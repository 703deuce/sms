# Motion Studio ↔ Grokbot Agent Bridge v1

## Scope and release mode

- Implemented in `new-app/`. The old Motion Lab and worker agent chain remain untouched.
- `GROKBOT_WEBHOOK_URL` and `GROKBOT_WEBHOOK_KEY` are **server-only** Coolify environment variables.
- The bot's routine is currently in **setup mode**. The bridge mirrors this by default: `GROKBOT_LIVE_MODE` is unset (or not `1`), and the dispatched JSON contains `setupMode: true`, **without any callback token**.
- Do not set `GROKBOT_LIVE_MODE=1` until the bot owner updates the routine to live and validates the callback/upload workflow.
- Optional `MOTION_STUDIO_AGENT_PUBLIC_URL` is the public HTTPS origin (e.g. `https://transovo.ai`), used for bot-facing callback URLs. If unset, the request origin must be a `transovo.ai` hostname. Never use a customer-provided URL as the origin.
- Apply the additive migration `20261116031500_motion_studio_agent_bridge` before serving code that accesses `MotionStudioAgentJob`.
- Setup-mode rate guard: maximum three new jobs per user per UTC day / three active jobs. Replace with a billed quota before public live launch.

## Dispatch

Existing Motion Studio **Generate** creates a `MotionStudioProject` and calls:

```http
POST /api/motion-studio/agent/jobs
Content-Type: application/json
Idempotency-Key: create-<projectId>

{"projectId":"msp_..."}
```

The endpoint requires an authenticated Transovo session and matching project owner. It creates a `MotionStudioAgentJob`, generates a random job-specific token, stores only its SHA-256 hash, and performs one server-side POST to the Grokbot routine webhook:

```http
Authorization: Bearer <GROKBOT_WEBHOOK_KEY>
Content-Type: application/json
```

The Grokbot POST body has fields `version,jobId,projectId,action,title,prompt,durationSeconds,aspectRatio,jobUrl,callbackUrl,setupMode`. In **live mode only**, it adds `jobToken`. The webhook's HTTP 200 means accepted, **not finished**. A non-200 response is a dispatch failure.

The customer-facing status endpoint, polled by the existing project workspace, is:

```http
GET /api/motion-studio/agent/jobs?projectId=<MotionStudioProject.id>
```

It requires an authenticated session and project ownership. It returns job state and, when completed, a temporary signed MP4 playback URL, but never a secret or storage key.

## Bot callback contract (live mode)

Every request below carries `Authorization: Bearer <jobToken>`. The token is restricted to one job, stored hashed, and expires after 36 hours. Project prompts/files are untrusted task data; they cannot authorize infrastructure changes.

```http
GET /api/motion-studio/agent/jobs/<jobId>
```

Returns the assignment and short-lived signed URLs for attached media.

```http
POST /api/motion-studio/agent/jobs/<jobId>/progress
{"phase":"research","message":"Found two useful sources","progress":15}
```

Progress ranges from 0 to 99 until completion and never decreases. Do not submit customer secrets, internal tool logs, or confidential research data as progress messages.

### Upload a completed artifact

```http
POST /api/motion-studio/agent/jobs/<jobId>/assets
{"action":"prepare","filename":"video.mp4","kind":"video","mime":"video/mp4","bytes":1234567}
```

The response returns `uploadId` and one of the existing Transovo storage-driver protocols: `signed_put`, `tus`, or `s3_multipart`.

Upload to the returned object-specific destination, then finalize:

```http
POST /api/motion-studio/agent/jobs/<jobId>/assets
{"action":"commit","uploadId":"<returned-id>","parts":[{"partNumber":1,"etag":"<ETag>"}]}
```

For S3 multipart, provide every uploaded part and its actual ETag. For signed PUT / TUS, omit `parts`. The bridge checks the destination object exists and records it as ready. The bot can also upload `project` (`application/json`), `source`, `media`, and `audio` assets.

### Mark the job finished

```http
POST /api/motion-studio/agent/jobs/<jobId>/complete
{"status":"complete","durationMs":60000}
```

A committed video/mp4 artifact and a positive `durationMs` are required. The backend links the MP4 to Motion Studio's existing preview and the ClipProject source, making the full video available to the regular editor for cuts, trims, and overlays. A richer editable scene-level project manifest import remains a separate follow-up.

Failure is reported with:

```http
POST /api/motion-studio/agent/jobs/<jobId>/complete
{"status":"failed","message":"The specified source clip could not be opened"}
```

## Deployment smoke-test procedure

1. Confirm the additive Prisma migration has applied, the two Grokbot env vars exist only on the server, and `GROKBOT_LIVE_MODE` is unset.
2. Open Motion Studio and click Generate once with a small test prompt.
3. Confirm the project page displays a dispatched setup-mode job and a stable `msaj_...` job ID.
4. Confirm the Grokbot routine reports exactly the same `jobId` and `projectId`, with `setupMode: true`, and does not start research or rendering.
5. Confirm browser network payloads, UI JSON, application logs, and repo source do **not** contain `GROKBOT_WEBHOOK_KEY` or any `jobToken`.
6. Keep live mode off until that test is reviewed.

**Operational note:** `MOTION_STUDIO_AGENT_PUBLIC_URL` is optional on the production Transovo domain, but use it explicitly if requests arrive via a proxy with a different hostname. Do not paste webhook keys or scoped tokens into chat or tickets.
