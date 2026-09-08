# Browser certification — disposable-browser + preview-only

## Configuration (no env vars for non-secrets)

| What | Where |
|------|--------|
| Preview/staging URL | `scripts/browser-cert/browser-cert.config.ts` → `previewBaseUrl` |
| Cert test email | `browser-cert.config.ts` → `certEmail` |
| Timeouts, pauses, circuit breakers | `browser-cert.config.ts` |
| Deploy SHA | **Auto** — `/api/health` on preview vs `git rev-parse HEAD` |
| Cert password | **Secret** — `CERT_BROWSER_PASSWORD` env var only |

Update `previewBaseUrl` once for your Coolify deployment. No `BROWSER_CERT_BASE_URL` or `BROWSER_CERT_DEPLOY_SHA` required.

### Coolify deploy requirement

Staging must expose `commitSha` on `GET /api/health` (from `SOURCE_COMMIT` or `GIT_COMMIT` at build time). Browser cert refuses to run if preview SHA ≠ local git HEAD.

## Architecture (Layer 2)

1. **Preview URL only** — never local `next dev` / Turbopack on the Cloud Agent VM.
2. **One headless Chromium per flow** — 189 reachability + 12 user-action (BATCH-UA); browser killed after each.
3. **Checkpoint after every flow ID** — resume from `flowsCompleted`.
4. **Circuit breakers:**
   - 2× server unreachable → `BLOCKED — TEST ENVIRONMENT UNAVAILABLE`
   - 2× Chromium crash → `BLOCKED — BROWSER PHASE STOPPED`

No video, no trace, no headed mode, no parallel workers, no navigation retries.

## Run

```bash
# Only secret required
export CERT_BROWSER_PASSWORD='your-cert-account-password'

npm run cert:appointments-mctb-browser:preflight
npm run cert:appointments-mctb-browser -- --fresh
npm run cert:appointments-mctb-browser -- --only BATCH-01
npm run cert:appointments-mctb-browser -- --limit 30
```

## Provenance

Written to `docs/certification/appointments-mctb-browser-cert-provenance.json`:

- Local git HEAD
- Deployed commit from preview `/api/health`
- Certification start time
- Preview base URL from config

Cert **aborts** if local HEAD ≠ preview `commitSha`.

## Final certification rule

Prior localhost PASS results are **not** valid for go-live. Provenance reconcile clears them on first preview run when URL/SHA changes.

## Batches

15 batches · 201 flows (189 reachability + 12 user-action) — see `scripts/browser-cert/flows.ts`

### User-action acceptance

Route/render PASS alone is **not** full frontend certification. See:

- `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md`
- `docs/certification/BROWSER_FLOW_CLASSIFICATION_AUDIT.md`
- `npm run cert:audit-browser-flow-classification`

Run user-action batch only: `npm run cert:appointments-mctb-browser -- --only BATCH-UA`

State: `docs/certification/appointments-mctb-browser-cert-state.json`
