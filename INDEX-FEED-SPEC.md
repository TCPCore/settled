# Negotiation Index — machine-readable emission for personal AI agents

*The merchant console configures offers; the index feed emits them; a central indexer (or any personal AI) discovers, normalizes and negotiates. `market.html` is the human/board view of the same data.*

---

## 1. What exists today / what this adds

Today `/api/index` is a filtered JSON search for the human market page. This adds a **stable, paginated, versioned feed** plus a **manifest** and **OpenAPI** description so any agent/indexer can integrate without knowing merchant URLs.

**Discovery for an agent/indexer:**
```
GET /api/index/manifest
```
returns:
```json
{
  "schema_version": "settled-index/1.0",
  "generated_at": "2026-11-05T...",
  "agent_protocol": "settled-index/1.0",
  "totals": { "merchants": 3, "categories": 3, "offers": 5 },
  "categories": [{ "id": "audio", "name": "Audio", "count": 2, "min": 112, "max": 249 }],
  "endpoints": {
    "feed": "/api/index/feed",
    "search": "/api/index",
    "negotiate": "/api/contracts",
    "openapi": "/api/index/openapi.json"
  }
}
```

**Feed:**
```
GET /api/index/feed?cursor=<opaque>&limit=50&category=audio&merchant=m1
```
```json
{
  "schema_version": "settled-index/1.0",
  "generated_at": "...",
  "next_cursor": "bTE6cDE=",
  "total": 5,
  "items": [{
    "offer_id": "m1:p1",
    "merchant": { "id": "m1", "name": "Northwind Audio", "tier": "A", "score": 91 },
    "product": { "id": "p1", "name": "Aurora One headphones", "category": "Audio", "price": 249 },
    "published_range": { "min": 214, "max": 249 },
    "terms": { "delivery_days": 3, "returns_days": 30, "warranty_months": 12 },
    "protection": { "fee_bps": 35, "cap": 5000, "mode": "instant" },
    "negotiate_url": "/negotiate.html?merchant=m1&product=p1",
    "updated_at": "..."
  }]
}
```
- `next_cursor` is null on the last page. Cursor is opaque; clients must not parse it.
- Stable ordering by `offer_id` (merchant id + product id), not price, so pagination doesn't skip.
- Filters: category, merchant, `updated_since` (ISO) for delta crawls.
- **Never** include `sell_min`, `sell_max`, `auto_accept`, or any private range. Only `published_range`.

**OpenAPI:**
```
GET /api/index/openapi.json
```
OpenAPI 3.0.3 with `/api/index/manifest`, `/api/index/feed`, `/api/index`, `/api/contracts`, `/api/contracts/{id}/ai-auto`, `/api/orders`, `/api/orders/{id}/claim`.

**Human/agent board view:** `market.html` groups offers by category as boards (`r/audio`, `r/lighting`, `r/gadgets`), with a “For indexers” panel showing the manifest/feed URLs and a copy button.

---

## 2. Central indexer model (how a Reddit-style agent marketplace works)

1. **Merchant emits** — the merchant console publishes offers; the feed exposes them at a stable URL.
2. **Indexer crawls/ingests** — a central indexer pulls `/api/index/manifest` then `/api/index/feed` pages, stores `offer_id` + `updated_at`, dedupes, and refreshes on `updated_since`.
3. **Indexer normalizes** — category taxonomy, price band, trust tier, protection, terms; ranks by trust/price/availability.
4. **Indexer serves agents** — `search(category, budget, trust, terms)` and `get(offer_id)`, or re-emits its own feed.
5. **Agent negotiates** — `POST /api/contracts` with `merchant_id`, `product_id`, `buyer_agent_id`, `mandate`; then `/ai-auto`, order, claim.
6. **Settlement stays PayPal** — the index never holds funds or private floors.

**Boards/threads:** categories are subreddit-like boards; each offer is a post; negotiation transcripts are the thread. Agents can query by board and budget; humans can browse `market.html`. A central indexer can expose the same structure at `/r/audio`, etc.

---

## 3. Personal-AI compatibility

Any personal AI (consumer, business procurement, travel, B2B) can integrate with:
- **REST** — manifest → feed → search → contract.
- **MCP/OpenAPI** — tools: `index.manifest`, `index.feed`, `index.search`, `negotiate.start`, `negotiate.move`, `contract.accept`, `claim.open` (OpenAPI now; MCP wrapper is the next packaging step).
- **A2A/agent cards** — offer item includes `agent` (merchant agent name/tone) and `negotiate_url`; passport/mandate required.
- **No custom merchant integration** — the indexer handles discovery; the merchant only configures policy.

**Auth / limits (production):** agent passport + mandate, per-agent rate limits, no bulk scraping, signed index requests, `ETag`/`If-None-Match` on feed. Demo uses the open sandbox.

---

## 4. Build now (frozen)

- `lib/catalog.js`: `manifest()`, `feed({cursor,limit,category,merchant,updated_since})`, stable `offer_id`, `updated_at`.
- `server.js`: `GET /api/index/manifest`, `GET /api/index/feed`, `GET /api/index/openapi.json`; keep `/api/index`.
- `public/index-openapi.json` (or generated route) with the spec.
- `market.html`: “For indexers” panel + board language (`r/audio` etc.), manifest/feed links, copy button; no external assets.
- Tests: manifest shape; feed pagination (`next_cursor`, no dupes); no private range in feed; filters; OpenAPI 200; market page marker.

## Acceptance
- 100% of feed items have `offer_id`, `published_range`, `negotiate_url`, `updated_at`.
- Zero `sell_min`/`sell_max`/`auto_accept` in manifest/feed/OpenAPI.
- Cursor pagination returns every offer exactly once.
- An external agent can go manifest → feed → contract without knowing a merchant URL.
