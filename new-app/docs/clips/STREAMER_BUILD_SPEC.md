# Transovo: Streamer mode build spec (S0 to S15)

**Repo:** `703deuce/sms`. App is `new-app/` (Next.js 16, React 19, pnpm). Prisma 6 schema is root `prisma/schema.prisma` (latest migration `20261026120000_clip_thumbnails`). Worker is `worker/clips_worker/` (Python, faster-whisper, Gemini, `gpt-6-luna` LLM with `gpt-4o-mini` fallback). Deploy: Coolify from `master`.
**Written:** Mon Oct 26 2026 (America/New_York). **Audience:** a Cursor coding agent. **Style:** same as `/workspace/plan/descript_build_spec.md`.
**What it is:** an Opus Clip-style streamer mode.
- Paste a Twitch/Kick VOD, highlight or clip link (or upload a recording), or connect your own channel so every stream auto-processes.
- Moments are ranked from cheap signals (loudness, chat, viewer clips, transcript LLM), with reasons.
- Output is 9:16 facecam + gameplay clips with captions, metadata, optional chat overlay, and a montage.
- GPU work goes to Modal serverless (scale to zero), with a local fallback.

---

## 0. Ground rules (apply to every milestone)

### 0.1 Scope
| In scope (build) | OUT of scope (do not build, do not stub UI for) |
|---|---|
| Paste-a-link ingest (Twitch VOD / highlight / clip, Kick VOD / clip) + file upload of recordings | **Recording or restreaming any live stream.** No live HLS/RTMP capture of anyone, including the user. Only finished VODs/clips, or files the user uploads. |
| Connect-account auto-pull for the **user's own** Twitch and Kick channel (OAuth + webhooks) | Auto-pull of any channel the user did not authorize via OAuth |
| Highlight score from audio, chat, viewer clips and transcript LLM, ranked clips with reasons | Social publishing back to Twitch/Kick/TikTok/YouTube |
| 9:16 facecam + gameplay stack, auto facecam detection, user-drawn box, per-channel layout presets | Login/auth, sessions, credits, billing, plan enforcement, Stripe, marketing pages |
| Captions (existing system), title/game metadata, optional chat overlay, montage | Emote **images** in the chat overlay (v1 renders emote names as text) |
| Per-channel settings, auto-process toggle, in-app + email notifications | RunPod provider (env value reserved, raises "not built") |
| `GPU_PROVIDER=local\|modal` for transcription, face tracking and rendering | Sub-only / private VODs (need the viewer's cookies, so not supported; the user uploads the file instead) |
| Per-workspace stream-hour usage + configurable cap, queue priority, source deletion after processing | Plans/tiers (the cap is a number in `WorkspaceLimits.limits`, editable in UI, with no plan logic) |

Every route uses `resolveWorkspaceId()` (`new-app/lib/server/workspace.ts`) and the same access guard the existing `/api/clips/**` routes use (copy the top of `new-app/app/api/clips/projects/route.ts`). No route may require a session. Webhook and `/api/internal/**` routes skip that guard and authenticate by signature only.

### 0.2 Engineering rules
1. **Prisma migrations are additive only.**
   - Allowed: new models, new nullable columns, new columns with defaults, enum values appended at the end, new indexes, and back-relation fields (no SQL).
   - Forbidden: drop, rename, type change, and `NOT NULL` without a default.
   - Create each migration with `pnpm prisma migrate dev --name sN_<slug> --create-only`, then grep the SQL for `DROP` / `ALTER COLUMN ... TYPE` before applying.
   - Deleting user data is a soft delete (`deletedAt`) or a storage-object delete. **Never drop tables.**
2. **Worker job types: the S0 refactor comes first.**
   - Today the type lists live in 3 places in `worker/clips_worker/main.py`: `count_queued_jobs()`, `claim_job()` and the dispatch. S0 refactors them to one module-level `JOB_TYPES: tuple[str, ...]` plus a `DISPATCH: dict[str, Callable]`, with no behaviour change.
   - `worker/tests/test_job_types.py` asserts `set(JOB_TYPES) == set(DISPATCH)` and that both SQL builders use `JOB_TYPES`.
   - Every new `STREAM_*` type is added there.
   - The queue order stays `ORDER BY priority DESC, "runAfter" ASC` with `FOR UPDATE SKIP LOCKED`.
3. **Heartbeat (S0, required before any long job).**
   - The reaper resets `RUNNING` jobs whose `lockedAt` is older than 5 min (when `attempts < 3`), and the multi-hour streamer jobs would be killed.
   - Fix: `POST /api/internal/jobs/[id]/progress` sets `"lockedAt" = NOW()` whenever the job is `RUNNING`.
   - The worker gets `clips_worker/heartbeat.py`: a `Heartbeat(job_id, post_progress, every_s=45)` context manager running a daemon thread that re-posts the last stage/progress. Every `STREAM_*` handler wraps its body in it.
   - The reaper is otherwise unchanged.
4. **Idempotent, resumable jobs.** A reaped long job restarts from the top. Each `STREAM_*` handler checkpoints into `StreamVod.state` (JSON), for example `{audioKey, chunks:{"0":"…/0.words.json"}, signalsKey, segmentKeys:{…}}`, and skips completed steps.
5. **Two worker lanes (S2).**
   - The env is `WORKER_LANE=default|stream|all` (default `all`): `default` claims every type except `STREAM_*`, `stream` claims only `STREAM_*`, `all` claims both.
   - `infra/coolify/clips-worker/docker-compose.yml` gains a second service, `clips-worker-stream`: same image, same `worker.env`, plus `WORKER_LANE=stream`. The existing service sets `WORKER_LANE=default`.
   - Result: a 10-hour VOD never blocks normal uploads.
6. **Secrets.**
   - Read env server-side only and never log values. `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` are read implicitly by the Modal client from env and never printed. Never pass them as CLI args, and use `set +x` in scripts.
   - OAuth tokens are stored encrypted with the existing `encryptIntegrationSecret` / decrypt pair (`rg -n "encryptIntegrationSecret" new-app/lib`) in `IntegrationConnection.accessToken/refreshToken`.
7. **LLM.** Use the existing picker LLM client (`worker/clips_worker/picker/llm.py`): `gpt-6-luna`, falling back to `gpt-4o-mini`. **Never send `temperature`.** Use JSON output only.
8. **Storage.**
   - Bucket `clips`, keys under `ws/{workspaceId}/…`.
   - `upload_file` reads the whole file into memory, so **never upload a multi-GB file from the worker**. The streamer pipeline only uploads small audio (opus, about 11 MB/h), JSON and short segments (≤ about 150 MB).
   - S0 adds `sign_url(key, expires_s)` and `sign_upload_url(key)` to `worker/clips_worker/storage.py` (Supabase `object/sign` and `object/upload/sign`) so Modal never needs storage keys.
   - S2 makes `download_object` stream to disk in 8 MB chunks if it currently buffers.
9. **Tests.**
   - `vitest`: parsers, zod schemas, route handlers (vendor fetch mocked), webhook signature verification.
   - `pytest`: worker modules with tiny fixtures in `worker/tests/fixtures/streamer/` and `yt-dlp`/HTTP mocked.
   - Live network tests are `@pytest.mark.live` and skipped unless `STREAMER_LIVE_TESTS=1`.
   - Playwright: one happy path per milestone (`e2e/sN-*.spec.ts`, port 3100).
10. **Owner tests on production.** Every milestone lists **Browser acceptance (prod)** steps the owner clicks through on https://transovo.ai after deploy. Each milestone PR updates `docs/clips/PROGRESS.md` and passes the "READY TO PUSH" gate before merge to `master`.

### 0.3 Vendors, platforms and docs (verified 2026-10-26)
| Purpose | Vendor / tool | Facts used by this spec | Docs |
|---|---|---|---|
| GPU serverless | **Modal** | <ul><li>L4 costs $0.000222/s (about $0.80/h). Starter includes $30/mo credit (about 37 L4-hours), 10 GPU concurrency, 100 containers.</li><li>Function params: `gpu`, `min_containers`, `max_containers`, `buffer_containers`, `scaledown_window` (2 s–20 min, default 60 s), `timeout` (default 300 s, max 24 h).</li><li>Call deployed functions with `modal.Function.from_name(app, name)` / `modal.Cls.from_name` plus `.remote/.spawn/.map`.</li><li>Volumes cost $0.09/GiB/mo.</li><li>The client authenticates from `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET` env.</li></ul> | https://modal.com/pricing · https://modal.com/docs/guide/gpu · https://modal.com/docs/guide/scale · https://modal.com/docs/reference/modal.App#function · https://modal.com/docs/guide/trigger-deployed-functions |
| Transcription on GPU | faster-whisper `large-v3`, CUDA 12 + cuDNN 9, `BatchedInferencePipeline` | Word timestamps and VAD filter. The throughput estimate is about 30–45× realtime on L4; **verify in S0 QA** and write the measured value into PROGRESS.md. | https://github.com/SYSTRAN/faster-whisper |
| Download | **yt-dlp** `yt-dlp[default,curl-cffi]` (Kick extractor uses impersonation) | <ul><li>Extractors: `twitch:vod`, `twitch:clips`, `twitch:videos`, `kick:vod` (`kick.com/<slug>/videos/<uuid>`), `kick:clip` (`kick.com/<slug>?clip=clip_…`, `kick.com/<slug>/clips/clip_…`), `kick:videos` (channel VOD list, newest first).</li><li>`--download-sections "*START-END"` fetches a time range only.</li><li>**No Twitch chat replay** in yt-dlp anymore.</li></ul> | https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md · https://github.com/yt-dlp/yt-dlp#download-options |
| Twitch | Helix + EventSub (webhook) + OAuth | <ul><li>Get Videos `GET /helix/videos?user_id=&type=archive&first=5`.</li><li>Get Clips `GET /helix/clips?broadcaster_id=&started_at=&ended_at=&first=100` (fields `video_id`, `vod_offset` nullable, `view_count`, `duration`, `created_at`).</li><li>`stream.online` / `stream.offline` / `channel.update` need no authorization.</li><li>`channel.chat.message` with an app token needs `user:read:chat` + `user:bot` from the chatting user and `channel:bot` from the broadcaster. We ask the streamer for `user:read:chat user:bot channel:bot` and set the condition `broadcaster_user_id = user_id = streamer`.</li><li>Webhook HMAC: `sha256=` + HMAC-SHA256(secret, `id + timestamp + rawBody`) with headers `Twitch-Eventsub-Message-Id/-Timestamp/-Signature/-Type`. Handles challenge and revocation.</li><li>Apps must `/validate` user tokens hourly.</li></ul> | https://dev.twitch.tv/docs/api/reference/#get-videos · https://dev.twitch.tv/docs/api/reference/#get-clips · https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ · https://dev.twitch.tv/docs/eventsub/handling-webhook-events/ · https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/ · https://dev.twitch.tv/docs/authentication/validate-tokens/ |
| Twitch VOD chat replay | **Unofficial** GQL `VideoCommentsByOffsetOrCursor` | Best effort and non-fatal, behind `TWITCH_VOD_CHAT_REPLAY=gql\|off`. See ToS note §0.5. | n/a (undocumented) |
| Kick | Kick public API + webhooks + OAuth 2.1 | <ul><li>`id.kick.com/oauth/authorize` (PKCE S256 **required**, `state`, `scope`) and `/oauth/token` (`authorization_code`, `refresh_token`, `client_credentials`), plus `/oauth/revoke`.</li><li>Scopes: `user:read channel:read events:subscribe`.</li><li>Subscribe with `POST https://api.kick.com/public/v1/events/subscriptions`.</li><li>Events: `livestream.status.updated` (`is_live:false` + `ended_at` = stream ended), `chat.message.sent`, `livestream.metadata.updated`.</li><li>The webhook URL is set in the Kick app settings.</li><li>Signature: RSA PKCS#1 v1.5 SHA-256 over `` `${Kick-Event-Message-Id}.${Kick-Event-Message-Timestamp}.${rawBody}` ``, base64 header `Kick-Event-Signature`, public key from `GET https://api.kick.com/public/v1/public-key` (fetch and cache; don't hardcode).</li><li>Kick unsubscribes after about a day of failed deliveries.</li><li>**No public VOD-list endpoint** (VOD discovery uses yt-dlp `kick:videos`).</li></ul> | https://docs.kick.com/getting-started/generating-tokens-oauth2-flow · https://docs.kick.com/events/subscribe-to-events · https://docs.kick.com/events/webhook-security · https://docs.kick.com/events/event-types |
| Vision fallback | Gemini (existing `worker/clips_worker/gemini_vision.py`) | Facecam box fallback when the CV confidence is below 0.6 | existing |
| Email | Brevo (existing `new-app/lib/email/brevo.ts`, `sendTransactionalEmail`) | "Clips ready" email | existing |

Before coding against Kick, re-check field names in the responses for `/public/v1/users`, `/public/v1/channels` and event payloads at docs.kick.com. The shapes below are from the docs as read on 2026-10-26, but Kick's API is young.

### 0.4 Deploy checklist (every milestone)
1. Pass the PROGRESS.md "READY TO PUSH" gate, then merge to `master`. Coolify builds the app.
2. **New app env vars** are set on the Coolify app through the Coolify API (names in §21). **New worker env vars** are appended to `/opt/clips-worker/worker.env`, then the worker containers restart.
3. **Modal** (S0, and whenever `worker/modal_app/**` changes): run the deploy from inside the worker container, which already has the tokens in env. Nothing is printed.
   ```bash
   docker exec clips-worker sh -lc 'cd /app/worker 2>/dev/null || cd /app; set +x; modal deploy -m modal_app.app'
   ```
   Verify with `modal app list` (shows `transovo-gpu` deployed).
4. Migrations run through the existing deploy path (`prisma migrate deploy`).

### 0.5 Platform risk and ToS notes (show the short version in UI)
- **yt-dlp downloads use unofficial endpoints of Twitch and Kick.** It is a gray area under both platforms' terms and can break when the sites change.
  - Mitigations: the user must tick "This is my channel or I have the creator's permission" before a paste import (`StreamVod.attestedAt`); auto-pull only works on a channel the user connected by OAuth; we only fetch finished VODs/clips, never live streams; we fetch only the audio plus the selected clip ranges; and sources are deleted after `STREAMER_SOURCE_RETENTION_HOURS`.
  - Keep `yt-dlp` updated: rebuild the worker image weekly, pinned to the latest release at build time.
- **Twitch VOD chat replay uses an undocumented GQL operation.** It may break or be rate-limited, and it is best-effort and non-fatal. `TWITCH_VOD_CHAT_REPLAY=off` disables it. For connected channels the official EventSub chat capture (S13) is used instead.
- **Kick VOD discovery for auto-pull uses yt-dlp `kick:videos`** (there's no official endpoint). If it fails, the user gets a notification asking them to paste the link or upload.
- UI copy (Streamer tab footer, `components/streamer/tos-note.tsx`): *"Only import streams you own or have permission to use. We fetch finished VODs and clips, never live streams, and delete the source after processing (clips are kept)."*

---

## 1. Milestone order
| # | Milestone | Ships (user-visible) |
|---|---|---|
| **S0** | GPU provider abstraction + Modal app, job-type refactor, heartbeat | Uploads transcribe on a Modal L4 with large-v3 (`GPU_PROVIDER=modal`), falling back to local |
| **S1** | Paste-a-link ingest (Twitch/Kick VOD, highlight, clip) + Streamer tab + upload | Paste a link in `/app/clips/new` → Streamer tab → clips (≤ 3 h, existing pipeline) |
| **S2** | Long-VOD pipeline: audio-first, chunked GPU transcription, range-only video download, per-clip source segments, worker lanes | VODs up to 12 h without downloading the full video |
| **S3** | Cost controls: stream-hour usage + cap, priority, source deletion, Modal budget guard | Usage meter and cap; sources auto-deleted, clips kept |
| **S4** | Highlight score v1: audio loudness + transcript LLM, fusion, reasons, hype timeline | Ranked clips with "why" chips and a hype graph |
| **S5** | Chat signal from Twitch VOD chat replay | Chat-spike reasons on Twitch VODs |
| **S6** | Viewer-clip signal (Twitch Get Clips; Kick best effort) | "N viewers clipped this" reasons |
| **S7** | Facecam auto-detect + 9:16 stacked facecam/gameplay render | Streamer layout clips automatically |
| **S8** | Layout box editor + per-channel layout presets | Draw/adjust boxes, saved per channel, re-render |
| **S9** | Captions placement, title/game metadata, optional chat overlay | Seam captions, game badge, chat overlay toggle |
| **S10** | Montage of top moments | "Make montage" → one MP4 |
| **S11** | Notifications: real in-app popover + email when clips are ready | Bell shows real items; email arrives |
| **S12** | `/app/streamer` channels page, per-channel settings, auto-process toggle (UI), OBS fallback docs, nav item | Channels hub |
| **S13** | Twitch connect: OAuth, EventSub `stream.offline` auto-pull, live chat capture, hourly maintenance | Stream ends → clips arrive automatically |
| **S14** | Kick connect: OAuth 2.1 PKCE, webhook auto-pull, live chat capture | Same for Kick |
| **S15** | GPU rendering + face tracking on Modal (batched per VOD), parity tests, hardening/load test | Faster renders, measured costs |

Every milestone is independently shippable. Later milestones only add.

---
## 2. Data model (all additive; the migration that introduces each part is noted)

```prisma
// ---------- S1: s1_streamer_ingest ----------
model StreamChannel {
  id              String    @id @default(cuid())
  workspaceId     String
  platform        String                       // 'twitch' | 'kick'
  login           String                       // lowercase slug/login (from URL or metadata)
  externalId      String?                      // Twitch user id / Kick broadcaster_user_id (null until known)
  displayName     String?
  avatarUrl       String?
  connectionId    String?                      // IntegrationConnection.id when OAuth-connected (S13/S14); null = paste-only
  status          String    @default("PASTE_ONLY") // PASTE_ONLY | CONNECTED | NEEDS_REAUTH | DISCONNECTED
  autoProcess     Boolean   @default(false)    // only honoured when status = CONNECTED
  settings        Json      @default("{}")     // StreamerChannelSettings (lib/streamer/settings.ts)
  platformState   Json      @default("{}")     // { eventsubIds?, kickSubIds?, live?: {sessionId, startedAt}, categoryLog?: [{at,title,category}] }
  lastVodAt       DateTime?
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  vods            StreamVod[]
  @@unique([workspaceId, platform, login])
  @@index([platform, externalId])
  @@map("stream_channels")
}

model StreamVod {                              // one per streamer ClipProject (1:1)
  id              String    @id @default(cuid())
  workspaceId     String
  projectId       String    @unique
  channelId       String?
  platform        String                       // 'twitch' | 'kick' | 'upload'
  sourceType      String                       // 'vod' | 'highlight' | 'clip' | 'upload'
  externalId      String?                      // twitch video id / clip slug, kick vod uuid / clip id
  url             String?
  title           String?
  category        String?                      // game / category at VOD level
  chapters        Json?                        // [{startMs,endMs,category}] (twitch chapters / categoryLog)
  streamedAt      DateTime?                    // stream start (VOD created_at / started_at)
  durationMs      Int?
  rangeStartMs    Int       @default(0)        // analysed range (absolute VOD ms)
  rangeEndMs      Int?
  triggeredBy     String                       // 'paste' | 'upload' | 'auto' | 'retry'
  attestedAt      DateTime?                    // "my channel / have permission" tick
  priority        Int       @default(0)
  state           Json      @default("{}")     // resumable checkpoints (see §0.2.4)
  signalsKey      String?                      // ws/{ws}/streams/{id}/signals.json
  chatSource      String?                      // 'twitch_gql' | 'twitch_eventsub' | 'kick_webhook' | 'none'
  chatMessages    Int?
  sourceDeletedAt DateTime?
  notifiedAt      DateTime?
  error           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  workspace       Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project         ClipProject   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  channel         StreamChannel? @relation(fields: [channelId], references: [id], onDelete: SetNull)
  @@index([workspaceId, createdAt])
  @@index([channelId, streamedAt])
  @@map("stream_vods")
}
// Back-relations (schema only, no SQL): Workspace.streamChannels, Workspace.streamVods, ClipProject.streamVod StreamVod?

// ---------- S2: s2_stream_segments ----------
model Clip {                                   // existing: ADD only
  sourceSegKey     String?                     // short padded source segment (survives source deletion)
  sourceSegStartMs Int?                        // absolute VOD ms of the segment's first frame (after alignment)
  sourceSegEndMs   Int?
}

// ---------- S3: s3_stream_usage ----------
model StreamUsage {
  id            String   @id @default(cuid())
  workspaceId   String
  periodStart   DateTime                       // first day of month 00:00 UTC
  sourceSeconds Int      @default(0)           // analysed stream seconds (counts toward cap)
  gpuSeconds    Int      @default(0)
  vodCount      Int      @default(0)
  updatedAt     DateTime @updatedAt
  @@unique([workspaceId, periodStart])
  @@map("stream_usage")
}
// Cap + priority live in the EXISTING WorkspaceLimits.limits JSON (no migration):
//   limits.streamer = { monthlyHours: number | null, priority: number }   (null = env default)

// ---------- S8: s8_layout_presets ----------
model StreamLayoutPreset {
  id               String   @id @default(cuid())
  workspaceId      String
  channelId        String?
  name             String   @default("Default")
  layout           String   @default("stack") // 'stack' | 'gameplay' | 'facecam' | 'camera_follow'
  facecam          Json?                       // {x,y,w,h} normalised 0..1 of source frame
  gameplay         Json?                       // {x,y,w,h} normalised; default full frame
  split            Float    @default(0.4)      // facecam share of 9:16 height (0.25..0.5)
  facecamPosition  String   @default("top")    // 'top' | 'bottom'
  source           String   @default("auto")   // 'auto' | 'manual'
  confidence       Float?
  sampleFrameKey   String?
  deletedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@index([workspaceId, channelId])
  @@map("stream_layout_presets")
}
// StreamChannel: ADD defaultPresetId String?

// ---------- S10: s10_montage ----------
model ClipMontage {
  id          String    @id @default(cuid())
  workspaceId String
  projectId   String
  title       String
  clipIds     Json                             // ordered string[]
  options     Json      @default("{}")         // {maxDurationS, order, transition, aspect, titleCard}
  status      String    @default("QUEUED")     // QUEUED | RENDERING | READY | FAILED
  outputKey   String?
  posterKey   String?
  durationMs  Int?
  sizeBytes   BigInt?
  error       String?
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([workspaceId, projectId])
  @@map("clip_montages")
}

// ---------- S13: s13_stream_live ----------
model StreamWebhookEvent {                     // dedupe for Twitch/Kick deliveries
  id          String   @id                     // platform message id
  platform    String
  type        String
  receivedAt  DateTime @default(now())
  @@index([receivedAt])
  @@map("stream_webhook_events")
}

model StreamChatBucket {                       // live chat counts, 5-second buckets
  channelId   String
  bucketStart DateTime
  count       Int      @default(0)
  chatters    Int      @default(0)             // approx unique (per-bucket set size)
  hype        Int      @default(0)             // messages matching hype lexicon
  @@id([channelId, bucketStart])
  @@map("stream_chat_buckets")
}

model StreamChatLine {                         // sampled live chat text for the overlay
  id          String   @id @default(cuid())
  channelId   String
  at          DateTime
  user        String
  color       String?
  text        String
  @@index([channelId, at])
  @@map("stream_chat_lines")
}
```

**Not changed:**
- `ClipProject`: a streamer project is recognised by having a `StreamVod` row.
- `ClipProjectStatus`: the existing values `QUEUED → PREPARING → TRANSCRIBING → SCANNING → FINDING_CLIPS → REFRAMING → RENDERING → READY/FAILED` are reused, with detail in `stage`.
- `ClipJob`: its `priority` already exists.
- `IntegrationConnection`: unique per `(workspaceId, provider)`, so one Twitch and one Kick connection per workspace. Providers are `'twitch'` and `'kick'`.
- `InAppNotification`, `AiUsage`, `WorkspaceLimits` are all used as they are.

**Storage key layout:**
```
ws/{ws}/streams/{vodId}/audio.opus                 (deleted by cleanup)
ws/{ws}/streams/{vodId}/chunks/{n}.opus|.words.json (deleted by cleanup)
ws/{ws}/streams/{vodId}/signals.json               (kept; small)
ws/{ws}/streams/{vodId}/chat.jsonl.gz              (deleted by cleanup)
ws/{ws}/streams/{vodId}/frames/{n}.jpg             (kept: max 3)
ws/{ws}/projects/{pid}/transcript.json             (existing transcriptKey; kept)
ws/{ws}/projects/{pid}/clips/{cid}/source_seg.mp4  (kept with the clip)
ws/{ws}/projects/{pid}/clips/{cid}/chat.json       (kept with the clip, S9)
ws/{ws}/projects/{pid}/montages/{mid}.mp4          (S10)
```

## 3. Shared settings schema: `new-app/lib/streamer/settings.ts` (zod) + `worker/clips_worker/streamer/settings.py` (same defaults)
```ts
export const streamerSettingsSchema = z.object({
  clipCount: z.number().int().min(1).max(30).default(12),
  minClipS: z.number().min(10).max(120).default(15),
  maxClipS: z.number().min(15).max(180).default(60),
  leadS: z.number().min(0).max(60).default(20),              // S4 window before peak
  tailS: z.number().min(0).max(60).default(10),              // S4 window after peak
  language: z.string().nullable().default(null),             // null = auto-detect
  transcribeTrack: z.number().int().min(0).max(7).nullable().default(null), // OBS multi-track uploads
  signalWeights: z.object({                                  // S4; renormalised when a signal is missing
    audio: z.number().min(0).max(1).default(0.35),
    chat: z.number().min(0).max(1).default(0.30),
    viewerClips: z.number().min(0).max(1).default(0.25),
    transcript: z.number().min(0).max(1).default(0.10),
  }).default({}),
  llmBlend: z.number().min(0).max(1).default(0.4),           // final = (1-llmBlend)*signal + llmBlend*llm
  layout: z.enum(['stack','gameplay','camera_follow']).default('stack'), // 'stack' = auto facecam stack (S7)
  presetId: z.string().nullable().default(null),             // S8
  captionPresetId: z.string().nullable().default(null),      // existing caption presets
  captionPosition: z.enum(['seam','gameplay_bottom','top']).default('seam'), // S9
  gameBadge: z.boolean().default(false),                     // S9 burn-in
  chatOverlay: z.object({                                    // S9
    enabled: z.boolean().default(false),
    position: z.enum(['gameplay_left','gameplay_right','facecam_side']).default('gameplay_right'),
    opacity: z.number().min(0.2).max(1).default(0.6),
  }).default({}),
  notify: z.object({ inApp: z.boolean().default(true), email: z.boolean().default(true) }).default({}), // S11
});
```
- **Merge order:** env defaults → `StreamChannel.settings` → per-import overrides. The result is stored in `ClipProject.settings.streamer`.
- `ClipProject.settings` keeps every existing key (`genre` is forced to `gaming_stream` for streamer projects, and `aspectRatio` defaults to `9:16`).
- Parity: a committed file `worker/tests/fixtures/streamer/settings_defaults.json` holds the defaults. vitest (`streamer-settings.test.ts`) asserts `streamerSettingsSchema.parse({})` deep-equals it (reading `../worker/tests/fixtures/...`), and pytest asserts the Python defaults equal it.

---
## 4. S0: GPU provider abstraction + Modal app (+ job-type refactor, heartbeat)

**Goal:** every GPU-worthy operation goes through one interface. With `GPU_PROVIDER=modal`, transcription runs on a Modal L4 (faster-whisper large-v3, float16) that scales to zero. With `local`, nothing changes. Ships value immediately: uploads transcribe faster and with the better model.

### 4.1 Prereq refactors (behaviour-neutral, commit S0.0)
1. `main.py`: `JOB_TYPES` tuple + `DISPATCH` dict (§0.2.2). Add `worker/tests/test_job_types.py`.
2. Progress route heartbeat (§0.2.3):
   - `new-app/app/api/internal/jobs/[id]/progress/route.ts`: when the stored job status is `RUNNING` (or the body says `jobStatus:"RUNNING"`), also set `lockedAt = new Date()`.
   - vitest `progress-heartbeat.test.ts`: lockedAt moves forward; a DONE job is not touched.
3. `worker/clips_worker/heartbeat.py`: `class Heartbeat` (daemon thread, `every_s=45`, `update(stage, progress)`, posts the last payload, swallows network errors and logs them at warn level). pytest `test_heartbeat.py` uses a fake post fn and a 0.05 s interval, and asserts ≥ 3 posts and a clean stop.
4. `storage.py`: add `sign_url(key, expires_s=3600) -> str` and `sign_upload_url(key) -> {url, token}` (Supabase `POST /storage/v1/object/sign/{bucket}/{key}` and `POST /storage/v1/object/upload/sign/{bucket}/{key}`). pytest uses a mocked HTTP.

### 4.2 Provider interface: `worker/clips_worker/gpu/`
```
gpu/__init__.py        get_provider(op: Literal['transcribe','face','render']) -> GpuProvider
gpu/base.py            dataclasses + Protocol
gpu/local.py           LocalProvider: wraps today's code paths unchanged
gpu/modal_provider.py  ModalProvider: modal.Cls/Function.from_name(MODAL_APP_NAME, …)
gpu/budget.py          monthly Modal spend guard (S3 wires the UI; S0 records usage)
```
```python
@dataclass
class TranscribeReq:
    audio_url: str | None          # signed URL (modal) …
    audio_path: str | None         # … or local path (local)
    offset_ms: int = 0             # added to every word time (chunking, S2)
    language: str | None = None    # None = auto
    initial_prompt: str | None = None
    model: str | None = None       # default WHISPER_GPU_MODEL (modal) / WHISPER_MODEL (local)

@dataclass
class TranscribeRes:
    words: list[dict]              # EXACT shape the pipeline uses today: {w,s,e,p,i}
    language: str
    duration_s: float
    gpu_seconds: float             # 0 for local
    provider: str                  # 'local' | 'modal'

class GpuProvider(Protocol):
    name: str
    def transcribe(self, req: TranscribeReq) -> TranscribeRes: ...
    def transcribe_many(self, reqs: list[TranscribeReq]) -> list[TranscribeRes]: ...   # modal: .map / spawn+get; local: sequential
    def face_track(self, req: FaceTrackReq) -> dict: ...        # returns crop-track JSON {v,W,H,cw,fps,t0_ms,x0,x0_A,x0_B,shots}
    def render_batch(self, reqs: list[RenderReq]) -> list[RenderRes]: ...   # S15
```
- **Selection:** `GPU_PROVIDER_<OP>` (`TRANSCRIBE|FACE|RENDER`) overrides `GPU_PROVIDER` (default `local`). `runpod` raises `NotImplementedError("runpod provider not built yet")`.
- **Fallback:** if the Modal call raises (auth, timeout, quota) **or** `budget.allow()` is False, and `GPU_FALLBACK_LOCAL=1` (default), log `gpu.fallback op=… reason=…` and run `LocalProvider`. Otherwise re-raise.
- **Normalisation:** move the word-dict builder from today's transcription code into `gpu/base.py::normalize_words(segments, offset_ms)`, used by both providers so their output is identical in shape. Find it with `rg -n "def .*transcri" worker/clips_worker worker/prototype/v3/transcribe.py`. Diarization, if the local path does it, stays in the worker after transcription; Modal returns words only.
- **Wiring in S0:** `pipeline.py` PROCESS_PROJECT calls `get_provider('transcribe').transcribe(...)` instead of the direct call. For Modal, the worker first extracts 16 kHz mono opus (`ffmpeg -vn -ac 1 -ar 16000 -c:a libopus -b:a 24k`), uploads it to `ws/{ws}/projects/{pid}/audio.opus`, and passes `sign_url(...)`.
- **Usage rows:** after every Modal call insert `AiUsage`:
  - `provider='modal'`, `model='L4:transcribe'`;
  - `units=gpu_seconds`, `unitType='gpu_s'`;
  - `costUsdMicros=round(gpu_seconds*MODAL_L4_USD_PER_S*1e6)`;
  - `workspaceId`, `projectId`.
  
  `gpu_seconds` is the wall time measured inside the Modal function plus `MODAL_SCALEDOWN_S` once per batch (idle tail estimate).
- **Budget guard** (`gpu/budget.py`): `allow()` returns False when `SUM(costUsdMicros)` of `provider='modal'` rows in the current UTC month is ≥ `0.95 × MODAL_MONTHLY_BUDGET_USD`. The result is cached for 60 s.

### 4.3 Modal app: `worker/modal_app/`
```
worker/modal_app/__init__.py
worker/modal_app/app.py         # app = modal.App(os.environ.get("MODAL_APP_NAME","transovo-gpu")); imports the modules below
worker/modal_app/images.py      # gpu_image, render_image (S15)
worker/modal_app/transcribe.py  # class Transcriber
worker/modal_app/face.py        # S15: face_track
worker/modal_app/render.py      # S15: render_batch
worker/modal_app/common.py      # fetch(url)->Path (streamed), put(signed_upload, path)
worker/modal_app/README.md      # deploy, cost knobs, smoke test
```
```python
# images.py
gpu_image = (modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", add_python="3.11")
             .apt_install("ffmpeg")
             .pip_install("faster-whisper>=1.1,<2", "requests>=2.32"))
models = modal.Volume.from_name("transovo-models", create_if_missing=True)

# transcribe.py
@app.cls(image=gpu_image, gpu=os.environ.get("MODAL_GPU", "L4"),
         volumes={"/models": models},
         min_containers=0, buffer_containers=0,
         max_containers=int(os.environ.get("MODAL_MAX_CONTAINERS", "2")),
         scaledown_window=int(os.environ.get("MODAL_SCALEDOWN_S", "60")),
         timeout=3600)
class Transcriber:
    @modal.enter()
    def load(self):
        from faster_whisper import WhisperModel, BatchedInferencePipeline
        self.model = WhisperModel(os.environ.get("WHISPER_GPU_MODEL","large-v3"), device="cuda",
                                  compute_type="float16", download_root="/models")
        self.pipe = BatchedInferencePipeline(model=self.model)
    @modal.method()
    def transcribe(self, audio_url: str, language: str | None, initial_prompt: str | None) -> dict:
        t0 = time.time(); path = fetch(audio_url)
        segs, info = self.pipe.transcribe(str(path), batch_size=int(os.environ.get("WHISPER_GPU_BATCH","16")),
                                          word_timestamps=True, vad_filter=True,
                                          language=language, initial_prompt=initial_prompt)
        words = [{"word": w.word, "start": w.start, "end": w.end, "prob": w.probability}
                 for s in segs for w in (s.words or [])]
        return {"words": words, "language": info.language, "duration_s": info.duration,
                "gpu_seconds": time.time() - t0}
```
- Decorator values are read **at deploy time**. Changing `MODAL_MAX_CONTAINERS` etc. needs a redeploy, or a call to `modal.Cls.from_name(...).update_autoscaler(max_containers=…)` from `scripts/modal_autoscaler.py`.
- **Cost knobs:**
  - `min_containers=0`: scale to zero, so 1–2 min cold starts are accepted.
  - `scaledown_window=60`: the idle tail per batch is ≤ 60 s.
  - L4 GPU, and `max_containers=2`, which caps parallel burn at about $1.60/h.
  - One batch per VOD: all chunks are submitted together, so they share warm containers.
- **Model weights are cached** on the Volume after first load (first cold start downloads about 3 GB once).
- **Client side** (`gpu/modal_provider.py`): `T = modal.Cls.from_name(APP, "Transcriber")`, then `T().transcribe.remote(...)` for one item, or `list(T().transcribe.map(urls, langs, prompts, order_outputs=True))` for many.
- `worker/requirements.txt`: add `modal` (latest 1.x at build time, pinned).
- The worker `Dockerfile` copies `worker/modal_app` into the image (needed for deploy from the container).
- **Deploy:** `cd worker && modal deploy -m modal_app.app` with `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET` in env (§0.4). **Local fallback:** unset or set `GPU_PROVIDER=local`. No code change is needed.
- **Smoke test:** `scripts/modal_smoke.py` transcribes `worker/tests/fixtures/streamer/speech_30s.opus` via Modal and prints only word count, language and gpu_seconds.

### 4.4 Tests and acceptance
- **pytest:**
  - `test_job_types.py`;
  - `test_heartbeat.py`;
  - `test_gpu_select.py` (env matrix: overrides win; `runpod` raises; fallback when the Modal mock raises; no fallback when `GPU_FALLBACK_LOCAL=0`);
  - `test_normalize_words.py` (offset applied, keys `{w,s,e,p,i}`, monotonic);
  - `test_budget_guard.py` (seeded AiUsage rows, then allow False at 95 %);
  - `test_storage_sign.py`;
  - `@live test_modal_smoke.py`.
- **vitest:** `progress-heartbeat.test.ts`.
- **Browser acceptance (prod), with `GPU_PROVIDER=modal`:**
  1. Upload a 5–10 min talking video in `/app/clips/new` → the project reaches READY, and clip captions read correctly.
  2. The Modal dashboard shows `transovo-gpu` / `Transcriber` ran on an L4, and the container count returns to 0 within about 2 min.
  3. Set `GPU_PROVIDER=local` and restart the worker; the same upload still works (fallback path).
  4. During a job longer than 6 min, the job never flips back to QUEUED, because the heartbeat keeps `lockedAt` fresh. Check with `SELECT "lockedAt" FROM clip_jobs WHERE id=…` twice, 1 min apart.

---

## 5. S1: Paste-a-link Twitch/Kick ingest + Streamer tab (+ upload)

**Goal:** in `/app/clips/new`, a new **Streamer** tab accepts a Twitch VOD/highlight/clip or Kick VOD/clip link, or a file upload, and produces clips. S1 hands off to the **existing** PROCESS_PROJECT pipeline (≤ 3 h, `gaming_stream` genre). S2 swaps in the long-VOD pipeline.

### 5.1 Prisma: migration `s1_streamer_ingest`
`StreamChannel`, `StreamVod` and back-relations (§2).

### 5.2 URL parsing (pure; identical rules in TS and Python)
`new-app/lib/streamer/url.ts` and `worker/clips_worker/streamer/urls.py` export `parseStreamUrl(raw) -> { platform, kind, id, channel } | { error }`. Accept with or without `https://`, `www.`, `m.`, tracking params, and `?t=1h2m3s` (kept as `startHintS`).

| Pattern | Result |
|---|---|
| `twitch.tv/videos/{digits}` | `{twitch, vod, id}` (kind becomes `highlight` after metadata if Helix/yt-dlp says so) |
| `twitch.tv/{login}/video/{digits}` | `{twitch, vod, id, channel}` |
| `clips.twitch.tv/{slug}` · `twitch.tv/{login}/clip/{slug}` | `{twitch, clip, id:slug, channel?}` |
| `kick.com/{slug}/videos/{uuid}` · `kick.com/video/{uuid}` | `{kick, vod, id:uuid, channel?}` |
| `kick.com/{slug}?clip=clip_{id}` · `kick.com/{slug}/clips/clip_{id}` | `{kick, clip, id, channel}` |
| `twitch.tv/{login}` or `kick.com/{slug}` (bare channel) | **error** `"That's a channel page. Paste a VOD, highlight or clip link. We never record live streams."` |
| anything else | `{ error: 'unsupported' }` |

- Shared fixture: `worker/tests/fixtures/stream_urls.json` (≥ 25 cases including the errors). vitest reads it via `../worker/tests/fixtures/stream_urls.json` and pytest reads it directly, so both must agree.
- `classify_url()` in `import_url_parse.py` and the client `lib/clips/import-url.ts` gain `'twitch' | 'kick'`. The generic **Link** tab redirects those to the Streamer tab with the URL prefilled, rather than failing.

### 5.3 API routes (`new-app/app/api/streamer/**`, Node runtime, zod)
| Route | Method | Purpose |
|---|---|---|
| `/api/streamer/resolve` | POST `{ url }` | Parse with no download. If `TWITCH_CLIENT_ID/SECRET` are set and it's Twitch, call Helix (app token, cached in module memory until `expires_in − 60 s`) Get Videos `?id=` or Get Clips `?id=` for title, duration, thumbnail, type and `user_login`. Kick returns the parsed info only. Returns `{platform, kind, id, channel, title?, durationS?, thumbnailUrl?}`. |
| `/api/streamer/imports` | POST `{ url? , uploadId?, channelId?, rangeStartMs?, rangeEndMs?, settings?, attest: true }` | Validates (`attest` must be `true` for URLs). Creates `ClipProject` (`title` = resolved title or "Twitch VOD …", `sourceUrl`, `settings` = merged §3, `status QUEUED`), a `StreamVod` (`triggeredBy 'paste'\|'upload'`, `attestedAt`) and an upserted `StreamChannel` (when the login is known: `@@unique(workspaceId, platform, login)`). Enqueues `STREAM_IMPORT` (`priority 10`; S3 replaces this with the computed priority). Returns `{ projectId }`. |
| `/api/streamer/vods` | GET `?channelId=&cursor=` | List (for S12). |
| `/api/streamer/vods/[id]` | GET | StreamVod + project status. |

Server helpers live in `new-app/lib/server/streamer/{imports.ts,channels.ts,vods.ts}`, using `createId`, `jsonError` and `resolveWorkspaceId` as in the clips routes.

### 5.4 Worker: `STREAM_IMPORT` (S1 behaviour)
Module layout: `worker/clips_worker/streamer/{__init__,urls,ytdlp,import_job,settings}.py`.

Payload `{ vodId }`. Steps:
1. `ytdlp.metadata(url)`:
   - `yt-dlp -J --no-download --no-playlist <url>`, with a 60 s timeout.
   - Map: `title`; `uploader`/`channel` → channel display; `uploader_id` → login; `duration`; `timestamp` → `streamedAt`; `chapters` → `StreamVod.chapters` (Twitch VOD chapters carry game names, giving `category`); `thumbnail`.
   - **If `is_live` is true or `live_status in ('is_live','is_upcoming')`, abort:** "We never record live streams. Paste the VOD after the stream ends."
   - Upsert `StreamChannel` with `externalId` once known.
2. **Error mapping** (stderr regex → user message):
   - subscriber-only / "requires authentication" → "This VOD is subscriber-only. Download it from your dashboard and upload the file."
   - 404 / "does not exist" → "VOD not found or deleted."
   - geo / 403 → "Twitch/Kick refused the download. Try again later or upload the file."
3. **Guards:** `duration ≤ 3 h` (S1; S2 raises it), and free disk ≥ 2× the estimated size (`shutil.disk_usage(STREAMER_SCRATCH_DIR)`).
4. **Download:**
   - `yt-dlp -f "bv*[height<=1080][fps<=60]+ba/b[height<=1080]/b" --merge-output-format mp4 -o source.mp4 <url>`;
   - a progress hook (`--newline --progress-template`) maps download % to 5–25 %;
   - wrapped in `Heartbeat`.
   - If `rangeStartMs/EndMs` are set, add `--download-sections "*{start}-{end}"`.
5. Same as today's IMPORT_URL from here: probe, upload source, insert `clip_uploads`, set `ClipProject.uploadId`, and enqueue `PROCESS_PROJECT` with payload `{ singleClip: true }` when `kind=='clip'`, else `{}`.
6. **PROCESS_PROJECT change (small):**
   - When `payload.singleClip` is true, skip the picker and emit exactly one clip spanning `[0, duration]`, trimmed by the existing silence trim.
   - When `settings.streamer` is present, force `genre='gaming_stream'`.
   - pytest `test_single_clip_payload.py`.

`worker/Dockerfile`: `pip install "yt-dlp[default,curl-cffi]"` (latest at build time, pinned in `requirements.txt`), with a comment `# rebuild weekly; Twitch/Kick extractors change`.

### 5.5 UI
- `components/clips/new-project-workspace.tsx`:
  - add a third tab **Streamer** (`value="streamer"`, Twitch + Kick glyphs). `/app/clips/new?tab=streamer` deep-links.
  - The tab renders `components/streamer/streamer-import-panel.tsx`:
    - **Link input**, debounced 400 ms → `POST /api/streamer/resolve` → preview card (thumbnail, title, duration, platform badge, kind badge VOD/Highlight/Clip). Errors are shown inline.
    - **Optional range** (two `mm:ss`/`h:mm:ss` inputs, "Whole VOD" default).
    - **Settings accordion** with the subset of §3 relevant now: clip count, clip length range, language. The rest appears as later milestones ship.
    - **Required attestation checkbox:** "This is my channel or I have the creator's permission."
    - **ToS note** (§0.5).
    - **"Find clips"** → POST `/api/streamer/imports` → router push `/app/clips/{projectId}`.
    - **"Or upload a recording"**: reuses the existing upload component (same TUS/multipart flow), then POST `/api/streamer/imports {uploadId}`. A channel picker dropdown appears if channels exist.
- **Project page** `/app/clips/[projectId]`: if a StreamVod exists, show `components/streamer/stream-header.tsx`: platform badge, channel, VOD title, category, duration, and a link to the original.

### 5.6 Tests and acceptance
- **vitest:**
  - `streamer-url.test.ts` (fixture parity);
  - `streamer-imports.route.test.ts` (attest required for URLs; bare channel 400; creates project + vod + job with priority 10; upload path);
  - `streamer-resolve.route.test.ts` (Helix mocked; token cached).
- **pytest:**
  - `test_stream_urls.py` (fixture parity);
  - `test_ytdlp_metadata.py` (canned `-J` JSON for twitch vod/clip and kick vod/clip; live rejection; chapters mapping);
  - `test_ytdlp_errors.py` (stderr → message);
  - `test_single_clip_payload.py`;
  - `@live test_ytdlp_live.py` (a known public Twitch clip downloads under 10 s).
- **playwright** `e2e/s1-streamer-paste.spec.ts`: Streamer tab → paste fixture URL (resolve mocked) → tick attest → Find clips → lands on the project page with the stream header.
- **Browser acceptance (prod):**
  1. `/app/clips/new?tab=streamer`, paste a public Twitch clip URL → preview → tick → Find clips → one 9:16 clip READY.
  2. Paste a ≤ 1 h public Twitch VOD → multiple clips READY with the gaming genre; the header shows the title/category.
  3. Paste a Kick clip and a Kick VOD → both READY.
  4. Paste `https://twitch.tv/somechannel` → inline error about live streams; the button stays disabled.
  5. Upload a 10-min OBS recording in the Streamer tab → READY.
  6. Paste a Twitch link into the old Link tab → it switches to the Streamer tab with the URL filled.

---
## 6. S2: Long-VOD pipeline (audio-first, chunked GPU transcription, range-only downloads, worker lanes)

**Goal:** VODs and highlights up to `STREAMER_MAX_VOD_HOURS` (12) are processed without downloading the full video. Uploads and short VODs (≤ `STREAMER_FULL_DOWNLOAD_MAX_MIN` = 20 min) keep the simple full-download path. Clip choice in S2 uses the **existing picker** run over transcript windows; S4 replaces this with the fused score.

### 6.1 Prisma: migration `s2_stream_segments`
`Clip.sourceSegKey`, `sourceSegStartMs`, `sourceSegEndMs` (§2).

### 6.2 Worker lanes
- `main.py`: `lane_types(lane)` returns the claimable subset of `JOB_TYPES`, and `claim_job` / `count_queued_jobs` use it.
- Compose: second service `clips-worker-stream` (§0.2.5).
- `STREAMER_MAX_RUNNING_PER_WORKSPACE` (1): `claim_job` skips `STREAM_ANALYZE` jobs whose workspace already has a RUNNING `STREAM_ANALYZE`, using a `NOT EXISTS` subquery in the claim SQL.

### 6.3 Job graph
```
STREAM_IMPORT (metadata, guards, branch)
 ├─ kind=clip OR duration ≤ FULL_DOWNLOAD_MAX_MIN OR platform=upload
 │     → S1 path (full source → clip_uploads → PROCESS_PROJECT)
 └─ vod/highlight > FULL_DOWNLOAD_MAX_MIN
       → audio-only download → STREAM_ANALYZE → STREAM_RENDER
```

### 6.4 `STREAM_IMPORT` (long branch)
- **Audio download:** `yt-dlp -f "ba/b" -x --audio-format opus --postprocessor-args "ffmpeg:-ac 1 -ar 16000 -b:a 24k" -o audio.%(ext)s <url>`, with `--download-sections` when a range is set. Progress maps to 2–20 %.
- Upload the audio to `ws/{ws}/streams/{vodId}/audio.opus`, checkpoint `state.audioKey`, then enqueue `STREAM_ANALYZE {vodId}` with priority = §7 priority.
- Project status `PREPARING`, stage `"Downloading audio"`.

### 6.5 `STREAM_ANALYZE`: `worker/clips_worker/streamer/analyze_job.py`
Each step is checkpointed in `StreamVod.state`.
1. **Chunk** (`streamer/chunking.py`): `plan_chunks(duration_ms, chunk_ms=CHUNK_MIN*60e3, overlap_ms=CHUNK_OVERLAP_S*1e3) -> [(start,end)]`. ffmpeg `-ss/-t -c copy` slices the opus into chunk files, which are uploaded to `chunks/{n}.opus`.
2. **Transcribe:**
   - `get_provider('transcribe').transcribe_many([...signed URLs, offset_ms=start])`;
   - each result is saved to `chunks/{n}.words.json` and recorded in `state.chunks`;
   - restarts skip done chunks;
   - project status `TRANSCRIBING`, progress 20–55 % by chunk count.
3. **Merge** (`chunking.merge_words`): for each adjacent pair, cut at the overlap midpoint `m = (endA + startB)/2`, keeping A's words with `s < m` and B's words with `s ≥ m`. Re-index `i`, then save the project transcript to the existing `transcriptKey` in the same shape PROCESS_PROJECT writes, so the editor and captions work unchanged.
4. **Candidates (S2 interim):**
   - Run the existing picker with `genre='gaming_stream'` over sliding transcript windows (10 min, 1 min overlap). Dedupe overlapping candidates (IoU > 0.5 keeps the higher score) and keep the top `clipCount` (§3, default 12).
   - Persist `Clip` rows exactly as today's pipeline does, with `status` set to the queued/pending value the pipeline already uses.
   - Status `FINDING_CLIPS`.
5. Enqueue `STREAM_RENDER {vodId}`.

### 6.6 `STREAM_RENDER`: `streamer/render_job.py`
For each clip, in score order:
1. **Segment fetch** (`streamer/segments.py`):
   - `seg_start = max(0, clip.start − SEGMENT_PAD_S)` and `seg_end = clip.end + SEGMENT_PAD_S`;
   - `yt-dlp -f "bv*[height<=1080][fps<=60]+ba/b[height<=1080]" --download-sections "*{seg_start}-{seg_end}" --force-keyframes-at-cuts -o seg.mp4 <url>`.
   - **Uploads:** cut from the local file with no download.
2. **Alignment** (`streamer/align.py`):
   - `--download-sections` can land a few seconds off.
   - Extract 16 kHz mono PCM from the segment and from `audio.opus` over `[seg_start−15 s, seg_end+15 s]`.
   - Normalised cross-correlation (numpy FFT) finds `lag_ms`. If the peak corr ≥ 0.6, set `true_seg_start = seg_start + lag_ms`. Otherwise keep the nominal start and log `align.low_conf`.
   - Store `sourceSegStartMs/EndMs`.
3. **Upload** the segment to `clips/{cid}/source_seg.mp4` and set `Clip.sourceSegKey`.
4. **Render:** refactor `pipeline.py` per-clip stage into `process_clip(conn, clip, source_path, source_offset_ms, settings, words)`. Clip times are absolute VOD ms, and the function subtracts `source_offset_ms` before cutting. PROCESS_PROJECT calls it with `offset 0` (behaviour unchanged, covered by existing tests). STREAM_RENDER calls it with `seg_path, sourceSegStartMs`. Reframe/captions/preview/thumbnail all go through this path.
5. **RENDER_CLIP change** (`render_job.py::load_render_context`): if `clip.sourceSegKey` is set, download that instead of the upload source and subtract `sourceSegStartMs` from `clip_start/clip_end`. Trims outside the padded segment are clamped and the UI shows "Extend beyond ±30 s needs re-import". pytest `test_render_job_segment.py`.
6. Project status `RENDERING` → `READY` when all clips finish; individual failures mark that clip FAILED only.

### 6.7 Limits and failure
- `duration > STREAMER_MAX_VOD_HOURS` → fail with "VOD is longer than 12 h; pick a range."
- Scratch dir `STREAMER_SCRATCH_DIR` (default `/tmp/streamer`) is cleaned in `finally`.
- Retry: STREAM_* handlers raise a `RetryableError` for network failures (the existing attempts counter applies); `PermanentError` writes `StreamVod.error` + project `FAILED`.

### 6.8 UI
- The Streamer tab range input now allows up to 12 h; the preview card shows "Long VOD: we fetch audio first, then only the clip ranges."
- The project page shows a stage stepper (Downloading audio → Transcribing n/m chunks → Finding moments → Rendering k/N), driven by existing `stage`/`progress` fields.

### 6.9 Tests and acceptance
- **pytest:**
  - `test_chunking.py` (plan for 0/1/25/26 min/12 h; merge at midpoint with no duplicate or lost words, using synthetic words);
  - `test_align.py` (synthetic noise shifted by 2.3 s is recovered within ±20 ms; low corr falls back);
  - `test_lane_types.py`;
  - `test_analyze_resume.py` (state has chunks 0–1 done, so only 2+ are transcribed; mocked provider);
  - `test_process_clip_offset.py` (offset subtraction);
  - `test_render_job_segment.py`;
  - `@live test_segment_fetch_live.py`.
- **vitest:** `streamer-imports.route.test.ts` (12 h accepted, 12 h+ rejected).
- **playwright** `e2e/s2-stage-stepper.spec.ts` (seeded project in each stage).
- **Browser acceptance (prod):**
  1. Paste a public 3–6 h Twitch VOD → stepper shows chunk progress → ≥ 8 clips READY. Worker disk never exceeds about 2 GB (`docker exec clips-worker-stream df -h /tmp`).
  2. While (1) runs, upload a normal 5-min video in `/app/clips/new` → it finishes without waiting (lanes).
  3. Open a streamer clip in the editor, trim ±10 s, re-render → works.
  4. Spot-check 3 clips: captions are in sync with speech (alignment is correct).

---

## 7. S3: Cost controls (usage + cap, priority, source deletion, Modal budget)

**Goal:** each workspace sees stream-hours used this month against a configurable cap; imports over the cap are blocked; streamer jobs carry a priority; sources are deleted after processing while clips remain.

### 7.1 Prisma: migration `s3_stream_usage`
`StreamUsage` (§2). Cap/priority in the existing `WorkspaceLimits.limits.streamer` JSON.

### 7.2 Logic
- **Metering:** at `STREAM_ANALYZE` start (or PROCESS_PROJECT start for S1-path streamer projects), upsert `StreamUsage(periodStart = month UTC)` with `sourceSeconds += analysedSeconds` and `vodCount += 1`, once per vod (guarded by `state.metered=true`). Modal GPU seconds are added from the same values written to AiUsage.
- **Cap:**
  - `monthlyHours = limits.streamer.monthlyHours ?? STREAMER_DEFAULT_MONTHLY_HOURS` (40); `null`/`0` in the UI means unlimited.
  - `POST /api/streamer/imports` returns 402 `{code:'stream_cap', usedH, capH}` if `used + incomingDuration > cap`. When the duration is unknown it is checked again in STREAM_IMPORT after metadata; over the cap fails with the same message. Auto-pull (S13/14) checks the same and sends a notification instead.
- **Priority:** `ClipJob.priority` for STREAM_* = `limits.streamer.priority ?? 0` (paste/upload) and `+5` for `triggeredBy='paste'` (user waiting) vs `auto`. Allowed range −10…10.
- **Source deletion:** `STREAM_CLEANUP {vodId}` is enqueued with `runAfter = now + STREAMER_SOURCE_RETENTION_HOURS` when the project reaches READY. It deletes `audio.opus`, `chunks/**`, `chat.jsonl.gz`, frames beyond 3, and (S1-path) the `clip_uploads` source object (the row stays, `sourceDeletedAt` set). It keeps `source_seg.mp4`, clip outputs, transcript and `signals.json`. For S1-path projects (no segments), cleanup first runs the S2 segment step from the local full source so re-render still works.
- **Modal budget:** `gpu/budget.py` (S0) gets `MODAL_MONTHLY_BUDGET_USD` (default 25). Above 95 % → local fallback + a one-time in-app warning (S11 delivers it; S3 just logs).

### 7.3 API
| Route | Method | Purpose |
|---|---|---|
| `/api/streamer/usage` | GET | `{ periodStart, usedHours, capHours, vodCount, gpuHours, modalUsdThisMonth }` |
| `/api/streamer/usage` | PATCH `{ monthlyHours: number\|null, priority: int }` | Writes `WorkspaceLimits.limits.streamer` (merge, keep other keys) |

### 7.4 UI
- `components/streamer/usage-meter.tsx` (progress bar "12.4 / 40 stream-hours this month") in the Streamer tab and later `/app/streamer`.
- A settings popover lets the user edit the cap and priority (no plan logic).
- The 402 shows "Monthly stream-hour cap reached" with an edit-cap link.
- Project header: "Source deleted after processing (clips kept)" badge when `sourceDeletedAt`.

### 7.5 Tests and acceptance
- **vitest:** `streamer-usage.route.test.ts` (GET math; PATCH merges JSON; cap 402).
- **pytest:**
  - `test_usage_meter.py` (idempotent metering);
  - `test_cleanup_job.py` (deletes the right keys, keeps segments, idempotent);
  - `test_priority.py`.
- **playwright** `e2e/s3-usage.spec.ts`.
- **Browser acceptance (prod):**
  1. The Streamer tab shows the usage meter. After a 1 h VOD, it increases by about 1.0 h.
  2. Set the cap to 1 h → paste a 2 h VOD → blocked with a clear message. Reset the cap.
  3. Temporarily set `STREAMER_SOURCE_RETENTION_HOURS=0` → after READY, the Supabase storage browser shows no `audio.opus`/source; clips still play, download and re-render.

---
## 8. S4: Highlight score v1 (audio + transcript LLM fusion, reasons, hype timeline)

**Goal:** replace the S2 interim picker for streamer projects with a fused, explainable score. Each clip shows "why" chips, and the project shows a hype timeline. S5/S6 plug extra signals into the same fusion.

### 8.1 Prisma
None. Scores go in the existing `Clip.scores` JSON and reasons in `Clip.aiMeta.streamer`; `StreamVod.signalsKey` points to `signals.json`.

### 8.2 Signals (`worker/clips_worker/streamer/signals/`)
| Module | Output (per second, length = duration_s) |
|---|---|
| `audio.py` | `ffmpeg -i audio.opus -af ebur128=peak=none -f null -` parses momentary loudness (M, LUFS, every 100 ms), then the per-second max. Rolling median/MAD over 120 s gives a robust z, clipped to [0, 6] and divided by 6. Also flags `laugh/scream` frames: z ≥ 3 sustained ≥ 1.5 s. |
| `transcript.py` | Keyword density per second (hype lexicon `streamer/lexicon.py`: "let's go", "no way", "clip that", "oh my god", profanity list, "gg", "what"), speech rate spikes, and `?!` density. Values 0..1. |
| `chat.py` (S5) | stub returning `None` in S4 |
| `viewer_clips.py` (S6) | stub returning `None` in S4 |

`signals.json`: `{ v:1, hz:1, audio:[…], transcript:[…], chat:null, viewerClips:null, chapters:[…] }`, uploaded to `signalsKey` (gzip if > 1 MB).

### 8.3 Fusion (`streamer/fusion.py`)
1. **Combined curve:** `c(t) = Σ w_k · s_k(t)`, with default weights `audio .35, chat .30, viewerClips .25, transcript .10` (settings `signalWeights`). Missing signals (`None`) drop out and the remaining weights are renormalised to sum to 1. Smooth with a 5 s moving average.
2. **Peaks:** local maxima with prominence ≥ 0.15 and minimum separation `minClipS`; take the top `STREAMER_LLM_CANDIDATES` (40).
3. **Windows:** for each peak, the window starts `leadS` (default 20 s) before the peak and ends `tailS` (default 10 s) after it, clamped to `[minClipS, maxClipS]` (settings, defaults 15/60; `leadS`/`tailS` are settings too). Then `picker/snap_bounds.py` snaps to sentence/silence edges.
4. **LLM rerank** (`picker/llm.py` client):
   - batches of 10 candidates;
   - prompt `worker/clips_worker/picker/prompts/genres/stream_moments.md`: streamer context, category, transcript of window ±10 s, signal summary ("loudness z=4.1, chat 6× baseline, 3 viewer clips");
   - JSON array response, one item per candidate: `{ id, score 0-100, keep bool, title ≤ 60 chars, hook ≤ 90, category: 'funny'|'clutch'|'fail'|'rage'|'wholesome'|'reaction'|'skill'|'story'|'other', suggestedCaption, hashtags[≤5] }`;
   - invalid JSON is retried once, then `gpt-4o-mini`, then signal-only.
5. **Final score:** `total = (1−llmBlend) × signalPeak×100 + llmBlend × llm.score` (llmBlend default 0.4). Drop `keep=false` unless needed to reach `clipCount`; dedupe with IoU > 0.3; take the top `clipCount`.
6. **Persist:**
   - `Clip.scores = { total, audio, chat, viewerClips, transcript, llm }` (0–100 each, `null` when missing);
   - `Clip.aiMeta.streamer = { reasons: [...], category, peakMs, signalPeak }`;
   - `title`/`hook`/hashtags go into the same fields the existing picker fills.
   - **Reasons:** each item is `{ kind:'audio'|'chat'|'viewer_clips'|'transcript'|'llm', label, value }`, e.g. `{kind:'audio', label:'Loudness spike', value:'+4.1σ'}`, `{kind:'chat', label:'Chat 6× baseline'}`, `{kind:'viewer_clips', label:'3 viewers clipped this'}`, `{kind:'llm', label:'Clutch 1v3'}`. Only signals with a normalised value ≥ 0.5 produce a reason; the LLM category always adds one.

`STREAM_ANALYZE` step 4 now calls `signals → fusion` for streamer projects. The S1-path PROCESS_PROJECT for streamer projects (≤ 20 min / uploads) also calls signals+fusion after transcription, through a shared `streamer.rank_moments(...)`, so all streamer projects get reasons.

### 8.4 API
`GET /api/streamer/vods/[id]/signals` returns `{ hz, combined: number[] (downsampled to ≤ 2000 points), series: {audio, chat, viewerClips, transcript}, clips: [{id, startMs, endMs, total}] , chapters }`. It reads `signals.json` via the storage helper and caches with `Cache-Control: private, max-age=300`.

### 8.5 UI
- `components/streamer/reason-chips.tsx` on each clip card (icons: Volume2, MessageSquare, Scissors, FileText, Sparkles) plus a score badge.
- `components/streamer/hype-timeline.tsx`: a canvas/SVG area chart over the VOD with clip ranges highlighted and chapter bands labelled with the game. Hovering shows the time and values; clicking a clip range scrolls to its card. Placed above the clip grid on the project page when a StreamVod exists.
- Sort dropdown on the project page: "Score" (default for streamer) | "Time".

### 8.6 Tests and acceptance
- **pytest:**
  - `test_signal_audio.py` (synthetic tone with a +12 dB burst at 30 s, so the z peak lands at 30±1 s; ebur128 parse fixture);
  - `test_signal_transcript.py`;
  - `test_fusion.py` (weight renormalisation when chat/viewerClips are None; peak separation; IoU dedupe; LLM failure falls back to signal-only; reasons thresholds);
  - `test_stream_moments_prompt.py` (prompt renders; no `temperature` in the request body);
  - `test_llm_json_parse.py`.
- **vitest:** `streamer-signals.route.test.ts` (downsampling ≤ 2000; 404 for other workspace).
- **playwright** `e2e/s4-reasons.spec.ts` (seeded clips with reasons render chips; timeline click scrolls).
- **Browser acceptance (prod):**
  1. Re-run a known VOD → clips sorted by score, each with ≥ 1 reason chip (e.g. "Loudness spike +3.8σ", "Clutch").
  2. The hype timeline shows peaks aligned with the clip ranges; clicking a range jumps to its clip.
  3. Watch the top 3 clips: each contains an obvious moment (shouting/laughing/play), and none starts mid-sentence.

---

## 9. S5: Chat signal (Twitch VOD chat replay)

**Goal:** Twitch VOD projects gain the chat spike signal and the "Chat N× baseline" reason. (Kick/connected live chat comes from S13/S14 capture through the same interface.)

### 9.1 Prisma
None. Uses `StreamVod.chatSource`, `chatMessages`.

### 9.2 Worker
- **`streamer/chat/twitch_gql.py`:**
  - pages `VideoCommentsByOffsetOrCursor` via `POST https://gql.twitch.tv/gql`, headers `Client-Id: TWITCH_GQL_CLIENT_ID`, persisted query hash `TWITCH_GQL_COMMENTS_HASH`, variables `{videoID, contentOffsetSeconds}` for the first page, then `{videoID, cursor}`;
  - collects `{t_s: contentOffsetSeconds, user: commenter.login, color, text: fragments joined}` (fields drift, so parse defensively);
  - limits: `STREAMER_CHAT_MAX_MESSAGES` (default 300 000) and 4 req/s with jitter. A 429 backs off exponentially; after 5 failures it returns what it has;
  - output is gzip JSONL at `chat.jsonl.gz`, checkpointed by cursor in `state.chatCursor`;
  - disabled if `TWITCH_VOD_CHAT_REPLAY=off` or either env var is missing → `chatSource='none'`.
  - Runs in `STREAM_ANALYZE` **in a thread in parallel with transcription** (network-bound).
- **`streamer/chat/source.py`:** `get_chat(vod) -> Iterable[ChatMsg] | None`. Order: S13/S14 live-captured rows in `StreamChatBucket/StreamChatLine` covering `[streamedAt, streamedAt+duration]` (preferred, official) → Twitch GQL replay → None.
- **`signals/chat.py`:**
  - per-second message counts shifted by `STREAMER_CHAT_LAG_S` (6 s; chat reacts late);
  - unique chatters per 5 s;
  - hype-lexicon hits ("KEKW", "LUL", "OMEGALUL", "PogChamp", "Pog", "W", "LETSGO", "monkaS", "Clap", "+1", "!!!" …) weighted 2×;
  - rolling median/MAD z over 300 s, clipped to [0, 8] and divided by 8;
  - reason label `Chat {ratio:.0f}× baseline` where `ratio = window_mean / rolling_median`.

### 9.3 UI
The hype timeline gains a chat series toggle. The chat reason chip appears. The project header shows "Chat: 48,210 messages (Twitch replay)" or "Chat: unavailable".

### 9.4 Tests and acceptance
- **pytest:**
  - `test_twitch_gql_parse.py` (2 canned pages; cursor paging; tolerates missing fields);
  - `test_twitch_gql_backoff.py`;
  - `test_signal_chat.py` (synthetic burst at 120 s produces a peak at 114±1 s after the lag shift; lexicon weighting);
  - `test_chat_source_order.py`;
  - `@live test_twitch_gql_live.py`.
- **Browser acceptance (prod):**
  1. Paste a popular streamer's public Twitch VOD (≤ 2 h) → header shows a chat message count → several clips show a "Chat N× baseline" chip.
  2. Set `TWITCH_VOD_CHAT_REPLAY=off` and re-run → finishes normally with "Chat: unavailable" and no chat chips.

---

## 10. S6: Viewer-clip signal (Twitch Get Clips; Kick best effort)

**Goal:** moments that viewers clipped are boosted, with the reason "N viewers clipped this".

### 10.1 Worker: `signals/viewer_clips.py`
- **Twitch:**
  - needs `externalId` of the broadcaster (Helix Get Users by login if missing) and the VOD id;
  - `GET /helix/clips?broadcaster_id=…&started_at=streamedAt&ended_at=streamedAt+duration+1h&first=100`, paging with `after`, up to 1 000 clips, using an app access token (client credentials);
  - keep clips with `video_id == vod.externalId` and `vod_offset != null`. A clip covers `[vod_offset, vod_offset + duration]`;
  - signal: a Gaussian kernel centred at `vod_offset + duration/2` with `σ = 10 s` and height `log1p(view_count)`, summed and normalised to max 1;
  - reason label `{n} viewer clip(s) · {views} views`.
- **Kick:** if `KICK_CLIPS_SIGNAL=1`, `yt-dlp --flat-playlist -J "https://kick.com/{slug}/clips"` and match by `created_at` within the stream window (offset = created_at − streamedAt − clip duration). Off by default. Otherwise `None`.
- **Uploads:** `None`.
- **Twitch clip imports (S1):** irrelevant (single clip).

### 10.2 Tests and acceptance
- **pytest:** `test_viewer_clips_twitch.py` (canned Helix pages; null `vod_offset` skipped; Gaussian sum; paging stops at 1 000), `test_viewer_clips_kick.py` (flag off → None), `@live`.
- **Browser acceptance (prod):** paste a VOD that has viewer clips (check twitch.tv/<channel>/clips filtered by that broadcast) → at least one generated clip overlaps a viewer clip and shows "N viewer clips" → the timeline shows the viewer-clip series.

---

## 11. S7: Facecam auto-detect + 9:16 stacked render

**Goal:** streamer clips render by default as **facecam on top, gameplay below** (9:16 1080×1920). The facecam box is detected automatically per VOD. If no facecam is found, the clip falls back to the gameplay-only layout (centre crop, existing reframe).

### 11.1 Worker: `streamer/layout/`
| Module | Does |
|---|---|
| `detect_facecam.py` | Samples 24 frames spread over the clip ranges (`frame_sampler.py`, 640 px wide). For each frame: YuNet faces (the existing model loader in `subject_reframe.py` / speakercrop) and Canny + probabilistic Hough edges. Faces are clustered by centre (DBSCAN eps 0.05 of width). The biggest stable cluster (present in ≥ 50 % of frames) is the facecam. **Box:** the rectangle formed by persistent edges (present in ≥ 60 % of frames) around the face cluster, searched within 3× the face size. Without strong edges, the box = face bbox × 2.2 (w) / 2.6 (h), clamped to the frame. **Confidence** = 0.5·presence + 0.3·edge_strength + 0.2·box_aspect_plausibility (1.0 for 4:3/16:9 ±20 %). |
| `gemini_facecam.py` | Used if confidence < 0.6. Sends 3 frames to `gemini_vision.py` with the prompt "Return JSON {has_facecam, box:{x,y,w,h} normalised} for the streamer's webcam overlay" and validates the box (area 1–40 % of frame, inside bounds). Gemini confidence is 0.7. If `has_facecam=false` or validation fails → `layout='gameplay'`. |
| `render_stack.py` | `build_stack_filter(src_w, src_h, facecam_box, gameplay_box, split, position) -> str`. Facecam height `Hf = round(1920·split / 2)·2` (split 0.4 gives 768) and gameplay `Hg = 1920 − Hf` (1152). `[0:v]crop=fw:fh:fx:fy,scale=1080:Hf:force_original_aspect_ratio=increase,crop=1080:Hf[f]; [0:v]crop=gw:gh:gx:gy,scale=1080:Hg:force_original_aspect_ratio=increase,crop=1080:Hg[g]; [f][g]vstack=inputs=2[v]` (order swaps for `bottom`). The gameplay default box = the full frame centred to the 1080:Hg aspect (`gameplay=null` means a centre crop of width `src_h·1080/Hg` covering the action area). |

### 11.2 Integration
- Detection runs once per VOD in `STREAM_RENDER` (or the PROCESS_PROJECT streamer branch) before clip rendering and is stored in `StreamVod.state.layout = {layout, facecam, gameplay, confidence, source:'auto', sampleFrameKeys}` (3 frames uploaded to `frames/`).
- Channel preference: if the channel has a saved preset (S8), it is used and detection is skipped.
- `process_clip` gets a `layout` arg. `stack` uses `render_stack` for the video filter, replacing the reframe stage. Captions burn in after stacking. `gameplay` and `camera_follow` use the existing reframe (`subject_reframe.py` / speakercrop). `Clip.aiMeta.streamer.layout` records what was used.
- **RENDER_CLIP:** reads the layout from `aiMeta.streamer.layout` so edits keep the layout.

### 11.3 UI
- Project page: a "Layout: Facecam + gameplay (auto, 82 %)" pill. The pill is read-only in S7; S8 makes it open the editor.
- Streamer tab settings: layout radio `Auto stack | Gameplay only | Camera follow`, default Auto stack.

### 11.4 Tests and acceptance
- **pytest:**
  - `test_detect_facecam.py` (3 fixture frames from synthetic composites with a face image pasted in a bordered box at top-left: box IoU ≥ 0.8; no-face fixture gives layout gameplay);
  - `test_gemini_facecam_validate.py`;
  - `test_render_stack_filter.py` (exact filter strings for top/bottom/split 0.25/0.5);
  - `test_stack_render_smoke.py` (ffmpeg renders a 2 s 1080×1920 output from a 1920×1080 testsrc; ffprobe dims).
- **Browser acceptance (prod):**
  1. Paste a VOD of a streamer with a corner facecam → clips show the face on top and gameplay below; the face is not cut off.
  2. Paste a no-facecam VOD (or upload a gameplay recording) → clips are gameplay-only; the pill says "Gameplay only".
  3. Edit a stacked clip's captions in the editor and re-render → the layout is preserved.

---
## 12. S8: Layout box editor + per-channel presets

**Goal:** the user can draw or adjust the facecam and gameplay boxes on a real frame, preview the 9:16 result live, save it as the channel's preset, and re-render the project's clips.

### 12.1 Prisma: migration `s8_layout_presets`
`StreamLayoutPreset` + `StreamChannel.defaultPresetId` (§2).

### 12.2 API
| Route | Method | Purpose |
|---|---|---|
| `/api/streamer/presets` | GET `?channelId=` | List the workspace's presets (channel-scoped and general) |
| `/api/streamer/presets` | POST | Create `{channelId?, name, layout, facecam, gameplay, split, facecamPosition, makeDefault?}` (zod: boxes in 0..1, w,h ≥ 0.05, inside the frame; split 0.25–0.5) |
| `/api/streamer/presets/[id]` | PATCH / DELETE | Update; soft delete (clears `defaultPresetId` if it pointed here) |
| `/api/streamer/projects/[projectId]/layout` | GET | `{ current layout, sampleFrames: [signed urls], srcW, srcH, presetId? }` |
| `/api/streamer/projects/[projectId]/layout` | POST `{ layout…, saveAsPreset?: {name, makeDefault}, rerender: 'all'\|clipIds[] }` | Writes `StreamVod.state.layout` (`source:'manual'`). Optionally creates a preset and sets the channel default. Enqueues `STREAM_RELAYOUT {vodId, clipIds}` |

### 12.3 Worker: `STREAM_RELAYOUT`
For each clip, it updates `aiMeta.streamer.layout` and runs the existing RENDER_CLIP code path (segment-sourced since S2) with the new layout. Clip status goes to rendering, then ready. Clips with user edits keep their edits.

### 12.4 UI
- `components/streamer/layout-editor-dialog.tsx` opens from the layout pill. Left: a sample frame (the user can switch between 3) with two draggable/resizable boxes (orange Facecam, blue Gameplay), plus "Auto-detect again" and "No facecam" buttons. Right: a live 9:16 preview.
- `stack-preview-canvas.tsx` draws the two crops from the frame image onto a 270×480 canvas with the same math as `render_stack.py`. The shared constants live in `lib/streamer/layout-math.ts`, and a vitest compares them to the pytest fixture `worker/tests/fixtures/streamer/layout_math.json`.
- Controls: split slider 25–50 %, facecam position top/bottom, layout radio, "Save as channel default" checkbox, and "Apply to: all clips / this clip".
- Box drawing uses pointer events and keyboard nudging (arrows 1 %, shift = 5 %). No new dependency.
- The channel settings page (S12) lists presets.

### 12.5 Tests and acceptance
- **vitest:** `layout-math.test.ts` (parity fixture), `streamer-presets.route.test.ts` (validation; default switching; soft delete), `streamer-layout.route.test.ts` (enqueues relayout).
- **pytest:** `test_relayout_job.py`, `test_preset_precedence.py` (channel default preset beats auto-detect).
- **playwright** `e2e/s8-layout-editor.spec.ts`: drag the facecam box → preview canvas pixels change → Save → POST body correct.
- **Browser acceptance (prod):**
  1. Open a streamer project → click the layout pill → move the facecam box onto the webcam → the preview updates live → Apply to all → clips re-render with the new crop.
  2. Tick "Save as channel default" → paste another VOD from the same channel → the new clips use the saved box with no detection (pill shows "Preset").
  3. Choose "No facecam" → gameplay-only re-render.

---

## 13. S9: Captions placement, title/game metadata, optional chat overlay

**Goal:** captions sit in a readable place for stacked layouts; clips carry a title, game/category and timestamps; an optional chat overlay shows the real chat lines from that moment.

### 13.1 Captions
- Caption rendering stays on the existing system and styles. For `layout='stack'`, the default caption anchor is the **seam** (y = Hf ± 0), or `bottom_third` of the gameplay panel. Setting `captionPosition: 'seam'|'gameplay_bottom'|'top'` (§3).
- Implementation: a pure `streamer/layout/caption_anchor.py` returns the ASS `MarginV`/alignment, passed into the existing caption burn step.

### 13.2 Metadata
On each clip:
- `aiMeta.streamer.meta = { game: chapterAt(peakMs) ?? vod.category, vodTitle, channel, vodOffsetMs: clip.startMs, vodUrlAt: url+"?t=XhYmZs" (Twitch) }`;
- clip `title` comes from the LLM (S4) and is editable as today.

UI on the clip card: a game badge, a "VOD 1:23:45 ↗" link, and copy-title/hashtags buttons. An optional **game badge burn-in** (`gameBadge`, default false): a small rounded label at the top-left of the gameplay panel, drawn with drawtext.

### 13.3 Chat overlay
- **Source:** the S5/S13 chat for `[clip.start − 5 s, clip.end]`, shifted by `CHAT_LAG_S`. A max of 4 msgs/s are sampled (busier chats are thinned uniformly, favouring hype-lexicon lines). Text is ≤ 80 chars with emotes as plain text names. Usernames use the chat colour, or a hash colour if missing.
- **API:** `GET /api/streamer/clips/[clipId]/chat` returns `{ lines: [{tMs (clip-relative), user, color, text}] }` (from `clips/{cid}/chat.json`, written at render, so it survives cleanup).
- **Render:** `streamer/layout/chat_overlay.py` builds an ASS file. Each message is a dialogue event for 6 s, with up to 6 lines visible stacked in a semi-transparent box (`\3c`/`\4c` + BorderStyle 3). Position `chatOverlay.position` (§3, default gameplay_right), font size 34 at 1080 w. Burned in with the `subtitles=` filter after captions.
- **Settings:** `chatOverlay.enabled` (default false), `position`, `opacity` (0.6). It is per-project in the Streamer tab and editable on the project page (toggling it enqueues `STREAM_RELAYOUT` for the selected clips).
- When no chat exists, the toggle is disabled with the tooltip "No chat available for this VOD".

### 13.4 Tests and acceptance
- **pytest:** `test_caption_anchor.py`, `test_chat_sampling.py` (cap 4/s, lag shift, clip-relative times), `test_chat_overlay_ass.py` (golden ASS file), `test_metadata.py` (chapterAt; Twitch `?t=` format), `test_chat_overlay_render_smoke.py`.
- **vitest:** `streamer-clip-chat.route.test.ts`.
- **Browser acceptance (prod):**
  1. A stacked clip has captions at the seam and they never cover the face.
  2. The clip card shows the game badge and a VOD timestamp link that opens Twitch at the right moment.
  3. Turn on the chat overlay for a Twitch VOD project → re-rendered clips show scrolling chat lines that match the moment. Turn it off → gone.

---

## 14. S10: Montage of top moments

**Goal:** one click creates a single highlight video from selected (or top-N) clips.

### 14.1 Prisma: migration `s10_montage`
`ClipMontage` (§2).

### 14.2 API
| Route | Method | Purpose |
|---|---|---|
| `/api/streamer/montages` | POST `{ projectId, clipIds?: string[], topN?: 5, maxDurationS?: 180, order: 'score'\|'chronological', transition: 'cut'\|'fade', aspect: '9:16'\|'16:9', titleCard: boolean }` | Creates `ClipMontage` (status QUEUED) and enqueues `STREAM_MONTAGE {montageId}` |
| `/api/streamer/montages?projectId=` | GET | List with signed `outputUrl` when READY |
| `/api/streamer/montages/[id]` | GET / DELETE (soft) | |

### 14.3 Worker: `STREAM_MONTAGE` (`streamer/montage_job.py`)
1. Resolve clips (order and trim to `maxDurationS` by dropping the lowest-scored).
2. **9:16:** use each clip's rendered output (re-encode to the same fps 30 / 1080×1920 / AAC 48k). **16:9:** cut from `sourceSegKey` (S2) without reframe.
3. **Optional title card:** 2 s, VOD title + channel + game, drawn with drawtext on a blurred first frame.
4. **Concat:** `cut` uses the concat demuxer after normalising; `fade` uses `xfade=transition=fade:duration=0.3` + `acrossfade` chains.
5. Loudness-normalise (`loudnorm I=-14`).
6. Upload `montages/{id}.mp4` + poster, set READY, then notify (S11, when shipped).

### 14.4 UI
- Project page toolbar: "Make montage" button → dialog (clip multi-select, pre-checked top 5 by score; order; transition; aspect; title card; estimated duration).
- Montages section above the clip grid: card with player, download, delete, status.

### 14.5 Tests and acceptance
- **pytest:** `test_montage_plan.py` (ordering, maxDuration trimming), `test_montage_ffmpeg_smoke.py` (3 testsrc clips → output duration ≈ sum − fades), `test_montage_resume.py`.
- **vitest:** `streamer-montages.route.test.ts`.
- **playwright** `e2e/s10-montage-dialog.spec.ts`.
- **Browser acceptance (prod):**
  1. On a READY streamer project: Make montage → defaults → within a few minutes a montage card plays: the top 5 moments with fades and a title card; it downloads.
  2. Chronological 16:9 montage → landscape output in time order.

---

## 15. S11: Notifications (in-app popover + email)

**Goal:** when a streamer project finishes, fails, hits the cap, or an auto-pull fails, the user gets an in-app notification (the bell shows real data) and an email.

### 15.1 Prisma
None. Uses the existing `InAppNotification` (needs `userId`) and `StreamVod.notifiedAt`.

### 15.2 Server
- **`POST /api/internal/notify`** (HMAC: reuse the internal-route signature check used by `/api/internal/jobs/**`; `rg -n "verifyInternal|INTERNAL_" new-app/app/api/internal`). Body `{ workspaceId, type: 'stream_ready'|'stream_failed'|'stream_cap'|'autopull_failed'|'modal_budget', vodId?, montageId?, data }`. `new-app/lib/server/streamer/notify.ts`:
  - **Recipients:** `Membership` rows for the workspace (`userId`); if there are none, `Workspace.ownerUserId`. If both are empty (no-auth mode), skip in-app and only email `STREAMER_NOTIFY_FALLBACK_EMAIL` when it is set.
  - creates an `InAppNotification` per user (`type`, `title`, `body`, `href` `/app/clips/{projectId}`);
  - sends a Brevo email via `sendTransactionalEmail` (subject `"🎬 12 clips ready from 'Ranked grind…'"`, a plain HTML template `new-app/lib/email/templates/stream-ready.ts` with the top 3 clip titles + thumbnails + button);
  - email is skipped when the project's `settings.streamer.notify.email` is false (in-app when `notify.inApp` is false);
  - idempotent: for `stream_ready` it skips if `StreamVod.notifiedAt` is set (then sets it), and other types dedupe on `(type, vodId)` within 1 h.
- **Worker:** `streamer/notify.py::notify(type, …)` posts via the existing internal HTTP client, called at the end of STREAM_RENDER / PROCESS_PROJECT (streamer), on failures, cap, budget, and STREAM_MONTAGE.

### 15.3 API + UI
- `GET /api/notifications?cursor=` → the current user's items. The user is resolved by the existing session helper if one exists; otherwise (no-auth mode) it is `Workspace.ownerUserId`. If that is also null, return `[]`.
- `POST /api/notifications/read { ids | all:true }`.
- Replace the bell's placeholder in the app header (`rg -n "Bell" new-app/components`) with `components/notifications/notifications-popover.tsx`: unread count badge, list, mark-all-read, click to navigate. It polls every 60 s while the tab is visible (no websockets).

### 15.4 Tests and acceptance
- **vitest:** `internal-notify.route.test.ts` (bad HMAC 401; idempotency; email called with the right subject; preference off → no email), `notifications.route.test.ts`, `notifications-popover.test.tsx`.
- **pytest:** `test_notify_calls.py` (called once on READY; on failure with the error).
- **Browser acceptance (prod):**
  1. Paste a short VOD and leave the page → when READY, the bell shows a badge → the item opens the project.
  2. The email "clips ready" arrives with the top clip titles and a working link.
  3. Force a failure (paste a deleted VOD) → a "failed" notification with the reason.

---
## 16. S12: `/app/streamer` channels hub, per-channel settings, auto-process toggle, OBS docs, nav

**Goal:** one place to see channels, their VODs and settings, connect accounts (buttons go live in S13/S14), and read the OBS fallback guide.

### 16.1 Prisma
None (`StreamChannel.settings`, `autoProcess` exist since S1).

### 16.2 API
| Route | Method | Purpose |
|---|---|---|
| `/api/streamer/channels` | GET | Channels + last 5 VODs each + connection status + usage summary |
| `/api/streamer/channels` | POST `{ platform, login }` | Add a paste-only channel (validated with the login regex; Helix lookup for avatar/displayName if creds exist) |
| `/api/streamer/channels/[id]` | PATCH `{ settings?, autoProcess?, defaultPresetId? }` / DELETE (soft) | Settings are validated by `streamerSettingsSchema.partial()` and deep-merged. `autoProcess=true` is rejected with 409 unless `status='CONNECTED'` |

### 16.3 UI routes
- **`new-app/app/app/streamer/page.tsx`** (server component; follow the existing `/app/clips` page structure for layout/data loading):
  - header with the usage meter (S3) and a "New import" button (→ `/app/clips/new?tab=streamer`);
  - channel cards: avatar, platform, status badge (Paste-only / Connected / Needs re-auth), auto-process switch (disabled with tooltip "Connect your channel to auto-process" when not connected), last VOD date, "Settings";
  - "Connect Twitch" / "Connect Kick" buttons (hidden until S13/S14 env present: `TWITCH_CLIENT_ID` / `KICK_CLIENT_ID` passed as booleans from the server);
  - empty state: "Paste your first VOD", plus the OBS guide link.
- **`new-app/app/app/streamer/channels/[id]/page.tsx`:**
  - tabs **VODs** (table: title, date, duration, status, clips count, link to project; Retry for FAILED → `POST /api/streamer/imports {url, channelId}` with `triggeredBy='retry'`);
  - **Settings** (form generated from §3 groups: Clips, Layout & presets (S8 list), Captions & chat overlay, Notifications, Auto-process);
  - **Connection** (S13/S14).
- **`new-app/app/app/streamer/obs/page.tsx`** renders `docs/clips/STREAMER_OBS.md` content (MDX/markdown renderer already used in the app, or a static TSX copy). Content:
  - (1) OBS Settings → Output → Recording, record to MKV/MP4 at 1080p60 while streaming; Remux;
  - (2) the optional Source Record plugin for a separate vertical/facecam output;
  - (3) upload in the Streamer tab;
  - (4) why: sub-only VODs, platforms without VODs, privacy;
  - an explicit note that we don't take an RTMP feed.
- **Nav** (`new-app/lib/nav.ts`): `{ title: 'Streamer', href: '/app/streamer', icon: Radio, group: 'Create', badge: 'new' }` after Clips.
- **Streamer tab channel picker:** selecting a channel prefills its settings.

### 16.4 Tests and acceptance
- **vitest:** `streamer-channels.route.test.ts` (409 on autoProcess without connection; settings merge; soft delete), `nav.test.ts` (item present), `channel-settings-form.test.tsx`.
- **playwright** `e2e/s12-streamer-hub.spec.ts`.
- **Browser acceptance (prod):**
  1. The sidebar shows "Streamer (new)" → `/app/streamer` lists the channels created by earlier pastes with their VODs.
  2. Open a channel → change the clip count to 5 and the caption position → paste a new VOD for that channel → it gets 5 clips with that caption position.
  3. The auto-process switch is disabled with a "Connect" tooltip.
  4. The OBS guide page reads correctly.

---

## 17. S13: Twitch connect (OAuth, EventSub auto-pull, live chat capture, maintenance)

**Goal:** a streamer connects **their own** Twitch account. When their stream ends, the VOD is fetched and processed automatically (if auto-process is on), with official live chat captured during the stream.

### 17.1 Prisma: migration `s13_stream_live`
`StreamWebhookEvent`, `StreamChatBucket`, `StreamChatLine` (§2).

### 17.2 OAuth (`new-app/lib/server/streamer/twitch.ts`)
- **`GET /api/streamer/oauth/twitch/start`:** `state` = HMAC-signed `{ws, nonce, exp}` (the existing integrations framework state helper if present: `rg -n "state" new-app/lib/integrations/framework`). It redirects to `https://id.twitch.tv/oauth2/authorize?client_id&redirect_uri=${appUrl()}/api/streamer/oauth/twitch/callback&response_type=code&scope=user:read:chat user:bot channel:bot&state&force_verify=true`.
- **`GET …/callback`:**
  - verify state;
  - exchange the code (`POST https://id.twitch.tv/oauth2/token`);
  - `GET /helix/users` with the user token to get the broadcaster id, login, display name and avatar;
  - upsert `IntegrationConnection(provider='twitch')` with encrypted tokens, scopes, `externalAccountId=user_id` (map onto the existing column names; check the model);
  - upsert `StreamChannel(platform 'twitch', login, externalId, connectionId, status CONNECTED)`.
  - Then create EventSub subscriptions with the **app token**, transport `{method:'webhook', callback: ${appUrl()}/api/streamer/webhooks/twitch, secret: TWITCH_EVENTSUB_SECRET}`: `stream.online`, `stream.offline`, `channel.update` (v2) with condition `broadcaster_user_id`, and `channel.chat.message` with condition `{broadcaster_user_id, user_id: same}`.
  - Store the subscription ids in `platformState.eventsubIds`, then redirect to `/app/streamer/channels/{id}?connected=1`.
  - **Own channel only:** subscriptions are only ever created for the OAuth user's own id. The UI and API offer no other path.
- **`DELETE /api/streamer/channels/[id]/connection`:** deletes the EventSub subscriptions, revokes the token (`POST /oauth2/revoke`), and sets the connection inactive (soft) and `status='DISCONNECTED'`, `autoProcess=false`.

### 17.3 Webhook `POST /api/streamer/webhooks/twitch` (Node runtime, raw body)
1. Verify the HMAC (§0.3) with `crypto.timingSafeEqual`; reject if the timestamp is older than 10 min.
2. `webhook_callback_verification` → return `challenge` as `text/plain` 200.
3. `revocation` → channel `NEEDS_REAUTH` + notify.
4. **Dedupe:** insert `StreamWebhookEvent(id=message-id)`; on a unique conflict, return 204.
5. **Notifications:**
   - `stream.online`: `platformState.live={startedAt, sessionId}`, plus `categoryLog` start.
   - `channel.update`: append `{at, title, category}` to `categoryLog`.
   - `channel.chat.message`: aggregate (§17.4).
   - `stream.offline`: if the channel `autoProcess` is on and not over the cap, create a ClipProject (title "Stream {date}", status QUEUED, channel settings) + StreamVod (`triggeredBy 'auto'`, `attestedAt = connection time`, `streamedAt = live.startedAt`) + `ClipJob STREAM_AUTOPULL {vodId, attempt:1}` with `runAfter = now + TWITCH_VOD_DELAY_S`. If autoProcess is off, only an in-app "Stream ended: process it?" notification with a one-click action (POST imports).
6. Respond within 2 s (heavy work is all in jobs).

### 17.4 Live chat capture (official EventSub only; no recording)
- `new-app/lib/server/streamer/chat-aggregator.ts`: an in-memory per-channel buffer flushed every 5 s (and on 500 msgs). It upserts `StreamChatBucket` (`count += n`, `chatters` = set size, `hype` = lexicon hits) and inserts sampled `StreamChatLine` rows (max 4/s, text ≤ 200 chars). These are message text and counts only.
- If the app restarts, at most 5 s of counts are lost. Accepted.
- Chat rows older than 30 days are deleted by maintenance (rows only; no table drops).

### 17.5 Worker: `STREAM_AUTOPULL` (`streamer/autopull.py`)
1. Find the VOD: Helix `GET /videos?user_id=externalId&type=archive&first=5` (app token) and pick the one whose `created_at` is within ±15 min of `streamedAt`. Not found → re-enqueue with backoff 2/5/10/20/40 min; after 6 tries → `autopull_failed` notification: "Twitch didn't publish a VOD. Turn on 'Store past broadcasts' in Twitch settings, or upload your recording."
2. Set `StreamVod.url/externalId/title/durationMs/chapters` (chapters from `categoryLog` if Twitch has none), then run the STREAM_IMPORT logic inline (the S2 long branch).
3. **Chat:** `get_chat` prefers the live-captured buckets (`chatSource='twitch_eventsub'`).

### 17.6 Maintenance (worker-internal, not a ClipJob)
`streamer/maintenance.py` runs every 60 min from the stream-lane worker loop under `pg_try_advisory_lock(hashtext('streamer_maint'))`:
- calls `POST /api/internal/streamer/maintenance` (HMAC). The app owns token encryption, so it does the work: it validates every Twitch user token (`GET https://id.twitch.tv/oauth2/validate`, as Twitch requires hourly), refreshes expiring or invalid ones (`refresh_token` grant, stored encrypted), and sets `NEEDS_REAUTH` + notifies when a refresh fails. In S14 it does the same for Kick. **The worker never handles user tokens.** Helix calls from the worker use the app token (client credentials) only;
- (same app route) re-lists EventSub subscriptions and recreates any missing or not `enabled` ones;
- prunes `StreamWebhookEvent` > 7 days and chat rows > 30 days;
- re-enqueues `STREAM_CLEANUP` for READY vods past retention without `sourceDeletedAt`.

### 17.7 UI
- Connection tab: "Connect Twitch" → OAuth. When connected: account, scopes, subscriptions health (green/red per type), a "Live now" pill during a stream (with a chat messages counter), the Auto-process switch, and Disconnect.
- Copy: "We only process your own channel's finished VODs. We never record your live stream."

### 17.8 Tests and acceptance
- **vitest:**
  - `twitch-webhook.test.ts` (valid/invalid HMAC; old timestamp; challenge; dedupe 204; offline creates project+vod+job with runAfter; autoProcess off → notification only; cap exceeded);
  - `twitch-oauth.test.ts` (state tamper → 400; subscriptions created only for own id);
  - `chat-aggregator.test.ts`.
- **pytest:** `test_autopull_match.py` (±15 min match; backoff schedule; final notification), `test_maintenance.py` (lock; validate/refresh paths; recreate subs).
- **playwright** `e2e/s13-twitch-connect.spec.ts` (OAuth start redirect URL + params).
- **Browser acceptance (prod)**, with the owner's own Twitch test channel, "Store past broadcasts" ON:
  1. `/app/streamer` → Connect Twitch → authorize → the channel shows Connected with all 4 subscriptions green.
  2. Turn on Auto-process. Go live for about 10 min with some chat messages, then end the stream. The "Live now" pill and counter show during the stream.
  3. Within about 15 min of ending, a new project appears, clips become READY with chat reasons, and the bell + email arrive.
  4. Disconnect → the subscriptions are removed (re-connect works).

---

## 18. S14: Kick connect (OAuth 2.1 PKCE, webhooks, auto-pull, live chat)

**Goal:** parity with S13 for Kick.

### 18.1 OAuth (`new-app/lib/server/streamer/kick.ts`)
- **`GET /api/streamer/oauth/kick/start`:** generate a PKCE `code_verifier` (64 chars), stored in an httpOnly, Secure, SameSite=Lax cookie `kick_pkce` (10 min) with the signed `state`. Redirect to `https://id.kick.com/oauth/authorize?response_type=code&client_id&redirect_uri=${appUrl()}/api/streamer/oauth/kick/callback&scope=user:read channel:read events:subscribe&code_challenge=S256(verifier)&code_challenge_method=S256&state`.
- **`GET …/callback`:**
  - verify state, then exchange `POST https://id.kick.com/oauth/token` (`grant_type=authorization_code`, `code_verifier`);
  - `GET https://api.kick.com/public/v1/users` (token user) → `user_id`, `name`;
  - `GET /public/v1/channels` → `slug`, `broadcaster_user_id`;
  - upsert the connection + channel (CONNECTED);
  - subscribe `POST /public/v1/events/subscriptions` `{ broadcaster_user_id, method:'webhook', events:[{name:'livestream.status.updated',version:1},{name:'livestream.metadata.updated',version:1},{name:'chat.message.sent',version:1}] }`, storing the ids in `platformState.kickSubIds`.
- **Disconnect:** `DELETE /public/v1/events/subscriptions?id=…`, `POST /oauth/revoke`.

### 18.2 Webhook `POST /api/streamer/webhooks/kick`
- Verify the RSA signature (§0.3) with the public key from `GET /public/v1/public-key`, cached 24 h and refetched once on failure.
- Dedupe on `Kick-Event-Message-Id`.
- **Events:**
  - `livestream.status.updated` `is_live:true` → live state; `is_live:false` → same as Twitch offline, with `runAfter + KICK_VOD_DELAY_S`;
  - `livestream.metadata.updated` → categoryLog;
  - `chat.message.sent` → the chat aggregator (shared with S13).
- The webhook URL is registered in the Kick app settings (owner setup, §23).

### 18.3 Worker
- **`STREAM_AUTOPULL` (kick branch):** `yt-dlp --flat-playlist -J https://kick.com/{slug}/videos` (newest first), take entries ≤ 5, fetch each `-J` until `timestamp` is within ±15 min of `streamedAt`. Same backoff and final message ("Kick didn't publish a VOD yet. Upload your recording.").
- **Maintenance:** the app maintenance route (§17.6) also refreshes Kick tokens before expiry and re-checks the subscriptions (`GET /public/v1/events/subscriptions`), recreating any that are missing.

### 18.4 Tests and acceptance
- **vitest:** `kick-webhook.test.ts` (RSA verify with a test keypair; bad signature 401; dedupe; offline → job), `kick-oauth.test.ts` (PKCE challenge correctness; cookie flags; state tamper).
- **pytest:** `test_autopull_kick.py` (canned flat-playlist JSON; match/miss).
- **Browser acceptance (prod)**, with the owner's own Kick test channel:
  1. Connect Kick → Connected.
  2. Go live about 10 min with chat, then end. Clips arrive automatically with notifications.
  3. Disconnect works.

---

## 19. S15: GPU rendering + face tracking on Modal, parity, hardening

**Goal:** move the heavy per-clip work (face tracking for camera-follow, and the clip encodes) to Modal in one batch per VOD; prove output parity; load-test.

### 19.1 Modal functions
- **`modal_app/face.py`:** `face_track(segment_url, params) -> crop-track JSON`. Image `gpu_image` + `opencv-python-headless`, `mediapipe`, and the YuNet ONNX model (vendored into the Volume at deploy by `modal_app/common.py::ensure_models`). The worker's face-track code (`subject_reframe.py` core, refactored into a pure `track_faces(path, params)` with no DB/storage access) is copied into the image with `add_local_python_source("clips_worker.reframe_core")`. Same code locally and remotely, so parity is guaranteed by construction.
- **`modal_app/render.py`:** `render_batch(items) -> results`. Each item has `{segment_url, filtergraph (built by the worker), caption_ass_url?, chat_ass_url?, out_upload: signed upload url, encoder: 'h264_nvenc'}` and returns `{ok, duration_ms, size, gpu_seconds}`. Image: an ffmpeg build with NVENC (`jrottenberg/ffmpeg:7-nvidia` base or a static build); verify `ffmpeg -encoders | grep nvenc` in the image build. NVENC uses `-preset p5 -cq 21`; the CPU fallback uses libx264 `-crf 20` as today. Same decorator knobs as the Transcriber, with `timeout=1800`.
- **Batching:** STREAM_RENDER builds all filtergraphs locally (cheap), then makes one `render_batch.map(chunks of 4 clips)` call. Containers are reused within the batch, and scaledown happens 60 s after the last one.
- **Provider routing:** `GPU_PROVIDER_FACE` / `GPU_PROVIDER_RENDER` (default follows `GPU_PROVIDER`). Fallback to local per item on error.

### 19.2 Hardening
- Concurrency limits: `MODAL_MAX_CONTAINERS` per function, plus a worker-side semaphore `STREAMER_MODAL_INFLIGHT` (default 8 calls).
- Timeouts: transcribe 3600 s per chunk call, render 1800 s, face 900 s. The worker cancels with `FunctionCall.cancel()` on job cancel.
- Cost recording: every function returns `gpu_seconds` → AiUsage (`model='L4:render'|'L4:face'`).
- **Load test:** `scripts/streamer_load_test.py` enqueues 3 × 4 h public VODs plus 5 normal uploads. It records wall time, Modal GPU seconds and peak worker disk/RAM, and writes the results to `docs/clips/PROGRESS.md`.

### 19.3 Tests and acceptance
- **pytest:**
  - `test_reframe_core_pure.py` (no imports of db/storage);
  - `test_render_parity.py` (render one fixture clip via local libx264 and via the NVENC path when available (`@live`): same duration ±40 ms, same dims, SSIM ≥ 0.95 on 5 sampled frames);
  - `test_render_batch_fallback.py`;
  - `test_modal_inflight_semaphore.py`.
- **Secrets check:** `rg -n "MODAL_TOKEN_(ID|SECRET)\s*=\s*['\"][a-z0-9]" -i .` returns nothing, and the deploy logs grep for `ak-`/`as-` prefixes returns nothing.
- **Browser acceptance (prod):**
  1. With `GPU_PROVIDER=modal` for all ops, a 3 h VOD finishes noticeably faster than in S7 (time recorded in PROGRESS.md). The clips look identical in quality.
  2. The Modal dashboard shows render/face calls batched, with containers back to 0 within about 2 min.
  3. The `/app/streamer` usage popover shows Modal $ this month matching the Modal dashboard within ±15 %.

---
## 20. Out of scope / deferred
- Recording any live stream (HLS/RTMP), including the user's own. RTMP ingest. Restreaming.
- Auto-pull for channels not connected via OAuth by the user; following other creators.
- Sub-only/private VOD download (would need user cookies). Users upload instead.
- RunPod provider (`GPU_PROVIDER=runpod` raises "not built").
- Emote images in the chat overlay; animated chat; 3rd-party emotes (BTTV/7TV).
- Publishing to Twitch/Kick/TikTok/YouTube/Shorts.
- Login/auth, sessions, credits, billing, plans, marketing pages (later milestones of the product).
- YouTube Live / Facebook Gaming / Rumble sources.
- Websocket push for notifications (polling only).

## 21. Environment variables
| Var | Used by | Default | Notes |
|---|---|---|---|
| `GPU_PROVIDER` | worker | `local` | `local\|modal\|runpod` (runpod raises) |
| `GPU_PROVIDER_TRANSCRIBE` / `_FACE` / `_RENDER` | worker | = `GPU_PROVIDER` | per-op override |
| `GPU_FALLBACK_LOCAL` | worker | `1` | fall back to local on Modal error/budget |
| `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` | worker | — | **secret**; read by the Modal client from env; never printed/logged/passed as args |
| `MODAL_APP_NAME` | worker + deploy | `transovo-gpu` | |
| `MODAL_GPU` | deploy | `L4` | read at deploy time |
| `MODAL_MAX_CONTAINERS` | deploy | `2` | redeploy or `scripts/modal_autoscaler.py` to change |
| `MODAL_SCALEDOWN_S` | deploy + worker | `60` | idle tail; also used in the cost estimate |
| `MODAL_MONTHLY_BUDGET_USD` | worker + app | `25` | guard at 95 % → local |
| `MODAL_L4_USD_PER_S` | worker | `0.000222` | cost accounting |
| `WHISPER_GPU_MODEL` | deploy | `large-v3` | Modal transcriber model |
| `WHISPER_GPU_BATCH` | deploy | `16` | BatchedInferencePipeline batch size |
| `STREAMER_MODAL_INFLIGHT` | worker | `8` | S15 semaphore |
| `WORKER_LANE` | worker | `all` | compose sets `default` / `stream` |
| `STREAMER_MAX_VOD_HOURS` | app + worker | `12` | |
| `STREAMER_FULL_DOWNLOAD_MAX_MIN` | worker | `20` | ≤ this → S1 full-download path |
| `STREAMER_CHUNK_MIN` | worker | `25` | |
| `STREAMER_CHUNK_OVERLAP_S` | worker | `15` | |
| `STREAMER_SEGMENT_PAD_S` | worker | `30` | per-clip segment padding |
| `STREAMER_SOURCE_RETENTION_HOURS` | worker | `24` | then STREAM_CLEANUP |
| `STREAMER_DEFAULT_MONTHLY_HOURS` | app + worker | `40` | cap when `limits.streamer.monthlyHours` unset |
| `STREAMER_MAX_RUNNING_PER_WORKSPACE` | worker | `1` | concurrent STREAM_ANALYZE |
| `STREAMER_CHAT_LAG_S` | worker | `6` | |
| `STREAMER_LLM_CANDIDATES` | worker | `40` | |
| `STREAMER_CHAT_MAX_MESSAGES` | worker | `300000` | GQL replay cap |
| `STREAMER_MAX_UPLOAD_GB` | app | `20` | Streamer-tab upload limit (check the bucket limit, §23) |
| `STREAMER_SCRATCH_DIR` | worker | `/tmp/streamer` | |
| `STREAMER_NOTIFY_FALLBACK_EMAIL` | app | — | no-auth mode only |
| `STREAMER_LIVE_TESTS` | tests | `0` | enables `@live` pytest |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | app + worker | — | **secret**; app token + OAuth |
| `TWITCH_EVENTSUB_SECRET` | app | — | **secret**; 10–100 chars, random |
| `TWITCH_VOD_DELAY_S` | app | `120` | autopull first attempt delay |
| `TWITCH_VOD_CHAT_REPLAY` | worker | `gql` | `gql\|off` |
| `TWITCH_GQL_CLIENT_ID` / `TWITCH_GQL_COMMENTS_HASH` | worker | — | unofficial; replay is off if missing |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` | app | — | **secret** |
| `KICK_VOD_DELAY_S` | app | `300` | |
| `KICK_CLIPS_SIGNAL` | worker | `0` | best-effort Kick viewer-clip signal |

Existing vars reused unchanged: `APP_URL` (via `lib/integrations/framework/app-url.ts`), Supabase storage vars, internal HMAC secret, Brevo key, OpenAI/Gemini keys, `WHISPER_MODEL` (local).

## 22. Test matrix
| Milestone | vitest | pytest | playwright | Live / manual |
|---|---|---|---|---|
| S0 | progress-heartbeat | job_types, heartbeat, gpu_select, normalize_words, budget_guard, storage_sign | — | `@live` modal_smoke; prod acceptance §4.4 |
| S1 | streamer-url, streamer-imports.route, streamer-resolve.route | stream_urls, ytdlp_metadata, ytdlp_errors, single_clip_payload | `e2e/s1-streamer-paste.spec.ts` | `@live` ytdlp_live |
| S2 | streamer-imports.route (12 h) | chunking, align, lane_types, analyze_resume, process_clip_offset, render_job_segment | `e2e/s2-stage-stepper.spec.ts` | `@live` segment_fetch_live |
| S3 | streamer-usage.route | usage_meter, cleanup_job, priority | `e2e/s3-usage.spec.ts` | |
| S4 | streamer-signals.route | signal_audio, signal_transcript, fusion, stream_moments_prompt, llm_json_parse | `e2e/s4-reasons.spec.ts` | |
| S5 | — | twitch_gql_parse, twitch_gql_backoff, signal_chat, chat_source_order | — | `@live` twitch_gql_live |
| S6 | — | viewer_clips_twitch, viewer_clips_kick | — | `@live` helix clips |
| S7 | — | detect_facecam, gemini_facecam_validate, render_stack_filter, stack_render_smoke | — | |
| S8 | layout-math, streamer-presets.route, streamer-layout.route | relayout_job, preset_precedence | `e2e/s8-layout-editor.spec.ts` | |
| S9 | streamer-clip-chat.route | caption_anchor, chat_sampling, chat_overlay_ass, metadata, chat_overlay_render_smoke | — | |
| S10 | streamer-montages.route | montage_plan, montage_ffmpeg_smoke, montage_resume | `e2e/s10-montage-dialog.spec.ts` | |
| S11 | internal-notify.route, notifications.route, notifications-popover | notify_calls | — | email received |
| S12 | streamer-channels.route, nav, channel-settings-form | — | `e2e/s12-streamer-hub.spec.ts` | |
| S13 | twitch-webhook, twitch-oauth, chat-aggregator, internal-maintenance.route | autopull_match, maintenance | `e2e/s13-twitch-connect.spec.ts` | real stream on the owner's channel |
| S14 | kick-webhook, kick-oauth | autopull_kick | — | real stream on the owner's channel |
| S15 | — | reframe_core_pure, render_parity, render_batch_fallback, modal_inflight_semaphore | — | load test; secrets grep |

**Every milestone runs:**
- `pnpm -C new-app lint && pnpm -C new-app typecheck && pnpm -C new-app test`
- `cd worker && pytest -q`
- `pnpm -C new-app exec playwright test e2e/s{N}-*.spec.ts` (if one exists)
- `git diff master -- prisma/migrations | rg -i "drop |alter column .* type"` must be empty
- **Secrets grep:** `rg -n -i "(MODAL_TOKEN_(ID|SECRET)|TWITCH_CLIENT_SECRET|KICK_CLIENT_SECRET)\s*[:=]\s*['\"][^'\"$]{6,}" --glob '!*.md' .` must be empty, and no `print`/`console.log` of `process.env.*SECRET*` / `os.environ[...TOKEN...]`.

## 23. Owner setup actions (not open questions, just one-time config)
1. **Modal:** add `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` to `/opt/clips-worker/worker.env` (both services). Run the §0.4 deploy command once at S0. Optionally set the Modal workspace spend limit in the Modal dashboard to match `MODAL_MONTHLY_BUDGET_USD`.
2. **Twitch** (before S13; S1/S6 resolve also benefit): at dev.twitch.tv/console, register an app.
   - OAuth redirect `https://transovo.ai/api/streamer/oauth/twitch/callback`; category "Application Integration".
   - Set `TWITCH_CLIENT_ID/SECRET` on the app and worker, and generate `TWITCH_EVENTSUB_SECRET` (`openssl rand -hex 32`).
3. **Kick** (before S14): at kick.com → Settings → Developer, create an app.
   - Redirect `https://transovo.ai/api/streamer/oauth/kick/callback`; webhook URL `https://transovo.ai/api/streamer/webhooks/kick`; enable webhooks.
   - Set `KICK_CLIENT_ID/SECRET`.
4. **Supabase storage:** check the `clips` bucket's file-size limit (and the project's global upload limit) is ≥ `STREAMER_MAX_UPLOAD_GB` for OBS-recording uploads. If the plan caps it lower, set `STREAMER_MAX_UPLOAD_GB` to match.
5. **Twitch test channel:** "Store past broadcasts" ON (Creator Dashboard → Settings → Stream) for S13 acceptance.
6. **Optional:** `TWITCH_GQL_CLIENT_ID` and `TWITCH_GQL_COMMENTS_HASH` for VOD chat replay (S5). The coding agent documents how to obtain the current values in `docs/clips/STREAMER_OPS.md`. If unset, chat replay is off and everything else works.

## 24. Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| yt-dlp Twitch/Kick extractor breaks | Med | Paste/auto-pull fails | Weekly image rebuild; clear error → "upload the file"; `@live` tests in a nightly run |
| Platform ToS objection to downloading | Low–Med | Feature pulled | Attestation, own-channel auto-pull, no live recording, source deletion (§0.5) |
| Twitch GQL chat replay changes/blocked | High | No chat signal on pasted VODs | Non-fatal, flag off; EventSub capture for connected channels; fusion renormalises |
| Kick API changes (young API) | Med | Connect/webhooks fail | Defensive parsing, signature key fetched, notifications on failure, paste fallback |
| `--download-sections` inaccuracy | Med | Captions out of sync | Audio cross-correlation alignment (S2) |
| Long jobs reaped mid-run | High without fix | Duplicate work | Heartbeat (S0) + checkpoints |
| Worker disk/RAM blowup on 12 h VOD | Med | Worker crash | Audio-only + segment downloads; no multi-GB uploads; scratch cleanup |
| Modal cold starts (1–2 min) | Certain | Latency | Accepted for cost; one batch per VOD; local fallback |
| Modal cost overrun | Low | $ | Budget guard 95 %, max_containers 2, scaledown 60 s, usage shown in UI |
| Facecam mis-detection | Med | Bad crops | Confidence + Gemini fallback + editor + per-channel preset |
| Webhook missed (app restart) | Low | No auto-pull | Twitch retries; hourly maintenance re-subscribes; manual "process last stream" button via notification |

## 25. Modal cost estimate (ESTIMATE; verify in S0/S15 and write the measured values into PROGRESS.md)
Assumptions: L4 at $0.000222/s (≈ $0.80/h), faster-whisper large-v3 batched at ≈ 35× realtime on L4 (unverified), 60 s idle tail per batch, ≈ 90 s cold start per batch.

| Item | GPU time | Cost |
|---|---|---|
| Transcribe 1 stream-hour (audio) | ≈ 1.7 min | ≈ $0.023 |
| Cold start + idle tail, per VOD batch (×2 if face+render batches also cold) | ≈ 2.5 min | ≈ $0.033 |
| Face track 12 clips (S15) | ≈ 1 min | ≈ $0.013 |
| Render 12 clips with NVENC (S15) | ≈ 2 min | ≈ $0.027 |
| **4 h VOD, all on Modal** | ≈ 14 min | **≈ $0.19** |
| **Per workspace at the 40 h/month default cap (≈ 10 VODs)** | ≈ 2.3 h | **≈ $1.90/month** |

The Modal Starter $30/month credit covers ≈ 15 such workspaces before any spend (estimate). Local fallback costs $0 GPU but takes ≈ 0.3–1× realtime CPU for large-v3 int8, so it is only reasonable for smaller models or short VODs.

---
*End of spec.*
