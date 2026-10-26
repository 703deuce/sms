# Final Draft 13 — UI layout spec (Transovo `/app/sw`)

Page color may follow app theme; geometry matches FD.

## Regions

1. **Menu bar** — File, Edit, Format, Document, Production, Tools, Window, Help (stubs OK; placement required).
2. **Toolbar** — icon row under menu (save, print, undo, find, etc.).
3. **Element bar** — element type dropdown with **Ctrl+1…7** hints; applies to selection.
4. **Mode tabs** — Script | Cards | Beat Board (switches center + left context).
5. **Left navigator** — scenes, collapsible, ~240px.
6. **Center** — paper page editor (8.5×11, Courier 12pt, FD margins).
7. **Right notes** — comments / script notes panel (~280px).
8. **Status bar** — pages, scenes, save, collab.

## 22 look checklist

| # | Check |
|---|--------|
| L01 | Menu bar visible above toolbar |
| L02 | Toolbar full width under menu |
| L03 | Element dropdown shows shortcuts 1–7 |
| L04 | Mode tabs Script/Cards/Beat Board |
| L05 | Navigator left of editor |
| L06 | Editor paper centered with shadow |
| L07 | Right notes column present |
| L08 | Status bar bottom of editor column |
| L09 | Courier / 12pt body |
| L10 | Scene heading uppercase styling |
| L11 | Character indent ~3.7" |
| L12 | Dialogue indent ~2.5" |
| L13 | Parenthetical indent ~3.0" |
| L14 | Transition right-aligned |
| L15 | Page break decoration between pages |
| L16 | Collab banner under chrome |
| L17 | Import offers Replace / Append / New |
| L18 | Beat board columns (acts/sequences) |
| L19 | Breakdown tag hotkey |
| L20 | Revisions panel shows color set |
| L21 | Snapshots list with timestamp + rename |
| L22 | Cards mode synopsis + drag reorder |

Reference screenshots: `docs/clips/sw-ui-refs/` (from `sw-ui-refs.tgz`).
