# Transovo MCTB Page Build Spec — 03: Missed Call Detail

**Status:** Active — mandatory implementation specification  
**Route:** `/mctb/missed-calls/[id]`  
**Product:** Missed Call Text Back  
**Page archetype:** Canonical object detail  
**Canonical navigation:** MCTB → Missed Calls → Missed Call Detail  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment product screenshots + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Interaction, Forms, Responsive, Tables, Privacy/Consent, Security, Date/Time, and i18n standards plus the MCTB product/domain, IA, manifest, Overview, Missed Calls specs, and canonical map

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-03-missed-call-detail.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule for this page

The Missed Call Detail page is the **authoritative record of one missed-call recovery event**. Its purpose is to let the user understand exactly what happened from the original missed call through consent, recovery messaging, reply behavior, voicemail or request-form activity, and any failure/suppression state. The page must present one coherent operational story using authoritative runtime events and reason codes. It must **not** duplicate the Conversations inbox, Consent Log, Voicemail inbox, or Setup editors. Related objects should be linked contextually. Technical provider identifiers stay hidden from ordinary users unless opened through diagnostics.

---

## 2. Primary user and context

### Primary users

Receptionist, Office manager, Business owner, Scheduler, Support/admin diagnosing one recovery event.

### Primary context — user questions

- Did this caller actually miss us?
- What happened after the call?
- Did they press 1? Was consent recorded?
- Did compliance/recovery texts go out? Delivered?
- Did the caller reply? Why was no text sent?
- Voicemail? Request form? Call back?

### Primary user question

**"What exactly happened with this caller, and what should I do next?"**

---

## 3. Primary job

Exactly one primary job: **Explain the complete recovery lifecycle for one missed-call event and expose the correct next action.**

| Question | Answer |
|----------|--------|
| Where am I? | MCTB → Missed Calls → this caller/event |
| What is this for? | Understand one missed-call recovery event |
| What can I do? | Open conversation, call back, review consent/voicemail/failure, navigate related records |
| Attention needed? | Operational state must be obvious |
| Where next? | Conversation, voicemail, consent record, form response, setup/diagnostic fix |

---

## 4. Screenshot calibration requirement

Capture Appointment detail pages: object identity/header, status placement, action hierarchy, related-object links, timeline/activity, context panel, warning/error, drawers, mobile detail. Visual language only — not Appointment domain fields.

---

## 5. Canonical detail-page anatomy

```
Global shell
    ↓
Page header / identity
    ↓
Primary actions
    ↓
Operational state
    ↓
Core information
    ↓
Related processes / objects
    ↓
Activity / recovery timeline
    ↓
Diagnostics / advanced technical detail (if needed)
```

One coherent record — not unrelated cards piled together.

---

## 6–8. Header

### Structural back

**← Missed Calls** (or breadcrumb per Transovo detail pattern). Not vague "Back."

### H1

Prefer caller identity: **Anthony Johnson** — or **(571) 555-0184** if unknown.

### Supporting metadata

*Missed call · Sep 8, 2026 · 10:42 AM* — optional: *Called (703) 555-4421*

### Header status (one primary)

Recovered | Needs reply | Waiting for consent | Suppressed | Failed | No recovery text sent | Completed — canonical only. Not 5 badges.

### Header actions (state-dependent)

| State | Primary | Secondary |
|-------|---------|-----------|
| Caller replied, business owes response | Open conversation | Call customer, More |
| No conversation, callback makes sense | Call customer | Open conversation, etc. |
| Failure needs config fix | Fix setup *(only if actionable elsewhere)* | — |

**One dominant action.** No fake: Resend, Mark recovered, Override opt-out, Force consent, Retry without backend, "Fix automatically."

---

## 9–12. Operational lifecycle summary

Compact scannable stages after header:

**Call → Consent → Compliance text → Recovery text → Reply**

Example:

```
Call          Missed · 10:42 AM
Consent       Captured by Verified Call Consent · 10:43 AM
Compliance text  Delivered · 10:43 AM
Recovery text    Delivered · 10:43 AM
Reply         Needs reply · 10:47 AM
```

**Press-1:** distinguish missed call → prompt → press 1 → consent record → compliance confirmation → recovery message → reply. Do not collapse two outbound messages into one "First text."

**Existing Consent:** show *Existing consent mode* and actual outcome — no Press-1 prompt/audio fields.

---

## 13–14. Call information section

**Heading:** Call details

| Field | Example |
|-------|---------|
| Caller | Anthony Johnson / (571) 555-0184 |
| Business line | (703) 555-4421 |
| Missed | Sep 8, 2026 · 10:42 AM |
| Trigger | No answer |
| Repeat calls | 3 calls today |

Terminology: Caller | Business line | Text-back sender (where needed). No hidden forwarding destination unless diagnostics.

---

## 15–17. Consent section

**Heading:** Consent

**Verified Call Consent example:**

- Method: Verified Call Consent
- Outcome: Consent captured
- Captured: Sep 8, 2026 · 10:43:12 AM
- Scope: Missed-call text-back for this inquiry
- **View consent record** → Consent Log entry

**Summarize only** — no raw payloads, call-control IDs, prompt asset IDs, audio URLs, internal enums.

**Failure states:**

- *Caller did not press 1* — Not captured; no recovery text sent
- *Existing consent mode* — factual configuration language
- *Consent status unavailable* — if cannot load; do not guess

---

## 18–21. Messaging section (Text-back)

**Heading:** Text-back

**Press-1 flow — distinguish:**

- Compliance confirmation — Delivered · 10:43 AM
- Recovery message — Delivered · 10:43 AM

Show **actual sent content** historically — not current template if changed.

**States:** Queued | Sent | Delivered | Failed | Suppressed | Canceled — canonical only. Delivered ≠ Sent. Suppressed ≠ Failed.

**Failure:** *Failed — Sender was temporarily unavailable* + link to messaging setup if repair path exists. No fabricated reasons.

**Suppression examples:** Customer opted out | Sender not eligible | Consent not captured — from authoritative reason codes.

---

## 22–23. Conversation section

If conversation exists:

- Latest reply preview, received time, status (Needs reply)
- **Open conversation** — canonical thread; no full inbox/composer unless established Transovo pattern with canonical engine

If no reply: *No reply yet.* — no empty composer.

---

## 24–26. Related objects

### Voicemail

Duration, timestamp, transcript preview if available → **Open voicemail**. Omit if none unless absence matters.

### Request form

Submitted at, field summary, link to full response if canonical view exists.

### Link activity

Real tracked events only: *Booking link — Opened · 10:49 AM* — do not infer viewed from delivery.

---

## 27–30. Recovery timeline

**Heading:** Recovery timeline — chronological authoritative events.

Example sequence: Call missed → Forwarded to Transovo → Consent prompt played → Caller pressed 1 → Consent recorded → Compliance confirmation sent/delivered → Recovery message sent/delivered → Caller replied → Business replied.

- From canonical runtime/audit events — not frontend inference
- User-facing language — not `dtmf_event_digit_1` or `DLR_SUCCESS`
- Omit steps if instrumentation doesn't exist
- Keep planned vs actual distinct (Scheduled → Sent → Delivered with separate timestamps)

**Semantics:** `<ol>` with event name, timestamp, details — not decorative div-only timeline.

---

## 31–32. Diagnostics section

**Technical details / Diagnostics** — collapsed/secondary. Internal event ref, provider call ref, delivery status, reason code, sender identity, forwarding context. Truthful: *No additional provider detail was supplied* if empty. No secrets (tokens, credentials, session IDs).

---

## 33–35. Attention & healthy states

**Needs attention** near top when applicable — e.g. *Needs reply — caller replied at 10:47 AM* → Open conversation; *Recovery message failed* → View messaging setup.

**Healthy:** compact *Recovered* — no giant green panel. Timeline shows the rest.

**Callback:** Do not mark "Called back" unless authoritative. Distinguish Callback requested / attempted / completed only if real states exist.

---

## 36–38. Repeat caller & event identity

*Repeat caller — 3 missed calls today, 7 in last 30 days* → View caller history.

**Caller history** compact list — each row links to its own missed-call event.

Each missed call is its **own immutable event** — same caller ≠ merged record.

---

## 39–42. Object & error states

| State | Treatment |
|-------|-----------|
| ID not found | *This missed call no longer exists* → Return to Missed Calls |
| Unauthorized | *You don't have permission…* → Return to Missed Calls |
| Loading | Skeleton layout — no "Unknown caller" flash |
| Error | *Missed call couldn't be loaded* + Retry; localize section failures |
| Partial | Core event visible; e.g. *Text delivery status temporarily unavailable* |

---

## 43–47. Permissions, privacy, compliance, security

- View-only users see event/timeline/conversation/voicemail where permitted; setup actions respect role; server enforces
- Minimum operational data; link to canonical objects for more
- Consent evidence not editable; corrections append audit trail
- Factual states only — not "Legally compliant" / "TCPA approved"
- No secrets in diagnostics

---

## 48–49. Date/time

Audit-grade timestamps: `Sep 8, 2026 · 10:43:12 AM EDT` for timeline/consent. Canonical formatter roles (compact, full, audit). Workspace/event timezone; consent timestamps not relative-only.

---

## 50–53. Responsive layout

**Desktop:** Header + actions → lifecycle summary → main column (Call, Consent, Text-back, Conversation, Timeline) + optional secondary (Voicemail, Form, History, Diagnostics).

**Tablet:** Collapse secondary rail; actions wrap; no horizontal scroll.

**Mobile order:** Caller → time → state → primary action → lifecycle → sections → timeline → history → diagnostics. Obvious primary action; no tiny icon-only unfamiliar actions.

---

## 54–57. Accessibility & navigation

One H1; semantic back; buttons/links correct; status not color-only; timeline readable; expandable diagnostics expose state; 200% zoom; 320px reflow.

**Keyboard:** Return to list → understand state → Open conversation → consent link → voicemail → timeline → diagnostics.

**Return context:** ← Missed Calls restores filtered list context from which user came. Deep link: back still goes to canonical list.

---

## 58–62. Cross-object relationships

| Object | Relationship |
|--------|--------------|
| Contact | Link if exists |
| Conversation | Summary + link — thread owns messages |
| Consent Log | Summary + link — audit owns evidence |
| Voicemail | Reference + link — reuse shared player |
| Analytics | No KPIs — at most repeat-caller context |

---

## 63–67. Visual & content discipline

Emphasis: caller identity → primary state → primary action → critical failure → timeline.

Cards only for meaningful groups (lifecycle summary, critical alert). Use `<dl>` for static metadata — not disabled form fields. Historical message bodies exact. i18n: Unicode names, original message language, locale timestamps, RTL timeline.

---

## 68–69. Runtime contract

Reuse authoritative fields: `event_id`, `caller`, `business_line`, `trigger`, `missed_at`, `consent_mode`, `consent_status`, `consent_captured_at`, `compliance_message_status`, `recovery_message_status`, `suppression_reason`, `reply_status`, `conversation_id`, `voicemail_id`, `link_events`, `form_submission_id`, `timeline_events`, `repeat_caller_stats`.

Use backend event sequence — do not infer timeline from `consentCapturedAt && smsSentAt`.

---

## 70. Test scenarios

| ID | Scenario |
|----|----------|
| A | Full Press-1 success through reply |
| B | Caller did not press 1 — no fake failure |
| C | Existing Consent — no Press-1 UI |
| D | Opted out — suppression, no override |
| E | Delivery failure — accurate reason + fix path |
| F | Voicemail relationship |
| G | Link/form tracked events only |
| H | Repeat caller — separate events |
| I | Partial provider degradation |
| J | Mobile readable |
| K | Keyboard-only full task |
| L | Unauthorized — no leakage |

---

## 71. Definition of done — Missed Call Detail

Cursor may mark `/mctb/missed-calls/[id]` complete only when:

- [ ] Canonical Transovo shell + Appointment detail visual language
- [ ] Caller/event identity clear; structural return to Missed Calls
- [ ] Primary state near identity; one dominant real action
- [ ] Lifecycle summary reflects runtime; Press-1 distinguishes compliance vs recovery message
- [ ] Existing Consent shows no fake Press-1
- [ ] Call details canonical terminology; consent summarized + linked
- [ ] Message states authoritative; Suppressed ≠ Failed; historical text accurate
- [ ] Conversation summary links canonical thread
- [ ] Voicemail/form/link relationships work
- [ ] Timeline from authoritative events; technical IDs hidden
- [ ] Diagnostics truthful, no secrets; failure reasons not fabricated
- [ ] Repeat events separate; missing/unauthorized handling complete
- [ ] Loading/error/partial/permission states complete
- [ ] Privacy/evidence integrity; no opt-out override
- [ ] Date/time audit formatter + timezone
- [ ] Desktop/tablet/mobile + 320px + 200% + keyboard + SR QA
- [ ] Return restores list context; cross-links canonical
- [ ] No duplicate Conversation/Consent/Voicemail implementation
- [ ] Existing useful runtime/detail functionality preserved

---

## Build handoff

Next screen in sequence: **04 — Conversations** (`/mctb/conversations`) — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-04-CONVERSATIONS.md`.

**05 — Voicemail** — pending build spec.
