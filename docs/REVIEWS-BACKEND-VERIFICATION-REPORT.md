# Reviews backend verification report (PR #663)

Last run: Cloud Agent VM with `scripts/test-reviews-backend-runtime.ts`.

## How to run

**Local isolated Postgres (no Supabase):**

```bash
bash scripts/setup-reviews-cert-database.sh
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-reviews-backend-runtime.ts
```

**Integrated (hydrated `DATABASE_URL` + Supabase from Coolify web — same Postgres as production):**

```bash
REVIEWS_USE_INTEGRATED_DB=1 HEADLESS_PROVIDER_MODE=recording \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/test-reviews-backend-runtime.ts
```

Apply pending migrations on the target DB when needed:

```bash
REVIEWS_RUN_MIGRATE_DEPLOY=1 REVIEWS_USE_INTEGRATED_DB=1 … npx tsx scripts/test-reviews-backend-runtime.ts
```

## Results (honest)

| Area | Local cert DB | Integrated DB (Coolify) |
|------|---------------|-------------------------|
| Reputation adapter CRUD (insert/update/upsert, JSONB, filters) | **PASS** | **PASS** |
| Workspace isolation (`business_id` scoping) | **PASS** | **PASS** |
| Campaign message claim | **PASS** (in CRUD suite) | **PASS** |
| Review reply persistence | **PASS** | **PASS** |
| QR scan row persistence | **PASS** | **PASS** |
| Mocked outbound SMS (`HEADLESS_PROVIDER_MODE=recording`) | SKIP (needs Supabase) | **PASS** (not live carrier) |
| Platform inbound match + persist | SKIP | **PASS** |
| Job queue row for `review_momentum_run` | SKIP | **PASS** |
| `runReviewMomentum` execute w/ mocked Google/review providers | **SKIP** | **SKIP** |
| Review Velocity metrics unit fixture | **PASS** (mock) | **PASS** (mock) |
| Claim concurrency (memory store) | **PASS** (mock) | **PASS** (mock) |
| Static integration matrix | **PASS** | **PASS** |

## Fixes applied during verification

- `reputation-db.ts`: no synthetic `id` on `reputation_settings`; timestamptz casts for ISO date strings.
- Migration `20261014180500_review_qr_campaign_columns` for QR columns used by runtime code.
- Supabase compat: `platformProductConsumerAssignment` model mapping.
- Missing shims used by reputation imports: `logger`, `app-url`, `env/secrets`, `fetch-with-timeout`, `jobs/process-scan`.
- Runtime test harness: local cert vs integrated DB modes; no live SMS.

## Still unverified / not customer-ready alone

- Full **Review Velocity** job execution with **mocked** external review fetch/enrich (would need provider mocks or recorded fixtures).
- **Live** Telnyx/Twilio delivery and inbound webhooks (intentionally not run).
- End-to-end UI flows (Templates/Reviews UI out of scope for this pass).
- Production migration apply sign-off on your staging window (`REVIEWS_RUN_MIGRATE_DEPLOY=1`).

## Bottom line

The Reviews **database layer and core runtime paths are exercised against real PostgreSQL** (local cert + integrated). Mocked SMS recording mode proves the platform sender path without carrier send. **Do not treat static wiring or unit mocks as live delivery.** Complete Velocity execute mocks + your staging migration window before calling the product customer-ready.
