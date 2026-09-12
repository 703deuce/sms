# MCTB Light Booking — Copy Source Map

| MCTB surface | Source route | Source files | Source components | Canonical backend | Copy directly? | Trim after copy? | Notes |
|--------------|--------------|--------------|-------------------|-------------------|----------------|------------------|-------|
| Calendar | `/appointments/calendar` | `calendar-connected.tsx` | `kimi-ui/calendar/*`, `calendar/*` drawers | `/api/calendar/events`, `use-calendar-reschedule` | **Yes** → `features/mctb/booking/calendar/mctb-calendar-connected.tsx` | Yes — waitlist, KPI, routes | Same loaders/mutations |
| Appointments | `/appointments` | `list-connected.tsx` | `kimi-ui/list/AppointmentsList` | `/api/appointments`, list workspace | **Yes** → `features/mctb/booking/list/mctb-list-connected.tsx` | Yes — summary strip, advanced nav | Tabs/filters retained |
| Booking Setup | `/appointments/meetings` | `meetings-workspace-connected.tsx` | meeting sections/wizard | `/api/appointments/types`, settings | Wrapper | Yes — services/classes hidden | Simplest type editor |
| Reminders | `/appointments/reminders` | `reminders-connected.tsx` | `reminders-workspace-connected.tsx` | `/api/appointments/settings`, reminder engine | Wrapper | Yes — no workflows UI | Shared scheduler |
| New appointment | `/appointments/new` | `appointments-new-connected` | form components | appointment create APIs | Reuse page | Simplified shell | Same availability engine |
| Public booking | `/book/[slug]` | `public-booking-connected` | `kimi-ui/public-booking/*` | `/api/public/book/[slug]` | Reuse as-is | Optional branding | No second runtime |
