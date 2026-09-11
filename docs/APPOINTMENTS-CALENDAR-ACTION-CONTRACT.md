# Calendar action contract

| UI action | Canonical owner |
|-----------|-----------------|
| New appointment | `/appointments/new` → booking runtime |
| Slot click create | Same with query prefill |
| Open appointment | `/appointments/[id]` or drawer → GET appointment |
| Reschedule | PATCH `startsAt` → `reschedulePlatformAppointment` |
| Cancel | PATCH `action: cancel` → `cancelPlatformAppointment` |
| Collect payment | `/appointments/point-of-sale?appointmentId=` |
| Open client | `/appointments/clients/[contactId]` |
| Open class | Classes admin with occurrence |
| Block time | Availability overrides (not calendar-local blocks) |
| Open location | `/appointments/locations/[id]` |

No calendar-only INSERT/UPDATE on appointments except through these APIs.
