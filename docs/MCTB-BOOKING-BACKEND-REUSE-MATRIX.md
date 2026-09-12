# MCTB Booking — Backend Reuse Matrix

| Capability | Source service/model | MCTB call site | Reused? | Duplicated? | Notes |
|------------|---------------------|----------------|--------|-------------|-------|
| Appointment model | Prisma `Appointment` | All MCTB booking pages | Yes | No | — |
| Appointment service | `lib/appointments/*` | API routes unchanged | Yes | No | — |
| Availability | `availability-engine.ts` | New appointment + public book | Yes | No | — |
| Conflict detection | scheduling domain | Calendar drag/create | Yes | No | — |
| Customer matching | contact APIs | Create + conversation prefill | Yes | No | — |
| Microsoft sync | calendar sync services | Calendar events API | Yes | No | — |
| External busy events | `/api/calendar/events` | MCTB calendar | Yes | No | — |
| Reminder scheduling | `reminder-engine.ts` | Reminders settings | Yes | No | — |
| Public booking | `public/book` API | `/book/[slug]` | Yes | No | Shared URL |
| Reschedule | `PATCH /api/appointments/[id]` | MCTB calendar/list | Yes | No | — |
| Cancellation | same | MCTB list/detail | Yes | No | — |
| Timezone | workspace settings | All surfaces | Yes | No | — |
| Slot generation | availability engine | New appointment | Yes | No | — |
| SMS delivery | `sendAppointmentSms` | Send booking link | Yes | No | — |
| Email delivery | contacts actions | Send booking link | Yes | No | — |

**DUPLICATED_BACKEND_CAPABILITIES = 0**  
**NEW_REMINDER_ENGINE_CREATED = NO**
