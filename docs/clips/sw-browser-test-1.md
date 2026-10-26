# Screenwriting browser test tracker

## P1 (#8–#14)

| Id | Item | Status |
|----|------|--------|
| P1-8 | Import Replace / Append / New + PRE_IMPORT + warnings | IMPLEMENTED — `import-dialog.tsx`, import API |
| P1-9 | Beat board, breakdown, revisions, inline comments | PARTIAL — beat board + revisions; breakdown hotkey TODO |
| P1-10 | Snapshots timestamp, rename, preview, diff | IMPLEMENTED — `versions-panel.tsx` |
| P1-11 | FDX title page + fountain dialogue cluster | IMPLEMENTED — `title-page-xml`, `export-lines.ts` |
| P1-12 | Card synopsis + drag reorder | IMPLEMENTED — `scene-cards-panel.tsx` |
| P1-13 | Ctrl+1–7 in element dropdown | IMPLEMENTED — `screenplay-toolbar.tsx` |
| P1-14 | New screenplay &lt;1s perceived | IMPLEMENTED — minimal formatSpec, `loading.tsx`, dynamic workspace |

## Layout & format flow

- Spec: `docs/clips/screenwriting-ui.md` (22 look checks)
- Rules: `docs/clips/screenwriting-format-flow.md` (28 `[U]` tests in `screenwriting-format-flow.test.ts`)
