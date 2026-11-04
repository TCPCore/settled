# VPD applied to Settled — customer profile, value map, fit, and what to test

**Input:** *Value Proposition Design* (Osterwalder, Pigneur, Smith, Bernarda, Papadakos, 2014) — user-supplied PDF; page cites are the book's printed pages. **Settled** as built in `settled/` (HMAC-signed ledger, tiers A–D, 35/90/150 bps protection, reserve-funded instant claim, agent passport, contract hash, `POST /api/trust/verify`). Quotes ≤25 words; paraphrases are mine. **Legend: [S] = VPD page · [A] = our assumption / unverified claim.**

---

## 1. The 10-step VPD skillset, as a checklist

The book's process is "design, test, repeat" — iterative, not linear [S p.62]. These 10 steps are the minimum loop; each has a concrete tool and artifact.

| # | Step | Book tool / question | How to do it in one line | Page |
|---|---|---|---|---|
| 1 | **Choose one segment** | Customer (Segment) Profile | Pick a segment narrow enough that one VP can win it; "everyone who sells online" is not a segment | p.10, p.88 |
| 2 | **Sketch the profile** | Customer Profile exercise (5 steps) | Sticky-note every job, then pains, then gains — before any product thinking | p.22 |
| 3 | **Jobs** | Customer Jobs: functional / social / emotional + supporting (buyer, co-creator, transferrer) | Write them in the customer's words, with context and importance | p.12–13 |
| 4 | **Pains** | Undesired outcomes / obstacles / risks; rate severity extreme→moderate | Make each concrete ("wasting more than X") and order most-extreme first | p.14–15 |
| 5 | **Gains** | Required / expected / desired / unexpected; rate relevance essential→nice-to-have | Order most-essential first; "required" gains are the non-negotiable floor | p.16–17 |
| 6 | **Value map** | Products & Services → Pain Relievers → Gain Creators | List the offer, then one reliever/creator per ranked item; keep few and extreme | p.26, p.29, p.31, p.33 |
| 7 | **Fit check on paper** | Tick every reliever/creator against a job, pain, or gain | Un-ticked items "may not be creating customer value" — cut or re-tie them | p.46–47 |
| 8 | **Prototype alternatives** | Prototyping Possibilities; Starting Points | Sketch 3–5 whole VPs (not features) from different starting points, then choose | p.74, p.86 |
| 9 | **Test circle → square → rectangle** | What to Test; Test Card | Prove jobs/pains/gains matter *before* testing the offer; then the offer; then the model | p.188–204 |
| 10 | **Evolve** | Create Alignment; Measure & Monitor; Improve Relentlessly; Reinvent | Keep the canvas alive: instrument, learn, re-cut the profile when evidence changes | p.260–266 |

**The discipline that matters most here:** the book insists we test the *circle* (what customers care about) before the *square* (our offer), because otherwise "you never know if customers are rejecting your value proposition or if you are simply addressing irrelevant jobs" [S p.190, condensed].

---

## 2. Customer profile — primary segment

**Segment definition [A]:** enterprise merchants in high-AOV, trust-deficit commerce (high-ticket DTC, luxury resale, marketplaces, established brands moving into agentic channels); $50M+ GMV, 500+ orders/day, chargeback-visible.

**B2B buying centre — the book's warning is the whole problem** [S p.50–51]: a B2B purchase has influencers, recommenders, economic buyers, decision makers, end users and saboteurs, each with its own profile, and the book says sketch a canvas for each. Settled currently has **one blended profile**.

| Role | Who | What they actually buy |
|---|---|---|
| Economic buyer | CFO / VP Finance | Predictable loss reserve, cost per order, no new liability tail |
| Decision maker | VP Payments | Fewer failed/contested orders, uptime, PSP cost, a defensible agentic plan |
| Recommender | Head of Risk / Fraud Ops | Lower dispute rate, less manual adjudication, fraud controls |
| End users | Checkout product, support agents, buyer | A working checkout; a fast remedy |
| Saboteurs | IT security, legal/compliance, incumbent PSP account team | No new data flows, no new liability, no vendor sprawl |

### Jobs (ranked by importance) [A]

| # | Type | Job | Why it ranks here |
|---|---|---|---|
| J1 | Functional | Convert first-time / unfamiliar buyers at high AOV without discounting | Largest measurable revenue leak in trust-deficit commerce |
| J2 | Functional | Accept agent-originated orders without creating a new fraud & chargeback channel | The job that is arriving whether or not they are ready |
| J3 | Functional | Resolve a failed order faster than card-network dispute timelines | Ops cost + buyer churn + reserve drag |
| J4 | Financial/functional | Make loss a *predictable* monthly reserve line, not a lumpy tail | CFO's language; budget-line translation |
| J5 | Functional (supporting, buyer of value) | Procure and prove ROI for a new payments-layer vendor in one quarter | Procurement is the real gate |
| J6 | Social | Be the payments leader who made agentic commerce safe — visible, promoted internally | Career upside; sponsors budget |
| J7 | Social | Not be the team blamed for the first agent-fraud incident | Loss aversion is stronger than upside |
| J8 | Emotional | Sleep at night: no open-ended liability from bot traffic | Book's own example: "feel secure" [S p.12] |
| J9 | Functional (supporting, transferrer) | Exit or swap the vendor without ripping out checkout flows | Integration lock-in is a real adoption barrier |

### Pains (ranked by severity, extreme → moderate) [A]

| # | Severity | Pain | Type |
|---|---|---|---|
| P1 | Extreme | Unknown worst-case liability if agents transact: no cap, no precedent, no insurer | Risk |
| P2 | Extreme | Trust deficit suppresses conversion on new buyers at exactly the highest AOV | Undesired outcome |
| P3 | Severe | Protection is bundled and opaque — can't price it, can't prove ROI, can't buy more of it | Undesired outcome |
| P4 | Severe | Disputes are slow, adversarial and manual; ops drown and the buyer churns anyway | Obstacle |
| P5 | Severe | Badges and platform scores don't travel; every channel re-vets the merchant | Undesired outcome |
| P6 | Moderate | No clean way to hold an agent *operator* accountable — recourse is a support ticket | Obstacle |
| P7 | Moderate | Another integration, another contract, another security review | Obstacle |
| P8 | Moderate | Legal ambiguity: who is liable when an agent buys — merchant, operator, or platform? | Risk |

### Gains (ranked by relevance, essential → nice-to-have) [A]

| # | Relevance | Gain | Type |
|---|---|---|---|
| G1 | Essential | Loss capped per order and predictable per month | Required |
| G2 | Essential | Measured conversion lift on unfamiliar buyers | Required |
| G3 | Essential | Evidence before scale: a holdout that survives CFO scrutiny | Required |
| G4 | Expected | Instant remedy that beats chargeback timelines | Expected |
| G5 | Expected | One integration into the checkout they already run (PayPal/Braintree) | Expected |
| G6 | Desired | A portable credential that works across channels and PSPs | Desired |
| G7 | Desired | Risk-based pricing that gets cheaper as behavior improves | Desired |
| G8 | Unexpected | Optionality/defensibility: first-party data on agent-commerce risk nobody else has | Unexpected |

---

## 3. Value map — and what actually fits

Fit is ticked against the ranked items above. **Tick = relieves a ranked pain or creates a ranked gain.** No-tick is a finding, not a gap to paper over [S p.46–47].

| Settled offer | Type [S p.29/31/33] | Ticks | Fit |
|---|---|---|---|
| **Risk-priced protection** (tier A/B/C/D → 35/90/150 bps, per-order cap, capture or escrow) | Pain reliever | P1, P3, G1, G7 | **FIT — strongest element.** Prices the un-priced risk and caps it per order |
| **Merchant reserve + instant claim** (~1.2s refund via PayPal, reserve then network pool) | Pain reliever | P4, G4 (buyer side); P1 partially (merchant side) | **PARTIAL** — relieves the *buyer's* remedy pain; for the merchant a reserve is still a liability, just a scheduled one |
| **Signed merchant trust credential** (HMAC ledger; score 91, tier A, 94% coverage, $5,000 cap) | Product + gain creator | P2 (partially), P5, G2, G6 | **PARTIAL — see mismatch M2.** Attests *past outcomes*, so it is empty for exactly the merchant with the trust deficit |
| **Agent Passport** (operator KYB, signed mandate, spend limits, reputation) | Product + relief for agent operator | P6, J2, P8 | **FIT for segments 2–3, not for the merchant.** The merchant gets one control, not the passport |
| **Agent Commerce Contract** (signed hash, transcript, negotiated price) | Product | **nothing in the ranked profile** | **NO-FIT as a value prop.** It serves an audit/compliance job that isn't in the buying centre — re-position as an evidence artifact, not a benefit |
| **Trust API** (`POST /api/trust/verify`, `min_tier`) | Product for platform/PSP | Segment 2's intermediary job | **FIT for segment 2 only** — the book's "multiple fits" / intermediary case [S p.52] |
| **Recompute on claim** (downgrade score/tier after a claim) | Gain creator | G7, P5 | **FIT but weak** — a hygiene feature, never the reason to buy |

---

## 4. Honest fit diagnosis

**Addressed, defensibly:** P1 (unknown liability) and P3 (opaque, unpriceable protection) — the tiered bps engine is a real pain reliever, and the reserve makes loss a scheduled line. P4's *buyer-facing* half is solved by the instant claim. The book's bar is "alleviate extreme pains … extremely well" [S p.31], and Settled meets it on P1/P3.

**Claimed but not delivered (as built):**
- *"Portable credential lifts conversion."* No A/B evidence exists; portability is untested beyond two seeded merchants verifying each other; a third party only trusts the credential if it already trusts the issuer.
- *"Instant recourse."* True for reserve-funded claims, but adjudication is rule-based in the demo; "item not as described" still needs evidence and a human. A reserve shortfall draws on a fixed $25,000 network pool — that does not scale.
- *"Protection."* It is not a risk transfer — it is the merchant's own pre-funded reserve. No insurer, no capital requirement, no underwriting.
- *"Agent passport."* Demo rejection of RogueBot proves the gate works; there is no real KYB and the mandate is a JSON field.

**The 3 biggest mismatches:**

1. **The buying centre is inverted (the growth story is sold to the risk buyer).** The headline sells a *revenue* job (J1) to a CFO/VP Payments who is measured on loss rate and cost per order (J4, P1), while the artifacts — bps, cap, reserve, score — sell a *risk* product. The buyer who pays for conversion is a CMO who is absent from the canvas. VPD explicitly says to build a profile per stakeholder; Settled has one blended profile and no saboteur canvas [S p.50–51]. **Consequence: wins the demo room, stalls in the budget meeting.**
2. **The credential is empty precisely where the trust deficit is worst.** The signed ledger attests observed outcomes; the new/unfamiliar merchant has none, so it drops to tier C → escrow → the friction the product promised to remove. That is structural, not a copy problem: an outcome-history credential cannot relieve an unfamiliarity pain. It needs third-party backing (PSP underwriting/insurance) rather than self-reported history.
3. **Protection has to beat "free."** Card chargeback rights and PayPal buyer protection already give the buyer a remedy; Settled asks 35–150 bps for a *faster* remedy. Speed is a **desired** gain (G4), not a **required** one (G1) [S p.16]. At 35 bps on a $237 order the fee is $0.83 — adoptable, but too small to be a revenue story; at 150 bps the merchants who need it most are the ones who can't afford it.

**Also flagged:** (a) the pain is partly *anticipatory* — agent order volume is not material for most merchants today, so the 2026 budget line may not exist; (b) the contract/transcript has no ticked job (above). The book is blunt that the customer, not us, decides: "Your customers are the judge, jury, and executioner of your value proposition" [S p.43].

---

## 5. Three value propositions

**V1 — Enterprise merchant (primary):**
> *For high-AOV merchants whose checkout dies on "is this store real?" and who are about to accept AI-agent orders, Settled signs the merchant's outcome record into a portable trust credential, prices protection per order from 35 bps against a hard cap, and pays a claim from the merchant reserve in about a second — so you convert unfamiliar buyers and agent traffic without opening a new loss line.*

**V2 — Platform / PSP:**
> *For platforms and PSPs enabling agentic checkout, Settled is a trust API: it verifies the merchant, prices and binds the protection, and settles the claim — so agent-originated GMV can clear your rails without you becoming the insurer.*

**V3 — Agent operator:**
> *For agent operators who get blocked at checkout, Settled is a passport — operator KYB, a signed spend mandate, verifiable merchant trust, and a remedy that resolves without a human — so your agent can transact with merchants who have never heard of you.*

**Strongest: V1.** It names one segment, one extreme pain it can actually relieve (P2 trust-suppressed conversion — and note that *free* buyer protection relieves the buyer's post-purchase pain but does nothing for pre-purchase conversion, which is why V1 does not have to beat "free" on the same axis), and three relievers each ticked to a ranked item. V2 is likely the better *business model* — the book's intermediary/multiple-fits case [S p.52] — but as a value proposition it needs two fits sold at once and a partner's roadmap, which is a slower first sale.

---

## 6. What to test first (Test Card logic)

Circle first, then square, then rectangle — and "test early; refine later" [S p.190–194, p.208]. Each card: hypothesis → test → metric → criterion.

| # | Hypothesis | Test | Metric | Pass criterion | Cost / time | Data reliability | Critical? |
|---|---|---|---|---|---|---|---|
| **A1** (circle) | Merchants rank *conversion of unfamiliar buyers* above *chargeback cost* as their reason to buy | 12 structured interviews (VP Payments, CFO, Head of Risk) with forced ranking + "which budget line?" | % ranking conversion #1 *and* naming a budget line | ≥7/12 | $0, 2 wks | Medium (stated preference) | **Yes** |
| **A2** (circle) | Agent orders are a *funded 2026* pain, not a 2027 option | 15 interviews; ask last-90-day agent traffic % and Q1 budget owner | # with agent traffic >2% of orders or a named 2026 owner | ≥5 merchants | $0, 2 wks | High (behavioral + budget) | **Yes** — if false the wedge is V1 only |
| **A3** (square) | Credential + protection lifts first-time-buyer conversion ≥5% relative | Holdout A/B, one merchant, ≥20k sessions, credential+protection vs control | Relative CVR on new-buyer segment | ≥5% rel, p<0.1, claims not up | $0–1k, 3–4 wks | High (behavior) | **Yes** |
| **A4** (square) | Merchants pay ≥25 bps for protection on top of processing | 12 LOIs at 15/25/50 bps; fake-door pricing page in dashboard | Signed LOIs at ≥25 bps | ≥3/12 | Legal + 2 wks | High (signature) | **Yes** |
| **A5** (rectangle) | Reserve-backed instant claims are cheaper/faster than chargebacks and are insurable + compliant without a licence | Concierge pilot, 20 claims; insurer term-sheet asks; counsel memo | Time-to-refund; cost/claim vs chargeback cost; term sheet | <1 day; <50% of chargeback cost; 1 term sheet | $5–15k, 4–6 wks | High | Yes, but sequence last |

**Read the order as the book does:** if A1 or A2 fails, the circle is wrong and A3–A5 are wasted spend. If A3 fails, the credential is a badge — pivot to V2 (platform API) rather than re-writing copy. If A4 fails, the model is wrong even if the product works [S p.48–49, the three kinds of fit].

---

## 7. Page references and short quotes

- **Customer Profile / Jobs / Pains / Gains** — p.9–17; profile exercise p.22. *"Customers are the judge, jury, and executioner of your value proposition."* (p.43)
- **Value Map, Products & Services, Pain Relievers, Gain Creators** — p.26, p.29, p.31, p.33. *"Great value propositions often focus only on few pains that they alleviate extremely well."* (p.31)
- **Fit and the fit check** — p.42, p.46–47. *"If a pain reliever or gain creator doesn't fit anything, it may not be creating customer value."* (p.47)
- **Three kinds of fit** (problem-solution / product-market / business-model) — p.48–49. *"Fit is hard to find and maintain. Striving for fit is the essence of value proposition design."* (p.42)
- **B2B multiple stakeholders; multiple fits / intermediary** — p.50–52. *"Each one has a different profile with different jobs, pains, and gains."* (p.50)
- **Design loop** (prototype, starting points, understand, choose) — p.74, p.86, p.104, p.120. *"design, test, repeat"* (p.62)
- **Testing: circle → square → rectangle; Test Card; 10 principles** — p.188–194, p.204, p.208. *"Provide evidence showing what customers care about … before focusing on how to help them."* (p.190)
- **Evolve: alignment, measure, improve, reinvent** — p.260–266.
