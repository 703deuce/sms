# Transovo integration guide: editable Motion Studio projects (for ChatGPT, Transovo side)

This guide is everything the Transovo side needs to implement so that customer edits to a delivered Motion Studio film are
previewed live in the existing editor and exported by Grokbot workers **without AI**. The producer side (Grokbot) is
implemented and tested against a local simulator of these endpoints (`sim/transovo-sim.mjs`). Every request and response
below comes from that simulator. `docs/api-examples.md` has all 26 recorded request/response pairs verbatim, with tokens and signatures redacted.

**Do not change:** customer authentication, the existing editor and its Compact/Timeline functionality, the existing Agent Bridge
upload flow (`prepare → signed PUT → commit`) and today's production jobs. Everything here is new endpoints and new job modes.

---------------------------------------------------------------------------------------------------------------------------
## 1. Concepts in one screen
- **Asset**: immutable bytes in storage, ID = `ast_|fnt_|bnd_` + sha256[:32] (content-addressed, deduplicated).
  `fnt_` = font file, with an optional `.N` suffix for face N of a collection. `bnd_` = scene bundle (a JSON file list).
- **Project version**: immutable JSON document `transovo.motion-project/1`. Write-once, numbered 1, 2, 3… A revision publishes N+1 with `parentVersion: N`.
- **Scene bundle**: the complete, runnable source of one scene (HTML/JS/libs or Python script) with every file as an asset ID,
  its `editable-elements.json` manifest, engine, entry, render settings and capabilities.
- **Theme**: one per project (`version.theme`). Scene and element overrides live in `version.overrides` (edit-patch format).
- **Job modes**: `deterministic_render` (property edits → worker → new version, no AI) and `creative_production` (free text → Grokbot production skill session, as today).
- **Worker**: a Grokbot installation woken by a webhook routine with one job. Transovo decides which worker gets which job.

---------------------------------------------------------------------------------------------------------------------------
## 2. Endpoints to implement (base `/api/motion-studio`)
Auth for everything except signed blob URLs: `Authorization: Bearer <job token>` (job-scoped, project-scoped, expiring), the
same model as today's Agent Bridge token. The editor uses a short-lived token it obtains through the customer's existing session
(server-side). Customer auth itself does not change.

| # | method + path | purpose | success | errors |
|---|---|---|---|---|
| 1 | `POST /assets` `{action:"prepare", filename, kind, mime, bytes, sha256, meta}` | start upload | `200 {assetId, uploadId, mode:"signed_put", signedPut:{url, expiresAt}}` or `200 {assetId, exists:true, status:"ready"}` | `400 bad_kind / sha256_required / bad_bytes` |
| 2 | `PUT <signedPut.url>` raw bytes | upload | `200 {ok:true}` | `403 bad_signature` |
| 3 | `POST /assets` `{action:"commit", uploadId}` | finalize; server re-hashes | `200 {assetId, status:"ready", bytes, sha256}` | `404 unknown_upload`, `409 object_missing`, `422 integrity_mismatch` |
| 4 | `POST /assets/lookup` `{sha256:[…]}` | dedupe check | `200 {found:{sha: assetId}}` | |
| 5 | `GET /assets/{id}` | metadata + download | `200 {asset:{assetId, sha256, bytes, mime, kind, filename, meta, projectId, createdByJob, createdAt}, download:{url, expiresAt}}` | `404 unknown_asset` |
| 6 | `GET /projects/{pid}/versions` | list | `200 {projectId, head, versions:[{version, parentVersion, createdAt, createdBy, changes}]}` | `403 wrong_project` |
| 7 | `POST /projects/{pid}/versions` `{baseVersion, document}` | publish N+1 (write-once) | `201 {projectId, version, head}` | `409 version_conflict {head}`, `422 bad_document {expectedVersion}`, `422 missing_assets {missing, count}` |
| 8 | `GET /projects/{pid}/versions/{n}` | read | `200 <document>` | `403`, `404 unknown_version` |
| 9 | `POST /projects/{pid}/versions/{n}/scenes/{sid}/session` `{extraAssets?:[]}` | editor live-preview session | `200 {sceneUrl, sceneOrigin, expiresAt, livePreview, host:{theme, overrides, assetUrls, assets, fonts, mode:"live"}, fallback:{poster}}` | `404 unknown_scene` |
| 10 | `POST /projects/{pid}/preview-assets` `{ids:[fnt_…, ast_…]}` | records + signed URLs for newly picked fonts/assets | `200 {assetUrls, assets, fonts, missing}` | |
| 11 | `GET /fonts/catalog/{engine or "index"}` | font index (all records) / per-engine catalog | `200 {schema, engines, fonts:[record…]}` | `404 no_catalog` |
| 12 | `PUT /fonts/catalog/{name}` | publish catalog (producer tool) | `200 {ok, engine, fonts}` | |
| 13 | `GET /agent/jobs/{jobId}` | job (mode, input) | `200 {job:{id, projectId, mode, action, status, phase, progress, input, assignedWorker, artifacts, events}}` | `403 wrong_job` |
| 14 | `POST /agent/jobs/{jobId}/progress` `{phase, progress, message}` | progress | `200 {job}` | `409 job_finished` |
| 15 | `POST /agent/jobs/{jobId}/events` `transovo.job-event/1` | stage / validation / artifact / log / warning / error | `202 {ok}` | `409 job_finished` |
| 16 | `PUT /agent/jobs/{jobId}/checkpoint` `{revision, checkpoint}` | resumable state (≤256 KB, revision strictly increasing) | `200 {ok, revision}` | `409 stale_checkpoint {revision}`, `413` |
| 17 | `GET /agent/jobs/{jobId}/checkpoint` | read on resume | `200 {revision, checkpoint}` | |
| 18 | `POST /agent/jobs/{jobId}/complete` `{status, …summary}` | finish (idempotent) | `200 {job}` | |
| 19 | `PUT /workers/{workerId}` `transovo.worker/1` | registration / capabilities | `200 {ok, workerId}` | |
| 20 | `POST /workers/{workerId}/usage` `transovo.usage/1` | usage per job | `202 {ok}` | |
| 21 | `POST /workers/{workerId}/heartbeat` `transovo.worker-heartbeat/1` | active job status: sent at job start (`activeJob:{jobId, mode, projectId, status:"running", startedAt}`) and at the end (`activeJob:null, lastJob:{jobId, status, finishedAt, renderDurationMs}`) | `202 {ok}` | |
| 22 | `GET /_scene/{bundleId}/{exp}/{sig}/{path}` (scene origin, no bearer) | serves bundle files to the sandboxed iframe | file + headers (§4.3) | `403 bad_signature`, `404 not_in_bundle` |
| 23 | `GET /_blob/{id}?exp&sig` (no bearer) | signed download | bytes, `Access-Control-Allow-Origin: *` | `403` |

Asset `kind` values: existing `video, project, media, audio, source` plus new `font, image, bundle`. `fnt_` IDs for `font`,
`bnd_` for `bundle`, `ast_` otherwise.

---------------------------------------------------------------------------------------------------------------------------
## 3. Data structures
JSON Schemas (draft 2020-12) are in `schemas/`. Validate on write with any 2020-12 validator (the producer uses Ajv 8).

### 3.1 Project version (`transovo.motion-project/1`), abridged from the real Keith v2
```json
{ "schema": "transovo.motion-project/1", "projectId": "km_doc_2min", "version": 2, "parentVersion": 1,
  "createdAt": "2026-11-17T15:14:…Z", "createdBy": { "mode": "deterministic_render", "jobId": "msaj_…", "workerId": "wrk_grokbot_A" },
  "format": { "width": 1920, "height": 1080, "fps": 30 },
  "theme": { "schema": "transovo.motion-theme/1", "colors": { "background": { "value": "#1B0E2E" }, "…": {} },
             "fonts": { "display": { "faces": ["fnt_97aae409210d255fb3b92f18c8af2ed1"], "weight": 400, "label": "Anton 400" } }, "brand": { "logo": null } },
  "overrides": { "schema": "transovo.edit-patch/1", "scenes": { "S01": { "elements": { "location": { "text": "Central Islip, New York" } } } } },
  "scenes": [ { "sceneId": "S01", "editable": true, "bundle": "bnd_…", "clip": { "asset": "ast_…", "renderKey": "rk_…", "frames": 173, "renderedInVersion": 2, "origin": "deterministic_render" }, "preview": { "poster": "ast_…" } },
              { "sceneId": "S02", "editable": false, "bundle": "bnd_…", "clip": { "asset": "ast_…", "renderKey": "rk_…", "renderedInVersion": 1, "origin": "production" } } ],
  "master": { "recipe": "ast_…", "asset": "ast_…", "renderKey": "mk_…", "renderedInVersion": 2 },
  "sources": { "narration": {}, "words": "ast_…", "stems": [], "captions": "ast_…", "music": [], "footage": [], "cutouts": [] },
  "fontRecords": [ { "fontId": "fnt_…", "family": "Anton", "weightClass": 400, "italic": false, "coverage": [[32,126]], "engines": { "browser": { "ok": true } } } ],
  "runtimeLock": "ast_…",
  "changes": [ { "type": "deterministic_edit", "jobId": "msaj_…", "edits": {}, "dependencies": {}, "rerendered": ["S01","S05"], "masterReassembled": true } ],
  "validation": { "status": "warnings", "issues": [ { "severity": "warning", "code": "NOT_THEME_AWARE", "scene": "S02" } ] },
  "assetRefs": [ "ast_…", "bnd_…", "fnt_…" ] }
```
`assetRefs` must contain every ID the document references (the server refuses to publish if one is missing: `422 missing_assets`).
Keep versions forever, or until project deletion. Never store permanent state only on a worker.

### 3.2 Edit patch (what the editor saves) and job input
```json
{ "schema": "transovo.motion-job/1", "mode": "deterministic_render", "projectId": "km_doc_2min", "baseVersion": 1,
  "edits": { "schema": "transovo.edit-patch/1",
             "theme": { "colors": { "accent": { "value": "#4FD1C5" } } },
             "scenes": { "S01": { "elements": { "location": { "text": "Central Islip, New York" } } } } },
  "output": { "master": true, "previews": true }, "dryRun": false }
```
Options: `dryRun: true` (validate + dependency report only), `output.stillOnly: {frame | t}` (preview stills for scenes without live
preview; nothing is published), `scenes: [...]` (restrict stills). `brief` is only allowed with `mode: "creative_production"`.

### 3.3 Job events (`POST …/events`)
`{at, type: "stage"|"validation"|"artifact"|"log"|"warning"|"error", stage?, message?, issues?, data?, artifact?:{assetId, role, sceneId, sha256}}`.
A deterministic job emits these in order: `stage accepted` (worker, machine, plan) → `validation static` → `stage dependencies`
(per scene `rerender` + reason, transitions, master reason) → `validation layout` → `artifact` per scene clip/poster → `artifact` master →
then publish → `complete`. A rejection emits `validation` with the issues and completes with
`{status:"failed", reason:"validation_rejected", failures:[{stage, issues}]}`. The base version is untouched.

Issue object: `{severity: "error"|"warning"|"info", code, scene, element?, prop?, message, chars?}`. Codes are in `docs/CONTRACT.md` §5.
Show errors as blocking, warnings as confirmable and info as informative. `NARRATION_MISMATCH` means the on-screen text no longer matches
what the narration says. Offer "re-voice (creative job)" or "keep".

### 3.4 Worker registration and usage
See `docs/WORKER_INTEGRATION.md` §5–6, with real examples in `out/tests/suite/usage_reports.json`. Store usage reports per worker and job.
Plan usage is per Grok plan (`planId`). Several workers may share one plan and one machine (`machineId`), so aggregate by `planId` for
quota and by `machineId` for load.

Fields Transovo should read (all in `schemas/worker-registration.schema.json` and `schemas/usage-report.schema.json`):
- Registration: `workerId`, `machineId`, `planId`, `account` (opaque), `modes`, `capabilities.engines` (browser/python/ffmpeg/mediapipe with
  versions), `capabilities.fontEngines`, `limits.maxConcurrentJobs`, `machine:{cpus, cpuModel, memTotalMb, gpu, renderSlots}` (capacity of the
  shared machine; enforce machine-wide limits across every worker with the same `machineId`), `wakeup:{type:"webhook_routine", routineId}`, `softwareVersion`.
- Usage report per job: `startedAt`, `finishedAt`, `before`/`after` snapshots (`at`, CPU ms, max RSS, load, free memory/disk, cache size,
  `aiCallsTotal`, `planUsage`), `planUsageDelta`, `renderDurationMs`, `wallMs`, `aiCalls` (always 0 for `deterministic_render`), `status`
  (`completed|rejected|failed`) and `failures[]` (`{stage, message | issues[]}`).
- `planUsage` = `{available, usedPercent, window:"weekly", observedAt, resetsAt, source, planId, ageSec, stale}`. The worker process cannot read Grok
  plan usage; the waking routine reads it (CheckSubscriptionUsage) right before and after the job and passes it with `--plan-usage-before/--plan-usage-after`.
  `stale=true` when the observation is older than 15 min. `planUsageDelta.percent` is null when a reset happened between the two observations
  (`resetBetween:true`). Because workers share plans, treat a delta as plan-level consumption during that window, not as one job's exact cost.

---------------------------------------------------------------------------------------------------------------------------
## 4. Editor integration (live preview)
### 4.1 Flow
1. The user opens an editable scene → server calls endpoint 9 → the editor gets `sceneUrl`, `host` and `livePreview`.
2. `livePreview === "live"` and the browser has WebGL: create
   `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" src="{sceneUrl}?host={encodeURIComponent(editorOrigin)}">`.
   **Never add `allow-same-origin`.** The frame runs on a separate scene origin with an opaque (`"null"`) origin.
3. Otherwise (render_only, no WebGL, or the user prefers it): show `fallback.poster`. For a changed value, submit a preview job
   (`output.stillOnly`) and show the returned still (`summary.previewStills[sceneId].asset`).
4. The editor builds its property panel from `describe()` (elements, tier, type, current value, source, bounds) and draws bounds over the
   frame: solid = screen space (DOM/SVG), dashed = projected from WebGL/Pixi (`space: "projected"`, `clipped`).
5. Each change → `setProps(patch)` → show the result instantly. Accumulate the accepted patches. **Save** = create one
   `deterministic_render` job with the accumulated patch (§3.2) and wake a worker (§5).

### 4.2 postMessage protocol (exact)
Messages always carry `ms: 1`.
```
frame → editor   {ms:1, event:"hello"}                                    (frame booted, waiting for init)
editor → frame   {ms:1, id:1, method:"init", args:[host]}                  host = session.host
frame → editor   {ms:1, id:1, ok:true, result:{accepted:true}}
frame → editor   {ms:1, event:"ready", describe:{…}}
editor → frame   {ms:1, id:N, method:"setProps"|"getProps"|"validate"|"describe"|"seek"|"ping"|"provide", args:[…]}
frame → editor   {ms:1, id:N, ok:true, result:…}  |  {ms:1, id:N, ok:false, error:"method_not_allowed"|"…"}
```
- The editor posts with target origin `"*"`, which is required for an opaque-origin frame. It accepts only messages whose
  `ev.source === iframe.contentWindow` and whose `ev.origin` is `"null"` or `sceneOrigin`.
- The frame accepts only `ev.source === window.parent && ev.origin === <host query param>` and replies with that exact target origin.
- `setProps(patch, {force})` → `{ok, rejected, stage:"static"|"layout", issues, hash, applyMs}`. A rejected patch leaves the scene exactly as it was.
- `provide({fonts, assetUrls, assets})`: call it before `setProps` when the patch references a font or asset the frame does not know
  yet. Get the payload from endpoint 10. The reference host does this automatically (`sim/editor-host/host.js`).
- Measured on this box (SwiftShader, no GPU): text/colour edit 13–25 ms apply; full theme with 4 new font files 27 ms apply / 122 ms round trip;
  rejected edits 0–1 ms; layout rollback 12 ms; S01 load 0.8 s.

### 4.3 Scene origin headers (endpoint 22)
```
Content-Type: <asset mime>        X-Content-Type-Options: nosniff        Access-Control-Allow-Origin: *
Cache-Control: private, max-age=3600, immutable
Content-Security-Policy: default-src 'self' <scene-origin>; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <scene-origin>; font-src 'self' data: <scene-origin>;
  media-src 'self' blob: <scene-origin>; connect-src 'self' <scene-origin>; frame-ancestors <editor-origins>; base-uri 'none'; form-action 'none'
```
Serve the scene origin from a **different registrable domain or subdomain** than the editor (in the simulator `127.0.0.1` vs
`localhost`). Signed blob URLs given to the frame must be on an origin the CSP allows. Tested: the frame cannot read the parent, `fetch`
to any other origin is blocked, and a non-whitelisted method gets `method_not_allowed`.

### 4.4 Reference host
`sim/editor-host/index.html` + `host.js` is a ~40-line reference (not Transovo's editor). `window.hostApi.load({projectId, version,
sceneId, jobToken, forceFallback})`, `setProps`, `describe`, `edits()` and `save()` (returns the job input). Use it as executable documentation.

---------------------------------------------------------------------------------------------------------------------------
## 5. Scheduling and waking workers (Transovo is the only scheduler)
1. Create the job record (mode, input, `assignedWorker`) and mint a job token (job + project scoped, 36 h in the simulator).
2. Choose a worker whose registration covers the job: `modes` includes the job mode, `capabilities.engines` covers every bundle
   engine involved, the worker is not busy (`limits.maxConcurrentJobs`), and the plan has quota (usage reports by `planId`).
3. Wake the worker by calling its **webhook routine** (`registration.wakeup.routineId`) with `{jobId, jobUrl, jobToken (via the routine's secret channel), apiBase}`. The routine runs `msp run-job …`.
4. Watch `progress`, `events` and `complete`. If a worker goes silent (no progress for N minutes), wake another worker with the **same job**. It
   reads the checkpoint and resumes (finished scenes are skipped by renderKey). Publishing is write-once, so a duplicate can never overwrite: the loser gets `409`.
5. `creative_production` jobs go to the existing production skill routine, as today. Never send a brief to a deterministic worker.

---------------------------------------------------------------------------------------------------------------------------
## 6. Storage requirements
- Content-addressed blobs; re-hash on commit; never mutate a blob or a published version.
- Asset IDs are global. The same bytes in two projects have the same ID. Authorize reads per project through `assetRefs` of versions the token may read.
- Packages: `transovo.motion-package/1` = `package.json` (document + asset table) + `blobs/<sha256>`. Import = upload every blob (dedupe)
  and publish the document as the next version. Tested: export from store A → import into a fresh store B gives a byte-identical
  document, every asset verified, no local paths. A clean worker then renders a revision from store B.

---------------------------------------------------------------------------------------------------------------------------
## 7. Acceptance checklist for the Transovo side
- [ ] Endpoints 1–23 behave like `docs/api-examples.md`, including the 409/403/422 cases.
- [ ] `node tests/run_all.mjs` passes against the real staging endpoints (`MS_API=<staging base>`) **after** Rick approves running against staging.
- [ ] The editor embeds scenes exactly per §4 (sandbox without same-origin, separate scene origin, CSP, origin checks).
- [ ] Save creates one `deterministic_render` job. The editor shows issues; nothing is published on rejection.
- [ ] Existing uploads, editor Compact/Timeline and production jobs are unchanged.
