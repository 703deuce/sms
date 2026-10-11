# Appointment Reminders — import eligibility v2 (permissive defaults)

## Product intent

Selected Outlook/Google calendars should produce **reminder candidates by default**. Import rules are **optional filters the customer turns on**, not hidden assumptions about “real appointments.”

**Appointment-level** eligibility (`reminderImportEligible`) is separate from **SMS delivery** (`evaluateSmsReminderEligibility`) and **email delivery** (`evaluateEmailReminderEligibility`).

Import ineligibility no longer calls `suppressAppointmentReminders()` (that flag is for user “stop reminders” and lifecycle cancel only).

## Default changes (schema v2)

| Rule | v1 default | v2 default |
|------|------------|------------|
| `requireOrganizerIsConnection` | `true` | `false` (opt-in filter) |
| `requireExternalAttendees` | `true` | `false` (opt-in filter) |
| `skipInternalDomainOnlyMeetings` | `true` | `false` (opt-in filter) |
| `skipFreeShowAs` | `true` | `false` (opt-in filter) |
| `useBuiltinTitleExcludes` | implicit on | `false` (opt-in; was hard-coded list) |
| `skipAllDay` | `true` | `true` (unchanged) |
| `skipTentativeShowAs` | `false` | `false` (unchanged) |
| `transovo_originated` | excluded | excluded (unchanged) |

## Migration for existing connections

- `config.importRulesSchemaVersion` — `undefined` or `1` = legacy.
- On read, `mergeImportRules()` → `mergeImportRulesWithMigration()`:
  - If stored rules match **legacy implicit UI defaults**, upgrade to v2 permissive defaults.
  - If customer changed any field away from legacy implicit, only those explicit deltas are preserved on top of v2 defaults.
- Saving calendar settings sets `importRulesSchemaVersion: 2` (`patchWorkspaceCalendarConnection`).

## Migration for existing appointments

- New metadata: `reminderImportEligible`, `reminderImportIneligibleReason`.
- Discovery uses `isAppointmentReminderImportEligible()` (legacy rows still blocked only for **import** reason codes on `reminderSmsIneligibleReason`).
- Re-sync after rule change: `shouldRecoverFromImportOnlySuppression()` + `resetAppointmentReminders()` when import becomes eligible again (does not override `reminderOverride.suppressed`).

## Code paths

| Area | File |
|------|------|
| Rules + evaluation | `src/lib/calendar/eligibility.ts` |
| Schema migration | `src/lib/calendar/import-rules-migration.ts` |
| Appointment gate | `src/lib/calendar/import-eligibility.ts` |
| Import apply | `src/lib/calendar/import-sync.ts` → `applyImportedReminderEligibility` |
| Discovery | `src/lib/appointment-reminders/reminder-discovery.ts` |
| Immediate confirmation | `src/lib/appointments/reminder-delivery.ts` |
| UI status | `src/lib/appointment-reminders/aggregate-reminder-status.server.ts` |
| Calendar UI | `src/newui-transplant/connected/integrations/calendar-integrations-opus.tsx` |

## Tests

- `src/lib/calendar/eligibility.test.ts`
- `src/lib/calendar/import-rules-migration.test.ts`
- `src/lib/calendar/import-eligibility.test.ts`
- `src/lib/calendar/import-rules.test.ts`
- `npm run test:appointment-reminders`

## Block reason catalog

See `docs/AR-CALENDAR-REMINDER-ELIGIBILITY-BLOCK-REASONS.md` (update v2 section when editing).
