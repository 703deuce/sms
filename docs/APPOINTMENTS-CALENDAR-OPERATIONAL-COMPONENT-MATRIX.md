# Calendar operational component matrix (summary)

| REGION | COMPONENT | USER JOB | READ | WRITE | STATUS |
|--------|-----------|----------|------|-------|--------|
| Header | CalendarHeader | Navigate date/view | model | view state | PASS |
| Header | CalendarAddMenu | Add appointment/block/waitlist | — | routes | PASS |
| Toolbar | CalendarFilterBar | Filter/search | workspace API | URL params (partial) | PARTIAL |
| Grid | Week/Day/Month | View schedule | `/api/calendar/events` | — | PASS |
| Grid | Slot click | Quick create | prefill | quick sheet / new | PASS |
| Grid | Event click | Open drawer | list row | drawer | PASS |
| Drawer | CalendarEventDrawer | Operate booking | GET appointment | PATCH cancel/status | PASS |
| Drawer | Reschedule sheet | Move time | — | PATCH startsAt | PASS |
| Quick create | CalendarQuickCreateSheet | Fast book | workspace | POST appointments | PARTIAL |
| Aux | MiniCalendar | Pick day | model | cursor | PASS |
| Aux | DayAgenda | Day summary | model | open event | PASS |
| Waitlist | Toolbar link | Full waitlist | — | `/appointments/waitlist` | PASS |
| Waitlist | Match drawer | Offer slot | — | MISSING | BLOCKED |
| DnD | Drag reschedule | Move event | — | MISSING | FAIL |
| Deep | Full appointment page | Complete record | GET appointment | all actions | PASS (unchanged) |

**Totals (this pass):** connected operational paths expanded; drag/drop and waitlist matching remain blockers for `APPOINTMENTS_CALENDAR_OPERATIONAL_WORKSPACE_COMPLETE: YES`.
