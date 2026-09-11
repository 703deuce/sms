# Appointments Routing — Existing System Audit

**Scope:** Staff assignment routing for Services/Meetings (not Availability eligibility, not telephony smart routing, not routing-forms).

| Area | Status | Notes |
|------|--------|-------|
| `StaffAssignmentMode` on `AppointmentTypeConfig` | WORKING | `any_eligible`, `specific_staff`, `customer_chooses`, `round_robin`, `maximize_availability`, `collective` |
| `priority` assignment mode | PARTIAL | Added in this pass; runtime in `assignStaffPriority` + `resolveStaffForBooking` |
| `resolveStaffForBooking` | WORKING | Canonical assignment after eligibility; uses `filterStaffAvailableForSlot` when slot context provided |
| Round robin | WORKING | `assignStaffRoundRobin` — lowest per-service `roundRobinState.counts`, tie-break by pool order; persists via `saveAppointmentPlatformConfig` |
| Maximize availability / least loaded | WORKING | `assignStaffMaximizeAvailability` — most open slots in 14-day window among slot-available staff |
| Customer-selected staff | WORKING | `customer_chooses` + `preferredStaffId`; never swaps to another staff if eligible+available |
| Service → staff eligibility | WORKING | `svcCfg.staffIds` via `resolveEligibleStaff` |
| Location / calendar / resources | WORKING | Via `filterStaffAvailableForSlot` + availability engine (routing does not bypass) |
| Platform `routingRules` | LEGACY | Answer → appointment **type** routing; preserved at `?section=type-rules`, not staff assignment |
| `routingForms` product | N/A | Separate route `/appointments/routing-forms` |
| `schedulingGroups` | PARTIAL | Data model + team booking; displayed as staff pools table, not full pool editor on Routing page |
| Workspace routing defaults (`staffRouting`) | PARTIAL | New config; UI writes defaults; per-service `useWorkspaceRoutingDefault` supported via API |
| Customer "Any available" alongside named staff | PARTIAL | `allowAnyAvailable` field; public UI still primarily `customer_chooses` vs hidden auto |
| Routing activity / assignment reason audit | PARTIAL | Activity from recent bookings with `metadata.staffId`; no dedicated `routingMethod` timeline yet |
| Reschedule reroute policy | PARTIAL | Setting stored in `staffRouting.rescheduleWhenStaffUnavailable`; runtime enforcement not fully wired |
| Cancellation / manual load in RR balance | PARTIAL | Settings flags stored; `assignStaffRoundRobin` does not yet read them |
| Concurrent assignment | WORKING | Booking path revalidates slot; RR state updated in platform config (race risk remains under extreme concurrency) |
| Classes / workshops dynamic routing | N/A | Treated as N/A on Routing service table |
| Admin Routing page (staff) | PARTIAL | This pass — workspace UI + simulator using real engine |

## Preserved

- Availability engine unchanged.
- `resolveStaffForBooking`, round-robin counters, public book assignment flow.
- Legacy `routingRules` editor (relocated under Settings → Legacy type rules).

## Changed in this pass

- Added `staffRouting` workspace defaults and two-axis UI model (`routing-model.ts`).
- Added `priority` mode and `assignStaffPriority`.
- New `/api/appointments/routing/*` workspace, settings, simulate, service patch.
- Replaced `/appointments/routing` purple type-rules-only page with full staff routing workspace.
