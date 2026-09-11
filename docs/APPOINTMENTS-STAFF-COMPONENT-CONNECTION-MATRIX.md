# Staff component connection matrix (summary)

| Section | Control | API | Write target | Consequence |
|---------|---------|-----|--------------|-------------|
| Directory | Search/filter | client | — | View |
| Directory | Add staff | POST `/api/appointments/staff` | `platform.staff` | New record |
| Directory | Open row | — | — | Navigate detail |
| Detail | Save profile | PATCH `[staffId]` | `platform.staff` | Public book fields |
| Detail | Service checkbox | PATCH `appointmentTypeIds` | staff + `voiceService.config.staffIds` | Eligibility |
| Detail | Location checkbox | PATCH `locationIds` | staff + `location.staffIds` | Eligibility |
| Detail | Open Availability | link | — | Availability owner |
| Detail | Manage calendar | link | — | Integrations owner |
| Detail | Deactivate | PATCH `deactivate` | `active: false` | No new bookings |
| Scheduling | Weekly summary | GET detail | read-only | No duplicate editor |

**Connected:** 10 primary actions. **No-op / placeholder:** 0 in scope.
