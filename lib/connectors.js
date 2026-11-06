'use strict';
/**
 * lib/connectors.js — inventory connector: pull/sync a merchant's catalog from
 * a remote feed (or a manual payload) and keep it fresh on a schedule.
 * ZERO DEPENDENCIES (global fetch for the pull adapter).
 *
 * Implements INVENTORY-AUTOMATION-SPEC §1:
 *   merchant.connector = {
 *     adapter, url, interval_seconds, enabled,
 *     last_sync_at, last_status, last_error, last_counts
 *   }
 *
 * Every imported/updated product derives its negotiation config from the
 * merchant's CATEGORY RULE (falling back to the global 82% / 95%).
 * The scheduler is best-effort: failures are recorded on the connector and
 * never take the process down.
 */

const data = require('./data');
const catalog = require('./catalog');
const adapters = require('./adapters');

const round = (n) => Math.round(n);
const FETCH_TIMEOUT_MS = adapters.FETCH_TIMEOUT_MS; // 5000 (ADAPTER-SPEC §2)
const MAX_ERRORS = 50;
const INVENTORY_ADAPTERS = adapters.INVENTORY_ADAPTERS;
/** Adapters the scheduler may pull unattended. The rest are manual-only. */
const AUTO_PULL_ADAPTERS = new Set(['feed']);

const CONNECTOR_TICK_MS = (() => {
  const raw = Number(process.env.CONNECTOR_TICK_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 60000;
})();

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// ---------------------------------------------------------------- connector --
/** Ensure a merchant always has a well-formed connector record. */
function ensureConnector(merchant) {
  if (!merchant.connector || typeof merchant.connector !== 'object') {
    merchant.connector = data.baseConnector();
  }
  const c = merchant.connector;
  if (!c.last_counts || typeof c.last_counts !== 'object') {
    c.last_counts = { imported: 0, updated: 0, skipped: 0 };
  }
  if (!c.last_status) c.last_status = 'never';
  if (c.last_error === undefined) c.last_error = null;
  if (c.last_sync_at === undefined) c.last_sync_at = null;
  return c;
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

/** Reject obvious loopback/private/link-local destinations (SSRF hardening). */
function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^0\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (/^(fc|fd|fe80)/i.test(h)) return true;
  return false;
}

/** Validate a remote connector URL and block private-network fetches. */
function assertFetchableUrl(value) {
  if (!isHttpUrl(value)) {
    throw httpError(400, 'INVALID_URL', 'url must be an http(s) URL for the feed adapter');
  }
  if (process.env.CONNECTOR_ALLOW_PRIVATE === '1') return;
  let parsed;
  try { parsed = new URL(value.trim()); } catch { throw httpError(400, 'INVALID_URL', 'url is not valid'); }
  if (isPrivateHost(parsed.hostname)) {
    throw httpError(400, 'INVALID_URL', 'private, loopback and link-local connector hosts are blocked');
  }
}

/** Next due instant for a connector (ISO) or null when it cannot be due. */
function dueAt(connector) {
  if (!connector || connector.enabled !== true) return null;
  const interval = Number(connector.interval_seconds);
  if (!Number.isFinite(interval) || interval <= 0) return null;
  const last = connector.last_sync_at ? Date.parse(connector.last_sync_at) : NaN;
  const base = Number.isFinite(last) ? last : Date.now();
  return new Date(base + interval * 1000).toISOString();
}

function isDue(connector, now = Date.now()) {
  if (!connector || connector.enabled !== true) return false;
  const interval = Number(connector.interval_seconds);
  if (!Number.isFinite(interval) || interval <= 0) return false;
  const last = connector.last_sync_at ? Date.parse(connector.last_sync_at) : NaN;
  if (!Number.isFinite(last)) return true; // never synced -> due now
  return now >= last + interval * 1000;
}

/** GET /api/merchants/:id/connector → {connector, due_at, categories}. */
function getConnector(merchantId) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const connector = ensureConnector(merchant);
  return {
    connector: data.clone(connector),
    due_at: dueAt(connector),
    categories: catalog.ruleCategories(merchantId),
  };
}

/**
 * Validate a (partial) connector update merged over the current config.
 * URL must be http(s), interval 60–86400, enabled boolean, known adapter.
 */
function validateConnectorInput(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw httpError(400, 'INVALID_CONNECTOR', 'body must be an object');
  }
  const next = { ...(current || data.baseConnector()) };

  if (input.adapter !== undefined) {
    const adapter = typeof input.adapter === 'string' ? input.adapter.trim().toLowerCase() : '';
    if (!INVENTORY_ADAPTERS.includes(adapter)) {
      throw httpError(
        400,
        'INVALID_ADAPTER',
        `adapter must be one of: ${INVENTORY_ADAPTERS.join(', ')}`
      );
    }
    next.adapter = adapter;
  }

  if (input.interval_seconds !== undefined) {
    const interval = Number(input.interval_seconds);
    if (!Number.isFinite(interval) || interval < 60 || interval > 86400) {
      throw httpError(400, 'INVALID_INTERVAL', 'interval_seconds must be between 60 and 86400');
    }
    next.interval_seconds = Math.round(interval);
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') {
      throw httpError(400, 'INVALID_CONNECTOR', 'enabled must be a boolean');
    }
    next.enabled = input.enabled;
  }

  if (input.url !== undefined) {
    if (input.url !== null && typeof input.url !== 'string') {
      throw httpError(400, 'INVALID_URL', 'url must be an http(s) URL string');
    }
    const url = typeof input.url === 'string' ? input.url.trim() : '';
    if (url && !isHttpUrl(url)) {
      throw httpError(400, 'INVALID_URL', 'url must be an http(s) URL');
    }
    next.url = url;
  }

  // The pull adapter needs a pull URL whenever a sync could happen.
  const wantsPull = next.adapter === 'feed'
    && (input.url !== undefined || input.adapter !== undefined || input.enabled === true);
  if (wantsPull && !isHttpUrl(next.url)) {
    throw httpError(400, 'INVALID_URL', 'url must be an http(s) URL for the feed adapter');
  }

  return next;
}

/** PUT /api/merchants/:id/connector → {connector, due_at, categories}. */
function putConnector(merchantId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const current = ensureConnector(merchant);
  const next = validateConnectorInput(body, current);
  // Preserve the last-sync bookkeeping; PUT only changes the source config.
  next.last_sync_at = current.last_sync_at !== undefined ? current.last_sync_at : null;
  next.last_status = current.last_status || 'never';
  next.last_error = current.last_error !== undefined ? current.last_error : null;
  next.last_counts = current.last_counts && typeof current.last_counts === 'object'
    ? current.last_counts
    : { imported: 0, updated: 0, skipped: 0 };
  merchant.connector = next;
  return {
    connector: data.clone(next),
    due_at: dueAt(next),
    categories: catalog.ruleCategories(merchantId),
  };
}

// ------------------------------------------------------- payload extraction --
function rowsFromBody(adapter, body) {
  const raw = body.data;

  if (adapter === 'csv') {
    const text = typeof raw === 'string' ? raw : raw && raw.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw httpError(400, 'INVALID_REQUEST', 'body.data must be CSV text');
    }
    return adapters.csvToRows(text);
  }

  let payload = raw;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      throw httpError(400, 'INVALID_JSON', 'body.data is not valid JSON');
    }
  }
  if (!payload) throw httpError(400, 'INVALID_REQUEST', 'body.data is required');
  const list = Array.isArray(payload) ? payload : payload.products;
  if (!Array.isArray(list)) {
    throw httpError(400, 'INVALID_REQUEST', 'body.data must be an array or { products: [...] }');
  }

  if (adapter === 'json') return list;

  if (adapter === 'shopify') {
    // Shopify product payload: price/sku live on the first variant.
    return list.map((p) => {
      const variant = (p.variants && p.variants[0]) || {};
      return {
        sku: variant.sku || p.handle || (p.id !== undefined ? String(p.id) : ''),
        name: p.title,
        price: variant.price,
        category: p.product_type,
        description: p.body_html,
      };
    });
  }

  if (adapter === 'woocommerce') {
    return list.map((p) => ({
      sku: p.sku || (p.id !== undefined ? String(p.id) : ''),
      name: p.name,
      price: p.price,
      category: p.categories && p.categories[0] ? p.categories[0].name : p.category,
      description: p.description,
    }));
  }

  return list;
}

/** Pull a remote JSON feed (array or {products:[...]}) with a hard 5s timeout. */
async function fetchFeed(url) {
  assertFetchableUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    if (!res.ok) {
      throw httpError(502, 'ADAPTER_FETCH_FAILED', `feed returned ${res.status}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw httpError(502, 'ADAPTER_FETCH_FAILED', 'feed did not return JSON');
    }
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.products;
    if (!Array.isArray(list)) {
      throw httpError(502, 'ADAPTER_FETCH_FAILED', 'feed must be an array or { products: [...] }');
    }
    return list;
  } catch (err) {
    if (err && err.code) throw err;
    const reason = err && err.name === 'AbortError'
      ? `timed out after ${FETCH_TIMEOUT_MS}ms`
      : (err && err.message) || 'unknown error';
    throw httpError(502, 'ADAPTER_FETCH_FAILED', `feed fetch failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------- import --
function findExisting(merchant, sku) {
  if (!sku) return null;
  return (
    (merchant.products || []).find(
      (p) => (p.sku && String(p.sku) === String(sku)) || String(p.id) === String(sku)
    ) || null
  );
}

/**
 * Import/patch a merchant's catalog. Same normalized shape and upsert rules as
 * the adapter layer, except negotiation configs are derived from the CATEGORY
 * RULE (explicit adapter negotiation columns still win, then are validated).
 *
 * @param {string} merchantId
 * @param {{adapter:string, data?:any, url?:string}} body
 */
async function importInto(merchantId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);

  const adapter = typeof body.adapter === 'string' ? body.adapter.trim().toLowerCase() : '';
  if (!INVENTORY_ADAPTERS.includes(adapter)) {
    throw httpError(
      400,
      'INVALID_ADAPTER',
      `body.adapter must be one of: ${INVENTORY_ADAPTERS.join(', ')}`
    );
  }

  const rows = adapter === 'feed' ? await fetchFeed(body.url) : rowsFromBody(adapter, body);

  const errors = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  rows.forEach((raw, index) => {
    const row = adapters.normalizeRow(raw || {});
    const fail = (message) => {
      skipped += 1;
      if (errors.length < MAX_ERRORS) errors.push({ index, sku: row.sku || null, message });
    };

    if (!row.name) return fail('name is required');
    if (!Number.isFinite(row.price) || row.price <= 0) return fail('price must be a positive number');

    const price = round(row.price);
    const category = row.category || 'Uncategorised';
    const rule = data.ruleFor(merchant, category);
    const existing = findExisting(merchant, row.sku);
    const explicit = row.negotiation || {};
    const hasExplicit = Object.keys(explicit).length > 0;

    let negotiation;
    try {
      if (!hasExplicit) {
        // No adapter negotiation columns: derive from the category rule.
        negotiation = catalog.deriveNegotiation(price, rule);
        const prev = existing && existing.negotiation;
        if (prev) {
          // Preserve merchant choices that are not price-derived.
          if (prev.negotiable === false) negotiation.negotiable = false;
          if (prev.listed === false) negotiation.listed = false;
          if (prev.terms) negotiation.terms = { ...prev.terms };
          if (prev.window && typeof prev.window === 'object') {
            negotiation.window = { ...prev.window };
          }
        }
      } else {
        // Explicit columns win; unsupplied fields are inherited then clamped so
        // a price move can never strand a bound outside the valid band.
        const base = existing && existing.negotiation
          ? { ...existing.negotiation }
          : catalog.deriveNegotiation(price, rule);
        negotiation = { ...base, ...explicit };
        const given = (key) => explicit[key] !== undefined;
        if (!given('sell_min') && negotiation.sell_min > price) negotiation.sell_min = price;
        if (!given('sell_max') && negotiation.sell_max > price) negotiation.sell_max = price;
        if (!given('publish_max') && (negotiation.publish_max === null
            || negotiation.publish_max === undefined
            || negotiation.publish_max > negotiation.sell_max)) {
          negotiation.publish_max = negotiation.sell_max;
        }
        if (!given('publish_min') && negotiation.publish_min > negotiation.sell_max) {
          negotiation.publish_min = negotiation.sell_max;
        }
        if (!given('auto_accept')) {
          negotiation.auto_accept = Math.min(
            Math.max(negotiation.auto_accept, negotiation.sell_min),
            negotiation.sell_max
          );
        }
      }
      catalog.validateNegotiation(negotiation, price);
    } catch (err) {
      return fail(err.message);
    }

    if (existing) {
      existing.name = row.name;
      existing.price = price;
      existing.category = category;
      if (row.sku) existing.sku = row.sku;
      if (row.description) existing.description = row.description;
      existing.negotiation = negotiation;
      catalog.touch(merchantId, existing.id);
      updated += 1;
      return undefined;
    }

    const product = {
      id: 'p_' + data.randHex(6),
      name: row.name,
      price,
      description: row.description || '',
      category,
      negotiation,
    };
    if (row.sku) product.sku = row.sku;
    merchant.products.push(product);
    catalog.touch(merchantId, product.id);
    imported += 1;
    return undefined;
  });

  const view = catalog.catalogFor(merchantId);
  return {
    adapter,
    imported,
    updated,
    skipped,
    // Expose the connector-facing counts flattened too (handy for the panel).
    counts: { imported, updated, skipped },
    products: view.products,
    catalog: view,
    errors,
  };
}

// --------------------------------------------------------------------- sync --
/**
 * POST /api/merchants/:id/catalog/sync
 * Pull now using the saved connector config (or a body override) and update the
 * connector's status/counts. Returns {connector, sync}.
 */
async function syncNow(merchantId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const connector = ensureConnector(merchant);
  const source = body.source && typeof body.source === 'object' ? body.source : {};

  const adapterRaw = body.adapter !== undefined
    ? body.adapter
    : source.adapter !== undefined
      ? source.adapter
      : connector.adapter;
  const adapter = typeof adapterRaw === 'string' ? adapterRaw.trim().toLowerCase() : '';
  if (!INVENTORY_ADAPTERS.includes(adapter)) {
    throw httpError(400, 'INVALID_ADAPTER', `adapter must be one of: ${INVENTORY_ADAPTERS.join(', ')}`);
  }

  let payload;
  if (adapter === 'feed') {
    const url = body.url !== undefined ? body.url : source.url !== undefined ? source.url : connector.url;
    if (!isHttpUrl(url)) {
      throw httpError(
        400,
        'INVALID_URL',
        'feed sync needs an http(s) url (set it on the connector or pass body.url)'
      );
    }
    payload = { adapter, url };
  } else {
    const raw = body.data !== undefined ? body.data : source.data;
    if (raw === undefined || raw === null) {
      throw httpError(
        400,
        'INVALID_REQUEST',
        `adapter '${adapter}' is manual-only: pass body.data with the payload (or use the feed adapter for automatic pulls)`
      );
    }
    payload = { adapter, data: raw };
  }

  let result;
  try {
    result = await importInto(merchantId, payload);
  } catch (err) {
    connector.last_status = 'error';
    connector.last_error = (err && err.message) || 'sync failed';
    connector.last_counts = { imported: 0, updated: 0, skipped: 0 };
    throw err;
  }

  connector.last_sync_at = data.nowIso();
  connector.last_status = 'ok';
  connector.last_error = null;
  connector.last_counts = {
    imported: result.imported,
    updated: result.updated,
    skipped: result.skipped,
  };
  return { connector: data.clone(connector), sync: result };
}

// ---------------------------------------------------------------- scheduler --
let schedulerTimer = null;
let ticking = false;

/**
 * One scheduler pass: sync every enabled, due pull connector. Best-effort —
 * each merchant failure is recorded on its connector and swallowed.
 */
async function tick(now = Date.now()) {
  if (ticking) return { synced: [], skipped: true };
  ticking = true;
  const synced = [];
  try {
    for (const merchant of data.listMerchants()) {
      const connector = merchant.connector;
      if (!connector || connector.enabled !== true) continue;
      if (!AUTO_PULL_ADAPTERS.has(connector.adapter)) continue;
      if (!isDue(connector, now)) continue;
      try {
        const out = await syncNow(merchant.id);
        synced.push({ merchant_id: merchant.id, counts: out.connector.last_counts });
      } catch (err) {
        // syncNow already recorded last_status/last_error; never crash the tick.
        if (process.env.CONNECTOR_DEBUG) {
          console.warn(`[settled] connector sync failed for ${merchant.id}: ${err.message}`);
        }
      }
    }
  } finally {
    ticking = false;
  }
  return { synced, skipped: false };
}

/** Start the 60s inventory scheduler (timer is unref'd so it never traps exit). */
function startScheduler(intervalMs = CONNECTOR_TICK_MS) {
  const ms = Number.isFinite(intervalMs) && intervalMs >= 1000 ? intervalMs : CONNECTOR_TICK_MS;
  if (schedulerTimer) return schedulerTimer;
  schedulerTimer = setInterval(() => {
    tick().catch(() => {});
  }, ms);
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
  return schedulerTimer;
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  CONNECTOR_TICK_MS,
  FETCH_TIMEOUT_MS,
  INVENTORY_ADAPTERS,
  AUTO_PULL_ADAPTERS,
  ensureConnector,
  dueAt,
  isDue,
  getConnector,
  validateConnectorInput,
  putConnector,
  fetchFeed,
  importInto,
  syncNow,
  tick,
  startScheduler,
  stopScheduler,
};
