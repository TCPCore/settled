# Deploy the demo (private until submission)

The app is a single zero-dependency Node process. Public judges get **SIM mode** (no keys, no money); the video shows the live PayPal sandbox rail.

## Option A — Render (recommended, one click)

1. Push the repo (already done): https://github.com/TCPCore/settled
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

## What a judge does

1. Open `/demo.html` → **Reset** → **Run full demo**.
2. Watch step 3: Sam's personal agent negotiates with Northwind's seller agent; policy strip; signed contract.
3. Step 4: SIM payment id (public demo); step 5: instant refund + AI claim review.
4. Read `/` dashboard, `/agent.html`, and [LIVE-TEST.md](LIVE-TEST.md) for the live sandbox IDs in the recorded video.
5. Run `npm test` (63/63) from the repo.

## Safety

- Public demo: SIM only. No secrets, no PayPal tokens, no real money.
- Never commit `.env`; it is gitignored.
- If a live key is ever exposed, rotate it in the PayPal/LLM dashboard immediately.
- The $25k pool is demo capital, not a balance sheet; say so if asked.
