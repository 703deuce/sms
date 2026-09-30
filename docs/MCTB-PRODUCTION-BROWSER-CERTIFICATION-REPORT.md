# MCTB Production Browser Certification — Report

**Date:** 2026-09-30  
**Workspace:** `ws_1` (Blue Ridge Realty)  
**Environment:** Production (`transovo.ai`)

## Production SHA

| Field | Value |
|--------|--------|
| **SHA tested (browser pass)** | `c935c42c537fb5806c10135186c11c513332568b` |
| **Health** | `ok: true` |
| **Latest pushed (post-pass fixes)** | `ae862d56` (cert runner only; re-run browser after deploy optional) |

## Summary

| Metric | Result |
|--------|--------|
| Routes tested | **19 / 19** PASS (HTTP 200, authenticated) |
| Interactive rows (automated pass) | **27** |
| State-changing failures (final run) | **0** |
| **PRODUCTION BROWSER CERTIFIED (automated scope)** | **PARTIAL** — see gaps below |
| **READY FOR PHYSICAL GOLDEN PATH** | **YES** (for controls covered); PSTN/SMS handset proof still required |

## Consent mode (high priority)

| Step | Result |
|------|--------|
| Press-1 → Existing Consent (browser + attest + save) | **PASS** — persisted `existing_consent`, effective `texmlHandlerMode=voicemail`, refresh OK |
| Existing Consent → Press-1 (restore) | **PASS** — persisted `press_1`, effective `texmlHandlerMode=press_1`, refresh OK |
| Original production error | POST `/api/mctb/setup` **500** on existing consent save |
| Root cause | Missing `resolveMctbCapabilities` import in existing-consent eligibility block (`e7d2d8e9`) |
| Retest | **PASS** on production after deploy |

## Defects found and fixed during pass

| Area | Symptom | Fix | SHA |
|------|---------|-----|-----|
| Consent save | 500 on existing consent | Import `resolveMctbCapabilities` in setup route | `e7d2d8e9` |
| Exclusions UI | POST 400 (`phone` vs `phoneE164`) | API accepts `phoneE164`/`label`; client sends `phone` | `d9d12e5b` / `3c8c9e6b` |
| Recovery pause runtime | `pauseUntil` in DB but effective pause false | Parse `pauseUntil` when JSONB stores `Date` object | `c935c42c` |
| Cert runner | False failures on pause / restore | `waitFor` void return; resume-if-paused; pause POST matcher | `ae862d56` |

## Effective runtime (verified via `scripts/mctb-ws1-config-snapshot.ts` after UI actions)

| Setting | Verified |
|---------|----------|
| Consent mode + TeXML branch | Yes (`texmlHandlerMode` press_1 / voicemail) |
| Recovery timed pause | Yes (`recoveryPaused`, `pauseKind=timed`) |
| Exclusions | Yes (create + delete `+15550119999`) |
| Platform template | N/A (workspace sender mode — skipped) |
| Notifications / voicemail / AI / links | **Not in automated pass** — manual expansion required |

## Automated pass coverage

**Included:** route smoke (19), consent round-trip, exclusions CRUD, text-back (platform skip), missed calls search + detail, analytics preset click, recovery pause/resume on Missed-call Recovery → General.

**Not yet exercised in browser (per full spec §1–31):** onboarding wizard field-by-field, notifications CRUD, voicemail greeting publish, setup phone/forwarding edits, compliance log filters, conversations composer, analytics drilldowns, AI recovery, own sender/A2P flows, every modal/tab, mobile reflow pass, cross-tenant probe.

## Final regression (post-fix)

Run after this report:

- `npm run test:mctb-consolidated-nonhuman-matrix`
- `bash scripts/run-mctb-commercial-launch-guards.sh`
- `npm run test:job-queue-lifecycle`

## NOT certified by this pass (external / manual)

- Real carrier CFNA → PSTN call → Press-1 / voicemail → SMS → handset reply
- TFV/10DLC submission and provider approval
- Live forwarding verification call

## Artifacts

- Matrix: `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md`
- Runner: `scripts/mctb-production-browser-cert.ts`
- Verification: `scripts/mctb-ws1-config-snapshot.ts`
- Screenshots: `/tmp/mctb-prod-browser-cert/` (or `MCTB_PROD_CERT_ARTIFACTS`)
