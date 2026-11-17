# Clipper Agent Bridge plan

Status: design for implementation. Baseline is `703deuce/sms` `origin/master` at `2520aa65e9054f6aeeb831a74d010760a20eb6b0` (Agent Bridge v2). Scope is `new-app` only. Additive Prisma migrations only. No SMS worker, Coolify app3, production SSH, or clips-worker changes in v1.

The product goal: a customer uploads a video in the existing AI Clipper UI. The current finder still scores the best moments. The Motion Studio Producer bot then finishes each clip the way Motion Studio finishes a film: speaker-aware layout, motion graphics, light editorial cleanup, a downloadable MP4, and an editable project on separate timeline tracks. Live progress appears in the Transovo Clipper UI, branded only as Transovo / Transovo Agent.

---

## 1. Current clipper architecture (short)

### Upload and project

1. Customer opens `/app/clips/new` (`new-app/components/clips/new-project-workspace.tsx`).
2. File upload goes through `/api/clips/uploads` (`new-app/lib/server/clips/uploads.ts`, `upload-finalize.ts`) and creates a `ClipUpload` (`clip_uploads`) with an object-storage key.
3. `createProject({ uploadId, settings })` (`new-app/lib/server/clips/projects.ts`) creates a `ClipProject` (`clip_projects`) and enqueues a `ClipJob` (`clip_jobs`) of type `PROCESS_PROJECT`.
4. For the default “Find clips” intent, settings include `autoAgentClipMode: 'clip_unified_v1'`. `buildProcessProjectJobPayload` then sends `agentOnly: true` to the worker, so the classic M4 picker is skipped.

### Worker (clips-worker) — transcribe only, when agent-only

`worker/clips_worker/main.py` on `PROCESS_PROJECT`:

- Downloads the source from `clip_uploads.key`.
- Transcribes if `clip_projects.transcriptWords` is empty (Deepgram diarized words when configured; Whisper fallback). Words are `{ w, s, e, p?, spk?, i? }` with `s`/`e` in seconds; `spk` is the speaker id when diarization exists.
- Persists `transcriptWords` and optionally `transcriptKey` on the project.
- On `agentOnly: true`, does **not** run `pipeline.run_m4_pipeline`. It leaves the project at `FINDING_CLIPS` / progress 50 and finishes the job. The UI stays in progress so it does not say “ready, no clips” while scoring is still running.

Classic M4 finding (`pipeline.run_m4_pipeline`, speakercrop, crop tracks) still exists for non-agent projects. v1 of this bridge does not replace or call it.

### Scoring (in-app unified clipper)

`POST /api/internal/jobs/:id/progress` calls `maybeAutoStartUploadAgentBatch` (`new-app/lib/server/streamer/agent-batch.ts`) once ingest reports the right terminal state. That starts one `AiProducerAgentRun` via `startUnifiedClipRun` (`storyMode: 'clip_unified_v1'`).

`runClipAgent` (`new-app/lib/ai-producer-agent/clip-mode/orchestrator.ts`) then:

- Reads the project transcript.
- Runs Story and continuous passes on the same words, merges and dedupes (60% overlap rule), applies editorial safety (`needsReview`, critical drops).
- Writes `Clip` rows on the **source project** (`createSourceClip`, `publishClipScore`). Score is 0–100; `scores` is `{ hook, flow, value, trend }`; `aiMeta` holds `type` (`story` | `continuous`), `stitchSegments`, `whyThisClip`, `needsReview`, `overlaps`, `aiProducerRunId`.
- Optionally plans text-only motion graphics (`autoPlanClipMotion` in `clip-mode-motion.ts`) and auto-exports `!needsReview` clips via `RENDER_CLIP` on the clips-worker.

`finishRun` marks the `ClipProject` `READY` (or `FAILED` if nothing published).

Results live in `clips` and are also listed at `GET /api/ai-producer-agent/runs/:id/clips`. The Opus-style grid is `/app/clips/[projectId]` (`project-clips-view.tsx`), which polls `/api/clips/projects/:id/status`.

### What the current “agent” does not do

The unified run is an in-app Luna/Gemini orchestrator, not the Motion Studio Producer bot. `autoPlanClipMotion` writes caption-safe text graphics into `clip.edits`. It explicitly is **not** face detection. Layouts, punch-ins, and split/stack boxes are not decided per clip by that agent. Speakercrop / YuNet / multiperson director live only on the clips-worker, which this plan must not call for customer finishing.

### Motion Studio Agent Bridge (what we reuse)

Webhook to the same producer bot, `Authorization: Bearer <webhook key>`. Actions today: `create_video`, `revise_video`, `cancel`. Callbacks at `{jobUrl}` = `/api/motion-studio/agent/jobs/:id`:

`GET` assignment, `POST /progress`, `POST /assets` (prepare/commit), `POST /messages`, `GET /parent-artifacts`, `POST /usage` (private), `POST /complete` with `durationMs`.

Stages: `research`, `story`, `voice`, `scenes`, `review`, `fixing`, `rendering`, `delivering`, `complete`. Messages are sanitized; the UI never shows bot, model, engine, tool, path, signed URL, or `$`.

`botGetAssignment` today returns Motion Studio `StudioAsset` uploads only. It does not return a clip project source, transcript, or scored moments. `/complete` requires exactly one ready `kind:'video'` MP4 and stores a single `resultKey`.

`MotionStudioProject` already has `clipProjectId` and `clipId`. `MotionStudioAgentJob` has revision, parent, artifacts, usage, durationMs.

---

## 2. Proposed contract

Same Agent Bridge, same webhook, same job token and asset upload protocol. Extend additively. A clipping assignment is one job that finishes N clips, not N webhooks.

### 2.1 Webhook (server → producer)

Common fields stay (`version: 1`, `jobId`, `projectId` of the Motion Studio pack project, `jobUrl`, `callbackUrl`, `setupMode`, `jobToken` only in live mode, `quality`, `style`, `width`, `height`, `fps: 30`, `aspectRatio`, `resolution`).

New / changed fields:

| Field | v1 Motion | Clip job |
| --- | --- | --- |
| `action` | `create_video` / `revise_video` | `clip_video` / `revise_clip` |
| `jobType` | implied `motion` | `clip` |
| `clipProjectId` | absent | source `ClipProject.id` |
| `prompt` / `title` | customer brief | project title; prompt may be a short finishing instruction |
| `durationSeconds` | exact 30/60/120/180/300 for the whole film | **omit** at the job level. Each moment has its own duration. Do not invent a single 30–300s runtime for the pack. |
| `webResearch` | `true` | `false` (customer already supplied the footage) |
| `mediaPolicy` | `auto_plus_uploads` | `source_footage` |
| `platform` | n/a | `tiktok` / `shorts` / `reels` when known, else `shorts` |
| `momentCount` | n/a | number of moments the producer must finish |
| `momentsVersion` | n/a | hash or updated-at of the moment list, for idempotency |

Do **not** put the transcript or signed source URL in the webhook body (size and secret leakage). The producer loads them from the job API.

`setupMode: true` still means accept, do not render, do not download source.

Idempotency remains by `jobId`. Repeat deliveries must not start a second finish.

### 2.2 Revision webhook (`revise_clip`)

Same revision fields as v2: `parentJobId`, `revision`, `threadId`, `instruction`, `selectedElementIds` (max 20), `timeRangeMs`, `messageHistory` (last 20).

Plus:

- `targetClipId` — the `Clip.id` being revised. Required.
- Other clips in the pack are left alone.

### 2.3 Producer callbacks

All existing endpoints stay. Additions:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `{jobUrl}` | Assignment. For `jobType:'clip'`, also returns pack metadata, aspect, platform, and a **manifest of moments** (no signed URLs). |
| GET | `{jobUrl}/source` | Short-lived signed URL (~15–30 min) for the source video only. Never returned to the customer UI. |
| GET | `{jobUrl}/transcript` | Full project words `[{ w, s, e, p?, spk?, i? }]`, plus `language` if known, `durationMs`, `wordCount`. For very long sources, allow `?fromMs=&toMs=` (required for 3h VODs). |
| GET | `{jobUrl}/moments` | The scored list the producer must finish (same shape as assignment moments, always current). |
| GET | `{jobUrl}/parent-artifacts` | Revisions only, unchanged, scoped to the parent job (and therefore to that clip's prior artifacts). |
| POST | `{jobUrl}/progress` | Unchanged protocol. `sceneId` **is the `clipId`** while a specific clip is being edited. |
| POST | `{jobUrl}/assets` | Unchanged prepare/commit. 300-artifact cap still applies. |
| POST | `{jobUrl}/messages` | Unchanged. |
| POST | `{jobUrl}/usage` | Unchanged, private, never shown. |
| POST | `{jobUrl}/complete` | Extended multi-clip body (below). |

### 2.4 Moment object (assignment + `/moments`)

```ts
{
  clipId: string              // existing clips.id — stable, must appear in /complete
  title: string
  type: 'story' | 'continuous'
  score: number               // 0–100
  startMs: number
  endMs: number
  durationSeconds: number
  segments: Array<{ startMs: number; endMs: number }>  // one range, or a Story stitch
  whyThisClip: string | null
  needsReview: boolean
  needsReviewReasons: string[]
  speakerIds: number[]        // distinct spk values in the segment words, may be empty
}
```

v1 rule: the producer **finishes the published, `needsReview === false` moments**. `needsReview: true` moments are listed so the producer can skip them; the customer still sees them in the grid as drafts. The producer may tighten in/out points and cut dead air inside a moment, and may add a short bridge graphic in a 30/60s clip. It must not invent new moments or drop a published clean moment without a progress message and a `/messages` note.

If `/moments` is empty, fail the job with a customer-safe message (“We couldn't find a clip worth publishing in this video.”). Do not start an open-ended research film.

### 2.5 Progress stages and default copy

Keep the same nine stage ids so `AgentJobPanel` and sanitization stay reusable. Change only the default customer messages when `jobType === 'clip'`:

1. `research` — "We're finding the best moments…"
2. `story` — "We're choosing the strongest clips…"
3. `voice` — "We're cleaning up the audio…"
4. `scenes` — "We're editing your clips…"
5. `review` — "We're reviewing each cut…"
6. `fixing` — "We're polishing a few details…"
7. `rendering` — "We're rendering your clips…"
8. `delivering` — "We're adding your clips to the timeline…"
9. `complete` — "Done! Your clips are ready to edit."

UI labels (same component, clip copy): Moments, Selection, Audio, Editing, Review, Polishing, Rendering, Delivery, Complete.

Because transcribe + scoring happen **before** the webhook in v1, the server should write `research` and `story` activity events (and advance `phase`/`progress`) as those steps finish, then dispatch `clip_video` with the job already at `scenes` ~60%. The producer starts posting from `scenes` (or `voice` if it is doing dead-air / audio cleanup first). `fixing` may repeat. `sceneId` = `clipId` whenever the message is about one clip (“We're laying out the first clip…”).

Sanitization and first-person-plural Transovo wording are unchanged. Never mention Grokbot, models, engines, FFmpeg, MediaPipe, file paths, signed URLs, or costs.

### 2.6 Multi-clip `/complete`

Success body:

```ts
{
  clips: Array<{
    clipId: string
    title: string
    durationMs: number          // required, positive safe integer
    startMs: number
    endMs: number
    score?: number
    layout?: 'punch_in' | 'split' | 'stack' | 'grid' | 'custom'
    videoFilename: string       // committed kind:'video' mp4, e.g. clip_<clipId>.mp4
    projectFilename: string     // committed kind:'project' json, e.g. clip_<clipId>_project.json
    posterFilename?: string     // optional kind:'media' image
    srtFilename?: string        // optional application/x-subrip
  }>
  summary?: string
}
```

Rules:

- `clips.length >= 1`.
- Every listed `clipId` must be one of the assigned clean moments (or the `targetClipId` on a revision).
- Each listed clip must have a ready MP4 (`kind:'video'`, `mime:'video/mp4'`) whose filename matches `videoFilename`, and a ready `project.json`-schema manifest matching `projectFilename`.
- Per-clip `durationMs` is required. Do not require a pack-level `durationMs`. Store pack `durationMs` as the sum for bookkeeping if useful.
- `project.json` schema remains `transovo.motion-project/1`. Filename cannot all be exactly `project.json` when N>1; the importer must use `projectFilename` / artifact `elementId`. For a single-clip revision, `project.json` is still accepted.
- On a `revise_clip` job, `clips` has exactly one entry for `targetClipId`. Other pack clips are untouched.
- Failure remains `{ status: 'failed' }` with a generic customer message.

Importer per clip (reuse `agent-import.ts`):

- Master MP4 is the preview.
- Manifest tracks become editor lanes (footage, layouts/overlays, titles, captions, music, SFX).
- Stable element IDs survive revisions of that clip.
- If a clip's manifest is missing or invalid, that clip falls back to its master MP4 only.

### 2.7 End state written by `/complete`

In one transaction:

- Mark the `MotionStudioAgentJob` `complete`, `progress: 100`.
- Store `clipResults` (the complete body, no URLs) on the job.
- For each finished clip: set `previewKey` / export pointer, `aiMeta.agentJobId`, `aiMeta.layout`, duration from `durationMs`; create or update a `MotionStudioProject` with `workflow: 'clipper'`, `clipProjectId`, `clipId`, `exportInfo: { masterKey, durationMs, source: 'transovo_agent', agentJobId, storageDriver }`; increment that project's `timelineVersion`; import the manifest.
- Set the source `ClipProject` to `READY`, `stage: 'ready'`, `progress: 100`.
- Write a complete activity event.

Do not overwrite the customer's original `ClipUpload.key`. The source video must remain the source.

### 2.8 Combined customer progress (one bar from upload to pack)

| Customer stage | Backend reality |
| --- | --- |
| research | Worker transcribe, then unified clipper scoring |
| story | Moments published; `needsReview` drafts held |
| voice → complete | Producer `clip_video` job |

Until the producer completes, **do not** mark the `ClipProject` `READY`. `finishRun` of the unified scorer should set `status: 'RENDERING'` (existing enum, no new value required), `stage: 'editing_clips'`, progress ~60, and dispatch the webhook. `FAILED` only if scoring published zero clean clips and there is nothing to finish. `needsReview` drafts may exist alongside a successful finish of the clean ones.

### 2.9 Chat and versions

- Pack-level activity uses the Motion Studio pack project (`StudioActivityEvent`, existing poll).
- After delivery, each clip can be revised: `POST /api/motion-studio/agent/projects/:packOrClipProjectId/chat` with `{ instruction, clipId, selectedElementIds?, timeRangeMs? }`, or a thin clip-scoped alias `POST /api/clips/clips/:clipId/agent/chat` that calls the same service.
- Restore stays `POST .../versions/:jobId/restore`, scoped so a clip restore only swaps that clip's export and manifest.

---

## 3. Reuse vs new

### Reuse as-is

- Upload UI and `/api/clips/uploads*`.
- `PROCESS_PROJECT` agent-only transcribe in clips-worker.
- Unified clipper scoring, editorial safety, `Clip` rows, results grid contract (`docs/contracts/unified-clipper-v1.md`).
- Webhook dispatch, job tokens, asset prepare/commit, message sanitization, `/usage`, cancel, parent-artifacts, `StudioActivityEvent`.
- `project.json` schema and Compact Editor import (`agent-import.ts`), extended to N manifests.
- `MotionStudioProject.clipProjectId` / `clipId`.
- Progress panel pattern in `agent-job-panel.tsx` (stages, live updates, no secrets).
- Private usage reporting.

### Change (additive)

- `dispatchAgentJob` / payload builder: `clip_video`, `jobType`, skip `durationSeconds` / `webResearch` for clip jobs.
- `botGetAssignment` + new `/source`, `/transcript`, `/moments`.
- `botFinish` multi-clip complete; do not require a single `resultKey` as the only video.
- Default stage messages keyed by `jobType`.
- Hook after unified publish: skip `autoPlanClipMotion` and `exportOnFinish` when producer finish is on; dispatch one `clip_video` job; delay `READY`.
- Clipper UI: show the nine Transovo stages during transcribe/score/finish; after complete, grid items are finished MP4s with Edit opening the imported timeline; per-clip chat.
- One additive migration (below).
- Contract doc: `docs/contracts/motion-studio-agent-bridge-clip-v1.md`.

### Out of scope for v1

- Replacing unified scoring with the producer.
- Calling production speakercrop / clips-worker render for face track (the producer uses MediaPipe + OpenCV on its own box).
- Streamer facecam layouts, multi-source Story, captions-only, blank/full-video BYO, social publish.
- Pricing/credits UI (usage stays private). A later pricing model can use `/usage` + production work, not length alone.
- Replication package, Remotion user templates, “Make another version” UI.

---

## 4. Backend and frontend files to touch

### Backend (new-app)

- `prisma/schema.prisma` + new migration folder (see §5).
- `lib/server/motion-studio/agent-bridge.ts` — dispatch, assignment, stage copy, complete, optional `dispatchClipAgentJob`.
- `lib/server/motion-studio/agent-import.ts` — import one manifest per clip into that clip's Motion Studio / Compact Editor project.
- New: `lib/server/motion-studio/clip-agent-source.ts` — authorize bot token, load source key, words, moments; issue short-lived URLs only on `/source`.
- New routes under `app/api/motion-studio/agent/jobs/[id]/source|transcript|moments/route.ts`.
- `app/api/motion-studio/agent/jobs/[id]/complete/route.ts` and `route.ts` (GET) — no signature change if logic stays in `agent-bridge.ts`.
- `lib/ai-producer-agent/clip-mode/orchestrator.ts` — after publishing clean clips, skip motion auto-plan and auto-export when `agentFinish` is on; call dispatch instead of `finishRun`→READY.
- `lib/server/ai-producer-agent/clip-mode-store.ts` — stamp `aiMeta.agentJobId` when the finish job is created.
- Chat: `app/api/motion-studio/agent/projects/[projectId]/chat/route.ts` and/or `app/api/clips/clips/[id]/agent/chat/route.ts`.
- `lib/server/clips/jobs.ts` / project status serializer — expose pack agent phase, message, stages, events to the clipper poll (never tokens or URLs).
- Tests: assignment/moments auth, complete multi-clip, revision of one clip, READY timing, message sanitization, no `$` / no signed URL in public payloads.

### Frontend (new-app)

- `components/clips/project-clips-view.tsx`, `unified-clip-progress.tsx` (or a thin wrapper) — reuse `AgentJobPanel` stage UI with clip labels; keep the results grid.
- `components/motion-studio/agent-job-panel.tsx` — accept clip stage labels; do not hard-fail if `videoUrl` is absent and N clip previews exist.
- Results cards: play/download the finished MP4; Edit goes to the existing editor route once the manifest is imported (`/app/clips/[projectId]/edit/[clipId]` or the Motion Studio project for that clip).
- `components/motion-studio/agent-chat-panel.tsx` — available per clip after delivery.
- Copy: “Transovo Agent is finishing your clips.” Never “Grokbot”, engine, or model names.

### Docs

- `docs/contracts/motion-studio-agent-bridge-clip-v1.md` (implementer writes this as part of the PR).
- This plan stays in `/workspace/motion_jobs/` as the working design.

### Do not touch

- `worker/` (clips-worker, SMS worker), Coolify app3, production SSH, volume/migration outside the additive Prisma file, billing charge paths.

---

## 5. Additive-only migration

Suggested name: `20261116140000_motion_studio_clip_agent_jobs`.

On `MotionStudioAgentJob`:

- `jobType String @default("motion")` — `motion` | `clip`
- `clipProjectId String?`
- `targetClipId String?` — set on `revise_clip`
- `clipResults Json?` — complete body minus any URLs

Index: `@@index([clipProjectId, createdAt])`.

No new enum on `ClipProjectStatus`. Use existing `RENDERING` while the producer is finishing.

Optional, only if a join table is cleaner than `clipResults` + `MotionStudioProject` rows: `MotionStudioAgentClip` (`jobId`, `clipId`, `status`, `durationMs`, `layout`, `videoKey`, `projectKey`). Prefer JSON + existing projects in v1 unless the importer clearly needs a table. If added, it is still additive (new table, no drops).

`Clip.aiMeta` and `MotionStudioProject.clipProjectId` / `clipId` already exist — no change required.

---

## 6. Acceptance checks

1. Upload a talking-head file in `/app/clips/new` (Find clips). Transcribe + unified scoring still produce scored `Clip` rows. No classic M4 picker. Project does not flip to `READY` before the producer finishes (or fails).
2. After clean moments exist, exactly one `clip_video` webhook is sent. Retries reuse the same `jobId`. `setupMode` jobs are accepted and do not render.
3. `GET {jobUrl}/source` and `/transcript` and `/moments` require the job bearer token. Customer status/chat APIs never include those URLs, the job token, or `$`.
4. Progress in the Clipper UI shows the nine Transovo stages with clip-specific copy. `sceneId` messages attach to the right clip. Forbidden terms are rewritten to defaults.
5. `/complete` with 2+ clips writes one MP4 + one `transovo.motion-project/1` manifest per clip. Opening Edit on clip A shows that clip's tracks (footage, titles/graphics, captions, audio), not a flat bake only. Clip B is independent.
6. A `needsReview` moment is visible in the grid as a draft and is not required in `/complete`.
7. `revise_clip` on clip A replaces only A. Restore of a prior job for A does not delete B or later versions of A.
8. Dead-air / layout quality is a producer/QA concern (see `/workspace/staging/clip-production.md`); the backend checks artifacts, durations, and import, not creative taste.
9. Failure path: producer `{ status: 'failed' }` or dispatch failure sets a generic customer message and `ClipProject` `FAILED` only when no finished clip was stored; already-published drafts remain.
10. No clips-worker, SMS worker, or Coolify app3 diff in the PR. No secrets in logs or the ChatGPT brief.

---

## 7. Blockers and watch-outs

- **`/complete` is single-video today.** This is the main contract gap; the complete handler and importer must become multi-artifact before a live pack can land.
- **No signed source/transcript/moments API today.** Assignment only returns Motion Studio `StudioAsset` uploads. Must be built before the producer can work.
- **READY timing.** If `finishRun` still marks `READY` and auto-exports, customers will see unpolished clips and the producer will race the UI. The scorer hook has to change first.
- **Transcript size.** Long VODs cannot go in the webhook or even a single unbounded JSON without a range query.
- **Daily/concurrent test limits** in `dispatchAgentJob` (3 new jobs / 12 revisions / 3 active per user) count a pack as one job, which is fine; per-clip revisions can hit the revision cap on a large pack. Consider counting `jobType:'clip'` revisions against a slightly higher cap, still bounded.
- **MediaPipe Face Landmarker is not in `motion_engines/mediapipe/models/` yet** (only selfie segmenters). That is a producer-box install, not a production change. OpenCV is installed. Do not SSH to production or invoke speakercrop to fill the gap.
- **Do not print keys, env values, or signed URLs** in UI, logs, this plan's implementation chat, or the ChatGPT brief.
