# MCTB scale / resilience benchmarks (safe)

No real Telnyx SMS, calls, or Brevo email. Uses disposable `mctb_worker_smoke` jobs and isolated workspaces.

**Run on Coolify host or staging** with an **isolated** `DATABASE_URL`. Benchmarks that write `jobQueue` rows are **blocked** when `DATABASE_URL` points at production Supabase unless `MCTB_BENCH_ALLOW_PRODUCTION_DB=1`.

```bash
# Read-only production Redis snapshot (safe):
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-scale/redis-stats.ts
# Or from operator laptop with SSH:
bash scripts/mctb-scale/host-production-redis-stats.sh

# Full write suite — staging only:
bash scripts/mctb-scale/run-scale-smoke-suite.sh
```

Environment knobs: `MCTB_BENCH_ENQUEUE_COUNTS`, `MCTB_BENCH_SMS_RATES`, `MCTB_BENCH_REDIS_JOB_COUNTS`, `MCTB_BENCH_ALLOW_PRODUCTION_DB`.

Measured snapshots: `docs/MCTB-SCALE-BENCHMARK-RESULTS.json`.

Report: `docs/MCTB-PRODUCTION-SCALE-RESILIENCE-DURABILITY-REPORT.md`
