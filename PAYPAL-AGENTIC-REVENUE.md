# PayPal's revenue engine, agentic stack, and where Settled plugs in

*Analysis note · 2026-11-03 · sources in [research/paypal-history.md](research/paypal-history.md), [research/paypal-mechanics.md](../paypal-parley/research/paypal-mechanics.md), PayPal FY2025 release/10-K, developer.paypal.com*

---

## 1. Where the money actually comes from

| Metric (FY2025 / TTM) | Number | Source |
|---|---|---|
| **TPV** | **$1.794T** | FY2025 release |
| **Net revenue** | **$33.172B** | FY2025 release |
| **Blended take rate** | **~1.85%** | derived |
| **Transaction revenue** | **$29.80B** TTM (Dec 2025); **$30.86B** TTM (Sep 2026) | [StockAnalysis / TipRanks](https://stockanalysis.com/stocks/pypl/metrics/revenue-by-type/) |
| **Value-added services** | **$3.37B** TTM (Dec 2025); **$3.43B** TTM (Sep 2026) | same |
| **Transaction margin** | **$15.465B** (0.86% of TPV) | FY2025 release |
| **Branded checkout** | **30% of TPV, >65% of transaction gross profit** (~$538B TPV) | 2025 Investor Day (via UBS) |
| **Protection cost** | **$1,337M provision, $1,487M realized losses** | FY2025 10-K |

**Read:** ~90% of revenue is **transaction fees on payment volume**. The profit engine is **branded checkout** — the PayPal/Venmo button on a merchant's site — not Braintree/unbranded acquiring, which is lower margin. Value-added services (credit, subscriptions, etc.) are ~10% and growing; **Ads** is the new line. Everything PayPal does strategically is oriented to defend and grow **branded checkout TPV** and the margin on it.

**Why that matters for agentic:** if agents check out through ChatGPT/Google/Meta, PayPal risks becoming **an interchangeable rail** inside someone else's interface — same TPV, thinner relationship, pressure on take rate. The defence is to own the **identity + trust + protection** layer around the agent transaction, not just the payment verb.

---

## 2. Integration: how PayPal is embedded

| Surface | What it is |
|---|---|
| **PayPal/Venmo buttons + JS SDK** | Branded checkout on merchant sites; highest-margin volume |
| **Braintree** | Gateway/acquiring for merchants and platforms; lower-margin, high-volume |
| **REST APIs** | Orders v2, Payments v2, Invoicing, Subscriptions, Payouts, Disputes, Webhooks |
| **PayPal Open** (Feb 2025) | Unified merchant platform (PayPal + Braintree + Venmo + risk + capital + insights) |
| **Fastlane** (2024–25) | Guest checkout / conversion |
| **Agent Ready** (Oct 2025) | Accept agent payments via **ACP** (ChatGPT, delegated tokens through Braintree) and **UCP** (Google AI Mode/Gemini, Google Pay through Braintree or PayPal Orders v2) |
| **Store Sync** (Oct 2025) | Push catalog/product feeds to AI assistants for discovery + cart |
| **WebMCP** (Sep 2026) | JS SDK exposes search/cart/checkout tools to agentic browsers; buyer approves in PayPal |
| **Agent Toolkit / MCP** (Apr 2025 →) | Developer tools so agents can operate PayPal APIs |
| **PayPal World** (Jul 2025) | Wallet interoperability (Venmo, UPI, Mercado Pago, Tenpay), positioned for agentic shopping |

---

## 3. The agentic stack: broad in payment verbs, shallow in trust

**Timeline**

| Date | Move | What it does |
|---|---|---|
| Apr 2025 | **Agent Toolkit + MCP** | `create_order`, `get_order`, `pay_order`, invoices, subscriptions, catalog, disputes, shipment tracking, merchant insights — in OpenAI/LangChain/CrewAI/Bedrock agents |
| Sep 2025 | **AP2 with Google** | Signed Checkout/Payment Mandates — proof of what the user authorized |
| Oct 2025 | **Agentic Commerce Services / Store Sync / Agent Ready** + **OpenAI ChatGPT checkout** | Catalog discovery + accept agent payments across ChatGPT/Google |
| Jan 2026 | **Cymbio** acquisition | Marketplace/dropship feed automation for agentic discovery |
| Sep 2026 | **Meta Muse checkout; WebMCP in JS SDK** | Agents can shop/check out at PayPal merchants; structured tools replace UI scraping |
| Sep 2026 | **Agent Toolkit 1.11.0** | 20+ invoice tools, payments, disputes, tracking, catalog, subscriptions, insights |

**Depth scorecard (my judgment):**

| Capability | Depth | Detail |
|---|---|---|
| **Payment execution** | **8/10** | Orders, capture, refunds, invoices, subscriptions, payouts, disputes, tracking — agents can operate the whole payment lifecycle |
| **Acceptance surfaces** | **8/10** | ChatGPT (ACP), Google AI Mode/Gemini (UCP), Meta Muse, agentic browsers (WebMCP), Store Sync catalogs |
| **Authorization/identity** | **5/10** | AP2 mandates + ACP/UCP delegated tokens prove intent; but no agent identity/reputation/bond, no liability model |
| **Trust/reputation** | **2/10** | No portable merchant trust credential, no cross-merchant reputation, no `trust.verify` |
| **Risk-priced protection** | **1/10** | Protection is a bundled, free, post-hoc cost center ($1.3B provision); no tier → fee → capture/escrow |
| **Negotiation/commerce semantics** | **1/10** | `create_order` takes the price as given; no negotiation, no dynamic pricing, no contract |
| **Recourse/settlement for agent purchases** | **3/10** | Existing disputes/chargebacks; no instant claim from a merchant reserve, no buyer-facing guarantee for agent transactions |

**Bottom line:** PayPal's agentic tooling is a **deep payment-execution toolkit and a broad acceptance network** — but it stops at **authorization** ("can the agent pay?") and never reaches **assurance** ("should this merchant be trusted, and who pays if it fails?"). That is the layer Settled supplies.

---

## 4. How agents catalyse PayPal revenue

| Mechanism | How it shows up | Revenue effect |
|---|---|---|
| **New TPV surfaces** | Checkout inside ChatGPT/Google/Meta/browser agents; Store Sync discovery | Incremental TPV at ~1.85% take. 1% of $1.79T = $17.9B TPV → **~$331M**; 5% → **~$1.66B** |
| **Faster, cheaper checkout** | WebMCP: **~4.6× lower inference, ~2× faster, 3 tool calls vs 30 UI steps** | Higher conversion on agent traffic; less abandoned checkout |
| **Frequency / autonomy** | Agent-initiated repeat purchases, subscriptions, replenishment, procurement | More transactions per account; subscriptions are high-margin |
| **New fee SKUs** | Agent trust/protection, identity/mandates, agent analytics, platform fees | **The multiplier:** 25–100 bps on agent-protected GMV. $100B agent GMV at 30 bps = **$300M**; at 100 bps = **$1B** — additive to processing |
| **Risk reduction** | Agent identity/mandates + trust scoring reduce fraud/chargebacks | Lower protection losses against a $1.3B provision; lower dispute ops cost |
| **B2B / cross-border** | Invoices, net terms, Payouts, PayPal World | Larger tickets; new corridors |
| **Data** | Agent intent + cross-merchant purchase graph feeds Ads/insights | Ads is a named growth line in the 10-K |

**The strategic tension:** agentic checkout grows TPV but **disintermediates the consumer relationship** — the agent (ChatGPT, Gemini, Meta Muse) owns the front end, and PayPal becomes one of several rails (Meta also uses Stripe Link/Shop Pay). TPV alone doesn't protect the multiple; **the take rate does**. The way to protect the take rate is to own the parts of the agent transaction that are not commodity: **identity, trust, protection and recourse.** That is exactly the layer Settled provides — and it is the only layer PayPal's current stack does not have.

---

## 5. Where Settled plugs into PayPal's agent stack

| PayPal primitive | Settled layer |
|---|---|
| `create_order` / `pay_order` | **`trust.verify` first** — agent checks merchant tier/cap/fee/mode before creating the order |
| Orders v2 capture | **Risk-priced protection decision**: instant capture / capture + reserve / escrow / decline, priced off the merchant ledger |
| `POST /v2/payments/captures/{id}/refund` | **Instant claim payout** from the merchant reserve (buyer-initiated, not merchant-granted) |
| Webhooks (`CAPTURE.COMPLETED`, `REFUND`, `DISPUTE`) | **Signed outcome events** that update the portable credential |
| Agent Ready / ACP / UCP | **Trust check inside agent checkout** so agents can enforce merchant thresholds |
| Agent Toolkit / MCP | Add **`trust.verify`, `protection.quote`, `claim.file`** tools — the missing verbs |
| Store Sync catalogs | Merchant credential attached to product/merchant records for agent discovery |
| PayPal Ads | No conflict if Settled is neutral; potential data partnership |

**Positioning:** not a checkout competitor, not a PSP — a **trust-and-recourse layer sold into PayPal's agentic stack** (partnership/API customer, with acquisition as the strategic endgame). The pitch fact: **PayPal already spends ~$1.3B/year on protection with no risk-based pricing and no portable trust signal; Settled turns that cost centre into a priced, portable product for the agent channel.**

---

## 6. Honest caveats

- **PayPal may keep trust proprietary.** Its transaction data and Ads business make a neutral registry strategically awkward; it may extend private merchant risk scores to buyers instead of publishing a ledger.
- **Take-rate risk.** If PayPal treats protection as a free bundle, a paid trust layer competes with "free" — Settled must price against **claims cost + conversion lift**, not against zero.
- **Agent identity is being solved elsewhere.** Mastercard Agent Pay/Visa Trusted Agent/AP2 own authorization; Settled should integrate with them, not compete.
- **Toolkit depth is real but shallow in trust.** The Agent Toolkit is a strong developer surface (~20 invoice tools, payments, disputes, tracking), but there is no trust, negotiation or reputation verb — that is the gap, and also the easiest integration point.

---

## 7. One-line summary

> **PayPal makes ~90% of its revenue on transaction fees, and branded checkout is its profit engine. Its agentic stack is deep on payment execution and acceptance (Agent Toolkit/MCP, AP2, Agent Ready, Store Sync, WebMCP, ChatGPT/Google/Meta) but shallow on trust, risk pricing and recourse. Agents can grow TPV; they cannot protect the take rate without a trust layer. That is Settled's seat: the trust-and-recourse API inside agent checkout — priced, portable, collateralised, and machine-readable.**
