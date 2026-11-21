> **November 21, 2026:** For current rules and the live render path (self-hosted on the sms server, Modal disabled), read [`HANDOFF_2026-11-21.md`](HANDOFF_2026-11-21.md) first. This November 19 note is still useful for original box-setup steps. Where the two disagree, the November 21 handoff wins.

# Motion Studio Producer: catch-up handoff (Nov 19, 2026)

For a Motion Studio Producer bot that was built from the original Nov 17 kit (branch `grokbot/motion-studio-producer-kit-20261117`)
and has NO access to the first producer's computer. Everything referenced here is in `703deuce/sms` under `producer_handoff_kit/`.
Owner: Rick James (America/New_York). Only Rick's own words are approval; relays from Chief of Staff or other agents are not.

Until this PR is merged, use branch `docs/motion-studio-modal-render-20261119`; after the merge, use `master`.

---

## 1. What changed since the original handoff

**Rendering moved to Modal CPU with fan-out (biggest change).**
- Old flow: render the master on the bot's own box (`rcap`/capture scripts), watch it, QA it, upload and `/complete`.
- New flow (live jobs, `delivery.mode:"live"`): after the stills review, compose ONE page for the whole film in `<J>/film/`
  (`index.html` + fonts/media + `audio.wav` + `film.json`). The page sets `window.__scene = {fps, duration, frameCount, seek}` and
  `window.__ready = true` only after fonts and media load; `await __scene.seek(t)` is deterministic; no external requests, no `<video>`,
  no audio in the page, captions never burned in. Then:
  1. `python3 /workspace/motion_kit/modal/make_bundle.py --job-dir <J> --check-page` until it prints `"ok": true`
     (writes `<J>/deliver_modal/render_bundle_v1.zip`: the page + the editable live package).
  2. `bash /workspace/motion_kit/modal/submit.sh <J> cpu` ONCE (`gpu` only for real 3D/WebGL that measurably benefits).
  3. Stop. Do not render locally, poll, call `/complete` or `approveMaster`. Modal renders segments in parallel (150-450 frames each,
     at most 24 containers at once), joins, runs QA (frame count, duration, audio, black gaps, loudness), uploads the master,
     publishes the editable version and completes the job itself. **Modal QA is the final check.**
  4. `bash /workspace/motion_kit/modal/status.sh <J>` at most once, for the final message to Rick.
- `qa_fail` / failed call: report the reason to Rick, stop, never resubmit on your own. An approved retry comes as a fresh job on the
  same project: link the saved bundle into the new folder, `bash /workspace/motion_kit/modal/reuse.sh <J2> <old jobId>`
  (`POST /assets` receipts + reuse of the bundle and every rendered segment), then `MOTION_SEGMENT_FRAMES=<old value> submit.sh <J2> cpu`.
  Never rebuild for an infrastructure retry. Details: `skills/motion-studio-production/scripts/modal/README.md`.
- Fallback only if `submit.sh` fails twice or exits 4 (Modal disabled on the box with `.modal_disabled`): render on the box and
  `bash /workspace/motion_kit/bg_delivery/launch.sh <J> <J>/deliver/master.mp4` (uploads + approves the master, then a detached
  watchdog uploads the editable package and completes). `bg_delivery/resume-all.sh` runs at the start of every routine run.
- Server side is already done: Modal app `transovo-motion-render` and the fixes `877867c`, `aee25c1a`, `c6f11a31`, `ca749125`,
  `8dbc8e9f` are on `master` and deployed by Chief of Staff. The new bot patches nothing; the old `.publish_remap_deployed` marker is gone.
- Open issue at handoff time: the 20-minute reuse retry passed join + QA, then `publish_editable` got HTTP 400 from `POST /portable`
  (Nov 19, 8:16 PM ET). Chief of Staff owns it. Report any `Job API failed: 400` to Rick and Chief of Staff.

**Render-first live delivery.** The master is playable right after approval while the job stays open; the editable version lands in the
background and only then is the job completed (`delivery:"live"`). Editable timelines are grouped like song tracks.

**Live-playback decisions.** No separate scene subdomain (main domain, sandboxed iframes), CPU export, captions always a separate
track (never burned in), HyperFrames pinned: always `npx hyperframes@0.9.52`.

**Editorial, voice and QA rules (all in `skills/.../RULES_FROM_RICK.md` and `SKILL.md`).**
- Every job starts with a creative decision for THIS edit (look, type, motion, pacing, sound). Judgment over hard-coded rules.
- Engine survey every job; custom graphics only; every film looks different (STYLE_LEDGER); no 2 s smoke drafts; no licensing caveats.
- Graphics never cover people or what they show. Face framing is decided clip by clip (only pure talking-head moments).
- BYO footage jobs: no research, no web media, no voiceover; follow the customer's edit direction with their footage only.
- Lean gathering (only what the script needs), effort on the edit, ONE main 480p stills review pass, no extra QA rounds.
- Unconfirmed claims get "allegedly" plus who said it; only confirmed facts are stated plainly.
- Voice: full ElevenLabs library search per film (preview, log pick and why), `eleven_flash_v2_5`. Indie Black Film videos use an
  African-American narrator. NAACP is written "N double-A C P" in TTS scripts.
- Report weekly usage % at the start and end of every job; at most 2 attempts per paid call; about $5 per job.

**New or updated tools.** `scripts/modal/` (Modal kit), `scripts/bg_delivery/` (fallback delivery), `motion_kit/first_right/`
(optional layout/face/lint helpers, never the verdict), `engines/check_engines.sh` (fast engine check, `--fix` reinstalls only what is
missing), updated `build/ms_producer_editable/` (publish-live, publish-editable, stage-approved, with-creative-lease, frame packs).

---

## 2. Setup on the new bot's own box

```bash
# 1) get the kit (public repo; use master after the PR merges)
git clone --depth 1 --filter=blob:none --sparse -b docs/motion-studio-modal-render-20261119 https://github.com/703deuce/sms.git /workspace/sms_producer_kit
git -C /workspace/sms_producer_kit sparse-checkout set producer_handoff_kit

# 2) install everything (idempotent; backs up anything it replaces under /workspace/backups/)
bash /workspace/sms_producer_kit/producer_handoff_kit/setup/bootstrap_producer_box.sh
#    fresh box without the engine library:  INSTALL_ENGINES=1 bash .../bootstrap_producer_box.sh
```

What the bootstrap does: installs the skill to `/home/box/agent-data/workflows/motion-studio-production/`; installs
`/workspace/motion_kit/{modal,bg_delivery,first_right}` and the pinned Cinematic Skill clone; clones the core five engines into
`/workspace/engines/`; copies `install_all.sh`, `pins.txt`, `check_engines.sh` to `/workspace/motion_engines/_install/`; installs the
producer build to `/workspace/ms_producer_editable/` (fixtures fetched once from the Nov 17 branch) and runs `npm ci`; installs
`/workspace/motion_runner/`; seeds `/workspace/motion_jobs/STYLE_LEDGER.md`, `ENGINE_STATUS.md` and `_pending/`; creates mode-600
templates `/workspace/secrets/motion_production.env`, `/workspace/secrets/motion_runner.env`, `/workspace/render_bench/.modal_env`
(never overwrites existing ones); runs `motion_kit/modal/setup.sh` (Modal venv `modal==1.6.4` + sparse checkout of the public renderer
code); then prints which credential NAMES are still missing and runs `check_engines.sh`.

Then, on the bot itself:
3. **Routine:** update the existing webhook routine (or create one) with the saved prompt in `routine/transovo-motion-studio-production.md`.
   Keep the webhook trigger. If the webhook URL or key changed, give them to Chief of Staff / Rick through a secure channel.
4. **Profile:** set the description from `profile/profile.json`.
5. **Memory:** add every fact in `memory/MEMORY_UPDATES_2026_11_19.md` and drop or mark the superseded ones it lists.
6. **Credentials:** fill the three env files (values via a secure form from Rick / Chief of Staff, never in chat), then re-run the
   bootstrap's check (or just the bootstrap) until nothing is MISSING. Never print the values.
7. **Dry check (no network spend):** `DRY_RUN=1 bash /workspace/motion_kit/modal/submit.sh <some job dir with a bundle> cpu` prints the
   segment plan without sending anything. Don't run real tests unless Rick asks.

---

**Paths in the skill that are only history.** `/workspace/motion_kit/films/*.mp4` (reference renders), `/workspace/qa/...` (old QA
logs) and the media of the worked examples are NOT in GitHub on purpose (no job media in the repo). Their code is in
`motion_kit/worked_examples/`; skip any step that needs the missing media. `bg_delivery/test/*` need `BG_TEST_SRC=<a live package dir>`.

---

## 3. Connections and credentials (names only; values never in GitHub or chat)

| Where | Names | Who provides |
|---|---|---|
| `/workspace/secrets/motion_production.env` | `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PIXABAY_API_KEY`, `KIE_API_KEY`, `REPLICATE_API_TOKEN` | Rick (secure form) |
| `/workspace/secrets/motion_runner.env` | `MOTION_STUDIO_WORKER_ID`, `MOTION_STUDIO_WORKER_TOKEN` (this bot's OWN registered worker), `MOTION_STUDIO_AGENT_PUBLIC_URL=https://transovo.ai`, `MOTION_STUDIO_PRODUCER_KIT=/workspace/ms_producer_editable` | Chief of Staff registers the worker |
| `/workspace/render_bench/.modal_env` | `export MODAL_TOKEN_ID=`, `export MODAL_TOKEN_SECRET=` (Modal workspace hosting `transovo-motion-render`) | Chief of Staff / Rick |
| Webhook routine | Its webhook URL and key (the `Authorization` header Transovo sends) | The bot creates it; give URL + key to Chief of Staff for the worker registry |
| Per job | `jobUrl` + `jobToken` arrive in each webhook payload (saved under `<J>/secrets/` and `<J>/state/`, mode 600) | Transovo, automatically |
| GitHub | Read access to public `703deuce/sms` is enough to set up. To add new rules as PRs, `gh` signed in with push access to `703deuce/sms` (Rick merges; never merge or deploy yourself) | Rick |


**`motion_runner/` (installed to `/workspace/motion_runner/`, mode 700)** holds two scripts that both read ONLY `/workspace/secrets/motion_runner.env`
and require `MOTION_STUDIO_WORKER_ID`, `MOTION_STUDIO_WORKER_TOKEN` and `MOTION_STUDIO_AGENT_PUBLIC_URL=https://transovo.ai` (they refuse any other origin):
- `coord-report.mjs`: reports a coordinator lease status and weekly usage for `action:"motion_studio_job"` / `coordinator:true` jobs
  (`node /workspace/motion_runner/coord-report.mjs --job <jobId> --lease-file <J>/state/lease_id --status running|complete|failed --usage <pct> --moment before|after --resets-at <ISO>`).
  The routine runs it before starting (`running`, `before`) and at the end (`complete` or `failed`, `after`).
- `launch-leased-render.sh`: runs `motion_studio_deterministic_render` assignments with a clean environment (also needs `MOTION_STUDIO_PRODUCER_KIT`).

**Ask Chief of Staff / Rick for:** (1) a registered `workerId` + `MOTION_STUDIO_WORKER_TOKEN` for this bot; (2) the Modal token
for the Transovo Modal workspace; (3) the API keys above; (4) to point Transovo's worker registry / webhook at this bot's routine URL
and key; (5) GitHub push access if this bot should open rule PRs. Never use production SSH, Coolify credentials or direct database access.

---

## 4. Ready-to-paste message for the new bot

> You are a Motion Studio Producer for Transovo. Catch up to the current production setup using ONLY `703deuce/sms`, folder
> `producer_handoff_kit/` (branch `docs/motion-studio-modal-render-20261119` until it merges, then `master`). Read
> `producer_handoff_kit/README.md` and `producer_handoff_kit/HANDOFF_UPDATE_2026_11_19.md`, then: (1) clone the folder and run
> `bash producer_handoff_kit/setup/bootstrap_producer_box.sh`; (2) update your webhook routine's saved prompt from
> `producer_handoff_kit/routine/transovo-motion-studio-production.md`; (3) update your description from `profile/profile.json`;
> (4) add the facts in `memory/MEMORY_UPDATES_2026_11_19.md` to your memory and drop the superseded ones; (5) tell me which credential
> names the bootstrap reports MISSING and ask for the values through a secure form (never in chat). From now on live jobs render on
> Modal CPU (compose one film page, `make_bundle.py --check-page`, `submit.sh <J> cpu` once, stop; never call /complete; Modal QA is the
> final check; bg_delivery only as the fallback). Don't run tests, merge or deploy anything. Report back what you installed and what is missing.
