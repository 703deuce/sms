# Captions v1 API contract (PRODUCT_V1 Track B #1)

Status: ready for Frontend (PR to follow on `703deuce/sms`). This is the backend contract for issue #1107. It keeps the shapes Frontend already uses in PR #1109 and adds only the gaps from the Backend handoff plus VTT export.

Workspace auth is unchanged: all routes below are workspace-scoped, same as existing clip editor APIs. No `$` in product UI or these payloads.

## 1. Caption sidecar export

Built from the clip's word-level transcript, `wordFixes` / `wordFixMeta`, and `captionLines`. Cue times are on the **rendered / display clock** (cuts, trims, and speed warps applied), so they match the exported MP4.

### `GET /api/clips/clips/:id/srt`

Unchanged. `Content-Type: text/plain; charset=utf-8`. Attachment filename `clip.srt`.

Honors, in order:

1. Manual `edits.captionLines` text, with start/end warped through `displayPositionMs`.
2. Otherwise transcript words after `wordFixes` / `wordFixMeta`, grouped by `captions.wordsPerLine`.

404 if the clip is not in the workspace.

### `GET /api/clips/clips/:id/vtt` (new)

Same cues and honors as SRT, formatted as WebVTT (`WEBVTT` header, timestamps with `.` not `,`).

- `Content-Type: text/vtt; charset=utf-8`
- Attachment filename `clip.vtt`
- 404 if the clip is not in the workspace

Frontend can keep opening SRT with `window.open('/api/clips/clips/${clipId}/srt')` and may offer VTT the same way. No change to the burned-in caption render API.

## 2. Saved caption style (existing presets contract)

Frontend already posts a complete v1 snapshot to the existing presets API. Backend keeps that contract.

### Snapshot shape (`config`)

```ts
{
  version?: 1
  enabled?: boolean
  presetId?: string
  font?: string
  animation?: string
  size?: number
  userSizePct?: number
  position?: string
  case?: string
  wordsPerLine?: number
  colors?: { a?: string; b?: string }
  keywordHighlight?: boolean
  autoEmojis?: boolean
  progressBar?: { enabled?: boolean; color?: string; position?: 'top' | 'bottom'; thickness?: number }
  presetConfig?: Record<string, unknown>
  customPresetId?: string
  marginVPct?: number
  activeStyle?: 'color' | 'highlight' | 'fill'
  highlightColor?: string
}
```

`emojiByWord`, `emphasis`, `captionLines`, `wordFixes`, and `wordFixMeta` are **not** part of a reusable style. The server drops them on save so applying a preset cannot clear another clip's text edits. Unknown future brand-kit keys are left intact (seed for New #2).

### Endpoints (unchanged shapes)

- `GET /api/clips/caption-presets` → `{ data: { items: CaptionPresetRow[] } }`
- `POST /api/clips/caption-presets` body `{ name: string, config: Snapshot }` → `{ data: { preset: CaptionPresetRow } }`
- `DELETE /api/clips/caption-presets/:id` → `{ data: { ok: true } }`

`CaptionPresetRow`: `{ id, workspaceId, name, basePresetId, config, createdAt, updatedAt }`.

Per-clip style continues to live on `edits.captions` via the existing clip GET/PATCH APIs. Per-user default remains `defaultCaptionStyleId` on `GET` / `PATCH /api/clips/editor-preferences`. Applying a saved style to another clip is a frontend PATCH of `edits.captions` only; do not send word fixes or caption lines in the preset `config`.

## 3. ASR language (project settings)

`clipProjectSettingsSchema.asrLanguage` now accepts every code in `new-app/lib/clips/asr-languages.ts`:

`auto | en | es | fr | de | pt | it | nl | ru | ja | ko | ar | hi | zh`

Project create/update settings that already use this schema will persist Japanese, Korean, and the rest of that list. Codes outside the published list are still rejected. Do not advertise “100+ languages.”

## 4. Optional export-time sync guard

Frontend already warns in the editor and requires an “export anyway” acknowledgment (`captionSyncAck` state). That ack is now also a server field so a direct export API call cannot ship drifted captions.

### `POST /api/clips/clips/:id/export`

Existing body is unchanged, plus:

```ts
{
  // ...existing export fields...
  captionSyncAck?: boolean
}
```

When captions are enabled, the export is a pictured format (`mp4` / `mov` / `gif`, or default MP4), and it is not a `previewWysiwyg` grid download:

- If cue timing looks drifted (`invalid_times`, `non_monotonic`, `past_duration`, `source_clock`, or `line_transcript_drift`; 500ms threshold, same rules as the editor detector) **and** `captionSyncAck` is not `true`, the server returns **409** and does **not** enqueue a render (no paid run, no auto-retry):

```ts
{
  error: string
  code: 'CAPTION_SYNC_REQUIRED'
  data: { warnings: Array<{ level: 'warning'; code: string; message: string }> }
}
```

- If the user has acknowledged the warning, send `captionSyncAck: true`. The export proceeds; warnings are not a hard fail.
- Skipped when `edits.captions.enabled === false`, `previewWysiwyg: true`, or format is `mp3` | `wav` | `m4a` | `flac` | `png`.

Please add `captionSyncAck: true` to the `exportClipWithOptions` call in the export dialog when the editor acknowledgment is checked. The TypeScript options type already includes this optional field.

The same gate now applies to every pictured export path that can ship captions (not only single-clip `POST /export`):

### `POST /api/clips/projects/:id/export-all`

Existing body is unchanged, plus `captionSyncAck?: boolean`. Before any render is enqueued or a preview is reused, every clip in the batch is scanned with the same detector. If any clip is blocked and `captionSyncAck` is not `true`, the server returns **409** and enqueues nothing:

```ts
{
  error: string
  code: 'CAPTION_SYNC_REQUIRED'
  data: {
    warnings: Array<{ level: 'warning'; code: string; message: string }>
    clips: Array<{ clipId: string; warnings: Array<{ level: 'warning'; code: string; message: string }> }>
  }
}
```

`exportProjectAllBatch` accepts `captionSyncAck?: boolean`. Send `true` when the user has acknowledged the warning.

### `GET` / `POST /api/clips/clips/:id/export-xml` (NLE zip, includes `captions.srt`)

The zip is also gated. Acknowledge with `GET ?captionSyncAck=true` or `POST { captionSyncAck: true }`. The 409 body is the same single-clip shape (`data.warnings`, no `clips` array). `downloadClipNleZip(clipId, title, { captionSyncAck?: boolean })` passes the query flag.

The agent auto-export path that calls `enqueueRenderClip` from the orchestrator is not on this branch and is **not** gated inside `enqueueRenderClip` (there is no ack UI on those runs).

`#1109` (Frontend ack + 409 handling, including sentence-case) and `#1110` (this backend contract, including worker ASS sentence-case) must merge together.

## 5. Sentence case (preview, SRT/VTT, burned-in ASS)

`edits.captions.case` is `upper` or `sentence` (anything other than `upper` is treated as sentence). This is not a new API field.

- `upper`: every word is fully uppercased.
- `sentence`: capitalize **only the first character** of each cue and of each word that follows a sentence-ending `[.!?]` plus optional closing quotes/brackets (`[.!?]["')\]]*$`). Every other word keeps its **source casing**. Mid-sentence `I`, `I'm`, proper nouns (`Wayne State`, `Michigan`, `Egypt`), and acronyms (`AI`, `PhD`) must not be lowercased.

Frontend (`formatCaptionWord` / `formatCaptionLineText` in `new-app/lib/clips/caption-case.ts`, PR #1109) and worker burned-in ASS (`worker/clips_worker/captions_ass.py` `disp` / `disp_words`) use the same rule, so preview, downloaded SRT/VTT, and burned-in export captions agree.

## 6. Out of scope

- Caption translation (New #7) is not enabled or expanded.
- The burned-in caption render API shape is unchanged. Worker burn-in already applies `wordFixes` / `wordFixMeta` and `captionLines`; SRT/VTT use the same text, display-clock timings, and sentence-case rule.
- No Mode 2, Clean Take, or clipper finder changes.
