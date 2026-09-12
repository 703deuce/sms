# Appointments Calendar — operational upgrade audit

**Route:** `/appointments/calendar`  
**Date:** 2026-09-12  
**Principle:** Calendar = fast operational layer; full `/appointments/[id]` = canonical deep record.

## Implementation stack

| Area | Finding | Status |
|------|---------|--------|
| Calendar UI | Custom Kimi grid (`WeekCalendar`, `DayCalendar`, `MonthCalendar`) — not FullCalendar | **WORKING** |
| Data adapter | `calendar-connected.tsx` + `map-calendar.ts` | **WORKING** |
| Event fetch | `GET /api/calendar/events` → `listWorkspaceCalendarEvents` | **WORKING** |
| Range query | `from` / `to` on visible view | **WORKING** |
| Filters (server) | staffIds, locationId, resourceId, status, domainType, q | **WORKING** |
| Views | Day, Week, Month, Agenda | **WORKING** |
| Mini month + day agenda | Right `cal-side` panel | **WORKING** |
| Current time line | `nowLine` in week/day | **WORKING** |
| Event kinds | service, meeting, class, workshop, video, notetaker, block, external_busy (model) | **PARTIAL** (block/busy rendering varies) |
| Class occurrences | One event per occurrence with `registrationSummary` | **WORKING** |
| Meeting indicators | Secondary fetch `/api/appointments/meeting-indicators` | **WORKING** |
| New appointment | `/appointments/new` full page | **WORKING** |
| Quick create | `CalendarQuickCreateSheet` → `POST /api/appointments` + link to full form | **NEW** |
| + Add menu | New appointment, Block time, Waitlist | **NEW** |
| Block time | `/appointments/availability?section=overrides` (canonical availability) | **WORKING** (deep link) |
| Event drawer | `CalendarEventDrawer` operational sections + actions | **UPGRADED** |
| Reschedule in calendar | `CalendarRescheduleSheet` → `PATCH` `startsAt` + `reschedulePlatformAppointment` | **NEW** |
| Drag/drop reschedule | — | **MISSING** |
| Recurring drag scope | — | **MISSING** |
| Waitlist in calendar | Link + search; match drawer | **PARTIAL** (no match engine UI yet) |
| Message client | `/conversations?contactId=` | **WORKING** |
| POS | `/appointments/point-of-sale?appointmentId=` | **WORKING** |
| Status actions | PATCH status (confirmed, checked_in, completed, no_show) | **WORKING** |
| Cancel | PATCH `action: cancel` | **WORKING** |
| Tenant scope | `requireSession` + workspaceId on APIs | **WORKING** |
| Permissions | `requireAppointmentsAccess` on mutations | **WORKING** |
| Mobile | Agenda view + responsive CSS | **PARTIAL** |
| Soft Cool Slate shell | `cal-page-shell` neutral tokens | **NEW** |

## Preserved (do not replace)

- Full appointment page `AppointmentDetail` / `/appointments/[id]`
- Canonical booking `createPlatformAppointment`, `reschedulePlatformAppointment`, `cancelPlatformAppointment`
- Availability / block configuration under Availability workspace
- Waitlist page `/appointments/waitlist`

## Gaps (next passes)

1. Drag/drop with validation + rollback  
2. Recurring occurrence scope dialog on move  
3. Waitlist match indicator + offer-slot drawer wired to canonical matcher  
4. Dedicated `GET /api/appointments/calendar/quick-detail` batch projection (drawer still uses single `GET /api/appointments/[id]`)  
5. URL-persisted filter state (today: localStorage)  
6. Slot engine in quick-create (today: POST then server validates; full slot picker TBD)  
7. Visual QA screenshot set per directive  
