# Unified Appointments — shell, navigation, and frontend migration status

**Branch:** `cursor/unified-appointments-restore-f350` · **PR:** #653  
**Updated:** 2026-10-13

## Release gate summary

| Area | Status | Notes |
|------|--------|--------|
| Shell consistency | **In progress** | `isSchedulingOpusChromePath()` applies dark Opus shell to all `/appointments/**` and `/appointment-reminders/**` when unified scheduling is active. Gray `TransovoSidebar` must not render on those URLs (`shouldUseNewUiShell` + no legacy fallback). |
| Navigation consistency | **In progress** | Unified mode: **only** `buildUnifiedAppointmentsNav()` via `buildSchedulingOpusSidebarNav()`. No `buildAppointmentRemindersNav()` / `buildAppointmentsV1Nav()` split across route families. Calendar (`/appointment-reminders`) is product home — no separate Overview nav item. |
| Collapse behavior | **Implemented** | Opus `AppSidebar`: chevron toggle, auto-expand active parent, manual collapse. |
| Complete frontend migration | **Not complete** | See `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md`. Many routes still render legacy *visual* clients inside `schedulingAdminGate` (no `SchedulingOpusEmbed`). |
| Functional parity | **Ongoing** | APIs/hooks preserved; browser verification required per route list below. |
| Env alignment | **Required in prod** | Set `UNIFIED_APPOINTMENTS=1` so shell, nav, and `SchedulingPageGate` agree. Without it, AR-primary defaults may still split chrome. |

## Canonical navigation (unified mode)

Source: `buildUnifiedAppointmentsNav()` in `src/lib/products/unified-appointments-nav.ts`  
Resolver: `buildSchedulingOpusSidebarNav()` → `appointmentRemindersNavSections()` → Opus `AppSidebar`.

## Frontend migration — embed removal

- **`SchedulingOpusEmbed`**: removed from gate helper; replaced with `schedulingAdminGate` (`SchedulingOpusPage` only).
- **Native Opus pages wired**: waitlist (`waitlist-admin-opus.tsx`), workflows (`workflows-list-opus.tsx`), plus existing complete routes in matrix.
- **Remaining**: routes still using legacy JSX inside Opus page shell (team booking, segments, policies, classes/workshops Kimi workspaces, booking settings client, etc.) — must be replaced with New UI2 visual trees per matrix.

## Browser verification checklist

Same dark shell + same sidebar on all:

- `/appointment-reminders`
- `/appointment-reminders/appointments`
- `/appointment-reminders/ai-rescheduler`
- `/appointment-reminders/booking`
- `/appointments/services`
- `/appointments/scheduled`
- `/appointments/availability`
- `/appointments/clients`
- `/appointments/workflows`
- `/appointments/commerce`
- `/appointments/analytics`

Nested groups: expand/collapse chevrons; active child highlighted; parent auto-opens on navigation.

## Do not mark migration complete until

1. Matrix has no unintended `legacy_kimi` / `opus_partial` embed on unified destinations (except explicit `platform_shared`).
2. Every retained route’s **rendered visual tree** uses `newui-transplant` Opus components only.
3. Functional regression checks pass on the checklist above.
