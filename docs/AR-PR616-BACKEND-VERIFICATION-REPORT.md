# AR PR #616 — backend verification report (updated)

**Branch:** `cursor/ar-ai-rescheduler-implement-f350` · **PR:** #616  
**Policy:** No merge/deploy without owner approval. **No destructive tests against production Supabase.**

## Status legend

- **VERIFIED LIVE** — real external API or provider
- **VERIFIED WITH MOCKS / SIMULATED** — code path exercised without live provider/SMS
- **NOT VERIFIED** — not run or blocked by configuration

---

## Billing concurrency — root cause and fix

| Item | Detail |
|------|--------|
| **Root cause** | `reserveArReminderSmsUnit` used `tx.$executeRaw` (advisory lock) and `tx.$queryRaw` (`FOR UPDATE`) which **do not exist** on the Supabase `prisma-compat` client. Same failure would occur on every metered reminder send in production. |
| **Fix** | New `casIncrementArSmsUsageIfBelowLimit` / `casDecrementArSmsUsage` in `src/lib/appointment-reminders/ar-sms-usage-reserve.ts` using **optimistic concurrency** on `workspace_limits.limits.arReminderSmsUsageRevision` + PostgREST `updateMany` JSON path filters. |
| **Atomicity** | Each successful reserve performs read revision → conditional `updateMany` (revision match) → increment `arReminderSmsUsed` and bump revision. Concurrent callers retry (up to 16 attempts); at most one increment wins per revision step, preventing over-allocation under parallel reserves. Idempotency remains appointment metadata `arSmsReservations`. |
| **Also fixed** | `countBillableArReminderSmsSentInPeriod` no longer uses `$queryRaw` (returns empty on compat); uses `voiceAppointment.findMany` + timeline scan. |

**Billing concurrency test:** **NOT VERIFIED** on this agent — requires `AR_TEST_SUPABASE_URL` + `AR_TEST_SUPABASE_SERVICE_ROLE_KEY` (isolated staging). Command:

`NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-ar-billing-concurrency.ts`

---

## GPT-6 Luna

| | |
|--|--|
| Result | **VERIFIED LIVE** |
| Command | `npm run test:ar-gpt-6-luna-live` |
| Notes | `max_completion_tokens` for `gpt-6*` in `llm-providers.ts`; understanding JSON validated |

---

## Launch / MCTB

| | |
|--|--|
| AR-first nav | **VERIFIED WITH MOCKS** (flags + middleware static read) |
| MCTB preserved | **VERIFIED WITH MOCKS** (runtime files present; UI gated) |

---

## Migrations

| Migration | Validation doc |
|-----------|----------------|
| `20261008130000_ar_sms_reply_session` | `docs/AR-SUPABASE-MIGRATIONS-20261008.md` |
| `20261008140000_ar_sms_inbound_held` | same |

**NOT applied** to production in this pass. Post-apply verification must run on **staging** only.

---

## Test database policy (changed)

- **Removed** production Supabase hydration for destructive tests (`hydrate-prod-test-env.ts` loads LLM keys only).
- **Required for DB integration tests:** `AR_TEST_SUPABASE_URL`, `AR_TEST_SUPABASE_SERVICE_ROLE_KEY`.
- Guard: `scripts/cloud-agent/ar-test-database-guard.ts`.

---

## Remaining verification matrix

| Area | Status |
|------|--------|
| Sender inventory (Telnyx/Twilio authorized) | **NOT VERIFIED** (was production DB; re-run on staging after credentials) |
| `ArSmsReplySession` routing | **NOT VERIFIED** until migrations on staging |
| Billing concurrency end-to-end | **NOT VERIFIED** until staging DB + rerun test |
| Google Calendar reschedule | **NOT VERIFIED LIVE** |
| Microsoft 365 reschedule | **NOT VERIFIED LIVE** |
| SMS R → AI → confirmation | **NOT VERIFIED LIVE** |
| Twilio collision backup | **NOT VERIFIED LIVE** |
| Provider reconciliation (read provider truth) | **NOT VERIFIED LIVE** (local metadata reconcile was **SIMULATED** on staging-only path previously) |

---

## Files changed (this pass)

- `src/lib/appointment-reminders/ar-sms-usage.ts` — Supabase-safe reserve/release; no raw SQL
- `src/lib/appointment-reminders/ar-sms-usage-reserve.ts` — CAS increment/decrement
- `src/lib/appointment-reminders/ar-sms-usage-constants.ts` — `USAGE_REVISION_KEY`
- `src/lib/appointment-reminders/ar-sms-usage-reserve.test.ts` — unit tests
- `scripts/cloud-agent/ar-test-database-guard.ts` — staging-only DB policy
- `scripts/cloud-agent/hydrate-prod-test-env.ts` — LLM-only hydrate
- DB test scripts — use isolated guard
- `docs/AR-SUPABASE-MIGRATIONS-20261008.md`

---

## Owner next steps

1. Provision **staging Supabase** with same schema + compat behavior; set `AR_TEST_*` secrets on Cloud Agent environment (not production).
2. Apply migrations on **staging** first; rerun billing + session verification scripts.
3. Schedule **live** Google/Microsoft + SMS certification on dedicated test calendars/numbers (documented in prior instructions).
4. After staging green, approve production migration + controlled deploy.
