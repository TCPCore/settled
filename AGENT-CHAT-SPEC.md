# Step 3 — transparent agent-to-agent negotiation (frozen interface)

Goal: a judge watches **Sam's personal agent (ProcureBot)** negotiate with **Northwind's merchant agent** in a visible chat, while the server's policy guardrails are shown beside it. The AI writes the messages; the policy fixes the numbers.

## Backend (`lib/ai.js`, `lib/contract.js`) — api-scout

`planNegotiation()` returns two extra fields:
- `merchant_counter_message: string`
- `merchant_counter_rationale: string`

Prompt JSON adds those keys. The **merchant counter price is not chosen by the model** — it is `contract.policy.auto_accept`; the model only writes the merchant's message/rationale. Fallback text must be deterministic and must **not reveal the private floor**:
- counter: `I can meet you at $<auto_accept> — that's the best I can do within my published policy.`
- rationale: `Published seller policy fixes the auto-accept price; the merchant agent cannot move below it.`

`aiAuto()` attaches:
```js
contract.ai.dialogue = [
  { round: 1, from: 'buyer_agent',    agent: 'ProcureBot',              operator: 'Acme Procurement Inc',
    action: 'offer',  price: <opening>, message: <opening_message>,      rationale: <opening_rationale>,
    policy: 'within_buyer_mandate' },
  { round: 1, from: 'merchant_agent', agent: 'Northwind Seller Agent',  operator: 'Northwind Audio',
    action: 'counter', price: <auto_accept>, message: <merchant_counter_message>,
    rationale: <merchant_counter_rationale>, policy: 'auto_accept_price' },
  { round: 2, from: 'buyer_agent',    agent: 'ProcureBot',              operator: 'Acme Procurement Inc',
    action: 'accept', price: <auto_accept>, message: <accept_message>,   rationale: <accept_rationale>,
    policy: 'within_buyer_mandate' },
];
```
- If the opening offer is already accepted (>= auto_accept), include buyer offer + merchant accept; no counter.
- `ai.used` stays true when the model produced the messages; false on fallback.
- Keep `ai.moves` for compatibility. No new route, no schema break. `GET /api/contracts/:id` must expose `ai.dialogue`.
- One model call only; do not add latency.

## Frontend (`public/demo.html`, `public/demo.js`) — demo-builder

In step 3, above/replacing the current reasoning cards, render **“Agent-to-agent negotiation”**:
- Two agent chips: **Sam’s personal agent — ProcureBot** (Acme Procurement · mandate $500 · audio/electronics) and **Northwind Seller Agent** (Northwind Audio · published policy).
- Chat bubbles in order from `ai.dialogue`: buyer left, merchant right, price chip on each (`$214`, `$237`, `accepted $237`), message, small rationale line, small policy badge (`within mandate`, `policy price`, `signed`).
- A **policy strip** under the chat: “Server policy: allowed prices [214, 226, 237] · buyer mandate $500 · seller auto-accept $237 · the model can talk but cannot move money outside these.” (Values from contract `policy`/`mandate`; do not reveal `floor`.)
- Signed contract line below: hash, both signatures, “terms fixed before payment.”
- Keep the existing “Model reasoning” block as a collapsible/secondary section (do not remove transparency).
- If `ai.dialogue` is absent (older contract), fall back to the current `ai.moves` rendering.
- No new external assets; keep IDs; additive DOM only; `Run full demo` still 5/5.

## Acceptance
- `node --check` clean; `npm test` 82/82.
- Headless `/demo.html` + Run full demo: 5/5, chat visible with 3 bubbles, AI badges, no console errors, no overflow at 1440/1280.
- AI off (no key): dialogue still renders with deterministic messages and `FALLBACK` badge.
- One model call, step 3 still ~3–4 s on Ollama Cloud.
