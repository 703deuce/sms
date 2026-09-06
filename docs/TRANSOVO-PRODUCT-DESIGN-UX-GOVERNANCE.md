# Transovo Product Design & UX Governance Guide

**Status:** Active — highest governing authority for Transovo product design, UX, and UI implementation decisions  
**Audience:** Engineers, designers, product owners, Cursor agents, and Kimi building or changing Transovo  
**Role:** Standards hierarchy, conflict resolution, and implementation authority — sits **above** all individual Transovo design/UX standards documents

---

## Master Cursor rule

> **Transovo must be developed as one coherent product system, not as a collection of individually designed pages. Product scope determines what exists. Information architecture determines where it lives. Human-centered design determines how the workflow should work. Page architecture determines where information/actions belong. The visual design system determines how it looks. Shared components determine how repeated UI behaves. Formal standards determine accessibility, interaction, forms, responsive behavior, data semantics, privacy, security, time, and internationalization requirements. Existing implementation is reusable only when it conforms to these higher-level rules. When inconsistency is discovered, fix the underlying shared system rather than applying page-specific patches. Preserve correct existing business logic, reuse canonical domain engines, consolidate duplicate patterns, and ensure every visible control and state reflects actual runtime truth. The goal is a product whose behavior, visual language, terminology, interaction model, and architecture remain so consistent that the number of people who built it is irrelevant to the user’s experience.**

---

## Purpose

This document tells Cursor which Transovo design/UX documents control a decision, what order to follow them in, how to resolve conflicts between them, and how to prevent old implementation patterns from overriding the new professional product system.

The goal is not merely to make individual pages attractive.

The goal is for Transovo to behave, look, read, and feel like one professionally designed SaaS product created by a coordinated product, design, accessibility, frontend, security, and UX organization.

**Cursor must not design each screen independently.**

All product work must inherit the same:

- product architecture
- terminology
- information architecture
- page structure
- visual language
- component behavior
- interaction rules
- accessibility requirements
- responsive behavior
- data-entry behavior
- security/privacy behavior
- date/time rules
- internationalization architecture

**Related Transovo documents (authority order summarized below)**

| Layer | Document |
|-------|----------|
| **Governance (this file)** | `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md` |
| Product scope / domain | `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` · `docs/TRANSOVO-UI-DESIGN-GUIDE.md` |
| IA & terminology | `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` |
| HCD principles | `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md` |
| Page structure | `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md` |
| Visual system | `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md` |
| Formal standards Guides #1–#11 | See Level 7 below |

---

## 1. The standards are a system, not optional reference material

The Transovo UX/design documents are **governing implementation requirements**.

Cursor must not treat them as suggestions, inspiration, examples, optional polish, or something to apply only when creating new pages.

When modifying an existing surface, Cursor must apply the relevant standards unless doing so would create a larger regression or conflict with a higher-authority Transovo rule.

---

## 2. Order of authority

When multiple documents apply, use this order.

### Level 1 — Product Scope & Domain Architecture

Highest product-level authority.

This determines: what Transovo is, which features belong in the product, which features do not belong, canonical domain objects, product boundaries, canonical architecture, shared engines, and business/runtime behavior.

Examples: Appointment, Booking Type, Booking Page, Contact, Reminder Sequence, Workflow, Meeting, Payment.

**Hard rule:** No lower-level UX or visual document may invent a feature, domain, integration, product area, or terminology that violates the approved Transovo product scope.

If old code contains an out-of-scope feature, its existence does not give it product authority.

---

## 3. Level 2 — Canonical Information Architecture & Terminology

This controls global navigation, local navigation, feature placement, canonical naming, object relationships, and where users expect to find things.

**Current top-level Transovo IA:**

1. Home
2. Appointments
3. Booking
4. Contacts
5. Messages
6. Automations
7. Meetings
8. Payments
9. Analytics
10. Integrations
11. Settings

**Hard rule:** Every feature has one canonical home and one canonical user-facing name.

Do not duplicate a feature in several permanent navigation areas because doing so appears convenient. Contextual links to the same canonical object are allowed. Duplicate product architectures are not.

**Primary document:** `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · `docs/TRANSOVO-UI-DESIGN-GUIDE.md`

---

## 4. Level 3 — Human-Centered Design & Product Experience Principles

Use the Human-Centered Design / ISO-based guide to decide whether a workflow fits the user's actual task, whether unnecessary steps exist, whether the user retains control, whether the interface minimizes cognitive load, whether the workflow is understandable, whether error recovery is practical, and whether the complete task is efficient.

This level answers: **Should the experience work this way at all?**

Before asking "What component should we use?", Cursor must first ask: **What is the user's goal, and what is the simplest coherent workflow that accomplishes it?**

**Primary document:** `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`

---

## 5. Level 4 — Page Architecture & Layout Standards

This controls the structure of the page: page archetype, header placement, title placement, primary action placement, local navigation, filters, data region, detail layout, configuration layout, builder layout, empty/error/loading states, and hierarchy of page content.

This level answers: **Where does everything belong on the page?**

Do not redesign basic page anatomy separately for every route.

**Primary document:** `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`

---

## 6. Level 5 — Visual Design System

This controls visual consistency: typography, font scale, spacing, color, semantic colors, surfaces, borders, radius, shadows, iconography, density, alignment, button hierarchy, form visual treatment, table styling, light/dark behavior, and responsive visual rules.

This level answers: **What should the system look like?**

**Hard rule:** Visual values should come from shared tokens/system definitions rather than arbitrary page-level values.

Avoid random font sizes, padding, radius, colors, shadows, and control heights inside individual screens.

**Primary document:** `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`

---

## 7. Level 6 — Shared Component System

Once a reusable component exists, it should be the default implementation.

Examples: Button, Icon Button, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Tabs, Table, Badge, Alert, Toast, Modal, Drawer, Dropdown Menu, Empty State, Page Header, Filter Bar, Search Field, Pagination, Status Indicator, Skeleton, Timeline, Date Picker, Time Picker.

**Hard rule:** Do not recreate a common component inside an individual page when the product already has an appropriate shared component.

If the shared component is insufficient:

1. determine whether the requirement is legitimate
2. improve the shared component
3. use the improved component everywhere appropriate

Do not create `AppointmentButton`, `BookingButton`, `ContactButton`, and `SettingsButton` that all independently reinvent the same button behavior.

---

## 8. Level 7 — Formal Standards Guides

Apply every relevant standards document to the implementation.

These currently include:

1. `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
2. `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
3. `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
4. `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
5. `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
6. `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
7. `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
8. `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
9. `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
10. `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
11. `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

These documents are cross-cutting. A page may need several simultaneously.

**Example — New Appointment form:** Human-Centered Design, Page Architecture, Visual Design System, Accessibility, Interaction/Keyboard, Forms/Validation, Responsive/Reflow, Date/Timezone, Internationalization.

Do not choose one guide and ignore the others.

---

## 9. Level 8 — Existing implementation

Existing code is the **lowest authority**.

Existing implementation may be reused when it already conforms to the higher-level system.

It must not override the standards merely because "This is how the old page currently works."

**Hard rule:** Legacy implementation is evidence of existing behavior, not evidence that the behavior is correct.

Before copying an old pattern, verify it against the governing documents.

---

## 10. Conflict-resolution rule

When two rules appear to conflict, resolve them in this order:

1. **First** — Protect correctness, security, privacy, accessibility, and data integrity.
2. **Second** — Protect approved product scope and domain behavior.
3. **Third** — Protect user task completion and understandable interaction.
4. **Fourth** — Protect information architecture and terminology.
5. **Fifth** — Protect component/design consistency.
6. **Sixth** — Optimize visual aesthetics.

**Example:** A visually cleaner control cannot override keyboard accessibility, legally required consent clarity, correct appointment timezone behavior, or authorization boundaries.

Professional design is not visual appearance at the expense of correctness.

---

## 11. Formal standard vs Transovo best practice

Cursor must understand the difference.

**Formal requirement** — Examples: WCAG keyboard operability, WCAG error identification, RFC 3339 timestamp representation, IANA timezone handling, BCP 47 language tags. These should not be casually overridden.

**Transovo design rule** — Examples: page title upper-left, primary action upper-right, medium-density operational layout, use drawers to preserve certain list contexts. These are product-system rules and should normally be followed, but can be adjusted when the actual task clearly requires a better solution.

If deviating: explain the reason and preserve consistency elsewhere.

---

## 12. Do not design page-by-page

This is one of the strongest rules in this document.

Cursor must not think "How should this appointment page look?" in isolation.

Instead: **Which existing page archetype, component patterns, tokens, interaction rules, and object conventions apply to this appointment page?**

Professional systems reuse patterns. One-off design decisions create inconsistency.

---

## 13. System-first implementation rule

When the same UX problem occurs in multiple places:

- **Bad approach:** fix it separately on six pages.
- **Correct approach:** (1) identify the reusable pattern, (2) determine whether an existing component already owns it, (3) fix or extend the shared component, (4) use the same implementation everywhere applicable.

**Example:** If tables across Appointments, Contacts, Payments, and Meetings all need the same row-action behavior, build/fix the canonical table/action pattern. Do not invent four solutions.

---

## 14. One component, one behavioral contract

Shared components must define their complete states.

**Example button:** default, hover, focus, pressed, loading, disabled, destructive where appropriate.

**Input:** empty, filled, focused, disabled, read-only, invalid, success where appropriate, loading where applicable.

**Modal:** initial focus, focus containment, close, Escape, restoration, loading, error, confirmation behavior.

Do not leave individual pages responsible for reinventing component behavior.

---

## 15. Do not duplicate components because styling differs slightly

If two components perform the same semantic job but need minor presentation variations, use variants, size props, semantic props, and composition rather than separate unrelated implementations.

Example: `<Button variant="primary">`, `<Button variant="secondary">`, `<Button variant="danger">` — instead of three unrelated button implementations.

---

## 16. Component variants must represent real differences

Do not create 18 button variants because individual pages wanted slightly different padding.

Variants should reflect meaningful system differences such as primary / secondary / ghost / destructive, or small / medium. Keep the system constrained.

---

## 17. Tokens before arbitrary values

Cursor should prefer semantic design tokens such as `space-2`, `space-3`, `surface-secondary`, `text-muted`, `border-subtle`, `status-warning`, `radius-md` over arbitrary one-off values.

Avoid `margin-top: 17px`, `border-radius: 11px`, `color: #747783` unless there is an exceptional documented reason.

---

## 18. Shared terminology is part of the design system

Do not treat words as arbitrary page copy.

Canonical Transovo terms include: Appointment, Booking Type, Booking Page, Contact, Conversation, Reminder Sequence, Workflow, Meeting, Payment.

Do not casually replace them with Event, Session, Customer Booking Object, or Automation Campaign unless the concept genuinely differs.

---

## 19. One action should normally have one canonical name

If the action is "Create appointment", avoid pages alternatively saying Add event, New booking, Schedule customer, or Create meeting unless they represent different operations. Consistency reduces learning cost.

---

## 20. Same object = same visual/state language

An Appointment status should use the same terminology, badge, semantic color, icon where used, and state definition across Calendar, Appointment List, Contact detail, Analytics, Search, and Home. No page-specific interpretation.

---

## 21. Same action = same interaction pattern

If editing an object opens a drawer across the product, don't randomly make one page inline edit and another modal unless the workflow genuinely differs.

Consistency is not aesthetic sameness. It is behavioral predictability.

---

## 22. Choose UI surfaces according to task

- **Page** — substantial independent work
- **Drawer** — preserving parent context matters
- **Modal** — short contained decisions/actions
- **Popover** — lightweight contextual controls
- **Menu** — secondary commands
- **Tooltip** — supplementary explanation only
- **Wizard** — genuinely ordered multi-step work

Do not choose based on what looks fashionable.

---

## 23. Do not use cards as the answer to everything

Cards are appropriate for independent grouped content, dashboard summaries, and selected information blocks.

They are not required around every form section, table, subsection, or sentence. Avoid card inside card inside card.

Hierarchy should come from whitespace, typography, grouping, and borders when necessary — before excessive containers.

---

## 24. Professional density must remain consistent

Transovo is an operational SaaS, not a marketing landing page. Default: medium-density, calm, efficient.

Avoid pages with giant hero spacing, enormous headings, huge empty cards, excessive 64px padding, and oversized decorative illustrations.

Operational pages should maximize comprehension, scanning, and task completion without becoming cramped.

---

## 25. Healthy state should be quiet

Do not turn every normal state into green badges, success boxes, icons, and celebratory UI.

Example: Connected calendar does not need a giant green alert indefinitely. Normal healthy state should be easy to see but visually calm. Exceptions deserve more attention.

---

## 26. Problems get prominence proportional to consequence

High priority: Microsoft sync disconnected. Lower priority: Optional profile field missing.

Do not give everything equal alert treatment. This preserves attention.

---

## 27. Every page has one primary job

Before modifying a page, Cursor must state internally: **What is the main task this page enables?**

Anything not serving that job should be secondary, moved elsewhere, progressively disclosed, or removed if redundant. A page should not become a feature dump.

---

## 28. Every page needs one dominant primary action

Examples: Appointments → New appointment; Booking Types → New booking type; Workflows → New workflow.

Do not present five equal bright buttons. Secondary actions are subordinate.

---

## 29. Actions stay near the objects they affect

Appointment action Reschedule belongs with the Appointment. Contact action Book appointment belongs with Contact context.

Do not make users search Settings or a global action center for object-specific operations.

---

## 30. Global configuration and local configuration must remain separate

Example: **Settings** — default reminder behavior. **Appointment** — override reminder behavior for this appointment.

Do not duplicate the entire reminder system inside both areas. Global defines defaults/policy. Local modifies the current object.

---

## 31. Inheritance must be visible

When an object uses a default, show "Using calendar default" or equivalent.

When overridden, show "Custom for this appointment".

Do not make users guess whether changing something affects one appointment, calendar, workspace, or every future booking.

---

## 32. Existing code must be audited before creating something new

Before creating a component, service, route, page pattern, formatter, or state model, Cursor must first inspect whether an appropriate implementation already exists.

Use: **Audit → Preserve → Extend → Consolidate**

Do not: **Ignore → Duplicate → Diverge.**

---

## 33. Preserve correct existing behavior

Standards migration does not mean rebuilding everything.

If current implementation already works correctly, uses canonical architecture, and meets standards — reuse it.

Do not rewrite stable systems for aesthetic purity.

---

## 34. Fix the source, not merely the symptom

If five screens have incorrect button spacing because shared Button is wrong, fix Button.

Do not apply `className="special-page-fix"` five times.

Likewise: if table row actions behave inconsistently because Table component lacks an action API, improve Table.

---

## 35. Avoid permanent compatibility hacks

Short-lived migration compatibility may be necessary. But do not allow old navigation, old terminology, old component, and new component to coexist indefinitely. Migration needs a destination.

---

## 36. One source of truth for navigation

Global navigation should come from one shared configuration/component. Do not manually recreate sidebar entries on each page.

Same principle for headers, route labels, permissions, and major feature definitions.

---

## 37. One global shell

All standard authenticated product pages should share the same sidebar, header, content region, and responsive behavior — except intentionally immersive workspaces such as a builder.

No page-specific duplicate sidebar/header implementation.

---

## 38. Immersive workspaces are controlled exceptions

Examples: Workflow Builder may reduce global shell distractions.

But still preserve identity, exit path, save state, accessibility, and core product terminology.

An immersive mode is not permission to abandon the design system.

---

## 39. Feature state must come from canonical domain state

Do not calculate status independently in five components.

Example: Appointment confirmation state should come from the appointment domain. Do not have table compute confirmed, detail compute it differently, and analytics infer it another way. Shared domain truth.

---

## 40. Visual UI must never contradict runtime truth

Examples of broken UI:

- UI says SMS enabled but runtime cannot send.
- UI says Microsoft connected but refresh credentials are invalid.
- UI says Workflow published but runtime uses draft.

Professional UI means truthful UI.

---

## 41. A visible control must actually work

**Hard rule: No fake controls.**

Every visible toggle, button, select, filter, setting, and menu item must have real behavior.

If feature is unavailable: hide it when appropriate, or explicitly mark it unavailable with explanation. Never ship decorative functionality.

---

## 42. Normal, loading, empty, error, partial and success states are all part of the component

Do not design only loaded with perfect data.

Every major component/page needs: (1) Normal, (2) First use / Empty, (3) Loading, (4) Error, (5) Partial/degraded where applicable, (6) Success/updated state where applicable.

These states should use shared patterns.

---

## 43. Exceptional states must preserve the page structure

If table fails, don't replace the entire page with "Something went wrong."

Keep page title, nav, filters where useful, and retry/error region. Users should retain orientation.

---

## 44. Error messages need three things

Where applicable:

1. What happened?
2. What does it affect?
3. What can the user do?

**Example:** "Microsoft calendar sync is paused. New Microsoft changes won't import until the connection is restored. Reconnect Microsoft"

Not: "Error 401." 

---

## 45. Never expose backend implementation language to ordinary users

Avoid enum values, raw Graph errors, provider IDs, stack traces, database names, and webhook codes.

Translate into product language. Diagnostics can expose technical details in appropriate developer/admin contexts.

---

## 46. Accessibility is part of component completeness

A component is not complete because it looks right.

It also needs applicable semantics, keyboard operation, focus, accessible name, screen-reader state, contrast, and responsive reflow.

Do not defer accessibility to final polish.

---

## 47. Responsive behavior belongs to the shared pattern

If Drawer becomes full-screen on mobile, that behavior belongs to Drawer. Don't reimplement that transformation differently on every page.

Same for tables, filters, tabs, navigation, action bars, and forms.

---

## 48. Mobile is the same product, not a second product

Responsive layouts may transform. Information architecture, terminology, and business behavior remain the same.

Do not create desktop Transovo and unrelated mobile Transovo.

---

## 49. Security/privacy requirements override convenience

No design-system rule can justify exposing a secret, bypassing authorization, fabricating consent, sending after opt-out, or weakening authentication.

Security/privacy correctness always outranks visual convenience.

---

## 50. Date/time correctness overrides visual simplicity

Do not remove timezone context merely because the label looks cleaner.

If timezone ambiguity could result in incorrect appointment behavior, show necessary context. Correct scheduling outranks aesthetic minimalism.

---

## 51. Avoid premature abstraction

System-first does not mean turn every 8 lines into a component.

Create abstraction where there is actual reuse, stable semantic pattern, and shared behavior.

Do not build giant generic components with 40 props just to claim standardization.

---

## 52. Reuse semantics, not necessarily every DOM fragment

Two pages may share page-header pattern, filter pattern, and status pattern without being literally one giant component.

The goal is consistent architecture, not abstraction for abstraction's sake.

---

## 53. Component APIs should use product meaning

Better: `status="confirmed"` than `color="green"`. Better: `variant="destructive"` than `background="#EF4444"`. Better: compact data row than `42px height`.

Semantic APIs keep components consistent.

---

## 54. Design-system exceptions must be intentional

Sometimes a unique workflow genuinely needs something different. Before creating a one-off:

1. verify existing pattern cannot solve it
2. determine whether new pattern will recur
3. ensure it follows accessibility/interaction standards
4. document why it is an exception

Do not casually fork the system.

---

## 55. New reusable patterns must become part of the system

If a new pattern is genuinely needed — e.g., Appointment eligibility diagnostic panel — and it will recur, define structure, states, spacing, interaction, and responsive behavior. Then reuse it.

Do not leave it as anonymous page CSS.

---

## 56. Audit existing screens against the new system

Existing Transovo pages were created across different periods. Therefore they must not be assumed consistent.

Audit should identify: terminology inconsistencies, duplicate components, different headers, different sidebars, spacing drift, typography drift, button drift, modal/drawer inconsistencies, fake controls, missing states, responsive failures, accessibility failures, wrong page archetypes, and duplicated feature placement. Then consolidate.

---

## 57. Audit by pattern before auditing page-by-page

Efficient order:

1. Global shell
2. Tokens
3. Core components
4. Page archetypes
5. Domain-specific pages

Otherwise Cursor may polish 30 pages and later discover the shared Button/Table/Header needed to change.

---

## 58. Recommended system-consolidation order

**Phase 1 — Foundations:** typography, color tokens, spacing, surfaces, borders, radius, responsive primitives

**Phase 2 — Core controls:** Button, Input, Select, Combobox, Checkbox, Radio, Switch, Date/time controls

**Phase 3 — Interaction surfaces:** Modal, Drawer, Menu, Popover, Tooltip, Tabs

**Phase 4 — Data presentation:** Table, List, Cards, Badges/status, Empty state, Skeleton, Pagination, Filters

**Phase 5 — Page patterns:** Dashboard, List, Calendar, Detail, Settings, Editor, Builder

**Phase 6 — Product domains:** Appointments, Booking, Contacts, Messages, Automations, Meetings, Payments, Analytics, Integrations, Settings

---

## 59. Do not visually polish before structural correctness

Correct order:

1. product/domain correctness
2. IA
3. workflow
4. page architecture
5. components
6. accessibility/interaction
7. visual polish

Do not spend time perfecting shadows on a page whose information architecture is wrong.

---

## 60. Professional consistency beats novelty

Transovo does not need every screen to feel uniquely designed.

Professional software usually feels consistent precisely because users recognize patterns.

Cursor should favor familiar, predictable, polished over clever, unusual, visually surprising.

---

## 61. Do not copy competitor UI blindly

Competitors can provide feature research, workflow evidence, and user expectation evidence. They are not Transovo's design authority.

Do not reproduce layout, terminology, unusual interaction solely because Calendly/AppointmentReminder/etc. does it. Evaluate against Transovo's standards.

---

## 62. Product rules outrank visual screenshots

If Cursor is given a screenshot as a visual reference, it may study spacing, hierarchy, density, and polish — but must not copy incorrect IA, out-of-scope functionality, inaccessible controls, terminology conflicting with Transovo, or poor interaction patterns.

A reference is not authority.

---

## 63. Validate whole user journeys

A screen can look perfect and still create a bad product.

Test workflows such as: Book an appointment; Manual appointment; Microsoft import; Automation create/configure/publish; Meeting with Notetaker/transcript/recap.

Professional quality exists across the transitions.

---

## 64. Cross-page consistency is an acceptance criterion

Before declaring a feature polished, compare it against related pages.

Ask: Same header? Same button hierarchy? Same status? Same action placement? Same terminology? Same interaction? Same spacing? Same error model?

A page is not complete in isolation.

---

## 65. User-visible duplication is usually a warning sign

If users see the same setting in Appointment, Booking, Automations, and Settings, verify whether those are genuinely different scopes.

Often duplication indicates unclear architecture. Do not solve discoverability by copying entire configuration panels everywhere. Use contextual links and inheritance instead.

---

## 66. Multiple entry points can lead to one canonical object

Good: Contact → Book appointment, Calendar → New appointment, Home → New appointment — all can lead to the same appointment creation engine. That is professional reuse.

Do not build three unrelated appointment creation systems.

---

## 67. Shared domain engines must power every entry point

Examples:

- **Availability engine** serves Booking Page, staff manual booking, AI Booking, routing, reschedule.
- **Reminder engine** serves manually created appointments, Booking Page appointments, imported appointments where eligible, AI-created appointments.

One domain engine. Many interfaces.

---

## 68. Do not fork business logic for visual convenience

Example: Mobile appointment creation must not use simplified scheduling logic different from desktop.

It can have a different presentation. Same engine. Same validation. Same result.

---

## 69. UI should communicate actual hierarchy of importance

Do not make advanced setting, edge-case metadata, or internal diagnostic visually equal to customer, appointment time, status, or primary action.

Visual hierarchy should mirror task importance.

---

## 70. Reduce cognitive noise

Professional does not mean show everything.

Hide or subordinate advanced options, rarely used metadata, and internal diagnostics until context requires them. Use progressive disclosure.

---

## 71. Prefer recognition over recall

Show "Using Standard Reminders" rather than making the user remember which reminder sequence is active.

Show "Microsoft Work Calendar" not an opaque calendar ID. Show current state. Do not require memory.

---

## 72. Preserve spatial consistency

Users learn: primary action lives here, filters live here, object status lives here, page tabs live here.

Do not randomly rearrange those patterns. Spatial memory is part of efficiency.

---

## 73. Respect established defaults

Default behavior should satisfy the common case. Advanced users can customize.

Do not require 15 decisions merely to create a 30-minute appointment. Professional products reduce work.

---

## 74. Expert workflows should remain efficient

As users become experienced, keyboard, search, remembered filters, bulk actions, and contextual shortcuts can accelerate work. But novice clarity remains intact.

---

## 75. Every important object should have a canonical detail view

Examples: Appointment, Contact, Meeting, Transaction, Workflow.

Contextual drawers can provide previews. But there should be one authoritative representation of the complete object.

---

## 76. Timelines should be canonical where history matters

For Appointment, timeline can represent created, changed, confirmation, reminders, replies, payment, reschedule, cancellation, meeting, and sync events.

Do not create five unrelated history widgets describing different fragments with different terminology.

---

## 77. Diagnostics should explain system decisions

Examples: Why is this slot unavailable? Why wasn't SMS sent? Why is Microsoft disconnected? Why didn't this workflow run?

Expose actionable reasons where users need them. Do not require support for ordinary system explanations.

---

## 78. Diagnostics must come from actual reason codes/state

No guessed explanations. Backend/system should provide `reason = customer_opted_out`. UI translates it.

Do not ask AI to guess why SMS probably failed.

---

## 79. Every new feature must answer these questions before implementation

Cursor should determine:

1. What user problem does this solve?
2. Which canonical domain owns it?
3. Where does it live in the IA?
4. What page archetype does it use?
5. Which shared components apply?
6. Which formal standards apply?
7. What are its states?
8. What permissions apply?
9. What responsive behavior applies?
10. Does it reuse an existing domain engine?
11. What existing implementation can be reused?
12. What must not be duplicated?

If those cannot be answered, implementation is premature.

---

## 80. Every page must answer five user questions

Within a few seconds the user should understand:

1. Where am I?
2. What is this page for?
3. What can I do here?
4. Is anything requiring my attention?
5. Where do I go next if needed?

If not, hierarchy/navigation needs improvement.

---

## 81. Professional quality is determined by the weakest repeated pattern

One great dashboard cannot hide inconsistent modals, poor form validation, broken mobile tables, or strange error messages.

The repeated components determine perceived quality. Therefore prioritize fixing systems used everywhere over polishing one showcase page.

---

## 82. Acceptance means system consistency, not merely technical completion

A feature is not complete because endpoint works, button exists, or page renders.

It is complete when: domain behavior is correct, IA placement is correct, terminology is correct, page structure is correct, shared components are used, accessibility works, responsive behavior works, all relevant states exist, error/recovery works, visual system matches, and no duplicate implementation was introduced.

---

## 83. Cursor must inspect before changing

Before modifying UI: inspect relevant existing pages, shared shell, shared components, tokens, domain implementation, and relevant standards docs.

Then determine the smallest correct system-level change. Do not assume.

---

## 84. Do not rebuild stable systems unnecessarily

If an existing component/system satisfies the requirements: preserve it. If it is incomplete: extend it. If duplicates exist: consolidate carefully.

This follows **Audit → Preserve → Extend → Consolidate** — not Rebuild everything.

---

## 85. Do not perform visual work in isolation from code reality

The page design must account for real states, real data, permissions, loading, backend constraints, and runtime eligibility.

Do not create mock controls the backend cannot support.

---

## 86. When uncertain, prefer consistency with the governing system

If there are two equally valid approaches, choose the one already used by the canonical shared pattern. Do not introduce unnecessary variation.

---

## 87. When existing implementation and standards disagree

Do this:

1. identify the conflict
2. determine which higher-level rule applies
3. inspect whether changing the shared pattern affects other pages
4. fix at the lowest reusable level possible
5. preserve working business logic
6. migrate dependent usage where necessary
7. remove obsolete duplicate pattern when safe

Do not blindly copy the old implementation.

---

## 88. When two existing patterns conflict

Do not choose whichever appears on more pages automatically.

Evaluate both against standards, product architecture, usability, accessibility, and component system.

Choose the stronger canonical pattern. Then consolidate toward it.

---

## 89. Temporary exceptions need an explicit reason

If a page cannot yet follow the canonical pattern, document what differs, why, whether temporary, and migration target.

Avoid unexplained permanent divergence.

---

## 90. No "special CSS until it looks right" workflow

Cursor should not solve visual inconsistency by repeatedly adding random margins, one-off widths, arbitrary colors, and increasingly specific selectors.

Determine which design token/component/layout rule is wrong. Fix the system.

---

## 91. Avoid duplicated style constants

If the same value appears repeatedly, promote to token/component rule when semantically appropriate.

But do not create meaningless tokens like `appointment-page-left-gap-17`. Tokens represent reusable design decisions.

---

## 92. Keep design decisions semantic

Think secondary surface — not `#F7F8FA`. Think destructive action — not red button. Think compact data row — not `42px height`.

This allows the system to evolve coherently.

---

## 93. Maintain one professional visual personality

Transovo should feel: **Professional, calm, precise, modern, trustworthy, operational, medium-density.**

Avoid mixing playful consumer UI, neon startup aesthetic, enterprise gray bureaucracy, oversized marketing aesthetic, glassmorphism, and random gradients inside the same product.

---

## 94. Brand should support the product, not compete with it

Brand accent can appear in primary actions, active navigation, and controlled highlights.

Operational state should still use semantic colors. Do not paint the whole application in the brand color.

---

## 95. Product UI is not the marketing site

Marketing can be expressive, spacious, and persuasive.

Application should prioritize speed, clarity, information, state, and action.

Do not bring landing-page design patterns into every dashboard.

---

## 96. Complexity must be earned

Do not add tabs, nested navigation, accordions, wizard steps, or dropdown layers without real organizational need.

The simplest pattern that accurately represents the task should win.

---

## 97. Consistency does not mean forcing everything into one component

Appointment calendar is not a table. Workflow Builder is not a settings form. Meeting transcript is not an analytics dashboard.

Use different archetypes when tasks differ. Consistency means each archetype itself behaves consistently.

---

## 98. The system should be able to grow without redesigning navigation every month

New features should normally fit under an existing domain.

Before adding another top-level destination, ask: **Does this represent a genuinely new recurring mental workspace?**

Not: Is this feature important? Importance alone does not justify global navigation.

---

## 99. Do not let implementation architecture leak into product architecture

Users should not see navigation based on microservices, API modules, database tables, or provider integrations.

They think in appointments, customers, booking, reminders, meetings, and payments.

Product architecture follows user mental models.

---

## 100. Final governing principle

Transovo must be developed as one coherent product system, not as a collection of individually designed pages.

- **Product scope** determines what exists.
- **Information architecture** determines where it lives.
- **Human-centered design** determines how the workflow should work.
- **Page architecture** determines where information/actions belong.
- **The visual design system** determines how it looks.
- **Shared components** determine how repeated UI behaves.
- **Formal standards** determine accessibility, interaction, forms, responsive behavior, data semantics, privacy, security, time, and internationalization requirements.
- **Existing implementation** is reusable only when it conforms to these higher-level rules.

When inconsistency is discovered, fix the underlying shared system rather than applying page-specific patches. Preserve correct existing business logic, reuse canonical domain engines, consolidate duplicate patterns, and ensure every visible control and state reflects actual runtime truth.

**The goal is a product whose behavior, visual language, terminology, interaction model, and architecture remain so consistent that the number of people who built it is irrelevant to the user's experience.**

---

## Cursor Pre-Implementation Checklist

Before changing any significant Transovo UI:

- [ ] Confirm feature is inside approved Transovo scope
- [ ] Identify canonical domain
- [ ] Identify canonical terminology
- [ ] Identify canonical IA location
- [ ] Identify page archetype
- [ ] Inspect existing shared shell
- [ ] Inspect existing shared components
- [ ] Inspect design tokens
- [ ] Inspect existing domain/runtime behavior
- [ ] Identify all relevant standards guides
- [ ] Determine whether an existing implementation can be preserved
- [ ] Avoid creating duplicate component/domain logic
- [ ] Define loading/empty/error/partial/success states
- [ ] Define keyboard/focus behavior
- [ ] Define responsive behavior
- [ ] Define permission/privacy/security implications where applicable
- [ ] Define date/time/timezone implications where applicable
- [ ] Use shared component/system changes before page-level patches
- [ ] Preserve working business logic
- [ ] Keep visible UI synchronized with authoritative runtime state

---

## Cursor Completion Checklist

Before considering the work complete:

- [ ] Page follows approved Transovo IA
- [ ] Canonical terminology is used
- [ ] Page matches its approved page archetype
- [ ] Shared components used wherever applicable
- [ ] No unnecessary duplicate component created
- [ ] No arbitrary style values introduced unnecessarily
- [ ] Button/action hierarchy is consistent
- [ ] Normal/loading/empty/error/partial states handled
- [ ] Keyboard/focus interaction follows standards
- [ ] Accessibility requirements satisfied
- [ ] Forms/validation follow standards where applicable
- [ ] Responsive/reflow behavior follows standards
- [ ] Tables/grids use correct semantics where applicable
- [ ] Privacy/consent behavior follows canonical policy where applicable
- [ ] Security/authorization behavior remains server-enforced
- [ ] Dates/timezones use canonical temporal architecture
- [ ] Internationalization architecture is preserved
- [ ] Mobile and desktop use the same authoritative business state
- [ ] Visible settings actually affect runtime
- [ ] No stale legacy pattern remains merely because old code used it
- [ ] Related pages were checked for cross-product consistency
- [ ] Shared-system fix was preferred over page-specific patching

---

## Complete Transovo design & UX document hierarchy

```
LEVEL 0  TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md     → This file (authority & conflict resolution)
LEVEL 1  V1-APPOINTMENTS-MCTB-UI-REBUILD.md           → Product scope & domain
         TRANSOVO-UI-DESIGN-GUIDE.md                   → IA principles & domain definitions
LEVEL 2  TRANSOVO-IA-NAVIGATION-STANDARDS.md          → Guide #3: Canonical IA & navigation
LEVEL 3  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md  → Guide #2: HCD & usability
LEVEL 4  TRANSOVO-PAGE-ARCHITECTURE-RULES.md          → Page structure & behavior
LEVEL 5  TRANSOVO-VISUAL-DESIGN-GUIDE.md              → Visual design system
LEVEL 6  Shared component library                     → Reusable UI components
LEVEL 7  TRANSOVO-ACCESSIBILITY-STANDARDS.md          → Guide #1
         TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Guide #4
         TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Guide #5
         TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md  → Guide #6
         TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md   → Guide #7
         TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Guide #8
         TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md → Guide #9
         TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Guide #10
         TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Guide #11
LEVEL 8  Existing implementation                      → Lowest authority; audit before copying
```

---

*Transovo Product Design & UX Governance. Read this document first. Then apply the governing documents in authority order. Cursor and Kimi must adhere to this system for all Transovo UI work.*
