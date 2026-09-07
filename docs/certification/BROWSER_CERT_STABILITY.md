# Browser certification — disposable-browser + preview-only

## Architecture (Layer 2)

1. **Preview/staging URL only** — Cloud Agent never starts Next.js or Turbopack.
2. **One headless Chromium per flow** — launch → 3–5 UI actions → record → kill browser → wait → next flow.
3. **Checkpoint after every flow ID** — resume automatically from `flowsCompleted`.
4. **Circuit breakers:**
   - 2 consecutive server-unreachable errors → `BLOCKED — TEST ENVIRONMENT UNAVAILABLE`
   - 2 consecutive browser process crashes → `BLOCKED — BROWSER PHASE STOPPED`

No video, no trace, no headed mode, no parallel workers, no navigation retries.

## Root cause (confirmed)

Local `next dev` + Turbopack on the Cloud Agent VM accumulated ~13–14 GB RSS, was **OOM-killed**, and the browser runner continued against a dead server — producing hundreds of **false** `ERR_CONNECTION_REFUSED` / `ERR_CONNECTION_RESET` failures.

**This is not a product defect.** Those results are reclassified as `INVALID RESULT — LOCAL CERT SERVER OOM`.

## Hard rule

Browser certification **must not** start:

- `npm run dev`
- `next dev`
- Turbopack locally
- `next start` on the Cloud Agent VM
- any local application server

The Cloud Agent runs **Chromium + the cert runner only**.

The application runs on **Coolify preview/staging** at a stable URL.

## Required environment

```bash
export BROWSER_CERT_BASE_URL=https://your-preview.example.com   # NOT localhost
export BROWSER_CERT_DEPLOY_SHA=$(git rev-parse HEAD)            # must match deployed commit
export CERT_BROWSER_EMAIL=appt-mctb-browser@transovo.test       # user exists on preview DB
export CERT_BROWSER_PASSWORD=...                                 # or use preview auth flow
```

Optional:

```bash
export BROWSER_CERT_NAV_TIMEOUT_MS=60000   # heavy pages on preview
```

## Run one batch at a time

```bash
# Preflight (no browser — checks URL, SHA, health)
npm run cert:appointments-mctb-browser:preflight

BROWSER_CERT_BASE_URL=https://preview.example.com \
BROWSER_CERT_DEPLOY_SHA=$(git rev-parse HEAD) \
  npm run cert:appointments-mctb-browser -- --only BATCH-01

# Single flow
npm run cert:appointments-mctb-browser -- --flow APT-01-contacts

# Cap flows per invocation (useful for agent runs)
npm run cert:appointments-mctb-browser -- --limit 20
```

Or pass `--preflight` to the main runner:

```bash
BROWSER_CERT_BASE_URL=... BROWSER_CERT_DEPLOY_SHA=... \
  npm run cert:appointments-mctb-browser -- --preflight
```

## Provenance (recorded automatically)

Written to `docs/certification/appointments-mctb-browser-cert-provenance.json`:

- Git commit SHA under test
- Deployed commit SHA (`BROWSER_CERT_DEPLOY_SHA`)
- Certification start time
- Base URL

Cert **aborts** if git SHA ≠ deploy SHA.

## Final certification rule (same SHA)

**Do not treat prior PASS results as sufficient for go-live** unless they were recorded against the **same deploy SHA and preview base URL** you are certifying.

- The 89 localhost pre-OOM PASS results are **not** carried forward when you switch to preview — the runner clears them automatically.
- The 75 `INVALID RESULT — LOCAL CERT SERVER OOM` and 9 pre-OOM FAILs must be **rerun on preview**.
- `BLOCKED — LIVE PSTN/MEDIA` cases are preserved (they require live provider smoke, not preview UI).

On first preview run after localhost, you do **not** need `--fresh` — provenance reconcile clears stale results when `BROWSER_CERT_BASE_URL` or `BROWSER_CERT_DEPLOY_SHA` changes.

## Preview first-run checklist

1. Deploy commit `80dc8ea2` (or current HEAD) to Coolify preview/staging.
2. Seed cert user on preview DB: `npm run seed:appointments-mctb-browser-cert` (on preview host or against preview `DATABASE_URL`).
3. Set env: `BROWSER_CERT_BASE_URL`, `BROWSER_CERT_DEPLOY_SHA`, `CERT_BROWSER_EMAIL`, `CERT_BROWSER_PASSWORD`.
4. Preflight: `npm run cert:appointments-mctb-browser:preflight`
5. Run full matrix: batches `BATCH-01` … `BATCH-14` (checkpoint after each batch).

```bash
BROWSER_CERT_BASE_URL=https://preview.example.com \
BROWSER_CERT_DEPLOY_SHA=80dc8ea2 \
  npm run cert:appointments-mctb-browser -- --only BATCH-01
```

Repeat `--only BATCH-02` … `BATCH-14`, or run without `--only` for sequential execution.

## Server health circuit breaker

Before each batch:

1. `GET /api/health` (fallback `/`)
2. If unreachable → **abort batch** as `BLOCKED — TEST ENVIRONMENT UNAVAILABLE`
3. Do **not** record product FAILs

During a batch:

- **2 consecutive** `ERR_CONNECTION_REFUSED` / `ERR_CONNECTION_RESET` → stop immediately
- Same classification: `BLOCKED — TEST ENVIRONMENT UNAVAILABLE`

## Reclassify invalid local-OOM results

```bash
npm run cert:reclassify-browser-oom
```

## Batches

| Batch | Scope |
|-------|--------|
| BATCH-01 | Appointments nav + Home |
| BATCH-02 | Calendar + create |
| BATCH-03 | Booking types + availability |
| BATCH-04 | Public booking |
| BATCH-05 | Reminders + workflows |
| BATCH-06 | AI Booking |
| BATCH-07 | Meetings + Notetaker |
| BATCH-08 | MCTB nav + Home |
| BATCH-09 | Missed Calls + Conversations |
| BATCH-10 | MCTB Setup |
| BATCH-11 | Notifications & Handoff |
| BATCH-12 | Voicemail + Analytics |
| BATCH-13 | Cross-product |
| BATCH-14 | Remaining Appointments IDs |

State: `docs/certification/appointments-mctb-browser-cert-state.json`
