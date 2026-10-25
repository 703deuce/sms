# Clipping App Build Plan (v1, revision 2)

Written for: Cursor coding agents working in **GitHub `703deuce/sms`, branch `master`, folder `new-app/`**
Owner: Rick James · Drafted: Oct 25, 2026 (ET) · Revision 2: Oct 25, 2026 (ET), Rick's decisions applied (watermark, trial, Opus-matching prices, credits late, Pixabay only, no publishing, AI features into v1, AI music with no library)
Inputs: `sms_new_app_ui_system.md` (UI spec for new-app), `opusclip_product_map.md` v2 + logged-in tour notes, `speakercrop/v3` prototype README and code.

> **How to use this file.** Each milestone in §11 is one PR. Before you start a milestone, read §1 (ground rules), the page specs it touches (§4–§5), the data/API sections (§6–§7) and, for AI features, §13. Do not invent UI patterns. Reuse the components listed under "Reuse". Only build the components listed under "New".
> Tags: **[v1]** ships in the first public release · **[later]** not in v1 · **[proposal]** a number or choice Rick has not approved yet (see §12).

---

## 1. Ground rules (apply to every PR)

1. **Same visual language.** Use the porcelain neutrals and sapphire primary tokens in `app/globals.css`. Use the `.surface`, `.surface-raised`, `.tile-primary`, `.bg-grid-fade` and `.tabular` utilities. Cards are `rounded-xl surface`. Light theme only. Icons are lucide. Toasts use sonner.
2. **Components.** Use shadcn v4 base-nova on `@base-ui/react`. Never Radix and never `asChild`. Links in buttons use `render={<Link href=… />}`. Add missing primitives with `pnpm dlx shadcn@latest add <name>`. Expected additions: `skeleton slider scroll-area toggle-group radio-group accordion alert aspect-ratio`.
3. **Page blocks.** Build every app page from `components/app/page-primitives.tsx`: `Page`, `PageHeader`, `Panel`, `Stat`, `EmptyState`, `KeyValue`, `IconTile`. Statuses go through `StatusBadge`. Filters come from `components/app/filters.tsx`. Settings rows come from `components/app/option-group.tsx`.
4. **Conventions.**
   - Files are kebab-case and use named exports.
   - Feature UI goes in `components/clips/`. The client fetch wrapper is `lib/clips-api.ts`. Server code goes in `lib/server/clips/`.
   - Pages are thin server components with `metadata.title = '<Page> · Clips'`. `searchParams` is a Promise. Wrap `useSearchParams` in `Suspense`.
5. **API shape.** Responses are `{ data }` or `{ error }` via `jsonError`. Validate input with zod. Mutating routes call `assertDevApiAccess` until M15 replaces it with real auth. IDs come from `createId('clip')`, `createId('proj')` and similar (`lib/supabase/id.ts`). Use Prisma through `getPrisma()` (`lib/server/db.ts`). The schema is at repo-root `/prisma/schema.prisma`.
6. **No data fetching library.** Use plain fetch wrappers in `lib/clips-api.ts`. Poll job status with `setInterval` and stop when the job reaches a terminal state.
7. **Never store media in Postgres.** Do not copy the base64 upload in `knowledge-manager.tsx`. All media goes to S3-compatible object storage through presigned URLs.
8. **Low API cost is a product requirement.**
   - ASR, reframing, captions and rendering run on our own CPU worker. Use no paid per-minute APIs for these.
   - Paid APIs are allowed only through the provider wrappers in `lib/server/ai/` (§13), and every call writes an `AiUsage` row with its USD cost so we can see real margins.
   - Text decisions (clip picks, B-roll spots, music prompts, the AI Producer) use the one cheap OpenAI model `gpt-6-luna` (§13.1). Vision uses Gemini 3.1 Flash-Lite. Media generation uses Kie.ai (video, images) and ElevenLabs (music, SFX, dubbing).
   - No music library. Music is generated per clip (§13.6) and stays private to the workspace.
9. **Leave the phone code in place.** Phone, receptionist, mctb, power-dialer, numbers, contacts and inbox are removed in a separate, later PR (M18). Until then, hide them from nav and do not delete them.
10. **Never put secrets in client code.**
    - Server-only env vars (names only; never commit values): `S3_*`, `PIXABAY_API_KEY`, `OPENAI_API_KEY`, `CLIP_LLM_MODEL` (default `gpt-6-luna`), `GEMINI_API_KEY`, `VISION_MODEL`, `KIE_API_KEY`, `KIE_API_BASE_URL`, `KIE_UPLOAD_BASE_URL`, `KIE_CALLBACK_SECRET`, `ELEVENLABS_API_KEY`, `STRIPE_*`, `WORKER_SHARED_SECRET`.
    - `OPENAI_API_KEY`, `KIE_API_KEY` and `ELEVENLABS_API_KEY` already exist in the sms repo's `.env.example` (§13.0). Reuse the same names.
    - Pexels is dropped. Do not add `PEXELS_API_KEY`.
11. Fix `lib/format.ts` `formatWhen`: its hardcoded `NOW` (2026-10-18, America/Chicago) must become a real `Date.now()` in the viewer's time zone. Do this in M0.
12. **Feature flag `FEATURES_ALL_UNLOCKED`.** Credits are not a priority. Until M16, every feature works without credits:
    - Server env `FEATURES_ALL_UNLOCKED=true` (default `true` in dev and staging, `false` only once M16 ships). A workspace can also be put on a `test` plan (`Subscription.planId = 'test'`) by a seed script, which unlocks everything in any environment.
    - All gates go through one function: `lib/billing/entitlements.ts` → `can(workspace, feature)` and `costOf(action)`. Pages never check plans directly.
    - When unlocked: no credit checks, no watermark, 1080p allowed, all AI features enabled. The ledger still writes `kind = TEST` entries with the would-be credit cost, so pricing can be tuned from real usage.
    - The header shows a small "Test mode · all features unlocked" `Badge` when the flag is on.
    - **Test plan (while the flag is on):**
      1. Seed a `test` workspace and run three fixtures end to end: a 60-min two-person podcast (talking mode), a 20-min vlog with no dialogue (ClipAnything), and one 45 s "everything" clip (3 AI shots, 2 music generations, 3 SFX, 3 thumbnails, 1 dub).
      2. Compare `AiUsage` totals per feature (`GET /api/clips/usage`) against the §13.10 cost table; investigate anything more than 25% off.
      3. Check that every gate goes through `can()`: grep for direct plan checks, and confirm that flipping the flag off in staging hides AI features, restores the watermark and blocks 1080p for a Free workspace.
      4. At M16, seed one Free, one trial, one Starter and one Pro workspace in staging, run the same fixtures, and only then set `FEATURES_ALL_UNLOCKED=false` in production.
13. **Before auth (M15), never deploy publicly.** The paid AI APIs make an open staging URL expensive. Put staging behind Coolify basic auth or an IP allowlist.


---

## 2. Product summary

You upload a long video and get back short vertical clips that are ready to post. Two modes:

- **Talking mode** (podcasts, interviews, talks). Clips are picked from the transcript by `gpt-6-luna`. This is the cheapest path: about $0.004 per source hour in LLM cost.
- **ClipAnything mode** (vlogs, sports, gaming, any footage). Clips are picked by a vision model (Gemini 3.1 Flash-Lite) over a pre-filtered shortlist of moments. Shown cost: about $0.07 per source hour (§13.2).

Each clip has:

- **Speaker-following crop.** This is our edge. The 9:16 frame cuts to whoever is talking, using face tracking plus voice. Opus shows two speakers in split-screen instead. ClipAnything clips use a motion/subject crop.
- **Animated word-by-word captions** with 10 presets and keyword highlight (§8.6).
- **B-roll:** Pixabay stock (free, no watermark, credited) and AI B-roll generated with Wan 3.0 via Kie.ai.
- **Audio:** AI music generated per clip with ElevenLabs Music (no music library), ducked under speech, plus sound effects.
- **AI Producer:** a chat panel in the editor. The agent edits the clip by calling the same operations the UI uses.
- **Thumbnails:** a vision model picks the frame and writes a Nano Banana prompt, rendered via Kie.ai.
- **Dubbing:** ElevenLabs Dubbing into other languages. Lip-sync comes later.
- **Download-only export.** No social publishing in v1.

Watermark: on Free and trial exports, off on paid (and off whenever `FEATURES_ALL_UNLOCKED` is on).

Core flow:

```
Upload / link → Settings → Processing → Results → Editor (+ AI Producer) → Export (download)
/app/clips/new   (same page)   /app/clips/[id]   (same page)   /app/clips/[id]/edit/[clipId]   Export dialog
```

---

## 3. Sitemap (v1)

```
PUBLIC (app/(marketing)/ — no app shell)
/                                   Landing                      [v1]
/pricing                            Pricing                      [v1]
/tools                              Tools index                  [v1]
/tools/[slug]                       Google Ads landing template  [v1] (8 slugs at launch, §4.3)
/alternatives/opus-clip             Comparison page              [later]
/legal/terms  /legal/privacy        Legal                        [v1]
/legal/media-credits                Stock-media attribution      [v1]
/sitemap.xml  /robots.txt           SEO                          [v1]

AUTH (app/(auth)/ — centered card layout, no shell)
/login                              Email + Google               [v1]
/signup                             Email + Google               [v1]
/verify                             6-digit email code           [v1]
/auth/callback/google               OAuth callback (route)       [v1]
/invite/[token]                     Accept team invite           [later]

APP (app/app/ — existing shell)
/app                                → redirect /app/home         [v1, exists]
/app/home                           Clips dashboard              [v1, adapt]
/app/clips                          Projects list                [v1]
/app/clips/new                      Upload + settings            [v1]
/app/clips/[projectId]              Processing → Results         [v1]
/app/clips/[projectId]?clip=<id>    Clip preview drawer (Sheet)  [v1]
/app/clips/[projectId]/edit/[clipId] Clip editor                 [v1]
/app/clips/exports                  Export history & downloads   [v1]
/app/clips/brand                    Brand template               [v1 single template]
/app/clips/brand/new                Brand template wizard        [later]
/app/clips/library                  Asset library (logos only; no music library) [later]
/app/clips/calendar                 Publishing calendar          [later; no publishing in v1]
/app/clips/analytics                Post analytics               [later]
/app/settings?tab=profile           Profile                      [v1, adapt]
/app/settings?tab=team              Team                         [v1 read-only / later invites]
/app/settings?tab=billing           Plan, credits, ledger        [v1, adapt]
/app/settings?tab=notifications     Email toggles                [v1]
/app/settings/plans                 Plan picker (in-app pricing) [v1]
/app/integrations                   Catalog                      [v1, adapt]
/app/help                           Help center                  [v1, adapt]
not-found.tsx / error.tsx / loading.tsx at app/ and app/app/    [v1]

DIALOGS / DRAWERS (no route unless noted)
ClipPreviewSheet (?clip=)  ExportDialog  UpgradeDialog  BuyCreditsDialog
CreditEstimate (inline)    StockBrollPicker (Sheet)  RenameDialog  ConfirmDeleteDialog
ProducerPanel (editor, Sheet on mobile)  GenerationConfirmCard (inline)
CaptionPresetPopover       KeyboardShortcutsDialog [later]  ShareLinkDialog [later]
InviteMemberDialog [later] PublishDialog [later]
```

**Removed from nav now and deleted later in M18:** `/app/phone/*`, `/app/receptionist/*`, `/app/mctb/*`, `/app/power-dialer/*`, `/app/numbers/*`, `/app/contacts/*`, `/app/inbox/*`, `/app/calls/*`.

---

## 4. Page specs: public and auth

### 4.1 `/`: Landing [v1]
- **Purpose:** convert Google Ads and organic traffic into sign-ups. `app/page.tsx` currently redirects to `/app/home`. Replace it with this landing page.
- **On it:**
  1. **Marketing header:**
     - Logo.
     - Links: Tools (`/tools`), Pricing (`/pricing`), Log in (`/login`).
     - Primary button "Start free" (`/signup`).
  2. **Hero:**
     - H1 promise. Subcopy: "Speaker-following 9:16 crop + word-by-word captions".
     - Primary CTA "Upload a video — free" (`/signup?next=/app/clips/new`).
     - Secondary CTA "See examples" (anchor `#examples`).
     - Fake dropzone visual. It is a link, not a real upload; pre-signup upload is [later].
  3. **Before/after demo:** a 16:9 source next to the 9:16 speaker-follow output. Use the self-hosted MP4 from our own sample.
  4. **"How it works":** 3 steps (Upload → We find the moments → Download).
  5. **Feature grid:** speaker-follow crop, TikTok captions, AI clip picking with scores, stock B-roll, brand template, fast exports.
  6. **"Why not split-screen?":** comparison block.
  7. Pricing teaser (link to `/pricing`).
  8. FAQ (accordion).
  9. Footer: Tools, Pricing, Terms, Privacy, Media credits, Help.
- **Reuse:** `Button`, `Badge`, `.surface`/`.tile-primary`/`.bg-grid-fade` tokens, `IconTile`.
- **New:** `components/marketing/` → `marketing-header.tsx`, `marketing-footer.tsx`, `hero.tsx`, `before-after.tsx`, `feature-grid.tsx`, `how-it-works.tsx`, `faq.tsx` (uses the new `accordion`), `cta-band.tsx`.
- **Data:** static. `lib/marketing/attribution.ts` captures `gclid`/`gbraid`/`wbraid`/`utm_*` into a first-party cookie (30 days).

### 4.2 `/pricing` [v1]
- **On it:**
  - Monthly/Yearly `SegmentedFilter`.
  - 3 plan cards: Free, Starter and Pro (numbers in §9, matching Opus).
  - Top-up packs row [later, optional, decided at M16] and a feature comparison table.
  - "What's a credit?" explainer and FAQ.
  - Each CTA goes to `/signup?plan=<id>`. Signed-in users go to `/app/settings/plans`.
- **Reuse:** `Card`, `Table`, `SegmentedFilter`, `Badge`.
- **New:** `plan-card.tsx` (shared with `/app/settings/plans`) and `plans.ts` config (single source of truth for prices and credits).
- **Data:** `lib/billing/plans.ts` (static). Stripe price IDs come from env.

### 4.3 `/tools` and `/tools/[slug]`: ad landing template [v1]
- **Model:** Opus has about 215 `/tools/*` pages. We ship a typed template and 8 slugs, then add more without code changes.
- **v1 slugs:**
  - `ai-clip-maker`, `podcast-to-shorts`, `video-to-shorts`
  - `auto-reframe-video` (speaker follow)
  - `add-captions-to-video`, `tiktok-captions`, `interview-clips`
  - `long-video-to-short-video`
- **On each page:**
  - H1 with the keyword match, used for Ads Quality Score.
  - Subhead.
  - CTA "Try it free" (`/signup?next=/app/clips/new?preset=<slug>`).
  - Demo video, 3 benefit cards, a "How it works" strip, FAQ (with FAQ JSON-LD) and related tools links.
- **Presets:** `?preset=` pre-fills the new-project settings. For example, `add-captions-to-video` sets "Don't clip, captions only".
- **New:**
  - `app/(marketing)/tools/[slug]/page.tsx` with `generateStaticParams` and `generateMetadata`.
  - `lib/marketing/tools.ts`, an array of `{ slug, keyword, h1, sub, benefits[], faq[], preset, demoVideo }`.
  - The `/tools` index uses a card grid. Reuse the `integrations-catalog.tsx` grid layout.
- **Google Ads:**
  - Load gtag only on public pages plus `/signup`.
  - Fire conversion events `sign_up`, `project_submitted` (first one) and `purchase`. Fire the latter two client-side after the API succeeds and include the stored `gclid`.
  - EEA traffic needs a Consent Mode v2 banner (open decision §12).

### 4.4 `/legal/terms`, `/legal/privacy`, `/legal/media-credits` [v1]
- `media-credits` explains that stock B-roll comes from Pixabay and links to it, and that AI B-roll, music, SFX and thumbnails are generated (Kie.ai / ElevenLabs). Per-clip credits also appear in the editor and export dialog (§5.6, §5.7).
- Pixabay: show the source and author where possible, and self-host downloaded assets (no hot-linking). Pexels has been dropped.

### 4.5 Auth: `/login`, `/signup`, `/verify` [v1]
- **Layout:** `app/(auth)/layout.tsx` is a centered `surface-raised` card on `bg-grid-fade` with the logo.
- **/signup:**
  - "Continue with Google" button, then a divider, then an email field and "Send code".
  - Links to `/login`, Terms and Privacy.
  - Stores `plan`, `next` and attribution cookie data.
- **/login:** same layout with copy "Welcome back" and a link to `/signup`.
- **/verify:**
  - 6 single-digit inputs (new `otp-input.tsx`), "Resend code" (60 s cooldown) and "Use a different email".
  - Sends the email through the existing Brevo client (`lib/email/brevo.ts`).
- **After auth:** create or find User → create a Workspace if none (owner) → grant trial credits (once per user and per email domain, to deter abuse) → redirect to `next` or `/app/clips/new` on first login.
- **Auth library:** [proposal] Auth.js (NextAuth v5) with the Prisma adapter, Google provider and a custom email-OTP provider. It's free and self-hosted. Replace `requireSession()` in `lib/api-auth.ts` and `resolveWorkspaceId()` in `lib/server/workspace.ts` with real session lookups. Add `middleware.ts` protecting `/app/*` and `/api/*` (except `/api/stripe/webhook`, `/api/internal/*` and auth routes).
- **Models:** `User`, `Account`, `Session`, `VerificationToken` (Auth.js) and `WorkspaceMember`. Check existing models first; the dev stub suggests none exist.

---

## 5. Page specs: app

> **Shell for all app pages:** the existing `AppShell`, header and sidebar, with the §10 changes. Every page starts with `<Page><PageHeader …/>`.

### 5.1 `/app/home`: Clips dashboard [v1, adapt `app/app/home/page.tsx`]
- **Purpose:** the landing spot after login. Shows what's processing, recent clips and credits.
- **On it:**
  - PageHeader "Home". Actions: `Button` "New project" (`/app/clips/new`).
  - **Stat row:**
    - Credits left (`/app/settings?tab=billing`)
    - Clips this month
    - Minutes processed
    - Exports this month (`/app/clips/exports`)
  - **Panel "In progress":** up to 3 `ProjectRow`s with `JobStatus` (compact).
  - **Panel "Recent projects":** a 4-up `ProjectCard` grid, each linking to `/app/clips/[id]`. "View all" goes to `/app/clips`.
  - **First-run checklist** (Panel, hidden when complete): Upload a video, Edit a clip, Set brand template, Export.
  - Low-credit `Callout` at ≤20% with "Buy credits", which opens `BuyCreditsDialog`.
- **Reuse:** `Page`, `PageHeader`, `Stat` (extend `STAT_ICONS` with `clips`, `credits`, `minutes`, `exports`), `Panel`, `EmptyState`, the home layout grid, and `Callout` from `numbers/number-ui.tsx`.
- **New:** `project-card.tsx`, `project-row.tsx`, `job-status.tsx` (compact variant), `onboarding-checklist.tsx`.
- **Data:**
  - `GET /api/clips/projects?limit=4`
  - `GET /api/clips/projects?status=active`
  - `GET /api/billing/credits`
  - `GET /api/clips/stats?range=30d`

### 5.2 `/app/clips`: Projects [v1]
- **On it:**
  - PageHeader "Projects". Action: "New project".
  - Toolbar:
    - `SearchInput` (title)
    - `SegmentedFilter`: All / Processing / Ready / Failed
    - `SimpleSelect` sort: Newest, Oldest, Most clips
    - Grid/List toggle (toggle-group)
  - Grid of `ProjectCard`s. Each card shows a thumbnail, title, duration, clip count, `StatusBadge`, expiry hint ("Deletes in 5 days" for free) and a kebab menu: Rename, Delete.
  - Pager follows the `calls-table.tsx` pattern.
  - Empty state: `EmptyState` "No projects yet", with a CTA to `/app/clips/new`.
- **Reuse:** `filters.tsx`, `StatusBadge` (add the `CLIP_JOB_STATE` map), the `calls-table.tsx` pager, `DropdownMenu`, `Dialog`.
- **New:** `project-grid.tsx`, `rename-dialog.tsx`, `confirm-delete-dialog.tsx` (generic, in `components/app/`).
- **Data:**
  - `GET /api/clips/projects?q=&status=&sort=&cursor=`
  - `PATCH /api/clips/projects/[id]` (title)
  - `DELETE /api/clips/projects/[id]` (soft delete plus a storage purge job)

### 5.3 `/app/clips/new`: Upload + settings [v1]
- **Purpose:** steps 1 and 2 of the core flow on one page. The upload starts immediately while the user picks settings.
- **Layout:** `grid lg:grid-cols-[minmax(0,1fr)_380px]`.
- **Left: Source.**
  - `Dropzone`:
    - Drag/drop or click.
    - Accepts mp4, mov, webm and m4v.
    - Max [proposal] 3 h / 5 GB.
    - Uploads direct to object storage with presigned multipart.
  - After a file is picked:
    - `UploadProgressItem` showing filename, size, % and Cancel.
    - Video preview, plus a detected-duration readout after `ffprobe` metadata comes back from the client `<video>` element.
  - Tab "Paste a link":
    - YouTube, Drive or Dropbox URL [v1: Google Drive/Dropbox share links; YouTube link import is an open decision §12].
- **Right: Settings Panel.**
  - **Mode:** `radio-group` with three options:
    - "Talking (podcast, interview)": transcript picks with `gpt-6-luna` (§13.1). Default.
    - "ClipAnything (any footage)": vision picks (§13.2), with a muted cost line "Vision scan · about $0.07 per hour of video".
    - "Captions & reframe only (no clipping)".
  - **Clip length:** `toggle-group`, with options Auto, <30s, 30–60s, 60–90s.
  - **Processing range:** a dual-handle `slider` over the source duration. It drives the credit estimate.
  - **Topic/keywords prompt:** an optional `Textarea`, e.g. "moments about pricing".
  - **Layout:**
    - "Speaker follow" (default; badge "Recommended").
    - "Fit with blur."
    - "Center crop."
  - **Captions:**
    - `Switch` on/off.
    - Preset picker: thumbnails of 6 presets (§8.6).
    - Language `SimpleSelect` (v1: English only).
  - **Brand template:** `SimpleSelect`, either "Default" or the user's template.
  - **Auto stock B-roll (Pixabay):** `Switch`, off by default. Free.
  - **Extras** (`ToggleRow`s, off by default): "Auto music" (generate a matching track per clip, §13.6), "Thumbnails" (3 per clip, §13.8), "Dub to…" + language `SimpleSelect` (§13.9). Each shows its cost line.
  - **`CreditEstimate`:**
    - Until M16 (`FEATURES_ALL_UNLOCKED`): shows "Test mode · est. provider cost $X" instead of credits.
    - Shows "This will use **N credits** · You have M".
    - If N > M: a red text line plus "Buy credits" (`BuyCreditsDialog`) and "Upgrade" (`UpgradeDialog`).
  - **Submit `Button`:** "Get clips". It is disabled until the upload completes or the link is validated. On success, route to `/app/clips/[projectId]`.
- **Reuse:**
  - `Panel`, `OptionGroup`/`SettingRow`, `Field` + `Callout` (from `numbers/number-ui.tsx`), `Tabs`, `Switch`, `Select`, `Textarea`, `Progress`.
  - `ChoiceCard` from `number-ui.tsx` for the Layout options.
- **New:** `dropzone.tsx`, `upload-progress-item.tsx`, `project-settings-form.tsx`, `credit-estimate.tsx`, `caption-preset-picker.tsx`, `lib/clips/upload.ts` (multipart uploader: 10 MB parts, 4 parallel, retry per part).
- **Data:**
  - `POST /api/clips/uploads` → `{ uploadId, key, partUrls[] }`
  - `POST /api/clips/uploads/[id]/complete`
  - `POST /api/clips/estimate` → `{ credits }`
  - `POST /api/clips/projects` with `{ uploadId | url, settings }`. This reserves credits (§9.4; skipped in test mode) and enqueues the `ClipJob`.
- **`?preset=<slug>`** from `/tools/*` pre-fills settings.

### 5.4 `/app/clips/[projectId]`: Processing → Results [v1]
- **Purpose:** steps 3 and 4. One route, two states.
- **State A: processing** (status not `READY` or `FAILED`):
  - PageHeader shows the project title (inline rename) and a "Processing" `StatusBadge`.
  - `JobStatus` card:
    - `StepRail` with the stages Upload ✓ → Transcribe → Find clips → Reframe & caption → Ready.
    - Overall `Progress`.
    - Current stage label and an ETA, estimated from source minutes × the worker's average speed.
    - "You can leave this page. We'll email you when clips are ready." (Notification toggle.)
    - Cancel button: confirm, then refund the reserved credits.
  - Source video thumbnail plus a settings summary (`KeyValue`).
  - Polls `GET /api/clips/projects/[id]/status` every 4 s and stops at a terminal state.
- **State B: results:**
  - PageHeader: title and source duration. Actions:
    - "Export all" (`ExportDialog` batch) [v1: up to 10]
    - "Download SRT"
    - Kebab menu: Rename, Delete project
  - Toolbar:
    - Sort: `SimpleSelect`, either "Score" or "Timeline".
    - Filter: `SegmentedFilter`, either All or Favorites.
    - Count "12 clips".
  - **`ClipGrid`** of `ClipCard`s (`aspect-[9/16]`). Each card has:
    - Poster plus hover-to-play muted preview.
    - Score badge (0–100) with a tooltip showing the Hook, Flow and Value sub-scores.
    - Title and duration.
    - Buttons: "Edit" (`/app/clips/[projectId]/edit/[clipId]`), "Download" (`ExportDialog` single), "★" favorite.
  - Clicking a card opens `ClipPreviewSheet` (`?clip=<id>`, URL-synced so it can be shared and survive the back button). The sheet contains:
    - `VideoPlayer` (9:16, captions burned into the preview).
    - Title and the AI "why this clip" one-liner.
    - Score breakdown and the transcript excerpt.
    - Buttons: Edit, Download, Favorite, Delete clip.
  - Failure state: an `EmptyState` with the failure reason, "Credits refunded" (`StatusBadge` success) and "Try again", which re-creates the project with the same source.
- **Reuse:** `StepRail` (from `numbers/number-ui.tsx`), `Progress`, `Sheet`, `Tooltip`, `StatusBadge`, `KeyValue`, `SegmentedFilter`, `SimpleSelect`, and the `call-recording-player.tsx` media pattern.
- **New:** `job-status.tsx` (full variant), `clip-card.tsx`, `clip-grid.tsx`, `clip-preview-sheet.tsx`, `video-player.tsx` (custom controls: play, scrub, time, mute, fullscreen), `score-badge.tsx`.
- **Data:**
  - `GET /api/clips/projects/[id]` (project + settings)
  - `GET /api/clips/projects/[id]/status` → `{ status, stage, progress, etaSec, error? }`
  - `GET /api/clips/projects/[id]/clips`
  - `PATCH /api/clips/clips/[id]` (favorite, title)
  - `DELETE /api/clips/clips/[id]`
  - `POST /api/clips/projects/[id]/cancel`
  - Media URLs are short-lived signed GETs returned by the API (§7.3).

### 5.5 `/app/clips/[projectId]/edit/[clipId]`: Clip editor [v1]
- **Purpose:** step 5. Fix the cut, captions, crop, B-roll, audio, thumbnail and language, by hand or by asking the AI Producer, then export.
- **Layout:**
  - Sticky top bar, `sticky top-16`:
    - Back to project.
    - Editable clip title.
    - Save state ("Saved" / "Saving…").
    - Undo/Redo.
    - **"AI Producer"** toggle button (`Sparkles` icon). It opens the Producer panel (§13.5).
    - "Export" primary (opens `ExportDialog`).
  - Body: `grid lg:grid-cols-[320px_minmax(0,1fr)_400px]` when the Producer panel is open, otherwise `grid lg:grid-cols-[minmax(0,1fr)_400px]`. Below `lg`, the Producer panel is a `Sheet` from the left.
- **Center: preview.**
  - A 9:16 `VideoPlayer` playing the **source proxy**, with:
    - The crop applied client-side. A CSS transform on `<video>` follows `crop.json` keyframes.
    - An HTML caption overlay (`caption-overlay.tsx`) that renders words.json with the selected preset, including its animation (CSS keyframes that mirror the ASS animation, §8.6), in the same font (`@font-face`).
    - B-roll overlays (stock and AI) as `<video>` layers at their time ranges.
    - Music and SFX played through a small Web Audio mixer (`use-audio-mix.ts`): speech gain 1.0, music at its volume with the same ducking envelope the export uses, and SFX at their offsets.
    - When a dub track is selected, the speech track is swapped for the dub audio.
  - The final render is server-side with ASS and libass, so it can differ slightly from the preview. A "Render preview" button produces a low-res server render for exact checking.
- **Below the preview: timeline** (`scroll-area`, horizontal):
  - Word chips plus shot segments colored by speaker.
  - Lanes: B-roll (stock = neutral, AI = sapphire), Music (one bar), SFX (markers).
  - Trim handles for in/out, with a ±5 s extension into the source.
  - Playhead.
- **Right: `Tabs`** (scrollable `TabsList`).
  1. **Transcript**
     - Word-level transcript of the clip with speaker labels.
     - Select words → "Delete" removes those ranges (jump-cuts). Strikethrough shows deleted words. "Restore".
     - Click a word to seek.
     - Inline-edit a word's text to fix the caption spelling; timing is unchanged.
     - "Remove filler words" (um/uh) button. Rule-based, free.
  2. **Captions**
     - On/off; preset grid (10, animated thumbnails, §8.6).
     - Animation `SimpleSelect`: None / Pop / Bounce / Slide up / Typewriter / Karaoke fill / Glow. Defaults to the preset's animation.
     - **Keyword highlight** `Switch`: the words the LLM flagged as emphasis (§13.1) get the highlight color and a bigger scale. Click any word in the Transcript tab to toggle its highlight.
     - Font size `slider`; position (top, middle, bottom) `toggle-group`.
     - Case (UPPER / Sentence).
     - Words per line 1–3; highlight color per speaker (2 color pickers).
     - "Save as preset" stores the current style on the brand template.
     - Emoji toggle [later].
  3. **Layout**
     - Layout `ChoiceCard`s: Speaker follow / Subject follow (ClipAnything) / Fit with blur / Center crop.
     - Per-shot list (from `crop.json`): time range and speaker. Each shot has a "Focus on" `SimpleSelect` (Speaker A / Speaker B / Both-wide). This overrides the auto choice.
     - "Re-run auto reframe" (free).
  4. **B-roll** with a `Segmented`/`toggle-group` switch: **Stock | AI**.
     - **Stock (Pixabay):**
       - "Auto B-roll": the LLM picks spots and keywords (§13.4), then searches Pixabay.
       - Inserted list: thumbnail, time range, source credit "Video by <name> on Pixabay" with a link, and remove.
       - "Add B-roll" opens `StockBrollPicker`, a Sheet with a `SearchInput` that defaults to keywords from the selected transcript text, a portrait results grid with hover preview, and "Insert at playhead".
     - **AI (Wan 3.0 via Kie.ai):**
       - "Suggest AI shots": the LLM proposes 1–3 spots with prompts (shown as editable cards).
       - Each card: prompt `Textarea`, duration 3–5 s, resolution 480p/720p, cost line ("≈ $0.16 · 4 s 480p"), and "Generate".
       - Generation status uses `StatusBadge` (Queued → Generating → Ready / Failed). Ready shots can be previewed, inserted at their spot or at the playhead, regenerated or removed.
  5. **Audio** with sub-tabs **Music | SFX** (§13.6, §13.7).
     - **Music** (no library; AI-generated only):
       - Prompt `Textarea`, pre-filled with an AI-suggested prompt from the clip's transcript and mood (`POST …/music/suggest`, `gpt-6-luna`). A "Suggest again" link re-rolls it.
       - Optional mood `Pills` (Upbeat, Chill, Dramatic, Inspiring, Lo-fi, Cinematic) that append to the prompt.
       - Instrumental `Switch`, on by default (vocals compete with speech).
       - Length readout: "Matches clip: 0:42". This is automatic and follows trims. If the clip length changes by more than 1 s after a generation, show "Clip length changed · Regenerate to fit" (the export also trims and fades the track to fit).
       - **Generate** button with a cost line. The last 3 generations show as versions with play/pause previews; pick one.
       - Volume `slider` (default −18 dB under speech), **Duck under speech** `Switch` (on) with a depth `slider` (default −12 dB), fade in/out `Switch`.
       - Remove music.
     - **SFX:**
       - Preset `Pills`: Whoosh, Pop, Ding, Riser, Bass hit, Click, Camera shutter, Swipe, Record scratch, Applause.
       - Custom prompt `SearchInput` ("door slam, short").
       - Clicking a preset or "Generate" adds the effect at the playhead. Each effect row has offset, volume, preview and remove.
  6. **Thumbnail** (§13.8)
     - "Generate thumbnails": 3 variants in a grid. Aspect `toggle-group` 9:16 / 16:9.
     - The chosen source frame and the AI-written prompt and title text are shown and editable, then "Regenerate".
     - Pick one → it becomes the clip's poster and is downloadable from the Export dialog.
  7. **Dub** (§13.9)
     - Target language `SimpleSelect`, a cost line ("≈ $0.35 for 0:42"), and "Dub clip".
     - Each finished dub shows as an audio-track option (Original / Spanish / …) that the preview and the export can use.
     - "Lip-sync" is shown disabled with a "Coming later" tooltip.
  8. **Brand**
     - Apply template `SimpleSelect`.
     - Logo on/off and position.
     - Intro/outro [later].
     - Progress bar [later].
- **Autosave:** debounced 1 s `PATCH /api/clips/clips/[id]` with `{ edits }`. `edits` is a versioned JSON (§6). Undo/redo uses an in-memory stack. Each AI Producer turn is one undo step.
- **Keyboard:** Space (play/pause), ←/→ (1 s), Backspace (delete selected words), ⌘Z / ⇧⌘Z, ⌘K (focus the Producer input).
- **Reuse:**
  - `Tabs`, `Switch`, `Select`, `Slider`, `Popover`, `Sheet`, `Tooltip`, `Textarea`, `ScrollArea`, `Badge`.
  - `DraftBar` + `Section` + `ToggleRow` + `Pills` from `receptionist/ai-ui.tsx` for the save bar, tab sections, mood/SFX chips and Producer suggestion chips.
  - `ChoiceCard` and `SearchInput`. `StatusBadge` for every generation. The call-recording player pattern for audio previews.
- **New:** `components/clips/editor/` → `editor-shell.tsx`, `editor-top-bar.tsx`, `preview-stage.tsx`, `caption-overlay.tsx`, `timeline.tsx`, `transcript-panel.tsx`, `captions-panel.tsx`, `layout-panel.tsx`, `broll-panel.tsx`, `ai-broll-card.tsx`, `audio-panel.tsx`, `music-panel.tsx`, `sfx-panel.tsx`, `thumbnail-panel.tsx`, `dub-panel.tsx`, `brand-panel.tsx`, `stock-broll-picker.tsx`, `use-editor-state.ts` (reducer + undo), `use-audio-mix.ts`, `use-generation.ts` (polls `AiGeneration`), and `components/clips/producer/` → `producer-panel.tsx`, `producer-message.tsx`, `tool-call-card.tsx`, `use-producer.ts`.
- **Data:**
  - `GET /api/clips/clips/[id]` → `{ clip, edits, words, crop, mediaUrls, generations }`
  - `PATCH /api/clips/clips/[id]`
  - `POST /api/clips/clips/[id]/preview-render`
  - `GET /api/clips/broll/search?q=&orientation=portrait` (Pixabay)
  - `POST /api/clips/clips/[id]/broll` · `/broll/auto` · `/broll/ai/suggest` · `/broll/ai`
  - `POST /api/clips/clips/[id]/music/suggest` · `/music` · `/sfx`
  - `POST /api/clips/clips/[id]/thumbnails` · `/dubs`
  - `GET /api/clips/generations/[id]`
  - `POST /api/clips/clips/[id]/producer` (streams)

### 5.6 `ExportDialog` (from Results, Preview sheet and Editor) [v1]
- **On it:**
  - Resolution: `radio-group`, 720p (free) or 1080p (paid). [proposal]
  - Captions burned in (on), and "Also download .srt".
  - **Watermark row:**
    - Free and trial: "Includes a small watermark", with a "Remove with Starter" link that opens `UpgradeDialog`.
    - Rule: `watermark = !can(ws, 'no_watermark')`. Off whenever `FEATURES_ALL_UNLOCKED` is on.
  - **Audio track:** `SimpleSelect` Original / each finished dub (§13.9).
  - **Thumbnail:** "Download thumbnail" when one is picked (§13.8).
  - Stock media credits list, when any B-roll is used. It is copyable text for the post description.
  - "Export" button → render job → inline progress → "Download MP4" (signed URL) + "Copy title / description".
  - Exports are **free** (no credit charge). Credits are charged on processing (§9).
  - **No publishing in v1** (download only). "Publish to…", scheduling: [later].
- **Reuse:** `Dialog`, `RadioGroup`, `Switch`, `Progress`, `Button`.
- **New:** `export-dialog.tsx`.
- **Data:** `POST /api/clips/clips/[id]/export` → `{ renderId }`, `GET /api/clips/renders/[id]`, `GET /api/clips/clips/[id]/srt`.

### 5.7 `/app/clips/exports`: Export history [v1]
- **On it:**
  - Table: Clip (thumbnail + title, links to the editor), Project, Resolution, Watermark yes/no, Created, Expires, Status, Download.
  - `SegmentedFilter`: All / Ready / Failed.
  - Empty state.
- **Reuse:** the `calls-table.tsx` table + pager pattern, `StatusBadge`.
- **Data:** `GET /api/clips/renders?cursor=`.

### 5.8 `/app/clips/brand`: Brand template [v1 single template]
- **On it:**
  - Left: settings form.
    - Template name.
    - Default caption preset and colors.
    - Font (from 6 bundled OFL fonts).
    - Logo upload (PNG/SVG via presigned upload), with position and opacity.
    - Default layout.
    - Default clip length.
    - Auto B-roll default.
  - Right: a live 9:16 preview using `caption-overlay.tsx` over the sample clip.
  - `DraftBar` handles save and discard.
- Also stores saved caption presets (§13.3) and a default music mood for the music prompt [later].
- **Later:** multiple templates, intro/outro and the brand-kit wizard (`/app/clips/brand/new`). No music library.
- **Reuse:** `OptionGroup`/`SettingRow`, `DraftBar`, `Panel`.
- **New:** `brand-template-form.tsx`, `logo-uploader.tsx` (reuses `dropzone.tsx`).
- **Data:** `GET/PUT /api/clips/brand-template`, `POST /api/clips/uploads` (kind=`logo`).

### 5.9 `/app/settings`: adapt `settings-tabs.tsx` [v1]
- **`?tab=profile`:** name, email (read-only), time zone and avatar. Danger zone: delete account (confirm by typing your email).
- **`?tab=team`:**
  - v1: members table (you, owner) with "Invite" disabled and a "Coming soon" badge.
  - Later: invites, roles and the shared credit pool.
  - Reuse the existing team `Table`.
- **`?tab=billing`:**
  - **Plan panel:** current plan, renewal date, "Change plan" (`/app/settings/plans`) and "Manage billing" (Stripe portal).
  - **Credits panel:** usage meters (existing `Progress`, warning at 80%) per bucket: Plan (resets on date), Trial (expires on date), Free monthly. Built in M16; before that the panel shows "Test mode · all features unlocked" and the month's provider cost from `AiUsage`. "Buy credits" opens `BuyCreditsDialog`.
  - **Credit history table** (ledger): date, description ("Project: My Podcast Ep 4 — 42 min"), ±credits, balance after.
  - Invoices link via the Stripe portal.
- **`?tab=notifications`:** `Switch`es for "Email me when clips are ready" (default on), "Low credits" and "Product updates".
- **Remove these phone-specific tabs from the tab list:** numbers, calling, A2P, and anything Telnyx-related.
- **Data:**
  - `GET/PATCH /api/me`
  - `GET /api/billing/credits`
  - `GET /api/billing/ledger?cursor=`
  - `POST /api/billing/portal`
  - `GET/PATCH /api/me/notifications`

### 5.10 `/app/settings/plans`: Plan picker [v1]
- Same `plan-card.tsx` as `/pricing`, plus a Monthly/Yearly toggle and a "Current plan" badge. Each CTA calls `POST /api/billing/checkout` and redirects to Stripe Checkout. On return, a `?success=1` toast fires.
- Top-up packs row (one-time Checkout) [later, optional, decided at M16].

### 5.11 `UpgradeDialog` and `BuyCreditsDialog` [v1]
- **UpgradeDialog:**
  - Opened by: the over-limit `CreditEstimate`, the watermark row, the 1080p option and any generation over the limit (M16 only).
  - Content: 2 plan cards (Starter, Pro) with a "Compare all plans" link.
- **BuyCreditsDialog:** [later, optional] only if top-ups are added at M16.
- **New:** `upgrade-dialog.tsx`, `buy-credits-dialog.tsx`.

### 5.12 `/app/integrations`: adapt `integrations-catalog.tsx` [v1]
- Cards:
  - Pixabay (stock B-roll): built-in, "Connected" badge.
  - Kie.ai (AI B-roll, thumbnails) and ElevenLabs (music, SFX, dubbing): built-in, "Connected" badges. Server keys, nothing for the user to set up.
  - Google Drive import: [later] "Coming soon".
  - YouTube Shorts publishing: [later] (no publishing in v1).
  - TikTok: [later].
  - Instagram Reels: [later].
  - Zapier/API: [later].
- Remove the Telnyx, CRM and phone integrations from the list.

### 5.13 `/app/help`: adapt `help/help-center.tsx` [v1]
- Replace the categories with:
  - Getting started
  - Uploading
  - Credits & billing
  - Editing clips
  - Captions
  - Exporting
  - Stock media & credits
  - Troubleshooting (e.g. "Speaker follow picked the wrong person")
- Add a contact form, a `mailto:` link or a Brevo-sent message.

### 5.14 System pages [v1]
- `app/not-found.tsx`, `app/error.tsx`, `app/app/loading.tsx` (skeleton of PageHeader + grid) and `app/app/clips/[projectId]/loading.tsx`, all using `skeleton`.

---

## 6. Data model (Prisma, add to `/prisma/schema.prisma`)

> Check existing models first: extend `Workspace` and don't duplicate it. Names are suggestions. Money is stored in cents and durations in milliseconds.

```prisma
enum ClipProjectStatus { DRAFT UPLOADING QUEUED PREPARING TRANSCRIBING SCANNING FINDING_CLIPS REFRAMING RENDERING READY FAILED CANCELED }
enum ClipRenderStatus  { QUEUED RENDERING READY FAILED EXPIRED }
enum CreditBucket      { TRIAL FREE_MONTHLY PLAN TOPUP PROMO }
enum LedgerKind        { GRANT RESERVE CAPTURE RELEASE REFUND EXPIRE ADJUST TEST }   // TEST = would-be cost logged while FEATURES_ALL_UNLOCKED
enum GenerationKind    { BROLL_VIDEO MUSIC SFX THUMBNAIL DUB }
enum GenerationStatus  { QUEUED RUNNING READY FAILED CANCELED }

model ClipUpload {            // one source file in object storage
  id String @id  workspaceId String  key String  filename String  bytes BigInt
  mime String  durationMs Int?  width Int?  height Int?  status String // PENDING|COMPLETE|ABORTED
  s3UploadId String?  kind String @default("source") // source|logo
  createdAt DateTime @default(now())
}
model ClipProject {
  id String @id  workspaceId String  createdById String  title String
  uploadId String?  sourceUrl String?  settings Json   // §5.3 settings, versioned {v:2, mode:'talking'|'anything'|'captions', extras:{music,thumbnails,dubLang}, ...}
  rangeStartMs Int  rangeEndMs Int  status ClipProjectStatus @default(DRAFT)
  stage String?  progress Int @default(0)  error String?
  creditsReserved Int @default(0)  creditsCaptured Int @default(0)
  transcriptKey String?  proxyKey String?  thumbKey String?
  expiresAt DateTime?  deletedAt DateTime?  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  clips Clip[]  jobs ClipJob[]
  @@index([workspaceId, createdAt])
}
model ClipJob {               // Postgres-backed queue (SKIP LOCKED)
  id String @id  projectId String  clipId String?  type String // PROCESS_PROJECT|RENDER_EXPORT|PREVIEW_RENDER|AUTO_BROLL|AI_GENERATION_POLL|MUSIC|SFX|THUMBNAIL|DUB|PURGE
  status String @default("QUEUED") // QUEUED|RUNNING|DONE|FAILED
  payload Json  attempts Int @default(0)  lockedBy String?  lockedAt DateTime?  runAfter DateTime @default(now())
  error String?  createdAt DateTime @default(now())  finishedAt DateTime?
  priority Int @default(0)
  @@index([status, priority, runAfter])
}
model Clip {
  id String @id  projectId String  workspaceId String  title String  reason String?
  startMs Int  endMs Int  score Int  scores Json   // {hook,flow,value}
  cropKey String  wordsKey String  previewKey String?  posterKey String?
  edits Json   // {v:2, trim:{in,out}, cutRanges:[[s,e]], wordFixes:{i:"text"}, captions:{preset,animation,size,pos,case,wpl,colors,emphasis:[i]}, layout:{mode, shotOverrides:[{i,focus}]}, broll:[{id,source:'stock'|'ai',assetId|generationId,startMs,endMs}], music:{generationId,volumeDb,duck,duckDepthDb,fade}|null, sfx:[{id,generationId,atMs,volumeDb}], audioTrack:'original'|dubTrackId, thumbnailId?, brand:{templateId,logo}}
  aiMeta Json? // {emphasisWords, mood, brollIdeas} from the clip-pick call (§13.1)
  favorite Boolean @default(false)  deletedAt DateTime?  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
}
model ClipRender {
  id String @id  clipId String  workspaceId String  status ClipRenderStatus @default(QUEUED)
  resolution Int  watermark Boolean  editsVersionHash String  key String?  srtKey String?
  expiresAt DateTime?  error String?  createdAt DateTime @default(now())
}
model BrandTemplate {
  id String @id  workspaceId String  name String  settings Json  logoKey String?  isDefault Boolean @default(true)
}
model StockAsset {            // cache + attribution for Pixabay
  id String @id  provider String  providerId String  pageUrl String  author String  authorUrl String?
  width Int  height Int  durationS Int  storageKey String?  fetchedAt DateTime @default(now())
  @@unique([provider, providerId])
}
model CreditGrant {
  id String @id  workspaceId String  bucket CreditBucket  amount Int  remaining Int  paid Boolean
  expiresAt DateTime?  stripeRef String?  createdAt DateTime @default(now())
}
model CreditLedgerEntry {
  id String @id  workspaceId String  kind LedgerKind  amount Int  balanceAfter Int
  grantId String?  projectId String?  clipId String?  memo String  createdAt DateTime @default(now())
  @@index([workspaceId, createdAt])
}
model Subscription {
  id String @id  workspaceId String @unique  planId String  interval String // month|year
  stripeCustomerId String  stripeSubscriptionId String?  status String  currentPeriodEnd DateTime?
}
model AiGeneration {          // one paid generation (§13.0.1)
  id String @id  workspaceId String  projectId String?  clipId String?  kind GenerationKind
  status GenerationStatus @default(QUEUED)  provider String  model String  prompt String?
  params Json  providerTaskId String?  outputKey String?  costUsdMicros Int?  creditsCharged Int @default(0)
  error String?  createdAt DateTime @default(now())  finishedAt DateTime?
  @@index([clipId, kind])  @@index([workspaceId, createdAt])
}
model AiUsage {               // every paid API call, for real-cost tracking
  id String @id  workspaceId String  projectId String?  clipId String?  generationId String?
  provider String  model String  units Float  unitType String // tokens_in|tokens_out|seconds|minutes|images
  costUsdMicros Int  createdAt DateTime @default(now())
  @@index([workspaceId, createdAt])
}
model ProducerThread { id String @id  clipId String @unique  workspaceId String  createdAt DateTime @default(now()) }
model ProducerMessage {
  id String @id  threadId String  role String // user|assistant|tool
  content String  toolCalls Json?  editsPatch Json?  undone Boolean @default(false)  createdAt DateTime @default(now())
}
model Thumbnail { id String @id  clipId String  generationId String  aspect String  sourceFrameMs Int  prompt String  titleText String?  imageKey String  picked Boolean @default(false) }
model DubTrack {
  id String @id  clipId String  targetLang String  provider String @default("elevenlabs")  providerDubId String?
  audioKey String?  wordsKey String?  watermarked Boolean  status GenerationStatus @default(QUEUED)  generationId String
}
// Auth.js: User, Account, Session, VerificationToken (+ WorkspaceMember{workspaceId,userId,role})
// User also gets: gclid String?, utm Json?, signupPlan String?, trialGrantedAt DateTime?
```

---

## 7. API endpoints (all under `app/api/`)

| Method & path | Purpose | Milestone |
|---|---|---|
| POST `/api/clips/uploads` | Create ClipUpload + S3 multipart; return part URLs | M1 |
| POST `/api/clips/uploads/[id]/complete` | Complete multipart; store bytes/mime | M1 |
| POST `/api/clips/uploads/[id]/abort` | Abort multipart | M1 |
| POST `/api/clips/estimate` | `{durationMs, range, settings}` → credits | M2 |
| GET/POST `/api/clips/projects` | List (q, status, sort, cursor) / create + reserve + enqueue | M1/M3 |
| GET/PATCH/DELETE `/api/clips/projects/[id]` | Read / rename / soft delete (+PURGE job) | M1 |
| GET `/api/clips/projects/[id]/status` | `{status, stage, progress, etaSec, error}` | M3 |
| POST `/api/clips/projects/[id]/cancel` | Cancel + release credits | M3 |
| GET `/api/clips/projects/[id]/clips` | Clips with signed poster/preview URLs | M4 |
| GET/PATCH/DELETE `/api/clips/clips/[id]` | Editor payload / save edits, title, favorite / delete | M4/M6 |
| POST `/api/clips/clips/[id]/preview-render` | Low-res exact preview job | M6 |
| POST `/api/clips/clips/[id]/export` | Create ClipRender (watermark = Free/trial via `can()`; audio track; thumbnail) | M5 |
| GET `/api/clips/renders` · GET `/api/clips/renders/[id]` | Export history / status + signed download | M5 |
| GET `/api/clips/clips/[id]/srt` · `/api/clips/projects/[id]/srt` | Caption files | M5 |
| GET `/api/clips/broll/search` | Proxy Pixabay; 24 h cache; never expose keys | M9 |
| POST `/api/clips/clips/[id]/broll` · `/broll/auto` | Insert stock / auto-place stock | M9 |
| POST `/api/clips/clips/[id]/broll/ai/suggest` · `/broll/ai` | AI shot suggestions (`gpt-6-luna`) / generate a Wan 3.0 shot via Kie | M9 |
| GET `/api/clips/generations/[id]` | Generation status + signed output URL | M9 |
| POST `/api/internal/kie/callback?token=` | Kie task callback (per-generation signed token) | M9 |
| POST `/api/clips/clips/[id]/music/suggest` · `/music` | Suggested music prompt / generate a track (ElevenLabs Music) | M10 |
| POST `/api/clips/clips/[id]/sfx` | Generate or reuse a cached SFX (ElevenLabs SFX) | M10 |
| POST `/api/clips/clips/[id]/producer` · GET `…/producer` | AI Producer turn (SSE stream, tools §13.5) / thread history | M11 |
| POST/GET `/api/clips/clips/[id]/thumbnails` · PATCH `/api/clips/thumbnails/[id]` | Generate 3 / list / pick | M12 |
| POST/GET `/api/clips/clips/[id]/dubs` | Start a dub / list dub tracks | M13 |
| GET `/api/clips/usage` | Provider cost by feature (test-mode cost readout) | M4 |
| GET/PUT `/api/clips/brand-template` | Single template | M14 |
| GET `/api/clips/stats` | Dashboard stats | M4 |
| GET `/api/billing/credits` · GET `/api/billing/ledger` | Balance by bucket / history | M16 |
| POST `/api/billing/checkout` · POST `/api/billing/portal` | Stripe Checkout / portal | M16 |
| POST `/api/stripe/webhook` | checkout.session.completed, invoice.paid, customer.subscription.updated/deleted → grants | M16 |
| GET/PATCH `/api/me` · `/api/me/notifications` | Profile / email prefs | M15 |
| POST `/api/internal/jobs/[id]/progress` | Worker → app: stage/progress/outputs/error. HMAC with `WORKER_SHARED_SECRET` | M3 |

### 7.3 Storage layout (S3-compatible; [proposal] Cloudflare R2 because egress is free)

```
ws/{workspaceId}/uploads/{uploadId}/source.{ext}
ws/{workspaceId}/projects/{projectId}/proxy_720.mp4      # CFR 30fps 720p, faststart (editor preview)
ws/{workspaceId}/projects/{projectId}/audio.wav          # 16k mono (deleted after ASR)
ws/{workspaceId}/projects/{projectId}/words.json         # full transcript, word timestamps
ws/{workspaceId}/projects/{projectId}/thumb.jpg
ws/{workspaceId}/clips/{clipId}/crop.json  words_spk.json  preview.mp4  poster.jpg
ws/{workspaceId}/clips/{clipId}/gen/{generationId}.{mp4|mp3|png}   # AI B-roll, music, thumbnails, dub audio
ws/{workspaceId}/sfx/{presetSlug}.mp3                       # per-workspace SFX preset cache
ws/{workspaceId}/renders/{renderId}/clip.mp4  clip.srt
ws/{workspaceId}/brand/{templateId}/logo.png
stock/pixabay/{providerId}.mp4                            # Pixabay asks for self-hosting; cache videos
```

- **Signed GETs:** 1 h for previews, 24 h for downloads.
- **Bucket CORS:** allow PUT from the app origin for multipart.
- **Lifecycle rules:** delete `audio.wav` after 1 day. Delete project prefixes when `expiresAt` passes ([proposal] free 7 days, paid 30 days). Renders expire after 30 days.

---

## 8. Processing pipeline architecture

### 8.1 Components
```
Browser ──presigned multipart PUT──▶ Object storage (R2)
   │                                    ▲      │
   │ POST /api/clips/projects            │      │ GET source / PUT outputs
   ▼                                    │      ▼
Next.js app (Coolify) ──INSERT ClipJob──▶ Postgres ◀──SELECT … FOR UPDATE SKIP LOCKED── Python worker(s) (Coolify, CPU)
   ▲                                                                                      │
   └──────────── POST /api/internal/jobs/[id]/progress (HMAC) ◀───────────────────────────┘
```

- **Queue:** Postgres table `ClipJob`, claimed with `FOR UPDATE SKIP LOCKED`. This needs no new infrastructure (no Redis). The worker runs `concurrency = 1` job per container, with N containers.
  - Heartbeat: the worker updates `lockedAt` every 30 s.
  - The reaper (a cron route or the worker) re-queues jobs whose `lockedAt` is older than 5 min, up to 3 attempts.
- **Worker:** a new top-level `worker/` folder in the repo (Python 3.11), built from `speakercrop/v3`.
  - Dockerfile: `python:3.11-slim` + ffmpeg (with libass) + torch CPU wheel + mediapipe + opencv-python-headless + faster-whisper + resemblyzer + boto3 + psycopg.
  - Bake the model files into the image: `yunet.onnx`, `face_landmarker.task`, the faster-whisper `medium.en` int8 cache and the Poppins fonts.
- **Worker env:** `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `APP_URL`, `WORKER_SHARED_SECRET`, `OPENAI_API_KEY`, `CLIP_LLM_MODEL=gpt-6-luna`, `GEMINI_API_KEY`, `VISION_MODEL`, `KIE_API_KEY`, `KIE_API_BASE_URL`, `KIE_UPLOAD_BASE_URL`, `ELEVENLABS_API_KEY`, `PIXABAY_API_KEY`, `ASR_MODEL=medium.en` (names only; values live in Coolify secrets).

### 8.2 Stages for `PROCESS_PROJECT` (with status and progress weights)
1. **PREPARING (0→10%)**
   - ffprobe.
   - Cut to the processing range.
   - Transcode a 720p CFR 30 fps proxy (`-preset veryfast`), extract 16 kHz mono audio and grab a thumbnail.
   - Fail fast if there's no audio stream or the duration is over the limit.
2. **TRANSCRIBING (10→45%)**
   - Run `transcribe.py` (faster-whisper, word timestamps) on the full range once and save `words.json`.
   - Report progress from the segment timestamps.
2b. **SCANNING (45→50%), ClipAnything only:** local shortlist plus frame sampling (§13.2).
3. **FINDING_CLIPS (50→55%)**. Talking mode: transcript LLM (`gpt-6-luna`, §13.1). ClipAnything: Gemini vision ranking (§13.2). Skipped in "captions only" mode; that mode makes one clip = the whole range (max [proposal] 3 min).
   - Build a compact transcript (sentences with start times, about 1 token per word).
   - One `gpt-6-luna` call with the system prompt: return JSON `[{start, end, title, reason, hook, flow, value, emphasisWords, mood, brollIdeas}]`. Constraints: length bucket, user keyword prompt, and no overlap.
   - Snap starts and ends to sentence boundaries (pause > 300 ms).
   - Clamp to the length bucket and dedupe.
   - Keep the top N, where N = min(20, ~1 per 3 source minutes).
   - `score = round(0.4*hook + 0.3*flow + 0.3*value)`.
   - Long transcripts over the model context: chunk into 20-min windows with 1-min overlap, then merge.
4. **REFRAMING (55→85%)**, per clip:
   - Cut the clip window from the proxy (+0.5 s padding).
   - Slice `words.json` to the window and rebase the times.
   - Run `speakercrop.py` with `WORDS=<sliced>` (this skips ASR) and `NORENDER=1`, so it emits `crop.json` and `words_spk.json`.
5. **RENDERING (85→100%)**, per clip:
   - Build the ASS from `edits.captions` (default preset).
   - Single-pass ffmpeg render: crop path + captions → `preview.mp4` (720×1280, libx264 veryfast crf 23) + `poster.jpg`.
   - Upload and POST progress. Then insert the `Clip` rows (the worker can write via the internal API, which keeps all DB writes in the app).
6. **READY**:
   - Capture the reserved credits (§9.4; test-mode ledger entry until M16).
   - Run the project's extras (auto music, thumbnails, dub) as separate jobs per clip.
   - Send the "clips ready" email via Brevo if the user's preference is on.
   - Set `expiresAt`.
7. **FAILED / CANCELED:** release all reserved credits automatically. Show the reason. Record a ledger REFUND/RELEASE entry.

`RENDER_EXPORT` job: apply `edits` (trim, cutRanges via an ffmpeg concat/select filter, shot overrides, stock and AI B-roll overlays, animated captions, logo, watermark, the audio mix: speech or dub track + music with `sidechaincompress` ducking + SFX), then do the final render at 720p or 1080p (crf 20). Upload `clip.mp4` + `clip.srt`.

### 8.3 Changes needed in speakercrop (worker refactor, M3/M4)
- Make it importable: `analyze(clip_path, words) -> {shots, words_spk}` and `render(clip_path, crop, ass, out, size, watermark?)`. Keep the CLI.
- Add **`crop.json` output**. It contains the per-shot `{startMs, endMs, speaker, mode: 'A'|'B'|'both', cx, cy, w, h}` plus the ease params. The editor preview and shot overrides depend on it.
- Make the caption style a parameter: font, size, colors per speaker, case, words-per-line, position. Today's yellow/green Poppins ExtraBold pop becomes preset #1, "Bold Pop".
- **Fallbacks the prototype lacks**, all required for v1:
  - 1 face: follow that face.
  - 0 faces: center crop.
  - More than 2 faces, or a multi-cam cut detected by a scene-change score: per-shot face pick by loudness and lip motion, falling back to "Fit with blur".
  - Log the chosen mode in `crop.json`.
- Add 1080p output (scale the crop window, not the proxy). Read from the original source for exports.
- Keep the env knobs (HYST, LEAD, MIN_SEG, EASE, …) as worker defaults. Don't expose them in the UI.
- **Benchmarks from the README:** about 35–40 s wall time per source minute at 720p on 8 cores for the full pipeline (ASR 13–20 s/min with medium.en; crop + captions + encode about 18–19 s/min). Agreement is 93–98% with zero false cuts.
  - ASR runs once over the whole source. Crop and render run only over the clip minutes, so a 60-min source with 12 × 45 s clips costs about 15–20 min of ASR plus about 3 min of crop and render on one 8-core worker.

### 8.4 Status → UI mapping (`CLIP_JOB_STATE` in `components/app/status.tsx`)

| Status | Badge tone | Label | StepRail step |
|---|---|---|---|
| DRAFT / UPLOADING | muted | Uploading | Upload |
| QUEUED | neutral | Queued | Upload ✓ |
| PREPARING / TRANSCRIBING | info | Transcribing | Transcribe |
| SCANNING | info | Scanning scenes | Scan scenes (ClipAnything only) |
| FINDING_CLIPS | info | Finding clips | Find clips |
| REFRAMING / RENDERING | info | Reframing & captioning | Reframe & caption |
| READY | success | Ready | Ready |
| FAILED | danger | Failed · credits refunded | — |
| CANCELED | muted | Canceled | — |

### 8.5 Scale and cost levers
- Start with 1–2 CPU worker containers. The queue depth drives the ETA shown to users.
- If queues grow: add workers, use `small.en` for Free/trial (about 5 s/min ASR), or add one GPU box for ASR only [later].
- Priority: paid jobs first. `ORDER BY priority DESC, runAfter`; add a `priority Int` column.

### 8.6 Caption presets (v1, all from the same ASS generator, animated)
1. Bold Pop (prototype default: UPPER, 1–3 words, active word scales and colors per speaker). Animation: Pop.
2. Clean White (sentence case, white with a black stroke, active word in sapphire). Animation: none.
3. Boxed (word background box on the active word). Animation: Pop.
4. Karaoke (whole line visible, active word color fill). Animation: Karaoke fill.
5. Minimal (small, bottom third). Animation: none.
6. Neon (glow). Animation: Glow pulse.
7. Bounce (UPPER, active word bounces in). Animation: Bounce.
8. Typewriter (characters reveal left to right). Animation: Typewriter.
9. Slide Up (each line slides up and fades in). Animation: Slide up.
10. Highlighter (marker-style box behind emphasis words, §13.1). Animation: Pop on emphasis words only.

Every preset supports keyword highlight (`edits.captions.emphasis`). The single source of truth is `caption-presets.json`, which generates both the TS (browser overlay) and Python (ASS) maps (§13.3).

Fonts: bundle only OFL fonts (Poppins, Montserrat, Inter, Anton, Bebas Neue, Roboto). The same files are served to the browser preview via `@font-face`.

---

## 9. Credits model (late milestone M16; prices match Opus for now)

> **Credits are not a priority.** Until M16, `FEATURES_ALL_UNLOCKED` (§1 rule 12) makes every feature work without credits, and the ledger only logs would-be costs (`kind = TEST`). Everything in this section is built in M16.

### 9.1 Unit
**1 credit = 1 minute of source video processed** (the processing range, rounded up, minimum 1). This matches Opus.

### 9.2 Plans (match Opus for now)

| Plan | Price | Credits | $/credit | Watermark | Notes |
|---|---|---|---|---|---|
| Free | $0 | 60/mo (assumed, like Opus; confirm) | — | **Yes** | 720p |
| Trial | $0, once per user, no card | **90 credits for 7 days** (Rick said "70 days"; read as 7, pending confirmation) | — | **Yes** | Unlocks all features during the trial |
| **Starter** | **$15/mo** | **150/mo** | $0.100 | No | 1080p |
| **Pro** | **$29/mo**, or **$14.50/mo billed yearly** | **300/mo** | $0.097 (yearly $0.048) | No | 1080p, priority queue |
| Top-ups [later, optional] | — | — | — | — | Decide at M16 |

- Plan credits reset monthly. Trial credits expire after 7 days.
- **Watermark:** on for Free and trial exports, off for Starter and Pro. Rule: `watermark = !can(ws, 'no_watermark')`. It's always off while `FEATURES_ALL_UNLOCKED` is on.

### 9.3 Action costs (proposal for M16; tune from the `TEST` ledger data)

| Action | Credits (proposal) | Provider cost (§13.10) |
|---|---|---|
| Process source, talking or captions-only | 1 / source minute | ≈ $0.002–0.006 / min |
| Process source, ClipAnything | 1 / source minute (same as talking) | + ≈ $0.001 / min |
| Edit, re-reframe, preview render, export, SRT, AI Producer chat | 0 | ≈ $0.001 / turn |
| Stock B-roll (Pixabay) | 0 | $0 |
| AI B-roll shot (≤ 5 s) | 3 at 480p · 6 at 720p | $0.16–0.40 |
| Music generation | 2 per generation | ≈ $0.11 (45 s) |
| SFX | 0 (rate-limited) | ≈ $0.004 |
| Thumbnails (3 variants) | 3 | ≈ $0.18 |
| Dubbing | 6 per clip minute per language (rounded up) | $0.50 / min |

At Opus-matching prices (≈ $0.10 per credit), each AI action is priced at about 1.5–2× its provider cost.

### 9.4 Mechanics (M16)
- **Estimate:** `/api/clips/estimate` = ceil(rangeMinutes). Generation buttons show their credit price (or USD in test mode).
- **Reserve on submit:** ledger RESERVE. Spend order: Trial → Free monthly → Plan → Promo (expiring first).
- **Capture on READY:** CAPTURE. On FAILED or CANCELED, use RELEASE (automatic refund). A failed generation is refunded the same way.
- `lib/billing/entitlements.ts`: `can()`, `costOf()`, `reserve()`, `capture()`, `release()`, honoring `FEATURES_ALL_UNLOCKED` and the `test` plan. Keep a single-transaction balance update (`SELECT … FOR UPDATE` on the workspace's grants).
- **Stripe:** Products/Prices for Starter monthly, Pro monthly and Pro yearly.
  - The webhook grants credits idempotently, keyed by the Stripe event id.
  - `getStripe()` returning null keeps mock mode working locally.

### 9.5 Margin check (estimate)
- The core loop (ASR, picks, reframe, captions, render, R2) costs ≈ $0.003–0.008 per credit, against $0.048–0.100 revenue per credit.
- AI generations carry their own credit prices (§9.3), so heavy AI users can't sink the margin.
- **Free tier exposure:** 60 credits × ≈ $0.006 ≈ $0.36 per active free user per month, plus any AI generations (limit these on Free, e.g. 1 AI action per day [proposal]).

---

## 10. Navigation and shell change list

### 10.1 `lib/nav.ts`
1. `ProductKey`: add `'clips'`. Keep the phone keys in the type until M18 so imports compile.
2. Add the `CLIPS` context: `{ key:'clips', title:'Clips', shortTitle:'Clips', href:'/app/clips', icon: Scissors, items }`.
   - Group **Create:**
     - Projects `/app/clips` (exact, icon `Clapperboard`)
     - New project `/app/clips/new` (icon `Upload`)
   - Group **Customize:** Brand template `/app/clips/brand` (icon `Palette`)
   - Group **Library:** Exports `/app/clips/exports` (icon `Download`)
   - Later, append: Calendar `/app/clips/calendar`, Analytics `/app/clips/analytics`, Assets `/app/clips/library` (logos only; no music library).
   - Make the editor route `/app/clips/[id]/edit/[clipId]` resolve to the clips context with **Projects** active (prefix match, not exact).
3. `PRODUCTS`: set to `[CLIPS]` only. Remove `phone`, `receptionist`, `mctb` and `power_dialer` from the array but leave their definitions. Header product tabs hide when `PRODUCTS.length === 1`.
4. `WORKSPACE.items`:
   - **Keep:** Home `/app/home` (group Workspace), Integrations `/app/integrations`, Settings `/app/settings`, Help `/app/help` (group Manage).
   - **Remove:** Inbox, Contacts, Numbers.
5. `resolveContext()`: `/app/clips*` → clips; `/app/home|settings|integrations|help` → workspace. Unknown → workspace.
6. `ALL_CONTEXTS`: `[WORKSPACE, CLIPS]`.
7. `GlobalSearch` index: projects and clips by title (`GET /api/clips/projects?q=`). Remove phone/contact sources.

### 10.2 Shell files
- `components/shell/app-header.tsx`:
  - Replace the brand "T Transovo" if the brand decision says so (§12).
  - Replace the **Dial** button with **"New project"**, which goes to `/app/clips/new`.
  - Add a **`CreditsPill`** (M16): "142 credits", opening a popover with the per-bucket balances and "Upgrade". Until M16 it shows the "Test mode · all features unlocked" badge instead.
  - Remove the inbox and phone utility icons.
  - Account menu: the real user name and email in place of the hardcoded "Maya Okafor". Items: Settings, Billing & usage (`/app/settings?tab=billing`), Help, Log out.
- `components/shell/sidebar-nav.tsx`: replace the footer "Main line connected" pill with a **`CreditsMeter`** (Progress + "142 / 300 credits · resets Nov 3" + "Upgrade" link for free users).
- `components/shell/app-shell.tsx`:
  - Behind `NEXT_PUBLIC_PRODUCT=clips`, skip `WorkspaceProvider` (the Telnyx one), `NumbersProvider`, `AgentProvider`, `IncomingCallBar` and `ActiveCallBar`.
  - Add a light `ClipsWorkspaceProvider` (workspace, user, credits; refetches credits after mutations).
- `app/app/layout.tsx`: drop `PowerDialerImpersonationBanner` under the clips flag.
- `components/app/page-primitives.tsx`: extend `STAT_ICONS` with `clips`, `credits`, `minutes`, `exports`.
- `components/app/status.tsx`: add `CLIP_JOB_STATE` and `CLIP_RENDER_STATE` maps.

---

## 11. Phased build order (one PR each)

Core first, then the editor and the v1 AI features, then auth (before any public launch), then credits and billing, then marketing, then cleanup. `FEATURES_ALL_UNLOCKED` stays on until M16.

| # | PR | Scope | Done when |
|---|---|---|---|
| M0 | Shell + nav + flags | §10 changes behind `NEXT_PUBLIC_PRODUCT=clips`; empty `/app/clips`, `/new`, `/[id]`, `/exports`, `/brand` with `EmptyState`; add shadcn primitives; `CLIP_JOB_STATE`; loading/error/not-found; fix `formatWhen`; `FEATURES_ALL_UNLOCKED` + `test` plan + `can()` stub + "Test mode" badge | nav shows Home/Clips/Integrations/Settings/Help only; typecheck + build pass |
| M1 | Data model + storage + upload | Prisma models §6 (minus auth/billing); `lib/storage/s3.ts`; uploads API; `Dropzone`, `UploadProgressItem`, multipart uploader; projects list and create | a 2 GB file uploads with resume-on-part-failure; project appears in the list |
| M2 | Settings form | `project-settings-form` with the three modes, `caption-preset-picker`, estimate shown as info only, `?preset=` support | settings persist in `ClipProject.settings` |
| M3 | Worker v0 + queue + status UI | `worker/` package + Dockerfile; SKIP LOCKED claim; PREPARING + TRANSCRIBING; internal progress API (HMAC); `JobStatus` with StepRail and polling; cancel; reaper | upload → transcript saved; UI walks the stages |
| M4 | Talking mode: picks + reframe + results | `lib/server/ai/openai.ts` with `gpt-6-luna`, structured output incl. `emphasisWords`/`mood`/`brollIdeas`; snapping + scores; speakercrop refactor (`crop.json`, fallbacks); preview renders; `ClipGrid`, `ClipCard`, `ClipPreviewSheet`, `VideoPlayer`; home dashboard; `AiUsage` | a 30-min 2-person podcast yields scored 9:16 clips with word captions; LLM cost logged |
| M5 | Export (download only) | `ExportDialog`, `RENDER_EXPORT` job (trim/cuts/overrides/logo), watermark via `can()` (Free + trial), 720p/1080p, SRT, `/app/clips/exports` | downloaded MP4 matches the editor settings |
| M6 | Editor core | editor shell, transcript trim/delete/fix, filler removal, layout panel + shot overrides, timeline lanes, autosave/undo, preview render | edits round-trip to export |
| M7 | Animated captions + presets | `caption-presets.json` → TS + Python; 10 presets; animations in ASS and the CSS overlay; keyword highlight; "Save as preset" | the browser preview and the export match for every preset |
| M8 | ClipAnything mode | `SCANNING` stage (scene/loudness/motion shortlist), `lib/server/ai/gemini.ts`, vision ranking, subject-follow crop, mode UI + cost line | a 20-min vlog with no dialogue yields sensible clips at ≈ $0.07/hr logged |
| M9 | B-roll: Pixabay + AI B-roll | `lib/server/ai/pixabay.ts` + R2 cache + `StockBrollPicker` + auto B-roll + attribution; `AiGeneration`; `lib/server/ai/kie.ts` (ported from the visualizer) + Wan 3.0 + callback route + `ai-broll-card` | stock and AI shots render in the export; generation costs logged |
| M10 | Audio: music + SFX | `lib/server/ai/elevenlabs.ts` (Music + SFX); music suggest/generate; Audio tab; Web Audio preview mixer; ffmpeg ducking/fades in `RENDER_EXPORT`; SFX presets with per-workspace cache | a generated track fits the clip length and ducks under speech in the export |
| M11 | AI Producer | `/producer` SSE route, tool schema (§13.5) mapped to reducer actions, `ProducerThread`/`ProducerMessage`, producer panel UI, paid-tool confirm cards, one-step undo | "make it 30 s, add upbeat music, Bounce captions" produces a valid, undoable edit |
| M12 | Thumbnails | `THUMBNAIL` job: frame sampling → Gemini prompt → Kie Nano Banana 2; Thumbnail tab; results-card menu; export download | 3 thumbnails per clip in 9:16 or 16:9 |
| M13 | Dubbing | `DUB` job with ElevenLabs Dubbing v1; `DubTrack`; Dub tab; audio-track select in preview and export; caption re-timing | a Spanish dub exports with Spanish captions |
| M14 | Brand template | `/app/clips/brand` form + logo upload + live preview + saved caption preset; default for new projects | new projects use the template |
| M15 | Auth + workspaces | Auth.js (Google + email OTP via Brevo), `(auth)` pages, middleware, replace dev stubs and `assertDevApiAccess`, workspace bootstrap, trial grant hook, attribution capture, real account menu | two users can't see each other's projects or generations. **Required before any public launch.** |
| M16 | Credits + Stripe enforcement | grants/ledger, reserve/capture/release incl. generations, `CreditsPill`/`CreditsMeter`, billing tab, `/app/settings/plans`, `UpgradeDialog`, checkout/portal/webhook, trial 90/7 days, Free 60/mo; flip `FEATURES_ALL_UNLOCKED=false` in production | an over-limit action is blocked; failures refund; purchases grant credits; watermark on Free/trial only |
| M17 | Marketing + Ads | `(marketing)` layout, `/`, `/pricing` (Free, Starter, Pro), `/tools` + 8 slugs, legal pages incl. media credits, sitemap/robots, gtag + conversions + gclid persistence, consent banner (if EEA) | Lighthouse ≥ 90 on `/tools/*`; conversion events fire. **Public launch after M15–M17.** |
| M18 | Cleanup + hardening | delete phone/receptionist/mctb/power-dialer/numbers/contacts/inbox/calls code and Telnyx providers; retention purge cron; rate limits on upload/estimate/generations; file-type sniffing; error tracking | build is smaller; no dead routes |
| Later | — | Social publishing (YouTube Shorts first, then TikTok/IG); calendar; analytics; team invites + shared pool; multiple brand templates, intro/outro; lip-sync (HeyGen or Sync.so); Dubbing v2; project-level Producer; pre-signup upload; Drive import; GPU ASR; **screenwriting tool** and **AI video studio** add-ons | — |

**Ordering notes:** M7–M13 are mostly independent once M6 lands, so they can run in parallel PRs. M15 can also start any time after M5. Staging stays private until M15 (§1 rule 13).

---

## 12. Open decisions for Rick

Decided on Oct 25, 2026 and applied in this revision:
- Watermark on Free and trial.
- Trial is 90 credits; length read as 7 days (see #1).
- Prices match Opus (Starter $15/150; Pro $29, or $14.50/mo yearly, 300).
- Credits are a late milestone, with `FEATURES_ALL_UNLOCKED`.
- Stock B-roll is Pixabay only.
- No publishing in v1 (download only).
- Clip picking uses `gpt-6-luna`.
- ClipAnything, animated captions, AI B-roll (Wan 3.0 via Kie), AI Producer, AI music via ElevenLabs (no library), SFX via ElevenLabs, thumbnails and dubbing all move into v1.

Still open:
1. **Trial length:** confirm 7 days. The voice note said "70 days".
2. **Free tier:** keep a Free 60 credits/month watermarked tier like Opus (assumed), or go trial-only?
3. **ElevenLabs plan for commercial in-app use:** Scale (< 10 employees) or Business (< 50). Also confirm with ElevenLabs that end users writing music prompts inside our app isn't "model resale" or needs Enterprise.
4. **Dubbing provider:** confirm ElevenLabs Dubbing v1 ($0.50/min clean, $0.33/min watermarked). Lip-sync vendor later: HeyGen vs Sync.so.
5. **Vision fallback:** Kimi K2.5 is retired. Use `kimi-k2.6` as the fallback, or Gemini only?
6. **Auth provider:** Auth.js (proposal) vs Supabase Auth vs Clerk.
7. **Storage and workers:** R2 (proposal) vs S3 vs Supabase Storage, and the worker count and host at launch.
8. **YouTube link import in v1?** Recommendation: no; upload plus Drive/Dropbox links.
9. **Retention:** free 7 days / paid 30 days (proposal).
10. **Brand name and domain:** keep "Transovo" or rebrand?
11. **Upload limits:** 3 h / 5 GB paid, 1 h / 2 GB free (proposal).
12. **Languages:** English-only ASR for v1, or multilingual from day one? Dubbing captions need a multilingual model either way.
13. **EEA traffic:** a Consent Mode v2 banner if Ads target the EU or UK.
14. **Phone-code removal timing (M18):** right after launch, or once clipping is stable?
15. **AI credit prices (§9.3):** approve at M16 using the logged test data.

---

## 13. v1 AI features: pipelines, APIs, costs and UI entry points

> Prices were checked on the providers' public pages on Oct 25, 2026 (ET). Re-check before launch. Items marked **[verify]** could not be confirmed.

### 13.0 What already exists in `703deuce/sms` (read-only findings, env var names only)

| What | Where | Notes |
|---|---|---|
| Cheap OpenAI model (the "Luna" model) | `src/lib/appointment-reminders/ai-rescheduler/model.ts` → `AR_AI_RESCHEDULER_MODEL_ID = "gpt-6-luna"` (env override `AR_AI_RESCHEDULER_MODEL`) | It's used by the SMS AI Rescheduler and the "Luna" extraction assistant (`src/lib/appointment-reminders/calendar/reminder-phone-luna.ts`). **It is not the voice receptionist model**: the voice runtime uses `gpt-realtime-2` (`voice-runtime-python/transovo_voice/session/realtime_config.py`, env `VOICE_REALTIME_MODEL`), and the generic chat helper `src/lib/ai/openai.ts` defaults to `gpt-5-nano`. |
| OpenAI client in new-app | `new-app/lib/server/voice-v3/openai-client.ts` | Reads `OPENAI_API_KEY`. Copy the pattern into `new-app/lib/server/ai/openai.ts`. |
| ElevenLabs key | `.env.example` (around lines 107–110) lists `ELEVENLABS_KEY` / `ELEVENLABS_API_KEY` ("never expose to the browser"). Read in `new-app/lib/server/voice/elevenlabs-tts.ts` (`process.env.ELEVENLABS_API_KEY`, calls `api.elevenlabs.io/v1/text-to-speech`). Also `src/lib/voice/elevenlabs/client.ts`, `src/lib/voice/elevenlabs/models.ts`, `new-app/app/api/phone/elevenlabs/voices/route.ts`. | Reuse `ELEVENLABS_API_KEY`. The new `lib/server/ai/elevenlabs.ts` follows the `elevenlabs-tts.ts` pattern (server-only fetch with the `xi-api-key` header). |
| Kie.ai integration | `src/lib/visualizer/generation/kie-config.ts`, `src/lib/visualizer/generation/provider-kie.ts` | Env `KIE_API_KEY`, `KIE_API_BASE_URL` (default `https://api.kie.ai`), `KIE_UPLOAD_BASE_URL`, `VISUALIZER_KIE_MODEL` (default `nano-banana-2-1`). Port the createTask / poll / upload helpers into `new-app/lib/server/ai/kie.ts`. |

Model ids are env-configurable everywhere: `CLIP_LLM_MODEL` (default `gpt-6-luna`), `VISION_MODEL` (default Gemini 3.1 Flash-Lite; **[verify]** the exact API id string in Google AI Studio), `KIE_VIDEO_MODEL` (default `wan/3-0-video`), `KIE_IMAGE_MODEL` (default Nano Banana 2).

### 13.0.1 Shared plumbing (`lib/server/ai/` starts in M4; `AiGeneration` and Kie land in M9)
- **`lib/server/ai/`**: `openai.ts`, `gemini.ts`, `kie.ts`, `elevenlabs.ts`, `pixabay.ts`. Each export returns `{ result, usage: { provider, model, units, unitType, costUsdMicros } }`, and the caller writes `AiUsage`.
- **`AiGeneration` model** (§6 additions): one row per paid generation (AI B-roll shot, music track, SFX, thumbnail, dub). It holds the status, prompt, provider task id, output key and cost. The editor polls `GET /api/clips/generations/[id]`.
- **Async providers:** Kie (video, image) and ElevenLabs Dubbing are async. Kie tasks pass `callBackUrl = {APP_URL}/api/internal/kie/callback?token=<per-generation signed token>`; a worker poll every 10 s is the fallback. ElevenLabs Music and SFX are synchronous HTTP calls, made from a worker job so the request isn't tied to a browser request.
- **Outputs are copied to R2** right away (`ws/{ws}/clips/{clipId}/gen/{generationId}.{ext}`). Provider URLs expire.
- **Gates:** `can(ws, 'ai_broll' | 'music' | 'sfx' | 'thumbnail' | 'dub' | 'clip_anything' | 'producer')`. Always true while `FEATURES_ALL_UNLOCKED` is on.
- **Safety:** generation prompts go through a short filter (no real-person names in image/video prompts; no artist, song or label names in music prompts, §13.6).

### 13.1 Clip picking in talking mode: `gpt-6-luna`
- **Pipeline:** unchanged from §8.2 step 3, with the model set to `CLIP_LLM_MODEL=gpt-6-luna` and JSON-schema structured output. The same call also returns, per clip, `emphasisWords` (word indexes for keyword highlight), `mood` (for the music prompt) and `brollIdeas` (for auto B-roll). That's one call instead of three.
- **API:** OpenAI Responses or Chat Completions with `response_format: json_schema`.
- **Price (verified):** $0.10 / M input, $0.50 / M output ($0.01 / M cached input; Batch/Flex 50% off).
- **Cost:** a one-hour transcript is about 15–20k input tokens plus about 3–4k output tokens, so **≈ $0.004 per source hour**.
- **UI entry:** none new. It's the default "Talking (podcast, interview)" mode in `/app/clips/new`.

### 13.2 ClipAnything mode (vision)
- **When:** the user picks Mode → "ClipAnything (any footage)" in `/app/clips/new`. It's for vlogs, sports, gaming and other footage where the transcript alone misses the moments.
- **Pipeline** (worker, new stage `SCANNING` between TRANSCRIBING and FINDING_CLIPS; ASR still runs because captions need it):
  1. **Free local shortlist:** ffmpeg scene-change scores (`select='gt(scene,0.3)'`), audio loudness peaks (`ebur128`), frame-difference motion energy and (if there's speech) the transcript. Build candidate windows of 15–90 s around the peaks, capped at about 25% of the source duration or 60 windows.
  2. **Frames:** sample each candidate at 1 fps at 512 px JPEG.
  3. **Vision ranking:** Gemini 3.1 Flash-Lite, one request per batch of candidates (frames plus the transcript excerpt plus the user's prompt). It returns JSON `{candidateId, start, end, title, reason, hook, action, payoff, subjectBox?}`. Audio is not sent (the transcript covers speech, and this saves tokens).
  4. Snap to scene cuts, dedupe, keep the top N. Same scoring and the same `Clip` rows as talking mode.
  5. **Reframe:** "Subject follow" uses the motion centroid plus `subjectBox` hints, smoothed with the existing speakercrop easing. It falls back to Fit with blur. Speaker follow is still used when faces plus speech are detected.
- **Price (verified):** Gemini 3.1 Flash-Lite input $0.25 / M (text, image, video), output $1.50 / M, batch 50% off. Video costs 258 tokens per frame at 1 fps at default resolution, or 66 tokens at low `media_resolution`.
- **Cost per source hour:**

| Approach | Input tokens / hr | Cost / hr |
|---|---|---|
| Full scan, 1 fps, default res | ≈ 929k | ≈ $0.23 + output |
| Full scan, 1 fps, low res | ≈ 238k | ≈ $0.06 + output |
| **Shortlist (25%), 1 fps, default res (recommended)** | ≈ 232k | **≈ $0.06 + ≈ $0.01 output ≈ $0.07** |

- **Fallback model:** Kimi K2.5 was retired on Aug 31, 2026 (its endpoint returns 404). The current Kimi vision-capable model is `kimi-k2.6` at $0.95 / M input and $4.00 / M output, about 4× Gemini Flash-Lite's input price. Keep it as an optional `VISION_MODEL` fallback only; **[verify]** its per-frame token count.
- **UI entry:**
  - `/app/clips/new` Mode `radio-group`: "Talking (podcast, interview)" · "ClipAnything (any footage)" · "Captions & reframe only".
  - Under ClipAnything, a muted line: "Vision scan · about $0.07 per hour of video" (provider cost shown in test mode; credits once M16 ships).
  - StepRail gains a "Scan scenes" step for this mode.

### 13.3 Animated captions and presets
- **Pipeline:** the worker's ASS generator gains animation tags per preset (`\t` scale/alpha transforms for pop and bounce, `\move` for slide-up, `\k` karaoke fills, per-character reveal for typewriter, `\blur` plus a border for glow). Keyword highlight uses `edits.captions.emphasis` (seeded from §13.1).
- **Browser parity:** `caption-overlay.tsx` maps each preset to CSS keyframes with the same timing curves. One shared `caption-presets.ts` (TS) and `caption_presets.py` (worker) are generated from a single `caption-presets.json` so they can't drift.
- **Cost:** $0. Local rendering.
- **UI entry:** Captions tab (§5.5), the settings preset picker (§5.3) and brand template "Save as preset".

### 13.4 B-roll: Pixabay stock plus AI B-roll (Wan 3.0 via Kie.ai)
- **Stock (Pixabay only; Pexels dropped):** the server-side proxy `GET /api/clips/broll/search` calls the Pixabay video API with a 24 h cache. Chosen assets are downloaded to R2 (Pixabay asks for self-hosting rather than hot-linking). Attribution is shown in the app, the export dialog and `/legal/media-credits`. Cost: $0.
- **Auto B-roll:** uses `brollIdeas` from §13.1 (no extra LLM call), searches Pixabay, and places shots on low-motion spans over 2 s.
- **AI B-roll pipeline:**
  1. `POST …/broll/ai/suggest`: `gpt-6-luna` reads the clip transcript and returns 1–3 `{atMs, durationS, prompt}` suggestions (cinematic, no real people's names, vertical framing). Cost ≈ $0.0005.
  2. `POST …/broll/ai` with `{prompt, atMs, durationS (3–5), resolution (480p|720p)}` creates an `AiGeneration` and a Kie task: `POST {KIE_API_BASE_URL}/api/v1/jobs/createTask` with `model: "wan/3-0-video"`, aspect 9:16, and `callBackUrl`.
  3. On the callback (or a poll), copy the MP4 to R2, set the generation READY, and the editor inserts it as a `broll` item with `source: 'ai'`.
- **Price (verified, Kie):** Wan 3.0 is $0.04/s at 480p and $0.08/s at 720p. A 4 s shot costs $0.16 (480p) or $0.32 (720p); three shots per clip cost $0.48–0.96. (Replicate lists Wan at $0.025/s for 480p, a possible cheaper alternative later.)
- **UI entry:** Editor → B-roll → AI (§5.5); the AI Producer tool `generate_ai_broll`.

### 13.5 AI Producer (chat agent that edits the clip)
- **What it is:** a chat panel in the editor. The user types "make it 30 seconds and punchier, add upbeat music and a whoosh on the first cut", and the agent calls editor operations as tools. Every tool maps 1:1 to an existing `use-editor-state` reducer action, so the agent can only do what the UI can do.
- **Model:** `gpt-6-luna` with function calling. Context per turn: clip summary, words (compact, indexed), current `edits`, shots, available presets and brand templates. That's about 6–10k input tokens and about 0.5–1k output, so **≈ $0.001 per turn**.
- **Server:** `POST /api/clips/clips/[id]/producer` streams Server-Sent Events: assistant text, `tool_call` events (validated with zod against the schema below) and a final `editsPatch`. The server applies the ops to a copy of `edits`, validates them, and returns the patch. The client applies it as **one undo step** and autosaves. Paid tools don't run until the user confirms.
- **Tool schema (v1):**

| Tool | Args | Maps to | Paid? |
|---|---|---|---|
| `get_clip_state` | — | read only | no |
| `trim` | `{ inMs, outMs }` | `TRIM` | no |
| `cut_words` / `restore_words` | `{ fromWord, toWord }` | `CUT_RANGE` / `RESTORE_RANGE` | no |
| `remove_fillers` | — | `REMOVE_FILLERS` | no |
| `fix_word` | `{ index, text }` | `FIX_WORD` | no |
| `set_captions` | `{ preset?, animation?, size?, position?, case?, wordsPerLine?, colors?, highlight? }` | `SET_CAPTIONS` | no |
| `highlight_words` | `{ indexes[] , on }` | `SET_EMPHASIS` | no |
| `set_layout` | `{ mode }` | `SET_LAYOUT` | no |
| `set_shot_focus` | `{ shotIndex, focus: 'A'|'B'|'both' }` | `SET_SHOT_OVERRIDE` | no |
| `insert_stock_broll` | `{ query, atMs, durationMs }` | search → `ADD_BROLL` | no |
| `generate_ai_broll` | `{ prompt, atMs, durationS, resolution }` | `AiGeneration` → `ADD_BROLL` | **yes** |
| `remove_broll` | `{ id }` | `REMOVE_BROLL` | no |
| `generate_music` | `{ prompt, instrumental }` | `AiGeneration` → `SET_MUSIC` | **yes** |
| `set_music_mix` | `{ volumeDb?, duck?, duckDepthDb?, fade? }` | `SET_MUSIC_MIX` | no |
| `add_sfx` | `{ preset? , prompt?, atMs, volumeDb? }` | `AiGeneration`/cache → `ADD_SFX` | yes (cached presets free) |
| `set_title` | `{ title }` | `SET_TITLE` | no |
| `apply_brand` | `{ templateId }` | `APPLY_BRAND` | no |
| `generate_thumbnail` | `{ count, aspect, style? }` | §13.8 | **yes** |
| `dub` | `{ targetLang }` | §13.9 | **yes** |
| `render_preview` | — | `PREVIEW_RENDER` job | no |

- **Rules in the system prompt:** keep edits minimal and explain each change in one line. Ask before paid tools (the UI shows a confirm chip with the cost). Never invent timestamps; use word indexes from `get_clip_state`.
- **UI (reuse first):**
  - Panel: `producer-panel.tsx` docked left of the preview (a `Sheet` on small screens). It reuses `Section`, `ScrollArea`, `Textarea` + `Button` (the composer), and `Pills` for suggestion chips ("Make it punchier", "Add music", "Tighten pauses", "Translate to Spanish").
  - Messages: user and assistant bubbles; each tool call renders a `tool-call-card.tsx` (icon, one-line summary like "Trimmed to 0:12–0:41", `StatusBadge`).
  - Paid tools render a confirm card: "Generate 3 AI shots · ≈ $0.48 · Confirm / Skip". In test mode the cost shows in USD.
  - After a turn: a `DraftBar`-style strip, "4 changes applied · Undo".
  - The thread is saved per clip (`ProducerThread`/`ProducerMessage`).
- **Later:** project-level Producer ("apply this caption style and music to all clips").

### 13.6 Music: AI-generated with ElevenLabs Music (no music library)
- **No music library.** There's no browsing of stock tracks. Music is generated per clip from a prompt, stored privately for that workspace, and never shared across users (this also keeps us clear of ElevenLabs' "Music Library" prohibition below).
- **Pipeline:**
  1. **Suggest:** `POST …/music/suggest` → `gpt-6-luna` reads the clip transcript plus `mood` from §13.1 and returns `{ prompt, mood, bpmHint }`, e.g. "Upbeat lo-fi hip hop, warm keys, soft drums, 90 BPM, instrumental, builds slightly at the end". The prompt is filtered: no artist, song or label names. Cost ≈ $0.0003.
  2. **Generate:** `POST …/music` with `{ prompt, instrumental }` creates an `AiGeneration` and a `MUSIC` worker job. It calls ElevenLabs Music (`POST https://api.elevenlabs.io/v1/music`, key `ELEVENLABS_API_KEY`, server-only) with `music_length_ms` = the current clip length after trims and cuts (min 3 s, max 5 min per generation), then stores the MP3 in R2.
  3. **Mix (export):** `RENDER_EXPORT` adds the music input to the ffmpeg graph. It applies volume, then ducking with `sidechaincompress` keyed by the speech track (threshold about −30 dB, ratio about 8, attack 20 ms, release 300 ms, scaled by the depth slider), plus `afade` in and out, and finally `atrim` to the clip length. The browser preview approximates the ducking with a gain envelope built from `words.json`.
- **Price (verified, ElevenLabs API):** Music is **$0.15 per generated minute**, so a 45 s clip track costs ≈ $0.11 per generation (each regenerate is billed again).
- **Commercial-use terms (ElevenLabs Music Terms, updated Oct 9, 2026):**
  - Self-serve Starter, Creator and Pro are "for individual use only". **Scale** is for entities with fewer than 10 employees, **Business** for fewer than 50; larger companies need Enterprise.
  - Monthly music generation limits: Starter 17 min, Creator 62, Pro 304, Scale 1,100, Business 4,800. Separate download limits apply.
  - Media rights cover online and offline commercial use, **except** film, TV, radio and studio games. Social clips are covered. Streaming-platform distribution is allowed from Creator up.
  - **Model resale is prohibited** (no giving third parties API access to the model), and **creating a music library is prohibited**. Generating output inside our own product isn't resale as long as we don't expose API access, but confirm with ElevenLabs that letting our end users write prompts is allowed on the chosen tier (open decision).
  - Prompts must not name artists, songs or labels.
  - Recommendation: account on **Scale or Business**, or ask ElevenLabs sales whether a product serving end users needs Enterprise.
- **UI entry:** Editor → Audio → Music (§5.5); AI Producer `generate_music` / `set_music_mix`; brand template "Default music mood" [later].

### 13.7 Sound effects: recommendation = ElevenLabs SFX
- **Recommendation: ElevenLabs Sound Effects API** (`POST /v1/sound-generation`), using the existing key. It needs no licensing hunt or new vendor, and the AI Producer can ask for any sound by prompt.
- **Starter presets:** the 10 preset chips (§5.5) are fixed prompts. The first use in a workspace generates the effect (1–2 s) and caches it in R2 under that workspace. Later uses are free and instant.
- **Price (verified):** $0.12 per generated minute, billed per generation. A 2 s effect costs about $0.004. **[verify]** whether there's a minimum billed duration per generation.
- **Fallback:** a small bundled CC0 pack (10 files) if usage costs or latency ever matter. It's not needed for v1.
- **Mix:** each SFX is an `adelay` + `volume` input in the export graph; it isn't ducked.

### 13.8 Thumbnail generator (vision prompt → Nano Banana via Kie)
- **Pipeline** (`THUMBNAIL` worker job):
  1. Sample 1 frame every 2 s from the clip (20–45 frames, 512 px).
  2. Gemini 3.1 Flash-Lite (Kimi K2.6 fallback) picks the best 1–2 frames (clear face, strong expression, no motion blur). It writes a short title text (≤ 5 words) and a **Nano Banana prompt** that keeps the person's likeness from the reference frame ("bold YouTube thumbnail, subject on the right, bright rim light, big yellow text 'IT FAILED', clean background"). Cost ≈ $0.003.
  3. Upload the chosen frame with Kie's upload endpoint (`KIE_UPLOAD_BASE_URL`, already used by the visualizer). Then create a Kie Nano Banana 2 task with the frame as the image reference, the prompt and the aspect (9:16 or 16:9). Render 3 variants.
  4. Copy the results to R2 and create `AiGeneration` rows.
- **Price (verified, Kie Nano Banana 2):** $0.04 at 1K, $0.06 at 2K, $0.09 at 4K per image. Use 2K for a 1280×720 YouTube thumbnail, so 3 variants cost **≈ $0.18 + $0.003**. The repo's visualizer defaults to `nano-banana-2-1` (Nano Banana 2.1); **[verify]** its Kie price before switching.
- **Only the user's own footage is used as a reference.** Never prompt for a real, named person's likeness.
- **UI entry:** Editor → Thumbnail tab; a "Make thumbnail" item in the clip card menu on Results; AI Producer `generate_thumbnail`; the Export dialog offers "Download thumbnail".

### 13.9 Video dubbing: pick = ElevenLabs Dubbing (v1), lip-sync later
- **Pick:** **ElevenLabs Dubbing API**, because the key already exists (`ELEVENLABS_API_KEY`), it's the cheapest quality option found, and it's one vendor for music, SFX and dubbing.
- **Price (verified, ElevenLabs API pricing):**
  - **Dubbing v1: $0.50 per source minute per target language** without the ElevenLabs watermark, or **$0.33/min with the watermark**. Use the watermarked tier for Free and trial (whose exports are watermarked anyway) and the clean tier for paid.
  - Dubbing v2: $2.20/min. It's a premium option later, with better voice and emotion transfer.
  - Languages: 29 on the pricing page (the help center says 70+). **[verify]** the current list.
  - ElevenLabs Dubbing does **not** do lip-sync.
- **Pipeline** (`DUB` worker job): render the trimmed clip's audio (speech only, no music or SFX), then `POST /v1/dubbing` with `target_lang`, `source_lang` (auto) and `num_speakers` from the speaker count. Poll `GET /v1/dubbing/{id}` until it's dubbed, then download the target-language audio. Store it as `DubTrack` with the audio in R2.
- **Captions for the dub:** run the worker's ASR (a multilingual model) on the dubbed audio to get word timings for the translated captions. **[verify]** whether ElevenLabs returns a usable timed transcript, which would let us skip this.
- **Export:** "Audio: Original | <language>". A dubbed export swaps the speech track, re-mixes music and SFX and uses the translated captions.
- **Cost example:** a 45 s clip into Spanish costs ≈ $0.38 (clean) or $0.25 (watermarked).
- **Lip-sync later (comparison):** HeyGen video translation $2/min (Speed) or $4/min (Precision); Sync.so `lipsync-2` about $2.40–3.00/min. Add it as a premium toggle after v1.
- **UI entry:** Editor → Dub tab; AI Producer `dub`; the Export dialog audio-track select.

### 13.10 Per-feature cost table (provider cost, USD)

| Feature | Provider / model | Unit price (verified Oct 25, 2026) | Typical use | Cost per use |
|---|---|---|---|---|
| ASR, reframe, captions, render | Own CPU worker | ≈ VM $/h ÷ 180 per source min | 60 min source | ≈ $0.10–0.33 per source hour |
| Clip picking (talking) | OpenAI `gpt-6-luna` | $0.10 / M in · $0.50 / M out | 1 source hour | **≈ $0.004** |
| ClipAnything (vision) | Gemini 3.1 Flash-Lite | $0.25 / M in · $1.50 / M out · 258 tok/frame | 1 source hour, 25% shortlist | **≈ $0.07** (full scan ≈ $0.23) |
| Animated captions | Local | — | per clip | $0 |
| Stock B-roll | Pixabay API | free | per insert | $0 |
| AI B-roll | Kie · Wan 3.0 | $0.04/s 480p · $0.08/s 720p | 4 s shot | **$0.16 / $0.32** |
| AI Producer | `gpt-6-luna` | as above | per chat turn | ≈ $0.001 |
| Music | ElevenLabs Music | $0.15 / generated min | 45 s clip | **≈ $0.11** per generation |
| Music prompt suggestion | `gpt-6-luna` | as above | per clip | ≈ $0.0003 |
| SFX | ElevenLabs SFX | $0.12 / generated min | 2 s effect | ≈ $0.004 (cached presets $0 after first use) |
| Thumbnails | Gemini (prompt) + Kie Nano Banana 2 | $0.06 per 2K image | 3 variants | **≈ $0.18** |
| Dubbing | ElevenLabs Dubbing v1 | $0.50/min clean · $0.33/min watermarked | 45 s clip, 1 language | **≈ $0.38 / $0.25** |
| Lip-sync [later] | HeyGen / Sync.so | $2–4/min · $2.40–3.00/min | 45 s clip | ≈ $1.50–3.00 |

**Worst-case "everything" clip** (45 s; 3 AI shots at 480p, 2 music generations, 3 SFX, 3 thumbnails, 1 dub): ≈ $0.48 + $0.22 + $0.01 + $0.18 + $0.38 ≈ **$1.27**. The core loop (process plus edit plus export, no generations) stays under **$0.01 per source minute**. That's why the AI generations get their own credit prices in M16 (§9.3).
