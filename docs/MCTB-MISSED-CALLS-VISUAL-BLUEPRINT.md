# MCTB Missed Calls — visual blueprint (desktop)

Operational log layout on soft-slate MCTB shell. **Not a dashboard.**

## Row 1 — Header (12 col)
Title + subtitle left; **Manage setup** secondary button right. Not a card.

## Row 2 — Summary (12 col)
4×3 col metrics when Needs reply supported: Missed calls, Recovery texts, Replies, Needs reply.  
Height ~64–72px; label + value + range context (`Today`, `Last 7 days`, etc.). Needs reply context: `Conversations`.

## Row 3 — Toolbar (12 col)
Single 36px-high row: Search | Outcome | Date | Trigger | Filters | Sort.

## Row 4 — Table (12 col full width)
Columns ~18 / 14 / 11 / 20 / 12 / 15 / 10 %. Sticky header; rows 48–58px; Recovery two-line when reason present.

## Row 5 — Pagination footer (attached)
`1–10 of 43` | Rows per page `10` | `‹ Page 1 of 5 ›`

## Mobile
Stacked summary 2×2; search + Filters/Sort; compact list rows (not 7-col squeeze).

See `docs/TRANSOVO-GLOBAL-DATA-TABLE-STANDARD.md` for pagination defaults.
