# MCTB Booking — UI Copy/Trim Matrix

| Source component | Copied to | Keep | Hide in MCTB | Shared dependencies | Status |
|------------------|-----------|------|--------------|---------------------|--------|
| `calendar-connected.tsx` | `mctb-calendar-connected.tsx` | views, drag/drop, drawers, sync | waitlist, waitlist banner | same APIs/hooks | CONNECTED |
| `list-connected.tsx` | `mctb-list-connected.tsx` | tabs, CRUD, pagination | KPI strip, class enroll nav | `/api/appointments` | CONNECTED |
| `MeetingsWorkspaceConnected` | `mctb-booking-setup-connected` | meeting editor, availability | services/classes nav | types API | CONNECTED |
| `RemindersConnected` | `mctb-reminders-connected` | reminder steps, save | workflows/automation | settings API | CONNECTED |
| `AppointmentsNewConnected` | `/mctb/appointments/new` page | create flow | — | availability | CONNECTED |
| `ContactBookingActions` pattern | `conversation-booking-actions` | send link | — | contacts API | CONNECTED |

**UNACCOUNTED_SOURCE_COMPONENTS = 0** (MVP surfaces)
