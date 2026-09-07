# Appointments + MCTB Certification Results

**Updated:** 2026-09-07T22:36:00.000Z (targeted reconciliation pass — no full 31-batch rerun)  
**Authority:** docs/APPOINTMENTS-MCTB-FULL-FEATURE-SETTINGS-INVENTORY.md  
**Reconciliation log:** `docs/certification/appointments-mctb-certification-state.json` → `reconciliation[]`  
**Behavioral gaps:** `docs/certification/APPOINTMENTS-MCTB-BEHAVIORAL-RECONCILIATION.md`

## Summary (current code)

| Status | Count | Notes |
|--------|-------|-------|
| PASS | 44 | Includes reconciled post-first-run fixes |
| FAIL | 0 | All locally resolvable failures addressed |
| BLOCKED — PSTN | 1 | `AP-WORKFLOWS-minutes-live` only |
| DEFECT — MISSING UI | 0 | `/mctb/setup/links` implemented |

First full run (2026-09-07 ~21:46 UTC): 30 PASS · 6 FAIL · 1 BLOCKED · 1 DEFECT.  
This pass reran **only** failed/blocked matrix batches via `scripts/reconcile-appointments-mctb-cert.ts`.

## PASS (automated matrix batches)

All original passing batches remain PASS (STATIC, TSC, APT-ENG, APT-WF-01/02, APT-VR, APT-PAY, APT-PUB, APT-MTG, MCTB-FILTER, MCTB-INBOX, MCTB-VM-001, MCTB-HO, MCTB-RT-01–05, etc.)

### Reconciled from FAIL → PASS

| Matrix ID | Original | Fix | Retest |
|-----------|----------|-----|--------|
| AP-AI-BOOKING-* | FAIL | `understand-fallback.ts` BOOK intent | `test-appointment-ai-hardening.ts` |
| AP-OWNER-AMY-* | FAIL | OpenAI default model assertions | same |
| AP-WRITE-VERIFIER-* | FAIL | same batch | same |
| AP-BOOKING-AGENT-* | FAIL | Owner Amy defaults | `test-appointment-booking-agent-layer.ts` |
| X-PRODUCT-* | FAIL | Split from booking-agent batch; hermetic handoff checks | `test-mctb-cross-product-booking.ts` |
| AP-WORKFLOWS-minutes | BLOCKED (whole batch) | **Reclassified** — local scheduling only | `test-appointment-workflow-minutes-scheduling.ts` |
| MCTB-RT-007 | FAIL | Restored `isPlatformDemoNumber()` | `test-mctb-tfv-gates.ts` |
| MCTB-RT-engine | FAIL | TeXML-first ingress tests (not legacy SIP sync) | `test-mctb-engine-matrix.ts` |
| AI-MCTB-001 | FAIL | 9/9 john-preprod gates | `npm run test:john-preprod` |
| AI-MCTB-002 | FAIL | eligibility + scheduling fixture | same |
| AI-MCTB-003 | FAIL | owner control min-delay clamp + LLM fallback | same |
| AI-VM-001 | FAIL | Correct script mapping | `test-mctb-voicemail-ai-hermetic.ts` |
| AI-VM-002 | FAIL | Degraded finalize path | same |
| AI-TRANSCRIPTION-CATALOG | FAIL | V1 defers purchasability; catalog tiers still valid | `npm run test:ai-transcription` |
| MCTB-DEFECT-SETUP-LINKS | DEFECT | Implemented `/mctb/setup/links` | `test-mctb-setup-links.ts` |

## BLOCKED — PSTN

| Matrix ID | Reason | Exact dependency |
|-----------|--------|------------------|
| AP-WORKFLOWS-minutes-live | Live workflow SMS after booking | `scripts/test-appointment-workflow-minutes.ts:26` — `TEST_PHONE` E.164 required |

**Not blocked:** minute scheduling math (0/1/3/5 min after booking) — certified locally in `APT-WF-03`.

## AP-WORKFLOWS-minutes investigation (resolved)

The original `APT-WF-03` batch was incorrectly blocked in full. The script name suggests timing work, but `test-appointment-workflow-minutes.ts` is an **integration smoke** that books a real appointment and dispatches SMS steps. Deterministic scheduling is now `test-appointment-workflow-minutes-scheduling.ts` (PASS). Only provider SMS delivery remains PSTN-blocked.

## AI-MCTB per-ID (independent)

| ID | Gate | Status |
|----|------|--------|
| AI-MCTB-001 | JOHN_LLM — extraction, customer LLM, runtime turn | PASS |
| AI-MCTB-002 | ELIGIBILITY + SCHEDULING — process/dedupe | PASS |
| AI-MCTB-003 | OWNER_CONTROL + CUSTOMER_CONVERSATION | PASS |

## AI-VM per-ID (independent)

| ID | Focus | Status |
|----|-------|--------|
| AI-VM-001 | Transcript/summary lifecycle trace parsing | PASS |
| AI-VM-002 | Degraded finalize — recording evidence preserved | PASS |

## Product changes this pass

- **`/mctb/setup/links`** — request form, default `{{link}}`, lead capture, copy/preview, save/reload
- **`isPlatformDemoNumber`** — trial gate demo-number rejection restored
- **MCTB engine matrix** — TeXML ingress assertions replace obsolete SIP sync checks
- **john-preprod** — `require_carrier_forward: false` in fixture; immediate delay respects 5s minimum clamp

## Matrix coverage

Total matrix cases: **300**  
Automated batch-mapped cases: **46** (after split/reclassify)  
UI-deferred cases: separate browser pass per inventory

## Browser certification (preview-only)

**Architecture:** `docs/certification/BROWSER_CERT_STABILITY.md`

Local `next dev` + Turbopack OOM on the Cloud Agent VM (~13–14 GB RSS) invalidated the first localhost run. Those cascade failures are reclassified as `INVALID RESULT — LOCAL CERT SERVER OOM` — **not product defects**.

**Hard rule:** Browser cert runs only against a deployed Coolify preview/staging URL (`BROWSER_CERT_BASE_URL` + matching `BROWSER_CERT_DEPLOY_SHA`). The Cloud Agent runs Chromium + the test runner only.

**Current browser state:** `docs/certification/appointments-mctb-browser-cert-state.json`  
**Results:** `docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md`

| Status | Count (after OOM reclassify) |
|--------|------------------------------|
| PASS | 89 |
| INVALID RESULT — LOCAL CERT SERVER OOM | 75 |
| FAIL | 9 (pre-OOM localhost — review on preview rerun) |
| BLOCKED (live PSTN/media/provider) | 6 |
| NOT IMPLEMENTED / DEFERRED | 5 |

**Next step:** Deploy this branch to Coolify preview, set env vars, run `npm run cert:appointments-mctb-browser:preflight`, then batches `BATCH-01` … `BATCH-14` with `--retest` / `--fresh`.
