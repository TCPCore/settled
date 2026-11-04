'use strict';
/**
 * lib/passport.js — Agent Passport: a signed, portable credential that lets an
 * autonomous buying agent prove *who it is*, *what it may do*, and *on whose
 * authority* before it is allowed to spend money.
 *
 * ZERO DEPENDENCIES (node:crypto only).
 *
 * A passport is self-contained: the credential carries its own `sig`
 * (HS256 over base64url(JSON.stringify(payload-without-sig))), so a third party
 * can verify it offline without calling back. The envelope also exposes a
 * `signature` field for symmetry with the merchant ledger credential.
 *
 * Mandate expiry is materialised at issue time from a TTL, so a long-running
 * demo never trips an accidental "mandate expired" mid-pitch.
 */

const crypto = require('crypto');

const ALG = 'HS256';
const ISSUER = 'Settled Agent Passport';
const SECRET = crypto.randomBytes(32); // dedicated agent secret
const PASSPORT_TTL_S = 3600; // 1h
const MANDATE_TTL_S = 3600; // 1h

// --- seed agents (§1) -------------------------------------------------------
const AGENT_SEEDS = [
  {
    id: 'a1',
    name: 'ProcureBot',
    operator: { legal_name: 'Acme Procurement Inc', kyb: 'verified', country: 'US' },
    capabilities: ['purchase', 'negotiate', 'claim'],
    limits: { max_amount: 500, categories: ['audio', 'electronics'], merchants: ['m1', 'm2'] },
    reputation: { orders: 24, claims: 1, violations: 0, score: 92 },
    mandate: { id: 'ap2_9f2c', ttl_seconds: MANDATE_TTL_S, max_amount: 500, signed: true },
    status: 'valid',
  },
  {
    id: 'a2',
    name: 'GiftGenie',
    operator: { legal_name: 'Lumen Labs', kyb: 'verified', country: 'US' },
    capabilities: ['purchase'],
    limits: { max_amount: 250, categories: ['home'], merchants: ['m2'] },
    reputation: { orders: 8, claims: 0, violations: 0, score: 78 },
    mandate: { id: 'ap2_7a1b', ttl_seconds: MANDATE_TTL_S, max_amount: 250, signed: true },
    status: 'valid',
  },
  {
    id: 'a3',
    name: 'RogueBot',
    operator: { legal_name: null, kyb: 'unverified', country: null },
    capabilities: ['purchase'],
    limits: { max_amount: 9999, categories: [], merchants: [] },
    reputation: { orders: 0, claims: 0, violations: 6, score: 12 },
    mandate: { id: null, ttl_seconds: -86400, max_amount: 0, signed: false },
    status: 'invalid',
  },
];

// --- crypto helpers --------------------------------------------------------
const sha256hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const base64url = (s) => Buffer.from(s, 'utf8').toString('base64url');

/** HMAC-SHA256 over base64url(JSON.stringify(value)) — the single signing rule. */
function sign(value) {
  const material = typeof value === 'string' ? value : base64url(JSON.stringify(value));
  return crypto.createHmac('sha256', SECRET).update(material, 'utf8').digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// --- accessors -------------------------------------------------------------
function listAgentSeeds() {
  return AGENT_SEEDS.map((a) => JSON.parse(JSON.stringify(a)));
}

function getAgentSeed(agentId) {
  const found = AGENT_SEEDS.find((a) => a.id === agentId);
  return found ? JSON.parse(JSON.stringify(found)) : null;
}

/** Public projection used by GET /api/agents (from a seed). */
function publicAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    operator: agent.operator.legal_name,
    kyb: agent.operator.kyb,
    capabilities: agent.capabilities.slice(),
    limits: {
      max_amount: agent.limits.max_amount,
      categories: agent.limits.categories.slice(),
      merchants: agent.limits.merchants.slice(),
    },
    reputation: { ...agent.reputation },
    mandate: {
      id: agent.mandate.id,
      max_amount: agent.mandate.max_amount,
      signed: agent.mandate.signed,
      expires_at: new Date(Date.now() + agent.mandate.ttl_seconds * 1000).toISOString(),
    },
    status: agent.status,
  };
}

/** Public projection rebuilt from a (possibly externally supplied) credential. */
function agentFromCredential(cred) {
  return {
    id: cred.agent_id,
    name: cred.name,
    operator: cred.operator && cred.operator.legal_name,
    kyb: cred.operator && cred.operator.kyb,
    capabilities: (cred.capabilities || []).slice(),
    limits: {
      max_amount: cred.limits ? cred.limits.max_amount : null,
      categories: (cred.limits && cred.limits.categories) || [],
      merchants: (cred.limits && cred.limits.merchants) || [],
    },
    reputation: { ...(cred.reputation || {}) },
    mandate: cred.mandate || {},
    status: cred.status,
  };
}

// --- passport issue / verify ----------------------------------------------
/** Build the signed payload for an agent seed (stable key order, no `sig`). */
function buildPassport(agent) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + PASSPORT_TTL_S * 1000);
  const mandateExpiresAt = new Date(issuedAt.getTime() + agent.mandate.ttl_seconds * 1000);

  return {
    agent_id: agent.id,
    name: agent.name,
    operator: {
      legal_name: agent.operator.legal_name,
      kyb: agent.operator.kyb,
      country: agent.operator.country,
    },
    capabilities: agent.capabilities.slice(),
    limits: {
      max_amount: agent.limits.max_amount,
      categories: agent.limits.categories.slice(),
      merchants: agent.limits.merchants.slice(),
    },
    mandate: {
      id: agent.mandate.id,
      expires_at: mandateExpiresAt.toISOString(),
      max_amount: agent.mandate.max_amount,
      signed: agent.mandate.signed,
    },
    reputation: { ...agent.reputation },
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    revocation: agent.status === 'valid' ? null : { revoked: true, reason: 'agent_invalid' },
    status: agent.status,
  };
}

/**
 * Issue a signed passport. The credential carries its own `sig`; the envelope
 * repeats it as `signature` for symmetry with the merchant ledger credential.
 * @returns {{credential:object, signature:string, alg:string}|null}
 */
function issuePassport(agentOrId) {
  const agent = typeof agentOrId === 'string' ? getAgentSeed(agentOrId) : agentOrId;
  if (!agent) return null;
  const body = buildPassport(agent);
  const sig = sign(body);
  return { credential: { ...body, sig }, signature: sig, alg: ALG };
}

/** Recompute the HMAC over a credential, ignoring its own `sig` field. */
function verifyPassportSignature(credential, signature) {
  if (!credential || typeof credential !== 'object') return false;
  const provided = signature || credential.sig;
  if (!provided) return false;
  try {
    const { sig, ...rest } = credential;
    void sig;
    return safeEqual(sign(rest), provided);
  } catch {
    return false;
  }
}

function notExpired(iso, now = Date.now()) {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > now;
}

/** Case-insensitive one-way substring match, e.g. 'audio' ~ 'Audio gear'. */
function categoryMatches(allowed, category) {
  if (!allowed || !allowed.length) return false;
  const c = String(category).toLowerCase();
  return allowed.some((a) => {
    const s = String(a).toLowerCase();
    return s === c || c.includes(s) || s.includes(c);
  });
}

/**
 * Verify a passport credential against optional purchase context.
 * Everything is derived from the credential itself, so a caller-supplied
 * (possibly tampered) credential is checked exactly like a freshly issued one.
 *
 * @param {object} credential
 * @param {string} [signature] defaults to credential.sig
 * @param {{merchant_id?:string, amount?:number, category?:string}} [context]
 */
function verifyCredential(credential, signature, context = {}) {
  const reasons = [];
  if (!credential || typeof credential !== 'object') {
    return {
      verified: false,
      agent: null,
      checks: { passport: false, mandate: false, limits: false, merchant: false, category: false, kyb: false },
      reasons: ['credential_missing'],
    };
  }

  const sigOk = verifyPassportSignature(credential, signature);
  const holderLive = notExpired(credential.expires_at);
  const statusOk = credential.status === 'valid';
  const passportOk = sigOk && holderLive && statusOk;
  if (!sigOk) reasons.push('passport_signature_invalid');
  if (!holderLive) reasons.push('passport_expired');
  if (!statusOk) reasons.push(`passport_status_invalid:${credential.status}`);

  const mandate = credential.mandate || {};
  const mandateOk = Boolean(mandate.id) && mandate.signed === true && notExpired(mandate.expires_at);
  if (!mandate.id) reasons.push('mandate_missing');
  if (mandate.signed !== true) reasons.push('mandate_unsigned');
  if (!notExpired(mandate.expires_at)) reasons.push('mandate_expired');

  const kybOk = Boolean(credential.operator && credential.operator.kyb === 'verified');
  if (!kybOk) reasons.push(`operator_kyb_${(credential.operator && credential.operator.kyb) || 'missing'}`);

  const reputation = credential.reputation || {};
  const reputationOk = (reputation.violations || 0) === 0;
  if (!reputationOk) reasons.push(`violations:${reputation.violations}`);

  const limits = credential.limits || {};
  const hasAmount = context.amount !== undefined && context.amount !== null && context.amount !== '';
  const amount = hasAmount ? Number(context.amount) : null;
  let limitsOk = true;
  if (hasAmount) {
    if (!Number.isFinite(amount)) {
      limitsOk = false;
      reasons.push('amount_invalid');
    } else {
      if (amount > limits.max_amount) {
        limitsOk = false;
        reasons.push(`amount_exceeds_limit:${amount}>${limits.max_amount}`);
      }
      if (mandate.max_amount && amount > mandate.max_amount) {
        limitsOk = false;
        reasons.push(`amount_exceeds_mandate:${amount}>${mandate.max_amount}`);
      }
    }
  }

  const merchants = limits.merchants || [];
  let merchantOk = true;
  if (context.merchant_id) {
    merchantOk = merchants.includes(context.merchant_id);
    if (!merchantOk) reasons.push(`merchant_not_allowed:${context.merchant_id}`);
  }

  let categoryOk = true;
  if (context.category) {
    categoryOk = categoryMatches(limits.categories, context.category);
    if (!categoryOk) reasons.push(`category_not_allowed:${context.category}`);
  }

  const checks = {
    passport: passportOk,
    mandate: mandateOk,
    limits: limitsOk,
    merchant: merchantOk,
    category: categoryOk,
    kyb: kybOk,
  };

  const verified =
    passportOk && mandateOk && limitsOk && merchantOk && categoryOk && kybOk && reputationOk;

  return { verified, agent: agentFromCredential(credential), checks, reasons };
}

/**
 * Verify a seeded agent. Issues a fresh passport and verifies it through the
 * same credential path used for externally supplied passports.
 *
 * @param {string|object} agentOrId
 * @param {{merchant_id?:string, amount?:number, category?:string}} [context]
 */
function verifyAgent(agentOrId, context = {}) {
  const agent = typeof agentOrId === 'string' ? getAgentSeed(agentOrId) : agentOrId;
  if (!agent) {
    return {
      verified: false,
      agent: null,
      checks: { passport: false, mandate: false, limits: false, merchant: false, category: false, kyb: false },
      reasons: ['agent_not_found'],
      passport: null,
    };
  }
  const bundle = issuePassport(agent);
  const result = verifyCredential(bundle.credential, bundle.signature, context);
  return { ...result, passport: bundle };
}

module.exports = {
  ALG,
  ISSUER,
  PASSPORT_TTL_S,
  MANDATE_TTL_S,
  sha256hex,
  sign,
  verifyPassportSignature,
  listAgentSeeds,
  getAgentSeed,
  publicAgent,
  agentFromCredential,
  buildPassport,
  issuePassport,
  verifyCredential,
  verifyAgent,
  categoryMatches,
};
