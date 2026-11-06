# Agent-assisted merchant setup (frozen)

Goal: no one-by-one product entry. The merchant's agent reads the catalog, derives category rules, windows and policy, and can add products from a brief. Manual add is an advanced fallback only.

## Backend

### `POST /api/merchants/:id/agent/autoconfigure`
- Ensure a `category_rules` entry exists for every product category (default 82/95/86/18, window null).
- Apply rules to all products (reuse `catalog.applyRules`).
- Return `{merchant_id, categories, updated, skipped, rules, products, ai:{used:false}}`.
- Idempotent; no network.

### `POST /api/merchants/:id/agent/catalog`
Body `{brief:string, count?:number}` (default 3, max 8).
- AI drafts `{products:[{name,price,category,description}]}` from the brief + merchant context; one model call; fallback deterministic 3 products if AI unavailable/error.
- Server validates and creates each via `catalog.createProduct` (category rule inheritance).
- Return `{created, products, ai:{used,provider,model,error?}}`.
- Reject empty brief 400; cap count; no private data in prompt.

### `lib/ai.js`
Add `draftCatalog({merchant, brief, count, categories})` — JSON response, `used` semantics same as other AI functions; deterministic fallback names/prices/categories.

## UI

### Merchant console (`/merchant.html`)
- Add an **Agent setup** panel above the catalog:
  - Status: “Northwind Seller Agent · N products · N categories · policy configured”.
  - Button **Auto-configure catalog** → `POST /agent/autoconfigure`; show updated/skipped/rules summary.
  - Textarea “Describe what you sell” + example chips; Button **Add with agent** → `POST /agent/catalog`; show created products; refresh catalog.
  - Clear note: “The agent reads your catalog and applies category rules. You can still tune any item below.”
- **Remove the manual “Add product” form from the main page** (keep the API; no one-by-one UI).
- Keep Inventory source, Category rules, product cards, Agent settings, Import panels.

### Demo console (`/demo.html`)
- Add a compact **Merchant agent setup** strip above the scorecard (or above step 1):
  - “Northwind Seller Agent · catalog ready” + **Auto-configure** button + link to `/merchant.html`.
  - On click call `/agent/autoconfigure`, show “Agent configured N products across N categories”.
- Keep 5-step Run full demo working.

## Tests
- Autoconfigure returns categories/updated and is idempotent; rules applied.
- Agent catalog: fallback creates 3 products without AI; with AI stub optional; empty brief 400.
- UI markers: Agent setup, Auto-configure, Add with agent; no manual “Add product” section on merchant page.
- Existing 82 tests green.
