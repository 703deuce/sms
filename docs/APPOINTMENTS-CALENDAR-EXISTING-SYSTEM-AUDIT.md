# Appointments Calendar — Existing System Audit

| Area | Status | Notes |
|------|--------|-------|
| Route | WORKING | `/appointments/calendar` → `CalendarConnected` |
| Calendar library | WORKING | Custom React grid (Day/Week/Month), not FullCalendar |
| Data API | WORKING | `GET /api/calendar/events?from&to` |
| Range fetch | WORKING | Per view window (+ agenda 14d) |
| Day / Week / Month | WORKING | Preserved |
| Agenda list | PARTIAL | Added in this pass |
| Staff filter | PARTIAL | Server + UI; team via `teamStaffIds` |
| Location filter | WORKING | `metadata.locationId` |
| Resource filter | WORKING | `appointmentServiceLine.resourceIds` |
| Service filter | GAP | Not separate dropdown (search only) |
| Status filter | WORKING | Query param |
| Class occurrences | WORKING | One event per `classOccurrence` |
| Workshop occurrences | WORKING | Same table, kind from series metadata |
| Team booking display | WORKING | `staffLabel` multi-name |
| Resources on events | PARTIAL | Labels on drawer + subtitle when enriched |
| Quick detail drawer | WORKING | Added; grid click opens drawer |
| Create from slot | WORKING | `/appointments/new?startsAt&staffId&locationId` |
| Drag/drop reschedule | N/A | Not in legacy implementation |
| Block time | PARTIAL | Link to Availability overrides |
| External busy display | GAP | Blocks slots in engine, not rendered on calendar grid |
| Recurring series UI | PARTIAL | Banner removed; series via appointments metadata |
| Payment indicator | PARTIAL | Balance due label from metadata |
| Forms indicator | GAP | Drawer loads full appointment; no batch forms count |
| POS collect | PARTIAL | Link to POS with appointmentId |
| Cancel / reschedule | WORKING | Canonical PATCH `/api/appointments/[id]` |
| Realtime | GAP | Refetch on manual navigation/filter |
| Mobile | PARTIAL | Agenda view + responsive CSS |
| Purple styling | LEGACY | Replaced with teal pilot tokens in `reference.css` |

Preserved: week grid, month, mini-calendar side rail, meeting indicators, standalone video/notetaker events.
