# Settled — end-to-end API test

`test/e2e.js` is a **zero-dependency** Node script that boots the real server, drives the real HTTP API, and prints `PASS`/`FAIL` per test. It is the executable form of `BUILD-SPEC.md` §8 plus the fault, tamper, shortfall and static-page checks.

## Run

```bash
cd settled
npm test                 # = node test/e2e.js
node test/e2e.js         # same
```

Requires **Node ≥ 20** (global `fetch`, `AbortSignal.timeout`). No `npm install` — there are no dependencies.

Exit code is `0` only if every test passes, `1` otherwise, so it drops straight into CI or a pre-demo check.

To triage one section, filter by test-id prefix — the default run is always the full suite:

```bash
ONLY_TESTS=T4,T5 node test/e2e.js     # v2 only (agents, contracts, protection, demo)
ONLY_TESTS=T22 node test/e2e.js       # one test
```

Skipped tests print `SKIP` and are reported separately in the `RESULT` line.

## What it does

1. Probes `http://127.0.0.1:4173/api/health`. If something answers, it **reuses** that server and leaves it running.
2. Otherwise spawns `node server.js` from `settled/`, waits up to 20 s for `/api/health`, and **kills it on exit**.
3. `POST /api/reset` first, so results never depend on prior state.
4. Runs the suite sequentially (the API is stateful), then resets again at the end so the app is left on seed data for a demo.

## Configuration

| Env | Default | Meaning |
|---|---|---|
| `PORT` | `4173` | Port for the server it spawns |
| `BASE_URL` | `http://127.0.0.1:<PORT>` | Test an already-running server instead of spawning |
| `E2E_ALLOW_LIVE` | unset | Set to `1` to keep `AI_API_KEY` / `PAYPAL_LIVE` / PayPal credentials in the spawned server's environment. By default the suite **strips them**, so it always runs on the deterministic SIM + AI-fallback path (otherwise `PAYPAL_LIVE=1` would make orders `pending` and break both v1 and v3 assertions). |

```bash
# against a server you are already running on another port
BASE_URL=http://127.0.0.1:4400 node test/e2e.js

# spawn on a different port
PORT=4400 node test/e2e.js
```

If `server.js` is missing the suite exits `1` with `server.js not found … backend not built yet` — that is expected before the backend lands.

## What is asserted

| Test | Covers |
|---|---|
| T00 | §9 `node --check` parses `server.js` and every `lib/*.js` |
| T01 | `/api/health` → `ok`, `sim`\|`paypal`, 3 merchants |
| T02 | §8.1 merchant list = 3; m1/m2/m3 seed tier, score, fee_bps, cap, reserve, mode, products |
| T03 | §8.2 merchant detail: ledger `{credential, signature, alg:"HS256"}` + events; credential fields, 24 h expiry, 16-hex nonce, sha256 evidence hash |
| T04 | §8.2 `/verify` → `valid:true` and all three `checks` |
| T05 | §8.2 **tampered credential rejected** (score + nested metric mutated) |
| T06–T10 | §9 static pages: `/`, `/store.html`, `/agent.html` → 200 and contain `Settled`; `app.js` references the API (`/api...`); unknown static → 404 |
| T11–T18 | fault shapes: unknown API path, unknown merchant, unknown product, missing body, malformed JSON, unknown order → **404/400/409 with `{error:{code,message}}`** |
| T19–T23 | §8.3–8.5 m1 order: amount 249, fee 0.87 @ 35 bps, instant/5000; fulfill → delivered; double fulfill → 409; claim → refund 249, reserve 12500→12251, `refunded`; double claim → 409 |
| T24 | tier/score/fee/cap/mode recompute is internally consistent after a claim |
| T25–T26 | claim validation: bad reason → 400; `evidence !== true` → 400 and order untouched |
| T27 | §8.6 m3 → escrow / cap 1000; `evidence:false` → 400; valid claim pays 159 |
| T28–T31 | §8.7 `trust/verify`: m1 + min B → true; m3 + min B → false with a reason; default min tier C; unknown merchant → 400/404 |
| T32–T33 | `GET /api/orders` newest-first; `GET /api/events` seq-desc with sha256 hashes |
| T34 | §8.8 reset restores every seed value and empties orders |
| T35 | claim drains the merchant reserve, then the shortfall is paid from the network pool (reserve 900, 6 × 159 claims → 105 + 54) |
| T36 | final cleanup reset (leaves seed state) |

63 tests (37 base + 20 v2 + 6 v3), ~6–9 s against a warm server. Last verified green: **63/63, exit 0** on a freshly spawned server (`PORT=4400 node test/e2e.js`) — the server is killed on exit and leaves no listener.

## v2 coverage — HACKATHON-DEMO-SPEC (agents, contracts, protection, demo)

| Test | Covers |
|---|---|
| T40 | `GET /api/agents` → 3 agents with operator/kyb/capabilities/limits/reputation; a1 valid (ProcureBot, max $500, score 92), a3 invalid |
| T41 | `POST /api/agents/verify` a1 → `verified:true` and all six checks (passport, mandate, limits, merchant, category, kyb) true, `reasons:[]`, passport envelope `HS256` |
| T42 | `POST /api/agents/verify` a3 → `verified:false`, non-empty reasons citing kyb/mandate/violations, `checks.kyb:false` |
| T43 | `GET /api/agents/:id/passport` → credential fields (incl. `sig`), envelope `signature`, `HS256`; tamper probe (tampered score/limits + original signature) must not verify **when the endpoint accepts a caller-supplied credential** |
| T44 | `POST /api/contracts` → `ctr_<hex>`, `open`, `list_price 249`, `policy.floor≈204`, `policy.auto_accept≈237`, `max_discount_pct 18`, mandate/terms present, empty transcript |
| T45 | `POST /api/contracts/:id/auto` → `accepted`, `agreed_price` ≈ 95% of list and within [floor, list], 64-hex `hash`, ≥2 signatures referencing a1+m1, transcript ≥2, rounds advanced |
| T46 | offers: price `0` / negative → 400; invalid `from` → 400 (error envelope each time) |
| T47 | buyer offer above `mandate.max` → 400/409 error envelope |
| T48 | rounds exceed `max_rounds` → contract `expired`, `rounds > max_rounds`, later offers → 400/409 |
| T49 | `POST /api/protection/quote` m1 $249 → `fee_bps 35`, `fee 0.87`, `cap 5000`, `mode instant`, non-empty `coverage` |
| T50 | order with `contract_id`+a1 → amount = `agreed_price`, `acc{contract_id,hash(64hex),transcript_hash,terms,buyer_agent_id}`, status paid |
| T51 | order with a3 → **403 `AGENT_NOT_VERIFIED`** |
| T52 | regression: order without contract/agent → $249, paid, no `acc` required |
| T53 | claim on the negotiated order → refund = agreed price, `paypal_refund_id` `SIM-RF-<hex>`, `sla_ms 1200`, `actor buyer`, reserve decreases by the refund, order refunded |
| T54 | second claim on the same order → 409 |
| T55 | `GET /api/claims?merchant=m1` → `{claims:[...]}` newest-first and contains the claim |
| T56 | `/demo.html` → 200, contains `Settled`, `Run full demo`, `all five`; `/demo.js` → 200 and calls `/api` |
| T57 | full demo flow steps 1–5 via API → signed credential, a1 verified, contract accepted, order at agreed price with ACC hash, claim refunded; final contract state `accepted` |
| T58 | reset clears contracts + claims, keeps the 3 agents, unknown contract → 404 |
| T59 | cleanup: final reset leaves seed state |

## v3 coverage — AI-PAYPAL-BUILD-SPEC (AI negotiation, AI claims, PayPal SIM rails)

| Test | Covers |
|---|---|
| T60 | `GET /api/config` → `mode` sim\|live, `currency:USD`, `paypal{env,client_id,configured}` (configured ⇔ client_id present), `ai{enabled,provider,model}`; a spawned server (no key) reports `ai.enabled:false` |
| T61 | create contract + `POST /contracts/:id/ai-auto` → `accepted`, `ai.used:false` on the no-key fallback, 1–2 buyer moves each `offer`/`accept` with a price inside [floor, list], `agreed_price` in range, 64-hex `hash`, `contract.ai` attached; second call is idempotent |
| T62 | `POST /orders/:id/claim {use_ai:true}` → `ai.recommendation ∈ approve\|review\|deny`, `confidence 0..1`, non-empty `rationale`, boolean `used`; refund still paid, reserve drops by the refund, order `refunded`, second claim 409 |
| T63 | PayPal SIM lifecycle: `/api/paypal/create-order` → `SIM-…`; `/capture` → `COMPLETED` + order `paid` + `capture_id`; `/refund` → `SIM-RF-…`; **merchant reserve untouched** by PayPal routes |
| T64 | order with `simulate:true` → `paid` immediately, `simulated:true`, `SIM-…` payment id; a plain SIM-mode order stays `simulated:false` |
| T65 | regression/markers: `/demo.html` + `/demo.js` 200 and carry `AI agents`, `PayPal`, the AI badge; `demo.js` calls `/api/config` and `ai-auto`; final reset restores seed |

## Reading a failure

```
FAIL  T22  §8.5 claim → refund 249, reserve 12500→12251, order refunded  — claim.refund: expected 249 (±0.005), got 0
      evidence: {"claim_series":[{"refund":0,"from_reserve":0,...}]}
```

Every failure prints the assertion that broke and either the exact response body (truncated to 1.2 KB) or the last HTTP response with status and content type. Nothing is swallowed. Transport errors say so explicitly (`network/transport error — is the server up?`).

## Known contract ambiguities the suite resolves conservatively

- **Verify-with-body was not in §5.** "Tampered credential fails" is untestable through a no-body verify endpoint, so T05 supplies `{credential, signature}` to `POST /api/merchants/:id/verify` (and falls back to `/api/trust/verify`). The backend supports this — `valid:false, checks.signature:false` — so the test is green. Keep that optional-body support; it is an extension, not a break (§1 permits additions).
- **Money types.** Amounts/percentages may be JSON numbers or `"249.00"` strings; the suite normalises both, so it never fails on formatting.
- **`fulfill` status string.** §8.4 says "delivered"; T20 accepts `delivered` or `fulfilled`.
- **`payment.mode` vs `protection.mode`.** `protection.mode` is asserted (`instant`/`reserve`/`escrow`); `payment.mode` is only checked for presence.
- **Unknown merchant / unknown product codes.** §5 documents the 400/404/409 classes but not which applies where; the suite accepts 400 or 404 for those lookups (the backend currently returns 404 `PRODUCT_NOT_FOUND` / `MERCHANT_NOT_FOUND`).
- **Order creation status code.** `POST /api/merchants/:id/orders` returns **201**; the suite accepts 200 or 201.
- **`evidence` vs `reason` check order.** Both are 400s; T25 supplies a valid reason with a bad reason-only case and T26 a valid reason with `evidence:false`, so either check order passes.
- **`network_pool` has no read endpoint**, so T35 asserts the shortfall per claim (`paid_from_pool`) and the accounting identity rather than a pool balance.
- **Fee rounding.** `159 × 150/10000 = 2.385`; `Math.round` → 2.39 but `toFixed(2)` → 2.38. T27 accepts both.

### v2 (HACKATHON-DEMO-SPEC) ambiguities the suite resolves conservatively

- **Passport `sig`.** §1 lists `sig` inside the passport credential while §2 returns `{credential, signature, alg}`. T43 requires **both**: the envelope signature *and* `credential.sig` (a portable credential must carry its own signature).
- **Tamper verification.** T43 posts a mutated credential plus the original signature to `POST /api/agents/verify`. The backend accepts a caller-supplied `{credential, signature}` and returns `verified:false`; if a build ignores the body, the test still passes but reports `tamper NOT exercised` in the detail — do not lose that behaviour, it is the demo's assurance claim.
- **`/auto` price is under-specified.** §2's scripted path is written as `~$236.55?` in the demo narrative; the implementation returns `round(249 × 0.95) = 237`. T45 asserts `agreed_price` is inside `[floor, list]` and within ±$2.5 of 95%.
- **Offer above mandate** returns 400 `MANDATE_EXCEEDED`; the task allowed 400 or 409.
- **Round expiry** lands on the 5th offer (`rounds 5 > max_rounds 4`), per §2's "> max_rounds"; later offers return 409 `CONTRACT_NOT_OPEN`.
- **Order status code** for contract/agent orders is 200 (not 201); accepted. A **claim refund equals the agreed price**, not the list price.
- **`/demo.js` is a separate file** that `demo.html` loads with `<script src="demo.js">`; T56 requires it to exist and call `/api`.

### v3 (AI-PAYPAL-BUILD-SPEC) ambiguities the suite resolves conservatively

- **`ai` placement.** §3 says the claim response carries `ai` "(`claim.ai` too)"; T62 accepts either `response.ai` or `response.claim.ai`.
- **Capture status.** §4 returns `{mode, capture, order}` but the task says "capture returns status COMPLETED"; T63 accepts `capture.status` or a top-level `status`, case-insensitively.
- **Refund amount/status.** `/api/paypal/refund` amount is asserted only when present (a full refund should equal the order amount); status is asserted only if returned.
- **`ai.moves` count.** §2 allows at most 2 buyer moves and §6 says "2 moves"; the task says "≥1". T61 asserts 1–2.
- **Live mode.** With `PAYPAL_LIVE=1` the SIM assertions cannot run (they would hit the real API), so T63 reports `skipped SIM assertions` instead of failing; run the suite without live credentials (the default) for the green path.
- **`configured` semantics.** T60 requires `paypal.configured === Boolean(client_id)` — a config flag that disagrees with the presence of a client id is a bug, not a variant.
- **API helper vs literal path.** `demo.js` calls `S.api('/config')` and `S.api('/contracts/:id/ai-auto')` — the shared `Settled` helper prefixes `API_BASE = '/api'` (see `app.js`). T65 therefore accepts either the literal `/api/...` path **or** the helper form; matching raw literals only would be a false negative. T09 applies the same rule to `app.js`.
- **`AI agents` / `PayPal` markers** are checked across `demo.html` + `demo.js` combined, since the badge label can live in either file (§5 allows additive DOM).

If the backend or spec changes, update the assertion and the corresponding row above; keep the `Tnn` ids stable so a failing demo check maps to a known behaviour.
