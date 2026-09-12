# MCTB Home — locked visual reference

**Route:** `/mctb`  
**Status:** **LOCKED** — `MCTB_HOME_COMPLETE: YES`  
**Do not redesign Home** during later MCTB page passes except **shared-shell** fixes that apply globally.

## Reference implementation

| Area | Location |
|------|----------|
| Page view | `src/components/mctb/overview-view.tsx` |
| Home sections + CSS | `src/components/mctb/home/` |
| MCTB shell (all `/mctb/*`) | `src/app/(app)/mctb/layout.tsx`, `src/components/mctb/shell/mctb-neutral-shell.css`, `src/lib/products/mctb-shell.ts`, app shell + `TransovoSidebar` soft-slate class |
| Data | `loadMctbOverview` / `GET /api/mctb/overview` (unchanged) |

## Design tokens (Home)

- Canvas: `#F6F7F8`
- Surface border: `#EAEDF0`, radius **8px**
- Section header: **40px** min-height, `0.5rem 1rem` padding, 15px/21px/600 title
- KPI strip: **~64px** height — **do not shrink further**
- Active status: muted dot + text (no green pill)
- Needs attention (empty): inline strip inside Recent missed calls
- Bottom row: conversations **7** / setup **5**, equal stretch on desktop

## Carry forward to other MCTB pages

1. Neutral soft-slate shell (sidebar, header, credits, graphite Send Message)
2. Compact summary strips, not dashboard cards
3. Operational tables/rows with subtle hover
4. Semantic color only (success/warning/error states)

## Verification (locked)

All Home actions use existing routes/APIs — see `docs/MCTB-HOME-COMPONENT-CONNECTION-MATRIX.md`.
