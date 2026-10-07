# AI Rescheduler — implementation status (branch `cursor/ar-ai-rescheduler-implement-f350`)

**Do not merge or deploy without approval.**

## Shipped in this pass

| Area | Status |
|------|--------|
| `aiRescheduler` platform config + defaults | Done |
| API `GET/PATCH /api/appointment-reminders/ai-rescheduler` | Done |
| Opus page `/appointment-reminders/ai-rescheduler` + nav | Done |
| Reminder SMS suffix C/R/X + context on send | Done |
| Inbound C / R / X reminder-bound handler | Done |
| AI SMS path when notify or AI mode (`channel-adapters`) | Done |
| Provider-first reschedule via Voice V3 `executeMicrosoftUpdateBooking` + Google `updateGoogleEvent` | Done (`commit-reschedule` + `execute.ts`) |
| Idempotency keys on reschedule ops in appointment metadata | Partial |
| Automated script `scripts/test-ar-ai-rescheduler.ts` | Done |

## Follow-ups (not complete)

- Business approval inbox action + revalidation at approve time
- Enforce `weeklyHours`, `minimumNoticeMinutes`, `maximumDaysAhead`, `bufferMinutes` in availability resolver
- Full Google parity tests + conditional etag updates
- Durable cross-request reconciliation job after provider-success / DB-failure
- Four-tier calendar readiness UI on settings page
- Broader automated test matrix from locked spec §10
- Live Microsoft/Google certification

## Key paths

- `src/lib/appointment-reminders/ai-rescheduler/*`
- `src/lib/messaging/inbound-process.ts`
- `src/lib/appointments/ai-scheduling/execute.ts`
- `src/lib/appointments/reminder-delivery.ts`
