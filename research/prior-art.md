# Settled — prior-art audit

Product audited (per `settled/README.md`): a signed, portable merchant trust ledger derived from payment outcomes
(delivery, disputes, chargebacks) that **prices buyer protection per transaction** (instant capture / capture+reserve /
escrow / decline), **pays claims instantly from a merchant reserve**, and exposes an agent-readable `trust.verify` API.
Researched 2026-11-03. Every claim linked; **[UNVERIFIED]** = could not confirm from a primary/authoritative source;
**[judgment]** = my read.

## TL;DR — the honest verdict

- **Every component exists somewhere; the closed loop does not.** Risk-priced per-order guarantees are Signifyd's
  business ([100% financial guarantee](https://www.signifyd.com/purchase-optimization/guaranteed-fraud-protection/));
  consumer-facing guarantees attached to a badge are BuySafe/Norton's, running since 2003
  ([about](https://www.buysafe.com/about/)); network-level merchant trust scoring exists as of 2026 (Mastercard
  Merchant Trust Services); transaction-derived underwriting exists (Stripe/Shopify/PayPal Capital); signed
  trusted-agent credentials exist (Visa TAP, AP2).
- **What has never shipped:** a *portable, signed, buyer-facing* merchant outcome credential **with money behind it** —
  a reserve that pays a buyer-initiated claim instantly and feeds the outcome back into the merchant's price of
  protection at other checkouts. Networks keep the data private; marketplaces keep the badge inside their walls;
  insurers keep the reserve. Nobody unifies the three.
- **Closest competitor:** Signifyd (guaranteed fraud protection + chargeback protection + "Instant Refunds" under
  Returns Assurance). Second: Mastercard Merchant Trust Services (network-level merchant trust, 2026). Third:
  BuySafe/Norton Shopping Guarantee (consumer-facing guarantee attached to a merchant badge, Shopify-distributed).
- **Novelty: 6/10.** Combinatorial, not conceptual. The defensible claim is the *loop and the portability*, not the
  idea of trust scoring, protection pricing, or instant refunds.

## (a) Trust badges / certifications — alive, but trust theater

- **TrustedSite** (formerly McAfee SECURE): paid certification badges for "security, business integrity, and merchant
  reliability," 400k+ businesses, claims 2–30% conversion lift, integrations for Shopify/BigCommerce/Woo/Magento
  (https://www.trustedsite.com/). *Gap:* certification is point-in-time and policy-based, **not derived from payment
  outcomes**; no financial backing, no claims paid, no machine-readable credential beyond a directory listing.
- **BuySafe / Norton Shopping Guarantee** (see (b) — the badge *does* carry a guarantee). *Gap:* merchant-paid
  subscription, guarantee terms set by BuySafe, not risk-priced per transaction.
- **BBB accreditation, Trustpilot, Google Customer Reviews**: self-reported/review data; no payment-outcome truth, no
  adjudication, no money behind the mark. Trustpilot and Google Customer Reviews are reputational only.
- **[judgment]** The badge economy proves demand for third-party trust signals but has trained merchants to buy
  *marks*, not underwriting — a positioning problem Settled must overcome by making the badge a byproduct of the ledger.

## (b) Buyer-protection guarantees attached to a merchant — the 20-year precedent

- **BuySafe / Norton Shopping Guarantee**: founded 2003 after the founder was scammed, "a third party, independently
  verifying businesses"; shoppers get a shopping guarantee and can [start a claim](https://www.buysafe.com/shoppers/);
  now operated under Simpler Postage and distributed via a [Shopify app](https://apps.shopify.com/buysafe). Norton
  Shopping Guarantee "protects your online orders against damage, theft, loss, and fraud"
  (https://norton.buysafe.com/for-shoppers/). *What it lacks:* merchant-paid flat pricing rather than per-order risk
  pricing, no payment-outcome ledger, no portability outside the guarantee contract, no agent API, claim timelines not
  instant. **[UNVERIFIED]** coverage limits and payout speed.
- **Google Trusted Stores** (2011–2016): badge + purchase protection + data feed to Google; discontinued and replaced
  by Google Customer Reviews ([shutdown coverage](https://martech.org/google-trusted-stores-shut-transition-google-customer-reviews/),
  [replacement writeup](https://www.zentail.com/blog/google-trusted-stores-becomes-google-customer-reviews)).
  **This is the most instructive failure**: a platform with enormous traffic ran badging + protection, then killed it
  and kept only reviews. **[judgment]** Cause: adjudicating shopper disputes is a cost center that did not map to
  Google's revenue, and a badge without underwriting was cheaper to run. Lesson for Settled: the reserve must be
  merchant-funded and adjudication rule-based, or the economics repeat Google's.
- **[UNVERIFIED]** Google Trusted Stores' protection ceiling (widely reported as $1,000/order) — could not confirm
  from a primary source in this pass.

## (c) Chargeback / fraud guarantees — the real incumbents

- **Signifyd**: "100% financial guarantee" on approved orders, plus Chargeback Recovery and Complete Chargeback
  Protection; under Returns Assurance it markets **"Instant Refunds — deliver instant, risk-free refunds"**
  (https://www.signifyd.com/returns-assurance/). *Mechanism:* Signifyd scores the order and, if it approves it,
  indemnifies the merchant against fraud chargebacks. *Gap:* merchant-facing indemnity, **fraud-only**; the payout goes
  to the merchant, not to the buyer; no portable credential, no buyer-initiated claim against a reserve, no effect on
  the merchant's cost of protection at other sites.
- **Riskified**: 10-K states it charges "a percentage of every dollar of GMV that we approve"
  (https://ir.riskified.com/ and https://stockanalysis.com/stocks/rskd/filings/1135213/) and that the Chargeback
  Guarantee "automatically approves or declines online orders with guaranteed performance levels" — i.e. risk-priced
  per-transaction protection **for the merchant**. *Gap:* same as Signifyd; no buyer-facing/portable artifact.
- **Forter, ClearSale, NoFraud, Bolt, Sift, Kount**: same family — decision + optional guarantee, sold to merchants,
  priced on volume/GMV (Forter: https://www.forter.com/; Sift: https://sift.com/). **[judgment]** None publishes a
  signed merchant credential or lets an agent ask "what is this seller's protection price?"
- **What this proves:** per-transaction risk pricing of protection is a solved commercial model. **What it does not
  prove:** that protection can be *portable*, buyer-facing, and reserve-funded — that is Settled's claim.

## (d) Platform buyer protection / escrow — alive, walled, slow

- **PayPal Buyer Protection**: platform policy covering item-not-received / not-as-described, with eligibility rules
  and a claims window (https://www.paypalobjects.com/marketing/ua/pdf/HK/en/buyer-protection-061324.pdf);
  **Amazon A-to-z Guarantee** (https://www.amazon.ca/gp/help/customer/display.html?nodeId=GQ37ZCNECJKTFYQV) and
  **eBay Money Back Guarantee** (https://pages.ebay.com/ebay-money-back-guarantee/) work the same way: platform-funded,
  platform-adjudicated, days-to-weeks, only inside their walls.
- **Escrow.com** (https://www.escrow.com/) and **Alibaba Trade Assurance**
  (https://tradeassurance.alibaba.com/): escrow/settlement-based protection, % fee, transaction-scoped, no portable
  reputation output, no instant adjudication — a marketplace feature, not a credential. **[judgment]**
- **Why this matters:** each platform already holds the outcome data Settled wants — and each keeps it. That is the
  strategic reason a *neutral* ledger could exist, and also the reason incumbents can strangle it by refusing to
  publish outcomes.

## (e) Transaction-derived underwriting — the data exists, the product is a loan

- **PayPal Working Capital / business loans**, **Stripe Capital** (https://stripe.com/capital), **Shopify Capital**
  (https://www.shopify.com/capital), **Amazon Lending**: all underwrite merchants from payment history — proof that
  payment outcomes are credit-grade data. *Gap:* the output is a loan to the merchant, platform-bound, and **not a
  transferable or signed reputation artifact**.
- **Dun & Bradstreet** (https://www.dnb.com/), **Nav** (https://www.nav.com/), **Creditsafe**
  (https://www.creditsafe.com/): business credit bureaus — portable-ish risk scores, but built on trade credit and
  filings, **not per-order payment outcomes**, and not usable as a real-time checkout protection price.
- **[judgment]** This is the strongest "the data is already valuable" argument for Settled — and the strongest
  counterargument that incumbents will simply extend their own scoring to the buyer side before a neutral ledger wins.

## (f) Reputation portability — researched, not shipped

- **Hesse & Teubner** (HICSS 2020 milieu): "Takeaway Trust: A market data perspective on reputation portability in
  electronic commerce" and "In Stars We Trust — A Note on Reputation Portability Between Digital Platforms"
  (https://dblp.org/pid/263/3154.xml; HICSS copy:
  https://scholarspace.manoa.hawaii.edu/server/api/core/bitstreams/37046434-837c-43bd-86bc-db415e048bd2/content
  **[UNVERIFIED]** exact title of the HICSS version). Their finding, in short: portability is technically feasible
  and incentive-ambiguous — platforms resist exporting the reputation they paid to build. **[judgment]** This is the
  academic validation of Settled's core bet *and* its biggest adoption risk.
- **Blockchain reputation**: Kleros (https://kleros.io/) and academic designs such as TU Delft's "Anonymous and
  Verifiable Reputation System for E-Commerce Platforms Based on Blockchain"
  (https://pure.tudelft.nl/ws/portalfiles/portal/116555913/Anonymous_and_Verifiable_Reputation_System_for_E_Commerce_Platforms_Based_on_Blockchain.pdf)
  — verifiable and portable in theory, no financial backing, negligible commerce adoption. World ID and similar
  identity systems solve "who", not "will this seller pay if something goes wrong".

## (g) Agentic-commerce trust — signing the *agent*, not the *merchant*

- **Visa Trusted Agent Protocol** (Oct 14, 2025, with Cloudflare; Adyen, Checkout.com, Stripe, Shopify, Coinbase and
  others consulted): cryptographic agent intent + consumer recognition + payment data, so merchants can tell trusted
  agents from bots (https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-unveils-trusted-agent-protocol-for-ai-commerce.html;
  https://developer.visa.com/capabilities/trusted-agent-protocol/overview).
- **Mastercard Merchant Trust Services** (Sept 30, 2026): uses Mastercard's network, cyber and identity intelligence to
  distinguish legitimate from risky merchants, aimed at **acquirers/PSPs during onboarding**, plus a 72-hour
  investigation requirement for suspect merchant activity and an issuer-side "Merchant Scam & Risk Indicator" for
  authorization-time merchant risk (https://www.mastercard.com/us/en/news-and-trends/press/2026/september/new-trust-and-intelligence-services.html
  **[blocked, 403 — details via Digital Transactions report]**:
  https://www.digitaltransactions.net/eye-on-fraud-mastercard-merchant-trust-services-debuts-darwinium-takes-on-remote-access-scams/).
- **AP2** (https://ap2-protocol.org/): signed Checkout and Payment Mandates + receipts — evidence of *what the user
  authorized*, not of *whether the merchant delivers*. **UCP** (https://ucp.dev/) standardizes catalog/cart/checkout
  with AP2 as an extension. **OpenAI/Stripe ACP** (https://www.agenticcommerce.dev/): checkout protocol for agents,
  likewise no merchant-reputation or recourse primitive.
- **[judgment]** The entire 2025–26 agent stack solves "can I trust this agent / this authorization" and leaves "can I
  trust this seller to deliver after the agent pays" to existing card disputes — which is precisely Settled's opening
  (and why `trust.verify` is a genuinely novel API shape, not a re-skin of TAP).

## (h) "Trust APIs" / risk-as-code — scores, not credentials

Sift (https://sift.com/), Ravelin (https://www.ravelin.com/), Trustfull (https://trustfull.com/): APIs that return a
risk decision/score for a session, account or payment. **Gap:** output is internal risk for the merchant; nothing is
signed, portable, buyer-verifiable, or priced as protection. **[judgment]** No product found that returns
"trust decision + protection cap + fee + signature" in one call — the shape Settled's `trust.verify` proposes.

## (i) Adjacent financial precedent — insurance and parametric payout

- **Parametric insurance** (Descartes Underwriting, https://www.descartesunderwriting.com/): pays on a measured
  trigger rather than loss adjustment — the closest operational precedent for **instant claims from a reserve**.
  *Gap:* commercial/catastrophe risk, not per-order commerce trust.
- **Trade credit insurance** (Allianz Trade, https://www.allianz-trade.com/): covers a seller's receivable default —
  the inverse direction (insuring the counterparty), and slow, underwriting-heavy. **[judgment]** The *reserve +
  instant payout* mechanic is proven in insurance; the *per-transaction, merchant-funded, buyer-initiated* version is
  not a packaged product.
- **Warranty/returns startups** (e.g. Extend) sell per-item protection at checkout — proof that consumers will pay for
  checkout-attached protection, but the protection is a product warranty, not trust in the seller, and it isn't priced
  off the seller's outcome record. **[UNVERIFIED]** on Extend specifics; category observation only.

## (j) attempt → outcome → what it lacked

| Attempt | Outcome | What it lacked (and Settled's claimed fix) |
|---|---|---|
| Trust badges (TrustedSite, BBB, McAfee SECURE) | Alive; 400k+ sites; subscription revenue | No payment-outcome data, no money behind the mark, no API → ledger + reserve |
| BuySafe / Norton Shopping Guarantee (2003–) | Alive, niche, Shopify-distributed | Flat merchant pricing, no per-order risk price, no portability, not instant |
| Google Trusted Stores (2011–2016) | **Shut down**, replaced by Customer Reviews | Dispute adjudication was a cost center with no revenue mapping; badge ≠ underwriting |
| Signifyd / Riskified / Forter guarantees | Alive, large; priced as % of approved GMV | Merchant-facing indemnity, fraud-only, no buyer-facing credential, no portable ledger |
| Signifyd "Instant Refunds" (Returns Assurance) | Alive (2026) | Merchant grants the refund and Signifyd underwrites it; not buyer-initiated from a reserve |
| Platform buyer protection (PayPal, Amazon A-to-z, eBay MBG, Escrow.com, Trade Assurance) | Alive, standard | Platform-bound, slow, discretionary; outcome data never exported |
| Payment-derived underwriting (PayPal/Stripe/Shopify Capital; D&B/Nav/Creditsafe) | Alive, profitable | Output is a loan or a bureau score, not a signed portable trust state usable at checkout |
| Portable/blockchain reputation (Hesse & Teubner; Kleros; TU Delft) | Research + niche pilots | No financial backing, cold start, platforms won't export; no claim payout |
| Network merchant trust (Mastercard Merchant Trust Services 2026; Visa VAMP) | Ramps 2026 | Acquirer/issuer-facing risk flags, private data, no per-transaction protection price, no agent API |
| Agent trust protocols (Visa TAP, AP2, UCP, ACP) | Live 2025–26 | Sign the agent/mandate; no merchant-delivery trust, no recourse, no instant payout |
| Parametric insurance / trade credit | Alive, mature | Not per-order, not merchant-funded buyer protection, not agent-readable |

## The narrow white space (what actually survives)

**A portable, signed merchant trust state that is (i) derived from settled payment outcomes, (ii) priced into the
buyer-protection fee of the *next* transaction — including on sites the merchant does not own — and (iii) collateralised
so a buyer-initiated claim can be paid instantly from a merchant reserve, with the claim feeding back into that state.**
Prior art holds at most two of the three: Signifyd/Riskified (outcomes → per-order price, merchant-facing, no
portability, no buyer payout), TrustedSite/BuySafe/Google Trusted Stores (badge + sometimes guarantee, no outcome
pricing, dead or niche), Mastercard/Visa (network outcomes → private risk decisions, no buyer-facing credential),
AP2/UCP/TAP (signed mandates and receipts, no delivery trust), parametric insurers (reserve + instant payout, no
commerce granularity). One-line claim: **"reputation that settles with the payment and can be carried to the next
payment."**

**Biggest "this already exists" objection — and rebuttal.** *"Signifyd already prices risk per order and pays
guaranteed claims; add a badge and an API and you have this."* The rebuttal has to be precise: Signifyd's guarantee is
**merchant indemnity against fraud chargebacks** — the money flows to the seller's chargeback ledger, the buyer gets
nothing directly, the scoring is single-tenant, and the record is not exportable; "Instant Refunds" are merchant-
granted refunds that Signifyd underwrites, not buyer-initiated adjudication against a merchant-funded reserve. Settled's
claim is only real if (1) claims are buyer-initiated and paid in seconds from the merchant's own reserve, (2) the
resulting state is signed and *accepted by parties other than the issuing platform*, and (3) the fee actually moves with
that state across sites. Absent (2), it is a Signifyd clone with a consumer UI.

**Honest risks to state in the pitch:** consumer-reporting law and insurance licensing for reserves/claims; adverse
selection (bad merchants buy protection, good merchants don't need it); outcome-data provenance (who validates
delivery?); platform refusal to accept a third-party credential; and the incumbent move — Mastercard/Visa/PayPal can
extend their private trust scores to buyers without ever publishing a ledger. **[judgment]** Nov 2026 is late enough
that the network version of this (Mastercard MTS) is already shipping; the only durable wedge is neutrality +
portability + instant payout, all three at once.
