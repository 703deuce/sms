# Transovo controlled visual rollback

**Date:** 2026-09-25  
**Branch:** `cursor/pass-3b-full-visual-redesign-2304` (after rollback commit)

## A. Baseline selected

**Visual reference commit:** `3897951f` — *feat(ui): Pass 2A visual refinement — truthful KPIs, operating toolbar, density*

**Why:** Last product UI state **before** the surface-first experiment (`5e8a4138` Calls Fonio tighten → `3cfa24b3` Pass 3 → `f0650af9` Pass 3B). Pass 2 shared foundation (`transovo-visual-foundation.css`, `state-feedback`, KPI strip, toolbar) remains at the Pass 2A revision.

**Not used:** `5f9b3bab` (Pass 1 docs-only rollback point) — too far back; loses Pass 2A improvements.

## B. Diff classification (Pass 3 / 3B vs baseline)

| File / area | Class | Action |
|-------------|-------|--------|
| `transovo-pass3-surface-first.css` | A VISUAL | **Removed** |
| `transovo-operational-redesign.css` | A VISUAL | **Removed** |
| `transovo-voice-calls-workspace.css` | A VISUAL | **Removed** |
| `transovo-call-detail-workspace.css` | A VISUAL | **Removed** |
| `operational-page.tsx`, `product-page.tsx`, `section.tsx` | A VISUAL | **Removed** (unused Pass 3 primitives) |
| `voice/layout.tsx`, `mctb/layout.tsx` | A VISUAL | **Restored** from `3897951f` |
| Voice Calls / Call Detail pages | A VISUAL | **Restored** from `3897951f` |
| Voice/MCTB dashboards, setup shell, missed calls, overview | A VISUAL | **Restored** from `3897951f` |
| Receptionist, Knowledge, Call Handling editors | A VISUAL | **Restored** from `3897951f` |
| `card.tsx` | A VISUAL | **Restored** default contained `surface rounded-xl bg-card p-5` |
| `transovo-visual-foundation.css` | D MIXED | **Restored** Pass 2A (removed Pass 3 import + flat card demotion) |
| `app-shell.tsx` | D MIXED | **Removed** Pass 3 CSS import only |
| `sync-collection-config.ts`, `simplified-fields.ts` | B FUNCTIONAL | **Preserved** `Array.isArray` guards (AI Recovery) |
| `ai-recovery/context/route.ts`, `approved-business-information.ts` | B FUNCTIONAL | **Preserved** services array normalization |
| `ai-recovery-settings-page.tsx` | A VISUAL | **Restored** presentation from `3897951f` |
| IA / routes / runtime / sender authority | — | **Unchanged** (no route rollback) |

## C. Files changed in rollback

See git commit on branch after this doc (presentation restore + CSS deletion + functional cherry-pick).

## D. Visual systems removed

- `.transovo-product-surface-first` global canvas and card demotion
- `.transovo-operational-redesign` global overrides
- Voice Calls / Call Detail workspace-only Pass 3 CSS
- Pass 3 `Card` inversion (`contained` opt-in for boxes)
- `OperationalPage` / open-section composition layer

## E. Functional changes preserved

- AI Recovery: normalize `policy.actions`, `collectCapabilities`, `business.services`, `booking.links` at API/lib boundaries (defensive + contract-safe; does not change telephony/SMS runtime).

## F. Card behavior after rollback

`Card` default: `surface rounded-xl bg-card p-5` — contained module semantics restored. No global CSS strips borders/shadows from cards.

## G. Product architecture verification

Canonical MCTB and Voice IA unchanged. No legacy nav resurrection.

## H. Screenshot verification

Not required on Cloud Agent for this rollback. Validate locally with your normal `npm run dev` + browser when you want visual proof. Pre–Pass 3 reference PNGs remain under `/opt/cursor/artifacts/screenshots/pass-3-visual-proof/after/` (captured before the surface-first experiment).

## I. Known functional defects (unchanged)

- Voice Analytics: undefined count in KPI contract

## J. Residual from Pass 2 (intentional)

- `transovo-visual-foundation.css` (Pass 2A)
- `kpi-strip`, `operational-toolbar`, `state-feedback` components
- Pass 2A Calls toolbar / inline KPI density where present in restored `calls/page.tsx`

## K. Verdict

**CONTROLLED VISUAL ROLLBACK COMPLETE — READY FOR BASELINE POLISH**

Presentation restored to Pass 2A (`3897951f`) for all Pass 3/3B-touched UI; functional AI Recovery guards preserved. No product architecture or runtime changes in this rollback.
