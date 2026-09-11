# Appointments Routing Parity Audit

| Capability | Status | Notes |
|------------|--------|-------|
| ANY AVAILABLE | GAP | Auto-assign via `any_eligible`; optional Any alongside named staff partial (`allowAnyAvailable`) |
| HIDE STAFF SELECTION | PASS | `any_eligible` / `round_robin` / `priority` public flows without picker |
| CUSTOMER CHOOSES STAFF | PASS | `customer_chooses` + `preferredStaffId` |
| ROUND ROBIN | PASS | Least-count RR with persisted state |
| PRIORITY ROUTING | PASS | New `priority` mode |
| POOL AVAILABILITY | PASS | Availability engine unions eligible staff slots |
| SERVICE-SPECIFIC ROUTING | PASS | Per-type `staffAssignment` + overrides API |
| STAFF ELIGIBILITY | PASS | `staffIds` authoritative |
| LOCATION ELIGIBILITY | PASS | Staff/service location filters |
| CALENDAR CONFLICT FILTER | PASS | External busy + per-staff calendar |
| RESOURCE FILTER | PASS | Via slot/staff availability |
| DEFAULT VS OVERRIDE | PARTIAL | Workspace `staffRouting` + `useWorkspaceRoutingDefault` |
| RESCHEDULE BEHAVIOR | GAP | Policy setting only |
| ACTIVITY/AUDIT | PARTIAL | Booking list; no routing reason field |
| ROUTING TEST/SIMULATOR | PASS | Uses `resolveStaffForBooking` + candidate rows |
| CONCURRENT BOOKING SAFETY | PARTIAL | Slot revalidation; RR state not transactional with booking row |
| STAFF POOLS | PARTIAL | `schedulingGroups` read-only table |
| LEAST-LOADED | PASS | `maximize_availability` |
