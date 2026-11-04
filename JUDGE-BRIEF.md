# Settled — one-page judge brief

**"Reputation settles with the payment."**

**PayPal's merchant negotiation desk for the agent economy.** A PayPal-native tool the merchant turns on: it publishes a policy, a signed trust credential and protection terms; its **merchant agent** negotiates with a consumer's **personal AI**; both sign an **Agent Commerce Contract**; PayPal settles; a buyer/agent claim is paid from the merchant's reserve in seconds. The human trade ritual — trust, haggle, contract, guarantee, refund — at machine speed, with an audit trail.

---

## Problem (ours to solve, not invented)

- **51%** of shoppers abandon because they doubt the business is legitimate — the #1 reason, ahead of card security (TrustedSite 2026). **96%** worry about unfamiliar stores; **94%** fear AI-generated fake businesses; **91%** fear AI-written fake reviews.
- PayPal's FY2025 10-K shows **$1.34B protection provision / $1.49B realized losses** — a bundled cost centre with **no risk-based price and no portable trust signal**.
- Agent checkout is arriving on PayPal's rails (Agent Ready, Store Sync, WebMCP) — agents can **pay**, but cannot **trust**, and buyers have no **instant recourse**.

## Solution — three layers that ride the PayPal SDK

1. **Trust** — an HMAC/W3C signed **Merchant Trust Credential** built from settled payments, delivery and disputes. Portable to any store, PSP or agent; verified via `POST /api/trust/verify`.
2. **Protection** — **risk-priced per order**: tier A 35 bps / B 90 / C 150 / decline; cap $5k/$2.5k/$1k; instant capture / capture+reserve / escrow. The merchant pays; the buyer pays $0.
3. **Recourse + identity** — **Agent Passport** (operator KYB, signed mandate, spend limits, reputation) + **Agent Commerce Contract** + a **buyer/agent-initiated claim paid from the merchant reserve in ~1.2s** through the PayPal refund API.

**Settlement:** PayPal Orders v2, Payments v2 refunds, Invoicing for NET terms, webhooks for outcomes; AP2/ACP/UCP for agent authorization. No custody by default — reserve at the merchant's PSP, an LC, or an insurer.

## What the demo proves (5 calls, 5 steps)

Trust credential (m1: tier A, 91, 94% coverage, $5,000 cap, $12,500 reserve) → agent passport (a1 verified 6/6; RogueBot rejected) → negotiated contract ($249 → $214 → **$237** signed) → protection (35 bps, **$0.83**, $5,000 cap) + order at the agreed amount → claim (**$237 refunded in 1.2s**, reserve $12,263). **All five axes shown at 8+.**

## Business model

- **Revenue:** 1–3% bps on protected GMV (risk-priced); platform license ($250k–$1M); agent API per-verify + bps; later B2B credit/insurance commission.
- **Who pays:** merchant; buyer free; platform distributes for a share; insurer supplies capital.
- **Unit economics to prove:** loss ratio < fee; claim cost < chargeback cost; conversion lift > fee.
- **Why PayPal:** turns a $1.3B protection cost centre into a priced SKU; protects take rate as checkout moves into agents; distribution via PayPal Open/Agent Ready.

## Why it is different

| | Trust badge | Chargeback guarantee | Buyer protection | **Settled** |
|---|---|---|---|---|
| Outcome-derived | ✗ | ✓ merchant-side | ✓ post-hoc | ✓ signed outcomes |
| Portable across stores/agents | ✗ | ✗ | ✗ | ✓ |
| Risk-priced per order | ✗ | ✓ merchant | ✗ free | ✓ |
| Buyer-initiated instant payout | ✗ | ✗ | dispute | ✓ reserve |
| Agent-readable | ✗ | ✗ | ✗ | ✓ API/MCP |

**Moat:** cross-merchant payment/dispute data + reserve/underwriting + acceptance network + the credential standard.

## Evidence today / what is simulated

- **Real:** risk engine, HMAC credential + hash chain, reserve accounting, claims, agent passport, contract signing, PayPal Orders adapter, **63/63 e2e tests**.
- **Simulated:** payment ids and delivery in SIM mode; the $25k pool is a demo pool. **Production:** insurer/LC-backed reserve, carrier delivery evidence, counsel/insurance workstreams. Say this before a judge asks.
- **Pre-revenue, pre-traction:** the next 30 days are pre-registered tests — 12 merchant interviews, 3/12 LOIs at ≥25 bps, a holdout conversion test (≥5% relative lift), a 20-claim concierge pilot, and one insurer term sheet.

## The ask

A **90-day design-partner pilot** with one platform/PSP and 3–5 high-AOV merchants: protected cohort vs holdout, success measured on conversion lift, claim cost, and time-to-refund. If the tests pass, scale through the platform; if not, pivot to the platform trust API.

**One line:** *Sell to strangers and agents — protected, priced, and paid back in seconds.*
