# Appointments Meetings — Component Connection Matrix

**Route:** `/appointments/meetings`, `/appointments/meetings/[id]`, `/appointments/meetings/new`
**Pass:** Page 01B — final polish + functional closure
**Verification:** Playwright against the running dev server, workspace `harbor-home`

## Visual system

Structure, type scale, radii, spacing and the 60/30/10 balance are inherited from the
Home page (`appointments-overview-pilot.css`). The accent is teal and is defined in
`meetings-workspace-pilot.css`, scoped to `.meetings-workspace-pilot`.

| Token | Value | Role |
|-------|-------|------|
| `--surface-muted` | canvas | 60% — page and section background |
| `--text-primary` / `--border` | charcoal `#181b1f` family | 30% — structure and type |
| `--ws-accent` | `#0f766e` | 10% — selection, CTA, focus ring |
| `--ws-accent-soft` | `#e9f5f3` | selected choice-card fill |
| `--state-success` / `-warning` / `-error` | semantic | status only, never the accent |

**Discrepancy to note:** the Home page itself still ships the superseded violet
(`--brand-accent: #6b5dd3`) and contains no teal. Meetings adopts Home's structure and
scale but overrides the accent to teal, scoped so Home and Services are untouched.
Home needs the same accent flip to make the two pages match.

## Region map

| Region | Component | Responsibility |
|--------|-----------|----------------|
| Object list | `meetings-list-panel.tsx` | Search, count, select, create |
| Object header | `meeting-object-header.tsx` | Identity, status chips, save state, actions |
| Summary strip | `meeting-summary-strip.tsx` | Five read-only facts, responsive grid |
| Section nav | `meeting-local-nav.tsx` | Rail on desktop, dropdown below `lg`, attention flags |
| Section workspace | `meeting-section-workspace.tsx` | Routes to the six section components |

`meeting-local-nav.tsx` renders both responsive presentations itself, which is what
prevents a caller from mounting the rail and the dropdown at the same time.

## Connection matrix

`FORM` means the control writes to editor form state, which the header's **Save changes**
button persists with `PATCH /api/appointments/types/:id`. `RUNTIME` is the observable
consequence.

### Object list — `meetings-list-panel.tsx`

| Control | Read source | Write target | Runtime | Status |
|---------|-------------|--------------|---------|--------|
| Search | local state | filters list | — | WORKING |
| Meeting row | `GET /api/appointments/types` | `router.push` | selects object | WORKING |
| Count badge | types length | — | — | WORKING |
| `+ New` | — | `/appointments/meetings/new` | opens wizard | WORKING |
| Secondary line | `durationMinutes`, `config.location` | — | shows `30 min · Zoom`, or `Method not set` | WORKING |

### Object header — `meeting-object-header.tsx`

| Control | Read source | Write target | Runtime | Status |
|---------|-------------|--------------|---------|--------|
| Save changes | dirty form | `PATCH /api/appointments/types/:id` | persists all sections | WORKING |
| Saved indicator | save status | — | `role="status"`, not a button | WORKING |
| View booking page | `workspace.slug` + id | opens `/book/:slug/:id` | public page | WORKING |
| Copy link | booking URL | clipboard | — | WORKING |
| Duplicate | form | `POST /api/appointments/types` | new MEETING row | WORKING |
| Activate / Deactivate | `config.enabled` | `PATCH` | public visibility | WORKING |
| Active / visibility chips | `enabled`, `visibility` | — | — | WORKING |

### Summary strip — `meeting-summary-strip.tsx`

Duration, Host, Method, Availability, Price. Read-only, each cell carries a `title`
tooltip with the untruncated value and renders muted when unset. Grid is 2 columns
below `640px`, 3 to `1280px`, 5 above; the trailing cell spans to fill the row.

### Overview — `meeting-overview-section.tsx`

| Control | Field | Runtime | Status |
|---------|-------|---------|--------|
| `#ov-name` | `name` | public booking title | WORKING |
| `#ov-duration` | `durationMinutes` | slot length | WORKING |
| `#ov-desc` | `config.description` | public description | WORKING |
| Booking URL + View / Copy | `workspace.slug` | public page | WORKING |
| Customer preview | form | — | mirrors public header | WORKING |
| Setup health + `Fix` | `meetingSetupSteps()` | jumps to the blocking section | WORKING |

### Availability — `meeting-availability-section.tsx`

| Control | Field | Runtime | Status |
|---------|-------|---------|--------|
| `#av-duration` | `durationMinutes` | slot length | WORKING |
| `#av-buffer` | `bufferMinutes` | gap after booking | WORKING |
| `#av-notice` | `minimumBookingNoticeMinutes` | hides near slots | WORKING |
| `#av-ahead` | `maximumBookingDaysAhead` | booking horizon | WORKING |
| `#av-schedule` | `namedScheduleId` | slot generation | WORKING |
| Manage schedules | — | `/appointments/availability` | WORKING |

### Hosts & method — `meeting-hosts-section.tsx`, `meeting-method-section.tsx`

| Control | Field | Runtime | Status |
|---------|-------|---------|--------|
| Any available host | `staffAssignment=any_eligible` | any active host | WORKING |
| Specific hosts | `staffAssignment=specific_staff` + `staffIds` | restricted pool | WORKING |
| Customer chooses | `staffAssignment=customer_chooses` + `staffIds` | host picker on public page | WORKING |
| Round robin | `staffAssignment=round_robin` + `staffIds` | rotates | WORKING |
| Maximise availability | `staffAssignment=maximize_availability` + `staffIds` | union of hosts | WORKING |
| Collective | `staffAssignment=collective` + `collectiveStaffIds` | all must be free | WORKING |
| Host chips | pool for the active strategy | assignment | WORKING |
| `#hosts-add` + Add host | `PATCH /api/appointments/settings` `{staff}` | creates a bookable host in place | WORKING |
| Method cards | `config.location` | join method | WORKING |
| `#method-link` | `config.meetingLink` | join URL sent to the customer | WORKING |
| `#method-location` | `config.locationId` | in-person address | WORKING |
| `#method-new-location` | `PATCH /api/appointments/settings` `{locations}` | creates a location in place | WORKING |
| Collect a phone number | appends a required phone question | public intake | WORKING |
| Connection status chip | `GET /api/integrations/calendars` | truthful per provider | WORKING |
| Transovo Video settings | video config | `VideoMeeting` room | WORKING |
| AI Notetaker settings | notetaker config | notetaker join | WORKING |

The method status chip states the requirement for an unselected method and the actual
state for the selected one (`Link set`, `Location set`, `Connected`, `Reconnect needed`).

### Questions — `meeting-questions-section.tsx`

| Control | Field | Runtime | Status |
|---------|-------|---------|--------|
| Always collected | — | name and email are implicit | WORKING |
| Add question modal | `config.bookingQuestions` | public intake | WORKING |
| `#q-label` / `#q-type` / `#q-options` | question fields | intake rendering | WORKING |
| Required to book | `question.required` | validation | WORKING |
| Move up / down | `displayOrder` | intake order | WORKING |
| Edit / Delete | question row | intake | WORKING |

### Booking rules — `meeting-rules-section.tsx`

| Control | Field | Runtime | Status |
|---------|-------|---------|--------|
| Booking approval | `bookingApprovalRequired` | pending vs confirmed | WORKING |
| `#rule-cancel` / `#rule-cancel-hours` | `cancellationPolicy` | cancel window | WORKING |
| `#rule-resched` / `#rule-resched-hours` | `reschedulePolicy` | reschedule window | WORKING |
| `#rule-day` / `#rule-week` / `#rule-month` | booking limits | slot filtering | WORKING |
| Recurring bookings | `recurringEnabled` | repeat option | WORKING |

### Advanced — `meeting-advanced-section.tsx`

| Control | Field | Runtime | Status |
|---------|-------|---------|--------|
| `#adv-pay-mode` | `paymentMode` | checkout | WORKING |
| `#adv-pay-provider` | `paymentProvider` | checkout | WORKING |
| `#adv-pay-price` | `paymentPriceCents` | amount charged | WORKING |
| `#adv-conf-head` / `#adv-conf-body` | confirmation copy | done step | WORKING |
| `#adv-visibility` | `visibility` | listing on the booking page | WORKING |
| `#adv-redirect-url` | `redirectAfterBookingUrl` | post-booking redirect | WORKING |
| Open reminders | — | `/appointments/automations` | WORKING |

Each module expands in place under its own summary row, so no setting is shown twice.

### Create wizard — `create-meeting-wizard.tsx`

| Control | Behaviour | Status |
|---------|-----------|--------|
| `#wiz-name`, `#wiz-duration`, `#wiz-desc` | Step 1, name required | WORKING |
| Method cards + `#wiz-link` | Step 2, link required for link methods | WORKING |
| `#wiz-host` | Step 2 host select | WORKING |
| Add host inline | `PATCH /api/appointments/settings` when no staff exist | WORKING |
| `#wiz-schedule`, `#wiz-notice`, `#wiz-ahead` | Step 3 | WORKING |
| Create meeting | `POST /api/appointments/types` | creates a MEETING and opens its editor | WORKING |
| Meeting so far panel | reflects entered values | WORKING |

## Counts

| | |
|---|---|
| BROKEN | 0 |
| PLACEHOLDER / NO_OP | 0 |

## Known gaps outside this page

- **Availability engine latency.** `getAvailability` issues one conflict query, one
  booking-limit query and one staff query per candidate slot: 206 queries for 33 slots,
  about 15.5s for a 14-day window, measured outside Next as well as through the API. It
  is in `availability-engine.ts` and affects every booking type, not just meetings.
- **No delete for booking types.** There is no `deleteAppointmentType` anywhere in the
  backend and no `DELETE` route on `/api/appointments/types/:id`. Deactivate is the
  supported retirement path, so the header menu offers that instead.
- **Provider connect flows.** Google and Microsoft show their real connection state from
  `/api/integrations/calendars`; completing an OAuth connect needs provider credentials.
