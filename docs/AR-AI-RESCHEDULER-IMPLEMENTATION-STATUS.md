# AI Rescheduler — implementation status (branch `cursor/ar-ai-rescheduler-implement-f350`)

**Do not merge or deploy without approval.**

## Shipped in this pass

| Area | Status |
|------|--------|
| `aiRescheduler` platform config + defaults | Done |
| API `GET/PATCH /api/appointment-reminders/ai-rescheduler` + approve | Done |
| Opus page `/appointment-reminders/ai-rescheduler` + nav | Done |
| Reminder SMS suffix C/R/X on `trySendStep` SMS path + per-send context (24h/2h/additional) | Done |
| Outbound `messageId` + `timelineType` on reminder context | Done |
| Inbound C / R / X + YES cancel confirm + AR follow-up before inbox/MCTB AI | Done |
| Eligibility gate (contact + SMS reminder eligibility + non-internal) | Done |
| C → Transovo confirm + Google extendedProperties annotate (best effort) | Done |
| X → cancellation policy + YES confirm; provider cancel when enabled | Done |
| R → notify request or AI thread (`activeIntent` RESCHEDULE) | Done |
| Provider reschedule preserves title/attendees (time-only PATCH) | Done |
| Recurring series guard on commit | Done |
| Provider availability (Voice V3 busy + AR rules) | Done |
| Business approval queue + approve API | Done |
| Scripts: `test-ar-ai-rescheduler.ts`, `test-ar-ai-rescheduler-integration.ts` | Done |
| Addendum doc `AR-AI-RESCHEDULER-REQUIRED-ADDENDUM.md` | Done |

## Follow-ups (partial / remaining)

- Staff approve affordance in appointments UI (API exists)
- Background reconciliation job for `arReconcilePending`
- Full mocked E2E harness (import → reminder → inbound → provider mock) in CI
- Live Microsoft/Google + Telnyx certification (steps in addendum §H)
- Microsoft customer-confirmed annotation (Transovo metadata authoritative)

## Key paths

- `src/lib/appointment-reminders/ai-rescheduler/*`
- `src/lib/messaging/inbound-process.ts`
- `src/lib/appointments/ai-scheduling/execute.ts`
- `src/lib/appointments/reminder-delivery.ts`
