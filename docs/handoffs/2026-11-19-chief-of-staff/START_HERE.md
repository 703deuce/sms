# Chief of Staff Handoff & Delta Guide (Nov 19, 2026)

**Audience:** A new Chief of Staff bot starting on a fresh machine/account with **no access** to the previous bot's `/workspace` or `/home/box` filesystem.
**Source of truth:** Everything non-secret is now stored here in `703deuce/sms` on `master`.

---

## 1. Read order on boot

1. **`CONNECTION_CHECKLIST.md`** (in this folder) — connect GitHub, Hetzner SSH, Modal CLI, coordinator admin key, and Transovo login; verify zero missing permissions before doing real work.
2. **`STANDING_RULES_2026-11-19.md`** (in this folder) — every active rule from John (Nov 9–19, 2026). Newer rules override older ones.
3. **`MODAL_AND_SERVER_RUNBOOK.md`** (in this folder) — how to deploy/run `worker/modal_motion/`, inspect Coolify & DB safely, kick the coordinator, manage `MotionStudioWorkerPlan`, and use the parameterized scripts in `scripts/`.
4. **`team/AGENTS.md` & `team/LIMITS.md`** (repo root) — updated roster, retry limits, and approved spend rules.
5. **Motion Studio Producer kit:** `producer_handoff_kit/` on `master`, plus the updated Modal catch-up kit in open **PR #1270** (`docs/motion-studio-modal-render-20261119`, start at `producer_handoff_kit/README.md` and `producer_handoff_kit/HANDOFF_UPDATE_2026_11_19.md` — **for John to merge; do not merge PR #1270 yourself**).
6. **Historical docs archive:** `docs/transovo_team/` — contains `HANDOVER-motion-studio.md` (Nov 15 baseline), `TEAM.md`, `PRODUCT_V1.md`, `roles/*.md`, `specs/*.md` (including `specs/modal-render-brief.md`), `runbooks/*.md`, and `backend/motion-studio-api-contract.md`.

---

## 2. What changed since the Nov 15 handoff (`HANDOVER-motion-studio.md`)

| Area | Nov 15 Baseline | Nov 19 Current State |
|---|---|---|
| **Final rendering** | Python Cinematic Skill / local or `clips-worker` Chromium rendering | **Isolated Modal app `transovo-motion-render`** (`worker/modal_motion/`). CPU fan-out (`max_containers=24`, 4 vCPU / 8 GB per segment, 8 vCPU / 16 GB `join_qa`). GPU T4 is unused for 2D films (`$0.70/min` vs CPU `$0.19/min` benchmarked Nov 19). |
| **Delivery flow** | Build bundle and finish job in one pass | **Render-first + immutable editable publish:** Modal uploads & approves `master_cpu.mp4` (`POST /assets` `approveMaster` -> sets `resultKey`) so the watch link plays immediately, encodes `share_cpu.mp4` (skipping the 24 MB cap for films `>300s`), then publishes editable assets/bundle via `POST /portable` and finishes with `POST /complete`. |
| **Segment reuse** | Re-render everything on retry | `modal_submit.mjs` & `worker/modal_motion/pipeline.py` accept `reuse` artifact maps across jobs on the same project. `/api/motion-studio/agent/jobs/[id]/render-asset` allows any artifact under `ws/<workspaceId>/motion-studio/agent/` so retry jobs borrow already-rendered segments from prior jobs cleanly. |
| **Queue & budget gate** | Direct dispatch / local scripts | **Agent Bridge v2 + pull queue + `MotionStudioWorkerPlan`** (`grokbot-plan-john`). `new-app/lib/server/motion-studio/coordinator.ts` checks `observedPercent < weeklyLimitPercent` before dispatching AI jobs. |
| **Bot team & workflow** | 12-bot roster in `docs/transovo_team/TEAM.md`; build phase with New + Frontend | Active Motion Studio loop runs through **Chief of Staff** + **Motion Studio Producer** (`7b7a2930-99bd-42a5-9c47-a96d6a15a8c4`) + optional **Grok Bot** (`04661bbc-...`). Note: on a new account, ask John which bots/agent IDs are wired on the new workspace and update `team/AGENTS.md`. |
| **Repo vs box files** | Team docs, specs, and scripts lived only on the old bot's `/workspace/` | All non-secret team docs (`docs/transovo_team/`), Chief handoff/runbooks (`docs/handoffs/2026-11-19-chief-of-staff/`), and parameterized helper scripts (`scripts/`) live in `703deuce/sms` on `master`. |

---

## 3. Live production snapshot (as of Nov 19, 2026, ~8:45 PM ET)

- **Web app (`new-app/`) & Modal app (`worker/modal_motion/`):**
  - Latest feature commit deployed to both Hetzner/Coolify and Modal (`transovo-motion-render`): `8dbc8e9f` (`fix(modal-motion): upload master before share and skip 24 MB cap on films > 5 min`), preceded by `ca749125` (packet count `ffprobe`, 8 vCPU `join_qa`, long-film timeouts, borrowed `render-asset` prefix), `c6f11a31` (job API 429/5xx retries), and `aee25c1a` (B2 download retries + 24-container cap).
  - Verify live web commit anytime with: `curl -s https://transovo.ai/api/health` (`commitSha`).
- **Hetzner server (`128.140.102.51`):**
  - Disk usage is **~81%** (`~116G / 150G`, `~28G` free); `~55 GB` is active Docker build cache. Watch disk before large builds or pruning.
- **Coordinator worker plan (`MotionStudioWorkerPlan`):**
  - Row `grokbot-plan-john`: `maxConcurrentAi=1`, `weeklyLimitPercent=100.0`, `observedPercent=96.7`, `resetsAt=2026-11-24 20:41:00 UTC` (Tue Nov 24 3:41 PM ET), `enabled=true`.
- **20-minute film ("Dean and Ray J", project `msp_1f54092df4af46688360bdc1aa458445`):**
  - `msaj_0b48a96b-7faa-4f70-b223-d7d5aab2af4a` rendered and uploaded all 91 segments (`modal_seg_v1_cpu_000.mp4`..`090.mp4` + `render_bundle_v1.zip`) to B2.
  - `msaj_8eb586dd-53dc-4a64-96c6-920e1c0f121c` reused all 92 artifacts, stitched & passed `qa_video()` (`$0.066092`, `942.012` CPU-seconds), uploaded and **approved `master_cpu.mp4` (`854,886,155` bytes, `resultKey` set)** and `share_cpu.mp4` (`66,651,587` bytes). It is playable at `https://transovo.ai/app/motion-studio/msp_1f54092df4af46688360bdc1aa458445`.
  - At 8:16 PM ET, `msaj_8eb586dd` failed on `POST /portable` with HTTP `400` (`publish_editable`). John instructed to stop chasing the 20-min editable wrap-up for now and prioritize the bot transfer; only revisit `POST /portable` 400 if John asks to make this specific project editable.

---

## 4. Open backlog / next items to confirm with John

1. **PR #1270 (`docs/motion-studio-modal-render-20261119`):** Leave for John to review/merge (Producer's Modal skill & kit update).
2. **Do NOT merge `grokbot/motion-studio-producer-kit-20261117`.**
3. **Gold vs Bitcoin editor load-time:** Wait for ChatGPT's commits before testing; do not launch paid renders without John's approval.
4. **Routines & reporting:** Recreate any daily owner summary routine on the new bot with `UpdateRoutine` if John still wants daily summaries.
