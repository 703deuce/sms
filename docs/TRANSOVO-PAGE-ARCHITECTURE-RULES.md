# Transovo Page Architecture Rules

**Status:** Active — required reference for every page, screen, and surface  
**Audience:** Engineers, designers, and Cursor agents (including Kimi) building Transovo UI  
**Layer:** Page structure and behavioral grammar — **after** information architecture, **before** pixel-level design  

**Prerequisite:** Read `docs/TRANSOVO-UI-DESIGN-GUIDE.md` first (mental models, IA, heuristics). This document defines **how every page is built** so 40 attractive screens do not each behave differently.

**Related docs**

- **Accessibility (WCAG 2.2 AA):** `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- **Human-centered design (ISO 9241):** `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- **IA & navigation (hard standard):** `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- **Forms & validation (hard standard):** `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- **Responsive/reflow/zoom (hard standard):** `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- **Tables/grids (hard standard):** `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- **Privacy/consent/compliance (hard standard):** `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- **Security/authentication (hard standard):** `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- **Date/time/timezone/locale (hard standard):** `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- **Internationalization/localization (hard standard):** `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- Page architecture: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Appointments nav implementation: `src/lib/products/appointments-nav.ts`
- V1 UI rebuild: `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md`

---

## When to use this guide

**Before designing or implementing any page**, classify it and apply these rules.

**Follow this guide whenever you:**

- Create a new page or redesign an existing one
- Add headers, tabs, filters, drawers, modals, or wizards
- Build list, detail, dashboard, calendar, editor, or builder surfaces
- Decide where a primary action, status badge, or empty state goes

**If a page cannot be described with one primary job (Rule 1), split it or move content elsewhere.**

---

## The Transovo page template

Not every row appears on every page. The **page archetype** (Rule 10) determines which sections exist.

```
┌─────────────────────────────────────────────────────┐
│ GLOBAL APP SHELL                                    │
│ Sidebar + global utilities                          │
├─────────────────────────────────────────────────────┤
│ PAGE HEADER                                         │
│ Title                           [Primary Action]     │
│ Short context/status             Secondary actions  │
├─────────────────────────────────────────────────────┤
│ LOCAL NAVIGATION                                    │
│ Tabs / views — only when this domain has them       │
├─────────────────────────────────────────────────────┤
│ CONTROL BAR                                         │
│ Search · Filters · Sort · View controls             │
│ Only on list/calendar/management pages              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PRIMARY WORKSPACE                                   │
│ The actual task                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ CONTEXT / DETAILS / ACTIVITY                        │
│ Only where the page archetype requires them         │
└─────────────────────────────────────────────────────┘
```

### Element classification (Rule 50)

Every UI element on a page belongs to one level:

| Level | What it is | Examples |
|-------|------------|----------|
| **Global** | Product-wide navigation and context | Sidebar, global header, account menu |
| **Page** | Title and actions for this workspace | Page title, `+ New appointment`, page description |
| **Local** | Views/filters within this workspace | Calendar \| List \| Waitlist tabs |
| **Object** | Information/actions on the selected thing | Appointment status, Reschedule, customer name |
| **Contextual** | Related objects or shortcuts | Link to contact, payment, meeting recap |
| **Advanced** | Less common config, progressively disclosed | Round-robin weights, advanced timing |
| **System** | Loading, error, sync, async feedback | Skeleton rows, “Synced 3 min ago”, toasts |

---

## Page archetypes (Rule 10)

Almost every Transovo screen fits **one** archetype. Pick the archetype before layout.

### A. Dashboard page

**Examples:** Home, Analytics Overview

```
Page header
Critical status / alerts
Primary KPIs
Operational queues
Recent activity
Secondary insights
```

Dashboard cards must **answer questions**, not decorate.

---

### B. List / management page

**Examples:** Appointment List, Contacts, Booking Types, Workflows, Recaps, Transactions

```
Header + primary action
Local tabs (if needed)
Search / filter / action bar
Table or list
Pagination or load more
```

One reusable pattern across all list pages.

---

### C. Calendar page

**Examples:** Appointments → Calendar

```
Header
Date navigation + Today
Calendar / list view controls
Filters
Calendar surface
Context drawer when event selected
```

**Clicking an appointment** should open a **detail drawer** by default—not navigate away immediately (preserves context). Offer **Open full appointment** when the full detail screen is needed.

---

### D. Detail page

**Examples:** Appointment, Contact, Meeting recap, Payment

```
Breadcrumb or back
Object identity + status
Primary actions
Overview / important state
Related information (grouped)
Activity / history (bottom or tab)
```

See **Object detail anatomy** (Rule 11).

---

### E. Configuration / editor page

**Examples:** Booking Type, Availability Schedule, Reminder Sequence, Integration settings

```
Back / context
Title
Save state + primary action
Basic configuration
──────────────────
Most-used settings
Advanced sections
──────────────────
Less-frequent configuration
Danger zone
```

---

### F. Builder / workspace (immersive)

**Examples:** Workflow Builder, Routing Form Builder

```
Top builder bar
← Back    Workflow name    Test    Save / Publish
Palette | Canvas / workspace | Properties
```

Normal product sidebar **collapses** or becomes minimal. Maximize workspace.

---

## The 50 rules

### Purpose and shell

#### 1. Every page must have one primary job

Before designing, complete this sentence:

> “The purpose of this page is to ______.”

| Page | Primary job |
|------|-------------|
| Appointments | Find, review, create, and manage appointments |
| Booking Types | Create and configure appointment types customers can book |
| Reminder Sequences | Configure communications that automatically happen around appointments |

If three unrelated sentences are needed, the page probably contains things that belong elsewhere.

---

#### 2. Every normal page uses the same shell

No page invents its own header, sidebar, or layout.

```
┌──────────────┬────────────────────────────────────┐
│              │ Global header                      │
│              ├────────────────────────────────────┤
│ Global       │ Page header                        │
│ navigation   │ Title                Primary action│
│              │ Description / status               │
│              ├────────────────────────────────────┤
│              │ Local navigation / filters         │
│              ├────────────────────────────────────┤
│              │ Main workspace                     │
└──────────────┴────────────────────────────────────┘
```

**Same everywhere:** sidebar width, global header, content start, max widths, page-header spacing, button placement, tabs, filters, status treatment. Content changes; architecture does not.

---

#### 3. Page title always goes in the same place

**Top-left** of the content workspace.

```
Appointments
Manage upcoming, completed, and imported appointments.
```

**Top-right:** `+ New appointment`

Not: giant hero, centered title, button buried below, different title styles per screen.

---

#### 4. One obvious primary action per page

One visually dominant action per page.

| Page | Primary action |
|------|----------------|
| Appointments | New appointment |
| Booking Types | New booking type |
| Contacts | Add contact |
| Reminder Sequences | New sequence |
| Workflows | New workflow |

Secondary actions stay visually quieter: `Import` `Export` ··· `+ New appointment`

---

#### 5. Don’t put actions in navigation

| Sidebar | Page |
|---------|------|
| **Places** — where am I going? | **Actions** — what am I doing? |

❌ New Appointment in sidebar  
❌ Add Contact in sidebar  
❌ Create Workflow in sidebar  

✅ **Appointments** in sidebar → **+ New appointment** on the page

---

#### 6. Local navigation has a fixed location

Domain views sit **directly under the page header**.

```
Appointments                              + New appointment
Manage your scheduled appointments.
Calendar   List   Waitlist   Recalls
────────────────────────────────────────
```

```
Booking
Booking Types   Booking Pages   Availability   AI Booking   Routing   Polls
────────────────────────────────────────────────────────────────────────
```

Do not put tabs sometimes at top, sometimes left, sometimes inside cards, sometimes in dropdowns—unless the archetype genuinely requires a different pattern (e.g. builder).

---

#### 7. Tabs represent peer views, not actions

**Good:** `Calendar | List | Waitlist` — which view?  
**Bad:** `Save | Delete | Export` — those are actions.

Avoid tabs where one item is really a settings button, not a peer view.

---

#### 8. Filters and search live above the data they control

```
Page header
Local tabs
Search    Status ▼   Type ▼   Date ▼    More filters
Table / list
```

Not in the sidebar. Not at the bottom. Not scattered in column headers (except deliberate table-column filters).

Gestalt proximity: controls affect content **below** them.

---

#### 9. Don’t show filters until they are useful

**Default:** search + one or two important filters + **More filters**

**Expanded:** source, staff, booking type, status, calendar, date range, payment status, confirmation state

Do not show eleven dropdowns because eleven filters exist.

---

### Object detail and status

#### 11. Object detail pages need consistent anatomy

**Appointment detail** — same conceptual order every time:

| Level | Content |
|-------|---------|
| **1 — Identity** | Initial Consultation · Tue, Sep 8 · 2:00–2:30 PM · `Confirmed` |
| **2 — Primary actions** | Message · Reschedule · Cancel · `•••` |
| **3 — Operational state** | Confirmation, payment, reminder status, calendar sync, SMS eligibility |
| **4 — Core information** | Customer, booking type, staff, location, meeting, source |
| **5 — Related processes** | Scheduled reminders, messages, payment, meeting recap |
| **6 — Activity** | Chronological timeline |

---

#### 12. Status belongs near the object it describes

- **Confirmed** → next to appointment identity  
- **Paid** → near payment  
- **Synced** → near calendar  
- **SMS unavailable** → near reminders / communication  

Do not create separate pages for every state.

---

#### 13. Badges are for state, not decoration

Controlled vocabulary. Examples:

**Appointment:** Scheduled · Confirmed · Completed · Canceled · No-show  

**Reminder:** Scheduled · Sending · Sent · Delivered · Failed · Suppressed  

**Calendar:** Synced · Pending · Needs attention · Disconnected  

Do not use green pill, blue pill, Active, Healthy, Ready for four concepts that mean the same thing. **One canonical term per concept.**

---

#### 14. Critical state must be readable without color

Use labels: **Connected**, **Needs attention**, **Failed** — with color/icons assisting, not replacing text.

---

### Empty, error, and async states

#### 15. Empty states must teach

**Bad:** No appointments.

**Good:**
```
No appointments yet
Appointments appear here when customers book or you add one manually.
[Create appointment]
```

Every important empty state answers:

1. What is this?  
2. Why would I use it?  
3. What should I do next?

---

#### 16. First-use state and empty state aren’t always the same

**Never connected:** Connect Microsoft to sync appointments and block unavailable times.

**Previously connected, broken:** Microsoft needs attention. We couldn’t refresh authorization.

Different situations → different UI.

---

#### 17. Error states must be actionable

**Bad:** Something went wrong.

**Good:** SMS reminder couldn’t be scheduled — imported appointments aren’t eligible for platform SMS. Complete business texting registration. **[Set up business texting]**

Problem + cause + next action.

---

#### 18. Show system status where asynchronous work happens

Show: **what is happening + latest state + when**

| Feature | Example |
|---------|---------|
| Calendar sync | Synced 3 minutes ago |
| SMS reminder | Scheduled for Sep 8 at 9:00 AM |
| Notetaker | Waiting for host admission |
| Transcript | Processing |
| Payment | Succeeded · $50.00 · 10:43 AM |

Not an afterthought.

---

#### 47. Every page must handle six states

For every significant page, design:

1. **Normal**  
2. **First-use / empty**  
3. **Loading**  
4. **Error**  
5. **Partial / degraded**  
6. **Success / completed**  

Mockups that only show #1 break in production.

---

#### 48. Every page must answer five questions immediately

Acceptance test — within seconds the user knows:

1. Where am I?  
2. What is this page for?  
3. What can I do here?  
4. What needs my attention?  
5. How do I get to the related thing I need next?

Fail one → redesign.

---

### Lists, tables, and layout

#### 19. Every list row needs predictable hierarchy

```
Primary identity     — Who / what?
Secondary context    — When, type, source
State                — Confirmed, paid
Actions              — One common action or overflow
```

Example:
```
Anthony Johnson
Initial Consultation · Tomorrow 2:00 PM
Confirmed · SMS scheduled                                    •••
```

Not twelve icons per row.

---

#### 20. Tables when comparison matters

Use tables to scan/compare across many objects (Contacts, Appointments list).

Do not turn complex detail into a table. Tables are for comparison, not because data exists.

---

#### 21. Cards are for grouping, not everything

Avoid card-inside-card-inside-card. Use cards for meaningful regions; white space can group too.

---

### Forms and configuration

#### 22. Forms follow one reading direction

Primarily **top-to-bottom**. Group semantically:

```
Basics — Name, Duration, Location
Hosts — Host strategy, Staff
Availability — Schedule, Buffers, Limits
```

Two columns only for strongly related short fields: `Start date | End date`, `First name | Last name`.

---

#### 23. Required information first

Order: required/common → optional/common → advanced → destructive/system

Not alphabetical. Not backend-model order.

---

#### 24. Hide conditional controls until relevant

**One host** → hide round-robin, required-host rules, seat capacity.

**Round robin** selected → reveal round-robin controls.

---

#### 25. Use sensible defaults

Preselect workspace timezone, primary calendar, default reminder sequence, 30-minute duration, no payment—when that matches most users.

---

#### 26. Advanced settings need hierarchy

No single dump called “Advanced Settings.”

- Booking Type → **Advanced booking rules**  
- Reminder Sequence → **Advanced timing**  
- Microsoft → **Advanced synchronization**  

Advanced lives **within** the object it affects.

---

#### 27. Save behavior must be predictable

**Editor pages:** Save changes top-right (and/or sticky when needed).

**Immediate toggles:** auto-save only if visibly communicated (`Saved`).

Do not mix silent save, auto-save, and manual save without clear indication.

---

#### 28. Unsaved changes must be protected

On navigate away with dirty form:

```
You have unsaved changes.
[Discard]  [Keep editing]
```

---

#### 29. Destructive actions in predictable places

Delete does not compete with Save.

```
Danger zone
Delete booking type
Permanently removes this booking type. Existing appointments remain.
[Delete]
```

---

#### 33. Page-specific settings stay close to the feature

Affects **this booking type** → Booking Type → Reminders  
Affects **every booking type** → Settings → Appointment defaults  

**Local first. Global defaults second.**

---

#### 34. Global settings provide defaults, not duplicate the app

Settings → Calendar: default write calendar, default conflict calendars.

Per-type availability stays under **Booking → Availability / Booking Type**.

Settings is not a second copy of the whole product.

---

### Surfaces: drawer, modal, wizard

#### 30. Use drawers when maintaining context matters

**Good for:** appointment detail from calendar, contact quick view, reminder detail, log detail.

Calendar → click appointment → **right drawer** → optional **Open full appointment**.

---

#### 31. Use modals for short, focused decisions

**Good:** confirm cancel, choose calendar, add one contact, confirm delete  

**Bad:** entire booking type editor, giant appointment form, workflow builder  

---

#### 32. Wizards for genuine multi-step setup

**Good:** business texting registration (ordered steps, clear completion)  

**Bad:** ordinary configuration turned into a wizard because there are many fields  

---

### Linking, timeline, diagnostics

#### 35. Related objects clickable, not copied

Appointment detail:

- **Customer: Anthony Johnson** → opens contact  
- **Meeting: Zoom · Sep 8** → opens recap  
- **Payment: $50 paid** → opens transaction  

Show enough context; link to the authoritative object.

---

#### 36. Timeline is the canonical “what happened?”

Especially for appointments. Example:

```
Sep 7 · 10:03 AM  Appointment booked via public booking page
Sep 7 · 10:03 AM  SMS consent recorded
Sep 7 · 10:04 AM  Microsoft event created
Sep 8 ·  9:00 AM  Reminder sent via SMS
Sep 8 ·  9:00 AM  Delivered
Sep 8 ·  9:14 AM  Customer replied YES
Sep 8 ·  9:14 AM  Appointment confirmed
```

One of the highest-value UX investments in the product.

---

#### 37. Diagnostics should be contextual

**At 2 PM unavailable:**
```
Unavailable
Microsoft Work Calendar — Team Meeting, 1:30–2:30 PM
```

**Reminder not scheduled:**
```
Not scheduled — Customer opted out of SMS.
```

Explain at the point of failure. Deep diagnostic pages are secondary.

---

#### 38. Show policy restrictions before users commit

Imported appointment without A2P:

Do not enable SMS toggle that fails later. Show:

```
SMS reminders 🔒
Business texting registration required for imported/manual appointments.
[Set up texting]
```

---

#### 49. Every feature gets one primary home

One **canonical management location**; multiple **access paths** only.

**Reminder sequences**  
- Primary: Automations → Reminder Sequences  
- Referenced from: Appointment, Booking Type, Calendar settings  
- Not: a separate full editor in each place  

---

### Responsive, interaction, and polish

#### 39. Responsive rules are structural

| Desktop | Mobile |
|---------|--------|
| Sidebar | Navigation drawer |
| Wide table | Rows/cards |
| Drawer | Full-screen sheet/page |
| Filter bar | Filter button/sheet |

Same IA. No horizontal overflow. Primary action stays obvious.

---

#### 40. Don’t hide core actions behind hover

Edit, Delete, Reschedule must work on touch, keyboard, and mouse.

---

#### 41. Keyboard and focus everywhere

Visible focus, logical tab order, modal focus trap, Escape closes appropriate surfaces, focus returns to trigger, labeled inputs, keyboard-accessible menus, visible errors.

---

#### 42. Loading preserves page structure

Skeleton rows, skeleton cards, calendar shell visible—not blank full-page spinners.

---

#### 43. Immediate feedback on every action

Save → loading → Saved. Create → processing → object appears + toast.

Never: click → nothing → maybe it worked.

---

#### 44. Toasts are confirmation, not the only record

“Appointment created” + the appointment **visible on the page**. Toasts must not be the only place critical info appears.

---

#### 45. Detail screens prioritize exceptions

When all is well: compact status rows.

When broken: **prominent** exception (SMS blocked, sync failed). Surface what needs attention.

---

#### 46. Don’t expose implementation terminology

No delta tokens, Graph subscription IDs, webhook lifecycle, idempotency keys, queue workers, orchestration service—in customer UI. Translate to user state.

---

## Page design worksheet (use before Kimi / implementation)

Copy this for each new or redesigned page:

```markdown
### Page: [Name]
**Archetype:** Dashboard | List | Calendar | Detail | Editor | Builder
**Primary job:** The purpose of this page is to ______.
**Domain:** Appointments | Booking | … (from UI Design Guide)
**Primary action:** ______
**Local nav:** ______ (or none)
**Control bar:** search / filters (list which)
**Primary workspace:** ______
**Drawer vs full page:** ______
**Six states designed:** empty / loading / error / degraded / success / normal
**Five questions pass:** Y/N each
**Canonical home for any nested feature:** ______
```

---

## Screen-by-screen spec (next pass)

With IA complete (`TRANSOVO-UI-DESIGN-GUIDE.md`) and page grammar defined (this document), the next deliverable is **page-by-page specification**:

For each domain (Home → Appointments → Booking → …):

- What appears above the fold  
- Sections and grouping  
- Buttons and actions  
- Drawer vs full page  
- Advanced / hidden settings  
- Empty, error, and async states  

That spec is what Kimi designs against. **Do not skip to pixels before completing the worksheet for each page.**

---

## Quick reject triggers (page level)

- Page has no single-sentence primary job  
- Title or primary action in a non-standard position  
- Primary action in sidebar instead of page header  
- Tabs used for Save/Delete/Export  
- Filters below the list or in the sidebar  
- Detail page with random section order (not Rule 11)  
- Empty state with no next action  
- Error with no fix path  
- Async feature with no visible state  
- Only the “happy path” designed (missing Rule 47 states)  
- Same feature with two full editors in different nav areas (violates Rule 49)  
- Long form trapped in a modal (Rule 31)  
- Core actions hover-only (Rule 40)  

---

*This document is the authoritative page architecture ruleset for Transovo. Pair it with `docs/TRANSOVO-UI-DESIGN-GUIDE.md` for every screen.*
