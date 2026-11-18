# Motion Studio integration implementation / execution handoff — Nov 18, 2026

## Scope and safety

This branch implements Transovo app-side infrastructure for native producer project documents, no-AI whole-film jobs, shared worker capacity, scene previews and the first native editor tools. **It is not deployed, master has not been updated, and no real producer integration or live rendering test has passed.** GitHub remote edits alone do not prove it compiles. Keep the current production system unchanged until the gates below are met.

Old producer source is preserved on `grokbot/motion-studio-producer-kit-20261117`. Its full-suite rerun was stopped; it was previously connected to a local simulator only. The new app-side branch does **not** contain the producer's live engine installations.

## App-side changes on this branch

1. Future-compatible, opt-in `transovo.motion-scene-graph/1` with parent groups/compositions, ordered effects, keyframes, easing, engine component references; existing `transovo.editable-elements/1` and `ClipEditsV2` not replaced.
2. Lossless producer adapter: `transovo.motion-project/1` retained inside `motion-studio-portable/1.producerDocument`, plus content-addressed native ID → tenant-scoped asset alias map. All producer master/assembly/stem/font records retained.
3. Registered producer source fonts, images and bundle uploads with verified SHA-256 and completed upload size, with exact source metadata required on publication. Native producer requests need `document`, `assets` (with `storageId`) and per-scene `bundles` (with extracted verified editable-elements metadata). Unsupported or missing material is rejected.
4. Project-scoped immutable publication with optimistic base version, source-job idempotency and separate customer edit provenance.
5. Whole-project no-AI job `MotionStudioDeterministicJob`, source/version/asset delivery, renderer capability matching, leases, retries, new master artifact registration and editor project source update.
6. Existing creative production queue, scene preview renderer queue and whole-film queue now all count physical machine slots together. Paid AI jobs fail closed if weekly plan usage is unknown, >15 minutes stale or lacks future reset time.
7. Authenticated Grokbot tool discovery and optimistic ClipEditsV2 updates for initial safe text, split, music and FX operations. **This is a limited tool set, not full UI parity.**
8. Full-film timeline import correction preserves authoritative master MP4 and existing customer overrides.
9. Separate, explicitly configured cross-origin scene host with signed short-lived URLs, sandboxed iframe and per-file SHA-256 source checks. Never serve arbitrary scene HTML on the main Transovo origin.

## New routes

| Route | Caller | Operation |
|---|---|---|
| `POST /api/motion-studio/agent/jobs/:id/portable` | active creative producer job bearer | Publish native `{document,assets,bundles}` or existing portable version |
| `GET /api/motion-studio/projects/:id/portable/scene-session?versionId=&sceneId=` | existing customer auth | Mint signed cross-origin scene URL, original asset links and native font records |
| `GET /api/motion-studio/_scene/:projectId/:versionId/:bundleId/:expires/:sig/*` | public path capability **on dedicated scene host only** | Serve whitelisted source file from immutable bundle |
| `POST /api/motion-studio/projects/:id/portable/render-project` | customer | Enqueue full-project no-AI render (`{versionId,idempotencyKey}`) |
| `GET /api/motion-studio/projects/:id/portable/render-project/:jobId` | customer | Read render state and published version |
| `GET /api/motion-studio/agent/deterministic-jobs/:id?workerId=&leaseId=` | registered worker bearer | Read source and native `transovo.motion-job/1` input |
| `POST /api/motion-studio/agent/deterministic-jobs/:id/assets` | registered worker bearer | `{workerId,leaseId,action:'prepare'/'commit',...}` |
| `POST /api/motion-studio/agent/deterministic-jobs/:id/report` | registered worker bearer | `{workerId,leaseId,status:'running'/'failed'/'complete',...}`; on complete supply native `document,assets,bundles,durationMs` |
| `GET/POST /api/motion-studio/agent/jobs/:id/editor-tools` | active creative job bearer | Catalog+snapshot / version-checked operator execution |
| `POST /api/motion-studio/agent/coordinator` | coordinator admin | Dispatch/sweep existing queues and new whole-film queue |

### Required environment and deploy topology (not configured here)

- App: `MOTION_STUDIO_COORDINATOR=1`, existing coordinator keys, worker registry, live producer webhook, storage service.
- Dedicated source host: `MOTION_STUDIO_SCENE_HOST_ORIGIN=https://<separate-preview-host>` on server and `NEXT_PUBLIC_MOTION_STUDIO_SCENE_HOST_ORIGIN` in browser, with **a separate origin from the main app**, dedicated host routed to the scene API only; `MOTION_STUDIO_SCENE_HOST_KEY` must be ≥32 random characters. `MOTION_STUDIO_AGENT_PUBLIC_URL` must be the main application HTTPS origin; optional `MOTION_STUDIO_SCENE_ASSET_ORIGINS` for signed storage CORS/CSP. Avoid a preview host sharing the app's session cookies; best is a separate registrable domain.
- No production feature flags should be enabled until source-host separation and an actual two-minute browser producer scene are verified.

## CRITICAL OPEN BLOCKER: Old producer simulator client

The old producer worker is **not yet compatible** with the new API. Its unchanged `producer/lib/store-client.mjs` calls:

- `POST /assets`, `GET /assets/:nativeId`, `POST /assets/lookup` etc.
- `GET /projects/:id/versions`, `GET /projects/:id/versions/:n`, `POST /projects/:id/versions`.
- `GET /fonts/catalog/index`, `PUT /fonts/catalog/:engine`.
- `GET/POST/PUT /agent/jobs/:id/...`, `PUT/POST /workers/:id/...`.

The new worker instead gets a **registered worker credential, job ID and lease**. This release requires a producer-side transport adapter that:
1. Builds an `StoreClient`-compatible facade whose `getVersion/listVersions` resolve from the new GET job's `producerDocument`; every original `fnt_ / ast_ / bnd_` lookup must return the original SHA, byte size, MIME, and freshly signed URL via `producerAssetMap`.
2. Uploads changed assets using the leased `/assets` endpoint, tracks returned tenant upload IDs while preserving content-hashed producer IDs and the SHA mapping.
3. Handles FontCatalog from original stored `fontRecords` (and adds user-selected fonts only with registered source assets).
4. Replaces simulator `publishVersion` with a complete `POST /report` final handoff: **new native document + all referenced assets + complete verified scene-bundle descriptions + finished MP4 upload**. No fake final success on uploading individual scenes.
5. Submits heartbeats, stage events and local usage without exposing leases or signed URLs. Uses deterministic engine mode **without calling Grok's generative model**.
6. Supports continuation/retry from prior source version with no local original disk paths.

Do not attempt to run the unmodified old `msp run-job --api https://transovo.ai/api/motion-studio` yet; it will call endpoints that do not exist. No API key should be pasted into chats or source code.

## Acceptance commands — development checkout

In `new-app/`:
```bash
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx tsc --noEmit --pretty false
npx vitest run tests/motion-studio/motion-studio-scene-graph.test.ts \
  tests/motion-studio/motion-studio-producer-project-adapter.test.ts \
  tests/motion-studio/motion-studio-producer-render-job.test.ts \
  tests/motion-studio/motion-studio-editor-agent-operations.test.ts \
  tests/motion-studio/motion-studio-editor-timeline.test.ts
```
Compare type-check results against the same base feature branch. No test results have been recorded yet.

## Required integration proof

1. Register two workers on one machine + two different plan IDs; quotas fresh/unknown/stale cases; no overbooking across three queues.
2. Import one old producer documentary with original SHA, image, font, scene source and stems. Check full 2-minute timeline playback, master correctness, Text and music lanes.
3. Launch live browser scene session on dedicated origin with real `ms-bridge`; verify SDK ready, `setProps`, fonts, scene seek, CSP, fresh signed URLs, and preview frame vs exported frame.
4. Save manual change and publish immutable edit version; run deterministic no-AI job via adapted producer, selective render, complete assembly; original version intact, refreshed master plays to end; editing history preserved.
5. Run failure/retry: expired leases, partial artifact uploads, stale customer version, same callback twice, source-file corruption, fake SHA, missing font, and interrupted master update.
6. Use agent tools against a manual ClipEditsV2 project; concurrent human edits must produce version conflict, never silent overwrite.
7. Verify 9:16, 1:1, 16:9, GIF and brand kits with real producer. Verify no new regressions in the existing clipper/timeline, including SRT and narration.
8. Run the old producer full suite on its actual box: `node tests/run_all.mjs`; record pass/fail, not only targeted proofs.

## Release gate

Never merge into master or deploy this branch merely because it includes these files. **Its integration code is not certified**. The remaining live producer-side transport adapter and execution testing are mandatory. Only after build + scoped tests + security + full E2E green should deployment be considered.
