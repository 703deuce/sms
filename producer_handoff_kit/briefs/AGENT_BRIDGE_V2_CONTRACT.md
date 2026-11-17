# Motion Studio Agent Bridge v2 — producer contract summary

Source: `docs/contracts/motion-studio-agent-bridge-v2.md` on `703deuce/sms` master (`2520aa65e9054f6aeeb831a74d010760a20eb6b0`), cross-checked against `new-app/lib/server/motion-studio/agent-bridge.ts` and `agent-import.ts`.

This extends v1 additively. Only `new-app` is involved. The SMS worker and Coolify app3 are out of scope.

The repo doc still says “two additive Prisma migrations.” The commit actually ships **three**:

- `20261116094500_motion_studio_agent_revisions` — `parentJobId`, `revision` on `MotionStudioAgentJob`; new `MotionStudioAgentMessage`
- `20261116100000_motion_studio_agent_version_duration` — `MotionStudioAgentJob.durationMs`
- `20261116102000_motion_studio_private_usage` — `MotionStudioAgentJob.usage` JSON

Production start (`new-app/scripts/start-production.mjs`) runs `prisma migrate deploy` unless `SKIP_DB_MIGRATE_AT_START=1`. A successful container start should apply these automatically.

## Webhook dispatch (server → producer)

HTTPS JSON to the configured webhook, `Authorization: Bearer <webhook key>`. Idempotency is by **jobId**; repeat deliveries must not start a second render. If `setupMode: true`, do not render.

Common fields on every job:

- `version: 1`
- `jobId`, `projectId`
- `action`: `create_video` or `revise_video`
- `title`, `prompt`
- `durationSeconds`: exact `30 | 60 | 120 | 180 | 300`
- `width`, `height`, `fps` (always 30), `resolution`, `aspectRatio`
- `quality` (default `premium`), `style` (from visual direction, default `cinematic`)
- `webResearch: true`
- `mediaPolicy: 'auto_plus_uploads'`
- `jobUrl`, `callbackUrl` (same URL)
- `setupMode`
- `jobToken` only when live mode is on

Revision jobs additionally include:

- `parentJobId`
- `revision` (parent.revision + 1)
- `threadId` (the project id)
- `instruction` (customer text)
- `selectedElementIds` (string[], max 20, may be empty)
- `timeRangeMs`: `[startMs, endMs]` or `null`
- `messageHistory`: last 20 `{ role, text }` entries, oldest first

Customer chat creates the revision: `POST /api/motion-studio/agent/projects/:projectId/chat` with `{ instruction, selectedElementIds?, timeRangeMs? }`.

## Producer callbacks (`Authorization: Bearer <jobToken>`)

Base: `{jobUrl}` which is `/api/motion-studio/agent/jobs/:id`.

| Method | Path | Body / notes |
| --- | --- | --- |
| GET | `{jobUrl}` | Assignment. Includes settings and short-lived input upload URLs. |
| POST | `{jobUrl}/progress` | `{ stage, message, percent?, sceneId?, timestamp? }`. `phase` and `progress` are accepted as aliases of `stage` and `percent`. Invalid stages become `scenes`. Percent is clamped to `max(current, min(99, round(percent)))` until complete. |
| POST | `{jobUrl}/assets` | `action: 'prepare'` with `{ filename, mime, bytes, kind, elementId?, trackId? }`, then upload via the returned short-lived storage URLs (never through Next.js), then `action: 'commit'` with `{ uploadId, parts? }`. Optional `elementId`/`trackId` help the importer bind files. Max 300 artifacts. |
| POST | `{jobUrl}/messages` | `{ text, needsInput? }`. `needsInput: true` pauses the job as `needs_input`. |
| GET | `{jobUrl}/parent-artifacts` | Revisions only. Short-lived parent download URLs (~15 min). Not reusable public URLs. |
| POST | `{jobUrl}/complete` | `{ durationMs, summary? }` after all commits, or `{ status: 'failed' }`. `durationMs` is required on success (positive safe integer). At least one ready `kind:'video'` + `mime:'video/mp4'` must exist. `summary` is stored as the agent chat reply on revisions. |
| POST | `{jobUrl}/usage` | **Private, never shown to customers.** `{ items: [{ provider, units, usd }] }` (max 100). |

Cancel is best-effort: webhook `{ action: 'cancel', jobId }` plus persisted status.

Accepted asset `kind`: `video`, `project`, `media`, `audio`, `source`.

Accepted mime: `video/mp4`, `video/webm`, `video/quicktime`, `application/json`, `image/png`, `image/jpeg`, `audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/mp4`, `text/plain`, `application/x-subrip`, `application/zip`.

Always upload:

- master MP4, `kind: 'video'`
- silent scene/footage MP4s and images/overlays, `kind: 'media'`
- narration/music/SFX stems, `kind: 'audio'`
- `project.json`, `kind: 'project'`, mime `application/json`, **filename exactly `project.json`**
- optionally `assets-manifest.json`, `source.zip`, caption `.srt`

Prepare sanitizes `filename` to `[A-Za-z0-9._-]`. Use basenames (`scene_S01.mp4`), not paths.

## Progress stages

Fixed order, shown to the customer as pending / active / done. `fixing` may repeat.

1. `research` — default: "We're finding the best photos and clips…"
2. `story` — "We're writing your story…"
3. `voice` — "We're recording narration…"
4. `scenes` — "We're building your scenes…"
5. `review` — "We're reviewing the cut…"
6. `fixing` — "We're polishing a few details…"
7. `rendering` — "We're rendering your final video…"
8. `delivering` — "We're adding the video to your timeline…"
9. `complete` — "Done! Your film is ready to edit."

Messages must be short, friendly, first-person-plural, branded as Transovo / Transovo Agent. Never include bot/model/engine names, file paths, tool names, stack traces, signed URLs, credentials, or prices. The server rewrites a message that trips those patterns to the default for that stage. History is stored in `StudioActivityEvent` and the UI polls every few seconds.

On `/complete`, the job is marked `status: 'complete'`, `phase: 'complete'`, `progress: 100`, and a complete activity event is written. The Motion Studio project is set to `status: 'review'`, `stage: 'review'` (editor-review state) and `timelineVersion` increments. `exportInfo` gets `{ masterKey, smallKey, durationMs, source: 'transovo_agent', agentJobId, storageDriver }`.

## `project.json` the importer requires

- `schema` (or `schemaVersion`) must be exactly `transovo.motion-project/1`
- `tracks: [{ id, kind, label }]` — `id` must match `^[A-Za-z0-9_-]{1,40}$`. `name` is accepted as a label fallback. Elements may also be nested as `tracks[].elements` or `tracks[].items`.
- `elements: [{ id, trackId, startMs, endMs, file, sourceInMs?, sourceOutMs?, gainDb?, text?, editable?, engine?, codeRef? }]`
  - `elementId` is accepted as an id fallback
  - `track` is accepted as a `trackId` fallback (needed for the first Gunna manifest)
  - `filename` / `asset` are accepted as a `file` fallback
  - `startMs`/`endMs` must be non-negative safe integers, `endMs > startMs`, and `endMs <= durationMs + 1000` where `durationMs` is the value sent to `/complete` (also stored on the project as `exportInfo.durationMs`). Over-long elements are **dropped**, not clipped, except the 1s grace; kept elements are then clipped to `durationMs`.
  - File bind: artifact `elementId === element.id` (and optional matching `trackId`), else basename of `file` === artifact `filename`.
- `chapters: [{ id, startMs, title }]` when available. `ms` is accepted instead of `startMs`; `label` instead of `title`. A chapter at or past `durationMs` is dropped.
- Stable element IDs must survive revisions.
- For now, a revision should upload a **full replacement** artifact set and manifest, reusing unchanged asset bytes where possible.

Importer behavior the producer should know:

- The master MP4 stays the default preview/canvas. Scene MP4s land on the Scenes/video lane; footage on Footage; text without a file becomes Titles; audio stems become Narration / Music / Footage audio / Sound effects based on track label/id.
- Media Library skips the master (`kind: 'video'` + filename `video.mp4`) and non A/V/image mimes (json, zip).
- Audio from the manifest replaces the master’s baked audio only if **every** audio-lane element has a registered stem.
- `sourceOutMs` is stored on the manifest but **not used**; trim length is `endMs - startMs` from `sourceInMs`.
- `gainDb` is applied only to audio-lane elements.
- Captions import only from a committed `.srt` / `application/x-subrip` artifact, not from `project.json` `captions`.
- Timeline `fps` is hardcoded to 30 in the importer.

## Editor / versions (customer side, not producer calls)

- Chat: `GET/POST /api/motion-studio/agent/projects/:projectId/chat`
- Restore: `POST /api/motion-studio/agent/projects/:projectId/versions/:jobId/restore`
- If the manifest is missing or invalid, fallback is the master MP4 only.

## Security

Producer callback tokens, storage signatures, and webhook keys never go to the customer UI. No dollar amounts in customer-facing messages or UI. Usage telemetry is private.
