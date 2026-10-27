# Transovo Text-to-Video (T2V): build spec

Version 1 · 27 Oct 2026 (ET) · For: the Cursor coding agent that builds T2V inside `new-app/` + `worker/` of `703deuce/sms` (master, snapshot HEAD `694090d`), and the browser tester who checks it.
Goal: InVideo AI / Pictory-class text-to-video **inside the existing Transovo app**, reusing the clipper, the Descript-style script editor, captions, brand, music, Producer chat and the export stack. No MVP: the milestone plan ends at parity with Pictory's scene editor and InVideo's prompt→video + chat-edit flow, not at a demo.

Companion files
- Code: `/workspace/specs/text-to-video-code.tar.gz` (unpacks to `code/`, see `code/README.md` for TESTED / REAL / SKETCH status per file).
- Gap analysis + unit economics: canvas "Text-to-video: InVideo & Pictory vs Transovo" (section "Page-by-page build map" mirrors §3 of this file).
- Layout conventions, theme tokens and the Descript editor itself: `/workspace/specs/descript-ui-layouts.md` (this file follows its §0 rules).
- Reference images downloaded today: `/workspace/specs/t2v-refs/` (Pictory Academy hero images; marketing art, not UI captures, see §0.1).

---

## 0. Conventions

### 0.1 Where the layouts come from (read this first)
- **Pictory** (current product "Pictory 3", Academy pages fetched 27 Oct 2026):
  - Editor = **left panel for features**, **preview top-right**, **bottom timeline of scene thumbnails** ("After Pictory finishes generating scenes, the editor opens with: Left panel for features, Right top panel for scenes tools, Bottom panel for the timeline with scene thumbnails"). Source: pictory.ai/academy/academy-how-to-use-the-new-video-preview-and-timeline-in-pictory.
  - Left-panel tabs named on official pages: **Story** (edit narration), **Visuals** (stock search, uploads, AI Studio, crop), **Audio** (Voiceover / Music / Uploads, Apply Voice, Auto Sync), **Text**, **Styles**, **Elements**, **Scene layers** (eye toggle, delete, drag to restack). Sources: …/how-to-edit-visuals-captions-and-layers-in-pictory-3, …/how-to-use-the-audio-tab-in-pictory-ai.
  - Rules we copy: captions represent narration; titles/CTAs are separate text elements; editing a heading never changes spoken words; cropping never changes project aspect; preview updates live; per-scene play.
- **InVideo AI** (legacy prompt-to-video flow, invideo.io/make/ai-video-generator fetched 27 Oct 2026): "Type your idea, add the specifics—like length, platform, voiceover accent", then "**Select your audience, platform and appearance** and click 'Generate now'", then **Magic Box** chat edits ("delete scene, change voiceover, accent"), then Edit Media / Edit Voiceover, then Export. The help-center collection for editing (help-ai.invideo.io/…/9486768) **returns 404 today**; anything about its Edit Media / Edit Voiceover screens comes from search snippets (UNVERIFIED, §10).
- **No pixel captures** of either product were obtainable today (Academy images are marketing composites; both apps are behind login). Therefore every px value in §3 is **"Chosen"** in the sense of descript-ui-layouts §0.1: picked to match the Transovo shell (`descript-ui-layouts.md` §0.3 grid, 1440×900 primary, 1280×800 minimum) and the reference *structure* above. Do not re-guess them; change them only by editing this file.

### 0.2 Theme, tokens, components
Same as `descript-ui-layouts.md` §0.2–0.4: dark by default, `bg-background` / `bg-card` / `bg-popover`, `PrimaryButton` (`components/app/primary-button`) for **the** CTA of a screen, lucide icons 16 px in rails / 14 px inline, 4 px grid, focus ring `ring-2 ring-ring`. Toasts via `sonner`. Never hard-code hex.

### 0.3 State vocabulary used in every control table
`empty` (no data yet) · `loading` (fetching, skeleton) · `generating` (server job running; shows stage + % from `T2vDraft.status/stage/progress`) · `ready` · `error` (inline message + Retry; never a dead end) · `disabled` (with tooltip saying why) · `stale` (scene changed since last assemble; amber dot).

### 0.4 Truth model (one sentence each)
- `T2vDraft.document` (`T2vDraftV1`, `code/new-app/lib/t2v/types.ts`) is the authoring truth for **scenes, narration, scene media, voice, music, titles**.
- `T2V_ASSEMBLE` bakes the draft into a normal **ClipProject source mp4** + `transcriptWords` (from TTS alignment) + a **full ScriptComposition** document.
- From then on the **Descript-style editor** (`/app/clips/[projectId]/script`) and **RENDER_SCRIPT_COMPOSITION** export work unchanged. Fine edits there never touch the draft; going back to the storyboard and re-assembling preserves deletions whose word ids still exist (stable ids, §5.3).

### 0.5 Credits, pricing & billing — not scheduled (Rick, 27 Oct 2026)
**Do not build** credit gating, usage display, pricing-page changes, or billing for T2V unless Rick **explicitly** asks. There is **no milestone** for this work. T2V stays **ungated** (`FEATURES_ALL_UNLOCKED`). Wireframes that mention credits (§3.0–3.2) are competitor-style reference only — omit those UI elements in implementation. If billing is ever requested, use §5.8 hook points only; economics notes in the canvas §1 are research snapshots, not a delivery plan.

---

## 1. Research summary (what we must match or beat)

| Capability | InVideo AI | Pictory 3 | Transovo T2V (this spec) |
|---|---|---|---|
| Inputs | Prompt + specifics (length, platform, accent), media upload | Text, idea, script, URL, audio, PPT, PDF, images, screen rec, long video | Idea, Script, URL/Blog, PPT, Audio (+ long video = existing clipper) |
| Setup step | Audience, platform, appearance → Generate now | Agent asks voice, visuals, aspect, layout, brand kit | Settings step: audience, platform, aspect, duration, tone, voice, visuals source, template, brand kit |
| Script review | Agent writes script | Review script + scenes before render | Script review screen, per-scene narration + on-screen text + visual query |
| Scene editor | Edit Media / Edit Voiceover (help 404) | Story / Visuals / Audio / Text / Styles / Elements / Scene layers, preview, scene timeline | Studio (§3.4) with the same tab set + Brand + Chat |
| Chat edit | Magic Box | Agent refines by chat | Producer panel (REUSE) + T2V tools |
| Fine edit | Timeline NLE | Text-based editing, no timeline | **Descript-style script editor + timeline** (already built): beats Pictory |
| Voice | Library, accents, cloning | 170+ voices / 29+ langs, ElevenLabs, cloning | ElevenLabs `/v2/voices` library (filters), v4 / v4 Turbo / multilingual v2 / Flash v2.5, instant clone with consent |
| Stock | iStock (older page) | Storyblocks + Getty | Pixabay (have key) + Pexels (**key missing**) videos + photos, dedupe, aspect-aware, 24 h cache |
| Captions | Word-synced styles | Styles, srt/vtt/txt | 10 existing caption presets, word-synced (REUSE) |
| Export | Up to 4K, free exports | 1080p paid | 720p/1080p/4k settings via `enqueueCompositionExport` (REUSE) |

Pricing and plan snapshots are in the canvas (section "What each product has"); they are snapshots and UNVERIFIED for anything not on an official page today.

---

## 2. Route inventory (all 28 existing routes)

Legend: **REUSE AS-IS** (no code change) · **EXTEND** (small additive change, listed) · **NOT NEEDED** (T2V never touches it).

| # | Route (file under `new-app/app/`) | Verdict | What changes |
|---|---|---|---|
| 1 | `/app/clips/brand` `app/clips/(drive)/brand/page.tsx` | REUSE AS-IS | Brand kits (`components/clips/brand-templates-manager.tsx`) are picked in the T2V Settings step and Brand tab. |
| 2 | `/app/clips/exports` `(drive)/exports/page.tsx` | REUSE AS-IS | Already a redirect to `/app/exports`. |
| 3 | `/app/clips/new` `(drive)/new/page.tsx` | EXTEND | Add a 4th source card **"Text to video"** to the fieldset in `components/clips/new-project-workspace.tsx` (grid `sm:grid-cols-3` → `sm:grid-cols-4`), linking to `/app/clips/video/new`. |
| 4 | `/app/clips` `(drive)/page.tsx` | EXTEND | `components/drive/drive-home.tsx`: second CTA "Text to video" beside "New project"; `project-card.tsx` / project rows show a `Video` badge when `sourceKind='t2v'`, link to `/app/clips/[id]/video`; filter chip "Videos". |
| 5 | `/app/clips/trash` `(drive)/trash/page.tsx` | REUSE AS-IS | T2V projects are ClipProjects, so trash/restore works (T2vDraft cascades on hard delete). |
| 6 | `/app/clips/[projectId]/edit/[clipId]` | NOT NEEDED | Clip editor for clipper output; T2V uses the script editor. |
| 7 | `/app/clips/[projectId]` | EXTEND | Add `video: '/app/clips/video/new'` to `RESERVED_PROJECT_SLUGS`; if `project.sourceKind==='t2v'` → `redirect('/app/clips/'+id+'/video')`. |
| 8 | `/app/clips/[projectId]/script` | EXTEND | Top bar: "← Storyboard" button when `sourceKind='t2v'`; banner when draft revision > `assembledRevision` ("Storyboard has changes. Rebuild video"); mark `scene.fineEditedAt` when the user deletes/moves words inside a scene's id block. |
| 9 | `/app/exports` | EXTEND | `listClipRenders` lists `ClipRender` only. Add ScriptCompositionRender rows (T2V and script-editor exports) to `ExportsList`. |
| 10 | `/app/help` | NOT NEEDED | Optional article later. |
| 11 | `/app/home` | REUSE AS-IS | Redirects to `/app/clips`. |
| 12 | `/app/integrations` | REUSE AS-IS | Social publish via `composition-social-publish.ts` (feature-flagged off today). |
| 13 | `/app` `app/app/page.tsx` | REUSE AS-IS | |
| 14–19 | `/app/rooms`, `/rooms/new`, `/rooms/join`, `/rooms/[sessionId]`, `/studio`, `/upload` | NOT NEEDED | Rooms/recording. |
| 20 | `/app/settings` | EXTEND | "Voices" card (saved voices + clones, delete clone, default voice). No T2V usage/billing UI (§0.5). |
| 21–22 | `/app/streamer`, `/app/streamer/channels/[channelId]` | NOT NEEDED | |
| 23–24 | `/app/sw`, `/app/sw/scripts/[scriptId]` | NOT NEEDED | (Its read-aloud route is the only existing TTS; T2V gets its own, §5.4.) |
| 25 | `/` `app/page.tsx` (marketing) | NOT NEEDED | Marketing copy optional. |
| 26 | `/s/[token]` | NOT NEEDED | Screenwriting share. |
| 27 | `/share/clips/[linkId]` | REUSE AS-IS | Share links of exported renders. |
| 28 | `/share/p/[slug]` | REUSE AS-IS | Published composition viewer (`ShareClipViewer`). |

Totals: **REUSE AS-IS 8 · EXTEND 6 · NOT NEEDED 14** (= 28). New routes: **3** (§3).

---

## 3. Page list

New routes
- **P1** `/app/clips/video/new`: Create (source tabs) → **P2** Settings step (same route, step 2).
- **P3** `/app/clips/[projectId]/video`: T2V Studio, with in-page surfaces P3a Script review, P3b Storyboard, P4 Replace media drawer, P5 Voice picker, P6 Music, P7 Captions, P8 Text (titles/lower thirds), P9 Styles/Template, P10 Brand, P11 Chat, P12 Build progress, P13 Export, P14 Voice clone modal.
- **P15** `/app/clips/video/templates`: Templates gallery.
- Extended existing surfaces: P16 Projects list (route 4), P17 New-project entry (route 3), P18 Descript editor handoff (route 8), P19 Exports (route 9), P20 Settings → Voices (route 20).

Files: pages at `app/app/clips/(drive)/video/new/page.tsx`, `app/app/clips/(drive)/video/templates/page.tsx` (inside the drive shell, so the left Drive sidebar stays), and `app/app/clips/[projectId]/video/page.tsx` (full-screen like the script editor). Components under `components/t2v/`.

### 3.0 Shared Studio frame (P3) at 1440×900
Reference structure: Pictory editor (left features panel, preview, bottom scene timeline). Chrome copied from the Transovo script editor (`components/script-editor/script-editor-shell.tsx`, `script-editor-rail.tsx`).

```
┌──────────────────────────────────────────────────────────────────────────────────────────── 1440 ─┐
│ TOP BAR h56: [← Projects] Title (inline edit) · Saved ✓ · [Script|Storyboard] seg · ⟲ ⟳ ·         │
│              [Open in editor] (outline) · [Build video ▸] / [Export ▾] (CTA) — no credits pill (§0.5)   │
├────┬────────────────────────────────┬─────────────────────────────────────────────────────────────┤
│RAIL│ PANEL w400 (scroll)            │ PREVIEW STAGE (flex, 976 at 1440 / 816 at 1280)             │
│w64 │  header h48: tab title + help  │   letterboxed player, aspect of project, max-h 520           │
│    │  body: tab content (§3.x)      │   centred; overlays: caption preview, title/LT preview,      │
│Stry│                                │   scene index chip "Scene 3/12 · 5.2s"                       │
│Vis │                                │   TRANSPORT h48: ◀◀ ▶ ▶▶ · 00:21 / 01:04 · scene/full toggle │
│Aud │                                │   · volume · aspect glyph                                    │
│Text│                                │                                                              │
│Styl│                                │                                                              │
│Brnd│                                │                                                              │
│Chat│                                │                                                              │
├────┴────────────────────────────────┴─────────────────────────────────────────────────────────────┤
│ SCENE STRIP h132: [+] | card 168×96 thumb, label "1 · 4.8s", transition chip between cards (24×24) │
│ horizontal scroll, drag to reorder, selected = ring-2 ring-primary, stale = amber dot top-right     │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- Rail items (64×56 each, icon 16 + label 11 px): Story, Visuals, Audio, Text, Styles, Brand, Chat. Active = `bg-muted text-foreground`, left 2 px `bg-primary` bar. Reuse `script-editor-rail.tsx` pattern; new file `components/t2v/t2v-rail.tsx`.
- 1280×800: panel 360, scene card 152×86, strip 120.
- <1024: rail becomes bottom tab bar (reuse `components/clips/editor/editor-mobile-rail.tsx`), panel is a bottom sheet 60 vh, strip 96.
- Keyboard: Space play/pause, ←/→ previous/next scene, ⌘Z/⇧⌘Z undo/redo (draft history, 50 steps), ⌘↵ Build video, `/` focus Chat.
- Preview player: **client preview, no server render** for storyboard edits. `components/t2v/scene-preview-player.tsx` plays the scene's media element (video/img with CSS Ken Burns transform), the cached VO clip (`<audio>` with signed URL), and DOM overlays for titles/captions (reuse `components/script-editor/preview/script-caption-overlay.tsx` rendering of presets). Full-video play chains scenes; transitions are approximated with CSS opacity/transform. After Build, "Play built video" uses the real mp4.

### 3.1 P1 Create: `/app/clips/video/new`
Purpose: pick a source, paste/upload it, optionally a template. Reference: InVideo "Type your idea" home prompt; Pictory start tiles (Text, URL, PPT, Audio). Layout follows `new-project-workspace.tsx` (`grid lg:grid-cols-[minmax(0,1fr)_380px]`).

```
Drive shell (sidebar 240) │ content p-6, max-w 1120 centred
┌───────────────────────────────────────────────────────────────┬──────────── 380 ┐
│ H1 "Text to video" (text-xl) + sub "Idea, script, link, slides│ RIGHT RAIL       │
│ or audio → finished video"                                     │ Step pills 1●2○3○│
│ SOURCE TABS h40 (segmented, 5): Idea | Script | URL/Blog | PPT │ "What you'll get"│
│ | Audio                                                        │ est. length,     │
│ ┌─────────────────────────────────────────────────────────┐   │ scenes ≈ N       │
│ │ BODY card min-h 280 (per tab, below)                     │   │ (§0.5: no credits)│
│ └─────────────────────────────────────────────────────────┘   │ Template chip    │
│ QUICK OPTIONS row h36: Aspect [16:9|9:16|1:1|4:5] · Length    │ (from gallery)   │
│ [30s|1m|1.5m|2m|3m] · Language [EN ▾]                         │                  │
│ TEMPLATE STRIP h148: "Start from a template" 6 cards 160×100   │ [Continue →] CTA │
│ + "See all" → P15                                              │ (w-full h40)     │
└───────────────────────────────────────────────────────────────┴──────────────────┘
```
Tab bodies:
- **Idea**: `Textarea` rows 6, max 2000 chars, counter, placeholder "e.g. 60-second explainer on how solar panels work for homeowners". 4 example chips under it (fill on click).
- **Script**: `Textarea` rows 14, max 100k chars; "Split scenes by" radio [Sentence | Line break | Let AI decide]; live "≈ 14 scenes · ≈ 1:32" from `splitScript` + 150 wpm. Script mode **never rewrites narration** (`script-llm.ts` rule).
- **URL/Blog**: `Input` url + [Fetch] → shows extracted title + first 600 chars + word count (`POST /api/t2v/extract {kind:'url'}`); then "Summarise to [length]".
- **PPT**: Dropzone (`components/clips/dropzone.tsx`, accept .pptx/.pdf, 100 MB) → slide count + thumbnails row (one scene per slide; speaker notes = narration if present). Parity milestone M9.
- **Audio**: Dropzone (mp3/wav/m4a, reuse `uploadClipFile`) → "We'll transcribe it and add visuals" (Deepgram, REUSE). Voice = original audio; Voice tab disabled with tooltip.

| Control | empty | loading | ready | error |
|---|---|---|---|---|
| Continue | disabled ("Add an idea" tooltip) | spinner "Creating…" (POST /api/t2v/drafts) | enabled | toast + inline under body |
| Fetch (URL) | disabled until valid URL (`validateImportUrlForSubmit`) | spinner | extracted preview | "Couldn't read that page (blocked or not an article). Paste the text in Script instead." |
| Dropzone | default | `UploadProgressItem` | file chip | reuse upload error copy |

Data: `POST /api/t2v/drafts {sourceKind, text|url|uploadId, templateId, settings}` → `{id, projectId}` then `router.push('/app/clips/video/new?d='+id+'&step=2')`.

### 3.2 P2 Settings (step 2, same route)
Reference: InVideo "Select your audience, platform and appearance"; Pictory agent's setup questions (voice, visuals, aspect, layout, brand kit).

```
┌───────────────────────────────────────────────────────────────┬──────────── 380 ┐
│ H2 "Set up your video"                                         │ SUMMARY CARD     │
│ GRID 2 cols gap 16, each field card p-4 rounded-xl:            │ thumbnail of     │
│ ┌ Audience ─────────────┐ ┌ Platform ──────────────────────┐  │ template, voice  │
│ │ Input "small business │ │ chips: YouTube · Shorts · TikTok│ │ name ▶ preview,  │
│ │ owners" + 4 chips     │ │ · Reels · LinkedIn · Other      │ │ length, aspect,  │
│ └───────────────────────┘ └─────────────────────────────────┘  │ (no credits, §0.5)│
│ ┌ Tone ─────────────────┐ ┌ Look & feel ───────────────────┐  │                  │
│ │ chips ×6 (friendly…)  │ │ Template select + Brand kit     │  │ [← Back]         │
│ └───────────────────────┘ │ select (REUSE brand templates)  │  │ [Write script ▸] │
│ ┌ Voice ────────────────┐ └─────────────────────────────────┘  │ CTA              │
│ │ current voice row 56  │ ┌ Visuals ───────────────────────┐  │                  │
│ │ ▶ preview · [Change]  │ │ ☑ Pixabay ☑ Pexels(BLOCKED) ☐ AI │ │                  │
│ │ → opens P5 as modal   │ │ images · Mix: Video first|Any   │  │                  │
│ └───────────────────────┘ └─────────────────────────────────┘  │                  │
│ ┌ Captions ── switch + preset picker (REUSE caption-preset-picker.tsx) ┐           │
└───────────────────────────────────────────────────────────────┴──────────────────┘
```
- Platform chip auto-sets aspect (Shorts/TikTok/Reels → 9:16, LinkedIn → 1:1 suggestion) unless the user changed aspect in P1.
- Pexels checkbox: disabled with tooltip "Pexels isn't connected yet" while `pexelsConfigured()` is false (BLOCKED §9).
- Write script → `PATCH /api/t2v/drafts/[id]` (settings) then `POST …/script`; navigate to `/app/clips/[projectId]/video?mode=script` immediately and show P3a in `generating`.

### 3.3 P3a Script review (Studio, mode=script)
Reference: Pictory "review the script and scenes" before visuals; InVideo agent script. Panel area becomes a **centred document** (no preview) so writing is comfortable.

```
TOP BAR (as 3.0, segment "Script" active, CTA "Make storyboard ▸")
┌──────────────────────── doc column max-w 760 centred ──────────────────────────┐
│ Title Input text-2xl                                                              │
│ meta row: ≈ 1:04 · 12 scenes · 158 words · voice "George" ▶ · [Rewrite ▾]        │
│ SCENE BLOCK (repeat), card p-4 gap 8, hover shows handle ⋮⋮ and menu ⋯           │
│  "1"  Narration  [contenteditable, 16px/1.6]                         4.8s est     │
│       On-screen text  [Input sm, ≤ 6 words]                                       │
│       Visual  [chip "solar panels rooftop" ✎]   keywords chips                    │
│       ─ insert bar on hover between blocks: [+ Scene] [Split here] ─              │
│ ...                                                                               │
│ footer: [+ Add scene]                                                             │
└───────────────────────────────────────────────────────────────────────────────────┘
RIGHT FLOAT (w300, sticky top 72, ≥1280 only): "Make it…" quick rewrites:
Shorter · Longer · More casual · More professional · Add hook · Add CTA · Translate ▾
```
- Rewrite ▾ = whole-script rewrite (`POST …/script` with `instruction`); per-scene ⋯ menu: Rewrite, Duplicate, Merge with next, Delete, Move up/down.
- generating: skeleton blocks ×6 with shimmer + top progress "Writing script…" (indeterminate; 5–15 s). error: card "Couldn't write the script" + Retry + "Paste your own script" (switches source to Script).
- Edits autosave (debounce 800 ms) via `PATCH` with `baseRevision`; 409 → toast "Changed in another tab" + reload (same contract as `use-composition-tab-lock.ts`).

### 3.4 P3b Storyboard (Studio, mode=storyboard, default after script)
Frame §3.0. Left panel default tab **Story** (Pictory Story tab): the selected scene's narration + on-screen text + duration, and the scene list.

```
PANEL 400 · Story tab
┌ header h48 "Scene 3 of 12"  ◀ ▶ ─────────────────────────┐
│ Narration (textarea autosize, 15px)                         │
│   status row: voice ● ready 4.8s ▶  | ● stale "Re-voice"    │
│ On-screen text Input · show as [Title|Lower third|None]     │
│ Duration: auto (VO + pad) · pad slider 0–2 s · min (no VO)  │
│ Transition in ▾ (12 types, §5.5) · length 0.2–1.5 s         │
│ ─────────── Scenes ─────────── (list, row h56: thumb 64×36, │
│  "3 · How it works", 4.8s, stale dot, ⋯)                    │
└─────────────────────────────────────────────────────────────┘
```
- First entry from Script: storyboard shows `generating` "Finding visuals… 7/12" (per-scene cards fill in as `POST …/storyboard` returns; v1 is one request, ≈ 3–8 s; cards show shimmer until then).
- Scene card states: ready (thumb), no-match (dashed border, icon, "No match — search" → opens P4), stale (amber dot), voice failed (red dot, tooltip).
- Transition chip between cards opens a 240-wide popover grid of 12 transitions (3×4 tiles 72×48 with icon + name) + "Apply to all".

| Control | States |
|---|---|
| Build video (CTA) | disabled when any scene has no narration and no minDur, or voice failed; generating → P12; done → label becomes "Rebuild" if stale scenes else hidden behind Export |
| Open in editor | disabled until first build ("Build once to fine-edit"); else opens P18 |
| Undo/Redo | disabled at stack ends |

### 3.5 P4 Replace media (Visuals tab + drawer)
Reference: Pictory Visuals tab (search stock, uploads, AI Studio, preview candidate, replace control, crop Done/Cancel).

```
PANEL 400 · Visuals tab
┌ Current visual: 368×207 preview (plays muted on hover) ─────┐
│ [Crop & focus] [Motion ▾ zoom in/out/pan/none] [Lock 🔒]     │
│ attribution "Video by Jane Doe on Pixabay" (link)            │
├ Source segmented: Stock | Uploads | AI image | AI video ─────┤
│ Search Input (prefilled scene.visualQuery) [⌕]  filters:     │
│  Type [Video|Photo] · Orientation auto · Provider [All|Pixabay|Pexels]
│ GRID 2 cols, tile 184×104 (aspect-matched crop), gap 8,      │
│  hover: play preview, duration badge, "Use" button           │
│  infinite scroll (page+1), 24 per page                       │
│ [Shuffle] (next alternate from matchScenes cache)            │
└──────────────────────────────────────────────────────────────┘
Crop & focus = modal 720×520: media with draggable focal point (crosshair) over
an aspect frame overlay; Done / Cancel. Writes focalX/focalY (0..1).
```
- Stock search: `GET /api/t2v/drafts/[id]/scenes/[sceneId]/media?q=&provider=&type=&page=` → `stock-match.ts` (Pixabay now; Pexels when keyed). "Use" → `POST …/media {action:'replace', media}` → server copies to our storage (`stock-asset.ts`) and sets `media.locked=true`.
- Uploads: REUSE ClipUpload list + Dropzone (images and video).
- AI image: prompt textarea (prefilled) + style chips + [Generate · 1 cr]; REUSE `lib/server/ai/kie-image.ts` (KIE); generating tile with % from `/api/clips/generations/[id]` (REUSE `components/clips/editor/use-generation.ts`).
- AI video: REUSE `components/clips/editor/ai-broll-card.tsx` flow (`broll-gen`, 3 cr/shot, confirm-before-spend dialog). Parity milestone M9 adds 16:9/1:1.
- Empty search: "No results for 'x'. Try fewer words." Rate-limited (Pexels 429 / Pixabay 429): banner "Stock search is busy, try again in a minute", grid keeps last results.
- Reused components: `components/clips/editor/stock-broll-picker.tsx` (grid + preview logic; extend for provider filter and aspect crop), `broll-preview-video.tsx`.

### 3.6 P5 Voice picker (Audio tab → Voice section, and modal from P2)
Reference: Pictory Audio tab (Voiceover: browse, preview, Apply Voice; Uploads with Auto Sync); InVideo "change voiceover, accent".

```
PANEL 400 · Audio tab: segmented [Voice | Music | Upload]
Voice section:
┌ Current: avatar 32, "George", labels "male · British · narration", ▶ ───┐
│ Model ▾ [Studio (v4) · Fast (v4 Turbo) · Multilingual (v2) · Flash 2.5] │
│ Speed slider 0.7–1.2 · Stability 0–1 · Similarity 0–1 · Style 0–1       │
│ [Apply to all scenes] (CTA small)                                         │
├ Library ─ search Input · filters chips: Gender ▾ Age ▾ Accent ▾ Language ▾ Use case ▾
│ ★ Saved (T2vSavedVoice) first, then Clones, then library                  │
│ row h56: ▶ (preview_url) · name · 2 label chips · ☆ save · [Use]          │
│ "Load more" (next_page_token)                                             │
│ [+ Clone a voice] → P14                                                   │
└───────────────────────────────────────────────────────────────────────────┘
Modal variant (from P2): 640×640, same body, footer [Cancel] [Use voice].
```
- Data: `GET /api/t2v/voices?search=&gender=&accent=&language=&category=&cursor=` → ElevenLabs `GET /v2/voices` (§5.4, page_size 30). Only one preview plays at a time.
- Apply to all → `PATCH` draft voice; all scenes become `stale`; CTA "Re-voice 12 scenes · ≈ 1 cr" appears at top of Story tab. Re-voicing a scene that has `fineEditedAt` opens a confirm: "You edited this scene in the editor. Re-voicing replaces those word edits for this scene only."
- Upload section: Dropzone for own VO → Deepgram transcript → **Auto Sync**: narration of scenes is re-split to the transcript words (REUSE transcribe pipeline); Voice section disabled.

### 3.7 P6 Music (Audio tab → Music)
Reference: Pictory Music (browse categories, search, preview, Apply, volume).
```
Mood chips (Upbeat, Calm, Corporate, Cinematic, Inspiring, Playful, Dramatic, Lo-fi)
Library list row h48: ▶ · title · mood · 0:58 · [Use]       (pre-generated library, §5.6)
[✨ Generate music for this video · 2 cr] prompt prefilled from LLM musicMood
Current track card: waveform (REUSE audio-waveform-lane.tsx) · Volume 0–100 (default 25)
· Duck under voice switch (default on) · Remove
```
- REUSE: `components/script-editor/side/script-audio-panel.tsx` (music track UI), MUSIC job + `elevenlabs.generate_music` (worker), ducking in `audio_render.py`. Music is **not baked** into the source; it is written to `musicTracks` (§5.3).
- EXTEND worker: `script_composition_render.py` hard-codes music `volume: 0.25`; read `mt.volume` when present.

### 3.8 P7 Captions (Styles tab → Captions section)
REUSE `components/clips/caption-preset-picker.tsx` (10 presets in `lib/clips/caption-presets.json`), switch on/off, position. Preview via `script-caption-overlay.tsx`. Writes `settings.captionPresetId` / `captionsEnabled` → `settings.captions` in the composition.

### 3.9 P8 Text: titles and lower thirds (Text tab)
Reference: Pictory Text (decorative text separate from narration; font, size, colour, alignment, position).
```
List of text items for the selected scene (row h48: kind icon · text · 0.0–2.5s · ⋯)
[+ Title] [+ Lower third] [+ CTA]
Editor for selected item: Text, Subtitle (LT only), Start/End sliders within scene,
Animation [Fade|Slide up|None], Style from brand (font/colours from brand kit), Position [Top|Center|Bottom]
```
- Rendered by `worker/clips_worker/t2v/titles_ass.py` (TESTED) and burned in at assemble time.
- Rule (Pictory): editing a title never changes narration.

### 3.10 P9 Styles / Template (Styles tab)
```
Template grid 2 cols 184×104 (T2vTemplate thumbs) · current ring
Sections: Captions (P7) · Transitions default ▾ · Motion default ▾ · Text style ▾
[Apply template] → confirm "Replaces style, music and transitions, keeps your script and visuals"
```
Template = `T2vTemplate.settings` (partial draft: captions preset, transition, Ken Burns, text styles, music mood, pacing, brand). Applying never touches narration or locked media.

### 3.11 P10 Brand (Brand tab)
REUSE `components/clips/editor/brand-panel.tsx` + `lib/clips/brand.ts` (logo, colours, intro/outro). EXTEND worker: `brand_concat` is only called in `render_job.py`; call it from `script_composition_render.py` when `document.settings.brandTemplateId` is set (intro/outro bookends at export).

### 3.12 P11 Chat (Chat tab = Magic Box)
REUSE `components/clips/producer/producer-panel.tsx` + `lib/server/clips/producer-run.ts`, `tool-call-card.tsx` (confirm-before-spend). EXTEND with T2V tools (each a PATCH on the draft through `saveT2vDraft`):
`rewrite_scene(sceneId, instruction)`, `add_scene(after, narration)`, `delete_scene`, `reorder_scenes`, `swap_visual(sceneId, query?)`, `set_voice(voiceId|description)`, `change_accent(accent)`, `set_music(mood|generate)`, `set_transition(all|sceneId, type)`, `set_aspect`, `shorten_to(seconds)`, `add_title / add_lower_third`, `rebuild`. Placeholder "Try: make scene 3 punchier, use a British female voice".

### 3.13 P12 Build progress (overlay on preview stage)
```
Preview stage dimmed; centred card 420×220:
"Building your video"  ███████████░░░░  62%
stage list (check/spinner): Voice 12/12 ✓ · Visuals ✓ · Assembling ⟳ · Uploading · Ready
[Cancel] (sets job FAILED/cancel) · "You can leave; we'll keep going" 
```
Polls `GET /api/t2v/drafts/[id]` every 2 s (same cadence as project page, `projects-auto-refresh.tsx`). Stages/percent from `job.py` (voice 5–45, media 45–60, assemble 60–85, upload 85–95, composition 95–100). error: red card with message + [Retry] + [Report]. Done: toast "Video ready" and the preview switches to the built mp4 with "Open in editor" highlighted.

### 3.14 P13 Export (top-bar Export ▾ after build)
REUSE `components/script-editor/script-export-popover.tsx` + `enqueueCompositionExport(workspaceId, compositionId, settings)` (`exportKind`, `resolution` 720p/1080p/4k, `quality`, `burnCaptions`, `includeSubtitleTrack`), progress and download rows as in the script editor; shows up in `/app/exports` after route-9 EXTEND. If storyboard is stale, popover header warns "Storyboard has unbuilt changes" with [Build first].

### 3.15 P14 Voice clone modal (M9)
560×600 modal: Name · Dropzone (1–3 files, 1–2 min clean speech total) · "Remove background noise" switch · **consent checkbox (required)** "I have the right to use this voice and the speaker consented" · [Create voice]. → `POST /api/t2v/voices` multipart → ElevenLabs `POST /v1/voices/add`. If `requires_verification` is true, show "ElevenLabs needs to verify this voice" state. Stores `T2vSavedVoice{isClone, consentAt, consentById}`.

### 3.16 P15 Templates gallery: `/app/clips/video/templates`
Reference: Pictory templates; InVideo workflows. Drive shell, content max-w 1280.
```
H1 "Video templates" · search · category chips (Explainer, Listicle, Promo, News, Tutorial, Quote, Story) · aspect filter
GRID 4 cols (3 at 1280), card 280×158 thumb (hover plays previewKey muted) + name + "16:9 · 60s"
Click → preview modal 960×600 (video left 640, right: description, sample script, [Use template])
[Use template] → /app/clips/video/new?template=<id>
```
Empty (no workspace templates): system templates only. Seed 12 system templates (M9) via a seed script.

### 3.17 P16–P20 extended surfaces
- **P16 Projects list** (route 4): card badge `Video` (`components/clips/ui` new `kind-badge.tsx`), thumbnail = first scene thumb, status from draft (`Draft`, `Building 62%`, `Ready`).
- **P17 New-project entry** (route 3): fourth card 1:1 with existing cards (icon `Clapperboard`, label "Text to video", sub "Idea, script, link → video").
- **P18 Descript editor handoff** (route 8): see §4.
- **P19 Exports** (route 9): composition render rows (title, kind, resolution, status, download).
- **P20 Settings** (route 20): Voices card (list of saved/cloned voices, preview, workspace default, delete clone → ElevenLabs `DELETE /v1/voices/{voice_id}`). No usage/billing UI (§0.5).

---

## 4. How a T2V project opens in the Descript-style editor
1. After `T2V_ASSEMBLE`, the project has: `ClipProject.uploadId` → a `ClipUpload` (kind `t2v_source`) whose object is the built mp4; `transcriptKey` JSON with words `{w,s,e,i,spk}`; a `ScriptMediaAsset`; a `ScriptComposition` whose document comes from `draftToComposition()` (`code/new-app/lib/server/t2v/to-composition.ts`).
2. `sourceMediaId` = `clip_upload:{uploadId}` (existing `resolveSourceMediaId`), word id = `${sourceMediaId}:${i}`; `normalizeTranscriptWord` / `toEditorWords` (TS) and `_editor_words_from_transcript` (Python) already honour explicit `i`.
3. `i = slot*10_000 + k` (`T2V_WORD_BLOCK`), so re-voicing scene 4 renumbers only ids 40000–49999. Deletions elsewhere survive (`draftToComposition` keeps `deletedWordIds` whose ids still exist).
4. `scenes[]` in the composition use `startWordId` = first word of each slot block and `outStartMs` = scene start from `assemble()` → the editor's storyboard panel (`components/script-editor/storyboard/script-storyboard-panel.tsx`) shows the same scenes.
5. "Open in editor" = `router.push('/app/clips/'+projectId+'/script')`. Editor top bar shows "← Storyboard". Edits there are normal composition edits (EDL); export from either place uses the same composition.
6. Risk (test in M3): any code that assumes word `i` == array index. Grep `words[i]`/`index ===` patterns in `lib/clips/script-edl/*` and `script_edl.py`; the M3 acceptance test deletes a word in scene 2, re-voices scene 1, and checks the deletion survives.

---

## 5. Backend

### 5.1 Pipeline
```
P1/P2 create ─► POST /api/t2v/drafts ─► ClipProject(sourceKind t2v, DRAFT) + T2vDraft
            ─► POST …/script        ─► writeScript() (openAiJsonResponse, 150 wpm budget) ─► scenes[]
            ─► POST …/storyboard    ─► matchScenes() Pixabay(+Pexels) score+dedupe ─► ensureStockAsset copy to B2
            ─► (optional) POST …/scenes/:id/voice  ─► ttsWithTimestamps() preview + T2vVoiceClip cache
            ─► POST …/assemble      ─► ClipJob T2V_ASSEMBLE (worker):
                  per scene: cache hit or ElevenLabs with-timestamps → mp3 + alignment
                  media download (our storage) → normalize_scene (cover-fit, Ken Burns, exact frames)
                  xfade chain + VO concat (+ ASS titles burn) → source.mp4 → B2
                  words_from_alignment → transcriptKey JSON
                  callback → draftToComposition() → ScriptComposition upsert
            ─► Export: enqueueCompositionExport() → RENDER_SCRIPT_COMPOSITION (REUSE): captions, music+ducking, brand, 720p–4k
```

### 5.2 Prisma (additive only), file `code/new-app/prisma/t2v-additive.prisma`
- `ClipProject.sourceKind String @default("upload")` + index `(workspaceId, sourceKind, createdAt)` + back-relation `t2vDraft T2vDraft?`.
- `enum GenerationKind` + `TTS_VOICE`, `AI_IMAGE` (ALTER TYPE ADD VALUE; Postgres can't run it inside a transaction block together with use of the value, so keep it in its own migration).
- New models (`@@map` snake_case like `clip_jobs`): `T2vDraft` (1:1 project, `document Json`, `revision`, `status/stage/progress/error`, `assembledRevision`), `T2vVoiceClip` (unique `(workspaceId, hash)`), `T2vTemplate` (workspaceId null = system), `T2vSavedVoice` (unique `(workspaceId, provider, voiceId)`, `consentAt`).
- IDs: `createId('t2v')` from `lib/supabase/id` (clip models use string ids without defaults).
- Migration folder name must sort after the newest existing one (`20261028150000_script_publish_views_fk`), e.g. `20261029000000_t2v_additive` and `20261029000100_t2v_enum_values`. Generate with `prisma migrate dev --create-only`, review, never edit existing migrations.

### 5.3 Composition mapping
`draftToComposition()` (REAL): keptWordIds/deletedWordIds, scenes `{id,startWordId,label,outStartMs}`, `musicTracks:[{id,assetId: <AiGeneration id>, outStartMs:0, durMs, label, duckUnderSpeech}]` (the renderer resolves `assetId` as a **generationId**, verified in `script_composition_render.py` lines 224–235), `settings.aspect`, `settings.captions {enabled, presetId}`. Scene media is baked in the source; user-added B-roll overlays in the editor stay in `broll[]`.

### 5.4 Official API usage (code in `code/`)
ElevenLabs TTS with timestamps (API reference "Create speech with timing"):
```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID/with-timestamps?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"Solar panels turn light into power.","model_id":"eleven_v4",
       "voice_settings":{"stability":0.5,"similarity_boost":0.75,"speed":1.0},
       "previous_text":"…","next_text":"…"}'
# → {"audio_base64": "...", "alignment": {"characters": [...], "character_start_times_seconds": [...], "character_end_times_seconds": [...]}, "normalized_alignment": {...}}
```
TS: `ttsWithTimestamps()` in `code/new-app/lib/server/ai/elevenlabs-tts.ts`; Python: `tts_scene()` in `code/worker/clips_worker/t2v/job.py`; alignment → words: `tts_alignment.words_from_alignment()` (TESTED).
Models (docs models page, 27 Oct 2026): `eleven_v4`, `eleven_v4_turbo`, `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5` (`eleven_turbo_v2_5` deprecated in favour of Flash). Char limits per request: v4 10k, v2 10k, Flash 40k; T2V sends one scene per request (≤ ~300 chars) so limits never bind.
Voices: `GET https://api.elevenlabs.io/v2/voices?page_size=30&search=…&category=…` → `{voices:[{voice_id,name,labels,preview_url,category,verified_languages}], has_more, next_page_token}`. Clone: `POST /v1/voices/add` multipart `name`, `files[]`, `remove_background_noise`, `description`, `labels` → `{voice_id, requires_verification}`.
Pixabay videos (pixabay.com/api/docs):
```bash
curl "https://pixabay.com/api/videos/?key=$PIXABAY_API_KEY&q=solar+panels+roof&video_type=film&safesearch=true&per_page=40&min_width=1280&min_height=720"
# hits[].videos.{large,medium,small,tiny}.{url,width,height,thumbnail}; 100 req / 60 s; cache 24 h; no permanent hotlinking
```
Pexels videos (pexels.com/api/documentation), **needs PEXELS_API_KEY (BLOCKED)**:
```bash
curl -H "Authorization: $PEXELS_API_KEY" "https://api.pexels.com/videos/search?query=solar+panels&orientation=landscape&size=medium&per_page=40"
# videos[].video_files[].{link,width,height,quality,file_type}, video_pictures[], user.name, url; default 200 req/h, 20k/mo; show a prominent Pexels link + credit
```
OpenAI script LLM: REUSE `openAiJsonResponse<T>(system, user)` (json_object mode, model from `getClipsLlmModelId`, fallback gpt-4o-mini, 5 retries). Prompt + schema in `code/new-app/lib/server/t2v/script-llm.ts`.
**No OpenAI TTS fallback**: OpenAI's TTS guide says `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` are deprecated and shut down **January 6, 2027**, replaced by a Realtime-API model not supported on `/v1/audio/speech`. Fallback on ElevenLabs errors = retry with `eleven_flash_v2_5`.

### 5.5 Worker (ffmpeg 5.1.9 on prod; xfade, zoompan, ass, sidechaincompress all present)
- `assemble.py` (TESTED): per-scene normalize to exact frame count (`-frames:v`), cover-fit with focal crop, Ken Burns via 2× prescale + `zoompan` (1.0→1.15), video `-stream_loop -1` when shorter than the scene; **xfade timing trick**: every scene except the last is extended by its transition length T, so offset_k = Σ durations of scenes before k and each transition **starts at the scene boundary**, which keeps VO and word timings exact; `cut` = 1-frame fade. Transition map: cut, fade, dissolve, fade_black, fade_white, slide_left, slide_right, slide_up, wipe_left, circle_open, zoom_in, smooth_left → ffmpeg xfade names.
- `titles_ass.py` (TESTED): Title (centred `\an5`, fade or slide-up `\move`) and Lower third (`\an1\pos`, boxed, name over subtitle), burned with `ass=`.
- `job.py` (SKETCH): T2V_ASSEMBLE handler; register in `job_types.py`, `DISPATCH` in `main.py`, and the retry/terminal tuple in `main.py` (~line 552). For > ~40 scenes chunk the xfade graph (assemble in groups of 20, then xfade the group outputs) to bound filtergraph size.
- Example (official ffmpeg filter docs, xfade):
```bash
ffmpeg -i a.mp4 -i b.mp4 -filter_complex "[0:v][1:v]xfade=transition=slideleft:duration=0.5:offset=4.5,format=yuv420p" out.mp4
```

### 5.6 Music library
Pixabay's API has image and video endpoints only (no music endpoint in its API docs). Library = **pre-generated ElevenLabs music**: 8 moods × 4 tracks × 60–180 s generated once by an admin script through the existing MUSIC job, stored as system `AiGeneration` rows (workspace = system) so `musicTracks.assetId` works unchanged. One-off cost ≈ 32 × 2 min × $0.15 ≈ $9.60. Users can still generate per-video (2 cr) or upload.

### 5.7 APIs (all under `app/api/t2v/`, Next 16 `params: Promise<…>`, `resolveWorkspaceId()`, `jsonError`, `assertDevApiAccess` on writes like existing clips routes)
| Method · path | Purpose | Status in code/ |
|---|---|---|
| POST/GET `/drafts` | create (creates ClipProject via REUSED `createClipProjectFromPrompt`, sets sourceKind) / list | REAL |
| GET/PATCH `/drafts/[id]` | read / save with `baseRevision` (409 on conflict); recomputes `scene.voice.hash` | REAL |
| POST `/drafts/[id]/script` | LLM script → scenes | REAL |
| POST `/drafts/[id]/storyboard` | match + copy stock for unlocked scenes | REAL |
| GET/POST `/drafts/[id]/scenes/[sceneId]/media` | search / replace / shuffle / upload / ai_image | SKETCH |
| POST `/drafts/[id]/scenes/[sceneId]/voice` | synth one scene (preview + cache) | SKETCH |
| POST `/drafts/[id]/assemble` | enqueue T2V_ASSEMBLE | REAL |
| GET/POST `/voices` | ElevenLabs library + saved / clone | SKETCH |
| GET `/templates` | system + workspace templates | SKETCH |
| POST `/extract` | url (Readability) / ppt / audio (Deepgram) → text | SKETCH |
| POST `/internal/assembled` | worker callback → `draftToComposition` (internal auth like `/api/clips/internal/jobs/[id]/progress`) | to write (M3) |

### 5.8 Credit hook points (**not scheduled — only on Rick's go-ahead**)
No T2V billing work in M0–M9 or any other milestone. Do not add `credits.ts`, ledger writes, `checkCreditBalance` gates, usage UI, or pricing copy unless Rick explicitly requests it. If he does, likely touch points:

1. `lib/billing/entitlements.ts` — T2V `ClipAction` values + costs.
2. `POST /api/t2v/drafts/[id]/script` — `t2v_minute` (or charge at assemble).
3. `POST /api/t2v/drafts/[id]/scenes/[sceneId]/voice` — `tts_minute` on re-voice.
4. `POST /api/t2v/drafts/[id]/assemble` — `t2v_minute` by output duration.
5. Scene AI image (`…/media` `ai_image`, worker `T2V_SCENE_AI_IMAGE`) — `t2v_ai_image`.
6. Scene AI video (worker `T2V_SCENE_AI_VIDEO`) — `ai_broll_shot`.
7. Per-video music generate — existing `music` action.
8. Studio toolbar — credits pill / estimate (currently omitted per §0.5).
9. Settings — usage rollup lines.
10. Marketing pricing page — T2V SKUs.
11. Shared `recordT2vUsage(…)` (+ `CreditLedgerEntry` / `AiUsage`) after successful actions.

Unit-economics reference (not a build artifact): canvas §1 pricing snapshots; v4 TTS ≈ $0.08/min; library music/stock/export edits ≈ $0 marginal credits in a future model.

### 5.9 Tests run today on the box (ffmpeg 7.1.5; prod is 5.1.9, all filters used exist there)
`cd code/worker && python3 tests/test_t2v_lavfi.py` (all lavfi inputs, ~3.6 s total):
| Test | Result |
|---|---|
| xfade offsets | offsets 2.000, 4.000 for 3×2 s scenes (transitions start at boundaries) |
| assemble 3 scenes (looping 1.5 s testsrc2, trimmed smptehdbars with focal 0.2, mandelbrot still with Ken Burns) | 6.00 s output, 1.3 s wall |
| ducking (same sidechaincompress graph as `audio_render.py`) | music under VO −32.5 dB vs music alone −23.0 dB (≥ 3 dB required) |
| titles ASS burn | 6.00 s; frames checked visually (title centred, slide visible, lower third name over subtitle) |
| alignment → words | ids 30000, 30001 for slot 3 |
Bench `tests/bench_t2v_60s.py`: 12 scenes × 5 s, 1280×720@30, mixed transitions → **60.00 s in 13.5 s wall** (≈ 0.23 s per output second). Test videos for QA stay **1–3 minutes**.

---

## 5.10 Build ownership (single T2V agent on `transovo-build`)
One agent owns **web + worker** for T2V. Reuse Agent B’s landed stack (PR chain #786–#790 → `worker/clips_worker/t2v/*`) — do not fork a second assemble/TTS path.

**Contracts (do not fork):**
- **TTS:** `lib/server/ai/elevenlabs-tts.ts` + `lib/server/t2v/voice-cache.ts` (`ttsHash` in TS only); worker `elevenlabs_tts.py` + `voice_cache.py` on assemble.
- **Stock:** `lib/server/t2v/stock-match.ts` + `stock-asset.ts` (+ Pexels photos when keyed).
- **M5 assemble:** xfade, ducking, titles/LT, brand bookends in worker `assemble.py` / `render_finalize.py` / `job.py`.
- **M9 jobs:** `T2V_EXTRACT_DECK`, `T2V_VOICE_CLONE`, `T2V_SCENE_AI_*` — types in `lib/t2v/m9-contracts.ts`, handlers in `worker/clips_worker/t2v/m9_jobs.py`.

**Git & CI (Rick, 27 Oct 2026):** **No feature branches or PRs.** Commit on **`transovo-build`** only; **Rick merges** — agents do not merge PRs or branches. Loop: `git pull --rebase origin transovo-build` → edit → **`npm run typecheck`** (if TS) + **fast unit tests for touched files only** → commit → push `transovo-build`. **No** `next build`, full CI, or deploy of `transovo-build`. Agent A still owns **production deploy fixes** when `master` ships and Coolify needs attention.

---

## 6. Milestones (agent-days; reconciled with the canvas)
Canvas: core text-to-video ≈ 46 effort-days left, ≈ 53 with 15 % QA. This plan: **50 days for core (M0–M8)**, because the worker assembly, titles, alignment and stock scoring are already written and tested here (≈ 3 days of the canvas estimate). Parity pack M9 ≈ 14 days follows.

| M | Scope | Acceptance criteria | Days |
|---|---|---|---|
| M0 | Schema + plumbing: additive migration, `sourceKind`, job type registration, storage-driver patch (`patches/pixabay-storage-driver.diff`), reserved slug `video`, feature flag `FEATURE_T2V` | `prisma migrate deploy` clean on a copy; existing clipper e2e still green; stock asset written via B2 and signed URL downloads | 2 |
| M1 | TTS: `elevenlabs-tts.ts`, cache, alignment → words, scene voice route; **smoke test with-timestamps on `eleven_v4`** (fallback model if unsupported) | 3 scenes voiced; re-request is a cache hit (no ElevenLabs call); word times within ±50 ms of audio onsets on a spot check | 4 |
| M2 | P1 Create, P2 Settings, P3a Script review, `/script`, `/extract` url + audio | Idea → script in < 20 s; script mode keeps narration verbatim; URL to a blog post produces a 60 s script; autosave + 409 handling | 6 |
| M3 | T2V_ASSEMBLE end-to-end + composition write + editor handoff (§4) + id-stability test | 1-min prompt video builds; opens in `/script` with words and scenes; delete a word in scene 2 → re-voice scene 1 → rebuild → deletion survives; export 1080p works | 6 |
| M4 | P3b Storyboard + P4 Replace media + stock coverage (Pixabay video+photo; Pexels when keyed), focal crop, motion, lock, shuffle | 100 % scenes covered on 5 test prompts; no repeated clip inside a video; vertical prompt picks portrait-friendly clips; crop focal visible in build | 9 |
| M5 | **A:** P5–P10 UI, routes, client preview player. **B:** worker ducking, titles/LT burn, xfade, brand intro/outro in T2V render. **A:** composition export music `volume` in `script_composition_render.py` where not covered by assemble | Voice switch re-voices all; music ducks (export loudness check); titles render as designed; preview matches build within ~1 frame of scene boundaries | 8 |
| M6 | P11 Chat tools, re-voice UX + fineEditedAt warnings, undo/redo, P12 progress + cancel | "Make scene 3 shorter and use a British female voice" executes 2 tool calls with confirm; stale/rebuild flow works | 6 |
| M7 | P16/P17 list + entry, P19 exports, P20 voices, P13 polish | T2V projects visible/filterable (`Video` badge, status); composition renders in `/app/exports`; Voices tab works; exports popover on studio | 4 |
| M8 | QA: browser test script per page (states in §3), 10 test videos 1–3 min (idea, script, URL, audio; 16:9/9:16/1:1), perf check | All §3 states reachable; no console errors; 3-min 1080p build + export < 3 min wall on prod worker | 5 |
| | **Core total** | | **50** |
| M9 | Parity pack: P15 templates gallery + 12 seeds, P14 voice clone + consent, PPT/PDF source, AI image scenes, AI video scenes 16:9/1:1, Pexels photos | Template applies without touching script; clone usable after consent; 10-slide PPT → 10 scenes | 14 |

---

## 7. Reused modules (do not rebuild)
`lib/server/ai/openai-json.ts` (`openAiJsonResponse`), `lib/server/ai/pixabay.ts` (search + `ensureStockAsset`, after patch), `lib/server/ai/elevenlabs.ts` (export `fetchWithElevenLabsRetry` or host TTS next to it), `lib/server/ai/kie-image.ts`, `lib/server/clips/broll-gen*`, `lib/server/clips/composition-export.ts` (`enqueueCompositionExport`), `lib/server/clips/projects.ts` (`createClipProjectFromPrompt`), `lib/clips/script-edl/*` (ScriptDocumentV1), `lib/clips/caption-presets.json`, `lib/clips/brand.ts`, `lib/storage` (`getClipStorage().putBytes`), worker `audio_render.py` (ducking), `captions_ass.py`, `brand_concat.py`, `music_job.py`, `script_composition_render.py`, `storage.py`. UI: `script-editor-shell/rail`, `script-export-popover`, `script-storyboard-panel`, `caption-preset-picker`, `brand-panel`, `stock-broll-picker`, `ai-broll-card`, `audio-waveform-lane`, `producer-panel`, `tool-call-card`, `dropzone`, `upload-progress-item`, `primary-button`, `editor-mobile-rail`.

## 8. Known code issues found during the audit
- `pixabay.ts ensureStockAsset` uploads with the **Supabase** client but signs with `getClipStorage()`; on prod (`STORAGE_DRIVER` s3/B2) the object is written to the wrong store. **Fixed M0** (`9cbba3c9b`): `storage.putBytes` via active driver. Do not re-fix in auto-broll / stock-match paths—**#769** (merged) calls `ensureStockAsset`; align with that stack only if the patch diverges.
- `script_composition_render.py` ignores `musicTracks[].volume` (fixed 0.25) and doesn't apply brand bookends. **Fix in M5** (editor/composition export path only): read `musicTracks[].volume`, apply `brand_concat` like `render_job.py` after the composition cut. **Do not duplicate clipper brand seeding**—**#772** (open) adds `brandEditsFromProjectBrand` + intro/outro on **new clip** `edits.brand` in `projects.ts` / M4 pipeline; if #772 is unmerged, reuse its `lib/clips/brand.ts` helper when wiring T2V `draftToComposition()` brand fields, but keep worker changes scoped to `script_composition_render.py` (not `pipeline.py` / `render_job.py`).
- `/app/exports` lists only ClipRender rows.
- `pixabay.ts searchVideos` sorts portrait-first (clipper bias); T2V uses its own aspect-aware scoring in `stock-match.ts`.

### 8.1 Clipper PR coordination (agent B)
| PR | State | Overlap with T2V §8 | T2V rule |
|---|---|---|---|
| **#769** auto stock B-roll | merged | `ensureStockAsset`, `apply-project-auto-broll`, worker `internal_callback` | Stock storage already fixed at source (`pixabay.ts`); T2V stock in `stock-match.ts` / M4 only. |
| **#772** brand intro/outro on clip edits | open (stacks clipper gaps) | `brandEditsFromProjectBrand`, template intro/outro keys on **clip** exports | Composition/script export bug stays in **`script_composition_render.py`** + composition document brand; import shared TS mapping after #772 merges. |

## 9. BLOCKED: keys and accounts
| Name | Needed for | Status |
|---|---|---|
| `PEXELS_API_KEY` | Pexels videos + photos (second stock source) | **Absent on prod** (names-only env check). Code no-ops without it; UI disables the Pexels checkbox. Get a free key at pexels.com/api and request a higher limit (defaults 200/h, 20k/mo). |
Present (names only): ELEVENLABS, OPENAI, DEEPGRAM, PIXABAY, KIE, MODAL, STRIPE, GEMINI, ANTHROPIC keys.

## 10. UNVERIFIED (check before relying on it)
1. InVideo Edit Media / Edit Voiceover screens: help collection 404s today; details come from search snippets.
2. Whether `/with-timestamps` supports `eleven_v4` / `eleven_v4_turbo` (docs list the models; the M1 smoke test decides; fallback `eleven_multilingual_v2`).
3. Prod `STORAGE_DRIVER` value (bug in §8 assumes s3/B2 per earlier audit).
4. That no code assumes word `i` == array index (M3 test).
5. Pictory/InVideo plan prices and feature counts beyond the official pages cited in the canvas.
6. Default voice id `JBFqnCBsd6RMkjVDRZzb` ("George") taken from ElevenLabs quickstart docs; confirm in `/v2/voices` for the account.
7. TS files in `code/new-app` were not compiled against the repo (no node_modules in the snapshot); expect small type fixes (e.g. ScriptDocumentV1 field names, Prisma client types after generate).
8. All px values in §3 are chosen, not measured (no pixel captures of either product were available).
