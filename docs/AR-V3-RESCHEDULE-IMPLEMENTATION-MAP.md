# AR SMS reschedule ↔ Voice V3 implementation map

Branch: `cursor/ar-ai-rescheduler-implement-f350` · PR #616

## Transport vs scheduling

| Layer | Voice V3 | Appointment Reminders SMS |
|-------|----------|---------------------------|
| Input | Speech → GPT-Live-1 | SMS → GPT-6 Luna (tool-calling) |
| Reasoning | GPT-6 Astra | Luna (`arAiReschedulerModelOptions`) |
| Appointment identity | `find_appointment` | `ArSmsReplySession` + `loadVerifiedExistingForArSession` |
| Scheduling meaning | `set_scheduling_preference` tool | Same tool executor (`setSchedulingPreferenceTool`) |
| Availability | `find_availability` → `dispatchFindAvailabilityIfRequired` | Same dispatch + `buildArFindBusyFetcher` |
| Offer set / slots | `buildAvailabilityOfferSet` in call context | Persisted in `ar_sms_reply_sessions.rescheduleWorkflowState` |
| Slot commit | `reschedule_appointment` + `dispatchRescheduleIfRequired` | Same tools + dispatch; `updateBooking` → `patchProviderEventTimes` |
| Local sync | Voice durable booking store | `syncLocalAppointmentAfterProviderReschedule` |
| Confirmation SMS | Live speech after `RESCHEDULE_CONFIRMED` | Luna reply only after phase `RESCHEDULE_CONFIRMED` |

Voice V3 source files are **not modified**. AR imports executors and dispatch.

## Entry points

| Step | AR file |
|------|---------|
| R letter (deterministic) | `inbound-replies.ts` → `RESCHEDULING`, no Luna |
| Follow-up SMS | `inbound-follow-up.ts` → `runArV3RescheduleSmsTurn` |
| Turn orchestration | `v3-workflow/run-turn.ts` |
| Luna + tools | `v3-workflow/luna-turn.ts` |
| Durable V3 context | `v3-workflow/persist.ts` (`rescheduleWorkflowState` JSON) |
| Session runtime | `v3-workflow/session-runtime.ts` |
| Agent config | `v3-workflow/agent-config.ts` |
| Verified existing | `v3-workflow/verified-existing.ts` |

## Requirement status (owner verification)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | R → `RESCHEDULE_APPOINTMENT` without Luna intent ID | **IMPLEMENTED** | `inbound-replies.ts` letter R |
| 2 | Session-bound appointment | **IMPLEMENTED** | `verify-reply-session.ts`, `verified-existing.ts` |
| 3 | Luna interprets; backend executes | **IMPLEMENTED** | `luna-turn.ts` tool loop |
| 4 | Authoritative offer sets + slot IDs | **IMPLEMENTED** | V3 `buildAvailabilityOfferSet`; state in `rescheduleWorkflowState` |
| 5 | No production regex slot router on AR path | **IMPLEMENTED** | Legacy `handleAppointmentAIRequest` path removed from follow-up |
| 6 | `filterBusyForReschedule` / freeBusyOverrides | **REUSED** | `dispatchFindAvailabilityIfRequired` + AR busy fetch |
| 7 | Fresh revalidation before commit | **REUSED** | `dispatchRescheduleIfRequired` |
| 8 | Update original event (MS/Google) | **IMPLEMENTED** | `patchProviderEventTimes` in `updateBooking` hook |
| 9 | `RESCHEDULE_CONFIRMED` before customer success copy | **IMPLEMENTED** | `luna-turn.ts` checks phase before `confirmed: true` |
| 10 | Reminder reset after success | **IMPLEMENTED** | `syncLocalAppointmentAfterProviderReschedule` |
| 11 | Staff approval mode same executor | **REMAINING** | Approval queue not yet wired to V3 bind+dispatch |
| 12 | Live Google/Microsoft certification | **BLOCKED** | Needs owner calendar + migration on target DB |

## Tests

| Test | Type |
|------|------|
| `scripts/test-ar-v3-reschedule-workflow-unit.ts` | Mock/unit: busy filter, stale offer_set_id, slot bind |
| `scripts/test-ar-pr616-backend-verification.ts` | Simulated `commitArReschedule` |
| `scripts/test-ar-ws1-live-sms-crx-e2e.ts` | Live SMS (owner phone + MS) |

## Migration

`prisma/migrations/20261008150000_ar_reschedule_workflow_state` adds `rescheduleWorkflowState` to `ar_sms_reply_sessions`. Apply on Supabase before production SMS reschedule.

## Retired for AR follow-up

- `handleAppointmentAIRequest` + `resolveSlotFromConversation` for platform AR reschedule follow-ups (still used elsewhere for public booking / non-session SMS).
