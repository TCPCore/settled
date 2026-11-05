# Running a live PayPal-sandbox demo for judges

**Yes.** The app can run with real sandbox credentials while remaining a sandbox demo — no real money moves. The client secret and AI key stay **server-side**, never in the browser.

Two safe modes:

1. **Time-boxed live tunnel** (recommended for judging) — run the live instance on your laptop, expose it only while judges are watching, kill it afterwards.
2. **Hosted live-sandbox service** — deploy a second service with sandbox keys, keep the URL unlisted/access-gated, and rotate keys after the hackathon.

---

## Mode A — live tunnel for a judging session (best security)

```bash
cd "/Users/tom/Documents/growth hacks/settled"
set -a; . ./.env; set +a          # PAYPAL_LIVE=1 + sandbox keys + AI key
node server.js                     # http://127.0.0.1:4173  (live PayPal + AI)

# second terminal
cloudflared tunnel --url http://127.0.0.1:4173
```

Give judges the `trycloudflare.com` URL only during the session. When done:

```bash
# Ctrl-C the tunnel, Ctrl-C the server
# Rotate the PayPal app secret and the LLM key in their dashboards
```

**Why this is safe:** the sandbox app secret and AI key are only in the server process; the browser gets the public PayPal client ID and the app’s own JSON. Only PayPal sandbox IDs are created. The URL is unlisted and short-lived.

**Judge flow on the live instance:**
1. Open `/start.html` → **Negotiation** (or `/negotiate.html?merchant=m1&product=p1`).
2. Mandate $500 → **Start agent negotiation** → live AI dialogue → signed contract.
3. **Pay** → PayPal sandbox button → approve → real sandbox capture id.
4. **File claim** → real sandbox refund id, reserve drops.

**Buyer approval — the important part:**
- The sandbox app belongs to a **business/merchant** account; PayPal blocks a merchant from paying itself.
- Use a **Personal sandbox account** (developer.paypal.com → Sandbox → Accounts → Create Personal), or guest card checkout:
  **Pay with a credit or Visa Debit card → No, thanks → test Visa `4111 1111 1111 1111`, `12/30`, CVV `123`, any billing address.**
- Have the sandbox buyer logged in before the demo so the popup is one step.

**Do not use “Run full demo” for the live rail** — it intentionally forces SIM (`simulate:true`) so it never depends on the popup. For live PayPal, run steps 1–3, then click step 4 manually.

---

## Mode B — hosted live-sandbox service (self-serve judges)

Deploy a **second** Render service from the same repo; keep the public SIM service as-is.

- New → Blueprint/Web Service → same repo → name `settled-live-sandbox`.
- Environment (Dashboard → Environment, **never** in `render.yaml`):
  - `HOST=0.0.0.0`
  - `PAYPAL_LIVE=1`
  - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (sandbox)
  - `PAYPAL_ENV=sandbox`
  - `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL=gpt-oss:20b`, `AI_BASE_URL=https://ollama.com/v1` (or your provider)
- Keep the URL unlisted; if you need a gate, put a **password-protected reverse proxy / Cloudflare Access** in front (the app itself has no admin auth in this prototype).
- Set a **spend/rate limit** on the LLM key; use the deterministic fallback if it is exhausted.
- After judging: rotate the PayPal secret and LLM key, or delete the service.

**What to tell judges:** “Sandbox only — no real money. Use the sandbox buyer or the test card. The public SIM demo is separate.”

---

## What is real vs demo in this mode

| Real | Still demo/sandbox |
|---|---|
| PayPal Orders v2 create/approve/capture | PayPal **sandbox**, not production |
| Payments v2 refund on claim | Sandbox refund IDs |
| LLM negotiation + claim explainer | Model key is yours; fallback if unavailable |
| Signed credential, hash chain, reserve accounting | Reserve is demo/merchant-funded, not a balance sheet |
| Contract price/terms/ACC hash | Fulfillment is simulated |

No production money, no consumer data, no custody.

---

## Pre-demo checklist

- [ ] `.env` has sandbox keys and AI key; `set -a; . ./.env; set +a`.
- [ ] `curl localhost:4173/api/config` shows `mode:"live"`, `ai.enabled:true`, `paypal.configured:true`.
- [ ] Sandbox **Personal** buyer logged in, or test card ready.
- [ ] Tunnel URL opened on a second device; `/start.html` loads.
- [ ] Step 3 AI is warm (`gpt-oss:20b` ~3–5s); otherwise fallback is instant.
- [ ] A pre-recorded SIM take exists as fallback.
- [ ] After the session: kill tunnel + server; rotate keys if the URL was shared broadly.
