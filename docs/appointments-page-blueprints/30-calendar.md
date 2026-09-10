# Blueprint 30 — Calendar (`/appointments/calendar`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-3 ABSORPTION GAPS

| Feature ID | Feature | Current State | Final Section | UI Pattern | Backend | Status |
|---|---|---|---|---|---|---|
| CAL-01 | Staff colors | Hardcoded heuristics | Event styling + legend | Filter swatches | `CalendarColorConfig` via settings | ABSORBED |
| CAL-02 | Booking type colors | Name heuristics | Event styling + legend | Type swatches | Type `calendarColor` + `calendarColors.serviceColors` | ABSORBED |
| CAL-03 | Class/event distinction | Generic cards | Event card | Kind badge + capacity | `bookingTypeKind`, `groupCapacity` | ABSORBED |
| CAL-04 | Filters | Missing | Header | Popover panel | Client filter on calendar events | ABSORBED |
| CAL-05 | Staff view | Missing | View toggle | Staff lanes (day) | Staff list + event `staffId` | ABSORBED |
| CAL-06 | Drag reschedule | Missing | Week/day grid | Confirm dialog | `PATCH /api/appointments/[id]` | ABSORBED |
| CAL-07 | Recurring indicator | Missing | Event card | Repeat badge | `recurringSeriesId` metadata | ABSORBED |
| CAL-08 | Availability overlay | Missing | Header toggle | Background bands | `weeklyHours` platform config | ABSORBED |
| CAL-09 | External busy blocks | Hidden from calendar | Overlay blocks | Busy label | `getExternalBusyIntervals` | ABSORBED |
