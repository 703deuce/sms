# Transovo Text-to-Video (Prompt-to-Video): test guide

The living handoff for anyone (human or agent) testing T2V. Keep this file updated whenever the test setup changes.

## What it is
- A separate pipeline from the YouTube pipeline. Never cross them.
- Code:
  - web: `new-app/lib/server/t2v/pipeline/` (story agent, scene planner, footage agent, finisher, QA, orchestrator, no-repeat)
  - UI: `new-app/components/t2v/`
  - worker: `worker/clips_worker/t2v/` (`verify_stock.py` visual check, `assemble.py` / `job.py` assembly with in-scene cuts, `stock_repair.py`)
  - AI B-roll test: `new-app/lib/server/t2v/pipeline/t2v-ai-broll.ts`
- Flow: script, then scene plan (pacing and specific subjects), then stock search (Pixabay video, broader video, Pixabay photo with Ken Burns, re-checked spare, related fallback; optional AI B-roll test), then Gemini visual-only verify (worker job `T2V_VERIFY_STOCK`: no audio, picks in/out points, same check for stock, photos and AI clips), then ElevenLabs voice (default George, `lib/t2v/voice-defaults.ts`) with word timings for cuts, music, then assembly (`T2V_ASSEMBLE`), captions and export (`RENDER_SCRIPT_COMPOSITION`).
- Pick order per shot: accepted video (7+) → usable video (5-6) → photo with Ken Burns (5+) → spare re-checked for this line (5+) → AI test clip (5+, only when enabled) → related fallback (3+) → closest related clip from another line (text re-check) → any unused reviewed clip. Never a text card.
- UI: https://transovo.ai/app/ai-video/new. Feature gates: `lib/features/t2v.ts` / `lib/features/ai-video-enabled.ts` (web) and `worker/clips_worker/t2v/feature_gate.py` (worker).
- Status/wake route (public GET, no auth): `GET https://transovo.ai/api/t2v/pipeline/<draftId>`; each call also advances the run. `data.video.downloadUrl` is signed: download it, never print or commit it.

## Product rules (from Rick, non-negotiable)
- Never repeat a shot: same clip ID, near-identical frames, or the same shoot placed nearby.
- Every scene gets real footage. No title or text cards, and planner text never appears on screen.
- Search for a related alternative instead of rejecting a scene. A failed clip or download is skipped and never crashes the run.
- Stock covers nearly everything. AI B-roll is a future premium option, not the default.
- Realistic styles: live action only (no animation, 3D, CGI or vectors), lighting at least 6/10, night clips only for night lines, no black-and-white unless asked.
- Pacing like a real editor: variable holds and cuts (QA needs a shot-length CV of at least 0.3), cuts on voiceover pauses, and a different rhythm per video.
- Stock sources: Pixabay only (`PIXABAY_API_KEY`). There's no Pexels key (Pexels isn't issuing them), and paid stock like $1-per-download Vecteezy is rejected.
- AI B-roll test: Replicate `wan-video/wan-2.2-5b-fast` (`REPLICATE_API_TOKEN`, web env), only when stock is way off after every stock and photo round, at most 3 clips per video, one generation per scene, 81–121 frames at 24 fps (≈3.4–5 s, from the shot's planned length; shots over ~5.3 s are not eligible), 720p 16:9, `go_fast`. Off by default: enable with web env `T2V_AI_BROLL_TEST=1` or per run with `autobuild.aiBroll = true`. No automatic paid retries. Estimated $0.025/clip; per-clip status, predict time and cost are on `autobuild.aiJobs`, the total on `autobuild.aiCostUsd`, and in web logs `[pipeline-ai]`.

## Running a test
1. **Start a run (browser only).** `POST /api/t2v/pipeline` requires same-origin or the dev key. Don't fake headers or pull the dev key off the server. Open the UI in the logged-in box browser, fill in the prompt and settings (e.g. 90 s, Documentary, 16:9, captions on, 480p), click Generate once, and copy `?run=t2v_…` from the URL.
2. **Watch it.** Use the public status route, or `/workspace/test/t2v_watch.sh [limit]`, which reads `t2v_drafts` via the clips-worker container. The server-side orchestrator advances the run on its own.
3. **Re-run the same draft** after a code change: `docs/t2v-test-tools/t2v_reset_run.py <draftId> [ai]` (box copy: `/workspace/test/`) resets `document.autobuild` (keeps prompt, style, durationS, renderResolution, startedAt; `ai` adds `aiBroll: true`). Copy it into the clips-worker container (`docker cp`), run it there with `python3` (it uses the container's `DATABASE_URL`), delete it, then wake the run with one GET to the status route. That's one paid pass, never in a loop. Wait for running deploys first: the orchestrator runs in the web container.
4. **Collect.** Save the MP4 to `/workspace/test/<name>.mp4`, plus a frame per scene, `scenes_grid.jpg`, `timeline_1s.jpg` and `status.json`.
   `docs/t2v-test-tools/t2v_dump.py <draftId>` (run the same way) prints shots, picks, QA, log and the assembler's `shotStartsMs` (shot boundaries for frames) without URLs.
5. **Judge.** For each scene record the clip ID, pick type (accepted, usable, photo, spare, ai, fallback, last_resort, held, card), score and lighting, what it shows, fit to the line, and start, end and length. Also record shot-length CV, coverage, plan and render QA, repeats, and dark or black-and-white clips.

## Test drafts and history
- EV test (niche, thin on Pixabay): draft `t2v_0a0c874f40644f57a08607a223122df5`. Outputs: `t2v_test1.mp4`, `t2v_test2.mp4`, `t2v_test3.mp4`.
- Coffee test (common subject, the current benchmark): run `t2v_f061751671a84fe3905cdcee245fbfc9`, prompt "How coffee goes from farm to cup: growing, harvesting, roasting, brewing".
  - `t2v_coffee.mp4`: baseline, CV 0.20, about 8 of 15 fit.
  - `t2v_coffee2.mp4`: photo fill, CV 0.17, about 12 of 18 fit, one card.
  - `t2v_coffee3.mp4` (d5a2106c1): editorial pacing, no cards, stills cap. 80.1 s, 185 words, 20 shots. Render CV 0.42 (QA pass), 0 cards, 1 held piece, about 11 of 19 fit. 7 cross-line last-resort picks were mostly wrong (mugs and pouring under farm/roasting lines), which led to the text re-check of cross-line picks.
  - `t2v_coffee_ai.mp4` (5a52a1c06, per-run `aiBroll`): 81.0 s, 185 words, 23 shots. Render CV 0.42 (QA pass), 0 cards, 0 held, all 23 lines have their own clip. Pick types: 11 accepted, 5 photo, 1 fallback, 6 last resort, 0 AI. One AI clip was generated for the "ready to harvest" line (103 frames ≈ 4.2 s, 14.7 s predict time, est. $0.025). It scored 10/10 live action, but a 9/10 stock photo won under the pick order. That led to two changes: AI now only runs when no stock clip or photo reaches 5 for the line, and the stills cap is enforced on fallbacks too. Issues: fallback photos made runs of 3+ stills, and shots 2-3 look like one static shot.

## Round log
- Nov 13-14, 2026: pacing (CV 0.20 → 0.17 → 0.42 → 0.42), photo fallback, no cards, related rescue round, AI B-roll test step. Next: cross-line fallback quality, script expansion overshoot (185 → 263 rejected), and same-setup lookalikes inside split sentences.

## Deploys
- Web: Coolify auto-builds on every push to master (app `ds8s3hjin60qs6g7s0iqkixs`). Push with the `GITHUB_TOKEN_TRANSOVO` env var via GIT_ASKPASS. Never print it, never force-push.
- Worker: `bash /workspace/qa/deploy-worker-scoped.sh <sha> coolify-server` (not executable; run with bash). It recreates both containers (`clips-worker`, `clips-worker-stream`) with `docker run --env-file /opt/clips-worker/worker.env`. It sometimes hangs locally at the final ssh step; check container start time and `/app` code on the server instead, then re-run the CLIPS_WORKER_GIT_SHA sync script by hand.
- Env: worker `/opt/clips-worker/worker.env`, web via the Coolify API (`scripts/coolify-set-clips-worker-git-sha-web.sh` shows the pattern).
- SSH: `/workspace/secrets/cursor_coolify` as cursor-agent@128.140.102.51 (`~/.ssh` alias `coolify-server`). Check disk before builds and prune unused images (`docker rmi` old web tags, `docker image prune -f`), but keep the current web image.
- Check an env var is present by length only, e.g. `docker exec <c> sh -c 'printf %s "$VAR" | wc -c'`.
- Never print keys, env values or signed URLs. No SMS or app3 changes. Additive migrations only.
