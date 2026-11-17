# Motion Studio: video types, custom creative direction, brand kits — Grokbot handoff

Branch: `feat/motion-studio-video-types-brand-kits-20261117` (NOT merged to master). This branch also adds the customer-facing Transovo AI Assistant, with no changes to the current no-login testing resolver.

## Behavior
- Creation UI: `/app/motion-studio/new` (legacy `?type=documentary` remains navigable).
- Video type dropdown has 22 values (see `new-app/lib/motion-studio/creative-options.ts`): anything, documentary, social_video, explainer, educational, faq, testimonial, video_ad, animated_ad, product_demo, animated_typography, animated_design, logo_animation, cinemagraph, display_loop, ui_animation, nft_design, gif, video_editing, audiogram, text_overlay, template_customization.
- Creative styles: automatic, minimalist, modern, cinematic, bold, luxury, playful, editorial, retro, futuristic, custom.
- Independent source workflows remain: idea, script, footage. Duration remains 30/60/120/180/300 sec.
- Optional project branding: brand name, primary/secondary/accent HEX colors, typography preference, personality/tone, brand guidelines, uploaded image logo, logo placement (ai_decides/intro/outro/watermark/none), consistency (guided/strict/creative).
- Optional visual reference image/video uploads, optional free-text creative notes, optional 16:9/9:16/1:1.
- Workspace Brand Kits: GET/POST `/api/motion-studio/brand-kits`, DELETE `/api/motion-studio/brand-kits/:id`. POST with existing ID updates. Database migration `20261117090000_motion_studio_brand_kits` required. Preserve the current no-login testing setup unless the owner explicitly requests a change.
- The selected kit is snapshotted into `MotionStudioProject.settings.creative.brand` at project creation; later edits to the kit must not rewrite earlier jobs.
- Logo and reference media use existing `clipUpload` and `studioAsset` infrastructure, not external URLs.

## Grokbot assignment contract
`POST GROKBOT_WEBHOOK_URL` from `new-app/lib/server/motion-studio/agent-bridge.ts` continues to carry existing `prompt`, `title`, `durationSeconds`, `aspectRatio`, `resolution`, `style`, `jobId`, `jobUrl`, and callback fields. It **adds**:
```json
{
  "videoType": "animated_ad",
  "categoryGuidance": "Use original animated storytelling to highlight benefits and finish with a clear call to action.",
  "creative": {
    "videoType": "animated_ad",
    "style": "modern",
    "customStyle": "Optional free-text style when style=custom",
    "instructions": "Make the ending feel warm and optimistic.",
    "brandMode": "saved",
    "brandKitId": "msbk_<uuid>",
    "brand": {
      "name": "Example Brand",
      "primaryColor": "#172554",
      "secondaryColor": "#FFFFFF",
      "accentColor": "#F59E0B",
      "fontPreference": "geometric sans",
      "tone": "confident but friendly",
      "guidelines": "No flashing transitions.",
      "logoUploadId": "upl_...",
      "logoPlacement": "outro",
      "consistency": "guided"
    },
    "referenceUploadIds": ["upl_..."]
  }
}
```
Read `GET jobUrl` with the existing bearer token to fetch signed `inputs` URLs of uploaded media. Match `inputs[].uploadId` to `creative.brand.logoUploadId` and `creative.referenceUploadIds`. The `inputs` entries now expose `uploadId`, `filename`, `mime`, and `url` for exact matching.

**Precedence**: validated mandatory facts and safety > user's explicit instructions > strict brand constraints > category guidance > optional style suggestion. Never overwrite `prompt`, and do not treat brand or category as a scene template. Original concepts, compositions, animation, footage selection and storytelling remain the responsibility of the creative agents. `brandMode=none` means ignore brand fields; `guided` means stylistic consistency, `strict` means follow the approved identity, `creative` means broader art direction unless user states mandatory requirements.

**Rendering/export caveats**: `gif`, alpha-background outputs, and seamless looping require separate validated renderer/export capabilities. Initial selection is production guidance, not a promise of native GIF or alpha export. Existing render path is MP4. Do not invent product features or customer testimonials. Never promise 5-second exports while UI enforces 30-second minimum.

## Customer chat and production revisions — new contract

The initial producer workspace now displays the Transovo AI Assistant on the right of the video/job panel from the first run onward; the Compact Editor's Motion Studio lane integration already provides a chat when opened. The old blueprint AI Director path remains unchanged where no autonomous agent job exists.

Customer sends `POST /api/motion-studio/agent/projects/:projectId/chat`:
```json
{"instruction":"Make the opening darker and move the logo to the end.","selectedElementIds":["optional-element-id"],"timeRangeMs":[10000,11000]}
```
The backend calls a lightweight conversation model to classify `question`, `clarify`, or `edit`, using the saved creative brand snapshot, project title/status and recent chat history.

- `question` and `clarify`: persistent customer and assistant messages, **NO Grokbot production job**; progress/status questions are handled deterministically from actual job state.
- `edit` after a completed video: one existing revision job via `dispatchAgentJob`; preserve previous video/version; the assistant confirms only that production accepted the job, not that edits are complete.
- `edit` while a job is running or waiting: store a `queued_edit` internal message tied to that job (without starting another job). After successful completion, combine queued requests and dispatch at most one follow-up revision, with stable idempotency `queued-after-<jobId>`. If dispatch cannot run (quotas/network), requests remain queued for review; do not silently discard them.
- Producer `needs_input`: producer calls authenticated `POST /api/motion-studio/agent/jobs/:jobId/messages` with `{"text":"Your one question","needsInput":true}`. The active job becomes `needs_input`. A subsequent customer message submitted with `answerInput: true` (selected in the chat UI) other than a simple status check is forwarded to the existing `GROKBOT_WEBHOOK_URL` as:
```json
{"action":"answer_input","jobId":"msaj_...","projectId":"msp_...","text":"Use the first photo.","idempotencyKey":"ms_revision_..."}
```
The producer **must implement** `answer_input`, accept it idempotently, and continue the same job rather than generate a fresh revision. Return HTTP 2xx only after accepting the answer. The backend persists the customer's answer BEFORE webhook delivery, then acknowledges it using a deterministic confirmation ID; a retry reuses the same idempotency key and can repair a failed post-webhook database write. The producer now supports `answer_input` according to Brock, but end-to-end confirmation is still pending.

**Producer question safety:** `needsInput: true` messages retain up to 2,000 characters, including ordinary URLs, dollar values, and the word "bot". Do not apply the 240-character progress filter to questions. Late `/progress` calls do not clear `needs_input`, and a concurrent terminal status cannot be reset by progress.\n\n**24-hour unanswered window:** the frontend displays a deadline from the waiting job's `updatedAt`. If unanswered for 24 hours, the backend marks the job failed cleanly on subsequent client/producer polling. It is a lazy timeout, NOT an exact wall-clock scheduled job: for unattended expiration, the producer must also enforce its own 24-hour fallback or a dedicated worker must periodically check queued questions.\n\nCustomer-facing message thread persists in `MotionStudioAgentMessage`; versions remain in `MotionStudioAgentJob`. The UI polls every four seconds and exposes Restore without removing later versions. Internal vendor names and secrets should never be emitted to the customer. The customer knows it is the Transovo **AI** Assistant, not a human.

**Not implemented:** deterministic direct visual edits through this chat; actionable edits currently go through existing Grokbot revision route. Do not claim zero-cost direct edits, immediate rerenders, or full production/consumer end-to-end verification. No new authentication gate has been added.

## Production readiness
- Re-run `prisma validate`, scoped `vitest`, `tsc` against master, and a real create/chat/clarify/answer/revision test. The 52/52 reported by Brock was from before this newest patch series and does not validate these changes.
- SVG brand logos with standard `xmlns`/`xmlns:xlink` are accepted and converted to PNG in the browser; SVG script/external content is rejected. The server continues to accept PNG/JPEG/WebP.
- Keep the existing no-login testing resolver intact. No login or account-auth work is part of this branch.
- Existing agent testing quotas (3 initial jobs/day and 3 active jobs/user) remain unchanged; they are not a SaaS quota system.
- Ensure 9:16 and 1:1 render, preview, timeline, and export have parity beyond the creation form.
- Ensure actual Grokbot producer consumes the new assignment fields; this branch adds sending, NOT changes to the external Grokbot prompt/agent code.

## Persistent workspace/project production context

**Grokbot workers are stateless executors.** Transovo's PostgreSQL project/job records and persistent asset storage are the source of truth. A customer's browser and a Grokbot process can both disappear without losing the project.

- Every new assignment includes `workspaceId`, `projectId`, and `jobId` as distinct IDs. `userId` is stored on the job. Do not use a single process-wide session, memory buffer, or on-disk folder as the durable owner of a project.
- `GET /api/motion-studio/agent/jobs/:id` using the job-scoped bearer token now returns `projectContext` (workspace and project IDs, story, plan, narration, music, QA, editor timeline version and export metadata), `checkpoint`, `inputs` with stable `uploadId` and source role, `versions` with previous production artifact IDs/metadata and fresh signed preview URL, and a recent `conversation`.
- The assignment also includes `recoverableCheckpoints` (up to five earlier persisted job states and artifact IDs), including unfinished or failed attempts. A new worker can inspect them and explicitly decide which intermediate output is safe to reuse; never assume a failed checkpoint is a completed film.
- A new worker can retrieve ready files from any previous attempt within the same workspace and project using `GET /api/motion-studio/agent/jobs/:id/recovery-assets?sourceJobId=msaj_...` with its current job bearer. This returns fresh signed links for saved intermediate scenes, media and other committed artifacts, plus that attempt's checkpoint.
- For full individual parent-version media, use existing `GET /api/motion-studio/agent/jobs/:id/parent-artifacts` (job bearer). Never rely on original short-lived signed URLs beyond their expiry. Fetch new signed URLs when a new job starts.
- New additive column `MotionStudioAgentJob.checkpoint Json?` and migration `20261117093000_motion_studio_job_checkpoint` support durable producer checkpoints. Read `GET /api/motion-studio/agent/jobs/:id/checkpoint`; write `PUT` to the same URL with `{"revision":1,"checkpoint":{"stage":"visuals","finishedSceneIds":["scene_a"],"remainingSceneIds":["scene_b"],"manifestAssetIds":["asset_123"]}}`. Keep under 256 KB. Increase the monotonic revision for subsequent saves; conflicts mean reload latest checkpoint. Never store signed URLs, large scene files, raw videos, or secrets inside the checkpoint. Upload those into persistent storage and refer to durable asset IDs.
- Once a producer checkpoint is committed, it can stop using CPU resources to wait for customer input; later processing can run on another worker. The running-job bearer currently lasts 36 hours; it is **not** a 30-day credential. A new revision after 30 days receives a fresh job/token and can retrieve the same project and stored media. Long-lived resume of the *same* unfinished job beyond bearer expiry needs an explicit token re-issuance protocol and is not implemented.
- The current dispatcher still sends immediately and has testing concurrency limits. This is NOT yet a durable multi-tenant worker leasing/scheduling system. Before scaling to many simultaneous users, implement a persistent queue with leases, heartbeat/recovery, workspace fairness and per-workspace concurrency/usage budgets. Never add this by making Grokbot hold open a user session or a computer process.
- Existing no-login testing configuration remains unchanged. Job bearer verification is producer-to-server access, not a customer login gate.


## Durable pull queue and secure producer token rotation

The default existing webhook delivery remains enabled. The following is **opt-in**, and MUST stay disabled until the producer polling integration is deployed:

- Transovo env: `MOTION_STUDIO_PULL_QUEUE=1`, `MOTION_STUDIO_PRODUCER_QUEUE_KEY=<random secret of at least 32 characters>`, `MOTION_STUDIO_AGENT_PUBLIC_URL=https://...your Transovo API origin`.
- Creation refuses to queue when the producer queue key or public URL is missing; turning on the flag alone is insufficient.
- The queue key authenticates **producer service calls** only, and must never be sent to browsers. This is NOT customer login. The no-login customer testing resolver remains unchanged.
- When enabled, `dispatchAgentJob` persists a job with `status=queued` and does **not** send the original webhook. Both initial productions and revisions follow the same path.
- Producers poll `POST /api/motion-studio/agent/queue/claim` with header `Authorization: Bearer <queue key>` and body `{"workerId":"producer-01"}`. Empty queue returns `{"job":null}`. An assignment returns `jobId,workspaceId,projectId,userId,parentJobId,revision,jobUrl,jobToken,leaseId,leaseExpiresAt,tokenExpiresAt,workerId`.
- Use the returned **job-specific** `jobToken` to fetch `GET jobUrl`, retrieve fresh media signed URLs, inspect saved `checkpoint`, and use existing producer progress/artifact/finish endpoints. Producer context is reconstructed for each claim; workers must not use persistent local user folders as the project database.
- Each claim creates an exclusive 5-minute lease. Every ~60 seconds while actively working, call `POST /api/motion-studio/agent/queue/lease` using the same producer queue key with `{"action":"heartbeat","jobId":"msaj_...","workerId":"producer-01","leaseId":"<from claim>"}`. A heartbeat extends the lease. If the worker disappears and the lease expires, another worker may claim the same job and receive a **different** token and lease ID. The former token is invalidated.
- A long-running producer can request a new **job bearer token**, even if its old 36-hour token has expired, by sending the same lease request with `"action":"renew"`. Renew succeeds only with the producer queue key, matching worker ID, matching secret lease ID, and an **unexpired** lease; it rotates the old token and returns `jobToken` and `tokenExpiresAt`. If the lease expired, the worker must **claim again**, not renew. Callbacks without the current valid lease are rejected.
- Once a producer posts `needsInput:true`, its lease is released. The producer saves `PUT jobUrl/checkpoint` **before** asking the question. This frees worker capacity for other customers. The customer's answer is persisted in Transovo and changes the **same job** to `queued` (no direct `answer_input` webhook in pull mode). The next claim returns `resumeAnswer` plus the saved checkpoint; the new worker continues the same job.
- A finished job releases its lease. Existing queued follow-up revisions are dispatched as additional **queued** jobs. The producer should treat duplicate claim/retry deliveries for the same `jobId` as rehydrations of one production, not new charges or new work from scratch.
- Each claim also sweeps unanswered jobs older than 24 hours so a dormant customer browser cannot leave jobs waiting forever. The backend closes them cleanly; a producer-side timeout can independently apply an explicit creative fallback if the product chooses that policy.
- Queue selection uses PostgreSQL row locking (`FOR UPDATE SKIP LOCKED`), serializes claims per workspace, and reclaims stale leases. This initial scheduler allows one active claim per workspace and caps crash-reclaims at 20. The existing testing limit of 3 initial jobs/day or 12 revisions/day and 3 active jobs per user remains; it is **not** a finished billing or tenant-fairness model.
- The latest job and checkpoint must be persisted durably before the producer reports each stage done. Short-lived media URLs must be refreshed through job context on the next claim. Do not store raw video or large scene files in the JSON checkpoint.

**Deployment sequence:** apply `20261117100000_motion_studio_producer_queue` and the earlier checkpoint migration, regenerate Prisma Client, deploy Transovo preview code, configure the producer service key, implement Brock's poll/claim/heartbeat/renew/resume handling, run end-to-end tests with queue flag **off**, then enable the flag in preview and test parallel producer claims, killed-worker reclaim, same-job question/answer, and 36-hour token renewal. Do not flip the flag in production before the poller is ready. **Nothing in this branch is merged or deployed.**

## Recheck fixes after Brock review (Nov 17)

- Duplicate `messageId` declaration in `submitAgentRevision` removed; `agent-waiting.test.ts` uses a standard import, not top-level `await`; the previous generic return cast in the waiting-status handler is now an explicit `unknown` intermediate after database refetch.
- `MotionStudioAgentJob.waitingStartedAt` is a separate optional DateTime column added by migration `20261117103000_motion_studio_waiting_started_at`. Customer questions set it; checkpoint writes and progress do **not** extend it. Customer answers clear it. Queue polling and customer status checks expire based on this field. This migration must be applied before testing; existing waiting rows with null dates need an intentional migration/backfill or fresh customer question.
- Legacy webhook-mode `answer_input` now includes `workspaceId`, `projectId`, `jobId`, `jobUrl`, a fresh `jobToken`, and its `tokenExpiresAt`. A stable HMAC derived from the webhook service key, job and answer idempotency key makes retried deliveries issue the same scoped token; the server stores only the hash. Grokbot should always replace its old job token with the supplied token, and treat duplicate answers idempotently. Pull mode instead re-queues the job for a fresh claim and does not use this webhook action.
- The producer's `projectContext.exportInfo` is explicitly limited to `durationMs`, `source`, and `agentJobId`; internal `masterKey`/`smallKey` storage paths are not returned. Relevant media is delivered through fresh signed asset endpoints.
- Checkpoint input rejects credential-related field names, signed HTTP URLs, and raw `ws/`, `s3://`, or `gs://` storage locations, including nested values. Persist stable IDs only.
- Earlier-job ready artifacts are downloadable using `GET /api/motion-studio/agent/jobs/:id/recovery-assets?sourceJobId=...` with the current job bearer, scoped to the **same workspace and project**. Use this when a checkpoint references output saved before a different worker stopped.
- Queued edits are project-level durable `queued_edit` messages rather than tied to only the last successful job. A failed or timed-out production leaves the requests intact for the next successful revision. Nothing is falsely marked sent on failure.
- Safe SVG import tolerates additional editor namespaces and removes non-rendered Inkscape metadata before rasterization, while still forbidding executable content and external assets.

**Verification status:** The earlier 63 passing tests were reported by Brock against an older branch state, with four additional tests blocked by the duplicate symbol. These new fixes have been committed but NOT yet run in the chat environment. Re-run the full scoped suites, Prisma schema/migrations and TypeScript comparison; then verify webhook-mode resume and pull-queue resume in preview before enabling production.

## Follow-up corrections for the 74/75 validation report

- Fixed accidental doubled escapes in the literal regexes in `checkpoint-contract.ts` and `logo-upload.ts`; the long-question test now compares against the intentionally trimmed question.
- Lease claim comparisons now use `timezone('UTC', CURRENT_TIMESTAMP)` (timestamp without time zone), so a PostgreSQL session set to New York time does not miscompare UTC timestamps stored in lease columns. Re-test with the PostgreSQL session time zone set to `America/New_York` and a just-expired lease.
- Created migration `20261117104500_motion_studio_waiting_backfill` to initialize `waitingStartedAt` for legacy `needs_input` jobs from their last known `updatedAt`. Further checkpoint updates do not change the response deadline.
- A successful answer resets the job's crash-claim counter (`leaseAttempts=0`) so normal multi-round clarifications are not mistaken for twenty interrupted workers.
- Revision eligibility checks for any completed version of the same workspace/project, not only `latest.resultKey`; a failed latest attempt does not hide an earlier completed version.
- For **legacy webhook mode**, configure `MOTION_STUDIO_JOB_TOKEN_SECRET` to an independent random secret of at least 32 characters, **different from** `GROKBOT_WEBHOOK_KEY`. A fresh deterministic per-answer token is staged as `pendingTokenHash` before delivery; the previous token remains valid until producer acceptance. A failed webhook clears the staged token; a successful delivery promotes it. Additive migration `20261117110000_motion_studio_pending_resume_token` creates the optional staged fields. **Do not reuse the webhook secret as a derivation key.**
- In **pull mode**, workers already receive a fresh token on each queue claim and should not use the legacy answer webhook.
- Customer answers to producer questions are stored with internal role `answer`; client and conversation presentation map them back to customer role. `resumeAnswer` now queries only that answer role, not unrelated chat or edit messages.
- Checkpoint inspection now preserves ordinary hyperlinks inside written narration/story text, while blocking credential-like field names, signed media URLs, raw storage paths, and suspicious external media-file URLs. References to source media should be stable asset IDs.
- Saved project-level queued edit requests remain available after a failed production or timeout. On the next successful completion, pending requests are collected for a follow-up revision; they are not falsely marked sent by a failed job.

**New validation required:** regex import/parsing, 75-test suite plus new regression assertions, TypeScript vs master, Prisma validate, all migrations including legacy backfill and staged token columns, claim under a New York PostgreSQL session time zone, rejected webhook preserving old token, retry after webhook acceptance, questions through more than 20 rounds, revisions after failed latest job with older completed version, and resumeAnswer not mistakenly picking a normal chat message.

The existing no-login customer testing setup remains unchanged. Do not merge, deploy, or enable the queue until the branch is validated with the real producer.
