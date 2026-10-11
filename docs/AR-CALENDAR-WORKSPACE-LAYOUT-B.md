# Appointment Reminders — Calendar-first home (Layout B)

**Route:** `/appointment-reminders` (canonical) · legacy `/appointment-reminders/calendar` redirects with query preserved.

## Layout

- Desktop: CSS grid `minmax(0,1fr)` + `minmax(300px,360px)` (~72/28), 12–16px gap.
- Calendar: `ArCalendarOpusView` (week default via `parseArCalendarView`).
- Right panel: Mode A `ArCalendarActivityPanel` · Mode B `AppointmentDetailDrawer` (`layout="panel"`).
- Tablet/mobile: panel → sheet; activity feed via “Today’s activity” bottom sheet.

## Reuse map

| Concern | Source |
|--------|--------|
| Events API | `GET /api/appointment-reminders/calendar/events` |
| Activity feed | `GET /api/appointment-reminders/overview` |
| Appointment controls | `AppointmentDetailDrawer` (existing APIs) |
| Calendar grid | `ar-calendar-opus-view.tsx` + `ar-calendar-layout.ts` |
| UI2 shell | `ArOpusPage`, `OpusSearchField`, `OpusDataSurface`, `Segmented`, `Button` |

## Out of scope (this pass)

- Per-connection calendar filter dropdown (no prior standalone filter UI; all imported events in range).
- Engine/eligibility/dispatch behavior changes.
