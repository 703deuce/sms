# AR PR #616 — backend verification report

**Branch:** `cursor/ar-ai-rescheduler-implement-f350`  
**PR:** #616  
**Date:** 2026-10-08  
**Scope:** Verification only (no MCTB rewrite, no product switcher restore, no merge/deploy).

## Commands run

| Command | Result |
|---------|--------|
| `npm run test:ar-platform-isolation` | PASS |
| `npm run test:ar-gpt-6-luna-live` | PASS (`gpt-6-luna`, intent `RESCHEDULE`) |
| `npm run test:ar-pr616-verification` | PASS 5 / CONFIG 1 / FAIL 0 |
| `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-ar-matrix.ts` | PASS (DB section via Supabase hydrate) |
| `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-ar-billing-concurrency.ts` | **FAIL** — `tx.$executeRaw is not a function` (Supabase prisma-compat) |
| `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-appointment-reminders-log-pagination.ts` | See latest run in CI log |
| `npm run test:appointment-reminders` | See suite tail (billing blocks full green on Supabase compat) |

Cloud Agent DB access uses **production Supabase** (hydrated from Coolify web container via `scripts/cloud-agent/hydrate-prod-test-env.ts`). Isolated workspaces are created and deleted by each script. **Do not** point `DATABASE_URL` at local Postgres — `getPrisma()` is Supabase-only.

## 1. OpenAI `gpt-6-luna`

- **Configured model:** `gpt-6-luna` (`src/lib/appointment-reminders/ai-rescheduler/model.ts`).
- **Live request:** PASS after fixing OpenAI token parameter for `gpt-6*` models (`max_completion_tokens` in `src/lib/ai/llm-providers.ts`).
- **Parser contract:** Response validated with `validateUnderstandingResult` (scoped `Set` ids).

No silent model fallback.

## 2. Reschedule pipeline (R → session → commit → reminders)

| Step | Status | Notes |
|------|--------|-------|
| Telnyx reminder send | Not exercised live | Out of scope for automated run |
| Customer reply `R` | Not exercised live | |
| `ArSmsReplySession` bind | **CONFIG** | Table `ar_sms_reply_sessions` missing from production Supabase schema cache — apply migration `20261008130000_ar_sms_reply_session` |
| GPT understanding | PASS (live, bounded) | `test-ar-gpt-6-luna-live.ts` |
| Availability / commit | PASS (simulated) | `commitArReschedule` + `revalidateArSlotBeforeCommit` without external calendar ref |
| Provider Google/Microsoft patch | **SIMULATED** | Ref parsing only; no live Graph/Calendar API calls |
| Local sync + reminder reset | PASS | Reconciliation + staff-approval paths on Supabase |
| Customer SMS ack | Not exercised live | |

## 3. Reconciliation (provider success → local DB catch-up)

**PASS (SIMULATED):** Appointment without provider ref; `arReconcilePending` metadata → `reconcileArReschedulePending` updates local `startsAt` and clears pending flag.

## 4. Google / Microsoft

**SIMULATED:** `parseImportedExternalId` + `providerRefFromAppointment` keep connection ids workspace-scoped. **LIVE** reschedule not certified in this pass (requires staging calendar connections).

## 5. Sender authorization (AR use case)

**PASS (inventory):** `listArEligiblePlatformSenders()` — **1 Telnyx** and **1 Twilio** candidate passed `isPhoneAuthorizedForOutboundSms` (not a live send).

## 6. Staff approval + revalidation

**PASS (SIMULATED calendar):** `queueArRescheduleBusinessApproval` → `approveArRescheduleRequest` → local appointment time updated with `revalidateArSlotBeforeCommit` at approve time.

## 7. MCTB hidden, not removed

**PASS:** `isAppointmentRemindersV1Primary()`, product switcher off, MCTB UI paths gated in middleware (webhooks excluded). Runtime preserved (`src/lib/agents/missed-call-text-back/process.ts`).

## 8. Build / lint

- **TypeScript:** Repo-wide `tsc` reports pre-existing errors outside AR (e.g. `newui-transplant/`). No AR-specific regressions identified in changed files.
- **Lint:** Not re-run repo-wide (known legacy noise). AR verification scripts are the gate for this pass.

## Blockers before merge

1. **Apply Supabase migrations** for `ar_sms_reply_sessions` (and `ar_sms_inbound_held_messages` if held inbound is in scope for launch).
2. **AR SMS billing concurrency test** on Supabase: implement or shim `$executeRaw` in prisma-compat **or** refactor `reserveArReminderSmsUnit` to use compat-safe locking.
3. **Live** Google/Microsoft reschedule certification on staging tenants (original event update, no duplicate, workspace isolation).
4. **Live** end-to-end: reminder SMS → `R` → multi-turn AI → provider patch → confirmation SMS.

## Code changes in this verification pass

- `scripts/cloud-agent/hydrate-prod-test-env.ts` — Supabase + LLM hydrate for tests
- `scripts/test-ar-gpt-6-luna-live.ts` — bounded live model check
- `scripts/test-ar-pr616-backend-verification.ts` — orchestrated backend checks
- `src/lib/ai/llm-providers.ts` — `gpt-6-luna` token API shape
- `src/lib/supabase/prisma-compat.ts` — map `arSmsReplySession` / `arSmsInboundHeldMessage` tables
- DB test scripts accept Supabase without `DATABASE_URL`
- `package.json` — `test:ar-gpt-6-luna-live`, `test:ar-pr616-verification`

**Recommendation:** Do not merge PR #616 until migration (1) is applied in production Supabase and session-bound pipeline (2) is re-run green; then schedule live calendar + SMS certification.
