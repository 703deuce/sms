# Screenwriting browser test tracker

## P0 — core editor

| Id | Item | Status |
|----|------|--------|
| P0-1 | Final Draft layout (paper page, margins, Courier) | FIXED — `screenplay-editor.css` |
| P0-2 | PDF export unformatted | FIXED — `pdf/line-position.ts` |
| P0-3 | Not a screenplay doc (empty/wrong schema) | FIXED — `normalizeScreenplayDoc` |
| P0-4 | Enter/Tab element machine | FIXED — `screenplayKeymap` |
| P0-5 | Coarse undo / deleted text resurrects | FIXED — single Yjs `UndoManager` (`captureTimeout` 450ms), PM History off, offline recovery gated |
| P0-6 | “Local save until collab” banner honesty | FIXED — `CollabStatusBanner` + `/app/sw` copy; `liveCollabConfigured` on collab-token API |
| P0-7 | SmartType autocomplete | FIXED — `smarttype-menu.tsx` |
| P0-8 | Read aloud | FIXED — `segmentTableRead` + browser TTS fallback |

## P1 — panels & polish (#8–#14)

| Id | Item | Status |
|----|------|--------|
| P1-8 | Navigator / scene list + empty state | FIXED — jump links + `PanelEmpty` |
| P1-9 | Empty panel placeholders | FIXED — outline, cards, comments, versions, reports, breakdown |
| P1-10 | Status bar save + collab label | FIXED — `ScriptStatusBar` wired to `saveState` |
| P1-11 | Find/replace applies in editor | FIXED — `externalDocKey` + Yjs fragment replace |
| P1-12 | Comments POST UI | FIXED — form + API |
| P1-13 | Scene cards reorder | FIXED — existing ↑/↓ + empty state |
| P1-14 | FD chrome spec (menus/toolbar placement) | WAITING — `uploads/` layout spec incoming |

Resume W20–W27 after prod pass. Section D rows stay NOT DONE in `SCREENWRITING-BUILD.md` until verified.
