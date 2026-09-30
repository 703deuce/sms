# MCTB Phase 3 Live Exercise — Results (2026-09-30)

**Status:** Phase 3 run **COMPLETE** (no further action taken; **no push**, **no fixes** applied after this run).

**Production SHA during run:** `443a46c1c5cbb761801cd1b30196c2ca06bfe224`  
**Workspace:** `ws_1`  
**Matrix:** `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-EXERCISE.md`  
**Machine summary:** `/tmp/mctb-prod-browser-cert-exercise/exercise-summary.json`

---

## Totals

| Metric | Count |
|--------|------:|
| Routes in sweep | 28 |
| Matrix rows recorded | 611 |
| **PASS — UI + LIVE EXERCISE** | 590 |
| **FAIL** (any) | 21 |
| PASS — EXTERNAL / SAFE-BOUNDARY | 0 |
| PASS — CAPABILITY-LOCKED / DISABLED | 0 |
| State-changing rows with backend + refresh + runtime proof | **Not in this runner yet** (see below) |

**Exit code:** 2 (because `failed` > 0)

---

## Phase sequence (confirmed)

| Phase | What it was | Role |
|-------|-------------|------|
| **1** | 27 real interactions | Found real production bugs (consent, exclusions, pause) |
| **2** | ~1,487 `PASS — UI (manifest)` | **Inventory only** — control exists in DOM, not exercised |
| **3** | This run | **Live browser** — click / fill / toggle / link+back across inventory |

---

## Failure list (all 21)

**Pattern:** Every failure is the same class: **sidebar nav `link` click timeout** (8s), Playwright `getByRole('link').nth(N)` not actionable (likely off-screen, collapsed nav, or stale index after tab change).

**Not observed in this run:** HTTP 5xx on click, persistence failures, or notifications add-recipient CRUD rows (that dedicated step did not append rows to this matrix — harness gap to address in a follow-up pass).

| # | Route | Page / tab | Control | UI result (abbrev) |
|---|-------|------------|---------|-------------------|
| 1 | `/mctb/missed-call-recovery` | Recovery hub / General | link: Getting Started | TimeoutError click |
| 2 | same | General | link: Analytics | TimeoutError click |
| 3 | same | General | link: Phone & Forwarding | TimeoutError click |
| 4 | same | Consent | link: Getting Started | TimeoutError click |
| 5 | same | Consent | link: Analytics | TimeoutError click |
| 6 | same | Consent | link: Phone & Forwarding | TimeoutError click |
| 7 | `/mctb/setup` | Setup overview / General | link: Getting Started | TimeoutError click |
| 8 | same | General | link: Analytics | TimeoutError click |
| 9 | same | General | link: Phone & Forwarding | TimeoutError click |
| 10 | same | Consent | link: Getting Started | TimeoutError click |
| 11 | same | Consent | link: Analytics | TimeoutError click |
| 12 | same | Consent | link: Phone & Forwarding | TimeoutError click |
| 13 | `/mctb/setup/voicemail` | Setup Voicemail / Messages | link: Getting Started | TimeoutError click |
| 14 | same | Messages | link: Analytics | TimeoutError click |
| 15 | same | Messages | link: Phone & Forwarding | TimeoutError click |
| 16 | `/mctb/setup/exclusions` | Setup Exclusions / General | link: Getting Started | TimeoutError click |
| 17 | same | General | link: Analytics | TimeoutError click |
| 18 | same | General | link: Phone & Forwarding | TimeoutError click |
| 19 | same | Consent | link: Getting Started | TimeoutError click |
| 20 | same | Consent | link: Analytics | TimeoutError click |
| 21 | same | Consent | link: Phone & Forwarding | TimeoutError click |

### Initial triage (for your review — not applied yet)

| Bucket | These 21 failures |
|--------|-------------------|
| **Likely harness** | **Yes** — repeat clicks on global sidebar links across multiple tab surfaces; `nth()` locators; no scroll-into-view in the build that ran (fix exists locally on branch, not deployed) |
| **Likely product defect** | **No strong evidence** from this failure mode alone |

---

## Console noise (not counted as matrix FAIL)

Sample captured during run (same sidebar / layout interactions):

- `Base UI error #31` (repeated)
- `Minified React error #418` (hydration/text; seen on analytics path historically)
- Clipboard `NotAllowedError` on **Copy** (headless) — row still marked LIVE EXERCISE pass

Worth product/harness follow-up; not the same as the 21 explicit FAIL rows.

---

## Strict bar you set (next work — not done in Phase 3 runner)

For **state-changing** controls (consent, notifications, voicemail, recovery, AI, links, sender, etc.), PASS must eventually mean:

1. Browser action  
2. Successful request  
3. Authoritative backend state changed  
4. Refresh retained it  
5. Effective runtime uses it when applicable  

Phase 3 runner today: **interaction + optional HTTP error on response**. It does **not** yet upgrade every save/toggle to full persistence/runtime proof. Phase 1–2 style spot checks (e.g. consent round-trip, exclusions CRUD) remain the precedent for that bar.

**Gap:** Notifications **Add recipient** CRUD with DB snapshot was wired at end of `exercise-all.ts` but **no rows** appear in the Phase 3 matrix — treat notifications persistence as **not re-certified** in this run until a dedicated pass is recorded.

---

## What we are **not** doing now

- No new commits to `master`  
- No deploy  
- No harness or product fixes until you review this failure list  

---

## Suggested review questions for you

1. Treat all 21 as **runner-only** and re-run sidebar links once (expand sidebar, scroll, skip global nav in per-tab loops)?  
2. Schedule **Phase 3b**: state-changing matrix with backend + refresh + runtime for config surfaces?  
3. Re-run **notifications CRUD** alone on `443a46c1` with persistence columns?

---

End of Phase 3 results report.
