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
