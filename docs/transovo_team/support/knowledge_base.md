# Transovo AI — Customer Support Knowledge Base (first draft)

**Product:** Transovo Clips (AI video clipping / editing SaaS)  
**Owner:** John Jones  
**Site:** https://transovo.ai  
**Repo:** https://github.com/703deuce/sms (`new-app/` web, `worker/clips_worker/` workers)  
**Draft authored:** Mon Nov 9, 2026 evening America/New_York (box clock)  
**Author role:** Customer Support (Bot 11)

## Evidence legend (required on every claim)

| Tag | Meaning |
|---|---|
| **[PROD-VERIFIED]** | Observed live this turn (unauthenticated GET / public page) |
| **[IN-MASTER]** | Code on GitHub `master` that the live web `commitSha` includes |
| **[CODE-ONLY/UNCONFIRMED]** | In master or a branch, feature-flagged, or cannot confirm deployed worker/env |
| **[UNKNOWN]** | Mentioned historically or implied; not confirmed in code or production this turn |

**Hard rules for support answers:** Never invent features, limits, or numbers. Never show `$` amounts to customers — **credits only**. Never reveal secrets, tokens, signed URLs, or other customers’ data. Prefer non-destructive troubleshooting. Do not promise refunds, credit restores, or fix ETAs unless CoS/PM/billing process authorizes them.

---

## Deploy snapshot (this draft)

| Surface | Value | Evidence |
|---|---|---|
| Live web `GET https://transovo.ai/api/health` | `ok:true`, `app:"transovo-new-app"`, `version:"0.1.0"`, `db:true`, `commitSha:"9fdaad09265742d16803599adf0ecb8037c9e61d"` | **[PROD-VERIFIED]** 2026-11-09 ~7:57–8:00 PM ET |
| GitHub `master` HEAD | Same SHA `9fdaad09265742d16803599adf0ecb8037c9e61d` — message `fix(clips): scale QA budget and repair every stitch opening (#1081)` | **[IN-MASTER]** via GitHub API |
| Web vs master | **Identical** (`ahead_by:0`) | **[PROD-VERIFIED]** + **[IN-MASTER]** |
| Clips worker `CLIPS_WORKER_GIT_SHA` | **Not checked this turn** (no SSH; read-only) | **[UNKNOWN]** |
| GitHub issues (non-PR) | `has_issues:true` but **0 open non-PR issues** returned; closed non-PR sample also empty. Product bugs are tracked mainly via PRs / internal QA notes. | **[IN-MASTER]** API |

Recent merged product PRs on this tip (newest first): [#1081](https://github.com/703deuce/sms/pull/1081), [#1080](https://github.com/703deuce/sms/pull/1080), [#1079](https://github.com/703deuce/sms/pull/1079), [#1078](https://github.com/703deuce/sms/pull/1078), [#1077](https://github.com/703deuce/sms/pull/1077), [#1076](https://github.com/703deuce/sms/pull/1076), … through Clean Take / Mode 2 work (#1053–#1062). Open WIP PRs (not customer-facing until merged+deployed): [#1082](https://github.com/703deuce/sms/pull/1082) marketing landings, [#1075](https://github.com/703deuce/sms/pull/1075), [#1074](https://github.com/703deuce/sms/pull/1074), [#1070](https://github.com/703deuce/sms/pull/1070).

**Worker caveat:** [#1080](https://github.com/703deuce/sms/pull/1080) changed `worker/clips_worker/ai_producer_agent/finder/watch.py` (full-episode analysis chunking). Web includes that commit; **whether clips workers have been redeployed to the same SHA is UNKNOWN this turn.** Treat full-file 10-hour analysis behavior as **[CODE-ONLY/UNCONFIRMED]** until DevOps confirms worker SHA.

---

## 1. Accounts, subscriptions, credits

### What it does
- Product UI is **credits-only** for paid actions; provider `$` costs must never appear to customers. **[IN-MASTER]** `new-app/lib/clips/credit-cost.ts`, team hard rule.
- Live help chrome shows **“Test mode — All features unlocked. No billing.”** **[PROD-VERIFIED]** `GET https://transovo.ai/app/help`.
- Entitlement gate `FEATURES_ALL_UNLOCKED` defaults **true** unless env is explicitly `false`/`0`. `checkCreditBalance` currently always `{ ok: true }`. **[IN-MASTER]** `new-app/lib/billing/entitlements.ts`.
- Unit credit costs in code (for when billing is enforced): `process_minute=1`, `ai_broll_shot=3`, `music=2`, `thumbnail=3`, `dub_minute=6`. **[IN-MASTER]** same file. **Do not imply these are charged live today** — help + entitlements say unlocked / no billing.
- Clip-agent credit policy (intended rule): charge **per published kept clip**, **0** credits if status is `failed` / `canceled` / `capped` or `publishedClipCount<=0`. Comment notes enforcement may still be off. **[IN-MASTER]** `new-app/lib/clips/credit-policy.ts`, reinforced in [#1080](https://github.com/703deuce/sms/pull/1080).
- Public pricing / plan tiers / signup-login marketing URLs: **not found** for launch claims. **[PROD-VERIFIED]** / **[UNKNOWN]** per `/workspace/handoff/landing_pages_brief.md` + live site redirects.

### How a customer uses it
1. Open https://transovo.ai → app shell (`/app/clips`, `/app/home`). **[PROD-VERIFIED]** routes return 200.
2. Settings at `/app/settings` (CTA in landing brief). **[IN-MASTER]** / brief.
3. Until billing is turned on, treat “credits” questions as: balance UI may exist but **charges are not enforced** — escalate billing disputes to Chief of Staff; do not invent refunds.

### Statuses / errors
- Project fields `creditsReserved`, `creditsCaptured` exist on `ClipProject`. **[IN-MASTER]** Prisma `ClipProject`.
- AI Producer runs store internal `geminiUsd` / `costUsdEstimated` — **never quote these `$` fields to customers**. **[IN-MASTER]** `AiProducerAgentRun`.

### Non-destructive troubleshooting
1. Confirm help banner still says Test mode / no billing before telling a customer they were charged.
2. Collect workspace / project IDs they can see in the URL; do not access other workspaces.
3. Escalate any claimed charge, missing credits, or plan change to **Chief of Staff** (billing/account).

### Known issues
- Honest credits for long sources is a **backlog MUST-HAVE**, not a live billing product. **[UNKNOWN]** as customer policy — `/workspace/transovo_feature_backlog.md` item 2.
- No public pricing page. **[PROD-VERIFIED]** landing brief + 404s for `/pricing`.

---

## 2. Uploads

### What it does
- Customers create projects from **file upload**, **source URL / link**, **blank project**, or (code path) prompt. **[IN-MASTER]** `new-app/lib/clips-api.ts` (`startUpload`, `createProject`, `createProjectFromLink`, `createBlankProject`).
- Browser uploads go **direct to storage** (TUS or S3 multipart); web container chunk staging is deprecated. **[IN-MASTER]** `new-app/lib/server/clips/upload-limits.ts`, `upload.ts`.
- Policy defaults in code: **max duration 10 hours** (`CLIPS_UPLOAD_MAX_DURATION_MS`), **max size 30 GB** (S3/streamer default), 8 MB app chunk size constant, Supabase single-object default 50 MB when not on S3 multipart. Env can override. **[IN-MASTER]** `upload-limits.ts`; raised in [#1080](https://github.com/703deuce/sms/pull/1080).
- **Effective** live byte limit depends on storage driver / env — public limits API requires auth (`401 Unauthorized` unauthenticated). **[PROD-VERIFIED]** `GET /api/clips/uploads/limits` → 401. Quote policy defaults carefully as **code defaults**, not measured live effective max.
- BYO short clip path: max **3 minutes** (`180_000` ms). Message: “Bring-your-own clips can be up to 3 minutes. Use Find clips for longer videos.” **[IN-MASTER]** `byo-project.ts`, worker `user_errors.py`.
- Full-video edit projects: up to **3 hours**. Message: “Full videos can be up to 3 hours. Trim the file or upload it in parts.” **[IN-MASTER]** worker `user_errors.py` / FV1 notes.
- Upload progress states: `idle | uploading | finalizing | complete | error | canceled`. **[IN-MASTER]** `upload.ts`.
- Upload record default status `PENDING`. **[IN-MASTER]** Prisma `ClipUpload`.

### How a customer uses it
1. `/app/clips/new` (or Clips home) → upload file or paste link. **[PROD-VERIFIED]** help copy; **[IN-MASTER]** routes.
2. Wait for transcription / processing (project status pipeline below).
3. Full-length edit intent: `/app/clips/new?intent=full`. **[IN-MASTER]** / landing brief.

### File types
- Client sends `file.type || 'video/mp4'`. **[IN-MASTER]** `upload.ts`.
- Exact accepted extension/MIME allow-list for production UI: **[UNKNOWN]** this turn (not extracted from a live file picker `accept=` attribute). Do not invent “we support X/Y/Z” beyond “video upload / mp4 default.”

### Statuses / errors (upload)
| Symptom / code | User-facing guidance | Source |
|---|---|---|
| HTTP 413 / size exceeded | “This file is larger than the current upload limit ({maxLabel}). Paste a link instead, or contact support.” Not retryable for same file. | **[IN-MASTER]** `upload-limit-message.ts`, `upload-errors.ts` |
| 410 | Old staging path retired → Retry (resume direct to storage). | **[IN-MASTER]** |
| 401/403 | Refresh and try again. | **[IN-MASTER]** |
| 5xx | Server error; retry resumes stored parts. | **[IN-MASTER]** |
| Network / failed to fetch | Check connection; Retry resumes. | **[IN-MASTER]** |
| Incomplete / chunk mismatch / deploy interrupt | Retry to resume. | **[IN-MASTER]** |

### Non-destructive troubleshooting
1. Ask file size + approximate duration; compare to 10 h / 30 GB **policy** and BYO 3 min / full-video 3 h paths.
2. Suggest paste-a-link if over size.
3. Retry once for network/5xx; do not recommend re-uploading a huge file if parts may resume.
4. If project stuck in `UPLOADING`/`PREPARING`, collect `projectId` from URL and escalate to QA + Backend after one retry/reload.

### Known issues
- Agent-only upload retention / server-started batch after READY: fixed in [#1071](https://github.com/703deuce/sms/pull/1071) (on master / web tip ancestry). Live e2e “close tab” acceptance **unverified** in PR review notes. **[CODE-ONLY/UNCONFIRMED]** as customer-proof.

---

## 3. Streamer clipping

### What it does
- Streamer product at `/app/streamer` (also autopull, channels). **[PROD-VERIFIED]** `/app/streamer` → 200; **[IN-MASTER]** `app/app/streamer/*`, `lib/nav.ts`.
- Supported URL platforms in parser: **Twitch** and **Kick** (VOD, highlight, clip, channel). YouTube is **not** in `parseStreamUrl`. **[IN-MASTER]** `new-app/lib/streamer/url.ts`.
- Kick bare channel page rejected with: “That's a channel page. Paste a Kick replay (…/videos/…) or clip link.” **[IN-MASTER]**
- Worker jobs: `STREAM_IMPORT`, `STREAM_AGENT_PREPARE`, `STREAM_AGENT_BATCH`, `STREAM_ANALYZE`, `STREAM_RENDER`, `STREAM_RELAYOUT`, `STREAM_CLEANUP`, `STREAM_MONTAGE`, `STREAM_AUTOPULL`. **[IN-MASTER]** `worker/clips_worker/job_types.py`.
- On-demand window prepare (15s–20m historically in PR notes) + durable full-VOD agent batches so browser need not stay open. **[IN-MASTER]** PRs [#1064](https://github.com/703deuce/sms/pull/1064), [#1066](https://github.com/703deuce/sms/pull/1066).
- Short agent clip modes 30/60/90s; gaming windows may accept as few as **8 words** (long-form rough-cut kept 30-word minimum). **[IN-MASTER]** [#1065](https://github.com/703deuce/sms/pull/1065), [#1063](https://github.com/703deuce/sms/pull/1063).

### How a customer uses it
1. Open Streamer → paste Twitch/Kick VOD or clip URL (not a bare Kick channel).
2. Optionally prepare a time window, run agent modes, open results in Clip Studio.
3. For full VOD, batch can continue without keeping the tab open (after #1066).

### Statuses / errors
- Historical worker error: Twitch archived segment `range_outside_media` — fixed in [#1068](https://github.com/703deuce/sms/pull/1068). If a customer still sees range/outside-media failures on Twitch archives, treat as regression → QA + Backend.
- Streamer import URL `unsupported` from parser. **[IN-MASTER]**

### Non-destructive troubleshooting
1. Confirm URL host is twitch.tv / clips.twitch.tv / kick.com and kind is VOD/clip (not unsupported).
2. For Kick channel-only links, ask for `/videos/…` or clip URL.
3. Note time hint `?t=` is parsed when present.
4. If prepare/batch fails, capture project/batch IDs from UI and escalate; do not re-trigger paid analysis loops.

### Known issues
- Streamer gaps called out as LIVE-with-gaps in Nov 8 handoff. **[UNKNOWN]** which gaps remain on today’s tip without a fresh streamer e2e.
- Worker deploy lag can leave streamer window/timebase fixes behind web — confirm worker SHA with DevOps before blaming “old bug.”

---

## 4. Podcast clipping

### What it does
- No separate “Podcast” app route; podcasts use the **upload / link clipper** with genre `podcast` (label “Podcast / interview”) and tool preset key `podcast-to-shorts`. **[IN-MASTER]** `new-app/lib/clips/settings.ts`.
- Modes include `auto | talking | anything | captions`. **[IN-MASTER]**
- Clip length choices: Auto (AI up to 90s) or fixed 15 / 30 / 60 / 90s. **[IN-MASTER]** `clip-length.ts`.
- Help FAQ describes: upload → wait for transcription and clip suggestions → review → edit/export. **[PROD-VERIFIED]** `/app/help`.

### How a customer uses it
1. Upload or link a long talking-head / podcast file.
2. Optionally set genre to Podcast / interview and target length.
3. Review suggested clips; open editor; export.

### Non-destructive troubleshooting
1. If no clips appear, check project status (still `TRANSCRIBING` / `FINDING_CLIPS` vs `FAILED`).
2. Suggest waiting for proxy; reload if preview empty (help FAQ). **[PROD-VERIFIED]**
3. For mid-sentence / incomplete clips, note editorial QA work in #1079–#1081 is aimed at this; do not promise perfect cuts.

### Known issues
- Competitive complaint theme (mid-sentence cuts) is industry-wide; Transovo is actively tightening editorial gates — quality still imperfect on watched runs (see Story / clip sections). **[CODE-ONLY/UNCONFIRMED]** for “fixed for all podcasts.”

---

## 5. Continuous vs stitched / assembled Story clips

### Terminology (support must not invent)
| Customer wording | Product / code name | What it is | Evidence |
|---|---|---|---|
| Single continuous moment / “one clip” | `clip_moment_v1` | Bounded short clip (30/60/90s targets in UI) from one window | **[IN-MASTER]** settings `autoAgentClipMode`, types `storyMode` |
| Multi-moment short Story (stitched) | `clip_story_v1` | Assembled from **≥2 distinct source-moment clusters** (≥2500ms apart per #1077); Story/Footage/Flow/QA pipeline | **[IN-MASTER]** [#1076](https://github.com/703deuce/sms/pull/1076), [#1077](https://github.com/703deuce/sms/pull/1077) |
| Long-form Single-Source Story | Mode 1 / `just_chatting_rough_cut` + `roughCutIntent: 'story'` | Coherent longer edit from one recording | **[IN-MASTER]** types; handoff |
| Highlights (multiple standalone) | `roughCutIntent: 'highlights'` | Curates multiple moments rather than one narrative | **[IN-MASTER]** types |
| Multi-source Story | `multi_source_story_v1` | Story from 2–3 independent recordings | **[IN-MASTER]** types, `MULTI_SOURCE.md` |
| Clean Take | `clean_take_v1` | Remove false starts / setup chatter; keep program | **[IN-MASTER]** |

### Continuous vs assembled (how to explain)
- **Continuous / moment:** one self-contained stretch of source time (still may have internal trims).
- **Stitched / assembled Story:** multiple passages joined (crossfade / punch-in joins added in #1081). QA should repair mid-phrase openings and dangling pronouns before publish. **[IN-MASTER]** [#1081](https://github.com/703deuce/sms/pull/1081).
- Publish / auto-export gate: export only when editorial QA **completes and passes**; failed/incomplete QA holds **editable draft**. **[IN-MASTER]** #1081 (on live web SHA).

### Statuses / errors
- AiProducer phases: `ingest → inventory → decide → plan → validate → apply → preview_render → self_review → finish`. **[IN-MASTER]** `phases.ts`.
- Run row default status `"queued"` (string). **[IN-MASTER]** Prisma.
- Known failure strings from past runs (do not treat as current unless reproduced): `specialist_budget_exhausted`, `specialist_footage_did_not_submit`, `rough_cut_assembly_segment_failed`, `no_valid_moments_after_normalize`, `range_outside_media`. **[IN-MASTER]** / handoff / PR bodies.

### Non-destructive troubleshooting
1. Identify mode from UI labels / run config if visible (`clip_moment_v1` vs `clip_story_v1` vs Producer modes).
2. If only drafts held and few published: likely QA veto — open editable draft; do not auto-retry paid runs.
3. Escalate quality complaints with `aprun_…` / `proj_…` / `clip_…` IDs to QA + Video Quality.

### Known issues
- After #1080, first full-file Story run `aprun_851c73b3` published 1 clip / held 15 drafts due to QA budget exhaustion — addressed by #1081. **[IN-MASTER]** PR body; live web includes fix; **customer impact on workers** depends on worker SHA **[UNKNOWN]**.
- Watched Story/clip quality historically imperfect (mid-sentence joins, disjoint highlights). **[PROD-VERIFIED]** historically in handoff watches; not re-watched this turn.

---

## 6. Long-form Story

### What it does
- [#1080](https://github.com/703deuce/sms/pull/1080): removes prior ~20-minute clip-agent window cap; a Story/Moment run may cover a whole file up to **10 hours** / **30 GB** policy; analysis chunks then global select/stitch. Talking-head 9:16 clip-mode exports default **`speaker_follow`**. **[IN-MASTER]** (web tip includes #1080+#1081).
- Soft length targets historically included 30s / 60s / 90s and longer buckets for conversational cuts (handoff). Exact UI options on live tip: **confirm in product** before quoting. **[CODE-ONLY/UNCONFIRMED]** for every length bucket label.
- Full-video **manual** edit path: ~3 h ceiling (separate from 10 h upload/agent policy). **[IN-MASTER]** `FULL_VIDEO_MAX_DURATION_MS`.

### How a customer uses it
1. Upload/link long source → choose Story / agent clip Story (or AI Producer New edit Story).
2. Wait for analysis; review published clips vs held drafts.
3. Open in editor; export when ready.

### Non-destructive troubleshooting
1. Distinguish “full episode agent Story” (10 h policy) vs “Edit a full video” manual project (3 h).
2. Long renders take longer — help says longer sources may take more time. **[PROD-VERIFIED]**
3. Do not start duplicate agent runs.

### Known issues
- Worker chunking for full-episode analysis needs matching worker deploy (**[UNKNOWN]** this turn).
- Editorial quality still under active fix (#1079–#1081). Do not claim “broadcast ready.”

---

## 7. Multi-source Story

### What it does
- Mode 2 `multi_source_story_v1`: assemble a story from multiple distinct uploads. **[IN-MASTER]** types; PRs #1048–#1052 family.
- Representation decision: multi-source uses **script composition EDL** so each segment can carry its own transcript words; single-source uses normal `ClipEditsV2`. **[IN-MASTER]** `MULTI_SOURCE.md`.
- Captions require words per EDL source; validator rejects sources without words. **[IN-MASTER]**

### How a customer uses it
1. Import/attach multiple sources into a Producer multi-source run (API under `/api/ai-producer-agent/multi-source`, `/runs`). **[IN-MASTER]** route listing.
2. Review assembled project; edit; export.

### Non-destructive troubleshooting
1. Confirm each source finished transcription before blaming “missing captions.”
2. Escalate with all `proj_` / `aprun_` IDs.

### Known issues
- Editorial quality mixed in Nov 8 watched runs. **[UNKNOWN]** on today’s tip without retest.
- Feature visibility depends on AI Producer agent flag. **[CODE-ONLY/UNCONFIRMED]** whether `NEXT_PUBLIC_AI_PRODUCER_AGENT` is on in production env (help implies broad unlock / test mode).

---

## 8. Clean Take

### What it does
- Mode 3 `clean_take_v1`: clean raw talking recordings — remove false starts, production chatter, unfinished thoughts; keep real program. **[IN-MASTER]** types; PRs [#1053](https://github.com/703deuce/sms/pull/1053)–[#1061](https://github.com/703deuce/sms/pull/1061).
- Uses visual+audio evidence path; 1 FPS analysis sampling for all three Producer modes after [#1062](https://github.com/703deuce/sms/pull/1062).

### How a customer uses it
1. Start AI Producer Clean Take on a raw talking source (not a pre-edited demo).
2. Review cuts in editor; restore/adjust as needed; export.

### Non-destructive troubleshooting
1. Prefer raw continuous talk sources; packaged demos are poor tests (handoff).
2. If run fails validation three times, capture error text; recent PRs improved repair hints.
3. Do not auto-retry paid runs.

### Known issues (from watched exports — quality, not necessarily “down”)
- Latest Cinestudy replay still imperfect: sideways footage segments, fragmented topic change, mid-sentence ending (Nov 8 handoff). **[UNKNOWN]** whether later PRs fully fixed customer-facing quality.
- Treat as **PIPELINE READY / quality improving**, not final. Escalate quality complaints to Video Quality + QA.

---

## 9. Clip Studio & full editor

### What it does
- **Clip Studio** route under project: `…/clips/[projectId]/studio` (plus `edit`, `script`, `video`). **[IN-MASTER]** app contents listing; introduced streamer-first in [#1063](https://github.com/703deuce/sms/pull/1063).
- **Full / manual editor:** `/app/clips/[projectId]/edit/[clipId]` — CapCut/Descript-class NLE on same stack (timeline, transcript, captions, layouts, B-roll, brand, export). **[IN-MASTER]** / handoff; help FAQs **[PROD-VERIFIED]**.
- Motion Graphics control in main editor rail + Clip Studio toolbar; Producer `add_text_overlay` tool; false-success chat fixed in [#1078](https://github.com/703deuce/sms/pull/1078) (**on live web**).
- Script / Descript editor (`/app/editor`, script routes): **default flag OFF** (`SCRIPT_EDITOR_ENABLED`). **[IN-MASTER]** `script-editor-enabled.ts`.
- AI Video / T2V: **default flag OFF**. **[IN-MASTER]** `ai-video-enabled.ts`.
- Rooms / Record: gated (`recordingOnly` / `soloRecordingOnly` nav). **[IN-MASTER]** `nav.ts`.
- Clip editor AI extras (music/SFX gen tiles): default off unless `NEXT_PUBLIC_CLIP_EDITOR_AI_EXTRAS=1`. **[IN-MASTER]**

### How a customer uses it
1. From project → Studio or open a clip → Edit.
2. Trim on transcript; change layout/aspect; captions; B-roll/music; Export MP4.
3. Brand kit: `/app/clips/brand`. **[IN-MASTER]** nav; help.

### Non-destructive troubleshooting
1. Preview empty: wait for proxy; reload (help). **[PROD-VERIFIED]**
2. Caption/layout changes need **re-export** (do not apply to old files). **[PROD-VERIFIED]** help FAQ.
3. Stock B-roll missing: asset may still be caching. **[PROD-VERIFIED]**
4. Silence trim: shortens pauses; preview may still play full until render applies cuts. **[PROD-VERIFIED]**
5. Undo/autosave issues: collect clip ID; escalate to QA (do not DB-edit).

### Known issues
- **F7 background-removal composite** last failed Nov 5 Retest #9 (person keep / misalignment). No later numbered retest found in Nov 8 handoff. **[UNKNOWN]** on current tip — do not claim fixed. Escalate to QA.
- Long 1080p exports historically slow (~19 min for ~12 min source in old notes). **[UNKNOWN]** current performance.
- In-editor Producer must Accept/save drafts — #1078 stopped false “success” toasts. If customers still see false success, treat as regression.

---

## 10. Captions & layouts

### Captions
- Default captions enabled with preset `bold_pop` / slug `bold-pop` (“Bold Pop”). **[IN-MASTER]** settings + caption-presets.
- Built-in presets (slug → name): Bold Pop, Clean White, Boxed, Karaoke, Minimal, Neon, Bounce, Typewriter, Slide Up, Highlighter, Word Pop, Karaoke Highlight, Heavy Outline, Minimal Lower Third. **[IN-MASTER]** `caption-presets.ts`.
- Animations in preset model: `none | pop | bounce | slideup | typewriter | karaoke | glow`. Positions: bottom/middle/top. **[IN-MASTER]**
- ASR languages in project settings: `auto | en | es | fr | de | pt | it | nl`. **[IN-MASTER]**
- Help: choose preset, position, animation, words per line; preview matches export styling. **[PROD-VERIFIED]**
- Soft subs option exists on deliver model. **[IN-MASTER]** `export-deliver.ts`.

### Layouts & aspect
- Layout modes: `auto`, `speaker_follow`, `dynamic`, `split_debate`, `grid`, `grid3`, `grid4`, `locked_off`, `split`, `fill`, `fit`. **[IN-MASTER]** settings.
- Project aspect ratios: `9:16`, `4:5`, `1:1`, `16:9`. **[IN-MASTER]**
- Export aspects also include `4:3`, `21:9`, and custom `custom:WxH` (240–3840, ratio ≤4). **[IN-MASTER]** `export-aspect.ts`.
- Help mentions speaker follow, fill, center crop + 9:16 / 1:1 / 4:5 / 16:9. **[PROD-VERIFIED]**
- Clip-mode talking-head 9:16 defaults to **speaker_follow** (not blurred full_frame) after #1080. **[IN-MASTER]**

### Non-destructive troubleshooting
1. Re-export after caption/layout changes.
2. If captions missing: check transcription finished; language setting; captions enabled.
3. Layout greyed on some aspects — ask aspect; escalate if stuck.

### Known issues
- 16:9 caption presets historically untested live (Oct 31 leftover). **[UNKNOWN]** today.

---

## 11. Motion graphics

### What it does
- AI Motion Graphics feature merged in [#1067](https://github.com/703deuce/sms/pull/1067) (panel, styles, APIs, usage accounting; worker **export test** present). Live render quality / save-reload **not certified** in Nov 9 PR review. **[IN-MASTER]** / review notes → treat customer claims carefully.
- Motion Graphics control exposed in editor + Clip Studio (#1078). **[IN-MASTER]** + on live web.
- Automatic transcript-grounded motion planning before clip export after edit (#1077); motion failure must **not** block a usable clip. **[IN-MASTER]**
- Safe-area checks for portrait motion plans (#1079); **face tracking is not claimed**. **[IN-MASTER]**
- Optional post-cut motion agent still open WIP [#1070](https://github.com/703deuce/sms/pull/1070) — **not** shipped. **[CODE-ONLY/UNCONFIRMED]**

### Non-destructive troubleshooting
1. If motion missing but clip exports: expected when planning fails (#1077).
2. If Motion Graphics control missing: confirm they’re on tip ≥ #1078; hard-refresh.
3. Escalate broken overlays with clip ID + screenshot to QA + Frontend/Backend.

---

## 12. Rendering & exports

### What it does
- Primary path: enqueue `RENDER_CLIP` → worker render → `ClipRender` row. **[IN-MASTER]** job_types, Prisma.
- Deliver formats: `mp4 | mov | gif | mp3 | wav | m4a | flac | png`. Codecs `h264 | hevc`. Quality `standard | high | max`. Resolutions `720p | 1080p | 1440p | 2160p` (4K capped for long media in normalizer). **[IN-MASTER]** `export-deliver.ts`.
- Default deliver: MP4 H.264 standard, fps `source`. Dialog default resolution **1080p**, layout `speaker_follow`. **[IN-MASTER]** `export-dialog-defaults.ts`.
- Help emphasizes Export MP4; 1080p via Export resolution picker. **[PROD-VERIFIED]**
- Entitlement feature keys include `export_1080p`, `no_watermark` (currently unlocked in test mode). **[IN-MASTER]**
- Share links model exists (`ClipRenderShareLink`). **[IN-MASTER]**
- Export platform hints in API types: `tiktok | youtube_shorts | Instagram_reels` (type only — not the same as live social publish). **[IN-MASTER]** `clips-api.ts`.

### Render / job statuses
**ClipProjectStatus:** `DRAFT`, `UPLOADING`, `QUEUED`, `PREPARING`, `TRANSCRIBING`, `SCANNING`, `FINDING_CLIPS`, `REFRAMING`, `RENDERING`, `READY`, `FAILED`, `CANCELED`. **[IN-MASTER]** Prisma + `eta-poll.ts`.

**ClipJob.status (string):** `QUEUED`, `RUNNING`, `FAILED`, `DONE` (also requeue paths). Default `QUEUED`. **[IN-MASTER]** Prisma + `job_contract.py`.

**ClipRenderStatus:** `QUEUED`, `RENDERING`, `READY`, `FAILED`, `EXPIRED`. **[IN-MASTER]** Prisma.

**Upload progress:** see Uploads section.

### Export error mapping (user-facing)
| Internal signal | Message shown | Source |
|---|---|---|
| empty | Export failed. Try again or edit the clip and re-export. | **[IN-MASTER]** `export-error.ts` |
| no space / ENOSPC | Server ran out of disk space during export. | same |
| timeout | Export timed out. Try again with a shorter clip. | same |
| ffmpeg / non-zero / subprocess | Video processing failed. Try trimming or changing layout. | same |
| not found / missing | Source media is missing. Re-open or re-upload. | same |
| download_object … not associated | Internal storage bug — retry; if persists contact support. | same |
| UnboundLocalError | Internal processing error — retry. | same |

Worker also maps DB/internal markers to “Processing failed. Retry processing.” **[IN-MASTER]** `user_errors.py`.

### Non-destructive troubleshooting
1. Check render status READY vs FAILED; read sanitized error only.
2. Retry export once; shorten range if timeout.
3. Confirm source/proxy still present; re-open project.
4. For disk-space errors → escalate **incident** to DevOps + CoS immediately.
5. Do not delete customer media or force re-queue beyond UI Retry.

### Known issues
- Historical AI Producer export “Not found” fixed in #1016 (ancestry). If recurs, regression.
- Long exports slow; no claim of chunked parallel render. **[UNKNOWN]** current SLA.

---

## 13. Social publishing

### What it does / does not
- Composition social publish feature flag: **default OFF** unless `NEXT_PUBLIC_FEATURE_COMPOSITION_SOCIAL_PUBLISH=1`. Comment: “default off until worker + OAuth ship.” **[IN-MASTER]** `composition-social-publish.ts`.
- `/app/integrations` catalog in code is **Calendar / CRM / Payments** (Google, Microsoft, Zoho, Pipedrive, Salesforce, Stripe) — SMS/appointments oriented, **not** TikTok/YouTube/Instagram publish for clips. **[IN-MASTER]** `integrations/catalog.ts`.
- Export **platform presets** (TikTok / Shorts / Reels) may exist as export sizing hints — that is **not** authenticated publishing. **[IN-MASTER]** type on export API.
- Backlog item 11 (schedule/publish after approve) is a **differentiator request**, not a verified live feature. **[UNKNOWN]** as shipped product.

### Support stance
Tell customers: **download/export then upload manually** to social apps, unless PM/CoS confirms OAuth publish is enabled in production. Do not promise in-app posting.

---

## Job status & error code reference

### Project pipeline (`ClipProject.status`)
| Status | Meaning (support language) |
|---|---|
| DRAFT | Created; not fully processing |
| UPLOADING | File transfer in progress |
| QUEUED | Waiting for a worker |
| PREPARING | Import/prepare |
| TRANSCRIBING | Speech-to-text |
| SCANNING | Content scan |
| FINDING_CLIPS | AI clip discovery / picker |
| REFRAMING | Layout / crop work |
| RENDERING | Project-level render stage |
| READY | Usable |
| FAILED | Failed — read `error` (sanitized) |
| CANCELED | User/system canceled |

### Clip jobs (`clip_jobs.status`)
| Status | Meaning |
|---|---|
| QUEUED | Waiting / requeued |
| RUNNING | Worker holds lock |
| DONE | Finished successfully |
| FAILED | Failed after attempts |

Common **job types** (not all user-visible): `IMPORT_URL`, `PROCESS_PROJECT`, `FIND_CLIPS`, `RENDER_CLIP`, `STREAM_*`, `AI_PRODUCER_AGENT_ANALYZE`, `AI_PRODUCER_AGENT_RUN`, `MEDIA_TRANSCRIBE`, `DUB`, `MUSIC`, `THUMBNAIL`, `BG_MATTE_PREVIEW`, `REFRAME_CROP`, … **[IN-MASTER]** `job_types.py`.

### Renders (`ClipRender.status`)
`QUEUED` → `RENDERING` → `READY` | `FAILED` | `EXPIRED`.

### AI Producer
Phases listed in §5. Run status strings include at least `queued` (default); treat other values as observed in UI/API before documenting to customers.

### Useful error / message catalog
| Code / message fragment | Safe customer explanation | Escalate? |
|---|---|---|
| Upload limit / 413 | File over upload limit — paste link or smaller file | Support → if policy unclear, CoS |
| BYO 3 minutes | Use Find clips / full pipeline for longer | — |
| Full video 3 hours | Trim or split upload | — |
| Kick channel page | Need replay/clip URL | — |
| unsupported (streamer URL) | Not a supported Twitch/Kick link | — |
| range_outside_media | Window/timebase problem (Twitch archive historically) | QA + Backend if persists after #1068 |
| specialist_budget_exhausted | Agent hit step budget; may hold drafts | QA; check #1081 on tip |
| Export disk ENOSPC | Server disk full | **Incident** DevOps + CoS |
| Export timeout | Try shorter clip / retry | QA if widespread |
| Source media missing | Re-open / re-upload | QA if data loss |
| Processing failed. Retry processing. | Generic sanitized failure | QA + Backend after one retry |
| False Producer “success” | Should be fixed #1078; if seen, regression | QA + Frontend |

---

## Escalation map

| Category | Route to | Notes |
|---|---|---|
| Billing / account / credits / refunds / plan | **Chief of Staff** | No unauthorized credit changes; never invent refunds |
| Confirmed product bugs / reproducible failures | **QA** + **Backend (“New”)** | Include proj/clip/aprun IDs, status, sanitized error, SHA from `/api/health` |
| Feature requests / “can it do X?” gaps | **Product Manager** | Also log recurring themes for CoS |
| Onboarding friction / conversion / confusing first-run | **Growth & Analytics** | |
| Incidents (site down, mass export fail, disk, deploy stuck) | **DevOps** + **Chief of Staff** | |
| Editorial / AV quality of AI outputs | **Video Quality** (+ QA) | Attach watched notes if any |
| Security / data exposure | **Security** (critical → John via CoS) | |
| UI-only editor bugs | QA + **Frontend** | |

Agent ids: see `/workspace/transovo_team/TEAM.md` roster.

---

## Open questions for PM / CoS

These **must** be confirmed before telling customers as facts:

1. **Is billing/credits enforcement live for any workspace**, or is production still “Test mode — all features unlocked / no billing” for everyone?
2. **What are the customer-facing plans, credit allotments, rollover, and refund rules?** (Code has unit costs only; no public pricing.)
3. **Effective live upload max bytes** (storage driver: S3 multipart 30 GB vs Supabase ~50 MB object cap) — what do we advertise?
4. **Exact accepted file types/extensions** for upload (MIME allow-list)?
5. **Are YouTube / Drive / Dropbox imports supported in production** for the regular clipper (landing brief says yes; streamer parser is Twitch/Kick only)?
6. **Is AI Producer Agent (`NEXT_PUBLIC_AI_PRODUCER_AGENT`) enabled for all users**, and which modes appear in the New edit dialog (Story / Highlights / Clean Take / Multi-source / clip_moment / clip_story)?
7. **Clips worker SHA vs web `9fdaad09`** — especially whether #1080 worker watch-range chunking is live (affects full-episode Story).
8. **Can support promise “no credits burned on failed/empty clip runs”** as policy today, or only as intended rule?
9. **Social publishing:** any OAuth post-to-TikTok/Shorts/Reels enabled anywhere, or export-only forever for launch?
10. **Dubbing / AI music / Rooms / Script editor / T2V** — which are intentionally visible vs flagged off in prod?
11. **Background removal (F7):** still known broken, or fixed after Nov 5?
12. **Support channel of record** for customers (in-app “Contact support”, email address, Slack?) and SLA language we are allowed to use.
13. **Watermark / 1080p gating** when test mode ends — what changes for free vs paid?
14. Should support describe **clip_story_v1** as generally available, or still an experiment?

---

## Sources consulted (read-only)

- Live: `GET https://transovo.ai/api/health`, `/app/help`, `/app/clips`, `/app/streamer`, `/api/clips/uploads/limits` (401)
- GitHub `703deuce/sms` master via API (no clone): READMEs, `new-app/lib/**`, `worker/clips_worker/job_types.py` / `user_errors.py` / `job_contract.py`, Prisma enums, PR #1053–#1081 metadata
- `/workspace/transovo_team/TEAM.md`, `roles/11-customer-support.md`
- `/workspace/transovo_feature_backlog.md`
- `/workspace/handoff/landing_pages_brief.md`
- `/workspace/transovo-complete-agent-handoff-2026-11-08.md`
- `/workspace/transovo-recent-prs-review-2026-11-09.md`

**Not done this turn:** SSH / worker SHA check; authenticated product walkthrough; paid AI runs; creating issues/PRs.

---

*End of first draft. Update evidence tags when worker SHA is confirmed and after the next watched quality pass.*
