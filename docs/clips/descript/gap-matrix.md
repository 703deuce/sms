# Descript → Transovo gap matrix (Launch scope)

Companion to `descript-feature-map.md` (the full inventory) and `script-editor.md` (the implementation spec v1.0). Generated 2026-10-26.

**How to read this file**
- §1 gives the counts and the 15 most important missing features.
- §2 lists every **Launch** feature from the map, whether `script-editor.md` covers it (§ cited), and the proposed milestone.
- §3 is the **B5 scope table replacement**: the owner moved several rows from Later to Launch.
- §4 has **paste-ready spec sections** (new B6–B13 and additions to C1/C3) for the missing features.
- §5 is the **Recording** section: browser vs desktop feasibility, local-first architecture, the SFU choice, cost and concurrency, Streamer reuse, and milestones.
- §6 has **D1-style browser acceptance tests #67+** grouped into milestones **M7–M18**.

Prices marked **[verify]** were not confirmed from a primary source on 2026-10-26. LiveKit Cloud prices come from livekit.io/pricing and B2 prices from backblaze.com/cloud-storage/pricing, both fetched 2026-10-26.

**Owner scope applied**
- **Launch:** scenes, layouts, markers/chapters, B-roll/media, music, Studio Sound, remove retakes/filler, comments, and **all recording**, on top of core editing.
- **Later:** Eye Contact, Overdub/Regenerate/AI voice, Underlord, generative AI, other effects, share page, and publish destinations.
- **N-A:** account, billing, team admin, and developer API/MCP.


## 1. Summary

### 1.1 Counts

| Measure | Count |
|---|---|
| Descript pages read | 440 (399 help-center articles, 10 changelog posts, 31 product/feature pages) |
| Feature rows in the map | 596 |
| Launch / Later / N-A | 485 / 90 / 21 |
| Launch rows already in `script-editor.md` | 80 |
| Launch rows partly in spec | 60 |
| Launch rows missing | 345 |
| Recording rows (all Launch) | 86 |
| Descript shortcuts / covered by C1 | 85 / 35 (the C1 additions table in §4 covers the remainder relevant to Launch) |

New or extended work (partial + missing) per milestone:

| Milestone | Rows |
|---|---|
| M7 | 54 |
| M8 | 82 |
| M9 | 16 |
| M10 | 13 |
| M11 | 19 |
| M12 | 29 |
| M13 | 80 |
| M14 | 40 |
| M15 | 29 |
| M16 | 21 |
| M17 | 16 |
| M18 | 6 |

### 1.2 The 15 most important missing features (plain words)

1. **Record inside the editor.** Record camera, screen, mic, or screen + camera straight into the script at the cursor. The recording is transcribed automatically, with a countdown, pause, restart and stop.
2. **Remote recording rooms with guests.** Each person's browser records their own full-quality camera and mic track and uploads it during the call. Everyone sees each other through a live video link. The host gets one file per person, already lined up.
3. **Recordings that can't be lost.** Recordings are saved to the browser's local storage and uploaded in small chunks, so a dropped connection, closed tab or crash loses nothing. There is an upload status screen and a recovery link.
4. **Scenes.** Type `/` to split the video into scenes. Each scene shows a thumbnail in the script, scenes appear in a rail on the timeline, and a storyboard view lets you drag scenes into a new order.
5. **Layouts and layout packs.** One-click scene designs (camera, screen + camera, title, intro/outro) that place the speaker, screen and B-roll automatically. You can also change the pack, save your own layouts, remix colors and fonts, and set a default pack.
6. **A real canvas with layers.** Add, move, resize, crop, rotate and align text, shapes, images, video, waveforms and progress bars. Includes layer order, lock, hide and snap guides.
7. **B-roll and a Media panel.** Drag clips and images from the project, a shared media library or a stock library onto words or scenes.
8. **Music and sound effects.** Music lanes with loop, fades and automatic ducking under speech, plus a stock music and sound-effects library.
9. **Studio Sound.** One-click voice enhancement with an intensity slider, plus automatic leveling, room tone in gaps, volume keyframes and a level meter.
10. **Markers and chapters.** Press `#` to add a marker. Markers are listed in the transport. You can copy YouTube chapters, export one file per marker, use AI "Add chapters", and embed chapter metadata.
11. **Retakes.** "Remove retakes" finds repeated lines and false starts. When recording you can restart a take, re-record over a selected passage, and keep several takes.
12. **Comments.** Comments on words, @mentions with email, threads, resolve/reopen, comment markers on the timeline, plus a Share/Project access dialog and "copy link".
13. **Projects with many compositions, and a Project panel.** Several edits per project, plus a Files panel with folders, search and file actions. File actions include replace file but keep edits, A/V sync offset, convert to mono, detach audio and re-transcribe.
14. **Multitrack sequences and multicam.** Group camera, screen and mic tracks and auto-sync them. Automatic multicam cutting follows the active speaker, and "center active speaker" framing keeps them in frame.
15. **Teleprompter and recording invites.** A teleprompter while recording, scheduled Rooms with calendar invites, and "record async" links that let a guest record without a call.

Close runners-up: the Cmd+K action bar, inline notes and bold/italic/highlight in the script, export per scene/marker, GIF export, an embedded subtitle track, audio metadata, and the full app settings dialog.


## 2. Launch feature matrix

Columns:
- **In spec** cites the `script-editor.md` § that covers the feature. `PARTIAL` means only part of the behavior is there. `MISSING` means nothing is.
- **Milestone** is where the new work lands. `M1–M6 (exists)` = already covered by an existing milestone.
- Sources are listed in `descript-feature-map.md`.


### 1. Drive (home) view and projects — 1.1 Drive view

| Feature | In spec | Milestone |
|---|---|---|
| Sidebar views: Home (skills, AI video maker), Recents, Shared with me | PARTIAL §C6 (Transovo host owns project list) | M7 |
| Tools: Brand Studio, Media library, Speakers, Layout packs, Learn, Rooms recordings | MISSING | M14 |
| Header: Search, Record, New project, Profile/settings | PARTIAL §C6 | M14 |
| Project actions: Rename, Duplicate, Move to…, Copy project link, Project access, Delete (Trash 30 days) | PARTIAL §C6 | M7 |
| Restore deleted project within 30 days | MISSING | M7 |

### 1. Drive (home) view and projects — 1.2 Projects and compositions

| Feature | In spec | Milestone |
|---|---|---|
| Project = binder of Compositions + Files + Sequences | PARTIAL §B1 (single composition) | M7 |
| New project from Drive (type picker) or from inside project | PARTIAL §C6 | M7 |
| Multiple compositions per project; composition ⋯: rename, duplicate, copy link, open in new window, set audio-only, flatten, copy highlights, delete | MISSING | M7 |
| Duplicate project / composition / copy composition into another project / duplicate selection to another composition / duplicate layer | MISSING | M7 |
| Aspect ratio 1:1, 9:16, 16:9, custom; frame rate 23.98–60; canvas resolution 720p/1080p/1440p/4K | MISSING | M7 |
| Audio-only composition (auto when audio imported to blank comp; toggle; app default) | MISSING | M7 |
| Project settings: Optimize computer storage, automatic leveling (−16 LUFS), room tone in new gap clips; apply as default for new projects | MISSING | M11 |
| Autosave to cloud, sync spinner, no offline editing | §C2 | M1–M6 (exists) |
| Version history: view/restore (affects all compositions); collaboration conflicts | PARTIAL §C2 | M7 |
| Automatic + manual backups; new project from imported backup | MISSING | M7 |
| Duration & word count of selection / full script | MISSING | M7 |
| Project collaborators: Project editor vs commenter permission matrix; invite from Drive or editor | MISSING | M13 |
| Original + optimized proxy files; mixed sample rates (playback 44.1k) | PARTIAL §C4 | M7 |

### 1B. Import and media — 2.1 Import

| Feature | In spec | Milestone |
|---|---|---|
| Drag file into script → upload + transcribe in one step | PARTIAL §C6 | M7 |
| Upload to Files panel without transcribing | MISSING | M7 |
| Add file to script from Project panel (drag) → transcribes; layers aren't transcribed | PARTIAL §B1 | M7 |
| Activity panel: per-file progress, cancel upload (no minutes charged) | MISSING | M7 |
| Supported types: audio WAV/MP3/AIFF/M4A/FLAC/OPUS/AAC; video MP4/M4V/MOV/WEBM/MKV (H.264, HEVC, VP8, VP9, ProRes*); images BMP/JPEG/PNG/GIF/WEBP/HEIC; PDF; ≥3 channels downmixed; HDR beta | PARTIAL §C6 | M7 |
| Import PDF slide deck → one JPG per slide in Files | MISSING | M7 |
| Import from other projects (no re-upload) | MISSING | M7 |
| Import from Media library | MISSING | M10 |

### 1B. Import and media — 2.2 Project panel (Files)

| Feature | In spec | Milestone |
|---|---|---|
| Project panel: Compositions + Files sections | MISSING | M7 |
| File folders, subfolders; auto folders Sequences / AI Assets / Saved keyframes | MISSING | M7 |
| Files search by name; filter by type; sort name/date added/modified | MISSING | M7 |
| File actions: Rename, New composition from file, Duplicate, Create sequence, Insert into script, Add new layer, Transcribe/Re-transcribe, Detect speakers, Detect filler words, Convert to mono, Separate into mono files, Normalize audio, Detach audio, Replace (file/transcript), Change visual role, Set A/V sync offset, Repair audio drift, Fix file issue, Import transcript, Download, Delete | MISSING | M7 |
| Automatic file-issue detection badge + rate-limited repairs | MISSING | M7 |
| View file metadata | MISSING | M7 |
| Replace file keeping edits (transcript not regenerated) | MISSING | M7 |
| A/V sync offset (± ms) per file | MISSING | M7 |
| Repair audio drift | MISSING | M7 |
| Flatten tracks: script track only / all tracks → new file | MISSING | M7 |

### 1B. Import and media — 2.3 Media panel, library, stock (B-roll and music: Launch)

| Feature | In spec | Milestone |
|---|---|---|
| Media panel (sidebar): My Media (Media library, Brand Studio, projects) browse by location, search | MISSING | M10 |
| Add media: drag to script/canvas, Add to project files, Add at playhead; multi-select | MISSING | M10 |
| Stock tab: video, images, GIFs, stickers, backgrounds, music, sound effects (Storyblocks, GIPHY) by category/search | MISSING (needs licensed provider) | M10 |
| Stock licensing notes (GIPHY non-commercial; YouTube usage form) | MISSING | M10 |
| Media library (Drive): upload, folders, rename, move, remove, copy link; editors vs viewers | MISSING | M10 |

### 1C. Branding

| Feature | In spec | Milestone |
|---|---|---|
| Brand Studio Glossary (transcription glossary, Do Not Translate) | MISSING | M9 |

### 2. Editor: shell, top menus, action bar, view menu — 2.1 Editor regions and chrome

| Feature | In spec | Milestone |
|---|---|---|
| Script editor region | §A1 r2 | M1–M6 (exists) |
| Scene editor (canvas) region | PARTIAL §A1 r3 (preview only; no layer manipulation) | M13 |
| Timeline region | §B4 | M1–M6 (exists) |
| Right sidebar icon rail | PARTIAL §A1 r6 (Properties/Captions/Edit tools/Versions only) | M13 |
| Home button (top-left) | §A1 r1 (Back to project) | M1–M6 (exists) |
| Project/composition name menu in menubar | PARTIAL §A1 r1 (composition switcher only) | M13 |
| Comments toggle (top-right) | MISSING | M13 |
| Help icon (top-right) | §A1 r1 | M1–M6 (exists) |
| Publish/Export button (top-right) | §C3 | M1–M6 (exists) |
| Share button (top-right) | MISSING | M13 |
| Resize panels by dragging borders | §A2 | M1–M6 (exists) |
| Resizable sidebar width | §A1 r5 | M1–M6 (exists) |
| Collapse Script editor or Scene editor | PARTIAL §A2 (Full video view only) | M13 |
| Floating panels: move | MISSING | M13 |
| Floating panels: resize | MISSING | M13 |
| Layout preferences persistence | PARTIAL §A2 (per user, not per project) | M13 |
| Multi-window editing | PARTIAL §C5.5 (single-editor lock conflicts) | M13 |
| Descript for Web | §C6 | M1–M6 (exists) |
| Classic color theme / new colors | PARTIAL §D2.20 | M13 |

### 2. Editor: shell, top menus, action bar, view menu — 2.2 Top-left app menu: File

| Feature | In spec | Milestone |
|---|---|---|
| File > New > Project (Cmd+N) | MISSING | M7 |
| File > New > Composition (Opt+Cmd+N) | PARTIAL §A1 r1 (Duplicate composition only) | M7 |
| File > Duplicate | MISSING | M7 |
| File > Duplicate and Open in New Tab | MISSING | M7 |
| File > Move… | MISSING | M7 |
| File > Delete / Move to Trash | PARTIAL §C5.8 | M7 |
| File > Version history | §C2 | M1–M6 (exists) |
| File > Project settings | MISSING | M7 |
| File > Set composition to video or audio-only | MISSING | M7 |
| File > Export | §C3 | M1–M6 (exists) |
| File > Import (files, Zoom, Google Drive, PDF slides) | MISSING | M7 |

### 2. Editor: shell, top menus, action bar, view menu — 2.3 Edit menu

| Feature | In spec | Milestone |
|---|---|---|
| Edit > Undo / Redo (Cmd+Z / Shift+Cmd+Z) | §B2.8 | M1–M6 (exists) |
| Edit > Cut/Copy/Paste | §B2.7 | M1–M6 (exists) |
| Edit > Paste special > Replace script track | MISSING | M13 |
| Edit > Copy (attributes source) | MISSING | M13 |
| Edit > Paste selected attributes (Shift+Cmd+V) | MISSING | M13 |
| Edit > Select all (Cmd+A) | §B2.12 | M1–M6 (exists) |
| Edit > Find (Cmd+F) / Find in project (Shift+Cmd+F) / next / previous | PARTIAL §B2.11 (no project-wide find) | M13 |
| Edit > Toggle Correct mode (Opt+C) | §B2.9 | M1–M6 (exists) |
| Edit > Restore removed media (Shift+Cmd+Delete) | §B2.6 | M1–M6 (exists) |

### 2. Editor: shell, top menus, action bar, view menu — 2.4 View menu

| Feature | In spec | Milestone |
|---|---|---|
| View > Script > Toggle script | PARTIAL §A2 (Full video) | M13 |
| View > Script > Show edit boundaries | PARTIAL §A3 (always shown; no toggle) | M13 |
| View > Script > Underline filler words | PARTIAL §B3 (no toggle) | M13 |
| View > Script > Underline word errors | PARTIAL §A3 (low-confidence only in Correct mode) | M13 |
| View > Scene editor > Toggle scene editor | MISSING | M13 |
| View > Scene editor placement: Full-screen / Stacked / Side-by-side | §A2 | M1–M6 (exists) |
| View > Scene editor > Snap-to guides (Shift+Cmd+') | PARTIAL §B5 (caption snap only) | M13 |
| View > Timeline > Toggle timeline (Shift+Cmd+S) | §A2 | M1–M6 (exists) |
| View > Timeline > Playhead autoscroll | MISSING | M13 |
| View > Show in timeline > Advanced timeline tools | PARTIAL §A3 (Select/Blade/Hand always shown) | M13 |
| View > Show in timeline > Volume meter | MISSING | M11 |
| View > Show in timeline > Markers, comments, and audio pins | MISSING | M13 |
| View > Timeline > Layer size (compact/default/large) | MISSING | M13 |
| View > Timeline view / Storyboard view | MISSING | M13 |
| View > Zoom in / Zoom out / 100% / Fit in view / Fit current scene | PARTIAL §B4 (no 100%, no Fit current scene) | M13 |
| View > Sidebar panels: Project / Media / Properties / Comments | PARTIAL §A1 r6 | M13 |
| View > Theme: Light / Dark / System | PARTIAL §D2.20 (no picker) | M13 |
| View > Show/hide video (Opt+Cmd+V), Move video (Opt+Shift+Cmd+V) | PARTIAL §A2 | M13 |
| View > Toggle project contents (Opt+Cmd+C) | MISSING | M13 |
| View > Media library (Opt+Cmd+L) | MISSING | M10 |
| View > Toggle layout picker (Opt+Cmd+P) | MISSING | M13 |
| View > Toggle AI Tools (Opt+Cmd+Y) | MISSING | M13 |
| View > Script text size +/- | §A2 | M1–M6 (exists) |

### 2. Editor: shell, top menus, action bar, view menu — 2.5 Tools / Insert / Help menus

| Feature | In spec | Milestone |
|---|---|---|
| Tools > Transcription Glossary | MISSING | M13 |
| Insert > Speaker label (@) | §B2.10 | M1–M6 (exists) |
| Insert > Marker (#) | MISSING | M13 |
| Insert > Scene (/) | MISSING | M13 |
| Insert > Text (Opt+Cmd+T) | MISSING | M13 |
| Insert > Shape (Opt+Cmd+S) | MISSING | M13 |
| Insert > Captions | §B5 | M1–M6 (exists) |
| Insert > Comment (Shift+Cmd+M) | MISSING | M13 |
| Insert > File into script | MISSING | M13 |
| Insert > Inline note | MISSING | M13 |
| Insert > Recording | MISSING | M14 |
| Insert > Open layout picker | MISSING | M13 |
| Help > Keyboard Shortcuts (Opt+Cmd+K / Opt+/) | §C1 | M1–M6 (exists) |
| Help > Help Center | MISSING | M13 |
| Help > Debug > Force Fix Corrupted Alignment | MISSING | M13 |
| Help > Debug > Export project backup… | PARTIAL §C2 (JSON backup on failure only) | M13 |

### 2. Editor: shell, top menus, action bar, view menu — 2.6 Action bar (Cmd+K command palette)

| Feature | In spec | Milestone |
|---|---|---|
| Action bar: open via Cmd+K or AI Tools panel | MISSING | M13 |
| Action bar: Common (Add custom font, New project, Transcription glossary) | MISSING | M13 |
| Action bar: Editing (Enter Correct mode, Enter Write mode, Remove filler words, Remove ignored text, Replace with gap clip, Shorten word gaps, Split at playhead) | MISSING | M13 |
| Action bar: Export (share link/local, subtitles, text) | MISSING | M13 |
| Action bar: Insert (Animation, Comments, Captions, File into script, Inline note, Marker, Layout picker, Regenerate, Recording, Scene, Speaker label, Text) | MISSING | M14 |
| Action bar: Jump to composition / marker / scene (#12) / time (1h 32m 24s, 1:32:24.2, 24.2) | MISSING | M13 |
| Action bar: Project (Copy link to composition, Project access, Project settings) | MISSING | M13 |
| Action bar: Search (Find in script, GIPHY gifs/stickers, stock backgrounds/footage/photos/music/SFX) | MISSING | M10 |
| Action bar: Copy highlights (all or by color) | MISSING | M13 |
| Action bar in Drive view (create project, new window, help, shortcuts) | MISSING | M13 |

### 3. Editor: Script area — 3.1 Text-based editing core

| Feature | In spec | Milestone |
|---|---|---|
| Word-level sync of text and media | §B2.1 | M1–M6 (exists) |
| Click word to place cursor + move playhead | §B2.2 | M1–M6 (exists) |
| Current-word highlight during playback | §B2.3 | M1–M6 (exists) |
| Edit while playing | §B2.3 | M1–M6 (exists) |
| Delete text = delete media | §B2.4 | M1–M6 (exists) |
| Ignore (Cmd+Delete) | §B2.5 | M1–M6 (exists) |
| Hover ignored text: Restore / Delete | §B2.5 | M1–M6 (exists) |
| Remove ignored text (bulk) | MISSING | M13 |
| Remove from transcript | PARTIAL §B3 (filler action only, not general command) | M13 |
| Cut/copy/paste moves media | §B2.7 | M1–M6 (exists) |
| Drag-and-drop selection | §B2.7 | M1–M6 (exists) |
| Paste across compositions/projects | PARTIAL §B2.7 (same project only) | M13 |
| Restore removed media | §B2.6 | M1–M6 (exists) |
| Edit boundaries | §A3 | M1–M6 (exists) |
| Inline notes | MISSING | M13 |
| Bold / Italic script text (Cmd+B / Cmd+I) | MISSING | M13 |
| Highlight text in colors (Shift+Cmd+H) | MISSING | M13 |
| Copy highlights to new composition | MISSING | M13 |
| Replace script track (Paste special) | MISSING | M13 |
| Duplicate selection to… (new composition / existing / folder) | PARTIAL §A1 (Duplicate composition only) | M13 |
| Typing outside Correct mode | §B2.13 | M1–M6 (exists) |
| Wordless media in script (beta) | MISSING | M13 |
| Labels for wordless media ([music], [applause]) | MISSING | M10 |

### 3. Editor: Script area — 3.2 Correcting the transcript

| Feature | In spec | Milestone |
|---|---|---|
| Correct one word (C) | §B2.9 | M1–M6 (exists) |
| Correct All | §B2.9 | M1–M6 (exists) |
| Correct mode (Opt+C) | §B2.9 | M1–M6 (exists) |
| Hold Z+click capitalization / hold X+click punctuation | §B2.9 | M1–M6 (exists) |
| Realign words in range | MISSING | M7 |
| Fix word boundary on wordbar (Cmd-drag) | §B4 | M1–M6 (exists) |
| Import / Replace transcript | MISSING | M7 |
| Re-transcribe file (choose language) | MISSING | M7 |

### 3. Editor: Script area — 3.3 Selection toolbar (floating over selection)

| Feature | In spec | Milestone |
|---|---|---|
| Change layout | MISSING | M13 |
| Add layer | MISSING | M13 |
| Add scene | MISSING | M13 |
| Correct | §A3 | M1–M6 (exists) |
| Edit your script ▾ (Ignore / Delete / Replace with gap / Correct only) | §A3 | M1–M6 (exists) |
| Bold / Italic | MISSING | M13 |
| Highlight ▾ (colors) | MISSING | M13 |
| Duplicate to… | MISSING | M13 |
| Add comment | MISSING | M13 |
| Ellipsis → right-click menu | §A3 | M1–M6 (exists) |

### 3. Editor: Script area — 3.4 Speakers

| Feature | In spec | Milestone |
|---|---|---|
| Automatic speaker detection | MISSING (assumes existing diarization) | M7 |
| Identify speakers modal | MISSING | M7 |
| Detection mode setting: Always ask before detecting speakers (ask # speakers) | MISSING | M7 |
| Detect speakers manually (file ⋯) | MISSING | M7 |
| Add speaker (@ or "Add speaker" at paragraph top) | §B2.10 (no AI options) | M1–M6 (exists) |
| Re-label selection (@) | §B2.10 | M1–M6 (exists) |
| Move speaker label (drag grabber) | MISSING | M7 |
| Rename speaker (project-wide) | §B2.10 | M1–M6 (exists) |
| Replace in project with… (merge) | §B2.10 | M1–M6 (exists) |
| Change label color | §B2.10 | M1–M6 (exists) |
| Remove from project | §B2.10 | M1–M6 (exists) |

### 3. Editor: Script area — 3.5 Filler words, gaps, retakes, search

| Feature | In spec | Milestone |
|---|---|---|
| Filler-word detection + light-blue underline | §B3 (EN only) | M1–M6 (exists) |
| Remove filler words: Delete / Delete+gap / Ignore / Remove from transcript | §B3 | M1–M6 (exists) |
| Avoid harsh cuts | §B3 | M1–M6 (exists) |
| Shorten word gaps (more than / between → target) | §B3 | M1–M6 (exists) |
| Shorten gaps settings: Auto-advance, Preview results | §B3 | M1–M6 (exists) |
| Edit word gap (right-click: presets / Set manually / Shorten all) | §B2.14 | M1–M6 (exists) |
| Word gap shortcuts (Cmd+G at cursor; Shift+Cmd+G = last value) | MISSING (conflict to resolve) | M12 |
| Remove retakes | MISSING | M12 |
| Find in script panel (Cmd+F) with sidebar results | PARTIAL §B2.11 (find bar, no results sidebar) | M12 |
| Search options: Auto-advance, Preview results, Match whole words, Match case, Wrap around, Only current composition | PARTIAL §B2.11 (case + whole word only) | M12 |
| "Find and…" modes: Find, Remove filler words, Shorten word gaps, Correct transcript, Remove media, Copy | PARTIAL §B2.11/§B3 | M12 |
| Search actions: Delete, Delete+gap, Ignore, Remove from transcript, Duplicate to new/existing composition/folder, Copy | PARTIAL §B2.11 | M12 |
| Search: find jump cuts | MISSING | M12 |
| Highlighter filter | MISSING | M12 |

### 3. Editor: Script area — 3.6 Markers and chapters

| Feature | In spec | Milestone |
|---|---|---|
| Add marker (# or "Add marker" on blank line) | MISSING | M12 |
| Move marker (drag grabber) / rename (type) / delete | MISSING | M12 |
| Markers list in transport; jump to marker; Opt+Cmd+. / , | MISSING (transport placeholder only) | M12 |
| Copy formatted chapter list (for YouTube) | MISSING | M12 |
| Export each marker as separate file | MISSING | M12 |
| Markers as section headers in Word/HTML transcript export | MISSING | M12 |
| Add Chapters AI tool | MISSING | M12 |

### 3. Editor: Script area — 3.7 Sequences (multitrack / multicam)

| Feature | In spec | Milestone |
|---|---|---|
| Sequence concept | MISSING | M12 |
| Create sequence from selected project files | MISSING | M12 |
| Create via "Multicam & multitrack" in empty composition / + > Sequence | MISSING | M12 |
| Sequence Editor (Edit sequence, Shift+Cmd+O) | MISSING | M12 |
| Sequence: mute/solo tracks | MISSING | M12 |
| Sequence: Multi-Track Autosync | MISSING | M12 |
| Sequence: nudge clip (arrow 1 fr, Cmd ½ fr, Shift 5 fr, Opt 1 s) | MISSING | M12 |
| Sequence: per-track effects, pan/volume, automation, auto-level | MISSING | M11 |
| Sequence: add tracks (≤14) | MISSING | M12 |
| Sequence: Include/Remove track from script | MISSING | M12 |
| Fix duplicate transcripts (mic bleed) + revert | MISSING | M12 |
| Detach audio | MISSING | M12 |
| A/V sync offset | MISSING | M12 |
| Separate into mono files | MISSING | M12 |

### 3. Editor: Script area — 3.8 Transcription

| Feature | In spec | Milestone |
|---|---|---|
| Automatic transcription on add to script / Transcribe file / in sequence | PARTIAL §C6 (assumes transcript exists) | M7 |
| 26 transcription languages, auto-detect; UK English manual | MISSING | M7 |
| Always ask before transcribing / preferred language | MISSING | M7 |
| 15 h max per file | MISSING | M7 |
| Media Library files transcribe automatically | MISSING | M10 |
| Inverse Text Normalization | MISSING | M7 |

### 4. Editor: Scenes, Scene editor (canvas), layers — 4.1 Scenes and scene boundaries

| Feature | In spec | Milestone |
|---|---|---|
| Scenes concept | MISSING (§B1 reserves sceneBreak token only) | M8 |
| Split scene by typing / in script | MISSING | M8 |
| Create empty scene (/ on empty line, New Scene button, Shift+Cmd+Enter) | MISSING | M8 |
| Split button in timeline | PARTIAL §B4 (S splits script clip only) | M8 |
| Scene thumbnails in script margin | MISSING | M8 |
| Move scene boundary (script or ruler drag) | MISSING | M8 |
| Delete scene boundary (right-click > Delete boundary / Delete key) | MISSING | M8 |
| Reorder scenes (drag thumbnail in timeline scene rail or Storyboard) | MISSING | M8 |
| Scene rail in timeline | MISSING (§B4 'scenes strip later') | M8 |
| Storyboard view | MISSING | M8 |
| Navigate next/previous scene (Shift+Cmd+. / ,) and transport buttons | MISSING | M8 |
| Export scenes (each scene as file) | MISSING | M8 |

### 4. Editor: Scenes, Scene editor (canvas), layers — 4.2 Scene properties (no layer selected)

| Feature | In spec | Milestone |
|---|---|---|
| Choose layout pack / layout | MISSING | M8 |
| Scene duration | MISSING | M8 |
| Scene background (color/gradient/image) | MISSING | M8 |
| Layers list (stack order; click, drag reorder, rename, hide, delete, lock icon) | MISSING | M8 |
| Apply to all scenes toggle | MISSING | M8 |

### 4. Editor: Scenes, Scene editor (canvas), layers — 4.3 Scene editor (canvas)

| Feature | In spec | Milestone |
|---|---|---|
| Select layer on canvas (purple border = script track, blue = other) | MISSING | M8 |
| Multi-select (Shift+click, marquee) with Mixed values | MISSING | M8 |
| Align (L/R/center/top/middle/bottom) & distribute (≥3) | MISSING | M8 |
| Move/resize/rotate/crop/corner-round on canvas | MISSING | M8 |
| Snap to guides | MISSING | M8 |
| Layer toolbar (floating over selected layer) | MISSING | M8 |
| Scene toolbar (nothing selected): Layout, Background, Layers | MISSING | M8 |
| Layers menu: Save current frame to project files (PNG) | MISSING | M8 |
| Right-click layer: Select layer / Layer order / View media / Replace media / Change source / Cut / Copy / Paste / Paste attributes / Duplicate / Flip H / Flip V / Hide / Lock / Delete | MISSING | M8 |
| Option-drag to duplicate | MISSING | M8 |
| Layer order: ] front, Shift+] forward, Shift+[ backward, [ back | MISSING | M8 |
| Duplicate layer Cmd+D, Hide Opt+H, Lock Opt+L | MISSING | M8 |
| Lock layer (applies across scenes; Unlock button) | MISSING | M8 |
| Hide/show layers per scene | MISSING | M8 |
| Expand/shrink scene editor (Cmd+.) | MISSING | M8 |
| Aspect ratio / canvas size | §B5 (aspect + reframe) | M1–M6 (exists) |

### 4. Editor: Scenes, Scene editor (canvas), layers — 4.4 Layers and layer properties

| Feature | In spec | Milestone |
|---|---|---|
| Layer types: video, audio, image, GIF, text, captions, shapes, waveform, progress bar, emoji, avatar, placeholder | PARTIAL §B5 (captions only) | M8 |
| Add layer: drag from Project/Media to script, canvas or timeline | MISSING | M8 |
| Add layer via selection toolbar (+ Add Layer) | MISSING | M8 |
| Drop media on Range selection → auto scene boundaries | MISSING | M8 |
| Layer duration (+ speed, set exact duration) | MISSING | M8 |
| Clip speed | MISSING | M8 |
| Loop / Once / Freeze end (non-script layers) | MISSING | M8 |
| Attach layer to scene (drag edge to boundary) | MISSING | M8 |
| Extend layer across scenes (drag / Apply to all scenes) | MISSING | M8 |
| Current scene / All scenes toggle for multi-scene layer | MISSING | M8 |
| Audio: volume, pan, mute, solo | PARTIAL §B5 (composition volume only) | M8 |
| Opacity | MISSING | M8 |
| Size & position (x, y, w, h, rotation, corner radius, crop) | MISSING | M8 |
| Border | MISSING | M8 |
| Fill picker: solid, gradient (linear H/diag, radial center/corner, stops), eyedropper | MISSING | M8 |
| Stroke/Border thickness + color | MISSING | M8 |
| Visual role (Talking head / Screen recording / Graphics / B-roll) | MISSING | M14 |
| Replace media (keeps edits) via toolbar/right-click/Properties ⋯ | MISSING | M8 |
| Change source (stacked layers) | MISSING | M8 |
| Paste layer keeps offset from scene start | MISSING | M8 |
| Center active speaker (beta) | PARTIAL §B5 (reframe) | M8 |
| Automatic Multicam (Automatic / Active speaker only; cutaways Occasional 30 s / Frequent 10 s / None; camera setup; layout pack) | MISSING | M8 |

### 4. Editor: Scenes, Scene editor (canvas), layers — 4.5 Elements panel

| Feature | In spec | Milestone |
|---|---|---|
| Text: Text / Subtitle / Title | MISSING | M8 |
| Text type: Freeform / Captions / Speaker / Composition name / Marker / Timer | MISSING | M8 |
| Text background: bounding box fixed/auto, radius, color, Hug lines / Box | MISSING | M8 |
| Fonts + Custom fonts (Google Fonts search, upload ttf/otf/woff, add to Drive) | MISSING | M8 |
| Shapes: rectangle, ellipse, line, arrow | MISSING | M8 |
| Waveform (Lines/Circle/Ring/Wave; speaker; fill; size; fidelity; magnitude; mirror) | MISSING | M8 |
| Progress bar (Bar/Ring/Pie; color; start/end %) | MISSING | M8 |
| Placeholder layers (Media / Camera / Screen; notes) → Add File / Record / Stock / Generate | MISSING | M14 |

### 4. Editor: Scenes, Scene editor (canvas), layers — 4.6 Captions

| Feature | In spec | Milestone |
|---|---|---|
| Captions panel (current scene / all scenes toggle) | §B5 (captions panel) | M1–M6 (exists) |
| Caption presets (18 new + Legacy), search, filter, sort | PARTIAL §B5 | M8 |
| Caption style: font, size, alignment, text/background colors+gradients, stroke | PARTIAL §B5 | M8 |
| Active word fill/stroke/background; Future words fill/stroke | PARTIAL §B5 | M8 |
| Convert text layer ↔ captions | MISSING | M8 |
| Per-speaker captions layers | MISSING | M8 |
| Delete captions layer | §B5 | M1–M6 (exists) |

### 5. Timeline — 5.1 Structure

| Feature | In spec | Milestone |
|---|---|---|
| Collapsed / expanded timeline (handle, drag) | §B4 | M1–M6 (exists) |
| Time ruler (timecode, markers, comments, audio levels) | PARTIAL §B4 (no markers/comments) | M11 |
| Layer lanes (B-roll, text, effects, music) | MISSING (§B4 'later') | M10 |
| Wordbar | §B4 | M1–M6 (exists) |
| Script track | §B4 | M1–M6 (exists) |
| Zoom & Fit: Fit scene / Fit composition / zoom to playhead (Opt+Cmd+3) / fit selection (Opt+Cmd+4) | PARTIAL §B4 | M8 |
| Scroll (Shift+scroll, H+drag) | §B4 | M1–M6 (exists) |
| Volume meter | MISSING | M11 |
| Timeline audio pins | MISSING | M8 |

### 5. Timeline — 5.2 Tools

| Feature | In spec | Milestone |
|---|---|---|
| Select tool (A): move, trim, combine; drag media between script and layer lanes; Shift multi-select | §B4 | M1–M6 (exists) |
| Range tool (R): select span → delete, gap, visuals, realign, Add label | MISSING | M8 |
| Blade tool (B) | §B4 | M1–M6 (exists) |
| Slip tool (Y per shortcuts page; S per tools page) | MISSING | M8 |
| Hand tool (H) | §B4 | M1–M6 (exists) |
| Hold tool key for temporary switch | MISSING | M8 |

### 5. Timeline — 5.3 Clip operations

| Feature | In spec | Milestone |
|---|---|---|
| Trim clip/layer edges | §B4 (script track only) | M1–M6 (exists) |
| Split clip/layer at playhead (S / Shift+Cmd+S) | PARTIAL §B4 | M8 |
| Gap clips (right-click Add gap clip; Shift+Delete on range); room tone on by default | §B4 (no room tone) | M1–M6 (exists) |
| Room tone in gap clips (toggle) | MISSING | M11 |
| Freeze frame (right-click video > Add freeze frame; set duration) | MISSING | M8 |
| Automatic microfades (~5 samples at every cut) | MISSING | M8 |
| Replace with… (Opt+R) | MISSING | M8 |
| Layer order menu on right-click | MISSING | M8 |
| Mute/hide layer (0) | MISSING | M8 |
| Next/previous clip (Opt+Shift+Cmd+. / ,) | MISSING | M8 |
| Auto-level clip (Opt+Shift+Cmd+L) | PARTIAL §B5 (normalize) | M11 |
| Volume automation (keyframes) | MISSING | M8 |

### 5. Timeline — 5.4 Transport and playback

| Feature | In spec | Milestone |
|---|---|---|
| Play/pause (Space, Cmd+S, Opt+click) | §B2.2 | M1–M6 (exists) |
| Play from cursor (Shift+Space) | §C1 | M1–M6 (exists) |
| Spot audition (Shift+Cmd+Space) | MISSING | M8 |
| J/K/L speed (Shift+J/K/L) | §C1 | M1–M6 (exists) |
| Playback speed up to 3x (editor only) | MISSING | M8 |
| Frame step (← / →) | §B4 | M1–M6 (exists) |
| Home → start | §C1 | M1–M6 (exists) |
| Esc → resume autoscroll | §B2.3 | M1–M6 (exists) |
| Previous/next scene buttons, markers list in transport | MISSING | M8 |
| Record button in timeline toolbar | MISSING | M14 |

### 5A. Audio processing and effects — 5A.1 Launch audio (owner: Studio Sound, music)

| Feature | In spec | Milestone |
|---|---|---|
| Studio Sound on script layer / sequence track / part of a file | MISSING (§B5 Later) | M11 |
| Studio Sound Intensity slider (0–100%) | MISSING | M11 |
| Studio Sound disables room tone for that file | MISSING | M11 |
| Studio Sound during recording (setting) | MISSING | M14 |
| Auto-leveling: App setting (all new projects), Project setting, per clip | MISSING | M11 |
| Lower audio of other layers (ducking) with Amount; multiple ducking layers don't duck each other; strongest wins; layer-level only | MISSING | M10 |
| Room tone from first 30 s of file; applied to gaps; on by default (App/Project setting) | MISSING | M11 |
| Volume and pan per layer / selection / sequence track / whole composition; Mute | PARTIAL §B5 | M11 |
| Composition audio properties (volume, pan, effects on whole mix) | MISSING | M11 |
| Volume automation keyframes (fade up/down over clip) | MISSING | M11 |
| VU meter −30…0 dB in timeline (View > Timeline > Show in timeline > Volume) | MISSING | M11 |
| Apply/adjust/disable/remove effect; order top→bottom; presets via ⋯ | MISSING | M11 |

### 5A. Audio processing and effects — 5A.3 Visual effects (Later)

| Feature | In spec | Milestone |
|---|---|---|
| Center active speaker (beta) | MISSING | M12 |

### 9. Layouts and layout packs (owner: Launch)

| Feature | In spec | Milestone |
|---|---|---|
| Layout pack = themed layouts grouped by type (Camera, Media, Chapter, Intro, Outro, Captions, Text, Other) | MISSING | M9 |
| Apply layout: scene thumbnail → Layout / Choose layout; "[#] more" per group | MISSING | M9 |
| Apply from scene panel tile / timeline right-click Change layout / storyboard | MISSING | M9 |
| Change layout pack: Gallery / Drive / Private tabs + search; doesn't rewrite applied layouts | MISSING | M9 |
| Visual roles (Talking Head, Screen Recording, Graphics, Others) drive placeholder matching | MISSING | M14 |
| Lock layer bypasses layout matching | MISSING | M9 |
| Matching rules: camera/media interchangeable, by layer name, competition, leftovers notification (Restore one / Restore All / Dismiss) | MISSING | M9 |
| Empty scene + layout adds all layout layers | MISSING | M9 |
| Multicam layouts with sequences; edited layers preserved on layout change | MISSING | M9 |
| Smart Fill (Title/Subtitle text from script, captions, speaker labels); toggle per layout; Replace with placeholder | MISSING | M9 |
| Save scene as new layout (name, Save to pack, per-layer Keep / Don't include / Turn into placeholder, type) | MISSING | M9 |
| New layout pack from scratch (each scene = layout; Publish layout pack; access Private/Drive/Public) | MISSING | M9 |
| Layout pack can hold layouts for multiple aspect ratios (composition per ratio) | MISSING | M9 |
| Remix a gallery pack: base pack, Primary/Accent/Background colors, Title/Subtitle/Text fonts (upload), name, visibility | MISSING | M9 |
| Share pack link; recipient "+ copy to my layout packs" | MISSING | M9 |
| Drive default layout pack (Brand Studio > Layout packs) | MISSING | M9 |

### 6. Recording (all Launch per owner steering) — 6.1 Entry points and modes

| Feature | In spec | Milestone |
|---|---|---|
| Record button: Drive header (top-right) | MISSING | M14 |
| Record button: editor bottom dock / timeline toolbar | MISSING | M14 |
| Choose recording method guide (Record in project / Capture screen / Record with guests) | MISSING | M14 |
| Editor Recorder: Camera source | MISSING | M14 |
| Editor Recorder: Screen source (screen/window; region on desktop) | MISSING | M14 |
| Editor Recorder: Audio (mic) source | MISSING | M14 |
| Screen + camera combined recording | MISSING | M14 |
| Computer audio: desktop = system-wide; web = one browser tab only | MISSING | M14 |
| Recorder takes full window if script empty; else opens in Script view | MISSING | M14 |
| Record into script at playhead (insertion marker shown) | MISSING | M14 |
| Replace selection (record over highlighted text) | MISSING | M14 |
| Record new layer in selected scene | MISSING | M14 |
| Play script while recording an audio layer | MISSING | M14 |
| Recording length limit 4 h/session | MISSING | M14 |
| Background upload during recording with progress toast | MISSING | M14 |
| Navigation blocker while post-recording processing runs | MISSING | M14 |
| Low disk space warnings (persistent banner; hosts see guests' storage) | MISSING | M14 |
| Camera drop → recording auto-restarts | MISSING | M14 |
| Media-key control (Play/Pause/Record from headphones, foot switches) | MISSING | M14 |

### 6. Recording (all Launch per owner steering) — 6.2 Recorder controls and settings

| Feature | In spec | Milestone |
|---|---|---|
| Controls: Cancel (delete) / Restart (discard and restart) / Pause-Resume / Stop & save / Teleprompter / Settings | MISSING | M14 |
| Setting: Countdown (3 s) | MISSING | M14 |
| Setting: Transcription on/off (auto-transcribe after recording) | MISSING | M14 |
| Setting: Default Speaker label | MISSING | M14 |
| Setting: Studio Sound after recording | MISSING | M14 |
| Setting: Auto gain control (collapses to mono) | MISSING | M14 |
| Setting: Resolution (capped by camera/screen; no 4K screen on Windows) | MISSING | M14 |
| Framing: Center Me silhouette / Grid overlay | MISSING | M14 |
| Single mixed mic input (multiple mics must be aggregated at OS level) | MISSING | M14 |
| Device permission prompts (web: browser; desktop: OS privacy) | MISSING | M14 |
| Low frame rate / sync performance warnings | MISSING | M14 |
| Convert to mono (fix hard-panned recording) | MISSING | M14 |

### 6. Recording (all Launch per owner steering) — 6.3 Teleprompter

| Feature | In spec | Milestone |
|---|---|---|
| Teleprompter in Editor Recorder, Screen Recorder, Rooms (Host/Co-host) | MISSING | M16 |
| Script source: Paste / Type / Import from script | MISSING | M16 |
| Controls: font size, scroll speed, restart, play, flip/mirror, light/dark theme | MISSING | M16 |
| Settings: Variable vs Constant scroll; Auto-scroll on record; Focus mode | MISSING | M16 |
| Teleprompter excluded from capture on desktop; visible in web screen share | MISSING | M16 |

### 6. Recording (all Launch per owner steering) — 6.4 Desktop Screen Recorder (menu-bar/tray app)

| Feature | In spec | Milestone |
|---|---|---|
| Screen Recorder dock from menu bar/tray; standalone shortcut app | MISSING (desktop-only) | M18 |
| Inputs: Quick Share, Teleprompter, Computer audio, Camera, Microphone, Display (full/window/region) | MISSING | M18 |
| Quick Share on → single-track publish to share page; off → multi-track project | MISSING | M18 |
| Settings: Countdown, Camera resolution, Transcribe microphone, Studio Sound, shortcut Shift+Cmd+2, Destination drive (Recordings folder), Default publish privacy, After recording (open page+copy / copy only), Display author, Enable comments, Camera shape slider, Run in background, Launch at login | MISSING | M18 |
| Camera bubble movable/resizable during recording | MISSING | M18 |
| Dock: Pause/Resume (not Windows), Stop+timer, Restart, Minimize camera, Cancel | MISSING | M18 |

### 6. Recording (all Launch per owner steering) — 6.5 Rooms (remote recording with guests)

| Feature | In spec | Milestone |
|---|---|---|
| Create Room from Drive / project / goto-room URL | MISSING | M15 |
| Pre-join screen: camera+resolution, mic, speakers, headphones yes/no (echo cancel), display name (= speaker label) | MISSING | M15 |
| Invite links with role (Guest / Co-host / Producer / Viewer) | MISSING | M15 |
| Waiting room: approve join requests; change role before admit; auto-admit with role | MISSING | M15 |
| Roles: Host, Co-host, Producer (off-stage, push-to-talk), Viewer, Guest | MISSING | M15 |
| Control Room (backstage for producers) and Viewer Room | MISSING | M15 |
| Push-to-talk to everyone or one participant (+ silence button) | MISSING | M15 |
| Record button with on-screen countdown; elapsed timer | MISSING | M15 |
| Separate local high-quality track per participant (audio 48 kHz AAC/MP4 or Opus/WebM; optional lossless WAV on Chromium; video up to 4K H.264/MP4, VP8/WebM on Firefox, VFR ≤30 fps, 30 Mbps at 4K) | MISSING | M15 |
| Cloud backup per participant (WebM VP8/Opus via call) | MISSING | M15 |
| Screen share in Room (recorded) | MISSING | M15 |
| Live captions overlay in Room | MISSING | M15 |
| Chat (everyone + DMs), image paste in chat, chat notifications setting | MISSING | M15 |
| Editor comments during session (time-stamped into project) | MISSING | M15 |
| People tab: network health, role dropdown, pin participant; Gallery/Speaker view | MISSING | M15 |
| Host tools: view/adjust participant AV inputs; monitor upload status | MISSING | M15 |
| Upload status dialog after stop (all participants for host; non-dismissable, movable) | MISSING | M15 |
| Leave vs close tab; Stop and leave / Stop and close Room | MISSING | M15 |
| Room settings General: theme, chat notifications, waiting room, auto-admit role, producer chime, emoji skin tone | MISSING | M15 |
| Room settings Audio: echo cancellation, background noise reduction, auto gain, recording quality (Auto 48 kHz / lossless WAV) | MISSING | M15 |
| Room settings Video: aspect ratio 1:1/16:9, framing overlay, recording quality up to 4K, call quality Auto/Bandwidth saver | MISSING | M15 |
| Results: Recordings folder > "Room – date" + Backups; auto sequence inserted into composition and transcribed | MISSING | M15 |
| Stalled upload: Start editing with partial/backup / Copy recovery link (7 days) / rejoin to finish | MISSING | M15 |
| Replace partial file in sequence with recovered recording | MISSING | M15 |
| Browser support: Chrome, Edge, Arc, Firefox, Safari 26+, Opera; mobile blocked | MISSING | M15 |
| Bandwidth guidance: 10 Mbps min, 20 recommended, 30 up for 4K | MISSING | M15 |
| 4 h per recording; multiple recordings per Room saved to same project | MISSING | M15 |
| CPU overload warnings, mic-switch toast, viewer defaults / producer slots | MISSING | M15 |

### 6. Recording (all Launch per owner steering) — 6.6 Scheduling and async

| Feature | In spec | Milestone |
|---|---|---|
| Schedule for later: title, date, start/end, timezone | MISSING | M16 |
| Advanced: Save recording to new project (workspace/folder) or existing project | MISSING | M16 |
| Who can start: Host only / drive members / anyone with project access / anyone with link (record without host) | MISSING | M16 |
| Add to Google Calendar / Outlook; copy invite link | MISSING | M16 |
| Rooms recordings tab: Upcoming / Past; edit/delete | MISSING | M16 |
| Invite to record async: title, optional teleprompter script, link expiry, drive-members-only or anyone | MISSING | M16 |
| Async guest flow: name, device check, teleprompter, record, upload | MISSING | M16 |
| Async results in folder named by link; subfolder per guest; email + in-app notification | MISSING | M16 |

### 6. Recording (all Launch per owner steering) — 6.7 Retakes and recovery

| Feature | In spec | Milestone |
|---|---|---|
| Restart recording (discard take) | MISSING | M16 |
| Replace selection by recording (re-record passage) | MISSING | M16 |
| Multiple recordings per session/Room (takes) saved to the same project | MISSING | M16 |
| SquadCast Takes (rename, review per take) | MISSING | M16 |
| Remove Retakes AI after recording | MISSING | M16 |
| Recording recovery (web.descript.com/recover; desktop auto) | MISSING | M16 |
| Progressive upload (SquadCast reference) | MISSING | M16 |
| Unsupported devices list (AirPods, ASIO, Krisp, virtual cams…) | MISSING | M16 |

### 7. Export, publish, share — 7.1 Export dialog

| Feature | In spec | Milestone |
|---|---|---|
| Export button (top-right) → tabs Video / Audio / Subtitles / Transcript / Timeline; Destination dropdown | §C3 (no Timeline tab) | M1–M6 (exists) |
| Export range: Current composition / Current selection / Current scene / Scenes / Markers / Line breaks / All compositions | PARTIAL §C3 (composition + selection only) | M17 |
| Video: MP4 local export | §C3 | M1–M6 (exists) |
| Video: GIF format | MISSING | M17 |
| Video resolution 480p/720p/1080p/1440p/4K (capped by plan + canvas size) | §C3 | M1–M6 (exists) |
| Video quality Low / Medium / High | §C3 | M1–M6 (exists) |
| Frame rate (30/60) affects size | PARTIAL §C3 | M17 |
| Embedded subtitle track in MP4 (choose to embed, Mar 2026) | MISSING | M17 |
| Audio: m4a / wav / mp3 | §C3 | M1–M6 (exists) |
| Audio advanced: channels mono/stereo, 44.1/48 kHz, bitrate 32–256 kbps, normalize Off/Peak/-14/-16/-18/-23/-24 LUFS | PARTIAL §C3 | M17 |
| Metadata: show title, episode title, description, artwork, chapters (markers) | MISSING | M17 |
| Subtitles: .srt / .vtt; show speakers; max chars/line; max lines/card | §C3 | M1–M6 (exists) |
| Transcript: .html/.md/.docx/.txt/.rtf; timecode offset; include composition name/markers/ignored text/speaker labels/speakers every paragraph | PARTIAL §C3 (no docx/rtf/html, no markers) | M17 |
| Transcript timecodes: interval seconds, at paragraph breaks, with speaker labels, at markers | PARTIAL §C3 | M17 |
| Export soloed sequence track as mono file | MISSING | M17 |
| Export blocked by unready file (hover shows which file) | PARTIAL §C5 | M17 |
| Browser export storage/memory errors & persistent storage | PARTIAL §C4 | M17 |

### 8. Collaboration

| Feature | In spec | Milestone |
|---|---|---|
| Comments: select words → chat-bubble → comment in right panel | MISSING | M13 |
| Comment edit / delete via ⋯ | MISSING | M13 |
| @mention collaborators (email notification) | MISSING | M13 |
| Replies / threads | MISSING | M13 |
| Resolve (circle) → archived view; reopen | MISSING | M13 |
| Comments sidebar: toggle, sort, resolved/unresolved filter, Copy comments as text | MISSING | M13 |
| Comment markers in timeline ruler | MISSING | M13 |
| Comments don't copy with content/duplicate | MISSING | M13 |
| Project Access dialog (Share button): copy link; access levels Anyone can comment / Anyone can view / Project access required; invite people | MISSING | M11 |
| Copy project link (Cmd+L) / Copy link to composition | MISSING | M13 |
| Single-editor lock (Transovo) | §C5 | M1–M6 (exists) |

### 11. App settings (Cmd+,) — 11.1 General

| Feature | In spec | Milestone |
|---|---|---|
| Open settings: Cmd/Ctrl+, ; profile menu; drive selector; editor menu | MISSING | M17 |
| Default project: video or audio-only | MISSING | M17 |
| Appearance Light / Dark / System | PARTIAL §A2 | M17 |
| Transcription: default language (Auto), always ask before transcribing, auto-detect speakers, auto-add frequent corrections (3×) to glossary, notify glossary updates | MISSING | M17 |
| Advanced: automatic volume levels (−16 LUFS), show volume in dB, room tone on gap clips, apply Smart transitions, show wordless media in script, force software video decoding, limit preview to 1080p, default translation style, always show usage info | MISSING | M11 |

### 11. App settings (Cmd+,) — 11.2 Account / drive (admin)

| Feature | In spec | Milestone |
|---|---|---|
| Editor performance & proxy playback troubleshooting | §C4 | M1–M6 (exists) |
| Project won't load / won't save recovery | PARTIAL §C5 | M17 |

### 12. AI features (owner: Later unless noted) — 12.4 Recent changelog items (not in help center)

| Feature | In spec | Milestone |
|---|---|---|
| Gradient fills (shapes/text/captions) | MISSING | M8 |
| Speaker detection pre-processing on Drive media | MISSING | M7 |
| Media Library files transcribe automatically | MISSING | M10 |
| CPU overload warnings in Rooms | MISSING | M15 |
| Transcribe into UK English | MISSING | M7 |

## 3. B5 scope table: replacement rows

Paste these over the matching rows of `script-editor.md` §B5. The Captions, aspect/reframe, burn-in and volume rows stay as they are.

| Feature | Descript behavior (ref) | Transovo scope | Launch? |
|---|---|---|---|
| Studio Sound (voice enhance) | Toggle plus a 0–100% intensity on a layer, sequence track or part of a file. Turns off room tone for that file. Can also run on new recordings ([D:effects-animations-transitions/studio-sound]) | §B10. Server-side job on the proxy audio, with a preview while it processes. | **Launch-required** (M11) |
| Scenes ("/" separator) | `/` inserts a scene boundary. Scenes have their own layout and layers, a thumbnail in the script, a scene rail and a storyboard ([D:getting-started/scenes]) | §B7 | **Launch-required** (M8) |
| Layouts | Layout packs, visual roles, Smart Fill, save, remix and share ([D:templates-and-presets/layouts-apply]) | §B8 | **Launch-required** (M9) |
| B-roll / media insert | Media panel (My Media / Stock), media library, drop onto script, canvas or timeline ([D:descript-tour/media-panel]) | §B9 | **Launch-required** (M10) |
| Music | Audio layer, loop, fades, "Lower audio of other layers" ([D:effects-animations-transitions/lower-other-audio]) | §B9.4 + §B10 | **Launch-required** (M10/M11) |
| Markers / chapters | `#` marker, transport list, chapter copy, per-marker export, AI Add chapters ([D:script-editing/markers-chapters]) | §B11.1 | **Launch-required** (M12) |
| Remove retakes | AI marks earlier takes as ignored, for review ([D:descript-tour/sound-good-tools]) | §B11.2 (LLM over transcript; no AI Studio dependency) | **Launch-required** (M12) |
| Comments / multi-user | Comments panel, @mentions, threads, resolve; Project access ([D:collaboration/project-comments]) | §B12. The single-editor lock (§C5) stays; commenters never take the lock. | **Launch-required** (M13) |
| Recording | Editor Recorder, Rooms, teleprompter, scheduling, async ([D:record/editor-recorder]) | §R (section 5 of this file) | **Launch-required** (M14–M16; desktop recorder M18) |
| Eye Contact, Regenerate/Overdub, Underlord, Edit for clarity, generative media | — | — | Later (unchanged) |


## 4. Paste-ready spec sections (new §B6–§B13, plus additions to C1/C3/C6)

These follow the conventions of `script-editor.md`:
- Every visible control does something (rule 0.x).
- All mutations are ops in the single op log and undo stack (§B1).
- References use `[D:category/slug]` = https://help.descript.com/category/slug.

### B6. Projects, compositions, Project panel, import

**B6.1 Data model.** A project holds three kinds of thing:
- `compositions[]`: each has its own Document/EDL, aspect, fps, canvas resolution and `audioOnly` flag.
- `files[]`: original plus proxy, transcript, speakers, `avOffsetMs`, `channels`, `visualRole`, `issues[]`.
- `sequences[]`: see B11.3.

The existing Clipper "Full video" and the clip compositions (§C6) become entries in `compositions[]`. [D:working-in-projects/overview]

**B6.2 Composition management.** The composition menu (name dropdown in the top bar, and the Project panel ⋯) offers:
- New (⌥⌘N)
- Rename
- Duplicate
- Copy to another project
- Copy link (`/edit/:compositionId`)
- Open in new window
- Set audio-only / video
- Flatten
- Copy highlights to new composition
- Delete, with confirmation

Composition settings:
- Aspect: 16:9, 9:16, 1:1, 4:5 or custom W×H
- FPS: 23.976, 24, 25, 29.97, 30, 50, 60
- Canvas: 720p, 1080p, 1440p or 4K
- Audio-only: hides the canvas and makes Export default to Audio. A blank composition whose first insert is audio becomes audio-only automatically.

[D:working-in-projects/aspect-ratio] [D:working-in-projects/audio]

**B6.3 Project settings (File ▸ Project settings).** Settings, with defaults inherited from App settings (B13.3):
- Automatic leveling: on, −16 LUFS.
- Room tone in new gap clips: on.
- Optimize storage: proxy-only cache.

"Apply to all new projects" writes the setting back to App settings. [D:working-in-projects/project-settings]

**B6.4 Project panel.** Sidebar ▸ Project (⌥⌘C) has two sections, Compositions and Files.

Organizing files:
- Folders and subfolders: + ▸ Add folder, drag files in, rename or delete from ⋯.
- Automatic folders: Sequences, Recordings ("Room – date"), Saved frames.
- Search box (name contains).
- Type filter: audio, video, image, other.
- Sort: name, date added, date modified.

File ⋯ menu. Every action is an op where it changes the project.
- Rename
- New composition from file
- Duplicate
- Create sequence (multi-select)
- Insert into script at cursor
- Add as new layer to current scene
- Transcribe / Re-transcribe (language picker)
- Detect speakers
- Detect filler words
- Convert to mono (L, R or mix)
- Separate into mono files
- Normalize audio
- Detach audio
- Replace file…: keeps edits by mapping by time. The transcript is not regenerated unless asked.
- Replace transcript / Import transcript (SRT, VTT, TXT with timecodes)
- Change visual role
- Set A/V sync offset (±ms, with a preview loop of 3 s)
- Repair audio drift: server-side resample to a constant frame rate.
- Fix file issue: shown when the ⚠ badge is present. Examples: VFR, a missing audio track, odd sample rate, HDR.
- View metadata: codec, resolution, fps, sample rate, channels, duration, size.
- Download original
- Delete: blocked while the file is in use, and the dialog lists where it is used.

[D:add-and-manage-media/project-file-actions] [D:add-and-manage-media/replace-file] [D:add-and-manage-media/av-sync]

**B6.5 Import.** There are three ways in:
1. Drag files into the script, which uploads and transcribes them at the drop caret.
2. Drag files into Files, or use File ▸ Import, which uploads without transcribing.
3. Import from another project or from the media library. Both reference the existing object, so nothing is re-uploaded.

Accepted formats:
- Audio: WAV, MP3, AIFF, M4A, FLAC, OPUS, AAC.
- Video: MP4, M4V, MOV, WEBM, MKV (H.264, HEVC, VP8, VP9, ProRes).
- Images: PNG, JPEG, GIF, WEBP, HEIC, BMP.
- PDF: each page becomes a PNG/JPG in a folder named after the PDF.

Other import behavior:
- Files with three or more audio channels are downmixed to stereo.
- Uploads are resumable and chunked, using the same uploader as §R4.
- The Activity popover (top bar) shows per-file progress and a Cancel button. Cancelled uploads are not billed.
- Google Drive and Zoom import are Later.

[D:add-and-manage-media/supported-file-types] [D:add-and-manage-media/slides]

**B6.6 Duration and word count.** The status line shows the selection's word count and duration. With no selection it shows the whole composition. [D:working-in-projects/duration-word-count]

**B6.7 Backups.** File ▸ Export project backup produces a `.transovo.json` with the ops and file references. "New project from backup" restores it. The C2 versions stay the primary safety net. [D:working-in-projects/backups]

### B7. Scenes, canvas and layers

**B7.1 Scene model.** A `sceneBreak` token (already reserved in §B1) starts a scene. The first scene starts implicitly at 0. Each scene has:
- `layoutRef`
- `background` (color, gradient or image)
- `layers[]`

Layers are in one of these states:
- **Scene-local:** belongs to one scene.
- **Attached:** spans to the scene end.
- **Multi-scene:** "Apply to all scenes", or dragged across a boundary.

[D:visuals/scenes-layers] [D:visuals/attach-layer]

**B7.2 Creating and editing scenes.**

Creating scenes:
- `/` in the script, outside Correct mode, inserts a boundary at the cursor.
- `/` on an empty line, the "+ New scene" button or ⇧⌘Enter creates an empty scene.
- The timeline Split button with a scene target, or selection toolbar ▸ Add scene, also inserts a boundary.

Each boundary shows a 56×32 thumbnail in the script margin. Clicking it selects the scene, and the Properties panel switches to Scene.

Editing scenes:
- **Move a boundary:** drag the thumbnail grabber in the script, or the boundary in the timeline scene rail.
- **Delete a boundary:** right-click ▸ Delete boundary, or Delete when it is selected. The two scenes merge and the earlier scene's layout wins.
- **Reorder:** drag scenes in the timeline scene rail, or in Storyboard view (View ▸ Storyboard). This moves the scene's words and media as one block.
- **Navigate:** ⇧⌘. / ⇧⌘, and the transport ◀ ▶ buttons.

[D:getting-started/scenes] [D:visuals/boundaries]

**B7.3 Scene properties.** With no layer selected the panel shows:
- Layout (opens the picker, B8)
- Duration (read-only; for empty scenes it can be set, default 3 s)
- Background (color, gradient or image)
- Layers list: stack order, rename, eye, lock, delete, drag to reorder
- "Apply to all scenes" toggle for the background

**B7.4 Canvas.**

Selecting:
- Click to select. The script-track layer gets a purple outline and other layers a blue one.
- Shift-click or marquee adds to the selection. Properties then show "Mixed" for values that differ.

Arranging:
- Handles move, resize (Shift keeps the aspect), rotate and corner-radius. Double-click enters crop.
- Snap guides cover canvas edges, centers, other layers and safe areas. Toggle with ⇧⌘'.
- Align (L, C, R, T, M, B) and distribute (3 or more layers) sit in the multi-select toolbar.
- Order: `]` front, `⇧]` forward, `⇧[` backward, `[` back.
- ⌘D duplicates, ⌥-drag duplicates, ⌥H hides, ⌥L locks.
- ⌘. expands or shrinks the scene editor.

Right-click a layer for:
- Select layer (when layers are stacked)
- Layer order
- Replace media (keeps timing and transforms)
- Change source
- Save current frame to project files (PNG)
- Delete

[D:visuals/scene-editor-tools] [D:visuals/multi-select]

**B7.5 Layer properties.**

Common to all layers:
- Position x, y, w, h, rotation
- Corner radius
- Crop L/T/R/B
- Opacity
- Border (thickness and color)
- Fill (solid, linear or radial gradient with stops, eyedropper)
- Visual role
- Current scene / All scenes toggle

Timed layers (video, audio, GIF):
- Duration
- Speed (0.25–4×, or "set exact duration")
- Loop / Once / Freeze last frame
- Volume, pan, mute, solo

Paste keeps the layer's offset from the scene start. [D:visuals/layer-properties] [D:visuals/clip-properties]

**B7.6 Elements panel.**

- **Text:** presets Title, Subtitle and Text. Types:
  - Freeform
  - Captions (B7.7)
  - Speaker name (auto)
  - Composition name
  - Marker title (current marker)
  - Timer (counts up or down)

  Text background options: box fixed or auto, padding, radius, color, and "hug lines" vs one box.
- **Fonts:** Google Fonts search, upload TTF/OTF/WOFF to the drive's fonts, brand fonts listed first.
- **Shapes:** rectangle, ellipse, line, arrow.
- **Waveform:** styles Lines, Circle, Ring and Wave. Settings: speaker source, fill, size, fidelity, magnitude, mirror.
- **Progress bar:** styles Bar, Ring and Pie. Settings: color, start %, end %.
- **Placeholder:** Media, Camera or Screen, with a note. Clicking a placeholder offers Add file, Record (opens §R1 with that role), or Stock.

[D:visuals/text-layers] [D:visuals/shapes] [D:visuals/waveforms] [D:visuals/progress-bars] [D:visuals/placeholder-layers]

**B7.7 Captions additions to §B5.**
- Convert text layer ↔ captions.
- Per-speaker caption layers: one per speaker, each with its own style.
- Gradient fills on caption text and active-word fill.

[D:visuals/captions]

**B7.8 Timeline additions to §B4.**
- Scene rail above the lanes.
- Layer lanes for every non-script layer (B-roll, text, music, effects), each with a mute/hide toggle (`0`).
- Range tool (R): drag over a span to delete it, make a gap, add visuals or add a label.
- Slip tool (Y).
- Holding a tool key switches tools temporarily.
- Freeze frame: right-click video ▸ Add freeze frame, with a duration.
- Automatic microfades: a 5-sample fade at every cut. Always on and not user-visible.
- Next/previous clip: ⌥⇧⌘. / ,
- Spot audition: ⇧⌘Space plays 1 s around the playhead.
- Layer size: compact, default or large.
- Show in timeline: markers, comments, audio pins and the VU meter.

[D:timeline/timeline-tools] [D:timeline/freeze-frames]

### B8. Layouts and layout packs

**B8.1 Model.**
- A *layout pack* is a set of layouts grouped by type: Camera, Screen+Camera, Media, Chapter/Title, Intro, Outro, Captions. One pack can hold several aspect ratios.
- A *layout* is a scene template. Each layer in it is either fixed or a **placeholder** with a visual role (Talking head, Screen recording, Graphics, B-roll). Text slots can have **Smart Fill**.

[D:templates-and-presets/overview]

**B8.2 Applying a layout.** Three entry points:
- Scene thumbnail ▸ Layout
- Scene properties ▸ Choose layout
- Timeline right-click ▸ Change layout

The picker (⌥⌘P) shows the current pack grouped by type, with "N more" per group.

Matching rules when a layout is applied:
- Layers in the scene fill placeholders with the same visual role. Camera and media roles are interchangeable when no exact match exists.
- Locked layers are never moved.
- An unmatched layer becomes a "leftover", shown in a toast with Restore, Restore all and Dismiss.
- An empty scene receives every layout layer.
- Smart Fill puts the current marker or the first sentence into Title/Subtitle, and the speaker name into Speaker.
- Edited layers keep their edits when the layout changes.

[D:templates-and-presets/layouts-behavior] [D:templates-and-presets/layouts-apply]

**B8.3 Managing packs.**
- **Change pack:** tabs Gallery, Drive and Private, with search. Changing the pack doesn't rewrite scenes that already have a layout unless you click "Apply to all scenes".
- **Save scene as layout:** set a name and a target pack, then choose per layer: Keep, Don't include, or Turn into placeholder.
- **New pack from scratch:** opens a pack-editing composition where each scene is one layout. Publish it as Private or Drive.
- **Remix a gallery pack:** set primary, accent and background colors, title/subtitle/body fonts, and element visibility.
- **Share:** a pack link, which the recipient adds with "+ Copy to my layout packs".
- **Drive default pack:** set in Brand ▸ Layout packs. New compositions start with it.

Transovo already has Brand kit and Templates (§C6). Layout packs live under **Brand ▸ Templates**. Brand kit fonts and colors appear first in every picker.

[D:templates-and-presets/layouts-save] [D:templates-and-presets/layouts-remix] [D:templates-and-presets/layouts-sharing] [D:templates-and-presets/layouts-default]

### B9. Media panel, B-roll, media library, stock, music

**B9.1 Media panel.** Sidebar ▸ Media (⌥⌘L) has two tabs.

**My Media:**
- Browse by location: Media library, Brand, and this or other projects.
- Search by file name.
- Multi-select with ⌘-click or ⇧-click.

**Stock:**
- Categories: video, images, GIFs, stickers, backgrounds, music, sound effects.
- Search and category filters.
- Hover preview; audio previews play inline.

[D:descript-tour/media-panel]

**B9.2 Inserting media.**
- **Drag to the script:** inserts at the caret. A video with speech is transcribed; otherwise it becomes wordless media.
- **Drop onto selected words:** creates a B-roll layer anchored to those words. The layer moves and trims with them.
- **Drop onto a Range selection:** creates scene boundaries around it automatically.
- **Drag to the canvas:** adds a layer to the current scene.
- **Drag to the timeline:** adds the layer at that time on a lane.
- **Right-click:** Add to project files, or Add at playhead.

**B9.3 Media library (drive-level).**
- Library actions: upload, folders, rename, move, remove and copy link.
- Library files auto-transcribe in the background, so they can be searched.
- Permissions follow Transovo workspace roles.

[D:add-and-manage-media/media-library-overview]

**B9.4 Music and SFX.**
- An audio layer on a music lane with Loop, Once, fade in/out handles and volume.
- "Lower audio of other layers" (ducking) with an Amount of −3…−30 dB, default −12. It applies while this layer has speech. Several ducking layers never duck each other.
- Stock music and SFX come from a licensed provider. Implementation picks the provider, and needs a commercial licence [verify]. GIPHY-style non-commercial sources are excluded.

[D:effects-animations-transitions/lower-other-audio]

### B10. Audio: Studio Sound, leveling, room tone, automation, meter

**B10.1 Studio Sound.**
- Turn it on in Properties ▸ Audio ▸ Effects ▸ Studio Sound, with Intensity 0–100% (default 80).
- Targets: the script layer, a sequence track, or a time selection ("part of a file").
- It is a server job on the proxy that produces an enhanced proxy, with progress shown in the effects row. Export uses the enhanced original.
- When it's on, room tone for that file is disabled, and the UI says so.
- Recording setting: "Apply Studio Sound after recording" (§R2).

[D:effects-animations-transitions/studio-sound]

**B10.2 Automatic leveling.**
- Set in App settings, Project settings and per clip (⌥⇧⌘L).
- Target −16 LUFS short-term. Applied in preview and export.

[D:effects-animations-transitions/auto-leveling]

**B10.3 Room tone.**
- Sampled from the quietest 2 s within the file's first 30 s.
- Fills gap clips and cut points. On by default.

[D:effects-animations-transitions/room-tone]

**B10.4 Volume and pan.**
- Volume and pan per layer, selection, sequence track, or the whole composition (Composition audio properties).
- Volume keyframes: diamond handles on the clip's volume line, with fade presets.

[D:effects-animations-transitions/volume-automation-and-keyframes] [D:effects-animations-transitions/composition-audio-properties]

**B10.5 Effects stack.**
- Effects run top to bottom: add, reorder, bypass, remove, and ⋯ ▸ presets.
- At launch the stack holds only Studio Sound, leveling and ducking. EQ, compressor and the rest are Later.

[D:effects-animations-transitions/apply-adjust]

**B10.6 VU meter.**
- A −30…0 dB stereo meter in the timeline header, with peak hold.
- Volume can be shown in dB or %, set in App settings.

[D:effects-animations-transitions/vu-meter]

### B11. Markers/chapters, retakes, sequences and multicam

**B11.1 Markers.**
- **Add:** type `#` at the start of a line, or use Insert ▸ Marker. It creates a `marker` token with a title, which shows as a bold section header in the script.
- **Edit:** drag the grabber to move, type to rename, Delete to remove.
- **Navigate:** transport ▸ Markers dropdown, plus ⌥⌘. / ⌥⌘, to jump. Markers show as flags on the ruler.
- **Copy chapters:** writes `0:00 Title` lines for YouTube. The first chapter must be at 0:00, so add one if missing.
- **Export:** Export ▸ Range "Markers" writes one file per marker. Markers become chapter metadata in MP3, M4A and MP4, and headers in DOCX/HTML/MD transcripts.
- **Add chapters (AI):** an LLM over the transcript proposes 3–12 markers with titles. Show a review list (Add all / Add selected / Copy).

[D:script-editing/markers-chapters]

**B11.2 Remove retakes.**
- An LLM plus alignment pass finds repeated sentences and false starts.
- It marks every take except the last (or the best, per the model) as **Ignored**, never Deleted, and shows a review bar ("Retake 3/11 — Keep this one instead").
- Bulk Accept is one undo step.
- Recording retakes are in §R7.

[D:descript-tour/sound-good-tools]

**B11.3 Sequences.**
- A sequence is a nested multitrack: up to 14 tracks, each a file with an offset.
- Create with Create sequence from selected files, or via "Multicam & multitrack".
- Sequence editor (⇧⌘O) features:
  - Mute/solo per track
  - Autosync: audio cross-correlation, with a reported confidence
  - Nudge with arrows (1 frame), ⌘ (½ frame), ⇧ (5 frames), ⌥ (1 s)
  - Per-track volume, pan, effects and leveling
  - Include/remove track from script
- The script interleaves all included tracks' words by time.
- Fix duplicate transcripts (mic bleed) keeps the word from the louder track, and can be reverted.

[D:script-editing/multi-track-sequences-overview] [D:script-editing/sequence-editor] [D:script-editing/fix-duplicate-transcripts-or-mic-bleed]

**B11.4 Automatic multicam.**
- Modes: Automatic, or Active speaker only.
- Cutaways: Occasional (~30 s) or Frequent (~10 s).
- It writes camera switches as scene layer visibility, so they can be edited afterwards.
- Center active speaker reframes a wide shot to the speaker's face. It reuses the Clipper speaker-follow reframe data.

[D:visuals/automatic-multicam] [D:visuals/center-active-speaker]

### B12. Comments and project access

**B12.1 Comments.**
- **Adding:** select words, then click the 💬 in the selection toolbar or press ⇧⌘M. The comment opens in the right Comments panel and the commented range gets a yellow underline.
- **Comment features:**
  - Edit and delete (own only)
  - @mention a project member, which sends an email with a deep link `?comment=id`
  - Threaded replies
  - Resolve (✓) moves it to Resolved; Reopen brings it back
- **Panel:**
  - Sort by time in the script or by created date
  - Filter: Open, Resolved, All
  - "Copy comments as text"
- **Timeline:** comment markers on the ruler.
- **Copying:** comments are not copied by copy/paste or duplicate.
- **Anchoring:** comments anchor to word ids, so they survive edits. If the anchor words are deleted, the comment shows "Text removed" with a jump to the nearest point.
- **Who can comment:** commenters can comment without taking the §C5 edit lock. New comments appear for other viewers within 5 s.

[D:collaboration/project-comments]

**B12.2 Project access.**
- The Share button (top right, ⇧⌘A) opens a dialog: invite by email as Editor or Commenter, a link setting (Off / Anyone in workspace can comment / … can edit), Copy link (⌘L), and Copy link to composition.
- Roles map onto Transovo workspace permissions.
- Commenter = read plus comment, no export.

[D:collaboration/project-links] [D:working-in-projects/access]

### B13. Command surfaces: menus, action bar, script formatting, settings

**B13.1 Menus.** Add the Descript File/Edit/View/Insert/Help items listed in feature map §2.2–2.5 that serve Launch features:
- **File:** New project, New composition, Duplicate, Move, Project settings, Set audio-only, Import, Export project backup.
- **Edit:** Paste special ▸ Replace script track, Copy/Paste attributes ⇧⌘V.
- **View:** Toggle scene editor, Timeline view / Storyboard, layer size, Show in timeline (markers, comments, pins, meter), autoscroll.
- **Insert:** Marker, Scene, Text, Shape, Comment, File into script, Inline note, Recording, Layout picker.

**B13.2 Action bar (⌘K).** A searchable palette of every menu command. It also does:
- Jump to: composition, marker, scene `#12`, or a time (`1:32:24`, `1h 32m`, `24.2`).
- Copy highlights (all, or by color).
- Stock search.

Every entry shows its shortcut. [D:descript-tour/action-bar]

**B13.3 Script formatting.**
- Bold (⌘B), italic (⌘I) and highlight in 5 colors (⇧⌘H), with a highlighter filter.
- "Copy highlights to new composition".
- Inline notes: non-spoken text, not in captions or exports unless chosen.
- Remove ignored text (bulk).
- Labels for wordless media: [music], [applause].
- Realign words in range.
- Re-transcribe with a language choice.
- Import/replace transcript.

[D:script-editing/highlights] [D:script-editing/realign-range]

**B13.4 App settings (⌘,).**
- **General:** default composition type, theme (Light/Dark/System).
- **Transcription:** default language (Auto), Always ask before transcribing, auto-detect speakers / ask for the speaker count, add frequent corrections (3×) to the glossary, notify about glossary changes.
- **Advanced:** auto-leveling default, show volume in dB, room tone on gap clips, show wordless media, force software decoding, limit preview to 1080p, Smart transitions (Later).
- **Recording:** see §R2 defaults.

The Transcription glossary (Tools ▸ Transcription glossary) holds terms and "Do not translate".

[D:account-and-app-settings/app-settings] [D:script-editing/transcription-glossary]

**B13.5 Speakers.**
- Automatic speaker detection, with an "Identify speakers" modal that plays a sample per speaker so you can name them.
- Ask for the number of speakers before detection.
- Detect speakers from the file ⋯ menu.
- Drag a speaker label to move a speaker change.

[D:script-editing/speaker-detection]

### C1 additions (shortcuts)

Add these as the features land:

| Action | Mac | Windows |
|---|---|---|
| Marker | # | # |
| Scene | / | / |
| Text | ⌥⌘T | Ctrl+Alt+T |
| Shape | ⌥⌘S | Ctrl+Alt+S |
| Comment | ⇧⌘M | Ctrl+Shift+M |
| Next/prev marker | ⌥⌘. / , | Ctrl+Alt+. / , |
| Next/prev scene | ⇧⌘. / , | Ctrl+Shift+. / , |
| Next/prev clip | ⌥⇧⌘. / , | Ctrl+Alt+Shift+. / , |
| Spot audition | ⇧⌘Space | Ctrl+Shift+Space |
| Range / Slip tool | R / Y | R / Y |
| Layer front/fwd/back/back-most | ] / ⇧] / ⇧[ / [ | same |
| Duplicate / hide / lock layer | ⌘D / ⌥H / ⌥L | Ctrl+D / Alt+H / Alt+L |
| Snap to guides | ⇧⌘' | Ctrl+Shift+' |
| Mute/hide layer | 0 | 0 |
| Bold / Italic / Highlight | ⌘B / ⌘I / ⇧⌘H | Ctrl+B / I / Ctrl+Shift+H |
| Paste attributes | ⇧⌘V | Ctrl+Shift+V |
| Edit sequence | ⇧⌘O | Ctrl+Shift+O |
| Auto-level clip | ⌥⇧⌘L | Ctrl+Alt+Shift+L |
| Action bar | ⌘K | Ctrl+K |
| Project contents / Media / Layout picker | ⌥⌘C / ⌥⌘L / ⌥⌘P | Ctrl+Alt+C / L / P |
| Project access / Copy link | ⇧⌘A / ⌘L | Ctrl+Shift+A / Ctrl+L |
| Find in project | ⇧⌘F | Ctrl+Shift+F |
| Settings | ⌘, | Ctrl+, |
| Record (start/stop in recorder) | R / Space | R / Space |

Resolved conflicts:
- Descript binds Split layer to ⇧⌘S, and Toggle timeline also to ⇧⌘S. Transovo keeps Toggle timeline as ⌃⌥T + ⇧⌘S (already in C1) and puts split on `S` only.
- ⌘G stays Find next. Word-gap adjust stays on right-click only.

### C3 additions (export)

- **Range:** Current scene, All scenes (one file each), Markers (one file each), All compositions.
- **GIF:** ≤30 s, 480p/720p, 10/15 fps.
- **MP4:** optional embedded subtitle track (mov_text); burn-in stays separate.
- **Audio:** ID3 and MP4 metadata: show title, episode title, description, artwork, and chapters from markers.
- **Transcript:** add markers as headers, timecodes at markers, a timecode offset, and an option to include ignored text.
- **Sequence:** export a soloed sequence track as a mono WAV.

[D:export-and-share/video-gif] [D:export-and-share/audio] [D:export-and-share/transcript]


## 5. Recording (§R): all Launch

Descript records in three places:
- **Editor Recorder:** inside a project.
- **Rooms:** remote guests, recorded locally and uploaded.
- **Desktop recorder:** a menu-bar app for screen recording.

Every recording row in feature map §6.1–6.7 is Launch. Transovo builds everything browser-first. Only the items in §R1.2 need a desktop companion (M18).

**LiveKit Cloud (M15–M16):** normative API + file layout is **`livekit-api-brief.md`** in this folder (official docs + SDK source, 2026-10-26). Pinned packages: `livekit-client@2.23.0`, `@livekit/components-react@2.9.24`, `@livekit/components-styles@1.2.0`, `livekit-server-sdk@2.19.2`. **Do not** start recording milestones until **M5–M13** editor work is complete. **Coolify env** (owner-provisioned): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`.

### R1. Browser vs desktop feasibility

#### R1.1 Feasible in the browser (Chrome/Edge primary, Firefox/Safari secondary)

| Capability | Browser API | Notes |
|---|---|---|
| Webcam | `getUserMedia({video:{deviceId,width,height,frameRate}})` | Up to 1080p30/60 or 4K where the camera supports it. Resolution follows device constraints. |
| Microphone, audio-only | `getUserMedia({audio:{deviceId, echoCancellation, noiseSuppression, autoGainControl, channelCount}})` | Default for local-first: **EC/NS/AGC off** (raw, like Descript's Rooms "original sound"). Turn EC on only when the person has no headphones. |
| Screen / window / tab | `getDisplayMedia()` | Desktop browsers only, not mobile. The user must pick a source every time (OS picker). |
| Computer audio | `getDisplayMedia({audio:true})` | Chrome/Edge: tab audio everywhere, plus whole-system audio on Windows and ChromeOS. **macOS: tab audio only.** Firefox and Safari: none [verify per version]. |
| Screen + camera | Two parallel recorders | Separate files (screen track and camera track), placed as layers with an auto layout (B8). |
| Region capture | Record the whole display, then crop the layer afterwards | `CropTarget` region capture only applies to the current tab. |
| Hide our own tab from capture | `selfBrowserSurface:'exclude'`, `surfaceSwitching`, `monitorTypeSurfaces` | This is the teleprompter workaround: the prompter lives in our tab and the user shares another window. |
| Recording | `MediaRecorder(stream,{mimeType, videoBitsPerSecond, audioBitsPerSecond})` with `start(timesliceMs)` | Chrome: `video/webm;codecs=vp9,opus` or `video/mp4;codecs=avc1,opus` [verify version]. Firefox: webm VP8/Opus. Safari: mp4 H.264/AAC. Audio-only recording also produces lossless WAV via an AudioWorklet PCM tap. |
| Pause / resume | `MediaRecorder.pause/resume` | Descript has pause/resume in the Editor Recorder. |
| Countdown, hotkeys | App UI | 3-2-1 overlay. Hotkeys only work while the tab has focus, so there are no global hotkeys. |
| Device hot-swap | `devicechange` event | Shows "Mic disconnected". Stops gracefully and saves the take. |
| Local buffer | OPFS (preferred) or IndexedDB, plus `navigator.storage.persist()` and `estimate()` | Warns below 20 GB free, as Descript does. |
| Remote guests | WebRTC via an SFU (LiveKit) | Live preview only. The real recording is local (R3). |
| Live captions | Streaming ASR over the SFU audio track (server side) or Web Speech API | Descript Rooms has live captions. |
| Background upload while recording | `fetch` PUT to presigned URLs from a Web Worker | Runs while recording. Backgrounded tabs keep running. A closed tab stops; R6 recovers. |

#### R1.2 Needs a desktop app (M18 companion, Electron or Tauri)

| Capability | Why the browser can't |
|---|---|
| macOS system-wide audio | Browsers expose tab audio only. A native app needs ScreenCaptureKit (macOS 13+). |
| Teleprompter that stays on top and is hidden from capture | The browser can only exclude its own tab. A native window can set `NSWindow.sharingType = .none` / `SetWindowDisplayAffinity`. |
| Menu-bar or tray recorder, global hotkeys, launch at login, quick "record screen" from anywhere | Needs an OS process. |
| Robust long 4K60 screen recording with a hardware encoder and no tab-throttling risk | Browser encoding can drop frames on weak CPUs. Native uses VideoToolbox/NVENC. |
| Recording that survives closing the browser | The tab owns the MediaRecorder. |
| Multi-display or region capture with a live crop | Partly possible in the browser (crop after the fact). Native is cleaner. |

**Recommendation:** ship the browser recorder as Launch (M14–M16). The desktop companion (M18) reuses the same chunk uploader and API, so it only adds capture sources.

### R2. Editor Recorder (solo): modes and settings

**Entry points:**
- Insert ▸ Recording
- The timeline toolbar ● Record button
- A placeholder's "Record" action (B7.6)
- `R` key in the recorder panel
- Drive header ▸ Record (opens a new project)

[D:record/editor-recorder]

**Modes:**
- Audio only (mic)
- Camera (camera + mic)
- Screen (+ mic, + computer audio)
- Screen + Camera

The recorder panel docks on the right with live previews, a level meter per input, and the elapsed time.

**Recording settings** (gear icon). Defaults live in App settings ▸ Recording.
- **Inputs:** camera, mic, screen source, computer audio on/off.
- **Speaker label:** who is speaking.
- **Video resolution:** 720p / 1080p / 4K (if the device allows). Frame rate 30/60.
- **Audio:** Raw (EC/NS/AGC off) or Processed. Mono or stereo.
- **Countdown:** off / 3 s / 5 s.
- **After recording:**
  - Auto-transcribe (on)
  - Apply Studio Sound (off)
  - Remove filler words (off)
  - Apply layout: none, or a Screen+Camera layout from the pack (B8)
- **Where it goes:** insert at the script cursor, as a new scene, or as a new composition.
- **Camera overlay preview:** a picture-in-picture bubble while screen recording.

**Takes:**
- **Pause/Resume**, plus **Restart** (discards the current take after confirmation).
- **Stop:** the take appears immediately as a "Processing" block at the target position. It is replaced by transcribed words when the job finishes.

### R3. Local-first architecture (the main design)

```
 Browser (each participant)                         Cloud
 ┌──────────────────────────────────────┐
 │ getUserMedia/getDisplayMedia         │  WebRTC (simulcast, ≤720p)   ┌───────────────┐
 │   ├─► LiveKit publish (preview) ─────┼─────────────────────────────►│ LiveKit SFU   │──► other guests
 │   └─► MediaRecorder per track        │                              └───────────────┘
 │        timeslice 6 s                 │
 │        ▼                             │  presigned PUT per chunk      ┌───────────────┐
 │   OPFS/IndexedDB chunk store ──────► │ ─────────────────────────────►│ Backblaze B2  │
 │   upload worker (retry, backoff)     │                               └──────┬────────┘
 └──────────────────────────────────────┘                                      │ "track complete"
                                     API: /rec/sessions, /chunks/presign, /complete
                                                                               ▼
                                      Post-session jobs: concat → remux/proxy → ASR → align → place in project
```

**Rules**

1. **Recording is local and full quality.**
   - Each participant records each track separately (camera, mic WAV/Opus, screen) with its own MediaRecorder. The defaults are below.
   - The SFU preview never feeds the edit.

   | Track | Default |
   |---|---|
   | Camera | 1080p30, ~6–8 Mbps |
   | Screen | native resolution, ≤ 4K, ~8–12 Mbps |
   | Mic | 48 kHz PCM via AudioWorklet → WAV chunks, plus Opus inside the webm as a backup |

2. **Chunking.** `MediaRecorder.start(6000)` emits one Blob roughly every 6 s.
   - Each Blob is written first to **OPFS** as `rec/<session>/<participant>/<track>/<seq>.part`, with an IndexedDB index row: seq, bytes, sha256, wallclockStart, perfNowStart, uploaded=false.
   - Then it is queued for upload.
3. **Uploads are one object per chunk, not S3 multipart.**
   - Each chunk is PUT to `b2://transovo-rec/<session>/<participant>/<track>/<seq:06d>.webm` using a presigned URL. The API presigns in batches of 50.
   - Why not multipart: S3/B2 multipart parts must be ≥ 5 MB (except the last) [verify]. Audio chunks are far smaller, and an incomplete multipart upload can't be read until it is completed.
   - Single objects are idempotent: re-PUTting the same seq overwrites the same bytes, so retries are safe.
   - B2 charges nothing for uploads (Class A transactions are free; see R8).
4. **Resume.** The upload worker retries with exponential backoff (1 s → 30 s max).
   - On `online`, a visibility change or app start, it scans the IndexedDB index for `uploaded=false` and resumes.
   - A network drop therefore only delays the upload; nothing is lost while the tab and disk survive.
   - Chunks stay in OPFS until the server confirms them (HEAD/ETag), and are deleted 24 h after the session completes.
5. **No live server transcoding.**
   - During the session the server only issues presigned URLs and records chunk metadata.
   - After **Stop** plus "all chunks uploaded" (or the 7-day timeout), a job:
     - concatenates the chunks. WebM timeslice chunks are one continuous stream, so a byte-wise concat is valid; MP4 (Safari) is fragmented MP4, also concat-safe [verify].
     - remuxes to MP4/WAV, makes proxies, runs ASR and speaker labelling, and places the tracks as a **sequence** (B11.3) in the target project.
6. **Clock sync.**
   - Each chunk carries `wallclockStart` plus `perfNow`. The client measures its offset against the server clock with an NTP-style ping every 30 s.
   - Coarse alignment uses the corrected wallclock (±20 ms). Fine alignment uses audio cross-correlation, the same autosync as B11.3.
7. **Backpressure.** If the upload queue holds more than 60 s of unsent data, show "Uploading behind — keep this tab open".
   - The guide calls for an uplink of ≥ 10 Mbps for 1080p (≈ 8 Mbps recording upload plus ≈ 1.5 Mbps simulcast publish).
   - Recording never pauses because of upload speed. Only the local disk limits it.
8. **Disk.** At Start the recorder estimates storage. It warns below 20 GB, and stops the camera track (keeping audio) below 2 GB.

### R4. Rooms (remote recording)

**Room basics** [D:record/rooms-overview]
- A Room belongs to a project.
- **Roles:**
  - **Host:** owner/editor.
  - **Guest:** recorded.
  - **Producer:** not recorded; sees the control room.
- **Waiting room:** guests must be admitted. Joining from the link needs no account; the guest enters a display name only.
- **Device check:** camera, mic, speaker test, the R3.7 bandwidth test, a browser support check, and a headphones prompt.

**During the session**
- The host's Start/Stop records all participants. Each participant sees a red REC badge and their own "Upload: 100% / 2 min behind" indicator.
- **Host control room:**
  - Per-guest controls: mute request, upload status, CPU/network warnings (from WebRTC stats: `qualityLimitationReason`, RTT, packet loss) and local disk.
  - Remove a guest.
  - Producer notes on the timeline.
- **Chat:** text chat via the LiveKit data channel, saved to the project as notes.
- **Live captions:** server-side streaming ASR of the SFU audio. These are for display only; the final transcript comes from the local tracks.
- **Push-to-talk / mute:** for producers.
- **Screen share:** a guest's screen share is also recorded locally as its own track.
- **Separate tracks:** the result has one track per participant and source, already grouped into one sequence with speaker names.
- **Backup recording:** the host also records a mixed SFU composite at low bitrate. This uses LiveKit composite egress at $0.02/min, so it is optional and off by default. It is a safety net if a guest's local upload never finishes within 7 days.

**After the session**
- An upload dialog stays open until 100%. Closing early warns, and gives a **recovery link** (R6).

### R5. Scheduling, invites, async recording

- **Schedule a Room:**
  - Set date, time, timezone, title and guests' emails.
  - Guests get an `.ics` invite plus a join link; the email is sent by Transovo, not by the user's account.
  - The host gets a reminder 10 min before.
- **Async record link:** "Ask someone to record". The guest opens the link, sees an optional script/teleprompter, records solo with the same local-first recorder, and submits. The take lands in the host's project with a notification.
- **Room link:** permanent per project, and can be regenerated (which revokes the old link).

[D:record/schedule] [D:record/async-recordings]

### R6. Recovery and robustness

- **Tab crash or reload during recording:**
  - On next load the app finds unfinished OPFS chunks and offers "Recover recording from <time>". It then uploads the remainder and finalizes.
- **Guest closed the tab before the upload finished:**
  - Their recovery link (valid **7 days**) reopens the uploader.
  - The chunks are still in OPFS, which is same-origin and per-browser profile.
- **Network drop:** local recording continues and uploads resume (R3.4). The SFU reconnects automatically. The status shows "Reconnecting…".
- **Server-side gaps:** if a missing seq is detected at finalize, the host sees "Guest X: 18 s missing at 12:04" with a "Request re-upload" action, which pings the guest's recovery link.

### R7. Retakes during recording

- **Restart take:** discards the current take after confirmation.
- **Replace selection:** select words, then right-click ▸ Re-record. Recording plays a 3 s pre-roll and the new take replaces the selection. The old take stays in Files.
- **Multiple takes:** each Stop/Start in the same slot keeps Take 1…N. The take switcher shows on the block and lets you pick one.
- **Auto-sequence:** a take made while screen + camera are on becomes a sequence automatically.
- **Remove retakes (B11.2):** can run on the result.

[D:script-editing/fix-take] [D:record/rooms-recover-replace] [D:record/recover]

### R8. SFU choice: LiveKit Cloud vs self-hosted

**Sources (fetched 2026-10-26):**
- https://livekit.io/pricing
- https://docs.livekit.io/home/self-hosting/benchmark/
- https://www.backblaze.com/cloud-storage/pricing

**LiveKit Cloud plans:**

| Plan | Monthly | Included WebRTC participant-minutes | Overage | Concurrent connections | Bandwidth included → overage |
|---|---|---|---|---|---|
| Build | $0 | 5,000 | — | 100 | 50 GB |
| Ship | $50 | 150,000 | $0.0005/min | 1,000 | 250 GB → $0.12/GB |
| Scale | $500 | 1,500,000 | $0.0004/min | 5,000 | 3 TB → $0.10/GB |
| Egress (if used) | | Track egress $0.001/min · Composite egress $0.02/min | | | |

**Self-hosted LiveKit:**
- Open-source SFU [verify licence: Apache-2.0].
- One room has to fit on one node.
- LiveKit's benchmark: a GCP c2-standard-16 handled a 150-publisher / 150-subscriber meeting at about 85% CPU, with ~50 MBps in and ~93 MBps out.
- Our load (50 rooms × 3 = 150 publishers, 300 subscriptions in tiny rooms) fits on **one 8–16 vCPU node**, plus a second node for failover.
- Cost: compute ≈ $150–$450/mo per node on hyperscalers [verify], or ≈ $40–$100/mo on Hetzner/OVH dedicated [verify].
- **Bandwidth is what decides it:**
  - Hyperscaler egress is ≈ $0.08–0.12/GB [verify], about the same as LiveKit Cloud overage.
  - Hetzner includes ~20 TB per server [verify].
  - Self-hosting also brings TURN, ops, scaling and on-call work.

**Recommendation:**
- **Launch on LiveKit Cloud Ship.** It has no ops, an SLA and global edges.
- Publish with simulcast (180p/360p/720p) and adaptive stream, so each guest pulls only the layer that fits their tile.
- Cap preview at 720p. This does not affect recording quality, which is local.
- **Move to self-hosted on cheap-bandwidth servers** when monthly SFU bandwidth stays above ~5 TB, which is roughly $500+/mo of overage.
- The client API is the same, so the move is a config change.

### R9. Cost and concurrency: 50 concurrent sessions × 3 people

**Assumptions [verify]:**
- Camera recording 1080p30 at ~8 Mbps ≈ **3.6 GB/h**, plus mic WAV 48 kHz/24-bit mono ≈ 0.5 GB/h (Opus ~0.05).
- Call it **≈ 4 GB per participant-hour** (camera only; screen share adds ~3.6 GB/h).
- Preview publish via simulcast ≈ 1.5 Mbps up. Each participant receives 2 remote streams at ~0.6–1.2 Mbps each.

**Per hour at full concurrency (150 participants):**

| Item | Calculation | Per session-hour of all 50 rooms |
|---|---|---|
| Recording ingest to B2 | 150 × 4 GB | **≈ 600 GB/h**, ≈ 1.3 Gbps aggregate. This goes straight to B2 via presigned URLs, so none of it passes through our servers. |
| B2 upload cost | Ingress is free, and Class A PUTs are free | **$0** |
| B2 storage | 0.6 TB × $6.95/TB-mo | **≈ $4.17 per month** for each such hour kept |
| B2 download for processing | Free up to 3× the average stored per month, then $0.01/GB. Free via Cloudflare/bunny/Fastly CDN partners. | Usually **$0** (each file is read once or twice) |
| SFU participant-minutes | 150 × 60 | 9,000 min, ≈ **$4.50/h** overage on Ship (≈ $3.60 on Scale) |
| SFU bandwidth (down) | 150 × 2 streams × 1.2 Mbps ≈ 162 GB/h. With simulcast at 360–540p ≈ 0.5 Mbps: ≈ 68 GB/h | **≈ $8–19/h** at $0.12/GB (Ship) |
| ASR/processing (post) | 150 participant-h × the existing transcription price | Same as current Transovo per-hour transcription cost [verify current vendor price] |

**Monthly example: 2 hours/day at full concurrency (≈ 60 h/mo, 9,000 participant-hours):**
- **B2:** ≈ 36 TB/mo of new originals.
  - Keep originals 30 days, then delete and keep the 720p proxies (~10%).
  - Steady state ≈ 36 TB + proxies ≈ **$250–275/mo**.
  - If everything is kept forever, it grows by about $250 each month.
- **LiveKit Cloud Ship:**
  - $50 base.
  - Minutes: 540k total − 150k included = 390k × $0.0005 = **$195**.
  - Bandwidth: 60 h × 68 GB ≈ 4.1 TB − 0.25 TB = 3.85 TB × $0.12 = **≈ $462** (simulcast). At full 720p it is ≈ 9.7 TB, about $1,140.
  - **Total ≈ $700/mo** (simulcast), up to ≈ $1,400.
- **Scale ($500):** 540k minutes are included and 3 TB of bandwidth is included. The extra 1.1 TB × $0.10 = $110, for **≈ $610/mo**.
  - Scale wins above ~4 TB/mo or ~1.2M minutes.
- **Self-hosted on 2 Hetzner-class nodes:** ≈ **$100–200/mo** all-in [verify], plus engineering and ops time.

**Concurrency limits:**
- Ship allows 1,000 concurrent connections and Scale 5,000. 150 participants (plus egress) fits easily.
- Our API only issues presigned URLs: 150 participants ÷ 6 s ≈ 25 PUTs/s, with presigning batched every 5 minutes. That is light.
- The B2 per-bucket request limits are not a constraint at this rate [verify B2 rate limits].
- Post-session processing is a burst of 150 track jobs when sessions end. Queue it on the existing job runner with autoscale.

### R10. Streamer / live clipper reuse

The same ingest powers the planned Streamer/live clipper with no new capture code:

1. **Live tail.** Each uploaded chunk is announced (seq, wallclock, URL) on a queue, `rec.chunk.created`.
   - A live-tail worker pulls the **audio** chunks within seconds and runs streaming ASR.
   - The transcript then exists *during* the session, rather than only after it (like Descript live captions).
2. **Live highlights.** The highlight scorer (the Clipper model) runs over a rolling 5-minute transcript window and proposes clips with in/out times in wallclock.
   - Because the chunks are already on B2, a clip can be cut **within 1–2 minutes of happening**, by fetching only the needed chunks (seq range) and making a vertical reframe.
3. **Restream.** Optional. LiveKit egress can push the room to RTMP (YouTube/Twitch) as composite at $0.02/min, or as per-track egress at $0.001/min.
   - LiveKit **Ingress** (RTMP/WHIP) lets OBS or an external encoder join as a participant. Their high-quality feed then comes in through egress recording, and later the desktop companion.
4. **Same storage layout.** The `session/participant/track/seq` objects and the post-session concat job are shared, so a live stream becomes an editable project afterwards.

### R11. Recording milestones

| M | Scope | Depends on |
|---|---|---|
| **M14 Recording I: solo** | Editor Recorder: audio, camera, screen, screen+camera; settings (inputs, resolution, countdown, audio raw/processed); pause/resume/restart; R3 local-first chunked upload with OPFS and resume; post-session concat → proxy → auto-transcribe → insert at cursor or new scene/composition; screen+camera auto layout; disk/bandwidth checks; R6 crash recovery | M6 (integration), B6 uploader; the layout part needs M9 |
| **M15 Recording II: Rooms** | LiveKit Cloud integration; roles (host, guest, producer); waiting room; device check; synced start/stop; separate local tracks per participant; per-guest upload status; upload dialog + 7-day recovery link; chat; live captions; control room; CPU/network warnings; push-to-talk; auto-sequence + autosync (needs M12 sequences) | M14 |
| **M16 Recording III: workflow** | Scheduling with .ics; async record links; multiple takes + take switcher; replace selection (re-record); teleprompter (in-tab, with the `selfBrowserSurface:'exclude'` guidance); optional composite backup egress | M15 |
| **M18 Desktop companion (post-launch)** | Tauri/Electron menu-bar recorder: system audio on macOS, hidden-from-capture teleprompter, global hotkeys, hardware 4K60 capture; same R3 uploader/API | M14 |

M14–M16 can run in parallel with M7–M13 after M6. M14 only needs B6's resumable uploader and the composition model.


## 6. Milestones and D1 acceptance tests (#67+)

### 6.1 Milestone overview

| M | Name | Contents | Spec |
|---|---|---|---|
| M7 | Projects and import | Composition model and menu, composition settings, Project panel with all file actions, import formats/PDF, project settings, backups, speakers, glossary, word count | B6, B13.4–5 |
| M8 | Scenes, canvas, layers | Scene model, `/`, thumbnails, rail, storyboard; canvas transform/align/snap; layer properties; text/shape/waveform/progress/placeholder; caption extras; timeline additions | B7 |
| M9 | Layouts and packs | Picker, apply rules, Smart Fill, save/remix/share, default pack, brand fonts/colors first | B8 |
| M10 | Media, B-roll, music | Media panel, stock, media library, drop-on-words B-roll, freeze frame, speed/loop, music + ducking | B9 |
| M11 | Audio | Studio Sound, auto-leveling, room tone, volume/pan keyframes, effects stack, VU meter | B10 |
| M12 | Markers, retakes, sequences | Markers/chapters, AI chapters, remove retakes, sequences/autosync/mic bleed, automatic multicam, center active speaker | B11 |
| M13 | Collaboration and commands | Comments, project access/share link, menus, ⌘K action bar, bold/italic/highlights, inline notes, shortcuts | B12, B13.1–3, C1 additions |
| M14–M16 | Recording I–III | See R11 | §R |
| M17 | Export and settings completion | Scene/marker/all-composition export, GIF, embedded subs, metadata/chapters, transcript options, app settings dialog | C3 additions, B13.4 |
| M18 | Desktop companion (post-launch) | See R11 | R1.2 |

### 6.2 New D1 rows

Paste these after #66 in `script-editor.md` D1.
- Fixtures: `test_interview_60s` (2 speakers), the 3 h fixture, plus new fixtures `test_screen_30s.mp4`, `test_music_60s.mp3`, `test_slides.pdf` (3 pages), and `test_two_cams/` (2 cams + 1 mic, 2 min, with known 400 ms offsets).
- Run everything in Chrome on transovo.ai production unless the row says otherwise.

| # | Feature | M | Browser test (steps → expected) |
|---|---|---|---|
| 67 | New composition | M7 | Composition menu ▸ New → Untitled composition opens empty; Project panel lists 2 compositions; ⌘Z removes it |
| 68 | Composition settings | M7 | Set 9:16, 60 fps, 1080p → canvas becomes 1080×1920; export metadata shows 60 fps |
| 69 | Duplicate / copy link | M7 | Duplicate composition → "…(copy)" with the same words; Copy link → pasted URL opens that composition at `/edit/:compositionId` |
| 70 | Audio-only composition | M7 | New blank composition, drop an mp3 first → canvas hidden, Export defaults to Audio |
| 71 | Project panel folders/search/sort | M7 | Add folder, drag 2 files in, search "inter" → only matches; sort by date added → order changes |
| 72 | Replace file keeps edits | M7 | Delete 3 words, ⋯ ▸ Replace file with the same media re-encoded → deletions persist, words unchanged, playback correct |
| 73 | A/V sync offset | M7 | Set +200 ms → lip-sync visibly shifts in preview; export reflects the offset (clap fixture: audio peak 200 ms later) |
| 74 | Convert to mono / detach audio | M7 | Convert to mono (L) → meter shows mono; Detach audio → new audio file in Files + muted video layer |
| 75 | File issue badge | M7 | Upload a VFR clip → ⚠ badge; Fix file issue → badge clears after processing |
| 76 | PDF import | M7 | Import `test_slides.pdf` → folder with 3 PNGs named page 1–3 |
| 77 | Import formats | M7 | Upload WAV, FLAC, MOV(ProRes), MKV, HEIC → all accepted and previewable; a .exe is rejected with a message |
| 78 | Upload cancel | M7 | Start a 1 GB upload, cancel in Activity → upload stops; file is not in Files |
| 79 | Speaker identification | M7 | Transcribe the 2-speaker fixture with "ask for speaker count" → modal asks for the count, then plays a sample per speaker; names applied to the whole script |
| 80 | Glossary | M7 | Add "Transovo" to the glossary, re-transcribe → the word is spelled "Transovo" |
| 81 | Project settings defaults | M7 | Turn auto-leveling off in Project settings, "Apply to new projects" → a new project has it off |
| 82 | Word count/duration | M7 | Select 10 words → status shows "10 words · 0:0x"; no selection → totals |
| 83 | Scene via "/" | M8 | Type `/` mid-paragraph → a boundary with a thumbnail appears; the timeline rail shows 2 scenes; ⌘Z removes it |
| 84 | Scene navigation | M8 | ⇧⌘. moves the playhead to the next scene start; transport ◀▶ do the same |
| 85 | Reorder scenes | M8 | Storyboard view: drag scene 3 before scene 1 → script words and media move as a block; playback order matches |
| 86 | Delete boundary | M8 | Delete a boundary → scenes merge; the earlier scene's layout is kept |
| 87 | Scene background | M8 | Set a gradient background on scene 2 → only scene 2 changes; "Apply to all scenes" → all change |
| 88 | Canvas transform | M8 | Drag, Shift-resize and rotate a text layer → values update in Properties; snap guide appears at center |
| 89 | Align / distribute | M8 | Select 3 shapes → Distribute horizontally → equal gaps (±1 px) |
| 90 | Layer order/lock/hide | M8 | `]` brings the layer to front; ⌥L lock → it can't be dragged; ⌥H hide → invisible in preview and export |
| 91 | Crop | M8 | Double-click video → crop handles; crop 20% left → Properties crop L=20%; export matches |
| 92 | Text layer types | M8 | Add Timer text → counts in playback; add Speaker name → shows the current speaker; Marker title → shows the current marker |
| 93 | Custom font | M8 | Upload an OTF → appears in the font picker for all projects in the drive |
| 94 | Waveform | M8 | Add a Circle waveform bound to Speaker 1 → animates only when Speaker 1 talks |
| 95 | Progress bar | M8 | Add a Bar progress → width equals elapsed/scene duration at 3 sampled points (±2%) |
| 96 | Placeholder | M8 | Add a Camera placeholder → click → "Record" opens the recorder in Camera mode; "Add file" fills it |
| 97 | Freeze frame | M8 | Right-click video ▸ Freeze frame 2 s → a still holds 2 s; total duration +2 s |
| 98 | Range tool | M8 | R, drag 5 s on the timeline ▸ Delete → script words in range are struck; duration −5 s |
| 99 | Per-speaker captions | M8 | Enable per-speaker captions → 2 caption layers with different colors; each shows only its speaker's words |
| 100 | Gradient caption fill | M8 | Set a linear gradient on caption text → render shows the gradient; burn-in export matches |
| 101 | Apply layout | M9 | Scene with camera + screen → choose "Screen + Camera" → screen fills the main area, camera goes to the corner bubble; leftovers toast when there are extra layers |
| 102 | Locked layer respected | M9 | Lock the camera layer, apply another layout → the locked layer does not move |
| 103 | Smart Fill | M9 | Apply a Title layout after marker "Intro" → title text = "Intro" |
| 104 | Change pack | M9 | Change pack to another gallery pack ▸ Apply to all scenes → every scene restyled; ⌘Z restores in one step |
| 105 | Save layout | M9 | Save a scene as a layout with the text layer as a placeholder → the new layout appears in the Private pack and applies to another scene |
| 106 | Remix pack | M9 | Change primary color + title font → preview thumbnails update; applied scenes use the new style |
| 107 | Default pack | M9 | Set the drive default pack → a new composition's layout picker opens on that pack |
| 108 | Media panel | M10 | Media ▸ My Media lists project files and the media library; search filters by name |
| 109 | B-roll on words | M10 | Select 8 words, drop a stock clip → a B-roll layer spans exactly those words; delete 2 of the words → the B-roll shortens to match |
| 110 | Stock search | M10 | Stock ▸ search "city" → video results with hover preview; insert → plays in the composition |
| 111 | Media library | M10 | Upload to the media library, open another project → file available without re-upload; it is transcribed (searchable by spoken word) |
| 112 | Speed / loop | M10 | Set clip speed 2× → duration halves; set a GIF to Loop across a 10 s scene → repeats |
| 113 | Music + ducking | M10 | Add `test_music_60s` with "Lower other audio" −12 dB → while speech plays, music is ~12 dB lower (meter); in silences it returns to full |
| 114 | Music fades | M10 | Drag fade-in 2 s → the volume ramps from silence over 2 s in preview and export |
| 115 | Studio Sound | M11 | Enable at 80% → processing indicator then an audible change; toggle off → original; export with it on matches preview |
| 116 | Studio Sound on a selection | M11 | Select 10 s ▸ Studio Sound → only that span is processed |
| 117 | Auto-leveling | M11 | Quiet clip (−30 LUFS) with leveling on → export measures −16 ±1 LUFS |
| 118 | Room tone | M11 | Insert a 2 s gap clip → plays faint room tone (not digital silence, >−70 dBFS) |
| 119 | Volume keyframes | M11 | Add 2 keyframes 0 dB → −20 dB → meter falls during the span |
| 120 | VU meter / dB display | M11 | Meter visible in the timeline header; App settings "show volume in dB" → volume fields in dB |
| 121 | Add marker | M12 | Type `#Intro` at a line start → marker header; transport Markers lists "Intro"; flag on the ruler |
| 122 | Copy chapters | M12 | 3 markers → Copy chapters → clipboard `0:00 Intro\n…`, first at 0:00 |
| 123 | AI chapters | M12 | Add chapters on the 3 h fixture → 3–12 proposals; Add selected creates markers |
| 124 | Marker navigation | M12 | ⌥⌘. jumps to the next marker |
| 125 | Remove retakes | M12 | Fixture with a repeated sentence ×3 → 2 earlier takes marked Ignored; review bar "1/2"; Keep this one swaps; one ⌘Z undoes all |
| 126 | Create sequence + autosync | M12 | Select `test_two_cams` files ▸ Create sequence → auto-sync aligns to ±1 frame of the known offsets; the script interleaves both speakers |
| 127 | Sequence nudge | M12 | In the sequence editor, ⇧→ moves a track 5 frames; mute track 2 → its words are excluded |
| 128 | Mic bleed fix | M12 | Fix duplicate transcripts → duplicate words removed from the quieter track; Revert restores |
| 129 | Automatic multicam | M12 | Run Automatic, cutaways Frequent → camera switches follow the active speaker; each switch is editable |
| 130 | Center active speaker | M12 | Wide 2-person shot in 9:16 with center speaker on → crop follows the speaker's face |
| 131 | Comment on words | M13 | Select words, ⇧⌘M, type → comment in the panel, words underlined; a second user sees it in ≤5 s |
| 132 | @mention | M13 | @mention user B → B receives an email with a deep link that opens the project scrolled to the comment |
| 133 | Thread / resolve | M13 | Reply then Resolve → moves to the Resolved filter; Reopen brings it back |
| 134 | Comment after edit | M13 | Delete the commented words → comment shows "Text removed" and jumps to the nearest point |
| 135 | Commenter role | M13 | Invite B as Commenter → B can comment but can't edit (no lock taken, editing controls disabled) or export |
| 136 | Share link | M13 | Project access ▸ Anyone in workspace can comment ▸ Copy link (⌘L) → a workspace member opens it with comment rights |
| 137 | Action bar | M13 | ⌘K, type "1:32:24" → playhead jumps; "marker Intro" → jumps; "Studio Sound" → runs the command |
| 138 | Bold/italic/highlight | M13 | ⌘B, ⌘I, ⇧⌘H (yellow) on words → formatted; highlighter filter shows only highlights; Copy highlights → new composition contains only those |
| 139 | Inline note | M13 | Insert inline note → shows in the script, not in captions or audio |
| 140 | Menus completeness | M13 | Every item in B13.1 is present and does its action (no dead items) |
| 141 | Editor Recorder: mic | M14 | Insert ▸ Recording ▸ Audio, 3 s countdown, speak 20 s, Stop → block "Processing" then transcribed words at the cursor within 60 s |
| 142 | Camera + settings | M14 | Camera mode 1080p30 → resulting file metadata 1920×1080, ~30 fps |
| 143 | Screen + camera | M14 | Screen+Camera with computer audio (tab) → 2 files + layout applied (screen main, camera bubble); tab audio present |
| 144 | Pause/restart | M14 | Pause 5 s, resume → the result has no paused span; Restart → the previous take discarded after confirmation |
| 145 | Chunks uploaded during recording | M14 | Record 2 min with DevTools Network → PUTs to B2 every ~6 s while recording; at Stop the upload completes in ≤10 s |
| 146 | Network drop | M14 | DevTools Offline for 60 s mid-recording → recording continues, "Uploading behind" shown; back Online → backlog uploads; final file has no gap (duration = wall time ±0.5 s) |
| 147 | Crash recovery | M14 | Kill the tab mid-recording, reopen the project → "Recover recording" → the recovered take contains everything up to the kill (±6 s) |
| 148 | Low disk warning | M14 | Simulate quota <20 GB (Chrome DevTools storage override) → warning before Start |
| 149 | Recording settings defaults | M14 | Set countdown 5 s and "Studio Sound after recording" in App settings → the next recording uses both |
| 150 | Room join | M15 | Host creates Room; guest (incognito, no account) opens the link → waiting room → host admits → both see each other's video |
| 151 | Separate tracks | M15 | 3 participants record 2 min → the project gets a sequence with 3 camera + 3 mic tracks, named, auto-synced (±1 frame) |
| 152 | Local quality | M15 | With DevTools throttling the guest to 3G during the session → preview degrades, but the guest's uploaded file is still 1080p/~8 Mbps |
| 153 | Guest upload dialog / recovery link | M15 | Guest closes the tab at 70% uploaded → warning shows the recovery link; reopening the link within 7 days completes the upload; host sees 100% |
| 154 | Control room | M15 | Host sees per-guest upload %, network and CPU warnings (simulate CPU throttling 6× → warning) |
| 155 | Chat / live captions | M15 | Chat message appears for all participants and is saved to the project; live captions show within 3 s of speech |
| 156 | Producer role | M15 | Producer joins → not recorded (no tracks), can push-to-talk |
| 157 | Schedule room | M16 | Schedule a room with 2 guest emails → guests get an .ics with the join link; the event appears in Upcoming |
| 158 | Async record link | M16 | Guest opens the async link, records 30 s, submits → the take appears in the host project, transcribed, with a notification |
| 159 | Multiple takes | M16 | Record 3 takes in the same slot → take switcher shows 1/3…3/3; switching changes words and media |
| 160 | Replace selection | M16 | Select a sentence ▸ Re-record → 3 s pre-roll; new take replaces the selection; old take remains in Files |
| 161 | Teleprompter | M16 | Open the teleprompter with the script, set speed → scrolls during recording; when sharing a different window it isn't captured |
| 162 | Export current scene / markers | M17 | Export ▸ Markers with 3 markers → 3 files named by marker titles |
| 163 | GIF export | M17 | Export a 10 s range as GIF 480p 15 fps → valid animated GIF ≤10 s |
| 164 | Embedded subtitles | M17 | MP4 with an embedded subtitle track → VLC/ffprobe shows a mov_text stream matching the captions |
| 165 | Audio metadata/chapters | M17 | MP3 export with title/artwork + markers → ffprobe shows ID3 tags and chapters |
| 166 | Transcript export options | M17 | DOCX with markers as headers + timecodes → headers present; timecode offset 01:00:00 applied |
| 167 | App settings | M17 | ⌘, opens settings; theme Light → UI light; Transcription "always ask" → next import prompts for language |


## 7. Notes

- Contradictions in Descript's own docs are listed in the feature map: ⌘G (find next vs word gap), Slip tool Y vs S, and ⇧⌘S (split vs toggle timeline). §4 C1 additions resolves each one for Transovo.
- Excluded on purpose: Eye Contact, Overdub/Regenerate/AI voices, Underlord/agent edits, generative media, the share page, publish destinations, billing/admin and the API.
