# Descript → Transovo: pixel-level UI layout specs

Version 1 · 26 Oct 2026 · Audience: the coding agent that builds each screen, and the browser tester who checks it (paired checklist: `docs/clips/descript/ui-checklist.md`).

**Agent rule:** Before building surface §N, open reference PNGs on the server at `/opt/transovo-refs/descript/NN_*_*/` (not in git). In each milestone report, list § numbers built and any layout deviation + why. Out-of-scope actions are **hidden**, not disabled. Layout conflicts → this file wins for layout; `feature-map.md`, `gap-matrix.md`, and `script-editor.md` win for behaviour.

This document tells you **where every box goes, how big it is, and what is in it** for each Descript surface Transovo clones. Feature behaviour lives elsewhere: `descript-feature-map.md` (what Descript does), `descript-gap-matrix.md` §B6–B13 (Transovo's launch scope), and `script-editor.md` (script editing behaviour). If this file and one of those disagree on **layout**, this file wins. If they disagree on **behaviour**, they win.

## 0. How to read this document

### 0.1 Where the numbers come from
- Every surface lists its reference screenshots under `/opt/transovo-refs/descript/<NN_surface>/` on **coolify-server** (extracted from `descript-ui.tgz`; not in git). Paths in § blocks still say `surfaces/…` for readability — resolve to `/opt/transovo-refs/descript/<folder>/`.
- The screenshots are mostly 2× retina captures from the Descript help center. A 3024 px wide image is a 1512 css-px viewport. **All px values here are CSS px.** Measurements were taken from those images, halved where they were 2×, and rounded to the 4 px grid.
- Fixed chrome (bars, rails, row heights, control heights) keeps the same px at every viewport. Flexible regions are given at **1440×900** (primary target) and **1280×800** (minimum supported "full" layout).
- Where Descript shows something in a way Transovo has to change (light theme, brand, clipper), the **Transovo** block in that surface says what to build instead. Build the Transovo version.
- "Measured" means read off a screenshot. "Chosen" means Descript does not show it clearly, and this document picks a value. Do not re-guess either. If something is missing, add it to §0.6 and pick the nearest existing pattern.

### 0.2 Theme: Descript light → Transovo dark
Descript ships a warm light theme (the 2022 dark theme is in `03_editor_shell/90_dark_theme_reference_2022.png` and `08_scenes_storyboard/90_descriptcom_2022_storyboard_darkmode.png`, which show the same layout in dark). Transovo is **dark by default**. Map every Descript colour role to a token like this, and never hard-code hex:

| Descript role (light) | What it looks like in the refs | Transovo token / Tailwind class |
|---|---|---|
| App chrome behind cards | warm grey `#f4f2ef` | `bg-background` (oklch 0.145 0.012 275) |
| Left nav sidebar (Drive) | same warm grey | `bg-sidebar` (oklch 0.165 0.013 275) |
| Main content card, side-panel card | white, radius 12, 1 px hairline | `bg-card border border-border rounded-xl` (`.surface`) |
| Section card inside a panel (Properties groups) | white on very light grey, radius 10 | `bg-surface-raised rounded-[10px] border border-border` |
| Popover, menu, toolbar | white, shadow | `bg-popover border border-border rounded-lg shadow-lg` |
| Modal | white, radius 12, scrim 40 % black | `bg-popover rounded-xl shadow-lg`; scrim `bg-black/60 backdrop-blur-[2px]` |
| Input / select fill | light grey `#f0eeec`, no border | `bg-muted border border-input` (dark needs the 1 px edge) |
| Primary dark button (Export, New project, Join, Got it) | near-black or maroon `#2d1b22` | `PrimaryButton` (`bg-brand-gradient text-white`) when it is **the** CTA of the screen; otherwise `Button variant="default"` (`bg-primary text-primary-foreground`) |
| Secondary outline button (Record, View all projects) | white with grey border | `Button variant="outline"` (`border-border bg-transparent hover:bg-accent`) |
| Ghost icon button | transparent, grey icon | `Button variant="ghost" size="icon"` (`text-muted-foreground hover:bg-accent hover:text-foreground`) |
| Selected/active nav item, active rail item, selected segmented tab | light grey fill, darker text | `bg-accent text-accent-foreground` (segmented: `bg-surface-overlay text-foreground shadow-xs`) |
| Selected words in script | light blue fill | `bg-primary/25 text-foreground` |
| Find match (current) / other matches | blue outline / pale blue | current `bg-primary/35 ring-1 ring-primary`; others `bg-primary/15` |
| Filler word / gap marker | blue dotted underline | `decoration-info decoration-dotted underline underline-offset-4` |
| Ignored (struck) text | grey strikethrough | `text-muted-foreground/60 line-through` |
| Record button, REC timer, live dot | Descript red `#d70a0a` | `bg-lane-record text-white`; dot `bg-lane-record` |
| Success check, "connection good" dot | green | `text-success` / `bg-success` |
| Upload stalled, error | red text, red border | `text-destructive border-destructive/60 bg-destructive/10` |
| Beta / New tag | grey pill | `rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground` |
| Speaker label colour | green, purple… | `text-speaker-1` … `text-speaker-6` in order of first appearance |
| Timeline clip bars | light blue/grey bars | by lane: script/voice `bg-lane-voice/25 border-lane-voice/60`; b-roll `lane-broll`; caption `lane-caption`; music `lane-music`; SFX `lane-sfx`; AI `lane-ai` |
| Playhead | blue line | `bg-primary` 1 px line + 10×10 head `bg-primary rounded-sm` |
| Focus ring | blue 2 px | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0` |

### 0.3 Typography (Geist Sans; numbers in Geist Mono)
Measured from the refs at 1× css and mapped to Tailwind:

| Role | Descript (measured) | Transovo class |
|---|---|---|
| Home hero heading ("What can I help you with?") | 24 px / 600 | `text-2xl font-semibold tracking-tight` |
| Page title (folder name, "Rooms recordings") | 20 px / 600 | `text-xl font-semibold` |
| Script document title | 22–24 px / 600 | `text-[22px] font-semibold leading-tight` |
| Script body text | 16 px / 400, line-height 1.6 | `text-base leading-[1.6]` (user can change size 14–22) |
| Speaker label in script | 13 px / 600 | `text-[13px] font-semibold text-speaker-N` |
| Panel title ("Captions", "Project", "People") | 14 px / 600 | `text-sm font-semibold` |
| Section title in a panel ("Duration", "Audio effects") | 13 px / 600 | `text-[13px] font-semibold` |
| Row label, menu item, button text | 13 px / 400–500 | `text-[13px]` (`font-medium` on buttons) |
| Meta, helper, empty-state body | 12 px / 400 | `text-xs text-muted-foreground` |
| Rail label, tag, badge | 10–11 px / 500 | `text-[11px] font-medium` (rail `text-[10px]`) |
| Group overline ("WORKSPACES", "TOOLS") | Descript uses 12 px sentence case | Transovo: `text-[11px] font-medium uppercase tracking-wider text-sidebar-muted` |
| Timecode, %, dB, px fields | 11–12 px tabular | `font-mono text-[11px] tabular-nums` (fields `text-xs tabular-nums`) |

### 0.4 Spacing, sizes, radius, elevation
- 4 px grid. Common gaps: 4 (icon↔label in a button), 8 (between controls, between cards), 12 (panel inner padding), 16 (modal padding), 24 (page padding).
- Control heights: **32** for every input, select, segmented control and normal button (`h-8`); **28** for compact toolbar buttons and icon buttons (`size-7`); **36** for modal/onboarding primary buttons (`h-9`); **40** for the full-width primary button at the bottom of popovers (`h-10`). Menu items **32** (`h-8 px-2`); list rows **40**.
- Icons (lucide): 16 px in buttons and menus; 18 px in the right rail and top bar; 14 px inside dense inputs; stroke 1.75.
- Radius: controls 8 (`rounded-lg`), section cards 10 (`rounded-[10px]`), panels/cards/modals 12 (`rounded-xl`), thumbnails 6 (`rounded-md`), pills/segment containers full or 10.
- Elevation: cards `shadow-xs`; floating toolbars & popovers `shadow-lg`; modals `shadow-lg` + scrim; hover lift on grid cards `shadow-md`.
- Dividers: 1 px `border-border`. Resize handles: 8 px hit area, 1 px visible line, line turns `bg-primary` on hover/drag, cursor `col-resize`/`row-resize`.

### 0.5 Shared interaction states (apply everywhere unless a surface overrides)
- **Hover:** ghost/list items `bg-accent/60`; outline buttons `bg-accent`; primary `brightness-110` (+ `shadow-glow` on gradient CTA); thumbnails show a `ring-1 ring-primary/40` and their hover-only actions.
- **Active/pressed:** `brightness-95` and 1 px down; toggles show the "on" token (`bg-primary` track).
- **Selected:** `bg-accent text-accent-foreground`; in lists also a 2 px `bg-primary` bar on the leading edge when the list is a navigation list.
- **Disabled:** `opacity-50 pointer-events-none`, tooltip still on the wrapper if it explains why ("Upgrade to export 4K").
- **Focus:** keyboard focus always shows `ring-2 ring-ring`; mouse focus does not (`focus-visible`).
- **Loading:** skeletons `bg-muted animate-pulse rounded-md` at the final size of the thing; buttons that start a job swap their label for a 16 px spinner + verb-ing text ("Exporting…") and keep their width.
- **Error:** inline `text-xs text-destructive` under the control; page/panel-level errors use an `Alert` (icon + title + one sentence + "Try again" button).
- **Toasts:** sonner, bottom-center in the editor (above the transport), bottom-right elsewhere; 360 wide; `bg-popover`; action button on the right ("Fix", "Open", "Undo").
- **Tooltips:** 500 ms delay, `bg-popover text-xs px-2 py-1 rounded-md`, text then shortcut in `font-mono text-muted-foreground` ("Split  S").

### 0.6 Breakpoints and small screens (global rule)
- **≥1440:** layouts as drawn.
- **1280–1439:** same layout; flexible regions shrink first (canvas, then script); side panel keeps 320 until the main card would go below 720, then side panel drops to 280.
- **1100–1279:** the editor side panel becomes an overlay drawer (it floats over the canvas, `shadow-lg`, closes on Esc/outside click). The Drive sidebar stays 232 wide.
- **768–1099:** editor stacks script above canvas (Stacked placement forced), timeline collapsed by default. The Drive sidebar collapses to a 56 px icon rail. Modals become `w-[calc(100vw-32px)]`.
- **<768:** editor shows the "Editing needs a larger screen" card (icon, one line, "Open on desktop" copy-link button) per `script-editor.md`. Drive, Share page, Rooms guest join and Rooms in-room work on mobile with the notes in each surface.
- Gaps found while building (something this doc does not cover) go in a "Layout questions" list at the end of the PR, with the value you picked.

### 0.7 Transovo-wide differences (apply to every surface)
- **Brand:** the Descript logo / "Underlord" become the Transovo mark and **AI Producer** (sparkle icon in `bg-brand-gradient` 20 px tile). The brand gradient is used only for: the one primary CTA per screen, the logo, the AI Producer entry, score rings, and the active app-nav item.
- **App nav:** Transovo's app sections are Create / Library / Brand / Exports. Descript's Drive sidebar items map as: Home → Create, Recents/Shared/Workspaces/folders → Library, Brand Studio → Brand, (no Descript equivalent) → Exports.
- **Clipper:** every clip from the clipper is a composition with `kind:'clip'`, beside the project's "Full video" composition. Routes: `/app/projects/:projectId/edit` and `/app/projects/:projectId/edit/:compositionId`. The old route `/app/clips/[projectId]/edit/[clipId]` redirects there. Clip compositions show a "Show surrounding transcript" toggle and a "Back to project" link (see §3 and §27).
- **Captions:** Transovo's preset list is Bold Pop, Clean White, Boxed, Karaoke, Minimal, Neon, Bounce, Typewriter, Slide Up, Highlighter; animations None / Pop / Bounce / Slide up / Typewriter / Karaoke fill / Glow (see §6).
- **Words:** sentence case everywhere; "AI Producer" not "Underlord"; "Transovo link" not "Descript (web link)".

---

## 1. Home / Drive / project list

**References** (16 images): `surfaces/01_home_drive/01_the_drive_view_home_tab_showing_template.png`, `surfaces/01_home_drive/02_the_drive_view_sidebar_showing_workspace.png`, `surfaces/01_home_drive/03_the_project_actions_menu_in_the_drive_vi.png`, `surfaces/01_home_drive/04_a_screenshot_of_the_drive_view_in_descri.png`, `surfaces/01_home_drive/05_drive_dropdown_menu_showing_multiple_dri.png`, `surfaces/01_home_drive/06_creating_a_new_folder_in_the_drive_view.png`, `surfaces/01_home_drive/07_selecting_and_moving_multiple_projects_a.png`, `surfaces/01_home_drive/08_screenshot_of_the_media_library_tab_in_t.png`, `surfaces/01_home_drive/09_media_library_folders_displayed_in_drive.png`, `surfaces/01_home_drive/10_filter_options_in_the_media_library.png`, `surfaces/01_home_drive/11_copy_project_link_from_the_drive_view.png`, `surfaces/01_home_drive/12_the_create_new_workspace_option_in_the_d.png`, `surfaces/01_home_drive/13_workspace_creation_dialog_showing_open_a.png`, `surfaces/01_home_drive/14_2026_10_06_15_27_45.png`, `surfaces/01_home_drive/15_drive_view_with_arrow_showing_how_to_swi.png`, `surfaces/01_home_drive/90_descriptcom_projects_grid.png`
Key images: `10`-series settings shots in `20_settings/10_general_app_settings_with_show_wordless.png` are a true **1440×900** 1× capture of Home behind a modal, which is the master for every number below; `01_home_drive/01…` (Home with hero), the folder/list-view shots, `90_descriptcom_projects_grid.png` (grid cards).

### 1.1 Wireframe — Home (1440×900)
```
x:0        232 240                                                        1428 1440
y:0  ┌─────────┬──────────────────────────────────────────────────────────────┐
     │☰ ✓      │        [⌕ Everywhere ▾ | Search for projects, media… ] (720)  (●)(?)│ 48 top bar
y:48 ├─────────┤ ┌──────────────────────────────────────────────────────────┐ │
     │[B Biz ▾]│ │                                   [● Record][New project]│ │ header row 32 (+24 top pad)
     │ ⌂ Home  │ │ ┌──────────────────────────────────────────────────────┐ │ │
     │ ◷ Recents│ │ │            What can I help you with?  (24/600)       │ │ │ hero 300 tall
     │ ⇄ Shared │ │ │   ┌──────────────────────────────────────────┐ (800) │ │ │
     │          │ │ │   │ Upload a file or describe…               │  96   │ │ │
     │Workspaces⌄+│ │ │   │ 📎  Auto ▾                  [Get started]│       │ │ │
     │ 🔒Personal│ │ │   └──────────────────────────────────────────┘       │ │ │
     │ 👥General │ │ │ (chip)(chip)(chip)(chip)(chip)  ← 2 rows, centred, 32 │ │ │
     │Tools ⌄    │ │ └──────────────────────────────────────────────────────┘ │ │
     │ Brand…   │ │ Popular features                                          │ │
     │ Media lib│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐  184 tall     │ │
     │ Rooms rec│ │ └────────────┘ └────────────┘ └────────────┘               │ │
     │ AI spkrs │ │ Recent projects                         [View all projects]│ │
     │ Layout pk│ │ ┌─────┐┌─────┐┌─────┐┌─────┐   4-col grid, scrolls          │ │
     │ Learn    │ │ └─────┘└─────┘└─────┘└─────┘                               │ │
y:900└─────────┘ └──────────────────────────────────────────────────────────┘ ┘
```
Folder / workspace page (list view) replaces the hero with: title row → filter row → table.
```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ 🔒 Personal  (20/600)                    [New folder][● Record][New project]│ 32
 │ [All | Owned by me]                                         [▦ | ☰]        │ 32
 │ ☐  Name                     🌐   Duration   Owner     Created   Last viewed ▾│ 32 header
 │ ☐ [▣] Episode 12 rough cut   🌐   12:04      Rick J    Oct 2     2h ago    ⋯ │ 40 row
 └──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Regions
| Region | 1440×900 | 1280×800 | Min / max | Resizable |
|---|---|---|---|---|
| Top bar | x0–1440, h48 | x0–1280, h48 | fixed | no |
| Search field | w720, centred on viewport, h32 | w640 | `clamp(320px,50vw,720px)` | no |
| Left sidebar | x0–232, y48–900 | x0–232, y48–800 | 232 fixed (56 icon rail <1100) | no |
| Content card | x240–1428, y48–892 (r12) | x240–1272, y48–792 | min w 640 | no |
| Content inner padding | 48 left/right, 24 top | 32 / 24 | — | — |
| Hero panel | inner width × 300 | × 300 | — | — |
| Prompt box | w800 h96, centred | w720 h96 | max 800 | grows to 200 as text wraps |
| Popular feature cards | 3 × (w≈358, h184), gap 16 | 3 × (w≈309) | — | — |
| Recent projects grid | 4 cols, gap 16, card w≈262 | 3 cols | `repeat(auto-fill,minmax(240px,1fr))` | — |
| Table rows (list view) | h40; header h32 | same | — | column widths fixed except Name |

Table columns (list view): checkbox 32 · thumbnail 32 (24×24 r4 inside) · **Name** flex (min 240) · published 32 (globe icon if published) · Duration 96 · Owner 140 · Created 112 · Last viewed 112 (sortable ▾) · row menu 40.

### 1.3 Components, in order
**Top bar (left → right)**
1. App menu — `Menu` icon 18, ghost icon button 28, tooltip "Menu". Opens: New project, Import…, Settings (⌘,), Help, Log out.
2. Sync status — `CircleCheck` 16 muted, tooltip "All changes saved" / spinner "Syncing…".
3. Search — field h32 r8 `bg-muted`; inside: `Search` 14, scope select "Everywhere ▾" (Everywhere / This workspace / This folder), placeholder "Search for projects, media, and transcripts". ⌘K focuses it? **No**: ⌘K is the action bar in the editor; on Home use `/` to focus search. Results dropdown w = field, max-h 480, groups Projects / Media / Transcripts, row h40.
4. Avatar — 28 round, initials fallback `bg-speaker-1/30`; menu: name + email (12 muted), Theme ▸ (Dark / Light / System), Settings, Log out.
5. Help — `CircleHelp` 18 ghost 28, red 6 px dot when unread "What's new".

**Sidebar (top → bottom)**, padding 12, item h32 r8, icon 16 + label 13, gap 4 between items:
1. Drive switcher — h32, `bg-card border` r8: 20×20 r4 initial tile + drive name + `ChevronDown`. Menu lists drives, "Create drive", "Drive settings".
2. Home (`House`), Recents (`Clock`), Shared with me (`Share2`). Active = `bg-accent text-accent-foreground`.
3. Group "Workspaces ⌄" with "+" ghost 20 on the right (tooltip "New workspace"): Personal (`Lock`), General (`Users`), each team workspace (colour square 16).
4. Group "Tools ⌄": Brand Studio (`Palette`), Media library (`Images`), Rooms recordings (`Video`), AI speakers (`AudioLines`), Layout packs (`LayoutTemplate`), Learn (`GraduationCap`).
5. Groups collapse with the chevron (rotates -90°, 150 ms).

**Content (Home)**
1. Header row: `Record` — outline button h32, leading 8 px red dot (`bg-lane-record`), opens the Record menu (§21.3 menu: Camera / Screen / Audio only / Invite others to record ▸). `New project` — h32 primary; hover opens a small menu "New project in ▸ Personal / General / …" (ref `02_new_project_import/01`).
2. Hero: heading; prompt box (`bg-card border border-input r12`, textarea 15 px, placeholder "Upload a file or describe what you want to make, and I'll help you make it."), bottom row inside box: `Paperclip` ghost 28 (Attach), model select "Auto ▾" ghost h28, spacer, `Get started` primary h32 (disabled until text or file).
3. Template chips under the box: outline pill h32 r-full, 13 px, icon 14: Clean up video recording · Generate with an avatar · Rough cut of podcast · Create social clips · Translate & dub video · Turn slides into video · Generate animated video · Browse more templates…. Gap 8, centred, wrap.
4. "Popular features" (`text-base font-semibold`, 16 below hero top margin 32) + three cards (`.surface r12 p16`): left text (title 14/600, body 12 muted, 3 lines) + right illustration 120×120.
5. "Recent projects" title + `View all projects` outline h32. Project card: thumbnail 16:9 r8 (duration chip bottom-right `font-mono text-[11px] bg-black/70`), title 13/500 one line, meta 12 muted "Edited 2h ago · Rick J". Hover: ⋯ button top-right (Open, Rename, Duplicate, Move to…, Copy link, Delete).

### 1.4 States
- Sidebar item hover `bg-accent/60`; active `bg-accent` + 2 px left bar `bg-primary`.
- Table row hover `bg-accent/40` shows the checkbox and ⋯; selected rows `bg-primary/10`; header checkbox selects all; a selection bar replaces the filter row: "3 selected · Move · Duplicate · Delete · ×".
- Drag a file over the content card: card gets `border-2 border-dashed border-primary bg-primary/5` and a centred "Drop to create a project" (16/600).
- Empty (no projects): Recent projects area shows a 320 wide centred block: `FolderOpen` 32 muted, "No projects yet" 14/600, "Upload a video or start recording." 12 muted, buttons `New project` + `Record`.
- Loading: skeleton cards (thumbnail + 2 lines) ×8; table skeleton rows ×10 at h40.
- Error: inline Alert in the content card "Couldn't load projects" + Try again.

### 1.5 Keyboard focus order
Top bar (Menu → sync → search → avatar → help) → sidebar (drive switcher → items top to bottom; ↑/↓ move within, Enter opens) → content header buttons → prompt textarea → attach → model → Get started → chips (←/→ within the chip row) → feature cards → View all projects → project cards (grid: arrow keys move, Enter opens, Shift+F10 / ⋯ opens menu).

### 1.6 Below 1280
- 1100–1279: sidebar 232 stays; recent grid 3 cols; prompt box w = 100 % of hero inner.
- 768–1099: sidebar becomes 56 icon rail (icons only, tooltips; groups become popovers from a `Layers` icon); content card x 64.
- <768: sidebar hidden behind ☰ (sheet from left, w 280); search collapses to a 32 icon that expands full-width; hero chips scroll horizontally; table hides Owner/Created columns.

### 1.7 Transovo
- Sidebar becomes the Transovo app nav: **Create** (Home hero + clipper entry "Turn a long video into clips" as the first chip), **Library** (Recents, Shared, Workspaces, folders), **Brand** (Brand Studio), **Exports** (export queue/history). Active item uses `bg-brand-gradient` 2 px bar, per §0.7.
- Hero heading "What do you want to make?" with the AI Producer sparkle tile left of the prompt's model select; the model select is hidden (single model).
- Project cards show a clip count badge ("8 clips", `text-[11px] bg-black/70 r-md`) top-left when the project has clipper compositions, and a score ring (28) for clip cards.
- "Rooms recordings" stays under Tools (Rooms is launch scope).

---

## 2. New project & import

**References** (16 images): `surfaces/02_new_project_import/01_the_new_project_button_showing_a_workspa.png`, `surfaces/02_new_project_import/02_creating_a_new_project_from_the_file_men.png`, `surfaces/02_new_project_import/03_dragging_a_file_into_the_script_editor.png`, `surfaces/02_new_project_import/04_insert_into_script_button_in_the_file_pr.png`, `surfaces/02_new_project_import/05_the_activity_panel_showing_the_trash_ico.png`, `surfaces/02_new_project_import/06_project_files_upload.png`, `surfaces/02_new_project_import/07_project_files_plus_menu.png`, `surfaces/02_new_project_import/08_the_project_panel_of_the_descript_editor.png`, `surfaces/02_new_project_import/09_gif_showing_a_pdf_being_dragged_into_the.png`, `surfaces/02_new_project_import/10_a_v_sync_offset_slider_in_the_file_previ.png`, `surfaces/02_new_project_import/11_automatic_transcription_in_descript.png`, `surfaces/02_new_project_import/12_transcription_model_and_language_setting.png`, `surfaces/02_new_project_import/13_identify_speakers_prompt_in_descript_dis.png`, `surfaces/02_new_project_import/14_add_speaker_name_dialog_in_descript.png`, `surfaces/02_new_project_import/15_new_comp_png.png`, `surfaces/02_new_project_import/16_descript_media_panel_showing_the_option.png`
Masters: `21_recording_editor_screen/18_async_record_menu.png` (the empty new-project editor, 1512×828 css) and `02_new_project_import/03_dragging_a_file_into_the_script_editor.png` (Transcribing dialog, 1×).

### 2.1 Flow
`New project` (Home) → creates "Untitled project" in the current workspace → opens the editor (§3) in its **empty state** below. Dropping files anywhere (Home card, empty state, script, Project panel, timeline) imports them. Each import shows the **Transcribing dialog** once per batch, then the **Activity** card tracks progress.

### 2.2 Wireframe — empty editor (1440×900)
```
┌ top bar 48 (as §3, title "Personal / Untitled project ▾") ──────────────────────────┐
│ ┌ main card x8–1352 (panel closed) ─────────────────────────────────────┐ ┌rail 80┐│
│ │            Name your creation   (22/400 muted placeholder, editable)  │ │Project││
│ │            ┌ - - - - - - - - - - - - - - - - - - - - - - ┐  w736 h304 │ │AI     ││
│ │            ╎           [file icon 64]                     ╎            │ │Props  ││
│ │            ╎            Upload file (15/600)              ╎            │ │Elemts ││
│ │            ╎   Click to browse / or drag & drop           ╎            │ │Capts  ││
│ │            ╎      supported files ↗ here (12 muted)       ╎            │ │Media  ││
│ │            └ - - - - - - - - - - - - - - - - - - - - - - ┘            │ │       ││
│ │            [👥 Create with AI speaker ][▣ Import from media library]  │ │       ││ 44 each, gap 8
│ │            [● Record                  ][Z Import from Zoom        ]   │ │       ││
│ │            Paste from clipboard or press Enter to continue with an    │ │       ││
│ │            empty script (12 muted, centred)                           │ │       ││
│ │ «  »  ☰  0:00 / 0:00        ● Record  ▶  1x  ⧉ Split      ↖▾ ▭ ▤ ▦     │ │AI Prod││ transport 44
│ └────────────────────────────────────────────────────────────────────────┘ └───────┘│
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Regions
| Region | 1440×900 | 1280×800 | Notes |
|---|---|---|---|
| Empty-state column | w736, centred in main card, top 64 from card top | w680 | max 736, min 480 |
| Title field | h40, 22 px | same | `bg-transparent`, placeholder muted, focus shows 1 px bottom border `border-primary` |
| Dropzone | w100 % × h304, r12, 1.5 px dashed `border-input` | h264 | icon 64 tile with 2 rotated ghost cards behind it (decorative) |
| Action buttons | 2 × 2 grid, each h44, gap 8, outline r10 | same | icon 16 or avatar stack 20 + label 13/500, centred |
| Record menu (popover, opens above the Record button) | w296; items h56 with 84×46 r6 thumbnail | same | submenu w290, items h56 with 40×40 `bg-muted r8` icon tile |
| Transcribing dialog | w448, auto h (≈282), centred, r12 | same | — |
| Activity card | w288, docked bottom-right of main card above transport, r12 | same | collapsible header h40 |

### 2.4 Components, in order
**Empty state**
1. Title — "Name your creation" placeholder; Enter moves focus to the dropzone.
2. Dropzone — button role; click opens the OS file picker (multi-select); accepts video, audio, image, `.srt/.vtt` (attached to the nearest media), `.txt/.docx` script; "supported files ↗" link opens the help page in a new tab.
3. `Create with AI speaker` (avatar stack of 3 × 20 round) → AI speaker picker (Later, so **hidden** in the Transovo launch. The 2×2 grid then reads: Import from media library · Record · Import from YouTube link · Import from Google Drive.)
4. `Import from media library` (`Library` icon) → opens Media panel §11 on "My media".
5. `Record` (8 px red dot) → Record menu: **Camera**, **Screen**, **Audio only**, divider, **Invite others to record ▸** (submenu: Start a recording now · Invite to record async · Schedule for later — `ScreenShare`, `UserPlus`, `Calendar` tiles).
6. `Import from Zoom` → connector sheet (hidden in the Transovo launch; see item 3 for the replacement buttons).
7. Hint line under the buttons.

**Transcribing dialog** (header h48: "Transcribing…" 14/600 + `X` ghost 28)
1. Body line "Your transcript will be ready in a few minutes." 13.
2. One row per file (h40): 16×16 thumb r3, filename 13 (truncate), speaker count select `👥 1 ▾` (w56 h32), **Speaker name** combobox (w104 h32 → opens a 232 wide list with a search field "Type a name" and "Add "Brian" as speaker" row).
3. Divider; language row: `Languages` icon 16 + select "Auto ▾" (w64 h32).
4. Checkbox row "Always ask before detecting speakers" (16 checkbox, 13 label).
5. `Done` full-width h32 primary (r8). Closing with × = Done (transcription continues).

**Identify speakers prompt** (after transcription, if more than one speaker): toast-style card bottom-centre of the script (w384 h56): "Multiple speakers detected in <file>" + `Identify speakers` ghost button + ×. Opens the **Identify speakers** modal w448: "Clip 1 of N" (14/600 centred), 16:9 preview w256 with play, filename 12 muted, "Who's speaking?" row with name combobox (flex) + `Next clip` primary h32.

**Activity card** — header "Activity" 13/600 + chevron; rows h40: spinner 14 / check / ⚠, "Transcribing Brian_SR.mp4" 12/500, % right `font-mono` 12 muted; hover shows trash ghost 24 (cancel).

**Script while importing** — a placeholder paragraph row h32 `bg-muted r6` with the filename left and "Transcribing… 0%" right (ref `03`).

### 2.5 States, empty, loading, error
- Dropzone hover `bg-accent/30`; drag-over `border-primary bg-primary/5` + label "Drop to add"; invalid type: border `destructive` + "That file type isn't supported" for 2 s.
- Upload progress: Activity row % + 2 px bar along the row bottom `bg-primary`.
- Errors: row turns `text-destructive` with `TriangleAlert` + "Failed · Retry" link; toast "Couldn't import Brian_SR.mp4 — Retry".
- File menu path (top bar ☰ → File ▸ New ▸ Composition / Project) must also exist (ref `02_creating_a_new_project_from_the_file_men…`).

### 2.6 Focus order
Title → dropzone → 4 buttons (row-major) → transport. Dialog traps focus: file row controls → language → checkbox → Done; Esc closes.

### 2.7 Below 1280
Column w = min(736, card − 64). <1100 the action buttons become one column (4 rows). <768: "Editing needs a larger screen", but Upload still works from Home.

### 2.8 Transovo
- Add a fifth action, first in the grid and full width: **`✨ Make clips from a long video`** (h44, `PrimaryButton`) → uploads, then runs the clipper; the project opens on the "Full video" composition with the Project panel showing generated clip compositions (§27).
- Drop on Home creates the project and opens it directly in this state with the upload running.
- Language list uses Transovo's transcription languages; "Speaker name" defaults to the workspace's saved speakers.

---

## 3. Editor shell — top bar, menus, right rail, script, canvas, side panel, timeline, view modes

**References** (25 images): `surfaces/03_editor_shell/01_a_screenshot_of_the_editor_in_descript.png`, `surfaces/03_editor_shell/01_descript_main_editor_labeled.png`, `surfaces/03_editor_shell/02_dragging_the_border_between_editor_panel.png`, `surfaces/03_editor_shell/03_descript_timeline_expanded.png`, `surfaces/03_editor_shell/03_view_menu_open_to_scene_editor_placement.png`, `surfaces/03_editor_shell/04_descript_timeline_anatomy_labeled.png`, `surfaces/03_editor_shell/04_view_menu_dropdown_in_the_descript_edito.png`, `surfaces/03_editor_shell/05_comments_icon_in_the_top_app_bar_used_to.png`, `surfaces/03_editor_shell/06_the_search_actions_toolbar_in_descript_s.png`, `surfaces/03_editor_shell/07_the_transport_bar_at_the_top_of_the_time.png`, `surfaces/03_editor_shell/08_the_playback_speed_menu_showing_speed_op.png`, `surfaces/03_editor_shell/09_the_playhead_shown_in_the_script_editor.png`, `surfaces/03_editor_shell/10_write_mode_enabled_with_a_blue_border_ar.png`, `surfaces/03_editor_shell/11_keyboard_shortcuts_menu_in_descript.png`, `surfaces/03_editor_shell/12_timeline_settings_in_the_view_menu.png`, `surfaces/03_editor_shell/13_advanced_timeline_tools_in_the_toolbar.png`, `surfaces/03_editor_shell/14_descript_underlord_panel_resize_handles.png`, `surfaces/03_editor_shell/14_vu_meter_in_the_timeline_toolbar.png`, `surfaces/03_editor_shell/15_click_the_resize_handle_above_the_transp.png`, `surfaces/03_editor_shell/16_fully_expanded_descript_timeline_with_mu.png`, `surfaces/03_editor_shell/17_zoom_and_fit_controls_in_descript_timeli.png`, `surfaces/03_editor_shell/18_diagram_showing_timeline_elements_includ.png`, `surfaces/03_editor_shell/19_advanced_timeline_tools_in_descript_show.png`, `surfaces/03_editor_shell/20_image_of_the_split_button_in_the_descrip.png`, `surfaces/03_editor_shell/90_dark_theme_reference_2022.png`
Masters: `16_fully_expanded_descript_timeline_with_mu.png` (1512×823 css, every timeline lane), `03_view_menu_open_to_scene_editor_placement.png` (Stacked placement + View ▸ Scene editor submenu), `04_view_menu_dropdown…` (Side-by-side), `21_recording_editor_screen/18_async_record_menu.png` (chrome with no panel open), `19_advanced_timeline_tools…` (tool picker), `90_dark_theme_reference_2022.png` (same regions in a dark theme).

### 3.1 Wireframe — Side-by-side, side panel open, timeline collapsed (1440×900)
```
x:0 8                                       1024 1032          1352 1360   1440
y:0 ┌───────────────────────────────────────────────────────────────────────────┐
    │⌂ ☰ [▭ View ▾] ↶ ✓         👥 Personal / Episode 12 ▾       ∿ (+👤👤) 💬 [Export] ?│ 48
y:48│┌ main card r12 ────────────────────────────────┐┌ side panel r12 ┐┌ rail 80 ┐│
    ││ script pane 45 %              ┆ canvas pane    ││ Properties   × ││ 📁Project││
    ││                 [✎ Write] [▭] ┆                ││ ───────────── ││ ✦AI tools││
    ││ Episode 12 (22/600)           ┆   ┌────────┐   ││ (panel body,  ││ ⚙Propert.││
    ││ Speaker 1 (13/600 speaker-1)  ┆   │ 16:9   │   ││  §6/7/11/15/16││ ⊞Elements││
    ││ ▣ Hi everyone, I'm…  16/1.6   ┆   │ canvas │   ││  scrolls)     ││ ㏄Captions││
    ││                               ┆   └────────┘   ││               ││ ▤Media   ││
    ││                               ┆ [Layout|Background ●|≋]        ││          ││
    ││ ───────────── ═══ (timeline resize handle, 32×4 grip) ──────────││          ││
    ││ «  »  ☰  0:20.5 / 0:43.5   ●Record ▶ 1x ⧉Split  − 116% + ↖▾ ▭ ▤ ▦││ ✦AI Prod.││ 44
y:892│└───────────────────────────────────────────────┘└───────────────┘└─────────┘│
    └───────────────────────────────────────────────────────────────────────────┘
```
Timeline expanded (drag the handle up, or click ▤): the bottom of the main card becomes
```
    ││ transport row 44 (same controls)                                         ││
    ││ ruler 28   0:00   0:05   0:10 …                    (playhead ▼ + 1 px line) ││
    ││ scenes 36  [1 ▣][2 ▣][3 ▣]   numbered scene thumbnails                     ││
    ││ layer lanes 36 each: [▣ broll.mp4      ] [T Title          ]                ││
    ││ text/caption rows 24 each                                                    ││
    ││ word bar 24: [Hi][everyone,][I'm][Tifa.]                                     ││
    ││ script track 112: waveform (voice lane)                                      ││
    ││ [+ add track] 28                                                            ││
```

### 3.2 Regions (all inside the 1440×900 or 1280×800 viewport)
| Region | 1440×900 | 1280×800 | Min / max | Resizable |
|---|---|---|---|---|
| Top bar | 0,0 → 1440×48 | 1280×48 | fixed | no |
| Main card (panel open) | x8–1024 (w1016), y48–892 (h844), r12 | x8–864 (w856), y48–792 | min w 720 (else panel overlays) | width = viewport − 8 − 8 − panel − 8 − 80 |
| Main card (panel closed) | x8–1352 (w1344) | x8–1192 (w1184) | — | — |
| Side panel card | x1032–1352 (w320), y48–892, r12 | x872–1192 (w320) | 280–480 | yes, left edge drag (8 px hit) |
| Right rail | x1360–1440 (w80), y48–900, no card | x1200–1280 | fixed 80 | no |
| Script pane (side-by-side) | 45 % of card = 457 (panel open) / 605 (closed) | 385 / 533 | min 360 | yes, divider drag |
| Canvas pane | remainder: 558 / 738 | 470 / 650 | min 320 | yes |
| Script text column | max-w 720, centred in script pane, padding 32 left/right, 24 top | same | — | — |
| Canvas stage | aspect-fit inside pane with 24 padding, max 100 % | — | — | — |
| Canvas pill (Layout / Background / Layers) | h32, centred, 12 below stage | same | — | — |
| Timeline (collapsed) | transport 44 + 4 px scrub line above | same | — | — |
| Timeline (expanded) | default 280 including transport | 240 | min 160, max 60 % of card h | yes, handle drag; double-click toggles |
| Transport row | h44 | h44 | fixed | no |
| Ruler | h28 | h28 | — | — |
| Scene strip | h36 (thumbs 48×28 r4 + number) | h36 | — | — |
| Layer lane | h36 | h36 | — | — |
| Text/caption row | h24 | h24 | — | — |
| Word bar | h24 (chips 20 tall, 12 px text) | h24 | — | — |
| Script track | h112 | h96 | 64–200 | yes, lane bottom edge |
| Track header column (multitrack only) | w120 | w120 | — | — |

Stacked placement: canvas pane on top (height 50 % of the space above the timeline, min 240), 1 px divider with 32×4 grip, script below. Full-screen video placement: script hidden, canvas fills the card; script pane opens again from View ▸ Script ▸ Show script (⌥⌘S).

### 3.3 Components, in order
**Top bar left → right** (all ghost, h28, icon 18, gap 4; group gap 12)
1. `House` — "Back to Drive" (Transovo: "Back to project" when inside a clip composition, see §3.8).
2. `Menu` — app menu: File ▸, Edit ▸, Insert ▸, Tools ▸, Help ▸ (§3.5).
3. `View ▾` — button with `PanelLeft` 16 + "View" 13 + chevron 12; h28 px8 r8; open state `bg-accent`.
4. `Undo2` — disabled when nothing to undo (Redo lives in Edit menu + ⇧⌘Z).
5. Save state — `CircleCheck` 16 (saved) / `Loader2` spin (saving) / `CloudOff` warning (offline, tooltip "You're offline. Changes will sync when you're back.").
6. Centre breadcrumb (absolute centre of the viewport, max-w 560, truncates middle): workspace icon 14 + "Personal" (muted link) / project name (13/500) ▾ (opens the composition switcher = §27 compositions list, w288) .
7. Right: `AudioLines` VU-meter button (opens 2-channel meter popover, §13), collaborator stack ("+" circle 28 then up to 3 avatars 24, −8 overlap; click = Share §17), `MessageSquare` comments (§16, badge count dot), **`Export`** h32 px12 r8 (primary CTA → §18), `CircleHelp`.

**Right rail top → bottom**: item 72×60 r10 (icon 18 above label 10/500, gap 4), 12 gap between items: **Project** (`Folder`) §27 · **AI tools** (`Sparkles`) §15 · **Properties** (`SlidersHorizontal`) §7 · **Elements** (`Shapes`) §10 · **Captions** (`Captions`) §6 · **Media** (`Clapperboard`) §11 · (spacer) · **AI Producer** pinned bottom 12 from the edge. Click toggles that panel in the side-panel card; clicking the active item closes the card. Active = `bg-accent text-accent-foreground`; hover `bg-accent/60`. Tooltip = label + shortcut.

**Script pane header** (h40, right-aligned, inset 12): `PenLine` "Write" toggle (ghost h28; on = `bg-primary/15 text-primary` and a 2 px `ring-primary/60` around the script pane, ref `10_write_mode…`); in Side-by-side also `RectangleHorizontal` aspect/canvas toggle at the canvas pane's top-left.

**Canvas pane**: stage (black letterbox `bg-black/60` outside the composition); selection outlines §10; floating pill under the stage: `Layout` (opens §9 layout picker) | `Background ●` (colour swatch 14 round) | `Layers` icon (opens layer list §7).

**Transport (left → centre → right)** — all h28:
- Left: `ChevronsLeft` (previous scene/marker, tooltip "Previous ⇧←"), `ChevronsRight`, `ListVideo` chapters list (§14), timecode `font-mono text-xs tabular-nums` "0:20.5 / 0:43.5" (current in `text-foreground`, total muted).
- Centre (absolute centre of the card): `Record` (8 px red dot + "Record" 13) → §21; `Play` 16 (Space; becomes `Pause`); speed "1x" text button → menu 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x (ref `08_…speed…`); `SquareSplitHorizontal` "Split" (S).
- Right: `Minus` / "116%" (`font-mono text-xs`, click = fit) / `Plus` timeline zoom (ref `17_zoom…`); tool picker `MousePointer2 ▾` → menu w176: Select A, Hand H, Blade B, Range R, Slip Y (✓ on current, shortcut right in muted mono); view toggle segmented (h28, 2 × 32 wide): `Rows3` Timeline view / `LayoutGrid` Storyboard view (§8). In collapsed state an extra `PanelBottom` button expands the timeline.

**Timeline body** (expanded): ruler labels 11 px mono muted every 1/5/10/30 s depending on zoom; scene strip; lanes per layer type (colour per §0.2), clip bar r6 with 12 px icon + filename 11 px; fade handles at clip corners (8×8); playhead 1 px `bg-primary` through all rows with a 10×12 head on the ruler; word bar chips `bg-muted text-[11px] r4`; script track waveform `fill-lane-voice/70`.

### 3.4 View menu (w232, items h32)
`Script ▸` (Show/Hide script ⌥⌘S; Script options: Show wordless media, Show markers, Speaker labels on every paragraph; Text size S / M / L) · `Scene editor ▸` (Hide scene editor ⌥⌘V; header "Scene editor placement"; Full-screen video ⌘.; Stacked; Side-by-side — disabled with tooltip "Window is too narrow" below 1100; divider; Snap to guides ⇧⌘') · `Timeline ▸` (Show timeline ⌥⌘T; Timeline view / Storyboard view; Show waveforms; Show word bar; Show volume in dB) · `Panels ▸` (one row per rail panel with its shortcut; "Hide all panels ⌘\") · `Appearance ▸` (Dark / Light / System) · divider · "Show volume in decibels" (check).
Submenus open to the right, w232; group headers 11 px uppercase muted; checks 14 at left in a 20 gutter; shortcuts right, `font-mono text-[11px] text-muted-foreground`.

### 3.5 App menu (☰)
File ▸ (New ▸ Project ⌘N / Composition; Import… ⌘⇧I; Export… ⌘E; Project settings; Duplicate project; Version history §19; Move to trash) · Edit ▸ (Undo, Redo, Cut, Copy, Paste, Select all, Find ⌘F, Find and replace ⌥⌘F) · Insert ▸ (Marker M, Scene /, Text, Shape, Media…) · Tools ▸ (Studio Sound, Remove filler words, Shorten word gaps, Remove retakes, Transcribe, Detect speakers) · Help ▸ (Keyboard shortcuts ⌘/, Help center, What's new). Menu w240.

### 3.6 States
- Panel open/close animates width 200 ms ease-out; main card reflows (no overlap) at ≥1280.
- Divider/handle hover: 1 px line → `bg-primary`, cursor resize; while dragging show live px in a 11 px mono tooltip.
- Playback: Play icon → Pause; script shows the playhead caret (2 px `bg-primary` beside the current word) and auto-scroll (ref `09_the_playhead…`).
- Disabled transport buttons (no media) `opacity-50`.
- Offline: top-bar save icon state + toast once.

### 3.7 Empty / loading / error
- Empty project → §2 empty state replaces script + canvas.
- Loading project: top bar renders immediately; script pane shows 8 skeleton lines (widths 90/75/85/60 %), canvas a 16:9 `bg-muted` block, timeline a 44 transport with disabled controls.
- Media offline / proxy missing: canvas shows a 16:9 `bg-muted` block with `ImageOff` 24 + "Media is still processing" (or "Media missing — Relink").
- Fatal load error: centred card w400 "This project couldn't be opened" + Reload + Back to Library.

### 3.8 Keyboard focus order
Top bar (left → right) → script pane (Write toggle → script text) → canvas (stage → pill buttons) → transport (left → right) → timeline lanes (↑/↓ lanes, ←/→ clips) → side panel (header → body) → rail (↑/↓ between items). F6 cycles regions in that order; Shift+F6 reverses. Esc in a popover returns focus to its trigger.

### 3.9 Below 1280
- 1100–1279: side panel floats over the main card's right edge (x = viewport − 80 − 320 − 8), `shadow-lg`, main card keeps full width.
- 768–1099: Stacked placement forced (Side-by-side disabled with "Window is too narrow"); timeline collapsed by default; rail labels hidden (icon-only, item 56×44, rail w64).
- <768: "Editing needs a larger screen" card.

### 3.10 Transovo
- Breadcrumb: `Library / <Project> / <Composition ▾>`; for a clip composition the last crumb shows a `Scissors` 14 + clip name + score ring 20, and the top bar's House button becomes **← Back to project** (opens "Full video").
- Script pane header gets **Show surrounding transcript** (switch, h28, label 12) for clip compositions: off = only the clip's words; on = the source's words before/after rendered `text-muted-foreground/50` with a 1 px dashed `border-primary/50` line at the clip in/out points, draggable to extend/trim the clip.
- Rail: replaces "Underlord" with **AI Producer** (sparkle in `bg-brand-gradient` tile 24). Transovo adds **Brand** (`Palette`, brand kit: logo, colours, fonts, caption defaults) between Captions and Media. The 9 tabs of the old 400 px aside map to: producer → AI Producer, transcript → script pane, layout → Layout pill §9, captions → Captions, broll → Media, audio → Properties ▸ Audio, thumbnail → Export ▸ Thumbnail, dub → AI tools ▸ Translate, brand → Brand.
- Export button uses `PrimaryButton` (brand gradient) — it is the editor's only gradient CTA.
- `script-editor.md` §A says rail 56. **This doc supersedes it: rail is 80 with labels** (Descript measured 80–88 css px); 64 icon-only below 1100.

---

## 4. Script: selection toolbar, context menus, hover states, speakers, word colours

**References** (27 images): `surfaces/04_script_context_hover/01_script_editor_with_text_highlighted_befo.png`, `surfaces/04_script_context_hover/02_ignoring_text_in_the_script_editor.png`, `surfaces/04_script_context_hover/03_hover_menu_over_ignored_text_showing_res.png`, `surfaces/04_script_context_hover/04_highlighting_text_using_the_selection_to.png`, `surfaces/04_script_context_hover/05_clearing_a_highlight_from_text.png`, `surfaces/04_script_context_hover/06_convert_to_audio_option_in_the_script_ho.png`, `surfaces/04_script_context_hover/07_regenerate_option_on_edit_point_hover.png`, `surfaces/04_script_context_hover/08_regenerate_edit_boundary.png`, `surfaces/04_script_context_hover/09_descript_ignored_text_hover.png`, `surfaces/04_script_context_hover/09_the_view_menu_expanded_to_show_the_scrip.png`, `surfaces/04_script_context_hover/10_descript_speaker_rename.png`, `surfaces/04_script_context_hover/10_screenshot_of_the_descript_selection_too.png`, `surfaces/04_script_context_hover/11_example_of_wordless_media_in_the_script.png`, `surfaces/04_script_context_hover/12_right_click_menu_showing_edit_label_opti.png`, `surfaces/04_script_context_hover/13_speaker_label_move.png`, `surfaces/04_script_context_hover/14_speaker_label_rename_1.png`, `surfaces/04_script_context_hover/15_speaker_label_change_color.png`, `surfaces/04_script_context_hover/16_red_underline_in_the_descript_script_ind.png`, `surfaces/04_script_context_hover/17_descript_editor_message_with_fix_button.png`, `surfaces/04_script_context_hover/18_light_blue_text_is_placeholder_text_or_g.png`, `surfaces/04_script_context_hover/19_pulsing_dark_blue_text_is_ai_speech_that.png`, `surfaces/04_script_context_hover/20_dark_blue_text_is_ai_speech_that_has_bee.png`, `surfaces/04_script_context_hover/21_black_text_is_ai_speech_that_has_been_co.png`, `surfaces/04_script_context_hover/22_black_text_with_an_orange_underline_is_a.png`, `surfaces/04_script_context_hover/23_search_options_menu.png`, `surfaces/04_script_context_hover/24_find_and_dropdown_open_with_options_disp.png`, `surfaces/04_script_context_hover/25_color_filter_dropdown_for_highlights_in.png`
Masters: `10_screenshot_of_the_descript_selection_too.png` (selection toolbar + word-count meta), `12_right_click_menu_showing_edit_label_opti.png` (context menu + Edit label popover), `07_regenerate_option_on_edit_point_hover.png` (edit-point hover), `03_hover_menu_over_ignored_text…`, `14/15_speaker_label…`, `18–22_…` (AI-speech colour states).

### 4.1 Wireframe
```
                                      3w │ 0.72s      ✎ Write        ← script header meta (12 muted mono)
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ ✦ │ Change layout │ ≋+ │ Correct │ Regenerate │ S̶ ▾ │ B │ I │ ● ▾ │ ⊕▭ │ 💬 │ ⋯ │  h32, floats 8 above the selection
  └──────────────────────────────────────────────────────────────────────────────┘
  ▣ Your [jump cuts make] me want to jump into a ▣ wood chipper. Your punch ins…
           └ selection bg-primary/25              └ ignored: muted + line-through

  Right-click on words                     Edit-point hover (cut between words)
  ┌──────────────────────────────┐         ┌───────────────────┐
  │ Change speaker…            @ │         │ ✦ Regenerate │ ▾ │  h32, above the ┆ marker
  │ Edit label…                  │         └───────────────────┘
  │ Add scene                  / │
  │ ──────────────────────────── │
  │ Play                  ⌥Click │
  │ Preview selection    ⇧⌘Space │
  │ ──────────────────────────── │
  │ Edit word gap              ▸ │
  │ ──────────────────────────── │
  │ Cut ⌘X · Copy ⌘C · Paste ⌘V  │ (one per row)
  │ Paste special              ▸ │
  │ Duplicate to…              ▸ │
  │ Delete                       │
  │ ──────────────────────────── │
  │ Restore removed media  ⇧⌘⌫  │ (disabled unless applicable)
  │ ──────────────────────────── │
  │ View media             ⇧⌘O  │
  └──────────────────────────────┘ w240, items h32
```

### 4.2 Regions / sizes
| Element | Size | Position |
|---|---|---|
| Selection toolbar | h32, auto width (≈592 with all items), r8, `bg-popover shadow-lg border` | 8 above the first selected line, left-aligned to the selection start, clamped 8 inside the script pane; flips below if < 48 from the pane top |
| Toolbar items | text items px10 h32 13 px; icon items 32×32; 1 px `border-border` separators full height | — |
| Word-count meta | 12 px mono muted "3w │ 0.72s" | script header, left of Write, only while a selection exists |
| Context menu | w240, item h32, px8, separators 1 px with 4 px vertical margin | at the pointer, flips at edges |
| Edit label popover | w260, header h40 "Edit label" + × ; body: input h32 (flex) + `Save` ghost | above the selected gap |
| Edit-point hover | split button h32: "✦ Regenerate" + chevron 28 | 8 above the ┆ cut marker (marker: 2×16 `bg-primary/60` dashed) |
| Ignored-text hover | pill h28 with `Restore` and `Delete` ghost buttons (12 px) | 4 above the ignored run |
| Speaker label popover | w240, input h32 + list rows h32 | under the label |

### 4.3 Selection toolbar items (left → right)
1. `Sparkles` AI Producer — opens AI Producer with the selection as context. Tooltip "Ask AI Producer".
2. **Change layout** — opens §9 layout picker for the scene(s) containing the selection.
3. `Layers` + plus — "Add layer to selection" menu (Media, Text, Captions, Shape, Placeholder) — anchors the new layer to these words.
4. **Correct** (C) — enters word-correction (edits transcript text only).
5. **Regenerate** — AI speech regenerate for the selection.
6. `Strikethrough` + ▾ — Ignore (default click); menu: Ignore, Delete, Remove from transcript, Delete and replace with gap.
7. `Bold` (⌘B), 8. `Italic` (⌘I) — script formatting.
9. Highlight colour swatch 16 round + ▾ — menu of 12 swatches in a 6×2 grid (Yellow, Red, Orange, Green, Blue, Purple, Pink, Magenta, Lime, Seafoam, Lavender, Gray) + "Clear highlight". In Transovo the swatches are `oklch` values with 35 % alpha over the dark background.
10. `FilePlus2` "Add scene" (/).
11. `MessageSquare` "Comment" (⌥⌘M) → §16.
12. `MoreHorizontal` — overflow: Copy, Copy with timecodes, Add marker, Convert to audio (AI speech), Duplicate to…, Remove filler words in selection.

### 4.4 Word & paragraph visual states
| State | Visual (Transovo tokens) |
|---|---|
| Normal word | `text-foreground` |
| Hover word (Select tool) | `bg-accent/50 rounded-sm` |
| Selected | `bg-primary/25` (2 px rounded corners at run ends) |
| Playing word | 2 px caret `bg-primary` before the word; word `text-primary` |
| Filler word / long gap | `underline decoration-dotted decoration-info underline-offset-4`; gaps render as "·····" 12 px `text-info/80` (one dot per 0.2 s, max 12) |
| Ignored | `text-muted-foreground/60 line-through`; hover pill Restore / Delete |
| Highlighted | `bg-[color]/35 rounded-sm`; with "Highlight filter" in Find menu |
| Bold / italic | `font-semibold` / `italic` |
| Edit point (cut) | 2×16 `border-l-2 border-dashed border-primary/60`; hover shows Regenerate |
| Wordless media | 20×20 r4 thumbnail chip inline + filename 13 muted, or "♫" for audio |
| Inline media thumb (scene start) | 28×20 r4 thumb at the scene's first word; click = select scene |
| Marker | 28×28 r6 `bg-foreground` square + label 14/600 on its own line (§14) |
| AI speech — placeholder | `text-info/60` |
| AI speech — generating | `text-info animate-pulse` |
| AI speech — generated | `text-info` |
| AI speech — converted to audio | `text-foreground` |
| AI speech — failed | `text-foreground` + `underline decoration-wavy decoration-destructive` |
| Transcript issue (duplicate transcription etc.) | toast "This file was transcribed twice. Fix" |

### 4.5 Speakers
- Label line above a paragraph: 13/600 `text-speaker-N`, h24, hover `bg-accent/50 r4 px4`. Click → popover: search/rename input "Speaker name", list of speakers (dot 8 + name), "Create speaker", "Rename speaker". Right-click → Assign colour (9 swatches: Transovo maps to speaker-1…6 + 3 neutrals).
- Drag a label up/down a line to move the boundary (ref `13_speaker_label_move`): ghost of the label follows the pointer, a 2 px `bg-primary` insertion line shows the drop point.

### 4.6 States, empty, error
- Toolbar appears 120 ms after mouse-up, fades 100 ms; hides while typing in Write mode; disabled items `opacity-50` with tooltip reason (e.g. Regenerate: "Select up to 1,000 words").
- Context menu disabled rows muted; submenus open right on hover (150 ms delay).
- Empty script: placeholder "Start typing, or drop media here" 16 muted at the first line.
- Errors from Regenerate/Correct: inline toast with Retry.

### 4.7 Focus order
Selection with keyboard (⇧+arrows) shows the toolbar; Tab moves into it (left → right), Esc returns to the text with the selection intact. Context menu opens with Shift+F10 / the Menu key; ↑/↓ moves, → opens submenus.

### 4.8 Below 1280
Toolbar collapses Bold/Italic/highlight/Add scene into ⋯ when the script pane is < 520 wide (order of collapse: Add scene, highlight, Italic, Bold, Regenerate).

### 4.9 Transovo
- Item 1 is AI Producer; "Regenerate" and AI speech colours ship only if the dub/voice feature is on (otherwise hide items 5 and the AI-speech states).
- Add **"Make clip from selection"** (`Scissors` 16, label "Clip") right after Change layout: creates a `kind:'clip'` composition from the selected words and opens it.
- In a clip composition with "Show surrounding transcript" on, words outside the clip are not selectable for editing; hovering them shows "Outside this clip — drag the clip edge to include".

---

## 5. Filler-word & gap review bar (Find and…), search results

**References** (10 images): `surfaces/05_filler_gap_review/01_the_filler_word_removal_window_with_a_dr.png`, `surfaces/05_filler_gap_review/02_remove_filler_words_window_with_avoid_ha.png`, `surfaces/05_filler_gap_review/03_ai_actions_panel_in_descript_showing_the.png`, `surfaces/05_filler_gap_review/04_search_panel_in_descript_with_word_gap_s.png`, `surfaces/05_filler_gap_review/05_search_panel_with_word_gap_shorten_and_s.png`, `surfaces/05_filler_gap_review/06_adjusting_word_gaps_from_the_script_edit.png`, `surfaces/05_filler_gap_review/07_dragging_a_word_in_the_wordbar_to_adjust.png`, `surfaces/05_filler_gap_review/08_descript_filler_words_remove.png`, `surfaces/05_filler_gap_review/08_using_the_range_tool_to_remove_space_bet.png`, `surfaces/05_filler_gap_review/09_using_the_blade_tool_to_adjust_spacing_b.png`
Masters: `02_remove_filler_words_window_with_avoid_ha.png` (1× crop, the bar at native size), `04/05_search_panel…word_gap…` (results list in the side panel), `07_dragging_a_word_in_the_wordbar…`.

### 5.1 Wireframe (bar floats at the top-left of the script pane)
```
 ┌──────────────────────────────────────────────────────────────────┐  w ≈ 488, r12, bg-popover, shadow-lg
 │ ⌕▾  All filler words                 0/15   ˄   ˅   ⚙   ○   ×   │  row 1 h40
 │ ─────────────────────────────────────────────────────────────── │  1 px divider, inset 12
 │ 🗑  [Delete        ▾]  (◐ Avoid harsh cuts)   Remove   Remove all │  row 2 h44
 └──────────────────────────────────────────────────────────────────┘
        tooltip: "Keeps filler words if cutting them would sound unnatural"
 Gaps variant row 2:  ⏱ [Shorten to  1  seconds ▾]           Shorten   Shorten all
```
Side panel "Search results" (w320) lists every match:
```
 Search results            12 ×
 ┌────────────────────────────┐
 │ …so um [5.4] we went…  0:12│  row h56 (2 lines, 12 px), current row ring-1 ring-primary
 └────────────────────────────┘
```

### 5.2 Regions
| Element | 1440×900 | 1280×800 | Notes |
|---|---|---|---|
| Find bar | x = script pane left + 16, y = script pane top + 8; w488 | w = min(488, pane − 32) | sticks while scrolling; pushes script content down by 0 (overlays, with 96 px top padding added to the script while open) |
| Row 1 | h40, px12 | same | query field flex, count `font-mono text-xs` w48 right-aligned |
| Row 2 | h44, px12 | same | action select w128 h32 |
| Results panel | side panel card, w320 | w280 | header h48; list rows h56 |

### 5.3 Components, in order
Row 1: (1) `Search` 16 + ▾ mode menu — **Find** (⌘F), divider, **Find and…** Remove filler words, Shorten word gaps, Correct transcript, Remove media, Copy; (2) query input 13 px (preset values "All filler words", "Gaps more than 3s", or free text) — clicking a preset opens a chip menu of the filler list (um, uh, like, you know, so, I mean, sort of, kind of, basically, actually, right, okay + custom); (3) match count "0/15"; (4) `ChevronUp` previous (⇧Enter), (5) `ChevronDown` next (Enter); (6) `SlidersHorizontal` options popover (w240, checkbox rows h32): Auto-advance, Preview results, Match whole words, Match case, Wrap around, Only current composition, + "Highlight colour ▾" filter; (7) speaker filter dot (`Circle` 16; menu of speakers); (8) `X` close (Esc).
Row 2 (filler): (1) `Trash2` icon (action icon follows the select); (2) action select — Delete · Delete and replace with gap · Ignore · Remove from transcript; (3) switch **Avoid harsh cuts** (h20 switch + 12 px label, tooltip as drawn); (4) `Remove` ghost (current match only; disabled at 0 matches); (5) `Remove all` ghost semibold.
Row 2 (gaps): `Timer` icon; "Shorten to [1] seconds" (number input w48 h32, step 0.1, min 0.1); `Shorten`; `Shorten all`.

### 5.4 States
- Matches in the script: current `bg-primary/35 ring-1 ring-primary rounded-sm`, others `bg-primary/15`. Count updates live.
- Preview results (on): each removal previews with a 1 s pre-roll when stepping.
- After "Remove all": toast "Removed 15 filler words · Undo" (6 s).
- 0 matches: count "0/0" muted, Remove/Remove all disabled, a 12 px line under the bar "No filler words found".
- Loading (transcript still processing): spinner instead of count, actions disabled, tooltip "Waiting for transcription".
- Error (job failed): row 2 replaced with `text-destructive text-xs` "Couldn't apply changes. Try again" + retry.

### 5.5 Focus order
Mode menu → query → prev → next → options → speaker → close → action select → Avoid harsh cuts → Remove → Remove all. Enter in the query = next; ⌘Enter = Remove all (confirm toast with Undo, no modal).

### 5.6 Below 1280
Bar shrinks to the pane width − 32; below 440 the switch label shortens to "Avoid harsh" with the full text in the tooltip, and "Remove all" stays visible while "Remove" moves into the action select menu.

### 5.7 Transovo
Also reachable from AI tools ▸ "Remove filler words" / "Shorten word gaps" (§15) and from AI Producer suggestions ("I found 15 filler words · Review"). In a clip composition the search scope defaults to "Only current composition" = on.

---

## 6. Captions panel

**References** (7 images): `surfaces/06_captions_panel/01_captions_panel_showing_available_presets.png`, `surfaces/06_captions_panel/02_speaker_dropdown_for_a_captions_layer_in.png`, `surfaces/06_captions_panel/03_preview_translated_captions_in_descript.png`, `surfaces/06_captions_panel/04_captions_displayed_in_the_rooms_interfac.png`, `surfaces/06_captions_panel/05_edit_and_correct_translated_captions_dir.png`, `surfaces/06_captions_panel/07_descript_scene_editor_layout.png`, `surfaces/06_captions_panel/11_descript_captions_panel.png`
Masters: `01_captions_panel_showing_available_presets.png` (1738 px 1× crop), `11_descript_captions_panel.png`, `02_speaker_dropdown_for_a_captions_layer…`, `03/05_…translated captions…`.

### 6.1 Wireframe (side panel card, w320)
```
 ┌ Captions                         ⚲ ×┐  header h48 (filter icon, close)
 │ [⌕ Search captions              ]   │  h32, mx12
 │ Apply to  [Current scene|All scenes]│  label 12 muted + segmented h32
 │ ┌───────────────────────────────┐  │
 │ │      Tell your story           │  │  preset tile h64 r10 bg-surface-raised (live preview text)
 │ └───────────────────────────────┘  │
 │  Plus Jakarta Sans   (12 muted)     │  label h20
 │ ┌───────────────────────────────┐  │
 │ │      TELL YOUR STORY           │  │
 │ └───────────────────────────────┘  │
 │  …                                   │  list scrolls; gap 12 between items
 └─────────────────────────────────────┘
 Filter popover (w256): Sort by [Default ▾] · Style chips (Default)(Basic)(Bold)(Fun)(Trend)(Legacy) · [Reset]
```
When a caption layer is selected the panel's lower half (or Properties §7 for that layer) shows **Caption style**: Font (select), Size (number), Weight, Case (Aa / AA toggle), Fill colour, Stroke, Shadow, Background box (toggle + colour + padding + radius), Position (Top / Middle / Bottom + Y offset), Words per line (1–8), Lines (1–3), Highlight current word (toggle + colour), Animation (select), Speaker (select: All speakers / Speaker N), Language (Original / translated).

### 6.2 Regions
| Element | Size | Notes |
|---|---|---|
| Panel | w320 (280–480), full card height | §3 side panel |
| Header | h48, px16, title 14/600 | icons ghost 28 |
| Search | h32 r8 `bg-muted` | filters preset list by name |
| Apply-to segmented | h32, two equal segments | label left, w = panel − 24 |
| Preset tile | w = panel − 24, h64, r10 | 1 column; text centred, rendered with the real preset (font, colour, stroke, box) on `bg-[oklch(0.3_0.02_275)]` with a faint image texture |
| Preset label | h20, 12 muted | font name in Descript; preset name in Transovo |
| Filter popover | w256, p12 | chips h28 r-full outline; selected `bg-accent` |

### 6.3 States
- Tile hover: `ring-1 ring-primary/40` + preview animates once (the preset's animation). Selected (applied): `ring-2 ring-primary` + check badge 16 top-right.
- Applying shows a 2 px progress line under the tile until the captions layer exists.
- Empty search: "No styles match "neon"" 12 muted + Reset.
- No transcript yet: panel body = `Captions` icon 24 + "Captions appear once transcription finishes" + spinner.
- Error: Alert "Couldn't load caption styles" + Retry.

### 6.4 Focus order
Filter → close → search → segmented (←/→) → tiles (↑/↓; Enter applies) → caption style controls top-down.

### 6.5 Below 1280
Panel 280: tiles keep full width (h56). Drawer mode at 1100–1279.

### 6.6 Transovo
- Preset list is Transovo's 10, in this order, labelled by preset name (not font): **Bold Pop, Clean White, Boxed, Karaoke, Minimal, Neon, Bounce, Typewriter, Slide Up, Highlighter**. Style filter chips become: All · Bold · Clean · Animated · Brand.
- Animation select lists: None, Pop, Bounce, Slide up, Typewriter, Karaoke fill, Glow.
- A **Brand** row pinned at the top when the workspace has a brand kit: "Brand captions" tile using brand fonts/colours, with "Edit in Brand" link.
- Apply to gains a third segment in clip compositions: **All clips** (applies to every `kind:'clip'` composition of the project; confirm toast with Undo).
- Captions preview on the canvas uses safe areas for 9:16 (bottom 20 % reserved for platform UI; shown as a dashed guide while dragging).

---

## 7. Properties panel — scene, layer, video, audio, effects, transitions, animation

**References** (28 images): `surfaces/07_properties_panel/01_image_of_descript_s_editor_interface_wit.png`, `surfaces/07_properties_panel/02_descript_properties_panel_script_layer.png`, `surfaces/07_properties_panel/02_the_layer_list_near_the_bottom_of_the_pr.png`, `surfaces/07_properties_panel/03_layer_level_view_in_the_properties_panel.png`, `surfaces/07_properties_panel/04_the_layer_properties_panel_in_descript_s.png`, `surfaces/07_properties_panel/05_the_current_scenes_all_scenes_toggle_in.png`, `surfaces/07_properties_panel/06_descript_scene_properties_layers_list.png`, `surfaces/07_properties_panel/06_layer_order_shown_in_the_layers_list_in.png`, `surfaces/07_properties_panel/07_numbered_diagram_of_scene_level_properti.png`, `surfaces/07_properties_panel/08_adding_an_audio_effect_from_the_properti.png`, `surfaces/07_properties_panel/09_removing_an_effect_from_the_properties_p.png`, `surfaces/07_properties_panel/10_properties_panel_in_descript_showing_the.png`, `surfaces/07_properties_panel/11_adjusting_audio_volume_in_properties_pan.png`, `surfaces/07_properties_panel/12_mute_option_in_properties_panel.png`, `surfaces/07_properties_panel/13_panning_audio_using_the_properties_panel.png`, `surfaces/07_properties_panel/14_color_preset_thumbnails_in_the_color_adj.png`, `surfaces/07_properties_panel/15_white_balance_picker_tool_in_the_color_a.png`, `surfaces/07_properties_panel/16_all_scenes_toggle_in_the_properties_pane.png`, `surfaces/07_properties_panel/17_transition_settings_options_in_descript.png`, `surfaces/07_properties_panel/18_a_text_layer_selected_in_the_scene_edito.png`, `surfaces/07_properties_panel/19_animation_button_in_hover_menu.png`, `surfaces/07_properties_panel/20_the_transitions_picker_grid_in_descript.png`, `surfaces/07_properties_panel/21_merging_two_clips_and_applying_a_crossfa.png`, `surfaces/07_properties_panel/22_adjust_clip_loop.png`, `surfaces/07_properties_panel/23_clip_speed_canvas.png`, `surfaces/07_properties_panel/24_how_to_access_audio_properties_in_descri.png`, `surfaces/07_properties_panel/25_custom_animation_keyframes_in_timeline.png`, `surfaces/07_properties_panel/26_edit_keyframes_in_timeline_button.png`
Masters: `04_the_layer_properties_panel…` (Script layer: header, Current/All scenes, Duration, Audio, Opacity, Size and position, Border, Audio effects + canvas floating toolbar), `07_numbered_diagram_of_scene_level_properti…` (scene level), `14/15_color…`, `17/20_transition…`, `25/26_…keyframes…`.

### 7.1 Wireframe (side panel w320; panel x1032–1352 at 1440)
```
 ┌ ←  Script                    🔊  S  ⋯ ┐  header h48: back (to scene props), layer name 14/600, mute, solo, menu
 │ [   Current scene   |   All scenes   ] │  segmented h32, m12
 │ ┌ Duration ─────────────────────────┐ │  section card r10 bg-surface-raised p12, gap 8 between cards
 │ │ [⏲ 1x        ] [⏱ 0:05.3        ] │ │  two fields h32
 │ └───────────────────────────────────┘ │
 │ ┌ Audio                          ⋯ ┐ │
 │ │ [100%] ───────────────●──  🔊     │ │  field w72 + slider flex + icon 28
 │ └───────────────────────────────────┘ │
 │ ┌ Opacity ───────────────────────────┐│
 │ │ [100%] ──────────────────●  👁     ││
 │ ┌ Size and position ─────────────────┐│
 │ │ X [960 ]   Y [540 ]                ││  2-col grid, field h32 w104, label prefix 11 muted inside
 │ │ W [1920]   H [1080]   (⛓)          ││  link toggle 28
 │ │ ∠ [0°  ]   ◜ [0   ]   (⤢ fit)      ││  rotation, corner radius, fit/fill menu
 │ ┌ Border                          + ┐ │  collapsed section (header only, h44)
 │ ┌ Audio effects                   + ┐ │
 │ │ Studio Sound            (◐)  ⚙    │ │  row h32: label, switch, settings icon
 │ │ Lower audio of other layers (○) ⚙ │ │
 │ ┌ Color adjustments               + ┐ │
 │ ┌ Effects                         + ┐ │
 │ ┌ Transitions  In ▭  Out ▭           ┐│
 │ ┌ Animation                       + ┐ │
 └────────────────────────────────────────┘ body scrolls; header + segmented stay sticky
```
Canvas floating layer toolbar (over the selected layer, 8 above its top edge, centred on it):
`Position | ⧉ shape crop | ↻ replace | ⌗ crop | 130% | ⇆ flip | ⇋ | Effects | Animation | ⋯` — h32 r8 `bg-popover shadow-lg`, text items px8 12 px, icon items 28. Under the stage while a layer is selected: pill "Selected in [Current scene | All scenes]" h28.

### 7.2 Panel levels and their sections (top → bottom)
| Level (what is selected) | Header | Sections in order |
|---|---|---|
| Nothing (scene) | "Scene N" + ⋯ | Layout (thumb 56×32 + layout name + "Save as new layout" ⋯) · Duration · Background (colour/image/blur) · Effects · Transitions (In / Out) · **Layers** list |
| Script / video layer | ← layer name, 🔊, S, ⋯ | Duration (speed, duration) · Audio (volume) · Opacity · Size and position · Border · Audio effects · Color adjustments · Effects · Transitions · Animation |
| Image layer | ← name | Duration · Opacity · Size and position · Border · Color adjustments · Effects · Transitions · Animation |
| Audio-only layer | ← name | Duration · Audio (volume, pan via ⋯ ▸ Advanced audio) · Audio effects · Fades (in / out ms) · Loop (Loop / Once) |
| Text layer | ← name | Text (font, weight, size, line height, letter spacing, align L/C/R, case, colour) · Background box · Opacity · Size and position · Effects (shadow, outline) · Transitions · Animation |
| Shape layer | ← name | Fill · Stroke (width, colour, dash) · Opacity · Size and position · Corner radius · Effects · Animation |
| Multiple layers | "N layers" | Align (6 buttons + distribute ↔/↕) · Opacity · common props only |

**Layers list** (scene level, ref `06_…layers_list`): rows h32: drag handle (hover) · type icon 14 · name 13 (double-click renames) · lock (hover) · eye; order = top layer first; selected `bg-accent`; drag reorders with a 2 px `bg-primary` drop line; "+ Add layer" ghost row at the bottom.

**Section card**: header h44 (title 13/600 left; right: `+` to add when empty, ⋯ menu, chevron to collapse); body p12 pt0, rows gap 8. Collapsed sections show only the header. A section with values shows a 6 px `bg-primary` dot after the title when it differs from the default.

**Controls**: numeric field h32 r8 `bg-muted` with prefix label/icon 11 muted, value `text-xs tabular-nums`, drag-to-scrub on the prefix (cursor ew-resize), arrow keys ±1 (⇧ ±10); slider track 4 px `bg-input`, fill `bg-primary`, thumb 14 white with `ring-1 ring-black/20`; switch h20 w36.

**Color adjustments**: preset row of 4 thumbs 64×40 r6 (None, Neutral, Warm, Cool; selected ring-2 primary) → sliders Saturation, Temperature, Tint, Exposure, Contrast, Highlights, Shadows (−100…100, label left 12, value right mono) + White balance eyedropper button.
**Transitions** (popover from In/Out or from a scene boundary, w296): header "Transitions" + options ⚙ + ×; grid 3 cols, tile 72×56 r8 + 11 px label (None, Smart transition, Blur, Clock wipe, Color dip, Cross-zoom, Crossfade, Double…, Flip, Slide, Push, Zoom…), selected `ring-2 ring-primary`; list max-h 240 scroll; params: Duration "⏱ 400ms" field w88, then per-type params (Blur amount 200px…); footer `Apply to all` outline full width h32.
**Animation**: + adds In / Out / Custom; presets list (Fade, Rise, Pop, Wipe, Typewriter for text) with duration; Custom opens keyframe lane in the timeline (`25_custom_animation_keyframes…`: diamonds 8×8 `bg-primary` rotate-45 on the layer's lane; "Edit keyframes" button).
**Audio effects**: `+` menu: Studio Sound, EQ, Compressor, Noise gate, Reverb, Lower audio of other layers, …; each row: name 13, switch, `SlidersHorizontal` opens a popover (Studio Sound: Intensity slider 0–100 %, default 80; Ducking: Amount −3…−30 dB, default −12), ⋯ (Remove, Move up/down).

### 7.3 States
- "All scenes" segment on: every edited value applies to the layer in all scenes; section header shows `Link2` 12 muted.
- Mixed values (multi-select): field shows "—" muted.
- Disabled (locked layer): all controls `opacity-50`; banner at the top "Layer is locked · Unlock" (h36 `bg-warning/10 text-warning`).
- Processing (Studio Sound): row shows `Loader2` + "Processing 42%".
- Empty (nothing in scene): Layers list "No layers in this scene" + Add layer.

### 7.4 Focus order
Back → mute → solo → ⋯ → segmented → each section header (Enter toggles collapse) → its controls left→right, top→bottom → next section. Canvas toolbar: Tab moves through it when a layer is selected and focus is on the canvas.

### 7.5 Below 1280
Panel 280: X/Y/W/H fields shrink to w92; Size and position stays 2-column. Drawer mode at 1100–1279. Canvas toolbar collapses Effects/Animation into ⋯ when the canvas pane < 480.

### 7.6 Transovo
- Transovo launch keeps Audio effects to Studio Sound, Auto-level and "Lower audio of other layers" (gap-matrix B10.5); EQ, Compressor, Noise gate and Reverb are Later (gap matrix line "EQ, compressor and the rest are Later") and are **hidden** from the `+` menu, following the global rule in §15.6.
- Add a **Brand** section at the end of Text layer props: "Use brand font / colour" toggles.
- For clipper compositions, Duration shows the clip in/out timecodes (`font-mono`) with "Trim in transcript" link instead of a free duration field.

---

## 8. Scenes & Storyboard view

**References** (12 images): `surfaces/08_scenes_storyboard/01_scene_indicaators_in_the_script_and_time.png`, `surfaces/08_scenes_storyboard/02_short_video_demo_moving_a_scene_boundary.png`, `surfaces/08_scenes_storyboard/03_short_video_demonstrating_the_reorder_sc.png`, `surfaces/08_scenes_storyboard/04_scene_editor_workspace.png`, `surfaces/08_scenes_storyboard/05_descript_scenes_script_and_timeline.png`, `surfaces/08_scenes_storyboard/05_scene_toolbar_in_the_scene_editor.png`, `surfaces/08_scenes_storyboard/06_scene_toolbar_options_in_descript.png`, `surfaces/08_scenes_storyboard/07_scene_with_smart_fill_enabled_in_the_sce.png`, `surfaces/08_scenes_storyboard/08_apply_all_scenes_toggle_from_the_scene_e.png`, `surfaces/08_scenes_storyboard/09_manually_extended_a_layer_across_scenes.png`, `surfaces/08_scenes_storyboard/90_descriptcom_2022_storyboard_darkmode.png`, `surfaces/08_scenes_storyboard/91_descriptcom_2022_storyboard_lightmode.png`
Masters: `01_scene_indicaators_in_the_script_and_time…` (scene separators in script + timeline), `03_short_video_demonstrating_the_reorder_sc…` (drag-reorder), `05_scene_toolbar…`, `90_descriptcom_2022_storyboard_darkmode.png` (the 2022 Storyboard-era layout in dark: script with scene thumbs in a left gutter, filmstrip timeline). **There is no current help-center screenshot of the Storyboard grid.** The grid below is built from Descript's help text ("Timeline view / Storyboard view: toggle between full layer timeline and scene thumbnail layout"; "Scene Rail is now part of Storyboard View"; "reorder scenes by dragging thumbnails") plus the scene-strip refs. Treat the grid's sizes as **chosen**, not measured.

### 8.1 Scenes in the script and timeline
```
 ▣ Hi everyone, I'm Tifa. Welcome!           ← scene start thumbnail 28×20 r4 (click selects scene)
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─      ← "/" scene break: 1 px dashed border-border full text width, 16 px vertical margin
 ▣ I'm going to show you two shapes…
 timeline scene strip (h36): [1 ▣ Intro][2 ▣ Shapes][3 ▣ Outro] → blocks sized to duration, r6, number 11/600 + thumb 48×28 + title 11
```
Scene toolbar (canvas, when the scene is selected and no layer): `Layout ▾ | Background ● | Transition | Duplicate | ⋯` h32 (ref `05/06_scene_toolbar…`).

### 8.2 Storyboard view (toggle in the transport's view segmented control, §3.3)
```
 ┌ main card ─────────────────────────────────────────────────────────────┐
 │ script pane (unchanged)          │ canvas pane (unchanged)              │
 ├──────────────── resize handle ──────────────────────────────────────────┤
 │ transport 44 (view toggle shows ▦ active)                               │
 │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌ + ┐        │
 │ │ thumb │ │ thumb │ │ thumb │ │ thumb │ │ thumb │ │ thumb │ │   │  h=lane │
 │ │16:9   │ │       │ │       │ │       │ │       │ │       │ │Add│        │
 │ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───┘        │
 │  1 Intro   2 Shapes  3 …       (label row: number 11/600 + title 12 trunc) │
 │  0:04.2    0:12.0               (duration mono 11 muted)                   │
 └─────────────────────────────────────────────────────────────────────────┘
```
| Element | 1440×900 | 1280×800 | Notes |
|---|---|---|---|
| Storyboard area | same height as expanded timeline (default 280 incl. transport) | 240 | resizable like the timeline |
| Card | thumb w160 × h90 (16:9) / w72×128 (9:16) r8 + label 36 | w144×81 | grid wraps; gap 16; padding 16; scrolls vertically |
| Current scene | `ring-2 ring-primary` | — | follows playhead |
| Selected scenes | `ring-2 ring-primary bg-primary/10` | — | ⌘/⇧-click multi-select |
| Add scene card | dashed `border-input` r8, `Plus` 20 + "Add scene" 12 | — | appends a blank scene |

### 8.3 States & interactions
- Hover a card: ⋯ (top-right 24): Duplicate, Change layout, Apply transition, Add comment, Delete; play icon centre (plays from scene start).
- Drag reorder: lifted card `shadow-lg rotate-1 opacity-90`; 2 px × card height `bg-primary` insertion bar; script reorders paragraphs to match on drop; toast "Moved scene 3 · Undo".
- Transition badges between cards (12×12 r3 `bg-muted` with transition icon) when a transition exists; click opens the transitions popover (§7).
- Empty: "No scenes yet — type / in the script to add one" centred.
- Loading thumbs: `bg-muted animate-pulse` at final size.

### 8.4 Focus order
Transport → first card → ←/→ (↑/↓ by row) between cards → Enter plays/selects → ⋯ via Shift+F10 → ⌘↑/⌘↓ or ⌥←/⌥→ moves the focused scene.

### 8.5 Below 1280
Cards w144; <1100 the storyboard replaces the canvas pane instead of the timeline (stacked).

### 8.6 Transovo
In a project's "Full video" composition, the storyboard can show **Clips** instead of scenes (toggle "Scenes | Clips" at the left of the storyboard area, h28 segmented): each clip card shows its thumbnail, score ring 24 top-left, duration chip, and opens that composition on double-click.

---

## 9. Layouts picker & layout packs

**References** (14 images): `surfaces/09_layouts_packs/01_selecting_and_applying_a_layout_to_a_sce.png`, `surfaces/09_layouts_packs/02_layout_picker_with_remix_button_highligh.png`, `surfaces/09_layouts_packs/03_layout_pack_gallery_with_dropdown_for_se.png`, `surfaces/09_layouts_packs/04_color_picker_panel_showing_primary_accen.png`, `surfaces/09_layouts_packs/05_font_selection_dropdown_for_title_subtit.png`, `surfaces/09_layouts_packs/06_fields_to_name_and_set_sharing_level_of.png`, `surfaces/09_layouts_packs/07_layout_preview_screen_with_example_tiles.png`, `surfaces/09_layouts_packs/08_descript_s_available_layout_packs.png`, `surfaces/09_layouts_packs/09_branded_layout_packs_in_descript_showing.png`, `surfaces/09_layouts_packs/10_the_descript_editor_with_entry_points_fo.png`, `surfaces/09_layouts_packs/11_multicam_layout_applied_to_a_multi_track.png`, `surfaces/09_layouts_packs/12_notification_showing_removed_layers_with.png`, `surfaces/09_layouts_packs/13_aspect_ratio_png.png`, `surfaces/09_layouts_packs/14_default_layout_pack_toggle_in_brand_stud.png`
Masters: `01_selecting_and_applying_a_layout…` (picker, zoomed crop), `02_layout_picker_with_remix_button…` (picker at 1300×800 1×, anchored to the Layout pill), `03_layout_pack_gallery…`, `04/05_…colour / font…` (pack customisation), `06_fields_to_name_and_set_sharing…`, `07_layout_preview_screen…`, `13_aspect_ratio_png.png`.

### 9.1 Wireframe — layout picker popover (opens above the canvas "Layout" pill, or from the selection toolbar)
```
 ┌ Reykjavik cherry – light     ⌕  ☰  ⋯ ┐  header h44: pack name 13/600 (click = pack menu), search, filter (aspect), menu
 │ ┌──────────┐ ┌──────────┐            │
 │ │  thumb   │ │  thumb   │            │  2 cols, tile w128 h72 r8 (16:9; 9:16 packs use w88 h156)
 │ └──────────┘ └──────────┘            │
 │  Multicam      Intro                  │  label 13, h28
 │  Outro         Chapter                │
 │  Speaker       Captions               │
 │          [ Go to current layout ]     │  floating pill h32 at the bottom while scrolled away
 │ ───────────────────────────────────── │
 │ [⇄ Change layout pack]                │  footer h44 ghost
 └────────────────────────────────────────┘ w288, max-h 480, r12
```
Pack gallery (from "Change layout pack" or Scene props ▸ Layout ⋯): list in the side panel (w320) of packs, each a card h120: 2×2 thumb mosaic 136×76 + pack name 13/600 + "12 layouts" 12 muted + "Default" badge; sections "Your packs", "Drive packs", "Transovo packs".
Customize pack (side panel): **Color** (Primary text, Accent text, Background — rows h32 label + 16 round swatch → colour picker §10.6) · **Fonts** (Title, Subtitle, Text — select h32 + `SlidersHorizontal` → popover: Font, Weight, Capitalization Ag/AG segmented) · **Save** (modal w400: Name field, Sharing select: Private / Share with drive / Share publicly; Cancel / Save).

### 9.2 Regions
| Element | Size | Notes |
|---|---|---|
| Picker | w288, max-h 480 (clamped to space above the pill), r12 | anchored centre above pill, 8 gap |
| Tile | 128×72 r8 + label 28 | gap 12 col / 8 row; padding 12 |
| Remix button | 24 round `bg-popover` `Wand2` 14, top-right of hovered tile | tooltip "Remix layout" — opens Underlord/AI Producer remix |
| Pack gallery card | w = panel − 24, h120 | gap 12 |
| Aspect-ratio menu | w200: 16:9, 9:16, 1:1, 4:5, 4:3 + Custom | ref `13_aspect_ratio` |

### 9.3 States
- Tile hover `ring-1 ring-primary/40` + Remix; current layout `ring-2 ring-primary` + check; applying: tile spinner overlay; after applying, toast "Removed 2 layers that don't fit this layout · Undo" (ref `12_notification…`).
- Empty search: "No layouts match" + "Clear search".
- Loading: 6 skeleton tiles.

### 9.4 Focus order
Header pack name → search → filter → ⋯ → tiles (arrow keys, Enter applies, R remixes) → Go to current layout → Change layout pack.

### 9.5 Below 1280
Unchanged (popover). <768 n/a.

### 9.6 Transovo
- Transovo packs: **Clip – Speaker**, **Clip – Split screen**, **Clip – Captions focus**, **Podcast 2-up**, **Multicam**, **Title card**, **Outro**; default for clipper compositions is "Clip – Speaker" at 9:16.
- Brand kit integration: a "Brand" pack is generated from Brand (logo, colours, fonts) and sits first under "Your packs" with a brand-gradient 2 px left bar.
- Aspect-ratio menu adds the platform names: 9:16 (TikTok, Reels, Shorts), 1:1 (Feed), 16:9 (YouTube).

---

## 10. Canvas layers: text, shapes, waveform, progress bar, placeholders; align & snap

**References** (26 images): `surfaces/10_canvas_layers_align/01_addlayertoolbar_png.png`, `surfaces/10_canvas_layers_align/02_image_of_all_shape_layers_available_in_d.png`, `surfaces/10_canvas_layers_align/03_visuals_shapes.png`, `surfaces/10_canvas_layers_align/04_text_options_shown_in_descript_s_element.png`, `surfaces/10_canvas_layers_align/05_adding_a_text_layer_using_the_selection.png`, `surfaces/10_canvas_layers_align/06_layer_panel_open_showing_text_style_cont.png`, `surfaces/10_canvas_layers_align/07_descript_scene_editor_layout.png`, `surfaces/10_canvas_layers_align/07_dropdown_menu_showing_live_text_options.png`, `surfaces/10_canvas_layers_align/08_background_box_behind_a_multi_line_text.png`, `surfaces/10_canvas_layers_align/09_gif_of_different_style_progress_bars.png`, `surfaces/10_canvas_layers_align/10_progress_bar_options_in_the_elements_pan.png`, `surfaces/10_canvas_layers_align/11_speaker_property_assigned_to_a_waveform.png`, `surfaces/10_canvas_layers_align/12_alignment_options_in_the_scene_editor_pr.png`, `surfaces/10_canvas_layers_align/13_layer_border_colors_in_the_scene_editor.png`, `surfaces/10_canvas_layers_align/14_multi_select_in_the_scene_editor.png`, `surfaces/10_canvas_layers_align/15_layer_toolbar_in_the_scene_editor.png`, `surfaces/10_canvas_layers_align/16_floating_toolbar_options_in_descript_sce.png`, `surfaces/10_canvas_layers_align/17_right_click_visual_options_menu_in_descr.png`, `surfaces/10_canvas_layers_align/18_layer_snapping_to_scene_boundary.png`, `surfaces/10_canvas_layers_align/19_locking_a_layer_from_the_scene_editor.png`, `surfaces/10_canvas_layers_align/20_locked_layer_shown_in_properties_panel.png`, `surfaces/10_canvas_layers_align/21_fill_picker_open_on_the_solid_tab_showin.png`, `surfaces/10_canvas_layers_align/22_stroke_control_in_the_hover_toolbar_show.png`, `surfaces/10_canvas_layers_align/23_eyedropper_icon_in_the_fill_picker_swatc.png`, `surfaces/10_canvas_layers_align/24_placeholderlayers_png.png`, `surfaces/10_canvas_layers_align/25_placeholderpanel_png.png`
Masters: `01_addlayertoolbar_png.png` (New-layer menu), `02/03_…shapes…`, `04_text_options…Elements…`, `09/10_…progress bar…`, `11_…waveform…`, `12_alignment_options…`, `14_multi_select…`, `15/16_…layer toolbar / floating toolbar…`, `17_right_click_visual_options_menu…`, `18_layer_snapping…`, `21–23_fill picker / stroke / eyedropper`, `24/25_placeholder…`.

### 10.1 Elements panel (side panel w320)
```
 ┌ Elements                           × ┐ h48
 │ Text                                  │ section title 13/600, h32
 │ [ Title ][ Subtitle ][ Text ]         │ 3 tiles, each (w−24−16)/3 × 64, r10, bg-surface-raised, sample text in its style
 │ Basic shapes                          │
 │ ▭ ● ▢ ★ ▲ ⬭ ■ ➜ ─                    │ 5-col grid of 48×48 tiles r8
 │ Dynamic text           Show all ›     │ chips: Speaker name, Date, Countdown…
 │ Waveform               Show all ›     │ 2-col tiles 136×64: Linear, Circle, Bar, Line
 │ Playback progress      Show all ›     │ Bar, Spinner, Pie
 │ Annotations            Show all ›     │ Arrow, Highlight box, Callout
 │ Placeholder                           │ Media, Screen, Camera (2-col 136×64)
 └───────────────────────────────────────┘
```
Click inserts at the playhead, centred on the canvas; drag inserts at the drop point.

### 10.2 Canvas selection, handles, snap
| Element | Spec |
|---|---|
| Hover outline | 1 px `border-primary/60` |
| Selected outline | 1.5 px `border-primary`; 8 handles 8×8 white squares with 1 px `border-primary` (corners + edge midpoints); rotation handle 10 round 20 above top-centre |
| Locked layer | dashed 1 px `border-muted-foreground`, no handles, `Lock` 12 badge at top-left (ref `19/20`) |
| Multi-select | each layer outlined + one group bounding box with handles (ref `14`) |
| Layer colours by type (outline when selected) | video `primary`, text `lane-caption`, shape `lane-sfx`, image `lane-broll` (ref `13_layer_border_colors…` uses per-type colours) |
| Snap guides | 1 px `bg-lane-brand` lines spanning the canvas; snaps to canvas edges, centre, other layers' edges/centres, 8 px threshold; distance labels `text-[10px] bg-lane-brand text-white px-1 r-sm` |
| Text editing | double-click enters edit; caret `bg-primary`; outline turns dashed |

Floating layer toolbar — see §7.1. For text layers it is: `Font ▾ | Size | B | I | Align ▾ | Colour ● | Background ▢ | Animation | ⋯`; for shapes: `Fill ● | Stroke ▾ (width 0–20, colour, dash) | Corner | Animation | ⋯` (ref `22_stroke_control…`).

### 10.3 Right-click menu on a layer (w240, items h32)
Select layer ▸ (layers under pointer) · Layer order ▸ (Bring to front ⇧⌘], Bring forward ⌘], Send backward ⌘[, Send to back ⇧⌘[) · Align layers ▸ (Left, Centre, Right, Top, Middle, Bottom, Distribute horizontally, Distribute vertically) · divider · View media · Replace media · Change source · divider · Cut · Copy · Paste · Paste attributes · Duplicate ⌘D · divider · Flip horizontal · Flip vertical · divider · Hide layer · Lock layer · Delete layer ⌫.

### 10.4 New-layer menu (from `+` on canvas toolbar / Layers list; ref `01_addlayertoolbar`)
Files · Recording · Captions · Text · Placeholder · Live text ▸ · Shapes ▸ · Videos (stock) · GIFs. w220, icon 16 + label.

### 10.5 Colour (fill) picker — popover w248
Tabs `Solid | Gradient` (segmented h28) → saturation/value square 224×160 r8 → hue slider h12 + alpha slider h12 → row: `Pipette` eyedropper 28, "Hex" select w64, value field (#FFFFFF) flex, % field w56 → swatches row (document colours, 8 per row 20 round) → "Brand colours" row.

### 10.6 States, empty, error
- Placeholder layers render as `bg-muted/60` with dashed border + centred icon (Camera/Screen/Media) + label "Drop media" 12; dropping media fills it.
- Waveform layer with no audio: flat line + "No audio on this speaker" tooltip; Speaker select in its props (ref `11`).
- Font failed to load: fallback Geist + `TriangleAlert` in the font select.

### 10.7 Focus order
Canvas (Tab cycles layers top→bottom by z-order; arrows nudge 1 px, ⇧ 10 px; Enter edits text; Esc deselects) → floating toolbar → Elements panel tiles row by row.

### 10.8 Below 1280
Elements panel 280: shape grid 4 cols; tiles shrink proportionally.

### 10.9 Transovo
- Dynamic text adds **Clip title**, **Hook text**, **Handle (@)** from brand kit; Playback progress defaults to brand colour.
- Snap guides also show platform **safe zones** for 9:16 (top 12 %, bottom 20 %, right 12 % for TikTok UI), toggle in View ▸ Scene editor ▸ "Show safe zones".

---

## 11. Media panel & stock

**References** (11 images): `surfaces/11_media_stock/01_media_panel_open_in_the_descript_editor.png`, `surfaces/11_media_stock/02_brand_studio_media_panel_in_descript.png`, `surfaces/11_media_stock/03_selecting_brand_fonts_in_the_descript_ed.png`, `surfaces/11_media_stock/04_media_library_banner_image.png`, `surfaces/11_media_stock/05_project_file_actions_menu_in_descript.png`, `surfaces/11_media_stock/06_view_file_metadata_button_in_descript.png`, `surfaces/11_media_stock/07_ai_generated_project_file_options_menu.png`, `surfaces/11_media_stock/08_project_panel_with_an_option_to_add_a_fi.png`, `surfaces/11_media_stock/09_replace_button_in_the_scene_editor_toolb.png`, `surfaces/11_media_stock/10_save_current_frame_button_in_the_scene_t.png`, `surfaces/11_media_stock/11_saved_frame_shown_in_the_files_panel.png`
Masters: `01_media_panel_open_in_the_descript_editor.png` (Media panel, Stock tab, at ~1.4× of a 1440-class window), `02_brand_studio_media_panel…`, `05/07_…file actions menu…`, `09_replace_button…`, `10/11_save_current_frame…`.

### 11.1 Wireframe (side panel w320)
```
 ┌ ▣ Media                              ┐ header h48 (icon 16 + title 14/600; no close — rail toggles)
 │ [   My media   |▓▓▓  Stock  ▓▓▓]     │ segmented h32 m12; active segment bg-primary text-primary-foreground
 │ [⌕ Search stock media      ] [▣][♫] │ search h32 flex + 2 toggle buttons 32×32 (Visuals / Audio)
 │ ┌ Videos                  Show all ┐ │ section card r10 bg-surface-raised p12; title 13/600; link 12 muted
 │ │ ┌──────┐ ┌──────┐               │ │ 2-col grid, tile (w−48−8)/2 × 16:9 (≈128×72), r6, gap 8
 │ │ └──────┘ └──────┘ (4 items)     │ │
 │ ┌ GIPHY GIFs              Show all ┐ │ GIPHY mark 14 before the title
 │ ┌ Images                  Show all ┐ │
 │ ┌ GIPHY stickers          Show all ┐ │
 └──────────────────────────────────────┘ scroll; cards gap 8
 Audio toggle (♫) on → sections: Music · Sound effects (§12)
 "Show all" → full grid view of that category with ← back, filters (Orientation, Duration), infinite scroll 2-col
```
**My media** tab: search "Search your media" + sort/grid-list toggle; folders (Brand, Uploads, Recordings, Stock saved) rows h40; files grid 2-col tiles with duration chip bottom-right `text-[10px] bg-black/60 px-1 r-sm`; Brand Studio section shows logos, intro/outro, fonts (ref `02/03`).

### 11.2 Interaction & states
- Tile hover: `ring-1 ring-primary/40`, video previews muted on hover after 300 ms, `+` button 24 at bottom-right (adds at playhead), drag to script/canvas/timeline inserts there.
- Adding: tile shows a spinner overlay, then toast "Added to scene 3".
- File ⋯ menu (w220): Insert at playhead, Replace selected layer, Open in new window, View metadata, Rename, Download, Delete (destructive) (ref `05/07`).
- Empty My media: `Upload` icon 24 + "Drop files here or Upload" + Upload button h32.
- Search no results: "No stock results for "sunset drone"" + suggestions.
- Loading: skeleton tiles 2×2 per section.
- Error (stock API down): Alert in the section "Stock media is unavailable right now" + Retry.

### 11.3 Focus order
Segmented → search → Visuals → Audio → section 1 "Show all" → its tiles (arrows) → section 2 …

### 11.4 Below 1280
Panel 280: tiles ≈112×63. Drawer at 1100–1279.

### 11.5 Transovo
- Stock source: Transovo's stock provider(s) (Pexels/Pixabay class); replace GIPHY sections with **B-roll suggestions** (AI-matched to the transcript at the playhead, badge "Suggested" `text-lane-broll`) as the first section.
- B-roll inserted from here lands on the `lane-broll` track colour in the timeline.

---

## 12. Music & sound effects

**References** (7 images): `surfaces/12_music_sfx/01_media_panel_stock_tab_REUSED.png`, `surfaces/12_music_sfx/02_descriptcom_music_waveform_under_media.png`, `surfaces/12_music_sfx/03_descriptcom_script_word_track_audio.png`, `surfaces/12_music_sfx/04_descriptcom_transition_in_crossfade_popover.png`, `surfaces/12_music_sfx/05_descriptcom_filler_and_waveform.png`, `surfaces/12_music_sfx/06_volume_properties_REUSED.png`, `surfaces/12_music_sfx/07_pan_properties_REUSED.png`
**No usable reference of Descript's music/SFX browse list exists in the help center or on descript.com.** Used instead: `01_media_panel_stock_tab_REUSED.png` (shows the ♫ audio toggle that switches the Stock tab to audio), `02_descriptcom_music_waveform_under_media.png` and `03/05_…waveform…` (how a music layer looks in the timeline), `04_descriptcom_transition_in_crossfade_popover.png` (fade popover), `06_volume_properties_REUSED.png`, `07_pan_properties_REUSED.png`, plus gap-matrix B9 (Loop/Once, fade in/out, ducking −3…−30 dB, default −12). Sizes below are **chosen to match §11**, not measured.

### 12.1 Wireframe (Media panel ▸ Stock ▸ ♫ on)
```
 ┌ ▣ Media                               ┐
 │ [ My media | Stock ]                   │
 │ [⌕ Search music & sound effects][▣][♫]│  ♫ pressed (bg-accent)
 │ [ Music ][ Sound effects ]             │  tabs h28 underline style
 │ Mood ▾  Genre ▾  Duration ▾            │  filter chips h28 r-full outline, gap 6
 │ ┌───────────────────────────────────┐ │
 │ │ ▶  Sunny Afternoon     2:31   + ⋯ │ │  row h56: play 32 round, title 13/500 + artist/tags 12 muted, duration mono 12, add, menu
 │ │    ▁▂▅▇▅▃▂▁▂▅▇▆▃▁ (mini waveform)  │ │  waveform h16 under title while playing/hovered, progress fill bg-primary
 │ └───────────────────────────────────┘ │
 │ … list, infinite scroll                │
 └────────────────────────────────────────┘
 SFX tab: same rows h48 (no artist line), categories grid first (Whoosh, Click, Pop, Riser, Applause…) as 2-col chips h40
```

### 12.2 Music layer properties (Properties §7, audio-only layer)
| Section | Controls |
|---|---|
| Audio | volume field + slider (0–200 %, default 100), mute; ⋯ ▸ Pan (−100 L … 100 R slider) |
| Fades | Fade in [ms] / Fade out [ms] fields w88 (default 0 / 0; 0–10 000) |
| Loop | segmented `Loop | Once` (default Once for SFX, Loop for music beds) |
| Ducking | switch "Lower under speech" + Amount slider −3…−30 dB (default −12) |
| Audio effects | as §7 |

Timeline: music lane uses `bg-lane-music/25` block with `text-lane-music` waveform; SFX `lane-sfx`; fades drawn as diagonal handles (8×8 at block top corners; drag to set fade length).

### 12.3 States
Preview playing: row `bg-accent`, play → pause; only one preview at a time; preview stops when editor playback starts. Adding: toast "Added "Sunny Afternoon" · Undo". Empty search / loading / error as §11.2.

### 12.4 Focus order
Search → Visuals → Audio → Music/SFX tabs → filters → rows (↑/↓; Space previews; Enter adds).

### 12.5 Transovo
- Default sort "Fits this clip" (AI-matched mood/BPM to the clip) with badge `text-lane-music`.
- Licence line under the title 11 muted ("Royalty-free · OK for TikTok/YouTube").

---

## 13. Studio Sound, audio effects, EQ, VU meter

**References** (14 images): `surfaces/13_studio_sound_audio_fx/01_how_to_apply_studio_sound_in_descript_ed.png`, `surfaces/13_studio_sound_audio_fx/02_adjust_studio_sound_intensity_in_descrip.png`, `surfaces/13_studio_sound_audio_fx/03_sound_good_panel_in_the_descript_editor.png`, `surfaces/13_studio_sound_audio_fx/04_effects_animations_transitions_eq.png`, `surfaces/13_studio_sound_audio_fx/05_eq_detail_png.png`, `surfaces/13_studio_sound_audio_fx/06_vu_meter_transport.png`, `surfaces/13_studio_sound_audio_fx/07_vu_meter.png`, `surfaces/13_studio_sound_audio_fx/08_app_settings_in_descript_showing_the_tog.png`, `surfaces/13_studio_sound_audio_fx/09_project_settings_in_descript_showing_the.png`, `surfaces/13_studio_sound_audio_fx/10_effects_drawer_in_the_descript_scene_edi.png`, `surfaces/13_studio_sound_audio_fx/11_adding_audio_effects_in_the_sequence_edi.png`, `surfaces/13_studio_sound_audio_fx/12_descript_studio_sound_properties.png`, `surfaces/13_studio_sound_audio_fx/12_example_of_blur_speaker_background_effec.png`, `surfaces/13_studio_sound_audio_fx/13_green_screen_effect_in_descript.png`
Masters: `02_adjust_studio_sound_intensity…` (Studio Sound row → settings popover), `05_eq_detail_png.png` (EQ editor), `06_vu_meter_transport.png` (VU meter in transport), `07_vu_meter.png` (View ▸ Timeline ▸ Show in timeline ▸ Volume), `03_sound_good_panel…` (AI tools "Sound good"), `08/09_…settings toggles` (app/project audio defaults), `10_effects_drawer…`, `12_example_of_blur_speaker_background…`, `13_green_screen_effect…`.

### 13.1 Studio Sound settings popover (anchored left of the Properties panel row's `SlidersHorizontal` button)
```
 ┌ Studio Sound  ⓘ                   × ┐  w272, header h44 (title 14/600, help 16, close)
 │ ┌ Intensity ░░░░░░░░░░░░░░░░░ 100% ┐ │  "slider field": h36 r8 bg-muted; fill bg-primary/20 grows with value; label left 13 muted, value right mono 13
 │ └───────────────────────────────────┘ │  drag anywhere to set; arrows ±1; default 80 %
 │ ─────────────────────────────────────  │
 │ [ 🗑 Remove ]                          │  outline full width h36
 └────────────────────────────────────────┘
```
Row in Properties ▸ Audio effects: label 13 · `SlidersHorizontal` ghost 28 · switch (§7.2). Processing: switch replaced by `Loader2` 14 + "42%" mono 11 until the enhanced audio is ready; toast "Studio Sound applied".

### 13.2 EQ editor popover (wide, anchored to the panel's left edge)
```
 ┌ EQ  ⓘ                                                             × ┐ w640, r12
 │ [ Default                                                         ▾] │ preset select h36 full width (Default, Voice boost, De-mud, Bass cut, Telephone)
 │ ┌ graph h232: log Hz axis 20–20k (labels 11 muted below), dB −24…+18 right ┐
 │ │ 1px grid lines border-border/40; response curve 2px bg-primary; band     │
 │ │ nodes 10 round in band colours (speaker-1…5), draggable (x=freq, y=gain)  │
 │ └──────────────────────────────────────────────────────────────────────────┘
 │   (◐)1       (◐)2       (◐)3       (◐)4       (◐)5                        │ band columns, each switch + index
 │ Freq 50 Hz   200 Hz     800 Hz     3200 Hz    12800 Hz                     │ editable inline fields 13 mono
 │ Gain 0 dB    0 dB       0 dB       0 dB       0 dB                         │
 │ Width 2      2          2          2          2                            │ selected band column ring-1 ring-primary r8
 │ ───────────────────────────────────────────────────────────────────────── │
 │ Gain                                                               0 dB   │ row h44
 │ Remove effect                                                         —   │ row h44, text-muted hover text-destructive
 └────────────────────────────────────────────────────────────────────────────┘
```
Same pattern (header, preset, params grid, Remove) for Compressor, Noise gate, Reverb, Ducking (Amount −3…−30 dB default −12, Attack, Release).

### 13.3 VU meter
- In the transport, left cluster after the timecode: label "VU" 10/600 muted + 2 stacked bars (L/R) each 96×3 r-full, track `bg-muted`, fill green (`oklch(0.72 0.17 150)`) to −12 dB, amber to −6, red above −3; peak-hold tick 2 px for 1 s. Shown when View ▸ Timeline ▸ Show in timeline ▸ Volume is on or "Show volume in decibels" (Settings) is on; hover tooltip shows "−14.2 dB".
- In the timeline, volume shows as a 1 px line across each audio block with draggable keyframe dots (6 round).
- Range −30…0 dB (gap-matrix B10).

### 13.4 "Sound good" (AI tools ▸ category, ref `03`)
List of one-click actions with icon 16 + label 13, rows h40: Edit for clarity, Studio Sound, Remove filler words, Remove retakes, Shorten word gaps, Add chapters; each opens its own options popover/side-panel view (§15).

### 13.5 Visual effects drawer (ref `10/12/13`)
Effects `+` menu (w240): Blur, Blur background (speaker), Green screen, Remove background, Eye contact, Drop shadow, Chroma key…; each effect row in Properties has its own settings popover (Amount slider, colour picker for key colour).

### 13.6 States
Disabled when the layer has no audio ("No audio on this layer" tooltip). Error: row shows `TriangleAlert` `text-destructive` + "Couldn't process · Retry". Focus: settings button → popover traps focus → first control → Remove → × (Esc closes, focus returns to the settings button).

### 13.7 Transovo
Transovo names: **Studio Sound** (keep), **Auto-level** (−16 LUFS, gap-matrix B10), **Room tone** fill. EQ, Compressor and Reverb are Later and hidden at launch. §13.2 is kept so they can be built later without redesign. VU meter is in launch scope (B10.4).

---

## 14. Markers & chapters

**References** (5 images, thin set): `surfaces/14_markers_chapters/01_add_marker_option_shown_in_the_descript.png`, `surfaces/14_markers_chapters/02_markers_shown_in_the_script_and_timeline.png`, `surfaces/14_markers_chapters/03_marker_list_panel_showing_labeled_sectio.png`, `surfaces/14_markers_chapters/04_dragging_and_repositioning_a_marker_in_t.png`, `surfaces/14_markers_chapters/05_export_settings_showing_include_markers.png`
Masters: `03_marker_list_panel_showing_labeled_sectio.png` (marker list popover from the transport), `02_markers_shown_in_the_script_and_timeline.png`, `01_add_marker_option…` (script `/` menu / right-click "Add marker"), `04_dragging_and_repositioning_a_marker…`, `05_export_settings_showing_include_markers.png`.

### 14.1 Elements
```
 Script:  Details of the Study                 ← marker = heading line, 14/600, text-foreground, mt16 mb4
          tell us more about the study…
 Ruler:   ──┬───────▶──────────┬──             ← marker flag: 8×10 bg-primary (pennant) on the ruler, 1px line through the tracks on hover
 Transport ⋯ [≡▾] icon (list) → popover:
 ┌───────────────────────────────────────┐ w272, r12, p4
 │ Beginning of composition         Home │ row h32 px8, label 13 trunc, right 12 mono muted
 │ Introduction and Setup          00:00 │
 │ The Value of Multivitamins      00:10 │
 │ Details of the Study ▓▓▓▓▓▓▓▓▓  01:07 │ current (contains playhead) bg-accent
 │ …                                      │ max-h 360 scroll
 │ End of composition                End │
 └───────────────────────────────────────┘
```
| Element | Spec |
|---|---|
| Marker list button | transport left cluster, after skip back/forward; icon `ListTree`/`BookmarkList` 16 in a 28 ghost button; tooltip "Markers (M)" |
| Popover | w272, opens upward above the transport, left-aligned to the button |
| Ruler flag | 8 wide, 10 tall, `bg-primary`; label tooltip on hover; drag horizontally to move (snaps to word boundaries); ruler toggle View ▸ Timeline ▸ Show in time ruler ▸ Markers |
| Script marker | heading line; click to rename inline; ⋯ on hover: Rename, Go to, Remove marker |

### 14.2 States
Empty list: popover shows only Beginning/End + 12 muted "Add markers with / in the script" line. Add marker: ⌘⇧M or `/` → Marker; new marker enters rename mode. Dragging: flag lifts `shadow-glow`, timecode tooltip follows. Export (ref `05`): checkbox "Include markers as chapters" (§18).

### 14.3 Focus order
Marker list button → popover rows (↑/↓, Enter seeks, Home/End jump) → Esc returns focus.

### 14.4 Transovo
"Add chapters" AI action (§15) writes markers. In clipper projects, each clip's range shows as a `lane-ai`-coloured span on the Full-video ruler with the clip title, and the marker list gains a "Clips" group under the markers.

---

## 15. AI Tools panel, retakes, Underlord chat → Transovo AI Producer

**References** (18 images): `surfaces/15_ai_tools_retakes/01_the_ai_tools_panel_in_descript_accessese.png`, `surfaces/15_ai_tools_retakes/02_the_look_good_panel_inside_the_ai_action.png`, `surfaces/15_ai_tools_retakes/03_repurpose_tools_in_descript.png`, `surfaces/15_ai_tools_retakes/04_publish_tools_in_descript.png`, `surfaces/15_ai_tools_retakes/05_the_write_category_in_the_ai_tools_panel.png`, `surfaces/15_ai_tools_retakes/06_the_underlord_side_panel_open_in_the_des.png`, `surfaces/15_ai_tools_retakes/07_skills.png`, `surfaces/15_ai_tools_retakes/08_skills_plus_underlord_chat.png`, `surfaces/15_ai_tools_retakes/09_in_app_ui_demonstrating_the_ai_actions_p.png`, `surfaces/15_ai_tools_retakes/10_automatic_multicam_style_options.png`, `surfaces/15_ai_tools_retakes/11_automatic_multicam_cutaway_frequency_set.png`, `surfaces/15_ai_tools_retakes/12_automatic_multicam_camera_setup_options.png`, `surfaces/15_ai_tools_retakes/13_automatic_multicam_layout_pack_selection.png`, `surfaces/15_ai_tools_retakes/13_descript_ai_tools_panel.png`, `surfaces/15_ai_tools_retakes/14_a_short_demo_showing_edit_for_clarity_be.png`, `surfaces/15_ai_tools_retakes/15_model_picker_interface_in_descript_showi.png`, `surfaces/15_ai_tools_retakes/16_translate_option_in_descript_s_ai_tools.png`, `surfaces/15_ai_tools_retakes/17_the_translate_panel_in_the_descript_edit.png`
Masters: `01_the_ai_tools_panel…` and `09_in_app_ui…` (panel, search, "Sound good" / "Look good" cards, disabled + Beta items), `03/04/05_…repurpose / publish / write…`, `06_the_underlord_side_panel…`, `07_skills.png`, `08_skills_plus_underlord_chat.png` (composer + menu), `10–13_automatic_multicam…` (multi-step options), `14_…edit for clarity before/after`, `15_model_picker…`, `16/17_translate…`.

### 15.1 AI Tools panel (side panel w320)
```
 ┌ ✦ AI Tools                           ┐ header h48 (Sparkles 16)
 │ [⌕ What would you like to do?      ] │ search h36 r8 bg-muted; autofocus when the panel opens (ring-2 ring-ring visible)
 │ ┌ Sound good ─────────────────────┐ │ category card r10 bg-surface-raised, title 13/600 h40 px16
 │ │ ✎ Edit for clarity               │ │ action rows h40 px16 r8: icon 16 muted + label 13; hover bg-accent
 │ │ 🎙 Studio Sound                  │ │
 │ │ ⫼ Remove filler words            │ │
 │ │ ⟳ Remove retakes                 │ │
 │ │ ⋯ Shorten word gaps              │ │
 │ │ 🔖 Add chapters                  │ │
 │ └──────────────────────────────────┘ │
 │ ┌ Look good ──────────────────────┐ │ Quick design (disabled, opacity-50), Eye Contact, Center active speaker [Beta],
 │ │ …                                │ │ Green screen, Automatic multicam, Generate an image, Generate a video, Blur speaker background [Beta]
 │ ┌ Write ┐ ┌ Repurpose ┐ ┌ Publish ┐  │ Write: Write script, Rewrite, Summarize, Translate…; Repurpose: Create clips, Highlight reel,
 └──────────────────────────────────────┘ Social post…; Publish: Title ideas, Description, Show notes, Thumbnail
 Beta badge: text-[10px] px6 h18 r-sm bg-muted text-muted-foreground, after the label (gap 8).
```
Search filters actions across categories live (category titles stay; empty categories hide). Disabled items show a tooltip with the reason ("Needs 2+ speakers", "Select a scene first").

### 15.2 Action detail view (replaces the list inside the panel)
`← Remove retakes` header h48 · description 13 muted (2–3 lines) · options (selects/switches/sliders, rows h40) · scope segmented "Current composition | Selection" · primary button full width h36 ("Remove retakes") · cost line 11 muted ("Uses 2 AI credits") · after run: results list (each retake group as a card: kept take highlighted `ring-1 ring-primary`, alternates collapsed with "Swap" button) + `Undo` ghost.
Multi-step actions (Automatic multicam, refs `10–13`): stepper dots at the top (●○○○), Next/Back footer h56 with Back ghost + Next primary; steps: Camera setup → Layout pack → Cutaway frequency (Low/Medium/High segmented) → Style.
Running: primary button becomes progress "Working… 40%" (determinate bar inside the button), Cancel link below. Error: Alert destructive inside the view + Retry. Success: toast + result summary ("Removed 7 retakes · 1:12 saved").

### 15.3 Underlord chat (rail item pinned at the bottom; side panel w320–400)
```
 ┌ 🤖 Underlord           ⟲  ⋯  × ┐ header h48 (new chat, history, close)
 │            (🤖)                  │ avatar 56 round bg-surface-raised, centred, empty state
 │ I'm Underlord, your AI co-editor.│ 16/600, centred, max-w 260
 │ How can I help you?              │
 │ ┌ ✂ Make a short video ───────┐ │ suggestion cards h56 r10 border, title 13/600 + sub 12 muted
 │ ┌ What Underlord can do ──────┐ │ pill h36
 │                                   │
 │ ┌───────────────────────────────┐│ composer r12 border bg-surface-raised, min-h 88, max-h 240
 │ │ Ask, @ for context, / for skills│ placeholder 13 muted
 │ │ [+] [⬡ Auto ▾]            (↑) ││ + menu, model picker pill, send 32 round bg-primary (disabled bg-muted)
 │ └───────────────────────────────┘│
 │ Underlord can make mistakes. Learn more ↗ │ 11 muted centred
 └───────────────────────────────────┘
 + menu (w240): Upload files or media · Upload from media library · divider · Add context (@) · Skills
```
Messages: user bubble right `bg-primary/15 r12 px12 py8 max-w 85%`; assistant left plain text 13/1.6 with tool-step rows ("✓ Removed filler words · View") h32 and an inline "Undo all" button after edits.

### 15.4 Focus order
Panel: search → category 1 actions → category 2 … Detail: back → options → scope → primary → Undo. Chat: suggestions → composer textarea → + → model → send (Enter sends, ⇧Enter newline).

### 15.5 Below 1280
Panel 280; chat composer keeps full width; suggestions stack. At 1100–1279 the panel is an overlay drawer.

### 15.6 Transovo — AI Producer replaces Underlord
- Rail item **AI Producer** (bottom, `bg-brand-gradient` 32 icon tile, label "AI Producer"), panel title "AI Producer" with `Sparkles` brand-gradient icon; avatar is the Transovo mark, not a robot.
- Empty-state suggestions: "✨ Make clips from this video", "Remove filler words & gaps", "Write titles & descriptions", "Add captions in my brand style".
- AI Tools categories rename: **Clean up** (Edit for clarity, Studio Sound, Remove filler words, Remove retakes, Shorten word gaps, Add chapters), **Look good**, **Write**, **Clips** (Make clips, Re-score clips, Reframe 9:16, Hook rewrite), **Publish**.
- Cost line uses Transovo credits wording; actions not in launch scope are hidden (not disabled).

---

## 16. Comments

**References** (5 images, thin set): `surfaces/16_comments/01_comments_project_steps.png`, `surfaces/16_comments/02_comments_project_view_sort.png`, `surfaces/16_comments/03_comments_projects_unresolve.png`, `surfaces/16_comments/04_editor_comments_panel_in_rooms_hit_esc_t.png`, `surfaces/16_comments/05_commenting_in_descript_press_esc_to_mini.png`
Masters: `02_comments_project_view_sort.png` (Comments side panel + sort menu), `01_comments_project_steps.png` (add comment from selection), `03_comments_projects_unresolve.png` (resolved thread), `05_commenting_in_descript…` (composer; Esc minimises), `04_editor_comments_panel_in_rooms…`.

### 16.1 Wireframe (side panel w320, opened from the top-bar 💬 button, which shows a selected state bg-accent while open)
```
 ┌ 💬 Comments                     ⚙ ┐ header h48; options button 28 (SlidersHorizontal) → menu
 │ ┌ 00:07 ─────────────────────────┐ │ thread card r10 border bg-card p12, gap 8 between cards
 │ │ (S) Stephanie R  2h         ⋯ │ │ avatar 20, name 13/600, time 12 muted, ⋯ on hover (Edit, Copy link, Delete)
 │ │ We can probably cut the …      │ │ body 13/1.5, max 6 lines then "Show more"
 │ │ "quoted transcript text"       │ │ 12 italic muted, left border 2 bg-primary/40 pl8 (anchor)
 │ │ (S) [Reply…                 ] │ │ reply field h36 r8 bg-muted
 │ │                      ✓ Resolve│ │ ghost 28 on hover
 │ └────────────────────────────────┘ │
 └─────────────────────────────────────┘
 Sort/options menu (w220): ✓ Sort by timestamp · Sort by oldest · Sort by newest · divider · Show resolved comments · divider · Copy all comments
```
In the script: commented text has `bg-lane-brand/15` + 2 px underline `lane-brand`; a comment badge (avatar 16) floats in the right gutter of the paragraph; ruler shows comment pins (View ▸ Timeline ▸ Show in time ruler ▸ Comments) as 10 round avatar dots.
Add a comment: selection toolbar "Comment" (§4) or ⌘⌥M → composer card appears in the panel and anchored in the script gutter: textarea min-h 64, @-mentions popup (w240, rows h36 avatar+name+email), footer Cancel ghost + Comment primary h32. Esc minimises the composer to a pill (ref `05`).

### 16.2 States
Current thread (playhead or selection inside its range) `ring-1 ring-primary`. Resolved threads hidden unless "Show resolved"; then shown `opacity-60` with "Resolved by X · Reopen". Empty: `MessageSquare` 24 + "No comments yet" + "Select text and press ⌘⌥M to comment". Posting: card `opacity-70` + spinner; failed: "Not sent · Retry" `text-destructive` 12.

### 16.3 Focus order
Options → thread 1 (Enter jumps playhead) → its reply field → resolve → thread 2 …

### 16.4 Transovo
Comments are per composition; in clip compositions the panel has a scope toggle "This clip | Full video" (segmented h28 under the header). Mentions use Transovo workspace members.

---

## 17. Share & publish (Project access modal, publish to web link, share page)

**References** (17 images): `surfaces/17_share_publish/01_steps_to_open_the_project_access_modal_f.png`, `surfaces/17_share_publish/02_project_access_modal_with_fields_to_invi.png`, `surfaces/17_share_publish/03_project_access_panel_with_dropdown_for_d.png`, `surfaces/17_share_publish/04_copy_link_button_in_project_access_menu.png`, `surfaces/17_share_publish/05_permission_warning_when_access_is_denied.png`, `surfaces/17_share_publish/06_export_window_with_web_link_selected.png`, `surfaces/17_share_publish/07_download_button_in_export_menu.png`, `surfaces/17_share_publish/08_export_menu_with_unpublish_option.png`, `surfaces/17_share_publish/09_export_menu_with_settings_option_highlig.png`, `surfaces/17_share_publish/10_settings_icon_in_the_top_right_of_a_publ.png`, `surfaces/17_share_publish/11_unpublish_option_in_the_settings_menu.png`, `surfaces/17_share_publish/12_download_button_at_the_top_of_a_publishe.png`, `surfaces/17_share_publish/13_link_and_embed_options_on_the_share_page.png`, `surfaces/17_share_publish/14_login_prompt_for_an_embedded_video_with.png`, `surfaces/17_share_publish/15_page_views_icon_on_a_published_share_pag.png`, `surfaces/17_share_publish/16_publish_window_with_share_link_button_hi.png`, `surfaces/17_share_publish/17_custom_branding_example_on_a_descript_sh.png`
Masters: `02_project_access_modal_with_fields_to_invi.png` (modal, ~2.4× crop), `03/04_…dropdown / copy link…`, `05_permission_warning…`, `06–09_export window with web link / download / unpublish / settings`, `10–16_…share page…` (views, settings ⚙, download, Copy link & embed popover, login prompt), `17_custom_branding_example…`.

### 17.1 Project access modal (opened from the top-bar avatars/+ button "Share")
```
 ┌ Project access                                     × ┐ w448, r12, p20; title 16/600, header h52
 │ ┌ steph@descript.com          [Can edit ▾] ┐ [Invite to project] │ email field h40 r8 bg-muted flex with inline role select (h32 inside, bg-background r6);
 │                                                        │ button h40 primary px16
 │ ☐  Also invite to Stephanie's Business Drive           │ checkbox row h36 (only when inviting outside the drive)
 │ (🐶) Stephanie's Business Drive  Team    [Can edit ▾] │ member rows h48: avatar 28, name 14, tag 13 muted, role select h36 outline
 │ (S)  Stephanie R  You                         Owner   │ owner: plain 13 muted right
 │ ────────────────────────────────────────────────────── │
 │ 🔗 [Anyone with the link can view ▾]        Copy link │ footer h56: link icon 16, select h36 outline, ghost button
 └────────────────────────────────────────────────────────┘
```
Role options: Can edit · Can comment · Can view · divider · Remove (destructive). Link options: Only people invited · Anyone in the drive can view/edit · Anyone with the link can view/comment.
Copy link → button text swaps to "✓ Copied" 2 s + toast. Permission warning (ref `05`): Alert amber inside the modal "Bob doesn't have access to this drive. They'll get view-only access" with "Invite anyway".

### 17.2 Publish (web link) — this is the Export popover with Destination = Web link (§18)
After publish, the popover shows: link field (read-only, h36, mono 12) + Copy; "View page ↗"; footer icon buttons Download, Settings ⚙, Link, Embed `</>`, and ⋯ ▸ Unpublish (destructive confirm dialog "Unpublish? The link will stop working" Cancel / Unpublish).

### 17.3 Share page (public viewer at /share/:id)
```
 ┌ (logo) Brand   Title – v2               👁 2,473 views  💬  ⤓  🔗  ⚙  [Edit] (DR) ┐ header h56 bg-background border-b
 ├─────────────────────────────────────────────────────────────┬─────────────────────┤
 │                  video player (16:9, max-w 1080, r12)       │ » Transcript         │ right panel w360 collapsible (»)
 │                 ▶ big play 72 round bg-black/70             │ "by Mariana Blake    │
 │ ▶ 🔊 0:12 / 5:46 ────────────── 1.25x  CC  ⛶  (bar h44)     │  April 7, 2025"      │
 │                                                              │ transcript 15/1.7,  │
 │ Title 24/600 · description 14 muted                          │ current word hl     │
 └─────────────────────────────────────────────────────────────┴─────────────────────┘
 Copy link & embed popover (from 🔗; w420): row link + "Copy link" ghost; ☑ "Start at 00:05"; row </> + iframe code box (mono 12, bg-muted, r8, 4 lines) + "Copy code"
```
Settings ⚙ menu: Allow downloads, Show transcript, Allow comments, Require sign-in to view (ref `14` login prompt), Unpublish. Views 👁 button opens a "Page views" popover (count + list of viewers when signed in).

### 17.4 States
Loading share page: player skeleton 16:9 + transcript lines skeleton. Processing (just published): player shows "Processing video… 34%" over the poster. Unpublished / no access: centred card w400 "This video isn't available" + Sign in. Errors in the modal: inline under the email field "Enter a valid email" 12 destructive.

### 17.5 Focus order
Modal: email → role → Invite → checkbox → member role selects → link select → Copy link → close (Esc). Share page: header buttons left→right → player (Space play/pause, ←/→ 5 s, C captions, F fullscreen) → transcript.

### 17.6 Below 1280
Share page: transcript panel moves below the player under 1100 (full width). Modal fixed w448 (min(448, 100vw−32)).

### 17.7 Transovo
- Share page header uses the workspace **brand kit** (logo, accent) — default Transovo logo with "Made with Transovo" footer link (removable on paid plans).
- For clip compositions, publish also offers **Post to TikTok / YouTube Shorts / Instagram Reels** rows (connected accounts) in the Export popover (§18), not on the share page.

---

## 18. Export popover (all tabs)

**References** (15 images): `surfaces/18_export_dialog/01_export_panel_in_descript_showing_local_e.png`, `surfaces/18_export_dialog/02_export_audio_settings_in_descript.png`, `surfaces/18_export_dialog/03_descript_export_panel_showing_how_to_exp.png`, `surfaces/18_export_dialog/04_screenshot_of_export_window_for_transcri.png`, `surfaces/18_export_dialog/05_2025_03_07_10_47_20_png.png`, `surfaces/18_export_dialog/06_export_window_with_thumbnail_option.png`, `surfaces/18_export_dialog/07_select_resolution_in_export_panel.png`, `surfaces/18_export_dialog/08_youtube_selected_as_export_destination.png`, `surfaces/18_export_dialog/09_export_window_in_descript_with_captivate.png`, `surfaces/18_export_dialog/10_exporting_to_hubspot_from_descript.png`, `surfaces/18_export_dialog/11_export_subtitles_or_transcripts_in_descr.png`, `surfaces/18_export_dialog/12_select_multiple_languages_for_export_in.png`, `surfaces/18_export_dialog/13_example_export_showing_a_descript_waterm.png`, `surfaces/18_export_dialog/15_descript_export_video.png`, `surfaces/18_export_dialog/16_descript_export_subtitles.png`
Masters: `01_export_panel_in_descript_showing_local_e.png` (Video tab, local export, Advanced open), `07_select_resolution_in_export_panel.png` (web-link destination, 2×), `02_export_audio_settings…`, `04/11_…transcript…` (Transcript tab), `16_descript_export_subtitles.png` (Subtitles), `06_…thumbnail option`, `08/09/10_…YouTube / Captivate / HubSpot destinations`, `12_select_multiple_languages…`, `13_…watermark`.

### 18.1 Wireframe (anchored under the top-bar Export button, right-aligned to it, 8 gap)
```
 ┌ Export                                                × ┐ w420, max-h = viewport − 72 (scrolls), r12; header h52, title 16/600
 │ [▓Video▓| Audio | GIF | Timeline | Transcript | Subtitles] │ segmented h32 in p4 bg-muted r10, mx16; active bg-background shadow-xs
 │ ┌──────────────── preview 16:9 r10 ───────────────────┐ │ w388; chips bottom-right: "⏱ 0:15" "🗎 ~26 MB" h22 bg-black/60 text-white 11
 │ └──────────────────────────────────────────────────────┘ │ (Transcript/Subtitles tabs: composition chip instead: thumb 32×18 + name in a muted pill h36)
 │ Destination                      [⤓ Local export     ▾] │ rows h40 px16: label 13 left, select h32 outline right (auto width, max 220)
 │ Export options                   [Current composition ▾] │
 │ Resolution                       [Max (1080p)        ▾] │
 │ Quality                          [Recommended        ▾] │
 │ Advanced                                              ˄ │ collapsible header h40 13/600
 │ Format                                    [MP4 | GIF]   │ segmented h28
 │ Audio                                              ⚙   │ settings popover (codec, sample rate, bitrate)
 │ Metadata                                     ⚙   (◐)   │
 │ Disable hardware acceleration                     (○)   │
 │ Include subtitle track  ⓘ                         (◐)   │
 │ ──────────────────────────────────────────────────────── │
 │ [                    Export                           ] │ footer p16: primary full width h40
 └──────────────────────────────────────────────────────────┘
```

### 18.2 Tab contents (rows in order; defaults in brackets)
| Tab | Rows |
|---|---|
| Video | Destination [Local export] (Local export · Web link (Descript) · YouTube · Other: Captivate, HubSpot, Buzzsprout… · Connect…); Export options [Current composition] (Current composition / Selection / All compositions); Resolution [Max (1080p)] (Max, 4K, 1080p, 720p, 540p, 480p); Quality [Recommended] (Recommended, High, Medium, Low); Advanced: Format MP4/GIF, Audio ⚙, Metadata ⚙ + switch, Disable hardware acceleration, Include subtitle track, Thumbnail (ref `06`: choose frame / upload); Watermark notice on free plan (ref `13`) |
| Video, Web link destination | Resolution [Max]; Access [Anyone with the link] (Only me, Drive, Anyone with link); divider; Language [Original]; footer: primary "Publish" (or "Update" once published) w≈230 + icon buttons 36: Download, Settings, Copy link, Embed `</>`, Open page 🌐 |
| Audio | Destination; Format [WAV] (WAV, MP3, AAC, FLAC); Quality / sample rate; Export as [Single file] (Single file / Separate tracks per speaker (multitrack)); Include markers (for MP3 chapters); Loudness normalisation [−16 LUFS] |
| GIF | Resolution [480p]; Frame rate [15 fps]; Loop [Forever]; Size estimate |
| Timeline | Format [Final Cut Pro XML] (FCPXML, Premiere XML, AAF (Pro Tools)); Include media files (switch); Handles [0 s] |
| Transcript | Destination; Format [Microsoft Word (.docx)] (.docx, .txt, .md, .html, .rtf); switches: Include composition name, Include markers, Include ignored text, Include speaker labels, Speaker labels on every paragraph; Timecodes ⚙ (none / every paragraph / every N s); divider; Language [Original] |
| Subtitles | Destination; Format [SRT] (SRT, VTT); Max characters per line [32]; Max lines [2]; Include speaker names; Burn-in → link to Captions (§6); Language(s) multi-select (ref `12`: checkbox list with "Translated" badges) |

### 18.3 States
- Exporting (local): footer button becomes a determinate progress bar h40 "Exporting 34% · 1:12 left" + Cancel ghost; the Export top-bar button shows a 16 progress ring; on done toast "Export ready · Show in folder / Download".
- Publishing (web): "Publishing… 52%" then the link row (§17.2).
- Disabled: Export disabled while transcription/processing is running ("Wait for processing to finish" tooltip). Destination requiring a connection shows "Connect YouTube" button instead of Export.
- Error: Alert destructive above the footer "Export failed: not enough disk space" + Retry; GIF tab disabled for > 60 s compositions with reason.

### 18.4 Focus order
Close → tabs (←/→) → rows top→bottom (select, segmented, switches, settings buttons) → Advanced toggle → footer primary → footer icon buttons. Esc closes and returns focus to Export.

### 18.5 Below 1280
Unchanged width; at heights < 800 the preview shrinks to h160 and the body scrolls; footer stays sticky.

### 18.6 Transovo
- The top-bar Export button is the single `PrimaryButton` (brand gradient) of the editor.
- Destinations add **TikTok, YouTube Shorts, Instagram Reels** (each shows caption/title fields + "Post now / Schedule" after connecting).
- Export options gain **All clips (N)** for clipper projects → batch export with a per-clip progress list (rows h40: thumb, title, %, status icon).
- Resolution defaults to 1080×1920 for 9:16 clips; burn-in captions toggle defaults on for clips.

---

## 19. Version history

**References** (7 images): `surfaces/19_version_history/01_working_in_projects_version_history.png`, `surfaces/19_version_history/02_working_in_projects_version_history.png`, `surfaces/19_version_history/03_working_in_projects_version_history.png`, `surfaces/19_version_history/04_working_in_projects_version_history.png`, `surfaces/19_version_history/05_working_in_projects_version_history.png`, `surfaces/19_version_history/06_automatic_backups_in_descript_debug_menu.png`, `surfaces/19_version_history/07_success_message_for_importing_a_project.png`
Masters: `02_working_in_projects_version_history.png` (panel header + filter menu "Show all revisions", 2×), `04_…version_history.png` (preview mode banner + Restore on hover), `01/03/05` (opening from the app menu, list states), `06_automatic_backups_in_descript_debug_menu.png`, `07_success_message_for_importing_a_project.png`.

### 19.1 Wireframe (side panel w320, opened from App menu ▸ Version history)
```
 Top of main card while previewing (full width, h36, bg-warning/15 text-warning-foreground 13, centred):
   Viewing an old version from about 1 hour ago. To edit this project, return to latest version.   (link underlined)
 ┌ Version History                  ⚙  × ┐ header h48, title 14/600, options (SlidersHorizontal) 28, close 28
 │ (👤) May 30 at 2:54 PM                   │ rows h64 px16: avatar 24 at x16; 1 px vertical connector bg-border at avatar centre
 │  │   8 minutes ago                       │ title 13/500, sub 12 muted
 │ (👤) May 30 at 1:49 PM        [Restore] │ selected/previewed row bg-primary/10, Restore ghost h28 on hover/selected
 │  │   about 1 hour ago                    │
 │ (👤) May 30 at 1:36 PM                   │
 └──────────────────────────────────────────┘
 Options menu (w200): ☐ Show all revisions (default shows named/major versions only)
```

### 19.2 Behaviour & states
- Click a row → read-only preview of that version (editor chrome stays; script and canvas show that version; editing disabled, cursor not-allowed; banner appears).
- Restore → confirm dialog w400 "Restore this version? Your current version is saved in history." Cancel / Restore → toast "Restored version from May 30 at 1:49 PM · Undo".
- "return to latest version" exits preview.
- Loading: 6 skeleton rows; Error: "Couldn't load history · Retry"; Empty (new project): "No earlier versions yet".
- Import project success toast (ref `07`).

### 19.3 Focus order
Options → close → rows (↑/↓ previews, Enter restores via the dialog) → banner link reachable first via F6.

### 19.4 Transovo
Version entries also record AI Producer runs as named versions ("Before AI Producer: Make clips") so a whole AI pass can be restored in one click; label `text-lane-ai` icon `Sparkles` 12 before the title.

---

## 20. Settings modal

**References** (16 images): `surfaces/20_settings/01_opening_settings_from_the_profile_icon_i.png`, `surfaces/20_settings/02_opening_settings_from_the_drive_selector.png`, `surfaces/20_settings/03_opening_settings_from_the_editor_menu_in.png`, `surfaces/20_settings/04_the_ai_models_settings_panel_showing_mod.png`, `surfaces/20_settings/05_app_settings_showing_connected_apps.png`, `surfaces/20_settings/06_profile_tab_of_settings_showing_steps_fo.png`, `surfaces/20_settings/07_settings_page_showing_notification_tab.png`, `surfaces/20_settings/08_changing_the_profile_image_and_profile_n.png`, `surfaces/20_settings/09_email_update_app_settings.png`, `surfaces/20_settings/10_general_app_settings_with_show_wordless.png`, `surfaces/20_settings/11_hide_general_workspace_app_settings.png`, `surfaces/20_settings/12_members_tab_showing_list_of_users.png`, `surfaces/20_settings/13_settings_menu_showing_members_tab.png`, `surfaces/20_settings/14_usage_tab_in_descript.png`, `surfaces/20_settings/15_creating_a_new_drive_in_descript_setting.png`, `surfaces/20_settings/16_toggle_app_theme_in_account_settings.png`
Masters: `10_general_app_settings_with_show_wordless.png` (**true 1440×900 1×** — modal measured directly), `01/02/03_opening settings…` (entry points: profile icon, drive selector, editor app menu), `04_…AI models…`, `05_…connected apps`, `06/08_profile…`, `07_…notification tab`, `12/13_members…`, `14_usage tab…`, `15_creating a new drive…`, `16_toggle app theme…`.

### 20.1 Wireframe (measured at 1440×900)
```
 dim overlay bg-black/60 over Home/editor
         x320                                                   x1119
 y90  ┌──────────────┬──────────────────────────────────────────────┐
      │ General      │ General                                    × │ content header h56, title 18/600
      │              │ ─────────────────────────────────────────── │
      │ ACCOUNT      │ Notify of transcription glossary updates ⓘ (◐)│ setting rows h48: label 14, ⓘ 14 muted (tooltip), control right
      │ ◉ Profile    │ USB foot pedal ⓘ          [Connect foot pedal] │ button outline h32
      │ ✦ AI models  │ Advanced                                       │ group title 13/600 muted, mt16 mb4
      │ 🔔 Notific…  │ ┌──────────────────────────────────────────┐ │ grouped card r10 border divide-y, rows h48 px16
      │ ⧉ Connected… │ │ Automatic volume levels ⓘ           (◐) │ │
      │ ⌘ Descript MCP [New] │ Show volume in decibels ⓘ   (○) │ │
      │ 🔑 API tokens│ │ Use room tone on gap clips ⓘ         (◐) │ │
      │              │ │ Apply Smart transitions to new scenes (◐)│ │
      │ DRIVE        │ │ Show wordless media in script [Beta] (○) │ │
      │ [Drive ▾]    │ │ Force software video decoding        (○) │ │
      │ ⚙ Preferences│ │ Limit preview resolution to 1080p    (○) │ │
      │ 👥 Members   │ │ Default translation style      [Auto ▾] │ │
      │ ▦ Workspaces │ │ Always show usage info               (○) │ │
      │ ◈ Plan       │ └──────────────────────────────────────────┘ │
      │ ▤ Usage      │ Labs                                           │
      │ 🧾 Invoices  │ ┌ New timeline ⓘ (◐) · Underlord Beta (◐) ┐   │
 y808 └──────────────┴──────────────────────────────────────────────┘
       nav w236                      content w564 (p24, scrolls)
```
| Element | 1440×900 | 1280×800 | Notes |
|---|---|---|---|
| Modal | 800×720 (x320–1119, y90–808), r12, `bg-popover shadow-lg` | 800×min(720, 100vh−64) | centred; max-w calc(100vw−64) |
| Nav | w236, p8, `bg-surface-raised` (left of the modal), border-r | same | items h32 r8 px8 icon 16 + 13; group overlines 11 uppercase muted mt16 |
| Content | w564, p24, scroll | — | header sticky |
| Row | h48 (min), label 14, sub-text 12 muted under label when present | — | control right-aligned, 16 from the edge |

### 20.2 Pages (nav order)
General · **Account**: Profile (avatar 64 + change, Name, Email, Password, Theme Light/Dark/System segmented — ref `16`), AI models (model picker list with radio rows h56 + provider badge — ref `04`), Notifications (email/in-app switches matrix — ref `07/09`), Connected apps (rows h56: logo 32, name, status, Connect/Disconnect — ref `05`), Descript MCP [New], API tokens · **Drive**: drive picker select h36, Preferences, Members (table: avatar, name, email, role select, last active, ⋯; "Invite members" primary — ref `12/13`), Workspaces, Plan (current plan card + Upgrade), Usage (meters: transcription hours, AI credits — bar h8 r-full with `bg-primary` fill + "12 / 30 hrs" — ref `14`), Invoices (table with Download links). "+ Create drive" at the bottom of the drive picker (ref `15`).

### 20.3 States
Nav item hover `bg-accent/60`, active `bg-accent text-foreground font-medium`. Switches save instantly (toast only on failure: "Couldn't save setting · Retry" and the switch reverts). Loading page: skeleton rows. Admin-only pages for non-admins: lock icon + "Ask an admin" text, controls disabled.

### 20.4 Focus order
Close → nav items (↑/↓; Enter opens page) → content controls top→bottom. Esc closes; focus returns to the opener.

### 20.5 Below 1280
At < 900 width: modal becomes full-screen sheet; nav collapses into a select h36 at the top.

### 20.6 Transovo
- Transovo nav: **General** · Account: Profile, Notifications, Connected accounts (TikTok, YouTube, Instagram, Google Drive), API tokens · Workspace: Members, **Brand** (link to /app/brand), Plan & credits, Usage, Invoices.
- General rows (launch): Automatic volume levels, Show volume in decibels, Use room tone on gap clips, Apply smart transitions to new scenes, Default caption style [Bold Pop ▾], Default clip aspect ratio [9:16 ▾], Limit preview resolution to 1080p, Theme (Dark default).
- No Labs card at launch; no foot pedal.

---

## 21. Recording: editor recorder bar, settings, REC states, screen recorder, countdown, permissions

**References** (20 images): `surfaces/21_recording_editor_screen/01_descript_editor_with_record_button_highl.png`, `surfaces/21_recording_editor_screen/02_playhead_marker_showing_where_script_rec.png`, `surfaces/21_recording_editor_screen/03_script_selection_highlighted_for_replace.png`, `surfaces/21_recording_editor_screen/04_scene_highlighted_for_recording_into_a_n.png`, `surfaces/21_recording_editor_screen/05_upload_progress_notification_while_recor.png`, `surfaces/21_recording_editor_screen/06_recorder_options_in_descript.png`, `surfaces/21_recording_editor_screen/07_editor_recorder_settings_menu.png`, `surfaces/21_recording_editor_screen/08_framing_and_center_me_tools_in_editor_re.png`, `surfaces/21_recording_editor_screen/09_arrows_pointing_out_the_location_of_quic.png`, `surfaces/21_recording_editor_screen/10_screen_recorder_app_launcher_ui.png`, `surfaces/21_recording_editor_screen/11_grant_permission_buttons_for_screen_reco.png`, `surfaces/21_recording_editor_screen/12_dock_layout_showing_recording_input_opti.png`, `surfaces/21_recording_editor_screen/13_custom_region_selection_for_screen_recor.png`, `surfaces/21_recording_editor_screen/14_screen_recorder_dock_in_descript.png`, `surfaces/21_recording_editor_screen/15_selecting_inputs_in_the_descript_screen.png`, `surfaces/21_recording_editor_screen/16_browser_prompt_requesting_camera_and_mic.png`, `surfaces/21_recording_editor_screen/17_recording_countdown_png.png`, `surfaces/21_recording_editor_screen/18_async_record_menu.png`, `surfaces/21_recording_editor_screen/90_descriptcom_screen_recorder_bubble.png`, `surfaces/21_recording_editor_screen/91_descriptcom_screen_recording_countdown.png`
Masters: `07_editor_recorder_settings_menu.png` (recorder bar replacing the transport + settings popover), `02_playhead_marker_showing_where_script_rec.png` (REC pill on the script playhead), `03_script_selection_highlighted_for_replace.png`, `05_upload_progress_notification…`, `06_recorder_options…` (recording toolbar), `08_framing_and_center_me…`, `10–15_screen recorder…`, `16_browser_prompt…`, `17_recording_countdown_png.png`, `18_async_record_menu.png`, `90/91_descriptcom…` (bubble, countdown).

### 21.1 Editor recorder bar (replaces the transport row, h44 → h52 while armed)
```
 [×] [📷 No camera ▾] [🎙 M2 ▾] [🖥 No screen shared ▾]   [● Record into script ▾]  [⚙] [📜]
   28   select h32 w140   w150        w150                 split button h32 w165       28   teleprompter 28
```
- Selects: outline h32 r8, icon 16 + label 13 trunc + chevron; device menu rows h32 with ✓ current, VU bar under the mic menu items.
- Record split button: `bg-[oklch(0.62_0.22_25)]` (record red, use `bg-lane-record`) text-white; left part "● Record into script", right chevron opens: Record into script / Record into new scene / Record into new composition / Record to project files.
- Settings popover (⚙, w288, grouped cards r10 p12, gap 8, rows h36):
  - **General**: Countdown (switch, default on).
  - **Microphone audio**: Transcription (switch), Default speaker (select), Studio Sound (⚙ + switch), Auto gain control ⓘ (switch).
  - **Computer audio**: Transcription, Default speaker, Studio Sound.
  - **Camera**: Default resolution [4k ▾].

### 21.2 While recording
| Element | Spec |
|---|---|
| Countdown | 3-2-1 centred over the canvas: circle 160 `bg-black/60` text 96/700 white (ref `17` shows "4"; default 3 s); Esc cancels |
| Script playhead pill | "● REC 0:00" h24 r-full `bg-lane-record text-white` 12/600 mono at the insertion point; text appears live as transcription streams |
| Replace mode | selected words get `bg-lane-record/20` + strike until recording ends, then replaced (ref `03`) |
| Recording toolbar | in the transport row: 🗑 discard · ⟲ restart · ⏸ pause · [■ 00:12] stop (red h32 px12 mono) · layout · ⚙ — all 32 |
| Camera framing | overlay on canvas: rule-of-thirds 1 px white/30 + face box; "Center me" button h28 (ref `08`) |
| Upload card | bottom-left floating w320 r12: "Activity" 13/600 + row "Uploading video recording… 89.9%" with progress h4 `bg-primary` (ref `05`) |

### 21.3 Screen recorder (desktop app dock, ref `10–15`)
```
 ┌───────────────────────────────────────────────────────────────┐ floating dock w≈560 h64 r16 bg-popover shadow-lg
 │ [Quick share ◐] │ 📷 Cam ▾ │ 🎙 Mic ▾ │ 🖥 Screen ▾ │ ( ● ) │ ⚙ │ ×│  big record button 44 round red
 └───────────────────────────────────────────────────────────────┘
 Recording: [⏸ Pause] [■ Stop 00:42] [⟲ Restart] [Cancel]   camera bubble 160 round, draggable (ref 90)
 Custom region: dashed 2 px primary rectangle, W×H fields h28 w64 next to it + Start
```
Permissions (first run, ref `11/16`): card w480 list rows h56: Screen recording · Computer audio · Microphone · Camera, each with status dot and "Grant" outline button; browser prompt explainer.

### 21.4 Record menu & async (ref `18`, see §2)
Menu w296, items h56 with 84×46 thumbs: Camera · Screen · Audio only · Invite others to record ▸ (submenu w290: Start a recording now, Invite to record async, Schedule for later).

### 21.5 States
No devices: selects show "No camera found" muted + "Check permissions" link. Permission denied: inline Alert in the bar's place "Microphone access is blocked · How to fix". Upload failed: card row turns destructive with Retry. Disabled Record when no input selected (tooltip "Choose a camera, mic or screen").

### 21.6 Focus order
× → camera → mic → screen → Record (Space/R starts) → menu chevron → settings → teleprompter. While recording: Stop is focused; ⌘⇧Space pauses; Esc during countdown cancels.

### 21.7 Below 1280
Select labels truncate to icon + chevron below 1100 (tooltip shows device name).

### 21.8 Transovo
Scope (gap matrix M14/M16/M18): the editor recorder (camera, mic, screen, screen+camera via getUserMedia/getDisplayMedia), countdown, pause/restart, replace-selection re-record and the upload card are **launch**. The desktop screen-recorder dock (§21.3) is the M18 desktop companion, **post-launch**; in the web app, the Record menu's Screen item uses the browser picker. Record button uses `bg-lane-record`, never the brand gradient. Recording into a clip composition is disabled ("Record in the full video").

---

## 22. Teleprompter

**References** (5 images, thin set): `surfaces/22_teleprompter/01_teleprompter_button_location_in_editor_r.png`, `surfaces/22_teleprompter/02_teleprompter_button_location_in_screen_r.png`, `surfaces/22_teleprompter/03_teleprompterrooms_png.png`, `surfaces/22_teleprompter/04_teleprompter_controls.png`, `surfaces/22_teleprompter/05_recording_interface_in_descript_showing.png`
Masters: `04_teleprompter_controls.png` (panel + controls row), `01_teleprompter_button_location_in_editor_r.png` (icon in the recorder bar), `02_…in_screen_r…` (screen-recorder header), `03_teleprompterrooms_png.png` (Rooms bottom button), `05_recording_interface…`.

### 22.1 Wireframe (floating panel, default top-centre of the canvas pane, draggable by its body)
```
 ┌──────────────────────────────────────────────────────────── ⤢  × ┐ w680 h360 (min 400×200, resizable from corners), r12
 │                                                                     │ bg-[oklch(0.12_0_0)] (near-black, always dark), text white
 │   Paste, type, or import from script ⤒                              │ placeholder 28/500 white/50, left-aligned, p32
 │   (script text 32/1.5, current line white, others white/40)         │ reading line indicator: 2 px bg-primary/60 at 33 % height
 │                                                                     │
 │ ─────────────────────────────────────────────────────────────────── │
 │ Aa ━━●━━━   ⇣ ━━━●━━   ⟲   ▶   ⤒   ⇋   ◑   ⚙                      │ controls row h48 px16, gap 12; icons 18 white/80
 └─────────────────────────────────────────────────────────────────────┘
```
Controls in order: text-size slider (w96, 16–72 px, default 32) · scroll-speed slider (w96, 1–10, default 4) · restart ⟲ · play/pause ▶ (auto-scroll; also auto-starts with recording if "Start with recording" is on) · import from script ⤒ (replaces text with the composition's script) · mirror ⇋ (flip horizontally) · contrast ◑ (white-on-black / black-on-white) · settings ⚙ (Start with recording, Show reading line, Font). Expand ⤢ → full-screen over the editor.

### 22.2 States
Hover on the panel shows the controls row (it hides 2 s after the pointer leaves while scrolling). Empty: placeholder as drawn. Text is editable when paused (contenteditable, caret white). Playing: ▶ → ⏸; scroll pauses on wheel/scroll by hand.

### 22.3 Focus order
Text area → size → speed → restart → play → import → mirror → contrast → settings → expand → close. Space toggles play when the panel has focus; ↑/↓ change speed.

### 22.4 Entry points
Recorder bar 📜 (§21.1), screen-recorder header, Rooms bottom bar "Teleprompter" (§24).

### 22.5 Transovo
Launch (gap matrix M16): editor recorder and Rooms host/co-host. In the web app the panel lives in the page; the M16 note applies: use `selfBrowserSurface:'exclude'` so it isn't captured when sharing this tab. A teleprompter hidden from capture on desktop is M18. Import pulls from the current composition's script.

---

## 23. Rooms: lobby / pre-join, roles, scheduling

**References** (11 images): `surfaces/23_rooms_lobby_prejoin/01_pre_join_screen_in_descript_rooms_showin.png`, `surfaces/23_rooms_lobby_prejoin/02_guest_setup_screen_in_descript_rooms_bef.png`, `surfaces/23_rooms_lobby_prejoin/03_dropdown_to_change_role_before_entering.png`, `surfaces/23_rooms_lobby_prejoin/04_host_approval_screen_showing_options_to.png`, `surfaces/23_rooms_lobby_prejoin/05_invite_participants_using_role_based_roo.png`, `surfaces/23_rooms_lobby_prejoin/06_record_with_others_option_in_descript_ro.png`, `surfaces/23_rooms_lobby_prejoin/07_record_with_others_option_from_the_proje.png`, `surfaces/23_rooms_lobby_prejoin/08_record_with_others_entry_point_from_the.png`, `surfaces/23_rooms_lobby_prejoin/09_scheduling_window_for_a_rooms_session.png`, `surfaces/23_rooms_lobby_prejoin/10_scheduled_rooms_event_details_with_invit.png`, `surfaces/23_rooms_lobby_prejoin/11_green_room_setup_in_squadcast_before_joi.png`
Masters: `01_pre_join_screen_in_descript_rooms_showin.png` (host pre-join, ~1×), `02_guest_setup_screen…` ("Request Room"), `03_dropdown_to_change_role…`, `04_host_approval_screen…`, `05_invite_participants…`, `06/07/08_record with others entry points`, `09_scheduling_window…`, `10_scheduled_rooms_event_details…`, `11_green_room_setup_in_squadcast…` (older SquadCast-era reference, for layout only).

### 23.1 Wireframe (full page, no editor chrome; 1440×900)
```
 ┌ (logo) Descript Rooms                                                   (?) (avatar) ┐ top bar h56
 │                                                                                       │
 │        ┌──────────── card w520 r12 border bg-card ─────┐     Let's check your audio   │
 │        │ ┌─────── preview 16:9 (488×274) r8 ──────────┐│     and video!                │ 20/600, max-w 360
 │        │ │  (self video, mirrored) VU ▮▮▮▯▯ bottom-left ││     Are you using headphones? │ 14
 │        │ └────────────────────────────────────────────┘│     [ Yes ] [ No ]            │ 2 toggle buttons h36 w88
 │        │ 📷 [FaceTime HD Camera      ▾] [1080p ▾]      │     Your name                 │
 │        │ 🎙 [MacBook Pro Microphone  ▾]                │     [ Selina          ][Host ▾]│ input h36 + role select h36 w96
 │        │ 🔊 [MacBook Pro Speakers    ▾]   (▶ test)     │     [        Join           ] │ full-width h36 dark primary
 │        └───────────────────────────────────────────────┘     By joining you agree to…  │ 12 muted
 └───────────────────────────────────────────────────────────────────────────────────────┘
   content block centred: card (520) + gap 48 + column (360) = 928 wide; vertically centred
```
| Element | 1440×900 | 1280×800 | Notes |
|---|---|---|---|
| Card | w520, p16 | w480 | device rows h40 (icon 16 + select h36 flex); resolution select w96 |
| Right column | w360 | w340 | stack gap 16 |
| Role select | Host · Co-Host · Producer · Viewer · Guest (ref `03`) | — | Guest sees "Request Room" instead of Join (ref `02`) |

### 23.2 States
Camera off: preview `bg-muted` with avatar initials 64 + "Camera is off". Permissions blocked: preview shows Alert "Allow camera and microphone access" + "Try again". Waiting for approval (guest): button "Waiting for the host…" disabled + spinner. Host approval (ref `04`): toast-card top-right in the room "Bob wants to join · Deny / Admit" w320.
Join disabled until name is filled (and headphones answered).

### 23.3 Scheduling (ref `09/10`)
Schedule modal w480: Title · Date and time (date + time pickers h36, timezone 12 muted) · ▸ Advanced options (Recording quality, Record audio only, Auto-start recording, Separate tracks — switches h40) · footer Cancel / Save. Event details card: title, time, "Copy link", "Add to Google Calendar", "Add to Calendar (.ics)" buttons h32, invite list.

### 23.4 Focus order
Camera → resolution → mic → speaker → test → Yes/No → name → role → Join.

### 23.5 Below 1280
< 1000: stack column under the card (card w = min(520, 100vw−32)).

### 23.6 Transovo
Rooms is **launch-required** (gap matrix M15, LiveKit; scheduling with .ics and async links are M16). The page is dark by default and uses the Transovo logo. Join is the page's single `PrimaryButton`. Defaults per gap matrix: echo cancellation, noise suppression and AGC are off (raw audio), and EC turns on automatically when the person answers "No" to headphones. Roles at launch are host, guest and producer (co-host/viewer later unless the matrix adds them).

---

## 24. Rooms: in-room (host, producer, guest)

**References** (20 images): `surfaces/24_rooms_in_room_host/01_the_control_room_inside_a_descript_rooms.png`, `surfaces/24_rooms_in_room_host/02_default_rooms_layout_in_descript.png`, `surfaces/24_rooms_in_room_host/03_vu_meter_in_descript_rooms_showing_ideal.png`, `surfaces/24_rooms_in_room_host/04_people_panel_in_descript_rooms_showing_n.png`, `surfaces/24_rooms_in_room_host/05_pin_participant_option_in_the_descript_r.png`, `surfaces/24_rooms_in_room_host/06_producer_using_push_to_talk_to_speak_to.png`, `surfaces/24_rooms_in_room_host/07_push_to_talk_notification_with_red_hand.png`, `surfaces/24_rooms_in_room_host/08_push_to_talk_temporarily_silenced.png`, `surfaces/24_rooms_in_room_host/09_timer_showing_elapsed_recording_time_in.png`, `surfaces/24_rooms_in_room_host/10_notification_banner_in_descript_rooms_sh.png`, `surfaces/24_rooms_in_room_host/11_recording_notification_shown_to_particip.png`, `surfaces/24_rooms_in_room_host/12_sharing_your_screen_in_descript_rooms.png`, `surfaces/24_rooms_in_room_host/13_stop_screen_share_button_in_descript_roo.png`, `surfaces/24_rooms_in_room_host/14_captions_displayed_in_the_rooms_interfac.png`, `surfaces/24_rooms_in_room_host/15_stop_recording_button_in_descript_rooms.png`, `surfaces/24_rooms_in_room_host/16_changing_a_participant_s_role_from_the_p.png`, `surfaces/24_rooms_in_room_host/17_accessing_the_room_settings_menu_in_desc.png`, `surfaces/24_rooms_in_room_host/18_roomsroles_png.png`, `surfaces/24_rooms_in_room_host/90_descriptcom_rooms_people_panel.png`, `surfaces/24_rooms_in_room_host/91_descriptcom_rooms_host_controls.png`
Masters: `08_push_to_talk_temporarily_silenced.png` (~1×, 1632 wide: full layout with Producer mode, People panel), `02_default_rooms_layout…`, `04_people_panel…`, `01_the_control_room…`, `05_pin_participant…`, `06/07_push to talk…`, `09_timer…`, `10/11_notification banner / recording notification`, `12/13_screen share`, `14_captions…`, `15_stop recording…`, `16/17/18_roles & settings`, `90/91_descriptcom…`.

### 24.1 Wireframe (1440×900, dark stage)
```
 ┌ ← Back to editor            Selina's Room / Episode 1 ▾            [Invite] (avatar) (?) ┐ top bar h48
 ├───────────────────────────────────────────────────────────────┬────────────────┬──────┤
 │ ▓ Producer Mode — only producers can hear you   [To: Nikki ▾] [Push to talk] │ People │ 👥   │ banner h40 bg-[olive/30] (optional)
 │ ┌─────────────── tile 16:9 ─────────────┐ ┌──────────── tile ───────────┐   │ w296   │People│ mini rail w80
 │ │                                        │ │                              │   │        │ 💬   │
 │ │ ▢ Selina (Host)               🎙✕     │ │ Nikki                        │   │Recorded│ Chat │
 │ └── active speaker: 3 px green border ───┘ └──────────────────────────────┘   │ (2)    │      │
 │                       gap 12; tiles fill width, max 2 per row ≤4 people          │ card…  │      │
 ├──────────────────────────────────────────────────────────────────────────────┤ Not rec.│      │
 │ [Editor comment]       ( ● Record )  🎙  📷  🖥 Share  [Leave]   ● REC 0:27 │ (3)     │      │ bottom bar h72
 └──────────────────────────────────────────────────────────────────────────────┴─────────┴──────┘
   stage = 1440 − 296 − 80 = 1064 wide at 1440 (904 at 1280); stage padding 16
```
| Element | Spec |
|---|---|
| Top bar | h48 `bg-background` border-b; centre room/episode select 14/600; Invite outline-dark h32 |
| Stage | `bg-[oklch(0.1_0_0)]`, tiles r12, name tag bottom-left h24 r6 `bg-black/60` 12 white; mic-off badge 20 red; active speaker 3 px `oklch(0.72 0.17 150)` ring |
| Bottom bar | h72; Record = 48 round red with label "Start" 11 under; Mic/Video/Share 44 round `bg-white/10`; Leave pill h40 `bg-destructive/20 text-destructive`; REC timer pill "● REC 0:27 | Rooms" h28 |
| People panel | w296; section headers "Recorded (2)" / "Not Recorded (3)" 12/600 uppercase muted; participant card h56: avatar 32, name 13/600, role select ▾ 12, mic, cam, ⋮ (Pin participant, Remove participant, Move to Control Room / Recording Room); **Connection** block: "94% uploaded" bar h4, "Internet connection is good" + green dot; **Audio & video**: Echo cancellation switch, camera/mic/speaker selects h36 |
| Mini rail | w80, items 64×56 (People, Chat, Settings) — same component as the editor rail at a compact item size |

### 24.2 States & overlays
Banners (stage top, h40, dismissible): "Videos in the Room may appear lower resolution… recordings are full quality", "Heads up: You're recording in audio only". Modal "The host has started a recording" w400 with ☐ Don't show this again + OK. Push-to-talk active: red hand icon toast on the target's tile (ref `07`). Recording: Record → "■ 2:18" stop button (red, mono). Screen share: shared screen takes the main tile, others become a filmstrip row h96 at the bottom; "Stop share" pill. Captions (ref `14`): live caption strip at the stage bottom 16/500 white on black/60.

### 24.3 Focus order
Back → room select → Invite → stage tiles → bottom bar left→right → People panel → mini rail.

### 24.4 Below 1280
People panel becomes an overlay sheet toggled from the mini rail; stage uses full width.

### 24.5 Transovo
Launch (M15). Keep the layout. Use Transovo tokens (stage always near-black, controls `bg-white/10`, Record `bg-lane-record`). The People panel's upload % comes from the R3 chunked uploader. After the session ends, an auto-sequence with autosync is created (§26). Add **CPU/network warnings** as stage banners (gap matrix). "Back to editor" returns to `/app/projects/:projectId/edit`.

---

## 25. Rooms: upload, end of session, recovery, import

**References** (12 images): `surfaces/25_rooms_upload_end/01_upload_status_window_in_descript_rooms_a.png`, `surfaces/25_rooms_upload_end/02_upload_progress_window_in_descript_rooms.png`, `surfaces/25_rooms_upload_end/03_upload_completion_confirmation_with_conf.png`, `surfaces/25_rooms_upload_end/04_notification_shown_when_a_guest_leaves_a.png`, `surfaces/25_rooms_upload_end/05_stalled_upload_screen.png`, `surfaces/25_rooms_upload_end/06_choose_files_to_edit_modal.png`, `surfaces/25_rooms_upload_end/07_high_quality_upload_stalled_in_rooms.png`, `surfaces/25_rooms_upload_end/08_you_were_removed_from_the_call_message_i.png`, `surfaces/25_rooms_upload_end/09_recovery_page_showing_upload_progress_of.png`, `surfaces/25_rooms_upload_end/10_recovery_page_with_download_and_delete_o.png`, `surfaces/25_rooms_upload_end/11_partial_recordings_available_in_descript.png`, `surfaces/25_rooms_upload_end/12_error_importing_rooms_recordings.png`
Masters: `01/02_upload status / progress window…`, `03_upload_completion_confirmation…`, `04_notification_shown_when_a_guest_leaves…`, `05_stalled_upload_screen.png`, `06_choose_files_to_edit_modal.png`, `07_high_quality_upload_stalled…`, `08_you_were_removed_from_the_call…`, `09/10_recovery page…`, `11_partial_recordings_available…`, `12_error_importing_rooms_recordings.png`.

### 25.1 Upload card (shown to every participant after Stop; draggable, default bottom-right of the stage, 16 inset)
```
 ┌ Keep this browser tab open!                         ┐ w360 r12 bg-popover shadow-lg p16
 │ The recording has stopped – your files are uploading… │ 13 muted
 │ ┌ 🎥 Camera · Selina            72%  ━━━━━━━━━░░░ ┐ │ rows h48: icon 16, label 13, % mono 12, bar h4 r-full bg-primary
 │ ┌ 🎙 Microphone · Selina        ✓                 ┐ │ done = check 16 green
 └───────────────────────────────────────────────────────┘
 Done:  "All recordings were successfully uploaded. Thanks for recording in Descript Rooms!"  [Got it] (or [Rejoin the Room])
```
Leaving while uploading → confirm w400: "Are you sure you want to leave?" body "Your upload will stop…" · [Stay in the Room] outline · [Leave the Room] destructive.

### 25.2 Stalled / error
- Stalled (ref `05/07`): card gets 1 px `border-destructive`, row shows "⚠ Upload stalled" `text-destructive` 12 + buttons [Copy recovery link] outline h32 · [Start editing project] ghost.
- Host "Choose files to edit" modal (ref `06`, w480): radio cards h72: **High quality (Partial)** "2 of 3 tracks uploaded" · **Cloud backup** "Lower quality, complete"; Learn more link; footer [Start editing] primary.
- "You were removed from the call" full-page card w400 + "Return home".
- Recovery page (ref `09/10`): centred w560 list of local tracks with progress, [Download] and [Delete local copy] (destructive) per row; header "Recover your recording"; note "Files are kept in this browser for 7 days".
- Project panel (ref `11`, §27): yellow section "Uploading Recordings (1)" `bg-warning/10 border-warning/40` with per-track progress; when done, files move into "Rooms recordings" folder.
- Import error (ref `12`): modal w400 "Error importing your rooms recordings" + body + [Close].

### 25.3 Focus order
Card: rows (read-only) → primary action. Modals trap focus; default focus on the safe action (Stay in the Room / Start editing).

### 25.4 Transovo
Launch (M15). The recovery link and 7-day local retention follow gap matrix R3/R6 (OPFS). The upload card copy uses Transovo wording ("Thanks for recording with Transovo").

---

## 26. Multitrack / multicam sequence view

**References** (9 images): `surfaces/26_multitrack_multicam/01_edit_sequence_from_canvas.png`, `surfaces/26_multitrack_multicam/02_steps_to_open_sequence_from_the_project.png`, `surfaces/26_multitrack_multicam/03_solo_and_mute_buttons_in_the_sequence_ed.png`, `surfaces/26_multitrack_multicam/04_dragging_and_adjusting_a_track_in_the_se.png`, `surfaces/26_multitrack_multicam/05_sequenceeditor_auto_sync_1.png`, `surfaces/26_multitrack_multicam/06_remove_track_from_script_option_in_descr.png`, `surfaces/26_multitrack_multicam/07_gif_showing_how_to_detach_a_track_s_audi.png`, `surfaces/26_multitrack_multicam/08_multicam_layout_applied_to_a_multi_track.png`, `surfaces/26_multitrack_multicam/09_in_app_ui_demonstrating_the_ai_actions_p.png`
Masters: `03_solo_and_mute_buttons_in_the_sequence_ed.png` (track headers), `04_dragging_and_adjusting_a_track…`, `01_edit_sequence_from_canvas.png` (right-click ▸ Edit sequence), `02_steps_to_open_sequence_from_the_project…`, `05_sequenceeditor_auto_sync_1.png`, `06_remove_track_from_script…`, `07_gif…detach…audio`, `08_multicam_layout_applied…`, `09_in_app_ui…` (AI tools ▸ Automatic multicam).

### 26.1 Wireframe (sequence editor replaces the timeline body; breadcrumb in the script header "Composition › Sequence 1  [Done]")
```
 ┌ transport 44 (same as §3) ───────────────────────────────────────────────────────────┐
 │ ruler 28                                                                              │
 ├──────────────┬───────────────────────────────────────────────────────────────────────┤
 │ Selina   S 🔇 │ ▁▂▅▇▅▂▁▂▅▇▇▅▃▁▁▂▅▇▅▂▁  (waveform lane h56, bg-speaker-1/20)           │ track header w120: name 12/600 trunc,
 │ Nikki    S 🔇 │      ▁▂▅▇▅▂▁   ▂▅▇▇▅▃▁                                                 │ Solo "S" 20×20 r4 (on: bg-warning text-black),
 │ Screen   S 🔇 │ [video thumbs strip h56]                                               │ Mute 20 (on: bg-destructive/80)
 │ + New track   │                                                                         │ row h32 ghost
 └──────────────┴───────────────────────────────────────────────────────────────────────┘
 Right side panel → "Track 2": Duration · Audio 100% · Audio effects · Studio Sound · [Delete track] destructive
```
- Track lanes: h56 default (Layer size S/M/L = 40/56/80 via View ▸ Timeline ▸ Layer size); drag clips horizontally to offset (snap to other clips' starts and the playhead; offset tooltip "+0.42 s"); selected clip `ring-2 ring-primary`.
- Auto-sync (ref `05`): toolbar button "Sync tracks" → spinner → toast "Synced 3 tracks by audio".
- Track ⋯ / right-click: Rename, Remove track from script (keeps audio, hides words — ref `06`), Detach audio (ref `07`), Delete.
- Multicam: Scene ▸ Layout ▸ layout picker (§9) shows Camera / Zoom / Screen / Media / Multicam / 3 people tiles; AI tools ▸ Automatic multicam (§15.2 stepper).

### 26.2 States
Empty sequence: "Drag files here or + New track". Syncing: lanes `opacity-60` + progress in the transport. Out-of-sync warning badge on the header (`TriangleAlert` 12 amber) when the offsets drift.

### 26.3 Focus order
Breadcrumb Done → track headers (Tab: name → S → mute) → lanes (←/→ moves the selected clip by 1 frame, ⇧ 10 frames) → + New track.

### 26.4 Below 1280
Track header w104 (name truncates more). Same.

### 26.5 Transovo
Sequences are M12 in the gap matrix. Rooms sessions auto-create a sequence (M15). Speaker colours are `speaker-1..6` and match the script speaker labels.

---

## 27. Project panel: compositions & files

**References** (13 images): `surfaces/27_project_panel/01_project_panel_in_descript_showing_compos.png`, `surfaces/27_project_panel/02_project_file_search_bar_in_descript.png`, `surfaces/27_project_panel/03_project_panel_in_descript_showing_availa.png`, `surfaces/27_project_panel/04_composition_options_menu_in_descript_pre.png`, `surfaces/27_project_panel/05_composition_options_menu_showing_duplica.png`, `surfaces/27_project_panel/06_project_files_upload.png`, `surfaces/27_project_panel/07_project_files_plus_menu.png`, `surfaces/27_project_panel/08_the_project_panel_of_the_descript_editor.png`, `surfaces/27_project_panel/09_clips_folder_created_in_the_project_pane.png`, `surfaces/27_project_panel/10_recovered_recordings_highlighted_in_yell.png`, `surfaces/27_project_panel/11_backup_files_in_project_panel.png`, `surfaces/27_project_panel/12_project_file_actions_menu_in_descript.png`, `surfaces/27_project_panel/13_project_panel_with_an_option_to_add_a_fi.png`
Masters: `01_project_panel_in_descript_showing_compos.png`, `08_the_project_panel_of_the_descript_editor.png`, `04/05_composition_options_menu…`, `02_project_file_search_bar…`, `06_project_files_upload.png`, `07_project_files_plus_menu.png`, `09_clips_folder_created…`, `10_recovered_recordings_highlighted_in_yell.png`, `11_backup_files…`, `12/13_…file actions / add a file…`.

### 27.1 Wireframe (side panel w320, rail item "Project", first)
```
 ┌ 📁 Project                         [⤒ Upload] ┐ header h48; Upload outline h28
 │ Compositions                         ＋  🗀+   │ section title 12/600 uppercase muted h32; new composition, new folder 28
 │ ✓ Full video                    16:9  5:31  ⋯ │ rows h40 px12: check 14 (current), name 13 trunc, aspect chip 10, duration mono 12, ⋯ on hover
 │   Clip 1 – "Make clips…"        9:16  0:42  ⋯ │
 │ ─────────────────────────────────────────────── │
 │ Files                                 ＋   ⇅  ▦ │ add menu, sort, grid/list toggle
 │ [⌕ Search your files                       ]   │ h32
 │ ▸ 🗀 Video (3)                                  │ folder rows h36, chevron rotates on open
 │ ▸ 🗀 Audio (2)                                  │
 │ ▸ 🗀 Graphics                                   │
 │ ▸ 🗀 Stock Media                                │
 │   ▣ interview_cam_a.mp4        32:10        ⋯  │ file rows h40: thumb 32×18 r4, name 13, duration 12 mono
 └─────────────────────────────────────────────────┘
```
- Composition ⋯ menu (w240): Rename · Duplicate · Copy link · Open in new window · Set composition to audio only · Gather composition ▸ · Copy highlights ▸ · divider · Export · divider · Delete (destructive).
- Files ＋ menu (w240): **Add from**: Computer, Mobile, Other projects · **Import**: Zoom, YouTube, Rooms recordings, Google Drive · **Create**: Sequence, Folder.
- File ⋯ menu (w240): Insert at playhead, Open in new composition, Replace…, View metadata, Rename, Download, Show in folder, Delete.
- Special sections: "Uploading Recordings (N)" yellow (§25), "Backups" folder (ref `11`), "Clips" folder created by Create clips (ref `09`).
- Create clips panel (from Repurpose ▸ Create clips): Number of clips [5], Clip duration [30–60 s ▾], Layout [Clip – Speaker ▾], Topic (optional text), [Submit] primary.

### 27.2 States
Current composition row `bg-accent` + ✓. Rename inline: input h28 in the row. Drag files from here to the script, canvas or timeline. Uploading file rows show a progress bar h2 under the row. Empty files: dashed drop area h120 "Drop files to add them to this project". Loading: skeleton rows. Error on a file (failed transcode): `TriangleAlert` 14 `text-destructive` + "Failed · Retry".

### 27.3 Focus order
Upload → compositions header actions → composition rows (Enter opens, F2 renames) → files actions → search → folders/files (→ opens a folder, ← closes it).

### 27.4 Below 1280
Panel 280; aspect chip hidden below 300 panel width.

### 27.5 Transovo (clipper integration)
- The first composition is always **Full video** (`kind:'source'`). Clips (`kind:'clip'`) are grouped under it in a collapsible "Clips (N)" group, ordered by score. Each row shows a 20 score ring (brand gradient stroke), title, 9:16 chip and duration. The ⋯ menu adds **Re-score**, **Regenerate hook** and **Open in new tab**.
- Selecting a clip routes to `/app/projects/:projectId/edit/:compositionId`. The editor top-bar breadcrumb reads `Library / <Project> / <Clip title ▾>` (§3.10).
- "＋" next to Compositions offers: New composition · **✨ Make clips** (opens the Create clips panel; Submit is the PrimaryButton).
- Files Import menu: Upload, YouTube link, Google Drive; Zoom and Mobile come later.

---

## Appendix A. Reference coverage and substitutes

| Surface | Images | Coverage note |
|---|---|---|
| 08 Scenes & storyboard | 12 | **No current Storyboard-grid screenshot exists.** Used the scene-strip/reorder refs, help-center text and the 2022 descript.com storyboard images (`90_/91_…`, older product version). The grid sizes in §8.2 are chosen, not measured. |
| 12 Music & SFX | 7 | **No music/SFX browse-list screenshot exists.** Used the Stock tab (♫ toggle, REUSED from §11), descript.com music-waveform/crossfade images, the volume/pan property refs (REUSED from §7) and gap-matrix B9. The list sizes are chosen to match §11. |
| 14 Markers, 16 Comments, 22 Teleprompter | 5 each | Thin sets. The main panel/popover of each is shown in a ref, but treat secondary sizes there as less certain than elsewhere. |
| 23 Rooms lobby | 11 | `11_green_room_setup_in_squadcast…` is the older SquadCast-era UI, used for layout only. |
| All others | ≥ 7 | Measured from refs (see §0.1 for the scale rules). |

The full download log, with source page URL and alt text for every image, is at `/workspace/specs/descript-refs/download_log.tsv`.
