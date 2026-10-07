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

## Follow-ups (partial / remaining)

- Business approval: in-app notification + `POST /api/appointment-reminders/ai-rescheduler/approve` (staff UI affordance on appointments list still minimal)
- Provider availability for reschedule uses Voice V3 busy + AR weekly hours/rules when AI mode + SMS/conversation
- Reconciliation metadata `arReconcilePending` on provider-success / local DB failure (no background job yet)
- Calendar readiness levels 0–3 on settings API + page copy (per-event level 4 at mutation time via existing Microsoft validation)
- Full Google parity tests + conditional etag updates
- Broader automated test matrix from locked spec §10
- Live Microsoft/Google certification

## Key paths

- `src/lib/appointment-reminders/ai-rescheduler/*`
- `src/lib/messaging/inbound-process.ts`
- `src/lib/appointments/ai-scheduling/execute.ts`
- `src/lib/appointments/reminder-delivery.ts`
