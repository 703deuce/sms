# Motion Studio full-system integration contract v1 — Transovo side

Status: **implementation in progress; unvalidated branch, disabled by default**.
Owner: Transovo controls durable storage, editor, customer history, scheduling, plan/machine accounting and authorized file access. Grokbot controls creative scene production, source bundle export, engine-specific font enumeration and deterministic scene rendering.

## Compatibility with the producer proof of concept

The producer's `editable-elements.json`, `theme.json`, `ms-props.js`, and `render.mjs` remain the scene authorities. No Transovo font preset registry and no forced layout templates. Scene source remains custom authored. The saved element manifest declares allowed property tiers; anything not declared remains protected.

Transovo's storage-level manifest wrapper uses `format: "motion-studio-portable/1"`:

```json
{
  "format": "motion-studio-portable/1",
  "projectId": "msp_project",
  "assets": [
    {"id":"a-scene-bundle","kind":"bundle","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
  ],
  "scenes": [{
    "id":"S01","engine":"threejs","runtime":"chrome-156",
    "bundleAssetId":"a-scene-bundle",
    "bundleSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "manifest":{"elements":[
      {"id":"title","kind":"dom","properties":{
        "text":{"tier":"live_editable","type":"text","maxChars":30},
        "color":{"tier":"live_editable","type":"color"}
      }}
    ]}
  }]
}
```

The wrapper is a Transovo ownership envelope; the producer may retain its own internal bundle manifest. Backend validation requires every listed asset to be a registered **ready StudioAsset in the same project**, and each scene bundle to be among those assets. No local paths, signed URLs or credentials belong in the manifest. Hash strings are recorded but **content hash verification against storage bytes still needs production validation**.

The scheme supports `live_editable`, `render_editable`, `ai_editable` and `protected`. `ai_editable` requires a new creative job; it cannot be changed through deterministic patches. `protected` cannot be patched. The producer resolver is responsible for preserving animation, auto-fitting, contrast, token derivation, cropping and layout behavior.

## Portable upload lifecycle

1. Producer uploads every source bundle, original scene media, scripts, fonts and dependencies through the **existing** `POST /api/motion-studio/agent/jobs/:id/assets` prepare/commit flow. Each committed file receives a StudioAsset ID matching the returned uploadId. The exact MIME/size limits of that upload API apply.
2. While the job is still active, the producer calls `POST /api/motion-studio/agent/jobs/:id/portable` using the **existing job bearer**, with `{manifest,theme,overrides}`. The server assigns `sourceJobId`, validates asset ownership and atomically commits the next immutable version.
3. Customer GET `/api/motion-studio/projects/:projectId/portable` returns latest version or `?versionId=...` for history.
4. Customer PATCH to the same endpoint: `{baseVersionId,sceneId,elements:{title:{text:"NEW TITLE"}},themePatch:{colors:{primary:"#123456"}}}`. The server validates properties and uses an atomic project-row lock. A conflicting editor version yields HTTP 409; the earlier version remains intact.
5. No file in the producer's local computer is authoritative after publication. Bots must be able to reconstruct from signed, scoped asset URLs.

Theme tokens may be stored as raw hex values or producer-owned metadata objects such as `{value,label,designName}`. Transovo updates `value` without discarding the metadata. Font selection is governed by the producer's engine-native declarations and available bundled resources.

## Deterministic scene renders

Customer POST `/api/motion-studio/projects/:projectId/portable/render` with `{versionId,sceneId,idempotencyKey,patch:{}}`; reads/status use `GET .../render/:renderId`. Queued render requests do not consume Grok AI allowance, but they do consume machine capacity.

When `MOTION_STUDIO_COORDINATOR=1`, Transovo sends a worker webhook:

```json
{"action":"motion_studio_render","renderRequestId":"msrr_...",
 "sceneId":"S01","versionId":"mspv_...","workerId":"worker-1",
 "leaseId":"<ephemeral>","requestUrl":"https://transovo.example/api/motion-studio/agent/scene-renders/msrr_..."}
```

Authenticated worker (using its **own registered credential**, not the webhook secret) fetches:

- `GET /api/motion-studio/agent/scene-renders/:id?workerId=...` for pinned theme, overrides, scene manifest, and temporary asset URLs.
- `POST /api/motion-studio/agent/scene-renders/:id/assets` with `{workerId,leaseId,action:"prepare",filename,mime,bytes}`, followed by `commit` with optional multipart ETags.
- `POST /api/motion-studio/agent/scene-renders/:id` with `{workerId,leaseId,status:"complete",resultAssetId}`; `running` renews the five-minute lease, `failed` records a failure.

A successful result must correspond to a ready output asset uploaded for that exact render request. Customer status responses return signed 15-minute URLs only after completion.

**Full revised master assembly and update of the existing ClipEditsV2 project from these deterministic scene outputs still require end-to-end work.** Existing import of `project.json` remains in place; never drop its per-track and per-element data.

## Coordinator: bot, machine, plan

- `MotionStudioProducerWorker`: webhook, capabilities, machineId, planId, per-worker concurrency.
- `MotionStudioWorkerMachine`: physical render capacity shared across AI and deterministic jobs.
- `MotionStudioWorkerPlan`: real weekly usage percentage, observation timestamp, reset time, reserved capacity and per-plan AI concurrency.
- `MotionStudioWorkerAssignment`: scoped job lease and observed usage before/after.

Configure with the **admin bearer**:
- POST `/api/motion-studio/agent/coordinator/registry` with `kind:"machine" | "plan" | "worker"`.
- GET that URL to inspect worker and plan records and active assignments. The credential hash is excluded from the response. Registering a worker returns its credential **once**, and registering again rotates it.
- A worker must declare `motion-studio-produce` for creative jobs; `motion-studio-render` or `render:<engine>` for deterministic scene rendering.

A customer job creation triggers dispatch. Finished jobs trigger new dispatch. A server-owned cron calls `POST /api/motion-studio/agent/coordinator` with `{"sweep":true}` and the admin bearer to expire lost leases, expire unanswered questions, and retry eligible work. **No Grokbot polling and no dedicated bot-computer dispatcher.**

Webhook delivery uses `MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY` and a configured HTTPS endpoint. Incoming worker usage/progress uses `POST /api/motion-studio/agent/coordinator/report` with its own registered bearer.

Usage report accepts `{workerId,jobId,leaseId,status,usageMoment:"before"|"after",weeklyUsagePercent,observedAt}`. Plans use the newest observation timestamp; concurrent reservations share one plan and machine. The percentage may be rounded or influenced by activity outside Transovo, so keep reserve margins and timestamps.

## Isolated browser preview

The customer editor's manifest-driven inspector lives in the existing Motion Studio workspace. It can edit the original text, colors, fonts, images and allowed parameters without rewriting animation code; protected fields are excluded.

For live-capable scenes, set **`NEXT_PUBLIC_MOTION_STUDIO_SCENE_HOST_ORIGIN`** to a separate HTTPS host that serves unpacked, pinned bundle assets under `/bundles/:bundleAssetId/index.html`. The host must be deployed separately, enforce restrictive CSP/no arbitrary external connections, and wait for the versioned `transovo-motion-scene/1` postMessage `init` containing scoped assetUrls before starting the scene. It responds with `ready`; receives `setProps` and `seek`. Never use `allow-same-origin` on the iframe, and never execute arbitrary producer JS inside the main Transovo application.

Signed input URLs come from workspace-scoped GET `/api/motion-studio/projects/:projectId/portable/assets?versionId=...`.

If the host is not configured or the device cannot run the scene, the existing MP4/proxy editor remains available. **Live preview is an integration hook until the producer bundle host and browser contract have been validated together.**

## Rollout and boundaries

- Existing no-login Motion Studio testing remains unchanged; it must not be opened to untrusted public paid production without tenant auth.
- `MOTION_STUDIO_COORDINATOR=0` by default. Do **not** enable both pull queue and webhook coordinator modes.
- Require separately generated secrets `MOTION_STUDIO_COORDINATOR_ADMIN_KEY`, `MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY` and legacy-mode `MOTION_STUDIO_JOB_TOKEN_SECRET`. Do not reuse Grok webhook key as the job token derivation secret.
- Run all additive migrations and regenerate Prisma before testing.
- Test old legacy webhook mode, pull queue mode, coordinator-only mode, multi-machine capacity, account sharing, worker failure, lease expiry, usage resets, duplicate requests, concurrent edits, and no-AI renders with production storage.
- Test real Bot 1 → Bot 4 handoff with Bot 1's local files unavailable.

Until those end-to-end tests pass, this new implementation is **not production-certified and must not be deployed to public users**.
