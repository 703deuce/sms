# Descript feature map (exhaustive inventory)

Generated from `/workspace/specs/descript-help/features/*.txt` by `/workspace/specs/tools/render_feature_map.py`.
Sources: help.descript.com (399 pages fetched 2026-10-26 as .md), Descript changelog (10 posts, descript.canny.io), descript.com product pages (31).

**Tags:** Launch = in Transovo launch scope (owner: scenes, layouts, markers/chapters, B-roll/media, music, Studio Sound, retakes/filler, comments, ALL recording, plus core editing). Later = Eye Contact, Overdub/Regenerate/AI voice, Underlord, generative AI, other effects, publish targets. N-A = account, billing, team admin, plan gating, developer platform.

**In spec column** (Launch rows only): `§X` = covered by `script-editor.md` section; `PARTIAL §X` = partly covered; `MISSING` = not in spec.

## Counts

| Metric | Count |
|---|---|
| Feature rows | 596 |
| Launch | 485 |
| Later | 90 |
| N-A | 21 |
| Launch – in spec | 80 |
| Launch – partial | 60 |
| Launch – missing | 345 |

### By surface

| Surface | Rows | Launch | in spec | partial | missing |
|---|---|---|---|---|---|
| 1. Drive (home) view and projects | 23 | 18 | 1 | 7 | 10 |
| 1B. Import and media | 28 | 23 | 0 | 3 | 20 |
| 1C. Branding | 6 | 1 | 0 | 0 | 1 |
| 2. Editor: shell, top menus, action bar, view menu | 97 | 88 | 21 | 21 | 46 |
| 3. Editor: Script area | 104 | 93 | 32 | 8 | 53 |
| 4. Editor: Scenes, Scene editor (canvas), layers | 75 | 70 | 3 | 7 | 60 |
| 5. Timeline | 38 | 37 | 15 | 4 | 18 |
| 5A. Audio processing and effects | 31 | 13 | 0 | 1 | 12 |
| 6. Recording (all Launch per owner steering) | 87 | 86 | 0 | 0 | 86 |
| 7. Export, publish, share | 30 | 17 | 6 | 7 | 4 |
| 8. Collaboration | 14 | 11 | 1 | 0 | 10 |
| 9. Layouts and layout packs (owner: Launch) | 18 | 16 | 0 | 0 | 16 |
| 11. App settings (Cmd+,) | 19 | 7 | 1 | 2 | 4 |
| 12. AI features (owner: Later unless noted) | 26 | 5 | 0 | 0 | 5 |

## Contradictions and doc caveats

- `Cmd+G` is documented both as *Find next* (keyboard-shortcuts) and as *adjust word gap* (word-gaps page). Transovo should bind Find next to Cmd+G and put gap adjust on the right-click menu.
- Slip tool shortcut is listed as `Y` on timeline-tools but `S` elsewhere.
- *Split layer* `Cmd+Shift+S` collides with *View > Timeline > Toggle timeline* `Shift+Cmd+S`.
- Several features are Labs/beta (new timeline, Underlord, cursor presence, Center active speaker); behaviour may change.
- Help center lags the changelog; changelog-only rows are cited to the changelog post.

## Inventory

### 1. Drive (home) view and projects


#### 1.1 Drive view

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Sidebar views: Home (skills, AI video maker), Recents, Shared with me | Navigation | [descript-tour/drive-view](https://help.descript.com/descript-tour/drive-view) | Launch | PARTIAL §C6 (Transovo host owns project list) |
| Workspaces: Personal (default, private), General (shared), Custom (Enterprise) | Organization | [descript-tour/drive-view](https://help.descript.com/descript-tour/drive-view) | N-A | — |
| Folders inside workspaces (create/rename/delete; Enterprise create) | Organization | [working-in-projects/folders](https://help.descript.com/working-in-projects/folders) | Later | — |
| Tools: Brand Studio, Media library, Speakers, Layout packs, Learn, Rooms recordings | Drive tools | [descript-tour/drive-view](https://help.descript.com/descript-tour/drive-view) | Launch | MISSING |
| Header: Search, Record, New project, Profile/settings | Header | [descript-tour/drive-view](https://help.descript.com/descript-tour/drive-view) | Launch | PARTIAL §C6 |
| Project actions: Rename, Duplicate, Move to…, Copy project link, Project access, Delete (Trash 30 days) | Context menu | [descript-tour/drive-view](https://help.descript.com/descript-tour/drive-view) | Launch | PARTIAL §C6 |
| Drive search: projects (name/transcript), media, transcripts (snippet), folders, layout packs; visual matches (Enterprise); full results page with filters, sort, actions | Global search | [add-and-manage-media/search-your-drive](https://help.descript.com/add-and-manage-media/search-your-drive) | Later | — |
| Restore deleted project within 30 days | Trash | [working-in-projects/delete](https://help.descript.com/working-in-projects/delete) | Launch | MISSING |
| Move projects between workspaces/folders/drives (changes access) | Move | [working-in-projects/move](https://help.descript.com/working-in-projects/move) | Later | — |
| Change project ownership | Ownership | [working-in-projects/ownership](https://help.descript.com/working-in-projects/ownership) | N-A | — |

#### 1.2 Projects and compositions

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Project = binder of Compositions + Files + Sequences | Data model | [working-in-projects/overview](https://help.descript.com/working-in-projects/overview) | Launch | PARTIAL §B1 (single composition) |
| New project from Drive (type picker) or from inside project | Create | [getting-started/create-a-new-project](https://help.descript.com/getting-started/create-a-new-project) | Launch | PARTIAL §C6 |
| Multiple compositions per project; composition ⋯: rename, duplicate, copy link, open in new window, set audio-only, flatten, copy highlights, delete | Composition management | [working-in-projects/overview](https://help.descript.com/working-in-projects/overview) | Launch | MISSING |
| Duplicate project / composition / copy composition into another project / duplicate selection to another composition / duplicate layer | Duplicate | [working-in-projects/duplicate](https://help.descript.com/working-in-projects/duplicate) | Launch | MISSING |
| Aspect ratio 1:1, 9:16, 16:9, custom; frame rate 23.98–60; canvas resolution 720p/1080p/1440p/4K | Composition video settings | [working-in-projects/aspect-ratio](https://help.descript.com/working-in-projects/aspect-ratio) | Launch | MISSING |
| Audio-only composition (auto when audio imported to blank comp; toggle; app default) | Composition type | [working-in-projects/audio](https://help.descript.com/working-in-projects/audio) | Launch | MISSING |
| Project settings: Optimize computer storage, automatic leveling (−16 LUFS), room tone in new gap clips; apply as default for new projects | Settings | [working-in-projects/project-settings](https://help.descript.com/working-in-projects/project-settings) | Launch | MISSING |
| Autosave to cloud, sync spinner, no offline editing | Save | [working-in-projects/save](https://help.descript.com/working-in-projects/save) | Launch | §C2 |
| Version history: view/restore (affects all compositions); collaboration conflicts | Versions | [working-in-projects/version-history](https://help.descript.com/working-in-projects/version-history) | Launch | PARTIAL §C2 |
| Automatic + manual backups; new project from imported backup | Backups | [working-in-projects/backups](https://help.descript.com/working-in-projects/backups) | Launch | MISSING |
| Duration & word count of selection / full script | Stats | [working-in-projects/duration-word-count](https://help.descript.com/working-in-projects/duration-word-count) | Launch | MISSING |
| Project collaborators: Project editor vs commenter permission matrix; invite from Drive or editor | Access | [working-in-projects/access](https://help.descript.com/working-in-projects/access) | Launch | MISSING |
| Original + optimized proxy files; mixed sample rates (playback 44.1k) | Media pipeline | [working-in-projects/project-file-management](https://help.descript.com/working-in-projects/project-file-management) | Launch | PARTIAL §C4 |

### 1B. Import and media


#### 2.1 Import

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Drag file into script → upload + transcribe in one step | Import to script | [add-and-manage-media/local](https://help.descript.com/add-and-manage-media/local) | Launch | PARTIAL §C6 |
| Upload to Files panel without transcribing | Import to files | [add-and-manage-media/local](https://help.descript.com/add-and-manage-media/local) | Launch | MISSING |
| Add file to script from Project panel (drag) → transcribes; layers aren't transcribed | Script media | [getting-started/add-a-file-to-the-script](https://help.descript.com/getting-started/add-a-file-to-the-script) | Launch | PARTIAL §B1 |
| Activity panel: per-file progress, cancel upload (no minutes charged) | Upload tracking | [getting-started/import-overview](https://help.descript.com/getting-started/import-overview) | Launch | MISSING |
| Supported types: audio WAV/MP3/AIFF/M4A/FLAC/OPUS/AAC; video MP4/M4V/MOV/WEBM/MKV (H.264, HEVC, VP8, VP9, ProRes*); images BMP/JPEG/PNG/GIF/WEBP/HEIC; PDF; ≥3 channels downmixed; HDR beta | Formats | [add-and-manage-media/supported-file-types](https://help.descript.com/add-and-manage-media/supported-file-types) | Launch | PARTIAL §C6 |
| Per-plan max file size (1–50 GB) | Limits | [add-and-manage-media/supported-file-types](https://help.descript.com/add-and-manage-media/supported-file-types) | N-A | — |
| Import PDF slide deck → one JPG per slide in Files | Slides | [add-and-manage-media/slides](https://help.descript.com/add-and-manage-media/slides) | Launch | MISSING |
| Import from other projects (no re-upload) | Reuse | [add-and-manage-media/projects](https://help.descript.com/add-and-manage-media/projects) | Launch | MISSING |
| Import from Media library | Reuse | [add-and-manage-media/import-media-library](https://help.descript.com/add-and-manage-media/import-media-library) | Launch | MISSING |
| Import from Google Drive (web only) | Cloud import | [add-and-manage-media/google-drive](https://help.descript.com/add-and-manage-media/google-drive) | Later | — |
| Import from Zoom cloud recordings (connect account) | Integration | [add-and-manage-media/zoom](https://help.descript.com/add-and-manage-media/zoom) | Later | — |
| Edit in Descript from Captivate, Restream, SquadCast, Ecamm, HubSpot | Inbound integrations | [add-and-manage-media/editInDescript](https://help.descript.com/add-and-manage-media/editInDescript) | Later | — |

#### 2.2 Project panel (Files)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Project panel: Compositions + Files sections | Panel | [descript-tour/project-panel](https://help.descript.com/descript-tour/project-panel) | Launch | MISSING |
| File folders, subfolders; auto folders Sequences / AI Assets / Saved keyframes | Organization | [descript-tour/project-panel](https://help.descript.com/descript-tour/project-panel) | Launch | MISSING |
| Files search by name; filter by type; sort name/date added/modified | Filter | [descript-tour/project-panel](https://help.descript.com/descript-tour/project-panel) | Launch | MISSING |
| File actions: Rename, New composition from file, Duplicate, Create sequence, Insert into script, Add new layer, Transcribe/Re-transcribe, Detect speakers, Detect filler words, Convert to mono, Separate into mono files, Normalize audio, Detach audio, Replace (file/transcript), Change visual role, Set A/V sync offset, Repair audio drift, Fix file issue, Import transcript, Download, Delete | File menu | [add-and-manage-media/project-file-actions](https://help.descript.com/add-and-manage-media/project-file-actions) | Launch | MISSING |
| Automatic file-issue detection badge + rate-limited repairs | Health check | [add-and-manage-media/project-file-actions](https://help.descript.com/add-and-manage-media/project-file-actions) | Launch | MISSING |
| View file metadata | Info | [add-and-manage-media/project-file-actions](https://help.descript.com/add-and-manage-media/project-file-actions) | Launch | MISSING |
| Replace file keeping edits (transcript not regenerated) | Relink | [add-and-manage-media/replace-file](https://help.descript.com/add-and-manage-media/replace-file) | Launch | MISSING |
| A/V sync offset (± ms) per file | Sync fix | [add-and-manage-media/av-sync](https://help.descript.com/add-and-manage-media/av-sync) | Launch | MISSING |
| Repair audio drift | Fix VFR/drift | [add-and-manage-media/repair-audio-drift](https://help.descript.com/add-and-manage-media/repair-audio-drift) | Launch | MISSING |
| Flatten tracks: script track only / all tracks → new file | Simplify | [add-and-manage-media/flatten-tracks](https://help.descript.com/add-and-manage-media/flatten-tracks) | Launch | MISSING |

#### 2.3 Media panel, library, stock (B-roll and music: Launch)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Media panel (sidebar): My Media (Media library, Brand Studio, projects) browse by location, search | Reuse panel | [descript-tour/media-panel](https://help.descript.com/descript-tour/media-panel) | Launch | MISSING |
| Add media: drag to script/canvas, Add to project files, Add at playhead; multi-select | Insert | [descript-tour/media-panel](https://help.descript.com/descript-tour/media-panel) | Launch | MISSING |
| Stock tab: video, images, GIFs, stickers, backgrounds, music, sound effects (Storyblocks, GIPHY) by category/search | Stock library | [descript-tour/media-panel](https://help.descript.com/descript-tour/media-panel) | Launch | MISSING (needs licensed provider) |
| Stock licensing notes (GIPHY non-commercial; YouTube usage form) | Licensing | [add-and-manage-media/copyright-strikes](https://help.descript.com/add-and-manage-media/copyright-strikes) | Launch | MISSING |
| Media library (Drive): upload, folders, rename, move, remove, copy link; editors vs viewers | Shared library | [add-and-manage-media/media-library-overview](https://help.descript.com/add-and-manage-media/media-library-overview) | Launch | MISSING |
| Media minutes consumed on upload | Billing meter | [add-and-manage-media/media-library-overview](https://help.descript.com/add-and-manage-media/media-library-overview) | N-A | — |

### 1C. Branding

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Brand Studio Assets: custom fonts (+ Add fonts), brand colors at top of picker, share-page logo | Brand kit | [branding/brand-studio](https://help.descript.com/branding/brand-studio) | Later | — |
| Brand Studio Media tab (≤500 shared assets) | Brand media | [branding/brand-studio](https://help.descript.com/branding/brand-studio) | Later | — |
| Brand Studio Glossary (transcription glossary, Do Not Translate) | Glossary | [branding/brand-studio](https://help.descript.com/branding/brand-studio) | Launch | MISSING |
| Brand Studio Permissions (Enterprise) | Admin | [branding/bs-permissions](https://help.descript.com/branding/bs-permissions) | N-A | — |
| Custom branding on share pages | Share page logo | [branding/use-custom-branding-on-share-pages](https://help.descript.com/branding/use-custom-branding-on-share-pages) | Later | — |
| Brand fonts/colors in projects | Usage | [add-and-manage-media/brand-media](https://help.descript.com/add-and-manage-media/brand-media) | Later | — |

### 2. Editor: shell, top menus, action bar, view menu


#### 2.1 Editor regions and chrome

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Script editor region | Document-style transcript; edit media by editing text | [descript-tour/the-editor-interface](https://help.descript.com/descript-tour/the-editor-interface) | Launch | §A1 r2 |
| Scene editor (canvas) region | Visual preview where layers are moved/resized/arranged per scene | [descript-tour/the-editor-interface](https://help.descript.com/descript-tour/the-editor-interface) | Launch | PARTIAL §A1 r3 (preview only; no layer manipulation) |
| Timeline region | Traditional multi-lane timeline with waveforms below script/canvas | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | §B4 |
| Right sidebar icon rail | Project, Scene, Layer, Elements, Media, AI Tools, Underlord tabs | [descript-tour/the-editor-interface](https://help.descript.com/descript-tour/the-editor-interface) | Launch | PARTIAL §A1 r6 (Properties/Captions/Edit tools/Versions only) |
| Home button (top-left) | Returns to Drive view | [descript-tour/drive-view](https://help.descript.com/descript-tour/drive-view) | Launch | §A1 r1 (Back to project) |
| Project/composition name menu in menubar | Clicking project name opens dropdown incl. Project settings | [script-editing/wordless-media](https://help.descript.com/script-editing/wordless-media) | Launch | PARTIAL §A1 r1 (composition switcher only) |
| Comments toggle (top-right) | Show/hide/collapse comments panel | [descript-tour/customize-the-editor](https://help.descript.com/descript-tour/customize-the-editor) | Launch | MISSING |
| Help icon (top-right) | Opens Help menu incl. Keyboard Shortcuts | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §A1 r1 |
| Publish/Export button (top-right) | Opens export/publish popover | [export-and-share/export-and-publishing-overview](https://help.descript.com/export-and-share/export-and-publishing-overview) | Launch | §C3 |
| Share button (top-right) | Opens project access / invite dialog | [collaboration/project-links](https://help.descript.com/collaboration/project-links) | Launch | MISSING |
| Resize panels by dragging borders | Script, scene editor, timeline, sidebar resizable | [descript-tour/customize-the-editor](https://help.descript.com/descript-tour/customize-the-editor) | Launch | §A2 |
| Resizable sidebar width | Sidebar can be resized (Feb 2026) | [changelog/release-roundupfebruary-10th-2026](https://descript.canny.io/changelog/release-roundupfebruary-10th-2026) | Launch | §A1 r5 |
| Collapse Script editor or Scene editor | Collapsing one makes the other fill the window (Sep 2026) | [changelog/release-roundupseptember-17-2026](https://descript.canny.io/changelog/release-roundupseptember-17-2026) | Launch | PARTIAL §A2 (Full video view only) |
| Floating panels: move | Drag a floating settings/asset panel by its top bar | [descript-tour/customize-the-editor](https://help.descript.com/descript-tour/customize-the-editor) | Launch | MISSING |
| Floating panels: resize | Drag edge/corner of a floating panel | [descript-tour/customize-the-editor](https://help.descript.com/descript-tour/customize-the-editor) | Launch | MISSING |
| Layout preferences persistence | Timeline/sidebar sizes kept across compositions; script/scene visibility saved per project | [descript-tour/customize-the-editor](https://help.descript.com/descript-tour/customize-the-editor) | Launch | PARTIAL §A2 (per user, not per project) |
| Multi-window editing | File > New > Window opens a second window (web: another tab) | [descript-tour/multi-window-editing](https://help.descript.com/descript-tour/multi-window-editing) | Launch | PARTIAL §C5.5 (single-editor lock conflicts) |
| Desktop app (macOS/Windows) | Native app with launch-at-login, local cache | [getting-started/install](https://help.descript.com/getting-started/install) | N-A | — |
| Descript for Web | Browser app on Chrome/Edge/Opera | [getting-started/descript-for-web](https://help.descript.com/getting-started/descript-for-web) | Launch | §C6 |
| Mobile view/play projects | View and play projects on mobile (Feb 2026) | [changelog/release-roundupfebruary-10th-2026](https://descript.canny.io/changelog/release-roundupfebruary-10th-2026) | Later | — |
| Classic color theme / new colors | Theme palette options (Light/Dark/System + Classic) | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Launch | PARTIAL §D2.20 |

#### 2.2 Top-left app menu: File

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| File > New > Project (Cmd+N) | Create a new project | [getting-started/create-a-new-project](https://help.descript.com/getting-started/create-a-new-project) | Launch | MISSING |
| File > New > Composition (Opt+Cmd+N) | New composition in this project | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | PARTIAL §A1 r1 (Duplicate composition only) |
| File > New > Window | Opens new Drive window | [descript-tour/multi-window-editing](https://help.descript.com/descript-tour/multi-window-editing) | Later | — |
| File > Duplicate | Duplicate project | [working-in-projects/duplicate](https://help.descript.com/working-in-projects/duplicate) | Launch | MISSING |
| File > Duplicate and Open in New Tab | Duplicate project and open copy | [working-in-projects/duplicate](https://help.descript.com/working-in-projects/duplicate) | Launch | MISSING |
| File > Move… | Move project to workspace/folder | [working-in-projects/move](https://help.descript.com/working-in-projects/move) | Launch | MISSING |
| File > Delete / Move to Trash | Project to trash (30-day restore) | [working-in-projects/delete](https://help.descript.com/working-in-projects/delete) | Launch | PARTIAL §C5.8 |
| File > Version history | Opens version history panel | [working-in-projects/version-history](https://help.descript.com/working-in-projects/version-history) | Launch | §C2 |
| File > Project settings | Opens project settings window | [working-in-projects/project-settings](https://help.descript.com/working-in-projects/project-settings) | Launch | MISSING |
| File > Set composition to video or audio-only | Toggle composition type | [working-in-projects/audio](https://help.descript.com/working-in-projects/audio) | Launch | MISSING |
| File > Export | Opens export dialog | [export-and-share/export-and-publishing-overview](https://help.descript.com/export-and-share/export-and-publishing-overview) | Launch | §C3 |
| File > Import (files, Zoom, Google Drive, PDF slides) | Import media into project | [getting-started/import-overview](https://help.descript.com/getting-started/import-overview) | Launch | MISSING |

#### 2.3 Edit menu

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Edit > Undo / Redo (Cmd+Z / Shift+Cmd+Z) | Single undo stack | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §B2.8 |
| Edit > Cut/Copy/Paste | Text+media clipboard | [getting-started/edit-like-a-doc](https://help.descript.com/getting-started/edit-like-a-doc) | Launch | §B2.7 |
| Edit > Paste special > Replace script track | Replace selected script media with copied media | [script-editing/replace-script-track](https://help.descript.com/script-editing/replace-script-track) | Launch | MISSING |
| Edit > Copy (attributes source) | Copy a clip/layer to reuse attributes | [descript-tour/copy-paste-attributes](https://help.descript.com/descript-tour/copy-paste-attributes) | Launch | MISSING |
| Edit > Paste selected attributes (Shift+Cmd+V) | Paste gain+speed / size, position, fill, border, stroke, opacity / text styles / zoom+color onto selection | [descript-tour/copy-paste-attributes](https://help.descript.com/descript-tour/copy-paste-attributes) | Launch | MISSING |
| Edit > Select all (Cmd+A) | Select all in script, or all in track/layer | [descript-tour/copy-paste-attributes](https://help.descript.com/descript-tour/copy-paste-attributes) | Launch | §B2.12 |
| Edit > Find (Cmd+F) / Find in project (Shift+Cmd+F) / next / previous | Search script or whole project | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | PARTIAL §B2.11 (no project-wide find) |
| Edit > Toggle Write mode (Cmd+E) | Write mode: type script freely (for AI speech/drafting) | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Later | — |
| Edit > Toggle Correct mode (Opt+C) | Text-only correction mode | [script-editing/correct-your-transcript](https://help.descript.com/script-editing/correct-your-transcript) | Launch | §B2.9 |
| Edit > Restore removed media (Shift+Cmd+Delete) | Restore hidden source ranges | [script-editing/restore-removed-media](https://help.descript.com/script-editing/restore-removed-media) | Launch | §B2.6 |

#### 2.4 View menu

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| View > Script > Toggle script | Hide/show script panel; scene editor fills | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §A2 (Full video) |
| View > Script > Show edit boundaries | Toggle cut markers in script | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §A3 (always shown; no toggle) |
| View > Script > Underline filler words | Toggle dashed blue filler underline | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §B3 (no toggle) |
| View > Script > Underline word errors | Underline words whose alignment failed | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §A3 (low-confidence only in Correct mode) |
| View > Scene editor > Toggle scene editor | Hide/show canvas | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| View > Scene editor placement: Full-screen / Stacked / Side-by-side | Three placements; side-by-side disabled when too narrow with tooltip | [descript-tour/customize-the-editor](https://help.descript.com/descript-tour/customize-the-editor) | Launch | §A2 |
| View > Scene editor > Snap-to guides (Shift+Cmd+') | Alignment guides when moving layers | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §B5 (caption snap only) |
| View > Timeline > Toggle timeline (Shift+Cmd+S) | Collapse/expand timeline | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | §A2 |
| View > Timeline > Playhead autoscroll | Timeline auto-scroll on/off | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| View > Show in timeline > Advanced timeline tools | Reveal Range/Blade/Slip/Hand toolbar | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §A3 (Select/Blade/Hand always shown) |
| View > Show in timeline > Volume meter | VU meter for real-time levels | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| View > Show in timeline > Markers, comments, and audio pins | Toggle indicators on timeline | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| View > Timeline > Layer size (compact/default/large) | Track height presets | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| View > Timeline view / Storyboard view | Full layers vs scene-thumbnail storyboard | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| View > Zoom in / Zoom out / 100% / Fit in view / Fit current scene | Timeline zoom presets | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §B4 (no 100%, no Fit current scene) |
| View > Sidebar panels: Project / Media / Properties / Comments | Toggle each sidebar panel | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §A1 r6 |
| View > Theme: Light / Dark / System | Appearance | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | PARTIAL §D2.20 (no picker) |
| View > Show/hide video (Opt+Cmd+V), Move video (Opt+Shift+Cmd+V) | Toggle/move video preview | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | PARTIAL §A2 |
| View > Toggle project contents (Opt+Cmd+C) | Project panel | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| View > Media library (Opt+Cmd+L) | Media panel | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| View > Toggle layout picker (Opt+Cmd+P) | Layout picker | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| View > Toggle AI Tools (Opt+Cmd+Y) | AI tools panel | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| View > Script text size +/- | Script font size | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §A2 |

#### 2.5 Tools / Insert / Help menus

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Tools > Transcription Glossary | Drive-wide list of names/jargon to bias ASR; auto-add words corrected ≥3 times; notify toggle | [script-editing/transcription-glossary](https://help.descript.com/script-editing/transcription-glossary) | Launch | MISSING |
| Insert > Speaker label (@) | Insert speaker label at cursor | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | §B2.10 |
| Insert > Marker (#) | Insert marker at cursor | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING |
| Insert > Scene (/) | New scene at cursor | [getting-started/scenes](https://help.descript.com/getting-started/scenes) | Launch | MISSING |
| Insert > Text (Opt+Cmd+T) | Add text layer to scene | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Insert > Shape (Opt+Cmd+S) | Add shape layer | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Insert > Captions | Add captions layer to current scene | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | §B5 |
| Insert > Animation | Add animation to selected visual | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Later | — |
| Insert > Comment (Shift+Cmd+M) | Comment on selection | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Insert > File into script | Add file to script track at cursor | [getting-started/add-a-file-to-the-script](https://help.descript.com/getting-started/add-a-file-to-the-script) | Launch | MISSING |
| Insert > Inline note | Non-media note line in script | [getting-started/edit-like-a-doc](https://help.descript.com/getting-started/edit-like-a-doc) | Launch | MISSING |
| Insert > Recording | Opens in-app recorder into script | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Insert > Regenerate (D) | Regenerate modal | [script-editing/regenerate-overview](https://help.descript.com/script-editing/regenerate-overview) | Later | — |
| Insert > Open layout picker | Scene panel layout picker | [templates-and-presets/layouts-apply](https://help.descript.com/templates-and-presets/layouts-apply) | Launch | MISSING |
| Help > Keyboard Shortcuts (Opt+Cmd+K / Opt+/) | Shortcut list | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §C1 |
| Help > Help Center | Opens help | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Help > Debug > Force Fix Corrupted Alignment | Repairs alignment (red underlines) | [script-editing/automatic-transcription](https://help.descript.com/script-editing/automatic-transcription) | Launch | MISSING |
| Help > Debug > Export project backup… | Download project backup | [working-in-projects/backups](https://help.descript.com/working-in-projects/backups) | Launch | PARTIAL §C2 (JSON backup on failure only) |
| Help > Reset app data | Clears local cache | [app-troubleshooting/performance-playback](https://help.descript.com/app-troubleshooting/performance-playback) | N-A | — |
| Window > Reload / GPU History | Desktop diagnostics | [app-troubleshooting/performance-playback](https://help.descript.com/app-troubleshooting/performance-playback) | N-A | — |

#### 2.6 Action bar (Cmd+K command palette)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Action bar: open via Cmd+K or AI Tools panel | Universal searchable command palette | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Common (Add custom font, New project, Transcription glossary) | Commands | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Editing (Enter Correct mode, Enter Write mode, Remove filler words, Remove ignored text, Replace with gap clip, Shorten word gaps, Split at playhead) | Commands | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Export (share link/local, subtitles, text) | Opens export tabs | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Timeline export (Audition .sesx, FCPX .fcpxml, Premiere .xml, Pro Tools/Logic .aaf) | Opens NLE export | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Later | — |
| Action bar: Insert (Animation, Comments, Captions, File into script, Inline note, Marker, Layout picker, Regenerate, Recording, Scene, Speaker label, Text) | Commands | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Jump to composition / marker / scene (#12) / time (1h 32m 24s, 1:32:24.2, 24.2) | Navigation with flexible time parsing | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Project (Copy link to composition, Project access, Project settings) | Commands | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Search (Find in script, GIPHY gifs/stickers, stock backgrounds/footage/photos/music/SFX) | Opens Media tabs | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Action bar: Copy highlights (all or by color) | Collect highlighted ranges to paste into composition | [script-editing/highlights](https://help.descript.com/script-editing/highlights) | Launch | MISSING |
| Action bar in Drive view (create project, new window, help, shortcuts) | Limited palette on Drive | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |

### 3. Editor: Script area


#### 3.1 Text-based editing core

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Word-level sync of text and media | Every word aligned to media; edits cut media | [getting-started/edit-like-a-doc](https://help.descript.com/getting-started/edit-like-a-doc) | Launch | §B2.1 |
| Click word to place cursor + move playhead | Cursor and playhead move together when stopped | [descript-tour/playback-and-navigation](https://help.descript.com/descript-tour/playback-and-navigation) | Launch | §B2.2 |
| Current-word highlight during playback | Playhead highlights spoken word | [descript-tour/playback-and-navigation](https://help.descript.com/descript-tour/playback-and-navigation) | Launch | §B2.3 |
| Edit while playing | Text cursor moves independently during playback | [descript-tour/playback-and-navigation](https://help.descript.com/descript-tour/playback-and-navigation) | Launch | §B2.3 |
| Delete text = delete media | Delete/Backspace removes text+media; leaves edit boundary | [script-editing/delete-vs-ignore](https://help.descript.com/script-editing/delete-vs-ignore) | Launch | §B2.4 |
| Ignore (Cmd+Delete) | Strike-through; skipped in playback; optional in transcript export | [script-editing/delete-vs-ignore](https://help.descript.com/script-editing/delete-vs-ignore) | Launch | §B2.5 |
| Hover ignored text: Restore / Delete | Popover on ignored runs | [script-editing/delete-vs-ignore](https://help.descript.com/script-editing/delete-vs-ignore) | Launch | §B2.5 |
| Remove ignored text (bulk) | Delete all ignored text in composition | [descript-tour/action-bar](https://help.descript.com/descript-tour/action-bar) | Launch | MISSING |
| Remove from transcript | Remove text only, keep media playing | [script-editing/filler-words](https://help.descript.com/script-editing/filler-words) | Launch | PARTIAL §B3 (filler action only, not general command) |
| Cut/copy/paste moves media | Rearrange content like a doc | [getting-started/edit-like-a-doc](https://help.descript.com/getting-started/edit-like-a-doc) | Launch | §B2.7 |
| Drag-and-drop selection | Move text+media by dragging | [getting-started/edit-like-a-doc](https://help.descript.com/getting-started/edit-like-a-doc) | Launch | §B2.7 |
| Paste across compositions/projects | Clipboard carries media refs | [descript-tour/multi-window-editing](https://help.descript.com/descript-tour/multi-window-editing) | Launch | PARTIAL §B2.7 (same project only) |
| Restore removed media | Right-click selection/boundary; batch restore all in selection | [script-editing/restore-removed-media](https://help.descript.com/script-editing/restore-removed-media) | Launch | §B2.6 |
| Edit boundaries | Vertical markers where clips meet (deletes, inserts, blade cuts, gaps, freeze frames) | [script-editing/edit-boundaries](https://help.descript.com/script-editing/edit-boundaries) | Launch | §A3 |
| Click edit boundary → Smooth (Regenerate) | Heal cut with AI | [script-editing/edit-boundaries](https://help.descript.com/script-editing/edit-boundaries) | Later | — |
| Inline notes | Non-media note at cursor or on blank line (→) | [getting-started/edit-like-a-doc](https://help.descript.com/getting-started/edit-like-a-doc) | Launch | MISSING |
| Bold / Italic script text (Cmd+B / Cmd+I) | Rich text formatting in script, no media effect | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Highlight text in colors (Shift+Cmd+H) | Color highlights; dropdown to choose color; Clear highlight | [script-editing/highlights](https://help.descript.com/script-editing/highlights) | Launch | MISSING |
| Copy highlights to new composition | Gather highlights (all or one color) and paste elsewhere | [script-editing/highlights](https://help.descript.com/script-editing/highlights) | Launch | MISSING |
| Replace script track (Paste special) | Swap a script range's media with copied media | [script-editing/replace-script-track](https://help.descript.com/script-editing/replace-script-track) | Launch | MISSING |
| Duplicate selection to… (new composition / existing / folder) | Copy selection into another composition (Shift+Cmd+C; Quick duplicate Opt+Shift+Cmd+C) | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | PARTIAL §A1 (Duplicate composition only) |
| Write mode (Cmd+E) | Type a script freely for AI speech / drafting | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Later | — |
| Typing outside Correct mode | (Transovo) opens Correct popover | — | Launch | §B2.13 |
| Wordless media in script (beta) | Show silence/ambient sections as blocks in the script; project + app setting | [script-editing/wordless-media](https://help.descript.com/script-editing/wordless-media) | Launch | MISSING |
| Labels for wordless media ([music], [applause]) | Add label for range → appears in captions | [script-editing/wordless-media](https://help.descript.com/script-editing/wordless-media) | Launch | MISSING |

#### 3.2 Correcting the transcript

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Correct one word (C) | Inline correction, media unchanged | [script-editing/correct-your-transcript](https://help.descript.com/script-editing/correct-your-transcript) | Launch | §B2.9 |
| Correct All | Fix every instance in project | [script-editing/correct-your-transcript](https://help.descript.com/script-editing/correct-your-transcript) | Launch | §B2.9 |
| Correct mode (Opt+C) | Script behaves like text editor for text only | [script-editing/correct-your-transcript](https://help.descript.com/script-editing/correct-your-transcript) | Launch | §B2.9 |
| Hold Z+click capitalization / hold X+click punctuation | Quick fixes | [script-editing/correct-your-transcript](https://help.descript.com/script-editing/correct-your-transcript) | Launch | §B2.9 |
| Realign words in range | Right-click timeline range → re-sync word timing | [script-editing/realign-range](https://help.descript.com/script-editing/realign-range) | Launch | MISSING |
| Fix word boundary on wordbar (Cmd-drag) | Manual alignment | [script-editing/the-wordbar](https://help.descript.com/script-editing/the-wordbar) | Launch | §B4 |
| Import / Replace transcript | Paste own transcript ("Name: text"), Sync aligns it | [script-editing/import-transcript](https://help.descript.com/script-editing/import-transcript) | Launch | MISSING |
| Re-transcribe file (choose language) | Project file ⋯ > Re-transcribe | [script-editing/supported-transcription-languages](https://help.descript.com/script-editing/supported-transcription-languages) | Launch | MISSING |

#### 3.3 Selection toolbar (floating over selection)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Ask Underlord | Start AI chat on selection | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Later | — |
| Change layout | Apply layout to selection, creating a new scene | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Add layer | Add file, stock, text, captions, shape or recording at selection | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Add scene | Open layout picker to make selection a scene | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Correct | Correct text | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | §A3 |
| Regenerate | AI regenerate | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Later | — |
| Edit your script ▾ (Ignore / Delete / Replace with gap / Correct only) | Edit actions | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | §A3 |
| Bold / Italic | Formatting | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Highlight ▾ (colors) | Highlight | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Duplicate to… | Copy to composition | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Add comment | Comment on selection | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | MISSING |
| Ellipsis → right-click menu | Full context menu | [descript-tour/selection-toolbar](https://help.descript.com/descript-tour/selection-toolbar) | Launch | §A3 |

#### 3.4 Speakers

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Automatic speaker detection | Detects voices on import (≤5 h) | [script-editing/speaker-detection](https://help.descript.com/script-editing/speaker-detection) | Launch | MISSING (assumes existing diarization) |
| Identify speakers modal | Plays a sample per voice; name or pick existing | [script-editing/speaker-detection](https://help.descript.com/script-editing/speaker-detection) | Launch | MISSING |
| Detection mode setting: Always ask before detecting speakers (ask # speakers) | App setting | [script-editing/speaker-detection](https://help.descript.com/script-editing/speaker-detection) | Launch | MISSING |
| Detect speakers manually (file ⋯) | Run detection with speaker count | [script-editing/speaker-detection](https://help.descript.com/script-editing/speaker-detection) | Launch | MISSING |
| Add speaker (@ or "Add speaker" at paragraph top) | Speaker menu: In this project / Add AI speaker / Browse stock / Create new | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | §B2.10 (no AI options) |
| Re-label selection (@) | Assign speaker to selection | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | §B2.10 |
| Move speaker label (drag grabber) | Drag label to new word | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | MISSING |
| Rename speaker (project-wide) | "Rename X to Y" | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | §B2.10 |
| Replace in project with… (merge) | Merge one speaker into another | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | §B2.10 |
| Change label color | Speaker color | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | §B2.10 |
| Remove from project | Sections go to speaker above | [script-editing/speaker-labels](https://help.descript.com/script-editing/speaker-labels) | Launch | §B2.10 |
| Drive speakers / AI speakers library | Voice clones shared across drive | [script-editing/speakers](https://help.descript.com/script-editing/speakers) | Later | — |
| Speaker detection pre-processing on Drive media | Detect speakers in Media Library (Jun 2026) | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Later | — |

#### 3.5 Filler words, gaps, retakes, search

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Filler-word detection + light-blue underline | Auto detection (EN + ES/DE/FR/PT/IT since Aug 2026) | [script-editing/filler-words](https://help.descript.com/script-editing/filler-words) | Launch | §B3 (EN only) |
| Remove filler words: Delete / Delete+gap / Ignore / Remove from transcript | Per-hit or all | [script-editing/filler-words](https://help.descript.com/script-editing/filler-words) | Launch | §B3 |
| Avoid harsh cuts | Skips fillers too close to speech | [script-editing/filler-words](https://help.descript.com/script-editing/filler-words) | Launch | §B3 |
| Shorten word gaps (more than / between → target) | Shorten / Shorten all with review | [script-editing/shorten-word-gaps](https://help.descript.com/script-editing/shorten-word-gaps) | Launch | §B3 |
| Shorten gaps settings: Auto-advance, Preview results | Options | [script-editing/shorten-word-gaps](https://help.descript.com/script-editing/shorten-word-gaps) | Launch | §B3 |
| Edit word gap (right-click: presets / Set manually / Shorten all) | Per-gap pacing, plays back | [script-editing/word-gaps](https://help.descript.com/script-editing/word-gaps) | Launch | §B2.14 |
| Word gap shortcuts (Cmd+G at cursor; Shift+Cmd+G = last value) | Documented on word-gaps page; conflicts with Find next | [script-editing/word-gaps](https://help.descript.com/script-editing/word-gaps) | Launch | MISSING (conflict to resolve) |
| Regenerate treatment after gap/media removal (Audio+video / Audio only / Keep jump cuts) | Option in results | [script-editing/smooth-jump-cuts](https://help.descript.com/script-editing/smooth-jump-cuts) | Later | — |
| Remove retakes | Detect repeated lines/false starts, mark earlier takes as ignored for review | [descript-tour/sound-good-tools](https://help.descript.com/descript-tour/sound-good-tools) | Launch | MISSING |
| Edit for Clarity (intensity Low/Med/Heavy, Reword for flow) | AI cleanup with review: copy to new comp, remove ignored, discard, done | [script-editing/edit-for-clarity](https://help.descript.com/script-editing/edit-for-clarity) | Later | — |
| Smooth jump cuts (Find first / Smooth all) | Bulk Regenerate at cuts | [script-editing/smooth-jump-cuts](https://help.descript.com/script-editing/smooth-jump-cuts) | Later | — |
| Find in script panel (Cmd+F) with sidebar results | Search with results list | [script-editing/search-in-script-tool](https://help.descript.com/script-editing/search-in-script-tool) | Launch | PARTIAL §B2.11 (find bar, no results sidebar) |
| Search options: Auto-advance, Preview results, Match whole words, Match case, Wrap around, Only current composition | Settings gear | [script-editing/search-in-script-tool](https://help.descript.com/script-editing/search-in-script-tool) | Launch | PARTIAL §B2.11 (case + whole word only) |
| "Find and…" modes: Find, Remove filler words, Shorten word gaps, Correct transcript, Remove media, Copy | Unified search-and-act | [script-editing/search-in-script-tool](https://help.descript.com/script-editing/search-in-script-tool) | Launch | PARTIAL §B2.11/§B3 |
| Search actions: Delete, Delete+gap, Ignore, Remove from transcript, Duplicate to new/existing composition/folder, Copy | Per result or all | [script-editing/search-in-script-tool](https://help.descript.com/script-editing/search-in-script-tool) | Launch | PARTIAL §B2.11 |
| Search: find jump cuts | Cmd+F select jump cuts (Sep 2026) | [changelog/release-roundupseptember-17-2026](https://descript.canny.io/changelog/release-roundupseptember-17-2026) | Launch | MISSING |
| Highlighter filter | Filter script by highlight color | [script-editing/search-in-script-tool](https://help.descript.com/script-editing/search-in-script-tool) | Launch | MISSING |

#### 3.6 Markers and chapters

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Add marker (# or "Add marker" on blank line) | Section header in script | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING |
| Move marker (drag grabber) / rename (type) / delete | Edit markers | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING |
| Markers list in transport; jump to marker; Opt+Cmd+. / , | Navigation | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING (transport placeholder only) |
| Copy formatted chapter list (for YouTube) | From markers menu | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING |
| Markers become chapters on web share link | Share page chapters | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Later | — |
| Export each marker as separate file | Local export option "Markers" | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING |
| Markers as section headers in Word/HTML transcript export | Export option | [script-editing/markers-chapters](https://help.descript.com/script-editing/markers-chapters) | Launch | MISSING |
| Add Chapters AI tool | Generates markers+titles; add to script or copy timestamped list | [descript-tour/sound-good-tools](https://help.descript.com/descript-tour/sound-good-tools) | Launch | MISSING |

#### 3.7 Sequences (multitrack / multicam)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Sequence concept | Bundle camera, mics, screen, system audio as one synced source | [script-editing/multi-track-sequences-overview](https://help.descript.com/script-editing/multi-track-sequences-overview) | Launch | MISSING |
| Create sequence from selected project files | Multi-select → Create sequence | [script-editing/create-a-sequence](https://help.descript.com/script-editing/create-a-sequence) | Launch | MISSING |
| Create via "Multicam & multitrack" in empty composition / + > Sequence | Empty sequence | [script-editing/create-a-sequence](https://help.descript.com/script-editing/create-a-sequence) | Launch | MISSING |
| Sequence Editor (Edit sequence, Shift+Cmd+O) | Per-track editing window | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Sequence: mute/solo tracks | Track controls | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Sequence: Multi-Track Autosync | Align tracks by audio | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Sequence: nudge clip (arrow 1 fr, Cmd ½ fr, Shift 5 fr, Opt 1 s) | Manual sync | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Sequence: per-track effects, pan/volume, automation, auto-level | Track properties | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Sequence: add tracks (≤14) | Add media → new track | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Sequence: Include/Remove track from script | Avoid duplicate transcripts | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Fix duplicate transcripts (mic bleed) + revert | Auto toast "Fix" or Advanced menu | [script-editing/fix-duplicate-transcripts-or-mic-bleed](https://help.descript.com/script-editing/fix-duplicate-transcripts-or-mic-bleed) | Launch | MISSING |
| Detach audio | Split video into video + audio tracks | [script-editing/detach-audio](https://help.descript.com/script-editing/detach-audio) | Launch | MISSING |
| A/V sync offset | Fixed offset per file | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Separate into mono files | Split stereo channels | [script-editing/automatic-transcription](https://help.descript.com/script-editing/automatic-transcription) | Launch | MISSING |

#### 3.8 Transcription

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Automatic transcription on add to script / Transcribe file / in sequence | Automatic | [script-editing/automatic-transcription](https://help.descript.com/script-editing/automatic-transcription) | Launch | PARTIAL §C6 (assumes transcript exists) |
| Transcription model choice (Settings > AI models > Transcription: Automatic, Scribe v2, Rev v2/v3 …) | Model picker | [script-editing/automatic-transcription](https://help.descript.com/script-editing/automatic-transcription) | Later | — |
| 26 transcription languages, auto-detect; UK English manual | Language support | [script-editing/supported-transcription-languages](https://help.descript.com/script-editing/supported-transcription-languages) | Launch | MISSING |
| Always ask before transcribing / preferred language | App setting | [script-editing/supported-transcription-languages](https://help.descript.com/script-editing/supported-transcription-languages) | Launch | MISSING |
| 15 h max per file | Limit | [script-editing/automatic-transcription](https://help.descript.com/script-editing/automatic-transcription) | Launch | MISSING |
| Media Library files transcribe automatically | Mar 2026 | [changelog/release-roundupmarch-17th-2026](https://descript.canny.io/changelog/release-roundupmarch-17th-2026) | Launch | MISSING |
| Inverse Text Normalization | Numbers/dates formatted | [script-editing/supported-transcription-languages](https://help.descript.com/script-editing/supported-transcription-languages) | Launch | MISSING |

### 4. Editor: Scenes, Scene editor (canvas), layers


#### 4.1 Scenes and scene boundaries

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Scenes concept | Composition divided into scenes; each has own layout, layers, background, transitions | [visuals/split-vs-create](https://help.descript.com/visuals/split-vs-create) | Launch | MISSING (§B1 reserves sceneBreak token only) |
| Split scene by typing / in script | Splits at cursor; new scene inherits current media | [visuals/split-vs-create](https://help.descript.com/visuals/split-vs-create) | Launch | MISSING |
| Create empty scene (/ on empty line, New Scene button, Shift+Cmd+Enter) | New blank scene for intros/outros | [visuals/split-vs-create](https://help.descript.com/visuals/split-vs-create) | Launch | MISSING |
| Split button in timeline | No layer selected → split scene at playhead; layer selected → split layer (Shift / Shift+S → clips) | [timeline/split-button](https://help.descript.com/timeline/split-button) | Launch | PARTIAL §B4 (S splits script clip only) |
| Scene thumbnails in script margin | Click to select a scene; boundary handles appear in ruler | [visuals/boundaries](https://help.descript.com/visuals/boundaries) | Launch | MISSING |
| Move scene boundary (script or ruler drag) | Can't pass another boundary | [visuals/boundaries](https://help.descript.com/visuals/boundaries) | Launch | MISSING |
| Delete scene boundary (right-click > Delete boundary / Delete key) | Merges into previous scene | [visuals/boundaries](https://help.descript.com/visuals/boundaries) | Launch | MISSING |
| Reorder scenes (drag thumbnail in timeline scene rail or Storyboard) | Moves scene with its script | [visuals/reorder](https://help.descript.com/visuals/reorder) | Launch | MISSING |
| Scene rail in timeline | Thumbnail strip of scenes | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | MISSING (§B4 'scenes strip later') |
| Storyboard view | Grid of scene cards | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | MISSING |
| Navigate next/previous scene (Shift+Cmd+. / ,) and transport buttons | Jump | [descript-tour/playback-and-navigation](https://help.descript.com/descript-tour/playback-and-navigation) | Launch | MISSING |
| Export scenes (each scene as file) | Export all scenes in one go (Sep 2026) | [changelog/release-roundupseptember-17-2026](https://descript.canny.io/changelog/release-roundupseptember-17-2026) | Launch | MISSING |

#### 4.2 Scene properties (no layer selected)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Choose layout pack / layout | Apply pack + layout to current scene | [visuals/properties](https://help.descript.com/visuals/properties) | Launch | MISSING |
| Scene duration | Read-out from boundaries | [visuals/properties](https://help.descript.com/visuals/properties) | Launch | MISSING |
| Scene background (color/gradient/image) | Base fill | [visuals/properties](https://help.descript.com/visuals/properties) | Launch | MISSING |
| Scene effects (apply to all visuals) | Effects stack | [visuals/properties](https://help.descript.com/visuals/properties) | Later | — |
| Scene transitions | Transition into scene | [visuals/properties](https://help.descript.com/visuals/properties) | Later | — |
| Layers list (stack order; click, drag reorder, rename, hide, delete, lock icon) | Layer manager | [descript-tour/properties-panel](https://help.descript.com/descript-tour/properties-panel) | Launch | MISSING |
| Apply to all scenes toggle | Apply change to every scene | [visuals/properties](https://help.descript.com/visuals/properties) | Launch | MISSING |

#### 4.3 Scene editor (canvas)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Select layer on canvas (purple border = script track, blue = other) | Selection | [visuals/scene-editor-overview](https://help.descript.com/visuals/scene-editor-overview) | Launch | MISSING |
| Multi-select (Shift+click, marquee) with Mixed values | Group edit | [visuals/multi-select](https://help.descript.com/visuals/multi-select) | Launch | MISSING |
| Align (L/R/center/top/middle/bottom) & distribute (≥3) | Alignment buttons | [visuals/multi-select](https://help.descript.com/visuals/multi-select) | Launch | MISSING |
| Move/resize/rotate/crop/corner-round on canvas | Direct manipulation; link icon keeps ratio | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Launch | MISSING |
| Snap to guides | Smart guides | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| Layer toolbar (floating over selected layer) | Replace, reposition, crop, scale, rotate, flip, effects, animation | [visuals/scene-editor-overview](https://help.descript.com/visuals/scene-editor-overview) | Launch | MISSING |
| Scene toolbar (nothing selected): Layout, Background, Layers | Scene-wide quick tools | [visuals/scene-editor-tools](https://help.descript.com/visuals/scene-editor-tools) | Launch | MISSING |
| Layers menu: Save current frame to project files (PNG) | Frame grab | [visuals/save-a-frame-from-your-video](https://help.descript.com/visuals/save-a-frame-from-your-video) | Launch | MISSING |
| Right-click layer: Select layer / Layer order / View media / Replace media / Change source / Cut / Copy / Paste / Paste attributes / Duplicate / Flip H / Flip V / Hide / Lock / Delete | Context menu | [visuals/scene-editor-tools](https://help.descript.com/visuals/scene-editor-tools) | Launch | MISSING |
| Option-drag to duplicate | Duplicate layer | [visuals/scene-editor-tools](https://help.descript.com/visuals/scene-editor-tools) | Launch | MISSING |
| Layer order: ] front, Shift+] forward, Shift+[ backward, [ back | Shortcuts | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Duplicate layer Cmd+D, Hide Opt+H, Lock Opt+L | Shortcuts | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Lock layer (applies across scenes; Unlock button) | Prevent edits; bypasses layout matching | [visuals/lock-layers](https://help.descript.com/visuals/lock-layers) | Launch | MISSING |
| Hide/show layers per scene | Visibility | [visuals/layer-visibility](https://help.descript.com/visuals/layer-visibility) | Launch | MISSING |
| Expand/shrink scene editor (Cmd+.) | Toggle size | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Aspect ratio / canvas size | Composition size presets | [working-in-projects/aspect-ratio](https://help.descript.com/working-in-projects/aspect-ratio) | Launch | §B5 (aspect + reframe) |

#### 4.4 Layers and layer properties

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Layer types: video, audio, image, GIF, text, captions, shapes, waveform, progress bar, emoji, avatar, placeholder | Layer catalogue | [visuals/working-with-layers-and-clips-overview](https://help.descript.com/visuals/working-with-layers-and-clips-overview) | Launch | PARTIAL §B5 (captions only) |
| Add layer: drag from Project/Media to script, canvas or timeline | Adds to current scene | [visuals/add-layer](https://help.descript.com/visuals/add-layer) | Launch | MISSING |
| Add layer via selection toolbar (+ Add Layer) | Pick type | [visuals/add-layer](https://help.descript.com/visuals/add-layer) | Launch | MISSING |
| Drop media on Range selection → auto scene boundaries | B-roll over a range | [visuals/add-layer](https://help.descript.com/visuals/add-layer) | Launch | MISSING |
| Layer duration (+ speed, set exact duration) | Properties Duration | [visuals/clip-properties](https://help.descript.com/visuals/clip-properties) | Launch | MISSING |
| Clip speed | Speed control affects export | [visuals/clip-properties](https://help.descript.com/visuals/clip-properties) | Launch | MISSING |
| Loop / Once / Freeze end (non-script layers) | Fill scene | [visuals/clip-properties](https://help.descript.com/visuals/clip-properties) | Launch | MISSING |
| Attach layer to scene (drag edge to boundary) | Layer locked to scene; constrains loop | [visuals/attach-layer](https://help.descript.com/visuals/attach-layer) | Launch | MISSING |
| Extend layer across scenes (drag / Apply to all scenes) | Persistent logo etc. | [visuals/scenes-layers](https://help.descript.com/visuals/scenes-layers) | Launch | MISSING |
| Current scene / All scenes toggle for multi-scene layer | Edit scope | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Launch | MISSING |
| Audio: volume, pan, mute, solo | Per layer | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Launch | PARTIAL §B5 (composition volume only) |
| Opacity | Per layer | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Launch | MISSING |
| Size & position (x, y, w, h, rotation, corner radius, crop) | Numeric | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Launch | MISSING |
| Border | Outline | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Launch | MISSING |
| Fill picker: solid, gradient (linear H/diag, radial center/corner, stops), eyedropper | Color UI | [visuals/color-stroke](https://help.descript.com/visuals/color-stroke) | Launch | MISSING |
| Stroke/Border thickness + color | Outline | [visuals/color-stroke](https://help.descript.com/visuals/color-stroke) | Launch | MISSING |
| Animation (in/out/motion) | Layer animations | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Later | — |
| Effects (visual/audio) | Effects stack | [visuals/layer-properties](https://help.descript.com/visuals/layer-properties) | Later | — |
| Visual role (Talking head / Screen recording / Graphics / B-roll) | Used by layout matching; file or layer level | [visuals/visual-roles](https://help.descript.com/visuals/visual-roles) | Launch | MISSING |
| Replace media (keeps edits) via toolbar/right-click/Properties ⋯ | Swap | [visuals/replace-media](https://help.descript.com/visuals/replace-media) | Launch | MISSING |
| Change source (stacked layers) | Choose visible layer | [visuals/scene-editor-tools](https://help.descript.com/visuals/scene-editor-tools) | Launch | MISSING |
| Paste layer keeps offset from scene start | Behavior | [visuals/working-with-layers-and-clips-overview](https://help.descript.com/visuals/working-with-layers-and-clips-overview) | Launch | MISSING |
| Center active speaker (beta) | Auto reframe on speaker (single clip) | [visuals/center-active-speaker](https://help.descript.com/visuals/center-active-speaker) | Launch | PARTIAL §B5 (reframe) |
| Automatic Multicam (Automatic / Active speaker only; cutaways Occasional 30 s / Frequent 10 s / None; camera setup; layout pack) | Builds scenes per camera change | [visuals/automatic-multicam](https://help.descript.com/visuals/automatic-multicam) | Launch | MISSING |

#### 4.5 Elements panel

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Text: Text / Subtitle / Title | Text layers | [visuals/text-layers](https://help.descript.com/visuals/text-layers) | Launch | MISSING |
| Text type: Freeform / Captions / Speaker / Composition name / Marker / Timer | Dynamic text | [visuals/text-layers](https://help.descript.com/visuals/text-layers) | Launch | MISSING |
| Text background: bounding box fixed/auto, radius, color, Hug lines / Box | Text box | [visuals/text-layers](https://help.descript.com/visuals/text-layers) | Launch | MISSING |
| Fonts + Custom fonts (Google Fonts search, upload ttf/otf/woff, add to Drive) | Font management | [visuals/custom-fonts](https://help.descript.com/visuals/custom-fonts) | Launch | MISSING |
| Shapes: rectangle, ellipse, line, arrow | Shape layers | [visuals/shapes](https://help.descript.com/visuals/shapes) | Launch | MISSING |
| Waveform (Lines/Circle/Ring/Wave; speaker; fill; size; fidelity; magnitude; mirror) | Audiogram visualizer | [visuals/waveforms](https://help.descript.com/visuals/waveforms) | Launch | MISSING |
| Progress bar (Bar/Ring/Pie; color; start/end %) | Progress element | [visuals/progress-bars](https://help.descript.com/visuals/progress-bars) | Launch | MISSING |
| Placeholder layers (Media / Camera / Screen; notes) → Add File / Record / Stock / Generate | Template placeholders | [visuals/placeholder-layers](https://help.descript.com/visuals/placeholder-layers) | Launch | MISSING |

#### 4.6 Captions

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Captions panel (current scene / all scenes toggle) | Add captions layer | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | §B5 (captions panel) |
| Caption presets (18 new + Legacy), search, filter, sort | Styles | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | PARTIAL §B5 |
| Caption style: font, size, alignment, text/background colors+gradients, stroke | Properties | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | PARTIAL §B5 |
| Active word fill/stroke/background; Future words fill/stroke | Karaoke styling | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | PARTIAL §B5 |
| Line animation (word/line/paragraph; 15 in/out) | Text animations | [visuals/captions](https://help.descript.com/visuals/captions) | Later | — |
| Convert text layer ↔ captions | Type dropdown | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | MISSING |
| Per-speaker captions layers | Speaker filter | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | MISSING |
| Delete captions layer | Remove | [visuals/captions](https://help.descript.com/visuals/captions) | Launch | §B5 |

### 5. Timeline


#### 5.1 Structure

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Collapsed / expanded timeline (handle, drag) | Default collapsed | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | §B4 |
| Time ruler (timecode, markers, comments, audio levels) | Ruler | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | PARTIAL §B4 (no markers/comments) |
| Layer lanes (B-roll, text, effects, music) | Non-script layers | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | MISSING (§B4 'later') |
| Wordbar | Word alignment lane | [script-editing/the-wordbar](https://help.descript.com/script-editing/the-wordbar) | Launch | §B4 |
| Script track | Script media | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | §B4 |
| Zoom & Fit: Fit scene / Fit composition / zoom to playhead (Opt+Cmd+3) / fit selection (Opt+Cmd+4) | View controls | [timeline/timeline-overview](https://help.descript.com/timeline/timeline-overview) | Launch | PARTIAL §B4 |
| Scroll (Shift+scroll, H+drag) | Navigation | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §B4 |
| Volume meter | Real-time levels | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| Timeline audio pins | Indicators | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |

#### 5.2 Tools

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Select tool (A): move, trim, combine; drag media between script and layer lanes; Shift multi-select | Default tool | [timeline/timeline-tools](https://help.descript.com/timeline/timeline-tools) | Launch | §B4 |
| Range tool (R): select span → delete, gap, visuals, realign, Add label | Range | [timeline/timeline-tools](https://help.descript.com/timeline/timeline-tools) | Launch | MISSING |
| Blade tool (B) | Cut at click | [timeline/timeline-tools](https://help.descript.com/timeline/timeline-tools) | Launch | §B4 |
| Slip tool (Y per shortcuts page; S per tools page) | Slip content inside clip | [timeline/timeline-tools](https://help.descript.com/timeline/timeline-tools) | Launch | MISSING |
| Hand tool (H) | Pan | [timeline/timeline-tools](https://help.descript.com/timeline/timeline-tools) | Launch | §B4 |
| Hold tool key for temporary switch | Spring-loaded tools | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |

#### 5.3 Clip operations

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Trim clip/layer edges | Non-destructive | [visuals/working-with-layers-and-clips-overview](https://help.descript.com/visuals/working-with-layers-and-clips-overview) | Launch | §B4 (script track only) |
| Split clip/layer at playhead (S / Shift+Cmd+S) | Split | [visuals/working-with-layers-and-clips-overview](https://help.descript.com/visuals/working-with-layers-and-clips-overview) | Launch | PARTIAL §B4 |
| Gap clips (right-click Add gap clip; Shift+Delete on range); room tone on by default | Silent spacer | [timeline/using-gap-clips](https://help.descript.com/timeline/using-gap-clips) | Launch | §B4 (no room tone) |
| Room tone in gap clips (toggle) | Fill with ambient | [timeline/using-gap-clips](https://help.descript.com/timeline/using-gap-clips) | Launch | MISSING |
| Freeze frame (right-click video > Add freeze frame; set duration) | Hold frame | [timeline/freeze-frames](https://help.descript.com/timeline/freeze-frames) | Launch | MISSING |
| Automatic microfades (~5 samples at every cut) | No pops | [timeline/automatic-microfades](https://help.descript.com/timeline/automatic-microfades) | Launch | MISSING |
| Replace with… (Opt+R) | Replace visual | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Layer order menu on right-click | Order | [visuals/layer-visibility](https://help.descript.com/visuals/layer-visibility) | Launch | MISSING |
| Mute/hide layer (0) | Toggle | [changelog/release-round-upaugust-5th-2026](https://descript.canny.io/changelog/release-round-upaugust-5th-2026) | Launch | MISSING |
| Next/previous clip (Opt+Shift+Cmd+. / ,) | Navigation | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Auto-level clip (Opt+Shift+Cmd+L) | Loudness | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | PARTIAL §B5 (normalize) |
| Volume automation (keyframes) | Volume envelope | [script-editing/sequence-editor](https://help.descript.com/script-editing/sequence-editor) | Launch | MISSING |
| Saved keyframes folder | Keyframe presets | [descript-tour/project-panel](https://help.descript.com/descript-tour/project-panel) | Later | — |

#### 5.4 Transport and playback

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Play/pause (Space, Cmd+S, Opt+click) | Playback | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §B2.2 |
| Play from cursor (Shift+Space) | Playback | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §C1 |
| Spot audition (Shift+Cmd+Space) | Play around selection | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| J/K/L speed (Shift+J/K/L) | Shuttle | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §C1 |
| Playback speed up to 3x (editor only) | Speed menu | [descript-tour/playback-and-navigation](https://help.descript.com/descript-tour/playback-and-navigation) | Launch | MISSING |
| Frame step (← / →) | Step | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §B4 |
| Home → start | Seek | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §C1 |
| Esc → resume autoscroll | Follow playhead | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | §B2.3 |
| Previous/next scene buttons, markers list in transport | Navigation | [descript-tour/playback-and-navigation](https://help.descript.com/descript-tour/playback-and-navigation) | Launch | MISSING |
| Record button in timeline toolbar | Start recording into composition | [timeline/split-button](https://help.descript.com/timeline/split-button) | Launch | MISSING |

### 5A. Audio processing and effects


#### 5A.1 Launch audio (owner: Studio Sound, music)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Studio Sound on script layer / sequence track / part of a file | AI voice cleanup (noise, echo) applied to source file | [effects-animations-transitions/studio-sound](https://help.descript.com/effects-animations-transitions/studio-sound) | Launch | MISSING (§B5 Later) |
| Studio Sound Intensity slider (0–100%) | Wet/dry amount | [effects-animations-transitions/studio-sound](https://help.descript.com/effects-animations-transitions/studio-sound) | Launch | MISSING |
| Studio Sound disables room tone for that file | Interaction rule | [effects-animations-transitions/room-tone](https://help.descript.com/effects-animations-transitions/room-tone) | Launch | MISSING |
| Studio Sound during recording (setting) | Auto-apply after record | [effects-animations-transitions/studio-sound](https://help.descript.com/effects-animations-transitions/studio-sound) | Launch | MISSING |
| Auto-leveling: App setting (all new projects), Project setting, per clip | Loudness consistency | [effects-animations-transitions/auto-leveling](https://help.descript.com/effects-animations-transitions/auto-leveling) | Launch | MISSING |
| Lower audio of other layers (ducking) with Amount; multiple ducking layers don't duck each other; strongest wins; layer-level only | Music ducking under speech | [effects-animations-transitions/lower-other-audio](https://help.descript.com/effects-animations-transitions/lower-other-audio) | Launch | MISSING |
| Room tone from first 30 s of file; applied to gaps; on by default (App/Project setting) | Fill silences | [effects-animations-transitions/room-tone](https://help.descript.com/effects-animations-transitions/room-tone) | Launch | MISSING |
| Volume and pan per layer / selection / sequence track / whole composition; Mute | Mixing | [effects-animations-transitions/volume-pan](https://help.descript.com/effects-animations-transitions/volume-pan) | Launch | PARTIAL §B5 |
| Composition audio properties (volume, pan, effects on whole mix) | Master bus | [effects-animations-transitions/composition-audio-properties](https://help.descript.com/effects-animations-transitions/composition-audio-properties) | Launch | MISSING |
| Volume automation keyframes (fade up/down over clip) | Envelope | [effects-animations-transitions/volume-automation-and-keyframes](https://help.descript.com/effects-animations-transitions/volume-automation-and-keyframes) | Launch | MISSING |
| VU meter −30…0 dB in timeline (View > Timeline > Show in timeline > Volume) | Level meter | [effects-animations-transitions/vu-meter](https://help.descript.com/effects-animations-transitions/vu-meter) | Launch | MISSING |
| Apply/adjust/disable/remove effect; order top→bottom; presets via ⋯ | Effects stack mechanics | [effects-animations-transitions/apply-adjust](https://help.descript.com/effects-animations-transitions/apply-adjust) | Launch | MISSING |

#### 5A.2 Other audio effects

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| EQ 5-band parametric (width/frequency/gain, presets) | Tone shaping | [effects-animations-transitions/eq](https://help.descript.com/effects-animations-transitions/eq) | Later | — |
| Compressor, Limiter | Dynamics | [effects-animations-transitions/overview](https://help.descript.com/effects-animations-transitions/overview) | Later | — |
| Graphic EQ (10-band), High/Low shelf, High/Low-pass | Filters | [effects-animations-transitions/overview](https://help.descript.com/effects-animations-transitions/overview) | Later | — |
| Reverb, Bitcrusher, Distortion, Flanger | Creative audio FX | [effects-animations-transitions/overview](https://help.descript.com/effects-animations-transitions/overview) | Later | — |

#### 5A.3 Visual effects (Later)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Visual effects: Ascii, Blur, Chroma key, Color tone, Film grain, Glass blur, Glow, Invert, Pixelate, Portrait Lighting, Selective color, Shadows, Threshold, Uplighting, VHS, Vignette, Zoom blur | Layer/scene effects | [effects-animations-transitions/overview](https://help.descript.com/effects-animations-transitions/overview) | Later | — |
| Blur speaker background | AI depth blur | [effects-animations-transitions/blur-speaker-background](https://help.descript.com/effects-animations-transitions/blur-speaker-background) | Later | — |
| Color adjustments: presets Neutral/Warm/Cool/B&W/Pop/Invert; Exposure, Contrast, Highlights, Shadows, Temperature, Tint, Saturation; white balance; All scenes toggle | Color | [effects-animations-transitions/color-adjustments](https://help.descript.com/effects-animations-transitions/color-adjustments) | Later | — |
| Green Screen (AI background removal) + new background | Matting | [effects-animations-transitions/green-screen](https://help.descript.com/effects-animations-transitions/green-screen) | Later | — |
| Skin smoothing | Retouch | [effects-animations-transitions/skin-smoothing](https://help.descript.com/effects-animations-transitions/skin-smoothing) | Later | — |
| Eye Contact | AI gaze correction | [effects-animations-transitions/eye-contact](https://help.descript.com/effects-animations-transitions/eye-contact) | Later | — |
| Center active speaker (beta) | Auto reframe on speaker | [effects-animations-transitions/overview](https://help.descript.com/effects-animations-transitions/overview) | Launch | MISSING |

#### 5A.4 Animations and transitions (Later)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Layer animation presets in/out: Blur, Fade, Scale, Slide, Spin, Wipe, Zoom and pan, Ken Burns | Presets | [effects-animations-transitions/animate-visual-layers](https://help.descript.com/effects-animations-transitions/animate-visual-layers) | Later | — |
| Custom keyframe animations + easing curves | Keyframes | [effects-animations-transitions/animate-visual-layers](https://help.descript.com/effects-animations-transitions/animate-visual-layers) | Later | — |
| Ken Burns: In/Out/None, 8 directions, center zoom, speed | Still image motion | [effects-animations-transitions/ken-burns-animation](https://help.descript.com/effects-animations-transitions/ken-burns-animation) | Later | — |
| Custom zoom | Zoom via animation | [effects-animations-transitions/custom-zoom](https://help.descript.com/effects-animations-transitions/custom-zoom) | Later | — |
| Text animations by character/word/line/paragraph; duration, easing | Text motion | [effects-animations-transitions/text-animations](https://help.descript.com/effects-animations-transitions/text-animations) | Later | — |
| Scene transitions: None, Smart, Blur, Clock Wipe, Color Dip, Crossfade, Fade, Cross-zoom, Double Wipe, Flip, Move Out, Push-Pull, Scale, Shake, Shape Wipe, Split, Wipe; duration/direction/feather/easing | Scene boundary | [effects-animations-transitions/transitions](https://help.descript.com/effects-animations-transitions/transitions) | Later | — |
| Smart Transitions (default on new scenes; duration, easing, add fades) | Auto transitions | [effects-animations-transitions/smart-transitions](https://help.descript.com/effects-animations-transitions/smart-transitions) | Later | — |
| Clip transitions (timeline), crossfade requires handles & same layer | Clip boundary | [effects-animations-transitions/transitions](https://help.descript.com/effects-animations-transitions/transitions) | Later | — |

### 6. Recording (all Launch per owner steering)


#### 6.1 Entry points and modes

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Record button: Drive header (top-right) | Record menu: New recording / Record with others / Schedule for later / Screen | [record/host-guide](https://help.descript.com/record/host-guide) | Launch | MISSING |
| Record button: editor bottom dock / timeline toolbar | Opens Editor Recorder inside project | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Choose recording method guide (Record in project / Capture screen / Record with guests) | Picker | [record/editor-recorder-overview](https://help.descript.com/record/editor-recorder-overview) | Launch | MISSING |
| Editor Recorder: Camera source | Record webcam | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Editor Recorder: Screen source (screen/window; region on desktop) | getDisplayMedia-style capture | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Editor Recorder: Audio (mic) source | Audio-only recording | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Screen + camera combined recording | Multi-track: screen, camera, mic, system audio as a sequence | [record/presentation](https://help.descript.com/record/presentation) | Launch | MISSING |
| Computer audio: desktop = system-wide; web = one browser tab only | Capture constraint | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Recorder takes full window if script empty; else opens in Script view | Layout behavior | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Record into script at playhead (insertion marker shown) | Insert recording | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Replace selection (record over highlighted text) | Retake a passage | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Record new layer in selected scene | Recording as layer (e.g. voice-over / music bed) | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Play script while recording an audio layer | Monitor existing audio while recording | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Recording length limit 4 h/session | Limit | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Background upload during recording with progress toast | Progressive upload | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Navigation blocker while post-recording processing runs | Prevent tab close data loss | [changelog/release-round-upaugust-5th-2026](https://descript.canny.io/changelog/release-round-upaugust-5th-2026) | Launch | MISSING |
| Low disk space warnings (persistent banner; hosts see guests' storage) | Proactive warning | [changelog/release-round-upaugust-5th-2026](https://descript.canny.io/changelog/release-round-upaugust-5th-2026) | Launch | MISSING |
| Camera drop → recording auto-restarts | Resilience | [changelog/release-roundupseptember-17-2026](https://descript.canny.io/changelog/release-roundupseptember-17-2026) | Launch | MISSING |
| Media-key control (Play/Pause/Record from headphones, foot switches) | Hardware keys | [changelog/release-roundupseptember-17-2026](https://descript.canny.io/changelog/release-roundupseptember-17-2026) | Launch | MISSING |

#### 6.2 Recorder controls and settings

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Controls: Cancel (delete) / Restart (discard and restart) / Pause-Resume / Stop & save / Teleprompter / Settings | Recorder bar | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Setting: Countdown (3 s) | Delay before start | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Setting: Transcription on/off (auto-transcribe after recording) | Into script with transcript | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Setting: Default Speaker label | Applies speaker to transcript | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Setting: Studio Sound after recording | Auto enhance | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Setting: Auto gain control (collapses to mono) | AGC | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Setting: Resolution (capped by camera/screen; no 4K screen on Windows) | Quality | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Framing: Center Me silhouette / Grid overlay | Framing aids | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Single mixed mic input (multiple mics must be aggregated at OS level) | Input constraint | [record/multi-device-macos](https://help.descript.com/record/multi-device-macos) | Launch | MISSING |
| Device permission prompts (web: browser; desktop: OS privacy) | Permissions | [getting-started/descript-for-web](https://help.descript.com/getting-started/descript-for-web) | Launch | MISSING |
| Low frame rate / sync performance warnings | CPU overload warnings | [record/frame-rate-sync](https://help.descript.com/record/frame-rate-sync) | Launch | MISSING |
| Convert to mono (fix hard-panned recording) | File action | [record/troubleshooting](https://help.descript.com/record/troubleshooting) | Launch | MISSING |

#### 6.3 Teleprompter

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Teleprompter in Editor Recorder, Screen Recorder, Rooms (Host/Co-host) | Read script while recording | [record/record-with-descript-s-built-in-teleprompter](https://help.descript.com/record/record-with-descript-s-built-in-teleprompter) | Launch | MISSING |
| Script source: Paste / Type / Import from script | Content | [record/record-with-descript-s-built-in-teleprompter](https://help.descript.com/record/record-with-descript-s-built-in-teleprompter) | Launch | MISSING |
| Controls: font size, scroll speed, restart, play, flip/mirror, light/dark theme | Controls | [record/record-with-descript-s-built-in-teleprompter](https://help.descript.com/record/record-with-descript-s-built-in-teleprompter) | Launch | MISSING |
| Settings: Variable vs Constant scroll; Auto-scroll on record; Focus mode | Settings | [record/record-with-descript-s-built-in-teleprompter](https://help.descript.com/record/record-with-descript-s-built-in-teleprompter) | Launch | MISSING |
| Teleprompter excluded from capture on desktop; visible in web screen share | Platform difference | [record/record-with-descript-s-built-in-teleprompter](https://help.descript.com/record/record-with-descript-s-built-in-teleprompter) | Launch | MISSING |

#### 6.4 Desktop Screen Recorder (menu-bar/tray app)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Screen Recorder dock from menu bar/tray; standalone shortcut app | Lightweight recorder | [record/screen-recorder](https://help.descript.com/record/screen-recorder) | Launch | MISSING (desktop-only) |
| Inputs: Quick Share, Teleprompter, Computer audio, Camera, Microphone, Display (full/window/region) | Dock inputs | [record/screen-recorder](https://help.descript.com/record/screen-recorder) | Launch | MISSING |
| Quick Share on → single-track publish to share page; off → multi-track project | Output mode | [record/screen-recorder](https://help.descript.com/record/screen-recorder) | Launch | MISSING |
| Settings: Countdown, Camera resolution, Transcribe microphone, Studio Sound, shortcut Shift+Cmd+2, Destination drive (Recordings folder), Default publish privacy, After recording (open page+copy / copy only), Display author, Enable comments, Camera shape slider, Run in background, Launch at login | Settings | [record/screen-recorder](https://help.descript.com/record/screen-recorder) | Launch | MISSING |
| Camera bubble movable/resizable during recording | Overlay | [record/screen-recorder](https://help.descript.com/record/screen-recorder) | Launch | MISSING |
| Dock: Pause/Resume (not Windows), Stop+timer, Restart, Minimize camera, Cancel | Controls | [record/screen-recorder](https://help.descript.com/record/screen-recorder) | Launch | MISSING |

#### 6.5 Rooms (remote recording with guests)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Create Room from Drive / project / goto-room URL | Room per editor | [record/host-guide](https://help.descript.com/record/host-guide) | Launch | MISSING |
| Pre-join screen: camera+resolution, mic, speakers, headphones yes/no (echo cancel), display name (= speaker label) | Lobby | [record/guest-guide](https://help.descript.com/record/guest-guide) | Launch | MISSING |
| Invite links with role (Guest / Co-host / Producer / Viewer) | Role links | [record/host-guide](https://help.descript.com/record/host-guide) | Launch | MISSING |
| Waiting room: approve join requests; change role before admit; auto-admit with role | Admission | [record/host-guide](https://help.descript.com/record/host-guide) | Launch | MISSING |
| Roles: Host, Co-host, Producer (off-stage, push-to-talk), Viewer, Guest | Permissions matrix | [record/roles](https://help.descript.com/record/roles) | Launch | MISSING |
| Control Room (backstage for producers) and Viewer Room | Off-stage spaces | [record/control-room](https://help.descript.com/record/control-room) | Launch | MISSING |
| Push-to-talk to everyone or one participant (+ silence button) | Producer talkback | [record/push-to-talk](https://help.descript.com/record/push-to-talk) | Launch | MISSING |
| Record button with on-screen countdown; elapsed timer | Session recording | [record/record-in-a-descript-room](https://help.descript.com/record/record-in-a-descript-room) | Launch | MISSING |
| Separate local high-quality track per participant (audio 48 kHz AAC/MP4 or Opus/WebM; optional lossless WAV on Chromium; video up to 4K H.264/MP4, VP8/WebM on Firefox, VFR ≤30 fps, 30 Mbps at 4K) | Double-ended local recording | [record/quality](https://help.descript.com/record/quality) | Launch | MISSING |
| Cloud backup per participant (WebM VP8/Opus via call) | Fallback track | [record/quality](https://help.descript.com/record/quality) | Launch | MISSING |
| Screen share in Room (recorded) | Share | [record/record-in-a-descript-room](https://help.descript.com/record/record-in-a-descript-room) | Launch | MISSING |
| Live captions overlay in Room | Real-time captions | [changelog/release-roundupmarch-17th-2026](https://descript.canny.io/changelog/release-roundupmarch-17th-2026) | Launch | MISSING |
| Chat (everyone + DMs), image paste in chat, chat notifications setting | Chat | [record/comments](https://help.descript.com/record/comments) | Launch | MISSING |
| Editor comments during session (time-stamped into project) | Notes for editor | [record/comments](https://help.descript.com/record/comments) | Launch | MISSING |
| People tab: network health, role dropdown, pin participant; Gallery/Speaker view | Participants | [record/guest-guide](https://help.descript.com/record/guest-guide) | Launch | MISSING |
| Host tools: view/adjust participant AV inputs; monitor upload status | Remote control | [record/roles](https://help.descript.com/record/roles) | Launch | MISSING |
| Upload status dialog after stop (all participants for host; non-dismissable, movable) | Post-session upload | [record/record-in-a-descript-room](https://help.descript.com/record/record-in-a-descript-room) | Launch | MISSING |
| Leave vs close tab; Stop and leave / Stop and close Room | Session end | [record/record-in-a-descript-room](https://help.descript.com/record/record-in-a-descript-room) | Launch | MISSING |
| Room settings General: theme, chat notifications, waiting room, auto-admit role, producer chime, emoji skin tone | Settings | [record/room-settings](https://help.descript.com/record/room-settings) | Launch | MISSING |
| Room settings Audio: echo cancellation, background noise reduction, auto gain, recording quality (Auto 48 kHz / lossless WAV) | Settings | [record/room-settings](https://help.descript.com/record/room-settings) | Launch | MISSING |
| Room settings Video: aspect ratio 1:1/16:9, framing overlay, recording quality up to 4K, call quality Auto/Bandwidth saver | Settings | [record/room-settings](https://help.descript.com/record/room-settings) | Launch | MISSING |
| Results: Recordings folder > "Room – date" + Backups; auto sequence inserted into composition and transcribed | Into project | [record/edit](https://help.descript.com/record/edit) | Launch | MISSING |
| Stalled upload: Start editing with partial/backup / Copy recovery link (7 days) / rejoin to finish | Recovery | [record/rooms-recover-replace](https://help.descript.com/record/rooms-recover-replace) | Launch | MISSING |
| Replace partial file in sequence with recovered recording | Recovery | [record/rooms-recover-replace](https://help.descript.com/record/rooms-recover-replace) | Launch | MISSING |
| Browser support: Chrome, Edge, Arc, Firefox, Safari 26+, Opera; mobile blocked | Support matrix | [record/recording-checklist](https://help.descript.com/record/recording-checklist) | Launch | MISSING |
| Bandwidth guidance: 10 Mbps min, 20 recommended, 30 up for 4K | Checklist | [record/recording-checklist](https://help.descript.com/record/recording-checklist) | Launch | MISSING |
| 4 h per recording; multiple recordings per Room saved to same project | Limit | [record/rooms-ts](https://help.descript.com/record/rooms-ts) | Launch | MISSING |
| CPU overload warnings, mic-switch toast, viewer defaults / producer slots | Rooms improvements | [changelog/release-roundupapril-16th-2026](https://descript.canny.io/changelog/release-roundupapril-16th-2026) | Launch | MISSING |

#### 6.6 Scheduling and async

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Schedule for later: title, date, start/end, timezone | Scheduled Room | [record/schedule](https://help.descript.com/record/schedule) | Launch | MISSING |
| Advanced: Save recording to new project (workspace/folder) or existing project | Destination | [record/schedule](https://help.descript.com/record/schedule) | Launch | MISSING |
| Who can start: Host only / drive members / anyone with project access / anyone with link (record without host) | Permissions | [record/schedule](https://help.descript.com/record/schedule) | Launch | MISSING |
| Add to Google Calendar / Outlook; copy invite link | Invites | [record/schedule](https://help.descript.com/record/schedule) | Launch | MISSING |
| Rooms recordings tab: Upcoming / Past; edit/delete | List | [record/schedule](https://help.descript.com/record/schedule) | Launch | MISSING |
| Invite to record async: title, optional teleprompter script, link expiry, drive-members-only or anyone | Async request | [record/async-recordings](https://help.descript.com/record/async-recordings) | Launch | MISSING |
| Async guest flow: name, device check, teleprompter, record, upload | Guest UX | [record/async-recordings](https://help.descript.com/record/async-recordings) | Launch | MISSING |
| Async results in folder named by link; subfolder per guest; email + in-app notification | Delivery | [changelog/release-roundupoctober-12-2026](https://descript.canny.io/changelog/release-roundupoctober-12-2026) | Launch | MISSING |

#### 6.7 Retakes and recovery

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Restart recording (discard take) | Retake | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Replace selection by recording (re-record passage) | Retake in place | [record/editor-recorder](https://help.descript.com/record/editor-recorder) | Launch | MISSING |
| Multiple recordings per session/Room (takes) saved to the same project | Takes | [record/rooms-ts](https://help.descript.com/record/rooms-ts) | Launch | MISSING |
| SquadCast Takes (rename, review per take) | Reference for takes UX | [squadcast/takes](https://help.descript.com/squadcast/takes) | Launch | MISSING |
| Remove Retakes AI after recording | Mark earlier takes ignored | [descript-tour/sound-good-tools](https://help.descript.com/descript-tour/sound-good-tools) | Launch | MISSING |
| Recording recovery (web.descript.com/recover; desktop auto) | Crash recovery | [record/recover](https://help.descript.com/record/recover) | Launch | MISSING |
| Progressive upload (SquadCast reference) | Chunks uploaded during recording | [squadcast/progressive-upload](https://help.descript.com/squadcast/progressive-upload) | Launch | MISSING |
| Unsupported devices list (AirPods, ASIO, Krisp, virtual cams…) | Compatibility | [record/unsupported](https://help.descript.com/record/unsupported) | Launch | MISSING |

#### 6.8 SquadCast-only features (legacy product; reference only)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Green room, record/join tones, Dolby mastering, Auphonic mixing, SquadShots, Shows | Legacy SquadCast product | [squadcast/green-room](https://help.descript.com/squadcast/green-room) | N-A | — |

### 7. Export, publish, share


#### 7.1 Export dialog

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Export button (top-right) → tabs Video / Audio / Subtitles / Transcript / Timeline; Destination dropdown | Export hub | [export-and-share/export-and-publishing-overview](https://help.descript.com/export-and-share/export-and-publishing-overview) | Launch | §C3 (no Timeline tab) |
| Export range: Current composition / Current selection / Current scene / Scenes / Markers / Line breaks / All compositions | Batch modes | [export-and-share/video-gif](https://help.descript.com/export-and-share/video-gif) | Launch | PARTIAL §C3 (composition + selection only) |
| Video: MP4 local export | Render to file | [export-and-share/video-gif](https://help.descript.com/export-and-share/video-gif) | Launch | §C3 |
| Video: GIF format | Animated GIF | [export-and-share/video-gif](https://help.descript.com/export-and-share/video-gif) | Launch | MISSING |
| Video resolution 480p/720p/1080p/1440p/4K (capped by plan + canvas size) | Resolution | [export-and-share/video-gif](https://help.descript.com/export-and-share/video-gif) | Launch | §C3 |
| Video quality Low / Medium / High | Compression preset | [export-and-share/how-descript-controls-export-quality-and-file-size](https://help.descript.com/export-and-share/how-descript-controls-export-quality-and-file-size) | Launch | §C3 |
| Frame rate (30/60) affects size | Frame rate | [export-and-share/how-descript-controls-export-quality-and-file-size](https://help.descript.com/export-and-share/how-descript-controls-export-quality-and-file-size) | Launch | PARTIAL §C3 |
| Embedded subtitle track in MP4 (choose to embed, Mar 2026) | Soft subs | [export-and-share/remove-embedded-subtitles](https://help.descript.com/export-and-share/remove-embedded-subtitles) | Launch | MISSING |
| Audio: m4a / wav / mp3 | Formats | [export-and-share/audio](https://help.descript.com/export-and-share/audio) | Launch | §C3 |
| Audio advanced: channels mono/stereo, 44.1/48 kHz, bitrate 32–256 kbps, normalize Off/Peak/-14/-16/-18/-23/-24 LUFS | Settings | [export-and-share/audio](https://help.descript.com/export-and-share/audio) | Launch | PARTIAL §C3 |
| Metadata: show title, episode title, description, artwork, chapters (markers) | ID3/MP4 metadata | [export-and-share/audio](https://help.descript.com/export-and-share/audio) | Launch | MISSING |
| Subtitles: .srt / .vtt; show speakers; max chars/line; max lines/card | Settings | [export-and-share/subtitles](https://help.descript.com/export-and-share/subtitles) | Launch | §C3 |
| Transcript: .html/.md/.docx/.txt/.rtf; timecode offset; include composition name/markers/ignored text/speaker labels/speakers every paragraph | Settings | [export-and-share/transcript](https://help.descript.com/export-and-share/transcript) | Launch | PARTIAL §C3 (no docx/rtf/html, no markers) |
| Transcript timecodes: interval seconds, at paragraph breaks, with speaker labels, at markers | Timecode options | [export-and-share/transcript](https://help.descript.com/export-and-share/transcript) | Launch | PARTIAL §C3 |
| Export soloed sequence track as mono file | Stem export | [export-and-share/sequence-tracks](https://help.descript.com/export-and-share/sequence-tracks) | Launch | MISSING |
| Free-plan watermark + 720p cap | Plan gating | [export-and-share/video-gif](https://help.descript.com/export-and-share/video-gif) | N-A | — |
| Export blocked by unready file (hover shows which file) | Guard | [export-and-share/troubleshooting](https://help.descript.com/export-and-share/troubleshooting) | Launch | PARTIAL §C5 |
| Browser export storage/memory errors & persistent storage | Web constraints | [export-and-share/troubleshooting](https://help.descript.com/export-and-share/troubleshooting) | Launch | PARTIAL §C4 |

#### 7.2 Timeline (NLE) export

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Formats: Premiere XML, Premiere .prproj (beta), DaVinci Resolve XML, FCPXML, Reaper EDL, Audition SESX, Pro Tools/Logic AAF | NLE handoff | [export-and-share/timeline-exports](https://help.descript.com/export-and-share/timeline-exports) | Later | — |
| Options: include media, comments as markers, track per file, Logic compatibility, frame-rate snapping | Settings | [export-and-share/timeline-exports](https://help.descript.com/export-and-share/timeline-exports) | Later | — |

#### 7.3 Web link / share page

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Export to Descript web link (publish / Update keeps URL) | Hosted player page | [export-and-share/share-page](https://help.descript.com/export-and-share/share-page) | Later | — |
| Share page settings: Access (Public / Anyone with link / Project access / Drive access), Show transcript, Allow comments, Show author, Allow sharing from embeds, Optimize file size, Custom branding | Page settings | [export-and-share/share-page-settings](https://help.descript.com/export-and-share/share-page-settings) | Later | — |
| Copy link / Start at time / Embed code / Page views / Download / Unpublish / Edit button | Page actions | [export-and-share/share-page-settings](https://help.descript.com/export-and-share/share-page-settings) | Later | — |
| Share-page comments (timestamp or transcript range) | Viewer comments | [export-and-share/share-page-settings](https://help.descript.com/export-and-share/share-page-settings) | Later | — |
| Thumbnail: pick frame or upload | Share thumbnail | [export-and-share/set-and-customize-thumbnails](https://help.descript.com/export-and-share/set-and-customize-thumbnails) | Later | — |

#### 7.4 Publish destinations

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| YouTube (title, description, category, tags, privacy; markers → chapters; web only) | Direct publish | [export-and-share/youtube](https://help.descript.com/export-and-share/youtube) | Later | — |
| Google Drive export | Upload rendered file | [export-and-share/google-drive](https://help.descript.com/export-and-share/google-drive) | Later | — |
| LinkedIn publish (Connected Apps) | Direct publish | [changelog/release-roundupseptember-17-2026](https://descript.canny.io/changelog/release-roundupseptember-17-2026) | Later | — |
| Podcast hosts: Blubrry, Buzzsprout, Captivate, Castos, Hello Audio, Pinecast, Podbean, Podcast.co, Transistor | Hand-off via share page | [export-and-share/others](https://help.descript.com/export-and-share/others) | Later | — |
| Video hosts/tools: Wistia, HubSpot, Restream, Headliner, eWebinar, VideoAsk | Hand-off | [export-and-share/others](https://help.descript.com/export-and-share/others) | Later | — |

### 8. Collaboration

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Comments: select words → chat-bubble → comment in right panel | Project comments | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Comment edit / delete via ⋯ | Manage | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| @mention collaborators (email notification) | Mentions | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Replies / threads | Threading | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Resolve (circle) → archived view; reopen | Resolution | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Comments sidebar: toggle, sort, resolved/unresolved filter, Copy comments as text | Sidebar | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Comment markers in timeline ruler | Indicators | [descript-tour/view-menu](https://help.descript.com/descript-tour/view-menu) | Launch | MISSING |
| Comments don't copy with content/duplicate | Behavior | [collaboration/project-comments](https://help.descript.com/collaboration/project-comments) | Launch | MISSING |
| Comments exported as NLE markers | Export option | [export-and-share/timeline-exports](https://help.descript.com/export-and-share/timeline-exports) | Later | — |
| Project Access dialog (Share button): copy link; access levels Anyone can comment / Anyone can view / Project access required; invite people | Sharing (dependency of comments) | [collaboration/project-links](https://help.descript.com/collaboration/project-links) | Launch | MISSING |
| Copy project link (Cmd+L) / Copy link to composition | Links | [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts) | Launch | MISSING |
| Personal workspace private; changing access moves project to Drive workspace | Rule | [collaboration/project-links](https://help.descript.com/collaboration/project-links) | N-A | — |
| Cursor presence (Labs) | Live collaborator cursors | [collaboration/cursor-presence](https://help.descript.com/collaboration/cursor-presence) | Later | — |
| Single-editor lock (Transovo) | One editor at a time | — | Launch | §C5 |

### 9. Layouts and layout packs (owner: Launch)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Layout pack = themed layouts grouped by type (Camera, Media, Chapter, Intro, Outro, Captions, Text, Other) | Concept | [templates-and-presets/overview](https://help.descript.com/templates-and-presets/overview) | Launch | MISSING |
| Apply layout: scene thumbnail → Layout / Choose layout; "[#] more" per group | Picker | [templates-and-presets/layouts-apply](https://help.descript.com/templates-and-presets/layouts-apply) | Launch | MISSING |
| Apply from scene panel tile / timeline right-click Change layout / storyboard | Entry points | [templates-and-presets/layouts-apply](https://help.descript.com/templates-and-presets/layouts-apply) | Launch | MISSING |
| Change layout pack: Gallery / Drive / Private tabs + search; doesn't rewrite applied layouts | Pack switch | [templates-and-presets/layouts-apply](https://help.descript.com/templates-and-presets/layouts-apply) | Launch | MISSING |
| Visual roles (Talking Head, Screen Recording, Graphics, Others) drive placeholder matching | Matching | [templates-and-presets/overview](https://help.descript.com/templates-and-presets/overview) | Launch | MISSING |
| Lock layer bypasses layout matching | Lock | [templates-and-presets/layouts-apply](https://help.descript.com/templates-and-presets/layouts-apply) | Launch | MISSING |
| Matching rules: camera/media interchangeable, by layer name, competition, leftovers notification (Restore one / Restore All / Dismiss) | Behavior | [templates-and-presets/layouts-behavior](https://help.descript.com/templates-and-presets/layouts-behavior) | Launch | MISSING |
| Empty scene + layout adds all layout layers | Behavior | [templates-and-presets/layouts-behavior](https://help.descript.com/templates-and-presets/layouts-behavior) | Launch | MISSING |
| Multicam layouts with sequences; edited layers preserved on layout change | Behavior | [templates-and-presets/layouts-behavior](https://help.descript.com/templates-and-presets/layouts-behavior) | Launch | MISSING |
| Smart Fill (Title/Subtitle text from script, captions, speaker labels); toggle per layout; Replace with placeholder | Auto-filled text | [templates-and-presets/layouts-save](https://help.descript.com/templates-and-presets/layouts-save) | Launch | MISSING |
| Save scene as new layout (name, Save to pack, per-layer Keep / Don't include / Turn into placeholder, type) | Custom layout | [templates-and-presets/layouts-save](https://help.descript.com/templates-and-presets/layouts-save) | Launch | MISSING |
| New layout pack from scratch (each scene = layout; Publish layout pack; access Private/Drive/Public) | Pack authoring | [templates-and-presets/layouts-save](https://help.descript.com/templates-and-presets/layouts-save) | Launch | MISSING |
| Layout pack can hold layouts for multiple aspect ratios (composition per ratio) | Aspect handling | [templates-and-presets/layouts-aspect](https://help.descript.com/templates-and-presets/layouts-aspect) | Launch | MISSING |
| Remix a gallery pack: base pack, Primary/Accent/Background colors, Title/Subtitle/Text fonts (upload), name, visibility | Re-theme | [templates-and-presets/layouts-remix](https://help.descript.com/templates-and-presets/layouts-remix) | Launch | MISSING |
| Share pack link; recipient "+ copy to my layout packs" | Sharing | [templates-and-presets/layouts-sharing](https://help.descript.com/templates-and-presets/layouts-sharing) | Launch | MISSING |
| Drive default layout pack (Brand Studio > Layout packs) | Default | [templates-and-presets/layouts-default](https://help.descript.com/templates-and-presets/layouts-default) | Launch | MISSING |
| Generate layout pack with AI (brand files, prompt, Inspire me, 4 directions, 120 credits) | AI pack | [templates-and-presets/layouts-generate](https://help.descript.com/templates-and-presets/layouts-generate) | Later | — |
| Prompt templates → Underlord skills (deprecated) | Templates | [templates-and-presets/custom-templates](https://help.descript.com/templates-and-presets/custom-templates) | Later | — |

### 11. App settings (Cmd+,)


#### 11.1 General

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Open settings: Cmd/Ctrl+, ; profile menu; drive selector; editor menu | Entry | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Launch | MISSING |
| Default project: video or audio-only | Default | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Launch | MISSING |
| Default AI speaker (Write mode) | Default | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Later | — |
| Appearance Light / Dark / System | Theme | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Launch | PARTIAL §A2 |
| Transcription: default language (Auto), always ask before transcribing, auto-detect speakers, auto-add frequent corrections (3×) to glossary, notify glossary updates | Transcription defaults | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Launch | MISSING |
| Advanced: automatic volume levels (−16 LUFS), show volume in dB, room tone on gap clips, apply Smart transitions, show wordless media in script, force software video decoding, limit preview to 1080p, default translation style, always show usage info | Advanced | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Launch | MISSING |
| Labs: New timeline, Underlord beta, Cursor presence; Leave feedback | Beta toggles | [account-and-app-settings/labs](https://help.descript.com/account-and-app-settings/labs) | Later | — |

#### 11.2 Account / drive (admin)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| AI models default (Underlord, transcription, image, video, speech, avatars) | Model picker | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | Later | — |
| Connected apps (LinkedIn, Zoom), Descript MCP, API tokens | Integrations | [account-and-app-settings/connected-apps](https://help.descript.com/account-and-app-settings/connected-apps) | N-A | — |
| Drive Preferences (logo, name, sharing policies, default publish privacy, default personal workspace) | Drive admin | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | N-A | — |
| Members, Workspaces, Plan, Usage, Invoices | Admin/billing | [account-and-app-settings/app-settings](https://help.descript.com/account-and-app-settings/app-settings) | N-A | — |
| Profile name/image, email change, password reset, switch accounts/drives, create drives, delete account, data privacy opt-out, email notifications, referrals, Raycast, drive transfer | Account | [account-and-app-settings/profile](https://help.descript.com/account-and-app-settings/profile) | N-A | — |
| Team: invite/remove members, Editor/Viewer roles, admins, workspaces, hide General | Team admin | [team-management/drive-roles](https://help.descript.com/team-management/drive-roles) | N-A | — |
| Billing, plans, AI credits, media minutes (19 pages) | Billing | [billing-payments-plans/](https://help.descript.com/billing-payments-plans) | N-A | — |
| API (create projects, import, edit), MCP (Claude/ChatGPT/custom), Zapier, n8n, Claude Motion | Developer | [api-and-mcp/api](https://help.descript.com/api-and-mcp/api) | N-A | — |
| Desktop install/uninstall, system requirements, GPU, status page, network fixes, beta label | Platform/support | [getting-started/descript-system-requirements](https://help.descript.com/getting-started/descript-system-requirements) | N-A | — |
| Community, affiliates, hosting partners, get help | Company | [connect-with-us/get-help](https://help.descript.com/connect-with-us/get-help) | N-A | — |
| Editor performance & proxy playback troubleshooting | Performance | [app-troubleshooting/performance-playback](https://help.descript.com/app-troubleshooting/performance-playback) | Launch | §C4 |
| Project won't load / won't save recovery | Reliability | [app-troubleshooting/project-stuck](https://help.descript.com/app-troubleshooting/project-stuck) | Launch | PARTIAL §C5 |

### 12. AI features (owner: Later unless noted)


#### 12.1 AI Tools panel

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| AI Tools panel groups: Sound good, Look good, Repurpose, Publish, Write | Panel | [descript-tour/ai-tools-overview](https://help.descript.com/descript-tour/ai-tools-overview) | Later | — |
| Edit for Clarity | AI tighten | [descript-tour/sound-good-tools](https://help.descript.com/descript-tour/sound-good-tools) | Later | — |
| Quick Design (script → scene-based rough cut) | AI layout pass | [ai-assistant/quick-design](https://help.descript.com/ai-assistant/quick-design) | Later | — |
| Write tools: Brainstorm, Write a script, Write an outline, Rewrite | Text gen | [descript-tour/write-tools](https://help.descript.com/descript-tour/write-tools) | Later | — |
| Publish tools: Draft title, Summarize, Show notes, YouTube description, Social post, Blog post | Text gen | [descript-tour/publish-tools](https://help.descript.com/descript-tour/publish-tools) | Later | — |
| Repurpose: Create clips (shorts), Create highlight reel, Find highlights | Clipping | [repurpose/create-clips-from-your-content](https://help.descript.com/repurpose/create-clips-from-your-content) | Later | — |
| Translate captions; Dub speech; Lip sync; Do-not-translate list | Localization | [repurpose/translate-overview](https://help.descript.com/repurpose/translate-overview) | Later | — |

#### 12.2 AI speech

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Write mode | Draft script for TTS | [ai-speech/write-mode](https://help.descript.com/ai-speech/write-mode) | Later | — |
| Text-to-speech with stock voices / custom voice clone; TTS text colors; pronunciation | AI voice | [ai-speech/tts](https://help.descript.com/ai-speech/tts) | Later | — |
| Convert recorded audio to AI speech; convert AI speech to audio layer | Overdub-style | [ai-speech/convert-to-ai-speech](https://help.descript.com/ai-speech/convert-to-ai-speech) | Later | — |
| Manage/share AI speakers (Drive > Speakers) | Voices | [ai-speech/sharing](https://help.descript.com/ai-speech/sharing) | Later | — |
| Regenerate (re-voice word/phrase) | AI patch | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Later | — |

#### 12.3 Generative media and Underlord

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Generate images/video from prompt; style library; models | Gen media | [generative-media/generate-media](https://help.descript.com/generative-media/generate-media) | Later | — |
| Edit image with AI; extend video; start/end frame transitions; YouTube thumbnail | Gen edits | [generative-media/edit-with-ai](https://help.descript.com/generative-media/edit-with-ai) | Later | — |
| Generate AI music and sound effects | Gen audio | [generative-media/generate-audio](https://help.descript.com/generative-media/generate-audio) | Later | — |
| Avatars (create, presenter) | Avatars | [generative-media/overview](https://help.descript.com/generative-media/overview) | Later | — |
| Underlord chat co-editor; skills; revert Underlord changes; AI video maker | AI agent | [getting-started/underlord-beta-your-ai-co-editor-in-descript](https://help.descript.com/getting-started/underlord-beta-your-ai-co-editor-in-descript) | Later | — |

#### 12.4 Recent changelog items (not in help center)

| Feature | Behavior | Source | Tag | In spec |
|---|---|---|---|---|
| Tone Tags for AI speakers (Add tone) | Emotion control | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Later | — |
| Letterboxing detection | Auto-detect black bars | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Later | — |
| Gradient fills (shapes/text/captions) | Gradient color | [changelog/release-round-upaugust-5th-2026](https://descript.canny.io/changelog/release-round-upaugust-5th-2026) | Launch | MISSING |
| Classic color theme | Theme option | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Later | — |
| Speaker detection pre-processing on Drive media | Faster speaker ID | [changelog/release-round-upjune-11th-2026](https://descript.canny.io/changelog/release-round-upjune-11th-2026) | Launch | MISSING |
| Media Library files transcribe automatically | Auto-transcribe library | [changelog/release-roundupmarch-17th-2026](https://descript.canny.io/changelog/release-roundupmarch-17th-2026) | Launch | MISSING |
| CPU overload warnings in Rooms | Health warning | [changelog/release-roundupmarch-2nd-2026](https://descript.canny.io/changelog/release-roundupmarch-2nd-2026) | Launch | MISSING |
| Transcribe into UK English | Locale variant | [changelog/release-roundupfebruary-10th-2026](https://descript.canny.io/changelog/release-roundupfebruary-10th-2026) | Launch | MISSING |
| A year of usage history | Billing | [changelog/release-roundupoctober-12-2026](https://descript.canny.io/changelog/release-roundupoctober-12-2026) | N-A | — |


## Appendix A. Full Descript keyboard shortcut list vs Transovo C1

Source: [descript-tour/keyboard-shortcuts](https://help.descript.com/descript-tour/keyboard-shortcuts). `C1` = present in script-editor.md §C1; `—` = not in C1.
85 shortcuts; 35 covered (fully or with a different key) in §C1; 50 not in C1. Shortcuts for Launch features that are MISSING (markers, scenes, comments, layers, layout picker, Text/Shape insert, project access, copy link) arrive with those features in the gap matrix milestones.


| Group | Action | Mac | Windows | Transovo |
|---|---|---|---|---|
| Screen Recorder | Start/stop Screen Recorder | Cmd + Shift + 2 | Ctrl + Shift + 2 | — |
| Playback | Play / Pause | Space (while script tools are inactive), Cmd + S, Option + Click | Space (while script tools are inactive), Ctrl + S, Alt + Click | C1 |
| Playback | Play from cursor | Shift + Space | Shift + Space | C1 |
| Playback | Spot audition | Shift + Cmd + Space | Ctrl + Shift + Space | — |
| Playback | Move playhead to beginning | Home | Home | C1 |
| Playback | Next marker | Option + Cmd + . | Ctrl + Alt + . | — |
| Playback | Previous marker | Option + Cmd + , | Ctrl + Alt + , | — |
| Playback | Next scene | Shift + Cmd + . | Ctrl + Shift + . | — |
| Playback | Previous scene | Shift + Cmd + , | Ctrl + Shift + , | — |
| Playback | Step forward by a frame | Right arrow | Right arrow | C1 |
| Playback | Step backward by a frame | Left arrow | Left arrow | C1 |
| Playback | Next clip | Option + Shift + Cmd + . | Ctrl + Alt + Shift + . | — |
| Playback | Previous clip | Option + Shift + Cmd + , | Ctrl + Alt + Shift + , | — |
| Playback | Decrease playback speed | Shift + J | Shift + J | C1 |
| Playback | Reset playback speed | Shift + K | Shift + K | C1 |
| Playback | Increase playback speed | Shift + L | Shift + L | C1 |
| Playback | Autoscroll | Esc | Esc | C1 |
| Timeline | Select tool | A or hold A | A or hold A | C1 |
| Timeline | Range tool | R or hold R | R or hold R | — |
| Timeline | Blade tool | B or hold B | B or hold B | C1 |
| Timeline | Hand tool | H or hold H | H or hold H | C1 |
| Timeline | Slip tool | Y or hold Y | Y or hold Y | — |
| Timeline | Zoom in | Cmd + Scroll down or Cmd + = | Ctrl + Scroll down or Ctrl + = | C1 |
| Timeline | Zoom to playhead | Option + Cmd + 3 | Ctrl + Alt + 3 | C1 |
| Timeline | Fit selection | Option + Cmd + 4 | Ctrl + Alt + 4 | C1 has ⇧Z fit (Descript ⌥⌘4) |
| Timeline | Scroll left | Shift + Scroll Down or H + Drag Right | Shift + Scroll Down or H + Drag Right | — |
| Timeline | Scroll right | Shift + Scroll Up or H + Drag Left | Shift + Scroll Up or H + Drag Left | — |
| Timeline | Add clip boundary (split clip) | S | S | C1 |
| Timeline | Replace with gap clip | Shift + Delete | Shift + Backspace | C1 |
| Timeline | Replace with (requires visual selected) | Option + R | Alt + R | — |
| Timeline | Toggle timeline | Shift + Cmd + S | Ctrl + Shift + S | C1 |
| Timeline | Mute selected audio layer or hide selected visual layer | 0 | 0 | — |
| Tools | Toggle capitalization | Hold Z, then click a word | Hold Z, then click a word | C1 |
| Tools | Toggle punctuation | Hold X, then click a word | Hold X, then click a word | C1 |
| Tools | Correct the selection | Highlight and press C | Highlight and press C | C1 |
| Tools | Search actions | Cmd + K | Ctrl + K | — |
| Selection | Ignore | Cmd + Delete | Ctrl + Backspace | C1 |
| Selection | Bold text | Cmd + B | Ctrl + B | — |
| Selection | Italic text | Cmd + I | Ctrl + I | — |
| Selection | Highlight | Shift + Cmd + H | Ctrl + Shift + H | — |
| Selection | Paste attributes | Shift + Cmd + V | Ctrl + Shift + V | — |
| Selection | Edit sequence | Shift + Cmd + O | Ctrl + Shift + O | — |
| Selection | Auto-level clip | Option + Shift + Cmd + L | Ctrl + Alt + Shift + L | — |
| Selection | Comment | Shift + Cmd + M | Ctrl + Shift + M | — |
| Selection | Duplicate | Shift + Cmd + C | Ctrl + Shift + C | — |
| Selection | Quick duplicate | Option + Shift + Cmd + C | Ctrl + Alt + Shift + C | — |
| Insert | Speaker label | @ | @ | C1 |
| Insert | Marker (not while the correction tool is active) | # | # | — |
| Insert | Regenerate | D | D | — |
| Insert | Text | Option + Cmd + T | Ctrl + Alt + T | — |
| Insert | Shape | Option + Cmd + S | Ctrl + Alt + S | — |
| Insert | Scene (not while the correction tool is active) | / | / | — |
| Scene Editor | Bring to front | ] | ] | — |
| Scene Editor | Move forward | Shift + ] | Shift + ] | — |
| Scene Editor | Move backward | Shift + \ | Shift + \[ | — |
| Scene Editor | Send to back | \[ | \[ | — |
| Scene Editor | Duplicate layer | Cmd + D | Ctrl + D | — |
| Scene Editor | Hide layer | Option + H | Alt + H | — |
| Scene Editor | Toggle layer lock | Option + L | Alt + L | — |
| Scene Editor | Snap to guides | Shift + Cmd + ' | Ctrl + Shift + ' | — |
| Scene Editor | Expand / shrink scene editor | Cmd + . | Ctrl + . | C1 |
| View | Show / hide video | Option + Cmd + V | Ctrl + Alt + V | — |
| View | Move video | Option + Shift + Cmd + V | Ctrl + Alt + Shift + V | — |
| View | Toggle project contents | Option + Cmd + C | Ctrl + Alt + C | — |
| View | Media library | Option + Cmd + L | Ctrl + Alt + L | — |
| View | Toggle layout picker | Option + Cmd + P | Ctrl + Alt + P | — |
| View | Toggle AI Tools | Option + Cmd + Y | Ctrl + Alt + Y | — |
| View | Increase text size | Command + Shift + = | Ctrl + Shift + = | C1 |
| View | Keyboard shortcuts | Option + Cmd + K | Ctrl + Alt + K | C1 uses ⌘/ (Descript ⌥⌘K) |
| Edit | New project | Cmd + N | Ctrl + N | — |
| Edit | New composition | Option + Cmd + N | Ctrl + Alt + N | — |
| Edit | Toggle write mode | Cmd + E | Ctrl + E | — |
| Edit | Toggle correct text mode | Option + C | Alt + C | C1 |
| Edit | Undo | Cmd + Z | Ctrl + Z | C1 |
| Edit | Redo | Shift + Cmd + Z | Ctrl + Shift + Z | C1 |
| Edit | Select all | Cmd + A | Ctrl + A | C1 |
| Edit | Find | Cmd + F | Ctrl + F | C1 |
| Edit | Find in project | Shift + Cmd + F | Ctrl + Shift + F | — |
| Edit | Find previous | Shift + Cmd + G | Ctrl + Shift + G | C1 |
| Edit | Find next | Cmd + G | Ctrl + G | C1 |
| Edit | Restore removed media | Shift + Cmd + Delete | Ctrl + Shift + Backspace | C1 |
| Share | Project access | Shift + Cmd + A | Ctrl + Shift + A | — |
| Share | Export to Descript share page | Shift + Cmd + P | Ctrl + Shift + P | — |
| Share | Copy project link | Cmd + L | Ctrl + L | — |
| Share | Local export | Shift + Cmd + E | Ctrl + Shift + E | C1 |
