# MCTB Setup — architecture audit (Pass 1)

## Intent

- **Keep** main MCTB product sidebar (Home, Missed Calls, Conversations, Voicemail, Analytics, Setup).
- **Remove** permanent second vertical setup sidebar inside `/mctb/setup/*`.
- **Add** compact horizontal section navigation under the Setup header.
- **Do not** rebuild the initial onboarding wizard (`/mctb/setup/start`) in this pass.

## Permanent section IA

| Section | Canonical route | Legacy routes (still resolve) |
|---------|-----------------|-------------------------------|
| Overview | `/mctb/setup` | — |
| Phone & Forwarding | `/mctb/setup/phone` | — |
| Recovery | `/mctb/setup/recovery` | `/missed-call-rules`, `/text-back`, `/links`, `/follow-up`, `/business-hours` |
| Consent | `/mctb/setup/consent` | — |
| Voicemail | `/mctb/setup/voicemail` | — |
| Notifications | `/mctb/setup/notifications` | — |
| Exclusions | `/mctb/setup/exclusions` | — |
| Test | `/mctb/setup/test` | — |

Section resolution: `src/lib/mctb/setup-sections.ts`.

## Shell components

| Piece | Path |
|-------|------|
| Workspace shell | `src/components/mctb/setup/mctb-setup-shell.tsx` |
| Horizontal nav | `src/components/mctb/setup/mctb-setup-section-nav.tsx` |
| Styles | `src/components/mctb/setup/mctb-setup-shell.css` |
| Section pages wrapper | `src/components/mctb/setup/mctb-setup-section-layout.tsx` |
| Overview page | `src/components/mctb/setup/setup-overview-view.tsx` |

## APIs reused (no new persistence layer)

| API | Role |
|-----|------|
| `GET/POST /api/mctb/setup` | Runtime config, schedule/pause, consent, messaging readiness |
| `GET /api/mctb/overview` | Forwarding label cross-check |
| `GET /api/mctb/onboarding` | Forwarding verified, funnel events, live test timestamps |
| `GET /api/mctb/exclusions` | Exclusion count |
| `GET /api/mctb/handoff` | Notification recipient summary |
| `GET /api/mctb/live-test` | Live test passed flag |
| `GET /api/phone/voicemail?phoneNumberId=` | Greeting configured summary |

Pause/resume uses existing `POST /api/mctb/setup` with `enabled`, `pauseUntil` (same as Recovery controls).

## Runtime rules preserved

- Pausing recovery does **not** disable voicemail termination (copy + existing server pause semantics unchanged).
- Consent modes `press_1` / `existing_consent` unchanged; overview surfaces mismatch when messaging not ready under existing consent.

## Out of scope (later passes)

- Visual redesign of Phone, Recovery, Consent, Voicemail, Notifications, Exclusions, Test section bodies.
- Onboarding wizard polish.
- Per-number analytics scoping.
