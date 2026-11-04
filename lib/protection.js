'use strict';
/**
 * lib/protection.js — prices buyer protection off the merchant's own risk
 * record. The same ledger that scores the merchant also decides what the
 * protection costs and what it covers.
 *
 * ZERO DEPENDENCIES.
 */

const risk = require('./risk');
const data = require('./data');

/** Coverage granted per payment mode, strongest (instant) first. */
const COVERAGE_BY_MODE = {
  instant: ['not_delivered', 'not_as_described', 'damaged', 'instant_payout'],
  reserve: ['not_delivered', 'not_as_described', 'damaged'],
  escrow: ['not_delivered', 'not_as_described'],
  blocked: [],
};

/** Always excluded, regardless of tier. */
const BASE_EXCLUSIONS = [
  'buyer_remorse',
  'counterfeit_not_reported',
  'damage_after_returns_window',
  'off_platform_settlement',
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Quote protection for an amount against a merchant.
 *
 * @param {{merchant_id:string, amount:number}} input
 * @returns {object} quote
 */
function quote(input = {}) {
  const merchantId = input.merchant_id;
  if (!merchantId || typeof merchantId !== 'string') {
    throw Object.assign(new Error('body.merchant_id is required'), {
      status: 400,
      code: 'INVALID_REQUEST',
    });
  }

  const merchant = data.getMerchant(merchantId);
  if (!merchant) {
    throw Object.assign(new Error(`no merchant with id '${merchantId}'`), {
      status: 404,
      code: 'MERCHANT_NOT_FOUND',
    });
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('body.amount must be a positive number'), {
      status: 400,
      code: 'INVALID_AMOUNT',
    });
  }

  const amountR = round2(amount);
  const fee_bps = merchant.fee_bps;
  const fee = round2((amountR * fee_bps) / 10000);
  const cap = merchant.cap; // hard ceiling on a single payout
  const mode = merchant.mode;
  const covered = round2(Math.min(amountR, cap));

  const coverage = (COVERAGE_BY_MODE[mode] || []).slice();
  const exclusions = BASE_EXCLUSIONS.slice();
  if (amountR > cap) exclusions.push('amount_over_cap');
  if (mode === 'blocked') exclusions.push('merchant_blocked');

  return {
    merchant_id: merchant.id,
    amount: amountR,
    fee_bps,
    fee,
    cap,
    mode,
    covered_amount: covered,
    coverage,
    reserve_source: 'merchant_reserve',
    reserve_target: merchant.reserve_target,
    reserve_current: round2(merchant.reserve),
    exclusions,
    tier: merchant.tier,
    score: merchant.score,
    // What the same purchase would cost the merchant in risk terms.
    effective_rate_pct: round2((fee / amountR) * 100),
    quoted_at: data.nowIso(),
  };
}

module.exports = { quote, COVERAGE_BY_MODE, BASE_EXCLUSIONS };
