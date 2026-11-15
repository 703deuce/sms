# Transovo Studio (Motion Studio, documentaries) — Backend API contract v1

> **Issue alignment (1:15 AM ET, 15 Nov 2026):** route prefix is `/api/motion-studio/*` per #1211 (BE-2). Activity events = `StudioActivityEvent` (#1221), assets = `StudioAsset` (#1210), handoff segment record fields per #1222 (BE-13), director registry with one entry `documentary` (#1210). Timeline track labels VIDEO / GRAPHICS / VOICE / MUSIC (#1236 FE-6). Media policy fixed to `uploads_only` in v1 (#1231 FE-1).

Owner: Backend Engineer. Status: **DRAFT for Frontend agreement** (written 15 Nov 2026, ~1:10 AM ET). Repo copy: `docs/contracts/motion-studio-v1.md`.
Spec: `specs/transovo-studio-build.md` (D3: UI `/app/documentary`, API `/api/motion-studio/*`).

## 0. Principles
- **Reuse, don't fork.** Uploads = existing clip uploads (`/api/clips/uploads`). Storage, auth (`resolveWorkspaceId`), job queue (`clip_jobs` on the clips worker), clipper analysis (Deepgram transcription + Gemini watch) and the **Compact Editor data model (`ClipEditsV2`)** are reused.
- **One Motion Studio project = one canvas `ClipProject` + one editor `Clip`.** The editable timeline *is* `Clip.edits` (`ClipEditsV2`), opened in the Compact Editor at `/app/video-editor/{clipProjectId}/edit/{clipId}?mode=compact` (same handoff as Ad Studio). Motion Studio adds an optional `edits.motionStudio` extension (track kinds + scene/handoff metadata). **No new editor format.**
- All times are **milliseconds** unless the field ends in `S` (seconds).
- **No `$` anywhere.** `creditEstimate` is `null` (credits charging is OFF).
- Errors: `{ "error": string, "code": string }` with HTTP status. Codes: `INVALID`, `NOT_FOUND`, `CONFLICT`, `STAGE_NOT_RETRYABLE`, `INTERNAL`.
- Auth: same session/workspace as the rest of `/app` (cookie). Every route is workspace-scoped.
- Idempotency: `POST /projects` honours `Idempotency-Key` (same key → same project, 200 instead of 201).

## 1. Upload flow (existing, unchanged)
1. `POST /api/clips/uploads` `{ filename, bytes, mime, kind: "media" }` → `{ data: { uploadId, key, storage } }` (signed upload; multipart via `/api/clips/uploads/{id}/parts|chunk`).
2. `POST /api/clips/uploads/{id}/complete`.
3. Pass the `uploadId`s to Motion Studio (create, or `POST /projects/{id}/assets`). Videos, images and audio are accepted. A pasted or uploaded **text** script is sent as the `script` string (the UI reads the text file).

## 2. Enums
- `workflow`: `idea` ("Start with idea") | `script` ("Use a script") | `footage` ("Edit my footage").
- `settings.lengthMin`: `3 | 5 | 10 | 15` (10/15 = Beta).
- `settings.visualDirection`: `auto | cinematic_documentary | netflix_financial | archival_history | modern_explainer | 3d_technical | minimal_editorial` (free text accepted in `visualNotes`).
- `settings.voiceover`: `ai_brian` (ElevenLabs Brian, default) | `upload` (user narration audio, `narrationUploadId`) | `none`.
- `settings.aspect`: `16:9` (default) | `9:16` | `1:1`.
- `settings.automation`: `checkpoint` (pause after story + visual plan, default) | `auto` (fully automatic).
- `settings.music`: `generated` (default; code-generated beat-keyed score) | `upload` (`musicUploadId`) | `elevenlabs` (optional ElevenLabs music tier, #1230 BE-22: one generation per project/length, reused on re-assemble, no automatic retries, falls back to `generated` if unavailable) | `none`. No price/credit fields.
- Server-side the web resolves `narrationUploadId`/`musicUploadId` to storage keys (`settings.voiceoverUploadKey` / `settings.musicUploadKey`) for the worker; those keys are never returned to the client.
- Project `status`: `queued | running | awaiting_approval | review | failed | cancelled`.
- `stage` (the six concept stages, in order):
  `story` ("Develop the story") → `assets` ("Prepare the footage and assets") → `direct` ("Direct the documentary") → `graphics` ("Generate motion graphics") → `assemble` ("Assemble and mix") → `review` ("Review and export").
  Internal order on the worker: `assets` runs first when there are uploads (analysis feeds the story), then `story`, `direct`, checkpoint, narration (part of `assemble` prep, shown as `story`→`assemble` sub-step `narration`), `graphics`, `assemble`.
- Stage status: `pending | running | done | needs_review | failed | skipped`.
- Scene `visualType`: `footage | photo | diagram | map | chart | cinematic | interview | title | none`.
- Scene `status`: `planned | rendering | qa | fixing | ready | fallback | failed`.

## 3. Endpoints

### `GET /api/motion-studio/config`
→ `{ lengths:[3,5,10,15], betaLengths:[10,15], visualDirections:[{id,label}], voiceovers:[{id,label}], aspects:[...], automation:[...], music:[...], features:{ narration:boolean, groundedResearch:boolean, generatedMusic:true, elevenLabsMusic:boolean, customSceneCode:boolean }, mediaPolicy:'uploads_only', stages:[{id,label}], creditEstimate:null }`

### `POST /api/motion-studio/projects` (Start)
Body:
```json
{ "brief": "Make a documentary about the GameStop short squeeze in 2021.",
  "workflow": "idea",
  "title": null,
  "script": null,
  "uploadIds": ["upl_..."],
  "settings": { "lengthMin": 5, "visualDirection": "auto", "visualNotes": "", "voiceover": "ai_brian",
                "narrationUploadId": null, "aspect": "16:9", "automation": "checkpoint",
                "music": "generated", "musicUploadId": null } }
```
- `brief` 1..20000 chars (≥ 2,000-char briefs accepted). `script` ≤ 60000 chars, required for `workflow=script` unless `settings.voiceover=upload`.
- Creates the project + canvas ClipProject, attaches uploads as project media, writes the activity event, and queues the **planning** run (analysis/story/direct). **No narration or render is queued until the plan exists** (and, in `checkpoint` mode, until `/approve`).
- Header `Idempotency-Key` (recommended).
→ `201 { project: ProjectView }` (or `200` on idempotent replay).

### `GET /api/motion-studio/projects?limit=20&cursor=`
"My projects", newest first → `{ projects: ProjectSummary[], nextCursor: string|null }`.
`ProjectSummary = { id, title, status, stage, workflow, createdAt, updatedAt, thumbnailUrl|null, durationMs|null }`

### `GET /api/motion-studio/projects/{id}`
→ `{ project: ProjectView }` — poll every 2–4 s while `status` is `queued|running`.

```ts
type ProjectView = {
  id: string; title: string; brief: string; workflow: 'idea'|'script'|'footage'
  status: 'queued'|'running'|'awaiting_approval'|'review'|'failed'|'cancelled'
  stage: Stage; stages: { id: Stage; label: string; status: StageStatus; startedAt?: string; finishedAt?: string; detail?: string }[]
  settings: Settings
  story: Story | null          // after the story stage
  plan: DirectorPlan | null    // after the direct stage
  scenes: SceneView[]
  assets: AssetView[]
  narration: { status: StageStatus; durationMs?: number; voiceName?: string; wpm?: number } | null
  music: { source: 'generated'|'user'|'elevenlabs'|'none'; params?: MusicParams } | null
  qa: QaSummary | null
  editor: { clipProjectId: string|null; clipId: string|null; compactEditorUrl: string|null; fullEditorUrl: string|null }
  export: { status: StageStatus; videoUrl: string|null /* short-lived signed */; durationMs?: number; width?: number; height?: number; creditsFileUrl?: string|null } | null
  error: { code: string; message: string; stage: Stage; retryable: boolean } | null
  creditEstimate: null
  createdAt: string; updatedAt: string
}
type Story = {
  title: string; logline: string
  chapters: { id: string; title: string; lineIds: string[] }[]
  lines: { id: string; text: string; spoken: string; hero?: string; typed?: string; chapterId: string; claimIds?: string[] }[]
  claims: { id: string; text: string; grounded: boolean; sources: { url: string; title?: string; retrievedAt: string }[] }[]
  research: { query: string; grounded: boolean; reason: string }[]   // every research decision (ST-RES-001)
  lint: { lineId: string; issue: string }[]                          // typed-vs-spoken lint
  userWordsPreserved: boolean                                         // WF-B
}
type DirectorPlan = {
  world: { kind: string; reason: string }             // derived from the story (ST-DIR-001)
  styleSpec: Record<string, unknown>                   // 24 fields (ST-STY-005), each with a reason in styleReasons
  styleReasons: Record<string, string>
  emphasis: { lineId: string; word: string; reason: string }[]
  music: { mood: string; anchors: { event: 'enter'|'build'|'peak'|'cut'|'pad'|'resolve'; lineId: string; word: string }[]; reason: string } | null
  scenes: PlannedScene[]
}
type PlannedScene = {
  id: string; index: number; lineIds: string[]; visualType: VisualType; reason: string
  description: string; blocks: string[]                // Part 1 blocks it uses
  assetIds: string[]
  handoff?: { assetId: string; inS: number; outS: number; surfaceKind: 'photo'|'tv'|'monitor'|'newspaper'|'phone'|'cinema'|'billboard'|'panel';
              exitStyle: 'mirror'|'asymmetric'; footageMode: 'a'|'b'; presentationReason: string; cutType?: 'hard'; justification?: string }
}
type SceneView = PlannedScene & {
  status: SceneStatus; startMs?: number; endMs?: number
  model?: string; fixRounds: number; usedFallback: boolean
  qa?: { passed: boolean; checks: { id: string; passed: boolean; value?: number|string; note?: string }[] }
  previewUrl?: string|null    // signed mp4 of the scene segment
  stillUrl?: string|null      // signed jpg
}
type AssetView = {
  id: string; uploadId: string; kind: 'video'|'image'|'audio'; title: string
  durationMs?: number; width?: number; height?: number
  status: 'pending'|'analyzing'|'ready'|'failed'
  analysis?: { description?: string; transcriptWords?: number; moments?: { startS: number; endS: number; label: string }[]; onScreenText?: string[]; people?: { label: string; suggested?: string }[] }
  thumbUrl?: string|null
}
```

### `PATCH /api/motion-studio/projects/{id}`
Body (any subset): `{ title?, settings?: Partial<Settings>, story?: { lines?: {id,text,spoken?}[] } }`.
Story edits are allowed until narration starts (`409 CONFLICT` after). → `{ project }`

### `POST /api/motion-studio/projects/{id}/approve`
Checkpoint "Approve story & plan" (only when `status=awaiting_approval`). Queues narration → graphics → assemble. → `{ project }`

### `POST /api/motion-studio/projects/{id}/request-changes`
`{ note: string, target: 'story'|'plan' }` → re-runs story or direct with the note (one Luna call, no paid media). Only while `awaiting_approval` or `review`. → `{ project }`

### `POST /api/motion-studio/projects/{id}/retry`
User-initiated "Retry step" for a `failed` stage (never automatic for paid steps). → `{ project }`

### `POST /api/motion-studio/projects/{id}/cancel` → `{ project }`

### `POST /api/motion-studio/projects/{id}/assets`
`{ uploadIds: string[] }` → attaches media and queues analysis for the new assets. → `{ assets: AssetView[] }`

### `POST /api/motion-studio/projects/{id}/scenes/{sceneId}/regenerate`
`{ instruction?: string }` — per-scene regenerate (never the whole film): re-generates that scene's code (Luna), re-renders only that segment, then re-assembles. Allowed in `review`. → `{ project }`

### `GET /api/motion-studio/projects/{id}/activity?after={eventId}&limit=100`
Production Activity stream (poll). → `{ events: ActivityEvent[], lastId: string|null }`
```ts
type ActivityEvent = { id: string; at: string; stage: Stage; agent: 'story'|'researcher'|'director'|'footage_editor'|'motion_designer'|'narrator'|'composer'|'qa'|'assembler'|'system'
  kind: 'stage'|'decision'|'research'|'model_call'|'render'|'qa'|'fix'|'warning'|'error'; message: string; reason?: string; data?: Record<string, unknown> }
```
(Never contains keys, signed URLs, prompts or raw model output.)

### `GET /api/motion-studio/projects/{id}/timeline`
→ `{ clipProjectId, clipId, edits: ClipEditsV2 /* includes edits.motionStudio */, compactEditorUrl }`. The Compact Editor loads/saves via its existing clip APIs; this route is a read convenience.

### `POST /api/motion-studio/projects/{id}/export`
Re-runs only `assemble` (mix + join + QA + export) from cached segments. → `{ project }`. The finished MP4 is `project.export.videoUrl`.

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
