'use strict';
/**
 * lib/ai.js — real LLM layer (OpenAI-compatible) with a deterministic fallback.
 *
 * ZERO DEPENDENCIES (global fetch, AbortController).
 *
 * Design rule: the MODEL never decides anything that matters on its own.
 * The server computes the allowed candidate prices, the contract policy
 * validates whatever the model returns, and every failure path degrades to a
 * deterministic decision with `used:false`. The demo therefore works identically
 * with no API key at all.
 *
 * Env: AI_PROVIDER (openai|none), AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT_MS
 */

const PROVIDER_ENV = (process.env.AI_PROVIDER || '').trim().toLowerCase();
const API_KEY = (process.env.AI_API_KEY || '').trim();
const MODEL = (process.env.AI_MODEL || 'gpt-4o-mini').trim();
const BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) > 0 ? Number(process.env.AI_TIMEOUT_MS) : 8000;

// Infer the provider when only a key is supplied (friendlier for the demo).
const PROVIDER = PROVIDER_ENV ? PROVIDER_ENV : API_KEY ? 'openai' : 'none';

const round = (n) => Math.round(n);

/** Public config — never includes the API key. */
function config() {
  const enabled = available();
  return {
    enabled,
    provider: PROVIDER === 'openai' ? 'openai' : 'none',
    model: enabled ? MODEL : null,
    base_url: BASE_URL,
    timeout_ms: TIMEOUT_MS,
  };
}

function available() {
  return PROVIDER === 'openai' && Boolean(API_KEY);
}

/** reset() is a no-op: there is no per-process AI state to clear. */
function reset() {}

// --- LLM transport ---------------------------------------------------------
/**
 * One OpenAI-compatible chat completion returning parsed JSON.
 * Throws on any transport/shape error so callers can fall back.
 */
async function chatJson(messages, maxTokens = 300) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`llm ${res.status}: ${text.slice(0, 200)}`);
    const body = JSON.parse(text);
    const content = body && body.choices && body.choices[0] && body.choices[0].message
      ? body.choices[0].message.content
      : null;
    if (!content) throw new Error('llm returned no content');
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

// --- buyer negotiation -----------------------------------------------------
/** Candidate prices the buyer agent may choose from (computed server-side). */
function candidatePrices(contract) {
  const list = Number(contract.list_price);
  const floor = Number(contract.policy.floor);
  const autoAccept = Number(contract.policy.auto_accept);
  const mandateMax = Number(contract.mandate.max);
  return [round(list * 0.86), round((floor + autoAccept) / 2), autoAccept].filter(
    (p) => Number.isFinite(p) && p > 0 && p <= mandateMax
  );
}

/** Snap an arbitrary model price onto the nearest allowed candidate. */
function clampToCandidates(price, candidates, mandateMax) {
  const allowed = candidates.filter((c) => c <= mandateMax);
  if (!allowed.length) return Math.min(mandateMax, candidates[0] || 0);
  let best = allowed[0];
  let bestDist = Math.abs(Number(price) - best);
  for (const c of allowed) {
    const d = Math.abs(Number(price) - c);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return Math.min(best, mandateMax);
}

function pickMove(contract) {
  const candidates = candidatePrices(contract);
  return candidates;
}

/**
 * Decide the buyer agent's next move.
 *
 * @param {{contract:object, lastMerchantPrice:number|null, round:number}} input
 * @returns {Promise<{used:boolean, provider:string, model:string|null,
 *   action:'offer'|'accept', price:number, message:string, rationale:string, error?:string}>}
 */
async function negotiateBuyer(input = {}) {
  const contract = input.contract || {};
  const lastMerchantPrice =
    input.lastMerchantPrice === undefined || input.lastMerchantPrice === null
      ? null
      : Number(input.lastMerchantPrice);
  const roundNo = Number(input.round) || 1;
  const mandateMax = Number(contract.mandate && contract.mandate.max);
  const candidates = pickMove(contract);

  const canAccept = lastMerchantPrice !== null && lastMerchantPrice <= mandateMax;

  // --- deterministic fallback (also the no-key path) ----------------------
  const fallbackFor = () => {
    if (roundNo >= 2 && canAccept) {
      return {
        action: 'accept',
        price: lastMerchantPrice,
        message: `Accepting the merchant's $${lastMerchantPrice} counter — inside my mandate of $${mandateMax}.`,
        rationale: 'Counter is within mandate; accepting closes the deal at the best standing price.',
      };
    }
    const target = round(Number(contract.list_price) * 0.86);
    const price = clampToCandidates(target, candidates, mandateMax);
    return {
      action: 'offer',
      price,
      message: `Opening at $${price} for ${contract.product_name || 'this item'}.`,
      rationale: 'Deterministic opening bid at 86% of list, inside floor and mandate.',
    };
  };

  if (!available()) {
    const fb = fallbackFor();
    return {
      used: false,
      provider: 'none',
      model: null,
      ...fb,
      error: 'ai_disabled',
    };
  }

  const system =
    'You are an autonomous procurement agent negotiating a purchase price. ' +
    'Reply ONLY with JSON: {"action":"offer"|"accept","price":number,"message":string,"rationale":string}. ' +
    'You may only offer one of the allowed_prices. Never exceed mandate_max. ' +
    'Only use "accept" when last_merchant_price is provided and <= mandate_max.';

  const user = JSON.stringify({
    item: contract.product_name,
    list_price: contract.list_price,
    allowed_prices: candidates,
    mandate_max: mandateMax,
    last_merchant_price: lastMerchantPrice,
    round: roundNo,
    can_accept: canAccept,
  });

  try {
    const out = await chatJson([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    const wantsAccept = String(out.action).toLowerCase() === 'accept';
    if (wantsAccept && canAccept) {
      return {
        used: true,
        provider: 'openai',
        model: MODEL,
        action: 'accept',
        price: lastMerchantPrice,
        message: typeof out.message === 'string' ? out.message : `Accepting $${lastMerchantPrice}.`,
        rationale:
          typeof out.rationale === 'string'
            ? out.rationale
            : 'Model accepted the standing merchant counter.',
      };
    }

    // Anything else is an offer; the server snaps the price into policy.
    const price = clampToCandidates(out.price, candidates, mandateMax);
    const proposed = Number(out.price);
    const coerced = !Number.isFinite(proposed) || proposed !== price;
    return {
      used: true,
      provider: 'openai',
      model: MODEL,
      action: 'offer',
      price,
      message:
        typeof out.message === 'string'
          ? out.message
          : `Offering $${price} for ${contract.product_name || 'this item'}.`,
      rationale:
        typeof out.rationale === 'string'
          ? out.rationale
          : 'Model proposed an in-policy offer.',
      ...(coerced ? { error: `price_clamped_to_candidate:${price}` } : {}),
    };
  } catch (err) {
    const fb = fallbackFor();
    return {
      used: false,
      provider: 'openai',
      model: MODEL,
      ...fb,
      error: err && err.message ? err.message : 'llm_error',
    };
  }
}


/**
 * One-call negotiation plan: the buyer agent generates its opening offer and
 * the message it will use to accept the merchant's standing counter. This keeps
 * the AI genuinely in the loop while halving latency versus two sequential
 * model calls (important for local CPU models).
 *
 * @returns {Promise<{used:boolean, provider:string, model:string|null,
 *   opening_price:number, opening_message:string, opening_rationale:string,
 *   accept_message:string, accept_rationale:string, error?:string}>}
 */
async function planNegotiation(input = {}) {
  const contract = input.contract || {};
  const candidates = pickMove(contract);
  const mandateMax = Number(contract.mandate && contract.mandate.max);
  const list = Number(contract.list_price);
  const openingFallback = clampToCandidates(round(list * 0.86), candidates, mandateMax);

  const fallback = () => ({
    used: false,
    provider: 'none',
    model: null,
    opening_price: openingFallback,
    opening_message: `Opening at $${openingFallback} for ${contract.product_name || 'this item'}.`,
    opening_rationale: 'Deterministic opening bid at 86% of list, inside floor and mandate.',
    accept_message: 'The merchant counter is inside my mandate; accepting the standing price.',
    accept_rationale: 'Standing merchant price is within the signed spend mandate.',
    error: 'ai_disabled',
  });

  if (!available()) return fallback();

  const system =
    'You are an autonomous procurement agent negotiating one purchase. ' +
    'Reply ONLY with JSON: {"opening_price":number,"opening_message":string,"opening_rationale":string,"accept_message":string,"accept_rationale":string}. ' +
    'opening_price must be one of allowed_prices and must not exceed mandate_max. ' +
    'The merchant will counter; accept_message is what you will say when you accept that counter.';
  const user = JSON.stringify({
    item: contract.product_name,
    list_price: list,
    allowed_prices: candidates,
    mandate_max: mandateMax,
  });

  try {
    const out = await chatJson([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 900);
    const opening = clampToCandidates(out.opening_price, candidates, mandateMax);
    const proposed = Number(out.opening_price);
    const coerced = !Number.isFinite(proposed) || proposed !== opening;
    return {
      used: true,
      provider: 'openai',
      model: MODEL,
      opening_price: opening,
      opening_message:
        typeof out.opening_message === 'string' ? out.opening_message : `Opening at $${opening}.`,
      opening_rationale:
        typeof out.opening_rationale === 'string' ? out.opening_rationale : 'Model proposed an in-policy opening.',
      accept_message:
        typeof out.accept_message === 'string' ? out.accept_message : 'Accepting the merchant counter.',
      accept_rationale:
        typeof out.accept_rationale === 'string' ? out.accept_rationale : 'Counter is within the signed mandate.',
      ...(coerced ? { error: `price_clamped_to_candidate:${opening}` } : {}),
    };
  } catch (err) {
    return { ...fallback(), provider: 'openai', model: MODEL, error: err && err.message ? err.message : 'llm_error' };
  }
}

// --- claim explanation -----------------------------------------------------
const APPROVABLE = new Set(['not_delivered', 'not_as_described', 'damaged']);
const RECOMMENDATIONS = new Set(['approve', 'review', 'deny']);

/**
 * Advise on a claim. The rule engine remains the final authority; this only
 * produces an explanation a human/judge can read.
 *
 * @param {{order:object, merchant:object, reason:string, evidence:boolean}} input
 * @returns {Promise<{used:boolean, provider:string, model:string|null,
 *   recommendation:'approve'|'review'|'deny', confidence:number, rationale:string, error?:string}>}
 */
async function explainClaim(input = {}) {
  const order = input.order || {};
  const merchant = input.merchant || {};
  const reason = input.reason;
  const evidence = input.evidence === true;

  const fallback = () => {
    const recommend = APPROVABLE.has(reason) && evidence ? 'approve' : 'review';
    return {
      recommendation: recommend,
      confidence: recommend === 'approve' ? 0.8 : 0.45,
      rationale:
        recommend === 'approve'
          ? `Reason "${reason}" with evidence is covered by the merchant's protection policy; approved for instant settlement.`
          : `Reason "${reason}" with evidence=${evidence} does not cleanly match policy; routing to manual review.`,
    };
  };

  if (!available()) {
    const fb = fallback();
    return { used: false, provider: 'none', model: null, ...fb };
  }

  const system =
    'You are a claims adjudication assistant for a buyer-protection product. ' +
    'Reply ONLY with JSON: {"recommendation":"approve"|"review"|"deny","confidence":number,"rationale":string}. ' +
    'confidence is 0..1. Base the decision on the stated reason, evidence flag, ' +
    'purchase amount, and the merchant reputation provided.';

  const user = JSON.stringify({
    reason,
    evidence,
    order_amount: order.amount,
    product: order.product_name,
    merchant: {
      id: merchant.id,
      tier: merchant.tier,
      score: merchant.score,
      reserve: merchant.reserve,
      mode: merchant.mode,
    },
  });

  try {
    const out = await chatJson([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    const rec = String(out.recommendation || '').toLowerCase();
    const recommendation = RECOMMENDATIONS.has(rec) ? rec : 'review';
    let confidence = Number(out.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.5;
    confidence = Math.min(1, Math.max(0, confidence));
    return {
      used: true,
      provider: 'openai',
      model: MODEL,
      recommendation,
      confidence: Math.round(confidence * 100) / 100,
      rationale:
        typeof out.rationale === 'string' && out.rationale
          ? out.rationale
          : 'Model returned no rationale.',
    };
  } catch (err) {
    const fb = fallback();
    return {
      used: false,
      provider: 'openai',
      model: MODEL,
      ...fb,
      error: err && err.message ? err.message : 'llm_error',
    };
  }
}

module.exports = {
  config,
  planNegotiation,
  available,
  negotiateBuyer,
  explainClaim,
  reset,
  candidatePrices,
  clampToCandidates,
};
