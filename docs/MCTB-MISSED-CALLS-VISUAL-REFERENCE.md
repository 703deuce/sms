# MCTB Missed Calls — locked visual reference

**Route:** `/mctb/missed-calls`  
**Status:** **LOCKED** — `MCTB_MISSED_CALLS_COMPLETE: YES`  
**Do not redesign** during later MCTB page passes except **shared-shell** fixes that apply globally.

## Reference implementation

| Area | Location |
|------|----------|
| Page view | `src/components/mctb/missed-calls-view.tsx` |
| Styles | `src/components/mctb/missed-calls/mctb-missed-calls.css` |
| List data | `loadMctbMissedCallsListData`, `GET /api/mctb/missed-calls` |
| Pagination standard | `src/lib/ui/global-data-table.ts`, `src/components/ui/data-table-pagination-footer.tsx` |
| Blueprint | `docs/MCTB-MISSED-CALLS-VISUAL-BLUEPRINT.md` |

## Locked behavior

- Default **10** rows; page sizes **5 / 10 / 25 / 50**; server pagination
- Table body and pagination footer are **separate** blocks (no overlay on rows)
- Row click → `/mctb/missed-calls/[id]`; Callback `tel:` isolated
- Recovery column ~22%; two-line suppression reasons preserved
- **Recovery** filter (URL `status`); **Needs reply** KPI → `/mctb/conversations?filter=needs_reply`
- Summary metrics scoped to active **date** filter (+ Needs reply = live inbox count)

## Carry forward

Use the same shell/tokens as **MCTB Home** (`docs/MCTB-HOME-VISUAL-REFERENCE.md`).
