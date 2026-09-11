# Team Booking — Existing System Audit

| Capability | Status | Notes |
|------------|--------|-------|
| `staffAssignment: collective` | WORKING (legacy) | Requires **all** `collectiveStaffIds` available (`filterStaffAvailableForSlot` mode `all`) |
| Structured team requirements | PARTIAL | `teamBooking.requirements[]` + solver added this pass |
| Combination solver (distinct staff) | PARTIAL | Backtracking in `combination-solver.ts`; integrated in slot generation |
| Slot generation joint teams | PARTIAL | `generateNativeSlots` uses `resolveTeamAtSlot` when team enabled |
| Booking persistence multi-staff | PARTIAL | `metadata.teamStaffIds`, `teamAssignments`, `primaryStaffId` on admin `createPlatformAppointment` |
| Public book team metadata | PARTIAL | Relies on `createPlatformAppointment` team path |
| Busy index / calendar block all staff | PARTIAL | `loadAppointmentBusyIndex` indexes `teamStaffIds` |
| Routing integration | PARTIAL | RR load scoring among valid combinations |
| Staff pools | PARTIAL | `schedulingGroups` via `staff_pool` assignment mode |
| Service phases per role | N/A | Not in runtime |
| Reschedule preserve/replace team | GAP | Not implemented |
| Manual reassignment UI | GAP | Admin picker not built |
| Team templates | PARTIAL | `platform.teamBookingTemplates` read in UI; editor minimal |
| `teamBookingPages` (landing) | LEGACY/N/A | Separate product at `/appointments/team-pages` |
| Meeting co-host | PARTIAL | Meetings can use `collective` host mode |
| Classes/Workshops | N/A | Occurrence-owned instructors |

**Preserved:** Availability engine, routing engine, collective mode behavior for services not migrated to structured requirements.

**Schema:** No Prisma migration; team state in `AppointmentTypeConfig.teamBooking` and appointment `metadata`.
