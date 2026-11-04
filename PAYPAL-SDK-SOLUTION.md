# Settled for PayPal — the SDK-level solution to the five weak axes

*Design note · 2026-11-03 · how one middleware layer wraps the PayPal SDK/APIs so each axis reaches 8+.*
*Companion: [AGENTIC-STACK.md](AGENTIC-STACK.md) (the object model) · [PAYPAL-AGENTIC-REVENUE.md](PAYPAL-AGENTIC-REVENUE.md) (why PayPal needs it).*

---

## 0. What we are building

**`Settled for PayPal`** — a thin assurance layer that sits *between the agent and the PayPal SDK*:

- one server SDK (`@settled/paypal`) that wraps PayPal Orders/Payments/Invoicing,
- one MCP server so agents can call trust/contract/claim tools,
- one drop-in JS component for checkout,
- one signed object (the **Agent Commerce Contract**, ACC) that binds identity, terms, trust, protection and recourse to a real PayPal order.

**We do not replace PayPal.** PayPal stays the rail, the funding source, the approval UI, the refund/dispute system and the fraud engine. Settled adds the **assurance** PayPal's stack lacks: agent identity/reputation, portable merchant trust, priced protection, negotiation semantics, and instant buyer recourse.

---

## 1. The gap → the PayPal primitive → the Settled addition

| Weak axis | What PayPal SDK already gives you | What Settled adds | Target |
|---|---|---|---|
| **Authorization / identity** (5) | AP2 mandates via Agent Ready; ACP/UCP delegated tokens; OAuth scopes; `PayPal-Auth-Assertion` for partners; payment approval | **Agent Passport** (operator KYB, agent ID, capabilities, spend limit, expiry, revocation) + mandate-chain verification + **agent reputation** + liability/bond + signed audit | **8.5** |
| **Trust / reputation** (2) | Webhooks: `PAYMENT.CAPTURE.COMPLETED/REFUNDED/REVERSED`, `CUSTOMER.DISPUTE.*`; `list_transactions`; `get_merchant_insights` | **Merchant Trust VC** built from those outcomes, category-normalised, confidence-weighted, portable, offline-verifiable, revocable; `trust.verify` API | **8.5** |
| **Risk-priced protection** (1) | Orders `intent=CAPTURE|AUTHORIZE`; auth/capture; partial capture; `PayPal-Request-ID`; `payment_instruction.platform_fees` (partner-gated); Invoicing | **Protection quote**: tier → fee bps → cap → mode (instant / reserve / escrow / decline); actuarial pricing; merchant reserve; no-custody model; coverage + exclusions | **8.5** |
| **Negotiation / commerce semantics** (1) | Orders create + server-side `PATCH` of `amount` **before approval**; item breakdown; `custom_id`/`invoice_id`; Invoicing NET terms | **Negotiable Contract**: offer/counter/accept, buyer mandate, seller policy, signed terms bound to the order amount, transcript hash in `custom_id`, terms become claim rules | **8** |
| **Recourse for agent purchases** (3) | `POST /v2/payments/captures/{id}/refund` (full/partial); Disputes API; webhooks; Payouts | **Claim engine**: buyer/agent-initiated, one-tap evidence, rule-based adjudication, **instant payout from merchant reserve**, appeal, recovery, double-recovery prevention | **8.5** |

---

## 2. The integration in one picture

```
  AI agent (buyer)                     merchant / PSP
       │                                     │
       │ 1. agent.verify(passport, mandate)  │
       ▼                                     │
 ┌─────────────────── Settled ───────────────┴────────────┐
 │ 2. trust.verify(merchant) → tier/cap/fee/mode/VC       │
 │ 3. contract.negotiate/accept → signed ACC              │
 │ 4. protection.quote → price + reserve + coverage       │
 └───────────────────────┬────────────────────────────────┘
                         │ 5. create order (amount = agreed, custom_id = ACC hash)
                         ▼
              PayPal Orders v2 / JS SDK / Agent Ready
                         │ 6. buyer approves (PayPal or AP2 mandate / ACP)
                         ▼
              capture / authorize  →  webhooks
                         │
        ┌────────────────┴────────────────┐
        │ 7. outcome events → Merchant VC │
        │ 8. claim → refund from reserve  │
        └─────────────────────────────────┘
```

---

## 3. The PayPal calls, exactly

**Auth (server):**
```js
POST https://api-m.sandbox.paypal.com/v1/oauth2/token
Basic base64(client_id:secret) · body: grant_type=client_credentials
```

**Create the protected order (server) — amount is the agreed contract amount:**
```js
POST /v2/checkout/orders
{
  "intent": "CAPTURE",                    // or AUTHORIZE for escrow / delivery risk
  "purchase_units": [{
    "custom_id": "acc_sha256_9f2c…",      // the ACC hash = provenance
    "invoice_id": "acc_9f2c…",
    "amount": { "currency_code": "USD", "value": "249.00" },
    "payment_instruction": {              // only if Settled is an approved partner
      "disbursement_mode": "INSTANT",
      "platform_fees": [{ "amount": { "currency_code": "USD", "value": "0.87" } }]
    }
  }]
}
```
- `intent: AUTHORIZE` for new/escrow-tier merchants; capture on delivery confirmation.
- `intent: CAPTURE` for tier A with instant protection.

**Buyer approval:** PayPal JS SDK (`createOrder` returns the server order id, `onApprove` calls the server to capture) — or Agent Ready (ACP/UCP) / AP2 payment mandate for agent checkout. The buyer always approves the final amount; never patch after approval.

**Capture (server):**
```js
POST /v2/checkout/orders/{orderId}/capture
```

**Claim payout (server) — buyer-initiated, from the merchant reserve:**
```js
POST /v2/payments/captures/{captureId}/refund
{ "amount": { "currency_code": "USD", "value": "249.00" } }
```
- Instant claim = refund executed immediately; merchant reserve is debited in Settled's ledger and replenished from future settlements.
- If the reserve is short: network pool / insurer covers, then recovery from future captures (partner `payee` / delayed disbursement where enabled).

**B2B / NET terms:** `POST /v2/invoicing/invoices` with `payment_term: NET_30`, PO reference in `detail.reference`; claim rules attach to the ACC.

**Webhooks:** `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.AUTHORIZATION.VOIDED`, `CUSTOMER.DISPUTE.CREATED/UPDATED/RESOLVED` → update the Merchant Trust VC, trigger recovery, open/close claims.

**Agent surfaces:** the same operations exposed as MCP tools:
`agent.verify`, `trust.verify`, `contract.negotiate`, `protection.quote`, `claim.file`, `receipt.get`.

---

## 4. What each auth/identity piece looks like

**Agent Passport (VC/JWT), issued by Settled, anchored in PayPal data:**
```json
{
  "iss": "settled",
  "sub": "agent_op_8821/agent_procure_07",
  "operator": { "legal_name": "Acme Procurement Inc", "kyb": "verified" },
  "capabilities": ["purchase", "negotiate", "claim"],
  "limits": { "max_amount": 2500, "categories": ["electronics"], "merchants": ["allowlist"] },
  "mandate": { "ap2_checkout_mandate": "…", "ap2_payment_mandate": "…", "exp": "…" },
  "reputation": { "claims": 3, "disputes": 1, "violations": 0 },
  "revocation": "https://settled/revoke/…",
  "sig": "…"
}
```
Verified on every `trust.verify`; expired/revoked/out-of-scope → reject before `create_order`.
Liability: principal bound by mandate; operator bond/co-liability for out-of-scope actions; signed audit trail stored alongside the PayPal order id.

---

## 5. What each trust / protection / negotiation / recourse call returns

```json
POST /v1/trust/verify
{ "merchant_id": "m_8821", "amount": 249, "category": "audio",
  "agent_id": "agent_procure_07", "mandate_id": "ap2_9f2c" }
→ { "verified": true, "tier": "A", "score": 91, "ci": 3.2, "coverage": 0.94,
    "cap": 5000, "fee_bps": 35, "mode": "instant",
    "credential": { "vc": "…" }, "signature": "HS256 …", "protection_id": "prot_…" }
```

```json
POST /v1/contracts
{ "merchant_id": "m_8821", "items": [{ "sku": "p1", "qty": 1 }],
  "buyer_mandate": { "max": 260, "ttl": 600 },
  "terms": { "delivery_window": "3d", "returns": "30d" } }
→ { "acc_id": "acc_9f2c…", "agreed_price": 249.00, "terms_hash": "…",
    "signatures": { "buyer_agent": "…", "merchant_agent": "…" }, "status": "signed" }
```

```json
POST /v1/protection/quote
{ "merchant_id": "m_8821", "amount": 249, "tier": "A" }
→ { "fee_bps": 35, "fee": 0.87, "cap": 5000, "mode": "instant",
    "coverage": ["non_delivery","not_as_described","damaged"],
    "reserve": { "source": "merchant_paypal_reserve", "target": 12500 } }
```

```json
POST /v1/claims
{ "acc_id": "acc_9f2c…", "reason": "not_delivered", "evidence": { "tracking": "…" } }
→ { "claim_id": "clm_…", "status": "approved", "refund": 249.00,
    "paid_from": "merchant_reserve", "paypal_refund_id": "…", "sla_ms": 1200 }
```

---

## 6. How this lifts each score to 8+

| Axis | Why it is 8+ now |
|---|---|
| Authorization/identity | Passport + mandate chain + revocation + reputation + liability + audit — everything a merchant or network needs to trust an agent, layered on PayPal's auth |
| Trust/reputation | Signed VC from PayPal's own capture/refund/dispute events, portable, confidence-quantified, accepted by third parties |
| Risk-priced protection | Real price per transaction (tier → bps → cap → mode), collateral, coverage, exclusions, claims — replaces the $1.34B bundled cost centre |
| Negotiation | Signed contract with offer/counter/accept, buyer mandate, seller policy; amount fixed pre-approval; terms bind the claim |
| Recourse | Buyer/agent-initiated claim, instant refund from reserve via PayPal, rule-based adjudication, appeal, recovery |

---

## 7. Deployment modes

| Mode | What the merchant installs | Time |
|---|---|---|
| **Drop-in** | `settled.js` + `@settled/paypal` server SDK + webhook endpoint | hours |
| **Platform** | one integration on PayPal Open / Agent Ready / Store Sync; credential attached to merchant records | days |
| **Agent** | MCP server + Agent Ready/ACP/UCP + AP2 mandate verification | days |
| **No custody** | reserve = merchant's PayPal reserve, LC, or insurer; refunds via PayPal refund API | default |

---

## 8. Build vs partner

| Piece | Build | Partner |
|---|---|---|
| ACC schema, signing, hash chain | ✅ | — |
| Agent Passport + mandate verification | ✅ | AP2/Google, Visa TAP, Mastercard Agent Pay |
| Merchant Trust VC + revocation | ✅ | PayPal/PSP webhooks, carriers, KYB |
| Protection pricing + reserve ledger | ✅ | insurer/reinsurer, PSP reserve/LC |
| Claims engine + payouts | ✅ | PayPal Refunds/Payouts, arbitration provider |
| Settlement | — | PayPal (Orders, Invoicing, Refunds, Payouts) |
| Fee capture | ledger math now; `platform_fees` later | PayPal partner program |

---

## 9. Honest constraints

- `platform_fees` needs approved-partner status; until then the fee is invoiced/ledgered.
- AP2/ACP/UCP are evolving; version-pin and keep a compatibility layer.
- Settlement/claim payout depends on PayPal refunds being available on the capture; fallback = Payouts.
- "8+" is the design target after the 90-day build + standards partner + insurer/PSP; the current prototype covers trust, risk tiers, orders, fulfill, claims and agent verify, but not yet the passport/contract/VC/refund integration.

---

## 10. The one-line answer

> **Settled for PayPal is a thin assurance middleware around the PayPal SDK: an Agent Passport for identity, a signed Merchant Trust VC from PayPal outcomes, a priced protection quote attached to the order, a negotiable contract that fixes the amount pre-approval, and an instant claim paid through PayPal refunds from a merchant reserve. PayPal keeps the rail; Settled adds the five things the rail doesn't have.**
