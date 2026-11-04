'use strict';
/**
 * lib/ledger.js — signed trust credentials + tamper-evident event hash chain.
 * ZERO DEPENDENCIES (node:crypto only).
 *
 * Credential: HS256 over base64url(JSON.stringify(payload)) with a per-process
 *   secret. Stable key order is achieved by building the payload as an object
 *   literal in the documented order (JS preserves insertion order for string
 *   keys, so JSON.stringify is deterministic).
 * Events: hash = sha256(prev_hash + JSON.stringify(event_without_hash)); the
 *   first prev_hash is the literal "GENESIS".
 */

const crypto = require('crypto');
const data = require('./data');

/** Per-process signing secret. Rotating it invalidates all issued credentials. */
const SECRET = crypto.randomBytes(32);
const ALG = 'HS256';
const ISSUER = 'Settled';
const TTL_MS = 24 * 60 * 60 * 1000;

const GENESIS = 'GENESIS';

// --- primitives ------------------------------------------------------------
function sha256hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function base64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function hmac(payloadB64) {
  return crypto.createHmac('sha256', SECRET).update(payloadB64, 'utf8').digest('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// --- event hash chain ------------------------------------------------------
/** Current head of the chain: last event hash, or "GENESIS" when empty. */
function chainHead() {
  const events = data.state.events;
  if (!events.length) return GENESIS;
  return events[events.length - 1].hash;
}

/**
 * Append an event to the global hash chain.
 * Returns the stored event (including seq, prev_hash and hash).
 */
function appendEvent(merchantId, type, payload) {
  const prev = chainHead();
  const event = {
    seq: ++data.state.seq,
    id: 'evt_' + data.randHex(8),
    merchant_id: merchantId,
    type,
    created_at: data.nowIso(),
    payload: payload ? data.clone(payload) : {},
    prev_hash: prev,
  };
  // SHA-256 over prev_hash + the event JSON *without* its hash field.
  event.hash = sha256hex(prev + JSON.stringify(event));
  data.state.events.push(event);
  return event;
}

/** True when every event's hash still matches the chain. */
function verifyChain(events) {
  const list = events || data.state.events;
  let prev = GENESIS;
  for (const ev of list) {
    const { hash, ...rest } = ev;
    const expected = sha256hex(prev + JSON.stringify({ ...rest, prev_hash: prev }));
    if (expected !== hash) return { valid: false, broken_at_seq: ev.seq };
    prev = hash;
  }
  return { valid: true, head: prev, length: list.length };
}

// --- credentials -----------------------------------------------------------
/** Build the §4 credential payload for a merchant (stable key order). */
function buildPayload(merchant) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + TTL_MS);
  const m = merchant.metrics;
  const risk = require('./risk');

  return {
    v: 1,
    issuer: ISSUER,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce: data.randHex(8), // 16 hex chars
    merchant: {
      id: merchant.id,
      name: merchant.name,
      domain: merchant.domain,
      country: merchant.country,
    },
    metrics: {
      orders: m.orders,
      delivered_pct: m.delivered_pct,
      as_described_pct: m.as_described_pct,
      dispute_rate_pct: risk.disputeRatePct(merchant),
      chargeback_rate_pct: risk.chargebackRatePct(merchant),
      avg_delivery_days: m.avg_delivery_days,
      age_days: m.age_days,
    },
    score: merchant.score,
    tier: merchant.tier,
    fee_bps: merchant.fee_bps,
    cap: merchant.cap,
    reserve: data.round2(merchant.reserve),
    coverage: merchant.coverage,
    evidence_hash: sha256hex(chainHead()),
  };
}

function signPayload(payload) {
  return hmac(base64url(JSON.stringify(payload)));
}

/** Issue a freshly signed credential bundle: { credential, signature, alg }. */
function issueCredential(merchant) {
  const credential = buildPayload(merchant);
  return { credential, signature: signPayload(credential), alg: ALG };
}

/** Recompute the HMAC over the given credential object. */
function verifySignature(credential, signature) {
  if (!credential || typeof credential !== 'object' || !signature) return false;
  try {
    return safeEqual(signPayload(credential), signature);
  } catch {
    return false;
  }
}

function checkIssuer(credential) {
  return !!credential && credential.issuer === ISSUER;
}

function checkNotExpired(credential) {
  if (!credential || !credential.expires_at) return false;
  const t = Date.parse(credential.expires_at);
  return Number.isFinite(t) && t > Date.now();
}

/** Structured checks used by the /verify endpoints. */
function inspect(credential, signature) {
  const checks = {
    signature: verifySignature(credential, signature),
    issuer: checkIssuer(credential),
    not_expired: checkNotExpired(credential),
  };
  return { valid: checks.signature && checks.issuer && checks.not_expired, checks };
}

/** §4: boolean only. */
function verifyCredential(credential, signature) {
  return inspect(credential, signature).valid;
}

/** Stable hash of a signed credential, used in receipts. */
function credentialHash(bundle) {
  return sha256hex(base64url(JSON.stringify(bundle.credential)) + '.' + bundle.signature);
}

module.exports = {
  ALG,
  ISSUER,
  GENESIS,
  sha256hex,
  base64url,
  chainHead,
  appendEvent,
  verifyChain,
  buildPayload,
  issueCredential,
  verifySignature,
  checkIssuer,
  checkNotExpired,
  inspect,
  verifyCredential,
  credentialHash,
};
