# Transovo MCTB Page Build Spec — 02: Missed Calls

**Status:** Active — mandatory implementation specification  
**Route:** `/mctb/missed-calls`  
**Product:** Missed Call Text Back  
**Page archetype:** Operational list / management  
**Canonical navigation:** MCTB → Missed Calls  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment product screenshots + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Interaction, Forms, Responsive, Tables, Privacy/Consent, Security, Date/Time, and i18n standards plus the MCTB product/domain, IA, manifest, Overview build spec, and canonical map

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-02-missed-calls.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule for this page

The Missed Calls page is the canonical operational list of missed-call recovery events. Its job is to let the user quickly find a caller, understand the recovery outcome, identify exceptions, and open the authoritative missed-call record. It must **not** become a second dashboard, a conversations inbox, a consent audit page, or a setup editor. Use a **semantic HTML table** on desktop unless the data is transformed into structured records on narrow screens. **Do not use ARIA grid.** Filters, sorting, pagination, row actions, status labels, and return context must preserve the user's working state. Recovery status must come from authoritative domain/runtime state, not frontend inference.

---

## 2. Primary users and context

### Primary users

- Receptionist, Office manager, Business owner, Scheduler, Staff checking callbacks/follow-up

### Primary context

- Frequent operational use; search for known caller; investigate why text was/was not sent; check replies; work through several missed calls in sequence; desktop common, mobile fully usable

### Primary user question

**"Who did we miss, what did Transovo do, and what needs follow-up?"**

---

## 3. Primary job

Exactly one primary job: **Provide a trustworthy, filterable record of missed-call events and recovery outcomes.**

| Question | Answer |
|----------|--------|
| Where am I? | MCTB → Missed Calls |
| What is this for? | Review missed callers and recovery results |
| What can I do? | Search, filter, sort, open missed call, call back, open conversation |
| Attention needed? | Failed, suppressed, waiting-for-consent, replied/needs-reply must be clear |
| Where next? | Missed Call Detail or Conversation |

---

## 4. Screenshot calibration requirement

Capture finished Appointment screenshots: operational table/list, filter/search toolbar, table density, row hover/focus, pagination, status badges, overflow actions, mobile list/card pattern, empty/loading/error states. Visual baseline only — do not copy Appointment columns or object models.

---

## 5. Global page anatomy

```
Global Transovo shell
    ↓
Page header
    ↓
MCTB local navigation (Missed Calls selected)
    ↓
Optional compact summary metrics
    ↓
Control bar: Search + filters + date + more filters
    ↓
Missed Calls table/list
    ↓
Pagination / record range
```

Do not put unrelated setup sections below the list.

---

## 6. Page header

- **H1:** Missed Calls
- **Supporting text (optional):** *Review missed calls and see what happened after each one.*
- **Primary action:** Normally none. Possible contextual secondary **Finish setup** if setup incomplete — not a permanent bright Configure button once operating.

---

## 7–8. Optional summary strip & consistency

May include: Missed today, Texts sent today, Replies today — compact, not oversized dashboard cards.

**Must match Overview** for the same date scope. No conflicting metric definitions.

---

## 9–13. Control bar & filters

**Order:** Search caller → Status → Date → More filters → [Business line if multi-line useful]

### Search

- Label: Search missed calls | Placeholder: Phone or contact name
- Scope: normalized phone, contact/caller name if resolved — not full conversation text unless actually supported
- Debounced if remote; query preserved on detail return; filtered-empty ≠ true empty

### Primary filters — Status

All | Needs attention | Recovered | Replied | Waiting for consent | Suppressed | Failed — only statuses that exist in canonical domain.

### Date

Today | Last 7 days | Last 30 days | Custom — or existing Transovo date filter.

### More filters (advanced)

Trigger (No answer, Busy, Unreachable, Voicemail, After hours), Consent method, Delivery state, Repeat caller, Reply state. No backend concepts users don't understand.

### Filter state

Active filters visible; **Clear filters** when active; do not reset on sort/paginate.

---

## 14. Desktop table classification

**Semantic HTML table, not ARIA grid.** Read-oriented semantic table with interactive controls. Users compare callers across rows; sorting/filtering does not need spreadsheet keyboard interaction.

---

## 15. Recommended canonical columns

| Caller | Missed | Trigger | Recovery | Reply | Business line | Actions |

Collapse/hide Business line for single-line workspaces.

---

## 16–18. Column specs

### Caller (strongest row identity)

Contact name + phone; repeat-caller indicator: *Called 3× today*. Phone alone if no contact — not "Unknown caller."

Row header: `<th scope="row">` where semantically correct per Transovo table component.

### Missed

Canonical temporal formatting: `10:42 AM` (today) or `Sep 7 · 4:18 PM`. No raw ISO.

### Trigger

No answer | Busy | Unreachable | Voicemail | After hours | Unknown — not provider codes (`no_answer`, `cfna`, etc.).

---

## 19–23. Recovery column

**Most important column.** Canonical states: Waiting for consent | Scheduled | Sent | Delivered | Suppressed | Failed | No text sent — runtime-supported only.

| Tier | Examples |
|------|----------|
| Healthy (quiet) | Delivered, Sent, Scheduled |
| Attention | Waiting for consent, Failed, Suppressed (by reason), Sender unavailable |
| Neutral terminal | No text sent (no consent), Suppressed (opted out) |

**Suppressed ≠ Failed.** Concise secondary text: *Suppressed — Customer opted out*. Full diagnostics in Detail.

---

## 24–25. Reply column

Needs reply | Replied | No reply | — | Opted out

**Do not conflate** customer replied with business replied. Use canonical Conversations domain rules for `needs_reply`, `replied`, `no_reply` — not message count > 1.

---

## 26. Business line column

Public business line caller originally called. Label: **Business line** — not Number, Your number, Transovo number. Hidden forwarding destination not in list.

---

## 27–31. Actions & row navigation

Minimal: Open (via caller link), Call back, Open conversation, More (overflow).

- Caller identity → primary link to `/mctb/missed-calls/:id`
- Whole-row click optional enhancement; no nested interactive wrappers; no `<a>` around buttons
- **More actions for Anthony Johnson** (accessible name)

### Callback

Real caller number; `tel:` where appropriate; keyboard accessible; do not mark completed unless runtime establishes it.

### Open Conversation

Only if canonical conversation exists. No duplicate MCTB chat route.

---

## 32–35. Sorting & pagination

**Sortable:** Missed (default newest first), Caller if useful, Recovery if useful. `<th>` sort buttons, `aria-sort`, persists across pagination, does not clear filters.

**Pagination:** `1–25 of 184` or `Page 1 of 8`. Preserve search/filters/sort. Avoid infinite scroll unless validated.

---

## 36–37. Return context & deep links

**Mandatory return context:** search, filters, date, sort, page, scroll position restored after detail return.

Detail deep links work independently of list state.

---

## 38–43. Empty & error states

| State | Treatment |
|-------|-----------|
| First-use / not configured | *Finish setup to start recovering missed calls* + CTA — not "No missed calls yet" |
| Configured, no data in period | *No missed calls in this period* |
| Filtered empty | *No missed calls match these filters* + Clear filters |
| Loading | Table skeleton; not "0 missed calls" |
| Error | *Missed calls couldn't be loaded* + Retry; keep shell/filters |
| Partial/degraded | Rows shown; Recovery = *Status unavailable* where affected |

---

## 44. Stale data

Truthful only: *Recovery status may be delayed. Last updated 6 minutes ago.* No fake "Live" badge.

---

## 45–46. Optional detail drawer

May use right-side drawer if Transovo pattern supports it. Canonical full detail route still exists; deep linking preserved; full-screen on mobile. Lightweight preview only — not full consent record.

---

## 47–50. Mobile

Transform rows to structured records — do not squeeze columns.

**Priority:** Caller → Missed time → Recovery → Reply/attention. Trigger/business line can collapse.

**Filters:** Search + `[Filters (2)]` sheet; count visible; state preserved.

**Actions:** Primary record link + one prominent action + overflow; adequate touch targets.

---

## 51–55. Accessibility & keyboard

- One H1; semantic table; `<th scope="col">`; sort buttons in headers; `aria-sort`; no `role="grid"`; no all-cell tabindex
- Status not color-only; focus visible; no hover-only actions
- 200% zoom; 320px reflow; hidden desktop/mobile duplicates not both exposed

**Keyboard flow:** Search → filter → sort → navigate rows → open detail → return with context.

Focus stays on filter after apply; pagination moves focus per Transovo pattern (not body).

**Background updates:** Do not reorder above focused row; show *1 new missed call* or defer safely.

---

## 56–58. Runtime truth

Use canonical states: `trigger`, `recovery_state`, `suppression_reason`, `delivery_state`, `consent_state`, `reply_state`, `business_line`, `repeat_caller_state`.

Do not infer `smsSentAt => Sent` if domain distinguishes queued/sent/delivered/failed/suppressed.

Consent detail belongs on Detail / Consent Log — list may show *Waiting for consent* only.

---

## 59–63. Privacy, compliance, numbers, date/time, i18n

- No consent audio URLs, provider IDs, internal payloads in list
- Factual states: *Suppressed — customer opted out* — not "Noncompliant" / "TCPA failure"
- Only **Business line** in normal number column
- Timezone-aware formatters and date filter boundaries
- Externalized labels; localized status keys; locale-aware name collation

---

## 64–70. Visual hierarchy & density

Row priority: Caller → Recovery/attention → Missed time → Trigger/business line → Actions.

Max ~1–2 badges per row. Repeat caller: *Called 3× today* — restrained. Semantic colors only + text. Medium-density Appointment table token. No internal IDs as visible columns.

---

## 71. Legacy fields audit

Preserve from `/voice/missed-calls`: caller, business line, detected time, SMS sent time, status, suppression reason, repeat caller badge. Recompose per spec; relocate to detail if no longer primary column.

---

## 72–75. Relationships

| Page | Relationship |
|------|--------------|
| Overview | Same underlying data model; Overview shows ~5 recent |
| Conversations | Event-centric vs thread-centric; cross-link |
| Consent Log | Operational vs audit; contextual links only |
| Analytics | Drilldown lands here with filters e.g. `?status=suppressed` |

---

## 76. Test scenarios

| ID | Scenario |
|----|----------|
| A | Normal healthy list — 25 rows, sort/filter/search |
| B | Repeat caller — indicator, correct event |
| C | Waiting for consent — accurate, no fake delivery |
| D | Opted out — Suppressed, no Send action |
| E | Delivery failure — Failed + brief reason |
| F | Multi-line — Business line column + filter |
| G | Filtered empty — Clear filters |
| H | Partial provider outage — events shown, delivery degraded |
| I | Mobile — records, filter sheet, actions |
| J | Keyboard-only — full flow + return context |

---

## 77. Definition of done — Missed Calls

Cursor may mark `/mctb/missed-calls` complete only when:

- [ ] Uses canonical Transovo shell and MCTB local nav
- [ ] Matches Appointment visual language
- [ ] H1 is Missed Calls; remains list/management page
- [ ] Search scope clear; filters use real canonical fields
- [ ] Default sort newest first
- [ ] Semantic HTML table on desktop; no ARIA grid
- [ ] Sort keyboard-operable; `aria-sort` correct
- [ ] Caller primary identity; recovery/reply from authoritative runtime
- [ ] Suppressed distinguished from failed
- [ ] Business line terminology correct; forwarding destination not exposed
- [ ] Row actions minimal; contextual accessible names on overflow
- [ ] No invalid nested interactive elements
- [ ] Repeat-caller information preserved
- [ ] All empty/loading/error/partial states complete
- [ ] Pagination preserves filters/sort/search
- [ ] Return from detail restores context; deep links work
- [ ] Background updates don't steal focus unexpectedly
- [ ] No mock status; no provider jargon
- [ ] Date/time timezone-aware; mobile records preserve labels
- [ ] 320px / 200% / keyboard / screen-reader QA pass
- [ ] Metrics agree with Overview and Analytics
- [ ] Cross-links to detail/conversation work
- [ ] Legacy `/voice/missed-calls` functionality preserved or intentionally relocated

---

## Build handoff

Next page in sequence: **03 — Missed Call Detail** (`/mctb/missed-calls/:id`) — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-03-MISSED-CALL-DETAIL.md`.

**04 — Conversations** (`/mctb/conversations`) — pending build spec.
