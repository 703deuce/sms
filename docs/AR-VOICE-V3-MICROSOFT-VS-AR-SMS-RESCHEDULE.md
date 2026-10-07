# Voice V3 Microsoft reschedule vs Appointment Reminders SMS

Copy-friendly summary: how the AI voice agent reschedules on Microsoft 365 today, how that differs from reminder SMS, and what AR should reuse.

---

## What the voice agent actually does (Microsoft 365)

There are **two different “voice reschedule” implementations** in the repo. Which one you hit on a phone call determines whether Graph gets updated.

### 1. Voice V3 (this is what makes Microsoft reschedule work today)

When the caller says they want to reschedule on a **Microsoft-connected** Voice V3 agent:

1. **Find** — `findExistingAppointment` loads candidates from the durable store and/or **Microsoft calendarView** (`microsoft-find-existing-appointments`).
2. **Verify** — The call pins a `verifiedExisting` record with **`providerEventId`** and **`providerCalendarId`** (not “whatever is next on this phone number” in the DB alone).
3. **Offer slots** — FIND availability, caller picks a slot.
4. **Revalidate** — Busy intervals from Graph, with **`filterBusyForReschedule`** so the **current event does not block itself**.
5. **Commit** — **`executeMicrosoftUpdateBooking`** → **`updateMicrosoftEvent`** on that `providerEventId` (`src/lib/voice-v3/calendar/microsoft/microsoft-update-booking.ts`).

Cancel follows the same pattern via **`executeMicrosoftCancelBooking`**, with an explicit confirmation phase before commit.

This path **never** goes through `shouldSyncToNativeCalendar` or `syncExternalCalendarOnReschedule`.

### 2. Agent tool gateway (`reschedule_appointment` tool)

`runRescheduleAppointment` in `scheduling-workflows.ts` updates the **`voiceAppointment` row**, then enqueues `voice_appointment_provider_reschedule`. The outbox calls `getSchedulingProvider()` → for most workspaces **`InternalSchedulingProvider.rescheduleAppointment()` is a no-op**. So this path often **does not PATCH Microsoft** unless Calendly is the scheduling provider.

If your live test is “call Amy / Voice V3 and reschedule on Microsoft,” you’re almost certainly on **stack #1**, not the gateway outbox.

---

## How that differs from Appointment Reminders SMS today

Reminder inbound AI uses **`ai-scheduling`** → **`reschedulePlatformAppointment`** → **`syncExternalCalendarOnReschedule`**, which **returns immediately** when `externalId` is `microsoft:connectionId:eventId` because of **`shouldSyncToNativeCalendar`** (imports treated as mirror-only).

| | Voice V3 (Microsoft) | AR SMS / ai-scheduling |
|--|----------------------|-------------------------|
| Graph PATCH | Yes, by `providerEventId` | **No** for imported `microsoft:` ids |
| Transovo row | Updated via durable store / side effects | **Yes** |
| Slot revalidation | Graph busy + exclude self | Partial (execute excludes self; AI slot query does not) |
| Appointment binding | `verifiedExisting` on the call | Contact-scoped; reminder id not pinned on **R** |

The historical reason `shouldSyncToNativeCalendar` was conservative: avoid PATCHing calendar-imported events when Transovo was only a mirror, and avoid double-writes right after **new** bookings before Graph propagation. For **reminders**, the event is already on the calendar; the right behavior matches **Voice V3**: PATCH the **original** event using ids already stored on import (`metadata.providerEventId`, `connectionId`, or `parseImportedExternalId`).

---

## What to reuse for AR (not rebuild MCTB, not full Voice V3 runtime)

Keep **`ai-scheduling`** for SMS conversation (understand → resolver → verify → execute). For **Microsoft writes**, align with Voice V3’s **mutation layer**:

- `validateMicrosoftAppointmentBeforeMutation`
- `executeMicrosoftUpdateBooking` / `executeMicrosoftCancelBooking`
- Same `updateMicrosoftEvent` / cancel helpers in `@/lib/voice/calendar/providers`

Optionally fold that into `syncExternalCalendarOnReschedule` for `calendar_import` rows, or call it directly from `reschedulePlatformAppointment` after `verify-action` — same net effect as voice.

Do **not** need: Voice V3 goals, offer sets, or live session state machine on SMS.

---

## Key file paths

**Voice V3 (Microsoft book / reschedule / cancel)**

- `src/lib/voice-v3/calendar/appointment-management-dispatch.ts`
- `src/lib/voice-v3/calendar/reschedule-dispatch.ts`
- `src/lib/voice-v3/calendar/cancel-dispatch.ts`
- `src/lib/voice-v3/calendar/find-existing-appointment.ts`
- `src/lib/voice-v3/calendar/microsoft/microsoft-update-booking.ts`
- `src/lib/voice-v3/calendar/microsoft/microsoft-cancel-booking.ts`
- `src/lib/voice-v3/calendar/microsoft/microsoft-create-booking.ts`

**Agent gateway (often no Graph PATCH on internal provider)**

- `src/lib/voice/agent-tool-gateway/scheduling-workflows.ts` — `runRescheduleAppointment`, `runCancelAppointment`
- `src/lib/voice/outbox/voice-outbox.ts` — `voice_appointment_provider_reschedule`
- `src/lib/voice/providers/internal-scheduling-provider.ts` — no-op reschedule/cancel

**Appointment Reminders SMS**

- `src/lib/appointments/ai-booking-orchestrator.ts` → `handleAppointmentAIRequest`
- `src/lib/appointments/ai-scheduling/execute.ts` — `reschedulePlatformAppointment`
- `src/lib/appointments/booking-platform.ts` — `reschedulePlatformAppointment`
- `src/lib/calendar/external-sync.ts` — `syncExternalCalendarOnReschedule`
- `src/lib/calendar/external-id.ts` — `shouldSyncToNativeCalendar`

**Shared Graph primitives**

- `@/lib/voice/calendar/providers` — `updateMicrosoftEvent`, `cancelOrDeleteMicrosoftEvent`

---

## Suggested next code step

Wire SMS RESCHEDULE (after verifier) to the **same Microsoft update path as Voice V3** for imported appointments, then add reminder-bound **R** and policy-gated **X**.

**Related docs**

- `docs/AR-AI-RESCHEDULER-TRACE-AUDIT.md` — full six-question audit + §7 overlap
- `docs/AR-SMS-RESCHEDULE-AI-AGENT-REFERENCE.md` — broader stack map
