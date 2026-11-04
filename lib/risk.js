'use strict';
/**
 * lib/risk.js — Settled risk engine.
 * score -> tier -> fee_bps / cap / payment mode / reserve target.
 *
 * ZERO DEPENDENCIES. Pure functions over a merchant's canonical metrics.
 *
 * ---------------------------------------------------------------------------
 * DEVIATION FROM BUILD-SPEC §3 (documented deliberately, see README/task notes)
 * ---------------------------------------------------------------------------
 * The literal §3 formula (weights .30/.25/.15/.10/.12/.08 with dispute=rate*10,
 * chargeback=rate*50, volume=log10*25, age=days/365*50) yields 98 / 89 / 67 for
 * m1/m2/m3 — it CANNOT reproduce the §2 seed table (91 / 76 / 54), and it is
 * mathematically impossible to do so: m1's smallest component is 92.06, so no
 * convex combination of its components can fall to 91.
 *
 * Spec §3 explicitly permits tuning: "Tune the constants only if needed to match
 * the seed table exactly; the table is the acceptance test." We therefore keep
 * the exact same five component formulas and weighted-sum shape, and re-fit the
 * weights + the four scale constants so the seed table reproduces exactly.
 * Verified: m1=91/A, m2=76/B, m3=54/C, and all three tiers stay stable after a
 * create -> fulfill -> claim cycle (m2 visibly falls 76 -> 73).
 */

// --- Tuned constants (fit to the §2 seed table; see header note) ------------
const WEIGHTS = {
  delivered: 0.34,
  asDescribed: 0.15,
  dispute: 0.27,
  chargeback: 0.06,
  volume: 0.12,
  age: 0.06,
};

const SCALE = {
  volumeK: 15,     // volume   = min(100, log10(orders+1) * 15)
  ageK: 55,        // age      = min(100, age_days/365 * 55)
  disputeK: 35,    // dispute  = 100 - min(100, dispute_rate_pct * 35)
  chargebackK: 50, // chargeb. = 100 - min(100, chargeback_rate_pct * 50)
};

const TIER_RULES = [
  { tier: 'A', min: 85 },
  { tier: 'B', min: 70 },
  { tier: 'C', min: 50 },
  { tier: 'D', min: -Infinity },
];

const TIER_DERIVED = {
  A: { fee_bps: 35, cap: 5000, mode: 'instant', reserve_target: 10000 },
  B: { fee_bps: 90, cap: 2500, mode: 'reserve', reserve_target: 4000 },
  C: { fee_bps: 150, cap: 1000, mode: 'escrow', reserve_target: 1000 },
  D: { fee_bps: 0, cap: 0, mode: 'blocked', reserve_target: 0 },
};

const TIER_RANK = { A: 4, B: 3, C: 2, D: 1 };

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Dispute rate as a percentage of orders, 2dp (m1 seed -> 0.29). */
function disputeRatePct(merchant) {
  const m = merchant.metrics;
  return m.orders > 0 ? round2((m.disputes / m.orders) * 100) : 0;
}

/** Chargeback rate as a percentage of orders, 2dp (m1 seed -> 0.04). */
function chargebackRatePct(merchant) {
  const m = merchant.metrics;
  return m.orders > 0 ? round2((m.chargebacks / m.orders) * 100) : 0;
}

/** The six 0-100 risk components. */
function components(merchant) {
  const m = merchant.metrics;
  const dr = disputeRatePct(merchant);
  const cbr = chargebackRatePct(merchant);
  return {
    delivered: clamp(m.delivered_pct, 0, 100),
    asDescribed: clamp(m.as_described_pct, 0, 100),
    dispute: 100 - Math.min(100, dr * SCALE.disputeK),
    chargeback: 100 - Math.min(100, cbr * SCALE.chargebackK),
    volume: Math.min(100, Math.log10(m.orders + 1) * SCALE.volumeK),
    age: Math.min(100, (m.age_days / 365) * SCALE.ageK),
  };
}

/** Raw (unrounded) weighted score. */
function rawScore(merchant) {
  const c = components(merchant);
  return (
    WEIGHTS.delivered * c.delivered +
    WEIGHTS.asDescribed * c.asDescribed +
    WEIGHTS.dispute * c.dispute +
    WEIGHTS.chargeback * c.chargeback +
    WEIGHTS.volume * c.volume +
    WEIGHTS.age * c.age
  );
}

/** Rounded 0-100 score. */
function scoreOf(merchant) {
  return Math.round(clamp(rawScore(merchant), 0, 100));
}

function tierFor(score) {
  for (const rule of TIER_RULES) if (score >= rule.min) return rule.tier;
  return 'D';
}

function rankOf(tier) {
  return TIER_RANK[tier] || 0;
}

/** fee_bps / cap / mode / reserve_target for a tier. */
function derivedFor(tier) {
  return { ...TIER_DERIVED[tier] };
}

/** Full derived view of a merchant without mutating it. */
function evaluate(merchant) {
  const score = scoreOf(merchant);
  const tier = tierFor(score);
  return { score, tier, ...derivedFor(tier), components: components(merchant) };
}

/**
 * Recompute a merchant's derived fields in place.
 * Returns { previous, next, tier_changed, from, to, score }.
 * Emits nothing itself — caller (server) owns event emission, matching spec §3's
 * "appends tier-change events" while keeping this module side-effect free.
 */
function recompute(merchant) {
  const previous = { tier: merchant.tier, score: merchant.score };
  const next = evaluate(merchant);
  merchant.score = next.score;
  merchant.tier = next.tier;
  merchant.fee_bps = next.fee_bps;
  merchant.cap = next.cap;
  merchant.mode = next.mode;
  merchant.reserve_target = next.reserve_target;
  return {
    previous,
    next,
    score: next.score,
    tier: next.tier,
    tier_changed: previous.tier !== next.tier,
    from: previous.tier,
    to: next.tier,
  };
}

module.exports = {
  WEIGHTS,
  SCALE,
  TIER_DERIVED,
  TIER_RANK,
  disputeRatePct,
  chargebackRatePct,
  components,
  rawScore,
  scoreOf,
  tierFor,
  rankOf,
  derivedFor,
  evaluate,
  recompute,
};
