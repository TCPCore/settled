# Adapter layer — inventory in, indexer out, agents in (frozen)

Goal: any merchant can publish inventory from any source, any indexer can consume it, any personal AI can query/negotiate, and any storefront can hand off checkout. One registry, one feed, one agent manifest.

## 1. Adapter registry

`GET /api/adapters`
```json
{
  "schema_version": "settled-adapters/1.0",
  "inventory": [
    {"id":"csv","name":"CSV upload","mode":"push","status":"ready"},
    {"id":"json","name":"JSON payload","mode":"push","status":"ready"},
    {"id":"shopify","name":"Shopify product payload","mode":"payload","status":"ready"},
    {"id":"woocommerce","name":"WooCommerce product payload","mode":"payload","status":"ready"},
    {"id":"feed","name":"Remote JSON feed","mode":"pull","status":"ready"}
  ],
  "agents": [
    {"id":"rest","name":"REST / OpenAPI","mode":"rest","status":"ready"},
    {"id":"mcp","name":"MCP tool server","mode":"mcp","status":"roadmap"},
    {"id":"a2a","name":"A2A agent card","mode":"a2a","status":"roadmap"}
  ],
  "checkout": [
    {"id":"hosted","name":"Hosted negotiated checkout","mode":"hosted","status":"ready"},
    {"id":"paypal-button","name":"PayPal button at agreed amount","mode":"paypal","status":"ready"},
    {"id":"shopify-plugin","name":"Shopify cart/draft order plugin","mode":"plugin","status":"roadmap"},
    {"id":"woocommerce-plugin","name":"WooCommerce cart plugin","mode":"plugin","status":"roadmap"}
  ]
}
```

## 2. Inventory import / sync

`POST /api/merchants/:id/catalog/import`
Body one of:
```json
{"adapter":"csv","data":"sku,name,price,category,...\nAURORA-ONE,Aurora One,249,Audio,..."}
{"adapter":"json","data":{"products":[...]}}
{"adapter":"shopify","data":{"products":[{"id":1,"title":"...","variants":[{"price":"249.00","sku":"..."}],"product_type":"Audio","body_html":"..."}]}}
{"adapter":"woocommerce","data":{"products":[{"id":1,"name":"...","price":"249","sku":"...","categories":[{"name":"Audio"}],"description":"..."}]}}
{"adapter":"feed","url":"https://merchant.example/catalog.json"}
```
- Normalizes to catalog products: `name`, `price`, `category`, `description`, optional `negotiation` (defaults derived from price: sell_min=round(price*.82), auto=round(price*.95), publish_min=round(sell_min*1.05), publish_max=price).
- Upsert by `sku`/id; returns `{adapter, imported, updated, skipped, products, errors}`.
- CSV headers accepted: `sku|id, name|title, price, category|product_type, description|body_html, sell_min, sell_max, publish_min, publish_max, auto_accept, max_discount_pct, negotiable, listed`. Quoted CSV supported.
- `feed` fetch: 5s timeout, JSON array or `{products}`, no private ranges from remote unless provided; production allowlist.
- Shopify/Woo are **payload adapters** today (no OAuth); live app connectors are the next packaging step.
- `POST /api/merchants/:id/catalog/sync` is an alias with `{source:{adapter,...}}`.

## 3. Indexer emission (see `INDEX-FEED-SPEC.md`)

- `GET /api/index/manifest`
- `GET /api/index/feed?cursor=&limit=&category=&merchant=&updated_since=`
- `GET /api/index/openapi.json`
- Stable `offer_id = merchantId:productId`, `next_cursor`, `updated_at`, no private range.

## 4. Agent manifest (any personal AI)

`GET /api/agent-manifest` (also `/.well-known/settled-agent.json`)
```json
{
  "schema_version": "settled-agent/1.0",
  "name": "Settled",
  "description": "PayPal merchant negotiation index and assurance layer",
  "auth": "agent_passport+mandate",
  "endpoints": {
    "manifest": "/api/index/manifest",
    "feed": "/api/index/feed",
    "search": "/api/index",
    "negotiate": "/api/contracts",
    "auto": "/api/contracts/{id}/ai-auto",
    "order": "/api/merchants/{id}/orders",
    "claim": "/api/orders/{id}/claim"
  },
  "tools": [
    {"name":"index.manifest","endpoint":"GET /api/index/manifest"},
    {"name":"index.feed","endpoint":"GET /api/index/feed"},
    {"name":"index.search","endpoint":"GET /api/index"},
    {"name":"negotiate.start","endpoint":"POST /api/contracts"},
    {"name":"negotiate.auto","endpoint":"POST /api/contracts/{id}/ai-auto"},
    {"name":"order.create","endpoint":"POST /api/merchants/{id}/orders"},
    {"name":"claim.open","endpoint":"POST /api/orders/{id}/claim"}
  ]
}
```

## 5. UI

- `market.html`: “For indexers” panel with manifest/feed/OpenAPI URLs + copy buttons; board language `r/audio`, `r/lighting`, `r/gadgets`; keep cards.
- `merchant.html`: “Import catalog” panel: adapter select (CSV/JSON/Shopify/Woo/feed), textarea/file input or URL, Import button → POST import; show imported/updated/errors; refresh catalog; adapter status list.

## 6. Tests
- `GET /api/adapters` registry shape.
- `GET /api/index/manifest` + feed pagination; `next_cursor`; no duplicates; no private range.
- import CSV/JSON/Shopify/Woo payloads; invalid adapter 400; feed URL failure 502/400.
- agent manifest shape; OpenAPI 200.
- market/merchant page markers.
- Existing 69 tests green.
