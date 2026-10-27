# Transovo CLIPPER + STREAMER: UI layout spec (1440×900)

Prepared Mon Oct 26, 2026 (ET). Read alongside `/workspace/specs/clipper-streamer-bic.md` (features, tracking design).
Each screen below lists its competitor references first. Every reference image was opened and inspected. Paths are relative to `/workspace/specs/clipper-refs/`.

> **Rule for Cursor:**
> - Build exactly the geometry below at a 1440×900 viewport.
> - Use only the existing Transovo design system (`handoff/sms_new_app_ui_system.md`, `app/globals.css`): porcelain neutrals, sapphire primary, light theme, Geist, lucide icons, `.surface`, `.surface-raised`, `.tile-primary`, `ChoiceCard`, `StatusBadge`, `Page`/`PageHeader`/`Panel`, shadcn `Dialog`/`Sheet`/`Tabs`/`Slider`/`Switch`/`Tooltip`.
> - Do not copy the competitors' dark chrome. Copy their **structure, order and density**.
> - The only dark surface is the video **stage** (token below), because every competitor shows video on a dark stage. Video on white looks washed out.

## 0. Tokens and shared rules

### 0.1 Existing tokens (do not redefine)
- `--background` oklch(0.982 0.003 255) · `--card` white · `--foreground` oklch(0.21 0.022 264)
- `--primary` oklch(0.47 0.17 263) (sapphire) · `--accent` oklch(0.955 0.022 263) · `--muted-foreground` oklch(0.52 0.018 262)
- `--border` oklch(0.925 0.006 258) · `--success` oklch(0.58 0.13 160) · `--warning` oklch(0.78 0.14 75) · `--destructive` oklch(0.58 0.2 22)
- `--radius` 0.75rem (12px). The scale is rounded-sm 7.2px, md 9.6px, lg 12px, xl 16.8px.
- Shell geometry: header `h-16` (64px), sticky; sidebar `w-20` (80px) collapsed by default, `w-60` (240px) expanded.

### 0.2 New tokens: add to `@theme inline` / `:root`

| Token | Value | Use |
|---|---|---|
| `--stage` | oklch(0.17 0.012 264) (≈ #0E1117) | Video stage background behind previews (editor canvas, preview sheet) |
| `--stage-foreground` | oklch(0.96 0.004 255) | Text and icons on the stage |
| `--stage-muted` | oklch(0.32 0.012 264) | Stage toolbar dividers and inactive icons |
| `--speaker-1` | #4F7BFF | Person P1 (chips, timeline segments, caption color) |
| `--speaker-2` | #F5A524 | P2 |
| `--speaker-3` | #22C55E | P3 |
| `--speaker-4` | #EC4899 | P4 |
| `--speaker-5` | #06B6D4 | P5 |
| `--score-high` | var(--success) | Score ≥ 80 |
| `--score-mid` | var(--warning) | Score 60–79 |
| `--score-low` | var(--muted-foreground) | Score < 60 |
| `--platform-twitch` | #9146FF | Platform badge |
| `--platform-kick` | #53FC18 (text on it: #0B0B0B) | Platform badge |
| `--platform-youtube` | #FF0033 | Platform badge |
| `--live` | #EF4444 | LIVE pill and dot (dot pulses with `animate-pulse`) |
| `--timeline-playhead` | var(--primary) | Playhead line, 2px wide, with a 10px triangle head |

### 0.3 Type scale

| Use | Size / line height |
|---|---|
| Body | Geist 14/20 |
| Small | 12/16 |
| Label | 12/16, weight 500, `text-muted-foreground` |
| Section title | 16/24, weight 600 |
| Page title | 24/32, weight 600, tracking -0.015em |
| Numbers, durations, timecodes | `.tabular` (tabular-nums) |

### 0.4 Spacing and controls
- Spacing grid is 4px. Card padding is 16px. Page padding is 32px on the sides and 24px on top.
- Control heights:

| Control | Height |
|---|---|
| Button / Input sm | 32px |
| Button / Input default | 36px |
| Top-bar buttons | 36px |
| Icon buttons | 32×32 |
| Segmented control | 32px |

### 0.5 Motion
- Hovers and selections: 150ms ease-out.
- Sheets and drawers: 200ms.
- Caption-preset tiles autoplay their animation on hover only (honor `prefers-reduced-motion`).

### 0.6 Shared states (every screen)
- **loading:** skeleton blocks in the exact final geometry, `bg-muted animate-pulse` rounded-lg.
- **empty:** `EmptyState` (icon in a 48px `tile-primary` box, title 16/24, one line of help, primary button).
- **error:** `Callout tone="danger"` at the top of the region, with a retry button.
- **disabled:** opacity 0.5 and `cursor-not-allowed`. The tooltip names the reason, e.g. "Upgrade to Pro for 4K".
- **focus:** 2px `ring` with a 2px offset on every interactive element. Keyboard reachable.

## 1. Results grid (project page → clip cards)

**References:**
- `opusclip/get-clips-faq-1_1.png` … `_4.png`: Opus results rows. The 9:16 preview is about 210px wide; "LOW-RES PREVIEW" badge; transcript beside it; right-hand action column.
- `opusclip/virality-score_1.png`, `_2.png`: score 99/100 in green with letter grades.
- `klap/klap-shorts.png`: three 9:16 cards with platform badges.
- `submagic/Subtitles_Step_3_img.png`: card with a timer chip top-right and a download button on hover.
- `streamladder/clipgpt-feature-3.png`: clip card with a 0:57 duration chip and a 95/100 score bubble.
- `vizard/how_vizard_work_image2.png`: stacked cards with "Clip" badges.

**Frame:** app shell (header 64px, sidebar 80px). Content x 80–1440 (1360 wide). Inner content x 112–1408 (1296 wide).

| Region | y range | Content (left → right) |
|---|---|---|
| PageHeader | 88–144 (56) | Back chevron (32×32), title 24/32 (inline rename on click), `StatusBadge` "Ready · 18 clips". Right: `Button outline` "Re-run with new settings", `Button` (primary) "Export all" with a dropdown. |
| Source strip | 160–224 (64), `.surface` rounded-xl, p 12 | 16:9 source thumbnail 71×40 rounded-md · source title + duration (".tabular 1:02:14") + ingest icon (YouTube/Twitch/Kick/upload) · settings chips: "Speaker follow + Auto layouts", "Bold Pop", "30–60 s", "Prompt: pricing" · right: "People found: P1 P2 P3 P4" as 24px avatar crops (face thumbnails ringed in speaker colors), "Rename people" link. |
| Toolbar | 240–280 (40) | `SegmentedFilter` (All 18 · Liked · Hidden) · sort `SimpleSelect` (Score ▾ / Timeline / Duration) · length filter chips (<30 s, 30–60 s, 60–90 s, 90 s+) · layout filter chips · right: view toggle Grid/List (icon segmented, 32px), "Select" button (enters multi-select). |
| Grid | from y 300 | 5 columns × 240px, gap 24px horizontal and 32px vertical. |

**Clip card (240 × 563):**
1. **Preview** 240×427 (9:16), rounded-xl, overflow hidden, background `--stage`.
   - Poster image; it autoplays muted on hover after 300ms.
   - Overlays:
     - top-left: rank chip "#1" (24px high, `bg-black/60` white 12/16, px 8, rounded-full).
     - top-right: duration chip "0:42" (same style).
     - bottom-left: layout chip with icon + "Split" (shows the dominant layout).
     - bottom-right on hover: download icon button 32×32 white/90.
   - A center play button 48px appears on hover.
2. **Score row** at y+439 (height 24):
   - Score pill: 44×24 rounded-full, 14/20 weight 600 tabular, text in `--score-*` color, background at 12% of that color, e.g. "92".
   - Then four mini-grade chips "H A · F B+ · V A- · T B". Each is 20px high, 11/14, `bg-muted`.
   - Hovering the score shows a tooltip with the full grades and the one-line "Why".
3. **Title** at y+471: 14/20 weight 600, 2-line clamp (height 40).
4. **Why line** at y+515: 12/16 `text-muted-foreground`, 1-line clamp, e.g. "Strong hook: surprising stat in first 3 s".
5. **Actions row** at y+535 (height 28):
   - Left: "Edit" (`Button sm`, primary-outline, 28px high).
   - Then icon buttons 28×28: Like, Dislike (hides the card, with an undo toast "Clip hidden · Undo"), Download, More (Duplicate, Change layout…, Copy caption, Export XML, Delete).

**Card states:**
- hover: `.surface-raised` with a translateY(-2px) lift.
- selected (multi-select mode): checkbox 20px top-left of the preview, `ring-2 ring-primary`.
- rendering: preview shows a skeleton plus a progress ring 32px and "Rendering 64%".
- failed: `--destructive` hairline, preview shows an alert icon and "Retry".
- hidden (disliked): appears only under the Hidden filter, at 60% opacity.

**List view** (Opus-style rows, row height 300):
- preview 162×288 at x 112 · transcript of the clip (scrollable, 14/22, speaker-colored names) x 298–1016 · action column x 1040–1408: score block, title, Why, then vertical buttons (Edit clip, Change layout, Add B-roll, Schedule, Download HD, Export XML).

**Processing state (before any clip exists):**
- Replace Toolbar + Grid with a `Panel` at y 240, 1296×220.
- `StepRail`: Upload ✓ → Transcribe → Find people & scenes → Find clips → Reframe & caption → Ready.
- Below it: "About 6 min left" (tabular) and the current stage's live detail ("Tracking 4 people in 12 clips").
- **Progressive results:** as soon as clips are ready they appear in the grid below the panel. Skeleton cards fill the predicted count.

## 2. Clip editor (full-bleed, no app sidebar)

**References:**
- `opusclip/frames/apply-the-layouts_1_f.png`, `_2_f.png`, `_3_f.png`: per-segment layout labels on the timeline; right-click layout menu.
- `opusclip/frames/how-to-manually-reframe-content_1_f.png`, `_2_f.png`: crop box on the canvas.
- `opusclip/layout-and-reframing_*.png`/`.jpg`: canvas toolbar "9:16 | Layout: Fill | Tracker"; right drawer about 300px with an icon rail.
- `streamladder/guide_template_1.png`: left rail, panel, canvas, timeline with sticker and video tracks.
- `vizard/cotrol_area_timeline_editing.png`: word-chip timeline with trim handles and a time tooltip.
- `vizard/index-slider-area-image1.png`: "AI reframing" pill and face corner brackets.
- `submagic/MC_Feature_5_img.png`: segment blocks with an orange playhead.

**Frame:** the route `/app/clips/[id]/edit/[clipId]` renders without the app header or sidebar (editor shell).

| Region | x | y | Size | Background |
|---|---|---|---|---|
| Top bar | 0–1440 | 0–56 | 1440×56 | `--card`, bottom border |
| Transcript panel | 0–360 | 56–620 | 360×564 | `--card`, right border |
| Canvas (stage) | 360–1012 | 56–620 | 652×564 | `--stage` |
| Inspector panel | 1012–1352 | 56–620 | 340×564 | `--card`, left border |
| Icon rail | 1352–1440 | 56–620 | 88×564 | `--sidebar`, left border |
| Timeline | 0–1440 | 620–900 | 1440×280 | `--card`, top border |

**Top bar (left → right):**
- Back (32×32) · clip title 16/24 weight 600, editable on click, max 360px with ellipsis · autosave status 12/16 muted ("Saved · 10:42 AM ET" / "Saving…" / "Offline — changes kept locally").
- Center: undo/redo icon buttons.
- Right:
  - People chip group "P1 P2 P3" (24px faces). Clicking opens the rename popover.
  - `Button outline` "Preview render".
  - `Button` primary "Export" (36px, px 16), which opens §5.
  - The credits pill sits to the left of Export.

**Canvas (stage):**
- Toolbar at y 56–100 (44), centered group, stage-foreground 13/16:
  - aspect dropdown "9:16 ▾" (9:16, 1:1, 4:5, 16:9)
  - | "Layout: Auto · Split ▾" (opens the §3 picker in the inspector)
  - | "Reframe" (crop mode toggle, shortcut X)
  - | "Track subject" (click-a-subject mode)
  - | Zoom fit/100%.
  - Dividers are 1px `--stage-muted`, 16px high.
- Preview: 270×480 at x 551, y 116. 1px white/10 ring, rounded-lg.
  - Captions are rendered by the HTML overlay at true scale (×0.25 of 1080×1920).
- **Crop mode:**
  - The full 16:9 source shows dimmed at 40% behind the preview, scaled to fit 620 wide (620×349, centered).
  - The crop window is a white 2px rectangle with 8px corner handles. It is draggable and resizable with the aspect locked. Arrow keys nudge 1px; Shift+arrow nudges 10px.
  - Per-slot crop: in Split/Three/Four each slot has its own rectangle, colored by its person's speaker color. A label chip "P2" sits on each rectangle.
  - Buttons under the preview: "Apply to segment" (primary sm), "Apply to all segments with this layout", "Reset to AI".
- **Face indicators:** when the "Show tracking" toggle (the eye icon in the toolbar) is on, 12px corner brackets in speaker colors appear around detected faces in the source view, with an active-speaker dot (8px, pulsing).
- An "✳ AI reframing" pill (as in Vizard) sits at the top-left of the preview while auto layout is applied and the segment has no manual override. It changes to "✎ Manual" once the user overrides.

**Transcript panel:**
- Header (48): Tabs "Transcript" | "Scenes" (32px). Right: search icon, "Speech cleanup" `Button sm outline` (opens a popover with Filler words / Pauses > 0.5 s / Repeats toggles and "Remove N").
- Body: scrollable, p 16.
  - Speaker label rows: 20px face avatar + "P2 · Maria" 12/16 weight 600 in the speaker color + timecode muted.
  - Words are 14/24 inline spans:
    - in-clip words: `--foreground`
    - **context words** (±90 s around the clip): `--muted-foreground` at 60%, behind a dashed divider "Clip starts" / "Clip ends", with a drag handle (16×24 grip) to extend or shrink.
  - Pause chips "⏸ 0.8s": 18px high, `bg-muted`, 11/14, removable.
  - The current word is highlighted with `bg-accent` and follows playback.
- Selection behavior:
  - Shift-click or drag selects words. A floating toolbar (32px high, `.surface-raised`) appears with: Delete (⌫), Restore, Edit text, "Start layout here", "Add B-roll here", "Highlight keyword".
  - Deleted words are struck through in `--destructive` at 50%.
- Scenes tab: a list of shots (from shot detection), each a 64×36 thumbnail + time range + people present + the layout chosen.

**Inspector panel + icon rail:**
- The rail holds 64×64 buttons: a 20px icon over an 11/14 label, active item `.surface` + `tile-primary` icon (same as the app sidebar).
- Rail order:
  1. Layout
  2. Captions
  3. AI enhance (auto zoom, emojis, transitions, cleanup)
  4. B-roll
  5. Text & Hook
  6. Music & SFX
  7. Brand
  8. AI Producer (chat)
- Panel: header 48 (section title 16/24 + help icon), body scroll p 16, optional sticky footer 56.

**Timeline (y 620–900):**

| Row | y range (height) | Content |
|---|---|---|
| Toolbar | 620–664 (44) | Left: Split (S), Delete, Volume. Center: transport (−5 s, play/pause 36px circle primary, +5 s) and timecode "0:12.4 / 0:42.0" tabular. Right: "Fit" button and zoom slider 120px. |
| Ruler | 664–688 (24) | Ticks every 1 s labeled every 5 s, 11/14 muted. |
| **Layout track** | 692–720 (28) | Segment blocks rounded-md, colored by layout type (`bg-accent` + icon + label "Split · P1 P2"). Drag edges to move boundaries. Right-click opens the layout menu. Shift-click multi-selects. A "✎" mark appears on manual segments. |
| Video track | 724–780 (56) | Thumbnail strip with a 2px primary border when selected. Cut gaps are shown as 6px hatched gaps. |
| Speaker track | 784–796 (12) | Thin bars colored by the active speaker (from ASD/diarization), so wrong-speaker shots are visible at a glance. |
| Captions/Text track | 800–828 (28) | Word chips as in Vizard: white rounded chips; the selected one in primary with trim handles; a tooltip shows the time. |
| Overlay track | 832–856 (24) | B-roll, emoji and SFX blocks (B-roll `--chart-2`, emoji `--chart-3`, SFX `--chart-4`). |
| Audio | 860–892 (32) | Waveform in `--muted-foreground` at 50%, with the music lane underneath (collapsed to 8px unless music is present). |

- Playhead: a 2px `--timeline-playhead` line across all tracks with a 10px head on the ruler.
- Track headers: a 72px left gutter (x 0–72) with track icons. Tracks start at x 72.

**Keyboard shortcuts:** Space play, J/K/L, S split, ⌫ delete, X reframe, L layout menu, ⌘Z/⇧⌘Z, ⌘S save, ⌘E export, 1–5 focus person P1–P5 for the selected segment.

## 3. Layout picker (inspector tab "Layout"; same content inside a 720×560 Dialog from the results grid)

**References:**
- `opusclip/layout-and-reframing_3.png`, `_6.png`, `_8.png`, `_11.png`, `_12.png`: Opus layout set (Fill, Fit, Split, Three, Four, Screenshare, Gameplay) and brand-template layout chips with checkmarks.
- `opusclip/apply-the-layouts_4.png`.
- `streamladder/guide_template_2.png`: facecam/HUD/gameplay preview.
- `streamladder/yt_3K3sZh9-z3E.jpg`: real facecam stack with a seam watermark.

**Inspector version (340 wide, inner 308):**
1. Mode `SegmentedControl` (32px, full width): **Auto** | **Manual**.
   - Auto = the AI picks per scene, limited to the allowed layouts.
   - Manual = the chosen layout applies to the selected segments.
2. "Apply to" `SimpleSelect`: This segment / Selected segments (n) / Whole clip.
3. **Layout tiles:** 3 columns of 96×148, gap 10, 4 rows.
   - Each tile: a 72×128 diagram on `--stage`, rounded-md, with a 12/16 label centered under it.
   - Selected: `ring-2 ring-primary`, `bg-accent/60`, and a check badge (16px `tile-primary`) at top-right.
   - In Auto mode, tiles become checkboxes, meaning "allowed".
   - Diagrams (white 2px outlines, person slots filled `--speaker-n` at 35%):
     1. **Auto** (sparkle icon)
     2. **Follow** (one face, arrows)
     3. **Fill**
     4. **Fit** (16:9 bar with a blurred pad)
     5. **Split 2** (top/bottom 50/50)
     6. **Three** (top 50%, bottom two 25% halves)
     7. **Four** (2×2)
     8. **Screen + cam** (screen top 60%, cam bottom 40%)
     9. **Gameplay + cam** (cam top 35% / game 65%)
     10. **PiP** (full + 28% inset bottom-right)
   - Unavailable tiles (for example Four when only 2 people are detected in the segment) are disabled, with the tooltip "Only 2 people in this segment".
4. **People in this layout** (shown for Split/Three/Four/Follow):
   - A slot list, one row per slot, 44px high: slot diagram mini (20×36) + `SimpleSelect` with the person (face 24px + name + talk-time "38%") + a lock icon toggle ("keep this person in this slot").
   - Check row: "Pin first speaker to top slot" (Opus parity).
5. **Gameplay + cam** extras:
   - "Detected webcam box · 86%" `StatusBadge`, plus "Adjust boxes" (enters crop mode with two rectangles: Cam, Game, and an optional HUD box).
   - Split ratio slider 25–50% (default 35%).
   - Cam position Top/Bottom.
   - "Keep killfeed/minimap" toggle, which adds a HUD strip of 12% height.
6. **Motion** section (collapsed by default, "Advanced"):
   - Camera style `SegmentedControl`: Smooth (default) | Locked per shot | Snappy.
   - "Minimum shot length" slider 0.8–4.0 s (default 1.6).
   - "Ignore short reactions" toggle (on).
   - "Reaction cutaways" toggle (off).
7. Footer (sticky 56): "Re-run auto layout" `Button outline` (free) and "Apply" primary (Manual mode only).

**Dialog version (720×560, centered at x 360, y 170):**
- Header 56.
- Body: tile grid in 5 columns of 120×200 (diagram 96×170), followed by sections 2/4/6.
- Footer 64: Cancel · Apply to n clips.

## 4. Caption style picker (inspector tab "Captions")

**References:**
- `opusclip/frames/change-captions_1_f.png` … `_5_f.png`: brand template with Caption row, "Remove filler words", "AI keywords highlighter" toggles.
- `opusclip/how-to-add-a-brand-template_2.png`: keyword highlighter with 2 hex color rows (38FF70, E385FF).
- `opusclip/frames/captions-and-emojis_2_f.png` … `_7_f.png`.
- `klap/klap-shorts.png`: sentence-case white with black stroke; keyword in yellow, green or a blue pill; emoji above the caption at ~55% height.
- `submagic/Magic_Clip_Intro_img.png`: uppercase on orange boxes.
- `submagic/MC_Feature_5_img.png`: white pills.
- `vizard/how_vizard_work_image2.png`: uppercase white centered.

**Layout (inner 308):**
1. Tabs `Presets` | `Customize` (32px).
2. **Presets grid:** 2 columns of 148×104, gap 12.
   - Each tile: `--stage` background, rounded-lg, the sample word "THIS IS **HUGE**" rendered in the preset at true style (scaled), and the preset name 12/16 in the bottom-left of the tile (white/80).
   - Selected: ring-2 primary + check badge. Hover: animation plays.
   - Order: Bold Pop, Clean White, Boxed, Karaoke, Minimal, Neon, Beasty (uppercase heavy stroke), Pill (white pill bg), Two-tone (Klap-like keyword color), Gaming (seam, uppercase pink/yellow), plus "My presets" (from brand templates) at the top when present.
3. Toggles (`ToggleRow`, 44px each):
   - AI keyword highlight. When on, two color rows appear (36px: swatch 28px + hex input), as in the Opus screenshot.
   - AI emojis. When on: "Position: Above caption / Inline" and "Density: Low/Med/High".
   - Speaker colors. When on: 5 swatch chips mapped to P1–P5.
   - Auto-censor profanity.
4. **Customize tab:**
   - Font `SimpleSelect` with live font names.
   - Size slider 40–120 (px at 1080w).
   - Case `SegmentedControl` (Aa / AA / aa).
   - Words per line 1–4.
   - Colors: Text, Active word, Highlight 1, Highlight 2, Stroke (width 0–12), Shadow (0–20), Background box (none/word/line, color, radius).
   - Animation `SimpleSelect`: None, Pop, Bounce, Karaoke fill, Typewriter, Glow pulse, Slide up.
   - **Position:** a 3×3 anchor grid (24px cells) plus a Y-offset slider. Captions are also draggable on the canvas. Split layouts default to the **seam**.
   - "Save as preset" `Button outline` full width.
   - State: when edited after picking a preset, the tile shows a "Modified" chip and a "Reset" link.

## 5. Export / publish dialog

**References:**
- `opusclip/schedule-clips_1.png`, `_2.png`, `_3.png`: edit-post modal about 470 wide.
- `opusclip/bulk-scheduler_1.jpg` … `_11.jpg`, especially `bulk-scheduler_3.jpg`: calendar with Posted/Scheduled pills and a timezone chip.
- `streamladder/clip-gpt-how-it-works-3.png`: "Share to" avatars, per-platform descriptions, Schedule / Post now.
- `streamladder/guide_template_1.png`: quality radio cards 720p30/720p60/1080p60 with a "best choice" banner.

**Dialog:** 880×640, centered at x 280, y 130, `.surface-raised` rounded-2xl, overlay `bg-black/40`.

| Region | Geometry | Content |
|---|---|---|
| Header | 880×56, p 0 24 | Title "Export clip" 16/24 weight 600 + clip title muted · Tabs **Download** \| **Publish** \| **Schedule** (center) · Close X |
| Left column | x 0–300, y 56–576, p 24 | Preview 202×360 on `--stage` rounded-lg (plays) · title 14/20 weight 600 · duration + aspect chips · "Applies to 1 clip" or "3 clips selected" with a thumbnail stack |
| Right column | x 300–880 (580), p 24, scroll | Tab content |
| Footer | y 576–640 (64), top border, p 0 24 | Left: est. time "~40 s" + credits "uses 0 credits". Right: `Button outline` Cancel, primary action |

**Download tab:**
- Quality radio cards in 3 columns of 168×88, gap 12 (as StreamLadder): 720p 30 fps · **1080p 30 fps** (default, "Recommended" banner, 20px strip in `--success`) · 1080p 60 fps · 4K 60 fps (Pro, disabled with an upgrade tooltip on lower plans).
- Below: Format checkboxes: MP4 (always) · SRT captions · Premiere/DaVinci XML · Transcript TXT.
- "Burn captions" Switch (on). "Watermark" row (shown read-only on Free).
- Primary button: "Download".

**Publish tab:**
1. "Post to" row: 48px connected-account avatars with platform badges (TikTok, YouTube Shorts, Instagram Reels, X, LinkedIn, Facebook). Selected ones get a ring-2 primary. A "+ Connect" tile opens Settings › Connections.
2. Per-platform tabs (only the selected ones). For each:
   - Title (YouTube only, counter /100).
   - Caption/description `Textarea` 5 rows with a counter (TikTok 2200, IG 2200, X 280, LinkedIn 3000).
   - Hashtag chips (AI suggested, removable).
   - Privacy `SimpleSelect`.
   - Platform toggles: Allow comments, Duet/Stitch for TikTok, "Made for kids" for YT.
   - "✨ Rewrite with AI" `Button sm outline`.
   - "Copy to all platforms" link.
3. Primary button: "Post now".

**Schedule tab:**
- The same fields as Publish, plus a date picker (inline mini calendar 280×280) and a time `SimpleSelect` in 15-min steps.
- Timezone chip "America/New_York (ET)".
- "Bulk: space selected clips every [1 day ▾] starting [date]".
- Primary button: "Schedule".
- After success: toast "Scheduled for Tue Oct 27, 9:00 AM ET" + "View calendar".

**States:** posting (progress per platform row with ✓ or ✗ and a retry link), token expired ("Reconnect TikTok" inline `Callout warning`), and validation errors under each field.

**Calendar page** (`/app/clips/calendar`, P1):
- Month grid as in `bulk-scheduler_3.jpg`, light theme: 7 columns of (1296−6×8)/7 = 178px each, row height 132.
- Post chips are 56px high: platform icon + time + title, with a status pill (Posted `--success`, Scheduled `--accent`, Failed `--destructive`).

## 6. Brand kit (`/app/clips/brand`)

**References:**
- `opusclip/frames/change-captions_1_f.png`: Setting panel. Style: Clip layout settings, Caption. Brand: Overlay (logo, CTA), Intro/outro, Music. AI toggles: Remove filler words, Remove pauses, AI keywords highlighter. The preview is centered and "Save template" sits top-right.
- `opusclip/how-to-add-a-brand-template_*.png`/`.jpg`/`_f.png`.
- `vizard/cotrol_area_brand_template.png`.
- `streamladder/guide_template_2.png`: Save Template modal with "save with" toggles and a name counter 18/50.

**Frame:** app shell. Content x 112–1408.

- **PageHeader** y 88–144: "Brand templates" · right: `Button outline` "Duplicate", primary "Save template" (disabled until dirty; a `DraftBar` appears when dirty).
- **Template switcher** y 160–200: chips of templates (32px high, max 6 visible, overflow into a menu) + "+ New template". The default template has a star.
- **Columns:**

| Column | Geometry | Content |
|---|---|---|
| Left form | x 112–872 (760), y 216→ | Stacked `Panel`s, gap 16 |
| Right preview | x 896–1408 (512), sticky top 88 | `.surface` rounded-xl, p 16 |

Right preview contents:
- Aspect `SegmentedControl` 9:16 / 1:1 / 16:9.
- Stage 270×480 (9:16) centered, showing a sample clip with the template applied.
- Sample selector "Use clip from: [project ▾]".

**Form panels, in order:**
1. **Basics:** name (counter /50), "Use for new projects" Switch.
2. **Logo & overlays:**
   - Logo dropzone 120×120 + position 3×3 anchor grid + opacity slider + size slider.
   - CTA overlay text + style + appear-at.
3. **Colors & fonts:** 4 brand swatches (primary, secondary, highlight 1, highlight 2), each with a hex input; upload custom font (.ttf/.otf).
4. **Captions:** the preset picker (§4 grid, 4 columns of 172×110 here) + "Customize…".
5. **Applicable auto layouts:**
   - The layout tiles from §3 as checkboxes, in 5 columns of 136×200.
   - Default motion style and minimum shot length.
   - Fit crop ratio (4:3 / 1:1 / 16:9) for Fit.
6. **Intro / outro:** two 16:9 dropzones 240×135 with trim.
7. **Music:** default track or "AI music per clip", volume, ducking.
8. **AI defaults** (`ToggleRow`s): Remove filler words · Remove pauses · AI keyword highlighter · AI emojis · Auto zoom on emphasis · Auto transitions · Auto B-roll (stock/AI) · Hook title overlay.
9. **Brand vocabulary:** tag input of custom words and spellings for ASR and captions.
10. **"Save with" toggles** (StreamLadder parity): Layout, Captions, Text, Stickers/Emojis, Sound effects, Video effects, Music.

## 7. Streamer dashboard (`/app/streamer`)

**References:**
- `streamladder/clipgpt-feature-1.png`: "Find clips from stream".
- `streamladder/clipgpt-feature-2.png`: Twitch/YouTube/Kick platform buttons + "Paste a Twitch VOD URL…".
- `streamladder/clipgpt-feature-3.png`: card with score 95/100 above a VOD heat strip with emoji moment markers.
- `streamladder/clip-gpt-how-it-works-3.png`: publish.
- `eklipse/content-agent-1.png` … `_3.png`: autopilot "Activate Now / Maybe later" cards.
- `opusclip/get-clips-faq-1_*.png`: rows.

**Frame:** app shell. Content x 112–1408.

| Region | y range | Content |
|---|---|---|
| PageHeader | 88–144 | "Streamer" + subtitle "Clips arrive automatically after each stream" · right: `Button outline` "Paste VOD link", primary "Connect channel" (menu: Twitch, Kick, YouTube) |
| Channels row | 160–280 (120) | Channel cards, 4 columns × 306px, gap 24 (fewer cards = left aligned; the 4th slot can be the "+ Connect" dashed card) |
| Live strip (only while a channel is live) | 296–392 (96) | Full-width `.surface` rounded-xl, see below |
| Two-column body | 408 → | Queue x 112–536 (424) · gap 24 · Clip feed x 560–1408 (848) |

(Without a live channel, the body starts at y 296.)

**Channel card (306×120, `.surface` rounded-xl, p 16):**
- Row 1: avatar 40px with a platform badge (16px, at the bottom-right of the avatar) · name 14/20 weight 600 · handle 12/16 muted · right: status pill.
  - LIVE: `--live` background, white 11/14 weight 700, dot pulse, "LIVE 2:14:03".
  - Otherwise "Offline", muted.
- Row 2: three stat columns, each 12/16 muted label + 14/20 tabular value: "Last stream 3h ago" · "Clips this week 42" · "Hours used 18/40".
- Row 3: "Auto-clip" Switch (sm) · "Settings" ghost link.
- States: error, e.g. "Reconnect Kick" `Callout warning`, or a token-expired badge.

**Live strip (96px):**
- Left 280: channel avatar + "Live now · xQc" + viewers "54.2k" + uptime.
- Center (flex): **hype sparkline**, 600×56, showing chat messages/min (line `--primary`) and the hype score (area `--chart-3` at 30%). Live markers appear as 10px dots, with an emoji when the chat-emote type is known (😂 🔥 😱). Hovering a dot shows "02:11:40 · chat spike ×4.2 · 'KEKW'".
- Right 220: "7 moments marked" + "Clips will render when stream ends (≈ 20 min after)", or, when Twitch clip-create is enabled, "3 quick clips ready" with a link.

**Queue column (424 wide):**
- Panel header: "Queue" + `SegmentedFilter` Active · Done · Failed.
- Rows are 72px high:
  - 16:9 thumbnail 96×54 · VOD title 14/20 1-line · "Twitch · 6:02:11 · Oct 25"
  - stage `StatusBadge`: Waiting for VOD → Downloading audio → Transcribing → Scoring → Rendering 8/24 → Done
  - progress bar 4px under the row · ETA tabular, right-aligned.
- Row menu: Cancel, Re-run, Delete source.
- Below the list: "Usage this month 18/40 stream-hours" meter.

**Clip feed (848 wide):**
- Header (40): Tabs **Needs review (24)** · Approved · Scheduled · Posted · Rejected. Right: sort by Score / Time, plus a channel filter.
- Grid: 4 columns × 200px, gap 16. The card follows §1, scaled:
  - preview 200×356
  - score pill + reason chips (12px icons): "💬 chat ×4", "🎬 31 viewer clips", "🔊 voice peak", "🎯 triple kill"
  - title 2-line
  - VOD heat strip 200×16 under the title, with the clip's position highlighted in primary (as in StreamLadder clipgpt-feature-3)
  - actions: **Approve** (primary sm), Reject (ghost), Edit, More.
- Bulk bar (sticky bottom, 56, when items are selected): "n selected · Approve · Approve & schedule… · Reject".
- Approve & schedule opens §5 with the bulk schedule.
- **Autopilot card** (Eklipse-style; only while autopilot is off):
  - It is the first card in Needs review, 200×356, `tile-primary` background.
  - Text: "Autopilot: approve clips scoring ≥ 85 and post on schedule."
  - Buttons: "Turn on" (white) and "Not now".

**VOD detail** (`/app/streamer/vods/[id]`, click a queue row):
- Header with title/stats.
- Full-width **hype timeline** 1296×120: stacked lanes, each 24px high, for chat velocity, voice energy, game audio, viewer clips and game events. Markers sit on top, and selected clip ranges are primary blocks.
- Below it, the results grid from §1.
- Clicking anywhere on the timeline opens "Create clip here" with a range of ±15 s.

## 8. Settings (`/app/settings` → Clipper & Streamer sections)

**References:** the existing Transovo settings (`option-group.tsx`); `opusclip/how-to-add-a-brand-template_*` for toggle-row density.

**Frame:** app shell.
- Left vertical nav at x 112–332 (220): items 36px high, active `.surface` + primary text.
- Content at x 364–1084 (max 720).
- Sections are `Panel`s with 16px gaps; rows use `option-group.tsx` (label 14/20 + hint 12/16 + control right-aligned, row height 56).

Nav items and their contents:
1. **General:** language, timezone (America/New_York default), date format.
2. **Clipping defaults:**
   - clip length buckets
   - max clips (5–50)
   - allowed auto layouts (tile checkboxes, small: 5 columns of 120×180)
   - motion style
   - min shot length
   - caption preset
   - brand template
   - processing quality (Standard CPU / Fast GPU, with a cost line)
3. **People & tracking:**
   - "Remember people across projects" Switch
   - saved people list (face 32px, name, merge/delete)
   - max people to track (2–5)
4. **Streamer:** per-channel accordion, each with:
   - auto-clip Switch
   - hype sensitivity slider (Low–High)
   - min score to keep (0–100, default 60)
   - clip length 10–60 s range slider
   - max clips per stream
   - layout preset
   - game-event detection (on for supported games)
   - "Quick clips while live (Twitch create-clip)" Switch
   - autopilot threshold
5. **Connections:**
   - Twitch, Kick, YouTube, TikTok, Instagram, X, LinkedIn, Discord webhook.
   - Each row is 64px: logo 32px, name, connected account, scopes chip, Connect/Disconnect.
6. **Notifications:** in-app / email / Discord for "clips ready", "stream processed", "post failed", "usage 80%".
7. **Usage & limits:** stream-hours meter, minutes this month, GPU spend this month (Modal), cap input.
8. **Team** (later).

## 9. Reference image index (opened during research)

| Folder | Files |
|---|---|
| `opusclip/` | 84 images + `frames/` (27 GIF mid-frames): results rows, score, editor, layouts, reframe, brand template, captions/emojis, B-roll, transitions, scheduler/calendar, ClipAnything upload page |
| `klap/` | klap-shorts.png, klap-long-video.png |
| `vizard/` | 11 images: timeline word chips, AI reframing pill, edit-by-text, brand template, caption translation, change ratio, teams |
| `submagic/` | 10 images: Magic Clips intro, timeline blocks, subtitle cards, clip maker |
| `streamladder/` | guide_template_1/2 (editor + save template), clipgpt-feature-1/2/3, clip-gpt-how-it-works-1/2/3, YouTube frames of real facecam stacks (yt_*.jpg) |
| `eklipse/` | content-agent-1/2/3 (autopilot cards) |
| Descript, Medal, Twitch, Sizzle | no folder: no usable public screenshots without an account |

**Known gaps:**
- No logged-in screenshots exist of the Eklipse dashboard, the Klap editor or the Descript clip results; they would need accounts, which were not created.
- The streamer dashboard design draws on the StreamLadder ClipGPT and Eklipse Content Agent marketing images, plus the Opus results and scheduler.
