# Has this been tried? Prior art + what PayPal has already explored

*Research note for Settled — 2026-11-03. Sources linked; "reported" = press/third-party claim not independently verified.*

---

## 0. The short answer

**The ingredients have been tried. The assembly has not shipped.**

- **Trust badges** (TrustedSite, BuySafe/Norton, McAfee) sell certification and capped guarantees for a flat fee — not an outcome ledger, not portable, not agent-readable.
- **Chargeback/fraud guarantees** (Signifyd, Riskified, Forter, ClearSale, NoFraud) are the closest *business model*: merchant-paid, risk-scored, financially guaranteed — but merchant-facing, not a consumer/agent credential, and no instant buyer claim.
- **Buyer protection** (PayPal, Amazon A-to-z, eBay MBG, escrow) is post-hoc, platform-bound and free — not a pre-purchase trust signal or a priced risk product.
- **Portable reputation** has been attempted at least eight times and almost all died (TrustCloud, Traity, Credo360, Deemly, Karma, eRated…); the lesson is distribution at the moment of decision, not a destination site.
- **Agentic commerce** has agent *identity/authorization* (Mastercard Agent Pay, Visa Intelligent Commerce, AP2 mandates) but no machine-readable **merchant trust + recourse** primitive.

**PayPal has explored every adjacent layer** — protection, returns, merchant credit, fraud/risk M&A, deals, ads, wallet interoperability, agentic checkout — but has **never productized a portable merchant reputation, risk-priced protection, or an agent trust API.** Its FY2025 10-K shows buyer protection as a **$1.34B provision / $1.49B realized-loss cost center bundled into every payment** — no risk-based price, no portable credential, no instant claim settlement. That is the white space Settled targets, and also why PayPal is the most likely partner/acquirer.

---

## 1. Direct prior art, by category

| Category | Players | What they actually do | What they lack vs Settled |
|---|---|---|---|
| **Trust badges / certification** | [TrustedSite](https://www.trustedsite.com/) (400k+ businesses, 2–30% conversion lift), McAfee Secure, [BuySafe/Norton Shopping Guarantee](https://www.buysafe.com/) ($1,000 guarantee, 3.3M purchases/month), BBB, Google Customer Reviews | Paid certification + a badge; BuySafe adds a capped purchase guarantee | No outcome-derived reputation; not portable; no risk pricing; no agent API; capped, claims-based |
| **Chargeback / fraud guarantees** | [Signifyd](https://www.bigcommerce.com/apps/signifyd/), [Riskified](https://www.riskified.com/chargeback-guarantee/), Forter, ClearSale, NoFraud | Score transactions/merchants and guarantee the merchant against fraud/chargebacks | Merchant-facing; no consumer-facing credential; no portable reputation; not agent-readable; no instant buyer payout |
| **Buyer protection / escrow** | PayPal Buyer/Seller Protection, Amazon A-to-z, eBay Money Back Guarantee, [Escrow.com](https://www.escrow.com/), Alibaba Trade Assurance | Resolve after a problem; escrow holds funds per deal | Post-hoc and slow; platform-bound; free/universal rather than risk-priced; no portable trust |
| **Merchant credit from transaction data** | PayPal Working Capital (2013+), Shopify Capital, Amazon Lending, D&B, Nav, Creditsafe | Underwrite merchants from sales/credit data; lend | Platform/walled; credit only, not trust/recourse; no consumer-facing credential |
| **Portable reputation** | TrustCloud, Traity (~$4.7M, 4.5M users, out of business 2020), Credo360, Deemly, Karma, eRated; survivor HeatWare (embedded in trading forums); [Hesse & Teubner, HICSS 2020](https://scholarspace.manoa.hawaii.edu/bitstream/10125/64371/0506.pdf) | Aggregate/portable reviews across platforms | Cold start, platform resistance, no willingness to pay, no distribution at decision moment; **no settlement/guarantee** |
| **Agent identity / authorization** | [Mastercard Agent Pay](https://www.mastercard.com/news/latin-america/es/perspectivas/blog-posts/blog-es/2025/octubre/impulsando-el-comercio-agentico-con-confianza/) (agent registration, Web Bot Auth, intent data), [Visa Intelligent Commerce](https://www.visa.com.hk/en_HK/about-visa/newsroom/press-releases/visa-expands-visa-intelligent-commerce-across-asia-pacific-prepares-for-ai-commerce-pilot-by-early-2026.html), [Google AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol) mandates, OpenAI ACP/Stripe | Prove the agent is legitimate and the consumer authorized it | **No merchant trust credential; no buyer recourse; no risk-priced protection** |
| **Platform seller scores** | Amazon A-to-z/seller performance, eBay feedback, Etsy Star Seller, Faire | Walled reputation inside one marketplace | Not portable; review pollution; no agent API; no instant payout |
| **"Trust API" / risk-as-code** | *(none found)* | — | **This is the open slot** |

**Closest competitors, honestly** (full audit: [research/prior-art.md](research/prior-art.md)):

1. **Signifyd** — the closest product. It already risk-prices per-order protection ("100% financial guarantee") and markets **"Instant Refunds"** under Returns Assurance. But the guarantee is **merchant indemnity against fraud chargebacks**: the money flows to the seller's chargeback ledger, the buyer gets nothing directly, the scoring is single-tenant, nothing is signed/exportable, and "instant refunds" are merchant-granted refunds that Signifyd underwrites — **not buyer-initiated claims paid from a merchant reserve.**
2. **Mastercard Merchant Trust Services** (Sept 30, 2026) — network-level merchant trust is already shipping, but it is **acquirer/issuer-facing risk signalling**: the data stays private, there is no per-transaction protection price and no buyer payout.
3. **BuySafe / Norton Shopping Guarantee** (since 2003) — consumer-facing guarantee badge. Proves demand; capped, flat-fee, no outcome pricing, no portability, no agent API.
4. **PayPal Buyer Protection** — the trust brand and rail, but free/post-hoc and not portable.
5. **Google Trusted Stores (2011–2016)** — the most instructive failure: a platform with enormous traffic ran badging **plus** purchase protection, then killed it and kept only reviews. Adjudicating buyer disputes was a cost center with no revenue mapping. **Lesson: the reserve must be merchant-funded and adjudication rule-based, or Settled repeats Google's economics.**

**The narrow white space:** a **signed, outcome-derived, portable merchant credential + risk-priced protection + instant reserve payout + agent-readable API**. Every precedent holds at most two of those four.

---

## 2. The portable-reputation graveyard (why "trust network" alone fails)

Reported by [Nerdbeak's "Portable Reputation Graveyard"](https://www.nerdbeak.com/company/blog/portable-reputation-graveyard) (2026): at least eight startups tried portable reputation since 2009, raised $10M+, peaked at 4.5M users, and almost all are dead — TrustCloud, Traity, Credo360, Deemly, Reputationaire, Karma, eRated. Two survivors: **HeatWare** (embedded forum plugin, 25 years) and **eBay feedback** (deliberately non-portable, lock-in).

**Five lessons that map directly onto Settled:**

1. **Distribution at the moment of decision.** A destination site fails; the trust check must live where the purchase happens — hence payment-flow/API/MCP, not a website.
2. **Cold start / two-sided.** Start where the merchant already has transaction history and the buyer is already at checkout.
3. **Willingness to pay.** Consumers won't pay; the merchant (or the platform) must — hence bps on protected GMV.
4. **Platform resistance.** Don't try to aggregate Amazon/eBay/BigCommerce data without partnership; use the merchant's own payment events.
5. **Trust paradox.** A new trust brand needs usage; embed in an existing trusted flow (PayPal) rather than ask people to trust a new site.

A related cautionary tale: **Fakespot** (fake-review detection) was acquired by Mozilla in 2023 and shut down in July 2025 because *"it didn't fit a model we could sustain"* — consumer trust tooling with no payer has a unit-economics ceiling. Settled avoids that by charging merchants on protected GMV.

---

## 3. What PayPal has already explored (timeline)

| Year | Move | What it was | Outcome / lesson |
|---|---|---|---|
| 2008 | **Fraud Sciences (~$169M)** | Fraud/risk analytics acquired by eBay/PayPal | Absorbed into PayPal's internal risk engine — **never exported as a product** |
| 2010 | CyberSource (~$2.0B, reported) | Gateway + risk services | Folded into merchant acquiring/Braintree; not a standalone trust product |
| 2013 | **PayPal Working Capital** | Merchant advances repaid from a % of sales; priced off payment volume | **1.3M loans / $25.6B by mid-2022; >$30B by 2025** (WebBank-funded) — proves payment data underwrites merchant behaviour |
| 2014 | Buyer protection extended to **intangibles** (UK first) | Digital goods, services, tickets covered | PayPal chose to eat the risk; broadened SNAD |
| 2015 | **Buyer protection window 45 → 180 days** | Longer dispute tail, "from expected delivery" clock | Protection costs rose structurally; trust became a competitive weapon and a permanent liability |
| 2015–23 | **Return Shipping on Us** | Reimbursed return shipping for eligible purchases | Wound down in 2023 — returns-as-a-perk didn't survive cost review |
| 2017 | **Swift Financial (~$183M, reported)** | Longer-term business lending + underwriting | Faster than building; expanded PayPal Business Loan |
| 2018 | **Simility ($120M)** | Merchant fraud/risk decisioning platform | Folded into merchant risk tooling; brand retired — **risk tech is bought, not published** |
| 2020 | **Honey (~$4B)** | Shopping assistant / deals / ~17M MAU | 2024 exposé → Jan 2025 suits; **~$110M revenue decline in 2025**; class action largely dismissed late 2026 — consumer trust products can become trust liabilities |
| 2021 | **Happy Returns acquired** | Box-free returns network (logistics, not payments) | **Sold to UPS 1 Nov 2023 for ~$466M net cash, $339M gain** — "focus on core"; post-purchase is a logistics business |
| 2021 (reported) | **Chargehound** | Chargeback/dispute automation | Runs as "Chargehound, a PayPal company" — kept inside the merchant stack |
| 2024 (Oct) | **PayPal Ads** | Retail-media network on cross-merchant transaction data | Named an advertising growth area in the FY2025 10-K — **transaction data monetizes as media, not risk pricing** |
| 2025 (Feb) | **PayPal Open** | Unified payments/growth platform (PayPal, Braintree, Venmo) | A distribution surface for a trust API already exists |
| 2025 (Apr) | **Agent Toolkit + MCP** | `create_order`, `pay_order`, invoices, disputes as agent tools | Agents can **pay** a price; no trust/negotiation tool |
| 2025 (Sep) | **AP2 with Google** | Signed Checkout/Payment Mandates for agent payments | Standards work on **authorization**, not reputation/recourse |
| 2025 (Oct 28) | **Agentic Commerce Services / Store Sync / Agent Ready + OpenAI ChatGPT checkout** | Product feeds/discovery + accept agent payments | Agent **checkout**, not agent **trust** |
| 2026 (Jan) | **Cymbio acquisition** | Marketplace/dropship feed automation | Plumbing to be the default agent-commerce layer |
| 2026 (Sep) | **Meta Muse checkout; WebMCP in the JS SDK** | Muse agents can shop/check out at PayPal merchants; WebMCP exposes search/cart/checkout tools | PayPal becomes one of several agent rails; ~4.6× lower inference, ~2× faster, 3 tool calls vs 30 UI steps — **agent rail is here; trust is not** |
| FY2025 | **Protection: $1,337M provision, $1,487M realized losses** | Bundled into every payment | **No risk-based price, no portable credential, no instant claim settlement** |


**Other adjacent bets (context):** Braintree (2013, gateway), Xoom (2015, remittances), iZettle (2018, POS), Hyperwallet (2018, payouts), Paidy (2021, Japan BNPL), Venmo/PayPal.Me (P2P), PayPal Credit/Pay Later (consumer credit), PYUSD (stablecoin, 2023→). The pattern is consistent: PayPal buys or builds adjacent financial/commerce infrastructure, then folds it into the payment relationship. Trust as a *portable product* is the one adjacent layer it has not folded in.

**Pattern:** PayPal expands from payments into adjacent value (risk, credit, returns, deals, ads, agentic checkout), often by acquisition, and sheds what isn't core. Its trust asset remains **Buyer Protection** (free, post-hoc, platform-bound); its data monetization is **Ads** (targeting, not underwriting); its agent strategy is **checkout**, not trust.

**What PayPal has *not* done:**
- publish a **portable merchant reputation / credential** across stores;
- **price protection** per transaction (risk tiers, reserve, escrow);
- pay claims **instantly from a merchant reserve** (disputes take days);
- expose a **`trust.verify` API** to agents (its toolkit has no trust tool);
- offer a **cross-merchant trust decision** (it has the data; it uses it for ads and its own risk).

---

## 4. What that means for Settled

**Novelty: 6/10.** Components are old; the combination is unshipped, and the closest competitor (Signifyd) is closer than most pitches admit. The closest threats are:

| Threat | Likelihood | Why |
|---|---|---|
| **PayPal builds/acquires it** | High | It has the data, the trust brand, the rails and an agent strategy that stops one step short |
| **Signifyd/Riskified add buyer-facing trust** | Medium | Same buyer/budget; they already underwrite and guarantee |
| **Mastercard/Visa add merchant trust + recourse** | Medium | They are building agent identity; merchant trust is adjacent |
| **TrustedSite/BuySafe add outcome data** | Low–Medium | They lack transaction/dispute data |
| **A platform walls it (Shopify/Amazon)** | Medium | Distribution risk; partner or go merchant-direct |

**The three-condition test (must all hold, or it is a Signifyd clone with a consumer UI):**
1. **Buyer-initiated claims paid in seconds from the merchant's own reserve** (not merchant-granted refunds underwritten by a third party).
2. **The signed state is accepted by parties other than the issuer** — a credential that travels to other checkouts/agents, not a single-tenant score.
3. **The fee moves with that state** across sites, so the merchant's protection price changes with its behaviour.

**Honest risks to state in the pitch:** consumer-reporting law and insurance licensing for reserves/claims; adverse selection (bad merchants buy protection, good ones don't need it); delivery provenance (who validates the outcome?); platform refusal to accept a third-party credential; and the incumbent move — Mastercard/Visa/PayPal can extend private trust scores to buyers without ever publishing a ledger. *Nov 2026 is late enough that the network version is already shipping; the only durable wedge is neutrality + portability + instant payout, all three at once.*

**Strategic read:** Settled should be positioned as a **PayPal-native trust/recourse layer** (partner or acquisition), not a checkout competitor. The "trust settlement" primitive is the thing PayPal's agentic-commerce push is missing: it already lets agents pay; it cannot yet tell them whom to trust or make the buyer whole instantly.

**Partner, acquisition, or competitor?** The record says **partner/acquisition is more likely than competitor.** PayPal has historically *bought* risk primitives rather than build neutral infrastructure — Fraud Sciences (~$169M, 2008), Simility ($120M, 2018), Chargehound (reported, 2021), Happy Returns (2021, later sold), Cymbio (2026) — and its agentic strategy now needs exactly the portable trust signal it lacks. It becomes a competitor only if Settled turns into a neutral registry that devalues PayPal's transaction-data/Ads moat. The strongest BD line: *PayPal already spends ~$1.3B/year on protection with no risk-based pricing and no portable trust signal; Settled turns that cost centre into a priced, portable product for the agent channel.*

**The one-line answer to "has this been tried?"**
> *Every ingredient has been tried — badges, guarantees, buyer protection, merchant credit, portable reputation, agent identity. The assembled product — a portable, outcome-signed merchant credential that prices protection and pays claims instantly, exposed as an agent-readable API — has not shipped. PayPal has explored every adjacent layer and stopped one step short, which is either the opportunity or the acquisition thesis.*

---

## 5. Sources (selected)

- TrustedSite 2026 trust survey: https://investor.wedbush.com/wedbush/article/bizwire-2026-6-11-trustedsites-2026-state-of-ecommerce-trust-research-reveals-ais-toll-on-shopper-confidence
- BuySafe / Norton Shopping Guarantee: https://www.buysafe.com/
- TrustedSite: https://www.trustedsite.com/
- Riskified chargeback guarantee: https://www.riskified.com/chargeback-guarantee/
- Signifyd (BigCommerce app): https://www.bigcommerce.com/apps/signifyd/
- Mastercard Agent Pay / agentic trust: https://www.mastercard.com/news/latin-america/es/perspectivas/blog-posts/blog-es/2025/octubre/impulsando-el-comercio-agentico-con-confianza/
- Mastercard Merchant Trust Services coverage: https://news.paymentrisk.org/mastercard-introduces-new-services-to-enhance-merchant-trust/
- Visa Intelligent Commerce: https://www.visa.com.hk/en_HK/about-visa/newsroom/press-releases/visa-expands-visa-intelligent-commerce-across-asia-pacific-prepares-for-ai-commerce-pilot-by-early-2026.html
- Google AP2: https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol
- PayPal WebMCP: https://developer.paypal.com/community/blog/WebMCP_PayPal_Agent_Ready/
- PayPal Agentic Commerce Services: https://developer.paypal.com/agentic-commerce-services/about
- PayPal Offsite Ads: https://newsroom.paypal-corp.com/2025-04-29-PayPal-Launches-Offsite-Ads-Unlocking-the-Power-of-Transaction-Data-Off-Platform
- PayPal Open: https://newsroom.paypal-corp.com/2025-02-25-Introducing-PayPal-Open-The-Unified-Payments-and-Growth-Platform-for-Businesses-of-All-Sizes
- PayPal World: https://newsroom.china.paypal-corp.com/2025-07-23-PayPal-World
- PayPal Simility ($120M): https://newsroom.paypal-corp.com/paypal-to-acquire-simility-to-expand-global-merchant-offerings
- PayPal Buyer Protection 180 days + intangibles: https://newsroom.latam.paypal-corp.com/paypal-aumenta-el-plazo-de-su-programa-de-proteccin-al-comprador
- PayPal → UPS Happy Returns: https://www.paymentsdive.com/news/ups-acquires-happy-returns-reverse-logistics-Q4-2023/697995/
- Honey/Rakuten termination: https://ppc.land/honey-loses-access-to-2-000-clients-after-rakuten-network-termination/
- Portable reputation graveyard: https://www.nerdbeak.com/company/blog/portable-reputation-graveyard
- Reputation portability research: https://scholarspace.manoa.hawaii.edu/bitstream/10125/64371/0506.pdf
- Fakespot shutdown / unit economics: https://curlyethan.github.io/review-guardian/why-fakespot-stopped-working.html
- PayPal Working Capital: https://pep.paypal.com/us/cshelp/article/what-is-paypal-working-capital-and-how-do-i-apply-help430
- Full PayPal history audit: [research/paypal-history.md](research/paypal-history.md)
- Full prior-art audit: [research/prior-art.md](research/prior-art.md)
- PayPal FY2025 10-K (protection provision/losses, Working Capital, Happy Returns sale, Honey decline): https://www.sec.gov/Archives/edgar/data/1633917/000163391726000024/pypl-20251231.htm
