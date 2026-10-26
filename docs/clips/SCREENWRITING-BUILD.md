# Screenwriting build tracker

Spec: `uploads/screenwriting.md` (W1–W19). Addendum: `uploads/screenwriting-addendum.md`. **Prod audit:** `uploads/sw-browser-test-1.md`.

## Current priority

**P0 core editor** must pass browser test before W20–W27 addendum rows count as DONE.

| Area | Status | Path |
|------|--------|------|
| Screenplay formatting (margins, caps, Courier page) | DONE (retest) | `screenplay-editor.css`, `schema/extensions.ts` |
| Enter / Tab element machine | DONE (retest) | `createScreenplayKeymap` in `schema/extensions.ts` |
| SmartType autocomplete | DONE (retest) | `smarttype-menu.tsx`, `screenplay-editor.tsx` |
| PDF formatted export | DONE (retest) | `pdf/render.ts`, `pdf/line-position.ts` |
| Read aloud | DONE (retest) | `segmentTableRead` + TTS fallback in workspace |
| Yjs undo (single UndoManager) | DONE (retest) | `use-screenplay-yjs-collab.ts`, `collab/yjs-undo.ts`, PM History off |
| Collab honesty banner | DONE (retest) | `collab-status-banner.tsx`, `collab-token` `liveCollabConfigured` |
| Doc normalization | DONE | `schema/normalize-doc.ts` |
| P1 panels (#8–#14) | DONE (retest) | `panel-empty.tsx`, find/replace → editor, comments POST |

## W1–W19 (core)

| W | Theme | Status |
|---|--------|--------|
| W1 | Skeleton & schema | DONE |
| W2 | Elements & SmartType | DONE (retest autocomplete) |
| W3 | Fountain + import/export | DONE |
| W4 | Pagination | DONE |
| W5 | FDX | DONE |
| W6 | Paged editor | DONE (retest formatting) |
| W7 | PDF export | DONE (retest indents) |
| W8 | Writing aids | DONE |
| W9 | Versions | DONE |
| W10 | Collab | DONE (WS optional) |
| W11 | Comments & sharing | DONE |
| W12 | Templates | DONE |
| W13 | Revisions | DONE |
| W14 | Structure tools | DONE |
| W15 | Reports | DONE |
| W16 | DOCX/Highland | DONE |
| W17 | AI | DONE |
| W18 | Read aloud | DONE (retest) |
| W19 | Polish & nav | DONE |

## Section D — Addendum A (41 rows)

**Status: NOT DONE** until P0 browser pass on prod, then resume milestone verification.

| ID | Milestone | Feature | Status |
|----|-----------|---------|--------|
| D01–D41 | W20–W27 | See `addendum/rows.ts` | NOT DONE (code landed; verify after P0) |

Prisma: `20261026220000_sw_addendum_w20_w27`. Tests: `screenwriting-addendum.test.ts`, `screenwriting-p0-editor.test.ts`.

## Browser flows (Rick)

1. `/app/sw` → open script → `/app/sw/scripts/{id}`
2. Type **INT.** on action line → scene heading + SmartType menu
3. **Tab** from action → character; **Enter** after character → dialogue
4. **Read aloud** → hears dialogue (browser voice if ElevenLabs off)
5. Export **pdf** → indented character/dialogue columns
6. Addendum tabs (optional): use after P0 sign-off

## Workers

Do not restart `clips-worker` / `clips-worker-stream` during long stream VOD jobs.
