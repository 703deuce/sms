# TRANSOVO — MASTER VISUAL UI/UX AUDIT + DESIGN-SYSTEM SPECIFICATION

**Audience:** Kirsten (Pass 1)  
**Status:** Authoritative brief for read-only audit — not an implementation prompt  
**Last updated:** 2026-09-25

---

## MODE

**READ-ONLY VISUAL / UX AUDIT AND DESIGN-SYSTEM SPECIFICATION**

- Do **not** begin a broad UI implementation in this pass.
- Do **not** redesign product architecture.
- Do **not** move features between pages.
- Do **not** add product features.
- Do **not** remove working features.
- Do **not** change runtime behavior, APIs, database schema, telephony, SMS routing, consent logic, sender authority, entitlements, analytics definitions, AI behavior, or provider integrations.

The purpose of this pass is to inspect the **actual implemented** Transovo product, inspect the **supplied screenshots**, identify the visual inconsistencies, and define the **single visual system** that should govern the finished application.

The result of this pass must be a **concrete implementation specification** for the visual-polish phase.

**Engagement order (strict):**

1. Kirsten completes this audit + design-system specification (read-only).
2. Product/engineering reviews the report together.
3. Only then: a separate, controlled **implementation** prompt (not this document).

Do **not** take one screenshot you happen to like and rebuild the product around it.

**Screenshot package:** Use **all** supplied screenshots — **MCTB and Voice** (and shared surfaces such as Inbox), plus **external Fonio reference images** (progressive-disclosure example only — §8A). Voice screens are essential for cross-product inconsistency analysis. See `docs/KIRSTEN-VISUAL-AUDIT-SCREENSHOT-MANIFEST.md`.

---

## 1. CORE PRINCIPLE

Transovo is **one coherent product system**, not a collection of independently designed pages.

The existing product architecture has already been extensively reconciled.

The next phase is **visual consolidation**, not product redesign.

Use this governing rule:

| Layer | Determines |
|--------|------------|
| Product scope | What exists |
| Information architecture | Where it lives |
| Workflow | How it operates |
| Design system | How it looks |
| Existing screenshots | Evidence of current implementation — **not** design authority |

**Objective:** Do not redesign what Transovo does. Design **one professional visual language** for what Transovo already does.

---

## 2. TARGET PRODUCT CHARACTER

The finished Transovo UI should feel:

- professional
- mature
- calm
- precise
- operational
- modern
- trustworthy
- medium-density
- easy to scan
- visually consistent
- appropriate for businesses using the software every day

It should **not** feel:

- futuristic
- experimental
- like an AI demo
- like a landing page
- excessively bubbly
- excessively spacious
- card-heavy
- neon
- gradient-heavy
- decorative
- toy-like
- consumer-social
- visually noisy

Do not attempt to make the application look more professional by adding decoration.

Professionalism should come from:

- hierarchy
- typography
- spacing
- alignment
- information density
- consistency
- restraint
- clear states
- predictable interaction
- polished controls
- excellent empty/error/loading states

---

## 3. ARCHITECTURE IS FROZEN

Do not use this visual phase to reopen product architecture.

### MCTB permanent navigation

The canonical Missed Call Text Back navigation is:

1. Overview  
2. Missed Calls  
3. Inbox  
4. AI Recovery  
5. Voicemail  
6. Analytics  
7. Setup  

Do **not** add permanent MCTB navigation destinations.

Do **not** resurrect legacy MCTB pages.

Do **not** promote Consent Log to primary navigation.

Do **not** introduce separate Scheduling, Booking, Numbers, Rules, Business Hours, Follow-Up, or similar permanent MCTB destinations.

---

## 4. MCTB PAGE OWNERSHIP

The following ownership is already established.

### Overview

**Purpose:** What is happening with missed-call recovery right now?

Operational summary only. It may summarize and link. It must **not** become a second configuration center.

### Missed Calls

**Purpose:** What happened to each missed call and recovery attempt?

**Owns:** individual missed-call events; recovery outcome; suppression result; consent evidence; reply status; associated business line; event lifecycle; resulting actions.

### Inbox

**Purpose:** Who is texting us and what needs to happen next?

**Owns:** conversations; replies; operational state; human/AI ownership; permitted messaging actions; callback/action workflow.

Do not turn Inbox into a second CRM.

### AI Recovery

**Purpose:** What should Transovo know and collect while helping recover a missed caller?

The simplified launch model is already established.

**Owns:** AI Recovery status; business information/reference; information to collect; booking-link capability where entitled.

Do **not** restore: direct conversational scheduling; calendar orchestration; find availability; appointment booking; rescheduling; cancellation; prompt engineering controls; model controls; voice controls; no-reply follow-up automation.

For MCTB, **booking means send a booking link**.

### Voicemail

**Purpose:** Which voicemail messages need attention?

Operational Voicemail should primarily own: voicemail list; playback; transcript; read/unread state; caller/message context; appropriate resulting action.

Permanent voicemail configuration belongs under **Setup → Voicemail**. Contextual shortcuts are acceptable. Do not create competing configuration editors.

### Analytics

**Purpose:** Is MCTB successfully recovering missed callers?

Metric definitions are already authoritative. Do not invent or reinterpret metrics for visual convenience.

### Setup

**Purpose:** How is MCTB connected and configured?

**Canonical Setup sections:**

- Overview  
- Phone & Forwarding  
- Consent  
- Text Back  
- Recovery  
- Voicemail  
- Notifications  
- Exclusions  
- Links  
- Test  

Do not restructure these in this visual pass.

---

## 5. VOICE / AI RECEPTIONIST ARCHITECTURE IS ALSO FROZEN

Canonical Voice destinations:

1. Overview  
2. Calls  
3. Receptionist  
4. Business Knowledge  
5. Call Handling  
6. Analytics  

**Ownership:**

- **Receptionist** — what Amy does and how Amy behaves  
- **Business Knowledge** — what Amy knows about the business  
- **Call Handling** — what operationally happens to incoming calls  
- **Calls** — what happened on individual calls and resulting work  
- **Analytics** — aggregate meaning/performance  
- **Overview** — summary and access  

Do not move functionality between these destinations merely to simplify visual design.

---

## 6. IMPORTANT: MCTB AND VOICE MAY USE DIFFERENT PAGE ARCHETYPES

Do not force every page into the same layout.

Consistency does not mean identical pages.

Examples:

- An operational table such as Missed Calls naturally differs from a configuration editor such as Receptionist.  
- Inbox naturally requires a specialized multi-pane layout.  
- Analytics naturally requires visualization surfaces.  

What **must** be shared are the underlying visual rules:

- typography  
- colors  
- spacing  
- control styling  
- borders  
- radii  
- shadows  
- state semantics  
- page-header logic  
- navigation hierarchy  
- form behavior  
- table behavior  
- responsive behavior  
- accessibility  

Different workflows may have different page architectures while still clearly belonging to the same product.

---

## 7. EXISTING SCREENSHOTS — IMPORTANT OBSERVATION

The screenshots show several visual families currently coexisting.

Do **not** blindly choose one entire existing page as the design system.

Instead identify the strongest patterns and consolidate them.

Current families include approximately:

**A. Newer MCTB operational** — e.g. MCTB Missed Calls, MCTB Analytics. Useful operational density.

**B. Newer MCTB Setup** — e.g. Setup Overview, Phone & Forwarding, Consent, Text Back, Recovery, Voicemail, Links, Exclusions, Test. Currently the strongest overall starting family.

**C. Shared/legacy Inbox** — specialized messaging layout with its own navigation and density. Preserve the useful three-pane messaging workflow but reconcile its shell and visual primitives.

**D. Voice operational** — e.g. Calls. Substantially different visual language.

**E. Voice configuration** — e.g. Receptionist, Call Handling. Focused editing layouts; should use the same Transovo design tokens and components.

**F. Knowledge** — e.g. Business Knowledge. Another visual hierarchy; needs reconciliation with the global product system.

---

## 8. STRONG INTERNAL REFERENCES

The following existing screens contain useful patterns. Do not treat them as perfect or immutable. Use them as internal evidence.

| Screen | Useful patterns |
|--------|-----------------|
| MCTB Setup Overview | clear grouping; operational health summary; compact configuration rows; Call Flow / Operations grouping; restrained status presentation |
| MCTB Consent | page hierarchy; status summary; clear selection model; primary configuration + contextual summary; visual explanation of caller flow |
| MCTB Recovery | selected/unselected options; compact summary; status representation; main-content + contextual-summary relationship |
| MCTB Missed Calls | information density; compact filters; operational table; useful summary metrics; restrained visual styling |
| MCTB Analytics | compact KPI treatment; operational density; understandable funnel structure |

These should inform the new visual system more heavily than older oversized Voice dashboard patterns.

---

## 8A. EXTERNAL VISUAL REFERENCE — FONIO

The supplied Fonio screenshots are an **external visual reference only**.

They are **not** product-architecture authority and should **not** be copied literally.

**Files (repo):** `docs/KIRSTEN-VISUAL-AUDIT-REFERENCES/fonio/` — webhooks capability list, HTTP request modal, webhooks drawer, conversation/transcript detail.

Use them to study how a feature-rich AI communications product can remain visually simple through:

- progressive disclosure
- restrained surfaces
- compact capability navigation
- focused configuration panels
- contextual modals/drawers
- master/detail operational layouts
- strong hierarchy without excessive decoration
- limited explanatory copy
- clear primary actions
- purposeful whitespace
- compact controls
- reduced card nesting
- keeping advanced configuration out of the default view

### Important lesson

The goal is **not** to make Transovo look like Fonio.

The goal is to understand why Fonio can expose substantial functionality without making every page appear complicated.

A user should generally see:

**what this area does → current state → important choices/actions**

before seeing every possible configuration field.

Deeper configuration should appear when the user selects the relevant capability, row, section, modal, drawer, or focused editor.

### Example pattern from the supplied Fonio screenshots

Fonio’s Webhooks interface does not expose every HTTP configuration field simultaneously.

The initial surface presents the capabilities and existing webhook objects. Selecting or adding an HTTP request then opens a focused configuration surface containing the detailed settings.

This is a useful example of **progressive disclosure**.

Apply that principle where appropriate in Transovo, especially where current pages expose large amounts of configuration, explanation, status information, and secondary information simultaneously.

### Operational reference

The supplied Fonio conversation/call screen also demonstrates a useful operational pattern:

**conversation/call list → primary interaction/transcript → contextual details**

This is relevant when evaluating Transovo Calls, Inbox, Missed Calls, and Voicemail.

Do **not** force those pages into this exact layout. Determine whether the underlying master/detail principle improves the existing Transovo workflow without changing feature ownership.

### What NOT to copy

Do **not** copy:

- Fonio branding
- Fonio colors
- Fonio navigation architecture
- Fonio feature organization
- Fonio terminology
- Fonio’s exact page layouts
- functionality Transovo does not have
- interactions that conflict with Transovo’s frozen architecture

### Required comparison in the audit

When reviewing the Transovo screenshots, explicitly identify places where complexity is caused by **presentation** rather than actual product complexity.

For those cases, determine whether complexity can be reduced through:

- progressive disclosure
- better hierarchy
- removal of redundant explanatory text
- contextual summaries instead of duplicate information
- drawers or modals for secondary configuration
- expandable advanced settings
- master/detail patterns
- clearer grouping
- fewer nested surfaces
- stronger default states

Do **not** remove necessary information merely to make a screenshot appear cleaner.

The finished Transovo product should retain its operational depth while making that depth feel substantially easier to understand.

---

## 9. MAJOR VISUAL PROBLEMS TO AUDIT

Do not limit yourself to this list, but explicitly inspect each category.

### A. Page headers

Vary in: title position/size; subtitle; icon use; status placement; primary-action placement; top whitespace; container width.

**Deliverable:** canonical page-header patterns. Do not create a unique header for every page.

### B. Typography

Audit inconsistent: heading sizes/weights; label sizes/casing; letter spacing; secondary text; metric typography; helper text; tab typography; status typography.

**Deliverable:** formal typography hierarchy — at minimum: page title; page description; section title; subsection/card title; body; secondary body; form label; helper text; eyebrow/category label; metric value; metric label; status/badge; table header; table body/meta.

Do not allow individual pages to invent typography.

### C. Layout width

Define deliberate layout archetypes:

- **Operational Wide** — tables, Inbox, analytics, high-density operational views  
- **Standard** — dashboards, Setup, mixed configuration  
- **Focused Editor** — Receptionist, complex configuration workflows  

Exact widths from implementation and screenshots; must become reusable layout primitives.

### D. Surface/card usage

Define when to use: page surface; section; card; bordered group; summary strip; table; inset information; empty state; callout.

Reduce unnecessary nesting. Avoid “card inside card inside card.”

### E. Borders / radii / shadows

Define a restrained system. Shadows = elevation/separation, not decoration. Avoid excessively rounded/bubbly UI.

### F. Buttons

Standardize: primary; secondary; tertiary; destructive; icon-only; dropdown action; inline/link action; disabled; loading — plus height, padding, radius, typography, icon spacing, hover, focus, pressed, disabled.

The app currently mixes black, purple, white, text links, and floating controls without obvious hierarchy.

### G. Forms

Standardize: text input; textarea; select; checkbox; radio; segmented choice; switch; multi-option selection card; label; helper text; validation; disabled; read-only; saving; saved; error.

Persistent labels preferred. Do not rely solely on placeholder text.

### H. Status

One semantic status system (Active, Ready, Verified, Configured, Managed, Needs reply, Pending, Failed, Suppressed, Delivered, Replied, Paused, Unavailable, Opted out, etc.).

Do not assign colors independently per page. Color must never be the only status indicator.

### I. Tables and operational lists

Missed Calls, Voice Calls, Inbox lists, Voicemail — related feel, not identical structure.

Standardize: headers; row heights; primary/secondary row text; status placement; actions; hover; selected row; unread; pagination; filtering; empty; loading.

### J. Tabs and local navigation

Product contains: global sidebar; product navigation; Setup tabs; local page tabs; Receptionist internal navigation; Inbox navigation; contextual links.

Define hierarchy so each level communicates scope. Local tabs must not look like global navigation.

---

## 10. CUSTOMER LANGUAGE AUDIT

Identify implementation/developer terminology exposed to customers, e.g.:

- `{{link}}` variable  
- production ingress  
- workspace routing  
- authoritative request form  
- same setting as onboarding  
- live system compiles  
- implementation-oriented routing language  

Do not alter underlying behavior. Identify where copy should explain the user’s task.

**Principle:**  
Instead of: *Validate workspace routing and SMS delivery on production ingress.*  
Prefer: *Make sure missed calls reach Transovo and recovery texts are sent correctly.*

Do not blindly rewrite legal/compliance wording. Flag compliance-sensitive language separately.

---

## 11. NUMBER-IDENTITY SEMANTICS — CRITICAL

The UI must not visually collapse different telephone-number identities.

| Identity | Scope | Meaning |
|----------|--------|---------|
| **#1 Customer business DID** | Per workspace | Public number customers call |
| **#2 Transovo MCTB voice-ingress DID** | Per workspace | Transovo-owned; business line forwards unanswered calls here |
| **#3 Transovo PLATFORM SMS sender DID** | Global when `senderMode === PLATFORM` | From number on Transovo-managed platform recovery SMS |

For `ws_1`, one physical number may serve both workspace ingress and global platform sender — **dual-role assignment**, not a general product rule.

Audit labels: Business line; Forwarding destination; Transovo number; Text-back sender; MCTB sender; Messaging number; Sending number.

Determine whether each displayed value comes from the authoritative identity for that label.

Do not change provider/runtime architecture in this visual pass. Report semantic binding problems separately as **functional** issues.

---

## 12. SENDER AUTHORITY MUST NOT CHANGE

Visual work must preserve the messaging model.

- **PLATFORM sender** — Transovo controls sender and outbound behavior; not unrestricted customer free-form control.  
- **Customer-owned A2P / WORKSPACE sender** — broader capabilities where configured, ready, and entitled.

Do not imply: every customer can freely edit PLATFORM messages; PLATFORM = Telnyx; WORKSPACE = Twilio; provider = entitlement.

Do not expose Telnyx/Twilio to ordinary customers unless an admin workflow requires it.

---

## 13. ENTITLEMENT STATES MUST SURVIVE VISUAL POLISH

Do not expose unavailable actions for layout convenience.

Capability distinctions include: Press-1 consent; existing-consent; booking-link; free-form messaging; editable messaging; two-way Inbox; richer AI Recovery; workspace-owned sender.

Use authoritative capability checks — not scattered frontend plan-name checks. UI hiding is not authorization.

---

## 14. INBOX HAS THREE INDEPENDENT DIMENSIONS

Do not visually collapse:

1. **Operational state** — Needs reply; Needs callback; Resolved  
2. **Automation ownership** — AI Recovery active; Human handling  
3. **Messaging capability** — Platform responses only; Full two-way; Unavailable; Opted out  

Human takeover does not automatically imply free-form messaging permission.

---

## 15. VOICEMAIL OWNERSHIP

Permanent configuration: **Setup → Voicemail**.

Operational Voicemail: listening; transcript; read/unread; caller context; operational action.

If operational Voicemail duplicates permanent editors (greeting, enabled, transcription, alerts, routing), identify them. Recommend one canonical configuration owner with contextual links/summary elsewhere.

---

## 16. ERROR / LOADING / EMPTY / PARTIAL / SUCCESS STATES

Every significant page/component: normal; loading; empty; error; partial/degraded; success.

Shared patterns required. Do not expose raw JS/runtime errors to customers.

Examples in screenshots (functional defects — separate engineering pass): `b.filter is not a function`; `Cannot read properties of undefined (reading 'count')`.

The visual system must still define proper customer-facing failure states.

---

## 17. CURRENT FUNCTIONAL DEFECTS — DO NOT HIDE THEM WITH DESIGN

Flag as pre-polish engineering blockers:

| Area | Symptom |
|------|---------|
| AI Recovery | `b.filter is not a function` |
| Voice Analytics | `Cannot read properties of undefined (reading 'count')` |
| Additional Voice route/page | Full-page “This page couldn’t load” |

Do not solve by suppressing content, mock data, or designing around failure. Trace to first failing boundary separately.

---

## 18. RESPONSIVE DESIGN

Define behavior for: large desktop; standard laptop; narrow desktop; tablet; mobile.

No page-wide horizontal scroll for ordinary content. Tables may use intentional responsive strategies.

Define behavior for: sidebar; product switcher; top actions; tabs; tables; KPI strips; forms; two-column layouts; contextual summaries; Inbox panes.

Do not merely shrink desktop UI.

---

## 19. ACCESSIBILITY

**WCAG 2.2 AA** minimum.

Audit/specify: semantic structure; keyboard navigation; visible focus; contrast; non-color status; form labels; error association; target sizes (~44px where practical); zoom/reflow; modal/drawer focus; icon labels; screen-reader status semantics.

Align with `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md` where applicable.

---

## 20. DESIGN TOKENS / PRIMITIVES REQUIRED

Concrete proposed Transovo visual foundation.

**Color roles** — canvas; primary surface; secondary surface; border; strong/normal/muted text; primary action; selected; informational; success; warning; destructive; focus. Do not overuse purple because portions of the product use purple.

**Spacing** — reusable scale for page padding; section gaps; card padding; form spacing; table density; inline controls.

**Radius** — small intentional system.

**Elevation** — when shadows are allowed.

**Iconography** — family; sizing; stroke weight; containers; decorative vs meaningful use.

Existing code may reference `src/styles/kimi/` and Transovo standards docs — audit **implemented UI**, not only docs.

---

## 21. PAGE-HEADER SYSTEM REQUIRED

Canonical system supporting at least:

- **Standard page header** — Title; Description; Optional status; Optional primary action  
- **Operational page header** — Title; Description; Filters/time range/actions  
- **Focused editor header** — Title; Description; Save/test/go-live where appropriate  
- **Setup subsection header** — Parent context; Section title; Description; Save/action  

---

## 22. ACTION PLACEMENT

Define: page-level primary; section-level; row; contextual; destructive; save; test; go live.

Actions near the object they affect. Avoid duplicate Save unless deliberate. Audit sticky bottom bars — when justified.

---

## 23. DENSITY

Medium-density operational SaaS. Do not copy oversized Voice Calls KPI-card treatment product-wide. Prefer MCTB operational density for operational views; moderate for configuration; spacious enough for focused editors.

---

## 24. HEALTHY STATE SHOULD BE QUIET

Active / Ready / Verified / Configured — clear but restrained.

Stronger emphasis for: action required; failure; destructive consequence; compliance problem; blocked configuration.

---

## 25. DO NOT INTRODUCE FAKE CONTROLS

Every visible control must map to working behavior. Identify missing interactions separately; do not fabricate for screenshots.

---

## 26. SHARED SYSTEM FIRST

Implementation order (for the **future** polish pass — not this audit pass):

1. visual tokens  
2. layout primitives  
3. typography  
4. page headers  
5. buttons/forms  
6. status/badges  
7. tables/lists  
8. tabs/local navigation  
9. empty/loading/error states  
10. modal/drawer patterns  
11. responsive primitives  
12. page-family application  
13. page-specific exceptions  

Do not start by individually restyling 20 pages.

---

## 27. PAGE-FAMILY IMPLEMENTATION ORDER

After design system is **approved** (future phase):

| Family | Pages |
|--------|--------|
| **1 — MCTB operational** | Overview; Missed Calls; Inbox integration/shell; AI Recovery; Voicemail; Analytics |
| **2 — MCTB Setup** | Setup Overview; Phone & Forwarding; Consent; Text Back; Recovery; Voicemail; Notifications; Exclusions; Links; Test |
| **3 — Shared messaging** | Inbox shell/components; conversation list/detail; MCTB-specific states/actions |
| **4 — Voice operational** | Overview; Calls; Analytics |
| **5 — Voice configuration** | Receptionist; Business Knowledge; Call Handling |

This ordering is **not** permission to alter established IA.

---

## 28. SCREENSHOT REVIEW REQUIREMENT

Inspect **all** supplied screenshots side-by-side — not in isolation.

For each screenshot identify: page family; layout archetype; strongest patterns; inconsistent patterns; reusable components; one-off components; density/hierarchy/typography/spacing/action-placement problems; customer-language problems; state problems; accessibility concerns; responsive risks.

Classify each issue as:

- **SYSTEMIC** — fix via shared design system/component  
- **PAGE-FAMILY** — fix across related pages  
- **PAGE-SPECIFIC** — legitimate local solution  

Do not solve systemic problems with page-specific CSS.

---

## 29. DO NOT IMPLEMENT YET

Before implementation, return a report containing:

| Section | Content |
|---------|---------|
| **A. Executive visual diagnosis** | Why the app feels inconsistent; target visual direction |
| **B. Existing-pattern inventory** | KEEP / REFINE / REPLACE / CONSOLIDATE |
| **C. Proposed Transovo design system** | Typography; spacing; color roles; surfaces; borders; radii; shadows; buttons; forms; status; tables; navigation; page headers; empty/loading/error |
| **D. Layout archetypes** | Operational wide; standard; focused editor; specialized Inbox — map pages |
| **E. Component consolidation map** | Existing implementations → canonical component → migration pages |
| **F. Page-by-page visual audit** | Every supplied/canonical page: what works; inconsistencies; shared-system fixes; page-specific work |
| **G. Customer-language audit** | Developer terminology to rewrite; compliance-sensitive items flagged |
| **H. Responsive strategy** | Per page family: desktop → mobile |
| **I. Accessibility findings** | Issues and remediation |
| **J. Functional blockers discovered** | Separate from visual findings |
| **K. Proposed implementation sequence** | Safest order without destabilizing behavior |

---

## 30. CHANGE-DISCIPLINE RULE

During eventual implementation: **Audit → Preserve → Extend → Consolidate.**

Before changing a component:

1. determine what it currently does  
2. determine which pages depend on it  
3. determine whether it contains business behavior  
4. preserve working behavior  
5. change presentation at the narrowest correct layer  
6. migrate repeated surfaces to the canonical primitive  
7. verify affected states  

Do not rewrite working business logic because the UI component is visually weak.

---

## 31. PROTECTED SYSTEMS

Visual work must **not** modify unless a separately identified blocker requires it:

TeXML ingress; CFNA; consent runtime; eligibility; suppression; STOP/HELP; sender-authority runtime; PLATFORM/WORKSPACE routing; Telnyx/Twilio provider adapters; canonical platform-sender resolver; AI Recovery messaging policy; human-takeover runtime; booking-link event semantics; analytics metric definitions; LiveKit; GPT-Live; delegated Responses architecture; Voice tool execution; appointment provider execution; post-call pipeline; recording/transcription pipeline; business-knowledge runtime.

Visual polish is not authorization to refactor these systems.

---

## 32. PROVIDER ABSTRACTION

Do not visually redesign PLATFORM messaging as “Telnyx messaging.”

**PLATFORM** = Transovo-controlled sender authority. Telnyx/Twilio = provider implementation. Twilio path must remain available.

Customer-facing UI should generally describe: Transovo-managed messaging; your messaging number; your business line; your forwarding number — not infrastructure providers unnecessarily.

---

## 33. NO ARCHITECTURE REGRESSION

Specifically prohibited during visual work:

- resurrecting old routes because UI looks nicer  
- adding new permanent nav  
- duplicate configuration editors  
- restoring direct MCTB scheduling  
- restoring no-reply chase automation  
- giving PLATFORM customers unrestricted composer access  
- exposing provider implementation as product architecture  
- merging workspace ingress and global platform sender concepts  
- converting MCTB into a CRM  
- converting Overview into configuration  
- moving operational Voicemail configuration out of Setup ownership  
- changing analytics semantics for easier charts  
- changing runtime because a frontend component is inconvenient  

---

## 34. SUCCESS CRITERIA

This audit succeeds when all of the following can be answered **before** implementation:

1. What does a Transovo page look like?  
2. What does a Transovo page header look like?  
3. What typography hierarchy does every product use?  
4. What are the canonical spacing rules?  
5. When do we use a card?  
6. What do forms look like?  
7. What do tables look like?  
8. What do statuses look like?  
9. What do actions look like?  
10. How are tabs/navigation levels differentiated?  
11. How are healthy vs warning vs failure states presented?  
12. What happens while loading?  
13. What happens when empty?  
14. What happens when an API partially fails?  
15. What happens on mobile?  
16. Which existing components become canonical?  
17. Which old components should be retired?  
18. Which pages need only shared-system migration?  
19. Which pages genuinely require custom visual work?  
20. Can all of this be accomplished without changing the frozen product architecture?  

If those questions are not answered, the audit is **not** complete.

---

## 35. FINAL OUTPUT

End this pass with **exactly one** overall implementation readiness verdict:

**`READY FOR SHARED VISUAL-SYSTEM IMPLEMENTATION`**

or

**`NOT READY — FUNCTIONAL / ARCHITECTURAL BLOCKERS MUST BE RESOLVED FIRST`**

If not ready, enumerate only **genuine** blockers. Do not classify ordinary visual inconsistency as an architecture blocker.

**Do not implement the redesign during this pass.**

The immediate goal is the definitive visual specification that the subsequent implementation pass will follow.

---

## Related references (read-only context — screenshots remain evidence)

- Transovo standards: `docs/TRANSOVO-*.md` and `.cursor/rules/transovo-*.mdc`  
- MCTB architecture freeze: `docs/MCTB-LAUNCH-ARCHITECTURE-FREEZE.md`  
- Pass 6 handoff: `docs/MCTB-PASS-6-OWNER-HANDOFF-SUMMARY.md`  
- Screenshot manifest: `docs/KIRSTEN-VISUAL-AUDIT-SCREENSHOT-MANIFEST.md`  
- Regenerate captures: `scripts/capture-mctb-voice-visual-audit.ts`
