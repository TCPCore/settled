# Settled — 4-minute live demo script (stage directions)

> Master pitch (protagonist, judge rubric, Q&A, reliability, 48h runbook): [HACKATHON-PROOF.md](HACKATHON-PROOF.md). This file is the stage-direction backup.

**Before you start:** `cd settled && node server.js` → open `http://127.0.0.1:4173/demo.html`. Click **Reset** once. Have the dashboard (`/`) and agent console (`/agent.html`) open in other tabs as backup. If the Wi-Fi is hostile, the demo runs entirely in SIM mode — no PayPal credentials needed. If you have a sandbox client-id/secret, start with `PAYPAL_LIVE=1 PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… node server.js` and step 4 will show a real **Open PayPal approval** link; otherwise it shows `SIM` and the story is identical.

---

## 0:00 — Hook (15s)

> "PayPal already lets AI agents pay. What it can't do is let them **trust** — who the agent is, whether the merchant will deliver, what the price should be, and who pays if it goes wrong. We built the missing assurance layer for agentic commerce. Five weak axes, all taken to 8+."

Point at the scorecard: **Authorization 5, Trust 2, Protection 1, Negotiation 1, Recourse 3 → all 8+.** "Let me show you one agent purchase, end to end."

## 0:15 — Step 1: the trust credential (25s)

Click **1 · Trust credential**.

> "This is Northwind Audio. Instead of a badge they bought, this is a signed credential built from 4,812 settled payments, delivery and dispute outcomes: tier A, score 91, 94% coverage, $12,500 reserve. It travels — to any store, any PSP, any agent."

## 0:40 — Step 2: the agent passport (25s)

Click **2 · Agent passport**. Then click **Try RogueBot**.

> "Before the agent spends a dollar, it presents a passport: operator Acme Procurement, verified KYB, capabilities, a $500 spend limit, and a signed AP2 mandate. RogueBot has no verified operator and an expired mandate — rejected before anything is created."

## 1:05 — Step 3: negotiate the contract (30s)

Click **3 · Negotiate**.

> "The list price is $249. The buyer agent offers $214; the merchant agent counters at $237.00; the buyer accepts. Both sides sign one contract — price, delivery, returns, transcript hash. The amount is agreed **before** PayPal approval, so the buyer approves exactly what was negotiated."

## 1:35 — Step 4: price the protection and pay (30s)

Click **4 · Protection + PayPal**.

> "The contract prices risk, not a flat fee: tier A = 35 bps, $5,000 cap, instant capture. The order carries the contract hash in `custom_id`; PayPal settles the agreed amount. No custody — the reserve stays with the merchant; PayPal is the rail."

If live: click **Open PayPal approval**, approve in sandbox, come back — show real order/capture ids. If SIM: point at payment id.

## 2:05 — Step 5: instant recourse (30s)

Click **5 · Recourse**.

> "The parcel never arrives. The agent files a claim with evidence. The refund — $237.00 — is paid from the merchant's own reserve in about 1.2 seconds, through the PayPal refund API. The reserve drops to $12,263.00. No chargeback, no support queue, no 30-day wait."

## 2:35 — The payoff (25s)

Point at **ALL FIVE AXES 8+**.

> "One object — the Agent Commerce Contract — carries identity, negotiated terms, trust, protection and claim rules. That is what turns PayPal's agentic checkout from a payment rail into an assurance layer. PayPal already spends about $1.3B a year on protection with no risk-based pricing and no portable trust signal. We turn that cost centre into a priced, portable product — and protect the take rate as checkout moves into agents."

## 3:00 — Close (10s)

> "Settled. Reputation settles with the payment. Thanks."

---

## Backup lines for Q&A

- **"Is this just Signifyd with a UI?"** → "Signifyd indemnifies the *merchant* against fraud chargebacks. We credential the merchant, price the buyer's protection, and pay a **buyer-initiated** claim from the merchant's reserve — and the credential is portable to stores and agents the issuer doesn't own."
- **"Does PayPal need to build this?"** → "No. We plug into Orders v2, Refunds, Invoices, Webhooks and the Agent Toolkit/MCP. PayPal keeps the rail; we add the five things it doesn't have. Partner or acquire."
- **"What's real vs simulated?"** → "Real: HMAC-signed ledger, hash chain, risk engine, reserve accounting, claims, API. Simulated by default: payment ids, delivery. Live PayPal sandbox is one env var away."
- **"What if the agent lies?"** → "Passport + mandate caps + reputation + liability; server-side policy, not the LLM's judgement."
- **"New merchant?"** → "Escrow tier C, low cap, bond optional, graduates to instant capture as outcomes accumulate."

## If the demo breaks

1. Click **Reset** and run again (the whole flow is deterministic).
2. Switch to the dashboard and agent console tabs — they show the same state.
3. Use the pre-recorded 60-second screen capture (record it before the event) as the fallback.
