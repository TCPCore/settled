# Inventory automation — pull, category rules, negotiation windows (frozen)

Goal: the merchant connects a source; the plugin pulls inventory automatically; the merchant defines rules per category/item; negotiation is only available inside the configured time window.

## 1. Connector (inventory pull)

`merchant.connector`:
```json
{
  "adapter": "feed",              // feed | json | csv | shopify | woocommerce
  "url": "https://merchant.example/catalog.json",
  "interval_seconds": 300,
  "enabled": true,
  "last_sync_at": "ISO|null",
  "last_status": "ok|error|never",
  "last_error": null,
  "last_counts": { "imported": 0, "updated": 0, "skipped": 0 }
}
```
- `GET /api/merchants/:id/connector` → `{connector, due_at, categories}`
- `PUT /api/merchants/:id/connector` body `{adapter,url,interval_seconds,enabled}`; validate URL http(s), interval 60–86400.
- `POST /api/merchants/:id/catalog/sync` → pull now; use adapter fetch; upsert; update connector status/counts; return `{connector, sync}`.
- Scheduler: server checks every 60s (`CONNECTOR_TICK_MS`), syncs connectors where enabled and `last_sync_at + interval` due; `unref()` timer; failures recorded, never crash.
- Adapters: `feed` pulls JSON URL; `json`/`csv` use `data` directly (manual sync only); Shopify/Woo payload adapters accepted but live OAuth remains roadmap.

On import/sync, each product's negotiation is **derived from the category rule** (fallback global 82%/95%).

## 2. Category rules (the merchant's policy)

`merchant.category_rules`:
```json
{
  "Audio": {
    "negotiable": true,
    "sell_min_pct": 0.82,
    "auto_accept_pct": 0.95,
    "publish_min_pct": 0.86,
    "max_discount_pct": 18,
    "window": { "from": "2026-11-06T00:00:00.000Z", "to": "2026-11-30T23:59:59.000Z" }
  }
}
```
- `GET /api/merchants/:id/rules` → `{rules, categories}`
- `PUT /api/merchants/:id/rules/:category` → validate: 0.5≤sell_min_pct<auto_accept_pct≤1, publish_min_pct≥sell_min_pct, max_discount 0–50, window ISO/null; returns `{rule, rules}`.
- `POST /api/merchants/:id/rules/apply` body `{category?}` → re-derive sell/publish/auto for existing products in category from current price + rule (keeps listed/negotiable/tems; clears item window if rule has one? set item window null to inherit).
- New items/imports inherit the category rule; item-level PATCH can override `sell_min/sell_max/publish_min/publish_max/auto_accept/window`.

## 3. Negotiation windows

- `product.negotiation.window = {from: ISO|null, to: ISO|null}`; product window overrides category rule window.
- Helper `effectiveWindow(product, merchant)`; `windowOpen(window, now)` true when now ≥ from (or null) and now ≤ to (or null).
- **Index/feed/categories** include only listed+negotiable items whose effective window is open. Feed items expose `negotiation_window` (public, no private prices).
- **Contract create** rejects closed window: `409 NEGOTIATION_WINDOW_CLOSED`.
- PATCH product accepts `window:{from,to}` (ISO/null).
- Merchant UI: category window (datetime-local) + per-product override; market shows "closes …".

## 4. UI

- Merchant console: **Inventory source** panel — adapter select, URL, interval, enabled, **Pull now**, last sync/status/errors; **Category rules** table — negotiable, sell_min %, auto_accept %, max_discount %, window from/to, Save, Apply to existing items; product cards get window override fields.
- Market: card shows "Negotiation open until …" when a window exists.
- Keep existing manual add/import; the connector is the automatic path.

## 5. Tests

- Connector PUT/GET validation, sync from a local JSON feed (import/update), scheduler not required in test.
- Category rule save/apply: new product inherits percentages; apply updates existing.
- Window: open included in index/feed, closed excluded; contract 409; reopen works.
- Product window override beats category.
- No private range leak; existing 78 tests green.
