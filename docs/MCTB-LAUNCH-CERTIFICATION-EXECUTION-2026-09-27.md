# MCTB launch certification execution — 2026-09-27

**Branch:** `cursor/mctb-critical-path-perf-2304`  
**Workspace used for timings:** `ws_1`  
**Executor:** Cloud agent (automated + documented manual gaps)

---

## Verdict (honest)

| Layer | Status |
|-------|--------|
| **Code / automated pre-checks** | **PASS** (MCTB matrix suite + V1 API products + Stage 2 Opus + route timing) |
| **Certified TeXML pipeline (`verify:mctb-final-pipeline`)** | **PASS** when targeting workspace ingress `+18666020680` (production `cert=D`); earlier **FAIL** was stale verifier defaulting to historical `+18663464256` + `cert=C3` probe — corrected on `cursor/mctb-critical-path-perf-2304` |
| **Launch matrix `LIVE_VERIFIED`** | **0 / 75** |
| **Manual human passes (phone, carrier, Stripe)** | **NOT DONE** — 24 matrix rows |
| **Overall MCTB launch** | **NOT READY** until Pass 1–4 live evidence is recorded |

Performance work is **frozen** (0 customer-visible route FAILs ≥2s on `ws_1`). This run is **functional launch certification**, not another perf pass.

---

## Automated results (this run)

| Command | Result |
|---------|--------|
| `npm run verify:mctb-stage2-presentation` | **PASS** — PURE_OPUS, all zeros |
| `npx tsx scripts/mctb-launch-readiness-matrix.ts --run-tests` | **PASS** — TFV gates, onboarding arch, production phases, consent prompt |
| `npm run test:v1-api-products` | **PASS** — 34/34 |
| `WORKSPACE_ID=ws_1 npm run verify:mctb-route-timing-matrix` | **PASS** — 0 customer-visible FAILs (4 WARN: home/enrichment ~888ms, config GET ~892ms, consent ~1.1s) |
| `npm run verify:mctb-final-pipeline` | **FAIL** — see JSON in artifact log (routing mode, TeXML gather/consent on +18663464256) |
| `npm run test:v1-production-readiness` | **FAIL** — `tsc --noEmit` errors in `src/newui-transplant/mirror/*` (repo-wide, not MCTB-specific) |

Full console log: `/opt/cursor/artifacts/mctb-launch-cert-log.txt` (partial) + matrix re-run above.

### Launch readiness matrix summary

- **IMPLEMENTED:** 33  
- **AUTOMATED_TEST_PASSED:** 18  
- **LIVE_VERIFIED:** 0  
- **MANUAL_HUMAN_TEST_REQUIRED:** 24  

---

## Manual certification — execution order (you run on phone + production)

Use: `npx tsx scripts/mctb-certification-runbook.ts` (full checklists per pass).

### Pass 1 — Twilio / TFV (matrix A-02, A-05, A-06, B-01, B-02)

1. Fresh Google signup → MCTB plan → **one** TFN in Twilio console (no double-buy on refresh).  
2. Submit TFV from Transovo → field-by-field match Twilio record (Press-1 vs Existing Consent copy).  
3. Confirm TFV status webhooks reach Transovo → **APPROVED** without DB edits.  
4. Optional: 10 parallel fresh workspaces — no number collision.

### Pass 2 — Call path / CFNA / ANI (C-06, D-01, D-02, T-04)

1. Run `mctb-cert-prep-telnyx-platform-voice.ts --apply` if using platform 571 line.  
2. **Conditional forward** business line → platform ingress; timer beats voicemail.  
3. Record **ANI** = original caller (carrier sheet in runbook `--sheet`).  
4. Answered call → **no** MCTB SMS.  
5. Expired trial → forwarded call does not trap caller.

### Pass 3 — Messaging (CP-11–17, E-01, E-03, F-03, M-03, M-04, X-05)

1. **Press-1:** missed call → published consent audio → DTMF 1 → compliance SMS → recovery SMS.  
2. **Existing consent:** missed call → SMS without Press-1 (second workspace).  
3. Reply → conversation updates in `/mctb/conversations`.  
4. **STOP** → next recovery suppressed; **START** re-enables.  
5. Idempotency: double Press-1 → one consent + one recovery attempt.

### Pass 4 — Billing / fresh signup (S-01, T-06, UI-02)

1. Trial limits (100 SMS segments) enforced in UI + send path.  
2. Stripe checkout → entitlement active → same TFN/TFV/forwarding retained.  
3. **UI-02:** full browser path signup → paid with **no DB hacks**.

### Dashboard evidence (after live smokes)

- `/mctb` KPIs match missed calls / conversations.  
- Consent log entries for Press-1 captures.  
- A2P/TFV states honest (no send before approval).  
- Tenant isolation: workspace A cannot see B.

---

## Production pipeline gate (`verify:mctb-final-pipeline`)

This run failed because **+18663464256** in the connected DB is not on the certified `mctb_texml_final_v1` TeXML (wrong connection app / TeXML body). **Fix on production** (ingress routing profile, MCTB TeXML app, press-1 gather) then re-run:

```bash
npm run verify:mctb-final-pipeline
```

Do not treat MCTB telephony as launch-ready until this is **green on the live ingress DID**.

---

## What Cursor cannot complete

- Real PSTN calls, carrier CFNA, DTMF  
- Inbound/outbound SMS on your handset  
- Twilio/Stripe console approval and live webhook delivery  
- Production DNS / Coolify deploy verification (push + monitor per `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`)  
- Browser walkthrough of every lifecycle state (UI-01)

---

## Recommended next action for the team

1. **Deploy** `cursor/mctb-critical-path-perf-2304` to staging/production when ready (not done in this agent run).  
2. Execute **Pass 1 → 4** in order; mark rows `LIVE_VERIFIED` in `scripts/mctb-certification-results.json`.  
3. Re-run `verify:mctb-final-pipeline` on production ingress.  
4. Fix or exclude `tsc` mirror path errors before treating `test:v1-production-readiness` as green.

---

## Performance baseline (frozen — ws_1)

Customer-visible server reads: **no FAIL ≥2s**. See `docs/MCTB-ROUTE-TIMING-MATRIX.md`.
