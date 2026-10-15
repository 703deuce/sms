# Production journey blockers — fix report (2026-10-15)

Focused repair pass for four production **500** families identified in `docs/FOUR-PRODUCTS-USER-JOURNEY-E2E-AUDIT.md` (on branch `cursor/four-products-e2e-audit-f350`). **No live SMS/PSTN** or production deploy in this pass.

## Verification tiers (strict)

| Tier | Meaning |
|------|---------|
| **Code verified** | Static/regression script + repo tests |
| **API verified** | Handler loads without Prisma/schema errors (local or post-deploy smoke) |
| **Live delivery verified** | Real SMS/voice on tenant — **not claimed here** |

---

## Fix summary table

| Original failure | Root cause | Files changed | Fix | Regression test | Verification | Remaining blocker |
|------------------|------------|---------------|-----|-----------------|--------------|-------------------|
| `GET /api/appointment-reminders/reminders/workspace` → 500 | `VoiceAppointment` had **no `updatedAt` column**; Prisma rejected invalid field | `prisma/migrations/20261015114500_voice_appointments_updated_at`, `load-ar-reminder-workspace.ts`, `voice-appointment-query.ts` | Add **`updatedAt`**; workspace panel orders recent **row changes** by `updatedAt` | `test-production-journey-blocker-fixes.ts` + `test-ar-rescheduler-recency-semantics.ts` | **Code verified** | Deploy + migrate |
| `GET /api/appointment-reminders/ai-rescheduler/operations` → 500 | Same missing column; interim `startsAt` filter was **semantically wrong** for pending reconcile | `operations-query.ts`, `operations/route.ts`, `reconcile-pending.ts`, `run-ar-sms-outcome-backfill.ts` | **`updatedAt` lookback OR** reschedule/reconcile metadata; reconcile scan **metadata-only**; backfill orders by `updatedAt` (no `startsAt` window) | `test-ar-rescheduler-recency-semantics.ts` | **Code verified** (semantics corrected) | Deploy + migrate |
| `GET /api/reputation/contacts?businessId=…` → 500 | SQL selected columns **not present** on `review_request_contacts` (`source`, engagement fields) | `prisma/migrations/20261015103000_reputation_contacts_engagement_columns/migration.sql` | Add missing columns with safe defaults | Same script (asserts migration + select list) | **Code verified**; **API** after `prisma migrate deploy` on production DB | Migration must run on prod |
| `GET /api/templates/unified?product=all` → 500 | Invalid Prisma: `Template.orderBy.updatedAt` (field absent); invalid `solutionSetup.solutionKey`; wrong MCTB config source | `src/lib/templates/unified-templates.ts` | Order campaigns by **`name`**; MCTB row from **`loadMissedCallTextConfig`** | Same script | **Code verified** | None for this cause |

**Collateral:** `src/lib/appointment-reminders/ar-sms-usage.ts` — `await usesPlatformAppointmentSmsSender()` (metering correctness; not a page 500).

---

## Updated readiness matrix (four modules)

| Module | UI (prod smoke prior) | API (after this fix) | Code / pipeline | Live delivery |
|--------|----------------------|----------------------|-----------------|---------------|
| **MCTB** | LOAD_OK | Unchanged | TeXML contract **PASS** | **Not verified** — needs forwarded call + SMS |
| **Appointment Reminders** | Sequences/Settings/Templates **failed** | **Expected PASS** after deploy for workspace + test preview routes | Reminder jobs unchanged | **Not verified** — M365 + phone on appointment |
| **Campaigns** | Compose/review LOAD_OK; `/templates` **failed** | **Expected PASS** for unified templates | Launch worker path unchanged | **Not verified** — entitled launch + worker |
| **Reviews** | Most LOAD_OK; contacts **failed** | **Expected PASS** after DB migration | Drip/campaign code unchanged | **Not verified** — send on test list |

---

## Semantic correction (AR `updatedAt` vs `startsAt`)

The first repair pass used `startsAt` where the original (broken) code referenced `updatedAt`. That fixed Prisma 500s but could **drop pending reschedules** when `startsAt` was outside the lookback while `arReconcilePending` was still set.

**Final approach:**

| Surface | Recency semantics |
|---------|-------------------|
| AR reminder workspace panel | `orderBy updatedAt` on last 300 rows (recent activity / reminder stats) |
| AI Rescheduler operations API | `updatedAt >= since` **OR** `arReconcilePending` **OR** `arRescheduleRequest` in metadata |
| Reconcile pending scan | All rows with `arReconcilePending` (no `startsAt` filter) |
| SMS outcome backfill | Existing metadata `OR` filters; `orderBy updatedAt` only |

**Schema:** `voice_appointments."updatedAt"` added with default `now()`, backfilled from `"createdAt"`. Prisma `@updatedAt` maintains it on row updates.

---

## Post-deploy checklist

1. `npx prisma migrate deploy` (includes `20261015103000_reputation_contacts_engagement_columns` and `20261015114500_voice_appointments_updated_at`).
2. Re-run: `UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts`
3. One controlled **live delivery** cert per product (no new A2P gates on platform-sender paths unless that workflow uses workspace marketing sender).

---

## A2P / platform sender note

Campaign **broadcast** launch still uses `assertMassTextMarketingSendAllowed` for **mass-texting marketing** registration — appropriate when the workspace sends from its **marketing** use case. **Appointment Reminders** and **MCTB** platform toll-free paths use `resolveAppointmentOutboundSmsRoute` / MCTB platform sender — **do not** conflate with Mass Texting A2P in certification. This pass did **not** change those gates.
