# Transovo global data table standard

**GLOBAL_TABLE_DEFAULT_PAGE_SIZE:** `10`  
**GLOBAL_TABLE_PAGE_SIZE_OPTIONS:** `5`, `10`, `25`, `50`  
**GLOBAL_TABLES_NO_LONG_DEFAULT_SCROLL:** `YES`

## Rules

1. **Default page size is 10** — never default above 10 on list/admin tables.
2. **Allowed page sizes:** 5, 10, 25, 50 only (URL/query values outside this set normalize to 10).
3. **Always show pagination footer** on data tables:
   - Range text: `1–10 of 43`
   - Rows-per-page selector
   - Previous / next
   - Current page: `Page 1 of 5`
4. **Avoid long default scroll** — cap visible body height where practical; sticky header inside scroll region is encouraged.

## Implementation

| Piece | Path |
|-------|------|
| Constants + normalize | `src/lib/ui/global-data-table.ts` |
| Shared footer UI | `src/components/ui/data-table-pagination-footer.tsx` |

## Adoption status

| Surface | Status |
|---------|--------|
| MCTB Missed Calls | **Adopted** (default 10, shared footer) |
| Audience / contacts table | **Adopted** (page sizes aligned to 5/10/25/50) |
| Clients, numbers, appointments lists, conversations, reports | **Pending** — use shared lib + footer on next pass |

## MCTB Missed Calls

`MCTB_MISSED_CALLS_COMPLETE: YES` after pagination + data-grid refinement pass.
