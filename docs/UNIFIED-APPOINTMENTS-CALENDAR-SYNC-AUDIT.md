# Unified Appointments — Calendar sync audit (code evidence)

**Date:** 2026-10-13  
**Scope:** Read-only trace of native create, import, write-back, and reminder eligibility. No new calendar engine.

## Summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Native Transovo create → Microsoft write? | **Yes (when connected)** via `bookAppointment` → `insertMicrosoftEvent`; AR pipeline also has **Microsoft-only** `processArCalendarWriteBackJob`. |
| 2 | Native create → Google write? | **Yes (when connected)** via `bookAppointment` → `insertGoogleEvent`. AR write-back job **skips** non-Microsoft today. |
| 3 | Imported events alongside native? | **Yes** — `import-sync.ts` upserts `VoiceAppointment` rows with `formatImportedExternalId`. |
| 4 | Native + imported in reminders? | **Mostly yes** — AR/reminder engines key off `VoiceAppointment` + eligibility rules; imported rows participate when marked eligible (provider metadata). |
| 5 | ID mapping? | **Yes** — `external-id.ts`, imported `google\|microsoft:connectionId:eventId`, metadata `providerEventId` / `connectionId`. |
| 6 | Updates / cancel / reschedule propagation? | **Partial** — `external-sync.ts` for Transovo-booked cancel/reschedule; import path updates external-owned rows; AR Microsoft write-back for AI reschedule mutations. |
| 7 | Duplicate prevention (write then re-import)? | **Yes (intended)** — `findExistingAppointment` + `isTransovoOwnedProviderEvent` in `import-sync.ts`. |
| 8 | Disconnected calendar? | Write-back fails/skips; import jobs use `JobFailedError` for permanent auth; connection `disconnected` skips AR write-back. |
| 9 | Bidirectional vs read-only? | **Per connection + event ownership** — Transovo-booked events sync out; external-created import as read-only unless policy allows edit. |
| 10 | Google ↔ Outlook cross-sync? | **No** — each provider syncs with Transovo only; no direct G↔O bridge. |

## Key code paths

### Native booking (scheduling + voice calendar)

- `src/lib/appointments/booking-platform.ts` → `bookAppointment` (`src/lib/voice/calendar/booking.ts`)
- On success, stores provider `externalId` and `metadata.source: "transovo"` when calendar write succeeds.

### Calendar import (Outlook / Google → Transovo)

- `src/lib/calendar/import-sync.ts` — connection sync jobs, dedupe, Transovo-owned detection.

### AR Microsoft write-back (reminders / rescheduler)

- `src/lib/appointment-reminders/calendar-write-back/process-job.ts` — **Microsoft only** (`provider !== "microsoft"` → skipped).

### Cancel / reschedule write-back (Transovo-owned)

- `src/lib/calendar/external-sync.ts` — `syncExternalCalendarOnCancel` / `OnReschedule` when `shouldSyncToNativeCalendar` / Transovo-booked external id.

## Verified gaps (fix in follow-up, not assumed)

1. **AR write-back** does not mirror Google mutations the way `bookAppointment` does on create.
2. **Admin UI** native create paths must all funnel through `booking-platform` / `bookAppointment` — spot-check any legacy form that writes `VoiceAppointment` without calendar insert.
3. **Reminder eligibility** for read-only imports — confirm product rules in AR settings (do not treat as editable native).

## Environment flags

- `UNIFIED_APPOINTMENTS=0` — disable merged nav (AR-only sidebar).
- `UNIFIED_APPOINTMENTS=1` — force merged nav even if launch flags change.
