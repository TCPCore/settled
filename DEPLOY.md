# Deploy the demo (private until submission)

The app is a single zero-dependency Node process. Public judges get **SIM mode** (no keys, no money); the video shows the live PayPal sandbox rail.

## Option A — Render (recommended, one click)

1. Push the repo (already done): https://github.com/TCPCore/bit-settled
2. Render → **New → Blueprint** → connect the repo. `render.yaml` creates a free web service named `settled-demo`.
3. Wait for the first deploy; open `https://settled-demo.onrender.com/demo.html`.
4. **Do not publish the URL** until the submission is ready. Render URLs are unlisted unless linked.
5. Keep `PAYPAL_LIVE=0` and `AI_PROVIDER=none` on the public service. For a private live test, duplicate the service, add `PAYPAL_LIVE=1`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` in the Render dashboard — never in `render.yaml`.
6. Free plan sleeps after inactivity; first load may take ~20s. That is fine for a demo link.

## Option B — Docker

```bash
cd settled
docker build -t settled-demo .
docker run --rm -p 8080:8080 settled-demo
# open http://127.0.0.1:8080/demo.html
```

With live keys:

```bash
docker run --rm -p 8080:8080 --env-file .env settled-demo
```

## Option C — local + temporary tunnel (for testing from a phone/another machine)

```bash
# SIM instance only; no live keys
PORT=8080 HOST=0.0.0.0 node server.js
cloudflared tunnel --url http://127.0.0.1:8080
```

Use the `trycloudflare.com` URL only for private testing. It is public and temporary; do not put it in the Devpost submission.

## Option D — personal-AI runtime (MCP)

`mcp/server.js` is a zero-dependency **stdio** MCP server (JSON-RPC 2.0) that proxies to the running app at `SETTLED_BASE_URL` (default `http://127.0.0.1:4173`):

```bash
node server.js &                                        # keep the API up
node mcp/server.js                                      # stdio MCP server (stdout = protocol, stderr = logs)
```

Claude Desktop / Cursor config:

```json
{"mcpServers":{"settled":{"command":"node","args":["/abs/path/settled/mcp/server.js"],"env":{"SETTLED_BASE_URL":"http://127.0.0.1:4173"}}}}
```

Tools: `index_manifest`, `index_feed`, `index_search`, `negotiate_start`, `negotiate_auto`, `order_create`, `claim_open`. It is **local stdio with no remote auth** — never expose it as a public service.

## Option E — A2A card + drop-in widget

```bash
curl -s http://127.0.0.1:4173/.well-known/agent-card.json | python3 -m json.tool
curl -s http://127.0.0.1:4173/api/a2a/agent-card | python3 -m json.tool
```

One-line install on any storefront:

```html
<script src="/settled-widget.js" data-merchant="m1" data-product="p1" data-label="Negotiate with AI"></script>
```

Optional: `data-position="bottom-right|bottom-left"`, `data-theme="dark|light"`, `data-inline="true"`. The widget opens the hosted `/negotiate.html` flow in a new tab; it contains no price logic, no private data and no payment code. `/embed-demo.html` is a faux storefront (PayPal-style button + widget + "what happened" panel) for the judge.

## What a judge does

1. Open `/demo.html` → **Reset** → **Run full demo**.
2. Watch step 3: Sam's personal agent negotiates with Northwind's seller agent; policy strip; signed contract.
3. Step 4: SIM payment id (public demo); step 5: instant refund + AI claim review.
4. Read `/` dashboard, `/agent.html`, and [LIVE-TEST.md](LIVE-TEST.md) for the live sandbox IDs in the recorded video.
5. Open **`/embed-demo.html`** and click the negotiation widget — a storefront adds Settled with one script tag.
6. Run `npm test` (78/78) from the repo.

## Safety

- Public demo: SIM only. No secrets, no PayPal tokens, no real money.
- Never commit `.env`; it is gitignored.
- If a live key is ever exposed, rotate it in the PayPal/LLM dashboard immediately.
- The $25k pool is demo capital, not a balance sheet; say so if asked.
