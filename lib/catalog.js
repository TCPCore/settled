'use strict';
/**
 * lib/catalog.js — merchant catalog, category index and negotiation config.
 * ZERO DEPENDENCIES.
 *
 * SECURITY BOUNDARY: a product's `sell_min` / `sell_max` / `auto_accept` are the
 * merchant's private reservation range. They live here and in lib/data.js only;
 * everything buyer-facing goes through `data.publicProduct()`.
 *
 * This module deliberately exposes the FULL negotiation config on the catalog
 * endpoints (merchant view) — the prototype has no auth, as the spec allows.
 */

const data = require('./data');

const round = (n) => Math.round(n);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const isBool = (b) => typeof b === 'boolean';

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/** URL-safe category id: 'Home & light' -> 'home-light'. */
function slug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEFAULT_TERMS = { delivery_days: 3, returns_days: 30, warranty_months: 12 };

// --- lookups ---------------------------------------------------------------
/** Every product across merchants, with its owning merchant attached. */
function allListings() {
  const out = [];
  for (const merchant of data.listMerchants()) {
    // A paused merchant agent is invisible to the demand side.
    if (merchant.agent && merchant.agent.enabled === false) continue;
    for (const product of merchant.products || []) {
      out.push({ merchant, product });
    }
  }
  return out;
}

/** Listed *and* negotiable products are the public inventory. */
function isListed(product) {
  const n = product.negotiation || {};
  return n.listed !== false && n.negotiable !== false;
}

// --- categories ------------------------------------------------------------
/** @returns {{categories:Array, total:number, product_total:number}} */
function categories() {
  const byId = new Map();
  for (const { product } of allListings()) {
    if (!isListed(product)) continue;
    const name = product.category || 'Uncategorised';
    const id = slug(name) || 'uncategorised';
    const pub = data.publicProduct(product);
    const min = pub.published_range.min;
    const max = pub.published_range.max;
    let entry = byId.get(id);
    if (!entry) {
      entry = { id, name, count: 0, min: Infinity, max: -Infinity };
      byId.set(id, entry);
    }
    entry.count += 1;
    if (isNum(min)) entry.min = Math.min(entry.min, min);
    if (isNum(max)) entry.max = Math.max(entry.max, max);
  }
  const list = Array.from(byId.values())
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: c.count,
      min: Number.isFinite(c.min) ? c.min : null,
      max: Number.isFinite(c.max) ? c.max : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const productTotal = list.reduce((sum, c) => sum + c.count, 0);
  return { categories: list, total: list.length, product_total: productTotal };
}

// --- index -----------------------------------------------------------------
function indexItem(merchant, product) {
  const pub = data.publicProduct(product);
  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      tier: merchant.tier,
      score: merchant.score,
      fee_bps: merchant.fee_bps,
      cap: merchant.cap,
      mode: merchant.mode,
      coverage: merchant.coverage !== undefined ? merchant.coverage : null,
    },
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      category: pub.category,
      description: pub.description,
    },
    published_range: pub.published_range,
    terms: pub.terms,
    protection: {
      fee_bps: merchant.fee_bps,
      cap: merchant.cap,
      mode: merchant.mode,
    },
    negotiate_url: `/negotiate.html?merchant=${encodeURIComponent(merchant.id)}&product=${encodeURIComponent(product.id)}`,
  };
}

/**
 * Public, filterable negotiation index.
 * @param {{category?:string, q?:string, budget?:string|number, merchant?:string, limit?:string|number}} query
 */
function index(query = {}) {
  const category = query.category ? slug(query.category) : null;
  const q = query.q ? String(query.q).toLowerCase().trim() : null;
  const merchantFilter = query.merchant ? String(query.merchant) : null;
  const budgetRaw = query.budget !== undefined && query.budget !== null && query.budget !== ''
    ? Number(query.budget)
    : null;
  const budget = budgetRaw !== null && Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : null;
  const limitRaw = query.limit !== undefined && query.limit !== null && query.limit !== ''
    ? Number(query.limit)
    : NaN;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 50;

  let rows = allListings().filter(({ product }) => isListed(product));

  if (merchantFilter) rows = rows.filter(({ merchant }) => merchant.id === merchantFilter);
  if (category) rows = rows.filter(({ product }) => slug(product.category) === category);
  if (q) {
    rows = rows.filter(({ merchant, product }) => {
      const hay = `${product.name} ${merchant.name} ${product.category || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (budget !== null) {
    rows = rows.filter(({ product }) => {
      const min = data.publicProduct(product).published_range.min;
      return isNum(min) && min <= budget;
    });
  }

  rows.sort((a, b) => {
    const d = Number(a.product.price) - Number(b.product.price);
    if (d !== 0) return d;
    return String(a.product.name).localeCompare(String(b.product.name));
  });

  const total = rows.length;
  const items = rows.slice(0, limit).map(({ merchant, product }) => indexItem(merchant, product));

  return {
    items,
    total,
    filters: {
      category,
      q,
      budget,
      merchant: merchantFilter,
      limit,
    },
  };
}

// --- catalog (merchant view) ----------------------------------------------
/** Full config incl. the private range. Merchant-facing only. */
function catalogProduct(product) {
  const pub = data.publicProduct(product);
  return {
    ...pub,
    negotiation: product.negotiation ? data.clone(product.negotiation) : null,
  };
}

function catalogFor(merchantId) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  return {
    merchant: {
      id: merchant.id,
      name: merchant.name,
      domain: merchant.domain,
      tier: merchant.tier,
      score: merchant.score,
      fee_bps: merchant.fee_bps,
      cap: merchant.cap,
      mode: merchant.mode,
      reserve: data.round2(merchant.reserve),
    },
    agent: merchant.agent ? data.clone(merchant.agent) : null,
    products: (merchant.products || []).map(catalogProduct),
  };
}

// --- merchant-native agent config -----------------------------------------
const AGENT_TONES = ['consultative', 'concise', 'warm', 'formal'];
const AGENT_NAME_MIN = 2;
const AGENT_NAME_MAX = 60;
const AGENT_GREETING_MAX = 200;

/**
 * Validate a (partial) agent config, merged over the current one.
 * Unknown fields are ignored; missing fields are preserved.
 */
function validateAgent(input, current) {
  if (!input || typeof input !== 'object') {
    throw httpError(400, 'INVALID_AGENT', 'body must be an object');
  }
  const next = { ...(current || {}) };

  if (input.name !== undefined) {
    if (typeof input.name !== 'string') {
      throw httpError(400, 'INVALID_AGENT', 'agent.name must be a string');
    }
    const name = input.name.trim();
    if (name.length < AGENT_NAME_MIN || name.length > AGENT_NAME_MAX) {
      throw httpError(
        400,
        'INVALID_AGENT',
        `agent.name must be ${AGENT_NAME_MIN}-${AGENT_NAME_MAX} characters`
      );
    }
    next.name = name;
  }

  if (input.tone !== undefined) {
    const tone = typeof input.tone === 'string' ? input.tone.trim().toLowerCase() : '';
    if (!AGENT_TONES.includes(tone)) {
      throw httpError(
        400,
        'INVALID_AGENT',
        `agent.tone must be one of: ${AGENT_TONES.join(', ')}`
      );
    }
    next.tone = tone;
  }

  if (input.greeting !== undefined) {
    if (typeof input.greeting !== 'string') {
      throw httpError(400, 'INVALID_AGENT', 'agent.greeting must be a string');
    }
    if (input.greeting.length > AGENT_GREETING_MAX) {
      throw httpError(400, 'INVALID_AGENT', `agent.greeting must be <= ${AGENT_GREETING_MAX} characters`);
    }
    next.greeting = input.greeting;
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') {
      throw httpError(400, 'INVALID_AGENT', 'agent.enabled must be a boolean');
    }
    next.enabled = input.enabled;
  }

  return next;
}

/** PATCH /api/merchants/:id/agent */
function updateAgent(merchantId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const next = validateAgent(body, merchant.agent || {});
  merchant.agent = next;
  return { agent: data.clone(next), merchant: data.publicMerchant(merchant) };
}

// --- validation ------------------------------------------------------------
/**
 * Validate a negotiation config against the list price.
 * Throws 400 with a precise message on the first violation.
 */
function validateNegotiation(neg, price) {
  if (!neg || typeof neg !== 'object') {
    throw httpError(400, 'INVALID_NEGOTIATION', 'body.negotiation must be an object');
  }
  if (neg.negotiable !== undefined && !isBool(neg.negotiable)) {
    throw httpError(400, 'INVALID_NEGOTIATION', 'negotiation.negotiable must be a boolean');
  }
  if (neg.listed !== undefined && !isBool(neg.listed)) {
    throw httpError(400, 'INVALID_NEGOTIATION', 'negotiation.listed must be a boolean');
  }

  const { sell_min: sellMin, sell_max: sellMax, auto_accept: auto, publish_min: pubMin } = neg;
  const pubMax = neg.publish_max;

  for (const [key, value] of [
    ['sell_min', sellMin],
    ['sell_max', sellMax],
    ['auto_accept', auto],
    ['publish_min', pubMin],
  ]) {
    if (!isNum(value)) {
      throw httpError(400, 'INVALID_NEGOTIATION', `negotiation.${key} must be a number`);
    }
  }
  if (pubMax !== null && pubMax !== undefined && !isNum(pubMax)) {
    throw httpError(400, 'INVALID_NEGOTIATION', 'negotiation.publish_max must be a number or null');
  }

  if (!(price > 0)) throw httpError(400, 'INVALID_PRICE', 'price must be greater than 0');
  if (!(sellMin > 0)) {
    throw httpError(400, 'INVALID_NEGOTIATION', 'negotiation.sell_min must be greater than 0');
  }
  if (sellMin > sellMax) {
    throw httpError(400, 'INVALID_NEGOTIATION', `sell_min (${sellMin}) must be <= sell_max (${sellMax})`);
  }
  if (sellMax > price) {
    throw httpError(400, 'INVALID_NEGOTIATION', `sell_max (${sellMax}) must be <= price (${price})`);
  }
  if (pubMin < sellMin) {
    throw httpError(400, 'INVALID_NEGOTIATION', `publish_min (${pubMin}) must be >= sell_min (${sellMin})`);
  }
  if (pubMax !== null && pubMax !== undefined) {
    if (pubMin > pubMax) {
      throw httpError(
        400,
        'INVALID_NEGOTIATION',
        `publish_min (${pubMin}) must be <= publish_max (${pubMax})`
      );
    }
    if (pubMax > sellMax) {
      throw httpError(400, 'INVALID_NEGOTIATION', `publish_max (${pubMax}) must be <= sell_max (${sellMax})`);
    }
  }
  if (auto < sellMin || auto > sellMax) {
    throw httpError(
      400,
      'INVALID_NEGOTIATION',
      `auto_accept (${auto}) must be between sell_min (${sellMin}) and sell_max (${sellMax})`
    );
  }
  if (!isNum(neg.max_discount_pct) || neg.max_discount_pct < 0 || neg.max_discount_pct > 50) {
    throw httpError(400, 'INVALID_NEGOTIATION', 'negotiation.max_discount_pct must be between 0 and 50');
  }
  if (neg.terms !== undefined) {
    const t = neg.terms;
    if (!t || typeof t !== 'object') {
      throw httpError(400, 'INVALID_NEGOTIATION', 'negotiation.terms must be an object');
    }
    for (const key of ['delivery_days', 'returns_days', 'warranty_months']) {
      if (t[key] !== undefined && (!isNum(t[key]) || t[key] < 0)) {
        throw httpError(400, 'INVALID_NEGOTIATION', `negotiation.terms.${key} must be a positive number`);
      }
    }
  }
  return true;
}

/** Derive a sane default negotiation config from a list price. */
function deriveNegotiation(price) {
  const p = round(price);
  const sellMin = round(p * 0.82);
  return {
    negotiable: true,
    listed: true,
    sell_min: sellMin,
    sell_max: p,
    publish_min: round(sellMin * 1.05),
    publish_max: p,
    auto_accept: round(p * 0.95),
    max_discount_pct: 18,
    terms: { ...DEFAULT_TERMS },
  };
}

// --- mutations -------------------------------------------------------------
/** POST /api/merchants/:id/catalog */
function createProduct(merchantId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw httpError(400, 'INVALID_REQUEST', 'body.name is required');

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw httpError(400, 'INVALID_PRICE', 'body.price must be a positive number');
  }

  const category = typeof body.category === 'string' && body.category.trim()
    ? body.category.trim()
    : 'Uncategorised';

  const negotiation = body.negotiation
    ? { ...deriveNegotiation(price), ...body.negotiation }
    : deriveNegotiation(price);
  // Keep the invariant that the ceiling can never exceed the list price.
  negotiation.sell_max = round(negotiation.sell_max);
  validateNegotiation(negotiation, round(price));

  const product = {
    id: 'p_' + data.randHex(6),
    name,
    price: round(price),
    description: typeof body.description === 'string' ? body.description : '',
    category,
    negotiation,
  };
  merchant.products.push(product);
  return { product: catalogProduct(product), catalog: catalogFor(merchantId) };
}

/** PATCH /api/merchants/:id/catalog/:productId */
function updateProduct(merchantId, productId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const product = data.getProduct(merchant, productId);
  if (!product) {
    throw httpError(404, 'PRODUCT_NOT_FOUND', `no product '${productId}' for merchant '${merchantId}'`);
  }

  // Scalar fields first (price participates in negotiation validation).
  let nextPrice = round(product.price);
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw httpError(400, 'INVALID_PRICE', 'body.price must be a positive number');
    }
    nextPrice = round(price);
  }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw httpError(400, 'INVALID_REQUEST', 'body.name must be a non-empty string');
    }
  }
  if (body.category !== undefined && typeof body.category !== 'string') {
    throw httpError(400, 'INVALID_REQUEST', 'body.category must be a string');
  }

  if (body.negotiation !== undefined) {
    if (!body.negotiation || typeof body.negotiation !== 'object') {
      throw httpError(400, 'INVALID_NEGOTIATION', 'body.negotiation must be an object');
    }
    const merged = { ...(product.negotiation || deriveNegotiation(nextPrice)), ...body.negotiation };
    validateNegotiation(merged, nextPrice);
    product.negotiation = merged;
  } else if (nextPrice !== round(product.price) && product.negotiation) {
    // Price change with no explicit negotiation: re-validate the existing config.
    validateNegotiation(product.negotiation, nextPrice);
  }

  product.price = nextPrice;
  if (body.name !== undefined) product.name = body.name.trim();
  if (body.category !== undefined) product.category = body.category.trim() || 'Uncategorised';
  if (body.description !== undefined) product.description = String(body.description);

  return { product: catalogProduct(product), catalog: catalogFor(merchantId) };
}

module.exports = {
  slug,
  DEFAULT_TERMS,
  allListings,
  isListed,
  categories,
  index,
  catalogProduct,
  catalogFor,
  AGENT_TONES,
  validateAgent,
  updateAgent,
  validateNegotiation,
  deriveNegotiation,
  createProduct,
  updateProduct,
};
