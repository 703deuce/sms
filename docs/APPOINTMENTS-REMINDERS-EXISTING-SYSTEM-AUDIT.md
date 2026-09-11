# Appointments Reminders — Existing System Audit

Route: `/appointments/reminders`. **Engine not rewritten** in this pass.

## Storage

| Piece | Location | Status |
|-------|----------|--------|
| Platform reminder sequence | `solutionSetup.configJson.reminders` via `loadAppointmentPlatformConfig` | **WORKING** |
| Core steps | `confirmation`, `reminder24h`, `reminder2h` (`ReminderStepConfig`) | **WORKING** |
| Extra steps | `reminders.additionalSteps[]` (id + step config) | **WORKING** (added UI + scanner support this pass) |
| Per-appointment override | `metadata.reminderOverride.customSteps` | **PARTIAL** (schema exists; delivery uses platform steps) |
| Per-calendar defaults | `voiceCalendarConnection.config.reminderDefaults` | **WORKING** |
| Sent tracking | `metadata.reminderSentKeys`, `reminderGeneration`, `timeline` | **WORKING** |

## Runtime / scheduler

| Piece | Module | Status |
|-------|--------|--------|
| Confirmation on book | `booking-platform.ts` | **WORKING** |
| Timed SMS/email scan | `reminder-delivery.ts` → `scanPlatformAppointmentReminders` | **WORKING** |
| Fire time | `minutesBefore` or `timeOfDay` on step | **WORKING** |
| Past-due skip | `markPastDueSkipped` | **WORKING** (last-minute bookings) |
| Cancel suppress | `suppressAppointmentReminders` / `remindersSuppressed` | **WORKING** |
| Reschedule reset | `resetAppointmentReminders` bumps generation | **WORKING** |
| Stop on reply | `stopRemindersAfterCustomerReply` | **WORKING** |
| Workflow guard skip | `shouldSkipPlatformRemindersForAppointment` | **WORKING** |
| SMS consent gate | `smsConsent === false` skips scan | **WORKING** |

## Channels

| Channel | Status |
|---------|--------|
| SMS | **WORKING** (`sendInternationalAppointmentSms`, platform number) |
| Email | **WORKING** (Brevo transactional + optional ICS) |
| Voice | **WORKING** (confirmation path + voice reminders product) |

## UI (before → after)

| Before | After |
|--------|-------|
| `ReminderSettingsView` — max-width 1100px, purple indigo cards | Full-width `RemindersWorkspaceConnected`, Home teal tokens, thin timeline rows |
| Three large `ReminderCard` panels | Horizontal sequence rows + drawer editor |
| No activity table | Activity from appointment `timeline` |
| No extra steps in UI | **Add reminder** → `additionalSteps` persisted |

## Gaps (honest)

| Gap | Classification |
|-----|----------------|
| Per-offering custom sequence on Service/Class | **MISSING** (assignment table shows Default only) |
| `reminderOverride.customSteps` in delivery | **PARTIAL** |
| Dedicated reminder job queue UI (scheduled jobs table) | **MISSING** (inferred from scan window) |
| Quiet hours global setting | **MISSING** (per-step skip off-hours only) |
| Post-appointment reminders | **NOT_APPLICABLE** (use Workflows) |
| Voice reminders on this page | **LEGACY** (channel option; product at `/appointments/voice-reminders`) |
