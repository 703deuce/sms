# OpusClip Product Map: a rebuild spec for a coding agent

**v2 — updated Sun Oct 25, 2026 (America/New_York).** v1 used public sources only. v2 adds findings from a logged-in walkthrough on a free 7-day trial account done the same day (tagged **[TOUR]**). That walkthrough uploaded one 60 s CC BY interview, which used 1 credit. Wherever the walkthrough contradicted public sources, the walkthrough wins.

## How to read this

- This maps OpusClip (opus.pro, app at clip.opus.pro) so we can build an equivalent clipping product inside **our existing app**.
  - Use our app's existing components and styles everywhere.
  - Do NOT copy OpusClip's visual design. Copy only its information architecture, flows and features.
- Every fact has a source tag:
  - **[TOUR]** = our own logged-in walkthrough on a trial account, Oct 25 2026. This is the strongest source.
  - **[HC]** = help center (help.opus.pro; article URLs are help.opus.pro/docs/article/<slug>)
  - **[HC-img]** = a screenshot inside a help article
  - **[SR]** = Screenrove, an independent capture of a signed-in account (2026-10-22)
  - **[MKT]** = opus.pro marketing pages
  - **[PR]** = opus.pro/pricing
  - **[CL]** = changelog (opusclip.canny.io/changelog)
  - **[API]** = help.opus.pro/api-reference and its openapi.json
  - **[REV]** = reviews (Reddit, Trustpilot, eesel.ai, agentbrisk, vyroclips)
- Status marks:
  - **✅ Verified** = seen in the tour, or in a screenshot
  - **◐ Partial** = described, but not seen in full
  - **⛔ Unreached** = blocked on the trial, or needs a connected social account
  - ⚠️ = a conflict between sources, or an inference
- Tags in the feature list:
  - **v1** = build for launch
  - **later** = after launch
  - **skip** = don't build

Rick's v1 constraints:
- upload/download first
- users come from Google Ads
- low API cost
- stock B-roll from Pexels/Pixabay
  - paid for with in-app credit
  - no watermark on the stock footage
- AI video B-roll only on paid credits
- speaker-following vertical crop and animated word-by-word captions are already prototyped locally

## 0. Route inventory (verified in the tour unless marked)

| Route | Screen | Status |
|---|---|---|
| `/auth/oauth/login` | Sign-in / sign-up: Google, Apple, or email + 6-digit email code (no password) | ✅ |
| `/dashboard` | Home: import well, tool tiles, demo projects, What's new. The trial welcome modal appears here on first visit. | ✅ |
| `/workflow` → `/dashboard?projectId=…` | Submit → processing hand-off. The processing banner and survey show on the dashboard. | ✅ |
| `/clip/<projectId>` | Project results (clip gallery) and the clip preview modal | ✅ |
| `/editor-ux/<projectId>.<clipId>?clipId=…&clipRank=1&editType=normal` | Clip editor | ✅ |
| `/projects` | My projects (collections + projects) | ✅ |
| `/brand-templates-ux` | Brand template wizard + editor. v1 of this map had `/brand-templates`. | ✅ |
| `/brand-kits` | Asset library | ✅ |
| `/auto-post/calendar` | Calendar (scheduler) | ✅ |
| `/analytics` | Analytics ("Coming soon") | ✅ |
| `/subscription` | Subscription and credits | ✅ |
| Credit usage history | Table page linked from the avatar menu. The help center gives `/activity`; the tour did not record the URL. | ✅ screen / ◐ route |
| (dialog) | Social accounts, API Access, Upgrade / Change plan, Credit breakdown, Select project, Add collection | ✅ |
| `labs.opus.pro`, `producer.opus.pro`, `agent.opus.pro` | Opus Labs, AI Producer, Agent Opus. These are separate apps on the same login and credits. | ✅ (entry points) |
| — | **No standalone profile, account-settings or notification-settings page exists** [TOUR] | ✅ (verified absent) |

---
## 1. Logged-in app: page by page

### 1.1 Shell [TOUR] ✅

**Left sidebar:**
- **Create:** Home, My projects, Brand template, Asset library
- **Post:** Calendar, Analytics, Social accounts
- **Bottom:** Opus Labs, API Access, Learning center, Help center

Subscription is **not** in the sidebar. It lives in the avatar menu. This corrects v1, which put it in the sidebar based on an older help screenshot.

**Avatar menu** (top-left button with the user's initial) [TOUR], in order:
1. Accounts (email + plan badge, e.g. "Trial")
2. Subscription
3. Credit usage history
4. Language ▸ (submenu ⛔ not opened)
5. LinkedIn capabilities (⛔ not opened)
6. OpusClip AI Producer (Beta)
7. OpusClip Thumbnail
8. Go to Agent Opus
9. Logout

The older help screenshot also showed "Create a team" and "OpusClip Captions (Free)". Neither appeared in the tour ⚠️.

**Top bar:** notifications bell (News feed of product updates [SR]), ⚡ credit balance, **Add credits** (opens the Upgrade dialog) [TOUR].

**Global extras:**
- ⌘K search inside projects [TOUR]
- OmniSearch tabs [HC] ◐
- Get Support widget [HC]

### 1.2 Sign-up and first run [TOUR] ✅

1. `/auth/oauth/login` offers Google, Apple, or email + 6-digit code. There is no password.
2. You land on `/dashboard` with the modal **"Your Free Trial Has Started!"**. It says:
   - **90 credits, 7 days, no card**
   - all features except the Fast queue
3. **The onboarding survey appears during the first project's processing**, not right after sign-up. It has 5 steps:
   1. **Role:** Hobbyist, Pro creator, Media pro, Agency, Event organizer, Business marketer, Educator, Other
   2. **Org size**
   3. **Follower reach:** 0–1k … 500k+
   4. **Content type:** original / both / found
   5. **How did you hear:** 11 options
   - Confetti plays at the end.

Correction to v1: there was no survey at sign-up.

Screenrove's account was refused a trial by trust-and-safety [SR]. Ours was granted. Expect false positives from VPN and disposable-email users.

### 1.3 Home `/dashboard` [TOUR] ✅

- **Import well:**
  - "Drop a YouTube link" + **Get clips in 1 click**
  - **Upload**
  - **Google Drive**
  - **Try a sample project**
- **Tool tiles:** Long to shorts, Edit video, AI Captions, AI Producer (Beta), AI B-roll, AI Reframe, Auto SFX, Upscale, Voice dubbing, Enhance speech, Voiceover hook, Script to video (Beta).
  - **AI Captions**, **AI Reframe** and **Voiceover hook** each open a **single-purpose dialog**: YouTube link / Upload / Google Drive, up to 120 min [TOUR].
  - **Script to video** opens an Agent Opus promo (AI asset generation, "up to 500 free credits") [TOUR].
  - ◐ Edit video, Auto SFX, Upscale, Dubbing and Enhance speech dialogs were not individually documented.
- Below the tiles: demo projects and a **What's new** section.

### 1.4 Upload settings panel (Home, after adding a file or link) [TOUR] ✅

- **Header:**
  - Remove link
  - **Speech language:** Auto + ~25 languages; *Translate to*: none / English
  - **Upload .SRT (optional)**
  - **Credit usage ⚡N.** Our 60 s video cost **1 credit**; it showed a 720p badge.
- **Tabs:** **AI clipping** | **Don't clip**
- **Clip model:** Auto / ClipAnything / ClipBasic
- **Genre:** Auto, Q&A, Commentary, Marketing, Webinar, Motivational speech, Podcast, Academic, Listicle, Product reviews, How-to, Comedy, Sports commentary, Church, News, Vlog, Gaming, Others
- **Clip length:** for a 60 s source it offered Auto (0–3m), <30s, 30–59s. Longer sources add 60–89s, 90s–3m, 3–5m, 5–10m and 10–15m [HC-img]. **The options depend on the source length.**
- **Toggles:** Auto headline (**on** by default), Auto zoom (off)
- **Include specific moments:** a free-text prompt
- **Processing timeframe:** two-handle slider plus start/end fields, with a "Credit saver" badge
- **Caption:**
  - **Quick presets:** No caption, Font Shuffle, Word Cut, Negative keywords, Handwritten, Soft Build, Karaoke, Beasty, Simple, Mozi, Think Media, Deep Diver, Youshaei, Popline, Pod P…
  - **My templates:** Preset template 1/2 + Edit
- **Aspect ratio:** 9:16, 1:1, 16:9, 4:5
- **"Save settings above as default"** checkbox
- **Get clips in 1 click** button

### 1.5 Processing [TOUR] ✅

- Submitting goes `/workflow` → `/dashboard?projectId=…`.
- A banner reads **"Your first project is currently processing X% (ETA 3m)"**.
- The **Recent projects** card shows a New tag with a %/ETA overlay.
- The browser tab title shows progress, e.g. "48% · 0/1 | Clipping".
- The onboarding survey (1.2) runs during this wait.
- Our 60 s clip took **~8 min** end to end.
- ◐ The completion email was not captured. Help/API document email and webhook notifications.
- Server stages [API]: PENDING → QUEUED → IMPORT → CURATE → REFINE → RENDER → UPLOAD → COMPLETE / STALLED.

### 1.6 Results `/clip/<projectId>` [TOUR] ✅

- **Header:** breadcrumb "My projects / <name>"; search "Find keywords or moments" (⌘K).
- **Toolbar:**
  - Grid/list toggle
  - **Select** (multi-select)
  - **Filter:** Favorited, Disliked, Dubbed, Not dubbed, clip length
  - **Sort:** Virality score / Chronological
  - **Download all**
  - "…" menu (Refund this project, Pro only [HC])
- **Banners:**
  - Download All feature
  - "Auto headline added to the first 5 s of the top 10 clips" with a **Disable it** link
- **Clip card:**
  - Thumbnail with captions, an **Edited** pill and a duration chip
  - Big virality score
  - Calendar (post) icon and Download HD icon
  - Title
  - Category tag: *Emotional story, Viral snippet, Highlight compilation, Top moment*
  - On hover: heart, thumbs-down, play preview
- **Clip preview modal:**
  - LOW-RES PREVIEW player with prev/next/close
  - Save / favorite / dislike
  - **Score /100** plus **Hook, Flow, Value, Trend** letter grades, **each with a written rationale**
  - Title with a rename pencil
  - **Scene analysis:** timestamped AI summary + transcript, with a "Transcript only" checkbox
  - **Buttons:** Publish on Social, Export XML (Premiere), Download HD, **Upscale & download ⚡**, **Edit clip**, **AI tools ›**, aspect ratio 9:16, Duplicate

### 1.7 Editor `/editor-ux/<projectId>.<clipId>` [TOUR] ✅

- **First visit:** welcome modal and guided tours.
- **Top bar:** back, title, undo/redo, preview/compare, **Save changes**, **Export**, credits, avatar.
- **Left panel:**
  - Word-level transcript with **pause chips** (e.g. "0.52s")
  - **Speech cleanup**
  - **Extend a clip**
  - Search / filter / download
- **Preview toolbar:**
  - Aspect ratio
  - **Layout:** Global layout settings; Fill, Fit, Split, Three, Four, **Picture in picture**, ScreenShare, Gameplay
  - **Background:** blur / color / image / video
  - **Tracker ON/OFF** (manual tracking)
  - A floating crop/media toolbar
  - Captions can be dragged on the canvas
- **Right rail tabs:**
  - **AI enhance:** Remove filler words, Remove pauses, Remove bad takes, Auto censor, Speech enhancement, Eye contact correction, Auto B-roll, Video dubbing, Auto voiceover hook, AI emoji, AI keywords highlighter, Auto transitions, Auto sound effects, Auto zoom, Auto headline, **Speaker colors**
  - **Captions:** Presets | Font (family, color, size in px, weight, shadow color, Uppercase) | Effects (Position Auto/Top/Middle/Bottom, Animation)
  - **My library:** media (**deleted after 6 days on free**), Save to cloud, filters, Upload files
  - **Brand template:** Preset template 1/2 (logo, intro, colors)
  - **B-roll:** Auto B-roll ("Find spots", ~30 s) | Add B-roll
  - **Motion:** Transitions (auto + Cross fade, Cross zoom, Zoom in/out, Fade in/out) | Animation
  - **Text:** Add Text; Headline templates (Editorial, Statement, Classic); Name tags (7); Location presets
  - **Elements:** GIPHY search, categories, packs (Arrows, Tap here, Social)
  - **Audio:** Music (copyright-free search, filters, list) | Sound effects | Upload
  - **Voiceover hook:** script, voice (e.g. Adam), tone stability, original-audio volume, Generate
- **Timeline:**
  - Hide toggle
  - Split / link / delete / mute / snap
  - Transport controls + timecode, zoom, ruler
  - **Headline track** and **layout segment track** (Split/Fill segments)
  - Thumbnail strip and waveform
  - "+" to add media at either end
- **Keyboard shortcuts** [HC] ◐: S snap, D or ⌘B split, X crop.

### 1.8 Export menu [TOUR] ✅

- **"Remove watermark 👑"** upsell, because **free and trial exports are watermarked**.
- Rows:
  - Publish on Social
  - Export XML (Premiere/DaVinci)
  - Upscale & download ⚡ (HD/4K)
  - Download HD
- Opening the menu starts a background render with % spinners.

### 1.9 Publish on Social [TOUR] ◐

- With no accounts connected, it opens **"Add social accounts"**:
  - YouTube
  - TikTok (Feed/Inbox)
  - Instagram (Business/Creator)
  - Facebook Page
  - X (⚡ costs credits)
  - LinkedIn
  - Pinterest / Threads / Bluesky (Pro)
- ⛔ **The per-platform publish form is unreached** because no account was connected. From the help center ◐:
  - AI title, description and hashtags
  - Cover editor
  - Post now / Select time
  - Platform rules: TikTok fps > 23, YT Shorts must be 9:16 and under 180 s

### 1.10 My projects `/projects` [TOUR] ✅

- **Tabs:** All / Collections / Projects.
- **Collections:** Add new collection (name dialog), Favorites.
- **Project cards:**
  - **Upload new video** tile
  - Each card shows a New tag, **"Unsaved • 6 days left to edit"**, title, clip count and date
- **Storage:** 0/100 GB, with **Auto-save** (paid) and **Auto-import** chips.
- **Project "…" menu:** Save to storage, Share project, Add to a collection, Download subtitles (SRT), Download transcript (TXT), Delete.
  - "Rename" was listed in an older help screenshot but **not** seen in the tour ⚠️.
- **Auto-import:** "Auto-import videos from YouTube".
  - Connect a YouTube account.
  - Credits are charged on **full video length**.
  - Detailed settings per [HC] ◐: playlists, notify vs auto-create, clip length, caption preset.

### 1.11 Brand template `/brand-templates-ux` [TOUR] ✅ / per-section controls ⛔

- **3-step first-run wizard:**
  1. Aspect ratio: 9:16 / 1:1 / 16:9 / 4:5
  2. Caption style
  3. Logo [SR]
- **Editor:** Save template button and a demo preview. Sections:
  - **Style:** clip layout (fill/fit/three/four/split), caption font
  - **Auto headline style**
  - **Brand:** overlay logo + CTA, intro/outro, music
  - **AI toggles:** remove filler words, remove pauses, keyword highlighter, AI emojis, stock video B-roll, auto transitions, auto zoom
- ⛔ The controls inside each section were not opened. Caption flyout tabs Presets / Font / Effects are known from [SR].

### 1.12 Asset library `/brand-kits` [TOUR] ✅

- Storage meter
- **Censored words list** (Beta; default curse words; add list)
- **Brand vocabulary** 0/30 (proper nouns for transcription)
- **Fonts** 0/2 upload
- **Media:** All / Images / Videos / Audio, plus upload

### 1.13 Calendar `/auto-post/calendar` [TOUR] ✅

- Calendar Beta intro dialog.
- Month grid with **Schedule post**, **Upload local video** and a time-zone chip.
- **Schedule post → Select project dialog:**
  - **OpusClip / Agent Opus** tabs
  - Project filter
  - Upload own video
  - Project cards showing days-to-expiry
- The schedule form after picking a project ⛔ was not reached (no accounts).

### 1.14 Analytics `/analytics` [TOUR] ✅

- **"Coming soon"** badge.
- Date filter, Video Performance tab, Account views.
- Data comes from connected YouTube and TikTok accounts.
- ⛔ The populated state does not exist yet.

### 1.15 Social accounts (dialog) [TOUR] ✅

- Platform filter and account list.
- **Add account** → YouTube, TikTok, Instagram, Facebook, X, LinkedIn, Pinterest/Threads/Bluesky (Pro).
- Rate limits and account rules: see [HC] (X 150/day, TikTok 15/day, IG 40/day; FB Pages only; IG Business/Creator only).

### 1.16 Subscription `/subscription` [TOUR] ✅

- **Plan card:** "Free trial (Pro plan)" with an Active badge and **Upgrade** button.
- **Credits & features:**
  - Balance split into plan / trial / top-up credits
  - Expiry date with **See details**, which opens a **Credit breakdown** dialog:
    - Columns: Source, Expires, Remaining
    - Note: "Credits closest to expiry are always used first"
  - Seats 1/1, Brand templates 2/2
- **Billing & payment:** next-cycle credits, trial end date, billing info.
- **Credit usage history table:**
  - Columns: **Date, Usage, Details, Status, Credits**
  - Example row: "ClipProject · <file name> · Used · −1"
  - Page-size selector and pager
- ◐ Not reachable on trial: the cancel / retention flow. The help center describes it as Manage plan → Cancel → retention warning.

### 1.17 Upgrade / Change plan dialog [TOUR] ✅

Opened by **Upgrade**, **Add credits** and **Invite members**.

- Monthly / Yearly (up to 50% off) toggle.
- **Starter** $15/mo, 150 credits:
  - clipping + virality score
  - animated captions in 20+ languages
  - auto-post/download
  - editor
  - 1 brand template
  - filler/silence removal
  - **no watermark**
- **Pro** (Most popular) $29/mo, or $14.50/mo yearly ($174):
  - 300 credits/mo, **rollover 2 months**
  - 2 seats (up to 4)
  - 2 brand templates (up to 4)
  - 6 social connections (up to 12)
  - AI image B-roll
  - 10+ input sources
  - Premiere/DaVinci export
  - multiple aspect ratios
  - scheduler
  - custom fonts
  - speech enhancement
  - subtitle/transcript downloads
- **Business:** Contact us. Includes priority processing, custom credits/seats/storage, API, MSA, Slack and security.
- "Compare all features and plans" link.
- **Change plan dialog:** plan dropdown + **credit-pack dropdown** → Stripe checkout.
- **Top-ups are locked on the trial.**

### 1.18 Team [TOUR] ⛔

- **Team invites are paywalled.** "Invite members" opens the Upgrade dialog (Pro).
- ⛔ Not reached: the team members / roles / invite dialog.
- From help ◐: team name + logo, invite link, Team settings, 2 seats per Pro pack (max 4).

### 1.19 API Access (dialog, Beta) [TOUR] ✅

- Shows the key to owners. Actions: **Copy**, **Rotate key**, **Documentation** link.
- Limits shown: **900 credits (15 h)/month per workspace**, **10 concurrent projects**, minimum 10 credits per project.
  - ⚠️ The API docs say 4 concurrent on Pro.
- *(Never store or paste the key into specs.)*

### 1.20 Opus Labs and other products [TOUR] ✅ (entry level)

- **labs.opus.pro** tools:
  - Multi Angle
  - Copy Video
  - Product Ad Studio
  - Audio to Image Video
  - Motion Studio
  - Product Video Plugin
  - Viral Presets
  - AI Expand
  - A "Coming next" voting board
- **AI Producer** (producer.opus.pro):
  - Web app, plus Claude and ChatGPT plugins
  - Skills: rough cut, auto layout, auto B-roll, captions, music
- **Agent Opus:** AI asset/video generation. Promo offers up to 500 free credits.
- **OpusSearch** (Business) ⛔. It is described only in [HC]: index YouTube, natural-language search with People/Topics/Mood/Duration filters.

---

## 2. Marketing site (opus.pro)

### 2.1 Top navigation [MKT homepage]

- **Features** menu:
  - AI Producer (New → producer.opus.pro)
  - Animated captions `/captions`
  - AI Reframe `/ai-reframe`
  - ClipAnything `/clipanything`
  - Social scheduler `/calendar`
  - Brand template `/brand-templates`
  - AI B-Roll `/ai-b-roll`
  - Export to XML `/export-to-xml`
  - Team workspace `/team-workspace`
  - Editor `/ai-video-editor`
  - Thumbnail generator `/thumbnail`
  - Enhance speech `/enhance-audio`
  - AI video dubbing `/ai-dubbing`
  - "Agentic workflows" group: API `/api`, MCP `/mcp`, Inspiration gallery `/mcp/inspiration`
- **Solutions:** `/business/{creators, media-and-entertainment, marketing, podcaster, agencies, live-streaming, advertisers, church, e-commerce, real-estate}`
- **Resources:**
  - Customer stories `/customer-stories`
  - Blog `/blog`
  - Learning center `/learning-center`
  - Help center (help.opus.pro)
  - Product changelog (canny)
  - Featured case study
- **Pricing** `/pricing`; **For business** `/business`; **Opus Labs**; **Agent** `/agent`
- CTAs: **My dashboard**, **Sign in**, **Sign up – It's FREE** (all point to clip.opus.pro/dashboard); **Join waitlist** `/contact`

### 2.2 Homepage [MKT]

- Hero with link input "Get free clips" and **Upload files**.
- Demo projects (Vlog / Sports / Podcast → `clip.opus.pro/clip/demo-*`).
- Social proof, feature sections, FAQ.
- Banner: "Get 90 credits for free, no credit card required".

### 2.3 Footer [MKT]

- **Company:** About `/about`, Careers `/careers`, Contact `/contact-support`
- **Product:** Tools `/tools`, Changelog, Feature request (canny), OpusClip Captions (Free), How does OpusClip work
- **Resources:** Customer stories, Blog, Become an affiliate `/affiliate`, Media assets, Help center, Learning center, Research `/research`
- **Best practices:** blog links
- **Trust & legal:** `/terms-of-service`, `/privacy-policy`, Cookie preferences, Accessibility statement, Trust center (trust.opus.pro)
- Language switcher: EN, ES, PT-BR, DE, FR (Beta). Localized trees live at `/es-es`, `/pt-br`, `/de-de`, `/fr-fr`.
- Socials: YouTube, TikTok, X, Discord, LinkedIn, Instagram

### 2.4 Every page type in sitemap.xml (5,965 URLs) [MKT]

| Section | Count | Purpose |
|---|---|---|
| Feature pages (single) | ~20 | listed in 2.1, plus `/opussearch`, `/search-agent`, `/trend-agent`, `/auto-cataloging`, `/monetization-toolkit` (OpusSearch sub-pages), `/ai-motion-graphics` (Agent), `/mobile-app` |
| `/tools/*` | 215 | programmatic SEO "tool" landing pages (add-captions-to-video, ai-clip-maker, crop-video …) — **key for Google Ads/SEO landing pages** |
| `/blog/*` | 503 | content marketing |
| `/research/*` + `/ao-research/*` | 232 + 78 | data pages (best posting times, video lengths, hooks), "Research Hub" |
| `/agent/*` | 1,094 | Agent Opus templates/SEO pages |
| `/alternative/*`, `/alternatives/*` | 31 + 12 | competitor comparison pages |
| `/hub/*` | 38 | topic hubs |
| `/mcp/*` | 27 | MCP use cases and inspiration |
| `/business/*` | 11 | industry solution pages |
| `/demo/*` | 11 | demo pages |
| `/creators/*` | 5 | creator pages |
| Campaign pages | — | `/clip-for-cash`, `/growth-playbook`, `/youtube-growth-playbook`, `/wall-of-love`, `/success-stories` |
| Company and legal | — | about, careers, contact, contact-support, contact-api, affiliate, supported-countries, terms, privacy |
| Locales | ~910 each | de-de, fr-fr, es-es, pt-br mirrors |

### 2.5 Learning center structure [MKT /learning-center]

| Group | Topics |
|---|---|
| Upload & clip | Upload; Co-pilot; ClipAnything; prompts; Auto import |
| Quick start | Edit without clipping; captions only; reframe only; B-roll only; voice-over only |
| Brand & customization | Templates; custom font; aspect ratio; logo/overlay; asset library; brand vocabulary |
| Editing | Text-based; timeline; add section; manual reframe; subject tracking; layout; text overlay; B-roll; intro/outro; music; speech enhancement; fillers and pauses; transitions; beep censor; shortcuts |
| Export | XML; bulk download; Download HD |
| Publish | Connect accounts; publish and schedule |
| Team | Create, join, share |
| Growth videos | — |

---

## 3. End-to-end process (tour-verified path)

1. **Land.** The user arrives from an ad, SEO or a tool page. They paste a link or upload on the marketing hero, or click Sign up [MKT].
2. **Sign up** at `/auth/oauth/login`: Google, Apple, or email + 6-digit code. No password [TOUR].
   - Cloudflare human check [SR].
   - Trust-and-safety can deny the trial (VPN, disposable email). Screenrove hit this; we did not [SR].
3. **Trial starts.** The "Your Free Trial Has Started!" modal on `/dashboard` reads:
   - **7 days, 90 credits, no card**
   - all features except the Fast queue [TOUR]
   - After 7 days the account falls back to Free (60 credits/mo per [PR]) [HC].
4. **Import** from the Home well [TOUR]:
   - YouTube link, **Upload**, **Google Drive**, or Try a sample project.
   - Other link sources and limits per [HC]:
     - Vimeo, Zoom, Dropbox, Riverside, Loom, public mp4 and more
     - 10 GB file limit on Free/Starter, 30 GB on Pro
     - up to 10 h
     - YouTube links can fail on policy grounds
5. **Configure** in the Upload settings panel (see 1.4):
   - language, SRT, credit cost
   - AI clipping / Don't clip
   - model, genre, length
   - headline/zoom
   - moments prompt
   - timeframe
   - caption preset
   - aspect ratio
   - save as default
6. **Process:**
   - Goes `/workflow` → `/dashboard?projectId=…`.
   - Progress banner with %/ETA, plus a %-progress browser tab title.
   - **On the very first project, the 5-step onboarding survey runs during processing.**
   - Our 60 s source: **~8 min, 1 credit** [TOUR].
   - Failures auto-refund [HC].
7. **Review** at `/clip/<projectId>`:
   - Gallery sorted by virality.
   - Open the preview modal for the score, Hook/Flow/Value/Trend grades + reasons, scene analysis and transcript.
   - Favorite / dislike, filter, Download all [TOUR].
8. **Edit** at `/editor-ux/<projectId>.<clipId>`:
   - Transcript trim/cleanup and extend
   - Layout/reframe and tracker
   - Captions, B-roll, motion, text, elements, audio, voiceover hook
   - **Save changes** (see 1.7) [TOUR]
9. **Export** via the Export menu:
   - Download HD, Upscale ⚡, XML, or Publish on Social
   - **Free/trial exports carry a watermark** ("Remove watermark 👑" upsell) [TOUR]
10. **Publish / schedule:**
    - Publish on Social, or Calendar → Schedule post → Select project.
    - Both need a connected account (⛔ the form was not reached) [TOUR].
11. **Retention:**
    - Unsaved projects show **"6 days left to edit"** on the trial.
    - Free library media is **deleted after 6 days**.
    - Pro can Save to storage / Auto-save into 100 GB [TOUR].
    - ⚠️ The help center says 3 days on Free and 7 on Trial. The live app showed 6 days.
12. **Monetize:**
    - "Remove watermark", Add credits, Upgrade, Invite members and Top-ups all route to the **Upgrade / Change plan dialog** → Stripe [TOUR].

---

## 4. Pricing and gating [PR][HC][SR][TOUR]

**Tour corrections (these override v1):**
- **Trial:** 7 days, **90 credits**, **no card**, all Pro features except the Fast queue.
  - The subscription page labels it "Free trial (Pro plan)".
  - Top-ups are locked during the trial.
  - Team invites are paywalled (Pro).
- **Cost:** a 60 s video cost **1 credit** (90 → 89), recorded in the usage history as "ClipProject … −1".
- **Watermark:** free/trial exports are watermarked. Starter and up remove it.
- **Retention:** unsaved projects showed "6 days left to edit". Free library media is deleted after 6 days ⚠️ (the help center says 3 days on Free).
- **Credits:**
  - The breakdown dialog lists each source with its expiry.
  - "Credits closest to expiry are always used first".
  - Pro rollover is **2 months** (upgrade dialog).
- **API limits shown in the app:** 900 credits (15 h)/mo per workspace, **10 concurrent**, minimum 10 credits/project.
  - ⚠️ The API docs say 4 concurrent.

| | Free | Starter | Pro | Business |
|---|---|---|---|---|
| Price | $0 | $15/mo | $29/mo or $14.50/mo billed $174/yr | Contact us |
| Credits | 60/mo [PR] (trial: 90 for 7 days [TOUR]) | 150/mo | 300/mo per pack; rollover 2 months | custom |
| Watermark | **yes** [TOUR] | no | no | no |
| Processing | regular | faster | faster | priority/dedicated |
| Editor | limited ⚠️ (trial gets full) | yes | yes | yes |
| Brand templates | 1 | 1 | 2 (up to 4) | custom |
| Seats | 1 | 1 | 2 (up to 4) | custom |
| Social connections | – | auto-post | 6 (up to 12); scheduler | custom |
| B-roll | – | limited | AI image B-roll, stock, AI video (credits) | same |
| Export | 1080p, watermarked | top resolution | + XML Premiere/DaVinci, multiple ratios, SRT/TXT | + |
| Storage / retention | ~6 days unsaved [TOUR] (3 days per HC ⚠️) | 30 days | 100 GB + auto-save | custom |
| API | – | – | Beta (see limits above) | contract |

Credit rules [HC]:
- **Consumption:**
  - 1 credit = 1 minute of the processed range
  - Auto-import charges on full video length [TOUR]
  - X posts cost credits (⚡ in the UI)
  - AI video B-roll: 10 credits per generation
  - Dubbing: 10 credits per minute
  - 4K upscale: +11 credits per 10 s
- **Refunds:**
  - automatic on failure or after 90 minutes
  - manual "Refund this project" on Pro (≤14 days, nothing downloaded)
  - deleting a project does not refund
- **Plan changes:**
  - Upgrades are prorated
  - Downgrades apply at the end of the cycle
  - The Change plan dialog has a plan dropdown and a credit-pack dropdown [TOUR]
- ⚠️ The help center and API mention a **Max** plan (via Agent Opus) that is not on the pricing page.

---

## 5. Data model hints from the API [API]

- `POST /api/clip-projects` takes:
  - `videoUrl`
  - `brandTemplateId`
  - `curationPref`:
    - `model`: ClipAnything | ClipBasic
    - `clipDurations`: [[0,90]] etc.
    - `genre`
    - `topicKeywords` / `customPrompt`
    - `range {startSec, endSec}`
    - `enableAutoHook`
    - `skipCurate`
  - `renderPref`:
    - `layoutAspectRatio`: portrait | landscape | square
    - booleans: enableAutoLayout, enableScreenLayout, enableCrop, enableCaption, enableUppercase, enableHighlight, enableEmoji, enableFill/Split/Three/Four/FitLayout
    - `fitLayoutCropRatio`
    - `enableVisualHook` …
  - `importPref.sourceLang`
  - `conclusionActions`: [{type: EMAIL | WEBHOOK, email | url, notifyFailure}]
  - `uploadedVideoAttr.title`
- **Project** fields: id, orgId, userId, sourcePlatform (YOUTUBE | UPLOADED | YTDLP_LINK | GDRIVE | ZOOM | STREAM_YARD), stage enum, model, productTier, labels, isDeleted, isPurged.
- **Clip** (`/api/exportable-clips`) fields:
  - id `{projectId}.{curationId}`, runId
  - uriForPreview (low-res), uriForExport (HD)
  - durationMs
  - timeRanges (source ms ranges, can be multiple)
  - keywords, promptName, title, description, hashtags ⚠️, score ⚠️
- **Other endpoints:**
  - brand-templates
  - project visibility (share)
  - collections + collection-contents + export
  - censor-jobs
  - transcripts (paragraphs/words with timings)
  - generative-jobs (thumbnails)
  - social-accounts, social-copy-jobs, post-tasks, publish-schedules
- **Webhooks:** header `X-Opus-Signature` = HMAC-SHA256 of (body + salt), plus `X-Opus-Salt` and `X-Opus-Timestamp`.

---

## 6. Feature list with build tags

The full filterable table is in the Page. Tags follow Rick's rules:
- upload/download first
- Google Ads acquisition
- low API cost
- Pexels/Pixabay stock B-roll paid with in-app credit, no watermark
- AI video B-roll only on paid credits

The prototyped speaker-follow crop and word-by-word captions are reused.

- **Acquisition and auth:**
  - v1:
    - landing pages and 5–20 `/tools/*`-style ad/SEO pages
    - Google/Apple/email-OTP sign-up (no password, as Opus does)
    - a no-card trial with a clear credit amount (Opus: 7 days, 90 credits)
    - ad conversion events on sign-up, first project and purchase
  - later:
    - a short onboarding survey shown *during* first processing (Opus pattern: it uses dead wait time and feeds ad targeting)
    - localized sites, comparison pages, affiliate program
  - skip: Facebook login
- **Import:**
  - v1:
    - local upload (resumable, large files)
    - public mp4 URL
    - YouTube link as best-effort
  - later:
    - Google Drive (an Opus home-well button)
    - Dropbox / Zoom and other link sources
    - YouTube auto-import (Opus charges full length)
  - skip: long-tail sources
- **Processing settings:**
  - v1:
    - clip length presets that adapt to source length
    - processing timeframe ("credit saver")
    - "include specific moments" prompt
    - genre (optional)
    - speech language
    - auto headline toggle
    - Don't clip (captions only)
    - SRT upload
    - caption preset + aspect ratio + "save as default" in the same panel
    - show the credit cost before submitting
  - later: translate captions, multiple clip models, auto zoom
- **AI clipping:**
  - v1:
    - transcript + LLM moment selection with sentence-boundary snapping
    - **score /100 with Hook/Flow/Value/Trend grades and a one-line reason each** (from the same LLM call, so the cost is low)
    - titles, descriptions, hashtags
    - category tag
    - auto-refund on failure
  - later: scene analysis with timestamped summary (vision cost), reprompt
- **Processing UX:**
  - v1: stage progress with %/ETA in a banner, a recent-projects card and the browser tab title
  - v1: an email when done
- **Results:**
  - v1:
    - grid/list
    - sort by score / chronological
    - favorite / dislike + filter
    - preview modal with transcript
    - Download HD
    - Download all
    - duplicate
    - SRT/TXT download
  - later: collections, Select bulk actions, share link, ⌘K moment search
- **Editor:**
  - v1:
    - word-level transcript trim/delete with pause chips
    - filler/pause removal
    - extend clip
    - timeline split/delete/trim and undo/redo
    - Save changes
    - captions (presets, font, color, size, weight, shadow, uppercase, position, animation; prototyped)
    - layouts Fill / Fit / Split + **active-speaker follow (prototyped)** + manual crop + Tracker toggle
    - background blur for Fit
    - **stock B-roll from Pexels/Pixabay, charged in in-app credit, no watermark**
    - text overlays + headline
    - Export
  - later:
    - Three/Four/PiP/ScreenShare/Gameplay layouts
    - music library, SFX, transitions/motion, GIPHY elements, name tags
    - intro/outro, media upload
    - speaker colors, keyword highlighter, AI emoji
    - bad-takes, auto censor, speech enhancement
    - AI image B-roll
    - **AI video B-roll: later, paid credits only**
  - skip: eye contact correction, voiceover hook (TTS), dubbing, upscale/4K (all high API cost)
- **Brand templates:**
  - v1: one template (layout + caption + logo + AI toggles), with a 3-step wizard and live preview
  - later: multiple templates, intro/outro, music, headline styles, brand vocabulary, censored words, custom fonts
- **Export / publish:**
  - v1:
    - MP4 1080p download
    - SRT/TXT
    - **watermark policy is Rick's call.** Opus watermarks every free/trial export, and "no watermark" can be a Google Ads hook for us.
  - later: XML (Premiere/DaVinci), bulk zip, share links, publish now (YT/TikTok/IG), scheduler calendar, multi-account
  - skip: X posting (API cost)
- **Account / billing:**
  - v1:
    - credits ledger (Date / Usage / Details / Status / Credits)
    - credit breakdown by source and expiry, spending soonest-to-expire first
    - plan picker + Stripe
    - top-ups
    - cancel flow
    - retention per plan (Opus: unsaved projects deleted after 6 days on free)
  - later: seats/team invites (paywalled at Opus), yearly, API keys, analytics
  - Profile: v1 needs only the avatar menu (account, subscription, usage, logout). Opus has no standalone profile page.
- **Skip for now:** OpusSearch, Agent Opus, AI Producer, Opus Labs, mobile apps, Business SSO.

---

## 7. Complaints and gaps = opportunities [REV]

1. **Abrupt or mid-sentence starts and ends.** This is the #1 complaint (Reddit r/YouTubeCreators Jun 2026; r/opusclip Mar 2026; r/podcasting).
   - **Build:**
     - snap boundaries to sentence ends using transcript punctuation and pauses
     - 0.3–0.5s padding
     - "extend to previous/next sentence" buttons
     - a "complete thought" check in the LLM step
2. **Multi-speaker reframing** picks the wrong face or jitters on interruptions (agentbrisk, vyroclips).
   - **Build:**
     - diarization-driven active speaker with hysteresis (minimum hold time)
     - default to a stable Split layout when two faces are on screen
     - per-segment override with preview before rendering
     - a reaction-shot option
3. **Captions** have errors, are painful to fix, and stack on top of burned-in subtitles (eesel).
   - **Build:**
     - global find/replace
     - low-confidence word highlighting
     - brand vocabulary from day 1
     - detect existing burned-in subtitles and offer to cover or skip
4. **Pricing/credits feel punitive.** Long streams burn credits, credits expire (3,000 lost on renewal), constant upsell popups, cancellation pain (Trustpilot), failed/stuck jobs eat credits.
   - **Build:**
     - charge only for the selected range
     - show the cost before submitting
     - auto-refund on failure
     - one-click cancel
     - simple non-expiring top-ups or a longer rollover
     - a transparent ledger
5. **Export does not match the timeline, or A/V drifts** (frame-rate conversion) (r/opusclip). Keep source fps or use constant-fps conversion, and test exports against the preview.
6. **Virality score feels inflated or inconsistent** (everything 90+). Make it explainable (sub-score reasons) and calibrate it, or label it as a "ranking".
7. **YouTube link import failures** because of YouTube policy [HC]. This supports Rick's upload-first v1.
8. **Stuck processing and slow support** (Trustpilot Feb 2026). Show real stage progress, cancel and retry without double charging.
9. **Free trial denied** by trust-and-safety for VPN users [SR]. Watch false positives for Google Ads traffic.
10. **Analytics are still "Coming soon"** [SR]. This is a gap a competitor can fill later.

11. **Watermark on every free export plus 6-day deletion of unsaved projects** [TOUR]. These are upsell levers that also create friction.
    - **Build:** keep stock B-roll watermark-free, and consider watermark-free free exports with a longer retention window as an ad hook.
12. **Reframing does not follow the speaker in two-person interviews** [TOUR, see 7a]. Opus chose a stacked split screen.
    - **Build:** our active-speaker follow is the differentiator. Keep Split as a per-segment option.

### 7a. Head-to-head on the same clip [TOUR]

- **Test source:** a 60 s CC BY two-person interview (one man, one woman).
- **OpusClip** (trial, default settings, ClipAnything Auto):
  - Returned **1 clip** in **~8 min** for **1 credit**: "Peanuts to Archie: A Comic Book Memory That Started It All", 1:00.
  - Scored **91/100**: Hook **C**, Flow **A-**, Value **A-**, Trend **C**.
  - Reframe: a **stacked split screen** (man top, woman bottom) that switched between **Split and Fill** layout segments. It did **not** follow the active speaker.
  - The export was watermarked (free/trial).
- **Our prototype:** **follows the active speaker**. On the same clip it showed the **right person 93% of the time with zero false cuts**.
- **Takeaway:**
  - Our crop and captions already beat Opus on two-speaker footage.
  - Opus's edge is the explainable score (sub-grades + reasons) and the polished results/preview flow. Copy both in v1, since they are cheap (same LLM call).

---

## 8. Sources

- **[TOUR]** Logged-in walkthrough of clip.opus.pro on a free 7-day trial account, Sun Oct 25, 2026 (America/New_York). One 60 s CC BY interview was uploaded. Raw notes: `logged_in_tour_part1.md`, `logged_in_tour_part2.md`. No API key or account email is reproduced here.
- help.opus.pro (llms.txt, llms-full.txt; articles cited by slug), help.opus.pro/api-reference/openapi.json
- opus.pro: home, /pricing, /sitemap.xml, /learning-center, feature pages listed in 2.1
- opusclip.canny.io/changelog (entries Sep–Oct 2026)
- screenrove.com/opus-clip (product, flows; captured 2026-10-22)
- Reviews:
  - reddit.com/r/opusclip/comments/1rzlqtr
  - reddit.com/r/YouTubeCreators/comments/1uawdyq
  - reddit.com/r/podcasting/comments/1sxe0qm
  - reddit.com/r/opusclip/comments/1k73iaw
  - trustpilot.com/review/opus.pro
  - eesel.ai/blog/opusclip-reviews
  - agentbrisk.com/agents/opus-clip
  - vyroclips.com/opus-clip-face-tracking-glitch-multi-speaker-interviews

---

## 9. Gaps list: status after the logged-in tour

| # | Gap from v1 | Status | Result |
|---|---|---|---|
| 1 | Onboarding / first run | ✅ Verified | Trial modal (7 days, 90 credits, no card). 5-step survey **during first processing**. |
| 2 | Processing screen + notification email | ✅ Verified / ◐ email | Banner %/ETA, recent-projects card, tab-title progress, ~8 min. Email not captured. |
| 3 | Submit panel full layout | ✅ Verified | See 1.4: caption quick presets + My templates, aspect ratio, save as default. |
| 4 | Editor layout + export menu | ✅ Verified | See 1.7 and 1.8. Eye contact correction is in AI enhance. |
| 5 | Publish on Social per-platform form | ⛔ Unreached | No social accounts connected. Only the "Add social accounts" list was seen. |
| 6 | Analytics populated | ⛔ Unreached | The page is "Coming soon" and needs connected YouTube/TikTok accounts. |
| 7 | Team settings / invite dialog | ⛔ Unreached | Invites are **paywalled**: Invite members opens Upgrade (Pro). |
| 8 | Profile & notification settings | ⛔ Unreached (none found) | **No standalone profile page exists.** The avatar menu only has Accounts / Subscription / Usage / Language / LinkedIn / … / Logout. |
| 9 | API Access | ✅ Verified | Dialog: Copy, Rotate key, Docs. 900 credits/mo, 10 concurrent ⚠️ (docs say 4), minimum 10 credits. |
| 10 | Credit usage history columns | ✅ Verified | Date, Usage, Details, Status, Credits. |
| 11 | Manage plan / top-up / cancel | ◐ Partial | Upgrade + Change plan (plan + credit-pack → Stripe) verified. Top-ups locked on trial. Cancel flow not reachable. |
| 12 | Auto-import setup | ✅ Verified (entry) | Connect YouTube; credits charged on full length. Detailed settings not opened. |
| 13 | Quick-start sub-flows | ◐ Partial | AI Captions, AI Reframe and Voiceover hook dialogs, and the Script to video promo, verified. Edit video, SFX, Upscale, Dubbing and Enhance speech dialogs not opened. |
| 14 | Social accounts popup | ✅ Verified | Filter, list, Add account (7+ platforms). |
| 15 | Profile menu items | ✅ Verified / ⛔ submenus | Menu verified. **Language submenu and LinkedIn capabilities not opened.** |
| 16 | Pricing-table checkmarks | ◐ Partial | Starter and Pro bullets verified in the Upgrade dialog. The full compare table was not reread. |
| 17 | OpusSearch / Business screens | ⛔ Unreached | Business-only. |
| 18 | *(new)* Brand template per-section controls | ⛔ Unreached | Sections verified (Style, Auto headline, Brand, AI toggles). Controls inside each were not opened. |

**Still unreached:**
- team/invite dialog
- profile & notification settings (none exist as a page)
- brand template per-section controls
- Language submenu
- LinkedIn capabilities
- the per-platform publish form (no accounts connected)
- populated analytics
- the cancel flow
- Business-only screens
