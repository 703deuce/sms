# Appointment Reminders — AI Rescheduler trace audit

**Purpose:** Trace the existing Appointments AI Scheduling stack against the imported-calendar path before building the AI Rescheduler settings page and wiring reminder SMS **C / R / X** flows.

**Architecture decision (locked):** Reuse `src/lib/appointments/ai-scheduling/` (understand → resolver → verify → execute). Do **not** use MCTB Intent Router, Lead Recovery, or the MCTB booking orchestrator. SMS inbound already delegates to `handleUnifiedAiBooking` → `handleAppointmentAIRequest` via `ai-booking-orchestrator.ts` (thin wrapper, not MCTB).

**Related:** `docs/AR-SMS-RESCHEDULE-AI-AGENT-REFERENCE.md` (broader map).

---

## Executive summary

| Question | Answer |
|----------|--------|
| Imported Google/Microsoft events have durable provider IDs? | **Yes** — `externalId` = `google:{connectionId}:{eventId}` or `microsoft:…`; metadata also stores `providerEventId`, `connectionId`, `source: calendar_import`. |
| RESCHEDULE updates provider events today? | **Only for Transovo-booked** appointments (`externalId` without `google:`/`microsoft:` prefix). **Imported events skip native PATCH** due to `shouldSyncToNativeCalendar`. |
| Availability for AI reschedule excludes self + uses event duration? | **Partially.** Execution path excludes self when snapping/locking slots; **AI slot query does not** pass `excludeAppointmentId` and duration comes from `voiceService.durationMinutes`, not original event length. |
| Multi-turn SMS conversation state? | **Yes** — `appointmentAi` on contact `customFields`; persisted from `channel-adapters.ts`. **Not** reminder-message-bound today. |
| Inbound SMS tied to the appointment that sent the reminder? | **No** for C/X — next upcoming by `contactId`. **R** not first-class; single-letter `R` may enter AI only if contact has any upcoming appointment. |
| Provider reschedule recalculates reminders? | **Yes** on Transovo row — `resetAppointmentReminders()` in `reschedulePlatformAppointment`. Import pull sync also resets when external times change. |

**Headline gap:** Implement (or relax) the external-calendar write boundary so `syncExternalCalendarOnReschedule` PATCHes imported events using `resolveProviderEventId`, with connection write calendar + permission checks surfaced on the AI Rescheduler page.

---

## 1. Provider IDs and writable connections (imported calendar)

### Canonical imported identity

```1:7:src/lib/calendar/external-id.ts
/** Canonical external id for calendar-imported appointments (not Transovo-booked). */
export function formatImportedExternalId(
  provider: "google" | "microsoft",
  connectionId: string,
  providerEventId: string,
) {
  return `${provider}:${connectionId}:${providerEventId}`;
}
```

Import sync sets `voiceAppointment.externalId` to that form and metadata via `buildImportMetadata`:

```347:352:src/lib/calendar/import-sync.ts
  return {
    source: "calendar_import",
    provider,
    connectionId,
    calendarId,
    providerEventId: event.id,
```

`resolveProviderEventId` extracts the raw Google/Microsoft event id for API calls when the prefix matches the connection provider:

```24:36:src/lib/calendar/external-id.ts
export function resolveProviderEventId(
  externalId: string | null,
  provider: string,
): string | null {
  if (!externalId) return null;
  if (externalId.startsWith("calendly:")) return null;
  const parsed = parseImportedExternalId(externalId);
  if (parsed?.provider === provider) return parsed.eventId;
  if (!externalId.startsWith("google:") && !externalId.startsWith("microsoft:")) {
    return externalId;
  }
  return null;
}
```

### Write gating (today)

Native sync on reschedule/cancel is **explicitly disabled** for imported ids:

```39:50:src/lib/calendar/external-id.ts
export function isTransovoBookedExternalId(externalId: string | null): boolean {
  if (!externalId) return false;
  return (
    !externalId.startsWith("calendly:") &&
    !externalId.startsWith("google:") &&
    !externalId.startsWith("microsoft:")
  );
}

export function shouldSyncToNativeCalendar(externalId: string | null): boolean {
  return isTransovoBookedExternalId(externalId);
}
```

`syncExternalCalendarOnReschedule` returns immediately when that guard fails — so the PATCH/Graph update path never runs for imports:

```135:146:src/lib/calendar/external-sync.ts
export async function syncExternalCalendarOnReschedule(
  workspaceId: string,
  appointment: AppointmentRow,
  next: { startsAt: Date; endsAt: Date; summary?: string },
): Promise<void> {
  if (!shouldSyncToNativeCalendar(appointment.externalId)) return;

  const conn = await resolveConnectionForAppointment(workspaceId, appointment);
  // ...
  const providerEventId = resolveProviderEventId(appointment.externalId, conn.provider);
```

When sync **does** run (Transovo-booked), it calls `updateGoogleEvent` / `updateMicrosoftEvent` with token from `getValidAccessToken` and write calendar from config.

### Connection verification (UI signal)

`verifyWorkspaceCalendarConnection` performs live token + calendar list (+ Microsoft push when sync enabled). It does **not** today assert “this connection can PATCH events on the import calendar” separately from `shouldSyncToNativeCalendar`. The AI Rescheduler page should combine:

- verification result (token, calendars, health), and  
- per-appointment `externalId` / metadata `connectionId` + write calendar id from connection config.

**Gap to implement:** Treat calendar-imported appointments as **writable** when business enables AI reschedule and OAuth scopes + write calendar allow updates — e.g. new helper `shouldSyncImportedEventToProvider(externalId, metadata)` used by reschedule/cancel sync, not only `isTransovoBookedExternalId`.

---

## 2. RESCHEDULE execution path (Transovo vs provider)

### Stack entry (SMS)

```25:54:src/lib/appointments/ai-booking-orchestrator.ts
export async function handleUnifiedAiBooking(
  input: UnifiedBookingInput,
): Promise<AppointmentAiResult> {
  // ...
  return handleAppointmentAIRequest({
    workspaceId: input.workspaceId,
    channel,
    message,
    customerId: input.contactId || undefined,
    // ...
  });
}
```

### Resolver → verifier → executor

- `resolver.ts` — `RESCHEDULE` offers slots via `queryAvailabilityForIntent` until explicit mutation + slot selection; then `proposedWrite` with `requiresVerifier: true`.
- `verify-action.ts` — enforces confirmation rules before write.
- `execute.ts` — `applyVerifiedWrite` → `reschedulePlatformAppointment`.

```124:129:src/lib/appointments/ai-scheduling/execute.ts
    case "RESCHEDULE": {
      const appt = await reschedulePlatformAppointment(
        ctx.workspaceId,
        action.appointmentId,
        action.startsAt,
      );
```

### Transovo row + reminders

`reschedulePlatformAppointment` updates `voiceAppointment`, uses `excludeAppointmentId` for slot snap/assert, sets status `awaiting_confirmation`, then:

```1015:1077:src/lib/appointments/booking-platform.ts
  const baseMeta = resetAppointmentReminders({
    ...(row.metadata || {}) as AppointmentMetadata,
    lastChangeInitiatedBy: initiatedBy,
  });
  // ... prisma update ...
  try {
    const { syncExternalCalendarOnReschedule } = await import("@/lib/calendar/external-sync");
    await syncExternalCalendarOnReschedule(workspaceId, row, {
      startsAt: start,
      endsAt: end,
      summary: row.serviceName || undefined,
    });
```

**Conclusion:** RESCHEDULE **always** moves the Transovo appointment and **resets reminder generation**; provider calendar moves **only** when `shouldSyncToNativeCalendar` is true (not imports today).

---

## 3. Availability resolver (duration, exclude-self, live calendar)

### AI slot offering (`queryAvailabilityForIntent`)

```87:101:src/lib/appointments/ai-scheduling/availability-bridge.ts
export async function queryAvailabilityForIntent(
  workspaceId: string,
  intent: SchedulingIntent,
  serviceName: string,
): Promise<AvailabilityQueryResult> {
  // ...
  const { slots: rawSlots } = await generateNativeSlots(workspaceId, {
    serviceName,
    daysAhead,
    timezone,
    maxSlots: 100,
  });
```

No `excludeAppointmentId` parameter — the appointment being moved can still block its **old** time in offered slots unless the native engine implicitly treats the row differently.

### Execution-time slot check (exclude-self)

Same reschedule uses `excludeAppointmentId: appointmentId` in `snapProposedStartToCanonicalSlot` and `assertSlotAvailableForBooking` (see `booking-platform.ts` ~988–1004).

### Duration on reschedule

End time is `start + voiceService.durationMinutes` (default 30), not necessarily imported event length:

```1008:1013:src/lib/appointments/booking-platform.ts
  const service = await prisma.voiceService.findFirst({
    where: { workspaceId, name: row.serviceName },
  });
  const durationMinutes = service?.durationMinutes || 30;
  const start = new Date(canonicalStartsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
```

**Gaps for AI Rescheduler settings:**

- Pass `excludeAppointmentId` (and optional fixed duration override) into availability bridge for RESCHEDULE.
- Honor “original appointment duration” from `(endsAt - startsAt)` or metadata when service mapping is weak (common for imports).

---

## 4. Conversation state (multi-message SMS)

State lives on **contact** `customFields.appointmentAi`:

```7:17:src/lib/appointments/ai-scheduling/conversation-state.ts
export type AppointmentConversationState = {
  activeIntent?: string;
  appointmentId?: string;
  appointmentTypeId?: string;
  // ...
  lastOfferedSlots?: Array<{ startsAt: string; endsAt: string }>;
  updatedAt: string;
};
```

`applyStateHintsToUnderstanding` pins `appointmentId` when the model did not resolve one:

```84:88:src/lib/appointments/ai-scheduling/conversation-state.ts
  if (!next.appointmentReference.appointmentId && state.appointmentId) {
    next.appointmentReference = {
      ...next.appointmentReference,
      appointmentId: state.appointmentId,
    };
```

After each handled inbound SMS, `channel-adapters.ts` merges `result.data.conversationState` back to the contact.

**Durability:** Survives multiple inbound messages **per contact**, not per reminder send. **Risk:** Two upcoming appointments on one contact can still disambiguate via resolver (“Which appointment?”) unless state is seeded on **R**.

**Required product behavior:** On **R**, set `appointmentId` from the **reminder’s** `voiceAppointment.id` (and `activeIntent: RESCHEDULE`) before calling `handleAppointmentAIRequest` — appointment-bound session, not phone-only disambiguation.

---

## 5. Reminder SMS ↔ inbound reply association

### Deterministic C / X

```367:378:src/lib/messaging/inbound-process.ts
  if (upper === "C" || upper === "X") {
    const apptContact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
    });
    if (apptContact) {
      const { findUpcomingAppointmentForContact, confirmAppointment } = await import(
        "@/lib/voice/calendar/booking"
      );
      const appt = await findUpcomingAppointmentForContact(input.workspaceId, apptContact.id);
```

`findUpcomingAppointmentForContact` — earliest future non-terminal appointment for **contact**, not the message that triggered the reminder:

```1155:1167:src/lib/voice/calendar/booking.ts
export async function findUpcomingAppointmentForContact(
  workspaceId: string,
  contactId: string,
) {
  return getPrisma().voiceAppointment.findFirst({
    where: {
      workspaceId,
      contactId,
      startsAt: { gte: new Date() },
      status: { notIn: ["cancelled", "canceled", "completed"] },
    },
    orderBy: { startsAt: "asc" },
  });
}
```

**Confirm** updates DB status only (`confirmAppointment`); no external sync in that helper.

**Cancel (X)** calls `cancelPlatformAppointment` — external cancel sync uses the same `shouldSyncToNativeCalendar` gate as reschedule (imports skipped unless policy extended).

### R and general AI path

- No dedicated **R** handler in `inbound-process.ts`.
- `looksAppointmentRelated` returns false for `length <= 2`, but `tryHandleInboundAppointmentAi` still runs when the contact has **any** upcoming appointment:

```27:37:src/lib/appointments/ai-scheduling/channel-adapters.ts
  if (!looksAppointmentRelated(input.message)) {
    const prisma = getPrisma();
    const upcoming = await prisma.voiceAppointment.count({
      where: {
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        startsAt: { gte: new Date() },
        status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
      },
    });
    if (!upcoming) return { handled: false };
  }
```

So **R** may start AI without pinning the reminded appointment. Also gated by `platform.bookingEnabled === false` → no AI (AR may need a separate **rescheduler enabled** flag).

### Reminder outbound context

Delivery uses per-appointment ids in the reminder engine metadata/timeline; inbound processing does **not** currently read `providerMessageId` / last outbound reminder row to bind C/R/X. **Gap:** persist `lastReminderAppointmentId` on contact or conversation when a reminder SMS is sent, or resolve from the most recent outbound reminder message for that thread.

---

## 6. Reminder schedule after successful reschedule

```32:40:src/lib/appointments/reminder-state.ts
/** Reschedule or rebuild — bump generation so stale scanner windows cannot fire. */
export function resetAppointmentReminders(meta: AppointmentMetadata): AppointmentMetadata {
  const nextGen = currentReminderGeneration(meta) + 1;
  return {
    ...meta,
    reminderGeneration: nextGen,
    remindersSuppressed: false,
    reminderStatus: "scheduled",
  };
}
```

Called from `reschedulePlatformAppointment` before save. Import sync also calls `resetAppointmentReminders` when provider event times change (`import-sync.ts`).

**Conclusion:** Transovo-side reminder recalculation is **wired** for reschedule. If provider PATCH fails silently (import skip), customer calendar and Transovo can **diverge** while reminders follow Transovo — another reason to fix provider sync for imports.

---

## Recommended inbound flow (target)

| Reply | Behavior |
|-------|----------|
| **C** | Deterministic confirm — bind to **reminder appointment id**, not only “next upcoming”. |
| **R** | Seed `appointmentAi.appointmentId` + start RESCHEDULE session → existing AI stack; **R is not authorization to move** — verifier + executor after slot pick. |
| **X** | Policy-controlled cancel; do not delete Google/Microsoft event unless business enables auto-cancel on provider. |

---

## AI Rescheduler page (settings scope — not built yet)

Five setting groups (product spec):

1. Rescheduling mode — notify business (default) vs AI auto-reschedule after customer confirmation  
2. Availability — working days/hours + live connected-calendar conflicts  
3. Duration — original event duration (default) vs fixed override  
4. Rules — min notice, max days ahead, buffer  
5. Approval — automatic after customer confirmation vs business approval required  

**Readiness UI:** Show whether connected calendar supports event updates (verification + write calendar + imported `connectionId`); read-only import must not show “ready for automatic reschedule.”

---

## Implementation order (gaps only)

1. **Provider PATCH for imports** — extend `external-sync` / `external-id` guards; use `metadata.connectionId` + `resolveProviderEventId`; handle errors visibly (not only `console.warn`).  
2. **Reminder-bound session** — on outbound reminder and on inbound C/R/X, resolve `appointmentId` from reminder context.  
3. **Dedicated R handler** — seed conversation state; optional copy in reminder templates.  
4. **Cancel policy** — separate Transovo cancel from `syncExternalCalendarOnCancel` per AR settings.  
5. **Availability bridge** — `excludeAppointmentId` + duration override for RESCHEDULE.  
6. **AR feature flags** — decouple from `bookingEnabled` where reminders should reschedule without public booking.  
7. **AI Rescheduler Opus page** — settings + calendar writability indicator.

---

## 7. Voice AI agent (Microsoft 365) vs Appointment Reminders SMS

When you reschedule on a **live Microsoft Voice V3** call today, the system does **not** use `src/lib/appointments/ai-scheduling/execute.ts` or `syncExternalCalendarOnReschedule`. It uses the **Voice V3 appointment-management pipeline**, which PATCHes Graph with the **raw `providerEventId`** after slot revalidation.

Appointment Reminders SMS (and the shared `reschedulePlatformAppointment` path) uses **`external-sync.ts`**, which **refuses** to PATCH when `externalId` is `microsoft:…` / `google:…`. That is why voice “works” on Microsoft while reminder SMS reschedule can move only the Transovo row.

### Two voice stacks (do not conflate)

| Path | Entry | Microsoft reschedule commit |
|------|--------|-----------------------------|
| **Voice V3 (PSTN Microsoft booking)** | Tools → `dispatchAppointmentManagementIfRequired` | `executeMicrosoftUpdateBooking` → `updateMicrosoftEvent(providerEventId, …)` |
| **Agent tool gateway** (receptionist / `reschedule_appointment` tool) | `runRescheduleAppointment` | Updates DB; enqueues `voice_appointment_provider_reschedule` → `getSchedulingProvider()` → **`InternalSchedulingProvider.rescheduleAppointment` is a no-op** (unless Calendly is the workspace provider) |

If your production smoke is **Microsoft Graph reschedule on call**, you are almost certainly on **Voice V3**, not the gateway outbox path.

### Voice V3 — book / reschedule / cancel (Microsoft)

**Lookup (reschedule/cancel prerequisite)**

- `findExistingAppointment` merges durable store candidates with **Microsoft calendarView** (`fetchMicrosoftAppointmentDiscoveryCandidates`) when `config.calendar.connectionId` is set.
- Verified appointment carries `providerEventId`, `providerCalendarId`, `startUtc`, `endUtc` — used for all mutations.

**Reschedule**

1. Goal `RESCHEDULE_APPOINTMENT` → `dispatchFindAvailabilityIfRequired` (FIND) when rules require a new slot.
2. Caller selects slot → `dispatchRescheduleIfRequired`:
   - Revalidates busy intervals via Graph (`fetchMicrosoftBusyIntervals`), with **`filterBusyForReschedule`** so the **existing event interval is excluded** from conflict blocking.
   - `validateMicrosoftAppointmentBeforeMutation` (permissions / event still exists).
   - **`executeMicrosoftUpdateBooking`** — same underlying `updateMicrosoftEvent` as calendar import sync, but **no `shouldSyncToNativeCalendar` gate**.

**Cancel**

- `dispatchCancellationIfRequired` → `executeMicrosoftCancelBooking` (Graph cancel/delete), with confirmation phase `CANCELLATION_CONFIRMATION_REQUIRED` before commit.

**Book**

- `executeMicrosoftCreateBooking` via `calendar-provider-runtime` (separate certified FIND/BOOK path; not AR reminders scope).

Key files:

- `src/lib/voice-v3/calendar/appointment-management-dispatch.ts`
- `src/lib/voice-v3/calendar/reschedule-dispatch.ts`
- `src/lib/voice-v3/calendar/cancel-dispatch.ts`
- `src/lib/voice-v3/calendar/microsoft/microsoft-update-booking.ts`
- `src/lib/voice-v3/calendar/microsoft/microsoft-cancel-booking.ts`
- `src/lib/voice-v3/calendar/microsoft/microsoft-create-booking.ts`

### Agent gateway — what it does on reschedule

```228:256:src/lib/voice/agent-tool-gateway/scheduling-workflows.ts
  const durationMs =
    appt.endsAt && appt.startsAt
      ? appt.endsAt.getTime() - appt.startsAt.getTime()
      : 30 * 60 * 1000;
  const updated = await prisma.voiceAppointment.update({ /* startsAt / endsAt */ });
  if (updated.externalId) {
    await enqueueVoiceOutbox({
      jobType: "voice_appointment_provider_reschedule",
      payload: { externalId: updated.externalId, newStartTime, … },
    });
  }
```

Outbox handler:

```51:59:src/lib/voice/outbox/voice-outbox.ts
    case "voice_appointment_provider_reschedule": {
      const provider = await getSchedulingProvider(String(payload.workspaceId));
      await provider.rescheduleAppointment(
        String(payload.externalId || ""),
        String(payload.newStartTime || ""),
        …
      );
```

`InternalSchedulingProvider.rescheduleAppointment()` is intentionally empty — **no Microsoft PATCH** on this path.

### Appointment Reminders / ai-scheduling (SMS)

- Conversation: `handleAppointmentAIRequest` → `applyVerifiedWrite` → **`reschedulePlatformAppointment`**.
- Provider write: **`syncExternalCalendarOnReschedule`**, gated by **`shouldSyncToNativeCalendar`** (imports skipped).

### What AR should reuse (Microsoft-first recommendation)

Do **not** port the whole Voice V3 runtime (goals, offer sets, live session). **Do** reuse the **same Graph mutation primitives and safety pattern**:

| Voice V3 behavior | AR / ai-scheduling equivalent |
|-------------------|-------------------------------|
| `executeMicrosoftUpdateBooking` | Call from reschedule executor after verify, using `metadata.providerEventId` + `metadata.connectionId` (or `parseImportedExternalId(externalId)`) |
| `validateMicrosoftAppointmentBeforeMutation` | Run before PATCH on SMS reschedule (writable calendar, event exists) |
| `filterBusyForReschedule` + slot revalidation | Extend `queryAvailabilityForIntent` / reschedule slot path with `excludeAppointmentId` + event duration |
| Confirmation before commit | Already in `verify-action.ts` + explicit mutation flag; mirror voice “confirmed” semantics for **R** flow |
| Cancel policy | Mirror `CANCELLATION_CONFIRMATION_REQUIRED` — do not call `syncExternalCalendarOnCancel` unless AR policy allows |

**Shared low-level API:** `@/lib/voice/calendar/providers` → `updateMicrosoftEvent`, `cancelOrDeleteMicrosoftEvent` (also used by `src/lib/calendar/external-sync.ts` for Transovo-booked ids).

### Why `shouldSyncToNativeCalendar` existed

Historical intent: avoid PATCHing **calendar-imported** events when Transovo was only a mirror, and avoid double-writes right after **new** bookings before Graph propagation. For **Appointment Reminders**, the reminded appointment is already authoritative on the provider; the customer expects the **original Microsoft event** to move. Voice V3 already PATCHes by `providerEventId`; AR should align with that, not with the import-skip guard.

### Implementation sketch (single shared module — future)

Extract or call:

- `executeMicrosoftUpdateBooking` / `executeMicrosoftCancelBooking` from a neutral path (e.g. `src/lib/calendar/provider-mutations.ts`) used by:
  - Voice V3 (already)
  - `syncExternalCalendarOnReschedule` / cancel for `calendar_import` rows
  - Optional: gateway outbox when `externalId` is `microsoft:…`

Until then, the smallest fix for SMS is: in `reschedulePlatformAppointment` after verify, if `metadata.source === "calendar_import"` and provider is Microsoft, invoke the same update helper Voice V3 uses, then keep `resetAppointmentReminders`.

---

## Out of scope for this audit

- MCTB `src/lib/mctb/ai-booking/**` — not on the SMS appointment path above.  
- New booking / service catalog / public booking link — excluded per product direction.  
- Meeting-only AR booking UI — tracked on branch `cursor/ar-meetings-opus-f350` (PR #615).

---

*Generated from repository trace; re-verify after changes to `external-id.ts`, `inbound-process.ts`, or ai-scheduling resolver.*
