# Transovo MCTB Page Build Spec — 01: Overview

**Status:** Active — mandatory implementation specification  
**Route:** `/mctb`  
**Product:** Missed Call Text Back  
**Page archetype:** Operational dashboard  
**Canonical navigation:** MCTB → Overview  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment product screenshots + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Interaction, Forms, Responsive, Tables, Privacy/Consent, Security, Date/Time, and i18n standards plus the MCTB product/domain, IA, manifest, and canonical map documents

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-01-overview.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule for this page

The MCTB Overview page is the operational home of Missed Call Text Back. Its purpose is to let a business understand within seconds whether MCTB is working, what happened recently, whether anything requires attention, and where to go next. It is **not** a duplicate Missed Calls list, Conversations inbox, Analytics report, or Setup editor. Healthy system state should remain visually quiet; actionable exceptions should receive prominence proportional to consequence. Every metric, status, warning, recent event, and setup-health item must be derived from authoritative runtime state. The page must use the same shell, typography, spacing, color, surface hierarchy, button language, status treatment, density, and shared components as the completed Transovo Appointment product.

---

## 2. Primary user and context

### Primary users

- Solo business owner
- Receptionist
- Office manager
- Scheduler
- Small-team operator

### Primary context

- Repeated daily use
- Mostly desktop during business hours
- Mobile checks away from desk
- User may have only a few seconds to assess what happened
- User may be responding between phone calls or other work

### Primary user question

**"Did I miss anyone, did Transovo recover them, and is there anything I need to handle?"**

---

## 3. Primary job

The page has exactly one primary job:

**Provide a concise operational snapshot of MCTB and surface the next action only when something actually requires attention.**

It should answer the five Transovo page questions immediately:

1. **Where am I?** — Missed Call Text Back → Overview
2. **What is this page for?** — See missed-call recovery activity and system health.
3. **What can I do here?** — Open missed calls, respond to conversations, fix blockers, or manage setup.
4. **Does anything require attention?** — Clearly shown near the top when true.
5. **Where do I go next?** — Contextual links into Missed Calls, Conversations, Analytics, or Setup.

---

## 4. Screenshot calibration requirement

Before styling this page, Cursor must capture representative screenshots from the completed Appointment product showing at least:

- the global app shell
- an operational dashboard/Home page
- KPI/stat treatment
- Needs Attention treatment
- compact recent-record list/table
- status badge treatment
- section heading/spacing patterns
- buttons/link hierarchy
- loading skeletons if already implemented

Cursor must use those as the artistic/visual baseline.

### Important

**Screenshots control:** visual language, spacing feel, colors, typography, border treatment, density, component styling, alignment, page gutters.

**They do not control:** MCTB page architecture, MCTB terminology, MCTB domain behavior, MCTB information hierarchy. Those come from the governing MCTB specs.

---

## 5. Global page structure

Use the canonical Transovo page anatomy:

```
Global Transovo shell
    ↓
Page header
    ↓
MCTB local navigation
    ↓
Critical operational state, only when necessary
    ↓
Primary KPI region
    ↓
Needs attention
    ↓
Recent missed calls
    ↓
Recent conversations
    ↓
Setup health
    ↓
Performance snapshot
```

Not every section needs a card. Use whitespace, section headings, and subtle dividers before introducing unnecessary containers.

---

## 6. Global shell

Use exactly the same canonical authenticated Transovo shell as Appointments.

**Do not create:**

- MCTB-specific sidebar component
- MCTB-specific global header
- old Voice sidebar
- page-specific shell
- alternate MCTB mobile shell

MCTB is a product workspace within the same Transovo system.

---

## 7. MCTB local navigation

**Canonical MCTB local navigation:**

- Overview *(selected)*
- Missed Calls
- Conversations
- Voicemail *(permanent operational peer — locked)*
- Analytics
- Setup

Use the same local-nav styling already established elsewhere in Transovo.

**No** Consent Log, Try It, Schedule, Numbers, Needs Attention, Reports as peer primary navigation items. Those are contextual/subordinate.

---

## 8. Page header

### Left side

- **H1:** Overview
- Optional concise supporting line: *See missed-call recovery activity and anything that needs your attention.* Keep it short. Do not use a giant marketing subtitle.

### Right side

The page should not automatically have a bright primary CTA in a healthy configured state. Primary action is state-dependent.

---

## 9. Header action rules

### State: setup incomplete

**Primary:** Finish setup — links directly to the exact incomplete setup area where practical.

**Potential secondary:** Test setup — only if testing is currently possible.

### State: paused

**Primary:** Resume MCTB  
**Secondary:** Manage schedule

### State: healthy

Do not invent a bright action merely because the page architecture template allows one.

Possible quiet secondary action: **Manage setup** — or none. Healthy state should remain calm.

---

## 10. Critical status region

This region only appears when necessary. It should not be a permanent giant green success banner.

**Appropriate examples:**

**Setup incomplete** — *Finish setting up Missed Call Text Back* — Forwarding has not been verified, so missed calls cannot be recovered yet. → **Finish setup**

**Messaging blocked** — *Text-back messages are unavailable* — Your messaging sender is not ready. Missed calls can still be detected, but recovery texts will not be sent. → **Fix messaging**

**Paused** — *Missed Call Text Back is paused* — Recovery is paused until Sep 9 at 8:00 AM Eastern Time. → **Resume now**

**Provider/system degraded** — *Some text-back activity may be delayed* — Missed calls are still being detected, but message delivery status is temporarily unavailable. → View details if a real resolution path exists.

---

## 11. Healthy state treatment

Healthy status should be quiet. A compact status line is sufficient: **● Active** with text—not color alone. Or a small status badge integrated near product context.

**Do not show:** giant green panel, giant checkmark illustration, "Everything is awesome!", multiple green cards saying Connected / Verified / Active.

---

## 12. Primary KPI region

The first operational data region should contain the smallest useful set of high-frequency metrics.

**Recommended primary metrics:**

1. Missed calls
2. Recovery texts sent
3. Replies
4. Conversations needing reply — if authoritative and useful

**Default period:** Today

**Potential date control:** Today | Last 7 days — only if this does not turn Overview into Analytics.

**Example:**

| Missed calls | Recovery texts sent | Replies | Need a reply |
|-------------|---------------------|---------|--------------|
| 12 | 9 | 4 | 2 |

---

## 13. KPI terminology rules

| Use | Not |
|-----|-----|
| Missed calls | Lost Calls, Call Events, Voice Events |
| Recovery texts sent | SMS sends, Missed-call SMS, Recovery outreach, Auto-response messages (pick one canonical phrase) |
| Replies | Engagement responses, Message interactions |

Use one canonical term consistently.

---

## 14. KPI visual treatment

Use the same KPI component language already established in Appointment analytics/home.

**Requirements:** medium density, strong number, quiet label, no unnecessary icon on every card, no rainbow colors, no giant cards, no sparkline unless it provides real useful pattern information, no fabricated percentages.

If four KPI cards make the page visually noisy, use one contained KPI strip/grid rather than four oversized independent cards.

---

## 15. KPI interaction

Where useful, KPIs can be links:

- Missed calls 12 → `/mctb/missed-calls?date=today`
- Need a reply 2 → `/mctb/conversations?status=needs-reply`

Do not make every number clickable merely because it can be. Clickable metrics need clear interactive affordance.

---

## 16. Needs Attention section

**Heading:** Needs attention

If nothing needs attention, either omit the section or show a very compact quiet state. Do not use a large "Everything looks good" card.

---

## 17. Needs Attention object model

Each item must contain: **Problem | Impact | Affected thing | Time/context | Resolution action**

**Examples:**

- *Forwarding hasn't been verified* — Missed calls from your business line may not reach Transovo. Business line: (571) 555-1234 → **[Verify forwarding]**
- *2 conversations need a reply* — Two callers replied to your recovery text and haven't received a response. → **[Open conversations]**
- *Messaging sender needs attention* — Recovery texts cannot be sent until sender verification is complete. → **[View messaging setup]**

---

## 18. Needs Attention prioritization

Order by consequence, not timestamp alone.

| Severity | Meaning | Examples |
|----------|---------|----------|
| **Critical** | MCTB cannot operate | forwarding broken, sender unavailable, compliance suppression affecting all sends, configuration invalid |
| **Warning** | MCTB partly works | some delivery failures, schedule paused unexpectedly, provider partial outage, one line misconfigured |
| **Operational task** | Business should take action | conversations need reply, callback requested, voicemail requires follow-up |

Do not make these all visually identical.

---

## 19. Needs Attention must use authoritative reason codes

Backend/runtime should provide actual reason/state. Example: `forwarding_verification_required`, `recipient_reply_pending`, `sender_registration_pending`. UI translates those into customer language. No AI guessing.

No: *"It looks like your forwarding may possibly be broken."* unless runtime truly only has uncertain diagnostics and labels them as such.

---

## 20. Recent Missed Calls section

**Heading:** Recent missed calls  
**Secondary action:** View all → `/mctb/missed-calls`

Give the user a quick picture of very recent recovery events without recreating the full Missed Calls table. Show approximately **5** recent events depending on page density.

---

## 21. Recent Missed Calls columns/content

**Suggested compact desktop representation:**

| Caller | Missed | Recovery | Reply |
|--------|--------|----------|-------|

**Potential rows:**

- (571) 555-0184 | 10:42 AM | Text delivered | Replied
- Anthony Johnson | 9:18 AM | Waiting for consent | —
- (703) 555-9921 | 8:56 AM | Suppressed | Opted out

Do not overload Overview with business line column (unless multiple lines matter), provider ID, call SID, campaign, internal mode enum, or every suppression detail. Those belong in Missed Calls/detail.

---

## 22. Missed-call row interaction

Row primary identity links to Missed Call Detail. Use semantic table if the information is tabular. Do not use ARIA grid. Do not make plain cells all tab stops. If whole-row pointer click is supported as enhancement, retain a real accessible primary link.

---

## 23. Recent Missed Calls empty state

**New/unconfigured** — Do not show "No missed calls yet" if the system cannot receive them because setup is incomplete. Instead: *Finish setup to start recovering missed calls.* → **Finish setup**

**Configured but no calls** — *No missed calls today* — When a call is missed, its recovery status will appear here. No giant illustration.

---

## 24. Recent Conversations section

**Heading:** Recent conversations  
**Secondary action:** Open conversations → `/mctb/conversations`

Surface recent customer replies and threads needing attention.

---

## 25. Recent conversation item

Show: Contact/caller, Short latest-message preview, timestamp, unread / needs reply state, source context if needed.

**Examples:**

- Anthony Johnson — "Yes, can someone call me after 3?" — 10:47 AM — **Needs reply**
- (571) 555-3098 — "Tomorrow morning works." — 9:21 AM — **Replied**

Do not place a full SMS composer inside Overview. Open the canonical conversation.

---

## 26. Conversation state hierarchy

Operationally important state should be stronger than generic timestamps. **Needs reply** should be obvious. **Replied** can be quieter. **Opted out** is explicit. Do not use colored dot alone.

---

## 27. Setup Health section

Give a compact view of whether critical MCTB infrastructure is ready. This is not a complete setup editor.

**Heading:** Setup — or **Setup status**. Avoid "System Configuration Health Matrix."

---

## 28. Setup Health required concepts

| Concept | Example |
|---------|---------|
| Business line | (571) 555-1234 |
| Forwarding | Verified |
| Consent | Verified Call Consent |
| Text-back sender | (703) 555-4567 · Ready |
| Schedule | Always on |
| Voicemail | Enabled *(only if meaningful)* |

---

## 29. Setup Health interactions

Each row links to its canonical editor:

- Business line / Forwarding → Setup → Phone
- Consent → Setup → Consent
- Text-back sender → Setup → Messaging
- Schedule → Setup → Schedule

No inline duplicate editor.

---

## 30. Setup Health number terminology

Reinforce the number-role model. **Never** show ambiguous "Your number" for multiple roles.

Use: **Business line | Forwarding destination | Text-back sender**

If the hidden forwarding destination does not need to be exposed on Overview, omit it rather than confuse the user.

---

## 31. Performance snapshot

At the bottom, provide a small performance summary only if useful.

**Possible:**

*Recovery performance — Last 7 days — 38 missed calls · 31 recovery texts · 14 replies · 45% reply rate*

**CTA:** View analytics

Do not place five charts here. Analytics owns deeper performance analysis.

---

## 32. Chart rule for Overview

Prefer KPI/value over chart unless the pattern materially matters. If a tiny trend: real data only, restrained, follows Transovo analytics chart system, accessible textual equivalent. No decorative chart just to fill space.

---

## 33. First-use state

When MCTB is not configured, Overview should transform meaningfully.

**Do not show** Missed calls 0, Texts 0, Replies 0, Conversations 0 as the primary experience — that falsely suggests an operating product with zero activity.

**Instead** present a compact setup state:

*Set up Missed Call Text Back*
1. Choose your business line
2. Choose how consent is handled
3. Configure your recovery message
4. Connect call forwarding
5. Run a live test
→ **[Continue setup]**

Can include saved progress. Do not turn Overview into a second onboarding wizard — route into canonical Setup/Onboarding process.

---

## 34. Paused state

When paused, show clearly: *Missed Call Text Back is paused — Paused until Sep 9 at 8:00 AM Eastern Time*

**Primary:** Resume now | **Secondary:** Manage schedule

Metrics/history remain visible. Do not replace the whole page with a pause screen.

---

## 35. Partial/degraded state

Example: *Missed calls are available, but messaging provider status cannot currently be loaded.*

The page should still show header, navigation, missed-call metrics if available, recent calls if available. Only affected components show degraded state.

*Text delivery status is temporarily unavailable. Missed-call detection is still working.*

Do not blank the entire dashboard.

---

## 36. Error state

If main Overview data cannot load: keep app shell, local nav, page title. Then show: *Overview couldn't be loaded. Your settings have not been changed.* → **Retry**

If individual component fails, localize the error to that component.

---

## 37. Loading state

Use geometry-matched skeletons for: KPI strip, Needs Attention, recent missed calls, conversations, setup health.

**Do not** temporarily render zero values while data loads. Loading ≠ empty.

---

## 38. Success/updated states

Minor background save: quiet inline **Saved**.

Consequential state: *Missed Call Text Back resumed.* Toast may reinforce but persistent page state must update too. Do not rely solely on toast.

---

## 39. Date/time rules

All dates/times must use canonical Transovo formatters. Examples: `10:42 AM`, `Sep 8 · 10:42 AM`, `Today · 10:42 AM` depending on context.

- actual events use authoritative instant
- display in defined workspace/user timezone
- timezone context visible where ambiguity matters
- no raw ISO timestamps
- no browser/server ad hoc formatting
- Today calculated in proper workspace context

---

## 40. Relative time

Recent activity may use *3 minutes ago* only where useful. Exact time must remain available for consequential/audit context. Do not use relative-only time in consent evidence.

---

## 41–43. Responsive behavior

### Desktop

Medium-density Appointment visual language. Possible composition: Header / local nav → KPI strip → Needs attention → Recent missed calls + Recent conversations (or stacked) → Setup status → Performance snapshot. Do not force two-column layout if content becomes cramped.

### Tablet

KPI grid may become 2×2; recent sections stack; local navigation follows canonical responsive component; setup rows stay readable; no page-wide horizontal scroll.

### Mobile

Same product, same concepts. Suggested order: Overview → Status/problem → KPIs → Needs attention → Recent missed calls → Recent conversations → Setup status → Performance.

Tables transform to structured records. Example recent call card: Caller, time, Recovery status, Reply status. Do not squeeze desktop tables into 320px.

---

## 44. Mobile primary navigation

Use approved MCTB mobile IA. If bottom nav is constrained: Overview | Missed Calls | Conversations | More (Voicemail, Analytics, Setup). Must match canonical shared MCTB navigation strategy.

---

## 45. Accessibility requirements

Meet complete Transovo accessibility standards. At minimum: one H1, correct landmark structure, Skip to main content, semantic links/buttons, KPI labels programmatically understandable, table semantics for recent calls if table used, status text not color only, visible keyboard focus, logical Tab order, no hover-only action, accessible action-menu names, live status updates announced appropriately, 200% text zoom, 320px reflow, 44px touch targets where practical, no clipped focus rings, reduced motion respected.

---

## 46. Keyboard flow

Reasonable order: Skip to main → Global nav → MCTB local nav → Page-level primary action if present → Critical status action → KPI links if interactive → Needs Attention actions → Recent missed call links → View all → Recent conversation links → Open conversations → Setup links → Analytics link.

Do not make noninteractive KPI containers tabbable.

---

## 47. Screen-reader table requirement

If Recent Missed Calls is a table: use `<table>`, `<thead>`, `<th scope="col">`. No ARIA grid. No div pseudo-table. If mobile transforms into cards/list, hidden desktop table must not remain exposed simultaneously.

---

## 48. Privacy/compliance rules

Overview may show factual compliance state.

**Good:** Text-back sender — Verification pending | Consent method — Verified Call Consent

**Bad:** ✅ Fully TCPA compliant

Do not make blanket legal guarantees. Do not expose unnecessary consent evidence/details here.

---

## 49. Sensitive data minimization

Show only what helps the current task. Avoid: full consent payloads, provider tokens, call recording URL, internal IDs, A2P campaign IDs, raw compliance payload, every customer detail.

---

## 50. Security/permission behavior

If user can view activity but not change setup: Overview still works; Setup links may become read-only or permission-controlled; unauthorized actions hidden/disabled per shared patterns; server still enforces authorization.

Do not redirect ordinary staff from Overview simply because they cannot edit configuration.

---

## 51. Runtime data contract

Inspect existing backend/domain APIs before wiring. Do not create frontend approximations if backend has authoritative values.

Page needs authoritative representations for concepts like:

- `mctb_status`, `paused_until`
- `missed_calls_today`, `recovery_texts_today`, `replies_today`, `needs_reply_count`
- `recent_missed_calls[]`, `recent_conversations[]`
- `setup_readiness`, `forwarding_state`, `sender_state`, `consent_mode`, `schedule_state`

Exact API schema should reuse existing runtime services where possible.

---

## 52. No duplicated state computation

Do not have Overview calculate `if sender exists && tfv === approved → ready` if canonical backend already defines sender readiness. Likewise do not infer *customer replied* from random message-count logic if conversation domain owns that state. One source of truth.

---

## 53. Data freshness

Surface meaningful freshness (*Updated just now*) only if real. Do not show a fake syncing spinner. Background refresh must not reorder focused content unexpectedly.

---

## 54. Analytics consistency

If Overview says *Missed calls today: 12* and Analytics filtered to today says *Missed calls: 14* without a defined scope difference, the product is broken. Metric definitions must be shared.

---

## 55. Terminology consistency

Terms used here must match every other MCTB page: Missed call, Recovery text, Conversation, Reply, Business line, Text-back sender, Consent, Suppressed, Opted out, Needs attention.

---

## 56. Visual emphasis budget

**Strongest elements:** (1) Page title, (2) Actual critical alert if one exists, (3) Key operational numbers, (4) An unresolved action. Everything else subordinate.

Do not create: four bright KPI colors, multiple red/yellow/green sections, five primary buttons, giant brand panels, gradient cards.

---

## 57. Cards rule

Cards appropriate for: KPI grouping, meaningful Needs Attention items, possibly compact setup health panel.

Do not wrap every section, every row, every label/value, or one card inside another card in separate elevated boxes.

---

## 58. Visual tokens

No arbitrary page-level hex values, border-radius, margins, or font sizes unless represented by canonical semantic tokens. Reuse shared typography roles, spacing, surface tokens, borders, radius, button variants, status components.

---

## 59. MCTB Overview prohibited patterns

Cursor must **not**:

- recreate the old `/voice/missed-calls` page as Overview
- place the entire setup form on Overview
- create a separate MCTB shell
- show a giant green healthy banner
- use cards around everything
- show provider jargon
- show mock metrics
- guess recovery rate
- infer consent
- show raw error codes
- expose hidden forwarding architecture unnecessarily
- permanently display Try It or Consent Log
- duplicate Conversations
- add fake quick actions
- use hover-only row actions
- make mobile a different IA
- use Appointment screenshots to overwrite MCTB domain architecture

---

## 60. Overview test scenarios

| Scenario | Verify |
|----------|--------|
| **A — First-time user** | MCTB not configured; explains setup; CTA lands at correct continuation; no misleading zero-performance dashboard |
| **B — Healthy active user** | 12 missed, 9 texts, 4 replies, 2 need reply; page prioritizes the two conversations |
| **C — No activity today** | System active; no missed calls; professional empty state; setup shown quietly |
| **D — Paused** | Exact pause state; exact resume time/timezone; Resume works; history visible |
| **E — Messaging sender blocked** | Calls detected; page says texts cannot be sent; CTA links to fix |
| **F — Partial provider degradation** | Missed-call data visible; only delivery region degraded |
| **G — Staff without setup permission** | Can view operations; cannot change protected config; UI and backend agree |
| **H — Mobile** | No horizontal overflow; recent calls readable; actions reachable; local nav accessible |

---

## 61. Definition of done — Overview

Cursor may mark `/mctb` complete only when:

- [ ] Uses canonical Transovo shell
- [ ] Uses canonical MCTB local nav
- [ ] Matches Appointment visual language
- [ ] H1 is Overview
- [ ] Page primary job is operational health/activity
- [ ] Healthy state remains quiet
- [ ] Critical blockers are prominent/actionable
- [ ] Primary KPIs use authoritative data
- [ ] Needs Attention uses real reason/state
- [ ] Recent Missed Calls link to canonical details
- [ ] Recent Conversations link to canonical threads
- [ ] Setup Health links to canonical editors
- [ ] Analytics snapshot does not duplicate Analytics
- [ ] First-use state is distinct from no-activity state
- [ ] Paused state includes exact status/resume behavior
- [ ] Partial/degraded state preserves working portions
- [ ] Loading does not show false zeros
- [ ] Errors have recovery
- [ ] No mock analytics
- [ ] No fake controls
- [ ] No provider/backend terminology leaks
- [ ] Number-role terminology is correct
- [ ] Date/time uses canonical formatter/timezone rules
- [ ] Desktop/tablet/mobile behavior complete
- [ ] 320px reflow passes
- [ ] 200% zoom passes
- [ ] Keyboard-only operation passes
- [ ] Focus remains visible
- [ ] Semantic tables used where appropriate
- [ ] Screen-reader state/status treatment works
- [ ] Permission state works
- [ ] Cross-page metric/state terminology agrees
- [ ] Runtime truth agrees with visible UI
- [ ] Appointment/MCTB visual comparison performed after implementation

---

## Build handoff

Once Overview is complete, the next screen in the page-by-page package is:

**02 — Missed Calls List** (`/mctb/missed-calls`) — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-02-MISSED-CALLS.md`.

**03 — Missed Call Detail** (`/mctb/missed-calls/:id`) — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-03-MISSED-CALL-DETAIL.md`.

**04 — Conversations** (`/mctb/conversations`) — pending build spec.
