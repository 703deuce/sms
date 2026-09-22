# MCTB marketing / legal bundle — restoration inspection report

**Date:** 2026-09-22  
**Scope:** Inspection only — no merge to `master`, no re-cherry-pick, no local build in this pass.  
**Sources:** `git fetch`, GitHub PR metadata, static diff and content review.

---

## Executive summary

The safe restoration artifact is **draft PR #476** on branch **`cursor/mctb-marketing-legal-ship-2304`**. It is **exactly current `origin/master` plus four cherry-picked commits** that restore the known bundle (~16 files). Do **not** merge `cursor/opt-in-docs-carrier-legal-2304` wholesale (~42 unrelated commits). Do **not** recreate pages from memory.

**Final candidate SHA:** `21f3f6f3f976a74bf40eebc9e148515daa5de470`

**PR:** https://github.com/703deuce/sms/pull/476 (OPEN, draft, MERGEABLE)

---

## Known original bundle (git history)

Four commits (content intent):

| Order | Commit     | Role |
|-------|------------|------|
| 1 | `fe7e2b35` | MCTB homepage at `/`, Appointments marketing at `/appointments` |
| 2 | `5957a7f0` | Drop accidental scripts from marketing commit |
| 3 | `a575de8e` | `/opt-in-documentation`, privacy/terms carrier SMS policy |
| 4 | `e54cba87` | Diagram asset in landing components + copy trim |

Together: **~16 files** vs master at time of bundle — MCTB public homepage, appointments marketing relocation, carrier opt-in documentation, updated privacy and terms.

**Broad branch to avoid:** `cursor/opt-in-docs-carrier-legal-2304` (includes ~42 unrelated commits: Voice V3, Google, spam, etc.).

---

## STEP 1 — Starting state

| Item | Value |
|------|--------|
| **Starting `origin/master` SHA** | `ccfa2d3e1d0effb9fea39f86dcf146bfd915f14b` (`fix(voice-v3): call history certification defects…`) |
| **Workspace branch (inspection)** | `cursor/mctb-marketing-legal-ship-2304` |
| **PR #476** | Exists, **OPEN**, **draft**, **MERGEABLE** |
| **PR base** | `master` @ `ccfa2d3e` (merge-base = master tip) |
| **PR head SHA** | `21f3f6f3f976a74bf40eebc9e148515daa5de470` |
| **Commits on master not in PR** | **0** |
| **Commits in PR not on master** | **4** |

### Original four commits on current master?

- `fe7e2b35` — **NOT** on master  
- `5957a7f0` — **NOT** on master  
- `a575de8e` — **NOT** on master  
- `e54cba87` — **NOT** on master  

Equivalent bundle on PR: four cherry-picks with same messages/intent. Marketing commit patch-id matches original `fe7e2b35`.

### Commits in PR #476 not on master

1. `6d209f21` — feat(marketing): MCTB homepage at `/`, move Appointments to `/appointments` (≈ `fe7e2b35` + `5957a7f0` cleanup)  
2. `d4fc793d` — chore: drop accidental forensics scripts  
3. `874e0b2a` — feat(legal): MCTB opt-in diagram page and combined carrier SMS policy text (≈ `a575de8e`)  
4. `21f3f6f3` — fix(legal): bundle opt-in diagram and trim summary copy (≈ `e54cba87`)  

### Files changed by #476 vs `origin/master` (16 total)

| Status | Path |
|--------|------|
| A | `docs/MCTB-PUBLIC-HOMEPAGE-ROUTING.md` |
| A | `public/images/mctb-opt-in-flow-diagram.jpg` |
| R | `src/app/(app)/appointments/page.tsx` → `src/app/(app)/appointments/list/page.tsx` |
| A | `src/app/(public)/appointments/page.tsx` |
| A | `src/app/opt-in-documentation/page.tsx` (**missing on master → 404 today**) |
| M | `src/app/page.tsx` (MCTB landing at `/`) |
| M | `src/app/privacy/page.tsx` |
| M | `src/app/terms/page.tsx` |
| M | `src/components/landing/appointments/appointments-landing-page.tsx` |
| M | `src/components/landing/legal-shell.tsx` |
| A | `src/components/landing/mctb/mctb-hero-mockup.tsx` |
| A | `src/components/landing/mctb/mctb-landing-page.tsx` |
| A | `src/components/landing/mctb/mctb-landing.css` |
| A | `src/components/landing/mctb/mctb-opt-in-flow-diagram.jpg` |
| M | `src/lib/products/appointments-nav.ts` |
| M | `src/middleware.ts` |

**File deletions vs master:** **0**

---

## STEP 2 — Intended public behavior

| Route | Desired behavior | On PR branch | On `origin/master` today |
|-------|------------------|--------------|---------------------------|
| `/` | MCTB marketing homepage | `MctbLandingPage` | `AppointmentsLandingPage` (not desired end state) |
| `/appointments` | Appointments/scheduling marketing | Public `AppointmentsLandingPage`; auth users routed via middleware | Different arrangement |
| `/opt-in-documentation` | Public carrier MCTB SMS opt-in flow + diagram | Present | **Does not exist** |
| `/privacy` | Updated copy + SMS/MCTB + opt-in doc references | Bundle copy | Older copy |
| `/terms` | Updated SMS policy language | Bundle copy | Older copy |
| `/sms-opt-in` | Logged-in / account SMS opt-in (separate) | **Identical to master** (0-byte diff) | Present |

**Do not conflate:** `/opt-in-documentation` (carrier-facing documentation) vs `/sms-opt-in` (account/2FA opt-in surface). Both must exist; neither should redirect to the other.

---

## STEP 3 — Preserve everything newer

Because **master is 0 commits ahead of the PR base**, there is no “master moved under us” conflict surface for this inspection.

PR changes are additive/surgical where shared files are touched:

- **`middleware.ts`:** adds `/opt-in-documentation` to public routes; adds authenticated `/appointments` routing using existing `shouldRedirectAppointmentsRootToOverview` from master — does not remove existing voice/MCTB middleware on master.
- **No diffs** under `src/lib/voice-v3/**`, `src/lib/voice/**`, `src/app/mctb/**`, or `src/app/sms-opt-in/**` between master and PR.

**Rule if master advances before merge:** current master wins for unrelated functionality; bundle wins only for MCTB homepage, appointments marketing relocation, carrier opt-in doc, privacy/terms additions. Do not blind-replace whole files.

**Conflicts resolved in this inspection pass:** none (nothing applied).

---

## STEP 4 — Restoration method chosen

**Reused existing PR #476 as-is.**

- Did **not** re-cherry-pick the four commits again.  
- Did **not** rebase (unnecessary: PR base = current master tip).  
- Did **not** merge `cursor/opt-in-docs-carrier-legal-2304`.  
- Did **not** merge to `master` (not instructed).  
- Did **not** deploy production.

---

## STEP 5 — Regression protection

**No current product functionality was intentionally removed or reverted.**

Evidence:

- **0** deleted files in PR vs starting master.  
- **0** touched paths in Voice V3, voice app, or MCTB application trees in the PR diff.  
- `/sms-opt-in` unchanged vs master.

Areas explicitly checked via diff scope (no PR changes): Voice V3, AI After Hours paths, MCTB app (`/mctb/*`), call history, Google Calendar, knowledge/FileSearch, booking/transfer tooling — **not modified by this PR’s file list**.

---

## STEP 6 — Route tests

**Not run in this pass** (explicit instruction: no local build).

**Recommended after merge on preview/staging:**

| Route | Expected |
|-------|----------|
| `/` | HTTP 200, MCTB marketing homepage |
| `/appointments` | HTTP 200, Appointments marketing |
| `/opt-in-documentation` | HTTP 200, carrier opt-in documentation |
| `/privacy` | HTTP 200, updated privacy |
| `/terms` | HTTP 200, updated terms |
| `/sms-opt-in` | HTTP 200, unchanged account opt-in page |

Also smoke: `/mctb`, `/voice/*` behavior unchanged vs pre-merge master.

---

## STEP 7 — Link integrity (static review)

- **Legal shell:** `/`, `/privacy`, `/terms`, `/acceptable-use`, `/opt-in-documentation`, `/contact`  
- **MCTB landing:** links to `/appointments`, `/terms`, `/privacy`  
- **Privacy / terms:** link to `/opt-in-documentation`; privacy still references `/sms-opt-in` separately  
- No redirect from `/sms-opt-in` to `/opt-in-documentation` in middleware or bundle pages  

---

## STEP 8 — Responsive check

**Not run in this pass** (no local build / browser).

After deploy to preview: desktop, ~320–390px width, 200% zoom on public marketing/legal pages — no horizontal overflow, diagram readable, CTAs usable.

---

## STEP 9 — Application smoke / build

**Not run in this pass** (no local build).

After merge: confirm build on CI or staging; spot-check MCTB app and voice surfaces. PSTN certification not required for this marketing/legal-only restoration.

---

## STEP 10 — Checklist summary

| Check | Result |
|-------|--------|
| PR #476 exists and is clean 4-commit restoration | Yes |
| Bundle already on master | No |
| Safe to use #476 without whole old branch | Yes |
| Feature regression in PR diff | None identified |
| Merge performed | No |
| Deploy performed | No |

---

## Production today (master without #476)

- `/opt-in-documentation` → **404** (page not on master)  
- `/` → Appointments marketing (not MCTB homepage)  

## Next steps (human)

1. Review **PR #476**.  
2. Merge when approved (agent not instructed to merge).  
3. Deploy staging/production so carriers and public site get the restored routes.

---

## Distinction to preserve (carrier vs account)

| URL | Purpose |
|-----|---------|
| `/opt-in-documentation` | Public carrier-facing MCTB SMS opt-in flow documentation and diagram |
| `/sms-opt-in` | In-app / account SMS opt-in (e.g. 2FA); unchanged by this PR |

Both are required. Neither replaces the other.
