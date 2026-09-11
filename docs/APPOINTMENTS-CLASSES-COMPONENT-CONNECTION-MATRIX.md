# Appointments Classes — Component Connection Matrix

**Routes:** `/appointments/classes`, `/appointments/classes/[id]`, `/appointments/classes/new`
**Pass:** Classes rebuilt layout / UX / functional specification
**Verification:** Playwright against the running dev server, workspace `harbor-home`, data
`UAT Morning Yoga` (12 sessions, capacity 5, 8 registrations, 3 waitlisted) and
`Sunset Restorative Yoga` (created through the wizard during this pass).

## Space rule

```
[ GLOBAL SIDEBAR ] [ CLASS LIST 230–270px ] [ CLASS WORKSPACE — everything else ]
```

There is no third vertical column anywhere on the page. Section navigation is a
horizontal strip inside the workspace above the section body, and it collapses to a
single `<select>` below `640px`. Record detail that would otherwise want a column —
registrant detail, waitlist management — opens in an overlay drawer.

Inside the workspace the section body is a twelve-track grid (`.ws-grid12`). Spans are
live above `1100px`, collapse to halves between `700px` and `1099px`, and stack below
that.

| Section | Row 1 | Row 2 | Row 3 |
|---------|-------|-------|-------|
| Overview | Class details 7 / Next session 5 | Registration snapshot 5 / Customer preview 7 | Setup summary 12 |
| Schedule | Pattern 8 / Quick actions 4 | Sessions 12 | — |
| People & place | Instructor 6 / Location 6 | Rooms & equipment 12 | — |
| Capacity & registration | Capacity 4 / Registration status 4 / Waitlist 4 | Registrants 12 | — |
| Pricing & access | Drop-in price 5 / Payment requirement 7 | Packages 6 / Memberships 6 | Access rules 12 |
| Customer setup | Quick booking questions 7 / Customer identity 5 | Attached forms 12 | — |
| Advanced | Policies 6 / Admission & attendance 6 | Confirmation 6 / Reminders 6 | — |

## Region map

| Region | Component | Responsibility |
|--------|-----------|----------------|
| Object list | `classes-list-panel.tsx` | Search, count, select, create |
| Object header | `class-object-header.tsx` | Identity, status chips, save state, actions |
| Summary strip | `class-summary-strip.tsx` | Six operational facts, read-only |
| Section nav | `class-local-nav.tsx` | Horizontal strip; `<select>` below `640px` |
| Section workspace | `class-section-workspace.tsx` | Routes to the seven section components |
| Data layer | `use-class-editor.ts` | The only place a class is read, saved or mutated |

`class-local-nav.tsx` renders both responsive presentations itself, so a caller cannot
mount the strip and the dropdown at the same time. Which one shows is decided in
`workspace-pilot.css`, because `.ws-section-tabs` sets `display` and would beat a utility
class.

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
button persists with `POST /api/appointments/service-booking/classes` (an upsert keyed on
`id`). Controls that act immediately name their own action instead.

---

## Object list — `classes-list-panel.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Search | List | `input[type=search]` | Search classes | local state | filter | — | — | — | never | list skeleton | "No classes match" | — | filters rows | — | labelled input | full width | 01 | — | WORKING |
| Class row | List | `button` in `role=listbox` | class name | `GET .../classes` filtered to `kind=class` | `router.push` | — | — | — | never | skeleton rows | see empty state | list shows Retry | opens the class | — | `role=option`, `aria-selected` | stacks above workspace | 01, 19 | — | WORKING |
| Count badge | List | text | — | filtered rows length | — | — | — | — | — | — | `0` | — | shows scope | — | — | — | 01 | — | WORKING |
| `+ New` | List | `Link` | New | — | `/appointments/classes/new` | — | — | — | never | — | — | — | opens wizard | — | link semantics | — | 01, 14 | — | WORKING |
| Secondary line | List | text | — | next occurrence, capacity, price | — | — | — | — | — | — | "No sessions yet" | — | `Sep 15 · 5 seats · $24` | — | — | — | 01 | — | WORKING |
| Inactive chip | List | text | — | `active` | — | — | — | — | — | — | hidden | — | marks hidden classes | — | — | — | 01 | — | WORKING |

## Object header — `class-object-header.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Save changes | Header | `button` | Save changes | dirty snapshot | upsert | `POST .../classes` | all columns + metadata | `validateClassForm` | clean or saving | "Saving…" | — | "Retry save" + message | persists every section | settings take effect | — | stays in header | 02, 18 | — | WORKING |
| Saved indicator | Header | `role=status` | Saved | save status | — | — | — | — | — | — | — | — | not a button when clean | — | `role=status` | — | 02 | — | WORKING |
| View registration page | Header | `Link` | View registration page | `workspace.slug` | opens `/book/:slug/classes` | — | — | — | no slug | — | — | — | opens public page | — | link semantics | label shortens to "View" | 20, public log | — | WORKING |
| Copy link | Header | `button` | Copy registration link | booking URL | clipboard | — | — | — | no slug | — | — | falls back to prompt | "Copied" for 2s | — | `aria-label` | — | 02 | — | WORKING |
| Overflow menu | Header | `button` | More actions | — | menu open | — | — | — | never | — | — | — | reveals three actions | — | `aria-haspopup`, `aria-expanded` | — | 18 | — | WORKING |
| Duplicate class | Menu | `button` | Duplicate class | form | create | `POST .../classes` | new row | name required | saving | disabled | — | inline error | opens the copy | copy is a separate class | — | — | 18 | sessions are not copied | PARTIAL |
| Activate / Deactivate | Menu | `button` | Deactivate | `active` | `active` | `POST .../classes` | `ClassSeries.active` | — | saving | disabled | — | inline error | chip flips | drops off the public list | — | — | 18 | — | WORKING |
| Delete class | Menu | `button` | Delete class | — | confirm modal | `POST {action:"delete"}` | row removed | server refuses if anyone is registered | saving | "Deleting…" | — | keeps modal open with reason | returns to the list | class disappears | modal semantics | — | 18 | — | WORKING |
| Active / Listed chips | Header | text | — | `active`, `visibility` | — | — | — | — | — | — | — | — | state at a glance | — | — | wrap | 02 | — | WORKING |

## Summary strip — `class-summary-strip.tsx`

Read-only. Next session, Seats (`enrolled/capacity` for the next session), Waitlist,
Instructor, Location, Price. Unset values render muted rather than blank, so an
unconfigured class reads as unconfigured instead of broken. The strip reflows from six
cells to three to two; nothing truncates without a `title`.

## Section navigation — `class-local-nav.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Section tab | Nav | `button` | section label | `?section=` | `router.replace` | — | URL | — | never | — | — | — | swaps the section body | — | `aria-current` | hidden below `640px` | 02–13 | — | WORKING |
| Attention dot | Nav | text | "needs attention" | blocking-setup set | — | — | — | — | — | — | absent | — | flags an unfinished section | — | title text | — | 02 | — | WORKING |
| Section select | Nav | `select` | Section | `?section=` | `router.replace` | — | URL | — | never | — | — | — | same as tabs | — | labelled select | only below `640px` | 20, 21 | — | WORKING |

## Overview — `class-overview-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#cls-name` | Overview | `input` | Name | `form.name` | FORM | Save | `ClassSeries.name` | required | never | — | placeholder | blocks save | header title follows | class title | `htmlFor` | full width | 02 | — | WORKING |
| `#cls-category` | Overview | `input` | Category | `form.category` | FORM | Save | `metadata.category` | — | never | — | blank | — | list subtitle | groups on the public page | `htmlFor` | 3→1 col | 02 | — | WORKING |
| `#cls-visibility` | Overview | `select` | Visibility | `form.visibility` | FORM | Save | `metadata.visibility` | — | never | — | `public` | — | chip flips | hidden classes are filtered out of `/book/:slug/classes` | `htmlFor` | 3→1 col | 02, public log §3 | — | WORKING |
| `#cls-status` | Overview | `select` | Status | `form.active` | FORM | Save | `ClassSeries.active` | — | never | — | `active` | — | chip flips | inactive takes no registrations | `htmlFor` | 3→1 col | 02 | — | WORKING |
| `#cls-description` | Overview | `textarea` | Description | `form.description` | FORM | Save | `ClassSeries.description` | 500 chars, counter | never | — | placeholder | — | preview updates live | shown under the class | counter is `aria-live` | full width | 02 | — | WORKING |
| `#cls-image` | Overview | `input[url]` | Image URL | `form.imageUrl` | FORM | Save | `metadata.imageUrl` | — | never | — | placeholder | — | — | stored and exposed; the current public list template renders text only | `htmlFor` | full width | 02 | no image slot on the public list yet | PARTIAL |
| Next session → Schedule | Overview | `button` | Schedule | occurrences | section change | — | — | — | never | — | "No sessions yet" | — | jumps to Schedule | — | — | — | 02 | — | WORKING |
| Registration snapshot → Manage | Overview | `button` | Manage | registrants, waitlist | section change | — | — | — | never | counts blank | zeroes | — | jumps to Capacity | — | — | — | 02 | — | WORKING |
| Customer preview → Open | Overview | `Link` | Open | booking URL | opens public page | — | — | — | no slug | — | — | — | — | the page the customer sees | link semantics | — | 02 | — | WORKING |
| Setup jump chip | Overview | `button` | step name | setup steps | section change | — | — | — | step complete | — | — | — | jumps to the blocking section, tooltip names the blocker | — | `title` | wraps | 02 | — | WORKING |
| Setup row Edit | Overview | `button` | Edit | setup steps | section change | — | — | — | never | — | — | — | jumps to that section | — | — | rows stay thin | 02 | — | WORKING |

## Schedule — `class-schedule-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| One-time card | Schedule | `button` | One-time | `recurrence.pattern` | FORM | Save | `recurrenceRule.pattern` | — | never | — | — | — | hides the cadence controls | one session | `aria-pressed` | 2→1 col | 03 | — | WORKING |
| Repeating card | Schedule | `button` | Repeating | `recurrence.pattern` | FORM | Save | `recurrenceRule.pattern` | — | never | — | — | — | reveals repeat and ends | a series | `aria-pressed` | 2→1 col | 03 | — | WORKING |
| `#cls-start-date` | Schedule | `input[date]` | Start date | `recurrence.startDate` | FORM (`withStartDate`) | Save | `recurrenceRule.startDate` | required to generate | never | — | inferred from existing sessions | — | preview recounts; a lone weekday selection follows the new date | first session | `htmlFor` | 2→1 col | 03 | — | WORKING |
| `#cls-start-time` | Schedule | `input[time]` | Start time | `recurrence.startTime` | FORM | Save | `recurrenceRule.startTime` | — | never | — | `09:00` | — | preview recounts | session start | `htmlFor` | 2→1 col | 03 | — | WORKING |
| `#cls-duration` | Schedule | `input[number]` | Duration | `recurrence.durationMinutes` | FORM | Save | `recurrenceRule.durationMinutes` | min 5 | never | — | `60` | — | preview recounts | session length | `htmlFor` | 2→1 col | 03 | — | WORKING |
| `#cls-timezone` | Schedule | `select` | Timezone | `form.timezone` | FORM | Save | `metadata.timezone` | — | never | — | browser zone, or the legacy `recurrenceRule.timezone` | — | hint names the entry zone | — | `htmlFor` | 2→1 col | 03 | times are entered in the browser zone; the field records intent and does not convert | PARTIAL |
| `#cls-repeat` | Schedule | `select` | Repeat | `recurrence.repeat` | FORM | Save | `recurrenceRule.repeat` | — | one-time | — | `weekly` | — | preview recounts | cadence | `htmlFor` | 2→1 col | 03 | — | WORKING |
| Weekday chip | Schedule | `button` | Sun…Sat | `recurrence.weekdays` | FORM | Save | `recurrenceRule.weekdays` | falls back to the start day | not weekly/biweekly | — | start day | — | preview recounts | days the class runs | `role=group`, `aria-pressed` | wraps | 03 | — | WORKING |
| `#cls-ends` | Schedule | `select` | Ends | `recurrence.endsMode` | FORM | Save | `recurrenceRule.endsMode` | — | one-time | — | `after` | — | swaps count vs date | series length | `htmlFor` | 2→1 col | 03 | — | WORKING |
| Session count | Schedule | `input[number]` | Number of sessions | `recurrence.endsAfter` | FORM | Save | `recurrenceRule.endsAfter` | ≥ 1 | mode ≠ after | — | `8` | blocks save | preview recounts | — | `aria-label` | — | 03 | capped at 60 per generation | WORKING |
| Last date | Schedule | `input[date]` | Last date | `recurrence.endsOn` | FORM | Save | `recurrenceRule.endsOn` | — | mode ≠ on | — | blank | — | preview recounts | — | `aria-label` | — | 03 | — | WORKING |
| Create N sessions | Schedule | `button` | Create sessions | expanded rule vs existing | `POST {action:"occurrences"}` | same call | `ClassOccurrence` rows | needs a saved class and a start date | unsaved, or nothing new | "Creating…" | count reads 0 | inline error | rows appear in the list | sessions become bookable | — | — | 03, wizard log | — | WORKING |
| Session Edit | Schedule | `button` | Edit | occurrence | opens modal | `POST {action:"update_occurrence"}` | `ClassOccurrence` | — | cancelled | "Saving…" | — | inline error | row shows "Time changed" / "Capacity changed" | that session only | modal semantics | modal is full width on mobile | 04 | — | WORKING |
| Session Cancel | Schedule | `button` | Cancel | occurrence | `POST {action:"cancel_occurrence"}` | same call | `status=cancelled` | — | already cancelled | row dims | — | inline error | row shows "Cancelled" | session leaves the public list | — | — | 03 | registrants are not notified automatically | PARTIAL |
| `#occ-start` | Modal | `input[datetime-local]` | Starts | occurrence | modal state | `update_occurrence` | `startsAt`/`endsAt` | — | — | — | — | — | moves one session | new time | `htmlFor` | — | 04 | — | WORKING |
| `#occ-duration` | Modal | `input[number]` | Duration | occurrence | modal state | `update_occurrence` | `endsAt` | min 5 | — | — | — | — | — | new length | `htmlFor` | — | 04 | — | WORKING |
| `#occ-capacity` | Modal | `input[number]` | Capacity | occurrence | modal state | `update_occurrence` | `ClassOccurrence.capacity` | ≥ 1 | — | — | class default | — | one session differs from the class | seats for that session | `htmlFor` | — | 04 | — | WORKING |

## People & place — `class-people-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Instructor card | People | `role=radio` | staff name | `form.staffId` | FORM | Save | `ClassSeries.staffId` | — | never | grid skeleton | only "Unassigned" | — | strip and sessions show the name | named on the class | `role=radiogroup`, `aria-checked` | auto-fill grid | 05 | — | WORKING |
| Unassigned card | People | `role=radio` | Unassigned | `form.staffId` | FORM | Save | `staffId=null` | — | never | — | — | — | flags Overview setup | no instructor shown | `aria-checked` | — | 05 | — | WORKING |
| Add staff | People | `button` + modal | Add staff | `#cls-new-staff` | `PATCH /api/appointments/settings` | same call | workspace staff | name required | blank name | "Adding…" | — | modal stays open | new card appears selected, the class draft is untouched | bookable host everywhere | modal semantics | — | 06 | — | WORKING |
| Location card | People | `role=radio` | location name | `form.locationId` | FORM | Save | `ClassSeries.locationId` | — | never | grid skeleton | only "Unassigned" | — | strip shows the place | where to turn up | `role=radiogroup` | auto-fill grid | 05 | — | WORKING |
| Add location | People | `button` + modal | Add location | `#cls-new-location` | `PATCH /api/appointments/settings` | same call | workspace locations | name required | blank name | "Adding…" | — | modal stays open | new card appears selected | usable by every object | modal semantics | — | 05 | — | WORKING |
| Resource chip | People | `button` | resource name | `form.resourceIds` | FORM | Save | `metadata.resourceIds` | — | never | — | "No resources yet" | — | recorded on the class | — | `aria-pressed` | wraps | 05 | recorded for planning; a class does not hold a room against a session, so double booking is not blocked | PARTIAL |
| Add resource | People | `button` + modal | Add resource | `#cls-new-resource`, `-qty` | `POST .../resources` | same call | resource row | name required | blank name | "Adding…" | — | modal stays open | chip appears selected | — | modal semantics | — | 05 | — | WORKING |

## Capacity & registration — `class-capacity-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#cls-capacity` | Capacity | `input[number]` | Seats per session | `form.capacity` | FORM | Save | `ClassSeries.capacity` | ≥ 1 | never | — | `12` | blocks save | meter and stat update | **enforced server-side** by `assertOccurrenceCapacity` | `htmlFor` | 3→2→1 col | 07, enforcement log | — | WORKING |
| Show remaining spots | Capacity | `role=switch` | Show remaining spots | `form.showRemainingSpots` | FORM | Save | `metadata.showRemainingSpots` | — | never | — | on | — | — | "5 spots left" appears or is suppressed | `role=switch` | — | 07, public log §1 | — | WORKING |
| `#cls-reg-opens` | Capacity | `input[datetime-local]` | Registration opens | `form.registrationOpensAt` | FORM | Save | `metadata.registrationOpensAt` | must precede close | never | — | blank = open now | blocks save | state chip reads "Opens …" | register returns 400 before the window | `htmlFor` | — | 07, public log §4 | — | WORKING |
| `#cls-reg-closes` | Capacity | `input[datetime-local]` | Registration closes | `form.registrationClosesAt` | FORM | Save | `metadata.registrationClosesAt` | must follow open | never | — | blank = until start | blocks save | state chip reads "Closed" | register returns 400 after the window | `htmlFor` | — | 07, public log §4 | — | WORKING |
| Register for the whole series | Capacity | `role=switch` | Register for the whole series | `form.requireFullSeries` | FORM | Save | `ClassSeries.requireFullSeries` | — | never | — | off | — | registrant rows read "Whole series" | customer takes every session | `role=switch` | — | 07 | — | WORKING |
| Enable waitlist | Capacity | `role=switch` | Enable waitlist | `form.waitlistEnabled` | FORM | Save | `metadata.waitlistEnabled` | — | never | — | off | — | reveals the two waitlist settings | a full session offers "Join waitlist" and returns 202 | `role=switch` | — | 07, public log §2 | — | WORKING |
| Offer a seat automatically | Capacity | `role=switch` | Offer a seat automatically | `form.waitlistAutoPromote` | FORM | Save | `metadata.waitlistAutoPromote` | — | waitlist off | — | off | — | recorded | — | `role=switch` | — | 07 | recorded; nothing runs on a schedule to promote yet — the operator gives the seat from the drawer | PARTIAL |
| `#cls-waitlist-hours` | Capacity | `input[number]` | Offer expires | `form.waitlistOfferExpiresHours` | FORM | Save | `metadata.waitlistOfferExpiresHours` | ≥ 1 | waitlist off | — | `24` | — | recorded | — | `htmlFor` | — | 07 | same as above | PARTIAL |
| Manage (waitlist) | Capacity | `button` | Manage | waitlist | opens drawer | — | — | — | waitlist empty | — | disabled | — | wide drawer, not a third column | — | `role=dialog`, Escape closes | drawer is full width on mobile | 09 | — | WORKING |
| Session filter | Registrants | `select` | Filter by session | occurrences | local state | — | — | — | no sessions | — | hidden | — | narrows the table | — | `aria-label` | — | 07 | — | WORKING |
| Registrant name | Registrants | `button` | customer name | registrant | opens drawer | — | — | — | never | table skeleton | "No registrations yet" | — | detail drawer | — | `role=dialog` | drawer overlays | 08 | — | WORKING |
| Attendance | Registrants | `select` | Attendance for … | `registrant.attendance` | `POST {action:"update_enrollment"}` | same call | `ClassEnrollment.attendance` | — | never | select disabled | "Not recorded" | reverts with a message | Advanced counts marked registrations | — | `aria-label` per row | table scrolls | 07 | recorded by hand; `ClassAdmissionTicket` exists but nothing issues or scans one | PARTIAL |
| Cancel / Reinstate | Registrants | `button` | Cancel | `registrant.status` | `POST {action:"update_enrollment"}` | same call | `ClassEnrollment.status` | — | never | row busy | — | reverts with a message | frees a seat | seat becomes available | — | — | 07 | the customer is not notified automatically | PARTIAL |
| Mark attended | Drawer | `button` | Mark attended | registrant | `update_enrollment` | same call | `attendance` | — | already marked | — | — | inline error | closes and updates the row | — | dialog footer | — | 08 | — | WORKING |
| `#cls-promote-target` | Drawer | `select` | Offer a seat on | upcoming sessions | local state | — | — | — | one session | — | hidden | — | chooses the session a seat is given on | — | `htmlFor` | — | 09 | — | WORKING |
| Give seat | Drawer | `button` | Give seat | waitlist entry | `POST {action:"promote_waitlist"}` | same call | enrollment + entry status | server capacity check | no session, or no linked contact | "Offering…" | — | fails rather than oversells | entry leaves the waitlist | customer is registered | `title` explains a disabled button | — | 09 | — | WORKING |
| Remove | Drawer | `button` | Remove | waitlist entry | `POST {action:"remove_waitlist"}` | same call | entry removed | — | never | — | — | inline error | positions renumber | — | — | — | 09 | — | WORKING |

## Pricing & access — `class-pricing-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Free class | Pricing | `role=switch` | Free class | `form.isFree` | FORM | Save | `metadata.isFree` | — | never | — | on | — | reveals or hides Price | "Free" or the amount | `role=switch` | — | 10 | — | WORKING |
| `#cls-price` | Pricing | `input[number]` | Price | `form.priceCents` | FORM | Save | `metadata.priceCents` | > 0 when not free | free | — | `0.00` | blocks save | strip shows `$24` | `$24.00` on the registration row | `htmlFor` | — | 10, public log §1 | no online card capture at class registration — a priced class is pay-on-arrival | PARTIAL |
| Package Grant access / Remove | Pricing | `button` | Grant access | `form.packageProductIds` | FORM | Save | `metadata.packageProductIds` | — | never | rows skeleton | "No packages exist yet" | — | row flips | — | `aria-pressed` | list scrolls past ~7 rows | 10 | recorded; a package is not redeemed at class checkout yet | PARTIAL |
| Membership Grant access / Remove | Pricing | `button` | Grant access | `form.membershipProductIds` | FORM | Save | `metadata.membershipProductIds` | — | never | rows skeleton | "No memberships exist yet" | — | row flips | — | `aria-pressed` | list scrolls | 10 | same as packages | PARTIAL |
| Members only | Pricing | `role=switch` | Members only | `form.memberOnly` | FORM | Save | `metadata.memberOnly` | — | never | — | off | — | recorded | — | `role=switch` | 2 across | 10 | recorded; the public page does not yet check membership before registering | PARTIAL |
| Whole series only | Pricing | `role=switch` | Whole series only | `form.requireFullSeries` | FORM | Save | `ClassSeries.requireFullSeries` | — | never | — | off | — | mirrors the Capacity switch | customer takes every session | `role=switch` | 2 across | 10 | — | WORKING |
| Manage packages / memberships / Payment settings | Pricing | `Link` | — | — | navigation | — | — | — | never | — | — | — | leaves the page | — | link semantics | — | 10 | — | WORKING |

## Customer setup — `class-customer-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Add question | Customer | `button` + modal | Add question | `#cls-q-label`, `-type`, `-options`, Required | FORM | Save | `metadata.bookingQuestions` | label required | blank label | — | "No questions yet" | modal stays open | row appears | — | modal semantics | — | 11, 12 | saved on the class; the public class form does not render them yet and no answers are stored | PARTIAL |
| Question Remove | Customer | `button` | Remove | `metadata.bookingQuestions` | FORM | Save | same | — | never | — | — | — | row disappears | — | — | rows stay thin | 11 | — | WORKING |
| First name and phone | Customer | `role=switch` | First name and phone | — | — | — | — | — | always disabled | — | — | — | states the floor, honestly non-interactive | always required | `disabled` + explanation | — | 11 | — | WORKING |
| Require last name | Customer | `role=switch` | Require last name | `form.requireLastName` | FORM | Save | `metadata.requireLastName` | — | never | — | off | — | recorded | — | `role=switch` | — | 11 | recorded; the public form always shows the field and does not enforce it | PARTIAL |
| Require email | Customer | `role=switch` | Require email | `form.requireEmail` | FORM | Save | `metadata.requireEmail` | — | never | — | off | — | recorded | — | `role=switch` | — | 11 | same as above | PARTIAL |
| Form Attach / Detach | Customer | `button` | Attach | `form.intakeFormIds` | FORM | Save | `metadata.intakeFormIds` (+ legacy `intakeFormId`) | — | never | rows skeleton | "No forms yet" | — | row flips | — | `aria-pressed` | list scrolls | 11 | attached and stored; the public class registration flow does not present the form | PARTIAL |
| New form | Customer | `button` + modal | New form | `#cls-new-form` | `POST .../intake-forms` | same call | intake form row | name required | blank name | "Creating…" | — | modal stays open | new row appears attached | — | modal semantics | — | 11 | — | WORKING |

## Advanced — `class-advanced-section.tsx`

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#cls-cancel-window` | Advanced | `input[number]` | Cancellation window | `form.cancellationWindowHours` | FORM | Save | `metadata.cancellationWindowHours` | ≥ 0 | never | — | `24` | — | recorded | shown with the terms | `htmlFor` | 2→1 col | 13 | recorded; a late cancellation is not refused automatically | PARTIAL |
| `#cls-cancel-policy` | Advanced | `textarea` | Cancellation policy | `form.cancellationPolicy` | FORM | Save | `metadata.cancellationPolicy` | — | never | — | placeholder | — | recorded | shown with the terms | `htmlFor` | full width | 13 | — | WORKING |
| `#cls-terms` | Advanced | `input[url]` | Terms URL | `form.termsUrl` | FORM | Save | `metadata.termsUrl` | — | never | — | placeholder | — | recorded | linked from the class | `htmlFor` | full width | 13 | — | WORKING |
| Track attendance | Advanced | `role=switch` | Track attendance | `form.admissionEnabled` | FORM | Save | `metadata.admissionEnabled` | — | never | — | off | — | shows "0 of 8 registrations marked" | — | `role=switch` | 2→1 col | 13 | attendance is marked by hand in Capacity; there is no door-scanning flow to turn on | PARTIAL |
| `#cls-confirmation` | Advanced | `textarea` | Confirmation message | `form.confirmationMessage` | FORM | Save | `metadata.confirmationMessage` | — | never | — | falls back to the workspace default | — | recorded | replaces the standard confirmation after registering | `htmlFor` | 2→1 col | 13 | — | WORKING |
| Manage reminders | Advanced | `Link` | Manage reminders | — | `/appointments/reminders` | — | — | — | never | — | — | — | leaves the page | — | link semantics | — | 13 | reminders are per workspace, not per class — stated in the panel | WORKING |

## Create Class wizard — `create-class-wizard.tsx`

Four steps: **Basics**, **Schedule**, **People & capacity**, **Price & review**. The step
surface is about 700px, the "Class so far" rail about 260px, and the centred region lands
near 1000px.

| Control | Section | Kind | Accessible name | Reads | Writes | Persist call | Stored at | Validation | Disabled when | Loading | Empty | Error | Admin effect | Public effect | A11y | Responsive | Evidence | Gap | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `#wiz-cls-name` | Basics | `input` | Class name | draft | draft | on create | `ClassSeries.name` | required to continue | never | — | placeholder | step error | rail title updates | — | `htmlFor` | full width | 14 | — | WORKING |
| `#wiz-cls-category` | Basics | `input` | Category | draft | draft | on create | `metadata.category` | — | never | — | blank | — | rail updates | groups on the public page | `htmlFor` | — | 14 | — | WORKING |
| `#wiz-cls-description` | Basics | `textarea` | Description | draft | draft | on create | `description` | — | never | — | placeholder | — | — | shown under the class | `htmlFor` | — | 14 | — | WORKING |
| Pattern cards | Schedule | `button` | One-time / Repeating | draft | draft | on create | `recurrenceRule.pattern` | — | never | — | repeating | — | reveals cadence | — | `aria-pressed` | 2→1 col | 15 | — | WORKING |
| `#wiz-cls-date` | Schedule | `input[date]` | Start date | draft | draft (`withStartDate`) | on create | `recurrenceRule.startDate` | required to continue | never | — | today | step error | preview recounts; a lone weekday follows the date | first session | `htmlFor` | 3→1 col | 15 | — | WORKING |
| `#wiz-cls-time` / `-duration` / `-repeat` / `-count` / days | Schedule | inputs | as labelled | draft | draft | on create | `recurrenceRule.*` | count ≥ 1 | — | — | sensible defaults | step error | live "N sessions" preview | the sessions created | `htmlFor`, `aria-pressed` | 3→1 col | 15 | — | WORKING |
| Instructor / Location cards | People | `role=radio` | staff / location | settings | draft | on create | `staffId` / `locationId` | — | never | grid skeleton | inline add field | — | rail updates | named on the class | `role=radiogroup` | auto-fill | 16 | — | WORKING |
| Add host / Add location inline | People | `input` + `button` | New staff name / New location name | field | `PATCH .../settings` | same call | workspace staff/locations | name required | blank | "Adding…" | this is the empty state | inline error | new card appears selected | bookable everywhere | `aria-label` | — | 16 | — | WORKING |
| `#wiz-cls-capacity` | People | `input[number]` | Seats per session | draft | draft | on create | `ClassSeries.capacity` | ≥ 1 | never | — | `12` | step error | rail updates | enforced at registration | `htmlFor` | — | 16 | — | WORKING |
| Take a waitlist when full | People | `role=switch` | Take a waitlist when full | draft | draft | on create | `metadata.waitlistEnabled` | — | never | — | off | — | — | full sessions offer the waitlist | `role=switch` | — | 16 | — | WORKING |
| Free class / `#wiz-cls-price` | Review | `role=switch` / `input` | Free class / Price | draft | draft | on create | `metadata.isFree`, `priceCents` | > 0 when not free | free | — | free | step error | rail updates | price on the registration row | `role=switch`, `htmlFor` | — | 17 | pay-on-arrival, as above | PARTIAL |
| Back / Continue | All | `button` | Back / Continue | step | step | — | — | per-step validation | step 1 back leaves | — | — | `.ws-inline-error` | moves between steps | — | — | — | 14–17 | — | WORKING |
| Create class | Review | `button` | Create class | draft | `POST .../classes` then `{action:"occurrences"}` | both | row + `ClassOccurrence` rows | full form validation | creating | "Creating…" | — | routes to the class with the reason, keeping the input | opens the new class | class and its sessions are bookable at once | — | — | 17, wizard log | — | WORKING |
| Class so far rail | All | region | Class so far | draft | — | — | — | — | — | — | "Untitled class" | — | six live facts | — | `aria-label` | hidden below `1024px` | 14–17 | — | WORKING |

## Route integrity

`ClassSeries` backs both Classes and Workshops, and the two are told apart only by
`metadata.kind`. Two guards keep them separate:

- The list filters on `resolveClassSeriesOfferingKind(row.metadata) === "class"`.
- `useClassEditor` throws if a fetched row is not a class, so
  `/appointments/classes/<workshop-id>` renders **Class not found** rather than editing a
  workshop through the wrong page.

Both were exercised with a real workshop-kind row; see
`/opt/cursor/artifacts/class-route-integrity.log`.

## Honest gap list

These are recorded in the UI as `.ws-gap-note` text next to the control, never as a
disabled toggle pretending to be a feature.

| Gap | Where it is stated |
|-----|--------------------|
| No online card capture at class registration; a priced class is pay-on-arrival | Pricing → Payment requirement |
| Packages and memberships grant access but are not redeemed at class checkout | Pricing → Packages |
| `memberOnly` is recorded but the public page does not check membership | Pricing → Access rules |
| Booking questions and attached forms are saved but not presented during public registration, and answers are not stored against a registration | Customer setup → Quick booking questions; registrant drawer |
| Attendance is marked by hand; `ClassAdmissionTicket` exists in the schema but nothing issues or scans one | Advanced → Admission & attendance |
| Resources are recorded for planning and do not block double booking a room | People & place → Rooms & equipment |
| Automatic waitlist promotion is recorded but no scheduled job runs it | Capacity → Waitlist |
| Reminders are per workspace, not per class | Advanced → Reminders |
