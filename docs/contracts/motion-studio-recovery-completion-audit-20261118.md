# Motion Studio recovery and completion audit — 2026-11-18

Scope: **finish the six existing systems before beginning any After Effects / EffectCraft-inspired feature work**. This report compares repository code/branch content only; no app deployment, live worker, GPU render or DB migrations were executed as part of this audit.

## 0. Branch inventory

| Branch | Comparison with master | Meaning |
|---|---|---|
| `grokbot/motion-studio-producer-kit-20261117` | 5 commits ahead; 213 changed files | Old producer's source, 14 schemas, simulated Transovo API, runtime, tests, handoff and skill/engine installation kit. **Not on master**. |
| `feat/motion-studio-full-system-20261117` | 234 commits ahead; 70 changed files | Transovo-owned API, portable version store, editor inspector, coordinator and webhook scheduling, scene render queue. **Not deployed or validated**. |
| `fix/motion-studio-full-film-timeline-20261116` | 6 commits ahead; 4 changed files | Separate assembled-master timeline preservation fix. |
| `integration/motion-studio-producer-transovo-20261118` | based on full-system branch | Workbench for fixing contracts and combining safe code. |

Master already contains much of the earlier Motion Studio core, but none of these branches should be described as merged or production-certified.

## 1. Producer-side work found

Read `producer_handoff_kit/BUILD_HANDOFF.md`, `producer_handoff_kit/build/ms_producer_editable/docs/TRANSOVO_INTEGRATION.md`, `.../ENGINE_SUPPORT.md`, `.../WORKER_INTEGRATION.md` and source.

- A full v1 portable document format (`transovo.motion-project/1`) and 14 JSON schemas. Original scenes, file hashes, fonts, stems, assembly recipe, and immutable version history.
- Scene bundle package (`transovo.scene-bundle/1`), editable scene manifests (`transovo.editable-elements/1`), custom engine code, runtime locks and content-addressed IDs.
- Browser scene protocol `ms:1` + `event:hello` / `method:init` / `event:ready` / `setProps` / `seek`. NOT the experimental `protocol/type/nonce` interface initially authored on the Transovo branch.
- Deterministic local rendering `producer/lib/render-job.mjs`, changed-scene selection in `deps.mjs`, master rebuild in `assemble.mjs`, and worker CLI `producer/bin/msp.mjs`.
- Reported Keith two-minute documentary: changed scenes S01/S05 rendered, S02–S04/OV reused, master regenerated, v1 preserved. Reported runtime 346s; no AI.
- Reported live `setProps` 13–27ms and preview/export SSIM ~0.995. 38/38 local validation checks.
- Separate sandbox worker B smoke test with no original machine paths.
- Engine support documented for three.js+GSAP; later ENGINE_SUPPORT.md additionally reports PixiJS and Python OpenCV/FFmpeg tests. It explicitly does not certify CanvasKit, D3, Remotion, Lottie, Blender, Rive, etc.
- Handoff says full suite run one passed 5/12, six causes corrected, run two started then stopped at high Grok weekly usage. Do not equate independent targeted proofs or claim of P10 to a clean full suite.
- The **producer's present code is wired to its own simulator**. Its docs explicitly state no real Transovo API calls/uploads and no paid API calls.

## 2. The six completion workstreams

### A. Production bridge and recovery
Existing app: job webhook and queue, customer questions and answers, revision chat, checkpoints, recovery assets, low-res preview paths. Open:
- Verify 24-hour unanswered prompt expiry (including missing `waitingStartedAt`), job recovery and idempotent answer token rotation under concurrency.
- Verify server-side, not just route page load, dispatch; GET assignment mode for discovered jobs; `.srt` asset upload; successful `revise_video` while an older job awaits input.
- Run a real producer E2E: create → ask customer → resume → upload → complete → revise.

### B. Portable source ownership and live scene edits
App's `motion-studio-portable/1` envelope is **not producer's `transovo.motion-project/1`**. Current app's `publishPortableVersion` accepts `{manifest,theme,overrides}` with `scenes[].bundleAssetId`; producer sends `{baseVersion,document}` with `scenes[].bundle`, `assetRefs`, `master`, `sources`, `runtimeLock`. Need either an explicit lossless adapter or adopt producer's native document as version data. No silent truncation of narration, stems, captions, source clip timing, assembly recipe or editable scene metadata.
- Producer scene bundle holds `editable-elements.json` in assets, not inline `manifest.elements` as app currently expects. Fetch/verify these to construct inspector schema.
- Preserve producer color token `{value,label,designName}` and native font `{faces:[fontId],weight}`. Type-safe validation and source byte integrity are necessary.
- Implement secure scene serving by signed `/_scene/:bundleId/:exp/:sig/:path` or an equivalent validated separate-origin bundle host. App's static `/bundles/:id/index.html` URL is only a placeholder. Enforce CSP, signed asset access and host handshake; tested with the real scene bundle.
- Verify exact `ms:1` postMessage protocol and fallback for non-live scenes. Integration branch adjusts the client to producer handshake but has not been browser-tested.

### C. Deterministic revisions and finished master
Producer expects a `mode:deterministic_render` **whole-project job**, dependency analysis, render of changed scenes, reassembly of all scenes/stems into a fresh master, publication of version N+1, and optional still-only previews.
App currently has a **per-scene** `MotionStudioRenderRequest` queue, producer webhook actions and render output upload. These are not equivalent. Need a proper job adapter with producer's entire base version, change patch, asset service, font service, and version publication. Keep existing per-scene queue if useful but don't substitute it for complete film revisions.
- Implement versioned output update + media registration + refresh of `ClipEditsV2` and full master without dropping custom timeline work.
- Prove multiple edits from different browser sessions and restore previous production.
- Re-run producer full suite and local/production validation before enabling.

### D. Central multi-bot, machine and Grok-plan coordinator
App registry and webhook scheduler exist behind `MOTION_STUDIO_COORDINATOR=1`. Producer worker contract uses `PUT /workers/:id`, `POST /workers/:id/usage`, `POST /workers/:id/heartbeat` and registered modes, engine capabilities, `planId`/`machineId`. App uses `/agent/coordinator/registry`, `/agent/coordinator/report`, `/agent/coordinator` and separate worker auth. Reconcile registration/auth/usage formats.
- Real CheckSubscriptionUsage observations are outside the worker runtime. Use fresh plan-level readings and reservation margins; unknown/stale usage must be handled safely.
- Test machine shared by multiple workers, single Grok plan shared by workers on different machines, failover, replay, lost lease and idempotency. Render jobs consume machine capacity, not Grok usage.
- No producer-side scheduler, no periodic bot polling, no master edits during rollout.

### E. Existing editor and Grokbot-in-the-timeline
Keep `ClipEditsV2` and working Descript-style editor. The edit-from-chat route already exists for AI-created projects. New capability:
- Expose versioned, idempotent **existing editor operations** through a governed tool catalog for Grokbot to discover and run during revision (not during from-scratch filmmaking). Audit the backend implementations of the stated 300+ UI tools; UI buttons are not automatically callable APIs.
- Allow a manually assembled timeline to call the same Grokbot revision route, with all clips, sources, effects, tracks and the selected time range intact.
- Preserve manual edits and avoid rebaking/replacing every clip with an incomplete source. Integration branch now imports agent scene placements as cuts in the full authoritative master, not partial `sourceSegments`, and upgrades stale imported timelines with `motionStudioImportVersion:2`. End-to-end tests still required.

### F. Delivery, formats, brands, UI and QA
- Verify real 16:9 / 9:16 / 1:1 and GIF render outputs; customer brand kits, fonts, image replacement, SVG safety (allow normal XML xmlns while rejecting scripts), correct not-found on delete, captions/SRT and the Motion Studio editor's Text track.
- Ensure live preview plays the *whole film*, not just one scene; displayed scene state and production output must match. Keep existing editor accessible during ongoing production.
- Current uploader and bridge use different naming/IDs and signed upload protocols from the producer's simulated `POST /assets`, SHA lookup and font endpoints. Implement a secure adapter rather than configuring the producer to call non-existent routes.
- Independent worker A → worker B cold restore using only stored assets, zero original paths, and multi-revision/QA snapshots.

## 3. Producer simulator contract vs Transovo current endpoints

| Producer calls | Transovo currently has | Work |
|---|---|---|
| `POST /assets`, SHA lookup, `GET /assets/:id` | `POST /agent/jobs/:id/assets` and scoped signed artfacts | Adapter required; content-addressed ID and SHA verification |
| `GET/POST /projects/:id/versions`, `GET .../:n` | `/projects/:id/portable` GET/PATCH/POST | Lossless version document adapter and master publication required |
| `POST .../scenes/:id/session` | `/projects/:id/portable/assets` | Create signed isolated frame session; never expose a raw unsigned source path |
| `POST /projects/:id/preview-assets` | no compatible producer endpoint | New-font/image signing and metadata |
| `GET/PUT /fonts/catalog/:engine` | none | Engine-native content-addressed font catalogs |
| `POST /agent/jobs/:id/events` | progress/checkpoint/complete APIs | Event route for validation and per-scene artifact provenance |
| `PUT /workers/:id`, usage, heartbeat | `/agent/coordinator/registry`, report | Adapter for producer worker schema and authentication |
| `GET /_scene/.../_blob/...` | placeholders and signed storage URLs | Isolated scene origin host and content integrity |
| Render complete: new master version | per-scene `MotionStudioRenderRequest` | Whole-project deterministic job and `ClipEditsV2` resync |

## 4. Safe completion order

1. Preserve the producer kit as source and do not delete machine data. Its `README_START_HERE.md` has instructions for another bot, **not** instructions authorizing this audit process to create agents or handle secrets.
2. Run old producer suite `node tests/run_all.mjs` on a suitable, non-production machine, revalidate 10 proofs, fix regressions and record pass/fail. Never consume unknown subscription budget without checking it.
3. Align the lossless project-version and asset APIs first (native schema from producer or tested adapter), then live scene host and postMessage.
4. Connect whole-project deterministic render and full master update; follow with imported editor timeline, captions and existing AI revision chat.
5. Connect shared worker/plan/machine scheduler with source-specific capability filters, usage and recovery.
6. Run real integration E2E and all format/brand and provenance tests; only then consider merging and enabling feature flags.
7. After these systems are green, begin an independent After Effects/EffectCraft exploration, starting with property tree/effect registry/animation presets; do not change the current source-bundle production engine.

## 5. Hard gates and limitations

- **No test execution on the old producer box through this GitHub-only audit**; code and docs were inspected remotely, not run.
- **No live database migration or production deploy**. Do not merge to master or enable new dispatcher by default.
- Preserve old source, all media and the existing human editor. Any `.aep` reader or third-party code must be separately licensed and verified.
- Gate rollout on engine-accurate previews, stored asset SHA verification, exact source and master round trips, and no regressions in `ClipEditsV2`.
