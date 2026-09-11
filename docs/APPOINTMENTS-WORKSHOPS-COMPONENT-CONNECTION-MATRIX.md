# Appointments Workshops — Component Connection Matrix

**Routes:** `/appointments/workshops`, `/appointments/workshops/[id]`, `/appointments/workshops/new`
**Pass:** Workshops rebuilt layout / UX / functional specification
**Verification:** Playwright and direct API calls against the running dev server, workspace
`harbor-home`. Data: `Winter Pottery Intensive` (one date, 12 spots, 9 registrations,
3 checked in, 3 waitlisted, $85), `Two-Day Watercolour Retreat` (three consecutive dates,
free), `Founders Networking Night` (online, 40 spots), `Autumn Sourdough Basics` (past),
and `Indigo Dyeing Masterclass`, created through the wizard during this pass.

## Space rule

```
[ GLOBAL SIDEBAR ] [ WORKSHOP LIST 250px ] [ WORKSHOP WORKSPACE — everything else ]
```

There is no third vertical column anywhere on the page. Section navigation is a
horizontal strip inside the workspace above the section body, and it collapses to a single
`<select>` below `640px`. Record detail that would otherwise want a column — registrant
detail, waitlist management — opens in an overlay drawer.

The workspace is four horizontal layers: identity header, event summary strip, section
tabs, section body. Inside the body the section is a twelve-track grid (`.ws-grid12`).
Spans are live above `1100px`, collapse to halves between `700px` and `1099px`, and stack
below that.

| Section | Row 1 | Row 2 | Row 3 |
|---------|-------|-------|-------|
| Overview | Workshop details 7 / Event snapshot 5 | Registration snapshot 5 / Customer preview 7 | Setup summary 12 |
| Date & time | Primary session 8 / Quick actions 4 | Sessions timeline 12 | — |
| Place | Location 6 / Host 6 | Rooms & equipment 12 | — |
| Registration | Registration status 4 / Capacity 4 / Registration window 4 | Registrants 12 | Waitlist 12 |
| Pricing & access | Registration price 5 / Payment requirement 7 | Packages 6 / Memberships 6 | Access rules 12 |
| Customer setup | Registration questions 7 / Customer information 5 | Attached forms 12 | — |
| Advanced | Policies 6 / Admission & tickets 6 | Confirmation 6 / Reminders 6 | — |

## Region map

| Region | Component | Responsibility |
|--------|-----------|----------------|
| Object list | `workshops-list-panel.tsx` | Search, four state filters, count, select, create |
| Object header | `workshop-object-header.tsx` | Identity, status chips, save state, actions |
| Summary strip | `workshop-summary-strip.tsx` | Date, Registered, Capacity, Location, Price, Host |
| Section nav | `workshop-local-nav.tsx` | Horizontal strip; `<select>` below `640px` |
| Section workspace | `workshop-section-workspace.tsx` | Routes to the seven section components |
| Data layer | `use-workshop-editor.ts` | The only place a workshop is read, saved or mutated |
| Wizard | `create-workshop-wizard.tsx` | Basics / Date & place / Registration / Review |

`workshop-local-nav.tsx` renders both responsive presentations itself, so a caller cannot
mount the strip and the dropdown at the same time. Which one shows is decided in
`workspace-pilot.css`, because `.ws-section-tabs` sets `display` and would beat a utility
class.

## What makes a workshop not a class

Both are `ClassSeries` rows. Three things differ, and they drive the whole page.

| | Class | Workshop |
|---|---|---|
| Time | a recurrence pattern that expands into sessions | one date, occasionally a handful of consecutive ones |
| Capacity | seats per session; a customer books a session | one place for the whole event, counted across the series |
| Place | inherits a room from the business | states its own: a room, online, or a one-off venue |

`workshop-schedule.ts`, `workshop-form.ts` and `workshop-summary.ts` exist because of that
column, not to duplicate the class ones. `workshopSeats()` counts the series;
`primarySession()` picks the date the workshop is "about"; `formatSessionSpan()` renders
`Oct 12`, `Oct 12–14` or `Oct 12 +3` for the list row.

## Matrix schema

Every interactive component below is recorded against the same twenty columns.

| # | Column | Meaning |
|---|--------|---------|
| 1 | Control | The interactive element |
| 2 | Section | Where it lives |
| 3 | Kind | Element type |
| 4 | Accessible name | What assistive tech announces |
| 5 | Reads | Where its value comes from |
| 6 | Writes | Immediate target of the interaction |
| 7 | Persist call | Request that makes it durable |
| 8 | Stored at | Column or metadata key |
| 9 | Validation | Rule enforced before persistence |
| 10 | Disabled when | Conditions that block the control |
| 11 | Loading | Behaviour while a request is in flight |
| 12 | Empty | Behaviour with no data |
| 13 | Error | Behaviour on failure |
| 14 | Admin effect | Observable consequence in the workspace |
| 15 | Public effect | Observable consequence for a customer |
| 16 | A11y | Semantics beyond a plain label |
| 17 | Responsive | Behaviour below `1100px` / `640px` |
| 18 | Evidence | Screenshot or log that shows it working |
| 19 | Gap | Known limitation, honestly stated |
| 20 | Status | `WORKING`, `PARTIAL` or `BROKEN` |

`FORM` means the control writes to editor form state, which the header's **Save changes**
button persists with `POST /api/appointments/service-booking/workshops` (an upsert keyed on
`id`). Controls that act immediately name their own action instead.

---

## Object list — `workshops-list-panel.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Search | List | `input[type=search]` | Search workshops | local state | filter | — | — | — | never | list skeleton | "No matches" | — | filters rows | — | labelled input | full width | 01 | — | WORKING |
| State filter | List | `role=tab` | All / Upcoming / Past / Inactive | local state, session dates | filter | — | — | — | never | — | "Try a different filter" | — | narrows the list to a lifecycle stage | — | `role=tablist`, `aria-selected` | stays one row | 01 | — | WORKING |
| Workshop row | List | `button` in `role=listbox` | workshop name | `GET .../workshops`, kind-filtered on the server | `router.push` | — | — | — | never | skeleton rows | see empty state | list shows Retry | opens the workshop | — | `role=option`, `aria-selected` | stacks above workspace | 01, 02 | — | WORKING |
| Secondary line | List | text | — | session span, `registeredCount`/capacity, price | — | — | — | — | — | — | "No date set" | — | `Sep 23 · 9/12 · $85` | — | — | — | 01, 05 | — | WORKING |
| Cancelled / Inactive chip | List | text | — | `metadata.cancelledAt`, `active` | — | — | — | — | — | — | hidden | — | marks a workshop that takes nothing | — | — | — | 01 | — | WORKING |
| Count badge | List | text | — | rows length | — | — | — | — | — | — | `0` | — | shows scope | — | — | — | 01 | — | WORKING |
| `+ New` | List | `Link` | New | — | `/appointments/workshops/new` | — | — | — | never | — | — | — | opens the wizard | — | link semantics | — | 01, 13 | — | WORKING |

## Object header — `workshop-object-header.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Save changes | Header | `button` | Save changes | dirty snapshot | upsert | `POST .../workshops` | all columns + metadata | `validateWorkshopForm` | clean or saving | "Saving…" | — | "Retry save" + message | persists every section | settings take effect | — | stays in header | demo video, runtime log | — | WORKING |
| Saved indicator | Header | `role=status` | Saved | save status | — | — | — | — | — | — | — | — | not a button when clean | — | `role=status` | — | 02 | — | WORKING |
| View registration page | Header | `button` | View registration page | `workspace.slug` | opens `/book/:slug/workshops` | — | — | — | no slug | — | — | — | opens the public page | — | — | label shortens to "View" | 17, 20 | — | WORKING |
| Copy link | Header | `button` | Copy registration link | booking URL | clipboard | — | — | — | no slug | — | — | inline message | "Copied" for 2s | — | `aria-label` | — | 02 | — | WORKING |
| Overflow menu | Header | `button` | More actions | — | menu open | — | — | — | never | — | — | — | reveals four actions | — | `aria-haspopup`, `aria-expanded` | — | 02 | — | WORKING |
| Duplicate workshop | Menu | `button` | Duplicate workshop | form | create | `POST .../workshops` | new row | name required | saving | disabled | — | inline error | opens the copy with the date cleared | copy is a separate workshop, unlisted until dated | — | — | runtime log | registrants, waitlist, payments and dates are deliberately **not** copied | WORKING |
| Cancel workshop | Menu | `button` + modal | Cancel workshop | registrant count | `cancelledAt`, `active=false` | `POST .../workshops` | `metadata.cancelledAt` | — | already cancelled | "Cancelling…" | — | inline error | chip flips to Cancelled, registrations stay on the record | registration returns 400 "This workshop has been cancelled" | modal states the count | modal full width on mobile | runtime log | nobody is messaged and nothing is refunded; the modal says so | WORKING |
| Reopen workshop | Menu | `button` | Reopen workshop | `metadata.cancelledAt` | clears it, `active=true` | `POST .../workshops` | same | — | not cancelled | disabled | — | inline error | chip flips back | registration reopens | — | — | runtime log | — | WORKING |
| Activate / Deactivate | Menu | `button` | Deactivate | `active` | `active` | `POST .../workshops` | `ClassSeries.active` | — | saving | disabled | — | inline error | chip flips | drops off the public list | — | — | 02 | — | WORKING |
| Delete workshop | Menu | `button` + modal | Delete workshop | — | confirm modal | `POST {action:"delete"}` | row removed | server refuses if anyone is registered | saving | "Deleting…" | — | keeps the modal open with the reason | returns to the list | workshop disappears | modal semantics | — | runtime log | — | WORKING |
| Status chips | Header | text | — | `active`, `visibility`, `cancelledAt` | — | — | — | — | — | — | — | — | state at a glance | — | — | wrap | 02 | — | WORKING |

## Summary strip — `workshop-summary-strip.tsx`

Read-only. Date, Registered, Capacity (`registered / capacity`), Location, Price, Host.
Unset values render muted rather than blank, so an unconfigured workshop reads as
unconfigured instead of broken. Every cell carries a `title` and an `sr-only` label, so
nothing truncates without a way to read it. The strip reflows from six cells to three to
two.

## Section navigation — `workshop-local-nav.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Section tab | Nav | `button` | section label | `?section=` | `router.replace` | — | URL | — | never | — | — | — | swaps the section body | — | `aria-current` | hidden below `640px` | 02–12 | — | WORKING |
| Attention dot | Nav | text | "<section> needs attention" | blocking-setup set | — | — | — | — | — | — | absent | — | flags an unfinished section | — | `aria-label` | — | 02 | — | WORKING |
| Section select | Nav | `select` | Workshop section | `?section=` | `router.replace` | — | URL | — | never | — | — | — | same as the tabs | — | labelled select | only below `640px` | 17, 18 | — | WORKING |

## Overview — `workshop-overview-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#wks-name` | Overview | `input` | Name | `form.name` | FORM | Save | `ClassSeries.name` | required | never | — | placeholder | blocks save | header title follows | workshop title | `htmlFor` | full width | 02 | — | WORKING |
| `#wks-category` | Overview | `input` | Category | `form.category` | FORM | Save | `metadata.category` | — | never | — | blank | — | header subtitle | groups on the public page | `htmlFor` | 3→1 col | 02, demo video | — | WORKING |
| `#wks-visibility` | Overview | `select` | Visibility | `form.visibility` | FORM | Save | `metadata.visibility` | — | never | — | `public` | — | chip flips | hidden workshops are filtered out of `/book/:slug/workshops` | `htmlFor` | 3→1 col | 02 | — | WORKING |
| `#wks-status` | Overview | `select` | Status | `form.active` | FORM | Save | `ClassSeries.active` | — | never | — | `active` | — | chip flips | inactive takes no registrations | `htmlFor` | 3→1 col | 02 | — | WORKING |
| `#wks-description` | Overview | `textarea` | Description | `form.description` | FORM | Save | `ClassSeries.description` | 500 chars, counter | never | — | placeholder | — | customer preview updates live | shown under the workshop | counter is `aria-live` | full width | 02 | — | WORKING |
| `#wks-image` | Overview | `input[url]` | Image URL | `form.imageUrl` | FORM | Save | `metadata.imageUrl` | — | never | — | placeholder | — | — | stored and exposed; the current public list template renders text only | `htmlFor` | full width | 02 | no image slot on the public list yet | PARTIAL |
| Event snapshot → Manage date & time | Overview | `button` | Manage date & time | sessions | section change | — | — | — | never | — | "No date set" | — | jumps to Date & time | — | — | — | 02 | — | WORKING |
| Registration snapshot → View registrations | Overview | `button` | View registrations | registrants, waitlist | section change | — | — | — | never | counts blank | zeroes | — | jumps to Registration | — | — | — | 02 | — | WORKING |
| Customer preview → Open / Copy link | Overview | `button` | Open | booking URL | opens public page / clipboard | — | — | — | no slug | — | — | — | — | the page the customer sees | — | — | 02, 20 | — | WORKING |
| Setup jump chip | Overview | `button` | step name | setup steps | section change | — | — | — | step complete | — | — | — | jumps to the blocking section, tooltip names the blocker | — | `title` | wraps | 02 | — | WORKING |
| Setup row Edit | Overview | `button` | Edit | setup steps | section change | — | — | — | never | — | — | — | jumps to that section | — | — | rows stay thin | 02 | — | WORKING |

The Registration snapshot shows **Checked in** only when `admissionEnabled` is on, so a
workshop that does not track admission does not display a metric that will always read
zero.

## Date & time — `workshop-datetime-section.tsx`

A workshop has no recurrence. The primary session is edited in place and extra dates are
added one at a time, because a workshop that runs across three days is three known dates
rather than a pattern.

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#wks-primary-date` | Date & time | `input[date]` | Date | `form.schedule.date` | FORM | "Update this date" | `ClassOccurrence.startsAt` | required, `min` is today | never | — | falls back to `recurrenceRule.startDate` | inline error | date tile follows | the day customers register for | `htmlFor` | 2→1 col | 03 | — | WORKING |
| `#wks-primary-start` | Date & time | `input[time]` | Start time | `form.schedule.startTime` | FORM | same | `startsAt` | — | never | — | `09:00` | inline error | preview follows | start time | `htmlFor` | 2→1 col | 03 | — | WORKING |
| `#wks-primary-duration` | Date & time | `input[number]` + suffix | Duration | `form.schedule.durationMinutes` | FORM | same | `endsAt` | min 5 | never | — | `180` | inline error | hint reads "6 hours" | how long it runs | `htmlFor` | 2→1 col | 03 | — | WORKING |
| Length preset | Date & time | `select` | Length preset | duration | FORM | same | `endsAt` | — | never | — | "Custom" | — | sets the duration above | — | `htmlFor` | 2→1 col | 03 | — | WORKING |
| `#wks-timezone` | Date & time | `select` | Timezone | `form.timezone` | FORM (Save) | Save | `metadata.timezone` | — | never | — | browser zone | — | shown beside the time | — | `htmlFor` | 2→1 col | 03 | times are entered in the browser zone; the field records intent and does not convert | PARTIAL |
| Update this date / Set the date | Date & time | `button` | Update this date | schedule draft | `update_occurrence` or `occurrences` | same call | `ClassOccurrence` | needs a date | saving, or no date | disabled | reads "Set the date" | inline error | the session row moves | the public date moves | — | full width | 03 | — | WORKING |
| Move confirmation | Modal | `button` | Move the workshop | registrant count | the write above | same | same | — | — | "Saving…" | not shown with 0 registrations | inline error | names the count before writing | — | modal semantics | full width | 03 | reminders do not send a change notice; the modal says so | WORKING |
| Add another session | Date & time | `button` + modal | Add another session | new draft | `POST {action:"occurrences"}` | same call | new `ClassOccurrence` | needs a date | unsaved workshop | "Adding…" | — | inline error | row appears in the timeline | another day of the same workshop | modal semantics | full width | 04 | — | WORKING |
| Session Edit | Timeline | `button` | Edit | occurrence | `POST {action:"update_occurrence"}` | same call | `startsAt`/`endsAt` | — | cancelled | "Saving…" | — | inline error | the row moves | that date only | modal semantics | full width | 04 | — | WORKING |
| Session Cancel | Timeline | `button` + modal | Cancel | occurrence | `POST {action:"cancel_occurrence"}` | same call | `status=cancelled` | — | already cancelled | row dims | — | inline error | row reads Cancelled and strikes through | the date leaves the public list | — | — | 04 | registrants are not notified automatically | PARTIAL |
| Quick actions counts | Date & time | text | — | sessions, registrants | — | — | — | — | — | — | zeroes | — | Upcoming / Registered / Cancelled | — | `dl` semantics | — | 03, 04 | — | WORKING |

## Place — `workshop-place-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| In person / Online / One-off venue | Place | `role=radio` | mode name | `form.locationMode` | FORM | Save | `metadata.locationMode` | — | never | — | `in_person` | — | swaps the control beneath | changes what the listing says | `role=radiogroup`, `aria-checked` | 3→1 col, `is-tight` layout | 05 | — | WORKING |
| Location card | Place | `role=radio` | location name | `form.locationId` | FORM | Save | `ClassSeries.locationId` | — | mode ≠ in person | grid skeleton | only "Unassigned" | — | strip shows the place | the room is named on the listing | `role=radiogroup` | 2→1 col | 05, 20 | — | WORKING |
| Add location | Place | `button` + modal | Add location | `#wks-new-location` | `PATCH /api/appointments/settings` | same call | workspace locations | name required | blank name | "Adding…" | — | modal stays open | new card appears selected, the workshop draft is untouched | usable by every object | modal semantics | — | 05 | — | WORKING |
| `#wks-virtual-url` | Place | `input[url]` | Joining link | `form.virtualUrl` | FORM | Save | `metadata.virtualUrl` | must parse as a URL | mode ≠ online | — | placeholder | blocks save | — | listing says "Online"; the link is returned with the registration, not on the listing | `htmlFor` | full width | 05, public log | nothing creates the meeting — the link is pasted in | WORKING |
| `#wks-location-note` | Place | `input` | Venue | `form.locationNote` | FORM | Save | `metadata.locationNote` | — | mode ≠ one-off | — | placeholder | — | strip shows the note | printed on the listing as written | `htmlFor` | full width | 05 | free text; it is not geocoded or mapped | PARTIAL |
| Host card | Place | `role=radio` | staff name | `form.staffId` | FORM | Save | `ClassSeries.staffId` | — | never | grid skeleton | only "Unassigned" | — | strip shows the host | named on the registration page | `role=radiogroup`, `aria-checked` | auto-fill grid | 05 | one host per workshop | WORKING |
| Add host | Place | `button` + modal | Add host | `#wks-new-staff` | `PATCH /api/appointments/settings` | same call | workspace staff | name required | blank name | "Adding…" | — | modal stays open | new card appears selected | bookable host everywhere | modal semantics | — | 05 | — | WORKING |
| Resource row | Place | `role=checkbox` row | resource name | `form.resourceIds` | FORM | Save | `metadata.resourceIds` | — | never | rows skeleton | "No resources yet" | — | recorded on the workshop | — | `aria-checked` on a full-width row | rows stay thin | 05 | recorded for planning; a workshop does not hold a room or a resource against a date, so double booking is not blocked | PARTIAL |
| Add resource | Place | `button` + modal | Add resource | `#wks-new-resource`, `-qty` | `POST .../resources` | same call | resource row | name required | blank name | "Adding…" | — | modal stays open | row appears selected | — | modal semantics | — | 05 | — | WORKING |

## Registration — `workshop-registration-section.tsx`

Capacity is one number for the whole event. A workshop with three dates does not sell
three sets of places.

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Registration status | Registration | text | — | active, visibility, window, seats, cancelled | — | — | — | — | — | — | "No date" | — | one sentence saying whether anyone can register and why not | mirrors what the public page does | `ws-chip` tone | 3→1 col | 06 | — | WORKING |
| `#wks-capacity` | Registration | `input[number]` + suffix | Maximum registrations | `form.capacity` | FORM, guarded | Save | `ClassSeries.capacity` | ≥ 1; a value below the live registration count opens a warning modal instead of applying | never | — | `20` | blocks save | meter and stat update | **enforced server-side** by `assertOccurrenceCapacity` | `htmlFor` | 3→1 col | 06, runtime log | — | WORKING |
| Capacity warning | Modal | `button` | Keep <n> / Lower anyway | registrants | FORM | Save | same | — | — | — | not shown when safe | — | names how many are already registered before letting the number drop | nobody is un-registered by lowering it | modal semantics | full width | 06 | lowering below the count is allowed once confirmed; existing registrations are never removed | WORKING |
| Show spots publicly | Registration | `role=switch` | Show spots publicly | `form.showRemainingSpots` | FORM | Save | `metadata.showRemainingSpots` | — | never | — | on | — | — | "3 spots left" appears or is suppressed | `role=switch` | — | 06, 20 | — | WORKING |
| `#wks-reg-opens` | Registration | `input[datetime-local]` | Opens | `form.registrationOpensAt` | FORM | Save | `metadata.registrationOpensAt` | must precede close | never | — | blank = open now | blocks save | status reads "Opens later" | register returns 400 before the window | `htmlFor` | 3→1 col | 06, runtime log | — | WORKING |
| `#wks-reg-closes` | Registration | `input[datetime-local]` | Closes | `form.registrationClosesAt` | FORM | Save | `metadata.registrationClosesAt` | must follow open | never | — | blank = until the start | blocks save | status reads "Closed" | register returns 400 "Registration has closed" | `htmlFor` | 3→1 col | 06, runtime log | — | WORKING |
| Registrant name / Details | Registrants | `button` | customer name | registrant | opens drawer | — | — | — | never | table skeleton | "No registrations yet" | — | detail drawer, not a fourth column | — | `role=dialog`, Escape closes | drawer overlays | 07, 12 | — | WORKING |
| Check in | Registrants | `button` | Check in | `registrant.attendance` | `POST {action:"update_enrollment"}` | same call | `ClassEnrollment.attendance` | — | cancelled registration | button busy | — | reverts with a message | pill flips to "Checked in", Advanced counts it | — | `aria-pressed` | table scrolls | 07, 12, demo video | marked by hand; `ClassAdmissionTicket` exists in the model but nothing issues or scans a QR code | PARTIAL |
| Cancel / Restore | Registrants | `button` | Cancel | `registrant.status` | `POST {action:"update_enrollment"}` | same call | `ClassEnrollment.status` | — | never | row busy | — | reverts with a message | frees a place | the place becomes available | — | — | 07 | the customer is not notified automatically | PARTIAL |
| `#wks-detail-status` | Drawer | `select` | Registration status | registrant | `update_enrollment` | same call | `status` | — | never | — | — | inline error | row updates and the drawer stays open | — | `htmlFor` | full width | 12 | — | WORKING |
| Take a waitlist when full | Registration | `role=switch` | Take a waitlist when full | `form.waitlistEnabled` | FORM | Save | `metadata.waitlistEnabled` | — | never | — | off | — | reveals the other two settings | a full workshop returns 202 and queues the person instead of refusing | `role=switch` | 3→1 col | 06, runtime log | — | WORKING |
| Offer a spot automatically | Registration | `role=switch` | Offer a spot automatically | `form.waitlistAutoPromote` | FORM | Save | `metadata.waitlistAutoPromote` | — | waitlist off | — | off | — | recorded | — | `role=switch` | — | 06 | recorded; nothing runs on a schedule to promote yet — the operator gives the spot from Manage | PARTIAL |
| `#wks-waitlist-hours` | Registration | `input[number]` + suffix | Offer expires after | `form.waitlistOfferExpiresHours` | FORM | Save | `metadata.waitlistOfferExpiresHours` | ≥ 1 | waitlist off | — | `24` | — | recorded | — | `htmlFor` | — | 06 | same as above | PARTIAL |
| Manage (waitlist) | Registration | `button` | Manage | waitlist | opens wide drawer | — | — | — | waitlist empty | — | disabled | — | wide drawer, not a third column | — | `role=dialog` | drawer full width on mobile | 06 | — | WORKING |
| Give a spot | Drawer | `button` | Give a spot | waitlist entry | `POST {action:"promote_waitlist"}` | same call | enrollment + entry status | server capacity check | no upcoming date, or no linked contact | "Offering…" | "Set a date first" note | fails rather than overselling | entry leaves the waitlist | the customer is registered | `title` explains a disabled button | — | 06 | — | WORKING |
| Remove | Drawer | `button` | Remove | waitlist entry | `POST {action:"remove_waitlist"}` | same call | entry removed | — | never | — | — | inline error | positions renumber | — | — | — | 06 | — | WORKING |

## Pricing & access — `workshop-pricing-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Free / Paid | Pricing | `role=radio` | Free / Paid | `form.isFree` | FORM | Save | `metadata.isFree` | — | never | — | Free | — | reveals or hides Price | "Free" or the amount on the listing | `role=radiogroup`, `aria-checked` | 2→1 col | 08 | — | WORKING |
| `#wks-price` | Pricing | `input[number]` | Price | `form.priceCents` | FORM | Save | `metadata.priceCents` | > 0 when paid | free | — | `0.00` | blocks save | strip shows `$85` | `$85.00` on the registration row | `htmlFor` | — | 08, 20 | no online card capture at workshop registration | PARTIAL |
| No payment / Pay on arrival | Pricing | `role=radio` | payment mode | `form.isFree` | FORM | Save | `metadata.paymentMode` | — | the free option follows the price | — | derived | — | states plainly what is collected and when | the amount owed is recorded, not charged | `role=radiogroup` | 2→1 col | 08 | online card and deposit are not wired to workshops; the panel says so rather than offering a control that does nothing | PARTIAL |
| Package Grant access / Remove | Pricing | `button` | Grant access | `form.packageProductIds` | FORM | Save | `metadata.packageProductIds` | — | never | rows skeleton | "No packages exist yet" | — | row flips | — | `aria-pressed` | list scrolls past ~7 rows | 09 | recorded; a registration does not draw down a package credit at checkout yet | PARTIAL |
| Membership Grant access / Remove | Pricing | `button` | Grant access | `form.membershipProductIds` | FORM | Save | `metadata.membershipProductIds` | — | never | rows skeleton | "No memberships exist yet" | — | row flips | — | `aria-pressed` | list scrolls | 09 | same as packages | PARTIAL |
| Members only | Pricing | `role=switch` | Members only | `form.memberOnly` | FORM | Save | `metadata.memberOnly` | — | never | — | off | — | recorded | — | `role=switch` | — | 09 | recorded; the public page does not check membership before registering, and the panel says to keep the workshop hidden if the check has to hold | PARTIAL |
| Manage packages / memberships / Payment settings | Pricing | `Link` | — | — | navigation | — | — | — | never | — | — | — | leaves the page | — | link semantics | — | 08, 09 | — | WORKING |

## Customer setup — `workshop-customer-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Add question | Customer | `button` + modal | Add question | `#wks-q-label`, `-type`, `-options`, Required | FORM | Save | `metadata.bookingQuestions` | label required | blank label | — | "No questions yet" | modal stays open | row appears | — | modal semantics | full width | 10 | saved on the workshop; the public registration form does not render them yet and no answers are stored | PARTIAL |
| Question Edit | Customer | `button` + modal | Edit | the question | FORM | Save | same | label required | never | — | — | modal stays open | row updates in place | — | modal semantics | — | 10 | — | WORKING |
| Question up / down | Customer | `button` | Move up / Move down | question order | FORM | Save | same array order | — | first / last row | — | — | — | order is the order customers would see | — | `aria-label` per row | rows stay thin | 10 | — | WORKING |
| Question Remove | Customer | `button` | Remove | `metadata.bookingQuestions` | FORM | Save | same | — | never | — | — | — | row disappears | — | — | rows stay thin | 10 | — | WORKING |
| First name and phone | Customer | `role=switch` | First name and phone | — | — | — | — | — | always disabled | — | — | — | states the floor, honestly non-interactive | always required | `disabled` + explanation | — | 10 | — | WORKING |
| Require last name | Customer | `role=switch` | Require last name | `form.requireLastName` | FORM | Save | `metadata.requireLastName` | — | never | — | off | — | recorded | — | `role=switch` | — | 10 | recorded; the public form always shows the field and does not enforce it | PARTIAL |
| Require email | Customer | `role=switch` | Require email | `form.requireEmail` | FORM | Save | `metadata.requireEmail` | — | never | — | off | — | recorded | — | `role=switch` | — | 10 | same as above | PARTIAL |
| Form Attach / Detach | Customer | `button` | Attach | `form.intakeFormIds` | FORM | Save | `metadata.intakeFormIds` (+ legacy `intakeFormId`) | — | never | rows skeleton | "No forms yet" | — | row flips | — | `aria-pressed` | list scrolls | 10 | attached and stored; the public registration flow does not present the form | PARTIAL |
| New form | Customer | `button` + modal | New form | `#wks-new-form` | `POST .../intake-forms` | same call | intake form row | name required | blank name | "Creating…" | — | modal stays open | new row appears attached | — | modal semantics | — | 10 | — | WORKING |

## Advanced — `workshop-advanced-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#wks-cancel-window` | Advanced | `input[number]` + suffix | Cancellation window | `form.cancellationWindowHours` | FORM | Save | `metadata.cancellationWindowHours` | ≥ 0 | never | — | `24` | — | recorded | stated in the policy | `htmlFor` | 2→1 col | 11 | recorded and displayed; no self-service cancellation exists for a workshop registration, so nothing enforces it | PARTIAL |
| `#wks-cancel-policy` | Advanced | `textarea` | Cancellation policy | `form.cancellationPolicy` | FORM | Save | `metadata.cancellationPolicy` | — | never | — | placeholder | — | recorded | shown with the workshop terms | `htmlFor` | full width | 11 | — | WORKING |
| `#wks-terms` | Advanced | `input[url]` | Terms URL | `form.termsUrl` | FORM | Save | `metadata.termsUrl` | — | never | — | placeholder | — | recorded | linked with the terms | `htmlFor` | full width | 11 | — | WORKING |
| Track admission | Advanced | `role=switch` | Track admission | `form.admissionEnabled` | FORM | Save | `metadata.admissionEnabled` | — | never | — | off | — | reveals the checked-in stat and the Registration check-in column | — | `role=switch` | 2→1 col | 11 | — | WORKING |
| Checked-in stat | Advanced | text | — | registrant attendance | — | — | — | — | — | — | `0 of 0` | — | `3 of 9 registrants checked in` | — | — | — | 11 | — | WORKING |
| Check people in | Advanced | `button` | Check people in | — | section change | — | — | — | never | — | — | — | jumps to the registrant table | — | — | — | 11 | — | WORKING |
| `#wks-confirmation` | Advanced | `textarea` | Confirmation message | `form.confirmationMessage` | FORM | Save | `metadata.confirmationMessage` | — | never | — | placeholder | — | recorded | replaces the standard wording after registering | `htmlFor` | full width | 11, public log | — | WORKING |
| Manage reminders | Advanced | `Link` | Manage reminders | — | navigation | — | — | — | never | — | — | — | leaves the page | — | link semantics | — | 11 | reminders are one workspace schedule, not one per workshop; the panel says so instead of offering a per-workshop control that would not run | WORKING |

## Create Workshop wizard — `create-workshop-wizard.tsx`

Four steps at ~720px with a ~260px live summary beside them, about 1000px centred.

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#wiz-ws-name` | Basics | `input` | Workshop name | local | wizard state | Create | `ClassSeries.name` | required to continue | never | card skeleton | — | inline message on Continue | summary updates live | workshop title | `htmlFor`, autofocus | full width | 13 | — | WORKING |
| `#wiz-ws-category`, `-description` | Basics | `input`, `textarea` | Category, Description | local | wizard state | Create | metadata, `description` | — | never | — | — | — | summary updates | listing copy | `htmlFor` | full width | 13 | — | WORKING |
| `#wiz-ws-date`, `-time`, `-length` | Date & place | `input[date]`, `input[time]`, `select` | Date, Start time, Length | local, defaults to today | wizard state | Create + `occurrences` | `ClassOccurrence` | a valid date is required to continue | never | — | today, 09:00, 3 hours | inline message on Continue | preview reads "Runs Friday, Oct 15 · 1:30 PM – 5:30 PM" | the day customers register for | `htmlFor` | 3→1 col | 14, demo video | — | WORKING |
| Location mode | Date & place | `button` | In person / Online / One-off venue | local | wizard state | Create | `metadata.locationMode` | — | never | — | in person | — | swaps the control beneath | changes what the listing says | `aria-pressed` | 3→1 col, `is-tight` | 14 | — | WORKING |
| Location / Host card | Date & place | `button` | name | settings | wizard state | Create | `locationId` / `staffId` | — | never | — | "No locations yet" | — | summary updates | named on the listing | `aria-pressed` | 2→1 col | 14, demo video | — | WORKING |
| Add location / Add staff | Date & place | `button` + inline field | Add location | inline input | `PATCH /api/appointments/settings` | same call | workspace settings | name required | blank | "Adding…" | — | field stays open | new card appears selected | usable everywhere | `aria-label` | — | 14 | — | WORKING |
| `#wiz-ws-url` / `#wiz-ws-venue` | Date & place | `input` | Joining link / Venue | local | wizard state | Create | `metadata.virtualUrl` / `locationNote` | the URL must parse | wrong mode | — | placeholder | inline message on Continue | summary updates | — | `htmlFor` | full width | 14 | — | WORKING |
| `#wiz-ws-capacity` | Registration | `input[number]` | Spots | local | wizard state | Create | `ClassSeries.capacity` | ≥ 1 | never | — | `20` | inline message on Continue | summary reads "14 total" | enforced server-side | `htmlFor` | 3→1 col | 15, demo video | — | WORKING |
| `#wiz-ws-opens` / `-closes` | Registration | `input[datetime-local]` | Registration opens / closes | local | wizard state | Create | metadata | — | never | — | blank | — | — | enforced server-side | `htmlFor` | 3→1 col | 15 | — | WORKING |
| Waitlist / Show spots / List publicly | Registration | `role=switch` | — | local | wizard state | Create | metadata | — | never | — | off / on / on | — | — | each has a visible effect on the listing | `role=switch` | stack | 15, demo video | — | WORKING |
| Free workshop / `#wiz-ws-price` | Review | `role=switch`, `input[number]` | Free workshop, Price | local | wizard state | Create | `metadata.isFree`, `priceCents` | > 0 when paid | free | — | Free | disables Create | summary shows the price | the amount on the listing | `role=switch`, `htmlFor` | — | 16, demo video | pay-on-arrival, as stated in the panel | PARTIAL |
| Review list | Review | `dl` | — | wizard state | — | — | — | — | — | — | — | — | eight facts, worded the way a customer will read them | — | `dl` semantics | — | 16 | — | WORKING |
| Create workshop | Review | `button` | Create workshop | wizard state | `POST .../workshops` then `POST {action:"occurrences"}` | both | row + one occurrence | every step's rule | saving, or a step error | "Creating…" | — | keeps the wizard open with the message | lands on Overview with "Workshop created" | the workshop is registrable immediately | — | — | demo video | if the row saves but the date does not, the wizard still opens the workshop and the banner says the date has to be set | WORKING |
| Back / Continue | Wizard | `button` | Back, Continue | step | step index | — | — | the step's rule | first step / never | — | — | inline message | moves between steps | — | — | — | 13–16 | — | WORKING |

## Route integrity

`/appointments/workshops` and `/appointments/workshops/[id]` render the same connected
component, so the list is present with or without a selection and selecting a workshop is
a real navigation. `?section=` is the only section state; `overview` is the default and is
removed from the URL rather than written to it. `?created=` is read once by the workspace,
turned into the confirmation banner, and stripped, so a reload does not announce it again.

## Workshop / class separation

Both kinds are `ClassSeries` rows told apart by `metadata.kind`. Filtering on the client
was not enough, so the kind is now enforced in the domain layer and both API routes carry
the kind they serve.

| Guard | Where | Behaviour |
|---|---|---|
| `listClassSeries(workspaceId, kind)` | `service-booking/classes.ts` | Returns rows of that kind only. The kind lives in a JSON column, so the filter runs after the query — the server, not the caller, is still the authority. |
| `getClassSeries(…, kind)` | same | Throws `Workshop not found` / `Class not found` for the wrong kind |
| `deleteClassSeries(…, kind)` | same | Same refusal before it can delete anything |
| `assertSeriesKind(workspaceId, kind, ref)` | same | Resolves a series from a `seriesId`, `occurrenceId`, `enrollmentId` or waitlist `entryId` and refuses unless the parent series matches. Every action on both routes calls it first. |
| `metadataForOfferingKind(KIND, …)` | both routes | The stored kind is set by the route, never taken from the request, so neither route can mint the other kind |
| `loadPublicGroupOfferings(workspaceId, kind)` | `public-group-offering.ts` | The public listing is filtered the same way |
| Public POST kind check | `book/[slug]/workshops` | Checks the kind whether the request names an occurrence **or** only a series. Before this pass a class series id posted to the workshops endpoint enrolled somebody in the class. |

Verified in both directions — 10 checks, all refusals, in `runtime.log`.

## Public registration guards

The workshops endpoint had drifted behind the classes one. Everything below is enforced on
the server and proven in `runtime.log`.

| Guard | Refusal |
|---|---|
| `bookingEnabled` off | `403 Booking disabled` on GET **and** POST |
| Registration window | `400 Registration has closed` / `Registration opens …` |
| Workshop cancelled | `400 This workshop has been cancelled` |
| Workshop inactive or hidden | filtered out of the listing |
| Capacity | `assertOccurrenceCapacity` refuses; with a waitlist on it returns `202` and queues the person |
| Offering kind | `400 Invalid workshop date` / `404 Workshop not found` |
| Delete with registrations | `400 <n> registrations exist for this workshop. Deactivate it instead.` |

## Public terminology

The public workshop page says Workshop, Register, and names the date and the place. It
never says Class, Class session or Join class. The waitlist message, the confirmation, the
empty state and the loading state all have workshop wording, and
`CLASS_SERIES_OFFERING_UI.workshop.occurrenceLabel` is "Workshop date". One shared error
string in `joinClassWaitlist` cannot know the kind, because the row is what could not be
found, so it reads "Registration is no longer available" rather than naming either.

## Honest gap list

Nothing below is hidden from the operator: each one is stated in the panel it belongs to.

1. **Payment** — workshop registration takes no card and no deposit. A priced workshop is
   pay-on-arrival and the amount owed is recorded. Appointments already collect card
   payment; workshops are not connected to it.
2. **Packages and memberships** — recorded against the workshop, but a registration does
   not draw down a package credit and the public page does not check membership before
   registering.
3. **Registration questions and attached forms** — stored on the workshop; the public form
   does not render them and no answers are stored, so the registrant drawer says so rather
   than showing an empty answers list.
4. **Admission tickets** — check-in is marked by hand and persists on the registration.
   `ClassAdmissionTicket` exists in the data model but nothing issues or scans a QR code
   for a workshop, so no QR decoration is drawn.
5. **Waitlist auto-promotion** — the setting is stored; no scheduled job promotes anybody.
   The operator gives the spot from Manage, where the same capacity check applies.
6. **Notifications** — cancelling a workshop, cancelling a date, moving a date or
   cancelling a registration does not message anybody. Every one of those confirmations
   says so instead of implying a notice went out.
7. **Timezone** — the field records the intended zone and is displayed; times are entered
   in the browser's zone and are not converted.
8. **Resources** — recorded for planning; nothing holds a room against a date, so two
   workshops can still be booked into the same space.
9. **Cancellation window** — recorded and displayed with the policy; there is no
   self-service cancellation for a workshop registration, so nothing enforces it.
10. **Image URL** — stored and returned; the current public list template renders text
    only.

## Component status roll-up

| Status | Count |
|---|---|
| `CONNECTED_AND_WORKING` | 71 |
| `READ_ONLY_BY_DESIGN` | 6 |
| `INTENTIONALLY_DISABLED_WITH_REASON` | 1 |
| `EXTERNAL_PROVIDER_BLOCKED` | 0 |
| `BROKEN` | **0** |
| `NO_OP` | **0** |
| `PLACEHOLDER` | **0** |

`PARTIAL` rows in the tables above are controls that persist correctly and have a real
admin effect, but whose public consequence is limited by one of the gaps listed. None of
them is inert: every one writes and every one reads back.

`READ_ONLY_BY_DESIGN`: the summary strip, the registration status panel, the checked-in
stat, the Quick actions counts, the wizard review list, the customer preview.
`INTENTIONALLY_DISABLED_WITH_REASON`: the "First name and phone" switch in Customer setup,
which states the floor the public form always enforces.

## Verification

| # | Check | Result |
|---|---|---|
| 1 | Typecheck | clean; the only two errors in the repo are the pre-existing Booking Types ones from merge `f83e1cf4` |
| 2 | Runtime suite (`runtime.log`) | 30 / 30 |
| 3 | Public suite | 5 / 5 |
| 4 | axe-core, WCAG 2.1 AA, ten pages | 0 new serious or critical violations. The two reported are the global app chrome and are identical on `/appointments/classes` and `/appointments/services`. |
| 5 | Console and network, all 19 screenshot passes | 0 console errors, 0 responses ≥ 400 |
| 6 | Wizard end-to-end | creates the row and its date; capacity 14, price $120, waitlist on, kind `workshop`, one 4-hour session — all read back |
| 7 | Edit persistence | category edited, saved, page reloaded, value survives |

## Screenshots

| # | File | Shows |
|---|---|---|
| 01 | `workshops-01-no-selection.png` | List plus empty state, one list only |
| 02 | `workshops-02-overview.png` | Overview, 7/5, 5/7, 12 |
| 03 | `workshops-03-date-time.png` | Primary session and the compact edit grid |
| 04 | `workshops-04-multi-session.png` | Three-day workshop on the timeline |
| 05 | `workshops-05-place.png` | Location modes, host, resources |
| 06 | `workshops-06-registration.png` | Status / Capacity / Window across the top |
| 07 | `workshops-07-registrants.png` | Six-column registrant table and the waitlist |
| 08 | `workshops-08-pricing-access.png` | Price 5 / Payment 7 |
| 09 | `workshops-09-packages-memberships.png` | Packages 6 / Memberships 6 |
| 10 | `workshops-10-customer-setup.png` | Questions 7 / Customer information 5 |
| 11 | `workshops-11-advanced.png` | Four 6-span panels |
| 12 | `workshops-12-admission-checkin.png` | Registrant drawer over the table |
| 13–16 | `workshops-13…16-wizard-*.png` | The four wizard steps |
| 17–19 | `workshops-17…19-mobile-*.png` | Mobile Overview, Registration, Registrants |
| 20 | `workshops-20-public.png` | The public registration page |
