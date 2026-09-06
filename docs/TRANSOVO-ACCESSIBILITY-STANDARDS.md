# Transovo Accessibility Standards Guide

**Series:** Implementation standards · **Guide #1 of 12**  
**Status:** Active — mandatory hard standard for all UI and interactive features  
**Audience:** Engineers, designers, and Cursor agents building Transovo  
**Baseline:** **WCAG 2.2 Level AA** (mandatory floor)

---

## Master Cursor rule

> **Transovo accessibility baseline is WCAG 2.2 Level AA.** Use native semantic HTML wherever possible. When custom widgets are required, implement the corresponding **WAI-ARIA Authoring Practices** interaction model, including keyboard behavior, focus management, accessible naming, states and properties—not merely ARIA attributes. **Accessibility must be implemented during component/page construction, not added after visual completion.** A feature that cannot be completed with keyboard and assistive technology is **incomplete**.

**No feature is considered complete if its primary functionality:**

- requires a mouse  
- relies only on color  
- cannot be understood by assistive technology  
- loses functionality when zoomed/reflowed  
- exposes inaccessible custom controls  

---

## Primary authorities

| Authority | Scope |
|-----------|--------|
| **W3C WAI** | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — Perceivable, Operable, Understandable, Robust; Level A / AA / AAA success criteria |
| **W3C WAI** | [WAI-ARIA](https://www.w3.org/TR/wai-aria/) + [Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/) — patterns for complex widgets |
| **U.S. Access Board** | [Section 508](https://www.access-board.gov/ict/) — ICT accessibility (incorporates WCAG for covered federal ICT) |
| **ETSI** | **EN 301 549** — European ICT accessibility (aligned with WCAG for web/software) |

**Implementation principle:** Prefer **native HTML semantics** wherever they express the required widget or behavior. Use ARIA only when native elements cannot.

**Procurement note:** Private SaaS is not automatically Section 508–covered, but building to **WCAG 2.2 AA** positions Transovo for customers with federal/European procurement requirements. Do not maintain two unrelated accessibility systems—one foundation: semantic web + WCAG conformance.

**Related Transovo guides**

- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`  
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`  
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`  
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- **Next in series:** Guide #4 — Interaction, Keyboard & Focus Standards (coming) · Guide #8 — Privacy, Consent & Compliance UX Standards (coming)

---

## A. Core accessibility rule (WCAG four principles)

Every user must be able to:

| Principle | Meaning |
|-----------|---------|
| **Perceivable** | Information and UI components are presentable to users in ways they can perceive |
| **Operable** | UI components and navigation are operable |
| **Understandable** | Information and operation of the UI are understandable |
| **Robust** | Content is robust enough for assistive technologies and agents |

---

## B. Semantic HTML first

Always use native semantic elements where they match the task.

| Use | For |
|-----|-----|
| `<button>` | Actions |
| `<a>` | Navigation |
| `<input>`, `<select>`, `<textarea>` | Input (native select when appropriate) |
| `<table>` | Real tabular data |
| `<h1>`–`<h6>` | Document structure (not font size) |
| `<main>`, `<nav>`, `<header>`, `<aside>` | Landmarks |

**Do not:**

```html
<div onclick="save()">Save</div>
```

**Do:**

```html
<button type="button">Save</button>
```

Custom ARIA widgets require authors to implement keyboard and focus behavior; native controls provide much of this by default. W3C warns that custom ARIA GUI components need explicit keyboard support.

---

## C. Every control must have an accessible name

Every interactive control must expose its purpose **programmatically**.

**Good:** visible text — `<button>Cancel appointment</button>`  
**Acceptable when icon-only:** `<button aria-label="Close appointment">…</button>`

Applies to: buttons, inputs, toggles, calendar controls, row menus, filters, pagination, AI actions, recording controls.

WCAG requires controls and non-text interactive content to have text alternatives/names describing purpose.

---

## D. Keyboard access is mandatory

Every mouse action must be operable from keyboard unless the action inherently requires path-based motion (e.g. freehand drawing).

**Test:** Tab, Shift+Tab, Enter, Space, arrow keys (per pattern), Escape, Home/End where applicable.

Users must **never** become trapped in a control or region.

WAI-ARIA APG defines keyboard patterns and predictable focus movement for complex controls.

---

## E. Focus must always be visible

Never remove focus outlines without an **equally visible** replacement.

The user must always answer: **“Where is keyboard focus?”**

Applies to: sidebar links, tabs, buttons, fields, actionable cards, appointment rows, date-picker cells, workflow nodes, dialogs, dropdown items.

---

## F. Focus order must follow logical reading/task order

DOM/focus order should follow meaningful progression:

```
Page title → Primary action → Tabs → Filters → Results → Pagination
```

- Do not use CSS to appear visually first while remaining last in tab order.  
- Do not use positive `tabindex` to force arbitrary sequences.

---

## G. Modal dialogs have strict behavior

A true modal must:

1. Move focus **into** the modal when opened  
2. Keep Tab / Shift+Tab **inside** the modal  
3. Make background **inert** (non-interactive)  
4. Have an accessible **name/title**  
5. Provide obvious **close/cancel**  
6. Close with **Escape** where appropriate  
7. **Restore focus** to the triggering control on close  

Never implement a visually modal panel that leaves keyboard focus roaming behind it.

---

## H. Tabs must behave like tabs

If using a real tab interface:

- Container uses appropriate tab semantics (`tablist`, `tab`, `tabpanel`)  
- Active tab exposes **selected** state  
- Tab controls and panels are **associated**  
- Keyboard follows [tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) (e.g. Left/Right for horizontal tabs)  
- Focus and selection are **distinguishable**

Do not style a row of buttons as tabs without correct semantics and keyboard behavior.

---

## I. Comboboxes / autocomplete must follow APG

For staff search, contact picker, timezone, booking-type selector, etc.:

- Field exposes expanded/collapsed state  
- Popup associated with input  
- Keyboard: enter/leave/navigate results, Escape dismisses, Enter selects  
- Standard text-editing keys continue to work  

Do not build mouse-only custom dropdowns.

---

## J. Static table vs interactive grid — choose intentionally

| Pattern | When |
|---------|------|
| **Semantic `<table>`** | Read/compare tabular data (most appointment lists) |
| **ARIA grid** | Spreadsheet-like: cell nav, in-cell edit, complex selection |

ARIA grids require managed focus and directional-key navigation—substantially more complex. **Do not make every table an ARIA grid.**

---

## K. Headings must describe document structure

Use heading levels for **structure**, not font size. Style with CSS.

```
H1 Appointments
  H2 Today's appointments
  H2 Needs attention
  H2 Recent activity
```

Every page needs a clear primary **H1**.

---

## L. Landmarks must be meaningful

Expose structural regions: `navigation`, `main`, `header`, `complementary`/`aside` where appropriate so screen-reader users can jump between major sections.

---

## M. Color can never be the sole information carrier

Never rely only on green = confirmed, red = canceled, yellow = warning.

Always pair with **text** (and optionally icon): `Confirmed`, `Canceled`, `Needs attention`.

Color may reinforce; it cannot be the only signal.

Applies to: calendar events, appointment status, reminders, payments, charts, connection health, validation errors.

WCAG: color must not be the only visual means of conveying information, action, or state.

---

## N. Text contrast must meet WCAG AA

| Text | Minimum contrast |
|------|------------------|
| Normal text | **4.5:1** |
| Large text (≥18pt / 14pt bold) | **3:1** |

Applies to helper text, captions, placeholders (when they convey info), table text, sidebar text—not only body copy.

---

## O. Important non-text UI needs sufficient contrast

Focus indicators, field boundaries, and states needed to operate the UI must remain discernible (~**3:1** for UI components per WCAG / design-system practice).

Checkbox boundaries, selected states, and focus rings cannot be imperceptibly faint.

---

## P. Do not rely on hover

Essential information or actions on hover must also be available via:

- keyboard focus  
- touch interaction  
- persistent visible control  

Especially: row actions, tooltips, menus, calendar actions, workflow nodes.

---

## Q. Tooltips must be accessible

- Work from keyboard focus  
- Must not contain **required** information unavailable elsewhere  
- Must not disappear before user can perceive  
- Cannot be sole explanation for critical restrictions  

**Bad:** Disabled SMS button; explanation only in hover tooltip.  
**Good:** `SMS unavailable` + `Business texting registration required.` visible or via explicit info action.

---

## R. Forms require persistent labels

Never use placeholder as the only label.

```
Email address
[ name@example.com ]
```

Labels must be **programmatically associated** (`<label for=…>`, `aria-labelledby`, etc.).

---

## S. Required and optional status must be understandable

Do not rely only on red `*`. Explain asterisk meaning globally, or use:

```
Email address
Notes — Optional
```

Be consistent across Transovo.

---

## T. Form instructions before they are needed

Format requirements, phone rules, password rules, A2P fields—explain **before or during** entry, not only after rejection.

---

## U. Errors must identify field and problem

**Bad:** `Invalid.`  
**Good:** `Enter a valid email address.`

Errors need **text**, not only red border/icon/color. Long forms: consider error summary with links to fields.

---

## V. Errors must preserve entered data

Server validation failure must not erase completed forms—especially booking-type setup, A2P registration, org settings, payment setup, workflows.

---

## W. Status messages must be exposed to assistive technology

When status changes without moving focus (`Saved`, `Appointment created`, `Sync failed`), use appropriate **live region** / status semantics—without making every tiny change aggressively interruptive.

---

## X. Dynamic loading must announce meaningful state

For calendar sync, AI processing, transcription, payments, reminders:

- `Syncing calendar` → `Calendar synced` or `Calendar sync failed`  
- Loading must not make the interface disappear from AT without explanation  

---

## Y. Touch targets must be sufficiently usable

**Practical standard:** ~**44×44 CSS px** effective hit area for important touch controls (WCAG 2.2 target size at AA; AAA is stricter).

Icon may be 16–20px; hit area must still be usable. No microscopic close buttons or overflow menus.

---

## Z. Content must survive zoom and reflow

Users must enlarge content substantially (WCAG: **200% zoom** without loss of content/function) without overlap, clipped controls, or required horizontal scroll for ordinary reading.

---

## AA. Do not lock orientation unnecessarily

Responsive web product works in available orientations unless orientation is essential to function.

---

## AB. Accessible names should match visible labels

If button shows `Reconnect Microsoft`, accessible name should not be `Retry authorization flow button` unless strongly justified. Helps voice-control users.

---

## AC. Links and buttons must not be confused

| Element | Use |
|---------|-----|
| **Link** (`<a>`) | Navigates (URL change) |
| **Button** | Performs action in place |

`Open contact` → link. `Save changes` → button. `Delete appointment` → button.

---

## AD. No drag-and-drop-only interactions

Reorder booking types, move appointments, workflow connections, scheduling drag—must have **non-pointer alternative** for the same operation.

---

## AE. Calendar interaction must not be mouse-only

Users must navigate dates, open/create appointments, inspect events, and perform required actions without precise pointer interaction. Drag may be an **accelerator**, not the only method.

---

## AF. Charts need accessible equivalents

Essential information cannot live only in the chart. Provide labels, values, descriptions, and underlying table/data where appropriate. Do not differentiate important series by color alone.

---

## AG. Recording and media controls must be accessible

Notetaker: play/pause keyboard-operable, state communicated, transcript available, meaningful labels, captions/transcript where relevant.

---

## AH. Notifications cannot steal focus arbitrarily

`Reminder delivered` should **announce**, not move focus away from current task. Reserve focus changes for interactions that require immediate user action.

---

## AI. Focus must return intelligently after temporary UI closes

- Action menu closed → focus returns to menu trigger  
- Modal canceled → focus returns to opener  
- Item deleted → focus moves to meaningful adjacent target, not top of document  

---

## AJ. Hidden content must be hidden from AT when appropriate

Inactive tab panels, modal background, collapsed accordions, removed conditional fields—inactive content must not remain focusable in the accessibility tree.

---

## AK. Disabled state must be programmatically conveyed

`disabled` / `aria-disabled` semantically—not only gray styling. If **why** matters, explain nearby:

```
SMS reminders unavailable
Complete business texting registration for imported appointments.
```

---

## AL. Navigation must be consistent

Same global sidebar, main areas, terminology, placement (aligns with IA guide). WCAG / Section 508 consistent navigation expectations.

---

## AM. Same function → same identification

`More actions` vs `Options` for the same control type—avoid without reason. `Close` / `X` behavior consistent everywhere.

---

## AN. Avoid unexpected context changes

Selecting from dropdown must not unexpectedly submit, navigate, or erase work unless clearly informed. Focus change alone must not trigger destructive behavior.

---

## AO. Time limits treated carefully

Session expiry or timed actions: warn, allow extension where possible, preserve entered work. Do not silently destroy a 20-minute setup form.

---

## AP. Auto-updating content must not overwhelm

Inbox, appointments, workflow logs, calendar sync—avoid constant reordering under the user. Preserve position and context.

---

## AQ. Flashing content avoided

No flashing visual effects. Calm status transitions.

---

## AR. Motion must respect user preferences

Honor `prefers-reduced-motion` for non-essential animation (drawers, loading, expand/collapse).

---

## AS. Page language must be declared

`<html lang="en">` (or appropriate). Mark language changes in content portions where needed (WCAG Understandable).

---

## AT. Responsive layout must preserve reading order

Mobile CSS must not invert visual vs DOM/screen-reader order in ways that confuse task flow.

---

## AU. Screen-reader-only text when visual context is insufficient

Icon-only delete in Anthony’s row → `Delete Anthony Johnson's appointment`—not verbose everywhere, but contextual when it helps.

---

## AV. Decorative images/icons should not create noise

If visible text already conveys meaning (`Connected`), decorative check icon → `aria-hidden="true"`.

---

## AW. Custom components must implement the full interaction contract

ARIA role alone is **not enough**. Must implement:

- Keyboard behavior (per APG)  
- Focus management  
- States and properties (`aria-expanded`, `aria-selected`, etc.)  
- Accessible naming  
- Screen-reader behavior  

---

## AX. Accessibility testing must include keyboard testing

For every major page/component:

1. Ignore the mouse  
2. Complete primary task by keyboard  
3. Verify visible focus  
4. Verify no traps  
5. Verify modal/menu/tab/calendar behavior  
6. Verify all required operations reachable  

Automated tools **supplement**; they do not replace manual keyboard QA.

---

## AY. Screen-reader testing for critical patterns

Practical AT verification minimum for:

- Login / onboarding  
- Appointment create & manage  
- Booking page  
- Payment  
- Messaging  
- Modals / dialogs  
- Workflow UI  
- **Calendar** (high risk)  
- Any custom control  

---

## AZ. WCAG AA is the floor, not always the ceiling

| Level | Transovo policy |
|-------|-----------------|
| **A** | Subset of AA |
| **AA** | **Mandatory baseline** |
| **AAA** | Use individual techniques when practical and high value—not a blanket engineering requirement |

---

## Transovo accessibility acceptance checklist

A page or feature is **not complete** until all applicable items pass:

- [ ] Semantic HTML used wherever native semantics exist  
- [ ] Every interactive element has an accessible name  
- [ ] Entire primary workflow usable by keyboard  
- [ ] Logical Tab/focus order  
- [ ] Visible focus indicator  
- [ ] No keyboard traps  
- [ ] Modal focus correctly contained and restored  
- [ ] Tabs/comboboxes/grids use appropriate WAI-ARIA behavior  
- [ ] One logical page H1  
- [ ] Logical heading hierarchy  
- [ ] Appropriate landmarks  
- [ ] Text contrast meets WCAG AA  
- [ ] UI state not communicated by color alone  
- [ ] Interactive boundaries/states sufficiently visible  
- [ ] Persistent labels on form controls  
- [ ] Errors associated with affected controls  
- [ ] Errors described in text  
- [ ] Entered form values preserved after validation failures  
- [ ] Dynamic status changes exposed appropriately  
- [ ] Touch targets usable (~44px where feasible)  
- [ ] Responsive reflow preserves content/function  
- [ ] 200% zoom remains functional  
- [ ] No required hover-only interaction  
- [ ] Drag/drop has equivalent alternative  
- [ ] Charts have accessible data/labels  
- [ ] Media controls accessible  
- [ ] `prefers-reduced-motion` honored  
- [ ] Disabled state programmatically conveyed  
- [ ] Hidden content removed from focus/AT when appropriate  
- [ ] Navigation and component naming consistent  
- [ ] Real keyboard QA performed  
- [ ] Critical custom components receive assistive-technology QA  

---

## High-risk Transovo components (extra scrutiny)

| Component | Requirements |
|-----------|----------------|
| **Appointment calendar** | Full keyboard nav; drag optional; event state not color-only |
| **Combobox / pickers** | APG combobox pattern |
| **Data tables** | Semantic table unless true grid needed; row actions keyboard-accessible |
| **Modals / drawers** | Focus trap, restore, Escape |
| **Workflow builder** | Non-drag alternatives for connections/reorder |
| **Notetaker / media** | Controls, transcript, state |
| **Status-heavy surfaces** | Live regions, text labels, async state |

---

## Implementation stack (where this guide sits)

```
TRANSOVO-UI-DESIGN-GUIDE.md           → IA
TRANSOVO-PAGE-ARCHITECTURE-RULES.md   → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md       → Visual tokens & components
TRANSOVO-ACCESSIBILITY-STANDARDS.md        → WCAG 2.2 AA + ARIA (this file) ← hard standard
TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md → ISO 9241 HCD
TRANSOVO-IA-NAVIGATION-STANDARDS.md        → IA & navigation
TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
Guide #4 (coming)                            → Interaction, keyboard & focus
Guide #8+ (coming)                           → Privacy, consent & compliance UX, etc.
```

**Build accessibility into components at construction time.** Retrofitting after visual completion is not acceptable.

---

*Guide #1: Accessibility Standards. Next: Guide #2 — `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` · Guide #3 — `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · Guide #5 — `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md` · Guide #6 — `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md` · Guide #7 — `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`.*
