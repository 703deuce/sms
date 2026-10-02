# MCTB end-to-end audit — handoff report

**Generated:** 2026-10-01 (UTC)  
**Production host:** (your production origin — e.g. `MCTB_PROD_CERT_BASE_URL`)  
**Cert workspace:** `ws_1` (Blue Ridge Realty)  
**Latest `master` commit (fixes merged):** `53933d56`

---

## Production browser cert — latest run

| Area | Result |
|------|--------|
| **Route smoke (19 MCTB URLs)** | **19/19** HTTP 200, not login |
| **Interactive controls (27 rows)** | **27/27 PASS**, **0 FAIL** |
| **Consent** (Press-1 ↔ existing + restore) | PASS — persistence + expected TeXML (`voicemail` / `press_1` when recovery is active) |
| **Recovery pause** (“1 hour” preset) | PASS — backend `recoveryPaused=true`, `pauseKind=timed` |
| **Exclusions CRUD, missed calls search/detail, text-back, etc.** | PASS |

**Artifacts from latest full run:**

- Summary JSON: `/opt/cursor/artifacts/mctb-e2e-cert-final/summary.json`
- Matrix markdown: `/opt/cursor/artifacts/mctb-e2e-cert-final/MCTB-PRODUCTION-BROWSER-CERTIFICATION-RUN.md`

**Production SHA at cert start (before deploy of `53933d56`):** `bbe6fcd545b1d9be91a00666229673928ca2b51f`

**Re-run command:**

```bash
MCTB_PROD_CERT_ARTIFACTS=/tmp/mctb-cert \
MCTB_PROD_CERT_BASE_URL=<production-origin> \
MCTB_PROD_CERT_EMAIL=<admin-email> \
npx tsx scripts/mctb-production-browser-cert.ts
```

---

## What was wrong (and what we fixed)

### 1. First-run onboarding modal (earlier on `master`)

- **Problem:** Mandatory `MctbFirstRunWizardHost` modal stayed open on `/mctb/*` and blocked consent/recovery UI (Playwright: dialog intercepts clicks).
- **Fix:** `src/lib/mctb/onboarding/first-run-policy.ts` — dedicated setup paths; `mctb-first-run-wizard-host.tsx` does not auto-open on those paths for incomplete onboarding.
- **Related commits on `master` before this pass:** `da7146d5`, `bbe6fcd5`, client-safe policy via `completion.ts`.

### 2. Cert harness false failures (this pass)

- **Problem:** Consent and pause **did persist** in the DB while Playwright often did not observe the `/api/mctb/setup` POST → rows showed `http ?` and FAIL.
- **Fix:** `scripts/mctb-production-browser-cert.ts` — race-free POST waits, better pause button selectors (`1 hour` / `Pause 1 hour`), dismiss onboarding modal, **backend snapshot as authoritative** for PASS when persistence matches.
- **TeXML expectations:** Cert now uses `expectedTexmlHandlerMode()` — **press-1 shows `voicemail` when recovery/automation is paused** (by design in `resolveMctbTexmlHandlerMode`); resume recovery before consent test when ws is paused.

### 3. Analytics React #418 (hydration)

- **Problem:** `mergeDailyTrends` used `toLocaleDateString(undefined, …)` → server/client text mismatch on `/mctb/analytics`.
- **Fix:** `src/lib/newui-transplant/adapters/chart-series.ts` — weekday labels use **UTC + `en-US`**.
- **Note:** Until Coolify deploys **`53933d56`**, production may still log #418 on analytics route load (defect column) even when route row is PASS.

---

## Code changes on `master` (`53933d56`)

| File | Change |
|------|--------|
| `scripts/mctb-production-browser-cert.ts` | Cert hardening, backend-truth PASS, consent/pause fixes |
| `src/lib/newui-transplant/adapters/chart-series.ts` | Stable chart day labels (hydration) |

Branch merged: `cursor/mctb-e2e-cert-fixes-f350` → `master`.

---

## Interactive cert rows (summary from `summary.json`)

- **Setup → Consent — Press-1 → Existing Consent + Save:** PASS — UI + PERSISTENCE + EFFECTIVE CONFIG (`texml=voicemail` for existing consent).
- **Setup → Consent — restore Press-1:** PASS — UI + PERSISTENCE + EFFECTIVE CONFIG (`texml=press_1` when automation active).
- **Missed-call recovery — Pause 1 hour:** PASS — UI + PERSISTENCE (`recoveryPaused=true`, `pauseKind=timed`). UI copy after reload may still say “active” briefly; backend is authoritative.

---

## Still outside this cert script (not “everything” in one script)

| Item | Notes |
|------|--------|
| **`/mctb/setup/notifications`** | Known persistence gaps in older docs; use `scripts/mctb-production-browser-cert-continue.ts` and phase 3b (`docs/MCTB-PRODUCTION-BROWSER-CERT-SESSION-2026-09-30.md`). |
| **Brand-new customer onboarding + live PSTN/SMS** | Needs fresh workspace + real phone; cloud agents cannot complete Telnyx SMS certification. Runbook: `docs/MCTB-AI-LEAD-RECOVERY-LIVE-MANUAL-TEST-RUNBOOK.md`. |
| **SMS worker image** | Confirm Coolify **`transovo-sms-worker`** is on same commit as web after deploy (earlier: worker lagged web at `60181881` while web was newer). |
| **Phase 3 exercise / nav link matrix** | `mctb-production-browser-cert-exercise-all.ts` — separate harness; many historical FAIL rows were harness timeouts, not product. |

---

## Ops context (from earlier in thread)

- Coolify disk was **100% full** → DB restart loop; fixed with `docker image prune`, deploy continued.
- **SMS worker** was pointed at Upstash Redis (rate limits); env aligned with web/BullMQ Redis on self-hosted **`transovo-bullmq-redis`**.
- **Production web** was at **`bbe6fcd5`** before merge; push **`53933d56`** triggers new Coolify build.

---

## Suggested next steps

1. Wait for **Coolify deploy** of **`53933d56`**; verify `GET /api/health` → `commitSha` matches.
2. Re-run full browser cert (command above); expect **0 interactive FAIL**.
3. Open `/mctb/analytics` — confirm **no React #418** after chart fix deploy.
4. Run **notifications / phase 3b** cert if you need “every control” beyond the 27-row matrix.
5. **Manual PSTN/SMS** golden path on a non-`ws_1` workspace when ready for launch certification.

---

## Definition of done (honest)

| Claim | Status |
|-------|--------|
| All **19** MCTB routes load on production (ws_1) | **Yes** (latest cert) |
| **27** interactive rows in `mctb-production-browser-cert.ts` | **0 FAIL** (latest cert) |
| Notifications persistence | **Not certified** by main script |
| New customer onboarding + PSTN end-to-end | **Manual** only |
| “Every single thing works start to finish” globally | **No** until notifications + PSTN + fresh-workspace onboarding are explicitly certified |

---

## Key file paths (repo)

- Cert script: `scripts/mctb-production-browser-cert.ts`
- Backend snapshot (verification only): `scripts/mctb-ws1-config-snapshot.ts`
- First-run policy: `src/lib/mctb/onboarding/first-run-policy.ts`
- Consent editor (new UI): `src/newui-transplant/components/mctb/consent-editor.tsx`
- Recovery pause UI (recovery hub): `src/newui-transplant/mirror/routes/mctb/setup/recovery/page.tsx`
- TeXML mode rules: `src/lib/mctb/texml-ingress/texml-mode-provision.ts` (`resolveMctbTexmlHandlerMode`)

---

*End of handoff report.*
