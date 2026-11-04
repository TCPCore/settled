# SETTLED — build spec (v1)

**Product:** "Settled" — reputation settles with the payment.
A working prototype of Trust Settlement: a signed, portable merchant trust ledger that prices buyer protection and pays claims instantly.

**Stack:** Node.js ≥ 20, **zero npm dependencies** (built-in `http`, `crypto`, `fs`, `url`; global `fetch` for the optional PayPal adapter). Static frontend: plain HTML/CSS/JS, no build step, no external assets. Port **4173**.

**Definition of done:** `node server.js` → open `http://127.0.0.1:4173` → the 5 flows below work end-to-end with real API calls and persisted-in-memory state.

---

## 1. Files / ownership

| Path | Owner | Contents |
|---|---|---|
| `settled/server.js` | backend (api-scout) | HTTP server, routing, static serving, seed, orchestration |
| `settled/lib/data.js` | backend | seed merchants/products + in-memory store + reset |
| `settled/lib/risk.js` | backend | score, tier, fee, cap, payment mode, reserve |
| `settled/lib/ledger.js` | backend | HMAC credential signing/verify, hash-chained events |
| `settled/lib/paypal.js` | backend | optional live PayPal adapter; sim fallback |
| `settled/public/index.html` | frontend (demo-builder) | merchant dashboard |
| `settled/public/store.html` | frontend | storefront + checkout + claim |
| `settled/public/agent.html` | frontend | agent trust console |
| `settled/public/app.js`, `styles.css` | frontend | shared client |
| `settled/test/e2e.js` | QA (red-team) | end-to-end API test |
| `settled/README.md` | lead | run instructions, architecture, what's real vs simulated |

**Contract is frozen in this file.** Backend implements exactly these endpoints; frontend consumes exactly these shapes. If something is missing, extend without breaking existing fields.

---

## 2. Seed data (must match)

Merchants:

| id | name | domain | category | tier | score | fee_bps | cap | reserve | mode | orders | delivered% | as_described% | disputes | chargebacks | avg_days | age_days |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| m1 | Northwind Audio | northwind.audio | Audio gear | A | 91 | 35 | 5000 | 12500 | instant | 4812 | 99.1 | 99.4 | 14 | 2 | 3.2 | 1460 |
| m2 | Lumen Supply | lumensupply.co | Home & light | B | 76 | 90 | 2500 | 4000 | reserve | 412 | 97.2 | 98.1 | 6 | 1 | 4.6 | 520 |
| m3 | Nova Finds | novafinds.shop | Gadgets | C | 54 | 150 | 1000 | 900 | escrow | 12 | 91.7 | 93.0 | 1 | 0 | 6.8 | 45 |

Products (price USD):
- m1: `p1` "Aurora One headphones" $249.00; `p2` "Aurora Buds" $129.00
- m2: `p3` "Halo floor lamp" $189.00; `p4` "Halo desk lamp" $79.00
- m3: `p5` "Pocket projector" $159.00

Metrics are canonical; score/tier/fee/cap/mode are **derived by `lib/risk.js`** and must equal the table above at seed time (tune weights so they do). Reserve is stored and mutable after claims.

---

## 3. Risk engine (`lib/risk.js`)

Inputs: `orders`, `delivered_pct`, `as_described_pct`, `dispute_rate_pct`, `chargeback_rate_pct`, `age_days`.
- `volume = min(100, log10(orders+1) * 25)`
- `age = min(100, age_days / 365 * 50)`
- `dispute = 100 - min(100, dispute_rate_pct * 10)`
- `chargeback = 100 - min(100, chargeback_rate_pct * 50)`
- `score = round(0.30*delivered + 0.25*as_described + 0.15*dispute + 0.10*chargeback + 0.12*volume + 0.08*age)`

Tier: `A >= 85`, `B >= 70`, `C >= 50`, `D < 50`.
Derived: `fee_bps = {A:35,B:90,C:150,D:0}`, `cap = {A:5000,B:2500,C:1000,D:0}`, `mode = {A:'instant',B:'reserve',C:'escrow',D:'blocked'}`, `reserve_target = {A:10000,B:4000,C:1000,D:0}`.

`recompute(merchant)` recalculates after any state change and appends tier-change events when tier changes.

> Tune the constants only if needed to match the seed table exactly; the table is the acceptance test.

---

## 4. Ledger (`lib/ledger.js`)

Credential payload (JSON, stable key order):
```json
{
  "v": 1,
  "issuer": "Settled",
  "issued_at": "<ISO>",
  "expires_at": "<ISO + 24h>",
  "nonce": "<16 hex>",
  "merchant": { "id": "m1", "name": "Northwind Audio", "domain": "northwind.audio", "country": "US" },
  "metrics": { "orders": 4812, "delivered_pct": 99.1, "as_described_pct": 99.4,
               "dispute_rate_pct": 0.29, "chargeback_rate_pct": 0.04,
               "avg_delivery_days": 3.2, "age_days": 1460 },
  "score": 91, "tier": "A", "fee_bps": 35, "cap": 5000, "reserve": 12500,
  "evidence_hash": "<sha256 of hash chain head>"
}
```
- Signature: `HMAC-SHA256` over `base64url(JSON.stringify(payload))` with a per-process secret (`crypto.randomBytes(32)`), hex or base64url. `alg: "HS256"`.
- Event hash chain: each event `hash = sha256(prev_hash + JSON.stringify(event_without_hash))`; first prev = "GENESIS".
- `verifyCredential(credential, signature)` → boolean (recompute HMAC + expiry + issuer).
- `POST .../verify` returns `{valid, checks:{signature, issuer, not_expired}, credential}`.

---

## 5. API (exact)

All responses JSON, `Content-Type: application/json`. Errors: HTTP 400/404/409 with `{ "error": { "code": "...", "message": "..." } }`.

### GET /api/health
`{ ok: true, mode: "sim" | "paypal", merchants: 3 }`

### GET /api/merchants
`{ merchants: [ publicMerchant ] }` where publicMerchant = id, name, domain, category, tier, score, fee_bps, cap, reserve, mode, metrics summary, products.

### GET /api/merchants/:id
`{ merchant, ledger: { credential, signature, alg: "HS256" }, events: [event...] }`

### GET /api/merchants/:id/ledger
`{ credential, signature, alg: "HS256" }`

### POST /api/merchants/:id/verify
`{ valid, checks: { signature: bool, issuer: bool, not_expired: bool }, credential }`

### GET /api/merchants/:id/events
`{ events }`

### POST /api/merchants/:id/orders
Body: `{ "product_id": "p1", "buyer": { "name": "Sam Rivera", "email": "sam@example.com" } }`
- 409 if merchant mode is `blocked`.
- Creates order: amount = product price, fee = round(amount * fee_bps / 10000, 2), protection `{ mode, cap }`.
- Sim payment id `SIM-<hex>` (or PayPal order id in live mode).
- Returns `{ order, payment: { mode, id, approval_url? }, receipt: { order_id, paid, captured_at, credential_hash }, event }`
- Order shape: `{ id: "ord_<hex>", merchant_id, product_id, product_name, amount, fee_bps, fee, protection: {mode, cap}, status: "paid", payment_id, buyer, created_at, delivered_at: null }`

### POST /api/orders/:orderId/fulfill
Marks delivered (only if status `paid`), updates merchant delivered count, returns `{ order, event }`. 409 if not paid.

### POST /api/orders/:orderId/claim
Body: `{ "reason": "not_delivered" | "not_as_described" | "damaged", "evidence": true }`
- 409 if order already `claimed`/`refunded`; 400 if `evidence !== true` or reason invalid.
- Refund = min(order.amount, protection.cap, merchant.reserve + pool) — use `min(order.amount, cap)`; pay from reserve, if reserve < refund then shortfall drawn from `network_pool` (starts 25000) and reported.
- Updates merchant: `dispute_rate_pct` numerator +1, reserve -= paid_from_reserve, recompute score/tier (may downgrade), append events (`claim`, `refund`, `reserve_change`, optional `tier_change`).
- Order → `status: "refunded"`.
- Returns `{ claim: { id, order_id, reason, status: "approved", refund, paid_from_reserve, paid_from_pool, reserve_before, reserve_after, created_at }, order, merchant: { id, tier, score, reserve, fee_bps, cap, mode }, events: [new events] }`

### POST /api/trust/verify
Body: `{ "merchant_id": "m1", "min_tier": "B" }` (`min_tier` optional, default `"C"`)
- Returns `{ verified, merchant_id, tier, score, cap, fee_bps, mode, reasons: [], credential, signature, checked_at }`
- `verified = valid signature && tier rank >= min_tier rank` (A>B>C>D). `reasons` lists failures.

### GET /api/orders?merchant=m1
`{ orders }` sorted newest first.

### GET /api/events?merchant=m1
`{ events }` sorted newest first (seq desc).

### POST /api/reset
Reseeds to seed state. `{ ok: true }`

### Static
`GET /` → `public/index.html`; `GET /store.html`, `/agent.html`, `/app.js`, `/styles.css`. Unknown static → 404. `/api/*` unknown → 404 JSON.

---

## 6. Optional live PayPal (`lib/paypal.js`)

- Env: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox|live` (default sandbox), `PAYPAL_LIVE=1` to enable. If not set → sim mode (default).
- `createOrder({ amount, currency:'USD', returnUrl })` → `{ id, approval_url }` via `POST /v2/checkout/orders` intent CAPTURE.
- `captureOrder(id)` → capture via `POST /v2/checkout/orders/{id}/capture`.
- Live mode in this prototype: create order, return approval URL to the frontend; capture endpoint `POST /api/paypal/capture` body `{ order_id }` calls capture and finalizes the order. If any call fails, return a clean 502 and do not corrupt state.
- **Sim mode is the demo path.** Live is documented, not required.

---

## 7. Frontend pages

Shared: `app.js` (api helper, money/pct formatting, toast, nav, copy JSON), `styles.css` (dark slate #0B1220, emerald #2BD9A0, gold #F5C451, cards, mono, responsive, no external fonts/images).

### `/` — Merchant dashboard
- Sidebar merchant switcher (m1/m2/m3), link to storefront (with `?merchant=`), agent console, reset.
- Header: merchant name/domain, tier badge, score dial (SVG ring), fee bps, protection cap, reserve, payment mode.
- Cards: Orders, Delivered %, As described %, Dispute rate, Chargeback rate, Avg delivery.
- **Signed ledger** panel: pretty JSON credential + signature, "Verify signature" button → shows valid + checks.
- Events timeline (latest 20) with type chips and hash prefix.
- Orders table (latest) with status + "Simulate delivery" / "Report a problem" actions.
- Everything from API; no hardcoded merchant data in HTML.

### `/store.html?merchant=m1` — Storefront
- Brand header, product card (name, price, description, simple inline SVG product art), trust panel: tier, score, "delivered on time", "protected up to $X", payment mode.
- "Buy with protection" → checkout modal: order summary, fee (merchant pays, buyer sees $0 fee), protection mode + cap, PayPal-style button. On confirm: POST order → receipt panel (order id, paid, captured, credential hash), confetti-free but animated success.
- After purchase: "Simulate delivery" and "Report a problem" buttons. Claim modal: reason select + evidence checkbox → POST claim → show instant refund animation, "Refunded $X from seller reserve in 1.2s", updated ledger/tier, shortfall note if any.
- Link to dashboard/agent.

### `/agent.html` — Agent trust console
- Merchant select + min tier select; "Run trust.verify" → JSON response panel + human summary (verified, tier, score, cap, reasons).
- "Buy as agent" button: if verified, POST order for that merchant's first product; show purchase result + receipt (agent id "agent_shopper_01").
- Event log of calls (client-side).
- Explain in one line: "This is the API an AI shopping agent would call before spending money."

### UI quality bar
Polished, not a wireframe: spacing, typography, hover states, skeleton/loading, error toasts, responsive ≥ 1024px primary. No emoji in body. No external network requests except none (sim mode). All amounts formatted `$1,234.56`, percents one decimal.

---

## 8. QA (`test/e2e.js`, no deps)

Spawn `node server.js` on port 4173 (or reuse if running), wait for `/api/health`, then assert:
1. merchants list = 3, m1 tier A.
2. m1 ledger signature verifies; tampering one field fails.
3. m1 order p1: amount 249, fee 0.87 (35bps), mode instant, cap 5000.
4. fulfill → delivered.
5. claim → refund 249, reserve decreases, merchant tier stays A (or recompute), order refunded; second claim → 409.
6. m3 order → mode escrow; claim with evidence false → 400.
7. trust/verify m1 min B → verified true; m3 min B → false with reason.
8. reset restores seed.
Print PASS/FAIL per test, exit 1 on failure. Kill server if spawned.

---

## 9. Acceptance

- `node server.js` starts, no warnings/errors.
- All pages render with data; no console errors.
- E2E passes.
- `node --check` passes on server and all JS.
- Screenshots: dashboard, storefront checkout, claim success, agent console.
- README documents run, API, what's real vs simulated, and how to enable live PayPal.
