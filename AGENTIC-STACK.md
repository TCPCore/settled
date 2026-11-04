# Settled Agent Stack — getting every axis to 8+

*Design note · 2026-11-03 · the five-axis scorecard the user set: authorization/identity 5, trust/reputation 2, risk-priced protection 1, negotiation/commerce semantics 1, recourse for agent purchases 3 — all must become **8+**.*

---

## 0. The one idea that moves all five at once

Do not build five features. Build **one object** that every agent transaction becomes:

> **The Agent Commerce Contract (ACC)** — a machine-readable, signed agreement between a principal's agent and a merchant that carries identity, negotiated terms, merchant trust, protection terms, claim rules and settlement in a single verifiable object.

```
AgentCommerceContract {
  parties: {
    principal: { id, consent, jurisdiction },
    agent:     { passport_vc, operator, capabilities, spend_limit, mandate_vc },
    merchant:  { trust_vc, legal_entity, tier, score, coverage }
  },
  subject:   { items, quantity, category, condition },
  terms:     { price, delivery_window, returns, warranty, payment_terms },
  negotiation: { transcript_hash, rounds, buyer_mandate, seller_policy, signatures },
  trust:     { tier, score, confidence, evidence_hash, accepted_by: [issuer, verifier] },
  protection:{ tier, fee_bps, cap, mode: instant|reserve|escrow|decline, reserve, exclusions },
  recourse:  { claim_rules, evidence_required, sla, payout_source: merchant_reserve, appeal },
  settlement:{ paypal_order_id, capture_mode, invoice_id, refund_id },
  signatures:{ agent, merchant, issuer },
  provenance:{ hash_chain, timestamps, revocation_ref }
}
```

Every axis is a field or a process on this object. That is how a single product reaches 8+ on all five instead of five disconnected features.

---

## 1. Scorecard: current → target → how

| Axis | Now | Target | What gets it to 8+ |
|---|---|---|---|
| **Authorization / identity** | 5 | **8.5** | Agent Passport VC (operator, capabilities, spend limit, expiry, revocation) + AP2 mandate verification + Web Bot Auth/passkeys + agent reputation + principal/operator liability + signed audit trail |
| **Trust / reputation** | 2 | **8.5** | Signed Merchant Trust VC from payment/delivery/dispute outcomes; category-normalised + confidence-weighted; portable across PSPs/platforms/agents; published methodology + appeals + audits; coverage disclosure |
| **Risk-priced protection** | 1 | **8.5** | Tier → fee bps → cap → mode (instant capture / capture+reserve / escrow / decline); actuarial loss model; merchant-funded reserve (no custody: PSP reserve / LC / insurer); exclusions and caps; disclosure |
| **Negotiation / commerce semantics** | 1 | **8** | Contract schema + offer/counter/accept protocol; deterministic seller policy + buyer mandate; signed terms bound to payment; price, delivery, returns, warranty, bundles, B2B terms; provenance |
| **Recourse for agent purchases** | 3 | **8.5** | Buyer- or agent-initiated claim; one-tap evidence; instant payout from merchant reserve; rule-based adjudication + appeal; merchant recovery/subrogation; double-recovery prevention; consumer rights preserved |

---

## 2. Axis 1 — Authorization & identity (5 → 8.5)

**Gap:** AP2/ACP prove *intent*; nobody proves *who the agent is, who operates it, what it may do, and whether it is still trusted*.

**Design — the Agent Passport:**
- **Operator identity** (legal entity, KYB), agent ID, model/version, capabilities, allowed merchants/categories, spend limits, expiry.
- **Mandate chain:** principal consent → AP2 Checkout/Payment Mandate → per-transaction intent; verify signature, amount, merchant, category, TTL, replay nonce.
- **Transport identity:** Web Bot Auth (RFC 9421) / signed agent requests / passkey-bound sessions.
- **Agent reputation:** claim rate, dispute rate, mandate violations, merchant complaints — a two-sided score merchants can require.
- **Liability:** principal bound by mandate; operator co-liability or bond for out-of-scope actions; signed audit trail.
- **Revocation:** instant revocation of passport/mandate, propagated to `trust.verify`.

**8+ criteria:** verified operator + agent + mandate + capabilities + revocation + reputation + liability + audit. (Partner with AP2/Visa TAP/Mastercard Agent Pay for network identity; Settled issues the passport and binds it to trust.)

---

## 3. Axis 2 — Trust & reputation (2 → 8.5)

**Gap:** no portable, signed merchant credential; platform data is walled; badges are pay-to-play.

**Design — the Merchant Trust VC:**
- **Outcome inputs:** captures, delivery (carrier-confirmed), disputes, refunds, chargebacks, resolution time, authenticity/condition claims, coverage.
- **Method:** category-normalised, maturity-weighted cohorts, Bayesian/Wilson confidence intervals, minimum sample rules; volume weighted low; coverage % disclosed.
- **Portability:** W3C VC/JWT; offline verify + revocation list; accepted by third parties (PSPs, platforms, agents).
- **Independence:** published methodology, audit samples, merchant appeals, anti-gaming (identity graph, matured cohorts, coverage requirement).
- **Agent API:** `trust.verify(merchant, amount, category, agent, mandate)` → tier, score ± CI, cap, fee, mode, reasons, credential.

**8+ criteria:** signed + portable + cross-merchant + confidence-quantified + independent + agent-readable + accepted beyond issuer.

---

## 4. Axis 3 — Risk-priced protection (1 → 8.5)

**Gap:** protection is a free bundled cost centre ($1.34B provision / $1.49B losses); there is no price for risk.

**Design — protection as a priced SKU:**
- **Tiers:** A/B/C/D → fee bps (e.g. 35/90/150/decline), cap ($5k/$2.5k/$1k/$0), mode (instant/reserve/escrow/decline).
- **Underwriting:** expected loss = PD × severity (category, amount, merchant tier, buyer/agent reputation); price = loss cost + ops + margin; reserve target per tier.
- **Collateral:** merchant-funded reserve / rolling reserve / bond / LC / insurer; **no custody** option keeps enterprise adoption clean.
- **Coverage:** non-delivery, not-as-described, damage, authenticity, late delivery; explicit exclusions (regulated, prohibited, digital exceptions); caps and duration.
- **Claims:** rule-based evidence (carrier, photos, API assertions), merchant response, appeal, recovery.
- **Governance:** model risk, fairness, adverse selection controls, reinsurance partner, licensing review.

**8+ criteria:** risk-based price + collateral + coverage/exclusions + claims + actuarial model + compliance + disclosure.

---

## 5. Axis 4 — Negotiation & commerce semantics (1 → 8)

**Gap:** `create_order` takes a price as given; there is no machine-readable contract or negotiation.

**Design — the Negotiable Contract inside the ACC:**
- **Schema:** item(s), quantity, price or price band, delivery window, returns, warranty, payment terms, validity, activation rules, obligations, claim rules.
- **Protocol:** propose → counter → accept/decline; buyer mandate (max price, TTL, quantity, category); seller policy (floor, auto-accept threshold, max concessions); deterministic numbers, LLM only for language; expiry/deadlock/human escalation.
- **Binding:** both agents sign the agreed terms; contract hash + transcript hash ride the payment; settlement at the agreed amount; terms become the claim rules.
- **Semantics:** price, shipping, delivery date, returns, warranty, bundles, subscriptions, B2B volume tiers/net terms.
- **Standards:** publish the ACC/negotiation schema as an AP2/UCP extension; interoperate with AP2 mandates.

**8+ criteria:** machine-readable contract + multi-round negotiation + signed terms + settlement binding + standards extension.

---

## 6. Axis 5 — Recourse for agent purchases (3 → 8.5)

**Gap:** disputes/chargebacks take days; no buyer-initiated instant claim from a merchant reserve; agents cannot navigate a human support flow.

**Design — recourse as a service:**
- **Claim initiation:** buyer or agent files in one call (`claim.file`), with evidence (carrier proof, photos, API assertions, contract terms).
- **Adjudication:** rule-based first pass (delivery window, carrier status, contract terms, buyer/agent reputation); instant payout for low-risk/low-value; human review above thresholds.
- **Payout:** from merchant reserve via PayPal refund/payout; SLA seconds for instant claims; status webhooks.
- **Merchant fairness:** response window, evidence, appeal, arbitration path; recovery/subrogation from future settlements; double-recovery prevention (claim vs chargeback).
- **Consumer rights:** 14-day withdrawal (EU), statutory rights preserved; no waiver.
- **Transparency:** decision rationale, evidence ledger, claim metrics.

**8+ criteria:** buyer/agent-initiated + instant payout + collateral + rule-based adjudication + appeal + recovery + compliance.

---

## 7. One API, one object, one audit trail

```
POST /v1/agents/verify                     # Agent Passport + mandate + reputation
POST /v1/trust/verify                      # Merchant Trust VC + tier/cap/fee/mode
POST /v1/contracts                         # create/negotiate/sign an ACC
POST /v1/protection/quote                  # price + coverage + reserve
POST /v1/claims                            # buyer/agent-initiated claim
GET  /v1/credentials/{id}                  # VC verification (offline-friendly)
POST /v1/credentials/{id}/revoke
POST /v1/events/ingest                     # payment, delivery, refund, dispute
GET  /v1/audit/{acc_id}                    # signed ACC + transcript + evidence
```

**MCP tools** for agents: `agent.verify`, `trust.verify`, `contract.negotiate`, `protection.quote`, `claim.file`, `receipt.get`.
**Settlement:** PayPal Orders v2 / Invoicing / Refunds / Payouts; AP2/ACP/UCP for authorization; no custody by default.
**Every response is signed** and every state change is hash-chained.

---

## 8. Build vs partner

| Capability | Build | Partner |
|---|---|---|
| Agent Passport / mandate verification | VC + mandate engine | AP2/Google, Visa TAP, Mastercard Agent Pay for network identity |
| Merchant Trust VC | Outcome ledger, scoring, revocation | PSP webhooks, carrier APIs, KYB providers |
| Protection pricing | Risk engine, tiers, reserve accounting | Insurer/reinsurer, PSP reserve/LC |
| Negotiable Contract | Schema, protocol, signing, provenance | AP2/UCP standards body |
| Recourse | Claim engine, adjudication, payouts | PayPal refunds, PSPs, arbitration provider |
| Settlement | — | PayPal (primary), PSP-agnostic later |

---

## 9. 90-day plan to the 8+ scorecard

| Weeks | Ship |
|---|---|
| 1–2 | ACC schema + signing; extend existing ledger to W3C VC/JWT + revocation |
| 3–4 | Agent Passport + AP2 mandate verification + agent reputation |
| 5–6 | `trust.verify` v2 (confidence intervals, coverage, category normalisation); protection quote v2 (tier/fee/cap/mode) |
| 7–8 | Negotiable Contract protocol + deterministic seller policy + buyer mandate |
| 9–10 | Claim engine v2 (agent-filed, instant payout, appeal, recovery) |
| 11–12 | MCP server; publish ACC/trust schema as AP2/UCP extension; two design-partner pilots |

**Acceptance tests per axis** (must pass in a sandbox):
- Identity: forged/expired/revoked mandate rejected; out-of-scope spend blocked.
- Trust: tampered credential fails; coverage disclosure enforced; cross-store acceptance.
- Protection: tier → fee → capture mode correct; reserve shortfall handled.
- Negotiation: contract signed by both; terms bound to payment; no post-hoc repricing.
- Recourse: agent-filed claim pays in seconds from reserve; appeal and recovery work; no double payout.

---

## 10. Honest dependencies and risks

- **Standards adoption** (AP2/UCP extension) is the main external dependency; without it, the ACC is proprietary and portability is limited.
- **Agent identity** is being standardized by Visa/Mastercard/Google; partner rather than compete.
- **Insurance/licensing** for reserves and claims; no-custody model + insurer partner mitigates.
- **Carrier/delivery evidence** is the hardest data dependency; start with tracked physical goods.
- **PayPal may keep trust proprietary**; position as the neutral layer it can consume or acquire.
- **Scores are design targets, not shipped reality** — 8+ requires the 90-day build + one standards partner + one insurer/PSP.

---

## 11. Before / after

| Axis | Current | After |
|---|---|---|
| Authorization/identity | 5 | **8.5** |
| Trust/reputation | 2 | **8.5** |
| Risk-priced protection | 1 | **8.5** |
| Negotiation/commerce semantics | 1 | **8** |
| Recourse for agent purchases | 3 | **8.5** |

**One line:** *the Agent Commerce Contract is the single object that carries identity, negotiated terms, merchant trust, priced protection and claim rules — and that is how Settled becomes the assurance layer for agentic commerce rather than another point solution.*
