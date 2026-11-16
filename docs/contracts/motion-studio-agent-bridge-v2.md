# Transovo Motion Studio Agent Bridge v2

This contract extends v1 additively. Only `new-app` is changed. Production runs stay in the existing Next.js/Prisma app; the legacy SMS worker and Coolify app3 are not involved.

## Bot producer handoff

The server dispatches HTTPS JSON to the configured webhook with the original jobId and bearer webhook key. `action` is `create_video` or `revise_video`. Every production has a unique `jobId`, `jobUrl`, optional `jobToken` in live mode, `durationSeconds` (exact 30/60/120/180/300), `width`, `height`, `fps`, `resolution`, `aspectRatio`, `quality`, `style`, `webResearch:true`, and `mediaPolicy:'auto_plus_uploads'`. No customer-facing engine selection exists.

A revision adds `parentJobId`, `revision`, `threadId`, `instruction`, `selectedElementIds`, optional `timeRangeMs`, and the last 20 `messageHistory` entries. Idempotency is by **jobId**; repeat webhook deliveries must not start duplicate renders. If `setupMode:true`, do not render.

The bot authenticates to `GET {jobUrl}`, `POST {jobUrl}/progress`, `POST {jobUrl}/assets`, `POST {jobUrl}/messages`, `GET {jobUrl}/parent-artifacts` (revisions only), and `POST {jobUrl}/complete` using `Authorization: Bearer <jobToken>`. The server issues scoped temporary parent-download URLs for revisions, not reusable public asset URLs.

### Progress

`POST /progress` accepts `{stage, message, percent?, sceneId?, timestamp?}`. Valid stages: **research, story, voice, scenes, review, fixing, rendering, delivering, complete**. Stage order is displayed to customers; `fixing` may recur. Wording should be short, friendly, and brand-neutral ("We're building scenes…"). Never include bot/model/engine names, file paths, tracebacks, signed URLs, credentials, or prices in progress or messages. The UI polls progress and chat every few seconds; history persists in `StudioActivityEvent`.

### Asset upload and manifest

`POST /assets` prepare accepts `action:'prepare'`, `filename`, `mime`, `bytes`, `kind`, optionally `elementId`, `trackId`. It returns the existing direct, short-lived object-storage upload mechanism; **do not send large media via Next.js**. Upload then `action:'commit'` as in v1. Up to 300 artifacts are allowed. MP4, WebM, MOV, WAV, M4A, MP3, PNG, JPEG, SRT, JSON and ZIP are accepted. Always upload:
- master video MP4 with `kind:'video'`
- silent scene and footage MP4s, images/overlays as `kind:'media'`
- narration/music/SFX stems as `kind:'audio'`
- `project.json` (`kind:'project'`, JSON)
- optionally `assets-manifest.json`, `source.zip`, caption SRT

`project.json` must include `schema:'transovo.motion-project/1'`, `tracks:[{id,kind,label}]`, and `elements:[{id,trackId,startMs,endMs,file,sourceInMs?,sourceOutMs?,gainDb?,text?,editable?,engine?,codeRef?}]`. File basenames or explicit artifact `elementId` connect elements to files. Include `chapters:[{id,startMs,title}]` when available. Stable element IDs must survive revisions. For now a revision should upload a **full replacement artifact set and manifest**, reusing unchanged asset content where possible. `POST /complete` accepts `{durationMs,summary?}` after all uploads are committed and at least one master MP4 exists.

### Conversation and versions

Customer chat: `GET/POST /api/motion-studio/agent/projects/:projectId/chat`. Bot replies: `POST {jobUrl}/messages` with `{text, needsInput?}`. `needsInput:true` pauses a job; the customer can submit an additional instruction as a linked revision. Prior renders are available through short-lived URLs at `GET {jobUrl}/parent-artifacts`. Customers can see version history and restore a completed render via `POST /api/motion-studio/agent/projects/:projectId/versions/:jobId/restore`. Bot cancellation is best-effort webhook `{action:'cancel',jobId}` plus authoritative persisted status.

### Editor behavior

The project master MP4 remains the default preview/canvas. On opening the Compact Editor, the backend reads `project.json`, stores each supported asset in the existing project Media Library, imports scene/footage/text/audio track placements into `ClipEditsV2`, stores element source/provenance in `edits.motionStudio`, and adds chapters / SRT captions. If the manifest is missing or invalid, fallback is the master MP4. The editor shows the imported named track overview and a separate Transovo Agent revision panel. A new completed job increments `timelineVersion` and remaps the newest manifest; version restore switches back to the selected job.

**Important limitations / follow-ups:** No production smoke test against the real user job `msp_304e68c4fa26412cb9831481d2aa6fe3` has been performed. Full preview/export audio/frame parity and exact rendering of every custom overlay need verification against real uploaded manifests; the master is preserved to avoid playback regression. Revision jobs require the **bot producer's skill** to adopt the new revision fields and re-render only changed scenes. Live deployment must apply the two additive Prisma migrations and regenerate Prisma Client before testing; the v2 schema is not automatically migrated by GitHub commits.

## Security

The UI currently uses the testing-only internal operator (no login), per the user's direction. Do not expose this shared-workspace setup as an unrestricted public production service. Producer callback bearer tokens, storage signatures, and webhook keys never go to the customer UI. Reintroduce tenant authorization and usage/billing enforcement before public launch.
