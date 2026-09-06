# Transovo Responsive, Reflow & Zoom Standards Guide

**Series:** Implementation standards · **Guide #6 of 12**  
**Status:** Active — mandatory hard standard for viewport adaptation, browser zoom, text enlargement, orientation, and constrained layouts  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** W3C WCAG 2.2 — especially 1.4.4 Resize Text, 1.4.10 Reflow, 1.3.4 Orientation, and related requirements for meaningful sequence, text spacing, non-text contrast, target size, keyboard operation, and hover/focus behavior

---

## Master Cursor rule

> **Transovo must comply with WCAG 2.2 responsive accessibility requirements, including Resize Text 1.4.4, Reflow 1.4.10, Orientation 1.3.4, and related requirements for meaningful sequence, text spacing, keyboard operation, and accessible interaction.** Normal vertically scrolling content must reflow without loss of information or functionality at the equivalent of 320 CSS pixels, while any genuinely essential two-dimensional content such as calendars or workflow canvases must be isolated to its own region and handled intentionally. Text must remain fully usable at 200% enlargement, browser zoom must never be disabled, layouts must support portrait and landscape, and responsive transformations must preserve the same information architecture, business state, task capability, semantic order, and interaction meaning. Adapt layout by reflowing, wrapping, collapsing secondary controls, and transforming components — **not** by shrinking text, hiding essential functionality, or introducing page-wide horizontal scrolling.

**This guide controls how Transovo must adapt across viewport sizes, browser zoom, text enlargement, device orientation, and constrained layouts without losing information or functionality.**

---

## Governing principle

Responsive design is not “make desktop smaller.” The interface must preserve the same task, meaning, relationships, and functionality as available space changes.

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- **Next:** Guide #4 — Interaction, Keyboard & Focus Standards (coming) · Guide #8 — Privacy, Consent & Compliance UX Standards (coming)

---

## A. Reflow is mandatory

For normal vertically scrolling content, Transovo must reflow down to a viewport width equivalent to **320 CSS pixels** without losing information or functionality and without forcing horizontal plus vertical scrolling at the same time.

**Cursor rule:** Ordinary pages must not depend on a minimum desktop width to remain usable.

This applies to: Home, Contacts, Appointment details, Booking editors, Settings, Integrations, Payments, Analytics text/content, Reminder sequences.

---

## B. Two-dimensional layouts are the exception, not the default

WCAG explicitly permits exceptions where two-dimensional layout is essential to usage or meaning.

**Likely Transovo candidates:** calendar grid, workflow canvas, complex data tables, certain charts, scheduling matrices.

That does not mean the whole page can horizontally scroll.

**Example:**

```
Page header
Filters
Calendar viewport ← may require 2D interaction
Other content
```

Only the essential region gets the exception.

**Cursor rule:** Never use an essential-layout exception as justification for making the entire application fixed-width.

---

## C. 200% text resize must preserve content and functionality

WCAG 1.4.4 requires text to resize to 200% without loss of content/functionality.

At 200%: labels must remain visible, buttons remain operable, text must not clip, input values remain readable, table actions remain reachable, dialogs remain usable, navigation remains understandable.

W3C also specifically notes text containers should accommodate larger text instead of clipping it.

---

## D. Do not disable browser zoom

**Hard rule.** Do not use viewport settings or scripts that prevent users from zooming.

**Cursor must not ship:**

```
maximum-scale=1
user-scalable=no
```

or equivalent behavior that blocks enlargement.

W3C test guidance explicitly includes verifying that the viewport permits zoom.

---

## E. Avoid fixed heights around text

One of the most common zoom failures is `height: 40px; overflow: hidden;` around a component whose text can grow.

At increased text size: label clips, button text disappears, helper text overlaps, row becomes unreadable.

Prefer min-height, intrinsic sizing, wrapping, flexible containers where appropriate.

---

## F. Relative sizing should be preferred for text

W3C lists relative measurements such as em and percentage-based sizing among techniques supporting text resizing.

For Transovo, prefer a scalable typography system using rem, em, relative line heights rather than hard-coding every text metric in a way that defeats user enlargement.

This does not mean every layout dimension must use rem. Use the right unit for the right job.

---

## G. Text-based controls must resize with their text

W3C specifically addresses form elements containing text and the need for them to scale appropriately.

Buttons and inputs must not stay too short while their text doubles in size.

At zoom, **Save changes** must remain readable and clickable — not clip into **Save chan…**

---

## H. No orientation lock

WCAG 1.3.4 says content must operate in either portrait or landscape unless one orientation is essential.

Transovo should work in portrait phone, landscape phone, portrait tablet, landscape tablet, desktop.

Do not show **Rotate your device to continue.** W3C specifically lists such forced-reorientation behavior as a failure pattern.

---

## I. Orientation changes must preserve state

If a user rotates their device while creating an appointment, editing a workflow, viewing a contact, or filling a form — do not reset entered values, selected tab, current appointment, filters, or scroll position unnecessarily.

Layout changes. Task state should survive.

---

## J. Responsive design must preserve semantic order

WCAG requires meaningful sequence to remain programmatically determinable.

**Desktop:** Customer | Appointment details | Status

**Mobile** may visually stack: Customer → Appointment details → Status

DOM order should remain logical. Do not visually reorder with CSS in a way that makes screen-reader/keyboard order nonsensical.

---

## K. Breakpoints should be content-driven

There is no standards rule that says mobile = 768px.

Cursor should not blindly design around device names.

Breakpoints should occur when: navigation stops fitting, table stops being usable, form columns become cramped, actions collide, calendar controls become unusable.

Use actual content pressure.

---

## L. Device classes are secondary to available space

Do not write UX assumptions like if iPad → tablet design, if iPhone → mobile design.

Prefer responsive behavior based on viewport, container width, input capabilities where necessary.

A narrow desktop window may need the same responsive layout as a tablet.

---

## M. The global sidebar must adapt, not disappear conceptually

**Desktop:** persistent/collapsible sidebar

**Smaller viewport:** navigation drawer/menu

The conceptual order and labels remain the same. Do not create a completely different mobile IA.

Responsive presentation changes. Information architecture does not.

---

## N. Primary navigation must remain fully reachable

Mobile adaptation must not permanently remove: Appointments, Booking, Contacts, Messages, Automations, Meetings, Payments, Analytics, Integrations, Settings.

All authorized destinations remain accessible.

---

## O. The page’s primary action must remain prominent

**Desktop:** Appointments + New appointment

**Mobile** might become Appointments with a compact persistent **+ New appointment** action.

But it must not vanish into ••• → More → New appointment unless there is a strong reason.

Primary task priority survives responsive changes.

---

## P. Secondary actions may collapse before primary actions

As width decreases, keep **Save changes** before Export, Duplicate, Advanced actions.

Secondary actions can move into overflow.

**Cursor rule:** Collapse by priority, not arbitrary DOM order.

---

## Q. Responsive reduction order should be predictable

When width becomes constrained, use this sequence conceptually:

1. reflow
2. wrap
3. reduce nonessential spacing
4. collapse secondary controls
5. move secondary actions to overflow
6. transform component presentation
7. only hide content that is genuinely nonessential

Do not start by deleting information.

---

## R. Do not shrink text below the design system minimum to make things fit

**Bad:** Mobile layout doesn’t fit → make everything 9px.

Responsive layout should restructure. It should not sacrifice readability.

---

## S. Tables require an explicit responsive strategy

Every Transovo table must declare how it behaves at narrow widths.

| Pattern | When |
|---------|------|
| **1 — Horizontal scrolling region** | Column comparison is essential |
| **2 — Priority columns** | Hide lower-priority columns; preserve access through detail |
| **3 — Row/card transformation** | Each row becomes a structured mobile record |
| **4 — Summary + detail** | Show essential fields; open full detail |

**Cursor rule:** A table is not “responsive” merely because the page has `overflow-x: auto`.

---

## T. If horizontal table scrolling is required, isolate it

Do not make the entire page scroll sideways.

```
Page header
Filters
┌──────────────────────┐
│ scrollable table     │ ← horizontal if needed
└──────────────────────┘
```

Normal page content continues vertically. This aligns with the WCAG reflow exception approach.

---

## U. Preserve row identity when tables collapse

**Desktop:**

| Customer | Date | Type | Status |

**Mobile:**

```
Anthony Johnson
Sep 8 · 2:00 PM
Initial consultation
Confirmed
```

Do not turn it into unlabeled Anthony / Sep 8 / Consultation / Confirmed if context becomes ambiguous.

---

## V. Data labels may need to become explicit on mobile

Desktop column heading supplies context: **Status: Confirmed**

Mobile card may require **Status: Confirmed** because the column heading is gone.

Responsive transformation must preserve relationships.

---

## W. Calendars need multiple viewport strategies

A desktop week calendar may not work on a 320px screen. Do not simply compress seven columns into microscopic cells.

**Possible responsive hierarchy:**

| Width | View |
|-------|------|
| Wide desktop | Week / day / month |
| Narrow desktop/tablet | Reduced week / day |
| Phone | Agenda/day/list-oriented view |

All underlying appointments remain reachable.

**Cursor rule:** Preserve scheduling capability; adapt the visualization.

---

## X. Calendar mobile view must not lose appointment actions

User must still be able to inspect appointment, create appointment, reschedule, cancel, message, see status — even if the week grid becomes an agenda.

---

## Y. “Why unavailable?” diagnostics must adapt too

**Desktop:** Hover/click on slot may show explanation.

**Mobile:** Tap unavailable slot or explicit info control.

Never rely on hover.

---

## Z. Drawers become different surfaces at small widths

**Desktop:** right-side detail drawer

**Mobile:** full-screen sheet/page

Do not force a 480px-wide drawer into a 375px viewport.

The conceptual action remains: inspect appointment without losing logical context.

---

## AA. Modals need responsive maximum dimensions

A modal must fit within the viewport.

At small widths: near-full-width, content scrolls internally where necessary, actions remain reachable, no horizontal clipping.

Long workflows should not remain in modals at all.

---

## AB. Modal actions must remain reachable at 200% zoom

Do not position Cancel / Save outside the visible region with no way to reach them.

Scrollable modal content must preserve correct focus and access.

---

## AC. Forms should collapse columns

**Desktop:** Start date | Start time

**At narrow width:**

```
Start date
Start time
```

Do not keep narrow side-by-side fields until labels/values overlap.

---

## AD. Form grouping must remain intact after reflow

If Start date + Start time are conceptually related, stack them together.

Don’t let responsive CSS scatter Start date at top, other fields, Start time later.

Meaningful grouping survives layout changes.

---

## AE. Button groups should wrap intelligently

**Example desktop:** Cancel · Preview · Save changes

**On mobile** potentially Save changes, Preview, Cancel — depending on design system conventions and task priority.

But never let controls overlap or shrink below usable size.

---

## AF. Destructive and primary actions must stay distinct after wrapping

A mobile stack must not accidentally put **Delete** directly where **Save** used to be with identical visual priority.

Responsive transformations must preserve hierarchy and safety.

---

## AG. Tabs need a narrow-screen strategy

If tabs no longer fit, possible approaches: horizontally scrollable tablist, controlled overflow, local dropdown in certain contexts, reduced tabs where architecture supports it.

Do not shrink labels until unreadable or wrap tabs across confusing multiple lines without deliberate design.

---

## AH. Horizontal tab scrolling must keep selected tab discoverable

If local tabs scroll horizontally: selected tab should remain visible, focus should reveal offscreen tab, keyboard navigation still works, clipping should communicate scrollability appropriately.

---

## AI. Do not convert every tabset into a dropdown on mobile automatically

Sometimes horizontal scrolling or fewer local views is more discoverable. The responsive pattern should fit the specific task.

---

## AJ. Filters need a responsive transformation

**Desktop:** Search | Status | Staff | Date | More filters

**Mobile:** Search + **[ Filters (3) ]** then filter sheet/dialog.

Selected filters should remain visible through chips, count, or summary. User must know filtering is active.

---

## AK. Filter state survives breakpoint changes

If user narrows browser window, do not clear date filter, staff, status, or search query.

Presentation changes. State remains.

---

## AL. Search should retain adequate input width

Don’t squeeze search into a 70px field because toolbar contains too many buttons.

On small screens, give search its own row if necessary. Core findability beats toolbar compactness.

---

## AM. Long labels must wrap rather than clip where appropriate

Buttons may sometimes use concise labels. But headings, field labels, helper text, warning messages must be allowed to wrap.

Do not truncate essential instructions.

---

## AN. Truncated content needs a recovery path

For unavoidable truncation **Initial consultation for…** provide full value through object detail, accessible name, tooltip/focus behavior where appropriate.

Critical information cannot become permanently unavailable.

---

## AO. Fixed-width containers must be justified

Avoid `width: 1200px` for normal content.

Prefer flexible max-width, minmax, grid/flex, percentages, container queries where appropriate.

Fixed widths are appropriate for specific controls/components, not entire normal pages.

---

## AP. min-width is a frequent reflow hazard

Be careful with tables, cards, toolbars, input groups.

A stray `min-width: 900px` can break the entire 320px reflow requirement. Audit min-width usage.

---

## AQ. Flex/Grid children need to be allowed to shrink

Common CSS issue: a grid/flex child refuses to shrink because of intrinsic minimum sizing.

Use patterns such as `min-width: 0` where semantically appropriate to allow content containers to reflow rather than overflow.

Cursor should check actual rendered behavior rather than assume flexbox makes everything responsive.

---

## AR. Long unbroken values must not blow out layouts

Potential offenders: email addresses, URLs, meeting links, IDs, webhook URLs, long customer names.

Allow appropriate wrapping, truncation with recovery, overflow handling.

Do not let one URL create horizontal page scrolling.

---

## AS. Code/technical strings may have a justified horizontal scroll region

Developer-oriented content such as webhook payload, API example, long code may appropriately scroll horizontally inside its own region.

Again: exception belongs to the specific content, not whole page.

---

## AT. Text spacing overrides must not break the UI

WCAG 1.4.12 requires content/functionality to survive specified user text-spacing adjustments.

Cursor must avoid layouts dependent on exact line-height/letter-spacing assumptions.

Do not clip text, overlap lines, or hide controls when text spacing is increased.

---

## AU. Do not use text embedded in images for UI labels

Besides accessibility concerns, image text does not reflow/resize properly.

Navigation, labels, status, buttons should be real text.

---

## AV. Icons should not shrink below recognition merely to fit

Responsive may reduce some decorative size but should not make meaningful icon controls microscopic.

If space is insufficient, reorganize.

---

## AW. Touch-target usability must survive responsive layouts

Even though Guide #4 covers interaction, responsive layouts must preserve target usability.

Do not let desktop 36px compact icon button become 22px tiny icon on mobile.

Usually the reverse is needed: mobile hit areas should be at least as usable.

---

## AX. Dense desktop tables may become more spacious touch layouts

Mobile need not preserve desktop density.

Touch interaction benefits from larger row targets, clearer separation, fewer simultaneous controls.

Same information, adapted interaction density.

---

## AY. Hover-only content must have a mobile equivalent

**Desktop:** hover appointment → quick controls

**Mobile:** tap appointment / overflow menu

Do not omit the action entirely.

---

## AZ. Responsive states need explicit design for empty/loading/error

Do not only design the normal desktop state.

For each major page verify at small widths: loading, empty, error, warning, many items, long labels, form errors, open drawer/modal.

Responsive design includes all system states.

---

## BA. Skeletons must reflow with final content

Desktop table skeleton should not remain a desktop-wide artifact when mobile layout transforms to cards.

Loading geometry should match the active responsive pattern.

---

## BB. Sticky elements must not consume the whole viewport at zoom

At high zoom, stacking global header, page header, tabs, filter bar, save bar can leave almost no usable content.

**Cursor rule:** Audit cumulative sticky height at narrow widths and high zoom.

---

## BC. Sticky headers must not cover focused content

When keyboard focus moves to an anchor/control, it must not be hidden beneath sticky UI.

Use appropriate scroll margins/offset handling.

---

## BD. Fixed bottom bars must not cover page content

Mobile save/action bars need content padding so final fields/actions are still reachable.

No hidden bottom rows behind sticky controls.

---

## BE. Safe areas must be respected on mobile devices

Where browser/device environments expose safe-area insets, avoid putting critical controls under notches, home indicator areas, rounded corners.

This is platform-responsive quality even though WCAG itself doesn’t prescribe specific safe-area CSS.

---

## BF. Do not assume hover or fine pointer at any width

Large-screen touch devices exist. Small-screen mouse-driven windows exist.

Use responsive layout and input-capability detection carefully.

**Viewport ≠ input method.**

---

## BG. Do not remove functionality simply because viewport is small

**Hard rule.** Mobile can reorganize advanced settings, complex editors, analytics — but authorized functionality remains reachable unless that function truly cannot meaningfully operate on that device and an equivalent method is provided.

“Desktop only” should be rare and justified.

---

## BH. Complex builders may use an adapted mobile read-only/limited mode only if essential functionality is otherwise available

For a workflow canvas, editing on a 320px viewport may be exceptionally difficult.

If editing is genuinely impractical: allow inspection, offer accessible alternative editing controls, or explicitly support a structured non-canvas editor.

Do not simply show **Use a desktop.** without evaluating whether an accessible alternative can satisfy the task.

---

## BI. Calendar grid exception does not eliminate responsive alternatives

Even though a calendar can qualify as two-dimensional essential content, Transovo should still provide agenda/list, date navigation, appointment detail where that improves usability.

WCAG exception is a minimum compliance boundary, not a design goal.

---

## BJ. Charts need responsive alternatives

At narrow width: simplify labels, stack legends, allow horizontal region where essential, provide data table/value summaries.

Never shrink chart text until unreadable.

---

## BK. Analytics KPI grids should reflow

**Desktop:** 4 KPI cards in one row

**Tablet:** 2 × 2

**Phone:** single-column or compact 2-column where legible

Do not preserve desktop columns at the expense of readability.

---

## BL. Page gutters should adapt

Desktop may use larger gutters. Mobile uses smaller but still comfortable gutters.

Example conceptual system: Wide 24–32 · Medium 20–24 · Narrow 16

Exact values belong to the visual design system.

The rule is: reduce margins before shrinking content itself.

---

## BM. Component density can adapt without changing semantics

**Desktop** may show customer | booking type | source | status | reminder | payment

**Mobile** may prioritize customer, time/type, status — with full detail one tap away.

This is acceptable because the same authoritative object remains available.

---

## BN. Content priority must be explicitly defined

For each dense component, define:

| Level | Content |
|-------|---------|
| **Must remain visible** | Critical identity/state |
| **Can collapse** | Secondary detail |
| **Can move to detail/overflow** | Rare actions/metadata |

Without priority rules, responsive implementations become arbitrary.

---

## BO. Source order should prioritize meaningful content

When layout transforms, users should encounter: object identity → primary state → important context → actions → secondary metadata.

Not whatever column happened to be first in desktop CSS.

---

## BP. Breakpoint transitions should not cause state loss

Test resizing live while: modal open, drawer open, filters active, form partially complete, tab selected, calendar date selected.

The app should not reset or crash because layout mode changed.

---

## BQ. Avoid duplicated desktop/mobile DOM when possible

Rendering desktop table + mobile cards and hiding one with CSS can cause duplicate accessibility content, duplicate focusable controls, state divergence.

Prefer shared semantic data/component structure when practical.

If duplicate representations are necessary, hidden variant must truly be removed from interaction/accessibility exposure.

---

## BR. Responsive behavior belongs at component level too

Do not solve responsiveness only at the page shell.

Each component needs rules for: button group, card, table, tabs, alert, form section, modal, drawer, timeline, chart, calendar control.

A responsive shell cannot fix rigid children.

---

## BS. Container-based behavior is often preferable for reusable components

A component may appear in full page, drawer, dashboard card. Its available width may differ even on same viewport.

Where supported/appropriate, design reusable components according to their container, not only global viewport breakpoints.

This is implementation guidance rather than WCAG requirement, but it prevents brittle responsive behavior.

---

## BT. Do not make text size depend excessively on viewport width

Avoid aggressive patterns that make typography tiny on small viewports or enormous on large displays.

Typography should primarily follow the design-system scale. Responsive type adjustments should be restrained.

---

## BU. Zoom is not the same as responsive simulation

A page that looks fine at 320px responsive viewport may still break at 1280px browser → 400% zoom.

WCAG explicitly relates the 320 CSS px reflow condition to 400% zoom on a 1280px starting viewport.

**Test both.**

---

## BV. Text-only enlargement must also be considered

WCAG Resize Text specifically concerns text resizing, not merely page scaling.

Fixed-height components can pass ordinary browser zoom but fail when font sizing/spacing changes independently.

Audit text containers.

---

## BW. At 200% text size, no essential text may be clipped behind ellipsis without recovery

If truncation exists: full value remains discoverable; critical instructions/errors should generally wrap instead.

Do not truncate form errors or primary object names without access to full value.

---

## BX. At 400% zoom, normal reading should remain one-directional where required

For ordinary pages, vertical scroll is expected.

Repeated horizontal → vertical → horizontal → vertical to read each line is the failure WCAG’s Reflow criterion is designed to avoid.

---

## BY. Horizontal scrolling components must support keyboard access

If a table/calendar/code region scrolls horizontally, keyboard users must be able to reach and operate its content.

Don’t create pointer-only horizontal scrolling.

---

## BZ. Scrollbars must not be intentionally hidden when they are the only indication of overflow

If a horizontally scrollable region exists, the user needs a discoverable way to know/use it.

Do not remove visible scroll affordances without providing equivalent cues/control.

---

## CA. Fixed overlays must not trap content at high zoom

Examples: chat widget, help button, cookie banner, persistent notification, save bar.

At high zoom they can occupy huge proportions of the viewport. Audit overlays under constrained space.

---

## CB. Banners should wrap and grow naturally

A warning such as **Microsoft sync is paused. Reconnect Microsoft to resume imported appointments.** must grow vertically.

Don’t force one-line banner layouts that clip at small widths.

---

## CC. Status badges should not force horizontal overflow

If status text becomes long: allow wrapping where appropriate, use concise canonical labels, reposition badges.

Do not reduce font size to unreadability.

---

## CD. Breadcrumbs need a responsive strategy

At small widths: truncate intermediate ancestors carefully, collapse with accessible overflow, keep current/nearest useful parent.

Do not allow a five-level breadcrumb to create page-wide horizontal scrolling.

---

## CE. Long page titles should wrap

**Example:** Initial consultation — New customer appointment may become two lines.

That’s preferable to clipping, shrinking to 11px, or pushing primary action offscreen.

---

## CF. Page actions may move below title

**Desktop:** Title + Primary action

**Mobile:** Title → Description → Primary action

Same hierarchy, different geometry.

---

## CG. Responsive content changes must not create unexpected context changes

Changing viewport size should not navigate user, reset wizard, close form unnecessarily, submit, or clear selection.

Responsive adaptation is presentation, not a product action.

---

## CH. Reduced viewport must not turn persistent instructions into hover-only info

When space becomes tight, do not move essential helper text into tooltips merely to save space.

Critical instructions remain available.

---

## CI. Mobile keyboard must not cover active field/action irrecoverably

Forms should scroll active controls into a visible position when software keyboard opens.

Avoid fixed layouts where input is hidden, Save cannot be reached, or modal cannot scroll.

---

## CJ. Virtual keyboard resizing must not corrupt viewport logic

On mobile browsers, opening keyboard changes effective viewport.

Do not close dialogs, reset drawer, or recalculate layout into unusable state. Test real field entry.

---

## CK. Date/time picker mobile behavior can use native platform controls where beneficial

Native mobile controls often provide accessibility, large touch targets, familiar interaction.

Use native controls where they satisfy product requirements.

Don’t replace them with a complex custom desktop picker merely for visual consistency.

---

## CL. Content must remain functional in narrow embedded contexts when intentionally supported

Public booking pages may be embedded inline.

Therefore test not just full browser width but embedded container.

If an inline booking widget is supported, it needs container-aware reflow.

---

## CM. Embeds must not assume parent-page width

Booking embed should work inside narrow website column, full-width page, modal-like container.

If minimum supported embed width exists, document and enforce it appropriately.

---

## CN. Public booking flow should prioritize single-column responsiveness

Customer-facing booking has a different context from admin SaaS.

On narrow devices: one clear decision at a time, large time-slot targets, clear progress, minimal admin-style density.

Same WCAG standards; different responsive optimization.

---

## CO. Email/SMS previews must not force layout overflow

Message preview should wrap/contain content.

Long links or template tokens should not blow out the editor.

---

## CP. Meeting transcript/recap content needs readable line width even on wide screens

Responsive does not only mean small-screen.

On 4K desktop, paragraphs should not stretch across the whole viewport.

Use task-appropriate max widths for text-heavy content.

---

## CQ. Ultra-wide monitors should not stretch forms indefinitely

Business settings form should not become 2200px-wide input.

Use meaningful maximum widths. Tables/calendars can use more width. Forms/prose should remain readable.

---

## CR. Width strategy must follow content type

| Width | Content |
|-------|---------|
| **Full-width** | calendar, workflow canvas, wide table, analytics grid |
| **Medium** | appointment detail, contact detail, booking editor |
| **Narrow/controlled** | settings form, onboarding, text-heavy content |

Responsive design is not one universal container.

---

## CS. Every component must declare overflow behavior

For text, row, table, chart, modal, drawer, tablist — define whether it wraps, truncates, scrolls, collapses, or reflows.

Do not leave overflow to accidental browser behavior.

---

## CT. Avoid overflow: hidden as a general layout fix

It often hides focus rings, enlarged text, dropdowns, errors.

Use it only when clipping is intentional and no essential content becomes inaccessible.

---

## CU. Focus rings must not be clipped by responsive containers

If a control sits at edge of scroll/card region, visible focus must still render sufficiently.

Don’t let overflow rules cut it off.

---

## CV. Testing must include real zoom levels

At minimum QA: 100%, 200%, 400% where relevant to reflow testing.

And text enlargement where test environment supports it.

Do not rely only on device emulation.

---

## CW. Testing must include representative viewport widths

At minimum conceptual coverage: narrow phone, larger phone, tablet/narrow laptop, standard desktop, wide desktop.

Exact breakpoint values belong to implementation/design system.

---

## CX. Test both portrait and landscape

Especially: booking flow, calendar, forms, drawers, modals.

WCAG orientation requirement makes this mandatory unless orientation is genuinely essential.

---

## CY. Test realistic worst-case content

Responsive QA must include: long contact name, long booking type, long email, multiple status badges, long error, long helper text, timezone, translated-length-like strings, many table columns, no data, large data.

Mockup-perfect short labels are insufficient.

---

## CZ. Test dynamic states at narrow widths

For example: Microsoft error banner, SMS eligibility warning, payment failure, workflow validation issues, loading states, modal open, keyboard open, filter sheet open.

Responsive bugs often appear only in exceptional states.

---

## DA. No horizontal page scrolling acceptance rule

For standard pages at required reflow sizes, `document.documentElement.scrollWidth` should not exceed viewport width due to normal content, except intentional isolated essential regions.

This can be automated as a lightweight check where feasible.

---

## DB. No clipped-text acceptance rule

At 200% text resize, critical headings, labels, button text, errors, status, form values must remain fully perceivable or have an appropriate accessible recovery path.

---

## DC. Responsive state must use the same underlying business state

Do not maintain desktop filter state and separately mobile filter state.

One source of truth. Different presentation. Same application data.

---

## DD. Responsive layouts must not duplicate actions with inconsistent runtime behavior

If mobile has a different Save button component than desktop, both must invoke the same canonical action and validation.

Do not fork business behavior per breakpoint.

---

## DE. Server-rendered/hydrated state must not flash the wrong layout materially

Where possible, avoid desktop sidebar briefly appears on phone → disappears in a disruptive way.

Hydration/layout should minimize visible instability.

This is performance/UX best practice rather than a direct WCAG criterion, but materially affects perceived quality.

---

## DF. Responsive transitions should avoid layout shift during ordinary use

When loading appointments, filters, navigation — reserve expected geometry where feasible.

No sudden jumps that move controls under pointer/focus.

---

## DG. Component breakpoints must be documented

For reusable components, document:

```
Table — wide: table; narrow: condensed table/card
Drawer — wide: side panel; narrow: full-screen
Filters — wide: inline; narrow: filter sheet
```

Cursor must not invent the responsive behavior differently on each page.

---

## DH. Responsive behavior belongs in the design system

Any shared component should ship with its responsive rules.

Do not build Button desktop then later special mobile button unless they are genuinely different components.

One system.

---

## DI. Accessibility exceptions must be documented, not assumed

If a region depends on two-dimensional layout under WCAG’s Reflow exception, Cursor should document:

- why 2D layout is essential
- which region gets the exception
- what alternative navigation/view exists if any

**Examples:** calendar, workflow canvas

Do not casually claim **It’s a dashboard, so horizontal scroll is okay.**

---

## DJ. Responsive design should exceed the minimum where practical

WCAG defines minimum conformance.

Premium Transovo behavior should aim higher: good mobile agenda instead of barely scrollable calendar, clean card transformation rather than giant table scroll, contextual full-screen detail rather than cramped drawer.

Compliance is the floor. Usability remains the goal.

---

## Transovo Responsive / Reflow / Zoom Acceptance Checklist

Every applicable page/component should pass:

- [ ] Works in portrait and landscape unless orientation is truly essential
- [ ] Browser zoom is not disabled
- [ ] Text can resize to 200% without loss of content/functionality
- [ ] Normal vertically scrolling content reflows at 320 CSS px equivalent width
- [ ] No page-wide horizontal scrolling for ordinary content
- [ ] Essential two-dimensional regions are isolated and justified
- [ ] Meaningful reading/DOM order survives responsive reflow
- [ ] Global navigation remains fully reachable
- [ ] Mobile uses same conceptual IA and canonical labels
- [ ] Primary page action remains prominent
- [ ] Secondary actions collapse before primary actions
- [ ] No essential function disappears on narrow viewports
- [ ] Text is not shrunk below design-system minimum merely to fit
- [ ] Fixed heights do not clip enlarged text
- [ ] Form controls expand appropriately with text
- [ ] Forms collapse columns before they become cramped
- [ ] Related fields remain grouped after stacking
- [ ] Tables have a documented narrow-screen strategy
- [ ] Horizontal table/calendar scrolling is isolated to the component
- [ ] Mobile row/card transformations preserve field relationships
- [ ] Calendar has a usable narrow-screen presentation
- [ ] Calendar actions remain available without hover/drag
- [ ] Drawers transform appropriately on small screens
- [ ] Modals fit and remain operable at narrow widths/high zoom
- [ ] Tabs have a documented narrow-screen behavior
- [ ] Filters collapse predictably while preserving active-filter state
- [ ] Search remains usable
- [ ] Long labels/URLs/names cannot break page width
- [ ] Important text wraps rather than clips
- [ ] Truncated information has a recovery path
- [ ] Sticky elements do not consume or cover the usable viewport
- [ ] Fixed bottom bars do not cover content
- [ ] Focused content is not hidden beneath sticky UI
- [ ] Touch target usability is preserved
- [ ] Hover-only behavior has touch/keyboard equivalent
- [ ] Breakpoint changes do not reset task state
- [ ] Orientation changes do not reset task state
- [ ] Mobile keyboard does not make active controls unreachable
- [ ] Public booking embeds reflow within supported containers
- [ ] Wide screens do not produce unreadably long prose/form lines
- [ ] Component overflow behavior is explicitly defined
- [ ] Focus indicators are not clipped
- [ ] 100%, 200%, and relevant 400% zoom tested
- [ ] Narrow phone/tablet/desktop widths tested
- [ ] Portrait and landscape tested
- [ ] Long/realistic content tested
- [ ] Loading/error/empty states tested responsively
- [ ] Desktop/mobile variants use one authoritative business state
- [ ] Responsive behavior is documented in reusable components

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  (coming)                                        → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom (this file)
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md     → Tables & grids
Guide #4 (coming)                                        → Interaction, keyboard & focus
Guide #8+ (coming)                                       → Privacy, consent & compliance UX, etc.
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #6: Responsive, Reflow & Zoom Standards. Next: Guide #7 — `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md` · Guide #8 — Privacy, Consent & Compliance UX Standards.*
