# Appointments Availability — Runtime Precedence

This document traces **actual** slot generation in the Transovo Appointments product.
Canonical entry: `getAvailability` → `generateNativeSlots` (`src/lib/appointments/availability-engine.ts`),
post-filtered by `filterSlotsByResourceAvailability` (`src/lib/appointments/service-booking/resource-availability.ts`).
Booking validation reuses the same engine via `assertSlotAvailableForBooking` (`src/lib/appointments/slot-validation.ts`).

> **Not covered here:** Voice calendar `getAvailability` (`src/lib/voice/calendar/booking.ts`) — separate legacy path.

## Per-staff day windows (`windowsForStaffDay`)

File: `src/lib/appointments/staff-availability.ts`

1. Holiday entry for date — if `closed`, no windows; if `windows`, use holiday windows.
2. Staff `dateOverrides` for date — closed or custom windows.
3. Platform `dateOverrides` for date — closed or custom windows.
4. Staff or platform `blackoutDates` — no windows.
5. Weekly hours: staff `weeklyHours` → else named schedule (`svcCfg.namedScheduleId`) → else platform default (`resolveWeeklyHours`).

## Workspace day loop (`generateNativeSlots`)

For each calendar day in range:

1. Skip if platform `dateOverrides[date].closed` or `blackoutDates` includes date.
2. Skip if holiday `closed` for date.
3. Day windows: override windows → holiday windows → weekly hours (location hours if `locationId`, else named schedule, else platform).
4. Intersect with service `bookingHours` (weekdays-only, start/end hour) when configured.
5. For each candidate start (fixed starts or interval grid from `fixed-start-times.ts`):
   - Reject if before **minimum notice** (max of platform + service notice).
   - Reject if outside **maximum booking horizon** (`daysAhead` capped by platform/service).
   - Reject on **group capacity** at same start time.
   - Reject on **appointment busy index** (existing bookings + buffers) when staff modes do not apply per-staff filtering.
   - Reject on **workspace external calendar busy** (`getExternalBusyIntervals`).
   - Reject on **booking limits** (daily/weekly/per-type) from preloaded counts.
   - **Staff modes** (`round_robin`, `collective`, `customer_chooses`, `specific_staff`, `maximize_availability`): `filterStaffAvailableForSlot` requires any/all eligible staff to pass staff windows, per-staff external busy, and per-staff appointment conflicts.
6. Post-process: minimize gaps ranking, fixed-start filter, availability density hide %.

## Eligibility intersection (before day loop)

- **Staff ↔ service:** `resolveEligibleStaff` uses `svcCfg.staffIds` (and collective ids) intersected with active `platform.staff`; staff `appointmentTypeIds` used when type does not pin `staffIds`.
- **Staff ↔ location:** `filterStaffIdsForLocation` when `locationId` is passed.
- **Resources:** After slot list built, `filterSlotsByResourceAvailability` removes starts where required `resourceIds` (and phase resources via effective duration) exceed `SchedulingResource.quantity` for overlapping bookings.

## Service-level overrides of workspace defaults

`loadAvailabilityContext` merges:

| Setting | Rule |
|---------|------|
| `minimumBookingNoticeMinutes` | **Max** of platform and service |
| `maximumBookingDaysAhead` | Service overrides platform |
| Buffers | Service `bufferBeforeMinutes` / `bufferAfterMinutes` (+ service row `bufferMinutes`) |
| `schedulingLimits` | Service overrides platform (interval, fixed starts, density, minimize gaps) |
| Duration | Service row minutes; phased services use `resolveEffectiveTypeDurationMinutes` |

## Known gaps (honest)

- **Phase-level provider release / resource occupancy windows** (`staff-phase-occupancy.ts`, `validatePhasedSlot`) are **not** wired into `generateNativeSlots`; duration sums phases but staff blocking uses full effective duration unless runtime elsewhere compensates.
- **Staff-specific date overrides** are supported in runtime but only editable on Staff page today; Availability overrides section edits **platform** overrides.
- **Location weekly hours** apply when preview/booking passes `locationId`; Availability preview UI exposes location selector but slot API wiring should pass `locationId` when extended (currently preview filters client-side by staff only).

## Override precedence test recipe

Controlled scenario for QA:

1. Platform hours 9–5 Mon–Fri.
2. Staff Alex custom 10–4 (`platform.staff[].weeklyHours`).
3. Platform override on date: 12–3 custom windows.
4. Calendar busy 1–2 PM on Alex connection.
5. Service 60 min, 15 min buffers.

Expected: slots only where **all** of: within intersected windows, notice/horizon, staff windows (staff override wins over platform for that staff), calendar busy excluded, duration fits window, resources available, limits not exceeded.

Document actual results in test runs; do not assume without executing against `GET /api/appointments/availability` and `GET /api/appointments/diagnostics/slots?explain=true`.
