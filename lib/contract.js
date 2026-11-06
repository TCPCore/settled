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

/**
 * Buyer-facing projection: never exposes the merchant's private floor or
 * auto-accept price. The internal contract keeps them for policy enforcement.
 * Tests opt into the internal fields with E2E_ALLOW_PRIVATE_POLICY=1.
 */
function publicContract(contract) {
  if (!contract) return contract;
  const safe = data.clone(contract);
  if (process.env.E2E_ALLOW_PRIVATE_POLICY !== '1') delete safe.policy;
  return safe;
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
  if (merchant.agent && merchant.agent.enabled === false) {
    throw httpError(409, 'MERCHANT_AGENT_DISABLED', `merchant '${merchant.id}' has paused its negotiation agent`);
  }

  // Product-level negotiation policy. Falls back to the historical defaults when
  // a product carries no config (older data / fixtures).
  const cfg = product.negotiation && typeof product.negotiation === 'object' ? product.negotiation : null;
  if (cfg && cfg.negotiable === false) {
    throw httpError(
      409,
      'PRODUCT_NOT_NEGOTIABLE',
      `product '${product.id}' is listed as not negotiable`
    );
  }

  const list = round(product.price);
  const mandateIn = input.mandate && typeof input.mandate === 'object' ? input.mandate : {};
  const mandateMax = isNum(mandateIn.max) && mandateIn.max > 0 ? round(mandateIn.max) : list;
  const ttl = isNum(mandateIn.ttl_seconds) && mandateIn.ttl_seconds > 0
    ? Math.round(mandateIn.ttl_seconds)
    : DEFAULT_MANDATE_TTL_S;

  // Numbers come from the merchant's private config; never from the model or
  // the caller. p1 => floor 204, auto_accept 237.
  const floor = cfg && isNum(cfg.sell_min) ? round(cfg.sell_min) : round(list * FLOOR_PCT);
  const autoAccept = cfg && isNum(cfg.auto_accept) ? round(cfg.auto_accept) : round(list * AUTO_ACCEPT_PCT);
  const maxDiscount = cfg && isNum(cfg.max_discount_pct) ? cfg.max_discount_pct : MAX_DISCOUNT_PCT;
  const terms = cfg && cfg.terms && typeof cfg.terms === 'object' ? { ...cfg.terms } : { ...DEFAULT_TERMS };

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
      floor,
      auto_accept: autoAccept,
      max_discount_pct: maxDiscount,
    },
    mandate: {
      max: mandateMax,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    },
    terms,
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
  // A merchant may not invent an offer below its own private floor or above list.
  if (from === 'merchant' && price < contract.policy.floor) {
    throw httpError(
      400,
      'MERCHANT_OFFER_BELOW_FLOOR',
      `merchant offer ${price} is below the merchant's private floor`
    );
  }
  if (from === 'merchant' && price > contract.list_price) {
    throw httpError(
      400,
      'MERCHANT_OFFER_ABOVE_LIST',
      `merchant offer ${price} is above the list price ${contract.list_price}`
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

  // An acceptance must still satisfy the locked policy and the buyer mandate.
  if (price < contract.policy.floor) {
    throw httpError(409, 'PRICE_BELOW_FLOOR', `offer ${price} is below the merchant's private floor`);
  }
  if (price > contract.list_price) {
    throw httpError(409, 'PRICE_ABOVE_LIST', `offer ${price} is above the list price ${contract.list_price}`);
  }
  if (price > contract.mandate.max) {
    throw httpError(400, 'MANDATE_EXCEEDED', `offer ${price} exceeds mandate max ${contract.mandate.max}`);
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

  // --- dialogue identities (agent-to-agent, judge-facing) ------------------
  const agentSeed = passport.getAgentSeed(contract.buyer_agent_id) || {};
  const buyerName = agentSeed.name || contract.buyer_agent_id;
  const buyerOperator = (agentSeed.operator && agentSeed.operator.legal_name) || 'Unknown operator';
  const merchant = data.getMerchant(contract.merchant_id) || {};
  const merchantName = merchant.name || contract.merchant_id;
  // Merchant-native agent identity is merchant-configurable (PATCH /agent).
  const configuredAgentName =
    merchant.agent && typeof merchant.agent.name === 'string' ? merchant.agent.name.trim() : '';
  const merchantAgentName = configuredAgentName || `${merchantName} Seller Agent`;
  const autoAccept = Number(contract.policy.auto_accept);

  const dialogue = [];
  const buyerEntry = (roundNo, action, price, message, rationale) => ({
    round: roundNo,
    from: 'buyer_agent',
    agent: buyerName,
    operator: buyerOperator,
    action,
    price,
    message,
    rationale,
    policy: 'within_buyer_mandate',
  });
  const merchantEntry = (roundNo, action, price, message, rationale) => ({
    round: roundNo,
    from: 'merchant_agent',
    agent: merchantAgentName,
    operator: merchantName,
    action,
    price,
    message,
    rationale,
    policy: 'auto_accept_price',
  });

  // One model call produces the opening offer + all surrounding prose.
  const plan = await ai.planNegotiation({ contract });
  const opening = record(1, {
    used: plan.used,
    provider: plan.provider,
    model: plan.model,
    action: 'offer',
    price: plan.opening_price,
    message: plan.opening_message,
    rationale: plan.opening_rationale,
    ...(plan.error ? { error: plan.error } : {}),
  });

  dialogue.push(buyerEntry(1, 'offer', opening.price, opening.message, opening.rationale));

  let result = offer(id, {
    from: 'buyer',
    price: opening.price,
    note: opening.message,
    counter: autoAccept,
  });

  if (result.decision === 'accepted') {
    // Opening already met the seller's published price: offer -> accept, no counter.
    dialogue.push(
      merchantEntry(
        1,
        'accept',
        contract.agreed_price,
        `Accepted at $${contract.agreed_price} — that clears our published price.`,
        'Opening offer already met the seller auto-accept price, so no counter was needed.'
      )
    );
  } else if (result.decision === 'countered') {
    // Merchant counter PRICE is policy-fixed; only the prose came from the model.
    dialogue.push(
      merchantEntry(1, 'counter', autoAccept, plan.merchant_counter_message, plan.merchant_counter_rationale)
    );

    const standing = lastMerchantPrice(contract);
    if (standing !== null && standing <= contract.mandate.max) {
      const accepted = record(2, {
        used: plan.used,
        provider: plan.provider,
        model: plan.model,
        action: 'accept',
        price: standing,
        message: plan.accept_message,
        rationale: plan.accept_rationale,
      });
      accept(id, { from: 'buyer' });
      dialogue.push(buyerEntry(2, 'accept', standing, accepted.message, accepted.rationale));
    } else {
      offer(id, {
        from: 'buyer',
        price: plan.opening_price,
        note: plan.opening_message,
        counter: autoAccept,
      });
    }
  }

  // Policy guarantee: a demo contract must never be left hanging open.
  if (contract.status === 'open') {
    const standing = lastMerchantPrice(contract);
    if (standing !== null && standing <= contract.mandate.max) {
      accept(id, { from: 'buyer' });
      if (!dialogue.some((d) => d.from === 'buyer_agent' && d.action === 'accept')) {
        dialogue.push(
          buyerEntry(
            2,
            'accept',
            standing,
            `Accepting $${standing} — inside my signed mandate.`,
            'Standing merchant price is within the buyer mandate.'
          )
        );
      }
    }
  }

  contract.ai = { enabled: true, provider, model, used, moves, dialogue };
  return { contract, ai: contract.ai };
}

module.exports = {
  MAX_ROUNDS,
  FLOOR_PCT,
  AUTO_ACCEPT_PCT,
  DEFAULT_TERMS,
  store,
  getContract,
  publicContract,
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
