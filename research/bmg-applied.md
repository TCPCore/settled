# Settled through *Business Model Generation* (Osterwalder & Pigneur)

Applied to the current product: merchant **trust credential** (outcome-signed, portable) + **agent passport** +
**negotiated contract** + **risk-priced protection** (instant capture / capture+reserve / escrow / decline) +
**instant claim from a merchant reserve**, exposed as `trust.verify` / `protection.quote` / `claim.file` (+ MCP), with a
working PayPal-sandbox demo. Book citations are to BMG page numbers (canvas p.44, blocks pp.16–40). Short quotes are
paraphrased except where marked.

**Verdict in one line:** strong pattern fit (multi-sided + unbundling), a clean Blue Ocean move, but the canvas is
weakest exactly where BMG says business models die — **who pays, and with whose capital** (pp.44, 212).

## 1. The nine-block canvas (BMG p.44; blocks pp.16–40)

| Block | Settled (3–6 concrete items) | Key question / evidence needed |
|---|---|---|
| **Customer segments** (p.20) | Paying: enterprise merchants (high-AOV DTC, luxury resale, marketplaces); platforms/PSPs enabling agentic checkout; agent operators. Beneficiaries: buyers and their agents. Later: insurers/credit partners. | Are there ≥2 segments with *different* willingness to pay, and is the beneficiary really non-paying? Evidence: 10 merchant + 5 platform interviews (A1, A5). |
| **Value propositions** (p.22) | Portable outcome-signed trust credential (VC/JWT); risk-priced protection quoted per order; buyer claim paid in ~1s from merchant reserve; agent passport + negotiated contract (mandate, caps, settlement); agent-readable trust API. | Which single job does each VP serve? Evidence: conversion lift vs holdout ≥5%, time-to-refund <1 day, loss ratio < fee. |
| **Channels** (p.26) | PayPal partner/App directory; other PSPs (Stripe, Adyen) via webhooks; platform app stores; direct enterprise sales; developer docs/MCP server; insurer/broker channel. | Can we reach merchants without a direct sales force? Evidence: 1 platform sandbox pilot; cost per integrated merchant. |
| **Customer relationships** (p.28) | 90-day paid pilot → success-based production; claims ops with SLAs; named risk partner for tier-1; self-serve developer tier; appeals/challenge process. | What relationship does a *risk* product require after launch? Evidence: pilot→paid conversion, churn, claim NPS. |
| **Revenue streams** (p.30) | bps on protected GMV (risk-priced, e.g. 10–200 bps); platform license ($250k–$1M); agent API per-verify + bps; B2B credit/insurance commission; later data products. | *For what value are they really willing to pay, and how?* Evidence: 3/10 LOIs at ≥25 bps (A1); price elasticity by tier. |
| **Key resources** (p.34) | Outcome data network (payments + delivery + disputes); underwriting and claims models; credential/ledger/claims tech; reserve or insurer capital; PayPal integration; compliance/claims team. | Which resource is truly scarce — data, capital, or trust? Evidence: data coverage per merchant, backtested loss curve. |
| **Key activities** (p.36) | Event ingestion and normalisation; underwriting/pricing; adjudication + appeals; credential issuance/revocation; integrations; KYB/licensing; merchant success. | What must be excellent to keep the promise "instant"? Evidence: decision latency, claim cycle time, appeal rate. |
| **Key partnerships** (p.38) | PayPal/PSPs; marketplaces and agent platforms; insurers/reinsurers (capital); carriers/3PL (delivery evidence); KYB providers; counsel/regulators. | Who carries the tail risk we cannot? Evidence: 1 insurer term sheet (A6), 1 PSP agreement. |
| **Cost structure** (p.40) | Claim payouts (largest variable); reserve capital cost / insurance premium; engineering and integrations; compliance/legal; sales/CS; fraud and abuse. | Is this value-driven or cost-driven, and what is the marginal cost of a protected order? Evidence: loss ratio, CAC, cost per claim. |

## 2. Patterns (BMG pp.56–120) — which fit, and the risks

**Multi-sided platform (p.76) — the strongest fit.** Sides and roles: **merchants** supply goods and pay bps;
**buyers/agents** demand assurance and pay nothing directly; **platforms/PSPs** distribute and take a revenue share;
**insurers** supply capital; **agent operators** are a third paying side (verifies + bps). Subsidy logic: buyers are
the subsidised side (protection bundled free at checkout); merchants cross-subsidise them; the platform is lured with
a free first integration because it monetises GMV elsewhere. BMG's own test — *which side is more price-sensitive, and
will the other side cover the subsidy?* (p.76) — is **unanswered**: a merchant that already pays for chargebacks may
see this as double cover. Risks: **chicken-and-egg** (a credential is only worth portability once several platforms
accept it), **who pays** (merchant WTP is assumption A1), **disintermediation** (the PSP or marketplace builds it in,
or the merchant hides outcome data to avoid a bad score).

**Unbundling (p.56) — Settled currently violates it.** BMG separates **customer-relationship**, **product-innovation**
and **infrastructure** businesses; they have different economics and should not sit in one company. Today Settled does
all three: storefront/dashboard (relationship), risk models and credential schema (innovation), ledger/claims/reserve
(infrastructure). The demo's storefront is the tell. Recommended position: **infrastructure + product innovation, rent
the relationship** from PSPs/platforms/agents. This also explains and justifies the no-custody, embed-in-PSP design.

**FREE (p.88) — partly, and dangerously.** There are three FREE shapes in BMG: advertising-based multi-sided,
freemium, and bait & hook. Settled is a **cross-subsidy** (merchant pays, buyer free) plus a plausible **freemium**
tier (free credential/verify for long-tail merchants, paid protection bps). BMG's warning is the metric to watch:
cost of serving the free user vs conversion to paid (p.88). For Settled the free side is the *buyer*, whose "free"
protection is a real liability — so a free tier without underwriting is a loss engine, not a funnel.

**Open business model (p.108) — selective.** Publish the credential/contract **schema** as an AP2/UCP extension
(inside-out) and accept third-party attestations — carrier delivery data, PSP disputes, KYB (outside-in). BMG's point
is that open models monetise the layer you *keep* (here: the ledger, pricing and claims), not the schema. Openness buys
the standards seat and distribution; it must not leak the outcome data or the underwriting model.

**Long tail (p.66) — opportunistic.** BMG's long-tail pattern needs low inventory cost and a strong platform (p.66).
Settled has neither inventory nor a marketplace; its analogue is a long tail of **small merchants priced out of
enterprise guarantees**, served by low-touch onboarding and a pooled reserve. The risk is **adverse selection**: only
merchants who expect claims adopt, which poisons the pool. Treat as an option after the enterprise wedge, not the wedge.

## 3. Design techniques (BMG pp.126–190)

**Customer insights / empathy map (pp.126–133; map p.131).** Primary paying buyer: *Maya, Head of Risk at a $200M DTC
brand.* **Sees:** agent traffic growing, competitor badges, chargeback dashboards. **Hears:** "our PSP covers fraud, not
delivery"; "the board wants agent sales but legal is nervous". **Thinks/feels:** exposed — she cannot answer "who pays
if an agent buys and the customer returns it?" **Says/does:** runs pilots, asks for holdouts, avoids new vendors that
touch funds. **Pains:** no portable proof, slow disputes, unquantified agent risk, compliance vetoes. **Gains:**
defensible loss numbers, safer agent channel, a story the CFO accepts. Implication: sell *evidence and bounded
downside*, not "trust".

**Ideation and epicenters (pp.134–142).** BMG names four starting points — resource-, offer-, customer- and
finance-driven (p.138). Five what-ifs to prototype: (1) *offer-driven*: protection as a line item the buyer sees and can
increase; (2) *resource-driven*: sell the ledger itself (trust API) and let others price claims; (3) *finance-driven*:
insurance balance-sheet model (premium bps, reserve from a reinsurer); (4) *customer-driven*: a marketplace-wide safety
net sold to the platform, not the merchant; (5) *multi-epicenter*: agent ops pays per verify, merchants pay bps,
insurer takes tail.

**Visual thinking (p.146).** Keep one poster: five axes (credential → passport → contract → priced protection → instant
claim) with money and data flows on one page. BMG's claim that sketches expose relationships (p.146) is why the demo
screens beat a slide deck in the pitch.

**Prototyping (pp.160–165).** BMG's scale runs from napkin sketch to a field-testable business model (p.165); the demo
is a genuine field-testable *decision + claim loop* (PayPal sandbox, 37 e2e tests) but has no real merchants, no real
money, no real reserve. **Next prototype should be lower-tech, not higher:** a wizard-of-oz concierge pilot — 20 claims,
one category, manual adjudication, measured time-to-refund vs chargeback — plus a pricing landing-page test. Design
attitude (p.164): hold two or three models open (merchant-bps vs platform-license vs insurance) rather than freezing
the first.

**Storytelling (pp.170–173).** BMG insists on **one protagonist** and simplicity (p.173). Maya's story: agent orders
arrive → she has no answer for "who pays?" → the credential proves the merchant, protection is priced per order, a
claim clears in a second from the reserve, and her agent gets a passport with limits. One protagonist, one arc, four
minutes.

**Scenarios (pp.180–182).** Three futures to design for: (A) **protocol absorption** — AP2/UCP add a trust/recourse
extension and the credential becomes a schema; Settled wins as referee + ledger. (B) **incumbent bundling** — Mastercard
Merchant Trust Services and PSPs fold merchant trust into existing products; Settled survives only as a neutral
cross-PSP ledger. (C) **agent winter / compliance** — agent commerce disappoints or is regulated; trust becomes audit
and insurance infrastructure. Each scenario implies a different prototype to keep alive.

## 4. Strategy (BMG pp.200–240)

**Environment (p.200), four forces.** *Market:* agent traffic rising, trust gap explicit, merchants already pay for
fraud cover — so the pitch must be additive, not duplicate. *Industry:* acquirers/PSPs, guarantee vendors (Signifyd,
Riskified, Forter), badges (TrustedSite, BuySafe), and networks (Mastercard Merchant Trust Services, 2026) all adjacent;
rivalry is about who owns the outcome data. *Key trends:* AP2/UCP/ACP standardisation, instant payouts as expectation,
reputation portability research, regulatory attention on AI agents. *Macro:* cost of capital for reserves, consumer
protection politics, cross-border data rules. Implication: the moat is timing plus a neutral data position, not the API.

**Evaluating the model (p.212).** BMG's SWOT-on-the-canvas: **Strengths** — outcome-derived data, working demo,
PayPal adjacency, a real economic buyer (risk/CFO). **Weaknesses** — no balance sheet for the guarantee, unproven WTP,
demo bundles three businesses, claims ops not built. **Opportunities** — agentic commerce has no trust primitive;
platforms want a packaged answer; insurers need distribution. **Threats** — PSPs/networks bundle it; platforms refuse a
third-party credential; adverse selection; regulatory reclassification as insurance.

**Blue Ocean four actions (p.226).** *Eliminate:* paid badges/certification theatre; platform-bound scores; manual
dispute queues; chargeback as the default remedy. *Reduce:* integration effort (three endpoints, no custodial flow),
claim latency (days → seconds), reserve capital per merchant (pooled/reinsured), underwriting cycle time.
*Raise:* certainty of coverage, portability of the credential, transparency of price (bps per tier), agent-readiness.
*Create:* the agent passport, the negotiated contract with instant settlement, `trust.verify`, instant claims from a
reserve, and a credential published as a protocol extension. BMG pairs this with value innovation — raise value *and*
cut cost (p.226); here cost falls because adjudication is rule-based and capital is partner-supplied.

**Managing multiple business models (p.232).** Two portfolios, ring-fenced: **exploit** — merchant protection bps and
PSP/platform distribution (near-term revenue, most effort); **explore** — agent passport + negotiated contract +
standards extension + B2B credit/insurance (the growth engine). BMG warns that conflicting models must be managed
separately or the established one starves the new one (p.232). Conflict to name: direct enterprise sales vs
platform-embedded distribution — do not run both as one motion.

## 5. Process (BMG pp.244–249) — hackathon now, 30 days after

BMG's five phases — Mobilize, Understand, Design, Implement, Manage (phases table p.248) — are explicitly not linear;
Understand and Design run in parallel (p.248).

| Phase | Objective (p.248) | Hackathon (3 days) | Next 30 days |
|---|---|---|---|
| **Mobilize** | prepare, common language | canvas + five-axis poster; demo script; pre-agreed success criteria | appoint claims/underwriting owner; pilot scope |
| **Understand** | immersion in customers/tech/environment | prior-art audit + 3 expert interviews | 10 merchant, 5 platform, 3 agent interviews; loss-data request |
| **Design** | generate and test options | prototype the decision→claim loop; two pricing models on paper | concierge pilot design; holdout A/B; insurer options |
| **Implement** | field-test the prototype | live demo (PayPal sandbox), fallback screenshots | 20-claim concierge pilot on one merchant |
| **Manage** | adapt continuously | post-demo retro; kill/persevere note | weekly loss/claim metrics; kill rule on A1/A2 |

BMG's **design attitude** (p.164) is the hackathon lesson: explore several crude models before refining one — the team
should leave with three canvases (merchant-bps, platform-license, insurance), not one polished deck.

## 6. Honest weaknesses from the book's lens — and 3 fixes

1. **Who pays is unproven (p.44 revenue block; p.30).** The beneficiary (buyer) is free and the payer (merchant) may
   believe it already bought protection. BMG treats "for what value are customers really willing to pay" as the central
   revenue question; Settled currently answers it with a hypothesis (25 bps LOIs), not evidence.
2. **The guarantee has no balance sheet (p.40 cost structure; p.212).** Instant claims from a fixed $25k demo pool is a
   promise the model cannot keep at volume; BMG's cost block forces the loss curve into the open. This is the single
   biggest model weakness: **a guarantee priced before the loss curve is a liability, not a revenue stream.**
3. **The model is bundled against BMG's own unbundling advice (p.56).** Storefront + dashboard + ledger + underwriting
   in one company means it competes on the relationship layer it cannot win (PSPs/platforms own the checkout) while
   under-investing in the infrastructure layer that would be defensible.
4. Secondary: multi-sided cold start (p.76), long-tail adverse selection (p.66), and the scenario where a network
   (Mastercard MTS) or PSP bundles merchant trust before Settled reaches distribution.

**Three fixes — the first two attack the guarantee directly, the third removes its structural cause.**
- **F1 — Prove the payer before pricing the promise.** Buyers free; merchants pay bps only on *protected* GMV; the
  platform subsidises the first 90 days because it monetises the resulting GMV; agent operators pay per verify. Gate the
  bps on a pre-registered holdout (conversion lift + loss reduction), so "who pays" is answered with evidence, not a deck.
- **F2 — Back the guarantee with a capital partner and bounded liability.** No underwriting from a demo pool: an
  insurer/LC partner, per-merchant aggregate caps (reserve × factor), a pooled/reinsured long-tail tier, and a
  backtested loss curve before "instant claim" is promised. Success = one insurer term sheet + one counsel memo.
- **F3 — Unbundle and rent the surface.** Ship only the credential/decision/claims layer; kill storefront/dashboard from
  the pitch (keep for demo); make integration a platform/PSP task. Success = one platform sandbox pilot, not ten
  merchant pilots. This is what makes the first two affordable.

*Sources: Business Model Generation, Osterwalder & Pigneur, 2010 (user-supplied text; BMG citations by book page).
Settled product facts from `settled/README.md`, `VALUE-PROPOSITION.md`, `ENTERPRISE-AGENTIC.md`.*
