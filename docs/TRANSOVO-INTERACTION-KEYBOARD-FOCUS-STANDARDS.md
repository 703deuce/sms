# Transovo Interaction, Keyboard & Focus Standards Guide

**Series:** Implementation standards · **Guide #4 of 12**  
**Status:** Active — mandatory hard standard for how Transovo behaves when users interact with it — especially with keyboards, focus, dialogs, tabs, menus, dropdowns, composite controls, builders, calendars, and temporary UI  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** W3C WCAG 2.2 · WAI-ARIA · WAI-ARIA Authoring Practices Guide (APG)

---

## Master Cursor rule

> **Transovo interaction behavior must follow WCAG 2.2 keyboard/focus requirements and established WAI-ARIA Authoring Practices for custom widgets. Use native HTML controls whenever possible. Every essential function must be keyboard operable without requiring hover, dragging, pointer precision, or memorized shortcuts. Tab moves between components; established component-specific keys move within composite widgets. Keyboard focus must always be visible, meaningful, persistent, and restored logically after temporary UI closes or focused elements are removed. Modals, menus, tabs, comboboxes, accordions, grids, calendars, and other complex controls must implement their complete established interaction contract—not merely visual appearance or ARIA attributes. Interactions must preserve user context and work, prevent duplicate/destructive errors, communicate loading/saving/system state, and provide predictable recovery when operations fail.**

**This guide controls how Transovo behaves when users interact with it — especially with keyboards, focus, dialogs, tabs, menus, dropdowns, composite controls, builders, calendars, and temporary UI.**

---

## Important distinction

**WCAG is the conformance standard. APG is implementation guidance for common accessible interaction patterns.**

Cursor should follow native HTML first and use APG patterns when implementing custom widgets. W3C explicitly notes that when authors create custom ARIA GUI widgets, the browser does not automatically provide the expected keyboard behavior; the developer must implement it.

**Primary authorities**

| Authority | Role |
|-----------|------|
| **W3C WCAG 2.2** | Normative accessibility requirements for keyboard operability, focus order, focus visibility, dragging alternatives, target size, context changes, etc. |
| **WAI-ARIA** | Specification for roles, states, and properties when native HTML semantics are insufficient |
| **WAI-ARIA Authoring Practices Guide (APG)** | Official implementation guidance and keyboard interaction patterns for dialogs, tabs, menus, comboboxes, grids, accordions, trees, and toolbars |

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## A. Every interactive function must be keyboard operable

Any function available through mouse or touch must also be usable from the keyboard unless its nature inherently requires a path-dependent pointer gesture.

That includes navigation, appointment creation, date selection, calendar navigation, rescheduling, menu actions, workflow editing, opening drawers, editing settings, sending messages, choosing contacts, selecting calendars, payment actions, and Notetaker controls.

**Cursor rule:** No essential Transovo action may require a mouse, hover, drag gesture, or touchscreen.

---

## B. Use native controls before building custom controls

Prefer `<button>`, `<input>`, `<select>`, `<textarea>`, and `<a>` over recreating those controls with generic elements and ARIA.

**Cursor rule:** If native HTML provides the required behavior and semantics, use it. Build custom ARIA widgets only when native controls cannot provide the required experience.

---

## C. Tab moves between components

The primary keyboard convention is: **Tab** and **Shift + Tab** move focus between UI components.

Inside composite controls such as tablists, menus, radio groups, grids, trees, and toolbars, other keys — usually arrow keys — move focus within the component.

This distinction should be enforced consistently throughout Transovo.

---

## D. Do not put every item inside a composite widget into the Tab sequence

**Bad example:** A tab bar with six tabs requires six Tab presses.

**Expected pattern:** Tab → enters tablist → Left/Right Arrow → moves among tabs → Tab → leaves tablist.

Likewise with radio groups, menus, listboxes, toolbars, and interactive grids.

**Cursor rule:** Composite widgets must use the established managed-focus interaction model rather than turning every internal option into a separate Tab stop.

---

## E. Focus must always exist somewhere meaningful

**Wrong:** User deletes an appointment from a list → appointment disappears → focus disappears.

**Correct:** appointment disappears → focus moves logically to the next appointment or another meaningful control.

User closes a modal → focus returns to the control that opened the modal, unless the workflow logically requires another destination.

**Cursor rule:** Never allow DOM changes to leave keyboard focus lost on the document body or another meaningless destination.

---

## F. Focus must always be visually discernible

Keyboard users must always be able to answer: **Where am I?**

Cursor must never use `outline: none;` without providing an equally visible replacement.

Focus indicators must be distinguishable from selected state, hover state, active state, and checked state.

---

## G. Focus and selection are different concepts

This matters heavily in tabs, calendars, tables, multi-select, workflow nodes, and listboxes.

A tab can remain **selected** while focus moves elsewhere.

- **Selected** means: this is the active/current item.
- **Focus** means: this is where the next keyboard interaction applies.

**Cursor rule:** Never use the same visual treatment for keyboard focus and persistent selection.

---

## H. Do not automatically activate everything merely because it receives focus

Selection following focus can be appropriate when switching is immediate, harmless, and locally rendered — e.g., tabs whose panels change instantly.

It can be harmful when focus changes cause network requests, expensive loading, navigation, destructive changes, or significant side effects. In those cases: Arrow keys → move focus; Enter / Space → activate selection.

**Cursor rule:** Focus movement must not trigger costly, destructive, or disruptive actions unless the interaction pattern explicitly warrants automatic activation.

---

## I. Never use positive tabindex to manually reorder a page

Avoid `tabindex="1"`, `tabindex="2"`, `tabindex="3"`.

**Cursor rule:** DOM order must represent meaningful interaction order. Fix DOM structure rather than patching bad structure with positive tabindex values.

---

## J. Use tabindex="0" and -1 intentionally

For custom composite widgets:

- `tabindex="0"` → participates in normal Tab order
- `tabindex="-1"` → can receive programmatic focus but is not directly tabbed to

For roving tabindex: one internal item receives `0`, others receive `-1`, and arrow navigation updates which item is focusable.

Use this only when the chosen APG pattern calls for managed focus.

---

## K. Do not invent keyboard bindings when established ones already exist

Users expect common conventions: Enter activates, Space activates buttons/toggles, arrows navigate within composites, Escape dismisses temporary UI, Tab moves forward, Shift + Tab moves backward, Ctrl/Cmd + Z generally means undo.

**Cursor rule:** Use APG/native platform conventions instead of inventing proprietary keyboard behavior.

---

## L. Keyboard shortcuts are accelerators, not accessibility patches

Do not create a bad keyboard interface and compensate with shortcuts.

Potential Transovo accelerators: `/` → focus search, Cmd/Ctrl + S → save in an editor, perhaps N → New appointment where safe and documented.

But the entire application must remain usable without memorizing any shortcut.

---

## M. Keyboard shortcuts must avoid conflicts

Do not hijack browser shortcuts, operating-system shortcuts, or assistive-technology shortcuts.

Shortcuts should be discoverable when materially useful. Do not build a secret keyboard language.

---

## N. Buttons activate actions

Use buttons for actions such as Save, Cancel appointment, Open menu, Send reminder, Reconnect Microsoft.

Use links for navigation such as Open contact, Go to appointment, View transaction.

**Cursor rule:** Button means action. Link means navigation. Do not swap semantics merely because the visual styling is similar.

---

## O. Toggle buttons must expose persistent pressed state

If a button represents an on/off state rather than a one-time action, expose the appropriate state, such as `aria-pressed` for a true toggle button.

For ordinary configuration, checkbox or switch may be more appropriate.

**Cursor rule:** Match the control semantics to whether the user is performing an action or changing persistent state.

---

## P. Modals must behave as true modal dialogs

When a modal opens: focus moves inside, outside content becomes inert, Tab stays within the dialog, Shift + Tab stays within the dialog, Escape closes where appropriate, dialog has an accessible name, and visible close/cancel mechanism exists.

**Cursor rule:** A visually modal panel must also behave modally for keyboard and assistive-technology users.

---

## Q. Initial modal focus must be intentional

Do not blindly focus the first element in DOM.

- **Add contact:** focus First name
- **Confirmation:** focus might appropriately begin on the safe action Keep appointment
- **Long informational dialog:** focus may begin on the heading/content container

**Cursor rule:** Initial focus placement must support the specific dialog task.

---

## R. Closing a modal usually restores focus to its trigger

Example: Appointment → Cancel → dialog → close. Focus returns to Cancel unless the triggering object disappeared or another destination is more logical.

---

## S. Dialog backgrounds must truly be inert

While the modal is open, users must not be able to Tab into the page behind it, click background controls unintentionally, operate underlying fields, or interact with hidden content through assistive technology.

Visual dimming alone is insufficient.

---

## T. Do not use modals for enormous workflows

Use modal for confirmation, small form, focused selection.

Use full page/drawer/workspace for Booking Type editor, Workflow Builder, complex appointment editing, A2P registration, and long configuration flows.

A modal is temporary contained interaction.

---

## U. Menu buttons must follow menu-button behavior

For an actions menu such as ••• More actions, expected behavior includes Enter opens, Space opens, appropriate arrow behavior, focus enters menu appropriately, expanded state exposed, and Escape closes.

**Cursor rule:** Dropdown action menus must be implemented as real accessible menu interactions when menu semantics are chosen.

---

## V. Menus are for commands/actions, not arbitrary navigation styling

Appropriate menu — Appointment: Reschedule, Duplicate, Cancel.

A normal list of navigation links does not automatically need `role="menu"`.

**Cursor rule:** Use menu semantics only when the behavior actually matches a menu.

---

## W. Escape should dismiss temporary UI where convention expects it

Examples: menu, popover, modal, combobox popup, date picker, temporary preview.

But Escape should not silently delete, publish, save, or discard large amounts of unsaved work.

---

## X. Tabs must follow the tab pattern

A real tab system needs tablist, tabs, selected tab, tabpanel, keyboard navigation, and correct selection/focus semantics.

For horizontal tabs: Left / Right → move tab focus; Home → first tab; End → last tab.

Activation can be automatic or manual depending on latency and side effects.

---

## Y. Do not use tabs for simple navigation when links are better

If clicking a label changes route, opens an unrelated page, or represents an independent destination, normal links/navigation may be the correct semantic model.

Do not make something an ARIA tab merely because the design shows horizontal labels.

---

## Z. Accordions must behave as disclosures

Accordion headers need button semantics, keyboard activation, and programmatic expanded/collapsed state.

Potential Transovo uses: advanced reminder timing, Booking Type advanced options, diagnostic sections.

**Cursor rule:** An accordion is a disclosure pattern, not merely a visual card with a chevron.

---

## AA. Do not hide essential information exclusively in accordions

Progressive disclosure should reduce clutter. It should not force users to repeatedly expand sections just to understand basic operational state.

---

## AB. Comboboxes must use a real combobox interaction pattern

Important Transovo examples: contact picker, staff picker, timezone search, calendar picker, booking-type picker.

A combobox must correctly expose expanded/collapsed state, current value, popup relationship, active option, selection, and keyboard navigation.

Do not build `input + floating <div>` without the complete accessibility behavior.

---

## AC. Editable and select-only comboboxes are different

Use editable search when there are many options (e.g., search thousands of contacts). Use simpler selection controls where the option set is small. Don't make every select searchable.

---

## AD. Arrow keys inside comboboxes must not break text editing

If the user is editing text: normal Left/Right cursor behavior remains available, Up/Down can navigate options according to the pattern, Escape dismisses the popup, Enter commits selection when appropriate.

Do not hijack basic text-editing behavior unnecessarily.

---

## AE. Dropdown focus must not disappear when options update

Remote search results can rerender. Preserve text-input focus, active-option state where appropriate, and logical keyboard navigation.

Do not make the user restart the control every time new results arrive.

---

## AF. Listboxes are selection widgets, not generic lists

Use listbox semantics when users are selecting from choices. Do not use listbox for ordinary appointment lists, feeds, navigation, or static data. Semantics follow behavior.

---

## AG. Radio groups should use arrow navigation

For one choice among mutually exclusive options (Scheduling method: One host / Round robin / Collective), native radio controls already provide established behavior. Prefer native radio groups before custom cards.

---

## AH. Switches represent immediate binary state

Good uses: Auto-join meetings, Allow customer cancellation. Not appointment status with five values. The control type must match the data model.

---

## AI. Checkbox vs switch behavior should remain consistent

Checkbox: inclusion, independent selection, form choice. Switch: immediate on/off system state. Do not alternate them based purely on visual preference.

---

## AJ. Interactive grids require complete keyboard implementation

A true ARIA grid behaves more like an application/spreadsheet. Potential cases: complex scheduling matrix, advanced editable table.

Ordinary Appointment List: semantic table/list — not grid.

**Cursor rule:** Use `role="grid"` only when the widget actually implements complete grid behavior.

---

## AK. Do not add role="grid" because rows are clickable

ARIA grid carries substantial keyboard expectations. If the interface does not implement directional cell navigation, predictable focus, and complete interaction semantics, then it is not a grid.

---

## AL. Calendar widgets require deliberate keyboard design

Transovo Calendar must define keyboard access to dates, days/weeks, appointments, create appointment, open detail, move through calendar, and leave the calendar.

Do not place hundreds of cells into Tab order. Use appropriate managed navigation.

---

## AM. Dragging cannot be the only way to reschedule

Desktop can allow drag 2 PM → 4 PM. But also provide Reschedule → select new date/time.

**Cursor rule:** Dragging is an accelerator, never the only essential operation.

---

## AN. Resizing cannot be the only way to change duration

If pointer users can drag an appointment edge, keyboard/touch users also need Edit appointment → Duration.

---

## AO. Hover interactions require focus/touch equivalents

If row actions appear on hover, they must also appear through keyboard focus, action menu, or touch. Hover cannot gate functionality.

---

## AP. Tooltips must work from focus, not only hover

Tooltip content must be accessible to keyboard users. Also: critical instructions should not live only in tooltips.

---

## AQ. Tooltips should not contain complex interactive content

Tooltip: short supplementary explanation. Popover/dialog: links, buttons, interactive controls. Choose the correct interaction model.

---

## AR. Popovers must define focus behavior

For every popover decide: **Noninteractive** — focus remains on trigger. **Interactive** — focus is intentionally managed.

Do not allow accidental keyboard traps or lost focus.

---

## AS. Drawers need an explicit interaction model

A drawer may be a **modal drawer** (background inert and focus contained) or a **nonmodal detail panel** (background remains usable). Choose deliberately.

Do not make it visually modal and functionally nonmodal.

---

## AT. Appointment quick-view drawer should preserve context

Example: Calendar → appointment → quick-view drawer. Keep selected date, filters, and calendar position. Then provide Open full appointment for deeper editing.

---

## AU. Closing temporary UI should return focus predictably

Examples: menu → trigger, modal → invoker/logical next object, drawer → appointment row/card, tooltip → focus remains on trigger.

Never jump randomly to page top.

---

## AV. If the triggering element disappears, choose the logical successor

If an appointment row is deleted, focus goes to: (1) next row, (2) previous row if no next, (3) list heading or primary action if list becomes empty. Never lose focus.

---

## AW. Destructive actions require deliberate interaction design

Use safeguards proportional to consequence. Cancellation may affect customer, reminders, calendar, and payment — so confirmation may be warranted.

Deleting a harmless draft might use Undo. Don't over-confirm everything.

---

## AX. Prefer Undo where reversible

Example: "Removed from waitlist. Undo" can be better than "Are you sure?" for low-risk reversible changes.

Use confirmation for irreversible, broad-impact, financially consequential, or difficult-to-recover actions.

---

## AY. Save behavior must be consistent

Choose intentionally between **Explicit Save** (user edits several fields and chooses Save changes) and **Immediate save** (toggle changes instantly).

Do not make identical controls behave differently without explanation.

---

## AZ. Auto-save must communicate state

Show Saving…, Saved, Couldn't save. Do not make users infer persistence.

---

## BA. Explicit Save must protect unsaved work

If leaving with unsaved changes: Discard changes / Keep editing. Don't silently lose work.

---

## BB. Loading controls should remain spatially stable

Button "Save changes" becomes "Saving…" inside roughly the same footprint. Do not replace it with a tiny spinner that shifts neighboring controls.

---

## BC. Disable repeated submission during active processing

Especially create appointment, payment, send message, publish workflow, connect integration. Once activated "Creating…", prevent duplicate execution.

---

## BD. Disabled state must not become a dead end

If Send SMS is unavailable, explain why — e.g., "Business texting registration is required for imported appointments." Do not force users to guess.

---

## BE. Disabled controls may remain discoverable when useful

Sometimes a disabled option should stay focusable/discoverable because users need to learn why it isn't available. In other cases, ordinary disabled behavior is appropriate. Choose based on task and discoverability.

---

## BF. Selection changes should not unexpectedly commit destructive actions

Selecting "Cancel reason" must not immediately cancel the appointment. Input selection and final commitment should remain distinct for consequential operations.

---

## BG. Changing focus must never trigger destructive actions

Keyboard focus movement must not save, send, delete, purchase, or cancel. Activation is separate.

---

## BH. Filtering should preserve focus predictably

If user selects Status = Unconfirmed and results rerender, focus should remain on the filter control unless there is a deliberate reason to move it.

---

## BI. Search results must not steal focus while typing

As contact-search results load: focus remains in search box; keyboard navigation into results happens intentionally. Do not auto-focus the first result after every request.

---

## BJ. Pagination should manage focus intentionally

After Next page, focus should land somewhere meaningful within the refreshed results context — not in a removed element or at body.

---

## BK. Infinite scrolling requires a stable focus model

If used: loaded content must not shift keyboard location unpredictably, footer/other controls remain reachable, loading state is exposed.

For operational SaaS, pagination or Load more may often be easier to make predictable.

---

## BL. Row click behavior must be predictable

If an appointment row opens detail: keyboard users need equivalent operation, nested buttons work independently, row click doesn't swallow action-menu events. Avoid ambiguous click targets.

---

## BM. Double-click must never be required

No essential feature depends on double click. It may be an optional accelerator in specialized desktop-like interactions.

---

## BN. Right-click cannot be the sole action path

Context menus are optional accelerators. Every important command must also be available through standard visible UI.

---

## BO. Pointer targets need adequate separation

Avoid cramped controls like Edit Delete Resend with tiny hit areas, particularly on mobile. Interaction design must reduce accidental activation.

---

## BP. Primary and destructive actions must remain distinct

Do not make Delete and Save equally prominent adjacent controls. Placement and hierarchy should reflect consequence.

---

## BQ. Forms should support Enter intentionally

Login: Enter submits. Search: Enter searches. Large text editor: Enter inserts newline. Workflow Builder: Enter should not accidentally publish.

Never globally bind Enter to Save.

---

## BR. Escape must not silently destroy unsaved work

Escape may close temporary UI. If closing would discard substantial work: preserve draft, warn appropriately, define cancellation behavior. No silent loss.

---

## BS. Background status updates must not steal focus

Events such as reminder delivered, Microsoft sync finished, payment update, or transcript finished may announce status. They should not move keyboard focus away from the user's current task.

---

## BT. Live updates should not reorder active content unexpectedly

If appointment list changes due to background sync, do not suddenly move the currently focused row. Possible strategy: "New updates available" — then reorder when appropriate.

---

## BU. Selected rows should survive harmless updates

If user selected five appointments and one row refreshes, selection should remain unless validity genuinely changes.

---

## BV. Bulk actions require a clear selection model

When selecting multiple objects: selected count visible, bulk actions grouped, deselect-all available, selection scope predictable. Do not scatter bulk actions across the interface.

---

## BW. Drag-and-drop requires feedback and alternatives

For Workflow Builder/reordering, users need clear dragged object, valid targets, invalid targets, completion feedback — and keyboard-accessible alternative.

---

## BX. Workflow Builder needs an explicit keyboard model

Define operations for navigate node, select node, edit node, add, delete, connect, move, undo/redo, zoom, and exit canvas. Do not rely only on free-form mouse manipulation.

---

## BY. Canvas panning/zooming must not trap users

Provide controls: Zoom in, Zoom out, Fit view, Reset. Pinch/mouse wheel may supplement these. They cannot be the only mechanisms.

---

## BZ. Calendar drag results must clearly report the final state

After moving: "Appointment moved to Tuesday, Sep 8 at 3:00 PM." If save fails: "Couldn't move appointment. It remains at 2:00 PM." Never silently roll back.

---

## CA. Optimistic updates need rollback behavior

If UI updates before server confirmation: represent pending appropriately, rollback on failure, explain what happened. Frontend and backend must never silently diverge.

---

## CB. Long-running actions need truthful progress/state

Examples: calendar import, transcript generation, AI follow-up, business registration. Show "Processing…". If actual percentage is unknown, don't fake "73%".

---

## CC. Cancellation should exist for long-running operations where feasible

Possible: AI generation, export, upload. If operation cannot truly cancel, don't show fake Cancel.

---

## CD. Don't block the whole app for local work

If one appointment is updating, use local loading. Don't cover entire Transovo interface with a full-screen spinner unnecessarily.

---

## CE. Toasts cannot carry required decisions

Toast is appropriate for "Appointment created." Not: "Your connection failed. Click here within 3 seconds to prevent data loss." Important action/state must persist elsewhere.

---

## CF. Success toasts must not steal focus

Feedback is not a navigation destination. Keep focus in the logical workflow.

---

## CG. Errors need recovery actions where possible

Examples: Microsoft connection expired → Reconnect; Payment failed → Retry; Workflow invalid → Review 2 issues. Do not terminate the user's path at "Error." 

---

## CH. Errors should not reset whole workflows

If Step 4 fails, preserve Step 1, Step 2, Step 3, and user's current data. Don't make users start over.

---

## CI. Wizards need predictable Previous/Next behavior

For real multi-step flows: Next moves forward, Back moves backward, state persists, current step clear, final commitment clearly different from intermediate navigation.

---

## CJ. Browser Back must not destroy wizard state unpredictably

Decide browser-history behavior. Do not allow Back to accidentally submit, clear all progress, or create corrupt intermediate state.

---

## CK. Selection state should persist where expected

Example: Calendar filter Sarah → open appointment → close detail → Sarah remains selected. The interface should not repeatedly erase the user's working context.

---

## CL. Draft and published states must be unmistakable

For Workflow: Draft versus Published. If changes aren't live until publication, show that clearly. User must never wonder: Is this already active?

---

## CM. Test and Live must be unmistakable

Especially workflows, AI booking, payments, messaging, and calendar operations. If a test mode exists, show persistent context. Don't rely on a tiny badge.

---

## CN. Read-only state must be obvious

If user lacks permission, do not make everything appear editable and then fail after interaction. Prefer read-only rendering, clear lock/permission explanation, and hide inappropriate dangerous actions.

---

## CO. Permission failures should preserve context

If "You don't have permission to edit this workflow," keep the user on the workflow where possible. Don't redirect them randomly to Home.

---

## CP. External authorization flows need state continuity

Example: Transovo → Microsoft OAuth → return. Restore Integrations → Calendars, relevant setup state, and user context. Do not dump user on Home.

---

## CQ. External auth cancellation must be recoverable

If user cancels Microsoft authorization: "Microsoft wasn't connected. Retry" — not "OAuth error." 

---

## CR. New tabs/windows must be intentional

Normal in-app navigation stays in-app. Potential justified cases: public booking preview, external provider portal. Where appropriate, communicate the destination.

---

## CS. Browser history should remain meaningful

Do not add history entries for every tooltip, every dropdown, every ephemeral popover. Browser Back should represent meaningful navigation.

---

## CT. Deep-linked objects must work independently

Opening `/appointments/:id` directly should load the object, expose valid actions, handle missing permissions, and not depend on hidden list-page state.

---

## CU. Custom keyboard interfaces require real QA

Critical components: calendar, date picker, combobox, modal, drawer, tabs, menu, workflow builder, multi-select tables, AI Booking. APG implementation still needs actual testing.

---

## CV. Keyboard testing must use complete tasks

Don't test only "Can I Tab to Save?" Test: Create an appointment with keyboard only.

Full task: Find New appointment → Choose contact → Choose Booking Type → Select date → Select time → Save → Verify.

---

## CW. Mixed pointer/keyboard use must remain coherent

Example: User clicks third tab, then presses Right Arrow. Keyboard navigation should continue from third tab. It must not jump to tab one because roving tabindex wasn't updated.

---

## CX. Touch should preserve the same conceptual interaction

Desktop: appointment drawer. Mobile: full-screen sheet. Concept remains: inspect appointment → return to calendar.

Responsive presentation can differ. Interaction model remains understandable.

---

## CY. Do not require precision gestures

No important feature may require tiny drag handles, exact swipes, multi-touch gestures, or precise hover. Provide explicit controls.

---

## CZ. Interaction feedback must be immediate

When user activates checkbox, tab, menu, filter, Save, or appointment, the UI should acknowledge immediately. Backend can continue processing afterward.

---

## DA. Don't claim success before success is known

If server hasn't confirmed, don't display "Saved" unless using a deliberate optimistic model with rollback. Truthful state is mandatory.

---

## DB. Prevent duplicate navigation/action race conditions

Examples: Double-click Create Appointment still one appointment. Repeated payment activation no duplicate charge. Rapid state changes no conflicting saves.

Interaction handlers and backend idempotency should cooperate.

---

## DC. Debounce search, not arbitrary actions

Reasonable: debounce contact search. Not reasonable: save button randomly waits 600 ms before doing anything. Different interactions require different techniques.

---

## DD. Essential actions cannot be gesture-only shortcuts

Swipe to delete can exist. Still provide More → Delete.

---

## DE. Menus should close predictably

Typically: choose action → close, Escape → close, outside interaction may close, navigation closes. No orphaned menus.

---

## DF. Avoid deep nested menus

Poor: More → Appointment → Communication → SMS → Advanced. If actions need that much depth, they likely belong on a dedicated detail/configuration page.

---

## DG. Context menus should remain object-local

Appointment menu: Reschedule, Duplicate, Cancel. Not Analytics, Settings, Integrations. Local actions remain local.

---

## DH. Interaction state must have one source of truth

If URL says List, tab says Calendar, and content shows Waitlist, the UI is broken. Route, selected state, and rendered state must remain synchronized.

---

## DI. Focus state should survive re-renders where possible

React/component updates should not recreate the active control unnecessarily. Use stable keys and DOM identity. Focus loss from rerender is a real implementation defect.

---

## DJ. Live validation must not fight the user

Do not show "Invalid email" after they type "a" while still entering it. Validate at sensible times: blur, submit, or after enough input depending on the field.

---

## DK. Correcting errors should clear obsolete error state

When value becomes valid, remove invalid/error treatment appropriately. Don't leave stale red state until an unrelated full-form submit.

---

## DL. Date/time interaction should respect user format

If user uses 12-hour time "2:00 PM", don't suddenly transform input into "14:00" unless their locale/settings call for it.

---

## DM. Timezone changes with meaningful consequences require explanation

If changing timezone alters the actual appointment instant, explain before applying. Don't silently reinterpret time.

---

## DN. Recurring appointment edits need explicit scope

Where supported: This appointment only / This and following / Entire series. No silent series-wide mutation.

---

## DO. Group booking actions need explicit scope

Cancel one attendee does not silently cancel everyone. Cancel group appointment clearly states everyone is affected.

---

## DP. Multi-host appointments need host-impact clarity

If a host changes, show whether appointment remains valid, replacement needed, or availability conflict exists. No hidden mutations.

---

## DQ. Reminder overrides must show inheritance during interaction

Example: Reminder sequence Standard / Using calendar default → Override for this appointment → Reset Use calendar default.

The user should see exactly what level they are editing.

---

## DR. SMS eligibility must be enforced before attempted use

If appointment cannot use SMS, do not let user configure/send normally and discover failure afterward. Show blocked state, reason, and remediation at the interaction point.

---

## DS. AI suggestions and execution must remain distinct

AI: "Tuesday at 2 PM is available." That's a proposal. Actual: "Appointment created." That's system execution.

Do not visually blur generated suggestions and authoritative state.

---

## DT. AI-generated content should remain editable where appropriate

Examples: follow-up email, meeting recap, customer message draft. Make clear whether it is Draft or Sent/published.

---

## DU. AI interactions need complete states

At minimum: generating, completed, failed, retry, cancel where feasible. No endless spinner with no recovery.

---

## DV. Human handoff must retain context

AI Booking failure → human should see conversation, contact, requested time, fields already gathered, availability checks, and failure reason. Do not restart the customer's journey.

---

## DW. Workflow publishing must validate before activation

Check required fields, connections, timing, and action configuration. If invalid, do not publish. Navigate/focus user to issues.

---

## DX. Validation summaries should link to exact problems

Example: "4 issues prevent publishing" — selecting each issue should reveal/focus the relevant node or field. Not "Workflow invalid." 

---

## DY. Complex builders should support Undo/Redo

Especially deleting nodes, moving nodes, changing connections. Use conventional keyboard shortcuts where supported.

---

## DZ. Immersive workspaces must always have an exit

Workflow Builder may minimize global navigation. Still provide ← Back to workflows (keyboard accessible), sensible Browser Back, and unsaved-work protection active.

---

## Transovo Interaction / Keyboard / Focus Acceptance Checklist

Every applicable feature should pass:

- [ ] Entire primary task can be completed without a mouse
- [ ] Native HTML controls used where appropriate
- [ ] Tab/Shift+Tab move predictably between components
- [ ] Composite widgets use correct internal keyboard model
- [ ] No unnecessary positive tabindex values
- [ ] Focus is always visible
- [ ] Focus never silently falls to body after DOM changes
- [ ] Focus and selected state are visually distinct
- [ ] Activation does not occur unexpectedly merely from focus
- [ ] Keyboard shortcuts follow platform conventions
- [ ] Keyboard shortcuts are optional accelerators, not required knowledge
- [ ] Buttons perform actions; links navigate
- [ ] Modal focus enters, stays inside, and restores correctly
- [ ] Modal background is inert
- [ ] Escape behavior is predictable
- [ ] Menu buttons follow WAI-ARIA menu-button interaction
- [ ] Tabs use appropriate semantics and keyboard behavior
- [ ] Accordions expose expanded/collapsed state
- [ ] Comboboxes provide proper popup/selection/focus behavior
- [ ] Radio/switch/checkbox controls use correct interaction model
- [ ] Static tables are not incorrectly implemented as ARIA grids
- [ ] Interactive grids implement complete keyboard navigation if used
- [ ] Calendar can be operated without dragging/pointer precision
- [ ] Drag operations have non-drag alternatives
- [ ] Hover-only functionality has keyboard/touch equivalent
- [ ] Tooltips are keyboard accessible
- [ ] Drawers explicitly use modal or nonmodal behavior
- [ ] Temporary UI returns focus logically
- [ ] Deleted elements transfer focus to a meaningful successor
- [ ] Destructive actions have proportional safeguards
- [ ] Reversible actions use undo where appropriate
- [ ] Save/auto-save behavior is consistent and visible
- [ ] Unsaved work is protected
- [ ] Loading state does not destabilize layout
- [ ] Duplicate submissions are prevented
- [ ] Disabled actions explain why when necessary
- [ ] Search/filter updates do not steal focus
- [ ] Pagination/infinite loading preserve keyboard orientation
- [ ] Row interaction supports keyboard and nested controls correctly
- [ ] Live/background updates do not steal focus
- [ ] Bulk selection model is clear
- [ ] Workflow-builder operations have keyboard-accessible alternatives
- [ ] Canvas zoom/pan has explicit controls
- [ ] Optimistic updates roll back visibly on failure
- [ ] Long-running operations show truthful state
- [ ] Toasts do not contain required transient decisions
- [ ] Error recovery preserves entered data/context
- [ ] Wizard Back/Next behavior is predictable
- [ ] Test/live and draft/published modes are unmistakable
- [ ] Read-only state matches permissions
- [ ] OAuth/external flows restore user context
- [ ] Browser history remains meaningful
- [ ] Pointer and keyboard interaction stay synchronized
- [ ] Real end-to-end keyboard QA performed

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus (this file)
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md      → Tables & grids
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → i18n/l10n
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #4: Interaction, Keyboard & Focus Standards. This completes all 12 implementation standards guides in the Transovo standards series.*
