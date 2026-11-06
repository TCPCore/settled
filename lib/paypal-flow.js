'use strict';
/**
 * lib/paypal-flow.js — PayPal sandbox routes for the live checkout flow.
 *
 * ZERO DEPENDENCIES. Wired by server.js:
 *   if (url.pathname.startsWith('/api/paypal/') && paypalFlow.handle(req, res, url)) return;
 *
 * Routes (all POST, all JSON):
 *   POST /api/paypal/create-order  {order_id}                  -> {mode, paypal_order_id, approval_url, status}
 *   POST /api/paypal/capture       {order_id, paypal_order_id?} -> {mode, capture, capture_id, order}
 *   POST /api/paypal/refund        {order_id, amount?}          -> {mode, refund_id, status, amount}
 *
 * Invariants:
 *   - Never mutates the merchant reserve (claim owns reserve/pool accounting).
 *   - SIM returns `SIM-…` ids and a null approval_url; no network calls.
 *   - Provider failures are 502 PAYMENT_PROVIDER_ERROR and leave order state untouched.
 *   - Order state only flips to `paid` after a COMPLETED capture.
 */

const data = require('./data');
const ledger = require('./ledger');
const paypal = require('./paypal');

const MAX_BODY = 1024 * 1024; // 1 MiB — mirrors server.js

// ---------------------------------------------------------------- helpers --

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function fail(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(
          Object.assign(new Error('payload too large'), {
            status: 400,
            code: 'PAYLOAD_TOO_LARGE',
          })
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Parse a JSON body; returns {} for an empty body (mirrors server.js). */
async function readJson(req) {
  const raw = await readBody(req);
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw Object.assign(new Error('body is not valid JSON'), {
      status: 400,
      code: 'INVALID_JSON',
    });
  }
}

function returnUrlFor(req, order) {
  const base = process.env.PUBLIC_BASE_URL
    || `http://${(req.headers && req.headers.host) || `127.0.0.1:${Number(process.env.PORT || 4173)}`}`;
  return `${base.replace(/\/+$/, '')}/store.html?merchant=${encodeURIComponent(order.merchant_id)}`;
}

/** Pull the capture object out of a capture-order response. */
function captureDetails(raw) {
  const unit = raw && Array.isArray(raw.purchase_units) ? raw.purchase_units[0] : null;
  const captures = unit && unit.payments && Array.isArray(unit.payments.captures)
    ? unit.payments.captures
    : null;
  if (captures && captures.length && captures[0] && captures[0].id) {
    return { capture: captures[0], id: captures[0].id, status: captures[0].status || raw.status };
  }
  const id = raw && raw.id ? raw.id : null;
  return { capture: raw || null, id, status: (raw && raw.status) || null };
}

function orderOf(body) {
  return typeof body.order_id === 'string' && body.order_id ? data.getOrder(body.order_id) : null;
}

// ----------------------------------------------------------------- routes --

/**
 * POST /api/paypal/create-order — reuse the order's existing PayPal id or create one.
 * In live mode the order may still be `pending`; this route never marks it paid.
 */
async function create(req, res) {
  const body = await readJson(req);
  if (typeof body.order_id !== 'string' || !body.order_id) {
    return fail(res, 400, 'INVALID_REQUEST', 'body.order_id is required');
  }
  const order = orderOf(body);
  if (!order) {
    return fail(res, 404, 'ORDER_NOT_FOUND', `no order with id '${body.order_id}'`);
  }

  // Idempotent: an order that already has a PayPal id reuses it.
  if (order.payment_id) {
    let approvalUrl = order.approval_url || null;
    if (!approvalUrl && paypal.isLive()) {
      // The order was created by the order route; recover the approve link.
      let remote = null;
      try {
        remote = await paypal.getOrder(order.payment_id);
      } catch (err) {
        return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', `get order failed: ${err.message}`);
      }
      const links = (remote && Array.isArray(remote.links) ? remote.links : []).filter(Boolean);
      const link = links.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
      if (link) {
        approvalUrl = link.href;
        order.approval_url = approvalUrl;
      }
    }
    return sendJson(res, 200, {
      mode: paypal.mode(),
      paypal_order_id: order.payment_id,
      approval_url: approvalUrl,
      status: order.status === 'paid' ? 'COMPLETED' : 'CREATED',
      reused: true,
    });
  }

  let created;
  try {
    created = await paypal.createOrder({
      amount: order.amount,
      currency: 'USD',
      returnUrl: returnUrlFor(req, order),
    });
  } catch (err) {
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', `create order failed: ${err.message}`);
  }
  if (!created || !created.id) {
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', 'paypal create order returned no id');
  }

  // Persist the provider id before responding so a retry reuses it. This route
  // never marks an order paid — capture is the only transition to `paid`.
  order.payment_id = created.id;
  if (created.approval_url) order.approval_url = created.approval_url;
  return sendJson(res, 200, {
    mode: paypal.mode(),
    paypal_order_id: created.id,
    approval_url: created.approval_url || null,
    status: created.status || 'CREATED',
    reused: false,
  });
}

/**
 * POST /api/paypal/capture — capture the approved order and finalize the order row.
 * Idempotent when the order already has a capture_id (returns the stored capture).
 */
async function capture(req, res) {
  const body = await readJson(req);
  if (typeof body.order_id !== 'string' || !body.order_id) {
    return fail(res, 400, 'INVALID_REQUEST', 'body.order_id is required');
  }
  const order = orderOf(body);
  if (!order) {
    return fail(res, 404, 'ORDER_NOT_FOUND', `no order with id '${body.order_id}'`);
  }

  // Already captured: replay the stored result instead of double-charging.
  if (order.capture_id && order.status === 'paid') {
    return sendJson(res, 200, {
      mode: paypal.mode(),
      capture: {
        id: order.capture_id,
        status: 'COMPLETED',
        simulated: !paypal.isLive(),
      },
      capture_id: order.capture_id,
      order,
      already_captured: true,
    });
  }

  const paymentId =
    (typeof body.paypal_order_id === 'string' && body.paypal_order_id) || order.payment_id;
  if (!paymentId) {
    return fail(
      res,
      400,
      'INVALID_REQUEST',
      'order has no payment_id; call POST /api/paypal/create-order first'
    );
  }

  let raw;
  try {
    raw = await paypal.captureOrder(paymentId);
  } catch (err) {
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', `capture failed: ${err.message}`);
  }

  const details = captureDetails(raw);
  if (!details.id || details.status !== 'COMPLETED') {
    return fail(
      res,
      502,
      'PAYMENT_PROVIDER_ERROR',
      `capture not completed (status '${details.status || 'unknown'}')`
    );
  }

  order.payment_id = paymentId;
  order.status = 'paid';
  order.captured_at = data.nowIso();
  order.capture_id = details.id;

  ledger.appendEvent(order.merchant_id, 'payment_captured', {
    order_id: order.id,
    payment_id: paymentId,
    capture_id: details.id,
    amount: order.amount,
    status: details.status,
    mode: paypal.mode(),
    simulated: !paypal.isLive(),
  });

  return sendJson(res, 200, {
    mode: paypal.mode(),
    capture: details.capture,
    capture_id: details.id,
    order,
  });
}

/**
 * POST /api/paypal/refund — refund a captured payment (full by default).
 * Requires a capture_id; never mutates the reserve or order status.
 */
async function refund(req, res) {
  const body = await readJson(req);
  if (typeof body.order_id !== 'string' || !body.order_id) {
    return fail(res, 400, 'INVALID_REQUEST', 'body.order_id is required');
  }
  const order = orderOf(body);
  if (!order) {
    return fail(res, 404, 'ORDER_NOT_FOUND', `no order with id '${body.order_id}'`);
  }
  if (!order.capture_id) {
    return fail(
      res,
      409,
      'ORDER_NOT_CAPTURED',
      `order '${order.id}' has no capture_id; capture it first`
    );
  }

  const requested = body.amount === undefined || body.amount === null ? order.amount : Number(body.amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return fail(res, 400, 'INVALID_AMOUNT', 'body.amount must be a positive number');
  }
  const amount = data.round2(requested);
  if (amount > data.round2(order.amount) + 0.005) {
    return fail(
      res,
      400,
      'INVALID_AMOUNT',
      `body.amount ${amount} exceeds the captured amount ${order.amount}`
    );
  }

  let result;
  try {
    result = await paypal.refundCapture(order.capture_id, { amount, currency: 'USD' });
  } catch (err) {
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', `refund failed: ${err.message}`);
  }
  if (!result || !result.id) {
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', 'paypal refund returned no id');
  }

  return sendJson(res, 200, {
    mode: paypal.mode(),
    refund_id: result.id,
    status: result.status || 'COMPLETED',
    amount,
    order_id: order.id,
  });
}

// ------------------------------------------------------------------ router --

const ROUTES = {
  '/api/paypal/create-order': create,
  '/api/paypal/capture': capture,
  '/api/paypal/refund': refund,
};

/**
 * Handle a PayPal route. Returns true when the request was consumed (including
 * error responses) so server.js can `return`; false lets the normal router run.
 */
function handle(req, res, url) {
  const fn = url && url.pathname ? ROUTES[url.pathname] : null;
  if (!fn) return false;

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' });
    res.end(
      JSON.stringify({
        error: { code: 'METHOD_NOT_ALLOWED', message: `${url.pathname} accepts POST only` },
      })
    );
    return true;
  }

  Promise.resolve()
    .then(() => fn(req, res))
    .catch((err) => {
      if (res.writableEnded || res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      const status = err && err.status >= 400 && err.status < 500 ? err.status : 500;
      const code = (err && err.code) || (status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST');
      fail(res, status, code, (err && err.message) || 'internal error');
    });

  return true;
}

module.exports = { handle, create, capture, refund };
