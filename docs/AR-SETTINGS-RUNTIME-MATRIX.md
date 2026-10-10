# Appointment Reminders — settings ↔ runtime matrix

Authority: workspace `solutionSetup` row (`solutionType: appointments-platform`) via `loadAppointmentPlatformConfig` / `saveAppointmentPlatformConfig`.

## Certification policy (live)

Do **not** treat manual DB-only appointments or immediate-only smokes as proof of production behavior.

**Canonical E2E:**

1. Book through **Microsoft Graph** (or sync/import with real `providerRef`).
2. Let **reminder discovery** enqueue at the configured offset (`minutesBefore` on `reminder24h`, `reminder2h`, `additionalSteps`).
3. Optional: inbound **R / X / C** on the platform sender thread.

Scripts:

- `scripts/ar-prod-microsoft-2h-reminder-live.ts` — Graph create + 2h discovery + dispatch
- `scripts/ar-prod-verify-reschedule.ts` — Graph + DB parity after reschedule

## UI → API → runtime

| Surface | API | Runtime consumers |
|--------|-----|-------------------|
| Reminder steps (timing, channel, template, send-time flags) | `PATCH /api/appointment-reminders/settings` | `configuredReminderSteps`, `discoverAndEnqueueDueAppointmentReminders`, `executeArReminderDispatch` |
| Scheduling prefs (lead time, service rules, default channel) | same | `reminder-scheduling-policy.ts`, discovery filters |
| Weekly hours + timezone | same | `resolveWeeklyHours`, `shouldSkipReminderSendNow` |
| Business profile / email branding | same | `reminderAppointmentMergeVars`, email HTML |
| Template library / presets | `apply-template`, `presets` | `saveAppointmentPlatformConfig` + platform template policy |
| AI Rescheduler | `PATCH /api/appointment-reminders/ai-rescheduler` | `resolveAiReschedulerConfig`, `run-turn`, slot validation |
| Per-appointment reminder contact | `PATCH .../reminder-contact` | metadata on send + eligibility |
| Test send | `POST .../reminders/test` | real transport; uses same templates as production |

## Send-time controls

`skipWeekends`, `skipClosedDays`, and `skipOffHours` on each step feed `resolveEffectiveReminderFireTime`:

1. Compute the **nominal** offset from `minutesBefore` / `timeOfDay`.
2. If restrictions block that instant, shift to the **latest permitted time before** the nominal instant (respecting appointment `createdAt` and a 14-day lookback).
3. If no prior window exists (e.g. booked too late), use the **earliest permitted time after booking** and before `startsAt`.
4. If still none, record dispatch `suppressed` with `no_allowed_send_window`.

Discovery enqueues when `now` is within tolerance of the **effective** fire time (not the nominal offset). Appointment timeline preview uses the same resolver.

Optional `reminderQuietHours` applies when `skipOffHours` is enabled.

## Verification

```bash
npx tsx scripts/verify-ar-settings-runtime.ts
npx tsx src/lib/appointment-reminders/reminder-send-time-policy.test.ts
npx tsx src/lib/appointment-reminders/reminder-scheduling-policy.test.ts
```
