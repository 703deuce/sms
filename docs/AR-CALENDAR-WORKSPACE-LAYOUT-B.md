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

## Calendar filter

Toolbar **Calendars** dropdown (`SimpleSelect`) filters client-side by `metadata.connectionId` on calendar events (same identity as Appointments list). URL param: `calendar=<connectionId>`.

## Verification

```bash
PORT=3010 npm run dev
UI_AGENT_BASE_URL=http://localhost:3010 npx tsx scripts/verify-ar-layout-b-ui.ts
UI_AGENT_BASE_URL=http://localhost:3010 npx tsx scripts/capture-ar-calendar-workspace-layout-b.ts
```

Dev visual QA route (no login): `/dev/ar-layout-b` (404 in production unless `ALLOW_AR_LAYOUT_B_PREVIEW=1`).

## Out of scope

- Engine/eligibility/dispatch/OAuth backend changes.
- Per-provider-calendar sub-filter within one connection (only when `metadata.calendarId` is populated consistently).
