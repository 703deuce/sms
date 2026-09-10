# Page Blueprint — Availability (Batch 8B-1)

**Route:** `/appointments/availability`  
**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY  
**Primary user job:** Tell Transovo when customers are allowed to book.

## Page structure

1. **Regular hours** — `WeeklyHours` + `BookingRules` (timezone, minimum notice, booking horizon) in main shell
2. **Special dates** — `SpecialDatesSection` (overrides, blackouts, holidays) with drawer add flow
3. **Booking rules** — `SchedulingRulesSection` (start interval, fixed start times)
4. **Booking limits** — workspace caps in connected shell
5. **Named schedules** — reusable hour templates
6. **Schedule preferences** — `SchedulePreferencesSection` (reduce gaps, show fewer times, external calendar link)
7. **Check availability** — `SlotDiagnosticsPanel` admin tool

## Controls

| Section | Control | Backend | Parity absorbed |
|---------|---------|---------|-----------------|
| Special dates | Add special date drawer (closed/custom/holiday) | `dateOverrides`, `blackoutDates`, `holidays` | Commerce/parity blackout blocks |
| Booking rules | Appointment start interval | `slotStepMinutes` / `schedulingLimits.customStartIntervalMinutes` | Parity schedule |
| Booking rules | Only allow specific start times | `fixed-start-times.ts` | Parity |
| Preferences | Reduce gaps in schedule | `minimize-gaps.ts` | Parity compact scheduling |
| Preferences | Show fewer available times | `availability-density.ts` | Make Me Look Busy |
| Preferences | Manage calendars | Integrations → Calendars | `scheduling-domain.ts` external busy |
| Diagnostics | Check a time (type, date, time, staff, location) | `slot-diagnostics.ts`, `availability-engine.ts` | Parity diagnostics |

## Runtime-only (no admin toggle)

- Collective / group scheduling — configured on booking types
- Resource-constrained availability — Service + Rooms & Equipment
- Atomic booking / slot validation — runtime protections

## Status

ABSORBED_CANONICAL_UI for listed controls. STILL_MISSING: room/equipment field in diagnostics query (optional).
