# Voice V3 — legacy reuse standard (mandatory)

**Applies to:** all new Voice V3 tools, executors, and side effects under `src/lib/voice-v3/**`.

## Rule

Do **not** reuse a helper because its name sounds generic (`sendQuickSms`, `sendAppointmentSms`, `publishX`, shared “utils”).

Before wiring a V3 tool to any existing function, **trace the full call graph** and classify every downstream effect:

| Class | Examples | Allowed in V3 tool hot path? |
|-------|----------|------------------------------|
| **Pure infrastructure** | Telnyx `sendMessage`, authz on phone id, E.164 normalize | Yes, via a **dedicated V3 wrapper** with a narrow API |
| **Product / legacy application** | CRM enqueue, review/tracking URLs, campaign rows, appointment HP sender, inbox templates, mass-texting | **No** — unless explicitly required and documented for that tool |

If the trace is not **only** infrastructure (plus explicit compliance gates: STOP, credits, workspace existence), **build a dedicated V3 path** under `src/lib/voice-v3/…`.

## SEND_LINK precedent

**Wrong (proven on PSTN 2026-09-19):**

```
send_booking_link → sendAppointmentSms / sendQuickSms
  → From forced to HP +15714073615
  → /r/… tracking append
  → CRM BullMQ jobs
```

**Required:**

```
send_booking_link → sendVoiceV3BookingLinkSms → sendViaRegistration (authorized wizard number only)
```

Guard: `scripts/test-voice-v3-booking-link-sms-isolation.ts`

## Review checklist (every new V3 tool with outbound side effects)

1. List every import from outside `src/lib/voice-v3/**`.
2. For each import, document: DB tables touched, queues enqueued, URL/body mutations, sender resolution.
3. Add or extend an isolation script that fails on forbidden imports in the tool’s module tree.
4. PSTN freeze gate document for the strategy (see SEND_LINK freeze doc).

## Governing sentence

**V3 owns product behavior; shared libs are evidence, not authority.** Names are not contracts — graphs are.
