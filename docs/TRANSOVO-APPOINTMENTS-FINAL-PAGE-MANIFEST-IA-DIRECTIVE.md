# Transovo Appointments — Final Page Manifest + IA Reorganization Directive

**Status:** Active — **highest IA authority for Appointments product UI reorganization**  
**Audience:** Cursor, Kimi Mode 4 (appointments only), product engineering  
**Effective:** 2026-09-09  
**Scope:** Appointments / scheduling / service-booking customer-facing UI (excludes MCTB, Mass SMS, Smart Routing, Fax)

---

## Purpose

We are reorganizing the **Appointments** product so the full feature set is easy to understand and use.

**This is NOT a site-wide redesign.**

A large amount of the existing Transovo UI already looks correct and should be **preserved**.

### Four bookable objects (2026-09-10)

Booking admin uses **Meetings**, **Services**, **Classes**, and **Workshops** as first-class destinations under Booking — not a generic "Booking Types" hub. See `docs/APPOINTMENTS-FOUR-BOOKABLE-OBJECTS-IA.md`.

### Goals

1. Put every feature in the correct user-facing place.
2. Split overloaded workflows where necessary.
3. Merge temporary parity pages into their real homes.
4. Add missing functionality to existing polished pages **without damaging** their current design.
5. Create only the genuinely necessary new pages.
6. Make every new page visually consistent with the current Transovo Home / Appointments Overview design language and the universal Transovo UI/UX standards.

---

## Authority order (Appointments IA pass)

When documents conflict, resolve in this order:

1. **This directive** — page placement, preservation rules, migration map
2. `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` — global IA principles
3. `docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md` — V1 product boundary
4. `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` — feature completeness
5. `docs/APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md` — per-route classification (living doc)
6. All Transovo standards guides (accessibility, forms, tables, interaction, visual, HCD)
7. Existing code and screenshots — **evidence only**, not placement authority

---

## Design authority

Use these authorities together:

1. Transovo Information Architecture & Navigation Standards Guide
2. Transovo UI Design Guide
3. Transovo Visual Design Guide
4. Transovo Human-Centered Design & Usability Standards Guide
5. Transovo Forms, Input & Validation Standards Guide
6. Transovo Table & Grid Semantics Standards Guide
7. Transovo Interaction, Keyboard & Focus Standards Guide
8. Current Appointments scope authority (`docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md`)
9. Current Appointments master feature inventory (`docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md`)
10. **This final IA/page-manifest directive**

### Important visual reference

Use the current **`/appointments/overview`** Home screen as the **primary visual / art-direction reference** for newly created Appointments pages.

The Home screen contains the newer Transovo visual treatment to carry forward:

- typography choices
- font sizing
- text hierarchy
- color treatment
- visual density
- card treatment
- spacing rhythm
- border/shadow restraint
- button language
- overall modern SaaS feel

**DO NOT** blindly copy the Home layout onto every page. Use it as **visual design reference**.

Page structure must still follow the appropriate page type:

- lists / tables
- editors
- detail pages
- settings
- builders
- operational screens

The universal design guides remain authoritative for those patterns.

### Art direction vs template (critical)

| Home screen is… | Home screen is NOT… |
|-----------------|---------------------|
| Art-direction source for typography, color, density, hierarchy | A layout template for every page |
| Reference for modern Transovo tone | Permission to turn Packages into a dashboard |

**Example:** A list page should still behave like a list page. An editor should still be an editor. The Home screen provides **art direction**; universal standards provide **component and interaction rules**.

---

## Critical preservation rule

Before touching **ANY** page, classify it as:

| Classification | Meaning |
|----------------|---------|
| **KEEP** | Correct, polished, no new functionality needed — **hands off** |
| **EXTEND** | Good placement; add functionality in existing design language |
| **REORGANIZE** | Right job; poor hierarchy after parity growth |
| **SPLIT** | Multiple distinct user jobs on one surface |
| **MERGE** | Temporary or duplicate UI; capability belongs elsewhere |
| **RETIRE** | No lasting user job after migration |
| **NEW** | Genuinely missing canonical surface |

Then follow the appropriate rule below.

### KEEP

Existing page is already correctly placed, polished, and does not need new functionality.

**RULE: DO NOT TOUCH IT.**

Do not:

- restyle it
- refactor it
- move components
- change typography
- change spacing
- "clean it up"
- regenerate it

Examples may include:

- polished Home
- polished Calendar
- polished Contacts
- polished Messages
- polished Analytics
- polished Meetings / Recaps
- any other page already matching current Transovo quality

If the page is not involved in this IA migration, **leave it alone**.

### EXTEND

Existing page is good and correctly placed, but new functionality belongs on it.

**RULE: KEEP THE EXISTING DESIGN.**

Inspect the existing page carefully and add new functionality using:

- same typography
- same spacing system
- same components
- same field styles
- same button styles
- same card/table patterns
- same header structure
- same responsive behavior

Determine where the new feature logically belongs in the existing hierarchy.

**Do NOT redesign the rest of the page.**

Examples: Availability, Staff, Locations, Booking Pages, Appointment Detail, Contact Detail, Integrations, Settings.

### REORGANIZE

Existing page contains the right user job but parity additions have made the information hierarchy poor.

**RULE:** Preserve strong existing visual components. Reorganize:

- grouping
- sections
- local navigation
- progressive disclosure
- action placement

Do not redesign simply for novelty.

Example: Availability → Schedules / Special Dates / Booking Rules / Preferences / Diagnostics.

### SPLIT

Existing page now combines genuinely different user jobs.

**RULE:** Create separate focused experiences. Reuse existing components and working code where possible. Do not create one generic giant conditional editor.

**Major required splits:**

| Current | Target |
|---------|--------|
| Generic Booking Types (MEETING / SERVICE / CLASS mega-editor) | Meetings · Services · Classes · Workshops & Events |
| Mega Commerce / parity page | Real destinations under Packages & Sales, Booking, Contacts, Integrations |

### MERGE

Temporary parity page represents a feature that belongs inside another canonical page.

**RULE:** Move the capability into its proper destination. Preserve working backend/runtime. Remove duplicate UI **only after** canonical destination works.

### RETIRE

Temporary hub or obsolete page has no lasting user job after migration.

**RULE:** Do not delete working runtime/backend. Retire the customer-facing route/navigation after all functionality has been relocated and verified.

### NEW

A truly new page is required.

**RULE:** Design it intentionally.

For **EVERY NEW PAGE:**

1. Inspect `/appointments/overview`
2. Inspect 2–3 best existing Transovo pages of the same page type
3. Use the universal UI/UX guides
4. Create a page-specific task hierarchy
5. Use the current Transovo visual language
6. Do not create a generic generated-looking admin form
7. Do not expose backend terminology

---

## Global UX rule

The number of features may be large.

**The amount of complexity shown to one user at one time must not be large.**

Do not solve complexity by:

- hiding things under vague labels
- creating 25 tabs
- creating 25 sections on one page
- exposing internal object names
- forcing users to navigate elsewhere for dependencies

Instead use:

- clear object-specific workflows
- progressive disclosure
- contextual creation
- focused pages
- meaningful subsections
- drawers/modals for simple related creation
- full child pages for genuinely complex objects

---

## Final user-facing product architecture

```
HOME

APPOINTMENTS
    Calendar
    Appointments
    Waitlist
    Recalls

BOOKING
    Booking Types
        Meetings
        Services
        Classes
        Workshops & Events
    Booking Pages
    Availability
    Staff
    Locations
    Rooms & Equipment
    Forms & Documents
    Routing
    Team Booking
    Meeting Polls
    AI Booking

PACKAGES & SALES
    Packages
    Memberships
    Gift Cards
    Products
    Discounts
    Point of Sale
    Programs        (V2 / optional)
    Rewards         (V2 / optional)

PAYMENTS
    Transactions
    Invoices
    Payment Plans   (V2 / optional)

CONTACTS
    Contacts
    Segments
    Import
    Fields

MESSAGES
    Inbox

AUTOMATIONS
    Reminders
    Workflows
    Templates
    Activity

MEETINGS
    Upcoming
    Recaps

ANALYTICS
    Overview
    Booking
    Reminders
    Automations
    Revenue
    Reports

INTEGRATIONS
    Calendars
    Payments
    Booking Channels
    Developer

SETTINGS
    Business
    Team
    Messaging
    Calendar
    Meetings
    Security
    Billing

HELP
```

**Naming note:** **"Packages & Sales"** is the current working label. **Do NOT** substitute **"Commerce"** in user-facing UI. If an existing stronger customer-tested label already exists in Transovo, preserve it pending final naming review.

---

## Booking Types — required split

The current generic Booking Type architecture must no longer force MEETING / SERVICE / CLASS through one giant conditional editor.

Create a **lightweight Booking Types landing page.**

**Question:** *"What can customers book?"*

Show clear choices:

### Meetings

**Description:** Schedule calls, consultations, demos, interviews, or virtual meetings.

**Actions:** View meetings · Create meeting

Meeting workflow should feel Calendly/Cal.com-like. Meeting editor contains **only** meeting-relevant configuration.

**Suggested structure:**

1. Details
2. Duration & Availability
3. Hosts
4. Meeting Method
5. Questions
6. Booking Rules
7. Payment (if enabled)
8. Confirmation

**Do NOT expose:** class seats, class enrollment, event tickets, service processing phases, complex room/equipment machinery by default.

### Services

**Description:** Book one-on-one or provider-based services (training, tutoring, salon, massage, repair, inspection, photography, private lessons, etc.).

**Actions:** View services · Create service

**Service editor:**

1. General
2. Scheduling
3. Staff, Locations & Rooms
4. Customer Information
5. Add-ons
6. Pricing & Access
7. Policies & Documents
8. Confirmation

Relevant advanced settings use progressive disclosure.

### Classes

**Description:** Let multiple customers enroll into the same scheduled class.

**Actions:** View classes · Create class

**Class editor:**

1. General
2. Schedule
3. Instructor & Location
4. Capacity
5. Pricing & Access
6. Customer Information
7. Policies
8. Waitlist
9. Admission (when enabled)

**Do NOT expose** service processing settings.

### Workshops & Events

**Description:** Take registrations for workshops, seminars, special events, and limited-run group sessions.

**Actions:** View workshops & events · Create workshop or event

**Editor:**

1. General
2. Date & Time
3. Location
4. Registration
5. Pricing & Access
6. Customer Information
7. Policies
8. Admission / Check-in (when applicable)

Do not make Events inherit all recurring Class complexity.

---

## Canonical home + contextual completion rule

Every reusable object has **one canonical management home**.

When the user needs that object inside another workflow, provide a contextual way to:

- select existing
- create new
- manage/edit if appropriate

…without losing the current workflow.

**Example — Service → Pricing & Access → Packages**

If packages exist:

- Select package
- + Create package
- Manage packages

If none exist:

> No packages yet  
> Packages let customers prepay for a set number of services or classes.  
> [ Create package ]

After creating:

- return to Service editor
- preserve all unsaved service work
- auto-select new package

**Do NOT say:** "Go to Packages and create one first."

---

## Quick create rule

Contextual creation should **NOT** reproduce the full canonical editor when simple setup is enough.

Use quick-create for common dependencies.

**Example — Service → Add Location**

Quick create: name · address · timezone → Save.

Then: *"Location created and added to this service."*

Full Location page contains: hours · services · staff · rooms · public details.

**Same pattern for:** Staff · Rooms & Equipment · Package · Membership · Discount · Intake Form · Contract · Reminder Sequence.

If the dependency is too complex for quick create: open a focused child flow while preserving draft state.

---

## Area-specific directives

### Booking → Availability

| | |
|---|---|
| **Classification** | EXTEND / REORGANIZE |
| **Rule** | Do not redesign existing good page |

**Organize into:**

1. **Schedules** — weekly hours, saved schedules, timezone
2. **Special Dates** — date overrides, closed dates, holidays
3. **Booking Rules** — minimum notice, booking horizon, booking limits, fixed start times, start interval
4. **Availability Preferences** — reduce gaps, limit visible times
5. **Diagnostics** — why a slot is unavailable

Use existing components/design.

### Booking → Staff

| | |
|---|---|
| **Classification** | EXTEND |
| **Rule** | Keep existing page appearance |

Staff detail: Profile · Services · Availability · Locations · Calendar · Scheduling · Calendar display/color.

Contextual creation from Meeting/Service/Class must be available.

### Booking → Locations

| | |
|---|---|
| **Classification** | EXTEND |

Location editor: General · Hours · Services · Staff · Rooms & Equipment · Public Details.

Do **not** create separate pages for location hours, timezone, assignments, etc.

### Booking → Rooms & Equipment

| | |
|---|---|
| **Classification** | NEW or EXTEND if good page exists |
| **Label** | **"Rooms & Equipment"** — not "Resources" as primary label |

List: name · type · location · quantity · status. Local secondary view: **Groups** ("Use any available room from this group.").

### Booking → Forms & Documents

| | |
|---|---|
| **Classification** | NEW / MERGE |

**Sections:** Intake Forms · Contract Templates · Terms.

Merge existing parity pages here. Appointment-specific answers/signatures stay on Appointment Detail.

### Booking Pages

| | |
|---|---|
| **Classification** | EXTEND |

Preserve polished design. Organize: General · Branding · Share & Embed · Confirmation · Advanced.

Move here: QR · direct links · embed · single-use links · custom domain · custom CSS · terminology/language. Do not create random standalone pages.

### Packages

| | |
|---|---|
| **Classification** | NEW / SPLIT from mega parity page |

Dedicated focused page. Editor: General · Included Services & Classes · Validity · Usage Rules · Customers.

Contextual creation from: Service · Class · Contact · Point of Sale.

### Memberships

| | |
|---|---|
| **Classification** | NEW / SPLIT |

Editor: General · Benefits · Access · Credits · Billing & Lifecycle · Members.

Customer language: credits · benefits · members · renewal · paused · past due. **Not** "entitlement lifecycle."

### Gift Cards · Products · Discounts · Point of Sale

| Area | Classification | Notes |
|------|----------------|-------|
| Gift Cards | NEW / SPLIT | Offerings, issued cards, balance, expiration, history |
| Products | NEW / SPLIT | Simple retail catalog — not warehouse inventory |
| Discounts | MOVE / NEW | Move `/appointments/coupons` here; label "Discounts" |
| POS | KEEP if polished | Service, Package, Membership, Gift Card, Product → discount → tip → payment |

### Programs · Rewards

| | |
|---|---|
| **Status** | **V2** — do not surface prominently |
| Programs | MERGE into Packages if only a package variant |
| Rewards | Customer label "Rewards" — not loyalty-engine jargon |

### Payments

Payments answers: *What money came in, what is still owed, and what needs action?*

Do **not** mix sellable product configuration into Payments.

| Surface | Classification |
|---------|----------------|
| Transactions | KEEP if polished |
| Invoices | KEEP if polished |
| Payment Plans | V2 — installments under Payments; product eligibility in product editors |

### Contacts

| | |
|---|---|
| **Classification** | KEEP main page; EXTEND detail only |

Own: appointments/history · packages · memberships · balance · gift cards · payments · household · booking access · notes/activity.

**Move from parity Commerce:** contact merge · custom fields · household · booking restrictions · service history · segments · imports.

**Booking Access:** Contact Detail → Booking Access. Global list via Contacts filter "Booking restricted." Retire standalone Restrictions product page.

### Appointments operational

| Surface | Classification | Notes |
|---------|----------------|-------|
| Calendar | KEEP | Add slot-click create, colors, meeting indicators, filters only |
| Appointments list | KEEP | Merge approval queue into status/filter |
| Appointment Detail | EXTEND / REORGANIZE | Group: Overview · Customer Info · Payments · Documents & Policies · Communications · Activity |
| Waitlist | KEEP / EXTEND | Preferences, party size, priority, offer status, expiry — same domain |
| Recalls | KEEP queue | Automation behavior → Automations; retire duplicate config pages |

### Automations · Messages · Meetings · Analytics · Integrations · Settings

| Area | Rule |
|------|------|
| Automations | Preserve design; Reminders · Workflows · Templates · Activity; channels inside Reminders |
| Messages | KEEP Inbox — no redesign |
| Meetings | KEEP Upcoming/Recaps — distinct from Booking Types → Meetings |
| Analytics | KEEP; add Revenue; move service-booking reports into Reports |
| Integrations | EXTEND; Calendars · Payments · Booking Channels · Developer (webhooks) |
| Settings | KEEP org-wide only — not service/package/class config |

---

## Temporary parity UI migration map

These surfaces are **not** final IA. Migrate then retire.

| Current route | Destination | Action |
|---------------|-------------|--------|
| `/appointments/commerce` | Packages, Memberships, Gift Cards, Products, Discounts, Contacts, Rooms & Equipment, Integrations | SPLIT → **RETIRE** mega page |
| `/appointments/service-booking` | Real destinations | **RETIRE** |
| `/appointments/policies` | Service/Class/Workshop policy sections | **MERGE** |
| `/appointments/restrictions` | Contact Detail → Booking Access | **MERGE** |
| `/appointments/coupons` | Packages & Sales → Discounts | **MOVE** |
| `/appointments/payments` | Split payment-plan mgmt vs product pricing | **REORGANIZE** |
| `/appointments/contracts`, `/appointments/booking/contracts` | Booking → Forms & Documents → Contracts | **MERGE** |
| `/appointments/categories` | Services → Manage Categories | **MERGE** |
| `/appointments/segments` | Contacts → Segments | **MOVE** |
| `/appointments/scheduled` | Contacts / appointment history | **MERGE** |
| `/appointments/recall-campaigns` | Automations | **MERGE** |
| `/appointments/no-show-recovery` | Automations | **MERGE** |
| `/appointments/commerce/contact-merge` | Contacts | **MOVE** |
| Commerce custom fields | Contacts → Fields | **MOVE** |
| Commerce intake forms | Booking → Forms & Documents | **MOVE** |
| Commerce webhooks | Integrations → Developer | **MOVE** |
| Commerce resources | Booking → Rooms & Equipment | **MOVE** |
| Commerce dynamic pricing | Service → Pricing & Access → Price Rules | **MOVE** |
| Commerce waitlist priority | Appointments → Waitlist | **MOVE** |
| Commerce seat maps | Class → Admission | **MOVE** |
| Commerce households | Contacts | **MOVE** |
| Commerce theme | Booking Pages → Branding | **MOVE** |
| Commerce import/export | Contacts / Analytics (by data type) | **MOVE** |
| `/appointments/booking/share` | Booking Pages → Share & Embed | **MERGE** (tab/section, not orphan) |
| `/appointments/booking/branding` | Booking Pages → Branding | **MERGE** |
| `/appointments/reports/service-booking` | Analytics → Reports | **MERGE** |
| `/appointments/classes` (admin tab shell) | Booking Types → Classes + canonical class mgmt | **SPLIT / MERGE** |
| `/appointments/resources` | Booking → Rooms & Equipment | **MOVE** |

---

## Free-trial discoverability standard

Major capabilities must be recognizable quickly:

| Area | Must visibly communicate |
|------|--------------------------|
| Booking landing | Meetings · Services · Classes · Workshops & Events |
| Packages & Sales | Packages · Memberships · Gift Cards · Products · Discounts · Point of Sale |
| Appointments | Calendar · Appointments · Waitlist · Recalls |
| Automations | Reminders · Workflows |

Do **not** require trial users to open generic settings to discover major capabilities.

---

## Empty-state standard

New management pages must **teach** the feature.

| Bad | Good |
|-----|------|
| "No packages found." | "Sell multiple sessions together" + explanation + [ Create your first package ] |

Apply to: Packages · Memberships · Classes · Workshops · Rooms & Equipment · Forms · Gift Cards · Products · Discounts.

---

## Page implementation workflow

**Do NOT reorganize the entire product blindly in one pass.**

Work **page by page** in deliberate batches.

### Per-page workflow

1. Inspect the current page in the browser.
2. Capture screenshot.
3. Determine classification: KEEP / EXTEND / REORGANIZE / SPLIT / MERGE / RETIRE / NEW.
4. Identify all feature inventory rows assigned to that page.
5. Identify dependencies and contextual-create requirements.
6. For existing pages: preserve current styling/components.
7. For new pages: inspect `/appointments/overview` for visual art direction.
8. Inspect best existing page of the same type (list, editor, detail, settings, builder).
9. **Write compact page blueprint BEFORE coding.**
10. Implement UI.
11. Preserve working backend/runtime.
12. Wire only missing functionality.
13. Browser-test the real task.
14. Move/retire old temporary UI only after replacement works.
15. Continue to next page.

### Implementation batch order (recommended)

| Batch | Focus | Why first |
|-------|-------|-----------|
| **0** | Classification manifest only (no UI) | Lock KEEP pages |
| **1** | Booking Types landing + split entry | Gates Meetings/Services/Classes/Events editors |
| **2** | Booking Types editors (one archetype at a time) | Core scheduling mental model |
| **3** | Booking Pages (merge share/branding) | Customer-facing distribution |
| **4** | Availability reorganization | High-traffic config |
| **5** | Packages & Sales split (Packages, Memberships, Gift Cards, Products, Discounts, POS) | Dismantle commerce mega-page |
| **6** | Rooms & Equipment + Forms & Documents | Booking dependencies |
| **7** | Contacts extensions + merge parity CRM features | Customer record home |
| **8** | Integrations (Developer/webhooks) | Remove from commerce |
| **9** | Retire temporary routes + nav update | After replacements verified |
| **10** | Appointment Detail extend + Analytics merge | Operational polish |

**First detailed page blueprint (mandatory):** **Booking Types landing** (`/appointments/types` or successor) — before any archetype editor blueprint.

---

## Required page blueprint before coding

For every page that is **not KEEP**, complete this worksheet **before** implementation:

```
PAGE:
ROUTE:
CLASSIFICATION:
PRIMARY USER:
PRIMARY USER JOB:
SOURCE FEATURE ROWS: (from APPOINTMENTS-MASTER-FEATURE-INVENTORY.md)
EXISTING UI TO PRESERVE:
EXISTING COMPONENTS TO REUSE:
PRIMARY ACTION:
SECONDARY ACTIONS:
LOCAL NAV:
PAGE SECTIONS IN ORDER:
TABLE/LIST FIELDS:
DRAWERS:
MODALS:
EMPTY STATE:
LOADING STATE:
ERROR STATE:
SUCCESS FEEDBACK:
DEPENDENCIES:
CONTEXTUAL CREATE ACTIONS:
PUBLIC/PORTAL COUNTERPART:
RESPONSIVE BEHAVIOR:
ACCESSIBILITY NOTES:
BACKEND ALREADY PRESENT:
BACKEND GAPS:
BROWSER UAT:
OLD ROUTES TO MERGE/RETIRE:
```

**Do not code until this exists.**

Store blueprints in: `docs/appointments-page-blueprints/` (one file per page).

---

## Do not do these things

- Redesign pages marked **KEEP**
- Replace good existing pages just because new IA exists
- Create a page for every backend model
- Create generic forms with 20–30 unrelated sections
- Use **"Commerce"** in customer-facing navigation
- Expose archetype enum names (MEETING, SERVICE, CLASS) as primary UI labels
- Expose "resource pool", "entitlement", "ledger", etc. as primary customer terminology
- Put every advanced feature directly in front of basic users
- Move functionality before its destination is working
- Create duplicate data models during UI reorganization
- Reimplement backend solely because UI moved
- Break existing tested functionality
- Change global shell styling unnecessarily
- Run one giant agent across the whole app — use **batched page work**

---

## Success criteria

This IA/UI pass is complete when:

1. Every current feature has one understandable canonical home.
2. Every common dependency can be created contextually where needed.
3. Meetings, Services, Classes, and Workshops/Events have distinct workflows.
4. Current parity mega pages are dismantled into real user-facing destinations.
5. Existing polished pages remain visually intact unless they needed an extension.
6. Newly created pages visibly belong to the same Transovo product as the current Home screen.
7. No page becomes a 20–30-section dumping ground.
8. A free-trial user can identify major scheduling and selling capabilities without exploring random pages.
9. All relocated functionality still points at existing authoritative backend/runtime.
10. Final UI is ready for backend-gap completion and full real-user browser certification.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `docs/APPOINTMENTS-PAGE-CLASSIFICATION-MANIFEST.md` | Per-route classification (Batch 0) |
| `docs/APPOINTMENTS-MASTER-FEATURE-INVENTORY.md` | Feature completeness ledger |
| `docs/APPOINTMENTS-FEATURE-SPLIT-ORIGINAL-VS-PARITY.md` | Original vs parity feature split |
| `docs/APPOINTMENTS-UI-PRODUCTIZATION-TRACKER.md` | UI depth status |
| `docs/appointments-page-blueprints/` | Page blueprints (create as work proceeds) |
| `.cursor/rules/transovo-appointments-ia-manifest.mdc` | Cursor enforcement rule |

---

*End of directive.*
