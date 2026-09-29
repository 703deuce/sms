# MCTB scale / resilience benchmarks (safe)

No real Telnyx SMS, calls, or Brevo email. Uses disposable `mctb_worker_smoke` jobs and isolated workspaces.

**Run on Coolify host or staging** (low latency to Postgres + Redis). Avoid running large sweeps from Cloud Agent against **production** Redis (shared with live workers).

```bash
bash scripts/mctb-scale/run-scale-smoke-suite.sh
```

Environment knobs: `MCTB_BENCH_ENQUEUE_COUNTS`, `MCTB_BENCH_SMS_RATES`, `MCTB_BENCH_REDIS_JOB_COUNTS`.

Report: `docs/MCTB-PRODUCTION-SCALE-RESILIENCE-DURABILITY-REPORT.md`
