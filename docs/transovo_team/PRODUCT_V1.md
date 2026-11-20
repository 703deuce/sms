# Transovo v1 Product Offering & Roadmap

**Owner:** John Jones  
**Author:** Product Manager  
**Date:** Monday, 9 Nov 2026, America/New_York  
**Requested by:** Chief of Staff, on John’s direction  
**Status:** Product offering and build-order roadmap. AI editing assistant epic and Phase 1 issues: [#1114](https://github.com/703deuce/sms/issues/1114), [#1115](https://github.com/703deuce/sms/issues/1115), [#1116](https://github.com/703deuce/sms/issues/1116), [#1117](https://github.com/703deuce/sms/issues/1117). Motion graphics library (B0.5) issues: [#1119](https://github.com/703deuce/sms/issues/1119), [#1120](https://github.com/703deuce/sms/issues/1120), [#1121](https://github.com/703deuce/sms/issues/1121), [#1122](https://github.com/703deuce/sms/issues/1122), [#1123](https://github.com/703deuce/sms/issues/1123), [#1124](https://github.com/703deuce/sms/issues/1124). No engineering work has started from those issues yet.

This document is about the **product**: the full feature set across AI and video (clipping, editing, Story single- and multi-source, Clean Take, captions, layouts/reframe, and timeline), plus the ranked Round 5 AI additions. Credits, billing, pricing, and login/auth are deferred to the end and are not priced or packaged here. Researcher's Round 6 (wider features and standalone products) and Round 7 census additions are recorded in Section 9 as **candidates only** — John has not approved them, and they are not part of the approved build order in Sections 4–6.

## How this was assembled

Reused existing research; no new customer research was run.

- Researcher backlog, Rounds 1–6: `/workspace/transovo_feature_backlog.md`. Rounds 1–5 inform the approved lineup and build order. **Round 6 is listed in Section 9 only; it is PENDING JOHN DECISION and is not in the approved build order.**
- Round 7 census: `/workspace/transovo_team/research/ai-video-feature-census.md` (118 catalog features; every keyword-level CPC is recorded as “no data”). Strong new items and standalone entry products are in Section 9 only; they do not change Sections 4–6.
- Evidence page (verbatim quotes): https://cursor.com/canvas/store-bfe21f4a-f399-4d8d-af53-a13de82180ab/ea48a15d-6877-4124-88af-08a496976add
- Handoffs and reviews: `/workspace/transovo-complete-agent-handoff-2026-11-08.md`, `/workspace/transovo-new-agent-handoff.md`, `/workspace/transovo-recent-prs-review-2026-11-09.md`, `/workspace/transovo-video-map.md`
- Specs already written: `/workspace/specs/pm/2026-11-09-suggestion-first-cleanup-restore.md` (active). `/workspace/specs/pm/2026-11-09-ai-editing-assistant.md` (active; Track B epic B0, John 9 Nov 2026, 9:22 PM ET). `/workspace/specs/pm/2026-11-09-motion-graphics-library.md` (active; Track B epic B0.5, John via Chief of Staff, 9 Nov 2026, evening ET). `/workspace/specs/pm/2026-11-09-app-route-restructure.md` (active; small Track B Frontend item, size S, John via Chief of Staff, 9 Nov 2026, ~10:00 PM ET). `/workspace/specs/pm/2026-11-10-ai-ad-studio.md` (pointer) and `/workspace/docs/contracts/ad-studio-v1.md` (normative; AI ad studio, building this round, John 10 Nov 2026). `/workspace/specs/pm/2026-11-09-honest-credits-for-long-sources.md` is **parked**.
- Landing brief: `/workspace/landing/design-brief.md`. Frontend audit: `/workspace/frontend_audit/AUDIT.md`.

**Repo checks (read-only, 9 Nov 2026, evening ET).** `GET https://transovo.ai/api/health` returned `ok: true`, `app: "transovo-new-app"`, `db: true`, `commitSha: 9fdaad09265742d16803599adf0ecb8037c9e61d`. GitHub `master` HEAD is the same SHA: merge of [PR #1081](https://github.com/703deuce/sms/pull/1081) (`fix(clips): scale QA budget, repair every stitch opening, export only on pass`), merged 9 Nov 2026, 7:27 PM ET. That commit is **ahead of** `8476778f11463b6df054f117fbad00f7945083aa` ([PR #1080](https://github.com/703deuce/sms/pull/1080), merged 6:25 PM ET) by two commits. Researcher Rounds 3–5 statuses that cite `8476778f` are one merge behind current master and live web. #1081 is web-only (no `worker/` files); a clips-worker redeploy is not required for it. Worker SHA was **not** re-checked over SSH in this pass. Last documented worker deploy was #1080 at 6:35 PM ET (`/workspace/clipper_test_next/summary.md`).

There is **no top-level `app/` directory** in `703deuce/sms`. The legacy monolith UI and APIs live under `src/app/` and `src/lib/`. The live video product is `new-app/` plus `worker/clips_worker/`.

Status labels used below: **Built** (code exists and was evidenced in this pass), **Partial** (exists but incomplete, quality-gated, or not freshly AV-verified), **Missing**, **Unverified** / **UNKNOWN** (mentioned in docs or only checked on an older SHA).

Hard rules that apply to every epic: additive migrations only; no paid auto-retries or duplicate paid runs; do not touch the SMS worker or Coolify app3; never show `$` in the product UI; do not assign story angles in AI editorial prompts; do not break upload clipping, stream clipping, the editor, Story, multi-source Story, or Clean Take.

---

## 1. Product lineup at launch

v1 is the **AI clipper + real editor wedge**: import a long video or stream, get usable short cuts, caption and reframe them to 9:16, fix the cut on a real timeline, and download a 1080p MP4 (plus SRT). Story, multi-source Story, and Clean Take ship as existing modes that must be stabilized, not as a second product line. New AI features follow Researcher's Round 5 ranking and do not replace that wedge.

### Ships in v1 (in the offer)

| Offer | What the user gets | Why it is in v1 |
|---|---|---|
| **Upload clipping** | Upload a file → ranked short clips → open in Clip Studio / the clip editor. Routes: `/app/clips/new` → `/app/clips/[projectId]/edit/[clipId]` and studio. | Core front door. Live / partial quality. whyThisClip shipped in #1080 (`clipper_test_next/summary.md`). Mid-phrase openings still a quality gate (Round 4; #1080 test still saw a mid-phrase open). |
| **Stream / gaming clipping** | Twitch/Kick ingest at `/app/streamer`, including OAuth start/callback routes under `new-app/app/api/streamer/oauth/`. | Live path with known gaps. Because this path is in the v1 offer, a 9:16 facecam+gameplay layout is launch-critical for streamers (Round 4 brief; Round 5 #4). |
| **Editor / Clip Studio** | Manual timeline, transcript, captions, layouts, motion-graphics controls, export. Same editor for clips and full-video / BYO projects. | The thing users pay to fix and extend. Large surface shipped Oct 31–Nov 5; last dedicated regular-editor QA was Retest #9 on 5 Nov 2026. Timeline is only **partial** (Backend #6). |
| **Single-source Story (Mode 1)** | One recording → non-contiguous story edit (`just_chatting_rough_cut` / story). | Pipeline live; editorial quality still imperfect on gameplay (handoff 8 Nov 2026). Protected mode. |
| **Multi-source Story (Mode 2)** | 2–5 sources of the same subject (`multi_source_story_v1`). | Pipeline live after #1049; coverage and visual-action quality mixed. Protected mode. Named 6/15/20 recap targets are **not** required to launch this mode (see post-launch). |
| **Clean Take (Mode 3)** | Raw talking-head cleanup (`clean_take_v1`). | Pipeline live from #1059 onward; quality improved but not final. **Must ship suggestion-first** (Round 4; spec already written). Do not launch it as an unsupervised finished video. |
| **Captions and layouts** | Synced captions (exist), speaker-follow reframe (default after #1080, Backend report), export aspects including 9:16. | Captions are table stakes and Round 5 #1 — finish them in the new-feature track. Gaming stacked layout is Round 5 #4. |

### In the offer, but quality- or honesty-gated before calling launch-ready

These are not new product lines. They are conditions on the modes above.

- Clip in/out lands on a hook / complete sentence, not mid-phrase (backlog #1; in flight through #1080 / #1081).
- Clean Take is review-first, with one-click restore (backlog #3).
- AI cuts land on a real, extendable timeline (backlog #6).
- Export contract is explicit: 1080p 9:16 MP4, optional SRT, stated watermark behavior (Round 4).
- File size and duration limits are shown **before** upload; import limits are honest; retention has a stated window and an expiry warning (Round 4).

### Deferred after the v1 wedge (still on the roadmap)

- **Named-length story recap (6 / 15 / 20 min)** — Round 5 says this is a later differentiator, not a new category. Non-contiguous Story already works; named duration targets are new. First post-launch item, or a fast-follow if it is a thin target on top of Mode 1. Do not block the short-clipper launch on it.
- **Approve-then-schedule / direct social publish** — Round 5 #5. Real demand, heavy OAuth. After a reliable MP4 download, near the end of the new-feature track.
- **Full brand kit beyond “save this style”** — Round 5 #2 covers the launch-adjacent saved kit (caption style, layout, logo, reapplied to the next clip). Multi-brand / agency kits can follow.
- **Translated captions, optional B-roll, opt-in denoise, hook/title text, licensed music/SFX** — Round 5 #6–#10; scheduled in the new-feature track after captions, brand kit, and titles/chapters.
- **Chapters + YouTube description** are not deferred; they are new-feature #3, generated from the **approved** edit.
- **Multi-cam active-speaker (backlog #18), XML/FCPXML as a headline offer, VOD URL polish, authenticated private/sub-only VODs** — later unless already cheap on existing code. FCPXML / Premiere XML and SRT already appear in the export dialog (`new-app/components/clips/editor/export-dialog.tsx`); treat XML as existing, verify, and do not rebuild it as a v1 epic.
- **Team seats, public API, SSO, mobile apps, Drive/Dropbox as a first-class ingest, 4K as a true render (not an upscale)** — Round 4 post-launch. The export dialog already lists 1440p / 2160p and states “4K is upscaled from a 1080p render.” Do not market native 4K.
- **Credits, billing, checkout, and production login/auth** — deferred to the very end (Section 7). No packages in this document.

### Flagged off or out of the v1 offer

Script editor (`SCRIPT_EDITOR_ENABLED`), AI Video / T2V (`AI_VIDEO_ENABLED` / `FEATURE_T2V`), Rooms / recording (LiveKit gated), and screenwriting (`FEATURE_SCREENWRITING`) stay flag-off. Social publish is gated off until `FEATURE_COMPOSITION_SOCIAL_PUBLISH=1` (`new-app/lib/server/clips/feature-gates.ts`). These are not v1 promises.

Items John and Researcher already dropped, and Round 5 skip calls, are in **Section 8. Not planned**.

---

## 1b. Outcome-first product direction (John, Nov 10 2026, 2:19 AM ET)

John's direction: sell **finished results**; the editor is optional, not the front door. Source: `/workspace/transovo_team/research/outcome-products-from-john-2026-11-10.md` (ChatGPT memo John pasted and endorsed).

1. **App home at `/app` is an outcome-card grid** — "What do you want to create?" Each product is a card (not only a tool switcher). This **supersedes the simple launcher** (Clipper / Video Editor / recents only) in [#1126](https://github.com/703deuce/sms/issues/1126). **Note for Frontend:** keep the #1126 route moves and 308s; replace the planned `/app` dashboard contents with this card grid plus recent projects.
2. **Each tool gets its own nav link and a marketing landing page.**
3. **One upload is reused across tools** as a project. The user does not re-upload to caption, clip, or story the same file.
4. **Suggested tool order (suggestion only, pending John; no issues or builds from this list yet):** Clips (live) → YouTube video and Captions (already building) → then Reframe, Translate, and Audio. Motion graphics, podcast repurposing, and thumbnails stay later / already-specified where noted elsewhere.

AI Ad Studio (below) is that finished-output product. **Decided (John, 10 Nov 2026, 2:52 AM ET):** there is no standalone model-access AI Studio, not even as an advanced panel. All of AI Studio becomes the product video and ad studio; `/app/studio` is repurposed in place as the landing/run screen, and the outcome card and nav point to it.

---

## 2. Gap list

Evidence is from GitHub contents / trees on master `9fdaad09`, live `/api/health`, and the reused docs above. Worker production SHA is unverified this pass.

### Clipper (upload + stream)

**Partial.** Upload and stream pipelines are live. Recent work: isolated ranked clip modes, editorial rules (#1079), full-episode Story / QA publish gate / speaker-follow / whyThisClip / 10h·30GB caps in code (#1080), stitch-opening repair and export-only-on-pass (#1081, live). Historical quality was “about 65–70% right” (handoffs). A #1080 full-file Story test still opened mid-phrase when QA did not finish (`/workspace/clipper_test_next/summary.md`). #1081 is on live web; real-export verification of the opening repair is **Unverified**. Streamer gaps (archive window, live-capture fallback, Modal timeout, serial render) were listed in the video map and 7 Nov handoff and were **not** re-verified here. Protected: do not break upload or stream clipping.

**Needed:** finish in/out boundaries (Stabilize S1); honest limits copy (S5); gaming 9:16 layout (New #4); Video Quality watch of a real ~20-minute upload and a stream VOD after S1 and #4.

### Editor / Clip Studio / timeline

**Partial.** Primary NLE at `/app/clips/[projectId]/edit/[clipId]`. Motion Graphics control and Producer-tool truthfulness shipped in #1078 (live). Last numbered regular-editor retest ended 5 Nov 2026 (build `5321cca`): F38 passed; **F7 background-removal composite still broken**. Backend #6: AI output on a real extendable timeline is only partial. Many October 31 “DONE” rows were not retested on 8–9 Nov.

**Needed:** Stabilize S3 (extend, trim, restore on one timeline without re-upload). Do not treat the editor as “done.”

### Story modes (single- and multi-source)

**Partial.** Pipelines ready and deployed through #1062 (1 FPS analysis) and later web fixes. Latest watched reviews (8 Nov 2026 handoff): Mode 1 gameplay still chopped words / mid-action cuts; Mode 2 uneven source coverage and dropped visuals. #1073 edited shared specialists; Mode 1/2 behavior after that change is **Unverified**. Named 6/15/20 targets are new (post-launch).

**Needed:** protect current assembly; quality work stays in the stabilize track and Video Quality reviews. Do not add story angles to prompts.

### Clean Take

**Partial.** Pipeline live; Cinestudy improved after #1061 but was still not a clean final edit (sideways footage, fragmented topic change, mid-sentence ending). Cleanup **auto-applies** today and can export on finish (Backend #3; cleanup spec). That is a launch blocker if Clean Take is in the offer.

**Needed:** implement `/workspace/specs/pm/2026-11-09-suggestion-first-cleanup-restore.md` (Stabilize S2) before marketing Clean Take as a billed or default cleanup.

### Captions and layouts

**Partial.** Captions exist (Backend #5). Export dialog supports burned-in captions, “Also download .srt” (`alsoSrt` → `/api/clips/clips/[id]/srt`), and aspect 9:16 (default in the dialog). `speaker_follow` is the reported default after #1080; gaming facecam+gameplay stacked layout is **unverified**. In-place word edit, sync warning, saved style, and highlight/emoji-off-until-opted-in were **UNKNOWN** on `8476778f` and were not fully re-verified in the live UI this pass. Translation code exists (`new-app/lib/clips/caption-translate.ts` and tests) — treat translated captions as **Partial / unverified**, not Missing, and still schedule them as New #7 after captions finish.

**Needed:** New #1 (caption finish), then #2 (saved kit including layout + logo), then #4 (gaming layout).

### Auth / login

**Deferred** (Section 7). One-line status: `new-app` has Supabase session helpers (`new-app/lib/server/auth/session.ts`) but **no** login, signup, or `/api/auth/google` routes; the account menu is a hardcoded “MO” avatar (`new-app/components/shell/app-topbar.tsx`) and a tooltip can show “All features unlocked · no billing.” Google OAuth **does** exist in the legacy monolith (`src/app/api/auth/google/start/route.ts`, `src/app/api/auth/google/callback/route.ts`, `src/lib/auth/google-oauth.ts`, `src/components/auth/google-sign-in-button.tsx`). Production sign-in on transovo.ai was **not** exercised in a browser this pass (**Unverified** as a working user login).

### Billing and credits

**Deferred** (Section 7). One-line status: enforcement is off (`checkCreditBalance` always `{ ok: true }`; `isWorkspaceCreditEnforced()` is `false`; `featuresAllUnlocked()` defaults true in `new-app/lib/billing/entitlements.ts`). `credit-policy.ts` (from #1080) defines “0 credits if failed/canceled/capped or 0 published, else 1 per published clip” but is **not wired to a ledger**. Settings billing meters are hardcoded zeros (`frontend_audit/AUDIT.md`; `settings-tabs.tsx`). A Stripe client stub exists at `new-app/lib/stripe/client.ts`; subscription/checkout/webhook for video credits are in legacy `src/app/api/webhooks/stripe/` and related SMS/appointments billing, not a clips checkout. The honest-credits spec is **parked**.

### Dashboard / account

**Partial (mostly mock).** `/app/settings` exists. Frontend audit: Business / Team / Preferences / Billing controls toast or show demo data; no real credits or plan ledger. Account menu links to utilities, not a live identity.

### Landing pages

**Partial / Missing as public marketing.** `new-app/app/page.tsx` redirects to `/app/home`, which redirects to `/app/clips`. Open [PR #1082](https://github.com/703deuce/sms/pull/1082) (updated 9 Nov 2026, 8:01 PM ET) adds `/ai-clips` and `/video-editing`. Body says **do not merge without John’s approval** (Coolify deploys from `master`). Design brief: `/workspace/landing/design-brief.md`. Stale open PR #610 is an older homepage redesign and should not be merged on top of #1082 without a fresh diff.

### Onboarding

**Missing.** No `onboard` / `welcome` / `tour` pages under `new-app/` (frontend audit, rechecked via tree). New users land on `/app/clips`. A first-clip tour can follow stabilize work; it is not a Round 5 feature and must not delay captions. A card-required trial is deferred with billing.

### Support

**Partial.** In-app Help at `/app/help` (`new-app/components/help/help-center.tsx`) includes `mailto:support@transovo.com`. That is a human contact path. No evidence in this pass of Intercom, Discord, or a ticket queue. Preview-before-pay / trial is deferred with billing (Round 4 item 10, trial half only).

### Analytics

**Missing / Unverified for the video product.** `@vercel/analytics` is a `new-app` dependency. Clip-specific product analytics were not found as a first-class surface; `lib/mctb/analytics*.ts` is leftover SMS. Growth & Analytics has no launch epic in the two tracks below. Internal `AiUsage.costUsdMicros` is provider tracking, not a user-facing meter, and must stay off the product UI.

### Infra

**Partial.** Live web healthy on `9fdaad09`. Deploy topology: Hetzner + Coolify, web from master, clips workers via `scripts/deploy-worker.sh`. CI on recent master has pre-existing failures in `voice-agent-runtime` and `number-marketplace` (not caused by #1080/#1081 per the #1080 test note); editor-regression was green on #1080. Disk pressure and hanging Coolify image exports are recurring operational risks (8 Nov handoff). Do not confuse `Deploy SMS worker (Coolify)` with a clips-worker rollout.

---

## 3. Round 4 launch-critical checklist (product features)

Round 4 statuses were taken from Backend’s report on master `8476778f` plus a 7 Nov handoff that was not re-verified on that SHA. Current master and live web are `9fdaad09`. Items that are really billing/auth/trial live in Section 7, not here.

| Item | Status on current evidence | Track / disposition |
|---|---|---|
| Cleanup review (do not bill / auto-apply cleanup) | **Partial.** Auto-applies today. Spec written. | Stabilize **S2**. Do not treat Clean Take as launch-ready until this ships. |
| Clip boundaries (no mid-sentence in/out) | **Partial.** In progress after #1080; mid-phrase opens remained in the #1080 test; #1081 repair is live but **not AV-verified**. | Stabilize **S1** (in flight; keep going). |
| Timeline fix-in-place | **Partial** (Backend #6). | Stabilize **S3**. |
| Gaming 9:16 facecam+gameplay (HUD-aware) | **Unverified.** `speaker_follow` default reported; stream path is in the v1 offer, so this is launch-critical for that path. Opus’s published default is 30% facecam over 70% gameplay (Round 4). | New-feature **#4**. Does not block captions. |
| Export contract (1080p 9:16 MP4, watermark, SRT, free vs paid) | **Partial.** Dialog offers 720p/1080p (and 1440p/2160p upscaled), 9:16 and other aspects, MP4, optional SRT, and a watermark flag driven by `can(..., 'no_watermark')` — which is currently always unlocked because `featuresAllUnlocked()` defaults true. Free-vs-paid watermark **policy** waits on deferred billing. Live export quality **Unverified** this pass. | Stabilize **S4**. Paid/free rule documented as a later billing decision, not a pricing epic. |
| File size and duration limits shown before upload | **Partial / inconsistent.** Server policy in `new-app/lib/server/clips/upload-limits.ts`: default **30 GB** and **10 hours** (`CLIPS_UPLOAD_MAX_DURATION_MS`). Exceeded-file copy exists (`upload-limit-message.ts`). The **Upload** tab in `new-project-workspace.tsx` does not show those caps before a drop; it only shows detected duration after probe. The **Link** tab copy says “max 3GB, 3 hours” and mentions Drive/Dropbox. Those numbers disagree with the 30 GB / 10 h policy and over-claim Drive/Dropbox (Round 4: Drive/Dropbox are post-launch). Full-video intent has a separate “Up to 3 hours” hint. | Stabilize **S5**. |
| Storage / retention policy + expiry warning | **Partial / unstated.** `ClipProject.expiresAt` and `deletedAt` exist in `new-app/prisma/schema.prisma`. #1071 added source retention behavior (unverified acceptance tests). Editor audit historically said upload-original expiry was none. No user-facing expiry warning was found in this pass. | Stabilize **S5**. Retention **window** needs a decision from John (not a price). |
| Caption finish | **Partial.** Exists; finish work is the first new-feature epic. | New-feature **#1**. Starts immediately; stabilize must not delay it. |
| Honest import limits | **Partial.** Upload, URL import, and Twitch/Kick paths exist. Link-tab copy is inaccurate (see above). Private / sub-only VOD behavior **UNKNOWN**. | Stabilize **S5**. Authenticated private VODs stay post-launch. |
| Trial / preview-before-pay + human support | Support mailto is **Built** in Help. Trial/checkout is **deferred** with billing. | Section 7 (trial) and Support gap (contact already exists). |

**Explicitly post-launch** (Round 4, still correct after Round 5): team seats, public API, SSO, mobile apps, Drive/Dropbox ingest, native 4K, named 6/15/20 recap targets, Kick/Twitch authenticated private VODs. Direct social publish / scheduler is Round 5 #5 and is last in the new-feature sequence, not a v1 blocker.

---

## 4. Build order: two tracks in parallel

John’s decision (via the Chief of Staff, 9 Nov 2026): follow Researcher's Round 5 ranking for **new** features. Captions start now. Stabilization of existing modes runs **alongside** and **must not delay captions**. At 9:22 PM ET the same day, John added a new **top Track B epic**: the AI editing assistant in both editors (spec `/workspace/specs/pm/2026-11-09-ai-editing-assistant.md`). Later the same evening he added a second high-priority epic immediately after it: a real motion-graphics library (spec `/workspace/specs/pm/2026-11-09-motion-graphics-library.md`), slotted as **B0.5**. Both sit above #1–#10; the Round 5 order of those items is unchanged.

Effort S/M/L on new features is **Researcher’s inference** (Round 5), not an engineering estimate.

```
Stabilize existing modes (parallel)          New features (Round 5 rank, dependencies respected)
─────────────────────────────                ─────────────────────────────────────────────────
S1  Clip boundaries (in flight)              B0  AI editing assistant (chat in both editors)
S2  Clean Take review-first (written spec)   B0.5 Motion graphics library (templates, preview=export)
S3  Timeline fix-in-place                    #1  Finish captions
S4  Export contract                          #2  Saved brand kit
S5  Honest upload / import limits            #3  Titles, YT description, chapters
    + stated retention / expiry warning      #4  Gaming 9:16 facecam + gameplay (HUD-aware)
                                             #6  Optional, rejectable B-roll
                                             #7  Translated captions          (after #1)
                                             #8  Opt-in denoise on Clean Take (after S2)
                                             #9  Honest hook / title text     (after or with #3)
                                             #10 Optional licensed music/SFX
                                             #5  Approve-then-schedule        (last; after S4)
Credits, billing, login/auth ─────────────────────────────────────────────── very end (Section 7)
```

Owners may split across tracks (for example Backend on S1 while Frontend starts #1). If a person has to choose, **captions (#1) win over expanding stabilize scope**, but in-flight boundary work (S1) is not stood down.

Round 6 candidates are **not** in this order. See Section 9.

An **AI ad studio** epic is **building this round** in parallel (contract `/workspace/docs/contracts/ad-studio-v1.md`); it must not delay captions, the clipper fix, or YouTube video. A small Frontend item, **app route restructure** (`/` stays marketing via #1098; `/app` is the outcome-card home in Section 1b; editor routes move under `/app/video-editor` with 308s), is specified at `/workspace/specs/pm/2026-11-09-app-route-restructure.md`. Size **S**. **[#1126](https://github.com/703deuce/sms/issues/1126) is slotted BEFORE [#1117](https://github.com/703deuce/sms/issues/1117)** (Chief of Staff, 9 Nov 2026, 10:52 PM ET, America/New_York). Text-to-video pages move to `/app/ai-video/[projectId]` and `/app/ai-video/new` with 308s; the AI Video flag stays unchanged (**decided, Chief of Staff**, same time). It does not renumber #1–#10 and does not delay captions.

---

## 5. Track A — Stabilize existing modes

Each epic below lists owner role, goal, testable acceptance criteria, dependencies, required reviews, and protected existing behavior.

### S1. Clip in/out on the hook, never mid-sentence

- **Owner:** Backend Engineer (New), with Frontend for any transcript-nudge UI.
- **Goal:** Every published clip and Story stitch opens and ends on a complete thought. Mid-phrase openings do not export. Keep the in-flight work after #1080 / #1081 going.
- **Acceptance criteria:**
  1. A published clip does not start or end mid-word or mid-phrase on a held-out talking-head source and a held-out gameplay source.
  2. When a candidate would open mid-sentence, the system extends to the start (or end) of the sentence or rejects the candidate; it does not publish it.
  3. `whyThisClip` remains visible and is not replaced by a virality score.
  4. #1081 “export only on pass” still holds: a failing editorial QA does not publish.
  5. Upload clipping, stream clipping, Story, multi-source Story, and Clean Take still start and export (no regression of the protected modes).
- **Dependencies:** None. Already in flight on master `9fdaad09`.
- **Reviews:** QA (regression of publish gates and stitch openings). Video Quality (watch real exports, not only QA logs). Security not required unless auth or signed URLs change (they should not).
- **Protected behavior:** Do not loosen #1079–#1081 editorial contracts to “fix” yield. No story angles in prompts.
- **Effort:** In flight; not a Round 5 inference.

### S2. Clean Take and cleanup are suggestion-first, with one-click restore

- **Owner:** Backend Engineer (New) + Frontend Engineer.
- **Goal:** Cleanup proposes; the user accepts or restores. Clean Take does not auto-export a finished unsupervised video.
- **Spec (normative):** `/workspace/specs/pm/2026-11-09-suggestion-first-cleanup-restore.md`. Implement that spec; do not invent a second review model.
- **Acceptance criteria:** The ten testable criteria in Section 9 of that spec, including: `exportOnFinish` defaults to false; Show cuts on; every omission listed and restorable in one click; play-removed-only exists; lockable intro/outro; default filler is light (um/uh); reject/restore does not debit (when credits later exist); Mode 1 / Mode 2 start and export unchanged; manual cleanup on ordinary clips still works.
- **Dependencies:** None to start. Should complete before New #8 (opt-in denoise on the Clean Take timeline).
- **Reviews:** QA (the ten criteria + protected-mode regressions). Video Quality (re-watch Cinestudy as a reviewable first pass, not a finished show; a second raw talking-head source is still missing — do not use a packaged demo). Security not required unless new authz is added.
- **Protected behavior:** Upload / stream clipping and Story modes unchanged. Do not assign story angles in Clean Take prompts. No paid auto-retry.
- **Open question for John (also in the spec):** review on the output project plus an omitted-takes list (recommended) vs. on the source timeline.

### S3. AI cuts land on a real, extendable timeline

- **Owner:** Frontend Engineer + Backend Engineer (New) as needed for persistence / export parity.
- **Goal:** After an AI clip, Story, or Clean Take (once reviewed), the user can extend, trim, restore, and keep editing on the existing Transovo timeline against the original media, without a re-upload or a second tool.
- **Acceptance criteria:**
  1. Opening an AI clip or approved Clean Take / Story in the clip editor shows the cut on the real timeline with the source still available outside the in/out.
  2. The user can drag in/out (or nudge from the transcript) and play the new range; export uses the edited range (preview equals export for this change).
  3. Restore of a deleted cleanup suggestion or an extended hook does not require a new analysis job.
  4. Protected modes still open and export.
- **Dependencies:** Benefits from S1 (better first cut) and S2 (review lands on the timeline). Does not block New #1.
- **Reviews:** QA (trim / extend / restore / re-export). Video Quality (listen/watch that preview matches export). Security not required.
- **Protected behavior:** Manual editor tools already shipped stay available. Do not revive the flagged script editor to satisfy this epic.

### S4. Export contract

- **Owner:** Frontend Engineer + Backend Engineer (New) for any route/worker mismatch; Video Quality for the watched MP4.
- **Goal:** A paying-path export is a reliable 1080p 9:16 MP4, with optional SRT, and a stated watermark rule. Document what the dialog already does; fix gaps; do not invent 4K.
- **Acceptance criteria:**
  1. User can export 1080p 9:16 MP4 from a short clip and from a Story / Clean Take edit; ffprobe confirms resolution and duration (do not trust `durationMs` alone — handoff found first-segment bugs).
  2. “Also download .srt” produces a usable sidecar when captions are on, and is disabled when captions are off (current dialog behavior must keep working).
  3. Watermark behavior is visible and consistent with code: today `can('', 'no_watermark')` follows `featuresAllUnlocked()` (default unlocked). Until billing is enabled, the UI must not imply a paid unlock that does not exist. The free-vs-paid watermark **policy** is a later John decision (Section 7), not a price in the UI.
  4. 1440p / 2160p remain labeled as upscaled from 1080p if that is still how they work. No “native 4K” marketing.
  5. Existing FCPXML / Premiere XML export in the same dialog still works or is clearly marked if broken; this epic does not rebuild XML.
- **Dependencies:** None to start. **New #5 (schedule/publish) may not start** until this is accepted.
- **Reviews:** QA (dialog matrix: aspect, resolution, SRT on/off, watermark flag). Video Quality (watch/listen a real MP4). Security if signed download URLs change.
- **Protected behavior:** Motion failure must not block a usable MP4 (#1077). No second paid export retry.

### S5. Honest upload, import, and retention

- **Owner:** Frontend Engineer for copy and pre-upload hints; Backend Engineer (New) for a single source of truth on limits and for expiry warnings; John decides the retention window.
- **Goal:** Before upload or paste, the user sees the real size and duration caps. Link/import copy matches what actually works. Projects are not silently expired.
- **Acceptance criteria:**
  1. Upload tab shows the effective max size and max duration **before** a file is chosen, using `clipUploadLimitsPublic()` (or the same values): default policy today is 30 GB and 10 hours unless env overrides, and the effective cap if storage is not S3-multipart may be lower (`supabaseObjectMaxBytes`, default 50 MB — this must be honest if that driver is live).
  2. Link-tab copy does not say “3GB, 3 hours” unless that is the real link-import cap; it does not promise Google Drive or Dropbox if those paths are not launch-supported. YouTube / Twitch / Kick public URL behavior is stated, including known failures (private, unlisted, sub-only) rather than failing opaquely.
  3. Full-video “up to 3 hours” remains accurate for that intent, and is not confused with the 10-hour clipper cap.
  4. A stated retention window is shown on the project (and a warning before expiry or deletion). `expiresAt` is used or removed from view if unused; no silent delete.
- **Dependencies:** Retention **duration** is a John decision (Section 9). Work on pre-upload copy can start now.
- **Reviews:** QA (oversize / over-duration rejected with the same numbers shown in the UI; link copy matches API errors). Security if signed upload URLs change. Video Quality not required.
- **Protected behavior:** Do not lower working 10h / 30GB S3 uploads as a copy fix. Do not build Drive/Dropbox to make the current sentence true.

---

## 6. Track B — New features (Round 5 rank, dependencies respected)

John added a new **top epic** at 9:22 PM ET, 9 Nov 2026: the AI editing assistant (B0). Later the same evening he added a high-priority motion-graphics library epic immediately after it (B0.5). The Round 5 items below keep their relative order (#1 captions through #5 approve-then-schedule last). Do not wait for Track A to finish.

### B0. AI editing assistant (clip editor + timeline editor)

- **Owner:** Backend Engineer (New) for the command schema and AI endpoint; Frontend Engineer for the chat panel, registry wiring, and diff/undo UI.
- **Goal:** The user can chat with an assistant in both the clip editor (including Clip Studio) and the full timeline / full-video editor. The assistant uses the same tools as a hand edit, through one shared command registry. Changes are undoable and shown as a diff. Destructive or bulk work is confirmed first.
- **Spec (normative):** `/workspace/specs/pm/2026-11-09-ai-editing-assistant.md`. Implement that spec; do not treat the existing AI Producer popover as already satisfying it (limited tools, parallel reducer, prompt missing transcript and selection).
- **Phase 1 tools:** `trim`, `split`, `delete_range`, `apply_cleanup`, `restore_cut`, `set_captions`, `set_layout`, `add_or_edit_text`, `apply_brand`, `reorder_segment`. Phase 1 additions only if they compile to those commands (cut-by-meaning → visible ranges → confirm → `delete_range`; scope before acting). Later tools register as they ship (including motion graphics in progress). Ranked Phase 2 and UX updates are in the spec (changelog 9 Nov 2026, 10:52 PM ET).
- **First PRs:** Backend — shared command registry types (PR-B1). Frontend — chat panel in both in-scope editors, Phase 1 tool wiring, diff/undo (PR-F1, depends on PR-B1). Then Backend PR-B2 (endpoint + tool-calling loop) and Frontend PR-F2 (wire the chat to that endpoint). **#1126 is slotted before #1117** (Chief of Staff, 9 Nov 2026, 10:52 PM ET).
- **Acceptance criteria:** The 35 testable prompts and parity / undo / failure / Video Quality checks in Section 9 of the spec (includes cut-by-meaning, scope, a 3-hour scoped request, Retry/Continue, and an honest refusal).
- **Dependencies:** None to start PR-B1. #1117 follows #1126 for route paths. Credits, billing, and login stay deferred; the endpoint must be usage-frugal and leave metering hooks; when metering exists, never charge for undo, failed, or discarded work. Do not enable the flagged `/script` composition editor to satisfy this epic.
- **Reviews:** QA (prompts, parity, confirm gates, protected-mode smoke). Video Quality (watched preview vs hand-made copy and a user-clicked export). Security if prompt/context or new routes change authz or could leak signed URLs (they must not).
- **Protected behavior:** Upload / stream clipping, Story, multi-source Story, Clean Take, and existing manual editor tools. No chat-queued export. No `$`. No paid auto-retry. No story-angle assignment in prompts.
- **GitHub:** Epic [#1114](https://github.com/703deuce/sms/issues/1114); Backend PR-B1 [#1115](https://github.com/703deuce/sms/issues/1115); Backend PR-B2 [#1116](https://github.com/703deuce/sms/issues/1116); Frontend PR-F1 [#1117](https://github.com/703deuce/sms/issues/1117).


### B0.5. Motion graphics library (parameterized templates, preview = export)

- **Owner:** Backend Engineer (New) for the template schema, compiler, planner constraints, and ASS burn-in / `count_up` parity; Frontend Engineer for libass-wasm preview, picker, and editor UI; DevOps for the CI smoke fix; Video Quality for the eval rubric.
- **Goal:** Real motion graphics with many varied types (After Effects quality as the bar, compiled to the existing text/shape/sticker/keyframe + ASS path). The planner picks a template plus params from transcript context. Consecutive clips do not repeat the same template type. Preview equals export. No Remotion, Lottie, or After Effects in slice 1.
- **Spec (normative):** `/workspace/specs/pm/2026-11-09-motion-graphics-library.md`. Do not treat the live PR #1067 planner/panel as already satisfying this: seven of nine named types still compile toward one title, boxes and 220 ms slide/fade are hardcoded, `count_up` is rejected, and the 34-template manual catalog is unused by AI.
- **First 10 templates:** `lower_third_bar`, `lower_third_pill`, `title_card`, `kinetic_word_pop`, `quote_card`, `stat_counter` (real count-up), `callout_arrow`, `subscribe_cta`, improved `bar_chart`, `punch_in`.
- **First PRs:** Backend (New) — template schema + compiler rewrite, including real `count_up` (PR-B1). Backend (New) — planner selection and constraints; register motion commands on the assistant registry when #1115 types exist (PR-B2). Frontend — preview, picker, param editor, review/apply (PR-F1, depends on PR-B1). DevOps — install ffmpeg in `motion-graphics-mp4-smoke` and fail if tests skip (PR-D1, can start immediately). Video Quality — eval rubric (preview=export, no-repeat, legibility/safe area, animation animates, count-up counts).
- **Acceptance criteria:** The Video Quality, QA, and CI checks in Section 9 of the spec (checkable on rendered output).
- **Dependencies:** None to start PR-B1 or PR-D1. PR-F1 and PR-B2 depend on the compiler in PR-B1. Registering assistant commands depends on #1115. Credits, billing, and login stay deferred; keep the existing motion rate limits; leave metering hooks.
- **Reviews:** QA (compiler fixtures, catalog/export regression, CI actually runs ffmpeg). Video Quality (watched preview vs export, variety, count-up, safe area). DevOps (CI smoke + clips-worker deploy if `text_anim.py` changes).
- **Protected behavior:** Manual 34-template catalog and current no-motion / already-applied exports. Upload / stream clipping, Story, multi-source Story, Clean Take, and the editor. Auto-plan must not block a usable MP4. No `$`. No paid auto-retry. No story-angle assignment in prompts. No Remotion / Lottie / AE in this slice.
- **GitHub:** Epic [#1119](https://github.com/703deuce/sms/issues/1119); Backend PR-B1 [#1120](https://github.com/703deuce/sms/issues/1120); Backend PR-B2 [#1121](https://github.com/703deuce/sms/issues/1121); Frontend PR-F1 [#1122](https://github.com/703deuce/sms/issues/1122); DevOps PR-D1 [#1123](https://github.com/703deuce/sms/issues/1123); Video Quality rubric [#1124](https://github.com/703deuce/sms/issues/1124).

### B-small. App route restructure (`/app` dashboard, editor under `/app/video-editor`)

- **Owner:** Frontend Engineer.
- **Size:** **S**. **[#1126](https://github.com/703deuce/sms/issues/1126) is slotted BEFORE [#1117](https://github.com/703deuce/sms/issues/1117)** (Chief of Staff, 9 Nov 2026, 10:52 PM ET, America/New_York) so the chat panel does not hardcode old editor paths. Do not interleave conflicting file moves. Does not renumber #1–#10 and must not delay captions.
- **Goal:** Honor John’s URL scheme on transovo.ai: `/` remains marketing (#1098 / Landing Pages; not this issue). `/app` was specified as a simple launcher dashboard (Clipper, Video Editor, recent projects — nothing bigger). **Superseded for the dashboard contents (not the route moves):** John's 10 Nov 2026, 2:19 AM ET outcome-card home in Section 1b. Frontend should ship the #1126 path moves and 308s, and build `/app` as the outcome-card grid, not the three-tile launcher. `/app/clips` stays the projects drive. Editor, studio, script, and `/app/editor` move under `/app/video-editor`, with **308** redirects from every old path, query strings and deep links preserved. `/app/clips/new?intent=full` becomes `/app/video-editor/new`. **Decided (Chief of Staff, same time):** text-to-video pages move to `/app/ai-video/[projectId]` and `/app/ai-video/new` with 308s; the AI Video feature flag stays unchanged (default off; not a public launch). brand, media, templates, trash, exports, streamer, rooms, record, settings, help (and integrations) stay.
- **Spec (normative):** `/workspace/specs/pm/2026-11-09-app-route-restructure.md`.
- **Acceptance criteria:** Redirect test table (308s), in-app link crawl with no 404s, and no regression in upload clipping, stream clipping, the editor, Story, multi-source Story, or Clean Take. No auth/billing changes.
- **Dependencies:** None to start. This issue is slotted **before** #1117 (Chief of Staff, 9 Nov 2026, 10:52 PM ET); #1117 must use the new `/app/video-editor/...` paths. Coordinate with #1098 so marketing `/video-editor` is not claimed as the SaaS editor (`/app/video-editor` only).
- **Reviews:** QA (redirect table, crawl, protected-mode smoke). Video Quality not required. Security not required if auth is untouched.
- **Protected behavior:** Bookmarks, emails, and old links keep working via 308. Do not enable the flagged script editor or AI Video. Never show `$`.
- **GitHub:** [#1126](https://github.com/703deuce/sms/issues/1126).

### B-ads. AI ad studio — building this round

- **Owner:** Backend Engineer (New) for the contract, additive schema, agent/job pipeline, and stitch; Frontend Engineer for screens on the existing Studio shell, `/app` outcome card, nav, and compact-editor handoff.
- **Status:** **Building this round** (full UI + connected backend). Not gated on the clipper fix, YouTube video, or Captions, and **must not disrupt** those tracks or protected modes.
- **Goal:** Sell a finished 15s or 30s product ad in two modes (Storyline; Image-to-ad). `/app/studio` is repurposed in place as the ad landing/run screen (no model gallery/picker product; agents choose models). Keep `AiStudioJob` / KIE as internal plumbing, the stock B-roll catalog, and `RENDER_CLIP`. Existing jobs stay visible (no destructive migration). The result opens in the compact clip editor, with a switch to the full editor. Credits only (config placeholders until John sets amounts); confirm before paid generations; no automatic paid retries.
- **Contract (normative):** `/workspace/docs/contracts/ad-studio-v1.md` (repo path `docs/contracts/ad-studio-v1.md`, added in Backend PR-B1). Short product pointer: `/workspace/specs/pm/2026-11-10-ai-ad-studio.md`.
- **First PRs:** Backend PR-B1 — land the contract, additive `AdStudioRun` / `AdStudioScene` migration, cost config, types. Frontend PR-F1 — turn `/app/studio` into the ad landing/run screen; hide or remove model-gallery/picker entry points; keep existing history visible; outcome card + nav point here. Then Backend PR-B2 (API + agents + stock + confirm) and PR-B3 (child jobs + stitch + editor URLs); Frontend PR-F2 (wire + compact/full editor handoff).
- **Acceptance criteria:** The 12 criteria in contract §12.
- **Dependencies:** Existing AI Studio API (`docs/contracts/ai-studio-v1.md`) and stock search (`GET /api/clips/broll/search`). Does not wait on B0, #1, or S1, and must not block them.
- **Reviews:** QA (contract §12–13). Video Quality (watched Storyline and Image-to-ad exports; product look preserved). Security not required unless authz beyond workspace scoping is added (it should not be).
- **Protected behavior:** Existing `AiStudioJob` / asset rows and history visibility (no destructive migration), clip-editor stock picker, upload/stream clipping, the editor, Story, multi-source Story, Clean Take. Additive migrations only. Never show `$`.

### #1. Finish captions

- **Owner:** Frontend Engineer; Backend Engineer (New) for SRT / style persistence if needed.
- **Goal:** Accurate, editable, in-sync captions with at least one clean style and one modern style, in-place word edit, a sync warning, highlight/emoji off until opted in, SRT, and a saved style.
- **Acceptance criteria:**
  1. User can edit a caption word or line in place; the change is in preview and in the export (burned-in and SRT).
  2. If caption timing drifts from the transcript/audio, the UI warns; it does not silently ship out-of-sync text.
  3. At least two built-in styles (one clean, one modern). Highlight and emoji are off until the user opts in.
  4. User can save the current caption style and re-apply it on another clip in the same workspace (this is the seed for #2).
  5. SRT download remains available from export.
  6. Supported transcription languages already listed in `new-app/lib/clips/asr-languages.ts` are published honestly; no “100+ languages” claim without a test set.
- **Dependencies:** None. Starts now, in parallel with Track A.
- **Reviews:** QA (edit, style, opt-in defaults, SRT). Video Quality (sync on a real export). Security not required.
- **Protected behavior:** Existing caption burn-in and editor caption panel keep working. Do not enable translation here (that is #7).
- **Effort:** S/M (Researcher’s inference). Captions already exist.

### #2. Saved brand kit (caption style, layout, logo), reapplied to the next clip

- **Owner:** Frontend Engineer + Backend Engineer (New).
- **Goal:** Save caption style, layout (including safe area), and logo, and reapply that kit to the next approved clip without opening a second editor. A full multi-brand agency kit can wait.
- **Acceptance criteria:**
  1. From a finished clip, “Save as brand kit” stores caption style, layout choice, and logo (if present).
  2. The next new clip in that workspace can apply the kit in one click; preview and export show the kit.
  3. Manual override on a single clip does not destroy the saved kit.
  4. Existing brand routes (`/app/clips/brand`, `new-app/lib/clips/brand-kit.ts`, `ClipBrandTemplate`) are reused or repaired, not replaced blindly. Completeness of the current brand page is **Unverified**.
- **Dependencies:** After #1 (saved caption style). Layout pieces can be prepared in parallel once #1’s preset shape exists.
- **Reviews:** QA (save / reapply / override). Video Quality (logo and captions in the 9:16 safe area). Security if assets are served on new signed URLs.
- **Protected behavior:** Do not break clipper layouts already in production. Applying a kit is never an unsupervised restyle of an in-flight AI job mid-render.
- **Effort:** M (Researcher’s inference).

### #3. Titles, YouTube description, and chapters from the approved edit

- **Owner:** Backend Engineer (New) for generation from the approved transcript and beat list; Frontend Engineer for the review UI.
- **Goal:** After the user approves the cut, produce a title, a YouTube description, and legal chapters/timestamps from **that edit**, not from the raw VOD. No invented hashtag spam.
- **Acceptance criteria:**
  1. Outputs are generated only from the approved edit’s transcript and beats (plus `whyThisClip` / topic metadata when present).
  2. User can edit or reject each field before copy/download. Nothing is auto-posted.
  3. Chapters are legal/valid timestamps for the **exported** duration, not the source VOD.
  4. Titles and description do not invent hashtags, claims, or names absent from the edit (backlog #13 / #17).
  5. Prompts do not assign story angles.
- **Dependencies:** A usable approved edit (benefits from S1 and S3, but does not wait for them to be perfect). After or alongside #1 if description should include caption language later — not a hard gate.
- **Reviews:** QA (timestamp math, reject/edit). Video Quality / editorial spot-check that titles are grounded. Security not required.
- **Protected behavior:** Do not auto-publish. Do not block export if this generation fails.
- **Effort:** M (Researcher’s inference).

### #4. Gaming 9:16 facecam + gameplay layout with HUD-aware tracking

- **Owner:** Backend Engineer (New) + worker (`subject_reframe`, `layout_router`, Gemini visual analysis) and Frontend Engineer for manual crop and saved template.
- **Goal:** On the stream path, a 9:16 frame keeps facecam, gameplay, and HUD. Recommended default: stacked facecam above gameplay at about **30/70** (the only published competitor ratio, Opus; Round 4). Regions are draggable; a per-show template can be saved; a platform safe-area overlay is advisory. Manual crop does not require a re-analysis job.
- **Acceptance criteria:**
  1. A gameplay+facecam VOD can be laid out in 9:16 with facecam and a play/HUD region both visible; centre-crop-only is not the only gaming option.
  2. User can drag/resize regions and save a template that reapplies on the next clip of that show (#2 may store this).
  3. Automatic tracking does not claim “face tracking” if that is still not what the code does (#1079 explicitly did not claim face tracking).
  4. Talking-head `speaker_follow` default remains for non-gaming sources.
  5. Manual crop works without a new paid analysis (when billing later exists, still no re-charge).
- **Dependencies:** Not a captions blocker. Benefits from #2 if the gaming layout is part of the saved kit. Stream path is in the v1 offer, so this is launch-critical **for stream marketing**, not for a podcast-only talking-head export.
- **Reviews:** QA (layout presets, template save, talking-head regression). Video Quality (watch gameplay exports for cut-off kill feed / minimap / cam). Security not required.
- **Protected behavior:** Do not change upload talking-head defaults in order to ship the gaming preset. Do not break stream clipping ingest.
- **Effort:** M (Researcher’s inference).

### #6. Optional, rejectable B-roll on story beats (never auto-insert)

- **Owner:** Backend Engineer (New) + Frontend Engineer. Reuse existing B-roll suggest paths (`new-app/lib/clips/broll*.ts`, worker `broll_render.py`) if they still work.
- **Goal:** Suggest stock (or later, generated) B-roll on story beats; preview on the timeline; user rejects or accepts. Never auto-insert. No unsupervised “get creative.”
- **Acceptance criteria:**
  1. Suggestions appear as optional, rejectable items tied to beats of the approved edit.
  2. Default is off / not inserted. “Accept” places the shot; “Reject” or Uncut removes it in one click.
  3. A suggest or generate failure does not block the cut or export.
  4. No new hidden meter in the UI (billing still deferred; do not preview dollar costs).
- **Dependencies:** After #3 is underway or done (beats/approved edit). Do not wrap text-to-video as the front door (Not planned).
- **Reviews:** QA (never auto-insert; reject path). Video Quality (accepted B-roll timing). Security if stock keys or signed media change.
- **Protected behavior:** Existing cuts export with zero B-roll if the user ignores suggestions.
- **Effort:** M for stock+suggest (Researcher’s inference). Generative B-roll is later, still never auto-inserted.

### #7. Translated captions (not voice dubbing)

- **Owner:** Frontend Engineer + Backend Engineer (New). Reuse `caption-translate.ts` if it is sound.
- **Goal:** Translate the **approved-edit** caption transcript, keep timing, stay editable, and export SRT. Not a voice dub.
- **Acceptance criteria:**
  1. User picks a target language; timing stays aligned to the approved cut; words remain editable.
  2. SRT can be downloaded in the translated language.
  3. Failures are visible; the English (or source) captions remain.
  4. No lip-sync, cloned voice, or dubbed audio in this epic.
  5. Language list is honest (only languages actually tested).
- **Dependencies:** After #1.
- **Reviews:** QA (round-trip edit + SRT). Video Quality (spot-check timing; not a translation-quality bureau). Security not required.
- **Protected behavior:** Source-language captions and SRT keep working if translation is off or fails.
- **Effort:** M (Researcher’s inference).

### #8. Opt-in speech enhance / denoise on the Clean Take timeline

- **Owner:** Backend Engineer (New) + worker; Frontend Engineer for the opt-in preview on the Clean Take review timeline.
- **Goal:** An optional denoise/enhance the user can preview and reject, on the Clean Take timeline, after review-first cleanup. Not a default paid step and not a surprise second meter.
- **Acceptance criteria:**
  1. Default is off. The user previews before accept. Reject restores the original audio in one click.
  2. Does not run automatically on Clean Take analyze, and does not run on Story / clipper unless later explicitly productized.
  3. Failure leaves the unenhanced audio exportable.
  4. No eye contact, green screen, or default upscale in this epic.
- **Dependencies:** After **S2** (suggestion-first Clean Take). Do not ship enhance onto an auto-applied cleanup.
- **Reviews:** QA (default off, reject, failure). Video Quality (listen to before/after). Security not required.
- **Protected behavior:** Clean Take review and restore still work with enhance off. No paid auto-retry.
- **Effort:** M (Researcher’s inference).

### #9. Honest hook / title text from the transcript (no hashtag spam)

- **Owner:** Backend Engineer (New) + Frontend Engineer.
- **Goal:** Optional on-clip hook or title text grounded in the approved transcript. Not a generated spectacle or viral-hook motion pack.
- **Acceptance criteria:**
  1. Suggested text is drawn from the approved edit (and #3 title, if present). The user can edit or reject; default can be off.
  2. No invented hashtags, no unsupervised “viral hook” generator, no auto-applied motion pack.
  3. Text respects the same safe area as captions (#1 / #4).
- **Dependencies:** After or with #3. Safe-area work shared with #1 and #4.
- **Reviews:** QA (reject/edit). Video Quality (readability in 9:16). Security not required.
- **Protected behavior:** Clips without hook text still export. Existing headline layers must not be force-replaced.
- **Effort:** S/M (Researcher’s inference).

### #10. Optional licensed music or SFX, rejectable, with rights clear

- **Owner:** Frontend Engineer + Backend Engineer (New). Reuse existing music / SFX jobs if they are still valid (`music_job.py`, `export_sfx.py`, editor music tools).
- **Goal:** An optional, rights-clear bed or SFX the user can preview and reject. Do not leave uncleared stream-VOD music in a recap by default (Round 3).
- **Acceptance criteria:**
  1. Default is off, or existing source audio only. Adding a bed is a conscious accept.
  2. Catalog or generator used is rights-clear for the intended platforms; the UI states that in plain language (no legal fine print as the only disclosure).
  3. Reject removes the bed. Failure does not block export.
  4. No auto-scoring of a whole VOD that may contain uncleared third-party music.
- **Dependencies:** After #1 / S3 so the bed lands on the real timeline. Not a captions blocker.
- **Reviews:** QA (default, reject). Video Quality (mix level, not ducked speech). Security / rights: do not ship a catalog with unclear licenses.
- **Protected behavior:** Silent reject path. Do not strip user-owned source music unless they ask.
- **Effort:** S/M (Researcher’s inference).

### #5. Approve-then-schedule multi-platform publish (last in this track)

- **Owner:** Backend Engineer (New) + Frontend Engineer. DevOps / Security for OAuth app credentials and webhook/callback URLs.
- **Goal:** After the user approves the cut and has a reliable MP4, they may schedule or publish to connected accounts. Expired tokens are obvious. Jobs that fail or are canceled do not stay “posted.”
- **Acceptance criteria:**
  1. Download/export still works with publish disabled (`FEATURE_COMPOSITION_SOCIAL_PUBLISH` stays off until this epic is ready).
  2. User approves the cut first; schedule uses a real `runAfter` / `scheduledAt` (clipper-test notes: `enqueueCompositionSocialPublish` exists but has no delay today; `clip_jobs.runAfter` is the hook).
  3. Supported destinations are only those actually implemented and tested (do not list X/TikTok/Shorts/Reels until each path works).
  4. Expired or revoked OAuth is shown; a failed or canceled scheduled post does not remain marked published. Any later credit hold is released only when billing exists and John has approved refunds — until then, just clear the job state.
  5. No auto-post “while I sleep” without a prior approved cut (Round 3 dropped AutoPilot).
- **Dependencies:** After **S4** (reliable MP4). OAuth is heavy, so this is **last among new features** even though Round 5 ranked it #5. It must not jump ahead of #1–#4 or delay captions.
- **Reviews:** QA (schedule, cancel, token expiry). Video Quality not primary (the MP4 was already accepted). **Security** is required (OAuth, tokens, callbacks, redirect URIs, secret handling).
- **Protected behavior:** Clipping, editing, and download work with this flag off. Do not touch SMS/Coolify app3 OAuth.
- **Effort:** L (Researcher’s inference).

---

## 7. Deferred to the end

Credits, billing, pricing, checkout, and login/auth are **not** in the two tracks above. They come last, after the product features. No packaging options are proposed in this document. Cash prices stay TBD by John and must never appear in the product UI.

| Topic | One-line status | Disposition |
|---|---|---|
| **Credits UX** (estimate before run, one meter, failed-job refund, Credit History) | Policy helper and rate tables exist; no wired ledger, no pre-run quote, enforcement off (`entitlements.ts`, `credit-policy.ts`, `settings/billing.ts`). Stream-hour cap (`StreamUsage`, default 40h) is a second meter if left unlabeled. | **Parked.** Spec: `/workspace/specs/pm/2026-11-09-honest-credits-for-long-sources.md`. Do not implement as a current epic. Refund policy, credit unit (per selected minute vs per kept clip), rollover, and when to flip enforcement all still need John later. |
| **Paid credits checkout / Stripe for the video product** | `new-app/lib/stripe/client.ts` is a `STRIPE_SECRET_KEY` wrapper only. Video subscription checkout and webhooks were not found under `new-app/app/api`. Legacy Stripe lives in `src/app/api/webhooks/stripe/` and SMS/appointments billing. | Deferred. If/when built, reuse proven patterns carefully, add only additive schema, and require **Security** review. Do not reuse SMS billing UIs as the clips Settings page. |
| **Production auth / login** ([#1104](https://github.com/703deuce/sms/issues/1104)) | Supabase session helpers in `new-app`; no `new-app` login or Google OAuth routes. Google OAuth exists in `src/app/api/auth/google/*` and `src/lib/auth/google-oauth.ts`. Account menu is a placeholder (“MO”). The shared `/login` page with no `?next=` uses `defaultAuthLandingPath()` in `src/lib/auth/post-login-navigation.ts`, which returns `/dashboard` (the old `src/` shell). When production auth arrives, non-SMS users should land on `/app`. For now, marketing Log in links go to `/app` directly. | Deferred. Port or wrap a durable login (email or Google OAuth) at the end, with **Security** review. SSO is post-launch (Opus Business-only pattern; Round 4). Change the default landing to `/app` as part of that work, not now. |
| **Trial / preview-before-pay** | Not built. Help mailto exists. | Deferred with checkout. Round 4 still wants a preview-before-pay path at paid launch; it does not precede captions or stabilize work. |

---

## 8. Not planned

These are explicitly out of scope for the v1 wedge and for the Round 5 expansion. Rationale is Researcher’s, from Round 5 (and earlier drops where noted).

| Item | Researcher’s rationale |
|---|---|
| **Text / image / reference-to-video as a core Transovo product** | Large adjacent market and a commodity API wrapper (Runway, Veo, InVideo, etc.), expensive per second, and **not** a repeated weekly ask from people who already have VODs and interviews. Optional generated B-roll may be revisited later, never as the front door, and never auto-inserted. |
| **AI avatars / presenters** | Different customer (L&D and marketing). HeyGen and Synthesia already own it. No pipeline edge on recorded footage. Do not build “because Synthesia exists.” |
| **Full AI dubbing, lip-sync, and standalone voice cloning** | Thinner than translated captions in Rounds 1–4; specialist market; consent risk; mostly a wrapper around ElevenLabs/HeyGen-class APIs. Revisit only if caption translation is clearly used. Translated captions (#7) stay in scope. |
| **Script-to-video or blog / article-to-video as a product line** | Pictory / InVideo job: marketers with a post, not a VOD. Transovo’s edge is footage already recorded. (A smaller later idea — a script that *guides a Story cut of existing media* — is not this product line.) Existing T2V stays flag-off. |
| **Auto-thumbnails** | Dropped in Round 2 for thin organic demand. Slight edge if a still came from an approved beat is not enough. |
| **Eye contact, green screen, and default AI upscale / enhance** | Competitor checkboxes with weak “I would use this every week” demand. Easy to become a hidden second meter (Vizard Enhance, Descript Studio Sound). Opt-in denoise on Clean Take (#8) is the honest, narrower exception. F7 background-removal repair, if John prioritizes it, is a **bugfix** on an existing editor tool, not an AI-enhance product. |
| **Team workspaces / client review links / collaboration seats** | Thin in the clipper/cleanup corpus (Rounds 1–2, 4). Agency later, not a launch copy of someone else’s pricing grid. |
| **AI motion-graphics packs and unsupervised “viral hook” generators** | Spectacle without a repeated weekly ask. Honest hook *text from the approved edit* (#9) is enough. Existing Clip Studio motion-graphics controls stay as editor tools, not an unsupervised viral pack. |
| **Live in-game overlay clipping (Medal-style) and live game capture** | Dropped in Round 2. Transovo’s proven path is post-VOD analysis, not a desktop capture app. |
| **Community clipping / remix marketplaces** | Vendor-only in the research set. |

Flagged-off surfaces (script editor, T2V, Rooms, screenwriting) remain off unless John explicitly reopens them. They are not secret v1 work. Additional Round 6 “do not launch” items (competing ASR or hosting APIs, a Broadcast-style local app, a recording studio, generative actors) are listed in Section 9 and stay out of the approved tracks.

---

## 9. Round 6–7 candidates (PENDING JOHN DECISION)

Nothing in this section is added to the approved build order in Sections 4–6. Do not start these as epics, open issues, or delay captions or stabilize work until John decides. Effort labels are **Researcher’s inference**. Competitor names are brief comps only; this section does not set or quote package prices.

### Round 6

Researcher Round 6 (“wider features and standalone products,” 9 Nov 2026) is research only. **John has not approved it.**

If John later approves an item, the “PM slot” column is the recommended place to attach it — not a license to jump the current tracks.

| # | Candidate | Kind | PM recommendation (where it would slot, if approved) |
|---|---|---|---|
| 1 | Premiere / Resolve plugin + XML / FCPXML handoff | Standalone product + platform export | First ship is the export already in the dialog (FCPXML 1.10 + Premiere XML in `export-dialog.tsx`). That stays a **verify/fix under Stabilize S4**, not a rebuild. A real Premiere/Resolve panel is a later standalone product for editors who will not leave their NLE; it should follow a working XML handoff and Clean Take review-first (S2), not the v1 wedge. Closest comps are AutoPod-style NLE panels and existing XML exports from Gling, Selects, and Opus. |
| 2 | Custom ASR vocabulary / brand dictionary | Feature | Pairs naturally with **New #1 (captions finish)** and the saved brand kit (#2): teach the ASR a brand or person name so captions and search stop misspelling it. If approved, fold it into or immediately after #1 as a small add-on (Researcher effort S/M). Do not start a separate vocabulary project that delays captions. |
| 3 | Search and prompt-to-clip across the full VOD | Feature | Sharpens the existing clipper (“find the moments”) with transcript search and a written prompt as a first-class control. If approved, slot after **S1 (boundaries)** so results still open on complete thoughts; it must not delay captions. This is a control on the current finder, not a new product line. |
| 4 | Browser extension: send this YouTube / Twitch / Kick VOD to Transovo | Standalone | Thin layer on existing URL ingest. If approved, slot after **S5 (honest import limits)** so the extension does not promise Drive, Dropbox, or private/sub-only VODs the product cannot do. Growth / Landing can own the install path; it is not a Track B epic. |
| 5 | Show-notes / YouTube chapters micro-tool | Standalone, with an in-app twin | **Overlaps New #3** (titles, YouTube description, and chapters from the approved edit). If approved, do not build a second generator: ship #3 in-app first, then optionally expose a thin public/free entry (paste a URL, get notes/chapters, upsell the editor). Notes-from-a-video is not blog-to-video (still Not planned). |
| 6 | Profanity censor with an editable word list | Feature | Word timings already exist. If approved, slot on the **Clean Take review timeline after S2**, as a suggestion the user can accept, edit, or reject (beep / mute / cut). Modest demand; Researcher effort S. Do not auto-censor as an unsupervised default. |
| 7 | Import Twitch / YouTube markers and community-clip times as the first beat list | Feature | Matches how stream editors already log a VOD. If approved, feed those markers into Story and into **New #3** as an optional starting beat list, after stream ingest is honest (S5). Complements a later 6/15/20 recap; do not wait on named-length recap to import markers. |
| 8 | Multi-track / ISO import (Riverside, Zoom, local stems) | Feature | The missing input for Clean Take and for post-launch multi-cam (backlog #18). If approved, slot after **S2**, not in the v1 caption track. Do not pull multi-cam switching into the approved order just to justify ISO import. |
| 9 | Free SEO micro-tools (9:16 safe-area overlay, SRT timing checker, timestamp formatter) | Standalone (marketing), not a paid pillar | Reuses work already required by **#1, S4, and #3**. If approved, Landing Pages can publish these as free tool pages after those epics have a real implementation to share — a cheap acquisition slice, not a reason to reorder Tracks A or B. |
| 10 | Public clip / cleanup / caption API | Standalone, later | Already on the Round 4 post-launch list. If approved, it comes **after deferred auth** (Section 7) and must not block the creator wedge. Researcher effort L (versioning, webhooks, SLAs). Brief comps: Opus, Vizard, Klap, and Shotstack already sell APIs. Discord or Twitch clip-request bots, if ever, wait until after an API or the extension exists; they are not in this top 10. |

### Round 6 — do not launch

These stay out of the approved tracks even if John later picks some of the top 10. They extend Section 8; they do not reopen skipped product lines.

- **Competing ASR or video-hosting API.** Infrastructure (Deepgram, AssemblyAI, Mux, and similar), not a Transovo product. Do not launch a raw speech-to-text or hosting API to “compete with the vendors we already call.”
- **NVIDIA Broadcast clone / local green-screen or denoise app.** Broadcast is a free RTX-local utility. Opt-in denoise on the Clean Take timeline (New #8, after S2) is the in-app path; a desktop capture/enhance clone is not.
- **Recording studio.** Riverside-class recording remains flag-off (`FEATURE_SCRIPT_RECORDING` / Rooms). Transovo’s edge is footage already recorded. Do not stand up a studio product in v1.
- **Generative actors / AI-actor apps.** Same rationale as Section 8 avatars: different customer, no pipeline edge on real VODs, overlaps the existing skip.
- **Discord or Twitch bots (submit a timestamp, get a draft clip).** Later only, and only after a public API or the browser extension exists. Demand in Round 6 was inferred and thin; not in the top 10.

Other Round 6 ideas that did not make that top 10 (speaker-colored captions, upload-an-existing-SRT, channel-name stickers, on-screen chat replies, “link this Short to the long VOD,” OBS / Streamer.bot hooks) are likewise **not approved**. If they return, fold stickers into New #2 and “link the Short” into New #5 rather than inventing parallel work.

### Round 7 census additions

Source: `/workspace/transovo_team/research/ai-video-feature-census.md` (9 Nov 2026, America/New_York). Broad field census (118 catalog features). **John has not approved it.** Most of the census “biggest opportunities” (top 25) were already on the approved tracks or in the Round 6 list above, so they are cross-referenced rather than re-opened. Every keyword-level CPC in that census is **“no data”**; none were invented here, and none are used to rank work.

**Search-demand check (census Section 5, PENDING JOHN):** a later pass on the top 15 used Google Suggest + SERP density (Google Trends was blocked). **Real demand (7):** auto captions / subtitles; YouTube / podcast-to-Shorts; filler + silence cleaner; 9:16 / vertical reframe; chapters / timestamps; noise / speech enhance; translated captions. **Custom vocabulary is Thin** (demoted 9 → 15 in that table). These seven remain **platform features** already on the approved tracks or in Round 6 — not a reason to change Sections 4–6, and (per John’s correction below) not standalone products.

#### Already on the roadmap (cross-references, not new entries)

| Census item | Where it already lives |
|---|---|
| Auto captions / styles, in-place edit, sync, opt-in highlight or emoji, SRT, saved style | Approved **Track B #1** (Frontend already assigned by the Chief of Staff). A caption-generator landing page is only a standalone candidate, below. |
| Saved brand kit (caption style, layout, logo) | Approved **Track B #2**. Channel-name / end-card stickers stay folded into #2 (Round 6 leftover). Custom font upload, if John wants it, also folds into #1 or #2 — not a new epic. |
| Titles, YouTube description, and chapters / show notes from the approved edit | Approved **Track B #3**. The chapters / show-notes micro-tool is **Round 6 #5** (do not build a second generator). |
| Gaming 9:16 facecam + gameplay; speaker-follow reframe | `speaker_follow` is reported **shipped** as the talking-head default. Gaming stacked layout is approved **Track B #4**. A 9:16 converter landing page is a standalone candidate, below, and still depends on that reframe being verified. |
| Optional, rejectable B-roll | Approved **Track B #6**. |
| Translated captions (not dubbing) | Approved **Track B #7**. A translation **glossary** is the only new related candidate, below. |
| Opt-in speech enhance / denoise | Approved **Track B #8**. Echo / room-reverb and “studio sound” stay in that same preview-and-reject control; do not productize them separately. |
| Honest hook / title text from the transcript | Approved **Track B #9**. |
| Optional licensed music / SFX | Approved **Track B #10**. |
| Approve-then-schedule / direct publish | Approved **Track B #5** (last in the new-feature track, after S4). |
| Filler, silence, retake, and suggestion-first cleanup review | Approved **Stabilize S2** (and the written cleanup spec). Off-topic / wander removal and jump-cuts-from-silence stay on that same Clean Take review surface, not as a new product. A filler-cleaner landing page is a standalone candidate, below. |
| Clip in/out boundaries; long-to-short clipper; whyThisClip | **S1** (in flight) plus the v1 clipper already in the lineup; whyThisClip **shipped** in #1080. YouTube / podcast-to-Shorts as a landing page is a standalone candidate, below, and still depends on S1 quality. |
| Timeline fix-in-place / text-based extend-and-trim | Approved **Stabilize S3**. |
| Export contract, including aspect variants and SRT | Approved **Stabilize S4**. The export dialog already lists 9:16 / 1:1 / 4:5 / 16:9; verify there, don’t rebuild. |
| Named-length story recap (6/15/20); highlight / best-of reel | Already **post-launch** (Section 12, item 1). Highlight montages stay with Story / recap, not a new line. |
| Custom vocabulary / brand dictionary | **Round 6 #2**. |
| Search / prompt-to-clip on the full VOD | **Round 6 #3**. |
| Browser extension: send this VOD | **Round 6 #4**. |
| Profanity censor | **Round 6 #6**. |
| Twitch / YouTube marker import | **Round 6 #7**. |
| Multi-track / ISO import | **Round 6 #8**. |
| Premiere / Resolve plugin + XML / FCPXML | **Round 6 #1** (XML verify stays under S4). |
| Free SEO micro-tools (safe-area, SRT checker, timestamps) | **Round 6 #9**. Caption safe-area is that same work. |
| Public clip / cleanup / caption API | **Round 6 #10** (still later, after deferred auth). |
| Speaker-colored captions; upload an existing SRT; on-screen chat replies; link a Short to the long VOD; OBS / Streamer.bot hook | Already listed as **Round 6 leftovers, not approved**. |
| Full dubbing, lip-sync, voice cloning, avatars, text/image-to-video, script/blog-to-video, auto-thumbnails, eye contact / green screen / default upscale, team review, unsupervised viral hooks, recording studio, Broadcast-style app, competing ASR/hosting API | **Section 8 / Round 6 do-not-launch.** Round 7 does not reopen them. |
| Multi-cam / active-speaker switching | Already **post-launch** (Section 12), and still needs ISO import (Round 6 #8) if John later wants it. |

#### Genuinely new, strong census items

Only items that are still **no** or **partial**, with high buyer intent, good stack fit, and S/M effort (Researcher’s inference), and that were not already approved or listed above.

| Candidate | Census status / effort | PM recommendation (if John approves) |
|---|---|---|
| **Translation glossary / terminology** | no · fit high if a brand dictionary ships · S | Pair with **Round 6 #2** (custom vocabulary) and use it when **Track B #7** (translated captions) runs, so names and product terms survive translation. Do not start a glossary project that delays captions #1. |
| **Intro / outro templates** | no · fold into brand kit · S/M | Extend **Track B #2** (saved brand kit) rather than a new product. Logo and layout are already in #2; intro/outro would be the same saved kit, reapplied to the next clip. |

No other catalog row both cleared that bar and was absent from the approved tracks or Round 6. Weaker or commodity rows (auto zoom / punch-in, chat-spike detection, loudness normalize, TTS voiceover studio, Zapier after an API, bulk export) are not added as candidates.

#### Standalone paid products (candidates) — revised after John’s correction

John’s correction: **captions, reframe, chapters / timestamps, filler + silence cleanup, and translated captions are platform features, not standalone products.** The earlier “five standalone entry products” list in this section (caption generator, YouTube/podcast-to-Shorts landing, filler cleaner, 9:16 reframe tool, noise remover) is withdrawn as a product-line ranking. Those jobs stay on the approved tracks (or Round 6) as features. A marketing page in front of a feature is still a later John decision; it is not a new product.

The Researcher then ranked **standalone paid products** (things people already subscribe to as a whole tool) in `/workspace/transovo_team/research/standalone-ai-video-products.md`. **John has not approved adding these as separate product lines.** They remain candidates only and do not change Sections 4–6.

| Rank | Standalone paid product | Verdict in that memo | Notes / depends on |
|---:|---|---|---|
| 1 | **AI clipper** (long video → short clips) | Build | Already the v1 wedge. Quality still gated on **S1** and honest import (**S5**). |
| 2 | **Podcast / talking-head auto-editor** (raw → finished episode) | Build | Extends Clean Take + the timeline; gated on **S2** (review-first, restore). |
| 3 | **Best mode / condensed recap** (hours → 6/15/20 min) | Build | Already listed as post-launch (Section 12) and as decision 3. |
| 4 | **Stream / gaming highlight clipper** | Build | Extends the stream path; gaming 9:16 layout is **Track B #4**. |
| 5 | **Sermon / church vertical** | Build | Same clip engine, different go-to-market. Not a new engine. |
| 6 | **Webinar / meeting-to-content** | Build | Same clip engine, packaged as a content-repurposing product. |
| Watch | **Course / screen-recording editor** | Watch | Recorder-first competitors; Transovo can edit footage, not capture it, unless a recorder is built. |
| Watch | **Wedding / event highlights** | Watch | Real paid tools, thinner public traction; weaker speech-only fit. |

Sign-up on any future product page **depends on the deferred auth block** (Section 7). Landing PR #1082 is a related but separate John decision (decision 4).

**Google Ads:** every keyword CPC and volume figure in the Round 7 census is **“no data.”** Real CPCs need John’s Google Ads Keyword Planner (or an in-tool Semrush / Ahrefs pull). None were invented, and industry benchmark averages are not used here as keyword bids. Do not stand up Ads on a page until the matching capability is verified and John has decided to bid.

---

## 10. Decisions needed from John

1. **Retention window** for source media and projects (and whether `ClipProject.expiresAt` should be used). Required to finish S5. Do not silently expire work the user can still see.
2. **Clean Take review surface:** output project plus omitted-takes list (PM recommendation in the cleanup spec) vs. review on the source timeline.
3. **Named 6 / 15 / 20-minute recap:** first post-launch item vs. a fast-follow if Backend judges it a thin target on existing non-contiguous Story. Not in either track above.
4. **Landing PR #1082** (`/ai-clips`, `/video-editing`): the PR says do not merge without John’s approval, because Coolify deploys from `master`.
5. **Quality bar for calling Story and Clean Take launch-ready** after S1–S2 (Video Quality sign-off on named sources). A second raw talking-head source for Clean Take is still missing.
6. **When, later, to start the deferred auth + credits block** (Section 7), including watermark free-vs-paid policy, credit unit, refunds, and rollover. No decision is required to start Tracks A and B. Do not set cash prices in the product.
7. **Round 6 and Round 7 candidates** (Section 9). None of the Round 6 top 10, the two new Round 7 census features (translation glossary, intro/outro in the brand kit), or the standalone **paid-product** ranking (clipper, talking-head auto-editor, Best mode recap, stream/gaming, sermon/church, webinar/meeting; watch: course/screen-recording, wedding highlights) is in the approved build order until John says so. Captions, reframe, chapters, filler cleanup, and translated captions stay features, not products (John’s correction). A yes can be item-by-item; a no leaves them off the roadmap. Any future product page also needs a decision on whether to wait for deferred auth before promising sign-up, and CPCs must come from John’s Keyword Planner (the census has no keyword-level CPC data).

**Decided by John:**

- **Motion graphics engine (Nov 9, 2026, 10:06 PM ET, relayed by the Chief of Staff):** "The 10 templates on the current engine are enough for now." Epic B0.5 ([#1119](https://github.com/703deuce/sms/issues/1119)) stays as specced, with ASS/libass and 10 templates. No phase-2 animation engine is planned (no Remotion, Lottie, or After Effects).
- **AI Studio becomes AI Ad Studio (10 Nov 2026, 2:34–2:38 AM ET; confirmed 2:52 AM ET, relayed by the Chief of Staff):** AI Studio becomes a finished-ad product (Storyline and Image-to-ad), built this round with `/app/studio` repurposed in place. **There is no standalone model-access AI Studio, not even as an advanced panel**; agents choose models; KIE job APIs stay as internal plumbing. Normative contract: `/workspace/docs/contracts/ad-studio-v1.md`. Track B entry **B-ads**. Credits stay deferred; per-ad-type cost is a config value John will set. Must not disrupt the clipper fix, YouTube video, Captions, or protected modes.

Confirming the stream path is in the v1 offer is already assumed here (it is live). If John later wants a podcast-only launch, New #4 can slip; until then it stays launch-critical for stream marketing.

---

## 11. Open risks

- **#1081 is live but not AV-verified.** Mid-phrase opens remained in the #1080 test when QA did not finish. Do not declare backlog #1 done.
- **#1073 changed shared specialists** while claiming original Producer modes were untouched. Any Mode 1 / Mode 2 / Clean Take oddity after 9 Nov, 3:03 AM ET should be checked against that change first (`transovo-recent-prs-review-2026-11-09.md`).
- **Regular editor F7** (background-removal composite) was still broken on 5 Nov 2026. Unrelated to captions, but it undercuts “the editor is done.”
- **Import copy is already dishonest** (3 GB / 3 hours and Drive/Dropbox on the Link tab vs. 30 GB / 10 hours in `upload-limits.ts`). Landing copy must not print caps until S5 is consistent (`landing/design-brief.md` already flagged 10h / 30GB).
- **CI is not fully green** (`voice-agent-runtime`, `number-marketplace`). Do not treat those failures as clips regressions, and do not ignore editor-regression if it goes red.
- **Worker SHA unverified this pass.** Web is `9fdaad09`. Last documented clips-worker deploy is #1080. #1081 did not need a worker deploy; still confirm workers before a paid quality run.
- **Disk pressure and long Coolify deploys** remain operational risks. Do not touch SMS worker or app3.
- **FEATURES_ALL_UNLOCKED defaults true**, so watermark and 1080p entitlements are not a real paid gate today. Do not market plan-gated export until Section 7 is built.
- **Open overlapping clip PRs** (#1074, #1075 draft, #1070 draft) are stale relative to #1076–#1081; merging them is risky.
- **Editorial quality** of Mode 1 gameplay and Clean Take is still short of a watched “final” standard. Stabilize work reduces risk; it does not by itself guarantee a quality pass.

---

## 12. Post-launch (after the two tracks, before or beside deferred billing)

Ordered by product value, not by seats/API fashion:

1. **Named-length Story recap (6 / 15 / 20 min)** — first post-launch, or a fast-follow if cheap on Mode 1. Use Round 3 sourced structure rules; label inferred defaults as defaults, not law. Mid-phrase opens flagged via S1.
2. Authenticated private / sub-only Twitch or Kick VODs (public URL import stays in v1, honestly limited).
3. Drive / Dropbox ingest, if still demanded after honest copy in S5.
4. Native 4K (only if a real render, not the current upscale).
5. Multi-cam / active-speaker for podcasts (backlog #18).
6. Full multi-brand kit, team seats, public API, SSO, mobile apps — only with new demand, not to copy a pricing grid. The public API is also Round 6 candidate #10 and stays post-launch / pending John; it does not move into the approved tracks on its own.

---

## Appendix: SHA and path index (seen this pass)

- AI editing assistant spec (9:22 PM ET epic) and the motion-graphics library spec (B0.5, same evening) were audited on a later master: `5d12224eb5dd5c0b518e3cb808015c0eb7e410ee` (#1083, committed 8:11 PM ET). That SHA is **ahead of** the #1081 snapshot below and matches live `https://transovo.ai/api/health` as of the B0.5 audit. Both epics should treat `5d12224` (or current master) as the baseline.
- Live health and master (this document’s original pass): `9fdaad09265742d16803599adf0ecb8037c9e61d` (#1081), 9 Nov 2026, 7:27 PM ET.
- Previous: `8476778f11463b6df054f117fbad00f7945083aa` (#1080), 6:25 PM ET; workers last documented on this SHA at 6:35 PM ET.
- Key `new-app` paths: `lib/server/auth/session.ts`, `lib/billing/entitlements.ts`, `lib/clips/credit-policy.ts`, `lib/clips/credit-cost.ts`, `lib/settings/billing.ts`, `lib/stripe/client.ts`, `lib/server/clips/upload-limits.ts`, `lib/clips/upload-limit-message.ts`, `lib/server/clips/feature-gates.ts`, `components/clips/new-project-workspace.tsx`, `components/clips/editor/export-dialog.tsx`, `components/shell/app-topbar.tsx`, `components/help/help-center.tsx`, `components/settings/settings-tabs.tsx`, `app/page.tsx` (redirect), `prisma/schema.prisma` (`ClipProject.creditsReserved/Captured`, `expiresAt`, `CreditLedgerEntry` in cents — SMS-era).
- Legacy auth/Stripe: `src/app/api/auth/google/*`, `src/lib/auth/google-oauth.ts`, `src/app/api/webhooks/stripe/`, `src/app/(auth)/login/`.
- Worker tree confirmed present at `worker/clips_worker/` (pipeline, streamer, reframe, captions, AI Producer finder, etc.).
- Open video-related PRs noted: #1082 (landing, needs John), #1074, #1075 (draft), #1070 (draft), #986 (old editor rollback). No open GitHub issues were returned in this pass’s issues query.
