# Transovo Information Architecture & Navigation Standards Guide

**Series:** Implementation standards · **Guide #3 of 12**  
**Status:** Active — mandatory hard architectural standard between feature inventory and individual page designs  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** ISO 9241-110:2020 · WCAG 2.2 (Guidelines 2.4 Navigable, 3.2 Predictable) · W3C WAI · U.S. Web Design System (USWDS)

---

## Master Cursor rule

> **Transovo information architecture must be task-based, predictable, shallow enough to understand, and consistent across the product.** Follow ISO 9241-110 interaction principles and WCAG 2.2 navigation/predictability requirements. Every capability has **one canonical home**, **one canonical user-facing name**, and a **clearly defined parent domain**. Global navigation represents major recurring workspaces; local navigation represents peer views within those workspaces; actions stay on the pages where they are performed; states and filters do not become product navigation; organization-wide configuration belongs in Settings or Integrations. Multiple contextual paths may reach the same object, but must never create duplicate versions of that object. Repeated navigation must retain consistent order and identification. Users must always be able to determine where they are, predict where a destination belongs, and move between related objects without reconstructing context.

**This guide sits between the product feature inventory and individual page designs.** It is the hard architectural ruleset for how Transovo organizes information, names destinations, structures navigation, communicates hierarchy, and helps users find where they are going.

---

## Important distinction from Guides #1 and #2

There is **not** one international ISO standard that dictates a specific SaaS sidebar structure or says “use exactly seven navigation items.”

What **is** standardized are the underlying requirements around:

- predictable navigation
- meaningful labels
- user expectations
- location/orientation
- multiple ways to find content
- consistent identification
- logical hierarchy
- task suitability
- navigation accessibility

---

## Primary authorities

| Authority | Focus |
|-----------|--------|
| **ISO 9241-110:2020** | General interaction principles — suitability for user tasks, self-descriptiveness, conformity with user expectations, controllability, learnability, error robustness; intended to inform UI requirements, style guides, and interactive-system design |
| **W3C WCAG 2.2** | Guideline **2.4 Navigable** and Guideline **3.2 Predictable** |
| **W3C WAI** | Accessibility and navigation semantics |
| **U.S. Web Design System (USWDS)** | Official U.S. federal design-system guidance for hierarchical side navigation, breadcrumbs, and navigation patterns |

**Related Transovo guides**

- **Governance (read first):** `docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md`
- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Nav implementation: `src/lib/products/appointments-nav.ts`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Navigation must be organized around user tasks and concepts

ISO 9241-110 requires interaction to be suitable for the user’s task and conform to user expectations.

**Therefore:** Navigation must represent concepts and jobs users recognize, not internal architecture, database models, or implementation details.

**For Transovo — good:**

- Appointments
- Booking
- Contacts
- Messages
- Automations
- Meetings
- Payments
- Analytics

**Bad:**

- Event Engine
- Provider Connections
- Workflow Runtime
- Scheduling Objects
- Graph Sync
- Communication Eligibility

**Cursor rule:** Never expose a technical subsystem as primary navigation merely because it exists in the codebase.

---

## B. Every destination must have a clearly defined scope

Two neighboring navigation destinations should not force the user to guess where something belongs.

| Destination | Scope |
|-------------|--------|
| **Appointments** | Appointments that already exist |
| **Booking** | Rules and mechanisms that create appointments |
| **Contacts** | People/customer records |
| **Messages** | Actual conversations |
| **Automations** | Rules Transovo executes automatically |
| **Meetings** | Recordings, transcripts, recaps, and meeting intelligence |
| **Payments** | Transactions |
| **Analytics** | Aggregate operational performance |
| **Integrations** | Connections to external systems |
| **Settings** | Organization-level configuration |

**Cursor rule:** Every top-level destination must have a written definition. No two top-level destinations may intentionally represent substantially overlapping concepts.

---

## C. Navigation labels must describe purpose

WCAG 2.2 requires headings and labels to describe their topic or purpose.

Navigation labels therefore need to be:

- specific
- recognizable
- concise
- unambiguous
- written from the user’s perspective

| Good | Bad |
|------|-----|
| Appointments | Manage |
| Integrations | Connections & Resources |
| Reminder sequences | Communication configuration engine |

**Cursor rule:** Never use vague catch-all labels such as **Tools**, **Resources**, **Management**, **Other**, **Miscellaneous**, or **Advanced** as primary navigation categories.

---

## D. One concept gets one canonical name

WCAG requires components with the same functionality to be identified consistently. That principle applies strongly to information architecture.

If the object is called **Booking type**, don’t call it **Event type** on another page, **Service** elsewhere, or **Appointment type** somewhere else — unless those are actually different objects.

**Transovo canonical object vocabulary:**

- Appointment
- Booking type
- Booking page
- Contact
- Conversation
- Reminder sequence
- Workflow
- Meeting
- Payment

**Cursor rule:** Search the existing UI before introducing a new label for an existing concept. Prefer the established canonical term.

---

## E. Global navigation must remain consistent

WCAG 2.2 SC 3.2.3 requires repeated navigation mechanisms to occur in the same relative order unless the user initiates the change.

Therefore:

- same global navigation structure
- same item order
- same utility placement
- same active-state behavior
- same account/settings placement

across normal Transovo pages.

No page should invent a different sidebar because its designer preferred another layout.

**Cursor rule:** All normal application pages use the canonical global navigation component. Never fork page-specific versions of the main sidebar/header.

---

## F. Stable navigation placement builds spatial memory

W3C explicitly notes that consistent visual layout and source order allow users to use spatial cues and predict where repeated navigation will appear.

Therefore:

If Settings is bottom-left, global search is in the header, and page title begins at the same content position — **keep those relationships stable.**

A redesign of one page must not relocate global utilities.

---

## G. Global navigation is for major destinations, not every feature

A feature does not automatically deserve a sidebar entry. Global navigation should contain major recurring destinations.

**Examples that should not become global entries merely because they exist:**

- New appointment
- Reminder history
- Microsoft calendar
- SMS eligibility
- Teams meeting creation
- Booking approval
- A2P registration

These belong within appropriate domains.

**Cursor rule:** A capability qualifies for global navigation only if it represents a distinct, recurring user workspace rather than an action, setting, state, or subordinate feature.

---

## H. Navigation destinations and actions must be separated

**Navigation means:** Go somewhere.  
**Actions mean:** Do something.

**Sidebar:** Appointments  
**Page action:** New appointment

**Not:** Appointments and New appointment as two equal navigation destinations.

Similarly:

- Add contact → action
- Create workflow → action
- Export → action
- Connect Microsoft → action

**Cursor rule:** Do not put verbs/actions into persistent global navigation unless the action actually represents a durable workspace.

---

## I. Global and local navigation are different levels

**Global navigation answers:** Which major product area?

**Local navigation answers:** Which view inside this area?

**Example:**

- **Global:** Appointments
- **Local:** Calendar | List | Waitlist | Recalls

USWDS describes side navigation as hierarchical navigation for levels within a section.

**Cursor rule:** Do not promote every local subsection into the global sidebar.

---

## J. Local navigation must contain peer concepts

Tabs or local navigation should represent comparable views or subsections of the same parent.

**Good:** Calendar | List | Waitlist | Recalls

**Bad:** Calendar | Create appointment | Export | Settings

Those mix destinations, actions, and configuration.

**Cursor rule:** Local navigation contains peer destinations only. Actions belong in action controls; configuration belongs contextually or under settings.

---

## K. Hierarchies should be as shallow as practical

There is no formal universal “three clicks” rule. But ISO’s task-suitability and efficiency principles strongly argue against unnecessary nesting, while USWDS side-navigation patterns are designed around understandable hierarchical relationships.

**Transovo target:**

```
Global domain → local view/object list → object/detail
```

Usually no deeper than necessary.

**Good:** Booking → Booking types → Consultation

**Poor:** Booking → Setup → Scheduling → Types → Services → Consultation

**Cursor rule:** Do not introduce a navigation level merely to group one or two obvious destinations.

---

## L. Do not flatten everything just to avoid hierarchy

The inverse matters too. A sidebar with 30 unrelated links may technically be shallow but still imposes too much scanning and categorization burden.

Depth and breadth must be balanced around meaningful user concepts.

**Cursor rule:** Prefer a small number of meaningful parent categories with clear local navigation over a flat list of every capability.

---

## M. One feature has one canonical home

A feature can be reachable from multiple contexts. It still gets one authoritative management location.

**Example — Reminder sequence**

- **Canonical management:** Automations → Reminder sequences
- **Referenced from:** appointment, booking type, calendar configuration

Those contextual links should reach the same underlying object, not create separate copies of its editor.

**Cursor rule:** Multiple access paths are encouraged; duplicated feature implementations are not.

---

## N. Important pages should have multiple findability paths

WCAG 2.2 SC 2.4.5 requires more than one way of locating pages within sets of pages, except for steps in a process.

For an application, important objects can appropriately be reached through:

- navigation
- search
- contextual relationships
- dashboard queues
- related records

**Example appointment:**

- Appointments calendar
- Appointment list
- Contact record
- Dashboard
- Search

**Cursor rule:** Do not force users to return to the global navigation tree whenever the system already knows the related destination.

---

## O. Multiple routes should lead to the same object

Multiple findability does not mean creating duplicates.

If appointment A123 is opened from Contact, Calendar, or Search, the authoritative appointment remains A123. Its status, reminders, payment, meeting, and activity must remain identical.

---

## P. Related objects need associative navigation

Users frequently navigate relationships rather than hierarchies.

| From | Link |
|------|------|
| Appointment | Contact → Anthony Johnson |
| Meeting | Appointment → Initial consultation |
| Contact | Next appointment → Sep 8, 2 PM |
| Payment | Appointment → Initial consultation |

Those should be links.

**Cursor rule:** Related primary objects should expose direct navigation to each other wherever that relationship is useful to the current task.

---

## Q. Preserve context when following relationships

If a user opens an appointment from Calendar, a quick detail drawer may preserve the calendar context better than immediately replacing the entire workspace.

If deeper work is needed, **Open full appointment** can navigate to the full record.

Navigation should account for where the user came from and what they were doing.

---

## R. Breadcrumbs represent hierarchy, not browsing history

USWDS explicitly describes breadcrumbs as showing where the current page sits in the site hierarchy and notes they are not appropriate as a representation of a step-by-step process.

**Good:** Booking / Booking types / Initial consultation

**Bad:** Home / Search / Anthony / Appointment / Edit — merely because those happened to be the user’s previous clicks.

**Cursor rule:** Breadcrumbs represent structural ancestors, never arbitrary browser history.

---

## S. Don’t use breadcrumbs unnecessarily

USWDS notes breadcrumbs may be unnecessary when:

- the site is shallow
- the hierarchy is already obvious
- existing navigation communicates location sufficiently

Do not mechanically add breadcrumbs to every Transovo page.

For **Appointments**, the active sidebar item + page heading may be sufficient.

For **Booking → Booking type → Consultation**, a breadcrumb/back relationship becomes more useful.

---

## T. Step-based processes use a stepper, not breadcrumbs

**Example A2P registration:** Business → Messaging use → Consent → Review

That’s a process. It should not be presented as:

Settings / Messaging / Business / Messaging Use / Consent

Use process navigation such as a step indicator. USWDS explicitly distinguishes hierarchical breadcrumbs from linear processes.

---

## U. Users must be able to determine where they are

WCAG Guideline 2.4 is specifically about helping users navigate, find content, and determine location. It includes an explicit AAA location criterion as well.

Transovo should provide location through combinations of:

- active global destination
- page heading
- local active tab
- breadcrumb when hierarchy warrants it
- object title on details

A user should not need the URL to know where they are.

---

## V. Every page requires a descriptive page title

WCAG 2.4.2 requires page titles that describe topic or purpose. Browser/document title should reflect the current context where practical.

**Examples:**

- Appointments — Transovo
- Initial consultation — Booking types — Transovo
- Anthony Johnson — Contacts — Transovo

**Not:** Dashboard on every route.

---

## W. Every page needs a clear primary heading

WCAG requires headings and labels that describe topic or purpose. The visible page heading should reinforce the current navigation destination.

**Example:**

- Sidebar active: Automations
- Local tab: Reminder sequences
- Page heading: **Reminder sequences**

Not: Messaging Automation Engine. Terminology should align.

---

## X. Link purpose must be understandable

WCAG requires link purpose to be determinable from the link text or its programmatically determined context.

Avoid repeated ambiguous links such as **Click here**, **More**, or **View** when context does not sufficiently establish the destination.

**Better:** View appointment · Open contact · Manage Microsoft calendars

---

## Y. Avoid duplicate labels that lead to unrelated places

Do not have **Calendar** in the sidebar, under Booking, and under Integrations if they represent three different concepts.

Use differentiated labels:

- Appointments → Calendar
- Booking → Availability
- Integrations → Connected calendars

**Cursor rule:** When two destinations could reasonably be confused, change their labels until their scopes can be predicted without opening them.

---

## Z. Navigation should conform to familiar conventions

ISO 9241-110’s conformity-with-user-expectations principle means familiar interactions should behave familiarly.

**Examples:**

- logo/home affordance behaves consistently
- sidebar items navigate
- tabs switch peer content
- breadcrumb ancestors navigate upward
- back returns to previous/parent context appropriately
- selected nav item appears selected

Do not invent a new interaction vocabulary for common navigation.

---

## AA. Do not trigger navigation merely from focus

WCAG 3.2.1 prohibits a component receiving focus from automatically changing context.

Keyboard user tabs to **Appointments** — that must not navigate merely because it received focus. Navigation occurs on activation.

---

## AB. Input changes should not unexpectedly navigate

WCAG 3.2.2 says changing a UI setting should not unexpectedly cause a context change unless users are advised beforehand.

**Example:** Selecting **Staff: Sarah** from a filter should filter results. It shouldn’t suddenly navigate to Sarah’s profile unless that behavior is explicitly communicated.

---

## AC. Preserve user orientation after navigation

When users move between related views, the destination should provide enough contextual continuity to explain where they arrived.

**Example — Contact → appointment**

Destination shows:

```
Initial consultation
Anthony Johnson
Sep 8 · 2:00 PM
```

Not a generic page with no obvious relationship.

---

## AD. Back behavior must be predictable

Distinguish:

| Type | Meaning |
|------|---------|
| **Browser Back** | Previous navigation state/history |
| **Structural Back** | Parent workspace |

**Example:** ← Booking types inside a Booking Type editor.

Avoid controls labeled simply **Back** when it is unclear whether they mean previous browser page, parent section, cancel, or previous wizard step.

---

## AE. Preserve list state when returning from a detail

If a user:

1. searches appointments
2. filters to Unconfirmed
3. scrolls
4. opens an appointment
5. returns

the app should preserve reasonable state: query, filters, sort, pagination/scroll where practical.

Forcing users to reconstruct the same view harms efficiency.

---

## AF. Tabs should preserve predictable state

When switching Calendar → List → Calendar, the application should preserve relevant date/filter state where doing so matches user expectations.

Do not reset to today’s date or erase filters for no reason.

---

## AG. URL/state should support meaningful navigation where practical

Important workspaces and objects should have durable routes.

**Examples:** appointment detail, contact detail, booking type, workflow, meeting recap

This enables browser navigation, deep links, sharing internally, and restoring context.

Pure transient UI state should not unnecessarily become separate routes.

---

## AH. Do not create pages for simple states

Don’t create separate global pages for **Confirmed appointments**, **Failed reminders**, or **Paid appointments** when those are better represented as filters, views, or status queues.

Navigation should remain structurally stable even as data states change.

---

## AI. Status is not taxonomy

**Needs attention** may be an operational queue. It is not generally a permanent information category.

Likewise **Failed**, **Pending**, **Confirmed**, and **Disconnected** are states. Do not confuse state with product architecture.

---

## AJ. Configuration and operational work should be separated

**Operational objects:** appointments, contacts, messages, meetings, payments

**Configuration:** business settings, calendars, A2P, permissions, integrations

A common architecture problem is mixing these as equals.

**Cursor rule:** Frequently operated business objects receive higher navigational prominence than infrequent system configuration.

---

## AK. Local configuration stays with the object it affects

**Example — Payment required for a booking type:**

Booking → Booking type → Payment

**Not:** Settings → Payments → Booking behavior → Type X

**Global provider connection:** Integrations → Payments

This distinction reduces navigation cost.

---

## AL. Global Settings holds defaults and organization-wide behavior

Settings should not become a duplicate copy of the product.

**It may contain:** organization defaults, account settings, team/security, messaging registration, default calendar behavior

**It should not contain complete copies of:** Booking Types, Reminder Sequences, Contacts, Appointment management

**Cursor rule:** Settings controls global/default behavior; primary product objects remain in their canonical domain.

---

## AM. External-system connections belong together

For Transovo, connecting Microsoft or Google is conceptually **Integrations → Calendars** rather than making **Microsoft** a global navigation destination.

Similarly **Stripe / Square** belong under payment integrations/configuration. The provider is subordinate to the user’s job.

---

## AN. Feature flags/entitlements should not contaminate the IA

If a feature isn’t available to a user:

- hide it where it would otherwise create irrelevant clutter, or
- show it intentionally where discovery/upgrade is part of the product strategy

Do not produce a sidebar full of permanently disabled modules. Navigation should reflect usable product structure.

---

## AO. Role-based navigation must remain coherent

A staff member may have fewer destinations than an owner. That’s acceptable.

But the remaining destinations should preserve normal ordering, normal names, and normal grouping.

Do not invent an entirely different product architecture per role unless their work truly differs substantially.

---

## AP. Avoid excessive nested sidebar accordions

Collapsing 30 items into accordions does not actually solve information overload.

If every primary section expands into six children, the sidebar simply becomes a hidden tree of complexity.

**Cursor rule:** Global navigation should select the workspace. Local navigation generally handles depth within that workspace.

---

## AQ. Sidebar section headings should create meaningful grouping

If visual groups are used, they should communicate conceptual relationships.

**Possible logical groupings:**

```
WORK
  Appointments
  Messages
  Contacts
AUTOMATE
  Booking
  Automations
  Meetings
BUSINESS
  Payments
  Analytics
```

The headings themselves should be visually subordinate. Do not create a section heading for every two links just to decorate the sidebar.

---

## AR. Ordering should be stable and purposeful

Order global navigation based on:

- task frequency
- task importance
- conceptual workflow
- user expectations

**Not:** alphabetical order, order features were implemented, database/domain order

Once established, avoid unnecessary reordering because users develop spatial memory. W3C’s consistent-navigation guidance explicitly recognizes this benefit.

---

## AS. The most frequent destination should be inexpensive to reach

If Appointments is the operational center of Transovo:

- it gets prominent placement
- Home should link into it
- relevant contacts/meetings should link back into appointments

Do not make the highest-frequency workflow navigate through lower-frequency setup areas.

---

## AT. Deep configuration can use within-page navigation

A long settings/editor page can use section navigation, tabs, or anchored subsections where those sections are meaningful.

Do not create 15 separate routes solely because a configuration object has 15 groups of fields.

---

## AU. Do not use tabs merely to make a page look organized

Tabs introduce navigation and hidden content. Use them when sections are:

- meaningful peers
- independently useful
- understandable without seeing simultaneously

If users need to compare two sections at once, hiding them behind tabs may be wrong.

---

## AV. Don’t use accordions for frequently compared information

Accordions are useful for progressive disclosure. They are poor when users repeatedly need to scan several sections together.

Choose architecture according to the task, not aesthetics.

---

## AW. Search complements navigation; it does not repair bad navigation

Global search can help users reach appointments, contacts, and meetings quickly.

But do not rely on search because the hierarchy is confusing.

**Cursor rule:** Primary information architecture must remain understandable without requiring search.

---

## AX. Search scopes must be explicit

If global search searches contacts, appointments, and meetings, say so through result grouping or labels.

If a page search only searches contacts, keep it within Contacts.

Do not make users guess what a search field covers.

---

## AY. Filters stay within the object domain they operate on

**Example:** Appointment status filter belongs on Appointment list/calendar. It is not navigation.

Likewise date filter, staff filter, and booking type filter are view controls.

Do not put changing datasets into the global navigation tree.

---

## AZ. Saved views are shortcuts, not new product domains

If users save **Tomorrow’s unconfirmed appointments**, that’s a user-created view. It does not become a new top-level architectural category.

---

## BA. Navigation must remain usable with long labels and realistic data

Do not design solely around short English labels. Test:

- longer section names
- narrow viewport
- translated labels eventually
- badges/counts
- role variation

The IA should survive realistic UI constraints.

---

## BB. Counts/badges must not destabilize navigation

A navigation item can display **Messages 4** if meaningful.

But dynamic counts should not:

- shift labels
- alter ordering
- become the only indication of status
- produce dozens of distracting badges

Use notification counts selectively.

---

## BC. New/attention indicators need consistent meaning

If a dot means **new item** everywhere, keep that meaning.

If amber means **needs attention**, do not use the same treatment merely to advertise a new feature.

Navigation status needs semantic discipline.

---

## BD. Navigation should not become an alert center

System problems can be indicated contextually.

But don’t add **Microsoft error**, **reminder failure**, **payment failure**, or **A2P pending** as separate navigation destinations.

Those are states that should link users to their canonical locations.

---

## BE. Page hierarchy should map to URL hierarchy where practical

Not every URL has to mirror navigation literally. But meaningful relationships are beneficial:

```
/appointments
/appointments/:id
/booking/types
/booking/types/:id
/automations/workflows
/automations/workflows/:id
```

Avoid route structures that reveal obsolete implementation concepts even though the UI claims a new IA.

---

## BF. Legacy routes may redirect; legacy navigation must not remain

If old routes exist for compatibility, that’s fine.

But do not preserve obsolete duplicate menu destinations solely because legacy routes still exist.

Canonical navigation controls the product’s conceptual architecture.

---

## BG. One primary navigation system should dominate

Do not simultaneously give users:

- giant sidebar
- giant global header menu
- second nested sidebar
- top nav with duplicates

A secondary local system is fine. Multiple competing global systems are not.

---

## BH. Navigation must remain understandable at responsive breakpoints

WCAG consistency still applies when layouts adapt; repeated navigation should stay predictable within the same page variation.

| Breakpoint | Pattern |
|------------|---------|
| **Desktop** | persistent/collapsible sidebar |
| **Mobile** | drawer/menu |

The structure, labels, and order should remain conceptually the same. Mobile is not a different IA.

---

## BI. Mobile should not hide essential destinations permanently

Reduced screen space can change presentation. It should not make Payments, Settings, or Integrations impossible to reach.

The complete authorized architecture still needs a route.

---

## BJ. Focus order must track meaningful navigation order

WCAG 2.4.3 requires focus order to preserve meaning and operability.

If visual nav order is Home → Appointments → Booking → Contacts, keyboard order should not begin Settings → Contacts → Home because CSS visually rearranged it.

---

## BK. Skip navigation must be available where repeated blocks exist

WCAG 2.4.1 requires a mechanism for bypassing repeated blocks.

For Transovo, implement a reliable **Skip to main content** mechanism so keyboard users don’t traverse the entire sidebar on every route.

---

## BL. Persistent help should remain consistently located

WCAG 2.2 introduced **Consistent Help**: repeated help mechanisms must occur in consistent relative order.

If Transovo has persistent support, help, documentation, or AI help — keep its placement predictable.

Don’t put Support in the header on one screen, footer on another, and sidebar on another without reason.

---

## BM. Empty states must preserve architectural orientation

Even when there is no data, **Booking types** should remain visibly inside **Booking**.

The empty state does not replace the architecture.

**Good:**

```
Booking
Booking types
No booking types yet.
```

**Not:** Welcome! Let’s get started! with no indication where the user actually is.

---

## BN. First-run onboarding must not create a second permanent architecture

Setup checklists and guided onboarding can provide shortcuts.

After onboarding, the same object should still live in its canonical location.

**Example:** Setup checklist **Create booking type** takes the user to **Booking → Booking types** — not a special separate onboarding implementation that creates something different.

---

## BO. Wizards represent process state, not product hierarchy

During A2P registration, steps might be: Business → Use case → Consent → Review.

Those steps disappear after the process. Do not add them to persistent Settings navigation.

---

## BP. Object creation returns users to a meaningful context

**Example — From Appointment Calendar:**

New appointment → Save should return/show the new appointment in calendar or detail drawer — rather than sending the user to an unrelated generic success page.

Context after navigation matters as much as before navigation.

---

## BQ. Deleting an object must result in a valid destination

If user deletes **Booking type / Initial consultation**, the interface cannot leave them on a nonexistent route.

Return to **Booking → Booking types** with appropriate confirmation.

---

## BR. Missing/unauthorized objects need meaningful recovery

If a deep link points to a deleted appointment, object user lacks permission to view, or unavailable booking type — don’t display a generic blank 404 if the application can provide useful context.

**Examples:**

- This booking type no longer exists. Return to Booking types.
- You don’t have permission to view this workflow. Return to Automations.

---

## BS. External navigation should be distinguishable where it matters

Links that leave Transovo for Microsoft, Stripe, Square, or public booking page preview should avoid surprising users.

Where material, indicate that they’re opening an external destination or preview.

---

## BT. Public/customer navigation is a separate IA from admin navigation

This is critical.

**Customer journey:** choose booking type → choose time → information → confirm

**Admin journey:** configure booking type → availability → payments → reminders

Different users, different goals, different architecture.

Do not leak admin navigation into public booking experiences.

---

## BU. Authentication/onboarding has a separate temporary navigation model

Login, signup, recovery, and setup can use a simplified shell. They do not need the full operational sidebar.

Once inside normal application work, return to the canonical app shell.

---

## BV. Immersive builders may temporarily reduce global navigation

For workflow builder or complex routing builder, workspace efficiency may justify collapsing/minimizing normal navigation.

But there must always be a clear route back: **← Workflows**

This is a temporary workspace mode, not a new product hierarchy.

---

## BW. Current-page state must be programmatically identifiable

The active destination cannot rely only on a subtle visual difference.

For accessible navigation, expose appropriate current-state semantics such as `aria-current` where applicable. Visual state and semantic state should agree.

---

## BX. Repeated navigation controls need consistent accessible names

If the sidebar is labeled **Main navigation**, use a consistent label.

If secondary navigation is **Booking navigation**, make it distinct.

Screen-reader users should be able to distinguish multiple navigation regions.

---

## BY. Never create fake hierarchy solely from indentation

If an item visually appears as a child, it should actually be conceptually and semantically subordinate.

Do not indent **Settings** under **Analytics** merely for layout convenience. Visual hierarchy must reflect real IA.

---

## BZ. Architecture changes require an inventory pass

Before moving/removing a navigation destination:

1. Identify every feature currently under it.
2. Assign each feature a new canonical home.
3. Update contextual links.
4. Update terminology.
5. Redirect old routes as appropriate.
6. Ensure no orphaned UI exists.

**Cursor rule:** Never remove a navigation item until every reachable capability underneath it has been accounted for.

This is particularly important for the Transovo redesign.

---

## CA. Architecture decisions must be documented separately from visual decisions

Do not justify “Booking belongs above Contacts because it looks better there.”

Architecture decisions should be based on:

- task model
- conceptual relationship
- frequency
- expected location
- hierarchy

Visual styling comes afterward.

---

## CB. Card sorting is an IA discovery method, not implementation truth

For large feature inventories:

- put concepts/features into cards
- group them according to user mental models
- identify candidate labels

The result is a hypothesis. Do not hard-code the first grouping merely because the design team produced it.

---

## CC. Tree testing validates findability before visual design

Once a hierarchy exists, test realistic tasks against the text tree.

**Example task:** Where would you go to change the time customers can book you?

**Expected:** Booking → Availability

If many users expect Settings → Calendar, that’s evidence the taxonomy or labels may need work.

Cursor doesn’t simulate human research results; it preserves the architecture so actual testing can be performed.

---

## CD. Navigation should be evaluated using tasks, not aesthetics

Tests should resemble:

- Find an appointment and reschedule it.
- Connect Microsoft Calendar.
- Find out why an SMS didn’t send.
- Change the default reminder sequence.

**Not:** Which sidebar looks cleaner?

Findability is an outcome.

---

## CE. Measure IA failure signals

Useful signals include:

- repeated backtracking
- wrong-section visits
- search immediately after opening nav
- excessive support questions such as “where is X?”
- repeated use of browser back
- abandonment
- users entering Settings for operational actions

Those indicate architecture problems. Do not automatically add more links to solve them.

---

## CF. Do not compensate for bad IA with duplicate shortcuts everywhere

Contextual shortcuts are valuable.

But if every screen needs links saying “Looking for Booking Types? Click here.” the underlying hierarchy may be wrong.

Fix the architecture rather than accumulating patches.

---

## CG. Architecture should survive product growth

When a new capability is added, it should usually have an obvious parent.

| New capability | Expected parent |
|----------------|-----------------|
| New reminder delivery option | Automations / Reminder sequence |
| New calendar provider | Integrations / Calendars |
| New appointment lifecycle state | Appointments |

If every new feature demands another top-level navigation item, the taxonomy is too feature-driven.

---

## CH. Taxonomy must not be based on current code ownership

Engineering teams may own calendar service, messaging service, or AI service. Users do not care.

Product architecture should remain stable even if backend services are refactored.

---

## CI. Information architecture must remain source-of-truth documented

For Transovo, maintain one canonical IA map documenting:

```
Global domain
  → local destinations
  → canonical objects
  → contextual relationships
  → settings ownership
```

Cursor must consult it before adding new navigation.

**Implementation references:**

- `docs/TRANSOVO-UI-DESIGN-GUIDE.md` — domain definitions and placement principles
- `src/lib/products/appointments-nav.ts` — canonical global/local nav structure

---

## CJ. Every new feature needs an IA placement decision

Before creating a UI for any future feature, Cursor should answer:

1. What user job does it serve?
2. What canonical object does it affect?
3. What is its primary home?
4. Is it global, local, contextual, settings, or process-only?
5. What existing locations should link to it?
6. Does it introduce terminology that overlaps existing concepts?

**No placement → no new route yet.**

---

## CK. Canonical Transovo global architecture

Based on the inventory already scoped, the approved top-level architecture should remain:

```
Home
Appointments
Booking
Contacts
Messages
Automations
Meetings
Payments
Analytics
────────────
Integrations
Settings
```

This is not because a formal standard mandates those ten labels.

It is our task-model implementation of the standards:

- distinct user domains
- understandable labels
- shallow structure
- predictable navigation
- consistent terminology
- clear separation between work and configuration

---

## CL. Canonical local architecture

### Appointments

Calendar · List · Waitlist · Recalls

### Booking

Booking types · Booking pages · Availability · AI booking · Routing · Meeting polls

### Contacts

Primary list + contextual contact detail.

### Messages

Inbox — use filters rather than artificial navigation where possible.

### Automations

Reminder sequences · Workflows · Templates · Activity

### Meetings

Upcoming · Recaps

### Payments

Transactions

### Analytics

Overview · Booking · Reminders · Automations · Reports

### Integrations

Calendars · Payments

### Settings

Business · Team · Messaging · Calendar · Meetings · Security · Billing

---

## Transovo IA / Navigation Acceptance Checklist

Before a page, route, or navigation change is considered complete:

- [ ] Feature has one defined user job
- [ ] Feature has one canonical home
- [ ] Top-level category scope is documented
- [ ] No sibling category materially overlaps its meaning
- [ ] Label uses canonical user-facing terminology
- [ ] Same concept uses same label elsewhere
- [ ] Global navigation remains in canonical relative order
- [ ] Page uses canonical global navigation component
- [ ] Action has not been incorrectly promoted into navigation
- [ ] State/filter has not been incorrectly promoted into navigation
- [ ] Local navigation contains peer destinations only
- [ ] Hierarchy is no deeper than necessary
- [ ] Important object can be reached through useful contextual paths
- [ ] Multiple paths resolve to same authoritative object
- [ ] Related objects cross-link where useful
- [ ] Breadcrumbs, when used, represent hierarchy
- [ ] Process steps are not represented as breadcrumbs
- [ ] Current page/location is obvious
- [ ] Browser/document title describes current context
- [ ] Visible primary heading describes current page
- [ ] Link purpose is understandable
- [ ] Navigation does not change merely on focus
- [ ] Filter/input changes do not unexpectedly navigate
- [ ] List/filter state is preserved when returning where practical
- [ ] Responsive navigation preserves same conceptual architecture
- [ ] Keyboard order matches meaningful navigation order
- [ ] Skip-to-main mechanism exists
- [ ] Persistent help location remains consistent
- [ ] Unauthorized/removed objects have meaningful recovery
- [ ] Public/customer flows do not inherit admin navigation
- [ ] Legacy routes do not create duplicate canonical destinations
- [ ] New navigation does not expose backend implementation terminology
- [ ] Feature remains discoverable without requiring search
- [ ] Architecture documentation updated with any approved changes

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md           → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md  → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md         → IA & navigation (this file)
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md → Forms & validation
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md  → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                             → IA principles & domain definitions
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                     → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                         → Visual tokens
src/lib/products/appointments-nav.ts                    → Canonical nav implementation
```

---

*Guide #3: Information Architecture & Navigation Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*
