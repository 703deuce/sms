# Motion Studio (documentaries): Backend API contract v1.1

**Status: matches the merged frontend** (PR #1260, master 277e1c54). The types are `new-app/lib/motion-studio/types.ts`, and the live client is `new-app/lib/motion-studio/client.ts`; both are the source of truth for shapes. Turn the live backend on with `NEXT_PUBLIC_MOTION_STUDIO_LIVE=1`. Owner: Backend Engineer. Updated 15 Nov 2026, ~2:00 AM ET. The repo copy is `docs/contracts/motion-studio-v1.md`.

## 0. Principles
- **Reuse, don't fork.**
  - Uploads use the existing clips upload path (`uploadClipFile(..., {kind:'media'})`, which returns `uploadId`).
  - Auth uses `resolveWorkspaceId`.
  - Jobs go on the existing `clip_jobs` queue on the clips worker, as the types `DOC_PLAN`, `DOC_PRODUCE`, `MGD_RENDER_SEGMENT` and `DOC_ASSEMBLE`.
  - Analysis reuses the clipper analysis.
  - The timeline is the Compact Editor (`ClipEditsV2` plus the optional `edits.motionStudio` extension).
- One project = one `MotionStudioProject`, one canvas `ClipProject` (`sourceKind:'motion_studio'`) and one editor `Clip`.
- Times are in milliseconds.
- **No currency anywhere.** Allowance `credits`/`estimateCredits` are `null` until D2, and charging is OFF.
- **Envelope.** Mutations and `GET /projects/:id` return `{ project: MsProject }`. Lists return `{ projects }`, `{ assets }` or `{ allowance }`.
- **Auth (PR #1264):** every `/api/motion-studio/*` route requires a signed-in session (Supabase cookie; the client sends same-origin credentials). No session → `401 UNAUTHENTICATED`; a signed-in user with no workspace membership → `403 FORBIDDEN`. All reads and writes are scoped to the caller's own workspace (the pinned workspace when the user is a member of it, else their oldest membership). An id from another workspace returns `404 NOT_FOUND`, never 403.
- **Errors** are `{ error, code }` with an HTTP status. The codes are `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID`, `NOT_FOUND`, `CONFLICT`, `STAGE_NOT_RETRYABLE`, `DISABLED` and `INTERNAL`. Messages never contain keys, signed URLs, provider names or prompts.
- **Export seam gate (ST-CMH-014):** `POST /export` returns `409 CONFLICT` while a footage handoff in the latest assembly failed its seam check (QA `A15`); regenerate that scene, then export.
- **Faces (G2):** `assets[].analysis.faces` is the number of faces found (YuNet, local). People are grouped across photos and footage server-side (P1..Pn); no new field is required.
- **Idempotency-Key** (a header; the body `idempotencyKey` is also accepted):
  - create is deduped per user (`userId:key`, unique per workspace);
  - plan, run, regenerate (per scene), retry (per stage) and export are deduped per project. Keys are stored atomically under a row lock, so a repeated key returns the current project and starts nothing.
  - Separately from the keys, the job enqueue is deduped: there is never a second QUEUED/RUNNING job of the same type (or for the same scene).
- No automatic paid retries. Every job has `maxAttempts=1`, and retry is manual (`/steps/:stage/retry`).

## 1. Lifecycle (what each call does)
`createProject` → `status:'setup'` (no job queued) → `PATCH settings` → `POST /plan` (enqueues `DOC_PLAN` = analysis + story + visual plan; **never renders**) → `status:'planning'` → plan done → `status:'awaiting_review'`.

Production starts only when **both** hold: `POST /run` was called **and** (`mode:'auto'` **or** `POST /story/approve` was called). Either order works:
- `/run` with mode auto, sent during planning, continues straight into production when the plan finishes.
- With checkpoint mode, production starts on approve.

This decision is made under a row lock that the web and the worker share (`finish_plan`), so exactly one `DOC_PRODUCE` is queued.

`producing` (narration → per-scene renders) → `review` (the assembled master exists) → `POST /export` → `complete` (the master is already rendered, so export marks it delivered; if scenes changed, `exporting` shows until re-assembly finishes).

## 2. Status mapping (backend → `MsProjectStatus`)

| Backend row | FE status |
|---|---|
| `setup` | `setup` |
| queued/running, no plan yet or stage `story`/`direct` | `planning` |
| `awaiting_approval` | `awaiting_review` (story stage = `needs_review` when checkpoint and not approved) |
| running after the plan | `producing` (`exporting` if export was requested) |
| `review` | `review`, or `complete` once export was requested |
| `failed` / `cancelled` | `failed` (`error` is a friendly message) |

Stages are the six FE `MsStageId`s, each with a status and `progressLabel` (for example "3 of 5 uploads analyzed" or "12 of 15 scenes"). `activity` holds the five `MsActivityStep`s with counts and the latest action for each stage.

## 3. Endpoints (all under `/api/motion-studio`)

| Method + path | Body | Returns |
|---|---|---|
| `GET /config` | | lengths, directions, voiceovers, productionModes, formats, mediaPolicy, music options, features |
| `GET /projects` | `?limit&cursor` | `{ projects: MsProjectSummary[], nextCursor }` |
| `POST /projects` | `MsCreateInput` `{workflow, prompt, script?, uploads:[{uploadId, kind, label}], mediaPolicy:'uploads_only', idempotencyKey}` | `{ project }` (201 new / 200 replay) |
| `GET /projects/:id` | | `{ project }` |
| `PATCH /projects/:id` | `{ title?, settings?: Partial<MsSettings> }` | `{ project }` (409 if `lengthMin` changes after the plan exists) |
| `POST /projects/:id/plan` | Idempotency-Key | `{ project }` |
| `POST /projects/:id/run` | `{ mode: 'checkpoint'\|'auto' }` + key | `{ project }` (409 before a plan was requested) |
| `POST /projects/:id/story/approve` | | `{ project }` |
| `POST /projects/:id/story/changes` | `{ note }` | `{ project }` (re-plans with the note; unchanged scenes reuse cached renders) |
| `GET /projects/:id/activity` | `?after=<eventId>&limit` | `{ events: MsActivityEvent[], cursor }` (only events after `after`; `cursor` = last id) |
| `GET /projects/:id/assets` | | `{ assets: MsAsset[] }` |
| `POST /projects/:id/assets` | `{ uploads:[{uploadId, kind, label}] }` | `{ project }` |
| `POST /projects/:id/assets/:assetId/replace` | `{ withAssetId }` | `{ project }` (re-renders only the affected scenes) |
| `PATCH /projects/:id/scenes/:sceneId` | `MsScenePatch` `{startMs?, endMs?, style?, camera?, text?, params?}` | `{ project }` (re-renders that scene if production already ran) |
| `POST /projects/:id/scenes/:sceneId/regenerate` | `{ instruction }` + key | `{ project }` (409 before the scene was produced) |
| `POST /projects/:id/director` | `{ message, sceneId? }` | `{ project }` (adds a proposal and chat messages; nothing is applied) |
| `POST /projects/:id/proposals/:pid/accept` | `{ itemIds: string[] \| 'all' }` | `{ project }` |
| `POST /projects/:id/proposals/:pid/reject` | `{ itemIds: string[] \| 'all' }` | `{ project }` |
| `POST /projects/:id/steps/:stage/retry` | key | `{ project }` (409 `STAGE_NOT_RETRYABLE` unless failed) |
| `GET /projects/:id/allowance` | | `{ allowance: MsAllowance }` (all credits `null`) |
| `POST /projects/:id/export` | key | `{ project }` |
| `GET /projects/:id/export/download` | | `{ url, filename }` (short-lived signed URL; 409 until ready) |
| `POST /projects/:id/open-in-editor` | | `{ clipProjectId, clipId }`. Creates or syncs the Compact Editor clip from the timeline (409 before the first cut). The FE routes to `/app/video-editor/{clipProjectId}/edit/{clipId}?motionStudio={id}` |
| `POST /projects/:id/cancel` | | `{ project }` (extra) |
| `GET /projects/:id/timeline` | | `{ clipProjectId, clipId, edits, compactEditorUrl }` (extra, read convenience) |

### Field notes
- **Uploads.** `kind` comes from the FE (`photo|video|audio|script`). The mime type wins when they disagree.
  - An audio upload whose label matches `vo|voice|voiceover|narrat` becomes the narration (and `settings.voiceover` = `upload`).
  - Any other audio upload becomes the music (`music: 'upload'`).
  - Storage keys stay server-side only.
- **Settings** are the FE `MsSettings` (`lengthMin`, `visualDirection`, `voiceover`, `format:'16:9_1080p'`, `productionMode`). `PATCH` also accepts an optional, non-FE `settings.music: 'generated'|'upload'|'elevenlabs'|'none'`:
  - `elevenlabs` is the optional tier from #1230: one generation per project and length, reused on re-assemble, never retried automatically, and it falls back to `generated` when unavailable.
  - The default is always `generated`.
- **Scenes.** `MsScene` plus these optional fields:
  - `thumbnailUrl` (still) and `previewUrl` (segment MP4);
  - `params` (the stored per-type inspector params: chart/photo/clip key→string|number|boolean);
  - `error` (friendly text).
  - Before narration exists, `startMs`/`endMs` are estimated from word counts. After production they are exact program times.
  - `handoff` = `{assetId, approachMs:1400, footageMs, returnMs:1200, exit:'return'|'cut'}`.
- **Assets.** `MsAsset` with `url` (a short-lived signed preview) and analysis `{status, summary, transcriptExcerpt, faces, objects, shots}`.
- **Project.** `previewUrl` is the assembled small export (signed) once it exists. `allowance` is always non-null, with `estimateCredits: null`. `isExample` is `false` (examples are FE-only). `missingVisuals` is `[]` in v1.
- **Activity events.** `{id, at, stage, kind:'reasoning'|'action'|'status'|'warning', text}`. They never contain keys, signed URLs, prompts or raw model output.

## 4. Timeline = Compact Editor `ClipEditsV2` + `motionStudio` extension
**As built (v1):** the Compact Editor clip's canvas source is the **assembled program MP4** (picture + full mix: VO, clip audio, SFX, music at -15 LUFS). That keeps preview, captions and `RENDER_CLIP` export working unchanged with no duplicate audio items:
| Motion Studio track | Stored in `ClipEditsV2` | Notes |
|---|---|---|
| Program (all scenes + handoffs + mix) | canvas source (`ClipProject.uploadId`, `sourceKind:'motion_studio'`) | `trim {0, durationMs}`, `layout.mode:'full_frame'` |
| Captions | project/clip `words.json` = narration word timings on the program clock | existing caption pipeline |
| Chapters | `markers[]` (`chapter: true`) | one per chapter, at its first spoken word |
| Scenes / handoffs / graphics / VO / music / SFX | `edits.motionStudio.tracks[].items` | read-only structure for the timeline UI (labels VIDEO, VIDEO · footage, GRAPHICS, VOICE, MUSIC, SFX) |

Per-scene edits go through `POST …/scenes/{sceneId}/regenerate` then `POST …/export`, which re-assembles and bumps `timelineVersion`; `GET …/timeline` re-syncs the editor clip when the version changed (user edits to other fields are kept). Splitting the program into `sourceSegments[]` per scene is a later step (needs per-scene audio stems).

Extension (ignored by the renderer; preserved by `normalizeEdits`; excluded from the render-cache hash):
```ts
edits.motionStudio = {
  v: 1, projectId: string, timelineVersion: number, durationMs: number, fps: number,
  tracks: { id: 'ms_scenes'|'ms_handoff'|'ms_graphics'|'ms_vo'|'ms_music'|'ms_sfx'; kind: 'scenes'|'handoff'|'graphics'|'vo'|'music'|'sfx'; label: string;
            items: { id: string; startMs: number; endMs: number; label?: string; sceneIndex?: number; chapter?: number; inMs?: number; source?: string }[] }[],
  segments: { segmentId: string; sceneId: string; kind: 'graphics'|'handoff'|'hardcut'; visualType: string; renderHash: string|null; startMs: number; endMs: number; frames: number;
              handoff?: HandoffRecord /* BE-13: inFrame/outFrame/inPts/outPts, transformId, surface params, enter/playback/exit frame ranges, exitStyle/exitReason, cutType/cutJustification, handles, audioTail, seamScores, seamPass, decodeVerified, renderHash */ }[]
}
```

## 5. What the frontend must not do
- Never show `$`, keys or provider names for costs. Credits UI shows "Included" while charging is off.
- Never pick templates/transitions/camera for the user (Director's job); inspector overrides post-generation only.
