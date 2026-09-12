# MCTB Voicemail — existing system audit

Date: 2026-09-12. Canonical route: `/mctb/voicemail`.

## Architecture

- **Page:** `src/app/(app)/mctb/voicemail/page.tsx` — entitlement `hasMctbBundledVoicemailAccess`, loads `loadPersonalNumbers`, renders `MctbVoicemailWorkspace`.
- **Presentation:** `src/components/mctb/voicemail/mctb-voicemail-workspace.tsx` wraps shared personal voicemail APIs (no parallel engine).
- **Shared personal UI:** `src/components/personal/personal-voicemail-ui.tsx` (legacy full mockup layout); MCTB uses workspace, not duplicate runtime.
- **Greeting / ElevenLabs:** `PersonalGreetingControls` + `GreetingVoicePicker` → `/api/smart-routing/audio/generate`, `/api/smart-routing/audio/upload`.
- **Setup drill-down:** `MCTB_ROUTES.setupVoicemail` (`/mctb/setup/voicemail`).

## Query params

- `numberId` — filter inbox + per-number settings/greeting.
- `id` — pre-select message.

## APIs (`/api/phone/voicemail`)

| Action | Purpose |
|--------|---------|
| GET | boxes, messages, summary (total, unread, minutes this month) |
| ensure_number_box / ensure_personal | create box |
| mark_read / mark_unread | read state |
| mark_resolved | resolution |
| needs_callback | callback request (entitlement) |
| delete_message | delete |
| update_message_notes | internal notes |
| retranscribe | Whisper re-run (Telnyx) |
| update_box | greeting, emails, SMS notify, transcription |

Recording playback: `/api/phone/voicemail/[id]/recording`.

## Message capabilities

Playback, speed, download, transcript, English translation field, AI summary, notes, callback (`BusinessCallBackButton`), block (`/api/mctb/exclusions`), overflow actions.

## Greeting

Record (MediaRecorder), upload, ElevenLabs generate, default script, active URL via `provisionActiveVoicemailGreeting` on box update.

## Entitlement

`AddOnUpgradeCard feature="visual_voicemail"` when not entitled.

## Premium pass (this branch)

- `MctbVoicemailGreetingStudio` drawer (640–704px) with explicit activation for generated audio.
- Inbox default page size **5**; options 5/10/20.
- 32 / 42 / 26 desktop grid; no duplicate message list (personal wireframe activity list not copied).
