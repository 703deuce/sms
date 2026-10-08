# AR SMS PR #621 + #622 — verification report

**Status:** Pre-merge integration review (not a live PSTN certification).  
**Last verified (automated):** 2026-10-08 — Cloud Agent on `cursor/ar-reminder-customer-outcome-ui-f350` @ `87969b7f8`.  
**Branches:** `cursor/ar-post-complete-ack-cutoff-f350` (#621), `cursor/ar-reminder-customer-outcome-ui-f350` (#622, includes #621 two-agent commits).

## Executive summary

| Area | Code | Automated tests | Live Microsoft + SMS |
|------|------|-----------------|----------------------|
| Two-agent SMS (#621) | Implemented | 30 vitest tests PASS (see below) | **Not run** in this session |
| Customer outcomes UI (#622) | Implemented | Included in same suite + backfill tests | **Not run** (UI not browser-tested here) |
| Cancel/reschedule policies | Implemented | `ar-sms-action-policy` + `reschedule-sms-cutoff` PASS | Policy copy only until live late-cutoff scenario |
| Request vs completed outcomes | Tightened backfill + live hooks | PASS | N/A |

**Merge / deploy:** Still blocked until someone with a Microsoft-linked test appointment runs the in-process or live SMS scripts below and completes the manual multi-day thread checklist.

## User checklist (six boundaries)

| # | Requirement | Verdict | Evidence |
|---|-------------|---------|----------|
| 1 | Both agents share the same conversation snapshot (history, completed ops, pending offers) | **PASS (code + unit)** | `buildArSmsSharedTurnSnapshot` → `runArSmsContextAgent` → `runArRescheduleLunaTurn` with `snapshot.conversationHistory`; `ar-sms-shared-snapshot.test.ts` |
| 2 | Natural language from first SMS and after a completed operation | **PASS (code + prompt); live not run** | No post-complete canned ack bypass; appointment-agent COMPLETED guidance; `AR_INBOUND_ROUTABLE_LIFECYCLE_STATES` includes `COMPLETED` |
| 3 | Reschedule → thanks → next day → reschedule again without replaying first op | **PARTIAL** | `resetReschedulePhaseForNewRequest` + session re-open on COMPLETED; two `rescheduled` outcome events in tests; live multi-day steps in §4 |
| 4 | PR #622 attributes second op to correct appointment; list shows latest time | **PASS (unit)** | `ar-sms-integration-boundaries.test.ts` (latest Oct 19 over Oct 12); `startsAt` authoritative on list |
| 5 | Independent cancel cutoff, late policies, penalties, acknowledgments | **IMPLEMENTED** | `ar-sms-action-policy.ts` + persisted `arSmsPolicyAck` (`ar-sms-policy-ack.ts`); enforced at cancel/reschedule write boundaries; `ar-sms-policy-ack.test.ts` |
| 6 | Microsoft calendar path (not mocks only) | **NOT RUN** | Bootstrap E2E without `externalId` stops at calendar verify; use §7 with real `AR_SMS_E2E_*` or `test-ar-ws1-live-sms-crx-e2e.ts` |

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

**Late-action policy acceptance (2026-10-08):** `arSmsPolicyAck` on appointment metadata tracks `warning_delivered` → `accepted` / `declined`, policy fingerprint, message + timestamp, and `consumedAt` after a successful calendar write. C/R/X and natural-language paths share `ensureArSmsPolicyWarningDelivered` + `gateArSmsCalendarWriteByPolicy`. Scheduling questions do not imply acceptance.

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

## 7. Automated run log (2026-10-08)

```bash
npx vitest run \
  src/lib/appointment-reminders/ar-sms-outcome-backfill.test.ts \
  src/lib/appointment-reminders/ar-sms-integration-boundaries.test.ts \
  src/lib/appointment-reminders/ar-sms-outcome-detail.test.ts \
  src/lib/appointment-reminders/ar-sms-customer-outcome.test.ts \
  src/lib/appointment-reminders/ai-rescheduler/ar-sms-shared-snapshot.test.ts \
  src/lib/appointment-reminders/ai-rescheduler/context-agent/ar-sms-context-schema.test.ts \
  src/lib/appointment-reminders/ai-rescheduler/ar-sms-action-policy.test.ts \
  src/lib/appointment-reminders/ai-rescheduler/reschedule-sms-cutoff.test.ts
# → 7 files, 30 tests, all PASS

AR_SMS_E2E_BOOTSTRAP=1 AR_SMS_E2E_DRY_RUN=1 \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-ar-sms-luna-conversation-e2e.ts
# → PASS dry run; R opens flow; natural follow-up requires provider ref (no externalId on bootstrap row)
```

### Microsoft + full conversation (owner / staging)

**In-process (no phone)** — point at a workspace appointment that already has a Microsoft `externalId` and matching reply-session calendar fields:

```bash
AR_SMS_E2E_WORKSPACE_ID=... AR_SMS_E2E_APPOINTMENT_ID=... \
AR_SMS_E2E_LINES='Friday afternoon\nthe second one\nYes\nThanks\nCan we move to Tuesday afternoon?' \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-ar-sms-luna-conversation-e2e.ts
```

Or bootstrap with an existing Graph event:

```bash
AR_SMS_E2E_BOOTSTRAP=1 \
AR_SMS_E2E_MICROSOFT_CONNECTION_ID=... AR_SMS_E2E_PROVIDER_EVENT_ID=... \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-ar-sms-luna-conversation-e2e.ts
```

**Live Telnyx + Microsoft fixture** (creates Graph event, sends real SMS):

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-ar-ws1-live-sms-crx-e2e.ts
```

After any successful reschedule, confirm appointment detail shows latest `customerResponse` / action history and that `npm run backfill:ar-sms-customer-outcomes -- --dry-run` does not propose downgrades for that row.

## 8. PR #622 backfill safety (user review)

| Rule | Status |
|------|--------|
| Do not mark Cancelled/Rescheduled from `COMPLETED` session alone | Enforced in `ar-sms-outcome-backfill.ts`; test `does not infer outcome from COMPLETED session alone` |
| Prefer `arRescheduleOps.completed` or legacy `rescheduled` timeline | Enforced |
| `cancel_pending` ≠ `cancelled` in UI summary | `ar-sms-integration-boundaries.test.ts` |
| No invented cancellation reasons | Notes use customer snippet or neutral copy only |
| Idempotent backfill; dry-run first | `scripts/backfill-ar-sms-customer-outcomes.ts` supports `--dry-run`; does not overwrite newer verified types when timeline already has outcome events |
