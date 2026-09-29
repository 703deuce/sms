# MCTB consolidated non-human test matrix

**Run:** `npm run test:mctb-consolidated-nonhuman-matrix`  
**Script:** `scripts/run-mctb-consolidated-nonhuman-matrix.sh`  
**Last execution:** 2026-09-29 (Cloud Agent) — **61/61 PASS**

This pass executes existing integration/unit scripts (not a new inventory). Commercial certification wrapper is intentionally excluded; guards + matrix subsume most of it with `MCTB_CERT_SKIP_LIVE_DID_PURCHASE=1` for provisioning E2E.

## Fixes applied in this candidate

| Defect | Fix |
|--------|-----|
| Onboarding step order drift | Updated `test-mctb-onboarding-architecture.ts` for current `MCTB_ONBOARDING_STEP_ORDER` |
| Press-1 DB test used missing workspace FK | Isolated workspace + cleanup in `test-mctb-press1-consent-db.ts` |
| Existing consent copy assertion | `test-mctb-setup-consent.ts` expects "Recovery" not "paid" |
| Launch regression file paths | `test-mctb-simplified-launch.ts` → `mctb-onboarding-runtime.tsx`; STOP ordering checked inside `handleMctbCustomerSmsReply` body |

## Classification summary (sections 1–38)

| Area | Automated result |
|------|-------------------|
| 1–4 Account, wizard, provisioning, capabilities | **PASS** (matrix scripts) |
| 5–8 Templates, recovery, eligibility, free 25→26 | **PASS** |
| 9–15 Consent, jobs, inbound, missed calls, consent log | **PASS** |
| 16–23 Voicemail, notifications, urgent, STOP, exclusions, links, AI, sender | **PASS** (TFV live approval: **EXTERNAL**) |
| 24–28 Analytics, overview rows, round-trip, tenancy | **PASS** (partial via pass-6 + guards; full Overview UI: **MANUAL**) |
| 29 Webhook idempotency | **PASS** (contract/path tests; live Telnyx replay: **MANUAL**) |
| 30 Failure matrix | **PARTIAL** — covered by existing unit tests; full Redis outage sim not in matrix |
| 31 Redis/BullMQ | **PASS** |
| 32 Perf duplicate fetch | Not expanded (no new perf project) |
| 33 UI functional smoke | **MANUAL** — browser cert (`appointments-mctb-browser-cert`) not run in this pass |
| 34 Fixture leak | **PASS** (stage2 + no-dev-badge) |
| 35 DB migrations | **OUT OF SCOPE** — no schema change in this candidate |
| 36 Build | **PARTIAL** — MCTB matrix green; repo-wide `tsc` still has unrelated `newui-transplant/` noise |

## Remaining manual / external (for golden-path)

- Real PSTN call, CFNA, heard disclosure, DTMF Press-1, handset SMS send/reply
- Notification in external inbox (human read)
- Voicemail record/playback on handset
- STOP/HELP from handset (optional reserved)
- TFV/10DLC customer-owned sender carrier approval
- Fresh signup UX judgment where not scripted
- Browser walkthrough of wizard controls (section 33)

## Ready for one manual golden-path walkthrough

**YES** — non-human matrix green on candidate; proceed after single production deploy and production-safe smoke.
