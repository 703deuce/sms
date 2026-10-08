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
| **Fix** | Per-workspace in-process lock (`ar-sms-usage-metering-lock.ts`) + `workspaceLimits.upsert` for metered counters (MCTB-style). PostgREST JSON `equals` CAS was rejected (`22P02`). |
| **Atomicity** | Reserves serialize in one Node process; counter stored in `limits.arReminderSmsUsed` with revision bump. Idempotency via appointment metadata `arSmsReservations`. |
| **Also fixed** | `getArSmsUsageSnapshot` only raises `used` from timeline scan (`counted > used`), never lowers it — reserved-but-not-yet-sent units stay counted. Timeline scan uses `voiceAppointment.findMany` (no `$queryRaw`). |

**Billing concurrency test:** **VERIFIED** on Cloud Agent (Coolify-hydrated production Supabase; isolated test workspace created/deleted). Command:

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

**Applied** to production Supabase via Coolify web container `prisma migrate deploy` (see `docs/AR-SUPABASE-MIGRATIONS-20261008.md`). Session-bound tests pass after apply.

---

## Test database policy

- Cloud Agent hydrates **Supabase + LLM** from the production web container (`hydrate-prod-test-env.ts` via `coolify-server` SSH). No separate `AR_TEST_*` secrets in the Cloud Agent UI required.
- Optional local override: `AR_TEST_SUPABASE_URL` + `AR_TEST_SUPABASE_SERVICE_ROLE_KEY`.
- Guard: `scripts/cloud-agent/ar-test-database-guard.ts`.

---

## Remaining verification matrix

| Area | Status |
|------|--------|
| Sender inventory (Telnyx/Twilio authorized) | **NOT VERIFIED** (was production DB; re-run on staging after credentials) |
| `ArSmsReplySession` routing | **NOT VERIFIED** until migrations on staging |
| Billing concurrency end-to-end | **VERIFIED** (hydrated Supabase; ephemeral test workspace) |
| Google Calendar reschedule | **NOT VERIFIED LIVE** |
| Microsoft 365 reschedule | **NOT VERIFIED LIVE** |
| SMS R → AI → confirmation | **NOT VERIFIED LIVE** |
| Twilio collision backup | **NOT VERIFIED LIVE** |
| Provider reconciliation (read provider truth) | **NOT VERIFIED LIVE** (local metadata reconcile was **SIMULATED** on staging-only path previously) |

---

## Files changed (this pass)

- `src/lib/appointment-reminders/ar-sms-usage.ts` — Supabase-safe reserve/release; no raw SQL
- `src/lib/appointment-reminders/ar-sms-usage-metering-lock.ts` — per-workspace metering mutex
- `src/lib/appointment-reminders/ar-sms-usage-reserve.ts` — deprecated re-export (math only)
- `src/lib/appointment-reminders/ar-sms-usage-constants.ts` — `USAGE_REVISION_KEY`
- `src/lib/appointment-reminders/ar-sms-usage-reserve.test.ts` — unit tests
- `scripts/cloud-agent/ar-test-database-guard.ts` — staging-only DB policy
- `scripts/cloud-agent/hydrate-prod-test-env.ts` — Supabase + LLM hydrate from Coolify
- DB test scripts — use isolated guard
- `docs/AR-SUPABASE-MIGRATIONS-20261008.md`

---

## Owner next steps

1. Schedule **live** Google/Microsoft + SMS certification on dedicated test calendars/numbers.
2. Approve production deploy when ready (migrations already applied on production DB for AR tables).
3. Optional: set `AR_TEST_*` only if you want a dedicated non-production Supabase for tests (not required — Cloud Agent hydrates from Coolify today).
