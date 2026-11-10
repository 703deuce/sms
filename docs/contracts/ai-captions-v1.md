# AI Captions v1 contract

Status: **draft** for Frontend (`/app/captions`). Version `1`. Workspace-scoped, same auth as existing clip APIs. Additive schema only.

This document is the single canonical name set. Use these fields and paths exactly.

AI Captions is a **separate product**, not a clipper mode. `/app/clips` stays the clipper. There is no clipping and no cuts. One run transcribes the source (if needed) and generates captions only. Output is **one** `Clip` row covering the full video (`startMs` 0 through `durationMs`) in clip-editor shape, with captions enabled. Edit opens that clip in the **clip editor**.

Captions start automatically when a run is created from an upload or from an existing project or asset. There is no confirm or choose step.

Reuse the existing transcription and caption pipeline read-only (caption presets, word-boundary line splitting from #1132, SRT builders, `writeClipEdits`). Do not fork behaviour and do not change the clipper’s captions, the editor, the SMS worker, or app3. No live billing; never show `$`. Credits on this contract are informational only and are not charged.

## Shared types

```ts
type AiCaptionsSource =
  | { kind: 'upload'; projectId: string }
  | { kind: 'asset'; projectId: string; assetId: string }

type AiCaptionsStatus =
  | 'queued'
  | 'transcribing'
  | 'captioning'
  | 'exporting'
  | 'ready'
  | 'failed'

type AiCaptionsStage =
  | 'queued'
  | 'transcribe'
  | 'captions'
  | 'export'
  | 'ready'

type AiCaptionsWord = {
  text: string
  startMs: number
  endMs: number
  confidence?: number          // ASR word confidence `p` when present, 0–1
  lowConfidence: boolean       // true when confidence is present and < 0.5
}

type AiCaptionsLine = {
  id: string
  text: string
  startMs: number
  endMs: number
}

type AiCaptionsStyle = {
  styleId: string
  name: string
  kind: 'builtin' | 'saved'
}

type AiCaptionsResult = {
  clipId: string
  projectId: string
  editorUrl: string            // /app/clips/{projectId}/edit/{clipId}?tab=captions
  durationMs: number
  styleId: string
  captionsEnabled: true
  bounds: { startMs: 0; endMs: number }  // endMs === durationMs
  words: AiCaptionsWord[]
  lines: AiCaptionsLine[]
  playbackUrl: string | null
  thumbnailUrl: string | null
  downloadUrl: string | null   // burned-in MP4, no watermark, no tier gate
  srtUrl: string               // .srt from the same lines as the burn-in
}
```

`styleId` identifies a built-in preset or a saved style. `assetId` is a media asset on the given project (library upload id). `lowConfidence` is always present on each word. The coverage rule is: every transcript word in `[0, durationMs]` appears in `words` and in some `lines` entry, including its text and timing.

## 1. Create a run

`POST /api/ai-captions/runs`

Require an `Idempotency-Key` request header **or** `clientRequestId` in the JSON body (if both are sent they must be identical). The key is scoped to the workspace. A retry with the same key and an equivalent source and `styleId` returns the original run and does **not** start a second job (`200`). The same key with a different source or `styleId` is `409` `idempotency_key_reuse`. A missing key is `400` `idempotency_key_required`.

Captions start automatically on this request. Do not wait for a second call to begin transcription or caption generation.

```ts
{
  clientRequestId?: string     // optional if Idempotency-Key is set
  source: AiCaptionsSource
  styleId?: string             // built-in or saved; omit to use lastStyleId, else clean_white
}
```

- `kind: 'upload'` is a READY uploaded project in this workspace (`projectId`). This is the primary path: Frontend uploads with the existing upload API, then passes the new `projectId`, or the user picks an existing project.
- `kind: 'asset'` is an existing media asset (`assetId`) on a project in this workspace. No re-upload.
- After ingest, upload and asset sources are indistinguishable. The same pipeline runs for both.
- The project or asset must be READY. Otherwise `400` `source_not_ready`. Missing or cross-workspace ids are `404` `source_not_found`. A source with no audio is `400` `source_has_no_audio`.
- An unknown `styleId` is `400` `unknown_style_id`.
- There is **no captions-specific duration cap**. This path must accept 20–30+ minute sources. It uses the regular uploaded-project transcript path, not the 3-minute BYO path. The existing clip upload limit (10 hours) is unchanged; sources above that existing upload limit fail with the existing upload error, not a new captions cap.

`201` on a new run, `200` on an idempotent replay:

```ts
{ data: { runId: string, status: AiCaptionsStatus, creditEstimate: number } }
```

`creditEstimate` is an integer credit count. It is informational only, never a dollar amount, and is never charged in v1.

## 2. Read a run

`GET /api/ai-captions/runs/:runId`

`200` when the run exists in this workspace. `404` if it is missing or belongs to another workspace. Frontend polls this endpoint.

```ts
{
  data: {
    runId: string
    status: AiCaptionsStatus
    stage: AiCaptionsStage | null
    progressPercent: number | null    // 0–100; null before work starts
    failureCode: string | null
    failureMessage: string | null     // human, no $
    creditEstimate: number | null     // integer credits; informational; not charged
    styleId: string | null
    result: AiCaptionsResult | null   // set only when status is 'ready'
  }
}
```

| status | meaning |
|---|---|
| `queued` | Accepted, not started |
| `transcribing` | Running or waiting on the existing transcription path |
| `captioning` | Building caption words and sentence-aware lines |
| `exporting` | Optional burned-in MP4 is in progress; SRT may already be available on a later ready result |
| `ready` | Clip, captions, and SRT are written; `result` is present |
| `failed` | Terminal failure; `failureCode` and `failureMessage` are set |

A project that already has a transcript skips `transcribing` and goes straight to `captioning`.

When `ready`:

- The clip bounds are `startMs` 0 and `endMs` equal to `durationMs`. `captionsEnabled` is `true`.
- `styleId` is the style actually applied (requested, else last used, else `clean_white`).
- Word highlight (`keywordHighlight`) and auto-emoji (`autoEmojis`) are **off** unless the applied saved style explicitly turns them on.
- `words` are word-level, with punctuation preserved, and include `lowConfidence` from ASR confidence.
- `lines` are sentence-aware groups of those words. Oversized cues split on **word boundaries** only (the #1132 caption-lines rule), never mid-word, and no transcript word is dropped.
- `editorUrl` is `/app/clips/{projectId}/edit/{clipId}?tab=captions`. That path permanently redirects to the clip editor (`/app/video-editor/{projectId}/edit/{clipId}?tab=captions`). The Captions tab is the intended landing tab. Words and timing stay editable through the existing clip edits and caption-words path (`writeClipEdits` / clip PATCH). This product does not add a second edit API.
- `srtUrl` is `GET /api/ai-captions/runs/:runId/srt` (same lines used for the burned-in MP4).
- `downloadUrl` is the burned-in MP4 when an export has completed; it is `null` until then. MP4 and SRT have **no watermark** and **no tier gate**.

## 3. Styles

Default built-in style is `clean_white` (Clean White). The 14 built-in presets are the existing caption preset list, reused read-only:

`clean_white`, `bold_pop`, `boxed`, `karaoke`, `minimal`, `neon`, `bounce`, `typewriter`, `slide_up`, `highlighter`, `word_pop`, `karaoke_highlight`, `heavy_outline`, `lower_third`.

`GET /api/ai-captions/styles`

```ts
{
  data: {
    defaultStyleId: 'clean_white'
    lastStyleId: string | null
    styles: AiCaptionsStyle[]     // 14 builtin, then saved styles for this workspace
  }
}
```

`lastStyleId` is the workspace’s last applied or last saved caption style, when one exists.

`POST /api/ai-captions/runs/:runId/style`

Reapply a style after generation (or while captioning completes). Body:

```ts
{ styleId: string }
```

`200` with the same run payload as `GET`. The clip’s caption style is updated, `result.styleId` changes, and this `styleId` becomes `lastStyleId` for the workspace. An unknown id is `400` `unknown_style_id`. A run that has not reached `ready` and is not still `captioning` may return `409` `style_not_applicable`. Re-applying the same `styleId` is idempotent and returns the current run.

Saved styles are the workspace’s existing “My presets” (`styleId` is that saved preset’s id, `kind: 'saved'`). Built-in ids use the preset ids above (`kind: 'builtin'`).

## 4. SRT and burned-in export

`GET /api/ai-captions/runs/:runId/srt`

`200` `text/plain` with `Content-Disposition: attachment; filename="captions.srt"` when the run is `ready`. The file is generated from `result.lines` (the same lines as the burned-in MP4). `404` if the run is missing; `409` `srt_not_ready` if the run is not yet `ready`.

`POST /api/ai-captions/runs/:runId/export`

Starts a burned-in MP4 export of the full-video clip, with an SRT sidecar, **no watermark** and **no tier gate**. `200` (already running or already exported) or `202` (queued):

```ts
{ data: { runId: string, status: AiCaptionsStatus, downloadUrl: string | null, srtUrl: string } }
```

Poll `GET /api/ai-captions/runs/:runId` until `downloadUrl` is set. Re-posting after a successful export returns the current URLs and does not start a second render.

## 5. Credits

Credits are informational only in v1. Never charge. Never show `$`. Never include a dollar field or a USD amount in these responses.

The estimate is one config value: `CAPTIONS_RUN_CREDITS`. If the env var is unset or invalid, the placeholder default is `10`. That default is a placeholder, not a pricing decision. `creditEstimate` on create and on `GET` equals that integer.

## 6. Errors

JSON errors use `{ error: { code, message } }`. `message` is human-readable and must not contain `$`.

| code | HTTP | when |
|---|---|---|
| `idempotency_key_required` | 400 | missing Idempotency-Key and clientRequestId |
| `idempotency_key_reuse` | 409 | same key, different source or styleId |
| `source_not_ready` | 400 | project or asset is not READY |
| `source_not_found` | 404 | unknown or cross-workspace project or asset |
| `source_has_no_audio` | 400 | no audio to transcribe |
| `unknown_style_id` | 400 | styleId is not a builtin or saved style in this workspace |
| `style_not_applicable` | 409 | style change is not allowed in the current status |
| `srt_not_ready` | 409 | SRT requested before the run is ready |
| `export_not_ready` | 409 | export requested before the run is ready |
| `run_not_found` | 404 | unknown or cross-workspace run |

## 7. Product page

Authenticated app route: `/app/captions`. Marketing landing `/ai-captions` is later and is not part of this contract. The result screen (Frontend) is preview + Download + Edit. Edit uses `result.editorUrl`. Download uses `result.downloadUrl` (MP4) and `result.srtUrl` (SRT).

## 8. Engine notes (backend)

- Copy or wire into `new-app/lib/ai-captions/`. Do not modify clipper, editor, streamer, clip-mode, or `unified-clip-run` originals.
- Transcription: existing project or media transcript path, mocked in tests, no live paid provider calls in CI.
- Line grouping: sentence-aware (do not split immediately after a mid-sentence word); oversized cues use the #1132 word-boundary split (`splitTokensByMaxChars` / worker `caption_lines`). Import those helpers read-only; if a copy is required, do not change the original files.
- Low-confidence threshold: `0.5` on ASR `p`. Flag only when `p` is present.
- Coverage test: caption `words` cover all transcript words for the full duration.
- Default style: `clean_white`. Word highlight and auto-emoji off unless a saved style turns them on.
- Last or saved style is stored per workspace and reapplied by `styleId`.
