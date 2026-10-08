# AR SMS two-agent architecture (AI rescheduler mode)

## Pipeline (per inbound SMS, `ar.mode === "ai"`)

1. Persist inbound message on canonical conversation.
2. Build **one** shared turn snapshot (`buildArSmsSharedTurnSnapshot`).
3. **Context Agent** (Luna, JSON only, no tools) → structured interpretation.
4. Persist interpretation on `arSmsReplySession.rescheduleWorkflowState` for audit.
5. **Appointment Agent** (`runArRescheduleLunaTurn`) receives snapshot history, original message, and advisory interpretation.
6. Backend tools and policy gates authorize calendar writes.

## Responsibilities

| Layer | Role |
|--------|------|
| Context Agent | Interpret meaning only — no SMS, no tools, no suggested replies |
| Appointment Agent | All customer-facing SMS and tool use |
| Deterministic backend | Identity, cutoffs, penalties, calendar commits |

## Shortcuts

Literal **C / R / X** still use `handleArReminderLetterReply` for deterministic notify/AI letter semantics. Natural-language equivalents flow through the two-agent path via `tryHandleArReminderFollowUp` → `runArV3RescheduleSmsTurn`.

## Key files

- `src/lib/appointment-reminders/ai-rescheduler/ar-sms-shared-snapshot.ts`
- `src/lib/appointment-reminders/ai-rescheduler/context-agent/*`
- `src/lib/appointment-reminders/ai-rescheduler/v3-workflow/run-turn.ts`
- `src/lib/appointment-reminders/ai-rescheduler/v3-workflow/luna-turn.ts`
