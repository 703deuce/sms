# Resources — Component Connection Matrix (summary)

| Section | Component | Read source | Write target | API | Scheduling consequence |
|---------|-----------|-------------|--------------|-----|------------------------|
| Directory | Summary strip | `buildResourcesWorkspace` | — | GET workspace | Display only |
| Directory | Table rows | `directory[]` | — | GET workspace | Links to detail |
| Directory | Search/filters | Client | — | — | Client filter |
| Create | Step 1–3 modal | locations, types | `SchedulingResource` + sync | POST `/api/appointments/resources` | eligibleTypeIds → service resourceIds |
| Detail Overview | Basics | `buildResourceDetail` | PATCH resource | PATCH `[id]` | Name/category display |
| Detail Overview | Capacity now | `countResourceUsage` | — | GET detail | Live usage window |
| Detail Services | Assign drawer | services[] | `eligibleTypeIds` + sync | PATCH | Updates service.config.resourceIds |
| Detail Scheduling | Test button | `testResourceAvailability` | — | POST test-availability | Same as slot engine |
| Detail Bookings | Table | appointmentServiceLine | — | GET detail | Audit trail |
| Detail Advanced | Capacity | quantity | PATCH | PATCH | Peak guard |
| Detail Advanced | Deactivate | futureReservationCount | active false | PATCH 409 | Excludes inactive from slots |

**Totals:** 12 connected controls, 0 placeholders, 0 no-op buttons on primary paths. E2E screenshots BLOCKED this pass.
