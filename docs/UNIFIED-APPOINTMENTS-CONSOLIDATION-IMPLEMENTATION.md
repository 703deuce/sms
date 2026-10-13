# Unified Appointments — consolidation implementation (in progress)

**Date:** 2026-10-13  
**Authority:** `docs/UNIFIED-APPOINTMENTS-FEATURE-OVERLAP-AUDIT.md` + approved product direction.

## Navigation consolidated (13 primary + Help)

Replaced the 25-item merged tree with `buildUnifiedAppointmentsNav()`:

1. Calendar (`/appointment-reminders`) — **product home**
2. Appointments
3. Booking
4. Availability
5. Clients
6. Messages & Responses
7. Reminders
8. Workflows & Automation
9. AI Rescheduler
10. Commerce
11. Analytics & Reports
12. Integrations
13. Settings  
+ Help (`/getting-started`)

**Removed from sidebar (routes preserved):**

- Duplicate AR vs Scheduling **Calendar** entries → single Calendar home
- Separate **Overview** / Scheduling **Home** nav → overview redirects to calendar home
- Duplicate **Analytics**, **Settings**, **Integrations**, **Booking** top-level bands from the old dual-tree merge
- AR-only **Responses** top-level (folded under Messages & Responses)
- Scheduling **Messages** duplicate (Inbox under Messages & Responses)
- Legacy scheduling **Reminders** nav target (`/appointments/reminders` redirect only — not in sidebar)

Regenerate menu inventory: `npx tsx scripts/generate-unified-sidebar-menu-doc.ts` → `docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md`.

## Calendar as home

- Default view: **agenda** (`parseArCalendarView` in `ar-calendar-url-state.ts`).
- **Native create:** `CalendarQuickCreateSheet` on AR Opus calendar; workspace loaded **lazily** on first “New appointment” (`/api/appointments/calendar/workspace`).
- External provider compose kept as **“Add in calendar app”** (Microsoft/Google deeplinks).
- `/appointments/overview` → redirect to `/appointment-reminders` when unified.
- `/appointments/calendar` → redirect to `/appointment-reminders` when unified (no second calendar UI).

## Not yet completed (honest gaps)

| Area | Status |
|------|--------|
| Drag-reschedule / waitlist match on AR calendar | Not ported — still on legacy scheduling calendar route (redirected) |
| Staff/resource filters on AR calendar | Not ported |
| Full appointment detail merge (payments, intake, class enrollment) | AR drawer + `/appointments/[id]` still parallel |
| Booking Opus + full scheduling editors merge | Nav points to both; UI merge not done |
| Analytics / Settings / Integrations single-page tabs | Nav grouped only |
| Opus visual wrap of scheduling-only pages | Unchanged connected components |
| Production E2E (M365, write-back, public book, POS) | **Not claimed** in this pass |

## Backend reuse (unchanged engines)

- `VoiceAppointment`, `import-sync.ts`, `bookAppointment`, `reminder-engine.ts`, `AppointmentWorkflow` jobs, `service-booking/**` APIs — **no replacement engines introduced**.

## Tests run this pass

- Menu generator script + href count (local `tsx`)
- **Not run:** full `npm run build`, browser regression, Microsoft OAuth E2E

## Next implementation slices (recommended order)

1. AR calendar: scheduling filters + drag reschedule (reuse `calendar-connected` hooks, same event APIs where safe)
2. Appointments: deep-link native detail actions from AR table
3. Tabbed Analytics / Integrations / Settings Opus shells
4. Booking Opus extension for classes/workshops admin entry points
