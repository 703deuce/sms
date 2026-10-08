# AR SMS PR #621 + #622 — verification report

**Status:** Pre-merge integration review (not a live PSTN certification).  
**Branches:** `cursor/ar-post-complete-ack-cutoff-f350` (#621), `cursor/ar-reminder-customer-outcome-ui-f350` (#622, includes #621 two-agent commits).

## 1. Two-agent architecture (#621)

| Requirement | Implementation | Automated test |
|-------------|----------------|----------------|
| Context Agent: Luna, medium reasoning, JSON only, no tools | `run-ar-sms-context-agent.ts`, `openAiChatJsonResponse` with `reasoningEffort: "medium"` | Pipeline wired in `run-turn.ts` |
| Strict schema; no `suggested_reply` | Zod `.strict()` on `arSmsContextInterpretationSchema` | `ar-sms-context-schema.test.ts` |
| Same snapshot for both agents | `buildArSmsSharedTurnSnapshot` → context → `runArRescheduleLunaTurn` with same `conversationHistory` | `ar-sms-shared-snapshot.test.ts` |
| Appointment Agent gets original message + advisory JSON | `luna-turn.ts` system block + full history + `message` | Code review |
| No premature `AWAITING_REPLY` → `RESCHEDULING` | Removed from `run-turn.ts` / `inbound-follow-up.ts`; lifecycle on `begin_reschedule_request` / scheduling tools | Code review |
| `confirmed: true` only on calendar commit this turn | `luna-turn.ts` after `reschedule_appointment` success | Code review |
| Post-complete thanks ≠ second reschedule | Appointment Agent prompt + context examples; `resetReschedulePhaseForNewRequest` on new scheduling preference | `ar-sms-integration-boundaries.test.ts` (outcome layer) |

**Not verified in this environment:** Live Telnyx SMS + Microsoft Graph write on a real workspace (requires production/staging credentials and manual phone). Use:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-sms-luna-conversation-e2e.ts
# or AR_SMS_E2E_BOOTSTRAP=1 with Microsoft connection env vars
```

## 2. Customer outcomes (#622)

| Surface | Behavior |
|---------|----------|
| Appointments list | `customerResponse` from `resolveArCustomerResponseSummary` + authoritative `startsAt` |
| Detail drawer | Per-reminder engagement + **customer action history** (all `ar_sms_outcome_*` events, chronological) |
| Live recording | `recordArSmsCustomerOutcome` on confirm / cancel request / cancel complete / reschedule start / reschedule commit |
| Backfill | `npm run backfill:ar-sms-customer-outcomes` — idempotent, dry-run supported |

### Requested vs completed ( tightened )

| Customer state | Outcome type | Shown as |
|----------------|--------------|----------|
| “I need to cancel” | `cancel_pending` | Awaiting cancel confirmation |
| Calendar cancel succeeded | `cancelled` + status canceled | Cancelled by customer |
| “Can we do Friday?” (in flow) | `reschedule_started` | Rescheduling in progress |
| Notify-mode request | `reschedule_requested` | Reschedule requested |
| Graph/local commit | `rescheduled` | Rescheduled — **Now** (latest `startsAt`) |

**Backfill does not** mark Cancelled/Rescheduled from `COMPLETED` session alone. It uses canceled status, legacy `rescheduled` timeline, or `arRescheduleOps.completed`.

**Snippets** are shown as `Customer texted: "..."` — not invented cancellation reasons.

## 3. Cancellation / reschedule policies (#621)

Implemented in `ar-sms-action-policy.ts` + UI `SmsActionPolicyFields`:

- Independent `rescheduleSmsPolicy` and `cancelSmsPolicy` (`cutoffMinutes`, `afterCutoff`: allow | allow_with_warning | contact_business)
- Penalty types: none, lost_session, percent_of_price, fixed_fee, nonrefundable_deposit, custom_text
- Enforcement: `inbound-replies.ts` (C/R/X), `luna-turn.ts` (`arExecuteReschedule`), reminder suffix `buildArReplyInstructionsSuffix`
- Tests: `ar-sms-action-policy.test.ts`, `reschedule-sms-cutoff.test.ts`

**Gap / clarify:** “Explicit acknowledgment” for late reschedule is communicated in SMS copy (penalty warning before flow continues). There is no separate persisted “customer acknowledged penalty” flag beyond proceeding in conversation.

## 4. Multi-day / second reschedule on same thread

- Inbound still allowed when session lifecycle is `COMPLETED` (`AR_INBOUND_ROUTABLE_LIFECYCLE_STATES`).
- Second reschedule should record another `ar_sms_outcome_rescheduled` event; list summary uses **latest** outcome by timestamp; drawer shows full **action history**.
- Appointment row `startsAt` is authoritative for “current time” in the list.

**Recommended manual scenario after deploy:**

1. Reschedule via SMS → verify calendar + outcome event.
2. Text “Thanks” → natural reply, no second calendar write.
3. Next day: “Can we move to Tuesday?” → new reschedule flow + second outcome + updated list time.

## 5. Merge order

1. Merge **#621** (two-agent + policies + Luna fixes).
2. Merge **#622** (outcomes UI + backfill) — branch already contains #621 commits.
3. Run backfill dry-run on production, then apply if counts look reasonable.

## 6. What remains before “production certified”

- [ ] One live SMS + Microsoft reschedule smoke on staging/production workspace
- [ ] Manual multi-day thread test (steps above)
- [ ] Optional: extend `test-ar-sms-luna-conversation-e2e.ts` with post-complete “Thanks” + second reschedule lines

**Do not merge/deploy until live path is run by someone with DB + Telnyx + Microsoft test appointment.**
