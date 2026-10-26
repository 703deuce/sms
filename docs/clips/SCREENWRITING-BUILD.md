# Screenwriting build tracker (W1–W27)

Spec: `uploads/screenwriting.md` (W1–W19). Addendum A: `uploads/screenwriting-addendum.md` (W20–W27).

## Milestone summary (W1–W19)

| W | Theme | Status |
|---|--------|--------|
| W1–W19 | See prior audit below | DONE on master `7503c92ce` |

## Section D — Addendum A (41 rows)

| ID | Milestone | Feature | Status | Path |
|----|-----------|---------|--------|------|
| D01 | W20 | Single Yjs undo (disable PM History when collab) | DONE | `collab/undo-policy.ts`, `screenplay-editor.tsx` |
| D02 | W20 | Screenplay clipboard paste (plain elements) | DONE | `editor/clipboard.ts`, `screenplay-editor.tsx` |
| D03 | W20 | Device vs server save reconciliation | DONE | `persistence/save-reconcile.ts`, `screenplay-editor.tsx` |
| D04 | W20 | Restore/import policy with live collaborators | DONE | `collab/restore-policy.ts`, workspace import + versions |
| D05 | W20 | Import warnings list | DONE | `import/warnings.ts`, `import/fdx-stats.ts`, import API + sidebar |
| D06 | W21 | Scene versions (per-scene snapshot) | DONE | `api/.../scene-versions/`, addendum `sceneVersions` |
| D07 | W21 | Story bible entries | DONE | `api/.../bible/`, `bible/entries.ts`, addendum `bible` |
| D08 | W21 | Export presets on frozen snapshot | DONE | `versions/export-presets.ts`, versions panel frozen PDF link |
| D09 | W21 | Font fallback chain | DONE | `editor/font-fallback.ts`, editor inline style |
| D10 | W21 | Dual-dialogue pagination warning | DONE | `layout/dual-dialogue-warn.ts`, addendum bar |
| D11 | W21 | RTL block direction | DONE | `editor/rtl.ts`, stats panel + editor |
| D12 | W21 | AI privacy controls | DONE | `ai/privacy.ts`, addendum `privacy` |
| D13 | W22 | Embedded images on elements | DONE | `schema/extensions.ts` (`imageSrc`), toolbar + editor |
| D14 | W22 | Print/PDF options dialog | DONE | addendum `print` panel + export query params |
| D15 | W22 | Character sides PDF export | DONE | `pdf/character-sides.ts`, export `format=character-sides` |
| D16 | W22 | Print preview stylesheet | DONE | `app/globals.css` `@media print`, `.sw-print-preview` |
| D17 | W22 | Character dialogue highlighting | DONE | `screenplay-editor.tsx`, addendum `names` |
| D18 | W23 | Writing goals and stats | DONE | `writing/stats.ts`, addendum `stats` |
| D19 | W23 | Custom element toolbar | DONE | `screenplay-toolbar.tsx`, workspace |
| D20 | W23 | Split view layout | DONE | stats panel + workspace split JSON pane |
| D21 | W23 | Text macros | DONE | `editor/macros.ts`, addendum `macros` + editor F-keys |
| D22 | W23 | Name database | DONE | `names/database.ts`, addendum `names` |
| D23 | W24 | Episode header fields | DONE | `tv/episode-header.ts`, print panel |
| D24 | W24 | Collab chat messages | DONE | `api/.../chat/`, addendum `chat` |
| D25 | W24 | Branch draft create | DONE | `api/.../branch-drafts/` POST |
| D26 | W24 | Branch merge suggestions | DONE | `branch/merge.ts`, branch panel PATCH |
| D27 | W24 | Offline thesaurus lookup | DONE | `writing/thesaurus.ts`, addendum `thesaurus` |
| D28 | W24 | Story-time axis | DONE | `structure/story-time.ts`, addendum `timeline` |
| D29 | W25 | Big Fish page-start parity check | STUB | `parity/big-fish.ts` — no golden FDX fixtures in repo |
| D30 | W25 | Collab undo stack flag | DONE | `undo-policy.ts` `collabUndoStackLabel`, status bar hint |
| D31 | W25 | Offline recovery merge | DONE | `save-reconcile.ts` `mergeOfflineRecovery`, workspace boot |
| D32 | W25 | Frozen snapshot export guard | DONE | `export-presets.ts`, export API 403 without `frozenExport=1` |
| D33 | W25 | FDX import warnings API field | DONE | import route `data.warnings` |
| D34 | W26 | Scene version restore | DONE | scene-versions PATCH, addendum Restore |
| D35 | W26 | Bible character link | DONE | `bible/entries.ts`, bible panel Link char |
| D36 | W26 | PDF dialog watermark toggle | DONE | print panel + `render.ts` watermark |
| D37 | W26 | Filter dialogue by character | DONE | `character-sides.ts` extract + sides export |
| D38 | W26 | Macro hotkey slot | DONE | `macros.ts` `macroForHotkey`, default F1 macro |
| D39 | W27 | Episode header on PDF | DONE | `render.ts` + `formatEpisodeHeaderPdfLine` |
| D40 | W27 | Chat persistence API | DONE | `SwChatMessage`, `api/.../chat/` |
| D41 | W27 | Yjs undo plugin hook in editor | DONE | `collab/yjs-undo-hook.ts`, `use-screenplay-collab.ts`, editor |

Prisma (additive): `new-app/prisma/migrations/20261026220000_sw_addendum_w20_w27/`

Tests: `new-app/tests/screenwriting-addendum.test.ts` (41 `[U]` rows + catalog)

## W1–W19 detailed audit (unchanged)

### W1
| Bullet | Status | Path |
|--------|--------|------|
| Prisma Sw* models | DONE | `new-app/prisma/schema.prisma`, `new-app/prisma/migrations/20261026200000_sw_w1_screenwriting/` |
| TipTap schema (dual, page break) | DONE | `new-app/lib/screenwriting/schema/extensions.ts` |
| FormatSpec + Feature | DONE | `new-app/lib/screenwriting/formats/feature.ts` |
| `/app/sw` list + editor | DONE | `new-app/app/app/sw/page.tsx`, `new-app/app/app/sw/scripts/[scriptId]/page.tsx` |
| Local save | DONE | `new-app/components/screenwriting/screenplay-editor.tsx` |

### W2–W19
See git history on `7503c92ce` — full table in prior revision of this doc.

## Browser flows (Rick)

### W1–W19 (core)
1. **Dashboard:** Clips sidebar → **Screenwriting** → `/app/sw`
2. **Editor:** `/app/sw/scripts/{id}` — write, import/export, structure panels, AI, versions, share

### W20–W27 (addendum bar)
3. **Addendum tabs** (top): `bible`, `sceneVersions`, `chat`, `branch`, `stats`, `macros`, `names`, `print`, `thesaurus`, `timeline`, `privacy`
4. **stats:** word goal, split view, RTL, simulate collaborators (import/restore policy)
5. **print:** watermark PDF, character sides, print preview (browser), episode header fields
6. **toolbar:** element buttons + image URL attach on selection
7. **Import warnings:** after FDX import, warnings show in sidebar when addendum panel closed
8. **Collab undo:** when collab token loads, PM History off + “Yjs undo” in save line

## Streamer / workers

Do **not** restart `clips-worker` or `clips-worker-stream` during long VOD imports (stream lane download resets on deploy).
