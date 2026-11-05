# The PayPal Merchant Agent — plug-and-play negotiation for every merchant

*Product definition for the next build. Supersedes "assurance layer" as the primary framing; the credential, protection and recourse remain the differentiators underneath.*

---

## 1. Thesis

**PayPal gives every merchant its own native negotiation agent.**

The merchant connects PayPal, points the agent at its catalog, and sets the rules — what is negotiable, the floor, the auto-accept price, the terms, the protection tier. From then on, **any customer's personal AI can negotiate with that merchant**, at any storefront where PayPal is accepted. The merchant's agent answers; the policy engine fixes the numbers; the contract is signed; PayPal settles; the buyer gets recourse.

**One sentence for a judge:** *"Connect your store, choose what's negotiable, set your rules — and let any customer's AI negotiate with your merchant agent, with PayPal settling and backing the deal."*

---

## 2. What "plug and play" actually means

### Merchant (no code, ~10 minutes)
1. **Install from PayPal** — merchant clicks "Add Settled" in the PayPal app/partner directory; OAuth returns the merchant ID; no developer work.
2. **Connect the catalog** — one of:
   - platform connector (Shopify, WooCommerce, BigCommerce, Wix, custom API),
   - CSV/JSON upload,
   - product feed URL (Google Merchant/XML/JSON),
   - manual "add what you want to negotiate."
3. **Choose what is negotiable** — per item/category: `negotiable`, `floor_pct`, `auto_accept_pct`, `max_discount_pct`, `terms`, `protection_tier`.
4. **Configure the native agent** — name, tone, greeting, allowed categories, approval rules, escalation.
5. **Publish** — Settled gives the merchant a **negotiation link/button/QR** and an embed snippet.

### Consumer (no app)
Any personal AI connects through one endpoint/MCP server:
- presents an **Agent Passport** (operator KYB, signed mandate, spend limit, categories, expiry),
- calls `negotiate.start` with a product/need,
- receives offers/counters from the merchant agent,
- signs the **Agent Commerce Contract**,
- pays via PayPal.

### Judge (60 seconds)
`/merchant.html` → connect (sandbox) → sync catalog → mark 3 items negotiable → publish → open `/negotiate.html?merchant=m1&sku=p1` → chat with the merchant agent → pay → claim.

---

## 3. The one hard problem: price authority

"Any storefront where PayPal is deployed" is true **only if we are honest about who writes the final price**. Three modes:

| Mode | How the negotiated price reaches checkout | Works on any storefront? | Trade-off |
|---|---|---|---|
| **A. Hosted negotiated checkout** | Settled creates the PayPal order at the agreed amount; merchant receives the order via webhook/email/API | **Yes** — anywhere PayPal is accepted | Bypasses the storefront cart; merchant must accept the order into fulfillment |
| **B. Storefront plugin** | Platform API writes the discount/price to cart, draft order or checkout (Shopify Functions/Draft Orders, Woo hooks, BigCommerce, custom) | Only where a plugin exists | Native UX; per-platform build and review |
| **C. PayPal-native button** | The existing PayPal button calls Settled's `createOrder`; amount is the agreed amount | Where the merchant controls the PayPal integration | No cart price change; order/fulfillment still needs a handoff |

**Decision for the hackathon:** ship **A** as the universal path (works everywhere PayPal is), and show **B** as the native upgrade for Shopify/Woo. Do not claim "we change any storefront's cart price" — claim "we let any merchant put any item up for negotiation and settle it through PayPal." That is the ambiguity killer.

**Fulfillment handoff:** hosted mode sends the merchant an order webhook + a signed ACC with SKU, quantity, price, buyer agent, terms, and protection. The merchant's existing OMS/3PL can accept it; if not, email/CSV fallback.

---

## 4. The native merchant agent (what it is, technically)

A merchant-scoped agent with **tools**, not an open-ended chatbot:

| Tool | Purpose |
|---|---|
| `catalog.list` / `catalog.get` | Read the merchant's inventory/feeds |
| `policy.get` / `policy.set` | Per-item/category negotiation rules |
| `quote` | Price protection for a proposed deal |
| `offer` / `counter` / `accept` | The negotiation moves |
| `contract.create` / `contract.sign` | Bind price, terms, transcript hash |
| `order.create` | Create the PayPal order at the agreed amount |
| `claim.open` | Buyer/agent recourse |

**Control model:** the LLM writes the conversation and chooses among **server-computed legal moves**; the policy engine validates every number, term and limit. The model cannot invent a price below the floor or above the buyer's mandate. Every move is logged in the contract transcript.

**Catalog connectors (MVP order):**
1. CSV/JSON upload (works for any merchant immediately).
2. Custom REST feed.
3. Shopify (products + draft order), WooCommerce (products + cart hooks), BigCommerce.
4. Google Merchant/XML feed for discovery.

**Per-item fields:**
```json
{
  "sku": "AURORA-ONE",
  "title": "Aurora One headphones",
  "price": 249,
  "currency": "USD",
  "category": "audio",
  "negotiable": true,
  "floor_pct": 0.82,
  "auto_accept_pct": 0.95,
  "max_discount_pct": 18,
  "terms": { "delivery_days": 3, "returns_days": 30, "warranty_months": 12 },
  "protection_tier": "A"
}
```
The **floor is never exposed** to the buyer agent; the server only emits accepted/countered decisions.

---

## 5. What the consumer's AI sees (MCP / OpenAPI)

A minimal, agent-readable surface:

```text
settled.merchant.list        -> merchants that accept agent negotiation
settled.catalog.search       -> {merchant, sku, title, price, negotiable, category}
settled.negotiate.start      -> {contract_id, merchant_agent, policy_summary}
settled.negotiate.move       -> {offer|counter|accept, price, message, constraints}
settled.contract.accept      -> {contract_hash, terms, protection_quote, pay_url}
settled.claim.open           -> {claim_id, status, refund_id}
```

Auth: **Agent Passport** (operator, mandate, limits). Payment: PayPal order created by Settled at the agreed price; no card data touches Settled.

---

## 6. How PayPal deploys it to all merchants

1. **PayPal app/partner listing** — merchants install from the PayPal ecosystem; OAuth + Partner Referrals.
2. **PayPal-hosted onboarding** — Settled runs as a partner service; PayPal assigns merchant IDs, handles KYB, exposes the app.
3. **Distribution** — PayPal sales/merchant success promotes it; the fee is on protected GMV (`platform_fees` where partner-gated, invoice fallback).
4. **Data loop** — PayPal capture/refund/dispute webhooks feed the merchant trust credential; the credential prices the next deal.

**Revenue:** merchant bps on protected GMV; platform license for PSPs/marketplaces; agent API/per-verify; later insurance/credit commission.

---

## 7. Why this is better than the current demo framing

- **The merchant is the customer, not the consumer.** PayPal already owns the merchant relationship.
- **The merchant agent is configurable** — inventory, rules, tone, terms — so it fits any category, not just audio.
- **Any consumer AI can connect** — no app, no browser extension, no new checkout.
- **The universal path is genuinely storefront-agnostic** — hosted negotiated checkout works wherever PayPal is accepted.
- **The trust/protection/recourse layer remains the moat** — a negotiation without a guarantee is just a chatbot.

---

## 8. The smallest build that proves it (next 3–5 days)

1. **`/merchant.html`** — merchant console: connect (sandbox), catalog list, toggle `negotiable`, set floor/auto-accept/max discount/terms, agent name/tone, publish.
2. **Catalog API** — `GET/POST /api/merchants/:id/catalog`, per-product policy; `contract.create` reads it.
3. **`/negotiate.html?merchant=m1&sku=p1`** — consumer-agent-facing page: passport, mandate, chat with the merchant agent, signed contract, PayPal checkout.
4. **Hosted order** — create PayPal order at agreed amount; order webhook/ACC for fulfillment.
5. **Demo update** — step 3 remains the agent-to-agent chat; add a "Merchant setup" tab/screenshot; video shows setup → negotiation → payment → claim.

**Do not build yet:** full OAuth, Shopify app review, MCP server, insurer integration. Show them as the 30/60/90 path.

---

## 9. Judge's view (what to show)

- **Plug-and-play:** merchant connects, imports catalog, sets 3 rules, publishes link — in under 2 minutes.
- **Native agent:** the merchant's agent reads the catalog, negotiates within policy, signs the contract.
- **Any storefront:** hosted negotiation link works on a plain HTML page with a PayPal button; plugin path for Shopify/Woo.
- **Consumer AI:** a second agent with a mandate negotiates; no new app.
- **PayPal:** real sandbox order/capture/refund IDs; protection priced; claim paid.
- **Honesty:** hosted mode bypasses the cart; native mode changes it; say which is which.

---

## 10. One-line pitch

> **PayPal gives every merchant a native negotiation agent: connect your catalog, choose what's negotiable, set your rules — and any customer's AI can negotiate, with PayPal settling and backing the deal.**
