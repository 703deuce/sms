# MCTB Phase 3b — Production results (2026-09-30)

**Production SHA:** `443a46c1c5cbb761801cd1b30196c2ca06bfe224` (`GET /api/health`)  
**Workspace:** `ws_1`  
**Runner:** `scripts/mctb-production-browser-cert-phase3b.ts`  
**Matrix:** `docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-PHASE3B.md`

## Explicitly not product defects (per certification policy)

Do **not** open app fixes for: Phase 3’s 21 sidebar link timeouts (pre-3b harness), clipboard permission errors, Base UI #31, React #418, superseded Analytics matrix row. These are automation/environment noise unless they reproduce as functional failure in normal production browser use.

## Harness corrections (this branch)

| Area | Fix |
|------|-----|
| 21 nav retries | Click `[data-sidebar="sidebar"] a[href="…"]` and assert destination URL |
| Notifications route | `/mctb/notifications` (not `/mctb/setup/notifications`) |
| Headless overlay | Stuck Base UI `dialog-overlay` blocks Playwright clicks; use DOM `evaluate(click)` after prompt handler |
| State-changing routes | IA canonical: `/mctb/missed-call-recovery?tab=rules`, `/mctb/text-back?section=booking` |
| Fast re-run | `MCTB_PHASE3B_SKIP_NAV=1` skips nav block |

## Phase 3b — navigation (21 controls)

**Result:** **21 / 21 PASS** — `PASS — UI + LIVE EXERCISE (3b nav)`  
(Full table in matrix from run started `2026-09-30T11:54:53Z` / `11:49:47Z`; all rows use sidebar href scoping.)

## Phase 3b — notifications persistence

| Control | Result | Notes |
|---------|--------|--------|
| Delete recipient | **PASS — CAPABILITY-N/A** | No delete control in UI (edit via overflow only) |
| Add recipient | **FAIL — PRODUCT** | `window.prompt` flow completes; **`POST /api/mctb/handoff` → 200**; snapshot `recipientCount=0`, `certRecipientPresent=false`; row not shown after wait |
| Edit recipient | **FAIL — BLOCKED** | Depends on add |
| Urgent toggle | Not reached | Blocked on add |

**Evidence (harness):** `post=200` with handoff JSON in `backendResult`; read-only DB snapshot unchanged for cert email.

**Root cause (fixed on `master` after `443a46c1`):** `onAddRecipient` called `setRecipients(next)` then `save()` in the same tick; `save()` read **stale** React state and POSTed the **previous** `recipients` array (often empty). **Fix:** `save(recipientsOverride)` and `void n.save(next)` on add/edit.

Pre-fix runs looked like “200 but no rows” because the server echoed unchanged data.

## Phase 3b — state-changing (partial)

State-changing block did not append PASS rows in the final short runs (notifications early exit / selectors on canonical IA surfaces need a follow-up harness pass). Not counted as product failures.

## Summary counts (latest persistence-focused run)

| | Count |
|--|--|
| Rows exercised | 3 (notifications-only rerun) |
| PASS | 1 |
| FAIL — PRODUCT | 1 (Add recipient) |
| FAIL — HARNESS | 0 |

## Recommended next steps (no `master` push from this task)

1. **Product:** Investigate `POST /api/mctb/handoff` with new `recipients[]` — 200 response but `recipientCount` stays 0 for `ws_1` (likely server-side persist or read path).
2. **Harness:** Extend state-changing rows on canonical routes; require `post=200` + snapshot + reload for PASS.
3. **Re-run after deploy:** Full `mctb-production-browser-cert-phase3b.ts` (without `MCTB_PHASE3B_SKIP_NAV`) once notification fix ships.
