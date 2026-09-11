# Appointments Page-by-Page Completion Ledger

## MEETINGS (`/appointments/meetings`) — Page 01B

Verified with Playwright against the dev server in workspace `harbor-home`
(11 booking types, 2 meetings). 45 of 45 checks passed across three suites.

| Category | Status | Evidence |
|----------|--------|----------|
| VISUAL | PASS | Five-region shell on Home's structure with a teal accent; screenshots 01–17 |
| COMPONENT INVENTORY | PASS | `APPOINTMENTS-MEETINGS-COMPONENT-CONNECTION-MATRIX.md` |
| COMPONENT CONNECTIONS | PASS | Every control traced to a field, an API call and a runtime consequence |
| CREATE | PASS | Wizard creates a `MEETING` with the entered duration and method, then opens its editor |
| EDIT | PASS | All six sections drive form state; section is URL-addressable via `?section=` |
| SAVE | PASS | Dirty-gated `PATCH`; clean state renders as a `role="status"` indicator, not a button |
| PERSISTENCE | PASS | Name, join link, questions, question order and cancellation cutoff all survive reload and are present in the API row |
| PUBLIC/RUNTIME | PASS | `/book/harbor-home/:id` renders the meeting as `30 minutes · Zoom` and lists real slots |
| EMPTY STATES | PASS | No-selection state with hints; no-matches vs no-meetings in the list; contextual add-host and add-location |
| ERROR STATES | PASS | Per-step wizard validation surfaces `.ws-inline-error`; save failure offers Retry save |
| RESPONSIVE | PASS | Rail only on desktop, dropdown only below `lg`; summary strip reflows 5→3→2; no horizontal overflow at 390px |
| ACCESSIBILITY | PASS | axe wcag2a/aa clean on all six sections; dialog semantics, focus move, Escape close, `aria-pressed` choice cards |
| CONSOLE/NETWORK | PASS | No console errors and no failing requests across every section, the wizard and the public page |

**Counts:** `BROKEN = 0`, `PLACEHOLDER/NO_OP = 0`

**Overall:** `APPOINTMENTS_MEETINGS_PAGE_COMPLETE: YES`

### Defects fixed in this pass

| Defect | Cause | Fix |
|--------|-------|-----|
| Every text field rendered borderless | `.input` was only defined under `.reference-root`; the shell uses `ref-root` | Full form-control layer in `meetings-workspace-pilot.css` |
| Hosts, locations and schedules always empty; no booking link | Editor read `settingsJson.data.platform`; the API returns `data.staff` / `data.locations` / `data.namedSchedules` and `workspace.slug` | `optionsFromSettings()` reads the real shape |
| Host empty state dead-ended into `/appointments/staff` | No way to create a host from the editor | `addStaffMember()` writes to settings and auto-joins the new host to the active pool |
| Wizard step 2 said "Add a host in Staff first" | Same | Inline name field and Add host button |
| Duplicate section navigation on desktop | Two `MeetingLocalNav` mounts | One component renders both responsive presentations |
| Summary strip truncated to "Any av…", "Works…" | Fixed 5-column grid at every width | Responsive grid plus `title` tooltips |
| Mobile strip was a shrunken desktop strip | — | 2-column grid, trailing cell spans the row |
| Horizontal overflow at 390px | Unbreakable booking URL | `min-width: 0` through the section and overview grids |
| Advanced showed summary cards and full forms | Duplicated presentation | Collapsible modules that expand in place |
| Method picker was a plain select | — | Choice cards with per-provider connection status and conditional config |
| Method status was a static label | `Needs a link` shown even when a link existed | Chip reflects real state for the selected method |
| Modal was painted under the app sidebar | Workspace sits in a `z-index: 1` stacking context | Modal portals to `document.body` |
| Object list broke listbox semantics | `role="option"` inside a plain `li` | `role="presentation"` on the `li` |
| Notetaker summary select had no accessible name | `Label` without `htmlFor` | `htmlFor` / `id` pair |
| Public booking page looped forever when a type was preselected | `load` → `pickType` → `selectedType` → new `pickType` → new `load` | `pickTypeRef` plus a one-shot `preselectApplied` guard |

### Known gaps, deliberately not addressed in a Meetings pass

- **Availability engine latency.** `getAvailability` runs one conflict query, one
  booking-limit query and one staff query per candidate slot — 206 queries for 33 slots,
  about 15.5s for a 14-day window, reproduced outside Next as well as through the API.
  It lives in `availability-engine.ts` and slows every booking type equally, so fixing it
  means restructuring the shared slot loop and re-certifying Services, Classes and
  Workshops.
- **No delete for booking types.** No `deleteAppointmentType` exists in the backend and
  `/api/appointments/types/:id` has no `DELETE`. Deactivate is the supported path.
- **Home still uses the superseded violet accent.** Meetings adopts Home's structure and
  scale but overrides the accent to teal, scoped to `.meetings-workspace-pilot`. Home
  needs the same flip for the two pages to match.

## CLASSES (`/appointments/classes`) — rebuilt layout pass

Verified with Playwright against the dev server in workspace `harbor-home`, using
`UAT Morning Yoga` (12 sessions, 5 seats, 8 registrations, 3 waitlisted) and
`Sunset Restorative Yoga`, which was created through the wizard during this pass.

### Space rule

`[GLOBAL SIDEBAR] [CLASS LIST 230–270px] [CLASS WORKSPACE — everything else]`. One
global sidebar, one narrow object list, and no third vertical column anywhere. Section
navigation is a horizontal strip inside the workspace; registrant detail and waitlist
management open in an overlay drawer rather than taking a column.

| Category | Status | Evidence |
|----------|--------|----------|
| VISUAL | PASS | Four horizontal layers in the workspace; twelve-track section grid; screenshots 01–21 |
| HORIZONTAL SPACE USAGE | PASS | Capacity puts seats / registration state / waitlist across one row above a full-width registrant table; pricing pairs price with payment and packages with memberships; people places instructor beside location |
| COMPACTNESS / DENSITY | PASS | Session rows are ~69px thin horizontal rows, not cards; entitlement and form rows are single-line; long lists scroll inside their panel past ~7 rows instead of growing the page |
| COMPONENT INVENTORY | PASS | `APPOINTMENTS-CLASSES-COMPONENT-CONNECTION-MATRIX.md`, twenty columns per interactive component |
| COMPONENT CONNECTIONS | PASS | Every control traced to a field, a request and a runtime consequence |
| CREATE | PASS | Four-step wizard creates the class **and its sessions** in one action; `Sunset Restorative Yoga` came back with 8 sessions |
| EDIT | PASS | All seven sections drive one editor hook; section is URL-addressable via `?section=` |
| SAVE | PASS | Dirty-gated upsert; clean state renders as a `role="status"` indicator, not a button |
| PERSISTENCE | PASS | Instructor, location, category, description, price, waitlist and a booking question all survived a full reload and are present in the API row |
| CAPACITY ENFORCEMENT | PASS | Server-side. Five enrolled into a five-seat session, the sixth and seventh rejected with `This session is full` |
| WAITLIST | PASS | Rejected registrants joined at positions 1 and 2; the public route turns a full session into a waitlist join returning `202` |
| PUBLIC/RUNTIME | PASS | Price, remaining spots, hidden visibility, the registration window and the custom confirmation all now affect `/book/harbor-home/classes` |
| ROUTE INTEGRITY | PASS | A real workshop-kind row stayed off the Classes list, and its id under `/appointments/classes/` renders **Class not found** |
| EMPTY STATES | PASS | No-selection state with three hints; no-matches vs no-classes in the list; contextual add-staff, add-location, add-resource and new-form |
| ERROR STATES | PASS | Per-step wizard validation; save failure offers Retry save; delete is refused server-side with `10 registrations exist for this class. Deactivate it instead.` |
| RESPONSIVE | PASS | Tab strip only above `640px`, `<select>` only below; grid spans collapse at `1100px` and stack at `700px`; no horizontal overflow at 390px |
| ACCESSIBILITY | PASS | axe wcag2a/aa clean on all seven sections, the list and the wizard, apart from the global header's notification badge |
| CONSOLE/NETWORK | PASS | No console errors, no page errors and no failing requests across every section, both drawers, three modals, the wizard and the public page |

**Counts:** `BROKEN = 0`, `NO_OP = 0`, `PLACEHOLDER = 0`

**Overall:** `APPOINTMENTS_CLASSES_PAGE_COMPLETE: YES`

### Visual scorecard

| Category | Score |
|----------|-------|
| Layout / space usage | 5 |
| Horizontal space usage | 5 |
| Compactness / density | 5 |
| Information hierarchy | 5 |
| Consistency with Services | 5 |
| Iconography | 5 |
| Typography and colour | 4 |
| Responsiveness | 5 |
| Premium feel | 4 |

### Defects fixed in this pass

| Defect | Cause | Fix |
|--------|-------|-----|
| Classes had no registrant, waitlist or delete backend | Only enroll and upsert existed | `list_registrants`, `list_waitlist`, `update_enrollment`, `join_waitlist`, `promote_waitlist`, `remove_waitlist`, `delete` and a shared `assertOccurrenceCapacity` |
| Twenty-five type errors in `service-booking/classes.ts` | `getPrisma()` returns `AppDb`, which is `any`, so every callback parameter was an implicit any | Explicit row types and a shared `ContactLite` select |
| Four dead `class-editor-*` files failed the typecheck | They imported a hook that never existed and nothing imported them | Deleted |
| An existing class showed "Not scheduled" | The recurrence rule was only read, never inferred | `inferClassRecurrence` reads the pattern back off the sessions a class already has |
| Picking a Monday start date still produced Friday sessions | The weekday defaulted from today's date and never followed the start date | `withStartDate` moves a lone weekday selection to match the new date |
| The packages panel grew to ten screens | Every entitlement rendered as a row with no cap | `.ws-row-list.is-scroll` caps a list at `22rem` and scrolls inside the panel |
| The waitlist drawer clipped its Offer and Actions columns | A six-column table in a `30rem` field-list drawer | `Drawer` gained a `wide` variant at `46rem` |
| Two actions in one table cell ran together | No spacing rule for sibling controls | Margin between siblings, kept off `display:flex` so the cell stays a table cell |
| The empty state overflowed a 390px screen | `.ws-empty-state` is a flex item and took its min-content width | `min-width: 0` |
| Two "Classes list" landmarks in the DOM | The empty state rendered a desktop copy and a mobile copy | One list, shown or hidden by breakpoint |
| Instructor and location cards failed axe with `aria-allowed-attr` | `aria-pressed` is not allowed on `role="radio"` | Dropped the attribute; the stylesheet reads `aria-checked` as well |
| Hidden classes still appeared on the public page | `loadPublicGroupOfferings` never read `visibility` | Filtered out at the source |
| The registration window was advertised and never enforced | Neither the read nor the write path used it | `classRegistrationClosedReason` applied to both |
| A full session on a waitlist-enabled class dead-ended | The capacity error was returned as-is | The public route converts it into a real waitlist join returning `202` |
| Price, remaining-spot display and the custom confirmation were stored and ignored | `PublicGroupSeries` carried five fields | The shape now carries what the editor writes |
| Turning the booking page off hid classes but still let people register | The `bookingEnabled` guard was on the classes `GET` only | The same guard on `POST`, matching `/api/public/book/[slug]` |

### Known gaps, stated in the UI rather than faked

Each of these renders as a `.ws-gap-note` beside the control it concerns, so an operator
reads the limit at the moment they configure the thing.

- **No online card payment at class registration.** The public class page registers the
  customer and records the amount owed. Appointments already collect card payment; classes
  have not been connected to it, so a priced class is pay-on-arrival.
- **Packages and memberships grant access but are not redeemed.** The entitlement is
  recorded on the class and is not consumed at class checkout.
- **`memberOnly` is not enforced publicly.** The rule is recorded; the public page does
  not check membership before registering.
- **Booking questions and attached forms are not presented publicly.** They are saved on
  the class, and no answers are stored against a registration.
- **Admission is manual.** Attendance is marked by hand from the registrant table.
  `ClassAdmissionTicket` exists in the schema but nothing issues or scans one, so there is
  no door-scanning flow to switch on.
- **Resources do not block double booking.** They are recorded against the class for
  planning; a class does not hold a room against a session the way appointment booking
  does.
- **Automatic waitlist promotion has no scheduler.** The setting is recorded; today the
  operator gives the seat from the waitlist drawer, which runs the same capacity check.
- **Duplicate does not copy sessions.** The copy opens with the pattern and no sessions,
  which the Schedule section can then generate.

### Pre-existing, outside Classes

`npx tsc --noEmit` reports two errors in the Booking Types editor
(`booking-types-editor-client.tsx` passes `segmentId`, `initialTypeId` and `initialCreate`
to `AppointmentTypesConnected`, which accepts none of them, and
`AppointmentTypesPageModel` requires a `segmentLocked` the connected component never
builds). Both come from the `f83e1cf4` merge and are untouched by this pass.

`POST /api/public/book/[slug]/workshops` had the same missing `bookingEnabled` guard that
was closed on the classes route. It was left for the Workshops pass rather than touched
here. **Resolved** — see the Workshops defect table below.

## WORKSHOPS (`/appointments/workshops`) — rebuilt layout pass

Verified with Playwright and direct API calls against the dev server in workspace
`harbor-home`, using `Winter Pottery Intensive` (one date, 12 spots, 9 registrations,
3 checked in, 3 waitlisted, $85), `Two-Day Watercolour Retreat` (three consecutive dates,
free), `Founders Networking Night` (online, 40 spots), `Autumn Sourdough Basics` (past)
and `Indigo Dyeing Masterclass`, which was created through the wizard during this pass.

### Space rule

`[GLOBAL SIDEBAR] [WORKSHOP LIST 250px] [WORKSHOP WORKSPACE — everything else]`. One
global sidebar, one narrow object list, no third vertical column. The workspace is four
horizontal layers: identity header, event summary strip, horizontal section tabs, section
body. Registrant detail and waitlist management open in an overlay drawer rather than
taking a column.

| Category | Status | Evidence |
|----------|--------|----------|
| VISUAL | PASS | Four horizontal layers; twelve-track section grid; screenshots 01–20 |
| HORIZONTAL SPACE USAGE | PASS | Registration puts status / capacity / window across one row above a full-width registrant table and a full-width waitlist; pricing pairs price with payment and packages with memberships; place puts location beside host; Advanced is a 6/6/6/6 quad |
| COMPACTNESS / DENSITY | PASS | Additional dates are thin timeline rows with a date tile and a marker, not cards; the summary strip is one six-cell line; registrant rows are single-line; long lists scroll inside their panel |
| COMPONENT INVENTORY | PASS | `APPOINTMENTS-WORKSHOPS-COMPONENT-CONNECTION-MATRIX.md`, twenty columns per interactive component |
| COMPONENT CONNECTIONS | PASS | Every control traced to a field, a request and a runtime consequence |
| CREATE | PASS | Four-step wizard creates the workshop **and its date** in one action, then opens Overview with a `Workshop created` toast; if the date fails the workshop is still opened and the toast says so |
| EDIT | PASS | All seven sections drive one editor hook; section is URL-addressable via `?section=` |
| SAVE | PASS | Dirty-gated upsert; clean state renders as a `role="status"` indicator, not a button |
| PERSISTENCE | PASS | Name, category, capacity, price, host, location, waitlist and questions survive a full reload and are present in the API row |
| CAPACITY ENFORCEMENT | PASS | Server-side in `assertOccurrenceCapacity`; a full date is refused before an enrollment is written |
| DATE CHANGE SAFETY | PASS | Moving or cancelling a date with registrations warns with the live count and states plainly that nobody is messaged |
| WAITLIST | PASS | A full workshop converts a public registration into a waitlist join returning `202`; the operator gives the spot from Manage, which reruns the capacity check |
| PUBLIC/RUNTIME | PASS | Price, remaining spots, visibility, registration window, cancelled state and the custom confirmation all affect `/book/harbor-home/workshops`; an online workshop now reads `Online` and the joining link is returned only to the person who registered |
| ROUTE INTEGRITY | PASS | Ten refusal checks in both directions — a class id under `/appointments/workshops/`, and every workshop API action against a class id, return `Workshop not found` / `Class not found` |
| TERMINOLOGY | PASS | No `Class`, `Class session` or `Join class` string reaches a workshop surface; `occurrenceLabel` is `Workshop date` |
| EMPTY STATES | PASS | No-selection state with hints; no-matches vs no-workshops in the list; contextual add-host, add-location, add-resource and new-form |
| ERROR STATES | PASS | Per-step wizard validation; save failure offers Retry save; delete with registrations is refused server-side |
| RESPONSIVE | PASS | Tab strip only above `640px`, `<select>` only below; grid spans collapse at `1100px` and stack at `700px`; no horizontal overflow at 390px |
| ACCESSIBILITY | PASS | axe wcag2a/aa clean on all seven sections, the list and the four wizard steps, apart from the global header's notification badge, which is byte-identical on Classes and Services |
| CONSOLE/NETWORK | PASS | 0 console errors and 0 responses ≥ 400 across every section, both drawers, three modals, the wizard and the public page |

**Counts:** `BROKEN = 0`, `NO_OP = 0`, `PLACEHOLDER = 0`

**Overall:** `APPOINTMENTS_WORKSHOPS_PAGE_COMPLETE: YES`

### Visual scorecard

| Category | Score |
|----------|-------|
| Visual hierarchy | 5 |
| Premium feel | 4 |
| Horizontal space usage | 5 |
| Compactness / density | 5 |
| Iconography | 5 |
| Home design parity | 4 |
| Event-management clarity | 5 |
| Interaction polish | 4 |
| Responsive polish | 5 |

### Defects fixed in this pass

| Defect | Cause | Fix |
|--------|-------|-----|
| Workshops rendered the Classes admin component with an `offeringKind` prop | There was no Workshops page, only a relabelled Classes one | A Workshops workspace, list, header, strip, nav, seven sections and a wizard of its own; the three dead `class-series` files deleted |
| Public registration wrote an enrollment with no `seriesId` | `enrollInClass` took the series from the caller, and the public page registers by date alone | `assertOccurrenceCapacity` returns the series and the enrollment derives it; eight existing rows backfilled |
| Every list row read `0 / 12` | The list query returns dates, and a date carries no count | `countSeriesRegistrations` groups enrollments by series; a workshop is full across the whole event, not per date |
| A class id posted to the workshops endpoint with `seriesId` alone enrolled somebody in the class | The kind was only ever checked through an occurrence | The `seriesId`-only path loads the row and checks `resolveClassSeriesOfferingKind` |
| Turning the booking page off hid workshops but still let people register | The `bookingEnabled` guard was on the workshops `GET` only | The same guard on `POST` |
| The registration window and the cancelled flag were advertised and never enforced publicly | Neither was read on the write path | `publicGroupRegistrationClosedReason` covers both, and the shared helper refuses a cancelled workshop |
| A full waitlist-enabled workshop dead-ended | The capacity error was returned as-is | The public route converts it into a waitlist join returning `202` |
| The public page never said where a workshop happens | `PublicGroupSeries` carried no place | `placeLabel` resolves a named location, a custom note, or `Online`; the joining link is deliberately not public and is returned only in the registration response |
| A missing workshop was refused with `Class not found` in front of a customer | The waitlist helper is shared and assumed a class | A kind-neutral `Registration is no longer available` |
| Registrant names rendered centred and bold | `.ws-table` had no `tbody th` rule, so `<th scope="row">` kept the browser default | Explicit `text-align: left; font-weight: 400` on `tbody th` |
| Three location-mode cards were unreadable in a half-width panel | Icon, name and help were flex siblings sharing ~140px | `.ws-choice-grid.is-tight` puts the name beside the icon and drops the help beneath it |
| The Place section claimed the virtual link was shown with the workshop | It was not surfaced publicly at all | Implemented `placeLabel` and the private `joinUrl`, then rewrote the note to describe exactly that |

### Known gaps, stated in the UI rather than faked

Each renders as a `.ws-gap-note` beside the control it concerns.

- **No online card payment at workshop registration.** A priced workshop is pay-on-arrival
  and the amount owed is recorded.
- **Packages and memberships grant access but are not redeemed**, and `memberOnly` is not
  checked before a public registration.
- **Registration questions and attached forms are not presented publicly**, and no answers
  are stored against a registration, so the registrant drawer says so rather than showing
  an empty answers list.
- **Admission is manual.** Check-in is marked by hand and persists. `ClassAdmissionTicket`
  exists in the schema but nothing issues or scans one, so no QR decoration is drawn.
- **Automatic waitlist promotion has no scheduler.** The operator gives the spot from
  Manage, which runs the same capacity check.
- **Nothing messages anybody.** Cancelling a workshop, cancelling a date, moving a date or
  cancelling a registration all say so in the confirmation instead of implying a notice
  went out, and no refund is promised.
- **Timezone is recorded and displayed, not applied.** Times are entered in the browser's
  zone and are not converted.
- **Resources do not block double booking.** They are recorded for planning.
- **The cancellation window is recorded and displayed**, and there is no self-service
  cancellation for a workshop registration, so nothing enforces it.
- **Duplicate copies configuration only** — never registrants, payments, tickets,
  check-ins or attendance.

### Pre-existing, outside Workshops

The same two Booking Types typecheck errors from the `f83e1cf4` merge remain, untouched.
`react-hooks/set-state-in-effect` fires on the new files; it is endemic to the repo
(339 occurrences) and the Classes and Services pages carry the same pattern.

## PACKAGES (`/appointments/packages`) — rebuilt catalog + editor pass

Full-width catalog table at `/appointments/packages`. Dedicated full-width editor at
`/appointments/packages/[id]`. Four-step create wizard at `/appointments/packages/new`.
No object-list sidebar and no vertical section rail.

| Category | Status | Evidence |
|----------|--------|----------|
| LAYOUT | PASS | Global sidebar + wide workspace only; catalog uses full canvas |
| HORIZONTAL SPACE | PASS | Full-width table; editor uses twelve-track grid |
| DENSITY | PASS | Compact table rows, thin entitlement rows, inline summary strip |
| CATALOG | PASS | Search, status filter, sort, row actions, summary metrics |
| CREATE | PASS | Four-step wizard (Basics / Eligible bookings / Price & validity / Review) |
| EDIT | PASS | Five horizontal sections with `?section=` URL sync |
| ELIGIBILITY | PASS | Canonical `creditRules` on `PackageProduct`; Services/Classes/Workshops toggle the same record |
| CUSTOMER PACKAGES | PASS | Ownership table, detail drawer, manual credit adjustment via ledger |
| ACTIVITY | PASS | Package ledger table per product |
| BOOKING (SERVICES) | PASS (existing) | Service checkout redeems via `bookingTypeId` credit key — unchanged |
| BOOKING (CLASSES/WORKSHOPS) | N/A | Eligibility syncs bidirectionally; registration does not redeem credits yet (stated in UI) |
| MEETINGS | N/A | No package redemption runtime for meetings |

**Counts:** `BROKEN = 0`, `NO_OP = 0`, `PLACEHOLDER = 0`

**Overall:** `APPOINTMENTS_PACKAGES_PAGE_COMPLETE: YES` (service redemption path; class/workshop redemption deferred honestly)

### Known gaps, stated in the UI

- Class and workshop registration does not draw down package credits at checkout yet.
- Per-customer purchase limits are not enforced server-side.
- Meetings are not exposed in eligibility because checkout does not support them.
