Written: Nov 10 2026, 3:45 AM ET (weekly usage 98%; reset Tue Nov 10 3:41 PM ET)

# Transovo AI handoff

Who this is for: a new agent with zero context, picking up work on Transovo AI in GitHub repo `703deuce/sms`. Owner: John Jones. Read this file, then `/workspace/transovo_team/TEAM.md` and your charter in `/workspace/transovo_team/roles/`.

Status words used here: **merged** = on master; **live-verified** = seen running on transovo.ai; **unconfirmed** = not checked by the writer. Do not upgrade a status without checking it yourself.

---

## 1. Product and direction

- Transovo sells **finished video results**. The editor is optional. Do not position it as an "AI video editor". Messaging and entry points lead with the outcome.
- Each outcome tool has its own link (and later its own landing page), all sharing **one engine and one upload** (an upload can be reused across tools):
  - **Clips** (`/app/clips`): the unified clipper. Upload in, scored clips out. No mode picker. Streamer (Twitch/Kick VOD) only changes how the video comes in; the pipeline after ingest is the same.
  - **YouTube video** (`/app/youtube-video`): long-form edit/story from a long source. Any content type, not just gaming.
  - **AI Captions** (`/app/captions`): upload a finished video (or pick an existing project), get captions only, no cuts. Opens in the compact clip editor with the Captions tab active. Burned-in MP4 plus .srt/.vtt.
  - **AI ad studio** (`/app/studio`, repurposed in place): finished 15s/30s product ads. Mode 1 is a storyline ad: agents write the script, make product images, plan scenes, mix real stock B-roll with short AI clips (only where needed), stitch, and open it in the compact editor with a switch to the full editor. Mode 2 is image-to-ad: a product image becomes a 15s/30s ad using existing registry models. **There is no standalone model-access AI Studio and no model-picker panel** (John, Nov 10 2:52 AM ET), because we can't match Higgsfield prices profitably on Kling/Wan and John won't charge more or self-host models.
  - Later, possibly: Reframe, Translate, Audio. Not committed.
- URL scheme: everything on transovo.ai, no subdomains. `/` is the marketing home. Landing pages: `/video-editor`, `/ai-clipper`, `/youtube-video` (captions landing `/ai-captions` later, ad studio landing slug undecided). The app lives under `/app`.
- Traffic comes from Google Ads, so favor bottom-of-funnel features that can stand alone as a landing page/product.
- Credits, billing, pricing and login/auth are **deferred to the end**. The UI shows credits only, never `$`. Unset costs show "Credits TBD".
- Face tracking is decided per clip from visual framing (Opus Clip style), not by content type.
- Motion graphics: the 10 templates on the current ASS/libass engine are enough. No phase-2 animation engine.
- Source references: `research/outcome-products-from-john-2026-11-10.md`, `PRODUCT_V1.md`, `/workspace/specs/cos/*.md` (briefs), `/workspace/specs/pm/*.md`.

## 2. Shipped (merged to master)

Live: `https://transovo.ai/api/health` reported commitSha `383701b5` (release #1153) at 3:58 AM ET, so #1153's web deploy is live (worker rebuild and feature behavior not yet verified by QA).

Nov 10 (ET times, converted from GitHub UTC):
- **#1153** `383701b5` (3:38 AM): release 2026-11-10e. Batches #1149 (frontend clipper QA fixes, Studio Text-to-image tab, Editor QA tests), #1150 + #1143 (YouTube video UI and v1 backend; additive `youtube_video_runs` migration), #1148 (stream results use the unified grid; `/app/clips` is upload-only), #1147 (AI Captions backend; additive `ai_captions_runs` / `ai_captions_workspace_prefs`), #1151 (AI Captions frontend at `/app/captions`). Captions-only projects can't auto-start a clip run.
- **#1152** `b5d0f523` (3:26 AM): clipper live 0-clip parity fix, layout decision, and clipper stage logs (branch `fix/unified-clipper-live-parity`). Fixes the QA live run that finished Ready with 0 clips.
- **#1146** `e31317cc` (3:26 AM): streamer starts one unified clip run after stream ingest is READY.
- **#1144** `75f063d4` (2:00 AM): release 2026-11-10c, AI Studio + unified clipper (#1135 Studio contract, #1138 unified clipper v1, #1139 `/app/studio` UI, #1141 unified results UI).
- **#1142** `80a02258` (1:35 AM): release 2026-11-10b: captions finish (#1109), Clean Take suggestion-first review with restore (#1106), `/app` route restructure (#1133), CI guards (#1125, #1129), needsReview badge (#1128), ASS caption capitals fix (#1132).
- **#1111** `ac0a8353`: publish held drafts instead of ending at 0 clips. **#1108** `78c0b7aa`: snap And/But/So and pronoun openings, 300 ms tail.
- **#1112** `5cc621de`: public marketing home at `/`. **#1082** `7ad00451`: AI Clips and Video Editing landing pages.
- **#1083** `5d12224e` (Nov 9 8:11 PM ET): keep story endings, complete draft-only runs.

Nov 8-9 (clipper/editor foundation): #1081 QA budget and stitch openings, #1080 full-episode Story + QA publish gate + speaker-follow, #1079 editorial rules, #1078 motion-graphics control, #1077 clip quality/automatic motion graphics, #1076 isolated clip agents and ranked multi-clip, #1073, #1071, #1069, #1068 Twitch range fix, #1067 motion-graphics plan contract, #1066/#1064/#1065/#1063 streamer AI clipper, #1062, #1061 Clean Take.

## 3. In progress

- **Clipper live parity**: #1152 merged. Still not done (from `qa/live-batch-errors-2026-11-10.md`): stage logs for Captions, ad studio and youtube-video; streamer raw errors (storage_object_missing, range_outside_media, ffmpeg dumps, "list index out of range") mapped to friendly messages; an explicit double-run guard on "Create AI clips"; clip-tile poster/playback URLs in list payloads ("No preview yet" thumbnails); crop box should offset the tracker, not replace it; empty-state copy; no auto-start after upload; blank skeleton after "Get clips"; `/app/streaming` 404 (sidebar uses `/app/streamer`, add a redirect or confirm); stray sidebar icon under Home. Owner: New (backend) + Frontend.
- **QA live retest** of the unified clipper on the deployed #1152/#1153 build (checks 3-7, one uploaded file, no paid retry). Owner: QA. Then a live pass on YouTube video, AI Captions and the streamer grid. Log everything to the single batch log `qa/live-batch-errors-2026-11-10.md`, then one fix batch.
- **AI ad studio**: contract `docs/contracts/ad-studio-v1.md` (PM, build-ready; canonical copy at `/workspace/docs/contracts/ad-studio-v1.md`, lands in the repo with backend PR-B1). Frontend **PR-F1 #1154** (`frontend/ad-studio-f1`, mocked, open, not merged): `/app/studio` mode home, brief, plan card, progress, mocked done, model pickers removed. Handoff: `transovo_team/handoff/frontend-ad-studio-handoff.md`. Backend B1-B3 (`AD_STUDIO_RUN` worker type, `/api/ad-studio/*`, storyline/planner agents, stock search + `ensureStockAsset`, confirm + idempotency) **not yet opened as a PR** (unconfirmed whether New started). Then F2 wires F1 to the real API. Release conditions are in contract section "Release conditions".
- **Other open PRs** on 703deuce/sms that may be superseded (check before acting): #1145 (`frontend/youtube-video`, likely superseded by #1150), #1110 (`backend/captions-v1`, likely superseded by #1147/#1109), #1134 (editor command registry types, PR-B1 of the AI editing assistant), #1084 (team setup: templates, team/AGENTS.md, WORKFLOW, RELEASE_POLICY, LIMITS; coordination issue #1085, onboarding issues #1086-#1096, deferred billing/login #1097 and #1104, Clean Take #1103), #1075, #1074, #1070 (older clipper/motion WIP). PRs #668-#746 and #986 are old phone/voice/receptionist work: leave alone.

## 4. Next, build order, parked

1. #1153 web is live (383701b5); confirm workers, then QA's one live pass across Clips, YouTube video, AI Captions, streamer grid, and the ad studio once it exists. Log every error without stopping, fix all in one batch, retest only those.
2. AI ad studio B1-B3 + F2, then one batch merge and a live run (KIE limits apply).
3. The AI chat/editing assistant (`specs/pm/2026-11-09-ai-editing-assistant.md`, #1134 is its first piece).
4. Landing pages for each outcome tool (`/ai-captions`, ad studio slug once John picks it, `/youtube-video`).
5. At the very end: credits, pricing, login/auth (reuse the old `app/` Google OAuth and Stripe), and the Security criticals.

Parked: standalone model-access AI Studio (dropped); text-to-video, avatars, dubbing, script-to-video and auto-thumbnails as separate products; phase-2 motion-graphics engine; Twitch/Kick download testing; Security fixes (on hold until features work, see Security below).

## 5. John's hard rules and process rules

- Never deploy or modify the SMS worker or Coolify app3 (`fd7b2fe8172414e3320776281a-*`).
- No force-push, history rewrite or reset. Branch, PR, normal merge.
- **Batch** ready PRs into one merge to master and one deploy. Standing approval to merge/deploy anything that passes; no need to ask John each time.
- **Ship rough to live** and fix live. Work isn't done until John can run it on transovo.ai.
- The only pre-merge gate is **whether the app builds** (Coolify). Ignore the old red checks (voice-agent-runtime, number-marketplace, root tsc). No separate pre-release builds or CI runs.
- Builds should take 4-5 min. Past 5 min, SSH in and investigate; don't wait it out. Keep server disk space free or builds hang.
- Build a feature 100% (frontend + backend, connected) before testing. Then one full test pass, log all errors, one fix batch, retest only those. No back-and-forth review rounds mid-build. Real testing is on the live site after the merge.
- **Testing uses uploaded, pre-downloaded files only.** No time or usage on Twitch/Kick downloads. URL import cap stays 3h.
- **Never guess at errors.** SSH in and read the real logs (`runbooks/logs.md`). Every stage logs job id, stage, counts and the exact exception. Missing logging is a bug, fixed in the same batch. If it worked in tests but fails live, diff the passing run against live (code path, commit, settings, env, worker version) and make live match; confirm from logs.
- Never show `$` in the product UI. Credits only.
- Additive DB migrations only. Destructive DB ops need John.
- Don't break working modes: upload clipping, stream clipping, the editor, Story, multi-source Story, Clean Take.
- Never expose secrets, keys, tokens, cookies or signed URLs anywhere (chat, issues, PRs, logs you paste).
- Don't assign story angles in AI editorial prompts.
- No automatic paid retries or duplicate paid runs. No charge for failed or discarded work. Confirm before any paid generation.
- **KIE limit**: AI Studio/ad testing capped at 5 real KIE generations on cheap models, shortest duration (~1s video), max 600 of the 1,000 KIE credits. Verify model switching with mocks.
- **Usage budget**: work continues until weekly usage hits 99%; this handoff is written at 98%; all bots stop new work at 99% until the reset (Tue Nov 10 3:41 PM ET). Keep usage frugal: P0/P1 only near the limit, no exploratory or repeated runs.
- Staffing: Researcher, PM, Frontend and Backend (New) run continuously; on-call bots are woken only for a specific task.
- Separate code written / tests passed / deployed / verified in production. Never claim unverified work. The coder never self-certifies: QA, Video Quality (clip/edit/render/AI changes) and Security (auth/billing/storage/permissions) review independently.
- Real channels only: SendToAgent and GitHub issues/PRs. Never say a bot was notified unless you sent it.
- Escalate to John (through the Chief of Staff) only for security risk, real spending, destructive ops, pricing or strategy. Research should be broad market surveys before narrowing.

## 6. Environment and deploy

- Repo: `703deuce/sms`. Web app in `new-app/` (Next.js, Prisma). Clips worker in `worker/clips_worker/`. `app/` is the older project (reuse its Google OAuth and Stripe later). No local clones; use the GitHub API/`gh` with `GH_TOKEN` from `GITHUB_TOKEN`.
- Server: Hetzner + Coolify, SSH `cursor-agent@128.140.102.51` with key `/home/box/.ssh/grokbot_hetzner_ed25519` (path only). Only Backend (New) and DevOps deploy.
- **Coolify auto-deploys the web app from master** (app id `ds8s3hjin60qs6g7s0iqkixs`; container `ds8s3hjin60qs6g7s0iqkixs-<timestamp>`). Verify with `https://transovo.ai/api/health` (`commitSha`).
- Workers: `clips-worker` (default lane) and `clips-worker-stream` (stream lane), deployed with `scripts/deploy-worker.sh`. A release touching worker code needs web **and both workers** rebuilt.
- Key routes: `/`, `/ai-clipper`, `/video-editor`, `/app`, `/app/clips` (+ `/app/clips/new`), `/app/streamer`, `/app/youtube-video`, `/app/captions`, `/app/studio` (ad studio), `/app/video-editor/{projectId}/edit/{clipId}` (compact editor; `?timeline=1` full editor, `?tab=captions` captions tab), `/api/health`, `/api/studio/jobs`, `/api/clips/clips/:id/srt|vtt`, planned `/api/ad-studio/*`.
- Logs: `runbooks/logs.md`. Live `docker logs` are lost on redeploy; a 14-day archive cron (`/home/cursor-agent/bin/transovo-log-archive.sh`, every 15 min) writes `/home/cursor-agent/transovo-logs/{web,clips-worker,clips-worker-stream}/<date>.log`. Worker tags: `[clipper:stage]`, `[clipper:decision]`, `[clipper:transcribe]`, `[clipper:video_picker]`. Redact storage URLs before sharing.
- Env var / secret **names only**: `GITHUB_TOKEN`, `SUPABASE_NEW_SECRET_KEY` (in `/home/box/.transovo_team_secrets.env`, held by Backend and Chief of Staff). App secrets (KIE, Supabase, storage, etc.) live in the Coolify app env on the server; never print them.
- Supabase connector (user-Supabase MCP) is available to the Chief of Staff.

## 7. The bots

Message any bot with SendToAgent using its agent id. Everyone reports to the Chief of Staff. "Current task" is as of 3:45 AM ET Nov 10; if a task isn't listed it's unconfirmed, so ask the bot.

- **Chief of Staff** `d7a6dc1a-8cc5-4dc0-a4d7-1ff750adf615`: orchestrator, backlog, assignments, reviews, releases, reports to John. Did: team setup (#1084, issues #1085-#1104), agent registry in TEAM.md, briefs in `/workspace/specs/cos/`, release batching, usage pacing. Now: this handoff; at 99% sends the priority stop. Routines: weekday 8 AM ET owner report; usage pacing until the reset; handoff/stop watcher.
- **Researcher** `2e46c557-1340-400f-ae50-6e4446cc647a`: market and competitor research. Did: AI-video feature census, launch-completeness round 4, AI Studio pricing (KIE vs Higgsfield: only Veo 3.1 and Hailuo profitable), cheaper sources and ads memo (`research/ai-studio-cheaper-sources-and-ads.md`), captions competitors, long-form competitors, motion graphics, AI assistant teardown. Current task: unconfirmed (last assigned the ad studio sources memo).
- **Product Manager** `c4c535e3-2937-46a3-80be-88f643a52d50`: specs and contracts. Did: `PRODUCT_V1.md`, `specs/pm/*` (editing assistant, route restructure, honest credits, motion graphics, cleanup restore, ad studio), `docs/contracts/ad-studio-v1.md`. Now: contract owner for the ad studio build; waiting on John for the open decisions below.
- **Backend Engineer "New"** `8508ade4-9425-4db7-8d32-a8265e0904e7`: backend and workers, deploys. Main usage driver. Did: unified clipper (#1138), clipper fixes (#1083, #1108, #1111, #1152 live parity), streamer unified run (#1146), YouTube video backend (#1143), AI Captions backend (#1147), release PRs (#1142, #1144, #1153). Now: confirming both workers run the #1153 code, then the remaining live-batch fixes (stage logs for captions/youtube/studio, double-run guard, list payload thumbnails, streamer friendly errors, crop offset) and ad studio B1-B3.
- **Frontend Engineer** `610ea706-4ddd-4847-a8be-e9d513f1c772`: Next.js UI. Did: `/app/studio` UI (#1139), unified results (#1141), clipper QA fixes (#1149), YouTube video UI (#1150), streamer grid (#1148), AI Captions UI (#1151), ad studio F1 (#1154, open, mocked), Studio preview screenshots in `research/studio-preview/`. Now: waiting on backend B2 to do F2; frontend items from the live batch log.
- **Landing Pages** `1a3a4a0a-1bd1-4d80-9197-eb3f41d301e4` (on-call): marketing pages. Did: AI Clips and Video Editing landing pages (#1082), marketing home (#1112). Next when woken: `/ai-captions`, `/youtube-video`, ad studio landing (slug pending John). Outcome-first copy, no `$`.
- **QA Engineer** `a5d7df12-c8f9-48e9-9808-8d4c1652f1fc` (on-call): independent testing on live. Did: live pass on `/app/clips` at 2:17-2:25 AM ET (found the 0-clip critical, project `proj_f32e136d…`). Next: retest unified clipper checks 3-7 on the deployed build, then the full live pass, logging to `qa/live-batch-errors-2026-11-10.md`.
- **Video Quality** `3a810a68-4611-4a84-bc31-e293bfa6c829` (on-call): watches real exports for clip/edit/render/AI changes. Did: reviews of #1081, #1083, #1106, #1109, #1111 (`transovo_team/video_quality/`), benchmark set. Next: review real outputs from the live clipper/YouTube/captions runs and later one real ad.
- **Security** `6d0a56bd-47cc-480a-96d6-9fb799624a89` (on-call, on hold): baseline at `security/baseline-2026-11-09.md` (keep out of the public repo): 5 criticals (SEC-001 service_role key in public git history, SEC-002 unsigned session cookie, SEC-003 no caller auth on new-app APIs, SEC-004 no RLS on 155 tables, SEC-005 root Next.js RCE). John lifted the release block on feature PRs (Nov 9 8:18 PM ET) and put security on hold until features work. John has been told once about SEC-001; don't re-nag. Repo is public; secret scanning and Dependabot are off.
- **DevOps** `cdb84bac-1eb8-42bf-a4b0-4aa08b140379` (on-call): server, deploys, logs. Did: the logs runbook and 14-day log archive cron. Next when woken: slow or failed builds, disk space, worker deploys. Master has no branch protection (Projects board creation failed: the token lacks project write).
- **Customer Support** `f5bb8b81-ab50-46bb-8b6c-86b74e68c341` (on-call): knowledge base at `support/knowledge_base.md`. Not active; no users yet.
- **Growth & Analytics** `1fa6f991-42c1-48ba-8818-b5e3151081ac` (on-call): analytics baseline at `analytics/baseline-2026-11.md`, Google Ads keyword work (`research/keywords-for-planner.txt`). Not active.
- (Grok Bot `04661bbc-cc5f-4946-9d58-cc948d106ebb` is John's separate general assistant, not on the team.)

## 8. Open decisions waiting on John

1. **AI Captions credits**: how many credits a captions-only run costs (competitor reference in `research/ai-captions-competitors.md`; one competitor makes captions free and charges for the upload).
2. **Credits per ad type** for the ad studio (storyline 15s/30s, image-to-ad 15s/30s). Config placeholders are `null`, so the UI shows "Credits TBD" (contract section 8).
3. **Ad studio landing slug**: `/ai-ads` suggested, unconfirmed.
4. **Kling Avatar**: official Kling Avatar isn't in the current model registry. Add it or not (the preferred in-registry path is `veo-3.1-lite`).
