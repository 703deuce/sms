# Calendar drawer read model

**Component:** `CalendarEventDrawer`  
**Width target:** 400–460px (`cal-drawer-operational`)

## Layers

1. **List projection** (`CalendarApiAppointment`) — instant header, payment hint, flags  
2. **Detail fetch** (`GET /api/appointments/[id]`) — contact, policy, contracts, reminderSchedule, metadata  

## Modules

| Module | Read source | Write / navigate |
|--------|-------------|------------------|
| Summary | list + detail | — |
| Customer | detail.contact + list | `/contacts/[id]`, `/conversations?contactId=` |
| Payment | list.balance + detail metadata | `/appointments/point-of-sale?appointmentId=` |
| Package/membership | metadata | full appointment |
| Forms | pendingFormsCount + contracts | `/appointments/[id]#forms` |
| Reminders | reminderSchedule (when present) | `/appointments/reminders` |
| Policy | policySnapshot | full appointment |
| Calendar sync | metadata | full appointment |
| Video | meeting.videoJoinUrl | external / video routes |
| Activity | — (collapsed placeholder) | Open full appointment |
| Primary actions | — | Message, Reschedule sheet, More menu |
| Status | PATCH `{ status }` | canonical `updatePlatformAppointmentStatus` |
| Cancel | PATCH `{ action: cancel }` | `cancelPlatformAppointment` |
| Reschedule | PATCH `{ startsAt }` | `reschedulePlatformAppointment` |
| Deep record | — | `/appointments/[id]` always available |

## Class / video events

- Class: `registrationSummary`, link `/appointments/classes?occurrence=`  
- Video: host link `/video/rooms/...`  
