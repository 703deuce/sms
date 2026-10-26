# Screenwriting Addendum A (W20–W27)

Assumptions the W1–W19 spec implied but did not spell out, plus Final Draft 13 parity gaps and deferred spec items.

**Done rule:** each Section D row is **DONE** only when reachable in the browser UI at `/app/sw/scripts/{id}` and its `[U]` unit test in `new-app/tests/screenwriting-addendum.test.ts` passes.

## Milestones

| W | Theme |
|---|--------|
| W20 | Collab undo, clipboard, save reconciliation, restore/import with collaborators, import warnings |
| W21 | Scene versions, story bible, frozen export presets, font fallback, dual-dialogue warn, RTL, AI privacy |
| W22 | Images, print/PDF dialog, character sides, print preview CSS, character highlight |
| W23 | Goals/stats, element toolbar, split view, macros, name database |
| W24 | Episode headers, collab chat, branch drafts + merge, offline thesaurus, story-time axis |
| W25 | Big Fish parity, collab undo label, offline recovery, frozen export guard, FDX warnings API |
| W26 | Scene version restore, bible character link, PDF watermark, dialogue filter, macro hotkeys |
| W27 | Episode on PDF, chat persistence, Yjs undo hook |

## Section D (41 rows)

See `docs/clips/SCREENWRITING-BUILD.md` for status, paths, and browser flows.

Row ids: D01–D41 in `new-app/lib/screenwriting/addendum/rows.ts`.

## UI look spec (incoming)

A separate Final Draft–style spec (paper page, toolbar, Navigator, status bar) will land under `uploads/`. Fold classes into `screenplay-workspace.tsx` / `globals.css` when it arrives; baseline hooks: `.sw-fd-shell`, `.sw-fd-page`, `.sw-fd-toolbar`, `.sw-fd-navigator`, `.sw-fd-status`.
