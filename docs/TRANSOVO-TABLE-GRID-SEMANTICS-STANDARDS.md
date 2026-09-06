# Transovo Table & Grid Semantics Standards Guide

**Series:** Implementation standards · **Guide #7 of 12**  
**Status:** Active — mandatory hard standard for structured data tables and interactive data grids  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** WHATWG HTML Living Standard · WCAG 2.2 SC 1.3.1 Info and Relationships · W3C WAI Tables Tutorial · WAI-ARIA Authoring Practices Guide Grid Pattern

---

## Master Cursor rule

> **Transovo must use semantic HTML tables for genuinely tabular information and must preserve row/column/header relationships programmatically in accordance with the HTML Standard, WCAG 2.2 SC 1.3.1, and W3C WAI Tables guidance.** Use `<th>`, `<td>`, `scope`, captions, and explicit header associations as required by the complexity of the data. Never use tables for page layout, and **never use ARIA grid merely because a table contains buttons, sorting, row navigation, or selection.** A true ARIA grid is a composite interactive widget and may be used only when spreadsheet-like keyboard interaction is actually required and the complete WAI-ARIA APG focus/navigation model is implemented and tested. Sorting, filtering, pagination, selection, responsive transformation, virtualization, and real-time updates must preserve the data’s semantic relationships, user context, keyboard focus, and authoritative state.

**This guide controls how Transovo presents structured data in tables and when an interactive data grid is appropriate instead.**

---

## First hard rule

**A table and a grid are not interchangeable.**

- Use **semantic HTML tables** for normal tabular information.
- Use an **ARIA grid** only when the interface genuinely behaves like an interactive spreadsheet/application grid and the complete keyboard/focus model is implemented.

That distinction matters a lot for Transovo.

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Use tables only for genuinely tabular information

W3C defines tabular information as information whose relationships exist in two dimensions — rows and columns — and whose meaning depends on those relationships.

**Good table candidates in Transovo:** Appointment list, Contacts list, Transactions, Workflow execution history, Reminder delivery logs, Meeting list, Integration logs, Analytics reports.

**Bad table candidates:** Appointment detail page, Booking Type editor, Settings form, Dashboard card layout, Navigation, General page layout.

**Cursor rule:** Never use `<table>` merely to align content into columns. W3C explicitly says data-table guidance is not for using tables as page-layout mechanisms.

---

## B. Use native HTML table semantics by default

For ordinary tabular data, use:

```html
<table>
  <caption>Upcoming appointments</caption>
  <thead>
    <tr>
      <th scope="col">Customer</th>
      <th scope="col">Date</th>
      <th scope="col">Booking type</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    ...
  </tbody>
</table>
```

The HTML standard defines these native relationships directly.

**Cursor rule:** Prefer native `<table>`, `<th>`, `<td>`, `<thead>`, `<tbody>`, `<caption>` semantics over recreating a visual table using generic `<div>` elements.

---

## C. Header cells must actually be header cells

W3C’s Tables Tutorial requires header cells to use `<th>` and data cells to use `<td>` so assistive technologies can expose their relationship.

**Incorrect:** `<td class="bold">Customer</td>`

**Correct:** `<th scope="col">Customer</th>`

Bold visual appearance is not semantic structure.

---

## D. Use scope when header direction needs to be explicit

For column headers: `<th scope="col">Status</th>`

For row headers: `<th scope="row">Anthony Johnson</th>`

W3C specifically recommends `scope="col"` and `scope="row"` where header relationships could otherwise be ambiguous.

**Cursor rule:** Simple tables with meaningful headers should explicitly associate those headers with their row/column where appropriate.

---

## E. Complex tables require explicit header relationships

If a table has multi-level headings, groups of columns, irregular spanning headers, or row and column groups, then simple top-row `<th>` markup may not be sufficient.

W3C documents `scope="rowgroup"`, `scope="colgroup"`, `id`, and `headers` for more complex relationships.

**Cursor rule:** Do not visually construct multi-level table headers without ensuring every data cell has an understandable programmatic relationship to its applicable headers.

---

## F. Keep table structures as simple as the data permits

A complex table is harder for screen-reader navigation, responsive adaptation, visual scanning, implementation, and maintenance.

If one table needs six header levels, nested groups, and hidden row/column semantics — ask whether the data should be separated into multiple simpler views.

Complex markup is allowed. Unnecessary complexity is not desirable.

---

## G. Use a table caption when the table needs an identity

W3C says a `<caption>` functions like a table heading and helps users identify and navigate tables, especially screen-reader users navigating table-to-table.

**Example:** `<caption>Reminder delivery history</caption>`

But don’t duplicate an immediately adjacent heading unnecessarily if the relationship is already established accessibly.

**Cursor rule:** Each standalone data table must have a programmatically identifiable purpose, using `<caption>` or an appropriate equivalent relationship.

---

## H. Complex tables may need a structural summary

W3C recommends summaries where a complex table’s organization requires explanation.

**Example:** Columns are grouped by reminder channel. Each channel contains Sent, Delivered, and Failed totals.

This can help users understand the data model before navigating many cells. Do not provide redundant summaries for trivial tables.

---

## I. Table structure must survive presentation changes

WCAG 1.3.1 exists specifically so visual relationships remain available when presentation changes, including screen-reader or alternate rendering.

If sighted user can understand **Anthony Johnson → Sep 8 → Confirmed** because columns line up visually, screen-reader users must receive the same row/column relationships programmatically.

---

## J. Visual spacing cannot be the only table structure

Never create pseudo-tables using Anthony / Sep 8 / Confirmed with spaces, tabs, CSS positioning, or `<pre>`.

WCAG specifically identifies failure patterns where whitespace or nonsemantic markup is used to represent tabular information.

---

## K. Use a static table unless interactive-grid behavior is genuinely needed

**This is one of the most important rules.**

WAI APG distinguishes normal tables from grids. A grid is a composite widget:

- it contains focusable cells/items
- usually only one internal element participates in the page Tab sequence
- arrow/Home/End keys navigate within it
- the author must manage focus

Therefore: **Appointment list** with sortable columns, row links, and action menu does **not** automatically need ARIA grid. A semantic table can handle that.

---

## L. Sorting does not automatically make a table a grid

A normal semantic table can have sortable column headers.

**Example:** Customer ↕ · Date ↑ · Status

The sort control can be a button inside the `<th>`.

Do not switch to `role="grid"` just because rows are sortable, there are buttons, or rows have menus. Grid should be used only when the entire data region adopts managed interactive navigation.

---

## M. Row clickability does not automatically make a table a grid

A normal table row may contain contact link, appointment link, action menu without requiring ARIA grid semantics.

Avoid putting a click handler on `<tr>` if that creates inaccessible ambiguous interaction. Prefer explicit focusable elements inside cells where appropriate.

---

## N. ARIA grid creates a full interaction contract

If Cursor uses `role="grid"`, it must implement the complete interaction model.

WAI APG explicitly states that a grid requires author-managed focus and directional keyboard navigation.

That means:

- one appropriate grid entry point in normal Tab order
- arrow-key navigation
- Home/End behavior
- row/column semantics
- focusable cells or child widgets as required
- selected state where applicable
- editing behavior
- assistive-technology testing

**Cursor rule:** Never add `role="grid"` as an accessibility decoration.

---

## O. “No ARIA is better than bad ARIA”

W3C’s APG examples explicitly warn that poor ARIA implementations can reduce accessibility and that semantic HTML should be maximized.

**Cursor rule:** If a semantic table adequately represents the data and interaction, do not replace it with a custom ARIA data grid.

---

## P. A true data grid is appropriate for spreadsheet-like interaction

**Potential examples:** editable cells, cell-by-cell keyboard navigation, keyboard selection, copy/paste, complex row/column selection, large interactive matrix.

**Potential Transovo candidates:** possibly a sophisticated scheduling matrix, possibly a future spreadsheet-style bulk editor.

**Not typical candidates:** Contacts, Payments, Workflow logs, Meetings list.

---

## Q. Every grid cell must fit the grid’s focus model

APG says data-grid cells are themselves focusable or contain focusable elements, with limited exceptions for noninteractive headers.

Do not build a grid where some cells participate in arrow navigation, others require random Tab presses, some cannot receive focus, or focus vanishes inside embedded controls — without explicitly managing those transitions.

---

## R. Composite widgets inside grid cells require special handling

W3C notes that grid arrow keys may conflict with controls inside a cell, such as combobox, slider, editable field, radio group.

The interface needs a clear distinction between **navigating the grid** and **interacting with/editing the cell**.

Cursor must implement this intentionally if using a true grid.

---

## S. Static table focus should remain simple

For ordinary tables, only actually interactive elements should be focusable: links, buttons, checkboxes, form fields.

Plain data cells should not all receive `tabindex="0"`. That would create hundreds of unnecessary Tab stops.

---

## T. Focus order must preserve row/column meaning

WCAG 2.4.3 requires focus order that preserves meaning and operability.

For a normal table row: Customer link → Booking link → Action menu — keyboard order should follow a predictable row sequence.

Do not visually show one order while DOM focus jumps unpredictably between columns.

---

## U. DOM order and visual table order should align

W3C recommends source/DOM order matching visual order where possible because mismatches confuse screen reader users, magnifier users, and keyboard users.

Avoid CSS tricks that visually reorder table columns without corresponding semantic order.

---

## V. Sorting must be operable with keyboard

If a column can be sorted by pointer, keyboard users must be able to perform the same sort.

Use an actual focusable control in the header.

**Example:**

```html
<th scope="col">
  <button>Appointment date</button>
</th>
```

Do not make the `<th>` itself mouse-clickable without appropriate interaction semantics.

---

## W. Sort state must be programmatically conveyed

If **Appointment date ↑** means ascending, assistive technology needs the sort state too.

Use appropriate table/ARIA sort semantics, e.g. `aria-sort` on the relevant column header when applicable.

Do not communicate sort direction only through arrow icon or color.

---

## X. Only the currently sorted header should expose active sort direction

Avoid marking every sortable column as ascending or none in confusing ways.

The active sort state should accurately represent the current data order.

---

## Y. Sorting must not silently change unrelated filters

If user sorts by Date, do not reset staff filter, status filter, search query, or selected date range.

Sorting changes ordering. It should not alter the dataset unless explicitly intended.

---

## Z. Filters belong outside or clearly above the table

Filters are controls over the dataset, not table-column data themselves.

**Typical:**

```
Search   Status ▼   Date ▼   More filters
[table]
```

Column-specific filters can exist when appropriate, but they still require clear interaction and accessible naming.

---

## AA. Table search scope must be clear

If search field above Appointments table searches customer, booking type, and email — that scope should be understandable.

Don’t create a search input whose behavior mysteriously differs by column.

---

## AB. Row selection must use real selection controls

For multi-row selection, use checkbox semantics.

Typical: checkbox in each row, select-all checkbox in header.

Do not make users Ctrl-click random rows unless that is an optional accelerator.

---

## AC. Selection state must not rely on row background alone

Selected row can have checked checkbox and visual highlight.

The checkbox/state carries meaning. Background color reinforces it.

---

## AD. Select-all scope must be explicit

**This is crucial with pagination.**

| Meaning |
|---------|
| Select all 25 rows on this page |
| Select all 2,430 matching appointments |

These are very different.

**Cursor rule:** Never make a select-all checkbox ambiguous across pagination/filter scope.

---

## AE. Bulk action bar must clearly show selected count

**Example:** `12 appointments selected` · Reschedule | Cancel | More

Do not require users to count highlights.

---

## AF. Bulk actions must operate only on explicit selection

Changing filter while rows are selected requires defined behavior.

Possible: selection persists if objects remain in scope, or selection clears with explicit notice.

Do not allow hidden selected rows to remain dangerously selected without the user understanding.

---

## AG. Row action menus need accessible names

Instead of every row exposing a button named **More**, use accessible context such as **More actions for Anthony Johnson’s appointment**.

Visible UI can still show •••. This reduces ambiguity for assistive technology.

---

## AH. Avoid too many per-row actions

A table row should not contain 9 buttons, 5 status controls, and multiple toggles.

That hurts scanability and keyboard efficiency.

Expose primary link/action, one or two frequent actions, overflow for secondary actions — where appropriate.

---

## AI. Row identity should be visually strongest

For Appointment List:

- **Primary:** Anthony Johnson
- **Secondary:** Initial consultation
- **State:** Confirmed
- **Actions:** •••

Do not let metadata visually overpower the object identity.

This part is best practice rather than a normative HTML rule, but it supports effective structured data scanning.

---

## AJ. Numeric columns should align consistently

For amount, counts, percentages — right alignment generally improves comparison.

Text remains left-aligned.

This is a visual/data-density convention rather than WCAG rule, but it should be consistent in Transovo.

---

## AK. Dates must use a consistent format within a table

Do not mix Sep 8, 09/09/2026, Tomorrow, and September 10th within the same comparison column without a clear reason.

Formatting details are governed by the Date/Time standards guide later. The table rule is consistency.

---

## AL. Status labels must be explicit text

Use **Confirmed** — not merely a green dot.

Use **Failed** — not merely red icon.

Tables fall under WCAG’s requirement that visual relationships and meaning not depend solely on presentation.

---

## AM. Status badges should not overwhelm table density

If a row has Confirmed, Paid, Synced, SMS ready, Imported, and Teams all as colored badges, scanning becomes difficult.

Show only the states needed for comparison. Move deeper state to detail view.

---

## AN. Long cell content needs a defined strategy

For fields such as long booking type, long customer name, meeting URL, email — choose wrap, truncate with accessible recovery, or open detail.

Do not let unpredictable text blow out column geometry.

---

## AO. Critical values should not be permanently truncated

If user must distinguish **Consultation — Returning Patient** from **Consultation — New Patient**, both can’t permanently appear as **Consultation — …**

Provide sufficient visible difference or access to full text.

---

## AP. Tooltips are not a substitute for usable table content

A user should not need to hover every row to know what it says.

Tooltips can reveal occasional full values. They should not carry primary table meaning.

---

## AQ. Sticky table headers must preserve semantics

Visually sticky `<thead>` is fine.

Do not duplicate header markup in a second fake layer that creates duplicate screen-reader content or breaks header associations — unless implemented carefully.

Prefer sticky positioning on the real header.

---

## AR. Sticky columns require careful focus/reading-order behavior

If first column remains fixed while table scrolls:

- semantic column order remains correct
- focus doesn’t jump
- duplicated clone cells are avoided or hidden correctly

Visual convenience must not duplicate accessible data.

---

## AS. Table virtualization must preserve accessibility information

Large datasets may virtualize rows.

If using an interactive grid, APG notes ARIA properties such as `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex` may be necessary when rows/columns aren’t all present in DOM.

For semantic tables, virtualization can be challenging.

**Cursor rule:** Do not add aggressive row virtualization without testing keyboard/screen-reader behavior and preserving meaningful row position/context.

---

## AT. Virtualization must not break browser find or assistive navigation unintentionally

If only visible rows exist in DOM:

- browser Find may not locate offscreen data
- screen readers may perceive partial data
- row counts may be misleading

Use virtualization only where dataset/performance justifies the UX tradeoff.

---

## AU. Pagination is often preferable to uncontrolled infinite tables

For large operational datasets, pagination provides clear boundaries, stable location, predictable navigation.

Infinite scrolling may be used, but requires deliberate focus/state handling.

Do not use infinite scrolling solely because it feels modern.

---

## AV. Pagination must expose current position

Users should know **Page 3 of 24** or equivalent record range **51–75 of 592** where practical.

Do not give only Previous | Next if total/range is known and useful.

---

## AW. Pagination controls need accessible names

Examples: Previous page, Next page, Page 3, Go to page 4.

Current page should be programmatically identifiable.

---

## AX. Changing page must preserve active filters and sorting

Page 2 should represent the same query.

Do not reset status, search, or sort when paging.

---

## AY. Returning from detail should restore table context

If user filtered to Unconfirmed, sorted by Date, opened row 38, and returns — preserve filters, sort, page, and reasonable scroll position.

This dramatically improves operational efficiency.

---

## AZ. Empty tables require a proper empty state

Do not render Customer | Date | Status with nothing else.

Show **No appointments match these filters.** with actions such as Clear filters or New appointment depending on context.

---

## BA. “No data” and “no results” are different

| State | Message |
|-------|---------|
| First use | No appointments yet. |
| Search/filter | No appointments match “Anthony”. |
| Error | Appointments couldn’t be loaded. |

Three different states. Do not present all as an empty table.

---

## BB. Loading is not an empty table

While fetching: skeleton rows, loading state.

Do not temporarily show **No appointments** and then replace it with data. That communicates false state.

---

## BC. Partial data needs explicit state

If some pages/results loaded but a provider failed: **184 appointments loaded. Microsoft import is temporarily unavailable.**

Do not silently present incomplete results as complete.

---

## BD. Table errors need recovery

**Example:** Appointments couldn’t be loaded. **Retry**

Do not leave the user staring at blank columns.

---

## BE. Column visibility settings need stable semantics

If users can hide columns: hidden state persists predictably, essential identity/actions cannot become impossible to find, reset defaults available.

Don’t allow a user to accidentally hide every identifying field.

---

## BF. Default columns should match primary task

**Appointments** — likely more useful: Customer, Date/time, Booking type, Confirmation, Reminder — than internal ID, createdAt, provider event ID.

Backend importance is not user importance.

---

## BG. Do not expose internal identifiers as primary table data

Provider IDs, UUIDs, webhook IDs belong in details or developer diagnostics — not ordinary operational tables unless users actually need them.

---

## BH. Column labels must be specific

**Bad:** Type — if unclear whether it means appointment type, payment type, or calendar type.

**Better:** Booking type

Clarity beats extreme brevity.

---

## BI. Avoid icon-only column headers unless universally understood and accessible

A column headed only **$** may be understandable in context but still needs appropriate accessible naming.

A column headed only by bell icon for reminders is likely too ambiguous. Use text where ambiguity exists.

---

## BJ. Column header controls must not obscure the header name

If header includes sort/filter buttons, screen-reader name should remain understandable.

**Example:** Appointment date, sorted ascending — not Button, ascending.

---

## BK. Actions column should have accessible meaning even if visual header is blank

A blank visual heading for trailing ••• actions may be acceptable visually.

Programmatically, the structure should still make sense. Row action controls themselves need contextual names.

---

## BL. Row headers can improve complex tables

If each row is fundamentally identified by one field, use it as row header when appropriate.

**Example:** `<th scope="row">Anthony Johnson</th>`

Then screen-reader users can more readily associate other values in that row with the customer.

W3C explicitly supports row headers through `<th scope="row">`.

---

## BM. Do not make every first cell a row header automatically

Only do so when that value genuinely identifies/describes the row.

For an anonymous raw log table where first column is merely timestamp, row-header semantics may not be meaningful.

Semantics should reflect actual relationships.

---

## BN. Spanning cells should be minimized where not necessary

`rowspan` and `colspan` are valid HTML features. But complex spanning structures increase navigation complexity.

Use only when data model genuinely contains grouped relationships. Do not use spanning just for visual style.

---

## BO. Do not merge cells to create decorative headings

If you need a visual section, use actual section/page structure rather than abusing table cells.

Tables describe data relationships.

---

## BP. Tables should not contain giant forms unless spreadsheet interaction is intentional

If every row contains 8 editable fields, date picker, dropdown, and buttons — you are moving toward data-grid/spreadsheet interaction.

At that point explicitly decide whether inline editing is actually appropriate, edit drawer/detail page would be clearer, or real grid semantics are needed.

Do not drift accidentally into an inaccessible pseudo-grid.

---

## BQ. Inline editing must have a clear mode

If a cell becomes editable, user must understand: which cell is editing, how to save, how to cancel, validation errors, whether moving away saves/discards.

Do not turn plain text cells into controls on hover with no clear state.

---

## BR. Inline editing may not rely on double click

Provide explicit keyboard-accessible action such as Edit button, Enter when cell selected in true grid, or row action.

Double-click may be an accelerator, never the sole path.

---

## BS. Saving one row should not reload the entire table unnecessarily

Preserve focus, sort, filters, selection, scroll. Update the affected row.

Operational tables should feel stable.

---

## BT. Background updates must not reorder focused rows unexpectedly

If appointment status changes in real time, don’t suddenly sort the focused row to another place while user is interacting.

Possible pattern: **Updates available** — or update row without reorder until safe.

Preserve interaction stability.

---

## BU. Real-time updates must reflect truthful state

If reminder becomes **Delivered**, update appropriately.

But don’t fake status before authoritative result.

System state in tables must use the same canonical source as detail pages.

---

## BV. Table and detail state must never disagree

If table says **Confirmed** and Appointment Detail says **Scheduled / not confirmed** — one is stale/broken.

Shared status components/data should derive from one authoritative state model.

---

## BW. Table status terminology must match the rest of Transovo

No Table: Done · Detail: Completed · Analytics: Finished.

Pick **Completed** and use it everywhere.

This follows the consistent-identification standards already established.

---

## BX. Table sorting rules must match data meaning

Dates sort chronologically. Currency sorts numerically. Names sort according to locale-aware text rules where appropriate.

Don’t sort formatted strings lexicographically if that produces incorrect results.

---

## BY. Null/missing values need one consistent representation

Examples: — · Not set · No phone number — choose according to meaning.

Do not mix N/A, None, Null, ●, blank arbitrarily.

Missing values should not be confused with zero or false.

---

## BZ. Zero, false, and missing are different

**Example:** `0 reminders` does not mean **Reminder data unavailable.**

Table representation must preserve semantic differences.

---

## CA. Date/time timezone must be explicit where ambiguity exists

Table may display **Sep 8 · 2:00 PM**.

If users span timezones and context isn’t obvious, include timezone or establish one clearly at page level.

The Date/Time standards guide will define formatting.

---

## CB. Responsive transformation must preserve header relationships

If desktop table becomes mobile cards, column header context may need to become visible labels.

**Desktop:** | Confirmation | Confirmed |

**Mobile:** Confirmation: Confirmed

Do not remove the semantic relationship just because the table visual disappears.

---

## CC. A responsive card version does not need table semantics if it is no longer tabular

If mobile representation becomes a list of self-contained records, semantic list/article structures may be more appropriate.

Do not force `<table>` semantics onto a fundamentally transformed mobile layout unless relationships remain tabular.

But ensure hidden desktop/mobile duplicates aren’t both exposed simultaneously.

---

## CD. Horizontal scrolling is acceptable for genuinely comparative tables

WCAG Reflow allows two-dimensional scrolling where two-dimensional layout is necessary for meaning/use. Complex data tables can qualify. The responsive guide governs this more fully.

**Cursor rule:** If a table must remain wide, isolate horizontal scrolling to the table region rather than the whole page.

---

## CE. Sticky action columns must not cover data

If trailing actions are sticky: no overlapping cells, proper z-index/background, focus visible, accessible order unchanged.

Test at zoom and narrow widths.

---

## CF. Fixed column widths should be used sparingly

**Appropriate:** checkbox, status icon, compact amount

**Flexible:** customer name, booking type

Do not assign every column an arbitrary pixel width that collapses under real content.

---

## CG. Column sizing should reflect comparison importance

**Example Appointment table:** Customer and Date deserve enough width. Internal source metadata can be narrower or hidden in detail.

Column geometry should follow user task importance.

---

## CH. Tables need row and column scanability

Use consistent row height, alignment, spacing, typography.

But don’t use excessive borders or zebra striping automatically.

Visual styling belongs to the design system; semantic hierarchy remains independent.

---

## CI. Row hover is supplemental

Hover may help pointer users identify current row.

But keyboard focus needs its own state, selected row needs its own state, touch users need no hover dependency.

Do not use hover as the only indication that a row can be opened.

---

## CJ. Row focus and selection must be distinguishable

If a table supports selection:

- **focus** = where keyboard is
- **selection** = included in action set

Do not use identical background for both. This aligns with APG interaction principles.

---

## CK. Tables with links must preserve clear link purpose

**Example customer cell:** Anthony Johnson links to contact. Date cell might link to appointment.

Do not make every cell link to the same detail page unless that actually improves usability; repeated redundant links can create excessive keyboard stops.

---

## CL. Whole-row navigation needs careful semantics

If whole row opens appointment, prefer an explicit primary link inside the row while allowing pointer row activation as enhancement if implemented safely.

This gives keyboard/screen-reader users a standard navigation element.

---

## CM. Do not nest interactive controls illegally

Avoid clickable row implemented as `<a>` containing buttons/menu.

Interactive elements nested inside interactive elements create invalid or confusing semantics. Structure row actions separately.

---

## CN. Exported tables must preserve understandable headers

CSV/PDF exports are separate formats, but the exported data should retain meaningful column names, ordering, units, date/time context.

If PDF is accessible, its table structure must also be tagged appropriately.

Do not export internal field names just because backend uses them.

---

## CO. Screen-reader testing is required for representative tables

At minimum test: simple table, table with row actions, sortable table, selectable table, any complex grouped table, any true ARIA grid.

Verify users can understand: table identity, headers, row identity, sort state, selection, actions.

---

## CP. Keyboard testing must include complete table tasks

**Example:** Find Anthony’s appointment, sort by date, open it, return, select two rows, perform bulk action.

Not merely: Can I Tab through the page?

Operational task testing matters.

---

## CQ. Large tables need performance without sacrificing semantics

Optimization cannot justify inaccessible virtualization, broken focus, missing rows, misleading counts.

Performance and accessibility both need to work.

If necessary: paginate, lazy-load predictably, virtualize only with a validated accessibility strategy.

---

## CR. Table semantics must match actual data, not appearance

WCAG 1.3.1 explicitly treats misuse of structural markup as a failure when markup does not represent real content relationships.

Do not use `<th>` merely to make text bold. Do not use table roles for a card layout.

Semantics must be truthful.

---

## CS. The table/grid decision must be documented per reusable component

For every reusable dense data component, Cursor should explicitly classify it as:

- Static/read-oriented semantic table
- Interactive data grid
- List/card collection

Do not leave this ambiguous.

---

## CT. Default Transovo classification

Unless evidence shows otherwise:

**Use semantic tables for:** Appointment list, Contacts, Transactions, Reminder history, Workflow activity/logs, Meeting lists, Integration logs, reports.

**Use list/card layouts for:** mobile transformed records, dashboard queues, contextual activity timelines.

**Use ARIA grid only for:** genuinely spreadsheet-like interactive datasets, specialized scheduling matrices if they implement complete grid behavior.

This should be Cursor’s default assumption.

---

## Transovo Table / Grid Acceptance Checklist

Every applicable table/grid should pass:

- [ ] Data is genuinely tabular before using table semantics
- [ ] Tables are not used for page layout
- [ ] Native HTML table semantics are used by default
- [ ] Header cells use `th`, not styled `td` elements
- [ ] Row/column relationships are programmatically determinable
- [ ] `scope=row/col` used where appropriate
- [ ] Complex headers have explicit correct associations
- [ ] Table has an understandable programmatic identity/caption where needed
- [ ] Complex table has explanatory summary where necessary
- [ ] Visual relationships survive assistive/alternate presentation
- [ ] Table structure is no more complex than necessary
- [ ] ARIA grid is not used merely because table is interactive
- [ ] Sorting alone did not trigger unnecessary grid semantics
- [ ] Row clickability alone did not trigger unnecessary grid semantics
- [ ] Any actual ARIA grid implements complete keyboard/focus behavior
- [ ] Grid cells and embedded controls follow APG interaction model
- [ ] Plain table cells are not added to Tab sequence unnecessarily
- [ ] DOM/reading/focus order matches logical visual order
- [ ] Sort controls are keyboard operable
- [ ] Sort direction is programmatically exposed
- [ ] Search/filter state persists through sorting/pagination
- [ ] Row selection uses explicit accessible selection controls
- [ ] Select-all scope is explicit
- [ ] Selected count is visible for bulk actions
- [ ] Bulk actions operate only on clearly selected rows
- [ ] Row action menus have contextual accessible names
- [ ] Primary row identity is clear
- [ ] Status is not communicated by color alone
- [ ] Long values have an explicit wrap/truncate/recovery strategy
- [ ] Critical values are not permanently obscured
- [ ] Sticky headers use real semantic header structure where possible
- [ ] Sticky columns do not duplicate accessible content
- [ ] Virtualization preserves row/column context or is avoided
- [ ] Pagination exposes position/range where useful
- [ ] Filters/sort/page are preserved when returning from detail
- [ ] First-use/no-results/error/loading states are distinct
- [ ] Partial datasets are labeled as partial
- [ ] Default columns reflect user tasks rather than backend fields
- [ ] Internal IDs are not exposed as primary data without reason
- [ ] Missing/zero/false values are differentiated correctly
- [ ] Table/detail status derives from same authoritative state
- [ ] Responsive representation preserves field relationships
- [ ] Horizontal scrolling is isolated to the table where necessary
- [ ] Inline editing has clear edit/save/cancel semantics
- [ ] Real-time updates do not steal focus or reorder active rows unexpectedly
- [ ] No invalid nested interactive elements
- [ ] Screen-reader QA performed on representative tables
- [ ] Keyboard task QA performed
- [ ] True data grids receive dedicated APG/assistive-technology QA

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md      → Tables & grids (this file)
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #7: Table & Grid Semantics Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*
