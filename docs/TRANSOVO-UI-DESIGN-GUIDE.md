# Transovo UI Design Guide

**Status:** Active — required reference for all UI work  
**Audience:** Engineers, designers, and Cursor agents building or changing Transovo interfaces  
**Scope:** Information architecture, navigation, layout, interaction patterns, terminology, and visual hierarchy  
**Not in scope:** Company-specific “house style” mimicry (Shopify, Atlassian, etc.). These rules come from established HCI/UX practice: ISO 9241-210 human-centered design, Nielsen Norman usability heuristics, information architecture methods, Gestalt principles, WCAG predictability/navigation guidance, and enterprise design-system conventions.

**Related docs**

- Appointments product IA (card sort): see conversation / `src/lib/products/appointments-nav.ts`
- V1 launch nav flags: `src/lib/products/v1-launch-nav.ts`
- V1 UI rebuild directive: `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md`

---

## When to use this guide

**Follow these rules whenever you:**

- Add or change a page, drawer, modal, wizard, or settings surface
- Add or move navigation items (global or local)
- Design forms, lists, detail views, or dashboards
- Choose labels, button placement, status display, or error copy
- Decide whether something belongs in global nav, local nav, a tab, a contextual action, or settings

**If a design choice conflicts with this guide, resolve the conflict before shipping UI.**

---

## The application shell (non-negotiable)

Every normal authenticated page uses **one** application shell. Kimi (or any page template) must not reinvent chrome per screen.

```
┌─────────────────────────────────────────────────────────┐
│ Global header                                           │
├──────────┬──────────────────────────────────────────────┤
│ Global   │ Page header (title, primary action, context) │
│ sidebar  ├──────────────────────────────────────────────┤
│          │ Local navigation (when this domain has it)   │
│          ├──────────────────────────────────────────────┤
│          │ Content workspace                            │
└──────────┴──────────────────────────────────────────────┘
```

**Preserve spatial consistency:** search, primary actions, settings entry, and navigation placement must not move between pages. Users build spatial memory.

---

## Transovo domain definitions (mutually exclusive)

These definitions prevent IA drift. If a feature does not fit one definition cleanly, rename it, make it contextual, or question whether it belongs in the product.

| Domain | Mental model | User question it answers |
|--------|--------------|-------------------------|
| **Appointments** | Scheduled occurrences that already exist | “What’s on my calendar / list?” |
| **Booking** | Rules and surfaces for *creating* appointments | “How do customers book with me?” |
| **Contacts** | People | “Who is this customer?” |
| **Messages** | Appointment-related conversations (not marketing) | “What are customers saying?” |
| **Automations** | Rules Transovo runs automatically | “What should happen automatically?” |
| **Meetings** | AI notetaker: recording, transcript, recap | “What happened in the meeting?” |
| **Payments** | Money collected for appointments | “What was paid?” |
| **Analytics** | Aggregate performance | “How is the operation performing?” |
| **Integrations** | External system connections | “What is connected?” |
| **Settings** | Organization-wide configuration | “How is my account set up?” |

**Sharp distinctions (do not blur):**

- **Appointments vs Booking vs Calendar** — Appointments = existing scheduled items; Booking = creation rules/pages; Calendar is a *view* inside Appointments.
- **Messages vs Automations** — Messages = conversations; Automations = triggered rules (reminders, workflows).
- **Meetings vs Appointments** — Appointments = scheduled slot; Meetings = what happened in Zoom/Meet/Teams/Webex (recording, recap).
- **Integrations vs Settings** — Integrations = connect external systems; Settings = defaults and org policy (A2P, team, security).

**Appointment platform boundary:** Do not reintroduce legacy SMS marketing, Grow, contests, AI receptionist, or unrelated telephony into primary product IA unless explicitly in scope for that product.

---

## The 30 rules

### 1. Start with the user’s mental model, not the feature inventory

The question is not “What features did we build?” It is “How does the user mentally divide the work they came here to do?”

- Use **card sorting** (generative) to discover natural groupings.
- Use **tree testing** (evaluative) to verify findability in the proposed hierarchy.
- The feature matrix is **input** to IA, not the IA itself.

### 2. Categories must be mutually distinguishable

A user must not wonder which of two top-level labels a feature lives under.

- Avoid overlapping, vague, or catch-all categories (“Tools”, “Management”, “Other”).
- Top-level labels must be **descriptive, specific, and mutually exclusive**.

### 3. Match the system to the real world

Use language and concepts customers already understand—not internal architecture.

| Prefer | Avoid (internal only) |
|--------|------------------------|
| Appointment | Event object |
| Booking page | Scheduling resource |
| Reminder | Workflow execution |
| Contact | Party record |
| Payment | Merchant transaction entity |

Internal names may exist in code; they must not drive UI labels.

### 4. Recognition beats recall

Users should **see** choices and recognize what they need—not remember where a hidden setting lives.

**Bad:** “Where do I change which calendar blocks availability? Integrations? Settings? Booking?”

**Good:** Inside **Booking → Availability**, show connected blocking calendars inline, with a link: **Manage connected calendars**.

Use **contextual links** between related objects so users do not memorize configuration locations.

### 5. Information hierarchy must reflect importance

Structure communicates priority. Typical order on a page:

1. What this page is (title / context)
2. Primary task
3. Most important current information
4. Secondary controls
5. Advanced / configuration details

**Gestalt:** proximity groups related items; similarity groups controls of the same type. Spacing is semantic—not decoration.

**Example (appointment detail):**

- **Group A:** Customer, date/time, service, staff
- **Group B:** Confirmation, payment, SMS eligibility, reminder state (operational status)
- **Group C:** Activity timeline

### 6. Use progressive disclosure

Show common controls first; reveal advanced complexity when needed.

**Booking type — show first:** Name, duration, host, availability, location.

**Reveal under sections:** Advanced scheduling, customer questions, notifications & reminders, payments, confirmation, permissions.

Same capability; far less cognitive load.

### 7. Use consistency aggressively

Across the entire product:

- Same global sidebar on every normal page
- Same header structure
- Same primary button placement (primary action top-right of page header unless domain standard differs)
- Same meaning for status colors and badges
- Same terminology everywhere
- Same drawer / modal behavior
- Same filter placement (lists)
- Same save / cancel conventions
- Same form field order patterns where applicable
- Same delete confirmation behavior

One team designed this—not a page-by-page assembly.

### 8. Preserve spatial consistency

If search is always top-right, keep it there. If Settings is always in the global sidebar footer area, keep it there. Predictable placement speeds navigation (WCAG consistent navigation).

### 9. Global navigation and local navigation are different systems

| System | Question |
|--------|----------|
| **Global** | What major area of Transovo do I want? |
| **Local** | What part of *this* area am I working in? |

**Example**

- Global: **Appointments**
- Local: Calendar | List | Waitlist | Recalls

Do not promote every local view to global navigation. Side navigation is for hierarchical sub-navigation within a section (typically one to three levels).

### 10. Keep breadth and depth balanced

There is no magic “max 7 items” rule. Balance **breadth** (too many top-level items) vs **depth** (too many nested clicks).

- Too broad: 27 global menu items
- Too deep: Settings → Scheduling → Availability → Staff → Calendars → Conflict rules

**Target for Transovo:** ~7–10 meaningful global destinations with shallow local navigation underneath—because that matches the jobs we support, not because of a folklore number.

### 11. Minimize decision cost (Hick’s Law)

Do not present 18 choices when 3 fit the moment.

**Bad — one global “New” menu:** New appointment, booking page, booking type, workflow, reminder, contact, routing form, poll, campaign…

**Good — context determines action:**

- On **Appointments:** New appointment
- On **Contacts:** Add contact
- On **Automations:** New automation

### 12. Minimize memory load

Carry context forward. The system remembers; the user should not re-enter or re-find context.

| From | Action | System should already know |
|------|--------|----------------------------|
| Contact (Anthony) | Book appointment | Anthony |
| Appointment | Send message | Customer + appointment |
| Meeting recap | Create follow-up | Meeting, contact, appointment |

### 13. Actions belong next to the object they affect

On an **appointment**, place confirm, reschedule, cancel, message, payment, reminder override **on that appointment**.

- **Global Automations** = rules for many appointments
- **Appointment detail** = this appointment’s status and overrides

Do not force users into Automations to answer “Did John get tomorrow’s reminder?”

### 14. Separate objects from configuration

| Objects (frequent) | Configuration (occasional) |
|--------------------|----------------------------|
| Appointments | Availability schedules |
| Contacts | Booking types |
| Conversations | Reminder sequences |
| Meetings | Integrations |
| Payments | Team roles, A2P, security |

Objects deserve prominent navigation. Configuration is set up once and changed rarely—do not give it equal visual weight with daily work.

### 15. Visibility of system status

The product is asynchronous: calendar sync, SMS, reminders, OAuth, payments, notetaker, transcription, workflows.

Always show **state**, not static labels.

| Weak | Strong |
|------|--------|
| Microsoft | Microsoft 365 — Connected — Last synced 2 min ago |
| SMS reminder | Scheduled — Tomorrow 9:00 AM → Sent 9:00 AM → Delivered |

This principle applies across the entire UI.

### 16. Error prevention beats error messages

Prevent failures before they happen.

| Weak | Strong |
|------|--------|
| SMS failed: A2P required | Disable SMS + explain: Business texting registration required for imported appointments |
| Conflict on save | 2:00 PM unavailable — Microsoft Work Calendar (before save) |

### 17. Errors must explain the problem and the solution

| Weak | Strong |
|------|--------|
| Error 401 | Microsoft connection expired. Reconnect to resume sync. **[Reconnect]** |

When the system can recover silently, the user should not see an error at all.

### 18. User control and freedom

Provide cancel, back, undo where reasonable, restore where reasonable, confirmation before destructive actions, and easy reschedule instead of delete/recreate. Wizards must not trap users.

### 19. The system should be forgiving

Normalize phone numbers, times, and formats. Reconcile external calendar changes instead of duplicating. Eliminate avoidable work.

### 20. Focus the interface on frequent tasks

Something used every hour beats something configured twice a year for placement priority.

**Appointments** near the top. **SAML** deep in Settings. Feature completeness ≠ information architecture.

### 21. Shortcuts for experts without complicating novices

Later: global search, command menu, keyboard shortcuts, saved filters, duplicate booking type, clone workflow, bulk actions. Novices ignore them; power users depend on them.

### 22. Use plain, specific labels

Avoid: Tools, Management, Resources, Advanced, Miscellaneous, Other.

Use: Appointments, Contacts, Payments, Automations.

**One concept → one canonical name.** If the UI says “Booking type”, do not also call the same object “Service”, “Event type”, and “Appointment type” unless they are truly different entities.

### 23. Maintain clear location and wayfinding

Users must always know where they are. Descriptive page titles and headings are required.

Hierarchy should be apparent: `Booking / Booking types / Initial consultation` — breadcrumbs optional, clarity not optional.

### 24. Multiple ways to reach important things

The same **object** may be reachable from:

- Calendar
- Appointment list
- Contact record
- Home / dashboard
- Global search (when available)

That is multiple **access paths**, not multiple duplicate objects.

### 25. Keep workflows task-oriented

Multi-step flows ask for one coherent chunk per step—organized by user tasks, not database tables or APIs.

**Example — create booking type:** Basics → Hosts & availability → Booking rules → Customer information → Notifications → Payment → Confirmation.

### 26. Don’t make users configure what can be defaulted

Default timezone to workspace timezone, default reminder sequence, default calendar, default staff to current user when sensible. Only expose decisions that matter.

### 27. Destructive actions: spare and separated

Primary: **Save changes**. Delete / revoke / cancel booking type: **Danger zone** lower on the page, visually distinct from primary actions.

### 28. Accessibility is part of the system, not polish later

Design for:

- Logical focus order
- Visible keyboard focus
- Descriptive headings and labels
- Consistent navigation and component identification
- Predictable context changes

### 29. Test the information architecture

Expertise produces a **hypothesis**; validation produces confidence.

Recommended flow:

```
Feature inventory
    → User tasks / mental models
    → Taxonomy
    → Card sort
    → Proposed hierarchy
    → Tree test
    → Revise
    → Low-fidelity nav prototype
    → Task-based usability testing
    → UI design / implementation
```

Changing IA after screens are built is expensive. Test navigation before polishing pixels.

### 30. Evaluation lenses (professional framework)

Evaluate every UI decision against:

**Information architecture**

- Mental models, taxonomy, mutually exclusive labels
- Hierarchy, breadth vs depth, findability
- Card sort + tree test when structure changes

**Nielsen heuristics**

- Visibility of status, real-world language, user control
- Consistency, error prevention, recognition over recall
- Efficiency, minimalism, error recovery, help

**Gestalt / visual hierarchy**

- Proximity, similarity, common region, continuity, figure/ground

**Human-centered design (ISO 9241-210)**

- Understand users, tasks, context; involve users; evaluate; iterate; whole experience

**Accessibility / predictability (WCAG)**

- Focus, consistent navigation, consistent identification, descriptive labels, multiple findability paths

---

## IA placement checklist (every capability)

Before adding UI for any capability, answer:

| Question | Options |
|----------|---------|
| Object or configuration? | Object → prominent nav or contextual surface; Configuration → Settings / Booking setup |
| Daily or occasional? | Daily → higher in hierarchy |
| Which user job? | Must map to one domain definition above |
| Customer-expected location? | Tree-test mentally: “Where would I look?” |
| Navigation level? | Global nav · Local nav · Tab · Contextual action · Advanced settings only |
| Related links? | What object pages should link here with recognition, not recall? |
| Canonical term? | One label across product |

---

## Implementation references (appointments platform)

Current global IA implementation lives in:

- `src/lib/products/appointments-nav.ts` — sidebar structure
- `src/lib/products/appointments-routes.ts` — route helpers and domain prefixes
- `src/lib/products/appointments-settings-tabs.ts` — Settings / Integrations / Analytics subnav
- `src/components/layout/sidebar.tsx` — shell wiring
- `src/components/layout/app-shell.tsx` — page titles and layout

When changing navigation, update nav tests: `npx tsx scripts/test-appointments-nav.ts`

---

## What we do next (process, not pixels)

1. **Inventory** — complete capability list (appointment platform scope).
2. **Classify** — object vs configuration; frequency; domain; canonical term.
3. **Place** — global / local / tab / contextual / settings per checklist.
4. **Tree test** — validate findability for top tasks (see card-sort tree tests in product IA work).
5. **Page design** — apply rules 5–8, 13–19, 22–28 per surface.
6. **Ship** — one shell, consistent patterns, status visibility, progressive disclosure.

Do not skip steps 1–4 by jumping straight to sidebar labels or mockups.

---

## Quick “reject this design” triggers

Stop and redesign if:

- Two top-level nav items could reasonably contain the same feature
- User must remember where a related setting lives with no contextual link
- A list page hides critical async status (sync, delivery, payment, workflow)
- Primary and destructive actions are adjacent without separation
- The same concept has different names on adjacent screens
- A new page uses a different shell, header, or button placement “just for this screen”
- Configuration is promoted to the same level as daily operational objects
- A wizard has no cancel/back and no saved progress for long flows
- Error copy names a code or internal reason without a user fix

---

*This document is the authoritative UI ruleset for Transovo. When in doubt, prefer user mental models, mutual exclusivity, recognition over recall, and consistent shell behavior.*
