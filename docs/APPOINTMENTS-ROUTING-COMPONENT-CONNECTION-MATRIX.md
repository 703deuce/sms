# Appointments Routing — Component Connection Matrix

| SECTION | COMPONENT | CONTROL TYPE | USER JOB | READ SOURCE | WRITE TARGET | API | DOMAIN | ROUTING CONSEQUENCE |
|---------|-----------|--------------|----------|-------------|--------------|-----|--------|---------------------|
| Overview | Edit default | button | Change workspace defaults | `staffRouting` | `staffRouting` | PATCH `/api/appointments/routing/settings` | `routing-model` | Default customer + auto method for services using workspace default |
| Rules | Customer staff choice radios | radio group | Set default customer experience | `staffRouting.defaultCustomerSelection` | same | PATCH settings | encode → `staffAssignment` on new services | Public staff step visibility |
| Rules | Auto-assignment radios | radio group | Set default algorithm | `staffRouting.defaultAutoMethod` | same | PATCH settings | RR / priority / maximize / first | Assignment when no customer pick |
| Rules | Priority reorder | buttons | Order staff for priority | `workspaceStaffPriorityOrder` | same | PATCH settings | `assignStaffPriority` | Priority fallback order |
| Services | Service table row | table row | Inspect service routing | types API via workspace | — | GET workspace | `decodeRoutingPolicy` | — |
| Services | Service drawer | drawer | Jump to service/availability | workspace row | — | — | — | — |
| Test | Run test | button | Simulate assignment | simulate API | — | POST `/api/appointments/routing/simulate` | `resolveStaffForBooking` | Preview only; same engine as booking |
| Activity | Activity table | read-only table | See recent assignments | `voiceAppointment.metadata.staffId` | — | GET workspace | — | Observability |
| Settings | Reschedule policy | radio | Policy when staff unavailable after reschedule | `staffRouting.rescheduleWhenStaffUnavailable` | same | PATCH settings | — | GAP: runtime |
| Settings | Load checkboxes | checkbox | RR balance rules | flags on `staffRouting` | same | PATCH settings | — | GAP: runtime |
| Settings | Legacy type rules link | link | Edit answer→type rules | `routingRules` | `routingRules` | PATCH `/api/appointments/settings` | `resolveRoutingDestination` | Appointment type only, not staff |
| Type rules | Rule editor | form | Conditional type routing | `platform.routingRules` | same | PATCH settings | public book pre-route | Not staff assignment |

**Totals:** 12 interactive components documented; 8 connected to persistence; 2 read-only; 2 settings with stored but not fully enforced runtime behavior.
