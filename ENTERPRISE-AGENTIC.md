# Settled for enterprise & agentic commerce

*Rethink for enterprise sales, business verticals and agentic commerce · 2026-11-03 · companion to the working prototype in this folder*

---

## 0. The enterprise thesis

Consumer trust badges are a $X/month add-on. **Enterprise trust is a risk decision that sits inside every order, every claim and every agent purchase.** That is the product enterprises will buy:

> **A trust-and-recourse API that plugs into an enterprise's existing payment events, returns a per-transaction decision (verified, tier, cap, fee, mode), attaches a signed credential, and enforces the downside through collateral — without changing checkout, without holding funds, and without asking anyone to trust a score.**

For agentic commerce it is the missing layer. AP2 gives agents **authority**, UCP/ACP gives them **catalog and checkout**, PayPal gives them **settlement**. None of them gives an agent **a machine-readable answer to “can I trust this counterparty and who pays if it fails?”** Settled is that answer.

---

## 1. Ease of adoption — five levers

| Lever | What it means | Why an enterprise says yes |
|---|---|---|
| **No checkout change** | The trust decision attaches to the existing payment event; no new payment method, no new consumer flow | It is a middleware deployment, not a replatforming |
| **No funds custody** | Settled is the decision + ledger + claims layer; the reserve lives in the merchant's PSP account, a letter of credit, or an insurance partner. Money moves through the PSP's refund API | Avoids money-transmission, insurance-licensing and treasury reviews — the three things that kill enterprise deals |
| **PSP-agnostic ingestion** | PayPal first (deepest data), then Stripe, Adyen, Braintree, Shopify Payments via webhooks/SDK | The enterprise does not have to switch processors to adopt it |
| **Success-based pricing** | No integration fee, no platform fee for the pilot; bps only on protected GMV | Procurement can approve a pilot without a new budget line |
| **Three endpoints + MCP** | `trust.verify`, `protection.quote`, `claim.file`; an MCP server for agents; SDKs | A platform can integrate in days, not quarters |

**The wedge offer:** *"Run a 90-day pilot on one category. We reduce claims cost and dispute rate on protected orders, and we give your agent channel a trust API. You pay only on protected GMV."*

---

## 2. Ease of deployment — architecture & timeline

```
enterprise systems                     Settled cloud
orders / payments ── webhooks ───────►  event ingestion
fulfilment / carrier ────────────────►  outcome normalizer
refunds / disputes ──────────────────►  risk engine ──► decision API
                                       credential service (VC/JWT)
merchant console ◄── dashboards ─────  claims + reserve ledger
agent / MCP ◄──── trust tools ───────  policy engine
```

| Decision | Recommendation | Why |
|---|---|---|
| **Delivery model** | Multi-tenant SaaS; regional data residency; private VPC link for tier-1 | Enterprise security review passes; no on-prem build |
| **Data** | No card data; payment/fulfilment/dispute events only; aggregate publication; DPA | Minimal PCI scope, GDPR/CCPA-friendly |
| **Custody** | None. Reserve = PSP reserve / LC / insurer | Removes regulatory load and treasury friction |
| **Integration** | 3 REST endpoints + 2 webhooks + SDKs (Node, Python, Java, Go) + MCP | Days for a platform, 2–4 weeks for enterprise |
| **Ops** | SSO/SAML, RBAC, audit log, 99.9% SLA, sandbox, usage dashboards | Meets enterprise procurement |
| **Agent** | MCP server; AP2 mandate verification; signed receipts | Agent channel is live on day one of the pilot |

**Pilot timeline:** week 1 sandbox + event mapping; week 2 live on one category; weeks 3–8 protected cohort; week 9 readout; week 10 expansion decision.

---

## 3. Innovation — what is actually new for an enterprise

1. **Trust as a per-transaction decision, not a badge.** The API returns `{verified, tier, score, cap, fee_bps, mode, credential}` and the order is routed to **instant capture / capture + reserve / escrow / decline** accordingly. No badge company does this; no platform exposes it across platforms.
2. **Collateralized trust.** The enterprise can be wrong about a merchant without taking unbounded loss: the cap is bounded by reserve/bond/history. This is the thing that makes it deployable inside a risk-averse enterprise.
3. **Outcome-signed, portable credential.** Earned from settled payments, delivery and disputes — not reviews, not certification. It travels across channels and is verifiable offline (VC/JWT), so platforms and agents can consume it.
4. **Agent-native by construction.** Policy is enforced **server-side** against a signed mandate and a trust threshold — not by the LLM. A malicious merchant page cannot prompt-inject its way past the enterprise's risk policy.
5. **The missing trust primitive for agentic commerce.** AP2/UCP/ACP standardize authority, catalog and checkout; none has a trust/recourse primitive. Publishing the credential schema as an extension is the standards seat.
6. **Network data effect.** More protected orders → better risk calibration → lower fees and higher caps → more merchants. A badge has no such flywheel.

**Honest positioning:** the ingredients exist (buyer protection, risk scoring, badges, guarantees). The **combination — portable outcome ledger + risk-priced decision + collateralized recourse + agent API — is not shipped.** Differentiation ~7.5/10; the moat is data + settlement + underwriting, not the UI.

---

## 4. Revenue multiplier

| Stream | Unit | Example |
|---|---|---|
| **Protection fee** | bps on protected GMV, risk-priced | 10–25 bps tier A, 40–90 bps B, 100–200 bps C |
| **Platform license** | annual, per platform/region | $250k–$1M for a marketplace/platform |
| **Agent API** | per verification + bps on agent-protected GMV | $0.002–$0.01/verify + 25–50 bps |
| **B2B credit/insurance** | success fee / commission | 1–3% of financed or protected trade |
| **Data & insights** | benchmark/API | later |

**Multiplier mechanics** (each is an expansion lever, not a new product):

1. **Penetration within a merchant** — start with one category, expand to all checkout.
2. **Merchant count** — one platform integration reaches thousands of merchants.
3. **Verticals** — same engine, category-calibrated evidence.
4. **AOV** — B2B/high-ticket moves more dollars per protected order.
5. **Agentic volume** — verifications and protected agent purchases grow faster than human checkout.
6. **Network effect** — better data lowers risk price and lifts caps, which wins more volume.

**Illustrative model**

| Platform GMV | Protected share | Blended bps | Protection revenue | + platform license | + agent API |
|---|---|---|---|---|---|
| $10B | 10% | 25 | $2.5M | $500k | $0.3M |
| $10B | 25% | 30 | $7.5M | $500k | $0.8M |
| $10B | 50% | 30 | $15.0M | $1.0M | $1.5M |
| $1B merchant | 30% | 35 | $1.05M | — | $0.2M |

At a $50M-GMV enterprise merchant: 30% protected × 35 bps = **$52.5k ACV** before agent volume; at $500M GMV: **$525k ACV**. The multiplier is the same engine across more GMV, more merchants, more verticals and more agent transactions.

---

## 5. API / agentic surface

### REST (enterprise)
```
POST /v1/events/ingest          payment, refund, dispute, fulfilment events
POST /v1/trust/verify           {merchant_id, amount, agent_id?, mandate_id?, min_tier?}
POST /v1/protection/quote       {merchant_id, amount, category, buyer}
POST /v1/claims                 {order_id, reason, evidence}
GET  /v1/credentials/{id}       verifiable credential (VC/JWT)
POST /v1/credentials/{id}/revoke
GET  /v1/reports/protection     claims, reserves, conversion, agent volume
```
Webhooks: `protection.granted`, `claim.opened`, `claim.settled`, `credential.revoked`.

### MCP tools (agents)
- `trust.verify(merchant, amount, mandate)` → decision + credential
- `protection.quote(merchant, amount, category)` → fee, cap, mode
- `claim.file(order, reason, evidence)` → claim id, refund status
- `receipt.get(order)` → signed receipt + provenance

### Agent-native rules
- **Mandate-bound:** the agent verifies an AP2 Checkout/Payment Mandate (spend cap, merchant allowlist, category, expiry) before the trust check.
- **Server-side policy:** the enterprise's thresholds are enforced by Settled, not the agent's model.
- **Credential:** short TTL, revocation list, offline-verifiable VC/JWT; the credential hash rides the receipt.
- **Human-in-the-loop:** above a configured amount/risk tier, the agent must hand off for approval.
- **Agent reputation:** the same ledger scores agents (claims, disputes, mandate violations), which merchants can require.

### Example
```json
POST /v1/trust/verify
{ "merchant_id": "m_8821", "amount": 1249.00,
  "agent_id": "agent_procure_07", "mandate_id": "ap2_pay_9f2c",
  "category": "electronics" }

→ { "verified": true, "tier": "A", "score": 91,
    "cap": 5000, "fee_bps": 25, "mode": "instant",
    "credential": { "v": 1, "issuer": "Settled", "merchant": {...},
                    "metrics": {...}, "evidence_hash": "0x..." },
    "signature": "HS256 ...", "protection_id": "prot_..." }
```

---

## 6. Vertical playbook (pick 3, not 10)

| Vertical | Buyer | Why it fits | Evidence | Entry offer |
|---|---|---|---|---|
| **Marketplaces & platforms** (Shopify Plus, BigCommerce, marketplace operators) | Head of Payments / Risk / AI | One integration → thousands of merchants; trust gap is the platform's biggest conversion leak | payments + fulfilment + disputes | "Trust API for your merchants + agent channel" |
| **High-ticket retail** (furniture, appliances, luxury resale) | CFO / VP Ops | High AOV, high claim cost, trust is the purchase blocker | carrier + inspection + disputes | "Cut claims cost and lift first-time-buyer conversion" |
| **B2B trade & procurement** | CFO / CPO / Head of Procurement | Negotiation and trust are native; net terms need a credit/trust layer | PO + delivery + payment behaviour + KYB | "Supplier trust + credit limits for procurement agents" |
| *(later)* Travel / services / digital | — | Different evidence; longer build | access logs, milestones | — |

**Best fit:** physical goods with trackable delivery, AOV high enough to justify protection, and a trust gap (independent/DTC/marketplace). **Poor fit:** ultra-low-ticket, digital goods with no delivery evidence, regulated categories, and marketplaces that forbid third-party overlays.

---

## 7. Enterprise sales motion

**Land (90-day paid pilot, one category):**
- Champion: **CFO** (claims/chargeback cost), **CRO** (conversion), **CTO/Head of AI** (agent strategy), **Head of Payments** (integration).
- Success criteria: protected-order claim rate, chargeback reduction, conversion lift vs holdout, agent-purchase success rate, no custody/regulatory incidents.
- Pricing: pilot fee credited against production; bps only on protected GMV.

**Expand:** more categories → more regions → B2B credit/insurance → agent API across the platform.
**Channel:** PayPal partner, PSPs, platform app stores, insurers, logistics/3PLs.

**Objections → answers**

| Objection | Answer |
|---|---|
| "We already have buyer protection." | Post-hoc and platform-bound. This is pre-purchase, portable and instant; it also reduces the claims you do get. |
| "We won't let a third party hold reserves." | No custody. Reserve lives in your PSP/LC/insurer; we adjudicate and instruct refunds via your PSP. |
| "Our data can't leave." | Event-only ingestion, aggregate publication, regional residency, private VPC, DPA. |
| "We're not a PayPal shop." | PSP-agnostic ingestion; PayPal gives the deepest data, but Stripe/Adyen/Braintree work. |
| "Is this insurance?" | It is a merchant-funded guarantee/decision layer; insurance is an optional partner product. |
| "How do we know it works?" | Holdout pilot with pre-registered success metrics and an auditable ledger. |

---

## 8. 90-day plan to enterprise-ready

| Weeks | Build |
|---|---|
| 1–2 | PSP-agnostic event ingestion (PayPal + Stripe adapters); decision API hardening; VC/JWT credential + revocation |
| 3–4 | Claims + no-custody reserve model (PSP reserve/LC/insurer); policy engine per category/market |
| 5–6 | MCP server + AP2 mandate verification; agent reputation; signed receipts |
| 7–8 | Enterprise console (SSO, RBAC, audit, reporting); SOC 2 gap assessment |
| 9–10 | Two design-partner pilots (marketplace + high-ticket retail) |
| 11–12 | Readout, pricing, expansion plan; publish the credential schema as an AP2/UCP extension |

**Metrics that sell:** protected GMV share, claim rate, chargeback reduction, conversion lift vs holdout, agent purchase success, time-to-first-decision, integration days.

---

## 9. The one-line enterprise pitch

> **"Settled is the trust-and-recourse API for commerce and agents. Plug your payment events in; get a per-order decision that prices risk, a portable signed reputation for every merchant, and instant, collateral-backed recourse for buyers — without changing checkout and without handing over funds."**
