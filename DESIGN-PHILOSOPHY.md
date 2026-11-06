# PayPal design philosophy, applied to bit-settled

PayPal's current identity is built on **simplicity, trust, optimism, and access**: clean geometric type, a blue-first palette, generous whitespace, and interactions that feel human. The 2024 Pentagram refresh removed decorative yellow from the brand system; yellow survives mainly as the familiar checkout button. We follow the same restraint.

## Principles → what we changed

| PayPal principle | What the demo does |
|---|---|
| **Simple by default** | One primary action per screen: *Run full demo*, *Auto-configure catalog*, *Start agent negotiation*. Advanced controls sit below the first action. |
| **Trust is visible** | Sandbox/SIM status, private-vs-public range separation, signed credential, protection and refund are shown next to the action they affect — not buried in a spec. |
| **Human and optimistic** | Plain-language explanations, rounded geometric type, soft blue surfaces, and friendly empty/loading states instead of terminal styling. |
| **Accessible to everyone** | High-contrast navy-on-white, visible focus rings, labelled controls, responsive layouts, and `prefers-reduced-motion` support. |
| **Consistent system** | Shared tokens for blue, navy, neutral, radius, spacing and type; every surface uses the same nav, buttons, cards and status language. |
| **Motion with purpose** | Motion is limited to feedback: hover lift, press, progress and state changes. Motion is removed for users who ask for reduced motion. |

## Palette

- **PayPal navy** `#001435` — primary text and strong surfaces
- **PayPal blue** `#0070BA` / `#005EA6` — primary actions and links
- **PayPal light blue** `#E8F3FB` / `#F2F8FD` — selected states, trust panels, hovers
- **White / off-white** `#FFFFFF` / `#F5F7FA` — canvas and cards
- **Yellow** `#FFC439` — only the actual PayPal checkout button, not decoration

## Type

Display and body use a rounded geometric sans stack (`Avenir Next`, `Futura`, `Century Gothic`, system sans). This mirrors PayPal Pro's circular, approachable forms without shipping external font files.

## UX rules

1. **One primary CTA per view**; secondary actions are ghost buttons or links.
2. **Explain before asking** — every money action has a one-line “what happens” note.
3. **Progressive disclosure** — technical JSON, advanced policy and machine endpoints are available but not the first thing a merchant sees.
4. **No dead ends** — every state has a next action or a return path.
5. **Say it plainly** — “refunded automatically” before “hash-chained credential”.
6. **Keep the proof** — simplicity never hides the live API evidence; it is labelled as proof.

## Where it shows up

- `/start.html` — hero CTA to run the demo, then the surfaces.
- `/demo.html` — one-sentence promise, one primary Run button, proof log beside it.
- `/merchant.html` — setup checklist, agent-first panels, no manual product entry.
- `/market.html` — published ranges and windows, no private floors.
- `/negotiate.html` — price, mandate, protection and refund in the same reading order.
- `/embed-demo.html` — real PayPal checkout + one-line negotiation install.
