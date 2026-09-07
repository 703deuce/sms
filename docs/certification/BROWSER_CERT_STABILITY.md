# Browser certification — preview-only architecture

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
  npm run cert:appointments-mctb-browser -- --only BATCH-01 --retest
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
