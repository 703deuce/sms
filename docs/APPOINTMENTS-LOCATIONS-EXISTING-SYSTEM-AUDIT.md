# Appointments Locations — Existing System Audit

| Area | Status | Notes |
|------|--------|-------|
| Location model | WORKING | `AppointmentLocation` in `solutionSetup.configJson` (`platform.locations`) |
| Physical / virtual / customer / phone kinds | WORKING | `kind` field on location |
| Service ↔ Location | WORKING | `location.appointmentTypeIds` + `voiceService.config.locationIds` (sync added) |
| Staff ↔ Location | WORKING | `location.staffIds` + `staff.locationIds` (bidirectional sync) |
| Location hours | WORKING | `location.weeklyHours` via `resolveLocationWeeklyHours` |
| Availability engine | WORKING | Uses location hours in `availability-engine.ts` |
| Staff filter by location | WORKING | `filterStaffIdsForLocation` |
| Resources | WORKING | `location.resourceIds` + `schedulingResource.locationIds` |
| Public booking | WORKING | `locationId` on book payload + metadata |
| Routing | WORKING | Filters staff by location |
| Team Booking | PARTIAL | Uses location constraints via shared platform config |
| Timezone per location | PARTIAL | `location.timezone` + `resolveLocationTimezone` |
| Service area / geocode | MISSING | No polygon/ZIP engine |
| Historical snapshot on address change | PARTIAL | Appointment metadata stores `locationId` / name |
| Deactivate | WORKING | `active: false`; future appointment guard on API |

No new Location database table. Schema unchanged.
