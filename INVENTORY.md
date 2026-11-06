# Inventory automation — connector pull, category rules, negotiation windows

*How a merchant's inventory gets in automatically, how their policy turns a list price into a negotiation range, and how a time window decides whether negotiation is available at all. Written against the frozen [INVENTORY-AUTOMATION-SPEC.md](INVENTORY-AUTOMATION-SPEC.md); [ADAPTERS.md](ADAPTERS.md) covers the manual import payloads and the machine-readable index feed.*

**One line:** a merchant connects a source once → the plugin pulls the catalog on an interval → the category rule derives every item's private range and public range → the item is negotiable only inside its effective time window.

Zero dependencies, same as the rest of the app. State is in memory and `POST /api/reset` restores the seed (connectors are present but **disabled**, category rules are always-open).

| Piece | Code | What it does |
|---|---|---|
| Connector | `lib/connectors.js` | Saves the source config, pulls/syncs it, records status + counts, runs the scheduler |
| Category rules | `lib/catalog.js` + `lib/data.js` | Per-category policy: sell/publish/auto-accept percentages, max discount, window |
| Windows | `lib/data.js` (`effectiveWindow`, `windowOpen`) + `lib/catalog.js` | Public visibility and the contract gate |
| Routes | `server.js` | `/connector`, `/catalog/sync`, `/rules`, `/rules/apply`, `PATCH catalog/:product` |
| UI | `public/merchant.html` + `merchant.js`, `public/market.html` + `market.js` | Inventory source, category-rules table, per-product window, "Open until" badge |
| Tests | `test/e2e.js` T81–T84 | Connector pull from a real local HTTP feed, rules apply/inheritance, window 409, UI markers/privacy |

---

## 1. Connector — where inventory comes from

`merchant.connector`:

```json
{
  "adapter": "feed",
  "url": "https://merchant.example/catalog.json",
  "interval_seconds": 300,
  "enabled": false,
  "last_sync_at": null,
  "last_status": "never",
  "last_error": null,
  "last_counts": { "imported": 0, "updated": 0, "skipped": 0 }
}
```

- `adapter` — one of `feed`, `json`, `csv`, `shopify`, `woocommerce`.
  Only **`feed`** is pulled unattended; the others are manual-push adapters that need a payload.
- `url` — the feed URL; must be `http(s)` and is required whenever a pull can happen.
- `interval_seconds` — scheduler interval, **60–86400** (default 300).
- `enabled` — only enabled `feed` connectors are picked up by the scheduler.
- `last_sync_at` / `last_status` (`ok|error|never`) / `last_error` / `last_counts` — bookkeeping written by every pull; `PUT` never changes it.

### Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/merchants/:id/connector` | `{connector, due_at, categories}` — `due_at` is the next ISO instant (or `null` when disabled), `categories` is the category names usable as rule keys |
| `PUT /api/merchants/:id/connector` | Body `{adapter?, url?, interval_seconds?, enabled?}` — a **partial** update merged over the current config; returns the same `{connector, due_at, categories}` |
| `POST /api/merchants/:id/catalog/sync` | Pull **now** with the saved source (or a body override) and return `{connector, sync}` |

`PUT` validation (each failure is a `400 {error:{code,message}}`):

| Field | Rule | Error code |
|---|---|---|
| `url` | `http://` or `https://` | `INVALID_URL` |
| `interval_seconds` | integer-ish number, 60 ≤ n ≤ 86400 | `INVALID_INTERVAL` |
| `enabled` | boolean | `INVALID_CONNECTOR` |
| `adapter` | one of the five adapters | `INVALID_ADAPTER` |

### Pulling — `POST .../catalog/sync`

With `adapter: "feed"` the server fetches `connector.url` with a hard **5 s timeout**, accepts either a top-level JSON array or `{ "products": [...] }`, normalizes every row through the same adapter layer as manual import, and **upserts by `sku`** (a row with no `sku` always creates a new item). The response carries the refreshed connector and the import result:

```json
{
  "connector": {
    "adapter": "feed", "url": "https://merchant.example/catalog.json",
    "interval_seconds": 300, "enabled": true,
    "last_sync_at": "2026-11-05T19:46:02.117Z", "last_status": "ok",
    "last_error": null,
    "last_counts": { "imported": 2, "updated": 1, "skipped": 0 }
  },
  "sync": {
    "adapter": "feed", "imported": 2, "updated": 1, "skipped": 0,
    "counts": { "imported": 2, "updated": 1, "skipped": 0 },
    "products": [ "…merchant catalog view…" ],
    "errors": []
  }
}
```

- **Imported/updated/skipped** are counted per row. A row that fails validation (no name, non-positive price, an invalid explicit range) increments `skipped` and adds an entry to `errors[]`; the rest of the feed still imports.
- The body may override the saved source for one call: `{ "url": "…" }`, `{ "adapter": "json", "data": { "products": [ … ] } }`, or `{ "source": { "adapter": "…", "url"/"data": … } }`. `json`/`csv`/`shopify`/`woocommerce` are **manual-only** — a sync for them without `data` is a `400 INVALID_REQUEST`.
- `POST /api/merchants/:id/catalog/import` is the same import path with an explicit `{adapter, data|url}` body (see [ADAPTERS.md](ADAPTERS.md)); both import and sync derive negotiation config from the merchant's **category rule**.

### Scheduler

The server starts a timer on boot (`connectors.startScheduler()`), every `CONNECTOR_TICK_MS` ms (**default 60 000**, minimum override 1 000 via env):

- one pass at a time (a `ticking` guard prevents overlap);
- only `enabled: true` **and** `adapter: "feed"` connectors are considered, and only when `last_sync_at + interval_seconds` is due (a never-synced enabled connector is due immediately);
- each merchant is isolated: a failed pull is recorded (`last_status: "error"`, `last_error`, zeroed `last_counts`) and swallowed — **the tick never crashes the process**;
- the timer is `unref()`'d, so it never keeps `node` alive at shutdown.

The scheduler is not required for the tests: T81 drives `POST /catalog/sync` directly against a tiny local HTTP feed spawned inside the test.

---

## 2. Category rules — the merchant's policy

`merchant.category_rules` is keyed by category name. The seed gives each merchant one always-open rule (`Audio` for m1, `Lighting` for m2, `Gadgets` for m3):

```json
{
  "Audio": {
    "negotiable": true,
    "sell_min_pct": 0.82,
    "auto_accept_pct": 0.95,
    "publish_min_pct": 0.86,
    "max_discount_pct": 18,
    "window": { "from": null, "to": null }
  }
}
```

| Field | Meaning | Validation |
|---|---|---|
| `negotiable` | Whether new items in this category are negotiable | boolean |
| `sell_min_pct` | Private floor as a fraction of list price | `0.5 ≤ sell_min_pct < auto_accept_pct ≤ 1` |
| `auto_accept_pct` | Price the merchant agent accepts immediately | `> sell_min_pct`, `≤ 1` |
| `publish_min_pct` | Public `published_range.min` as a fraction of list price | `≥ sell_min_pct` |
| `max_discount_pct` | Human-readable discount cap, 0–50 | `0 ≤ n ≤ 50` |
| `window` | Default negotiation window for items in this category | `{from,to}` ISO-8601 or `null`; `from ≤ to` |

If a category has no rule, the **global fallback** is 82 % / 95 % / 86 % / 18 % with no window (`lib/data.js` → `DEFAULT_CATEGORY_RULE`).

### Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/merchants/:id/rules` | `{rules, categories}` — rules keyed by category, plus every usable category name (rule keys + product categories, sorted) |
| `PUT /api/merchants/:id/rules/:category` | Partial rule body merged over the existing rule; returns `{rule, rules}` |
| `POST /api/merchants/:id/rules/apply` | Re-derive existing items; body `{category?}` limits it to one category; returns `{category, applied, updated, skipped, errors, rules, products}` |

`PUT` is a merge, so a client can send only the fields it changed. Category lookup is case-insensitive/slug-aware (`audio` addresses the `Audio` rule). All validation failures are `400 INVALID_RULE` (or `400 INVALID_WINDOW` for a bad window).

### What "apply" recomputes

For each existing product in scope, from its **current list price** `p` and the rule:

```
sell_min     = max(1, round(p × sell_min_pct))
sell_max     = p
publish_min  = clamp(round(p × publish_min_pct), sell_min, p)
publish_max  = p
auto_accept  = clamp(round(p × auto_accept_pct), sell_min, p)
max_discount_pct = rule.max_discount_pct
window       = null          // drop the item override -> inherit the category window
```

It **preserves** the merchant's non-price choices (`listed`, `negotiable`, `terms`) and skips a product whose re-derived config would not validate (recorded in `errors[]`, never a 500). `apply` without `category` walks every product using its own category rule.

### Inheritance

New products created with `POST /api/merchants/:id/catalog`, and every product coming in through **import or connector sync**, derive their negotiation config from the category rule:

- no explicit negotiation columns in the payload → `deriveNegotiation(price, rule)` (category rule, else global fallback);
- explicit adapter columns win, but unsupplied fields are inherited then clamped so a price move can never strand a bound outside the valid band;
- an item-level `PATCH` can still override `sell_min`, `sell_max`, `publish_min`, `publish_max`, `auto_accept` and `window`.

Changing the rule does **not** rewrite existing products by itself — that is exactly what `apply` is for.

---

## 3. Negotiation windows — when negotiation is available

A product may carry an item-level window:

```json
{ "negotiation": { "window": { "from": "2026-11-06T00:00:00.000Z", "to": "2026-11-30T23:59:59.000Z" } } }
```

**Effective window precedence** (`data.effectiveWindow(product, merchant)`):

1. the product's own `negotiation.window` if it is an object (item override);
2. otherwise the category rule's `window` (`merchant.category_rules[product.category]`);
3. otherwise `null` → **always open**.

A window is open when `now ≥ from` **and** `now ≤ to`; a `null`/missing bound is unbounded on that side (`data.windowOpen`). A window whose `from` is in the future is therefore *not* open yet.

### What a closed window changes

- `GET /api/index`, `GET /api/index/feed` and `GET /api/categories` **exclude** products whose effective window is closed — the item is invisible to buyers/indexers, not just un-negotiable.
- `POST /api/contracts` on a closed item returns **`409 NEGOTIATION_WINDOW_CLOSED`** (checked before the contract is created, with the window end in the message when one exists).
- The feed and index expose the **public** window as `negotiation_window: {from, to}` (or `null`) so the market can render "Open until …" / "Opens …". It carries no prices.
- `PATCH /api/merchants/:id/catalog/:productId` accepts a top-level `window`, or `negotiation.window`, as `{from, to}` with ISO/null values. **`window: null` clears the override** so the product inherits its category window again.
- `POST .../rules/apply` also clears each item's override (`window: null`), so items fall back to the rule's window.

### UI path

- **Merchant console** — `/merchant.html`:
  - **Inventory source** panel: adapter select (feed / JSON / CSV; Shopify and WooCommerce are labelled payload/OAuth-roadmap), source URL, interval, auto-pull toggle, **Pull now**, and last sync / status / counts / error.
  - **Category rules** panel: a row per category with negotiable, sell-min %, auto-accept %, max-discount %, window **from/to** (`datetime-local`), **Save** (`PUT /rules/:category`) and **Apply to existing items** (`POST /rules/apply`).
  - **Product cards** carry a per-item **window override** (from/to); leaving it blank sends `window: null` to inherit the category window.
- **Market** — `/market.html`: cards show a compact `Open until <date/time>` badge, or `Opens <date>` when the window has not started. Closed items never reach the market at all (the API filters them), so there is no "closed" state to render.

---

## 4. Agent-assisted setup — no one-by-one product entry

The merchant's own agent can read the catalog, derive the policy and add products from a brief. Manual one-by-one entry is an **advanced fallback only** (the `POST /catalog` API stays; the UI form is gone).

### `POST /api/merchants/:id/agent/autoconfigure`

Ensures a `category_rules` entry exists for **every product category** (default `82 / 95 / 86 / 18`, always-open window) and then applies the rules to all products — the same re-derivation as `POST /rules/apply`. **No network, idempotent** (a second call adds nothing and leaves the ranges identical), so it is safe to hit after every import/sync or when a new category appears.

```json
{
  "merchant_id": "m1",
  "categories": ["Accessories", "Audio"],
  "updated": 3,
  "skipped": 0,
  "rules": { "Audio": { "…": "…" }, "Accessories": { "…": "…" } },
  "products": [ "…merchant catalog view…" ],
  "ai": { "used": false, "provider": "none", "model": null },
  "configured": 1
}
```

`updated` counts **products applied**, `configured` counts rules created by that call (0 on the re-run). `ai.used` is always `false`: this is deterministic policy work, not a model call.

### `POST /api/merchants/:id/agent/catalog`

Body `{ "brief": "what the merchant sells", "count": 3 }` — `count` defaults to 3, is clamped to **1–8**, and the brief is required (trimmed, max 1 000 chars sent to the model).

- **One model call** (`ai.draftCatalog`) asks for `{products:[{name,price,category,description}]}`. The prompt carries only **public** merchant context (`id`, `name`, `domain`, `category`), the brief, the count and the merchant's category names — never reserve/floor/auto-accept data.
- **Deterministic fallback:** with no AI key (or an AI error) it drafts 3 sensible category-appropriate products with `ai.used:false`, `ai.error:'ai_disabled'` (or the error message). The demo works identically without a key.
- The server **validates and creates each draft** through `catalog.createProduct`, so every product **inherits its category rule** and is immediately in the merchant catalog and the public index (when its window is open).
- Invalid items are skipped and reported in `errors[]`; the response is `{merchant_id, brief, requested, created, products, ai:{used,provider,model,error?}, errors?}`.

Failure responses: empty/whitespace/missing `brief` → `400 INVALID_BRIEF`; non-numeric `count` → `400 INVALID_COUNT`.

### UI path

- **Merchant console** — `/merchant.html`, **Agent setup** panel above the catalog:
  - status line (“Northwind Seller Agent · N products · N categories · policy configured”);
  - **Auto-configure catalog** → `POST /agent/autoconfigure`, showing updated/skipped/rules;
  - **Describe what you sell** textarea + example chips, **Add with agent** → `POST /agent/catalog` `{brief, count:3}`, showing the created products and refreshing the catalog;
  - note: the agent reads the catalog and applies category rules, and any item can still be tuned below.
- The manual **Add product** form is removed from the main page; the `POST /api/merchants/:id/catalog` endpoint remains for advanced/scripted use.
- The demo console (`/demo.html`) has a compact **Merchant agent setup** strip (Auto-configure + link to the console) where implemented.

### Curl

```bash
# ensure a rule per category + apply policy to everything (idempotent)
curl -s -X POST $BASE/api/merchants/m1/agent/autoconfigure | python3 -m json.tool

# draft 3 products from a brief (deterministic fallback without an AI key)
curl -s -X POST $BASE/api/merchants/m1/agent/catalog \
  -H 'content-type: application/json' \
  -d '{"brief":"Warm designer lamps and dimmable bulbs for a reading corner","count":3}' \
  | python3 -m json.tool

# validation: an empty brief is a 400
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/merchants/m1/agent/catalog \
  -H 'content-type: application/json' -d '{"brief":"  "}'
# -> 400 INVALID_BRIEF
```

---

## 5. Curl quickstart

```bash
BASE=http://127.0.0.1:4173

# 1. read the connector (seeded, disabled)
curl -s $BASE/api/merchants/m1/connector | python3 -m json.tool

# 2. point it at a real JSON feed and enable the pull
curl -s -X PUT $BASE/api/merchants/m1/connector \
  -H 'content-type: application/json' \
  -d '{"adapter":"feed","url":"https://merchant.example/catalog.json","interval_seconds":300,"enabled":true}' \
  | python3 -m json.tool

# 3. pull now (or just wait for the 60s scheduler tick)
curl -s -X POST $BASE/api/merchants/m1/catalog/sync | python3 -m json.tool
# -> {"connector":{"last_status":"ok","last_counts":{...},"last_sync_at":"..."},"sync":{...}}

# 4. inspect / change the Audio policy
curl -s $BASE/api/merchants/m1/rules | python3 -m json.tool
curl -s -X PUT $BASE/api/merchants/m1/rules/Audio \
  -H 'content-type: application/json' \
  -d '{"sell_min_pct":0.80,"auto_accept_pct":0.90,"publish_min_pct":0.85,"max_discount_pct":20}' \
  | python3 -m json.tool

# 5. re-derive existing Audio items from their current prices
curl -s -X POST $BASE/api/merchants/m1/rules/apply \
  -H 'content-type: application/json' -d '{"category":"Audio"}' \
  | python3 -m json.tool

# 6. close p1's item window (a past `to`), then reopen it (a future `to`)
curl -s -X PATCH $BASE/api/merchants/m1/catalog/p1 \
  -H 'content-type: application/json' \
  -d '{"window":{"from":null,"to":"2020-01-01T00:00:00.000Z"}}' | python3 -m json.tool

# 7. a closed window is a 409 on contract creation
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/api/contracts \
  -H 'content-type: application/json' \
  -d '{"merchant_id":"m1","product_id":"p1","buyer_agent_id":"a1"}'
# -> 409  {"error":{"code":"NEGOTIATION_WINDOW_CLOSED", ...}}

# reopen -> 200 and the item is back in the index/feed
curl -s -X PATCH $BASE/api/merchants/m1/catalog/p1 \
  -H 'content-type: application/json' \
  -d '{"window":{"from":null,"to":"2030-01-01T00:00:00.000Z"}}' | python3 -m json.tool
curl -s "$BASE/api/index?merchant=m1" | python3 -m json.tool   # p1 listed again

# clear the item override -> inherit the category window
curl -s -X PATCH $BASE/api/merchants/m1/catalog/p1 \
  -H 'content-type: application/json' -d '{"window":null}' | python3 -m json.tool
```

A feed for the pull adapter is any JSON array or `{ "products": [...] }` of rows shaped like the import rows (`sku`, `name`, `price`, `category`, `description`; optional negotiation columns).

---

## 6. Privacy — the private range still never leaves the server

The connector does not change the public/private split:

- the feed (`/api/index/feed`), index (`/api/index`), manifest and categories expose only `published_range` and the public `negotiation_window` — **never** `sell_min`, `sell_max` or `auto_accept`;
- the merchant-only catalog view (`GET /api/merchants/:id/catalog`) and the connector/rules endpoints are the merchant console's private surface;
- T84 scans the market assets and the public endpoints for the private keys; T73/T67 do the same for the feed and index. No patch to the connector or rules layer is allowed to open that hole.

**SSRF guard:** connector fetches reject loopback, RFC1918, link-local and `.local` hosts by default; `CONNECTOR_ALLOW_PRIVATE=1` is for local test feeds only. Redirects are not followed. A production connector should also pin DNS and use an allowlist.

---

## 7. Failure handling

| Failure | Behaviour |
|---|---|
| Feed URL not `http(s)` | `400 INVALID_URL` on `PUT`/sync; nothing is pulled |
| Feed returns non-2xx or non-JSON, or times out after 5 s | sync fails with `502 ADAPTER_FETCH_FAILED`; connector becomes `last_status:"error"`, `last_error:"…"`, counts zeroed; the server stays up |
| Individual row is invalid | row counted in `skipped` + an entry in `sync.errors[]`; every other row still imports |
| Scheduler pull fails | recorded on that merchant's connector and swallowed; the next tick retries when due |
| Manual-only adapter synced without `data` | `400 INVALID_REQUEST` with an explanation |
| Unknown merchant / category | `404 MERCHANT_NOT_FOUND` / `404 RULE_NOT_FOUND` |
| Rule fails validation | `400 INVALID_RULE` / `400 INVALID_WINDOW`; the previous rule is unchanged |
| Bad `PATCH` window | `400 INVALID_WINDOW` (`{error:{code,message}}`); the item is unchanged |
| Agent catalog: empty/whitespace/missing `brief` | `400 INVALID_BRIEF`; nothing is created |
| Agent catalog: `count` not a number | `400 INVALID_COUNT`; `count` is clamped to 1–8 otherwise |
| AI unavailable or model error | deterministic 3-product fallback with `ai.used:false` and `ai.error`; the endpoint still succeeds |
| Invalid drafted item | skipped and reported in `errors[]`; the valid drafts are still created |
| Reset | `POST /api/reset` restores seed connectors (disabled, `never`), seed rules (always-open) and drops imported/agent-created inventory |

---

## 8. What is real, and what is roadmap

**Real now:** connector config + validation, on-demand sync from a live HTTP JSON feed, upsert by sku, status/counts/error bookkeeping, the 60 s best-effort scheduler, per-category rules with validation, apply-to-existing re-derivation, inheritance for new/imported items, effective windows with item override, index/feed/categories filtering, the `409 NEGOTIATION_WINDOW_CLOSED` gate, the merchant/market UI, and **agent-assisted setup** (idempotent autoconfigure + agent-drafted products with a deterministic fallback).

**Payload-only, no OAuth:** the `shopify` and `woocommerce` adapters accept a product payload (first variant price/sku, product type/category) and are honestly labelled *payload adapters* in the registry and the merchant UI. Live app installs are roadmap, not shipped.

**Roadmap (honest):**

- Shopify / WooCommerce **OAuth app connectors** (install flow, scoped tokens, webhook `products/update` push instead of polling).
- Per-connector auth headers/secret storage and credential rotation.
- Delta sync / inventory-level sync (`updated_since` on the pull side) instead of full-feed upserts.
- Retry with backoff, jitter and dead-lettering for the scheduler; per-connector observability.
- Durable persistence (today state is in memory, so a restart returns to seed).
- CSV/JSON sources are manual-sync only; a hosted "upload on a schedule" path would need storage.
- Agent setup: draft proposals shown as a review/diff before creation, per-item accept/reject, and using live sales/inventory signals (today the draft sees only the brief + public merchant context).

---

## 9. Tests and references

- **QA:** `test/e2e.js` — T81 (connector GET/PUT + sync from a local HTTP feed, import/update/upsert, success + failure bookkeeping), T82 (rule validation, apply re-derivation, new/imported item inheritance), T83 (open → closed → 409 → reopen; product override beats category), T84 (merchant/market UI markers + no private-range leak), T85 (autoconfigure ensures + applies rules, idempotent, no AI), T86 (agent catalog 3-product fallback, rule inheritance, empty-brief 400, count cap), T87 (Agent setup UI markers, no manual Add product). See [test/README.md](test/README.md).
- **Contracts:** [INVENTORY-AUTOMATION-SPEC.md](INVENTORY-AUTOMATION-SPEC.md) (frozen), [ADAPTER-SPEC.md](ADAPTER-SPEC.md), [INDEX-FEED-SPEC.md](INDEX-FEED-SPEC.md).
- **Manual import payloads / index out:** [ADAPTERS.md](ADAPTERS.md).
- **Contracts:** [AGENT-SETUP-SPEC.md](AGENT-SETUP-SPEC.md) (agent-assisted setup, frozen).
- **Run it:** `node server.js` → `/merchant.html` (Agent setup + Inventory source + Category rules + per-product window) → `/market.html` (window badges). `POST /api/reset` between demos.
