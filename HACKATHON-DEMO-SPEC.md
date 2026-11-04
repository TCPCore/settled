# HACKATHON DEMO SPEC — Settled Agent Assurance (v2)

Goal: a **working, live-demoable product** that tells the five-axis story in ~4 minutes and works on `node server.js` with zero dependencies. Keep the existing app and tests working; all changes add new files/endpoints/fields.

**Demo narrative:** trust credential → agent passport → negotiated contract → priced protection + PayPal order → instant refund. The demo console (`/demo.html`) is the primary stage; dashboard/store/agent remain.

---

## 1. Seed agents (new, in `lib/passport.js`)

| id | name | operator | kyb | capabilities | limits | reputation | mandate | status |
|---|---|---|---|---|---|---|---|---|
| a1 | ProcureBot | Acme Procurement Inc | verified | purchase, negotiate, claim | max $500, audio/electronics, merchants [m1,m2] | 24 orders, 1 claim, 0 violations, score 92 | ap2_9f2c, exp +1h, max $500, signed | valid |
| a2 | GiftGenie | Lumen Labs | verified | purchase | max $250, home, merchants [m2] | 8 orders, 0 claims, 0 violations, score 78 | ap2_7a1b, exp +1h, max $250, signed | valid |
| a3 | RogueBot | (none) | unverified | purchase | max $9999 | 0 orders, 6 violations, score 12 | none/expired | invalid |

Passport fields: `agent_id, name, operator{legal_name,kyb,country}, capabilities[], limits{max_amount,categories,merchants}, mandate{id,expires_at,max_amount,signed}, reputation{orders,claims,violations,score}, issued_at, expires_at, revocation, sig (HMAC HS256 over base64url(JSON))`. Reuse the ledger secret or a dedicated one.

## 2. New APIs (additive; exact shapes)

### GET /api/agents
`{ agents: [ { id, name, operator, kyb, capabilities, limits, reputation, status } ] }`

### POST /api/agents/verify
Body `{ agent_id, merchant_id?, amount?, category? }`
→ 200 `{ verified, agent: {…}, checks: { passport: bool, mandate: bool, limits: bool, merchant: bool, category: bool, kyb: bool }, reasons: [], passport: { credential, signature, alg } }`
- `false` for a3 (kyb/mandate/violations) with reasons.
- If merchant/amount/category given, check allowlist, max_amount, category.

### GET /api/agents/:id/passport
`{ credential, signature, alg: "HS256" }`

### POST /api/contracts
Body `{ merchant_id, product_id, buyer_agent_id, mandate?: { max, ttl_seconds } }`
→ 200 `{ contract }`
Contract: `{ id:"ctr_<hex>", merchant_id, product_id, product_name, list_price, agreed_price:null, status:"open", rounds:0, max_rounds:4, policy:{ floor, auto_accept, max_discount_pct }, mandate:{ max, expires_at }, terms:{ delivery_days, returns_days, warranty_months }, transcript:[], hash:null, signatures:{}, created_at }`
Policy: `floor = round(list*0.82)`, `auto_accept = round(list*0.95)`, `max_discount_pct = 18`.

### POST /api/contracts/:id/offers
Body `{ from: "buyer"|"merchant", price, note? }`
- Validate state, price > 0, buyer price ≤ mandate.max.
- Buyer offer: if ≥ auto_accept → accepted at offer; else if ≥ floor → merchant auto-counter `counter = max(price + step, floor)` where `step = round(list*0.02)`; else → rejected (`status:"rejected"`).
- Merchant offer can be accepted by buyer via `/accept`.
- Increment rounds; > max_rounds → status `expired`.
→ `{ contract, decision: "accepted"|"countered"|"rejected"|"expired" }`

### POST /api/contracts/:id/accept
Body `{ from: "buyer"|"merchant" }` (default buyer)
- Only if a merchant counter/offer exists; lock `agreed_price`; status `accepted`; compute `hash = sha256(JSON.stringify({contract, transcript, agreed_price, terms}))`; signatures: buyer_agent id/HMAC, merchant id/HMAC.
→ `{ contract }`

### POST /api/contracts/:id/auto
Runs the scripted path deterministically: buyer 86% of list → merchant counter 95% → buyer 93% → merchant counter 94.5%? Simpler exact: offer1 = round(list*0.86), merchant counter = round(list*0.95), buyer offer2 = round(list*0.93), merchant counter = round(list*0.945) capped at auto? If offer2 ≥ auto_accept - 2? Keep simple: buyer offer2 = round(list*0.944) → merchant accepts (since ≥ auto_accept? no, auto_accept=0.95). For a clean deal at ~94%: set buyer offer2 = round(list*0.95) → auto-accepted. So transcript: 0.86 → counter 0.95 → 0.95 accepted. That's 2 offers, fine.
→ `{ contract }` (status accepted, agreed_price).

### GET /api/contracts/:id
`{ contract }`

### POST /api/protection/quote
Body `{ merchant_id, amount }` → `{ quote: { merchant_id, amount, fee_bps, fee, cap, mode, coverage:[...], reserve_source:"merchant_reserve", reserve_target, exclusions:[...] } }`

### POST /api/merchants/:id/orders (extend existing)
Body may include `{ product_id, buyer, contract_id?, agent_id? }`.
- If `agent_id`: verify passport first; fail 403 `AGENT_NOT_VERIFIED`.
- If `contract_id`: must be accepted, merchant match, product match; `amount = contract.agreed_price`; attach `acc` to order and event.
- Response adds `acc: { contract_id, hash, transcript_hash, terms, buyer_agent_id }` and `protection` already there.
- Keep existing behavior when neither provided (tests).

### POST /api/orders/:id/claim (extend)
Add to claim response: `paypal_refund_id: "SIM-RF-<hex>"`, `sla_ms: 1200`, `actor: body.actor || "buyer"`; keep all existing fields/status codes. 

### GET /api/claims?merchant=m1
`{ claims: [...] }` newest first.

---

## 3. Demo console (`public/demo.html`, `public/demo.js`)

Single page, dark fintech, no external assets, uses `styles.css` + `Settled` helpers. Sections:

**Header:** "Settled — agent assurance for PayPal" + SIM pill + Reset + **Run full demo** (primary) + link to dashboard/store/agent.

**Scorecard (5 cards):** Delivery / Authorization / Trust / Protection / Negotiation / Recourse — show "before" and "after" values and light up green as each step completes:
- Authorization 5→8.5, Trust 2→8.5, Protection 1→8.5, Negotiation 1→8.0, Recourse 3→8.5.

**Steps (left column buttons / auto-advance):**
1. **Trust credential** — GET m1 detail; show tier A, score 91, coverage 94%, cap $5,000, reserve $12,500, VC JSON; mark Trust.
2. **Agent passport** — select a1; POST agents/verify; show operator/kyb/capabilities/limits/reputation + checks; also a "Try RogueBot" button → rejected; mark Identity.
3. **Negotiate** — POST contracts (m1,p1,a1); POST auto; show transcript (list $249 → offer $214 → counter $237 → offer $237.00? → accepted at $237.00?); show signed contract hash and terms; mark Negotiation.
4. **Protection + PayPal** — POST protection/quote (amount=agreed); then POST orders with contract_id+agent_id; show fee bps/fee/cap/mode, order id, payment id, receipt/ACC hash. If server is in live PayPal mode and returns approval_url, show a "Open PayPal approval" link; otherwise show SIM.
5. **Recourse** — POST claim on the order (reason not_delivered, evidence true); show refund $X, paid from reserve, PayPal refund id, SLA 1.2s, reserve before/after, score/tier update; mark Recourse.

**Right column:** live JSON log (request/response) with method chips; final "ALL FIVE AXES 8+ — ASSURANCE LAYER DEMOED" panel.

Also add a compact "What this replaces" note: badges vs outcome credential, bundled protection vs priced SKU, chargeback vs instant claim.

Add nav link "Demo" on dashboard/store/agent.

**Reliability:** all steps are single API calls with deterministic results; "Run full demo" runs steps 1–5 sequentially with small delays and stops on error (toast). Reset button calls `/api/reset` and clears UI.

---

## 4. Files / ownership

| Path | Owner |
|---|---|
| `lib/passport.js`, `lib/contract.js`, `lib/protection.js` (new), edits to `server.js`, `lib/data.js` | backend (api-scout) |
| `public/demo.html`, `public/demo.js`, nav links in `public/index.html`/`store.html`/`agent.html` | frontend (demo-builder) |
| `test/e2e.js` additions | QA (red-team) |
| Integration, PayPal live check, screenshots, README, demo script | lead |

**Do not break existing endpoints/tests.** All new fields additive. Use existing `ledger` HMAC helpers for signatures; reuse `risk.derivedFor` for fee/cap/mode. Reset must clear contracts/claims additions.

---

## 5. Acceptance

- `node server.js` clean; `npm test` still passes + new tests.
- `/demo.html` runs the full demo end-to-end and ends with 5/5 green.
- All pages 200; no external network; no console errors.
- Screenshots: demo start, contract accepted, claim/refund.
- README updated with demo script and "what's simulated vs live PayPal".
