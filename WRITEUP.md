# Settled — novelty, money, niche, USP, pitch, and what the demo really is

*Write-up for judges / investors / PayPal BD · 2026-11-04 · grounded in the working demo in this folder, the prior-art and PayPal-history research, and the Strategyzer audits in `research/`.*

---

## 1. The idea in one page

**Settled is the assurance layer for commerce and AI agents.** It turns every order into a signed, insured deal:

1. **Merchant Trust Credential** — a signed, portable record built from real payment outcomes (delivery, disputes, refunds, chargebacks), not reviews or paid badges.
2. **Risk-priced protection** — per-order pricing: tier A 35 bps / B 90 / C 150, a hard cap, and a settlement mode (instant capture / capture+reserve / escrow / decline).
3. **Instant recourse** — a buyer- or agent-initiated claim paid from the merchant's reserve in ~1.2 seconds through the PayPal refund rail.
4. **Agent Passport + Commerce Contract** — operator KYB, a signed mandate, spend limits, agent reputation, and a signed contract that fixes the price and terms before approval.

**Settlement stays on PayPal**: Orders v2, Payments v2 refunds, Invoicing, webhooks, Agent Ready/AP2/ACP/UCP for agent authorization. **No custody** — the reserve lives at the merchant's PSP, an LC, or an insurer.

**One line:** *Reputation settles with the payment.*

---

## 2. How novel is it? (honest answer)

**Score: 6/10 — combinatorial, not conceptual.** The ingredients exist; the closed loop does not.

| Component | Already exists | Closest example |
|---|---|---|
| Merchant trust score | Yes, platform-owned | Amazon seller performance, eBay feedback |
| Consumer trust badge/guarantee | Yes, paid certification | TrustedSite, BuySafe/Norton |
| Risk-priced merchant guarantee | Yes, merchant-facing | **Signifyd / Riskified** (chargeback indemnity, "Instant Refunds") |
| Network-level merchant risk | Yes, issuer-facing | **Mastercard Merchant Trust Services** (Sept 2026) |
| Buyer protection | Yes, post-hoc | PayPal Buyer Protection, card chargebacks |
| Agent identity/authorization | Yes | Mastercard Agent Pay, Visa Trusted Agent, AP2 mandates |

**What has never shipped:** a **portable, signed, buyer-facing merchant credential with money behind it** — a reserve that pays a *buyer-initiated* claim in seconds and feeds the outcome back into the merchant's protection price at checkouts the issuer doesn't own.

**The three-leg test** (all must hold, or it becomes "Signifyd with a consumer UI"):
1. **Buyer-initiated claims paid in seconds from the merchant's own reserve** — not merchant-granted refunds underwritten by a third party.
2. **The signed credential is accepted by parties other than the issuer** — travel across stores, PSPs and agents.
3. **The fee moves with the credential** across sites, so a merchant's price of protection changes with its behaviour.

**What is genuinely new:** the **loop** — outcome → credential → risk price → reserve → instant payout → updated outcome. Prior art holds at most two of the three legs. The portable-reputation graveyard (TrustCloud, Traity, Credo360, etc.) shows the failure mode: no settlement, no payer, no distribution at the decision moment. Settled embeds in the payment flow and charges the merchant, not the consumer.

**What is not new (say it before a judge does):** trust scores, guarantees, badges, buyer protection, instant refunds as a concept. The novelty is the **assembly and the settlement seat**, not the vocabulary. The moat is data + reserve + network + the credential standard, not the UI.

---

## 3. The niche

**Primary (paying): enterprise merchants in high-AOV, trust-deficit commerce** — high-ticket DTC, luxury resale, furniture/appliances, marketplace sellers, established brands entering agentic channels. Buyer: **VP Payments / CFO / Head of Risk**; co-sponsor: CMO/CRO for the conversion story.
**Secondary (distribution): platforms and PSPs enabling agentic checkout** — one integration reaches thousands of merchants; they monetise the resulting GMV and don't want to become the insurer.
**Tertiary: agent operators** — procurement and shopping agents that get blocked by unknown merchants and cannot navigate human disputes.

**Beachhead:** one platform/PSP + 3–5 high-AOV merchants, protected cohort vs holdout. **Explicitly out of scope:** Amazon/eBay overlays (platform rules), ultra-low-ticket (fee < risk), regulated goods, digital goods with no delivery evidence.

**Why this niche now:**
- 51% of shoppers abandon because they doubt business legitimacy — the #1 reason, ahead of card security (TrustedSite 2026); 96% are concerned about unfamiliar stores; 94% fear AI-generated fake businesses; 91% fear AI fake reviews.
- PayPal's FY2025 10-K: **$1.34B protection provision / $1.49B realized losses** — a bundled cost centre with no risk-based price and no portable trust signal.
- Agent checkout is arriving on PayPal's rails (Agent Ready, Store Sync, WebMCP). Agents can **pay**, but cannot **trust**, and buyers have no **instant recourse**.

---

## 4. The USP

| Capability | Trust badge | Signifyd / Riskified | PayPal Buyer Protection | Mastercard MTS | **Settled** |
|---|---|---|---|---|---|
| Outcome-derived (not paid certification) | ✗ | ✓ merchant-side | ✓ post-hoc | ✓ private | **✓ signed outcomes** |
| Portable across stores/PSPs/agents | ✗ | ✗ | ✗ | ✗ | **✓** |
| Risk-priced per order | ✗ | ✓ merchant | ✗ free | ✗ | **✓** |
| Buyer-initiated instant payout | ✗ | ✗ | dispute | ✗ | **✓ reserve** |
| Agent passport + trust API | ✗ | ✗ | ✗ | ✗ | **✓** |
| No custody / no insurance licence by default | — | — | — | — | **✓** |
| Merchant pays only on protected GMV | ✗ | ✓ | free | ✗ | **✓** |

**The five-word USP:** *portable trust, priced, paid instantly.*

**The comparison that matters:** free buyer protection fixes the buyer's **post-purchase** pain; it does nothing for the merchant's **pre-purchase conversion**. Settled competes on **conversion + bounded loss**, not on the same axis as free protection.

---

## 5. How it makes money for PayPal

**The pool:** PayPal branded checkout is **30% of TPV / >65% of transaction gross profit** (~$538B of the most profitable volume). Protection is a **$1.34B provision** with no risk-based price.

**At-scale scenarios** (assumptions, not forecasts — protected share of branded-checkout TPV × blended protection fee):

| Scenario | Protected share | Blended fee | Protection revenue | + platform license | + agent API | **Total** |
|---|---|---|---|---|---|---|
| Conservative | 8% ($43B) | 25 bps | $108M | $25M | $5M | **$138M** |
| Base | 20% ($108B) | 35 bps | $377M | $50M | $20M | **$447M** |
| Bull | 40% ($215B) | 45 bps | $968M | $100M | $60M | **$1.13B** |

**Not counted above (upside):**
- **Loss reduction:** a 10–20% cut in the $1.49B realized-loss line = **$149–298M**.
- **Conversion lift:** if protected GMV converts +5%, base-case incremental TPV (~$5.4B) at 1.85% = **~$100M** processing revenue.
- **Take-rate defence:** as checkout moves into agents, PayPal risks becoming an interchangeable rail. A trust/recourse layer protects the **branded-checkout take rate**, not just adds a SKU.
- **Data/Ads synergy:** outcome + agent intent data improves PayPal Ads and merchant insights; the credential becomes a network asset.

**How the fee is collected:** `payment_instruction.platform_fees` where Settled is the approved partner and owns the PayPal call; otherwise invoiced/ledgered. No custody means no float dependency; the reserve is merchant-funded (PSP reserve / LC / insurer).

**Why PayPal wins specifically:** it already has the payment, the dispute data, the merchant distribution and the agentic rails. It buys/sells risk primitives (Fraud Sciences $169M, Simility $120M, Chargehound, Cymbio); a portable trust layer is the missing one — partner or acquire.

**Honest boundary:** the headline numbers are **at-scale TAM math on stated assumptions**, not a forecast. The first proof is a 90-day pilot: conversion lift ≥5% relative, claim cost <50% of chargeback cost, 3/12 LOIs at ≥25 bps.

---

## 6. The hook pitch

**15 seconds:**
> *"PayPal can already let AI agents pay. It can't let them trust. Settled is the assurance layer: a signed trust credential, protection priced per order, and a refund from the merchant's reserve in seconds."*

**30 seconds:**
> *"Half of shoppers abandon because they're not sure a store is real. PayPal spends $1.3B a year on protection with no risk-based price. And agents are arriving with no way to trust or be trusted. Settled turns every order into a signed, insured deal — credential, price, instant remedy — riding the PayPal SDK."*

**4-minute structure:** Maya (Head of Risk) → 51% abandonment + $1.3B cost centre + agent trust gap → live 5-step demo → 35 bps / $5k cap / $0.83 fee / $237 refund in 1.2s → business model + moat → close.

**Closing line:** *"Sell to strangers and agents — protected, priced, paid back in seconds."*
**Category line:** *"Reputation settles with the payment."*

---

## 7. Is the demo real?

**Yes — with an honest boundary.**

**Real (runs on `node server.js`, 57/57 e2e tests):**
- HMAC-signed merchant credential + SHA-256 event hash chain.
- Risk engine: score, tier, fee bps, cap, payment mode; 35/90/150 bps; $5k/$2.5k/$1k caps; instant/reserve/escrow/decline.
- Agent passport: seeded agents, operator KYB, signed mandate, spend limits, reputation; RogueBot rejected **before** an order exists.
- Negotiable contract: offer/counter/accept, deterministic seller policy, signed hash, terms.
- Protection quote; order at the agreed price; reserve accounting; buyer/agent claim; instant refund from reserve; claims list.
- PayPal adapter: OAuth2 + Orders v2 create/capture + approval URL; `/api/paypal/capture`; falls back to SIM.
- Demo console: `/demo.html` runs the 5 steps end-to-end, scorecard 5/5 green, live JSON log; 57/57 tests.

**Simulated by default (say it):**
- Payment ids (`SIM-…`), delivery confirmation, KYB, the $25k network pool, and the claim's PayPal refund id.
- **Live PayPal sandbox** works by env var (`PAYPAL_LIVE=1` + client id/secret); the adapter creates real orders and returns an approval URL, but the **live approval/return flow is not exercised** in the current build — dry-run it before using it on stage.
- The $25k pool is **demo capital**, not a balance sheet. Production = insurer/LC partner, per-merchant aggregate caps, backtested loss curve.

**So the answer to "is it real?"** — the **business logic and APIs are real and tested**; the **money movement is simulated by default**, and the insurance/underwriting is a partner workstream, not a claim. That distinction is in the judge brief and the Q&A.

---

## 8. What the books say to fix (and how the pitch changed)

The Strategyzer audits (`research/vpd-applied.md`, `research/bmg-applied.md`) flagged:
- **Buying centre inverted** — growth story sold to a risk buyer → the pitch now sells **net revenue with bounded loss**, with CMO/CRO as co-sponsor.
- **Cold-start credential** — new merchants have no history → **escrow + bond + third-party attestation** trust ramp.
- **Protection must beat "free"** — don't sell buyer protection; sell **merchant loss cap + conversion + instant ops**.
- **Contract has no ticked job** — reposition as **evidence for disputes/agent liability**, not the headline.
- **Who pays is unproven / guarantee has no balance sheet** — **holdout-gated bps**, platform-funded pilot, insurer/LC, caps.
- **Model is bundled** — **unbundle**: credential/decision/claims only; platform/PSP owns the relationship.

---

## 9. The one-paragraph version

Settled is a PayPal-native assurance layer that turns trust into a signed, portable credential, prices protection per order against a hard cap, and pays a buyer/agent-initiated claim from the merchant's reserve in seconds. It is novel as an **assembly** rather than an ingredient (6/10), it sits in a real niche (high-AOV, trust-deficit merchants and the platforms enabling agentic checkout), and it makes money for PayPal by converting a $1.3B bundled protection cost centre into a risk-priced SKU on top of branded-checkout TPV — $138M / $447M / $1.13B at conservative/base/bull at-scale assumptions, plus loss reduction and take-rate defence. The demo is a real, tested prototype with simulated money by default and a live PayPal sandbox path one env var away. **Reputation settles with the payment.**
