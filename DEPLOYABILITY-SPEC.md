# Deployability & defensibility — remaining pieces (frozen)

Goal: a PayPal/merchant can deploy this, any personal-AI runtime can connect, and any storefront can add it without a replatform. Remaining pieces: MCP server, A2A-style agent card, index ranking, drop-in widget, deployment/defensibility docs.

## 1. MCP server (personal-AI runtime adapter)

`mcp/server.js` — zero deps, stdio JSON-RPC 2.0, connects to `SETTLED_BASE_URL` (default `http://127.0.0.1:4173`).

Supports:
- `initialize` → `{protocolVersion:"2024-11-05", capabilities:{tools:{}}, serverInfo:{name:"settled",version:"1.0.0"}}`
- `notifications/initialized` (no response)
- `ping`
- `tools/list` → tools:
  - `index_manifest` `{}` → `GET /api/index/manifest`
  - `index_feed` `{cursor?,limit?,category?,merchant?,updated_since?}` → `GET /api/index/feed`
  - `index_search` `{q?,category?,budget?,merchant?,limit?}` → `GET /api/index`
  - `negotiate_start` `{merchant_id,product_id,buyer_agent_id?,mandate_max?}` → `POST /api/contracts`
  - `negotiate_auto` `{contract_id}` → `POST /api/contracts/{id}/ai-auto`
  - `order_create` `{merchant_id,product_id,contract_id,agent_id?,simulate?}` → `POST /api/merchants/{id}/orders`
  - `claim_open` `{order_id,reason?,evidence?,use_ai?}` → `POST /api/orders/{id}/claim`
- `tools/call` `{name, arguments}` → `{content:[{type:"text",text:"<JSON>"}], isError:false}`; unknown tool/HTTP error → `isError:true`.
- stdout only JSON-RPC lines; logs to stderr.
- `mcp/README.md` with Claude Desktop/Cursor config snippet.

## 2. A2A-style agent card

`GET /.well-known/agent-card.json` and `GET /api/a2a/agent-card`:
```json
{
  "protocolVersion": "0.2.0",
  "name": "Settled",
  "description": "PayPal merchant negotiation index and assurance layer",
  "url": "/",
  "version": "1.0.0",
  "capabilities": { "streaming": false, "pushNotifications": false },
  "defaultInputModes": ["application/json"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    { "id": "negotiate", "name": "Negotiate a purchase", "description": "Find a merchant offer, negotiate within a mandate, sign a contract", "tags": ["commerce","negotiation"], "examples": ["Negotiate the Aurora One under $240"] },
    { "id": "verify", "name": "Verify merchant trust", "description": "Check the signed merchant credential", "tags": ["trust"] },
    { "id": "claim", "name": "Open a claim", "description": "File a buyer/agent claim and get a reserve refund", "tags": ["recourse"] }
  ]
}
```
Honest label: A2A-style discovery card, not a claim of full A2A protocol support.

## 3. Index ranking (no floor leak)

`GET /api/index?sort=trust|price|value`:
- default `price` (existing behavior),
- `trust`: merchant score desc, then price,
- `value`: discount from list based on **published_min** only: `(price - published_min)/price` desc.
Return `ranking:{sort, basis}` and no private fields. Feed remains stable by `offer_id` for pagination.

## 4. Drop-in widget (any storefront)

`public/settled-widget.js`:
```html
<script src="/settled-widget.js" data-merchant="m1" data-product="p1" data-label="Negotiate with AI"></script>
```
- Renders a floating button (and optional inline button via `data-inline="true"`) linking to `/negotiate.html?merchant=...&product=...` in a new tab.
- `data-position="bottom-right|bottom-left"`, `data-theme="dark|light"`, `data-label`.
- No external assets; no framework; no private data.
- `public/embed-demo.html` — a minimal storefront page with a PayPal button + the widget, one-line install snippet, and a "what happened" panel. Judge sees the install.

## 5. Docs

`DEFENSIBILITY.md`: why this is deployable (hosted checkout universal, payload adapters, MCP/A2A, index feed), what is roadmap (OAuth connectors, cart plugins, insurer/LC, MCP auth), security/limits, and the PayPal/merchant deployment path.
Update `DEPLOY.md`/`ADAPTERS.md` with MCP/widget/agent-card commands.

## 6. Tests
- MCP: spawn `node mcp/server.js`, send initialize/tools/list/tools/call(`index_manifest`), assert JSON-RPC.
- A2A card at both paths.
- `GET /api/index?sort=trust|value` ordering + no private range.
- `/embed-demo.html`, `/settled-widget.js` 200 + marker.
- Existing 74 tests green.

## Acceptance
- `node --check`; 74+ tests; MCP tools list has 7 tools; widget demo works; no floor leak.
