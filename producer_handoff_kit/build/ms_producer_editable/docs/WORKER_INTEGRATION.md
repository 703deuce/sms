# Worker integration (Grokbot side)

A **worker** is one Grokbot installation of `ms-producer` (this repo's `producer/` + `schemas/` + `node_modules`, shipped as a
release tarball; see `tests/workerB.mjs::installWorkerB`). Transovo owns scheduling. A worker never polls for work, never
picks or reassigns jobs and never schedules other workers. Several workers may share one Grok plan/account and one machine.

## 1. Lifecycle
```
Transovo creates job (mode, input, assigned worker) ──► calls the worker's webhook routine (jobId + job token)
  routine (agent side)                                  worker process (deterministic, no AI)
  ─ reads plan usage (CheckSubscriptionUsage) ───────►  msp run-job --job <id> --token-file <f> --plan-usage-before f.json
                                                         ├─ GET  /agent/jobs/<id>                     (mode + input)
                                                         ├─ POST /agent/jobs/<id>/events   accepted   (worker, machine, plan)
                                                         ├─ … progress / validation / dependencies / artifact events
                                                         ├─ PUT  /agent/jobs/<id>/checkpoint          (after each scene)
                                                         ├─ POST /projects/<pid>/versions             (publish N+1, write-once)
                                                         ├─ POST /workers/<wid>/usage                 (before/after, durations, failures)
                                                         └─ POST /agent/jobs/<id>/complete
  ─ reads plan usage again, may post a heartbeat with it
```
The job token is job-scoped (the same model as today's Agent Bridge). The worker writes it to a 0600 file, never logs it,
and deletes it after the job. Signed URLs are never printed (`redact()` in `producer/lib/util.mjs`).

## 2. CLI
```
node producer/bin/msp.mjs register   --config worker.json --api <apiBase> --token-file <f>
node producer/bin/msp.mjs run-job    --config worker.json --api <apiBase> --job <jobId> --token-file <f> \
                                     [--plan-usage-before before.json] [--plan-usage-after after.json]
node producer/bin/msp.mjs export     --api <apiBase> --token-file <f> --project <pid> --version <n> --out <dir>
node producer/bin/msp.mjs import-pkg --api <apiBase> --token-file <f> --dir <dir>
```
`worker.json`:
```json
{ "workerId": "wrk_grokbot_B", "planId": "plan_grok_shared_01", "account": { "handle": "acct_rick_grok" },
  "routineId": "rtn_webhook_B", "modes": ["deterministic_render"],
  "cacheDir": "/home/workerb/cache", "workDir": "/home/workerb/work", "maxConcurrentJobs": 1 }
```
Exit code: 0 = completed or rejected (the rejection is reported to Transovo), 1 = failed.

## 3. Modes
| mode | who executes | AI | output |
|---|---|---|---|
| `deterministic_render` | `producer/lib/render-job.mjs` | none (no model client in the code path; jobs carrying a `brief` are refused with `AI_REQUIRED`) | version N+1, or preview stills (`output.stillOnly`), or a dry run |
| `creative_production` | the existing Grokbot production skill session (unchanged) | yes | the worker only writes `creative-handoff.json` with the brief marked `untrusted: true` |

A worker that does not list a mode in `modes` rejects such jobs with `MODE_NOT_SUPPORTED`.

## 4. Deterministic job steps (`deterministicRender`)
1. Schema-check the job input and the edit patch.
2. Load the base version (default: head). Build the candidate version **in memory**.
3. Look up fonts in the storage font index (`GET /fonts/catalog/index`) and metadata for every referenced asset.
4. `render_editable` pre-steps (local, deterministic): portrait grade (`producer/py/grade_portrait.py`) gives a derived
   asset with `derivedFrom` and `op`; auto focal point uses MediaPipe BlazeFace (`producer/py/face_focal.py`).
5. Static validation of every editable scene. Errors stop the job (`rejected`; nothing is published).
6. Dependency analysis (render keys).
7. Layout validation **of all changed scenes before any render**: browser scenes are opened in headless Chrome and
   `__scene.validate()` is called; Python scenes run `render.py --mode measure`.
8. `output.stillOnly`: render one still per changed scene, upload it as `preview_still`, return. No publish.
9. Render the changed scenes (browser: seek per frame, PNG, then x264 High@4.2 or ProRes 4444 alpha; Python: the bundle's
   script). Checkpoint after each scene. A resumed job skips scenes whose renderKey is already done.
10. Re-assemble the master from the declarative recipe (whitelisted ffmpeg filters only, two-pass, High@4.2).
11. Publish N+1 with `changes[]` (edits, dependencies, rerendered, masterReassembled) and `validation`.

## 5. Capabilities (registration)
`PUT /workers/<id>` with `transovo.worker/1`: workerId, machineId (`mch_` + sha of `/etc/machine-id`, so two workers on one box
share it), planId, account, modes, `capabilities.engines`, `fontEngines` counts, limits, runtimeLock, `machine: {cpus, cpuModel, memTotalMb, gpu,
renderSlots}`, `activeJob`, `wakeup: {type: "webhook_routine", routineId}` and softwareVersion. During a job the worker posts
`POST /workers/<id>/heartbeat` with `activeJob` at start and `activeJob: null, lastJob` at the end. Each bundle also declares what it needs (`capabilities` in the bundle doc).
Transovo should only assign a job to a worker whose capabilities cover all bundles in the job.

## 6. Usage report (`POST /workers/<id>/usage`, `transovo.usage/1`)
`{workerId, machineId, planId, jobId, mode, projectId, startedAt, finishedAt, before:{at, cpu{userMs,sysMs,childUserMs,childSysMs}, maxRssKb, loadavg,
memFreeMb, diskFreeMb, cacheMb, aiCallsTotal, planUsage}, after:{…}, planUsageDelta, renderDurationMs, wallMs, aiCalls, status: completed|rejected|failed, failures[]}`.
The worker process cannot read Grok plan usage. The waking routine reads it with CheckSubscriptionUsage and passes it in through
`--plan-usage-before/--plan-usage-after` as `{"usedPercent": 37.2, "window": "weekly", "observedAt": "<ISO>", "resetsAt": "<ISO>", "source": "CheckSubscriptionUsage"}`.
The worker normalizes it to `planUsage {available, usedPercent, window, observedAt, resetsAt, source, planId, ageSec, stale}` (stale after 15 min) and
computes `planUsageDelta {percent, resetBetween}`. Without input, `planUsage.available=false` and a note are sent. Unknown keys are dropped.

## 7. Storage rules for workers
- Cache = content-addressed (`cache/blobs/<sha[:2]>/<sha>`), verified by sha256 on download. It can be deleted at any time.
- Work dirs are scratch. Permanent state lives only in Transovo storage (versions + assets). Nothing permanent stays on a bot computer.
- Bundles are materialized by hard-linking verified blobs. Path escapes in bundle file lists are refused.

## 8. Second worker proof
`tests/workerB.mjs` runs worker B in bubblewrap with uid 2000, its own hostname (`grokbot-worker-b`), its own home, the software from the
release tarball and read-only system runtimes only (`/usr`, `/etc`, `/opt/google`, the Python venvs). The original producer repo,
`/workspace/motion_tests`, worker A's cache and secrets are not visible inside the sandbox. It registers, runs a deterministic job
and publishes a revision. A grep shows that no original local path appears anywhere in its work or cache.
