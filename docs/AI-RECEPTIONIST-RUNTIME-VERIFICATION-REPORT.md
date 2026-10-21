# AI Receptionist — Runtime Verification Report

Branch: `cursor/ai-receptionist-two-modes-9779`  
Command: `cd new-app && npm run test:receptionist:runtime-verify`  
Date: 2026-10-21

No PSTN, no real SMS, no live Microsoft Graph in this pass.

## Results matrix

| Capability | Verdict | Evidence |
|------------|---------|----------|
| Mode switching → published tool allowlist | **PASS** | `compilePublishedBundle` / `enabledVoiceToolNamesFromEditor` — IVR vs Full; profile switch hides `book_appointment` while preserving saved caps |
| Publish compiler | **PASS** | `editorToVoiceV3AgentConfig` + `isVoiceV3ToolAuthorizedBase` per profile |
| Intake `update_intake` merge | **PASS** | `mergeIntakeUpdate` on field keys `i1` / `i2` with correction |
| Qualification compile | **PASS** | `qualificationConfigFromEditor` maps ZIP rule → field `i5`, operator `IN` |
| Callback `request_callback` persist | **BLOCKED** | `DATABASE_URL` unset in Cloud Agent VM |
| Booking link `send_booking_link` | **MOCK VERIFIED** | `executeSendBookingLink` with injected SMS deps; dedupe; failure path `ok: false` |
| Microsoft availability | **MOCK VERIFIED** | `findAvailability` + `AI_RECEPTIONIST_MS_SCHEDULING_MOCK=1` busy blocks |
| Microsoft booking | **MOCK VERIFIED** | `bookAppointment` → mock `microsoftCreateEvent` |
| Microsoft rescheduling | **MOCK VERIFIED** | `rescheduleAppointment` → mock patch |
| Microsoft cancellation | **MOCK VERIFIED** | `cancelAppointment` → mock delete |
| Microsoft OAuth / token refresh | **BLOCKED** | Requires live `voiceCalendarConnection` + OAuth env |
| Microsoft live Graph | **BLOCKED** | No authorized test tenant/calendar in this environment |
| Spam screening tool | **PASS** | Solicitor `action: end` → `DECLINE` → `report_unwanted_solicitor` authorized |
| Draft vs live mode (UI) | **PASS** | `receptionistModeStatusCopy` in sidebar, overview, operating mode selector |
| Frontend browser editors | **BLOCKED** | `test:receptionist` HTTP suite requires app on `:3001` (not running in verify pass) |
| Static two-mode / IVR profile | **PASS** | `test-ai-receptionist-two-modes.mjs`, `test-conversational-ivr-profile.mjs` |

## Mock gate (tests only)

When `AI_RECEPTIONIST_MS_SCHEDULING_MOCK=1`, `resolveSchedulingBackend` and Microsoft Graph helpers use in-memory stand-ins (`microsoft-scheduling-verify-mock.ts`). **Not enabled in production.**

## Recommended next steps

1. Run callback persist with isolated `DATABASE_URL` tenant.
2. Run live Microsoft cert against authorized test calendar (OAuth refresh, real create/patch/delete).
3. Start `new-app` and run `test:receptionist` + manual PSTN smoke after mock/live Microsoft pass.
