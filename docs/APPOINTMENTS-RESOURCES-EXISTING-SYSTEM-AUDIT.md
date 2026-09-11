# Appointments Resources — Existing System Audit

| Area | Status | Notes |
|------|--------|-------|
| `SchedulingResource` model | WORKING | Prisma `scheduling_resources`: name, quantity, eligibleTypeIds, metadata (locationIds, category), active |
| Individual resource | WORKING | `quantity: 1` exclusive unit |
| Quantity pool | WORKING | Single row with `quantity > 1`; interchangeable units |
| `SchedulingResourceGroup` pools | WORKING | `any_one` / `all_required`; `resolveResourcePool` at commit |
| Service requirements | WORKING | `voiceService.config.resourceIds` + `eligibleTypeIds` on resource (sync helper) |
| Per-booking quantity | PARTIAL | One line consumes one slot count per resource id; multi-unit per booking not modeled on line |
| Location linkage | WORKING | `metadata.locationIds` + `filterResourceIdsForLocation` in slot list |
| Slot generation | WORKING | `filterSlotsByResourceAvailability` in `listNativeSlotsForBooking` |
| Final commit | WORKING | `assertResourcesAvailable` in `createPlatformAppointment` + `persistAppointmentResources` |
| Slot validation gate | WORKING | `assertSlotAvailableForBooking` now filters slots by resources + exclude on reschedule |
| Reschedule | PARTIAL | Re-asserts capacity, shifts `appointmentServiceLine` times; advisory lock is per service+time not per resource |
| Cancel | PARTIAL | Lines remain until appointment removed; capacity freed when lines deleted or times moved |
| Service phases | PARTIAL | `service-phases.ts` asserts per-phase resource windows |
| Class / workshop occurrence | GAP | No dedicated occurrence→resource reservation in this pass |
| Meeting resources | N/A | Unless service config includes resourceIds |
| Team booking | PARTIAL | Staff resolved after resource assert on create; team runtime does not independently re-filter by resource |
| Routing | PARTIAL | Inherits staff slots; resource filter on public slot API path |
| Custom resource hours | MISSING | No per-resource weekly schedule table |
| Resource overrides / maintenance | MISSING | Use location blackouts only |
| Historical labels | WORKING | `metadata.resourceLabels` on appointment at create |
| Concurrency (last unit) | PARTIAL | `withAtomicSlotBooking` + assert; cross-service double-book same resource possible without resource-level lock |
| Admin UI (legacy) | LEGACY | `ServiceBookingAdminClient` replaced by `/appointments/resources` workspace |

Schema unchanged this pass. Runtime fixes: persist order, reschedule line update, slot-validation resource filter.
