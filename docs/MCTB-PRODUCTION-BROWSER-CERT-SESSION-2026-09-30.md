# MCTB Production Browser Certification — Session Summary (2026-09-30)

Copy everything below this line for handoff.

---

## Workflow agreement (going forward)

1. Run **all** certification suites in a batch first.
2. Collect **every** failure; fix **locally in one pass** (no deploy/push between individual fixes).
3. **Report what’s wrong** before any push to `master`.
4. **One push** with all fixes.
5. Re-run **only failed controls/suites**, not the full matrix.

Do **not**: fix → push → wait for Coolify → retest one control → repeat.

---

## Production vs repository

| Item | Value |
|------|--------|
| **Production `/api/health` commitSha (last checked)** | `74bd0108b7ca641f35122bdfd291d8237e91afdd` |
| **Includes prior browser fixes** | `ae862d56`, `c935c42c`, `e7d2d8e9`, exclusions payload fixes, etc. |
| **`master` after phase 2 + notification fix (may not be deployed yet)** | `443a46c1` (fast-forward merge of `cursor/mctb-browser-cert-continue-f350`) |
| **Workspace** | `ws_1` |
| **Auth** | Production dev-bypass + `POST /api/workspace` → `ws_1` |

**Important:** Browser certification against production was still running image **`74bd0108`** when notifications were re-tested. Notification persistence fixes live in **`443a46c1`** on `master` until Coolify deploys.

---

## Phase 1 (original partial cert — do not redo)

- **19 route loads** (HTTP 200, authenticated)
- **27 interactive rows** PASS (consent round-trip, exclusions CRUD, text-back skip, missed-call search/detail, analytics one preset, recovery pause/resume)
- **Matrix:** `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` (top section, Phase 1 table format)

### Real production defects found and fixed in Phase 1

| # | Area | Symptom | Root cause | Fix commit |
|---|------|---------|------------|------------|
| 1 | Setup → Consent (existing consent) | Save **500** | `resolveMctbCapabilities` not imported in setup route | `e7d2d8e9` |
| 2 | Exclusions add | POST **400** | API expected `phone` vs client `phoneE164` mismatch | `d9d12e5b` / `3c8c9e6b` |
| 3 | Recovery pause | UI saved; runtime ignored pause | `pauseUntil` in JSONB sometimes `Date`, reader only accepted string | `c935c42c` |
| 4 | Cert runner | False pause/resume failures | Runner timing/selectors | `ae862d56` |

**Interim report:** `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-REPORT.md` (describes Phase 1 only; outdated on coverage counts).

---

## Phase 2 (continuation — expand UI coverage)

**Goal:** Expand from 27 interactions to live DOM manifest + explicit flows (notifications, voicemail, onboarding, conversations, analytics, AI recovery, own sender, mobile, etc.) without redoing Phase 1 PASS rows.

**Runner:** `scripts/mctb-production-browser-cert-continue.ts`  
**Shared libs:** `scripts/mctb-browser-cert/` (`matrix.ts`, `auth.ts`, `snapshot.ts`, `discover.ts`)  
**Backend verify (read-only):** `scripts/mctb-ws1-config-snapshot.ts` (extended with `handoff.recipientCount`, `certRecipientPresent`, `emergencyDetectionEnabled`)

**Matrix:** Same file, section **“Phase 2 — full UI control manifest”** with columns:

`| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |`

### Phase 2 run results (full continue pass)

| Metric | Value |
|--------|--------|
| Production SHA at phase 2 start | `74bd0108` |
| New rows appended (phase 2) | **~1530** |
| Routes in manifest loop | **28** |
| Suite exit | **2 failures** (notifications persistence) |
| Artifacts | `/tmp/mctb-prod-browser-cert-phase2/`, summary `phase2-summary.json` |

**Included in phase 2 (high level):**

- Overview CTA link clicks
- Onboarding wizard (Back / Continue observe)
- Setup notifications, voicemail setup, phone/copy, missed-call filters, conversations search/thread, voicemail inbox, consent log search, analytics all presets + KPI drilldown (navigate href), recovery/links/AI recovery/own sender/numbers, validation on links, mobile viewport on major routes
- Per-route **live DOM enumeration** (tabs opened, interactives listed; disabled/destructive/safe-boundary labeled)

**Flags:**

- `--only-notifications` — notifications tests only, skips manifest loop
- `--skip-manifest` — skip DOM sweep (used with targeted retries)

---

## Open failure: Notifications CRUD (production image `74bd0108`)

**Matrix rows (FAIL):**

- `Setup Notifications` → **Add recipient** — UI row visible; backend `recipientCount=0`, `certPresent=false`
- **Add recipient refresh** — row missing after reload; persistence FAIL

**Test recipient used:** `mctb-browser-cert@transovo.test` / `+15550118877` / name “MCTB Cert Temp”

### Root cause (fixed in code on `master`, not verified on prod until deploy)

1. **Fake client ID:** `onAddRecipient` used `id: \`new-${Date.now()}\``. Server treated it as an update to an existing id → no row created in `mctb_notification_recipients`.
2. **Silent save skip:** `useMctbNotificationsWiring().save()` returned early when `config` was null, so recipients never POSTed.

### Fix (commit `443a46c1` on `master`)

- `src/newui-transplant/connected/mctb/setup-pages.tsx` — new recipients **without** fake `id`
- `src/newui-transplant/connected/mctb/setup-wiring-hooks.ts` — POST `{ recipients }` even when `config` is not loaded yet

**Retest after deploy:**  
`MCTB_PROD_CERT_BASE_URL=<prod> MCTB_PROD_CERT_EMAIL=<admin> NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-production-browser-cert-continue.ts --only-notifications`

---

## Stale matrix row (not an open bug)

- Early analytics row: **FAIL** “KPI drilldown link” via **click** (stayed on analytics URL).
- Later phase 2 row: **PASS** via **`page.goto(href)`** to `/mctb/missed-calls`.
- Treat the FAIL line as superseded by the PASS line.

---

## Batch non-browser suites (same session)

| Command | Result |
|---------|--------|
| `bash scripts/run-mctb-commercial-launch-guards.sh` | **PASS** |
| `npm run test:job-queue-lifecycle` | **PASS** |
| `MCTB_PROD_CERT_BASE_URL=… npx tsx scripts/mctb-production-browser-cert-continue.ts --only-notifications` on prod `74bd0108` | **FAIL** (2 rows — notifications) |

**Batch helper (local):** `scripts/mctb-production-cert-batch.sh` — requires `MCTB_PROD_CERT_BASE_URL`; runs notifications-only browser + guards + job queue. Not necessarily on `master` if commit was feature-branch only after workflow change.

---

## Git / branches

| Branch / commit | Notes |
|-----------------|--------|
| `master` @ `74bd0108` | Docs + phase 1 cert matrix; prod was here during most browser work |
| `master` @ `443a46c1` | Notification fix + phase 2 harness + large matrix append (merged from `cursor/mctb-browser-cert-continue-f350`) |
| `cursor/mctb-browser-cert-continue-f350` | Feature branch; batch script tweaks may exist locally without another `master` push |

---

## Key file paths

| Purpose | Path |
|---------|------|
| Certification matrix | `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` |
| Phase 1 interim report | `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-REPORT.md` |
| Phase 1 runner | `scripts/mctb-production-browser-cert.ts` |
| Phase 2 continuation | `scripts/mctb-production-browser-cert-continue.ts` |
| WS1 DB snapshot | `scripts/mctb-ws1-config-snapshot.ts` |
| This session summary | `docs/MCTB-PRODUCTION-BROWSER-CERT-SESSION-2026-09-30.md` |

---

## Certification status (honest)

| Question | Answer |
|----------|--------|
| Phase 1 automated scope | **PASS** (27 rows) — real clicks on those flows only |
| Phase 2 “manifest” rows (~1487× `PASS — UI (manifest)`) | **NOT full button coverage** — DOM listed, **not** every control clicked |
| Phase 3 live exercise | **Required** — runner `scripts/mctb-production-browser-cert-exercise-all.ts` → matrix `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-EXERCISE.md` |
| Notifications persistence | **FAIL** on prod `74bd0108`; fix on `master` `443a46c1` pending deploy + retest |
| `remaining browser-testable controls = 0` | **No** until Phase 3 exercise matrix is complete with no FAIL rows |
| Ready for physical golden path | **Not yet** — finish **live** browser exercise on deployed SHA first |

---

## Recommended next steps

1. Confirm production `/api/health` → **`443a46c1`** (or later).
2. Run **`--only-notifications`** only; expect PASS if fix is live.
3. Update matrix FAIL rows to PASS or append retest rows; remove or annotate stale analytics FAIL.
4. Run full batch script once more if desired; then physical golden path when browser-testable controls = 0.

---

## SHA transition log (certification)

| When | SHA | Event |
|------|-----|--------|
| Phase 1 browser pass | `c935c42c` | Consent, exclusions, pause fixes verified |
| Phase 2 start / most browser work | `74bd0108` | Prod image during manifest + notifications FAIL |
| `master` merge (notification fix) | `443a46c1` | Code fix pushed; **deploy may lag** |

---

End of copyable summary.
