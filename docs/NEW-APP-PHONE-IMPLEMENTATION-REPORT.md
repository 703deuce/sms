# New-app Phone product — implementation report

**Branch:** `cursor/new-app-phone-product-f350` (target)  
**Scope:** Greenfield Phone backend + frontend integration in `new-app/` per full product assignment.

## A. Implementation summary

### Delivered

- **Prisma domain:** Extended `HumanCall`, `WorkspacePhoneSettings`; added `HumanCallNote`, `WorkspaceCallRouting`, `PowerDialerCampaign`, `PowerDialerSession`, `PowerDialerAttempt`, `TelnyxWebhookDedup` (+ migration `20261019120000_phone_greenfield_product`).
- **Server layer** under `new-app/lib/server/phone/`: calls, settings, routing, analytics, readiness, WebRTC token, power dialer, webhook processing; `new-app/lib/server/contacts.ts` for lists/search/import.
- **API routes:** `/api/phone/*`, `/api/contacts/search`, `/api/telnyx/phone` webhook ingress.
- **Client:** `@telnyx/webrtc` in `WorkspaceProvider` (real outbound registration + media); `lib/phone-api.ts`; UI mapping `lib/phone-ui-map.ts`.
- **Pages wired:** Overview, Dialer, Calls list/detail, Call Handling (persisted policy + greeting), Analytics (live range), Numbers via existing inventory.
- **Power Dialer:** Campaign/list/session/attempt APIs; UI still uses legacy layout — **Session tab needs full client rewrite** to call session/next/attempt endpoints (see blockers).

### Replaced mocks

- Overview KPIs, recent calls, numbers panel, campaign summary → DB/API.
- Calls list (phone variant) → paginated `/api/phone/calls`.
- Call detail → server `getCallDetail`.
- Dialer caller ID + contacts + recent outbound → Numbers provider + APIs.
- Active call bar → live WebRTC path (no simulated timers).
- Analytics charts → `/api/phone/analytics`.

### Still using fixtures (non-Phone variants / partial)

- `CallsTable` for `receptionist` / `mctb` variants still reads `lib/data.ts` `CALLS`.
- **Power Dialer UI** (`power-dialer.tsx`) largely still seeded from `CAMPAIGNS` / `LISTS` / `DIALER_QUEUE` — APIs exist but UI not fully rewired.
- Voicemail runtime (greeting playback on no-answer, `VoicemailMessage` creation from Telnyx) — webhook stub updates calls; full voicemail pipeline not ported from monolith `voicemail-service.ts`.
- Inbound browser ring: webhook creates `HumanCall`; **TelnyxRTC incoming notification handler** not fully ported from `softphone-panel.tsx`.
- Call recording start on answer — not wired to Telnyx `record_start` in this pass.
- Settings → Phone & audio toggles — API exists; settings UI not wired to PATCH.

## B. Database

See migration and schema changes above. Single internal user via `resolveInternalUserId()`; workspace via `resolveWorkspaceId()`.

## C. APIs

| Route | Purpose |
|-------|---------|
| `GET /api/phone/readiness` | Telnyx + lines + default caller ID |
| `GET/PATCH /api/phone/settings` | Business phone prefs |
| `GET /api/phone/webrtc-token` | Telnyx login token |
| `GET/POST /api/phone/calls` | List + outbound register / link control / inbound answer |
| `GET/PATCH /api/phone/calls/[id]` | Detail + handled/disposition/notes |
| `GET /api/phone/calls/[id]/recording` | Recording URL |
| `GET/PATCH /api/phone/routing` | Policy + business hours |
| `GET /api/phone/analytics` | Aggregates |
| `GET/POST /api/phone/power-dialer/campaigns` | Campaign CRUD (create) |
| `PATCH /api/phone/power-dialer/campaigns/[id]` | Campaign update |
| `GET/POST /api/phone/power-dialer/lists` | Lists |
| `POST /api/phone/power-dialer/lists/import` | CSV rows |
| `POST /api/phone/power-dialer/sessions` | Start session |
| `GET/PATCH /api/phone/power-dialer/sessions/[id]` | Next contact / pause / end |
| `PATCH /api/phone/power-dialer/attempts/[id]` | Disposition |
| `GET /api/contacts/search` | Dialer lookup |
| `POST /api/telnyx/phone` | Signed webhook ingress |

Mutations honor `TRANSOVO_DEV_API_KEY` when set (`x-transovo-dev-key` header).

## D. UI wiring

| Surface | Status |
|---------|--------|
| Overview | Server-driven real data |
| Dialer | API + WebRTC |
| Calls | API pagination |
| Call detail | Server fetch + PATCH actions |
| Call handling | PATCH routing + greeting text |
| Analytics | Client fetch by range |
| Power Dialer | **API only — UI incomplete** |
| Global call bar | WebRTC state |
| Numbers | Existing `NumbersProvider` |

## E. Tests

- Script: `new-app/scripts/test-phone-greenfield.mjs` (HTTP smoke against dev server).
- **Not run in CI here** without `DATABASE_URL` + `next dev` + Telnyx credentials.
- Prisma generate + `pnpm typecheck` should be run locally after `cp ../prisma prisma` in `new-app/`.

## F. Remaining blockers

1. **Telnyx env:** `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID` or `TELNYX_CALL_CONTROL_APP_ID`, `TELNYX_TELEPHONY_CREDENTIAL_ID`, `TELNYX_PUBLIC_KEY` for webhooks, `DATABASE_URL` (greenfield).
2. **Power Dialer UI** — rewire `power-dialer.tsx` to campaigns/lists/sessions APIs + campaign create drawer.
3. **Inbound WebRTC** — port incoming notification + answer flow from legacy softphone.
4. **Voicemail + recording** — port `voicemail-service` + record start from monolith.
5. **Provider routing sync** — policy saved to DB; Telnyx connection/TexML application sync not implemented.
6. **Live PSTN** — requires real credentials; cannot certify from mocked responses alone.

## Governing routing note

`WorkspaceCallRouting.policyJson` is the shared store for AI Receptionist / MCTB extension — no duplicate Phone-only routing table beyond this.
