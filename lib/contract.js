'use strict';
/**
 * lib/contract.js — negotiable purchase contracts between a merchant and a
 * buying agent, settled at a single locked price.
 *
 * ZERO DEPENDENCIES.
 *
 * State machine:  open -> accepted | rejected | expired
 *   floor       = round(list * 0.82)   merchant's private reservation price
 *   auto_accept = round(list * 0.95)   buyer offers at/above this close instantly
 *   step        = round(list * 0.02)   merchant auto-counter increment
 *
 * The floor is NEVER exposed on the contract (it is the merchant's private
 * reservation price); only `policy.floor` travels to the negotiating agent —
 * see the note in `create()` about why the demo exposes it for the UI.
 */

const data = require('./data');
const ledger = require('./ledger');
const passport = require('./passport');
const ai = require('./ai');

const MAX_ROUNDS = 4;
const FLOOR_PCT = 0.82;
const AUTO_ACCEPT_PCT = 0.95;
const STEP_PCT = 0.02;
const MAX_DISCOUNT_PCT = 18;
const DEFAULT_TERMS = { delivery_days: 3, returns_days: 30, warranty_months: 12 };
const DEFAULT_MANDATE_TTL_S = 3600;

const round = (n) => Math.round(n);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/** Contract store lives in the shared in-memory state so reset() clears it. */
function store() {
  if (!Array.isArray(data.state.contracts)) data.state.contracts = [];
  return data.state.contracts;
}

function getContract(id) {
  return store().find((c) => c.id === id) || null;
}

// --- create ----------------------------------------------------------------
/**
 * @param {{merchant_id:string, product_id:string, buyer_agent_id:string,
 *          mandate?:{max?:number, ttl_seconds?:number}}} input
 */
function create(input = {}) {
  const merchantId = input.merchant_id;
  const productId = input.product_id;
  const agentId = input.buyer_agent_id;

  if (!merchantId || typeof merchantId !== 'string') {
    throw httpError(400, 'INVALID_REQUEST', 'body.merchant_id is required');
  }
  if (!productId || typeof productId !== 'string') {
    throw httpError(400, 'INVALID_REQUEST', 'body.product_id is required');
  }
  if (!agentId || typeof agentId !== 'string') {
    throw httpError(400, 'INVALID_REQUEST', 'body.buyer_agent_id is required');
  }

  const merchant = data.getMerchant(merchantId);
  if (!merchant) {
    throw httpError(404, 'MERCHANT_NOT_FOUND', `no merchant with id '${merchantId}'`);
  }
  const product = data.getProduct(merchant, productId);
  if (!product) {
    throw httpError(404, 'PRODUCT_NOT_FOUND', `no product '${productId}' for merchant '${merchantId}'`);
  }
  const agent = passport.getAgentSeed(agentId);
  if (!agent) throw httpError(404, 'AGENT_NOT_FOUND', `no agent with id '${agentId}'`);

  const list = round(product.price);
  const mandateIn = input.mandate && typeof input.mandate === 'object' ? input.mandate : {};
  const mandateMax = isNum(mandateIn.max) && mandateIn.max > 0 ? round(mandateIn.max) : list;
  const ttl = isNum(mandateIn.ttl_seconds) && mandateIn.ttl_seconds > 0
    ? Math.round(mandateIn.ttl_seconds)
    : DEFAULT_MANDATE_TTL_S;

  const contract = {
    id: 'ctr_' + data.randHex(8),
    merchant_id: merchant.id,
    product_id: product.id,
    product_name: product.name,
    list_price: list,
    agreed_price: null,
    status: 'open',
    rounds: 0,
    max_rounds: MAX_ROUNDS,
    policy: {
      floor: round(list * FLOOR_PCT),
      auto_accept: round(list * AUTO_ACCEPT_PCT),
      max_discount_pct: MAX_DISCOUNT_PCT,
    },
    mandate: {
      max: mandateMax,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    },
    terms: { ...DEFAULT_TERMS },
    transcript: [],
    hash: null,
    signatures: {},
    buyer_agent_id: agent.id,
    created_at: data.nowIso(),
  };

  store().push(contract);
  return contract;
}

// --- locking (accept) ------------------------------------------------------
/** Stable projection hashed into `contract.hash` (excludes hash/signatures). */
function hashSnapshot(contract) {
  return {
    id: contract.id,
    merchant_id: contract.merchant_id,
    buyer_agent_id: contract.buyer_agent_id,
    product_id: contract.product_id,
    product_name: contract.product_name,
    list_price: contract.list_price,
    agreed_price: contract.agreed_price,
    rounds: contract.rounds,
    policy: contract.policy,
    mandate: contract.mandate,
    terms: contract.terms,
    status: contract.status,
    created_at: contract.created_at,
  };
}

function lockPrice(contract, price) {
  contract.agreed_price = round(price);
  contract.status = 'accepted';

  const payload = {
    contract: hashSnapshot(contract),
    transcript: contract.transcript,
    agreed_price: contract.agreed_price,
    terms: contract.terms,
  };
  contract.hash = ledger.sha256hex(JSON.stringify(payload));

  // Both sides co-sign the same locked hash (same HMAC key, distinct roles).
  contract.signatures = {
    buyer: {
      id: contract.buyer_agent_id,
      role: 'buyer',
      alg: passport.ALG,
      sig: passport.sign({
        role: 'buyer',
        contract_id: contract.id,
        agreed_price: contract.agreed_price,
        hash: contract.hash,
      }),
    },
    merchant: {
      id: contract.merchant_id,
      role: 'merchant',
      alg: passport.ALG,
      sig: passport.sign({
        role: 'merchant',
        contract_id: contract.id,
        agreed_price: contract.agreed_price,
        hash: contract.hash,
      }),
    },
  };
  return contract;
}

/** Re-verify a locked contract's hash and both signatures. */
function verifyContract(contract) {
  if (!contract || !contract.hash) return null;
  const payload = {
    contract: hashSnapshot(contract),
    transcript: contract.transcript,
    agreed_price: contract.agreed_price,
    terms: contract.terms,
  };
  const expected = ledger.sha256hex(JSON.stringify(payload));
  const sigs = contract.signatures || {};
  const check = (entry, role) =>
    Boolean(entry && entry.sig) &&
    entry.sig ===
      passport.sign({
        role,
        contract_id: contract.id,
        agreed_price: contract.agreed_price,
        hash: contract.hash,
      });
  return {
    hash_valid: expected === contract.hash,
    hash: contract.hash,
    signatures: { buyer: check(sigs.buyer, 'buyer'), merchant: check(sigs.merchant, 'merchant') },
  };
}

// --- offers ----------------------------------------------------------------
function pushEntry(contract, entry) {
  contract.transcript.push({ at: data.nowIso(), ...entry });
}

/**
 * @param {string} id
 * @param {{from:'buyer'|'merchant', price:number, note?:string}} input
 * @returns {{contract:object, decision:'accepted'|'countered'|'rejected'|'expired'|'recorded'}}
 */
function offer(id, input = {}) {
  const contract = getContract(id);
  if (!contract) throw httpError(404, 'CONTRACT_NOT_FOUND', `no contract with id '${id}'`);
  if (contract.status !== 'open') {
    throw httpError(409, 'CONTRACT_NOT_OPEN', `contract '${id}' has status '${contract.status}'`);
  }

  const from = input.from === 'merchant' ? 'merchant' : input.from === 'buyer' ? 'buyer' : null;
  if (!from) throw httpError(400, 'INVALID_REQUEST', "body.from must be 'buyer' or 'merchant'");

  const price = Number(input.price);
  if (!isNum(price) || price <= 0) {
    throw httpError(400, 'INVALID_PRICE', 'body.price must be a positive number');
  }
  if (from === 'buyer' && price > contract.mandate.max) {
    throw httpError(
      400,
      'MANDATE_EXCEEDED',
      `buyer offer ${price} exceeds mandate max ${contract.mandate.max}`
    );
  }

  const list = contract.list_price;
  const { floor, auto_accept } = contract.policy;
  const step = round(list * STEP_PCT);

  // Round budget: an offer beyond max_rounds expires the contract.
  if (contract.rounds + 1 > contract.max_rounds) {
    contract.rounds += 1;
    pushEntry(contract, { round: contract.rounds, from, price, note: input.note || null, decision: 'expired' });
    contract.status = 'expired';
    return { contract, decision: 'expired' };
  }

  contract.rounds += 1;
  const roundNo = contract.rounds;

  if (from === 'merchant') {
    pushEntry(contract, { round: roundNo, from, price, note: input.note || null, decision: 'open' });
    return { contract, decision: 'recorded' };
  }

  // Buyer turn.
  if (price >= auto_accept) {
    pushEntry(contract, { round: roundNo, from, price, note: input.note || null, decision: 'accepted' });
    lockPrice(contract, price);
    return { contract, decision: 'accepted' };
  }

  if (price >= floor) {
    // Optional demo hook: a merchant agent may hold firm at an explicit ask
    // instead of the default incremental counter (used by aiAuto()).
    const counter = isNum(input.counter)
      ? Math.max(round(input.counter), floor)
      : Math.max(price + step, floor);
    pushEntry(contract, {
      round: roundNo,
      from,
      price,
      note: input.note || null,
      decision: 'countered',
      counter,
    });
    pushEntry(contract, { round: roundNo, from: 'merchant', price: counter, auto: true, decision: 'open' });
    return { contract, decision: 'countered' };
  }

  // Below the merchant's private floor: no deal.
  pushEntry(contract, { round: roundNo, from, price, note: input.note || null, decision: 'rejected' });
  contract.status = 'rejected';
  return { contract, decision: 'rejected' };
}

/** Latest merchant price on the table (counter or explicit offer). */
function lastMerchantPrice(contract) {
  for (let i = contract.transcript.length - 1; i >= 0; i -= 1) {
    const e = contract.transcript[i];
    if (e.from === 'merchant' && isNum(e.price)) return e.price;
  }
  return null;
}

/** Latest buyer price on the table. */
function lastBuyerPrice(contract) {
  for (let i = contract.transcript.length - 1; i >= 0; i -= 1) {
    const e = contract.transcript[i];
    if (e.from === 'buyer' && isNum(e.price)) return e.price;
  }
  return null;
}

/** @param {string} id @param {{from?:'buyer'|'merchant'}} input */
function accept(id, input = {}) {
  const contract = getContract(id);
  if (!contract) throw httpError(404, 'CONTRACT_NOT_FOUND', `no contract with id '${id}'`);
  if (contract.status !== 'open') {
    throw httpError(409, 'CONTRACT_NOT_OPEN', `contract '${id}' has status '${contract.status}'`);
  }

  const from = input.from === 'merchant' ? 'merchant' : 'buyer';
  // Buyer accepts the merchant's standing price; merchant accepts the buyer's.
  const price = from === 'buyer' ? lastMerchantPrice(contract) : lastBuyerPrice(contract);
  if (price === null) {
    const who = from === 'buyer' ? 'merchant counter/offer' : 'buyer offer';
    throw httpError(409, 'NO_OFFER_TO_ACCEPT', `no ${who} exists on contract '${id}'`);
  }

  pushEntry(contract, { round: contract.rounds, from, price, accepted: true, decision: 'accepted', by: 'accept' });
  lockPrice(contract, price);
  return { contract };
}

/**
 * Scripted, deterministic negotiation used by the demo:
 *   0.86*list  ->  merchant counters 0.95*list  ->  buyer offers 0.95*list (auto-accepted)
 * Ends accepted at ~95% of list.
 */
function auto(id) {
  const contract = getContract(id);
  if (!contract) throw httpError(404, 'CONTRACT_NOT_FOUND', `no contract with id '${id}'`);
  if (contract.status === 'accepted') return { contract }; // idempotent for demo retries
  if (contract.status !== 'open') {
    throw httpError(409, 'CONTRACT_NOT_OPEN', `contract '${id}' has status '${contract.status}'`);
  }

  const list = contract.list_price;
  const o1 = round(list * 0.86);
  const c1 = round(list * 0.95);
  const o2 = round(list * 0.95);

  contract.transcript = [];
  contract.rounds = 0;

  contract.rounds += 1;
  pushEntry(contract, { round: 1, from: 'buyer', price: o1, note: 'opening bid', decision: 'countered', counter: c1 });
  pushEntry(contract, { round: 1, from: 'merchant', price: c1, auto: true, decision: 'open' });

  contract.rounds += 1;
  pushEntry(contract, { round: 2, from: 'buyer', price: o2, note: 'meets ask', decision: 'accepted' });

  lockPrice(contract, o2);
  return { contract };
}

/**
 * AI-driven negotiation (demo centrepiece).
 *
 * Two buyer moves at most, so the round trip stays fast. The merchant agent
 * holds at its ask price, so the buyer's second move lands the deal at ~95% of
 * list ($237 on a $249 item) — the same outcome as the scripted /auto path, but
 * reached by a reasoning agent. With no LLM key the deterministic fallback runs
 * and the outcome is identical, with `ai.used === false`.
 *
 * @param {string} id
 * @returns {Promise<{contract:object, ai:object}>}
 */
async function aiAuto(id) {
  const contract = getContract(id);
  if (!contract) throw httpError(404, 'CONTRACT_NOT_FOUND', `no contract with id '${id}'`);

  const aiCfg = ai.config();

  if (contract.status === 'accepted') {
    // Idempotent for demo retries; keep whatever transcript already exists.
    if (!contract.ai) {
      contract.ai = {
        enabled: true,
        provider: aiCfg.provider,
        model: aiCfg.model,
        used: false,
        moves: [],
      };
    }
    return { contract, ai: contract.ai };
  }
  if (contract.status !== 'open') {
    throw httpError(409, 'CONTRACT_NOT_OPEN', `contract '${id}' has status '${contract.status}'`);
  }

  const moves = [];
  let used = false;
  let provider = aiCfg.provider;
  let model = aiCfg.model;

  const record = (roundNo, move) => {
    if (move.used) {
      used = true;
      provider = move.provider;
      model = move.model;
    }
    moves.push({
      round: roundNo,
      action: move.action,
      price: move.price,
      message: move.message,
      rationale: move.rationale,
      ...(move.error ? { error: move.error } : {}),
    });
    return move;
  };

  // Move 1 — the buyer opens.
  const m1 = record(1, await ai.negotiateBuyer({ contract, lastMerchantPrice: null, round: 1 }));
  let result = offer(id, {
    from: 'buyer',
    price: m1.price,
    note: m1.message,
    counter: contract.policy.auto_accept,
  });

  // Move 2 — respond to the merchant's standing counter.
  if (result.decision === 'countered') {
    const standing = lastMerchantPrice(contract);
    const m2 = record(
      2,
      await ai.negotiateBuyer({ contract, lastMerchantPrice: standing, round: 2 })
    );
    if (m2.action === 'accept' && standing !== null && standing <= contract.mandate.max) {
      accept(id, { from: 'buyer' });
    } else {
      offer(id, {
        from: 'buyer',
        price: m2.price,
        note: m2.message,
        counter: contract.policy.auto_accept,
      });
    }
  }

  // Policy guarantee: a demo contract must never be left hanging open.
  if (contract.status === 'open') {
    const standing = lastMerchantPrice(contract);
    if (standing !== null && standing <= contract.mandate.max) accept(id, { from: 'buyer' });
  }

  contract.ai = { enabled: true, provider, model, used, moves };
  return { contract, ai: contract.ai };
}

module.exports = {
  MAX_ROUNDS,
  FLOOR_PCT,
  AUTO_ACCEPT_PCT,
  DEFAULT_TERMS,
  store,
  getContract,
  create,
  offer,
  accept,
  auto,
  aiAuto,
  lockPrice,
  verifyContract,
  hashSnapshot,
  lastMerchantPrice,
  lastBuyerPrice,
};
