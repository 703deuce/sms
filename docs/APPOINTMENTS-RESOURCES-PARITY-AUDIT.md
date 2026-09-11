# Appointments Resources — Parity Audit

| Capability | Result | Notes |
|------------|--------|-------|
| Resource directory | PASS | Workspace API + table UI |
| Room resource | PASS | category label + qty 1 |
| Equipment resource | PASS | category + pool qty |
| Custom resource types | PASS | Freeform category in metadata |
| Resource location | PASS | metadata.locationIds + filter |
| Individual resource | PASS | quantity 1 |
| Resource pool (group) | PASS | Backend; UI lists membership on detail |
| Quantity capacity | PASS | quantity field |
| Service resource requirements | PASS | config.resourceIds + sync |
| Multi-resource service | PASS | Multiple ids on config |
| Resource quantity per booking | GAP | Always 1 unit per id on line |
| Resource availability (custom hours) | GAP | Location hours only |
| Resource overrides | N/A | Not in engine |
| Capacity enforcement | PASS | assert + count |
| Resource slot generation | PASS | filterSlotsByResourceAvailability |
| Booking reservation | PASS | appointmentServiceLine |
| Concurrent capacity safety | PARTIAL | Service-level lock only |
| Reschedule resource handling | PASS | assert + line time update |
| Cancellation resource release | PARTIAL | Depends on line cleanup |
| Service phase occupancy | PARTIAL | Phase asserts exist |
| Class/workshop occurrence | GAP | Not wired |
| Meeting resource | N/A | Unless configured on service |
| Location intersection | PASS | filterResourceIdsForLocation |
| Routing intersection | PARTIAL | Indirect via slots |
| Team booking intersection | PARTIAL | Resource before team on create |
| Public resource selection | N/A | Internal by default |
| Resource history | PASS | Lines + metadata labels |
| Deactivation | PASS | active flag + future guard |
| Future booking safety | PASS | 409 on deactivate |
| Mobile admin | PASS | Responsive table / sections |
