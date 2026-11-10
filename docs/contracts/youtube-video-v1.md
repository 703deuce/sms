# YouTube video v1 contract

Status: **draft** for Frontend (`/app/youtube-video`). Version `1`. Workspace-scoped, same auth as existing clip / AI producer APIs. Additive schema only.

This document is the single canonical name set. Use these fields and paths exactly. An option is identified by `options[].id`. The choose request body is `{ optionId }`, and that is the only use of the name `optionId`.

Mode 2 is a **separate product**, not a clipper mode. `/app/clips` stays Mode 1 only. There is no mode toggle and no results grid. One run produces **one** long-form video (premise, progression, payoff; no fixed length). Edit opens that video in the **clip editor**.

Uploads are the primary input. A Twitch/Kick URL is ingested with the **existing** import, unchanged, including its 3 hour cap, and then enters the **exact same** pipeline as an upload. After ingest, upload and URL sources are indistinguishable. Mixed lists are allowed. No live billing; never show `$`. Credits on this contract are informational only and are not charged.

Engine (backend, copied — do not edit the clipper/editor originals): Clean Take plus the clipper Story agent, with no length cap. Content-agnostic (gaming, podcasts, interviews, IRL, talking-head): do not frame a run as `just_chatting_rough_cut` and do not add genre-specific prompt text. Import the clipper’s content detection and editorial rules read-only. Story finds the premise from the source; do not assign an angle. Long sources use the editor’s 20-minute analysis chunks, then one global assemble. A simple transcript packer keeps a whole-source view. Output is one `Clip` row whose EDL bounds are the assembled duration.

## Shared types

```ts
type YoutubeVideoBeat = {
  label: string
  startMs?: number
  endMs?: number
  sourceId?: string
  evidence?: string
}

type YoutubeVideoOption = {
  id: string
  title: string
  premise: string
  beats: YoutubeVideoBeat[]
  estDurationMs?: number
}

type YoutubeVideoPlan = {
  premise: string
  beats: YoutubeVideoBeat[]
}

type YoutubeVideoChapter = {
  title: string
  startMs: number
}
```

`options[].id` identifies an option. `beats[].label` is the beat name. `sourceId` and `evidence` live on the beat when known.

## 1. Create a run

`POST /api/youtube-video/runs`

Require an `Idempotency-Key` request header **or** `clientRequestId` in the JSON body (if both are sent they must be identical). The key is scoped to the workspace. A retry with the same key and an equivalent source list returns the original run and does **not** start a second job (`200`). The same key with a different source list is `409` `idempotency_key_reuse`. A missing key is `400` `idempotency_key_required`.

```ts
{
  clientRequestId?: string            // optional if Idempotency-Key is set
  instruction?: string                // optional, max 4000; do not assign a story angle if omitted
  sources: Array<                     // 1–5 items, order is submission order
    | { kind: 'upload'; projectId: string }
    | { kind: 'url'; url: string }    // Twitch or Kick URL only
  >
}
```

- `kind: 'upload'` is an already-READY uploaded project in this workspace (`projectId`). This is the primary path (2A = one upload, 2B = 2–5 uploads).
- `kind: 'url'` is a Twitch or Kick link. The server calls the existing import as-is (3 hour cap, existing error codes). On success the imported project is an upload and is fed into the same pipeline. Unsupported hosts (including raw YouTube links in v1) are `400` `unsupported_source_url`.
- Mixed upload + URL lists are allowed (max 5 total). After ingest, every source is an upload project; the pipeline does not branch on origin.
- The source must have (or, for a URL, obtain) a transcript before planning starts. An upload that is not READY is `400` `source_not_ready`.

`201` on a new run, `200` on an idempotent replay:

```ts
{ data: { runId: string, status: YoutubeVideoStatus } }
```

## 2. Read a run

`GET /api/youtube-video/runs/:runId`

`200` when the run exists in this workspace. `404` if it is missing or belongs to another workspace. Frontend polls this endpoint.

```ts
{
  data: {
    runId: string
    status: YoutubeVideoStatus
    stage: YoutubeVideoStage | null
    progressPercent: number | null    // 0–100; null before work starts
    failureCode: string | null
    failureMessage: string | null     // human, no $
    creditsEstimated: number | null   // integer credits; informational; not charged
    options: YoutubeVideoOption[] | null  // set only when status is 'awaiting_choice'
    result: YoutubeVideoResult | null     // set only when status is 'ready'
  }
}
```

`YoutubeVideoStatus`:

| status | meaning |
|---|---|
| `queued` | Accepted, not started |
| `importing` | At least one URL is going through the existing import |
| `running` | Ingest, planning, assembling, or writing the clip |
| `awaiting_choice` | Story options are ready; `options` is populated; waiting for choose |
| `ready` | One clip was written; `result` is populated |
| `failed` | Terminal failure; see `failureCode` |
| `canceled` | Caller or system canceled; no clip |

`YoutubeVideoStage` (when `status` is `importing` or `running`; otherwise `null`):

| stage | typical percent |
|---|---|
| `importing` | 0–15 |
| `ingest` | 15–40 |
| `planning` | 40–70 |
| `assembling` | 70–90 |
| `applying` | 90–99 |

### Failure codes

| `failureCode` | when |
|---|---|
| `invalid_request` | Bad body (count, kinds, URL, instruction length, missing key, missing `optionId`) |
| `source_not_ready` | An upload project is missing, not in this workspace, or not READY |
| `unsupported_source_url` | URL is not a Twitch or Kick link |
| `import_failed` | Existing import failed (includes the 3 hour cap and other import errors, unchanged) |
| `ingest_failed` | Transcript or source media could not be prepared |
| `pipeline_failed` | Copied Clean Take / Story pipeline could not produce a usable plan |
| `no_story` | Footage did not support a truthful long-form story; nothing was invented |
| `apply_failed` | The clip / EDL could not be written |
| `canceled` | Run was canceled |

Auth uses the existing workspace 401/403 behavior. `409` `run_in_progress` if this workspace already has a YouTube-video run in `queued`, `importing`, `running`, or `awaiting_choice`.

## 3. Choose a story option

`POST /api/youtube-video/:runId/choose`

```ts
{ optionId: string }    // this is the only use of the name optionId; it is options[].id
```

Allowed only when `status` is `awaiting_choice` or after a choice was already made for this run.

- The `optionId` must match an `options[].id` on this run. Unknown ids are `400` `invalid_request`.
- First valid choose starts assembly of that option; the run leaves `awaiting_choice` and becomes `running`, then `ready`.
- Re-choosing the **same** `optionId` is idempotent: return the current run (`200`) and do not restart work.
- Choosing a **different** `optionId` after a choice has already been made is `409` `option_already_chosen`.
- If `status` is not `awaiting_choice` and no choice has been made (for example `queued` or `running` before options exist), the request is `409` `choice_not_available`.

`200`:

```ts
{ data: { runId: string, status: YoutubeVideoStatus } }
```

## 4. Result (when `status === 'ready'`)

This is **one** video, not a list.

```ts
{
  clipId: string
  projectId: string
  editorUrl: string                 // path: /app/clips/{projectId}/edit/{clipId}
  durationMs: number                // assembled EDL duration
  durationSeconds: number
  playbackUrl: string | null        // short-lived signed preview/playback URL
  thumbnailUrl: string | null       // short-lived signed poster, if available
  downloadUrl: string | null        // short-lived signed MP4 when an export exists; else null
  plan: YoutubeVideoPlan            // premise + beats of the chosen option, with times filled in
  chapters: YoutubeVideoChapter[]   // [{ title, startMs }, ...] in output time
  chapterText: string               // plain-text chapter list for the description
}
```

`editorUrl` is a same-origin path into the **clip editor** (not the full timeline / script-editor hub). The record is a normal `Clip` (`startMs` / `endMs` / `edits` EDL bounds equal the assembled duration). Frontend should not open `/app/editor`.

`playbackUrl`, `thumbnailUrl`, and `downloadUrl` are short-lived signed URLs from the existing clip media / export storage. If a URL 403s, Frontend re-GETs this run and uses the fresh URLs. `downloadUrl` may stay `null` until an export is ready; the editor still opens.

On first apply, the written edits are also stored on the clip as `aiMeta.aiOriginalEdits` so revert can restore them.

## 5. Revert

`POST /api/youtube-video/:runId/revert`

Allowed when `status` is `ready` and the result clip exists. Restores that clip’s edits from `clip.aiMeta.aiOriginalEdits` through the existing `writeClipEdits` path. The run stays `ready`. `options`, `plan`, `chapters`, and `chapterText` are unchanged.

- Re-posting revert is idempotent and returns the current run (`200`) if the clip is already at the stored original.
- `409` `revert_not_available` if the run is not `ready`, the clip is missing, or `aiMeta.aiOriginalEdits` is missing.

`200`:

```ts
{ data: { runId: string, status: 'ready', result: YoutubeVideoResult } }
```

## 6. Credits (informational only)

`creditsEstimated` is a non-negative integer, or `null` until it can be computed (usually after ingest knows source durations). It is **not charged** in v1. Live credit charging stays off. Never show `$`. Frontend may display the number as credits.

Estimate (documented so Frontend can show the same figure if it caches the create response later): after ingest, `max(1, ceil(totalSourceMinutes / 10) + (sourceCount - 1) * 2)`. This is not a price.

## 7. Create-run idempotency

- Header `Idempotency-Key` or body `clientRequestId` (same string space, 8–128 chars, `[A-Za-z0-9._:-]`).
- Key is stored with a canonical hash of the source list + instruction for this workspace.
- Same key + same request: return the existing `runId` / `status` (`200`), even if the first run later failed.
- Same key + different request: `409` `idempotency_key_reuse`.
- A new key always creates a new run (`201`), subject to `run_in_progress`.

Choose and revert have their own idempotency rules in sections 3 and 5. They do not use `Idempotency-Key`.

## HTTP summary

| HTTP | when |
|---:|---|
| 200 | Idempotent replay of create, successful GET, choose, or revert |
| 201 | New run created |
| 400 | Invalid body, missing idempotency key, source not ready, unsupported URL, unknown `optionId` |
| 401 / 403 | Existing workspace auth |
| 404 | Run or referenced upload not in this workspace |
| 409 | Create-key reuse with a different body; a run already in progress; a different option after a choice; choose before options exist; revert not available |

No `$` in error messages.

## Engine notes for implementers (v1)

Content-agnostic: the same pipeline handles gaming, podcasts, interviews, IRL, and talking-head. Do not frame the run as `just_chatting_rough_cut` and do not add gaming-only or other genre-specific prompt text in the copied engine. Import the clipper’s content detection and editorial rules read-only; do not fork those files. Do not assign a story angle in the request or in prompts — Story finds the premise from the source.

Uploads are the primary input. A `kind: 'url'` source only calls the existing import (3 hour cap, unchanged) and then follows the upload path. After ingest, upload and URL sources are identical. Tests must mock the URL/import path; no live Twitch/Kick downloads.
