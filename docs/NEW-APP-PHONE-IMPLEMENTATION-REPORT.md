# New-app Phone product — implementation report

**Branch:** `cursor/new-app-phone-product-f350`  
**Status:** Greenfield Phone backend + UI wiring + **runtime pass** (inbound routing, voicemail, recording hooks). Live PSTN/WebRTC still requires controlled Telnyx certification.

## Routing model (locked)

**Dynamic execution — no Telnyx connection sync.** Inbound calls hit `/api/telnyx/phone`; each event loads `WorkspaceCallRouting` + business hours from the DB and issues Call Control actions (ring browser / voicemail / transfer). Saving Call Handling updates DB only; the webhook applies policy on the next call.

## A. Implementation summary

### Implemented

- **Prisma domain:** Extended `HumanCall`, `WorkspacePhoneSettings`; added `HumanCallNote`, `WorkspaceCallRouting`, Power Dialer models (`PowerDialerCampaign`, `PowerDialerSession`, `PowerDialerAttempt`), `TelnyxWebhookDedup`. Migration: `prisma/migrations/20261019120000_phone_greenfield_product/`.
- **Server (`new-app/lib/server/phone/`):** Calls CRUD, WebRTC outbound registration, inbound webhook processing, routing persistence, analytics aggregations, readiness, WebRTC token, Power Dialer orchestration.
- **APIs:** `/api/phone/*` (readiness, settings, webrtc-token, calls, recording, routing, analytics), `/api/phone/power-dialer/*`, `/api/contacts/search`, `/api/telnyx/phone` webhook.
- **Client:** `lib/phone-api.ts`, `workspace-provider.tsx` (TelnyxRTC, outbound, inbound offer/answer), Power Dialer UI wired to APIs, dialer/calls/overview/analytics/call-handling/settings preferences.

### Mocks replaced (Phone paths)

- Overview, calls list (phone variant), call detail server fetch, dialer (numbers + contacts + recent calls), routing editor save, analytics range, active call bar (live state), Power Dialer campaigns/lists/session.

### Still fixture-driven (out of Phone scope or other products)

- Receptionist/MCTB call tables, global search calls/campaigns, home recent activity, contacts list pages.

### Reused

- Numbers inventory (`/api/numbers/*`, `numbers-provider`), contacts Prisma models, Telnyx client patterns from monolith (reference only).

## B. Database

See migration SQL and `prisma/schema.prisma` fields: `HumanCall.phoneNumberId`, `source`, `handled`, `callbackNeeded`, `metadata`; `HumanCall.callNotes` relation (not `notes` scalar).

## C. APIs

| Route | Role |
|-------|------|
| GET/PATCH `/api/phone/settings` | Business phone prefs |
| GET `/api/phone/readiness` | Lines + Telnyx readiness |
| GET `/api/phone/webrtc-token` | Browser login token |
| GET/POST/PATCH `/api/phone/calls` | History, outbound register, link control, inbound answer |
| GET/PATCH `/api/phone/calls/[id]` | Detail + notes/disposition |
| GET `/api/phone/calls/[id]/recording` | Authorized recording URL |
| GET/PATCH `/api/phone/routing` | Call handling policy |
| GET `/api/phone/analytics` | Aggregates + campaigns |
| `/api/phone/power-dialer/**` | Campaigns, lists, import, sessions, attempts |
| POST `/api/telnyx/phone` | Provider webhooks (signed) |

## D. UI wiring

| Surface | Route | Data source |
|---------|-------|-------------|
| Overview | `/app/phone` | Server + analytics API |
| Dialer | `/app/phone/dialer` | WebRTC + calls API |
| Power Dialer | `/app/phone/power-dialer` | Power dialer APIs |
| Calls | `/app/phone/calls` | Paginated calls API |
| Call detail | `/app/phone/calls/[id]` | Call detail API |
| Call handling | `/app/phone/call-handling` | Routing API |
| Analytics | `/app/phone/analytics` | Analytics API |
| Settings prefs | `/app/settings?tab=preferences` | PATCH settings |
| Global | Active + incoming bars | `workspace-provider` |

## E. Tests

| Check | Result |
|-------|--------|
| `pnpm typecheck` (new-app) | **PASS** (prisma client generated; `prisma/` excluded from tsc) |
| `prisma validate` (root schema) | **PASS** with `DATABASE_URL` set |
| `scripts/test-phone-greenfield.mjs` | Requires `next dev` + DB — run in dev environment |
| Live Telnyx outbound/inbound | **Not run** in cloud agent (credentials/PSTN) |

## Runtime pass (this iteration)

| Area | Change |
|------|--------|
| Inbound | `inbound-runtime.ts` — workspace from called number, route decision, ring timeout → voicemail, reject → voicemail/missed |
| Webhook | `/api/telnyx/phone` — dedup, inbound initiate, due ring timeouts, voicemail greeting events |
| Voicemail | `voicemail-runtime.ts` — greeting playback/speak, record_start, `VoicemailMessage` + recording.saved attach |
| Recording | `recording-runtime.ts` — `recordCalls` → `record_start` on answer (webhook + inbound answer) |
| Dev keys | Removed `NEXT_PUBLIC_*` key; `assertDevApiAccess` allows same-origin browser, optional `x-transovo-dev-key` for scripts |

## F. Remaining blockers

1. **Live Telnyx certification:** Browser register, PSTN→browser, browser→PSTN, voicemail clip on real call — not executed in cloud agent.
2. **External forward target:** `duringHours=external` uses `PHONE_INBOUND_EXTERNAL_FORWARD` until policy stores an E.164.
3. **AI receptionist route:** `duringHours=ai` falls through to ring browser (extension point only).
4. **Transcription:** Voicemail transcript stays `pending` without STT worker hookup.

## Final acceptance (honest)

Complete for **architecture + persistence + UI wiring** in single-client mode. **Production-ready PSTN** requires live credential certification per assignment §39.
