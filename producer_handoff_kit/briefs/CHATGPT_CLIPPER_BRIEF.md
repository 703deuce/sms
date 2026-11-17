# Transovo: wire the AI Clipper to the Motion Studio Agent Bridge (clip finish)

Repo: `703deuce/sms`, `new-app` only. Implement against current `master` (Agent Bridge v2, including `new-app/lib/server/motion-studio/agent-bridge.ts` and `docs/contracts/motion-studio-agent-bridge-v2.md`).

This is an additive contract extension, not a rewrite of Motion Studio and not a rewrite of the clipper finder.

A fuller design, including current architecture and acceptance checks, is in the companion plan if you have it. If not, this brief is sufficient to implement the server and UI side.

## What we want

A customer already uploads a video in the existing AI Clipper (`/app/clips/new`), and the existing unified clipper already finds and scores the best moments (`clip_unified_v1`). That part stays.

What is missing: after those moments exist, Transovo should send **one** job to the same production bot that Motion Studio already uses, so the bot can finish each clip (layout, motion graphics, light cleanup) and return **one MP4 plus one editable timeline project per clip**. Live progress should show in the Clipper UI with the same stage stepper Motion Studio uses, branded only as Transovo / Transovo Agent.

The bot / skill work is handled separately. You are implementing the **front end and backend in `new-app`**: the contract, the job API, the dispatch hook, the multi-clip complete/import path, and the Clipper progress + results UI.

## Hard constraints

- Only `new-app`. Do **not** change the SMS worker, Coolify app3, or `worker/clips_worker`.
- Additive Prisma migrations only. No drops, no destructive column changes. Do not add a new `ClipProjectStatus` if an existing value works (`RENDERING` while the bot is finishing).
- No billing charges and no `$` in the customer UI, errors, or progress text.
- Never put job tokens, webhook keys, storage signatures, or signed URLs in a public customer API or in the browser. The bot job token is for the producer only, same as Motion Studio.
- Customer-facing copy is Transovo / Transovo Agent. Never “Grokbot”, never model, engine, or tool names, never file paths, never stack traces.
- `setupMode: true` jobs must be accepted and must not require a render (same as Motion Studio).
- Idempotency is by `jobId`. Retrying the webhook must not create a second finish job.
- Do not print or hard-code secrets, env values, or example signed URLs in code, comments, tests, or docs.

## Current pipeline (do not replace)

1. Upload → `ClipUpload` + `ClipProject` + `PROCESS_PROJECT` with `agentOnly: true` when `autoAgentClipMode` is set (`lib/server/clips/process-project-payload.ts`).
2. clips-worker transcribes, writes `clip_projects.transcriptWords` (`{ w, s, e, p?, spk?, i? }`, `s`/`e` in seconds), leaves the project at `FINDING_CLIPS`.
3. `/api/internal/jobs/:id/progress` calls `maybeAutoStartUploadAgentBatch`, which starts one `startUnifiedClipRun` (`storyMode: 'clip_unified_v1'`).
4. `runClipAgent` in `lib/ai-producer-agent/clip-mode/orchestrator.ts` publishes scored `Clip` rows on the source project (`publishClipScore`). Editorial safety and `needsReview` stay in force.
5. Today the orchestrator may also call `autoPlanClipMotion` and auto-export `!needsReview` clips, then `finishRun` marks the project `READY`. **This is what you change.**

When producer finish is enabled (make this the default for new Find-clips uploads that already set `autoAgentClipMode: 'clip_unified_v1'`):

- Do **not** call `autoPlanClipMotion`.
- Do **not** auto-export via `RENDER_CLIP`.
- Do **not** mark the `ClipProject` `READY` in `finishRun`.
- If zero clean (`needsReview === false`) clips were published, keep today’s failure behavior (`FAILED` when nothing was saved).
- If at least one clean clip was published, set the project to `RENDERING`, `stage: 'editing_clips'`, progress about 60, write `research` / `story` activity as already done, and dispatch **one** Agent Bridge job with `action: 'clip_video'`.
- `needsReview: true` clips stay in the grid as drafts and are not required in `/complete`.

Reuse the existing Motion Studio webhook helper (`agentBridgeConfigured`, `agentBridgeLive`, fetch-with-retries, token hash, public job shape, friendly message sanitizer). Extend them; do not fork a second webhook stack.

## Contract to implement

### Webhook (server → existing producer webhook)

Same envelope as v2 (`version`, `jobId`, `projectId` of a new or reused Motion Studio pack project linked to the `ClipProject`, `jobUrl`, `callbackUrl`, `setupMode`, live-mode `jobToken`, `width`/`height`/`fps: 30`/`aspectRatio`/`resolution`, `quality`, `style`).

New fields:

- `action`: `clip_video` on first finish, `revise_clip` on a per-clip revision, `cancel` unchanged.
- `jobType`: `'clip'`.
- `clipProjectId`: the source clip project.
- `webResearch: false`
- `mediaPolicy: 'source_footage'`
- `platform`: existing run/project platform when known, else `'shorts'`
- `momentCount`: number of clean moments assigned
- `momentsVersion`: a short hash or timestamp of the moment list

Do **not** send `durationSeconds` as a single 30/60/120/180/300 value for the pack (clip lengths vary). Do **not** put the transcript or a signed source URL in the webhook body.

`revise_clip` also sends the v2 revision fields (`parentJobId`, `revision`, `threadId`, `instruction`, `selectedElementIds`, `timeRangeMs`, `messageHistory`) plus required `targetClipId`.

Create a `MotionStudioProject` with `workflow: 'clipper'`, `clipProjectId` set, and (after complete) per-clip projects or per-clip export bindings using the existing `clipId` field. `MotionStudioProject` already has `clipProjectId` and `clipId`.

### Job API (producer → Transovo)

Existing: `GET {jobUrl}`, `POST /progress`, `POST /assets`, `POST /messages`, `GET /parent-artifacts`, `POST /usage`, `POST /complete`. Keep auth as `Authorization: Bearer <jobToken>`.

Add (bot-token only):

- `GET {jobUrl}/source` — short-lived signed download for the original `ClipUpload` source. Do not replace or rewrite `clip_uploads.key`.
- `GET {jobUrl}/transcript` — `{ words, language?, durationMs, wordCount }`. Support `fromMs` and `toMs` query params so a 3-hour VOD is not a single unbounded payload.
- `GET {jobUrl}/moments` — the assigned moment list (always the current list).

`GET {jobUrl}` for a clip job should also include pack metadata and the moment list **without** signed URLs.

Moment shape:

```ts
{
  clipId: string
  title: string
  type: 'story' | 'continuous'
  score: number
  startMs: number
  endMs: number
  durationSeconds: number
  segments: Array<{ startMs: number; endMs: number }>
  whyThisClip: string | null
  needsReview: boolean
  needsReviewReasons: string[]
  speakerIds: number[]
}
```

`speakerIds` are the distinct `spk` values on words overlapping the moment. Empty array if unknown.

### Progress

Keep the nine stage ids: `research`, `story`, `voice`, `scenes`, `review`, `fixing`, `rendering`, `delivering`, `complete`.

When `jobType === 'clip'`, default messages are:

1. research — "We're finding the best moments…"
2. story — "We're choosing the strongest clips…"
3. voice — "We're cleaning up the audio…"
4. scenes — "We're editing your clips…"
5. review — "We're reviewing each cut…"
6. fixing — "We're polishing a few details…"
7. rendering — "We're rendering your clips…"
8. delivering — "We're adding your clips to the timeline…"
9. complete — "Done! Your clips are ready to edit."

UI labels: Moments, Selection, Audio, Editing, Review, Polishing, Rendering, Delivery, Complete.

Reuse `friendlyMessage`. Invalid stages still become `scenes`. Percent still clamps to `max(current, min(99, round(percent)))` until complete. Treat `sceneId` as the `clipId` when present, and persist it on the activity event as today.

The Clipper project poll should surface `phase`, `message`, `progress`, `stages`, and `events` from the pack job (same shape `userAgentJob` already returns, minus `videoUrl` secrets). Poll interval can stay a few seconds.

### Multi-clip complete

Extend `botFinish` so a clip job accepts:

```ts
{
  clips: Array<{
    clipId: string
    title: string
    durationMs: number
    startMs: number
    endMs: number
    score?: number
    layout?: 'punch_in' | 'split' | 'stack' | 'grid' | 'custom'
    videoFilename: string
    projectFilename: string
    posterFilename?: string
    srtFilename?: string
  }>
  summary?: string
}
```

Rules:

- At least one clip.
- Each `clipId` must be an assigned clean moment (or the revision `targetClipId`).
- Each entry needs a committed `kind:'video'` `video/mp4` whose filename matches `videoFilename`, and a committed `kind:'project'` `application/json` manifest whose filename matches `projectFilename`.
- Each `durationMs` is a positive safe integer. Pack-level `durationMs` is optional; if you store one, use the sum.
- Manifest schema remains `transovo.motion-project/1`. For N>1, filenames will be like `clip_<clipId>_project.json`, not a single `project.json`. Bind using the complete body and artifact filename / `elementId`. A one-clip revision may still use `project.json`.
- `{ status: 'failed' }` stays as today, with a generic customer message.
- On success, do **not** overwrite the original source upload key. Write each finished MP4 onto that `Clip` (preview/export pointer) and into a `MotionStudioProject` `exportInfo` (`source: 'transovo_agent'`, `agentJobId`, `durationMs`, `storageDriver`, master key). Import each manifest through `agent-import.ts` into that clip’s editor project. Increment `timelineVersion`. Set the source `ClipProject` to `READY`. Persist the complete body (no URLs) as `clipResults` on the job.
- If one clip’s manifest is invalid, that clip falls back to its master MP4; do not fail the whole pack if at least one video committed and the body is otherwise valid. Log the import miss internally without exposing details to the customer.

Motion Studio `create_video` complete behavior must stay unchanged (still requires one master MP4 + `durationMs`).

### Revisions and restore

Reuse `submitAgentRevision` / chat, with `clipId` / `targetClipId`. A revision job finishes only that clip. Restore (`.../versions/:jobId/restore`) switches only that clip’s export and imported timeline. Do not delete later versions.

You may add `POST /api/clips/clips/:clipId/agent/chat` as a thin alias if that is cleaner for the Clipper editor. It must call the same server function and the same auth/workspace checks.

## Schema

One additive migration, for example `20261116140000_motion_studio_clip_agent_jobs`:

On `MotionStudioAgentJob`:

- `jobType String @default("motion")`
- `clipProjectId String?`
- `targetClipId String?`
- `clipResults Json?`
- `@@index([clipProjectId, createdAt])`

Do not store signed URLs in `clipResults`. Existing `Clip.aiMeta` can also hold `agentJobId` and `layout` (additive JSON, no migration).

Production start already runs `prisma migrate deploy` unless skipped. Keep the migration SQL additive and safe to apply.

## Frontend

Keep `/app/clips/[projectId]` and the unified results grid. During transcribe, scoring, and bot finish, show the nine-stage Transovo stepper and live updates (reuse `components/motion-studio/agent-job-panel.tsx`, parameterized for clip labels). Do not say the video is ready until the pack job is `complete` (drafts with `needsReview` may already be listed).

After complete:

- Each clean finished clip plays and downloads its new MP4.
- Edit continues to open the existing clip editor (`/app/clips/[projectId]/edit/[clipId]` or the equivalent video-editor route) with the imported tracks, same as a Motion Studio complete.
- Offer the agent chat panel on a finished clip so the customer can say things like “the text is too close here” or “zoom in on the left speaker.”

Copy examples: “Transovo Agent is finishing your clips.” “Your clips are ready.” Never expose internal failure details; keep using the existing friendly sanitizer.

## Files you will likely touch

- `new-app/prisma/schema.prisma` and a new migration
- `new-app/lib/server/motion-studio/agent-bridge.ts`
- `new-app/lib/server/motion-studio/agent-import.ts`
- New helper e.g. `new-app/lib/server/motion-studio/clip-agent-source.ts`
- New routes: `new-app/app/api/motion-studio/agent/jobs/[id]/source/route.ts`, `transcript/route.ts`, `moments/route.ts`
- Existing job routes if they only re-export bridge functions
- `new-app/lib/ai-producer-agent/clip-mode/orchestrator.ts`
- `new-app/lib/server/ai-producer-agent/clip-mode-store.ts` if you stamp `agentJobId` at publish/dispatch
- Chat routes as above
- `new-app/lib/server/clips/jobs.ts` and/or the project status API the grid already polls
- `new-app/components/clips/project-clips-view.tsx`, `unified-clip-progress.tsx` if present, `agent-job-panel.tsx`, `agent-chat-panel.tsx`
- Tests next to the existing motion-studio and unified-clipper tests
- New contract doc: `docs/contracts/motion-studio-agent-bridge-clip-v1.md`

## Tests to include

- Dispatch payload for `clip_video` has `jobType:'clip'`, no source URL, no transcript body, no `durationSeconds` pack field, and `setupMode` follows live mode.
- `/source`, `/transcript`, `/moments` reject missing/invalid tokens; `/transcript` range query works.
- Public project status / chat / job poll never contain tokens, signed URLs, or `$`.
- `finishRun` + hook: clean clips → project stays off `READY` until `/complete`; `autoPlanClipMotion` and auto-export are not called when producer finish is on.
- `/complete` with two clips imports two manifests and two MP4s; a motion `create_video` complete is still single-video.
- `revise_clip` updates only `targetClipId`.
- Message sanitizer rewrites a progress line that mentions an engine or a URL.
- Progress hook still starts the unified scorer exactly once (no change to `maybeAutoStartUploadAgentBatch` behavior other than what happens after scoring).

## Out of scope

- Producer skill, engine installs, face-tracking implementation, or any bot-side render code.
- Changing how moments are scored or replacing `clip_unified_v1`.
- Streamer-specific facecam pipelines, multi-source Story, captions-only projects, billing UI, credits, or “Make another version.”
- Calling production SSH, Coolify, or the clips-worker from the bot or from this PR.

When the PR is ready: a short description, the migration name, and a note of any follow-up the bot skill still has to adopt (it will be updated separately).
