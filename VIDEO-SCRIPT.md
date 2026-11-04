# Settled — demo video script (<3:00)

**Target: 2:45–2:55 (the table ends at 2:58). Hard cap: 2:59.** One presenter, one screen, one protagonist (Maya). Devpost requires a **public YouTube** link, so the video is part of the submission, not just the pitch.

**Two takes, one cut:** record the **live take** (PayPal sandbox + AI enabled) first; if any step stalls twice, record the **SIM take** with the identical script and use that. Never fake an ID on screen — the SIM take is honest as long as it is labelled SIM.

---

## Pre-roll (T−15 min)

- `cd settled && lsof -ti :4173 | xargs kill; node server.js` with the sandbox + AI env set (`PAYPAL_LIVE=1`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`, `AI_API_KEY`).
- Open `http://127.0.0.1:4173/demo.html`; click **Reset**; confirm the header pills read **AI: <model>** and **PAYPAL SANDBOX** (not SIM).
- Run **Run full demo** once to warm the server, then **Reset** again. The take starts from a clean state.
- Browser: fresh profile, bookmarks bar hidden, zoom 100%, window 1600×900 (upscale to 1440p in the editor), notifications off, other tabs closed.
- **AI model warm.** `/api/config` should show `AI: gpt-oss:20b` (Ollama Cloud, ~3 s/step). If using local Ollama, run `ollama run llama3.2:3b "ok"` first and set `AI_TIMEOUT_MS=30000` — a cold CPU model takes 10–20 s and looks like a stall.
- **PayPal sandbox buyer ready.** If your app belongs to a business/merchant account, PayPal blocks it from paying itself. Either create a **Personal** sandbox account (developer.paypal.com → Sandbox → Accounts) and log in with it, or use guest card checkout: **Pay with a credit or Visa Debit card** → **No, thanks** → test Visa `4111 1111 1111 1111`, `12/30`, CVV `123`, any billing address. Do this once in pre-roll so the live take is one clean pass.
- Record with QuickTime/OSB at 1080p or 1440p, 30fps, system audio muted (voice-over recorded separately or live — live is fine if the room is quiet).

**Never on screen:** `.env`, API keys, client ids/secrets, real email addresses, terminal history.

---

## The script

| Time | Screen action | Voice-over (exact) |
|---|---|---|
| **0:00–0:12** | `demo.html`, scorecard visible. Cursor still. | *"PayPal can already let an AI agent pay. It can't let a merchant negotiate with that agent — or trust it. So we built the merchant's negotiation desk for the agent economy: personal AI meets merchant agent, in the open, with a signed contract and a refund if it fails."* |
| **0:12–0:32** | Slow pan down the five axes: Authorization 5, Trust 2, Protection 1, Negotiation 1, Recourse 3. | *"Meet Maya. She runs risk at a $200M brand. Half her shoppers abandon because they're not sure a store is real. Chargebacks take thirty days. And agent orders are arriving with no answer to: who pays if it fails?"* |
| **0:32–0:52** | Click **1 · Trust credential**. Result card appears (tier A, 91, 94%, $5,000 cap, $12,500 reserve). Hover the signature/verify line. | *"This is Northwind Audio. Not a badge they bought — a credential signed from 4,812 settled payments, deliveries and disputes. Tier A, score 91, 94% coverage, five-thousand-dollar cap, twelve-five reserve. And it travels — to any store, any PSP, any agent."* |
| **0:52–1:10** | Click **2 · Agent passport**; then **Try RogueBot**. Result: ProcureBot verified, RogueBot rejected. | *"Before the agent spends a dollar it presents a passport: verified operator, a signed spend mandate, a five-hundred-dollar limit. RogueBot has no verified operator and an expired mandate — rejected before an order exists."* |
| **1:10–1:45** | Click **3 · Negotiate**. Ensure **AI agents** is checked. Point at the two agent chips and the three chat bubbles: buyer $214 → seller $237 → accept. Point at the policy strip (`allowed prices [214, 226, 237] · mandate $500 · auto-accept $237`), then the signed hash. | *"This is the part judges should watch: two agents talking. Sam's personal agent has a five-hundred-dollar mandate; Northwind's seller agent is bound by its published policy. The buyer offers $214; the seller counters $237 — that number is fixed by policy, not invented by the model; the buyer accepts $237. The model writes every word, but the server fixes the allowed prices and the mandate. Both agents sign one contract: price, delivery, returns, transcript hash — before PayPal approval."* |
| **1:45–2:12** | Click **4 · Protection + PayPal**. Result: 35 bps, $0.83 fee, $5,000 cap, order at $237.00. In the **Live PayPal sandbox** block click the PayPal button; approve in the sandbox popup; the block shows the real capture id. | *"The contract prices risk, not a flat fee: thirty-five basis points, five-thousand-dollar cap, instant capture. The order carries the contract hash. Pay with the PayPal button — this is a real sandbox order, approved and captured at exactly the negotiated amount. No custody: the reserve stays with the merchant; PayPal is the rail."* |
| **2:12–2:34** | Click **5 · Recourse**. Check the evidence box, submit claim. AI recommendation + confidence appear; then refund $237.00 paid, refund id, reserve $12,500 → $12,263.00, score/tier update. | *"The parcel never arrives. The agent files a claim with evidence. The AI reviews it and recommends — with its reasoning — then the rule engine pays from the merchant's own reserve: two hundred and thirty-seven dollars refunded in about a second, through the PayPal refund API. No chargeback, no support queue, no thirty-day wait. And the merchant's score recalculates."* |
| **2:34–2:50** | Scroll to the scorecard: **ALL FIVE AXES 8+**. Then cut to `screenshots/dashboard.png` for one beat. | *"One object carries identity, negotiated terms, trust, protection and recourse. PayPal spends about one point three billion a year on protection with no risk-based price. We turn that cost centre into a priced product — and protect the take rate as checkout moves into agents."* |
| **2:50–2:58** | Back to `demo.html`, scorecard. | *"Settled. Reputation settles with the payment."* |

---

## Fallbacks (spoken, on camera — do not hide the failure)

| Failure | What to do | What to say |
|---|---|---|
| **No AI key / model timeout** | Continue; the transcript shows `FALLBACK` badges and the same accepted price. | *"The model is optional by design — here it's the deterministic policy fallback, same price, same contract."* |
| **PayPal popup fails or Wi-Fi drops** | Cancel the popup; click **Reset**; use the SIM take. | *"The rail is SIM in this take — the sandbox IDs are in the recording and in the README."* |
| **Sandbox login stalls** | Do not debug on camera. Cut to the pre-recorded capture moment, then continue at step 5. | — |
| **Any step red / 500** | Click **Reset**, rerun once. If it fails twice, switch to the SIM take. | — |
| **Running over 2:50** | Drop the Maya sentence about chargebacks; drop the dashboard beat at 2:34. Keep the close. | — |

**Rule: if the live take breaks twice, publish the SIM take.** It is the same product and the same script; a labelled SIM video is better than a video that shows a broken product.

---

## Upload

- **YouTube:** public (Devpost judges need the link), title `Settled — reputation settles with the payment (PayPal AI Hackathon 2026)`, description with the repo link, `#PayPalAIHackathon`. Keep it under 3:00 — YouTube shows the true duration.
- **Description honesty line:** *"Demo runs on the PayPal sandbox; local judges can run the same flow in SIM with no keys (see README)."*
- **Also save:** the raw recording (backup for stage), `screenshots/demo-complete.png`, and the exact take's JSON log as submission evidence.
