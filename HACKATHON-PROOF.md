# Hackathon-proof: the Strategyzer playbook applied to Settled

*Built from the user-supplied copies of **Business Model Generation** (BMG) and **Value Proposition Design** (VPD). Page citations are the books' printed pages; quotes are ≤25 words, everything else is synthesis. Companion analyses: [research/vpd-applied.md](research/vpd-applied.md) · [research/bmg-applied.md](research/bmg-applied.md).*

---

## 1. The two books as skillsets (the checklist)

### Business Model Generation — "describe, challenge, redesign" (BMG)

| # | Skill | What to actually do | BMG |
|---|---|---|---|
| 1 | **Map one model on one page** | Fill the 9 blocks for *one* model: customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, cost structure | p.44 |
| 2 | **Read the dependencies** | Right side = market; left side = what it takes; value proposition sits between. Move a segment and channels/costs move too | p.44 |
| 3 | **Treat the canvas as a claim** | Date/version it; every block is a hypothesis until evidence arrives | p.44 |
| 4 | **Stress-test the economics** | Revenue block: *for what value are they really willing to pay?* Cost block: *what does the guarantee cost at volume?* | p.30, p.40 |
| 5 | **Use patterns** | Unbundling (relationship / innovation / infrastructure); multi-sided platform (subsidise one side); FREE (cross-subsidy/freemium/bait-hook); open (outside-in/inside-out); long tail | pp.56–120 |
| 6 | **Design with the customer** | Customer insights/empathy map; ideation via "what if" and epicenters; visual thinking; prototyping at increasing fidelity; one-protagonist storytelling; scenarios | pp.126–190 |
| 7 | **Re-interpret strategy** | Environment forces (market/industry/trends/macro); evaluate the model; Blue Ocean four actions; manage multiple models (ambidextrous) | pp.200–240 |
| 8 | **Run the process** | Mobilize → Understand → Design → Implement → Manage, non-linearly; keep the design attitude (multiple prototypes before choosing) | pp.244–249, p.164 |

### Value Proposition Design — "fit before you build" (VPD)

| # | Skill | What to actually do | VPD |
|---|---|---|---|
| 1 | **Choose one segment** | Narrow enough that one value proposition can win it | p.10 |
| 2 | **Sketch the profile** | Sticky-note jobs, then pains, then gains — before thinking about the product | p.22 |
| 3 | **Jobs** | Functional / social / emotional + supporting (buyer, co-creator, transferrer); write in the customer's words | pp.12–13 |
| 4 | **Pains** | Undesired outcomes / obstacles / risks; rate severity extreme→moderate; make them concrete | pp.14–15 |
| 5 | **Gains** | Required / expected / desired / unexpected; rate relevance essential→nice-to-have | pp.16–17 |
| 6 | **Value map** | Products & services → pain relievers → gain creators; few and extreme, not exhaustive | pp.26–33 |
| 7 | **Fit check** | Tick each reliever/creator against a ranked job/pain/gain; un-ticked = not creating value | pp.46–47 |
| 8 | **Prototype alternatives** | Sketch 3–5 whole value propositions from different starting points; don't marry the first | pp.74–86 |
| 9 | **Test circle → square → rectangle** | Prove the jobs/pains/gains matter, then the offer, then the model; Test Card → Learning Card | pp.188–204 |
| 10 | **Evolve** | Align stakeholders, measure, improve, reinvent; keep the canvas alive | pp.260–266 |

**The one discipline that matters most:** test the *circle* (what customers care about) before the *square* (your offer) — otherwise you can't tell rejection of the offer from irrelevance of the job (VPD p.190).

---

## 2. What the books say is wrong with Settled (and the fixes)

This is the honest audit, not the pitch.

| # | Finding (book lens) | Why it matters | Fix |
|---|---|---|---|
| 1 | **The buying centre is inverted** (VPD pp.50–51) | The headline sells *conversion* to a CFO/VP Payments measured on loss and cost-per-order; the CMO who funds conversion is absent. One blended profile where the book demands one per stakeholder, including saboteurs (IT security, legal, incumbent PSP) | Split the canvas: economic buyer = CFO/VP Payments; value story = **net revenue uplift with bounded loss**; add CMO/CRO as co-sponsor; pre-answer security/legal |
| 2 | **The credential is empty where the trust deficit is worst** (VPD p.10; value map) | An outcome-history credential can't relieve *unfamiliarity*; a genuinely new merchant has no history → tier C → escrow, the friction we promised to remove | New merchant = **trust ramp**: escrow + refundable bond + third-party attestation (PayPal KYB, PSP history, insurer), not self-reported history. Established merchants moving channels get the portable credential |
| 3 | **Protection must beat "free"** (VPD p.16) | Card chargeback rights and PayPal buyer protection already give the buyer a remedy; speed is a *desired* gain, not a *required* one | Don't sell "buyer protection." Sell **merchant loss cap + conversion + instant ops**; price only on protected GMV; the buyer's faster remedy is a by-product |
| 4 | **The negotiated contract has no ticked job** (VPD p.47) | It's an audit/compliance artifact, not a customer benefit | Re-position as **evidence for dispute and agent liability**; keep it in the demo as the mechanism, not the headline |
| 5 | **Agentic pain is partly anticipatory** (VPD p.14 risk) | Most merchants' agent volume is not material yet; the 2026 budget line may not exist | Lead with **today's pain** (trust-suppressed conversion, claims ops, loss volatility); agent commerce is the *expansion* and the platform/PSP wedge |
| 6 | **Who pays is unproven** (BMG p.30) | Buyer free, merchant bps is a hypothesis; merchants may think they already bought protection | **Holdout-gated pricing**: bps charged only on protected GMV, with a pre-registered conversion/loss test; platform subsidises the first 90 days because it monetises the GMV |
| 7 | **The guarantee has no balance sheet** (BMG p.40, p.212) | Instant claims from a $25k demo pool is a promise the model can't keep at volume | **Insurer/LC partner**, per-merchant aggregate caps (reserve × factor), pooled long tail, backtested loss curve before "instant" is promised |
| 8 | **The model is bundled against unbundling** (BMG p.56) | Storefront + dashboard + ledger + underwriting in one company competes on the relationship layer PSPs own | **Unbundle**: ship credential/decision/claims only; make the PSP/platform own the customer relationship; the storefront is demo furniture |

---

## 3. The value proposition (refined, per segment)

**Master (one line):**
> **Settled turns every order into a signed, insured deal — a portable trust credential, protection priced per order against a hard cap, and a claim paid from the merchant's reserve in seconds. Sell to strangers and agents without opening a new loss line.**

**V1 — Enterprise merchant (lead):**
> *For high-AOV merchants whose checkout dies on "is this store real?" and who are about to accept AI-agent orders, Settled signs the merchant's outcome record into a portable trust credential, prices protection per order from 35 bps against a hard cap, and pays a claim from the merchant reserve in about a second — so you convert unfamiliar buyers and agent traffic without opening a new loss line.*

**V2 — Platform / PSP:**
> *For platforms and PSPs enabling agentic checkout, Settled is a trust API: verify the merchant, price and bind the protection, settle the claim — so agent-originated GMV can clear your rails without you becoming the insurer.*

**V3 — Agent operator:**
> *For agent operators who get blocked at checkout, Settled is a passport — operator KYB, a signed spend mandate, verifiable merchant trust, and a remedy that resolves without a human — so your agent can transact with merchants who have never heard of you.*

**Why V1 is the lead:** free buyer protection fixes the *buyer's post-purchase* pain; it does nothing for *pre-purchase conversion*, which is the merchant's extreme pain. Settled competes on conversion + bounded loss, not on the same axis as free protection (VPD p.16, p.31).

---

## 4. The 4-minute pitch (one protagonist)

**Protagonist: Maya, Head of Risk at a $200M high-AOV DTC brand.** One person, one arc (BMG p.173: keep it simple, one protagonist).

| Time | Say / do |
|---|---|
| **0:00** | *"PayPal can already let AI agents pay. It can't let them trust. This is the layer that fixes that — and it makes money on the risk PayPal already eats."* |
| **0:20** | *"Meet Maya. She runs risk at a $200M brand. 51% of shoppers abandon because they're not sure a store is real. Her chargebacks take 30 days. And agent orders are arriving with no answer to: who pays if it fails?"* |
| **0:45** | *"Maya doesn't need another badge. She needs three things: proof the merchant is real, protection priced to the order, and a remedy that settles in seconds — not a chargeback."* |
| **1:00** | **Demo step 1** — trust credential: tier A, score 91, 94% coverage, $5,000 cap, $12,500 reserve. *"Signed, portable, earned from real outcomes."* |
| **1:15** | **Step 2** — agent passport: ProcureBot verified (KYB, signed mandate, $500 limit); RogueBot rejected before an order exists. *"Agent authority, bounded."* |
| **1:35** | **Step 3** — negotiate: $249 list → $214 offer → $237 accepted; signed contract hash. *"Terms fixed before PayPal approval."* |
| **1:55** | **Step 4** — protection: 35 bps, $0.83, $5,000 cap, instant; order at the agreed $237. *"Risk priced per order, not bundled."* |
| **2:15** | **Step 5** — claim: $237 refunded from reserve in 1.2s; reserve updates. *"No chargeback, no support queue."* |
| **2:35** | *"Maya's numbers: conversion on unfamiliar buyers up, loss capped per order, claims settled in seconds. She pays 35 bps on protected GMV — only when it protects a sale."* |
| **2:55** | *"The business: protection is a $1.3B cost centre inside PayPal with no risk-based price. We turn it into a priced SKU — merchant bps, buyer free, platform license, agent API. Moat: outcome data, reserve, network, standard."* |
| **3:20** | *"This is not a badge. It's trust settlement: the credential, the price and the remedy ride the payment."* |
| **3:35** | **Close:** *"Sell to strangers and agents. Protected, priced, and paid back in seconds."* |

---

## 5. Judge rubric mapping

| Criterion | Evidence to show | Where |
|---|---|---|
| **Innovation / novelty** | Not a badge or chargeback guarantee: outcome-signed portable credential + risk-priced protection + instant reserve payout + agent API. The three legs no incumbent holds together | Steps 1–5; prior-art audit |
| **Technical execution** | Working zero-dependency demo; PayPal Orders v2 path; HMAC credential + hash chain; agent passport; contract signing; risk tiers; instant claim; **74/74 e2e tests** | `/demo.html`, `npm test` |
| **Business viability** | 51% abandon on legitimacy; $1.3B protection cost centre; bps pricing; platform license; agent API; 90-day test plan | Pitch 2:35–3:20; [VALUE-PROPOSITION.md](VALUE-PROPOSITION.md) |
| **Demo quality** | 5-step console, deterministic, SIM fallback, JSON log, reset | `/demo.html` |
| **Impact** | Merchant: conversion + bounded loss. Buyer: seconds-to-refund. Agent: passport + remedy. PayPal: new fee SKU + take-rate defense | All steps |
| **Feasibility** | No custody; PSP/insurer partners; 90-day plan; existing PayPal APIs | [PAYPAL-SDK-SOLUTION.md](PAYPAL-SDK-SOLUTION.md) |
| **Execution / team** | Roles, TAM, tests, 48h runbook | §8–9 |

---

## 6. Top judge questions — and the answers

1. **"Isn't this just a trust badge?"** → A badge is paid certification. This is outcome-signed, portable, risk-priced, and it pays a buyer-initiated claim from the merchant's reserve. The badge is a by-product of the ledger, not the product.
2. **"How is this different from Signifyd/Riskified?"** → They indemnify the *merchant* against fraud chargebacks. Settled credentials the merchant, prices the *buyer's* protection, pays a *buyer-initiated* claim in seconds, and the credential is accepted by parties the issuer doesn't own.
3. **"Who pays?"** → The merchant pays bps only on protected GMV; the buyer pays nothing; platforms pay a license; agent operators pay per verify. The pilot is platform-subsidised for 90 days because the platform monetises the resulting GMV.
4. **"What if merchants won't pay?"** → Then the wedge is V2 (platform/PSP trust API). We test it: 3/12 LOIs at ≥25 bps before scaling. We don't assume it.
5. **"A brand-new merchant has no history — how does the credential help?"** → It doesn't claim history. New merchants start in escrow tier C with a refundable bond and third-party attestation (PayPal KYB, PSP history, insurer); they graduate to instant capture. Established merchants moving channels carry their real history.
6. **"Buyer protection is free. Why pay?"** → We don't sell buyer protection. We sell the merchant's loss cap, conversion on unfamiliar buyers, and instant claims ops. The buyer's faster remedy is a by-product.
7. **"Why would an agent use this?"** → Agents get blocked by unknown merchants and can't navigate human disputes. The passport + mandate + trust threshold + instant remedy let them transact and recover without a human.
8. **"What if PayPal builds it?"** → Best case: partner/acquire. We plug into Orders, Refunds, Webhooks, Agent Toolkit/MCP. The trust layer is neutral and portable; PayPal's data makes it stronger, not weaker.
9. **"Where does the money for claims come from?"** → Merchant reserve/LC/insurer, not a demo pool. No custody: the reserve stays with the merchant's PSP or an insurer; caps are reserve × factor; a backtested loss curve precedes "instant."
10. **"How do you prevent gaming?"** → Only payment-settled, carrier-confirmed, matured outcomes count; identity at the beneficial-owner level; coverage disclosure; collateral before trust; buyer/agent reputation; graph detection; caps.
11. **"What's your evidence?"** → 74/74 e2e tests and a working demo today; pre-revenue, with a pre-registered 30-day test plan. We show the test cards, not just the deck.
12. **"Market size?"** → $1.3B protection provision/$1.49B losses inside PayPal; 51% abandonment on legitimacy; agentic checkout is the new surface. The wedge is the protected-GMV bps, not the TAM slide.
13. **"Regulatory/insurance?"** → No custody, merchant-funded guarantee, insurer/LC partner, counsel memo; not consumer credit reporting. We treat licensing as a gating workstream, not an afterthought.
14. **"Why now?"** → AI fake stores, AI fake reviews, agentic checkout entering PayPal's rails, and a standards gap for trust/recourse. The rail is here; the assurance isn't.
15. **"One thing to remember?"** → **"Reputation settles with the payment."**

---

## 7. Live demo reliability

**Pre-flight (T-15 min):**
1. `cd settled && lsof -ti :4173 | xargs kill; node server.js`
2. `curl -X POST http://127.0.0.1:4173/api/reset`
3. Open `/demo.html`, click **Run full demo** once, confirm 5/5 and **ALL FIVE AXES 8+**, click **Reset**.
4. Close heavy apps; disable notifications; set display 1440p or 1600×900; zoom 100%.
5. Keep tabs: `/demo.html`, `/` dashboard, `/agent.html`, `/store.html?merchant=m1`.
6. Have the 60-second screen recording and `screenshots/demo-complete.png` on the desktop.

**Failure modes → fallback**

| Symptom | Fix |
|---|---|
| Page blank / 404 | Server not running: restart; check port 4173 |
| API errors | Click **Reset**; if persists, restart server |
| Step stuck | Click the step again; Run full demo stops on error and toasts |
| Live PayPal fails | Stay in SIM (default); show the approval-link feature as roadmap |
| Wi-Fi down | SIM mode is local; no network needed |
| Time overrun | Skip RogueBot (step 2) and the contract transcript; go straight to claim |
| Judge wants dashboard | Switch tab `/` and show events/orders; return to demo |

**Never do:** live-debug code, promise a feature that isn't built, or claim the $25k pool is production capital. Say "demo pool; production = insurer/LC."

---

## 8. 48-hour runbook

| Time | Do | Owner |
|---|---|---|
| **T-48h** | Freeze scope. Run `npm test` (74/74). Fix only blockers. Record backup video | QA / Lead |
| **T-36h** | Rehearse the 4-minute script 3× with a timer; trim to 3:45 | Presenter |
| **T-24h** | Update judge brief + screenshots; reset seed; **no new features** | Lead |
| **T-12h** | Dress rehearsal on the projector; Q&A drill; check audio | Whole team |
| **T-2h** | Restart server; reset; warm demo; close apps; charge laptop | Driver |
| **T-0** | Demo; fallback ready; 4 minutes, no overrun | Presenter |

**Roles:** Presenter (story), Driver (screen/API), QA (reset/fallback), Lead (time + Q&A).

---

## 9. Team Alignment Map + Team Contract

**TAM (High-Impact Tools for Teams):**
- **Joint objectives:** a live 5-step demo, all five axes visibly 8+, a 4-minute story that survives the books' critiques.
- **Joint commitments:** Lead = integration + pitch; backend = APIs/tests; frontend = demo console; QA = e2e + fallback artifacts; presenter = rehearsal.
- **Joint resources:** PayPal sandbox, local server, screenshots, backup video, reset script, judge brief.
- **Joint risks:** live API failure, judge questions on novelty/economics, time overrun, Wi-Fi, projector. Mitigations: SIM default, deterministic reset, backup video, Q&A sheet, 3:45 target.

**Team Contract:**
- One owner per file; no cross-edits without asking.
- Decisions by Lead; disagreement → evidence, then decide in 5 minutes.
- No new features after T-24h; polish only.
- Demo runs from a clean reset; if it fails twice, switch to backup.
- Respect card: call out specific behavior that helped, not personality.

---

## 10. Metrics and evidence to quote

- **Problem:** 51% abandon on business legitimacy (TrustedSite 2026); 96% concerned about unfamiliar sites; 94% fear AI fake businesses; 91% fear AI fake reviews.
- **PayPal:** $1.34B protection provision / $1.49B realized losses (FY2025 10-K); $1.79T TPV; branded checkout 30% of TPV / >65% of transaction GP.
- **Demo:** 74/74 e2e; 5/5 axes; $237 refund in 1.2s; 35/90/150 bps; $5k cap; 94% coverage; reserve $12,500.
- **Targets to test:** ≥5% relative conversion lift on new buyers; 3/12 LOIs at ≥25 bps; time-to-refund <1 day; claim cost <50% of chargeback cost.

---

## 11. What we test next (VPD sequence)

| # | Hypothesis | Test | Pass |
|---|---|---|---|
| A1 | Merchants rank conversion of unfamiliar buyers above chargeback cost | 12 interviews (VP Payments/CFO/Risk), forced ranking + budget line | ≥7/12 |
| A2 | Agent orders are a funded 2026 pain, not 2027 | 15 interviews; agent traffic %, named budget owner | ≥5 merchants |
| A3 | Credential + protection lifts new-buyer conversion | Holdout A/B, ≥20k sessions | ≥5% rel, p<0.1 |
| A4 | Merchants pay ≥25 bps | 12 LOIs at 15/25/50 bps; fake-door pricing | ≥3/12 |
| A5 | Reserve claims cheaper/faster than chargebacks + insurable | 20-claim concierge pilot; insurer term sheet; counsel memo | <1 day, <50% cost, 1 term sheet |

**Rule:** if A1/A2 fail, the wedge is V2 (platform API); if A3 fails, the credential is a badge; if A4 fails, the model is wrong. Persevere/pivot/kill on evidence, not applause.

---

## 12. Final checklist (print this)

- [ ] Server restarted; `/demo.html` loads; **Reset** works.
- [ ] Full demo run once; 5/5 green; reset again.
- [ ] Backup video + screenshots on desktop.
- [ ] Pitch trimmed to 3:45; one protagonist (Maya); numbers rehearsed.
- [ ] Q&A: badge, Signifyd, who pays, new merchant, free protection, PayPal builds it.
- [ ] Judge brief printed/handout ready.
- [ ] Roles: presenter, driver, QA, lead.
- [ ] Honest boundaries stated: SIM by default; reserve is a demo pool; production = insurer/LC.
- [ ] Close line: **"Reputation settles with the payment."**
