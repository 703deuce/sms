# Reviews backend verification report (PR #663)

Branch: `cursor/reviews-full-integration-f350`  
Scope: Backend/runtime only — Templates and Reviews UI unchanged.

## A. Actual runtime tests

| Test | Kind | Result | Notes |
|------|------|--------|-------|
| `scripts/test-reviews-backend-runtime.ts` | mock + optional DB | **PASS** (mock portion) | DB section skipped without `DATABASE_URL` in this environment |
| Campaign claim concurrency (`campaign-claim` memory store) | mock | **PASS** | Validates atomic queued→sending claim semantics |
| Review Velocity metrics (`calcEntityMetrics`) | mock | **PASS** | Fixture reviews, 7d/30d buckets |
| `scripts/test-reviews-full-integration-matrix.ts` | static | **PASS** | Wiring checks + nested platform-sender tests |
| `scripts/test-reviews-platform-sender-integration.ts` | static | **PASS** | |
| `scripts/test-ar-platform-sender-isolation.ts` | static | **PASS** | |
| `src/lib/reputation/sequence-engine.test.ts` | unit | **PASS** | |
| Reputation DB CRUD (15-step checklist) | **DB** | **Not run here** | Requires `DATABASE_URL` + `prisma migrate deploy` |
| `dispatchFeatureJob` enqueue | **DB** | **Not run here** | Requires `DATABASE_URL` |
| Platform inbound resolver | **handler** | **Not run here** | `getPrisma()` inbox path requires Supabase compat or DB |
| Campaigns/Reviews E2E send with mock provider | **DB+mock** | **Not run here** | Use `scripts/test-sms-worker.ts` pattern locally with `DATABASE_URL` |

**Run full DB suite locally:**

```bash
export DATABASE_URL='postgresql://...'
npx prisma migrate deploy
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-reviews-backend-runtime.ts
```

## B. Bugs found and fixed

| Issue | Root cause | Fix |
|-------|------------|-----|
| `update().eq().select().maybeSingle()` ran SELECT | Adapter `maybeSingle` always called `executeSelect` | `maybeSingle`/`then` call `executeUpdate` when mode is `update` |
| `await insert({})` no-op | `insert()` was not thenable | `insert()` chain is thenable and runs INSERT |
| `delete().eq()` broken | `delete()` returned immediate promise | `delete()` returns filterable builder |
| Missing query ops | Ported code uses `ilike`, count head, `or`, `is` | Added to `reputation-db.ts` |
| JSONB inserts failed | Objects passed raw to SQL | `::jsonb` casts + `JSON.stringify` for known columns |
| `businesses` table missing | LSE used separate businesses table | `businesses` view + `BusinessesQueryBuilder` on `Workspace` |
| `getPrisma()` wrong for reputation SQL | App `getPrisma()` is Supabase PostgREST compat | Reputation uses direct `PrismaClient` via `DATABASE_URL` |
| Schema drift | Ported code expects extra columns/tables | Migration `20261014180400_reputation_schema_alignment` |

## C. Campaigns sending

Platform path remains in `src/lib/campaigns/campaign-message-send.ts` → `resolveSharedPlatformOutboundSender` → `sendQuickSms`. Worker: `send_campaign_sms` in `src/lib/jobs/job-handlers.ts`. **Full worker E2E not executed in this VM** (no `DATABASE_URL`); claim concurrency and static wiring verified.

## D. Reviews sending

`dispatchReviewRequestSms` + reputation `campaign-message-send.ts` for queued campaign messages. Claim path verified (memory). **Live DB send path** requires local `DATABASE_URL` + mocked provider (see `test-sms-worker.ts`).

## E. Inbound routing

`platform-sms-inbound-dispatch.ts` calls `routePlatformMassTextOrReviewInbound` after AR. Review replies call `storeReviewReply`. **Webhook E2E not run** without database.

## F. Reviews database

`createServiceClient()` → `createReputationDbClient()` using **Postgres `PrismaClient`**, not Supabase env vars. Migrations: `20261014180000`–`20261014180400`.

## G. Review Velocity

Metrics unit test passes. Momentum worker registered as `review_momentum_run` via `dispatchFeatureJob` → Transovo `JobQueue`. Provider fetch not run without API keys.

## H. QR tracking

Schema includes `review_qr_*`; static `/r/` wiring in matrix test. **Route E2E not run** without DB.

## I. Regression

AR platform sender isolation test **PASS**. MCTB/AR/Campaigns code paths not modified except shared inbound block (already on branch).

## J. Remaining verification limitations

- **No `DATABASE_URL`** in Cloud Agent VM → no Prisma migrate, no CRUD integration, no job enqueue, no inbound persistence tests.
- **No Docker daemon** → cannot spin up local Postgres in this environment.
- **No live SMS/email** (by policy).
- **Supabase compat `getPrisma()`** still used for Contacts/Inbox; production Transovo deploy should use `DATABASE_URL` for Postgres (Coolify) — reputation tables require it.
