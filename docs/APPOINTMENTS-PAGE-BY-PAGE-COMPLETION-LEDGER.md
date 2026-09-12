# Appointments page-by-page completion ledger

## Calendar (`/appointments/calendar`)

| Track | Status | Notes |
|-------|--------|-------|
| CALENDAR_EXISTING_AUDIT | PASS | `APPOINTMENTS-CALENDAR-OPERATIONAL-UPGRADE-AUDIT.md` |
| CALENDAR_READ_MODEL | PASS | `APPOINTMENTS-CALENDAR-EVENT-READ-MODEL.md` |
| DAY_VIEW / WEEK_VIEW / MONTH_VIEW / AGENDA_VIEW | PASS | Kimi grids |
| SEARCH | PARTIAL | Server `q` + Enter jump to first match |
| FILTER_TYPE / FILTER_STAFF | PASS | |
| FILTER_LOCATION / FILTER_RESOURCE / FILTER_STATUS | PARTIAL | Secondary filters toggle |
| MINI_CALENDAR / SELECTED_DAY | PASS | Collapsible side panel |
| QUICK_CREATE | PARTIAL | Sheet + full form escape hatch |
| ADD_MENU | PASS | + Add |
| BLOCK_TIME_CREATE | PASS | Availability overrides route |
| EVENT_DRAWER | PASS | Operational 440px drawer |
| MESSAGE_CLIENT / OPEN_CLIENT / OPEN_FULL_APPOINTMENT | PASS | |
| RESCHEDULE | PASS | In-drawer sheet |
| DRAG_DROP / RECURRING_SCOPE | FAIL | Not implemented |
| CANCEL / CHECK_IN / COMPLETE / NO_SHOW | PASS | PATCH |
| POS_PAYMENT | PASS | Point of sale link |
| WAITLIST_MATCHING / WAITLIST_OFFER | FAIL | Link only |
| CLASS_OCCURRENCE / CLASS_CAPACITY | PASS | registrationSummary |
| MOBILE | PARTIAL | Agenda + sheets TBD polish |
| MULTI_TENANT | PASS | API scoping |

**APPOINTMENTS_CALENDAR_OPERATIONAL_WORKSPACE_COMPLETE:** **NO** — blockers: drag/drop, waitlist match UI, slot-engine quick create parity, visual QA pack.
