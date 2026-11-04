# PayPal AI Hackathon 2026 — fit assessment & 8-day submission plan

*Rules as published by PayPal/Devpost (official page is Cloudflare-blocked to automated fetch; cross-checked against the PayPal developer blog and two organizer summaries). Verify the deadline on the Devpost page before submitting.*

**Sources:** [PayPal developer blog](https://developer.paypal.com/community/blog/PayPal_AI_Hackathon/) · [DevGrants Daily summary](https://devgrantsdaily.com/items/2026-10-02-paypal-ai-hackathon-2026/) · [CourseJoiner summary](https://coursejoiner.com/hackathon/paypal-ai-hackathon-2026/) · [Official Devpost](https://paypalaihackathon.devpost.com/)

---

## 1. The rules that matter

| Item | Rule |
|---|---|
| **Window** | Submissions open **Oct 1, 2026**; close **Nov 12, 2026, 2:00 PM PT** (≈8 days from Nov 4). Judging Nov 13–Dec 15; winners ~Dec 21. |
| **Core requirement 1** | Must **meaningfully integrate at least one PayPal technology/API/SDK/product** using the **free PayPal Sandbox**. |
| **Core requirement 2** | Must incorporate **AI/ML models or automated AI agents** into the core UX or backend. |
| **Working prototype** | Functional proof of concept; **static mockups do not qualify**. |
| **Submission** | Text description; **public GitHub repo with an open-source license**; **demo video under 3 minutes on YouTube**; demo judges can run. |
| **New/existing** | New projects, or existing projects with **meaningful progress during the submission period**. |
| **Eligibility** | Age of majority; excludes residents of Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, other sanctioned regions; PayPal/Devpost employees excluded. |
| **Judging** | Technical implementation, design, potential impact, innovation, presentation. |
| **Prizes** | Overall $12k / $8k / $5k; **$5k each** for Most Creative, Most Impactful, **Best Demo Delivery**, **Best Use of PayPal + AI**, **Best Use of Agentic Commerce**; sponsor prizes (AG Grid, APIMatic, Bryntum, Channel3, Render). |
| **No tracks** | Open problem space; no prescribed problem statements. |

---

## 2. Fit scorecard — as the project stands today

| Requirement | Current state | Verdict |
|---|---|---|
| **PayPal sandbox integration** | `lib/paypal.js` implements OAuth + Orders v2 create/capture + approval URL; `/api/paypal/capture`; SIM fallback. **The demo defaults to SIM and the live approval/return flow has not been exercised.** | ⚠️ **At risk** — must run real sandbox orders in the video and show real IDs |
| **AI in the core** | Agent passports, negotiation policy, risk engine, claim adjudication are **deterministic**, not a model. The "agents" are automated but not AI/ML. | ⚠️ **At risk** — judges may rule the AI requirement unmet |
| **Working prototype** | Node app, 5-step demo console, dashboard, agent console, 63/63 e2e tests, screenshots | ✅ **Strong** |
| **Public repo + license** | Code exists locally; **no git repo, no LICENSE** | ❌ **Must do** |
| **Demo video <3 min** | None | ❌ **Must do** |
| **Devpost text** | `WRITEUP.md`, `JUDGE-BRIEF.md`, `HACKATHON-PROOF.md` ready to adapt | ✅ **Easy** |
| **Meaningful progress in window** | Built Nov 3–4, inside Oct 1–Nov 12 | ✅ |
| **Eligibility** | Depends on entrant's residence/age (not disclosed) | ⚠️ Confirm |
| **Impact / innovation / design / presentation** | Strong: 51% abandonment, $1.3B cost centre, portable credential + priced protection + instant recourse, polished demo | ✅ |

**Honest verdict:** *not submission-ready yet.* The prototype and story are strong, but the two **core requirements** are currently only partly demonstrated: the AI is deterministic and the PayPal rail is simulated by default. Fix those, add the repo/license/video, and it is a strong contender for **Best Use of Agentic Commerce**, **Most Impactful**, and **Best Demo Delivery** — and potentially an overall placement.

---

## 3. Must-fix list (priority order)

### P0 — make the AI real and core (1–2 days)
- Add an LLM-backed **buyer agent + merchant agent** that generate offers, counters and justifications, **constrained by the deterministic policy** (buyer mandate max, seller floor/auto-accept, max rounds). The LLM chooses moves/wording; the policy enforces the numbers — this is the safest and most demoable AI.
- Add an **AI claim adjudicator/explainer**: classify the claim reason from evidence, draft the decision rationale, and hand off to the rule engine for the payout. Show "AI recommendation + policy check" side by side.
- Optionally add an **AI trust narrative**: a one-paragraph explanation of the merchant credential.
- Use any model (OpenAI/Anthropic/local); add `AI_PROVIDER`/`AI_API_KEY` env and a deterministic fallback so judges can run it offline.
- Demo toggle "AI agents" and show the transcript/reasoning; record the video with AI enabled.

### P0 — prove the PayPal sandbox rail (1 day)
- Wire the **PayPal JS SDK buttons** in the demo: server `createOrder` → buyer approves in the PayPal sandbox → `onApprove` → server capture.
- On claim, call **Payments v2 refund** on the capture (sandbox) and show the real refund id/status.
- Record the video with **real sandbox order/capture/refund IDs** visible; keep SIM as the fallback for local judges.
- Add `.env.example` and clear setup instructions; test end-to-end twice.

### P1 — submission artifacts (1 day)
- **Public GitHub repo** with MIT/Apache license, `.gitignore`, `README.md` (what, run, demo, env), screenshots.
- **`DEVPOST.md`**: title, tagline, inspiration, what it does, how we built it, challenges, accomplishments, what we learned, what's next, built-with (PayPal Orders v2, Payments v2, Agent Ready/AP2, Node, AI model), links.
- **`VIDEO-SCRIPT.md`** and a recorded **<3:00 YouTube** demo: hook → problem → live AI negotiation → PayPal sandbox order → claim/refund → impact/business → close.
- Optional: deploy to **Render** (sponsor) for a hosted judge demo; otherwise `node server.js` + video.

### P1 — positioning
- Target categories: **Best Use of Agentic Commerce** (primary), **Most Impactful**, **Best Demo Delivery**, **Best Use of PayPal + AI**.
- Emphasize: AI agents negotiating within guardrails; agent passport; signed contract; real PayPal sandbox; instant refund; $1.3B cost centre; 51% abandonment.
- De-emphasize: long strategy docs, the $25k demo pool, claims of production readiness.

---

## 4. 8-day plan (Nov 4 → Nov 12, 2:00 PM PT)

| Day | Ship | Owner |
|---|---|---|
| **Nov 4–5** | LLM buyer/merchant agents + AI claim explainer; policy guardrails; demo toggle; deterministic fallback | Backend + frontend |
| **Nov 5–6** | PayPal sandbox live flow (buttons, create, approve, capture, refund); real IDs; test twice | Backend + QA |
| **Nov 7** | Integrate both into `/demo.html`; record 3-minute video (script, screen capture, captions) | Frontend + presenter |
| **Nov 8** | Public repo + LICENSE + README + `.env.example` + DEVPOST draft; optional Render deploy | Lead |
| **Nov 9–10** | Full dress rehearsal; fix only blockers; screenshot/backup video; submit early | Whole team |
| **Nov 11–12** | Buffer; final submission before **2:00 PM PT Nov 12** | Lead |

---

## 5. Submission checklist

- [ ] PayPal sandbox app created; `PAYPAL_CLIENT_ID/SECRET` in `.env`; live mode tested.
- [ ] Real sandbox order + capture + refund IDs recorded in the video.
- [ ] AI model integrated in the core negotiation + claim path; fallback works without a key.
- [ ] Public GitHub repo, open-source LICENSE, README, screenshots, `.env.example`.
- [ ] Demo video <3:00 on YouTube; shows live AI + PayPal sandbox + instant refund.
- [ ] Devpost text + built-with tags + repo/video links.
- [ ] Judges can run: `npm start` → `/demo.html`; SIM fallback documented.
- [ ] Eligibility confirmed (age/residence); team members listed.
- [ ] Deadline confirmed on the Devpost page; submit **at least 24h early**.

---

## 6. What to emphasize / what to cut

**Emphasize:** AI agents negotiating within a signed mandate; agent passport; real PayPal sandbox order → capture → refund; instant claim from reserve; portable merchant credential; 51% abandonment / $1.3B protection cost; "Best Use of Agentic Commerce."

**Cut/soften:** long business-model essays in the video; the demo pool as "capital"; any claim that the live insurance/underwriting is built; features not in the demo.

**One-line submission:** *"Settled is a PayPal-native assurance layer where AI agents negotiate a signed contract, PayPal settles it, and a buyer/agent claim is paid from the merchant's reserve in seconds — portable trust, priced protection, instant recourse."*
