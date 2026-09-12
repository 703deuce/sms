# MCTB Voicemail — existing system audit

Date: 2026-09-12 (implementation pass)

## Routes

| Route | Role | Shell |
|-------|------|-------|
| `/mctb/voicemail` | **Canonical MCTB visual voicemail workspace** (`MctbVoicemailWorkspace`) | MCTB (`/mctb/*`) |
| `/personal/voicemail` | Numbers/Personal product voicemail (`PersonalVoicemailUI`) | Personal/Numbers nav |
| `/voice/voicemail` | Redirect → `MCTB_ROUTES.voicemail` | MCTB after redirect |
| `/mctb/setup/voicemail` | MCTB setup editor | MCTB |

## Entitlements

- `hasMctbBundledVoicemailAccess` on both MCTB and personal pages → `AddOnUpgradeCard` when false.

## APIs (preserved)

- `GET /api/phone/voicemail?phoneNumberId=` — boxes + messages (all workspace messages when no `phoneNumberId`; per-number when set).
- `POST /api/phone/voicemail` — `ensure_number_box`, `ensure_personal`, `update_box`, `mark_read`, `mark_unread`, `mark_resolved`, `needs_callback`, `delete_message`, `update_message_notes`, `retranscribe`.
- `GET /api/phone/voicemail/[id]/recording` — signed/protected playback.
- `POST /api/mctb/exclusions` — block caller from voicemail overflow.

## Models (unchanged)

- `voicemailBox`, `voicemailMessage` via Prisma / `voicemail-mappers.ts`.
- Greeting: `greetingUrl`, `greetingText`, active greeting provisioning via `voicemail-active-greeting`.
- Alerts: `emailNotify`, `secondaryEmailNotify`, `smsNotifyE164`, `transcriptionEnabled`.

## Personal UI (`PersonalVoicemailUI`) — legacy layout

| Control | Classification | Notes |
|---------|----------------|-------|
| 3-column equal layout + left Greeting Library | REPLACED on MCTB | MCTB uses 36/42/22 workspace |
| Sort dropdown | NO_OP (personal) | No state wiring |
| View All (Recent Activity) | NO_OP | Removed on MCTB (duplicate inbox) |
| Wireframe/demo data | READ_ONLY | `usePersonalWireframe` always false in prod |
| Voicemail minutes KPI | PARTIAL | Label "This month" but summed all messages — fixed on MCTB |
| Pagination default 5 | PARTIAL | MCTB uses global default 10 |
| Settings toggles | PARTIAL | Batch save via Save Settings |
| Greeting library Play/Edit | NO_OP | MCTB: library inside Change greeting drawer |

## MCTB workspace (`MctbVoicemailWorkspace`)

| Area | Status |
|------|--------|
| MCTB shell | CONNECTED |
| Inbox search/filter/sort/pagination | CONNECTED |
| Message detail playback/actions/notes | CONNECTED |
| Greeting preview/change/record/upload/generate | CONNECTED via `PersonalGreetingControls` |
| Settings + alerts + forwarding context | CONNECTED (per-number save) |
| Test voicemail modal | CONNECTED (instructions) |
| Mobile inbox → full-screen detail | CONNECTED |
| Tablet utility drawer | CONNECTED |

## Backend changes this pass

- **YES (minimal):** `GET` all-numbers inbox uses all boxes’ messages; `mark_unread` action added; notification deep links → `/mctb/voicemail`.

## Security

- All mutations scoped by `workspaceId` in API (unchanged).
- Recording URLs via authenticated recording route (unchanged).
