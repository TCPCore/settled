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

/**
 * Public inventory also requires an OPEN negotiation window
 * (product override → category rule). Closed offers never reach index/feed.
 */
function isVisible(merchant, product, now) {
  return isListed(product) && data.negotiationOpen(product, merchant, now);
}

// --- categories ------------------------------------------------------------
/** @returns {{categories:Array, total:number, product_total:number}} */
function categories() {
  const byId = new Map();
  for (const { merchant, product } of allListings()) {
    if (!isVisible(merchant, product)) continue;
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
const RANKINGS = {
  price: 'list price ascending',
  trust: 'merchant score descending, then list price ascending',
  value: 'published discount (price - published_min) / price, descending',
};

/** Discount implied by the PUBLIC published range only. Private floor never used. */
function publishedDiscount(product) {
  const pub = data.publicProduct(product);
  const price = Number(product.price);
  const publishedMin = Number(pub.published_range.min);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(publishedMin)) return 0;
  return (price - publishedMin) / price;
}

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
    // Public, price-free: lets the market show "negotiation open until …".
    negotiation_window: data.effectiveWindow(product, merchant),
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

  let rows = allListings().filter(({ merchant, product }) => isVisible(merchant, product));

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

  // Ranking. Never uses a private field: `value` derives from the PUBLISHED
  // minimum only, so a sort order cannot be used as a side channel for floors.
  const requestedSort = query.sort ? String(query.sort).toLowerCase().trim() : 'price';
  const sort = RANKINGS[requestedSort] ? requestedSort : 'price';

  const byPrice = (a, b) => Number(a.product.price) - Number(b.product.price);
  const tie = (a, b) => String(a.product.name).localeCompare(String(b.product.name));

  rows.sort((a, b) => {
    if (sort === 'trust') {
      const s = Number(b.merchant.score) - Number(a.merchant.score);
      if (s !== 0) return s;
      const d = byPrice(a, b);
      return d !== 0 ? d : tie(a, b);
    }
    if (sort === 'value') {
      const va = publishedDiscount(a.product);
      const vb = publishedDiscount(b.product);
      if (vb !== va) return vb - va;
      const d = byPrice(a, b);
      return d !== 0 ? d : tie(a, b);
    }
    const d = byPrice(a, b);
    return d !== 0 ? d : tie(a, b);
  });

  const total = rows.length;
  const items = rows.slice(0, limit).map(({ merchant, product }) => indexItem(merchant, product));

  return {
    items,
    total,
    ranking: { sort, basis: RANKINGS[sort] },
    filters: {
      category,
      q,
      budget,
      merchant: merchantFilter,
      limit,
      sort,
    },
  };
}

// --- catalog (merchant view) ----------------------------------------------
/** Full config incl. the private range. Merchant-facing only. */
function catalogProduct(product) {
  const pub = data.publicProduct(product);
  return {
    ...pub,
    // `sku` is the adapter upsert key — merchant view only, never in the feed.
    sku: product.sku !== undefined ? product.sku : null,
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
  // Item-level window override: {from: ISO|null, to: ISO|null}. Null means
  // "inherit the category window". Normalized in place for the stored config.
  if (neg.window !== undefined) {
    neg.window = validateWindowValue(neg.window, 'negotiation.window');
  }
  return true;
}

/**
 * Derive a negotiation config from a list price and (optionally) a category
 * rule. With no rule this is the historical global fallback: 82% / 95%.
 * New items/imports inherit the category rule; PATCH can override any field.
 */
function deriveNegotiation(price, rule) {
  const p = round(price);
  const r = rule && typeof rule === 'object' ? rule : null;
  const pct = (value, fallback) => (isNum(value) ? value : fallback);
  const sellMinPct = pct(r && r.sell_min_pct, 0.82);
  const autoPct = pct(r && r.auto_accept_pct, 0.95);
  const pubMinPct = r && isNum(r.publish_min_pct) ? r.publish_min_pct : null;
  const maxDiscount = pct(r && r.max_discount_pct, 18);
  const sellMin = Math.max(1, round(p * sellMinPct));
  const auto = Math.min(p, Math.max(sellMin, round(p * autoPct)));
  const publishMin = pubMinPct !== null
    ? Math.min(p, Math.max(sellMin, round(p * pubMinPct)))
    : Math.min(p, Math.max(sellMin, round(sellMin * 1.05)));
  return {
    negotiable: r && isBool(r.negotiable) ? r.negotiable : true,
    listed: true,
    sell_min: sellMin,
    sell_max: p,
    publish_min: publishMin,
    publish_max: p,
    auto_accept: auto,
    max_discount_pct: maxDiscount,
    terms: { ...DEFAULT_TERMS },
  };
}

// --- category rules (the merchant's policy) --------------------------------
const RULE_PCTS = ['sell_min_pct', 'auto_accept_pct', 'publish_min_pct'];

/** Extract/normalize a window field; throws 400 on a malformed window. */
function validateWindowValue(win, field) {
  if (win === null || win === undefined) return null;
  if (typeof win !== 'object' || Array.isArray(win)) {
    throw httpError(400, 'INVALID_WINDOW', `${field} must be an object {from,to} or null`);
  }
  const out = { from: null, to: null };
  for (const key of ['from', 'to']) {
    const value = win[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
      throw httpError(400, 'INVALID_WINDOW', `${field}.${key} must be an ISO timestamp or null`);
    }
    out[key] = new Date(Date.parse(value)).toISOString();
  }
  if (out.from && out.to && Date.parse(out.from) > Date.parse(out.to)) {
    throw httpError(400, 'INVALID_WINDOW', `${field}.from must be <= ${field}.to`);
  }
  return out;
}

/**
 * Validate (partial) category rule body merged over the current/default rule.
 * @returns normalized rule
 */
function validateCategoryRule(input, current) {
  if (input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input))) {
    throw httpError(400, 'INVALID_RULE', 'body must be an object');
  }
  const base = current && typeof current === 'object' ? current : data.DEFAULT_CATEGORY_RULE;
  const next = {
    negotiable: typeof base.negotiable === 'boolean' ? base.negotiable : true,
    sell_min_pct: isNum(base.sell_min_pct) ? base.sell_min_pct : 0.82,
    auto_accept_pct: isNum(base.auto_accept_pct) ? base.auto_accept_pct : 0.95,
    publish_min_pct: isNum(base.publish_min_pct) ? base.publish_min_pct : 0.86,
    max_discount_pct: isNum(base.max_discount_pct) ? base.max_discount_pct : 18,
    window: base.window && typeof base.window === 'object'
      ? data.normalizeWindow(base.window)
      : { from: null, to: null },
  };
  const body = input || {};

  if (body.negotiable !== undefined) {
    if (!isBool(body.negotiable)) {
      throw httpError(400, 'INVALID_RULE', 'negotiable must be a boolean');
    }
    next.negotiable = body.negotiable;
  }
  for (const key of RULE_PCTS) {
    if (body[key] === undefined) continue;
    if (!isNum(body[key]) || body[key] <= 0 || body[key] > 1) {
      throw httpError(400, 'INVALID_RULE', `${key} must be a number in (0,1]`);
    }
    next[key] = body[key];
  }
  if (body.max_discount_pct !== undefined) {
    if (!isNum(body.max_discount_pct) || body.max_discount_pct < 0 || body.max_discount_pct > 50) {
      throw httpError(400, 'INVALID_RULE', 'max_discount_pct must be between 0 and 50');
    }
    next.max_discount_pct = body.max_discount_pct;
  }
  if (body.window !== undefined) {
    next.window = validateWindowValue(body.window, 'window') || { from: null, to: null };
  }

  if (next.sell_min_pct < 0.5) {
    throw httpError(400, 'INVALID_RULE', 'sell_min_pct must be >= 0.5');
  }
  if (!(next.sell_min_pct < next.auto_accept_pct) || next.auto_accept_pct > 1) {
    throw httpError(
      400,
      'INVALID_RULE',
      'sell_min_pct must be < auto_accept_pct and auto_accept_pct must be <= 1'
    );
  }
  if (next.publish_min_pct < next.sell_min_pct) {
    throw httpError(400, 'INVALID_RULE', 'publish_min_pct must be >= sell_min_pct');
  }
  return next;
}

/** GET /api/merchants/:id/rules → {rules, categories}. */
function getRules(merchantId) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  return {
    rules: data.clone(merchant.category_rules || {}),
    categories: ruleCategories(merchantId),
  };
}

/** Category names usable as rule keys: declared rules first, then products. */
function ruleCategories(merchantId) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const names = new Set();
  for (const key of Object.keys(merchant.category_rules || {})) names.add(key);
  for (const product of merchant.products || []) {
    if (product.category) names.add(product.category);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/** PUT /api/merchants/:id/rules/:category → {rule, rules}. */
function putCategoryRule(merchantId, category, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const raw = typeof category === 'string' ? category.trim() : '';
  if (!raw) throw httpError(400, 'INVALID_RULE', 'category is required');

  if (!merchant.category_rules || typeof merchant.category_rules !== 'object') {
    merchant.category_rules = {};
  }
  const rules = merchant.category_rules;
  // Prefer an existing key (exact/case-insensitive/slug) so "audio" and
  // "Audio" address the same rule; otherwise use the caller's name verbatim.
  let key = data.ruleKeyFor(rules, raw);
  if (!key) {
    const productCategory = (merchant.products || []).find(
      (p) => p.category && data.categorySlug(p.category) === data.categorySlug(raw)
    );
    key = productCategory ? productCategory.category : raw;
  }
  const current = data.ruleKeyFor(rules, key) ? rules[data.ruleKeyFor(rules, key)] : null;
  const rule = validateCategoryRule(body, current);
  rules[key] = rule;
  return { rule: data.clone(rule), rules: data.clone(rules) };
}

/**
 * POST /api/merchants/:id/rules/apply {category?}
 * Re-derive sell/publish/auto for existing products from their current price
 * and the category rule; keeps listed/negotiable/terms, clears the item-level
 * window override so the product inherits the category window again.
 */
function applyRules(merchantId, body = {}) {
  const merchant = data.getMerchant(merchantId);
  if (!merchant) throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  const rules = merchant.category_rules || {};
  const rawCategory = typeof body.category === 'string' ? body.category.trim() : '';
  const wantedKey = rawCategory ? data.ruleKeyFor(rules, rawCategory) : null;
  if (rawCategory && !wantedKey) {
    throw httpError(404, 'RULE_NOT_FOUND', `no category rule for '${rawCategory}'`);
  }

  let applied = 0;
  let skipped = 0;
  const errors = [];
  for (const product of merchant.products || []) {
    let rule = null;
    if (rawCategory) {
      const matches = data.categorySlug(product.category) === data.categorySlug(rawCategory)
        || (wantedKey !== null && data.ruleKeyFor({ [wantedKey]: rules[wantedKey] }, product.category) !== null);
      if (!matches) continue;
      rule = rules[wantedKey];
    } else {
      rule = data.ruleFor(merchant, product.category);
    }
    if (!rule) {
      skipped += 1;
      continue;
    }
    const price = round(product.price);
    if (!(price > 0)) {
      skipped += 1;
      if (errors.length < 20) errors.push({ product_id: product.id, message: 'price must be a positive number' });
      continue;
    }
    const prev = product.negotiation && typeof product.negotiation === 'object' ? product.negotiation : {};
    const next = {
      ...prev,
      sell_min: Math.max(1, round(price * rule.sell_min_pct)),
      sell_max: price,
      publish_min: Math.min(price, Math.max(1, round(price * rule.publish_min_pct))),
      publish_max: price,
      auto_accept: Math.min(price, Math.max(1, round(price * rule.auto_accept_pct))),
      max_discount_pct: rule.max_discount_pct,
      // null = inherit the category window (product override cleared).
      window: null,
    };
    if (prev.negotiable === undefined) next.negotiable = rule.negotiable !== false;
    if (prev.listed === undefined) next.listed = true;
    if (!next.terms || typeof next.terms !== 'object') next.terms = { ...DEFAULT_TERMS };
    next.auto_accept = Math.min(next.sell_max, Math.max(next.sell_min, next.auto_accept));
    next.publish_min = Math.min(next.sell_max, Math.max(next.sell_min, next.publish_min));
    try {
      validateNegotiation(next, price);
    } catch (err) {
      skipped += 1;
      if (errors.length < 20) errors.push({ product_id: product.id, message: err.message });
      continue;
    }
    product.negotiation = next;
    touch(merchantId, product.id);
    applied += 1;
  }

  return {
    category: rawCategory || null,
    applied,
    updated: applied,
    skipped,
    errors,
    rules: data.clone(rules),
    products: (catalogFor(merchantId).products || []),
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

  // New items inherit the merchant's category rule for this category.
  const rule = data.ruleFor(merchant, category);
  const negotiation = body.negotiation
    ? { ...deriveNegotiation(price, rule), ...body.negotiation }
    : deriveNegotiation(price, rule);
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
  touch(merchantId, product.id);
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

  // Item-level negotiation window (also accepted top-level: {window:{from,to}}).
  // `null` clears the override so the product inherits its category window.
  if (body.window !== undefined) {
    const base = { ...(product.negotiation || deriveNegotiation(nextPrice)) };
    base.window = body.window;
    validateNegotiation(base, nextPrice);
    product.negotiation = base;
  }

  product.price = nextPrice;
  if (body.name !== undefined) product.name = body.name.trim();
  if (body.category !== undefined) product.category = body.category.trim() || 'Uncategorised';
  if (body.description !== undefined) product.description = String(body.description);

  touch(merchantId, product.id);
  return { product: catalogProduct(product), catalog: catalogFor(merchantId) };
}

// --- machine-readable feed (INDEX-FEED-SPEC) --------------------------------
const SCHEMA_VERSION = 'settled-index/1.0';
/** Process-boot timestamp: the fallback `updated_at` for untouched seed offers. */
const BOOT_AT = new Date().toISOString();
/** offer_id -> ISO timestamp, bumped on create/update/import. */
const UPDATED = new Map();

/** Stable, sortable id for an offer. Never reused across merchants. */
function offerId(merchantId, productId) {
  return `${merchantId}:${productId}`;
}

function updatedAtOf(merchantId, productId) {
  return UPDATED.get(offerId(merchantId, productId)) || BOOT_AT;
}

/** Record that an offer changed (drives `updated_at` and `updated_since`). */
function touch(merchantId, productId) {
  UPDATED.set(offerId(merchantId, productId), new Date().toISOString());
}

/** Clear the change clock (called on /api/reset). */
function resetUpdated() {
  UPDATED.clear();
}

function listedOffers() {
  return allListings().filter(({ merchant, product }) => isVisible(merchant, product));
}

function encodeCursor(value) {
  return Buffer.from(String(value), 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(String(cursor), 'base64').toString('utf8');
    // Cursors are opaque to clients; reject anything that isn't a plain offer id.
    return /^[A-Za-z0-9_.:-]+$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Discovery document for indexers/personal agents. */
function manifest() {
  const cats = categories();
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    agent_protocol: SCHEMA_VERSION,
    totals: {
      merchants: data.listMerchants().length,
      categories: cats.total,
      offers: listedOffers().length,
    },
    categories: cats.categories,
    endpoints: {
      feed: '/api/index/feed',
      search: '/api/index',
      negotiate: '/api/contracts',
      openapi: '/api/index/openapi.json',
    },
  };
}

/**
 * Cursor-paginated, stable feed of public offers.
 * Ordered by offer_id (NOT price) so pagination can never skip or duplicate.
 * Never emits sell_min / sell_max / auto_accept.
 */
function feed(query = {}) {
  const rawLimit = query.limit !== undefined && query.limit !== null && query.limit !== ''
    ? Number(query.limit)
    : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, Math.floor(rawLimit)) : 50;

  const category = query.category ? slug(query.category) : null;
  const merchantFilter = query.merchant ? String(query.merchant) : null;
  const updatedSince = query.updated_since ? Date.parse(query.updated_since) : NaN;
  const sinceMs = Number.isFinite(updatedSince) ? updatedSince : null;

  let rows = listedOffers();
  if (merchantFilter) rows = rows.filter(({ merchant }) => merchant.id === merchantFilter);
  if (category) rows = rows.filter(({ product }) => slug(product.category) === category);
  if (sinceMs !== null) {
    rows = rows.filter(({ merchant, product }) => Date.parse(updatedAtOf(merchant.id, product.id)) >= sinceMs);
  }

  rows.sort((a, b) => {
    const ia = offerId(a.merchant.id, a.product.id);
    const ib = offerId(b.merchant.id, b.product.id);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });

  const total = rows.length;
  const after = decodeCursor(query.cursor);
  const startIndex = after ? rows.findIndex(({ merchant, product }) => offerId(merchant.id, product.id) > after) : 0;
  const sliced = startIndex === -1 ? [] : rows.slice(startIndex, startIndex + limit);
  const hasMore = startIndex !== -1 && startIndex + limit < total;

  const items = sliced.map(({ merchant, product }) => {
    const pub = data.publicProduct(product);
    return {
      offer_id: offerId(merchant.id, product.id),
      merchant: {
        id: merchant.id,
        name: merchant.name,
        tier: merchant.tier,
        score: merchant.score,
        agent: merchant.agent ? merchant.agent.name : null,
      },
      product: {
        id: product.id,
        name: product.name,
        category: pub.category,
        price: product.price,
      },
      published_range: pub.published_range,
      terms: pub.terms,
      negotiation_window: data.effectiveWindow(product, merchant),
      protection: { fee_bps: merchant.fee_bps, cap: merchant.cap, mode: merchant.mode },
      negotiate_url: `/negotiate.html?merchant=${encodeURIComponent(merchant.id)}&product=${encodeURIComponent(product.id)}`,
      updated_at: updatedAtOf(merchant.id, product.id),
    };
  });

  const last = sliced[sliced.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor(offerId(last.merchant.id, last.product.id))
    : null;

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    next_cursor: nextCursor,
    total,
    filters: { category, merchant: merchantFilter, updated_since: query.updated_since || null, limit },
    items,
  };
}


module.exports = {
  slug,
  DEFAULT_TERMS,
  allListings,
  isListed,
  isVisible,
  categories,
  index,
  catalogProduct,
  catalogFor,
  AGENT_TONES,
  validateAgent,
  updateAgent,
  validateNegotiation,
  deriveNegotiation,
  validateWindowValue,
  validateCategoryRule,
  getRules,
  ruleCategories,
  putCategoryRule,
  applyRules,
  createProduct,
  updateProduct,
  SCHEMA_VERSION,
  offerId,
  updatedAtOf,
  touch,
  resetUpdated,
  manifest,
  feed,
};
