# Live verification — PayPal sandbox + local AI

**Date:** 2026-11-04 · **Environment:** PayPal **sandbox** (`PAYPAL_ENV=sandbox`), Ollama Cloud `gpt-oss:20b` via the OpenAI-compatible endpoint (local `llama3.2:3b` tested as fallback). No real money moved.

## PayPal — real sandbox order, capture and refund

| Step | ID | Status |
|---|---|---|
| Order | `1TD07351F78687411` | approved in sandbox |
| Capture | `05T456380E807962V` | `REFUNDED` |
| Refund | `2KN47117H3971321W` | `COMPLETED` — $249.00 USD |

Verified directly against `api-m.sandbox.paypal.com` (`GET /v2/payments/captures/{id}`, `GET /v2/payments/refunds/{id}`).

**Buyer approval:** guest card checkout in the sandbox popup — **Pay with a credit or Visa Debit card** → **No, thanks** → test Visa `4111 1111 1111 1111`, `12/30`, CVV `123`, any billing address. The provided sandbox login is a **business/merchant** account, and PayPal correctly blocks a merchant from paying itself (`CANNOT_PAY_SELF`); a **Personal** sandbox account or guest card is required to approve.

## AI — real local model in the core path

| Call | Result |
|---|---|
| `POST /api/contracts` + `/ai-auto` (list $249) | accepted at **$237**, `ai.used: true`, `provider: openai`, `model: gpt-oss:20b`, **3.7 s**; 8/8 consecutive runs used the model |
| AI move 1 | offer `$221` + rationale |
| AI move 2 | offer `$221` + rationale; policy closes at the merchant's `$237` ask |
| Claim with `use_ai:true` | `ai.used: true`, recommendation `approve`, confidence `0.8`, rationale returned; refund paid |

The model never sets an illegal price: the server computes the allowed candidate set, clamps off-menu proposals, and keeps the deterministic fallback for timeouts/offline.

## Reproduce

```bash
cd settled
cp .env.example .env          # fill AI + PayPal sandbox values
set -a; . ./.env; set +a
node server.js                # → http://127.0.0.1:4173/demo.html
```

`GET /api/config` must show `mode:"live"`, `ai.enabled:true`, `paypal.configured:true`. Then: Reset → steps 1–3 (AI transcript) → step 4 PayPal → step 5 claim. Real IDs replace `SIM-…`.

*These are sandbox identifiers, safe to publish; no secrets are included in this file or the repo.*
