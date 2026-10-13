# Unified Appointments — New UI2 Opus frontend replacement (policy)

**Branch:** `cursor/unified-appointments-restore-f350` · **PR #653** stays open until this policy is satisfied.

## Non-negotiables

1. **Replace** every retained Scheduling frontend with New UI2 Opus components — no wrapping legacy Kimi pages in Opus shells, no link hubs to unmigrated UIs.
2. **Preserve** backends: APIs, models, validation, provider rules, jobs. Reuse non-visual hooks and clients.
3. **No mixed design systems** on unified routes: no `kimi-ui`, `cal-drawer`, or legacy scheduling page shells in `newui-transplant` unified surfaces.
4. **Complete coverage:** all sidebar children and admin screens — see `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md` (regenerate with `npx tsx scripts/generate-unified-frontend-migration-matrix.ts`).

## Source of truth for visuals

- `src/newui-transplant/` — Opus layouts, kit, surfaces, appointment-reminders connected pages.
- Appointment Reminders pages are the visual baseline; extend that system — do not invent parallel Tailwind/shadcn layouts.

## Calendar (unified home) — Opus calendar components

| Capability | Opus component |
|------------|----------------|
| Filters | `ArCalendarFilterBar` |
| Quick create | `ArCalendarQuickCreateSheet` |
| Native appointment detail | `ArNativeAppointmentSheet` |
| Reschedule | `ArCalendarRescheduleSheet` |
| Waitlist match | `ArCalendarWaitlistSheet` |
| Recurring scope | `ArCalendarRecurringScopeDialog` |
| Imported calendar events | `AppointmentDetailDrawer` / `ArCalendarEventSheet` |

Legacy `components/appointments/calendar/*` remains **reference + backend wiring only** until each route is migrated.

## Release gate

Typecheck, tests, production build (CI), browser navigation across migrated routes, honest matrix status. Do not merge PR #653 until the matrix shows no unintended `legacy_kimi` on unified destinations.
