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
      },
      {
        id: 'p2',
        name: 'Aurora Buds',
        price: 129.0,
        description: 'Compact wireless earbuds with 32-hour case life.',
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
      },
      {
        id: 'p4',
        name: 'Halo desk lamp',
        price: 79.0,
        description: 'Compact task light with touch dimming and USB-C passthrough.',
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
    products: clone(merchant.products),
  };
}

module.exports = {
  SEED_MERCHANTS,
  NETWORK_POOL_SEED,
  state,
  reset,
  listMerchants,
  getMerchant,
  getProduct,
  getOrder,
  ordersFor,
  eventsFor,
  publicMerchant,
  clone,
  round2,
  randHex,
  nowIso,
};
