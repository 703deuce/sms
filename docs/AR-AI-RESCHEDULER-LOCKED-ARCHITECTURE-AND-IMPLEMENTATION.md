# Appointment Reminders — AI Rescheduler (locked architecture & implementation)

**Status:** Architecture locked. Do not merge or deploy without approval.

**Prerequisite audits:**

- `docs/AR-AI-RESCHEDULER-TRACE-AUDIT.md`
- `docs/AR-VOICE-V3-MICROSOFT-VS-AR-SMS-RESCHEDULE.md`

**Governing insight:** Transovo already has a **working Microsoft 365 rescheduling implementation in Voice V3** that updates the actual calendar event. Reuse that proven path for Appointment Reminders rather than build another Microsoft rescheduling implementation.

This specification brings product requirements, existing architecture, and engineering safeguards together **without** turning Appointment Reminders into another scheduling platform.

### Three locked product decisions

1. **Reuse Voice V3’s proven Microsoft calendar operations** while keeping the existing **Appointments AI** conversation pipeline for SMS.
2. **Notify-only is the default**; automatic AI rescheduling is enabled **explicitly** by the business.
3. **Never require a booking page or meeting type.** The original Google or Microsoft event supplies appointment identity and duration.

### Simple business journey (target)

Connect Google or Microsoft → turn on reminders → optionally enable **AI Rescheduler** → choose available days and hours.

**Product distinction:** Other reminder systems may tell you an appointment needs changing. Transovo AI can handle the conversation and change the **original calendar appointment** for you.

**Scope guard:** Do not add more pages, appointment types, calendar setup wizards, or additional AI agents beyond what is specified here.

---

## What the two audits establish

| Component | What Transovo already has | What AR needs |
|-----------|---------------------------|---------------|
| SMS conversation | Appointments AI scheduling stack | Reuse |
| Identify appointment | Imported event IDs | Bind to the correct reminder |
| Microsoft availability | Voice V3 live Graph checks | Reuse the underlying operations |
| Exclude original event | Voice V3 `filterBusyForReschedule` | Reuse |
| Microsoft event update | Voice V3 `executeMicrosoftUpdateBooking` | Reuse |
| Google event update | Shared Google calendar helpers | Verify equivalent safe path |
| Reminder recalculation | `resetAppointmentReminders()` | Reuse after successful update |
| Rescheduler settings | Not built | One new page |

**Important architectural distinction:** Voice V3’s Microsoft mutation path works **directly with the original Microsoft event ID**. It does **not** depend on Transovo’s imported appointment being treated as a native booking. That is exactly what AR needs.

---

## Locked architecture

```
Appointment reminder → Customer replies R
        ↓
Existing Appointments AI Scheduling
  (interpret request, offer times, obtain confirmation)
        ↓
Deterministic calendar mutation
  (Voice V3 Microsoft validation + update operations)
        ↓
Original Microsoft event updated
        ↓
Reconcile Transovo record and reset reminders
```

- **AI** = conversation (understand, clarify, offer, confirm intent).
- **Deterministic layer** = actual availability and calendar changes.

The model must **never** decide that a slot is available without provider verification.

---

## What we will NOT do

- Copy the entire Voice V3 scheduling workflow into AR (call-specific state, verified appointment records, offer sets, live conversation machinery).
- Modify the working Voice V3 Microsoft **call** flow to accommodate SMS.
- Use MCTB Intent Router, Lead Recovery, or MCTB booking orchestrator.
- Build another booking page, meeting setup wizard, or scheduling platform.
- Force customers through optional Booking / Meetings flows for rescheduling.

**Instead:** Reuse or extract the **smallest proven Microsoft operations:**

- `validateMicrosoftAppointmentBeforeMutation`
- `filterBusyForReschedule`
- `executeMicrosoftUpdateBooking`
- `executeMicrosoftCancelBooking` — only where explicitly authorized by business policy

**Google:** Same principle, but audits do **not** establish an equivalent tested Google rescheduling workflow. Trace and verify separately; do not assume Microsoft’s implementation applies unchanged.

---

## Implementation instructions (for engineering)

### Appointment Reminders AI Rescheduler — reuse proven Voice V3 calendar operations

Architecture decision is **locked**.

Use the existing **Appointments AI Scheduling** stack for SMS conversation and the proven **Voice V3 Microsoft calendar mutation operations** for imported Microsoft appointments.

### 1. Preserve the working systems

- Keep `src/lib/appointments/ai-scheduling/` as the SMS understanding → resolver → verify → execute pipeline.
- Do not use the MCTB Intent Router, Lead Recovery, or MCTB booking orchestrator.
- Do not rebuild the Voice V3 state machine.
- Do not alter the working Voice V3 Microsoft call flow.
- Do not build another booking page, meeting setup wizard, or scheduling platform.
- Preserve the approved New UI / Opus styling.

### 2. Reuse Microsoft calendar mutation behavior

Trace and reuse existing Voice V3 operations in:

- `src/lib/voice-v3/calendar/microsoft/microsoft-update-booking.ts`
- `src/lib/voice-v3/calendar/reschedule-dispatch.ts`
- `src/lib/voice-v3/calendar/find-existing-appointment.ts`

For **imported Microsoft events**, use stored **connection ID**, **provider event ID**, and **provider calendar ID** to identify and update the **original** Microsoft event.

Reuse existing validation, Graph busy checks, exclusion of the original event, and Microsoft event-update primitives.

**Do not** route imported Microsoft appointments through the internal scheduling provider’s no-op reschedule operation (`InternalSchedulingProvider.rescheduleAppointment`).

### 3. Fix calendar-write consistency (provider-first + recovery)

Current AR reschedule flow updates the Transovo appointment and **skips PATCH** for imported events (`shouldSyncToNativeCalendar`).

For eligible imported events, replace with **provider-first update** and **durable reconciliation**.

- Do **not** claim a successful reschedule unless the original provider event and Transovo appointment agree.
- **Order:** Mutate provider when policy allows, then persist local state and reset reminders—or enter reconciliation if local write fails after provider success.

**Recovery protection (required):**

| Failure | Requirement |
|---------|-------------|
| Provider succeeds, DB update fails | Durable operation record (idempotency key per attempt); reconciliation job or manual-safe retry that **does not** double-PATCH or send duplicate customer confirmations |
| Retry after ambiguous outcome | Treat `BOOKING_OUTCOME_UNKNOWN`-class results like Voice V3; reconcile by reading provider event state before re-attempting |
| Concurrent booking / race | Free/busy revalidation alone is **not** sufficient. Before mutation, check original event for changes (etag / `changeKey` / `updated` where provider supports **conditional updates**); fail or hand off if event changed since offer |
| Customer-facing success | Only after provider + local reconciliation both succeed (or explicit notify-only handoff with no calendar claim) |

Reuse patterns from Voice V3 authoritative operations (`runAuthoritativeOperation`, operation receipts) where applicable; extend for SMS/idempotency keys distinct from `callId`.

### 4. Complete reminder-bound SMS handling

| Reply | Behavior |
|-------|----------|
| **C** | Confirm the **correct** appointment deterministically (reminder-bound). |
| **R** | Start **appointment-bound** rescheduling session using Appointments AI stack. |
| **X** | Follow business **cancellation policy** (not automatic provider delete unless enabled). |

Rules:

- Do not select an appointment solely because it is the contact’s next upcoming appointment.
- Do not let a reply to an old reminder modify an unrelated appointment.
- Keep STOP/HELP and existing SMS compliance rules intact (see **SMS sender & consent** below).

### 5. Use original appointment details

- Preserve **original imported appointment duration** by default.
- Check **live provider availability** within business allowed days and hours.
- **Exclude** the original appointment from conflict calculations.
- **Revalidate** the selected time before updating the provider event.
- **Reset reminder generation** only after successful calendar mutation and local reconciliation.

### 6. Verify Google separately

Trace the existing Google Calendar event-update path.

Implement equivalent safe imported-event reschedule using existing Google primitives. Do not assume Microsoft’s implementation applies unchanged to Google.

### 7. Build the AI Rescheduler page

One compact page under Appointment Reminders (see **Product / IA** and **Page spec** below).

### 8. Certification

Add automated tests for:

- Microsoft imported-event rescheduling
- Google equivalent behavior (once verified)
- Multiple appointments per contact
- Provider failures and **provider-success / DB-failure** reconciliation
- Concurrent slot selection and **conditional update** / event-changed-since-offer paths
- Calendar write readiness tiers (see below)
- Per-appointment editability failures
- Reminder recalculation
- SMS consent / STOP / HELP on conversational reschedule threads

Report completed code changes separately from live-provider certification.

**Do not merge or deploy without approval.**

### 9. Engineering safeguards (tightened before implementation)

#### A. Calendar readiness ≠ write access

A healthy OAuth connection does **not** prove Transovo can edit every imported event.

The AI Rescheduler readiness indicator must distinguish:

| Level | Meaning | Gates |
|-------|---------|--------|
| 1 | Calendar connected and **readable** | Baseline import/reminders |
| 2 | Required **write permissions** granted (OAuth scopes) | Enabling AI reschedule features |
| 3 | Selected **write calendar** supports updates (not read-only calendar id) | Enabling **automatic** calendar mutation |
| 4 | **Individual appointment editable** at request time | Each customer reschedule attempt |

Levels **1–3** determine whether AI rescheduling can be **enabled** in settings. Level **4** is checked **per appointment** when the customer requests a change (permissions, recurring series, organizer locks, etc.).

Do not use `verifyWorkspaceCalendarConnection` token health alone as “ready to auto-reschedule.”

#### B. Provider-first updates + reconciliation

See **§3** above. Implementation must be explicit in code review—not implied by happy-path tests.

#### C. Rescheduling modes and approval (one UI, clear behavior)

Do **not** add a separate third “rescheduling mode” in the nav. Use:

- **Mode:** Notify me (default) **or** AI reschedules (opt-in).
- **When AI is on:** sub-choice **automatic approval** vs **business approval**.

| Configuration | Behavior |
|---------------|----------|
| **Notify me** | Collect the request; business handles rescheduling manually. No automatic provider mutation. |
| **AI + automatic approval** | AI offers provider-verified slots; customer confirms selection; calendar updates after revalidation. |
| **AI + business approval** | AI offers slots; customer selects preferred time; **business approves** before calendar updates. |

For **business approval**, the chosen time must be **revalidated at approval time** (live availability + event still editable). Do not assume the slot remains available between customer selection and staff approval.

#### D. SMS sender and consent

Automatic conversational rescheduling must operate within the **approved messaging use case** for Appointment Reminders:

- Existing SMS sender registration and workspace compliance rules apply.
- STOP / HELP / opt-out handling unchanged.
- Conversational AI replies are not authorized solely because calendar OAuth succeeded.
- No additional marketing or unrelated SMS flows via the reschedule thread.

---

## Post-implementation review (what matters)

When Cursor returns changes, review in this order—not whether the page merely renders:

1. **Actual Microsoft / Google event-write paths** (imported ids, conditional updates, failure modes).
2. **Reminder-to-appointment binding** (C / R / X and multi-appointment contacts).
3. **Recovery behavior** (provider succeeded, local failed; retries; no duplicate confirmations).

UI completeness is secondary to the above.

---

## Product assessment

Transovo does not merely have an AI agent that understands rescheduling requests. It has an **existing Microsoft calendar rescheduling operation** already used by Voice V3.

Remaining work:

1. Integrate that operation into the reminder SMS workflow.
2. Add safeguards (reminder binding, policy, reconciliation).
3. Give businesses one simple configuration page.

---

## Where it belongs (IA)

Sidebar stays almost as-is:

- Overview
- Appointments
- Reminders
- Calendars
- Reminder Settings
- **AI Rescheduler** ← new; immediately below Reminder Settings
- OPTIONAL BOOKING
  - Booking page
  - Meetings

**AI Rescheduler is not** inside the optional Booking section.

---

## AI Rescheduler page — functional specification

**Route (target):** Under Appointment Reminders product nav, e.g. `/appointment-reminders/ai-rescheduler` (exact route to match `appointment-reminders-nav.ts` when implemented).

**Design:** Existing New UI / Opus design system. Not a new wizard. Not another series of large cards.

### Page title and lead

**AI Rescheduler**

Let customers request appointment changes by replying to their reminder texts. Uses your existing Google or Microsoft calendar.

### How should rescheduling work?

1. **Notify me (default)**  
   Collect the customer’s request so I can reschedule manually.

2. **AI reschedules** (explicit opt-in)  
   Offer available times and confirm with the customer. When enabled, choose:
   - **Automatic approval** — after customer confirms a slot, update the connected calendar (subject to revalidation).
   - **Business approval required** — customer selects a time; staff approves before any calendar update (slot re-checked at approval).

There is **one** rescheduling mode control (notify vs AI), not a third top-level mode.

### Settings exposed on the page

| Setting | Notes |
|---------|--------|
| Rescheduling mode | Notify me (default) vs AI reschedules |
| Approval (when AI on) | Automatic after customer confirmation vs business approval required |
| Allowed days and hours | Working window for offered slots; live calendar conflicts |
| Duration | Original event duration (default); optional fixed override if product allows |
| Rules | Minimum notice, booking horizon (max days ahead), buffer between appointments |

### Connected calendar readiness (four levels)

Surface status clearly on the page (not a single green “connected”):

1. Connected and readable  
2. Write permissions granted  
3. Write calendar supports updates  
4. (Runtime) Per-appointment editable — explained in help copy; failures surface as handoff to business

Read-only connections must **not** allow enabling automatic calendar mutation.

### What the system handles automatically (not on the page)

Business should not configure every technical detail. Transovo derives from original appointment + connection:

- **Event duration** — original event start/end
- **Calendar** — calendar containing the original appointment
- **Timezone** — calendar or appointment timezone
- **Busy times** — live Google/Microsoft availability
- **Event update** — modify existing event, not create a duplicate appointment
- **Reminder updates** — cancel outdated scheduled reminders; recalculate for new time

**Backend safeguards** (not toggles on this page):

- Verify customer authorized to change the appointment
- Confirm event is editable
- Prevent conflicting writes
- Recurring events / permission failures → notify business or hand off

Business only chooses **policy** and **availability rules**.

### How modes behave

| Customer action | Notify me (default) | AI + automatic approval | AI + business approval |
|-----------------|---------------------|-------------------------|-------------------------|
| “I need to change my appointment” | Business receives request | AI asks for preferred time | AI asks for preferred time |
| “Friday afternoon” | Business sees request | AI checks provider slots | AI checks provider slots |
| Chooses 3 PM | Business handles manually | AI confirms; calendar updates after revalidation | Customer selection queued for staff |
| Staff / business step | — | — | Staff approves; **slot revalidated** then calendar updates |
| Calendar event changes | Only when business changes it | After successful provider + local reconcile | After approval + successful provider + local reconcile |
| Reminders update | Following calendar sync | After successful reschedule | After approved reschedule completes |

### Appointment identity (critical)

The AI must use the **exact appointment associated with the reminder conversation**, not assume a phone number uniquely identifies one appointment.

If multiple appointments are possible or the customer cannot be verified → clarification or hand off to business (per mode).

---

## Marketing one-liner

Connect your Google or Microsoft calendar. Transovo reminds your customers and can reschedule appointments directly by text—without another booking system.

Optional Booking Page and Meetings remain **separate and unchanged**.

---

## Related code index (quick reference)

| Area | Path |
|------|------|
| SMS AI pipeline | `src/lib/appointments/ai-scheduling/` |
| SMS entry | `src/lib/appointments/ai-booking-orchestrator.ts` |
| Reschedule execute | `src/lib/appointments/booking-platform.ts` — `reschedulePlatformAppointment` |
| Import skip (to fix) | `src/lib/calendar/external-id.ts` — `shouldSyncToNativeCalendar` |
| External sync | `src/lib/calendar/external-sync.ts` |
| Voice V3 MS update | `src/lib/voice-v3/calendar/microsoft/microsoft-update-booking.ts` |
| Voice V3 MS cancel | `src/lib/voice-v3/calendar/microsoft/microsoft-cancel-booking.ts` |
| Voice V3 reschedule dispatch | `src/lib/voice-v3/calendar/reschedule-dispatch.ts` |
| Inbound C/X/R (to extend) | `src/lib/messaging/inbound-process.ts` |
| Reminder reset | `src/lib/appointments/reminder-state.ts` |
| AR nav (when adding page) | `src/lib/products/appointment-reminders-nav.ts` |

---

## Recommendation (proceed)

Proceed with this specification, including safeguards **§9 A–D** explicitly in implementation and tests.

Do not expand scope into booking platforms, meeting types, or extra agents.

Remaining risk is **implementation quality**, not product scope.

---

*Document consolidates product direction and engineering instructions. Implementation PRs should reference this file and the two prerequisite audits.*
