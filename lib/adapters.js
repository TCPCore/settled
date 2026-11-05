'use strict';
/**
 * lib/adapters.js — inventory adapters: get a merchant's catalogue in from
 * whatever they already have (CSV, JSON, Shopify, WooCommerce, remote feed).
 * ZERO DEPENDENCIES (global fetch for the pull adapter).
 *
 * Every adapter normalizes to the same catalog product shape and goes through
 * the same validation + default-derivation as the manual catalog API, so an
 * import can never create an offer that the rest of the system can't price.
 */

const data = require('./data');
const catalog = require('./catalog');

const round = (n) => Math.round(n);
const FETCH_TIMEOUT_MS = 5000; // ADAPTER-SPEC §2: 5s timeout
const MAX_ERRORS = 50;

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// --- registry (ADAPTER-SPEC §1) -------------------------------------------
function registry() {
  return {
    schema_version: 'settled-adapters/1.0',
    inventory: [
      { id: 'csv', name: 'CSV upload', mode: 'push', status: 'ready' },
      { id: 'json', name: 'JSON payload', mode: 'push', status: 'ready' },
      { id: 'shopify', name: 'Shopify product payload', mode: 'payload', status: 'ready' },
      { id: 'woocommerce', name: 'WooCommerce product payload', mode: 'payload', status: 'ready' },
      { id: 'feed', name: 'Remote JSON feed', mode: 'pull', status: 'ready' },
    ],
    agents: [
      { id: 'rest', name: 'REST / OpenAPI', mode: 'rest', status: 'ready' },
      { id: 'mcp', name: 'MCP tool server', mode: 'mcp', status: 'roadmap' },
      { id: 'a2a', name: 'A2A agent card', mode: 'a2a', status: 'roadmap' },
    ],
    checkout: [
      { id: 'hosted', name: 'Hosted negotiated checkout', mode: 'hosted', status: 'ready' },
      { id: 'paypal-button', name: 'PayPal button at agreed amount', mode: 'paypal', status: 'ready' },
      { id: 'shopify-plugin', name: 'Shopify cart/draft order plugin', mode: 'plugin', status: 'roadmap' },
      { id: 'woocommerce-plugin', name: 'WooCommerce cart plugin', mode: 'plugin', status: 'roadmap' },
    ],
  };
}

const INVENTORY_ADAPTERS = ['csv', 'json', 'shopify', 'woocommerce', 'feed'];

// --- CSV (RFC-4180-ish: quoted fields, "" escapes, embedded newlines) ------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  // Drop trailing blank lines.
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function csvToRows(text) {
  const table = parseCsv(text);
  if (!table.length) return [];
  const headers = table[0].map((h) => String(h).trim().toLowerCase());
  return table.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = cells[i] !== undefined ? String(cells[i]).trim() : '';
    });
    return obj;
  });
}

// --- row normalization -----------------------------------------------------
const NUMERIC_NEG_KEYS = [
  'sell_min',
  'sell_max',
  'publish_min',
  'publish_max',
  'auto_accept',
  'max_discount_pct',
];

function pick(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return obj[key];
  }
  return undefined;
}

function truthy(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return undefined;
}

/** Turn an adapter row into {sku,name,price,category,description,negotiation}. */
function normalizeRow(raw) {
  const skuRaw = pick(raw, ['sku', 'id', 'handle']);
  const nameRaw = pick(raw, ['name', 'title', 'product_name']);
  const priceRaw = pick(raw, ['price', 'variant_price', 'amount']);
  const categoryRaw = pick(raw, ['category', 'product_type', 'type']);
  const descriptionRaw = pick(raw, ['description', 'body_html', 'body']);

  const negotiable = truthy(pick(raw, ['negotiable']));
  const listed = truthy(pick(raw, ['listed']));

  const negotiation = {};
  let hasNegotiation = false;
  for (const key of NUMERIC_NEG_KEYS) {
    const value = pick(raw, [key]);
    if (value !== undefined) {
      const n = Number(String(value).replace(/[^0-9.+-]/g, ''));
      if (Number.isFinite(n)) {
        negotiation[key] = key === 'publish_max' && String(value).trim() === '' ? null : n;
        hasNegotiation = true;
      }
    }
  }
  if (negotiable !== undefined) {
    negotiation.negotiable = negotiable;
    hasNegotiation = true;
  }
  if (listed !== undefined) {
    negotiation.listed = listed;
    hasNegotiation = true;
  }

  return {
    sku: skuRaw !== undefined ? String(skuRaw).trim() : '',
    name: nameRaw !== undefined ? String(nameRaw).trim() : '',
    price: priceRaw !== undefined ? Number(String(priceRaw).replace(/[^0-9.+-]/g, '')) : NaN,
    category: categoryRaw !== undefined ? String(categoryRaw).trim() : '',
    description: descriptionRaw !== undefined ? String(descriptionRaw) : '',
    negotiation: hasNegotiation ? negotiation : null,
  };
}

// --- per-adapter extraction ------------------------------------------------
function rowsFor(adapter, body) {
  const raw = body.data;

  if (adapter === 'csv') {
    const text = typeof raw === 'string' ? raw : raw && raw.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw httpError(400, 'INVALID_REQUEST', 'body.data must be CSV text');
    }
    return csvToRows(text);
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

async function fetchFeed(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw httpError(400, 'INVALID_REQUEST', 'body.url must be an http(s) URL for the feed adapter');
  }
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
    const reason = err && err.name === 'AbortError' ? `timed out after ${FETCH_TIMEOUT_MS}ms` : err.message;
    throw httpError(502, 'ADAPTER_FETCH_FAILED', `feed fetch failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

// --- import ----------------------------------------------------------------
function findExisting(merchant, sku) {
  if (!sku) return null;
  return (
    (merchant.products || []).find(
      (p) => (p.sku && String(p.sku) === sku) || String(p.id) === sku
    ) || null
  );
}

/**
 * Import/patch a merchant's catalog from an adapter payload.
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

  const rows = adapter === 'feed' ? await fetchFeed(body.url) : rowsFor(adapter, body);

  const errors = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  rows.forEach((raw, index) => {
    const row = normalizeRow(raw || {});
    const fail = (message) => {
      skipped += 1;
      if (errors.length < MAX_ERRORS) errors.push({ index, sku: row.sku || null, message });
    };

    if (!row.name) return fail('name is required');
    if (!Number.isFinite(row.price) || row.price <= 0) return fail('price must be a positive number');

    const price = round(row.price);
    const existing = findExisting(merchant, row.sku);

    // ADAPTER-SPEC §2: when the adapter supplies no negotiation columns, the
    // range is derived from the new price. Merchant preferences that are not
    // price-derived (flags, discount cap, terms) are preserved on upsert.
    const explicit = row.negotiation || {};
    const hasExplicit = Object.keys(explicit).length > 0;
    let negotiation;
    try {
      if (!hasExplicit) {
        negotiation = catalog.deriveNegotiation(price);
        const prev = existing && existing.negotiation;
        if (prev) {
          if (prev.negotiable === false) negotiation.negotiable = false;
          if (prev.listed === false) negotiation.listed = false;
          if (typeof prev.max_discount_pct === 'number') {
            negotiation.max_discount_pct = prev.max_discount_pct;
          }
          if (prev.terms) negotiation.terms = { ...prev.terms };
        }
      } else {
        // Explicit columns win; unsupplied fields are inherited then clamped so
        // a price move can never strand a bound outside the valid band.
        const base = existing && existing.negotiation
          ? { ...existing.negotiation }
          : catalog.deriveNegotiation(price);
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
      existing.category = row.category || existing.category || 'Uncategorised';
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
      category: row.category || 'Uncategorised',
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
    products: view.products,
    catalog: view,
    errors,
  };
}

/** Alias: POST /api/merchants/:id/catalog/sync with { source: { adapter, ... } }. */
async function syncFrom(merchantId, body = {}) {
  const source = body.source && typeof body.source === 'object' ? body.source : body;
  return importInto(merchantId, source);
}

module.exports = {
  FETCH_TIMEOUT_MS,
  INVENTORY_ADAPTERS,
  registry,
  parseCsv,
  csvToRows,
  normalizeRow,
  registryFor: registry,
  importInto,
  syncFrom,
};
