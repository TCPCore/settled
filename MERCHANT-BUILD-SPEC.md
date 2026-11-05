# Build spec — merchant catalog, negotiation index, generic negotiate page (frozen)

Goal: make the plug-and-play product real: a merchant configures inventory + price ranges, the items appear in a category index, and any consumer agent can negotiate and pay.

## Data model (additive)

Every product gets `category` and `negotiation`:
```js
{
  id: 'p1', name: 'Aurora One headphones', price: 249, description: '...', category: 'Audio',
  negotiation: {
    negotiable: true,
    listed: true,                 // appears in the public index
    sell_min: 204,                // PRIVATE floor — never public
    sell_max: 249,                // PRIVATE ceiling — never public
    publish_min: 214,             // public "from" price (>= sell_min)
    publish_max: 249,             // public ceiling (<= sell_max); null = "from"
    auto_accept: 237,             // public-policy price used by the merchant agent
    max_discount_pct: 18,
    terms: { delivery_days: 3, returns_days: 30, warranty_months: 12 }
  }
}
```

Seed ranges (keep p1 exactly 204/237 for existing tests):
- p1 249: sell 204–249, publish 214–249, auto 237
- p2 129: sell 106–129, publish 112–129, auto 123
- p3 189: sell 155–189, publish 162–189, auto 180
- p4 79: sell 65–79, publish 68–79, auto 75
- p5 159: sell 131–159, publish 139–159, auto 151

`publicProduct(product)` strips `sell_min`, `sell_max`, `auto_accept`; exposes `negotiable`, `published_range`, `terms`.
`publicMerchant()` must use `publicProduct` so no private range leaks. Catalog endpoint may expose full `negotiation` (merchant view; prototype has no auth).

## API (server.js + lib/catalog.js)

- `GET /api/categories` → `{categories:[{id,name,count,min,max}], total}` from listed+negotiable products.
- `GET /api/index?category=&q=&budget=&merchant=&limit=50` → `{items, total, filters}`.
  Item: `{merchant:{id,name,tier,score,fee_bps,cap,mode,coverage}, product:{id,name,price,category,description}, published_range:{min,max}, terms, protection:{fee_bps,cap,mode}, negotiate_url:'/negotiate.html?merchant=m1&product=p1'}`.
  Filter: category exact (slug lowercase), q substring in name/merchant, budget >= published_range.min, merchant exact.
- `GET /api/merchants/:id/catalog` → `{merchant, products:[{...publicProduct, negotiation:{...full}}]}`.
- `POST /api/merchants/:id/catalog` body `{name, price, category, description, negotiation?}` → creates `p_<hex>`, default negotiation derived from price (sell_min=round(price*.82), auto=round(price*.95), publish_min=round(floor*1.05), max=price). Returns `{product, catalog}`.
- `PATCH /api/merchants/:id/catalog/:productId` body partial `negotiation` fields (or category/name/price) → validates and returns `{product, catalog}`.
  Validation: price>0; 0<sell_min<=sell_max<=price; sell_min<=publish_min<=publish_max<=sell_max (publish_max may be null); sell_min<=auto_accept<=sell_max; 0<=max_discount_pct<=50; terms positive; booleans.
- Contract create reads `product.negotiation`: `policy.floor=sell_min`, `policy.auto_accept=auto_accept`, `policy.max_discount_pct`, `terms` from config; if `negotiable===false` → 409 `PRODUCT_NOT_NEGOTIABLE`. Keep fallback defaults if no config (old data/tests).

## Frontend (three new pages; no external assets; use styles.css)

### `/merchant.html` + `/merchant.js` — demo-builder
- Header + nav; "Merchant agent setup" for m1.
- Load `GET /api/merchants/m1/catalog`.
- Table/cards per product: name, price, category; `negotiable` + `listed` toggles; inputs `sell_min/sell_max/publish_min/publish_max/auto_accept/max_discount_pct`; Save (PATCH); status toast.
- "Add product" form: name, price, category, description → POST; refresh.
- "Open index" and "Preview negotiation" links.
- Show a light "agent settings" card (agent name "Northwind Seller Agent", tone "consultative", policy note) — static, no backend needed.
- No floor leak in preview links.

### `/market.html` + `/market.js` — commerce-scout
- Hero "The negotiation index"; search input; category chips from `/api/categories`; budget input/slider; fetch `/api/index` with filters.
- Cards: merchant name/tier/score, product, list price, **published range** (not floor), protection bps/cap, terms, "Negotiate with agent" link to `/negotiate.html?merchant=...&product=...`.
- Empty state + count; no external assets.

### `/negotiate.html` + `/negotiate.js` — platform-scout
- Read `merchant`/`product` query params; fetch `GET /api/index?merchant=&q=` or catalog; render product + merchant trust + published range + protection.
- Agent passport card (a1 ProcureBot, operator, mandate input max default 500).
- **Start negotiation**: POST `/api/contracts` {merchant_id, product_id, buyer_agent_id:'a1', mandate:{max}} then POST `/api/contracts/:id/ai-auto`; render `ai.dialogue` (3 bubbles) + signed contract hash.
- **Pay (SIM)**: POST `/api/merchants/:id/orders` {product_id, buyer, contract_id, agent_id:'a1', simulate:true}; show order id/amount/payment id.
- **File claim**: POST `/api/orders/:id/claim` {reason:'not_delivered',evidence:true,use_ai:true}; show refund and reserve.
- Keep it one page, simple, judge-readable. No external assets.

## Nav (Lead)
Add `Market` (`market.html`) and `Merchant` (`merchant.html`) links to demo/index/store/agent/integrate pages.

## QA (red-team)
Append tests:
- T66 categories shape/counts.
- T67 index returns listed items, published_range, no `sell_min`/`sell_max`/`auto_accept` anywhere in the JSON.
- T68 index filters category/q/budget/merchant.
- T69 PATCH catalog updates range; index reflects; validation 400 on publish_min<sell_min.
- T70 contract uses product policy (p1 floor 204/auto 237) and 409 for negotiable=false.
- T71 `/merchant.html`, `/market.html`, `/negotiate.html` 200 and contain markers; existing 63 unchanged.
Run on fresh :4400; report.

## Acceptance
- `node --check` all JS; `npm test` ≥78/78.
- Merchant console edits persist in memory and index reflects.
- Generic negotiation page completes contract → SIM order → claim.
- No private range in any public JSON.
