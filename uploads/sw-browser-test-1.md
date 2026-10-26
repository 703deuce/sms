# Screenwriting browser test 1 (prod audit)

## P0 — core editor (fix before W20–W27)

| # | Issue | Status |
|---|--------|--------|
| P0-1 | Final Draft layout (paper page, margins, Courier) | FIXED — `screenplay-editor.css` + inline element styles |
| P0-2 | PDF export unformatted | FIXED — `pdf/line-position.ts` per-element x/align |
| P0-3 | Not a screenplay doc (empty/wrong schema) | FIXED — `normalizeScreenplayDoc` |
| P0-4 | Enter/Tab element machine | FIXED — `screenplayKeymap` extension |
| P0-5 | SmartType autocomplete | FIXED — `smarttype-menu.tsx` |
| P0-6 | Read aloud dead | FIXED — dialogue via `segmentTableRead` + browser TTS fallback |

## P1 — panels & polish (after P0)

| # | Issue | Status |
|---|--------|--------|
| P1-1 | Navigator / scenes | DONE (sidebar navigator) |
| P1-2 | Empty panel placeholders | PARTIAL — addendum collapsed by default |
| P1-3 | FD chrome spec (menus/toolbar placement) | WAITING — `uploads/` layout spec incoming |

## W20–W27 addendum

Resume after P0 verified on prod. Section D rows marked NOT DONE in `SCREENWRITING-BUILD.md` until browser pass.
