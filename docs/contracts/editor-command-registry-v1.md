# Editor command registry v1 (PR-B1 / #1115)

Status: **draft** for Frontend (#1117 / PR-F1). Types live in `new-app/lib/clips/editor-commands`. Import `@/lib/clips/editor-commands`.

**Version:** `EDITOR_COMMAND_REGISTRY_VERSION = 1`. Bump this constant (and this doc) only for a breaking param or result change.

No LLM endpoint in this PR. Production editor hooks are not wired yet (PR-F1). Apply wrappers reuse existing manual editor operations; they do not fork them. Unknown names are rejected and are never reported as success. Metering fields (`workspaceId`, `projectId`, `clipId`, `commandName`) are reserved; nothing is debited.

## Command names (Phase 1)

`trim`, `split`, `delete_range`, `apply_cleanup`, `restore_cut`, `set_captions`, `set_layout`, `add_or_edit_text`, `apply_brand`, `reorder_segment`

`isEditorCommandName(name)` is the type/validator guard. Any other string is `unknown_command`.

## Arg schemas

JSON Schema objects: `editorCommandJsonSchemas[name]`. Validate with `validateEditorCommand({ name, params })`.

| Command | Required params | Notes |
|---|---|---|
| `trim` | `inMs`, `outMs` (source ms, `outMs > inMs`) | Clamped like `setTrim` (`clampTrimToExtendedBounds`). Bulk if it would drop most of a ≥60s source. |
| `split` | `atMs` (output ms) | Optional `item: { lane, id }`. Default is the main video. Wraps `splitAt`. |
| `delete_range` | `startMs`, `endMs` (output ms, `endMs > startMs`) | Optional `mode: 'ripple' \| 'main'` (default ripple). Wraps `deleteRange` / `deleteRangeMain`. Destructive; bulk if long or ≥ half the output. |
| `apply_cleanup` | `proposals: Array<{ id, kind, range, label }>` (non-empty) | Wraps `applyProposalsToEdits`. Destructive; bulk if more than one proposal. |
| `restore_cut` | `startMs`, `endMs` (source ms) | Same prune path as `restoreCutRange`. |
| `set_captions` | (none required) | Partial captions patch (`enabled`, `presetId`, `animation`, `size`, `position`, `case`, `wordsPerLine`, …). |
| `set_layout` | `mode` | Optional `facecam`. Same layout pick as `setLayoutMode` (drops auto template, sets `userPicked`). |
| `add_or_edit_text` | `text` when adding | Optional `id`, `kind: 'title_card' \| 'lower_third'`, `startMs`, `endMs`, `durationMs`, `x`, `y`. If `id` is new, it is used for the added item. |
| `apply_brand` | `settings` | Optional `id`, `logoKey`, `introVideoKey`, `outroVideoKey`. Wraps `applyBrandTemplateToEdits`. Always `bulk: true`. |
| `reorder_segment` | `segId` | `beforeId: string \| null` (null = last). Wraps `moveVideoSegment`. |

## Result / diff shape

```ts
applyEditorCommand(edits, { name, params }, ctx):
  | {
      ok: true
      name: EditorCommandName
      edits: ClipEditsV2          // next state
      before: ClipEditsV2         // recorded before-state for undo
      diffSummary: { text: string; ranges?: Array<{ startMs: number; endMs: number }> }
      destructive: boolean
      bulk: boolean               // drives the confirm gate
      metering: { workspaceId?: string; projectId?: string; clipId?: string; commandName: EditorCommandName }
    }
  | { ok: false; code: EditorCommandFailureCode; message: string; name?: string }
```

`ctx` is `{ bounds, previewEdits?, playheadMs?, wordSpans?, workspaceId?, projectId?, clipId? }`.

`invertEditorCommand(okResult)` returns `okResult.before`. `serializeEditorState(edits)` is `canonicalEditsJson` and is what parity tests compare.

## Error codes

| Code | When |
|---|---|
| `unknown_command` | Name is not one of the ten Phase 1 commands. Never treated as success. |
| `invalid_params` | JSON-schema or extra required-field checks fail (e.g. `outMs <= inMs`, empty cleanup proposals). |
| `precondition` | Apply returned no result (nothing to split/delete/restore, missing text item path that cannot be added, etc.). State is unchanged. |
| `no_change` | Apply ran but serialized state equals the input. State is unchanged. |

## Source

- Types: `new-app/lib/clips/editor-commands/types.ts`
- Schemas / validator: `new-app/lib/clips/editor-commands/schemas.ts`
- Apply wrappers: `new-app/lib/clips/editor-commands/apply.ts`
- Public API: `new-app/lib/clips/editor-commands/index.ts`
