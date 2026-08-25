# Production Route Manifest — MCTB Only

Branch: `cursor/mctb-only-production-9cca`  
Archive: https://github.com/703deuce/smsarchive.git @ `81f06c16` (verified 2026-08-25)

## Customer-facing routes (live)

| Route | Purpose |
|-------|---------|
| `/dashboard` | MCTB overview |
| `/inbox` | SMS conversations |
| `/voice/missed-calls` | Missed call events |
| `/voice/missed-calls/[id]` | Missed call detail |
| `/voice/consent-log` | Press-1 / consent audit |
| `/voice/setup` | Text Back setup |
| `/voice/schedule` | Business hours / schedule |
| `/voice/try-it` | Try It demo (gated) |
| `/voice/analytics` | MCTB analytics |
| `/voice/numbers` | Number management |
| `/voice/numbers/buy` | Buy numbers |
| `/compliance` | Messaging compliance (TFV/A2P) |
| `/integrations` | Integrations hub |
| `/settings/**` | Account settings |
| `/settings/billing` | Billing |
| `/onboarding/mctb` | MCTB onboarding funnel |

## MCTB API routes (live)

| Route | Purpose |
|-------|---------|
| `/api/mctb/setup` | Setup persistence |
| `/api/mctb/onboarding` | Onboarding state |
| `/api/mctb/missed-calls` | Missed calls API |
| `/api/mctb/consent-log` | Consent log API |
| `/api/mctb/consent-prompt` | Consent prompt config |
| `/api/mctb/exclusions` | Exclusion list |
| `/api/mctb/analytics` | Analytics |
| `/api/mctb/try-it` | Try It session |
| `/api/mctb/demo` | Demo helpers |
| `/api/mctb/tfv` | Toll-free verification |
| `/api/mctb/live-test` | Live test |
| `/api/mctb/setup-test` | Setup test |
| `/api/telnyx/voice/mctb-consent` | Press-1 consent webhook |
| `/api/telnyx/voice/mctb-call-control` | Call control diagnostic |
| `/api/telnyx/voice/mctb-event-only` | Event-only capture |
| `/api/telnyx/voice/mctb-voice-bridge` | Telnyx voice bridge |
| `/api/twilio/voice/mctb-ingress` | Twilio MCTB ingress |
| `/api/public/mctb-request-form` | Public request form |
| `/api/telnyx/inbound` | Telnyx SMS inbound |
| `/api/telnyx/messaging` | Telnyx messaging |
| `/api/twilio/inbound` | Twilio SMS inbound |

## Removed routes (archived in smsarchive)

These **must not** have `page.tsx` / route handlers in production:

- `/smart-routing/**` — Smart Routing product UI
- `/realtor/**` — Realtor vertical
- `/personal/**` — Personal numbers
- `/marketplace/**` — Number marketplace
- `/voice/agents/**` — AI receptionist UI
- `/voice/receptionist` — Receptionist admin
- `/voice/campaigns` — SMS marketing
- `/voice/calls` — PBX call log
- `/grow/**` — Growth tools
- `/hire/**` — Hire product
- `/company-brain/**` — Company brain
- `/outcomes/**` — Outcomes launcher

Static check: `node scripts/verify-mctb-extraction.mjs`

## Shared runtime kept (not customer routes)

These libraries remain because MCTB imports them transitively:

- `src/lib/smart-routing/` — press-1 consent runtime (not SR product pages)
- `src/lib/mctb/` — all MCTB core
- `src/lib/agents/missed-call-text-back/` — MCTB agent runtime
- `src/lib/solutions/missed-call-text-back/` — setup persistence
- Partial CRM/voice platform (telephony provisioning chain)

Trace tool: `node scripts/trace-mctb-imports.mjs`

## Intentionally out of scope

- Hetzner / `voice.transovo.ai` self-hosted LiveKit
- `voice-runtime/` (archived to smsarchive)
- LiveKit Cloud voice routing (unless MCTB SMS path references it)
