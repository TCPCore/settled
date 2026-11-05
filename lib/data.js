'use strict';
/**
 * lib/data.js — seed data, canonical metrics, in-memory store, reset.
 * ZERO DEPENDENCIES.
 *
 * Seed metrics are CANONICAL (§2). Derived fields (tier/score/fee_bps/cap/mode)
 * are computed by lib/risk.js and must equal the seed table; `assertSeed()`
 * enforces that at boot and reset.
 */

const risk = require('./risk');

// --- inventory automation seeds (INVENTORY-AUTOMATION-SPEC §1–§3) ----------
/**
 * Default connector for every merchant: present but disabled so a boot never
 * reaches out to the network. `feed` is the automatic (scheduler) adapter;
 * json/csv/shopify/woocommerce are manual-push adapters.
 */
function baseConnector() {
  return {
    adapter: 'feed',
    url: '',
    interval_seconds: 300,
    enabled: false,
    last_sync_at: null,
    last_status: 'never',
    last_error: null,
    last_counts: { imported: 0, updated: 0, skipped: 0 },
  };
}

/** Global fallback policy when a category has no explicit rule. */
const DEFAULT_CATEGORY_RULE = Object.freeze({
  negotiable: true,
  sell_min_pct: 0.82,
  auto_accept_pct: 0.95,
  publish_min_pct: 0.86,
  max_discount_pct: 18,
  window: Object.freeze({ from: null, to: null }),
});

/** A category rule with an always-open window so seed offers stay visible. */
function categoryRuleSeed() {
  return {
    negotiable: true,
    sell_min_pct: 0.82,
    auto_accept_pct: 0.95,
    publish_min_pct: 0.86,
    max_discount_pct: 18,
    window: { from: null, to: null },
  };
}

// --- §2 seed: products ------------------------------------------------------
const SEED_MERCHANTS = [
  {
    id: 'm1',
    name: 'Northwind Audio',
    domain: 'northwind.audio',
    country: 'US',
    category: 'Audio gear',
    reserve: 12500,
    coverage: 0.94,
    connector: baseConnector(),
    category_rules: { Audio: categoryRuleSeed() },
    agent: {
      name: 'Northwind Seller Agent',
      tone: 'consultative',
      greeting: 'Hi — I look after Northwind Audio orders. Happy to find a price that works for both of us.',
      enabled: true,
    },
    metrics: {
      orders: 4812,
      delivered_pct: 99.1,
      as_described_pct: 99.4,
      disputes: 14,
      chargebacks: 2,
      avg_delivery_days: 3.2,
      age_days: 1460,
    },
    // Acceptance test (§2 table) — derived values MUST equal these.
    expected: { tier: 'A', score: 91, fee_bps: 35, cap: 5000, mode: 'instant' },
    products: [
      {
        id: 'p1',
        name: 'Aurora One headphones',
        price: 249.0,
        description: 'Reference-grade over-ear headphones with adaptive noise shaping.',
        category: 'Audio',
        negotiation: {
          negotiable: true,
          listed: true,
          // PRIVATE: floor / ceiling. Never exposed by publicProduct().
          sell_min: 204,
          sell_max: 249,
          publish_min: 214,
          publish_max: 249,
          auto_accept: 237, // PRIVATE policy price
          max_discount_pct: 18,
          terms: { delivery_days: 3, returns_days: 30, warranty_months: 12 },
        },
      },
      {
        id: 'p2',
        name: 'Aurora Buds',
        price: 129.0,
        description: 'Compact wireless earbuds with 32-hour case life.',
        category: 'Audio',
        negotiation: {
          negotiable: true,
          listed: true,
          sell_min: 106,
          sell_max: 129,
          publish_min: 112,
          publish_max: 129,
          auto_accept: 123,
          max_discount_pct: 18,
          terms: { delivery_days: 3, returns_days: 30, warranty_months: 12 },
        },
      },
    ],
  },
  {
    id: 'm2',
    name: 'Lumen Supply',
    domain: 'lumensupply.co',
    country: 'US',
    category: 'Home & light',
    reserve: 4000,
    coverage: 0.88,
    connector: baseConnector(),
    category_rules: { Lighting: categoryRuleSeed() },
    agent: {
      name: 'Lumen Seller Agent',
      tone: 'warm',
      greeting: 'Welcome to Lumen Supply. Tell me what you need and I will see what I can do.',
      enabled: true,
    },
    metrics: {
      orders: 412,
      delivered_pct: 97.2,
      as_described_pct: 98.1,
      disputes: 6,
      chargebacks: 1,
      avg_delivery_days: 4.6,
      age_days: 520,
    },
    expected: { tier: 'B', score: 76, fee_bps: 90, cap: 2500, mode: 'reserve' },
    products: [
      {
        id: 'p3',
        name: 'Halo floor lamp',
        price: 189.0,
        description: 'Warm 2700K standing lamp with dimmable halo diffuser.',
        category: 'Lighting',
        negotiation: {
          negotiable: true,
          listed: true,
          sell_min: 155,
          sell_max: 189,
          publish_min: 162,
          publish_max: 189,
          auto_accept: 180,
          max_discount_pct: 18,
          terms: { delivery_days: 3, returns_days: 30, warranty_months: 12 },
        },
      },
      {
        id: 'p4',
        name: 'Halo desk lamp',
        price: 79.0,
        description: 'Compact task light with touch dimming and USB-C passthrough.',
        category: 'Lighting',
        negotiation: {
          negotiable: true,
          listed: true,
          sell_min: 65,
          sell_max: 79,
          publish_min: 68,
          publish_max: 79,
          auto_accept: 75,
          max_discount_pct: 18,
          terms: { delivery_days: 3, returns_days: 30, warranty_months: 12 },
        },
      },
    ],
  },
  {
    id: 'm3',
    name: 'Nova Finds',
    domain: 'novafinds.shop',
    country: 'US',
    category: 'Gadgets',
    reserve: 900,
    coverage: 0.62,
    connector: baseConnector(),
    category_rules: { Gadgets: categoryRuleSeed() },
    agent: {
      name: 'Nova Seller Agent',
      tone: 'concise',
      greeting: 'Nova Finds here. Straight to it — what is your best offer?',
      enabled: true,
    },
    metrics: {
      orders: 12,
      delivered_pct: 91.7,
      as_described_pct: 93.0,
      disputes: 1,
      chargebacks: 0,
      avg_delivery_days: 6.8,
      age_days: 45,
    },
    expected: { tier: 'C', score: 54, fee_bps: 150, cap: 1000, mode: 'escrow' },
    products: [
      {
        id: 'p5',
        name: 'Pocket projector',
        price: 159.0,
        description: 'Palm-sized 720p projector with HDMI and battery.',
        category: 'Gadgets',
        negotiation: {
          negotiable: true,
          listed: true,
          sell_min: 131,
          sell_max: 159,
          publish_min: 139,
          publish_max: 159,
          auto_accept: 151,
          max_discount_pct: 18,
          terms: { delivery_days: 3, returns_days: 30, warranty_months: 12 },
        },
      },
    ],
  },
];

const NETWORK_POOL_SEED = 25000;

// --- helpers ---------------------------------------------------------------
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const randHex = (bytes) => require('crypto').randomBytes(bytes).toString('hex');
const nowIso = () => new Date().toISOString();

/** Deep-clone JSON-ish data. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build one merchant record from its seed definition, deriving tier/score/fee/
 * cap/mode via risk.js and asserting the §2 acceptance table.
 */
function buildMerchant(seed) {
  const merchant = {
    id: seed.id,
    name: seed.name,
    domain: seed.domain,
    country: seed.country,
    category: seed.category,
    reserve: seed.reserve,
    coverage: seed.coverage,
    agent: clone(seed.agent || null),
    // Inventory automation (INVENTORY-AUTOMATION-SPEC): connector config and
    // the merchant's per-category negotiation policy. Cloned per merchant so a
    // reset always restores pristine seeds.
    connector: clone(seed.connector || baseConnector()),
    category_rules: clone(seed.category_rules || {}),
    reserve_target: 0,
    metrics: clone(seed.metrics),
    products: clone(seed.products),
    // derived, filled by risk.recompute below
    tier: 'D',
    score: 0,
    fee_bps: 0,
    cap: 0,
    mode: 'blocked',
    // bookkeeping used to advance delivered_pct on fulfill
    delivered_count: Math.round((seed.metrics.delivered_pct / 100) * seed.metrics.orders),
  };

  risk.recompute(merchant);

  const e = seed.expected;
  const problems = [];
  if (merchant.tier !== e.tier) problems.push(`tier ${merchant.tier} != ${e.tier}`);
  if (merchant.score !== e.score) problems.push(`score ${merchant.score} != ${e.score}`);
  if (merchant.fee_bps !== e.fee_bps) problems.push(`fee_bps ${merchant.fee_bps} != ${e.fee_bps}`);
  if (merchant.cap !== e.cap) problems.push(`cap ${merchant.cap} != ${e.cap}`);
  if (merchant.mode !== e.mode) problems.push(`mode ${merchant.mode} != ${e.mode}`);
  if (problems.length) {
    throw new Error(`[settled] seed mismatch for ${seed.id}: ${problems.join(', ')}`);
  }
  return merchant;
}

// --- state -----------------------------------------------------------------
/** The single mutable in-memory store. `reset()` replaces its contents. */
const state = {
  merchants: {},
  orders: [],
  events: [],
  claims: [],
  contracts: [], // negotiable contracts (lib/contract.js); cleared on reset
  network_pool: NETWORK_POOL_SEED,
  seq: 0,
  started_at: nowIso(),
};

function reset() {
  state.merchants = {};
  state.orders = [];
  state.events = [];
  state.claims = [];
  state.contracts = [];
  state.network_pool = NETWORK_POOL_SEED;
  state.seq = 0;
  state.started_at = nowIso();
  for (const seed of SEED_MERCHANTS) {
    state.merchants[seed.id] = buildMerchant(seed);
  }
  return state;
}

/** Boot with a clean seed. */
reset();

// --- accessors -------------------------------------------------------------
function listMerchants() {
  return Object.values(state.merchants);
}

function getMerchant(id) {
  return state.merchants[id] || null;
}

function getProduct(merchant, productId) {
  return (merchant.products || []).find((p) => p.id === productId) || null;
}

// --- category rules & negotiation windows ---------------------------------
/** URL-safe category id (mirrors catalog.slug; kept here to avoid a cycle). */
function categorySlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve the rules-object key for a category: exact name, then
 * case-insensitive name, then slug. Returns null when there is no rule.
 */
function ruleKeyFor(rules, category) {
  if (!rules || typeof rules !== 'object' || !category) return null;
  const name = String(category).trim();
  if (!name) return null;
  if (Object.prototype.hasOwnProperty.call(rules, name)) return name;
  const lower = name.toLowerCase();
  for (const key of Object.keys(rules)) {
    if (key.toLowerCase() === lower) return key;
  }
  const slug = categorySlug(name);
  for (const key of Object.keys(rules)) {
    if (categorySlug(key) === slug) return key;
  }
  return null;
}

/** The category rule applicable to a product, or null (global fallback). */
function ruleFor(merchant, category) {
  if (!merchant || !category) return null;
  const key = ruleKeyFor(merchant.category_rules, category);
  return key ? merchant.category_rules[key] : null;
}

/** Clamp an arbitrary window-ish value to `{from: ISO|null, to: ISO|null}`. */
function normalizeWindow(win) {
  if (!win || typeof win !== 'object') return null;
  return {
    from: win.from !== undefined && win.from !== null ? win.from : null,
    to: win.to !== undefined && win.to !== null ? win.to : null,
  };
}

/** True when `now` falls inside the window (null bounds are unbounded). */
function windowOpen(win, now = Date.now()) {
  if (!win || typeof win !== 'object') return true;
  const at = typeof now === 'number'
    ? now
    : Number.isFinite(Date.parse(now))
      ? Date.parse(now)
      : Date.now();
  const from = win.from ? Date.parse(win.from) : NaN;
  const to = win.to ? Date.parse(win.to) : NaN;
  if (Number.isFinite(from) && at < from) return false;
  if (Number.isFinite(to) && at > to) return false;
  return true;
}

/**
 * Effective negotiation window for a product: the item-level override wins,
 * otherwise the merchant's category rule, otherwise no window at all.
 */
function effectiveWindow(product, merchant) {
  const neg = product && product.negotiation;
  if (neg && neg.window && typeof neg.window === 'object') return normalizeWindow(neg.window);
  const rule = ruleFor(merchant, product && product.category);
  if (rule && rule.window && typeof rule.window === 'object') return normalizeWindow(rule.window);
  return null;
}

/** Convenience: is this product currently open for negotiation? */
function negotiationOpen(product, merchant, now) {
  return windowOpen(effectiveWindow(product, merchant), now);
}

function getOrder(orderId) {
  return state.orders.find((o) => o.id === orderId) || null;
}

function ordersFor(merchantId) {
  const list = merchantId
    ? state.orders.filter((o) => o.merchant_id === merchantId)
    : state.orders.slice();
  // newest first
  return list.sort((a, b) => {
    const t = Date.parse(b.created_at) - Date.parse(a.created_at);
    return t !== 0 ? t : String(b.id).localeCompare(String(a.id));
  });
}

function eventsFor(merchantId) {
  const list = merchantId
    ? state.events.filter((e) => e.merchant_id === merchantId)
    : state.events.slice();
  // seq desc
  return list.sort((a, b) => b.seq - a.seq);
}

/**
 * Public projection of a product. CRITICAL: strips the merchant's private
 * negotiation range (`sell_min`, `sell_max`, `auto_accept`). Anything served to
 * a buyer or agent must go through this function.
 */
function publicProduct(product) {
  const n = (product && product.negotiation) || {};
  const price = product && product.price;
  const pubMin = n.publish_min !== undefined && n.publish_min !== null ? n.publish_min : price;
  const pubMax = n.publish_max !== undefined && n.publish_max !== null ? n.publish_max : price;
  return {
    id: product.id,
    name: product.name,
    price,
    category: product.category || null,
    description: product.description || '',
    negotiable: n.negotiable !== false,
    listed: n.listed !== false,
    published_range: { min: pubMin, max: pubMax },
    terms: n.terms ? clone(n.terms) : null,
  };
}

/** Public projection of a merchant (§5 GET /api/merchants). */
function publicMerchant(merchant) {
  return {
    id: merchant.id,
    name: merchant.name,
    domain: merchant.domain,
    country: merchant.country,
    category: merchant.category,
    tier: merchant.tier,
    score: merchant.score,
    fee_bps: merchant.fee_bps,
    cap: merchant.cap,
    reserve: round2(merchant.reserve),
    coverage: merchant.coverage,
    agent: merchant.agent ? clone(merchant.agent) : null,
    mode: merchant.mode,
    reserve_target: merchant.reserve_target,
    metrics: {
      orders: merchant.metrics.orders,
      delivered_pct: merchant.metrics.delivered_pct,
      as_described_pct: merchant.metrics.as_described_pct,
      dispute_rate_pct: risk.disputeRatePct(merchant),
      chargeback_rate_pct: risk.chargebackRatePct(merchant),
      disputes: merchant.metrics.disputes,
      chargebacks: merchant.metrics.chargebacks,
      avg_delivery_days: merchant.metrics.avg_delivery_days,
      age_days: merchant.metrics.age_days,
    },
    products: (merchant.products || []).map(publicProduct),
  };
}

module.exports = {
  SEED_MERCHANTS,
  NETWORK_POOL_SEED,
  DEFAULT_CATEGORY_RULE,
  baseConnector,
  categoryRuleSeed,
  state,
  reset,
  listMerchants,
  getMerchant,
  getProduct,
  categorySlug,
  ruleKeyFor,
  ruleFor,
  normalizeWindow,
  windowOpen,
  effectiveWindow,
  negotiationOpen,
  getOrder,
  ordersFor,
  eventsFor,
  publicProduct,
  publicMerchant,
  clone,
  round2,
  randHex,
  nowIso,
};
