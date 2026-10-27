# Editor / Descript-side feature status inventory

**Purpose:** Per-feature **STATUS** for Rick to decide what to hide behind a default-off flag later. **No KEEP/HIDE recommendations here.** **No UI hidden yet.**

**Code revision:** `393af7b7d` (`origin/master` at time of write). Inventory is **code + optional prod-db only** — not gated on web deploy **4373** or any in-flight worker deploy.

**Prod-db snapshot (optional):** 2026-10-27 read-only queries via `clips-worker` container (may lag live workers).

**Status legend:** **DONE** · **MOSTLY DONE** (gap noted) · **BROKEN** · **STUB**

**Evidence legend:** `prod-db` = `clip_jobs` / related tables on production Postgres; `tests` = unit tests in repo; `code` = static wiring only.

---

## 1. Navigation, hub, and shell entry

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry (routes / nav) |
|---------|--------|------------------------------|----------|------------|-------------------------|
| Sidebar **Editor** section | DONE | — | `code` | `components/shell/app-sidebar.tsx`, `lib/app-sidebar-sections.ts` | Sidebar when section = Editor |
| **Editor hub** (project list) | MOSTLY DONE | Shows processing + READY + DRAFT; FAILED/CANCELED omitted; no search/folders | `code`; shipped `9be116032` | `app/app/editor/page.tsx`, `lib/server/clips/drive-data.ts` | `/app/editor`; sidebar **Editor hub**; `lib/nav.ts` **Editor** (Library) |
| **Projects library** (Clips drive) | DONE | Shared with clipper; not editor-only | `code` | `app/app/clips/(drive)/page.tsx`, `components/drive/drive-home.tsx` | `/app/clips`; primary **Clips** sidebar |
| **Create → Editor** | DONE | Points at hub | `code` | `components/shell/sidebar-create-menu.tsx` | Sidebar **Create** → **Editor** → `/app/editor` |
| **Script editor page** (container) | DONE | Full-height shell under app chrome | `code` | `app/app/clips/[projectId]/script/page.tsx`, `script-editor-entry.tsx` | `/app/clips/[projectId]/script`; `?clipId=` for clip composition |
| **Edit transcript** from project | DONE | Link from clipper project view | `code` | `components/clips/project-clips-view.tsx` | `/app/clips/[projectId]` → **Edit transcript** |
| **T2V stale storyboard banner** | MOSTLY DONE | Only when `sourceKind=t2v` (AI Video flag usually off) | `code` | `components/t2v/t2v-editor-stale-banner.tsx` | Banner on `/script` for t2v projects |
| **Voice** nav item | STUB | Disabled “soon” | `code` | `lib/nav.ts`, `app-sidebar.tsx` | `/app/voice` (disabled) |
| **Layout packs** (drive view) | MOSTLY DONE | Brand templates via `?view=layouts`; not editor-specific | `code` | `drive-home.tsx`, brand APIs | `/app/clips?view=layouts`; sidebar **Layout packs** |
| **Workspaces** drive view | MOSTLY DONE | Workspace switcher pattern | `code` | drive | `/app/clips?view=workspaces` |
| **Screenwriting** (SW) | DONE | Separate product; gated `isScreenwritingEnabled()` | `tests`: `screenwriting-p0-editor.test.ts` | `app/app/sw/**`, `/api/sw/**` | `/app/sw`; sidebar when enabled |
| **Brand kit / templates** | DONE | Used by captions/layouts | `code` | `app/app/clips/(drive)/brand/**` | `/app/clips/brand`, `?tab=templates` |

---

## 2. Upload, import, media library

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **New project upload** (clipper create) | DONE | Shared ingest | `prod-db`: `PROCESS_PROJECT` 14d DONE 27 / FAILED 11 | `app/clips/(drive)/new`, `lib/clips/upload.ts` | `/app/clips/new` |
| **Editor empty import** (no words yet) | DONE | Dropzone, link, rooms links | `code` | `import/script-empty-import.tsx` | `/script` when bootstrap has 0 words + DRAFT/empty |
| **Attach media to project** | DONE | Same-origin API | `code` | `POST /api/clips/projects/[id]/media` | Empty import flows |
| **Link import** (YouTube/Drive) | MOSTLY DONE | YouTube often blocked by `import-url` rules (by design) | `tests`: `import-url.test.ts` | `lib/clips/import-url.ts` | Empty import URL field |
| **Media library** (workspace uploads) | MOSTLY DONE | Lists `COMPLETE` uploads; create project → script; no attach-to-existing from UI | `code`; shipped `9be116032` | `app/clips/(drive)/media/page.tsx`, `media-library-view.tsx`, `lib/server/clips/media-library.ts` | `/app/clips/media`; sidebar **Media library**; empty import button |
| **Make clips from long video** CTA | DONE | Redirects to clipper create | `code` | `script-empty-import.tsx` | Empty import primary CTA |

---

## 3. Recording (Rooms) and in-editor record

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Rooms** (LiveKit record) | MOSTLY DONE | Gated `FEATURE_SCRIPT_RECORDING` + LiveKit env | `code` | `app/app/rooms/**`, `components/recording/rooms/**` | `/app/rooms/new`, `/app/rooms/[sessionId]/studio`; sidebar **Rooms** |
| **Rooms index** | STUB | Redirects to `/app/rooms/new` only | `code` | `app/app/rooms/page.tsx` | `/app/rooms` |
| **Upload recovery** | MOSTLY DONE | Resume IndexedDB chunks; **no** “import take → script” button on recovery page (studio has it) | `code` | `rooms/[sessionId]/upload/page.tsx`, `upload-recovery-client.tsx` | `/app/rooms/[sessionId]/upload` |
| **Take → project → script** (API) | DONE | `finalizeRecordingTakeToProject` returns `scriptUrl` | `code` | `lib/server/recording/finalize-take.ts`, `POST .../takes/[takeId]/import` | Rooms studio **Done** → `/script` |
| **In-editor recorder bar** | MOSTLY DONE | Embedded in shell; depends on recording flags | `code` | `components/recording/editor/editor-recorder-bar.tsx`, `use-editor-recorder.ts` | Script shell header area |
| **Teleprompter** | MOSTLY DONE | Panel in shell | `code` | `components/recording/editor/teleprompter-panel.tsx` | Script shell |
| **Rooms upload card in shell** | MOSTLY DONE | Overlay during room-related flows | `code` | `rooms/upload-card.tsx` wired in `script-editor-shell.tsx` | Script shell |

---

## 4. Transcription, bootstrap, speakers

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Transcription pipeline** (worker) | MOSTLY DONE | Failures on some `PROCESS_PROJECT` (11 FAILED / 14d) | `prod-db` | worker `pipeline.py`, Deepgram path | Project status on `/app/clips/[projectId]` |
| **Transcribing wait UI** | DONE | Polls status + bootstrap | `code`; `[editor:transcribe]` | `script-editor-transcribing.tsx`, `getProjectStatus` | `/script` while processing |
| **Script bootstrap** | DONE | Words, video URL, composition | `code` | `GET /api/clips/projects/[id]/script/bootstrap`, `lib/server/clips/script-bootstrap.ts` | Entry load |
| **Speaker blocks / labels** | MOSTLY DONE | Depends on diarization in transcript | `code` | `group-speaker-blocks.ts`, shell transcript | Transcript pane |
| **Speaker rename** | DONE | Composition ops | `code` | `speaker-rename-popover.tsx` | Transcript speaker chip |
| **Transcript enrich** | MOSTLY DONE | `enrichedAt` on media asset | `code` | `lib/server/clips/script-enrich.ts` | Server-side on bootstrap path |
| **Failed / canceled project** | DONE | Panel + back link | `code` | `script-editor-entry.tsx` | `/script` |

---

## 5. Main editor shell (layout, transport, preview)

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Script editor shell** | DONE | Large surface; live QA incomplete | `tests`: `editor-undo.test.ts`, `editor-native-controls.test.ts` | `script-editor-shell.tsx` | `/script` with words |
| **Preview + transport** | DONE | Play/pause, playhead, follow mode | `code` | `script-preview-canvas.tsx`, `sync-playhead.ts`, `preview-pill-bar.tsx` | Center column |
| **Composition switcher** (full vs clip) | DONE | `clipId` query | `code` | `script-composition-switcher.tsx` | Shell header |
| **Saving / undo / redo** | DONE | Ops + localStorage undo stack | `tests`: `editor-undo.test.ts` | `use-script-composition.ts`, `POST .../ops` | Header undo/redo; autosave |
| **Save status indicator** | DONE | saving / saved / error | `code` | shell header | Header |
| **Side rail** (7 tabs) | DONE | project, edit, properties, elements, layouts, captions, media | `code` | `script-editor-rail.tsx` | Right rail icons |
| **Command palette / actions** | DONE | Searchable actions dialog | `code` | `script-action-bar.tsx` | Cmd palette in shell |
| **Back to project** | DONE | Link | `code` | shell header | Header |
| **Reframe crop overlay** (preview) | MOSTLY DONE | Keyframes / aspect | `code` | `script-reframe-layer.tsx` | Preview |
| **VU meter** | MOSTLY DONE | Preview audio levels | `code` | `script-vu-meter.tsx` | Transport |
| **Find in transcript** | MOSTLY DONE | Wired in shell | `code` | `transcript-find.ts` | Shell search |
| **Theme** | DONE | Uses `next-themes` | `code` | shell | Settings / system |

### 5b. Shell header / layout modes (flagging entry points)

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Export popover** | BROKEN (worker) | See §17 | `prod-db` | `script-export-popover.tsx`, header Export | Header **Export** |
| **Share / access modal** | MOSTLY DONE | — | `code` | `script-project-access-modal.tsx`, Share icon | Header **Share** (`Share2`) |
| **Comments drawer** | DONE | Toggle + panel | `code` | `setCommentsOpen`, `ScriptCommentsPanel` | Header **Comments** (⌘⌥M) |
| **Settings modal** | DONE | — | `code` | `script-editor-settings-modal.tsx` | Header **Settings** |
| **Version history drawer** | DONE | — | `code` | `ScriptVersionHistoryPanel` | Header / actions → Version history |
| **Storyboard layout mode** | MOSTLY DONE | Grid vs script layout | `code` | `ScriptStoryboardPanel`, layout toggle | Header **Storyboard view** |
| **Multicam panel** | MOSTLY DONE | Auto-multicam action | `code` | `ScriptMulticamPanel` | Shell side stack (when multicam open) |
| **AI tools / clarity side stack** | MOSTLY DONE | Panel toggles from shell | `code` | `ScriptClarityPanel`, `ScriptAiToolsPanel` | Actions / side overlays |
| **Recorder + teleprompter** | MOSTLY DONE | Recording flags | `code` | `EditorRecorderBar`, `TeleprompterPanel` | Header / shell |

---

## 6. Text-based editing (Descript core)

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Word delete → cut video** | DONE | EDL `cut` ops | `tests`: `edits-reducer.test.ts` (related) | `derive-edl.ts`, ops route | Transcript + toolbar |
| **Selection toolbar** | DONE | Cut, clarity, etc. | `code` | `script-selection-toolbar.tsx` | Text selection |
| **Transcript context menu** | DONE | Right-click ops | `code` | `script-transcript-context-menu.tsx` | Transcript |
| **Filler word review** | DONE | Scan + apply | `code` | `script-filler-review-bar.tsx`, `filler-hits.ts` | Edit tools → Filler; review bar |
| **Shorten gaps** | DONE | Gap ops | `code` | `script-shorten-gaps-panel.tsx`, `gap-hits.ts` | Edit tools; gap chips |
| **Gap chip menu** | DONE | Per-gap actions | `code` | `script-gap-chip-menu.tsx` | Transcript between words |
| **Retakes detect (AI)** | DONE | gpt-6-luna | `code`; `logEditor` on route | `script-retakes-panel.tsx`, `POST .../retakes` | Edit tools → Retakes |
| **Retake apply to timeline** | MOSTLY DONE | Apply path needs live QA | `code` | shell + ops | Retakes panel |
| **Clarity rewrite** | DONE | Luna | `code` | `script-clarity-panel.tsx`, `POST .../clarity` | Side panel + selection |
| **Descript keyboard shortcuts** | MOSTLY DONE | `descript-shortcuts.ts`; QA incomplete | `code` | `lib/clips/script-editor/descript-shortcuts.ts` | Global in shell |
| **Shortcuts sheet** | DONE | Help overlay | `code` | `script-shortcuts-sheet.tsx` | Header / shortcut |

**Related (clipper, not full script):** Short-form trim lives on `/app/clips/[projectId]/edit/[clipId]` — separate from this inventory’s `/script` shell but shares EDL concepts.

---

## 7. Timeline, scenes, storyboard, multicam

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Timeline panel** | DONE | Ruler, word bar, lanes | `code` | `transport/timeline/timeline-panel.tsx` | Bottom dock |
| **Timeline view menu** | DONE | Lane visibility | `code` | `script-timeline-view-menu.tsx` | Timeline header |
| **Word bar / script track** | DONE | — | `code` | `timeline-wordbar.tsx`, `timeline-script-track.tsx` | Timeline |
| **Music lane** | MOSTLY DONE | Tied to composition music bed | `code` | `timeline-music-lane.tsx` | Timeline |
| **Overlay / B-roll lane** | MOSTLY DONE | Overlays from elements/media | `code` | `timeline-overlay-lane.tsx` | Timeline |
| **Captions lane** | DONE | — | `code` | `timeline-captions-lane.tsx` | Timeline |
| **Scenes strip** | MOSTLY DONE | Scene boundaries; nav helpers | `code` | `timeline-scenes-strip.tsx`, `scene-nav.ts` | Timeline |
| **Storyboard grid** | MOSTLY DONE | Reorder scenes; empty state via `/` | `code` | `storyboard/script-storyboard-panel.tsx` | Shell storyboard mode (layout toggle) |
| **Multicam** | MOSTLY DONE | Auto scenes from speakers; panel | `code` | `script-multicam-panel.tsx`, `multicam-scenes.ts` | Shell multicam UI |
| **Playhead follow / scroll** | DONE | — | `code` | `follow-playhead.ts`, `scroll-word-into-view.ts` | Transcript + timeline |

---

## 8. Side panels (project, properties, elements, layouts, media)

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Project panel** | DONE | Metadata | `code` | `script-project-panel.tsx` | Rail → Project |
| **Properties panel** | DONE | Selection properties → ops | `code` | `script-properties-panel.tsx` | Rail → Properties |
| **Edit tools panel** | DONE | Tabs: filler, gaps, retakes | `code` | `script-edit-tools-panel.tsx` | Rail → Edit tools |
| **Elements (overlays)** | MOSTLY DONE | Text placeholder only; B-roll via Media | `code` | `script-elements-panel.tsx` | Rail → Elements |
| **Layouts panel** | MOSTLY DONE | Brand templates | `code` | `script-layouts-panel.tsx`, brand templates API | Rail → Layouts |
| **Media / stock panel** | MOSTLY DONE | Stock search; overlaps clipper broll | `code` | `script-media-panel.tsx`, `.../broll/stock` | Rail → Media |
| **Captions panel** | DONE | Styles, document caption settings | `code` | `script-captions-panel.tsx` | Rail → Captions |
| **Audio panel** | MOSTLY DONE | Music, SFX, studio sound entry | `code` | `script-audio-panel.tsx` | Opened from shell (not on rail icons — audio subflows) |
| **AI tools panel** | MOSTLY DONE | Chapters entry | `code` | `script-ai-tools-panel.tsx` | Shell panel toggle |
| **Studio sound preview** | MOSTLY DONE | Generation job + preview | `code` | `studio-sound-preview.tsx`, `POST .../studio-sound` | Audio / shell |

---

## 9. Captions & subtitles

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Caption overlay (preview)** | DONE | — | `code` | `script-caption-overlay.tsx` | Preview |
| **Caption presets / brand** | DONE | Shared with brand kit | `code` | caption presets API, brand | Captions panel + brand |
| **Burn captions on export** | MOSTLY DONE | Export path **broken** on worker (see §16) | `prod-db` RENDER failures | export settings, worker render | Export popover |
| **SRT/VTT export** | MOSTLY DONE | Same worker job type | `prod-db` | `script-export-popover.tsx`, `composition-export.ts` | Export → Subtitles |
| **Subtitle sidecar track** | MOSTLY DONE | `includeSubtitleTrack` in export settings | `code` | export popover | Export advanced |

---

## 10. AI actions

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Chapters** | DONE | Luna | `logEditor` | `POST .../chapters`, AI tools | AI tools / export chapters text |
| **Music suggest** | DONE | Luna | `code` | `POST .../music/suggest` | Audio panel |
| **Retakes** | DONE | See §6 | `code` | `.../retakes` | Edit tools |
| **Clarity** | DONE | See §6 | `code` | `.../clarity` | Clarity panel |
| **SW script AI kinds** | DONE | `/api/sw/scripts/[id]/ai/[kind]` | `tests` partial | `app/api/sw/**` | Screenwriting UI |

---

## 11. Audio (music, SFX, studio)

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Music bed job** | MOSTLY DONE | Worker `MUSIC` job; preview QA | `code` | `POST .../music`, worker | Audio panel |
| **SFX** | MOSTLY DONE | `POST .../sfx` | `code` | audio panel | Audio panel |
| **Studio sound** | MOSTLY DONE | `STUDIO_SOUND` worker job | `code` | `.../studio-sound` | Studio sound preview |
| **useGeneration polling** | DONE | Shared with clipper generation UX | `code` | `use-generation.ts` | Shell overlays |

---

## 12. Comments & collaboration

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Comment threads** | DONE | CRUD API | `code` | `script-comments-panel.tsx`, `.../comments` | Header comment icon |
| **Timeline comment pins** | DONE | — | `code` | `timeline-comment-pins.tsx` | Timeline |
| **Mentions** | MOSTLY DONE | `workspace-members` API | `code` | `comment-mention-textarea.tsx` | Composer |
| **Comment composer pill** | DONE | — | `code` | `comment-composer-pill.tsx` | Transcript |

---

## 13. Share, publish, social

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Project access / share links** | MOSTLY DONE | Invite links; modal | `code` | `script-project-access-modal.tsx`, `POST .../share` | Header Share |
| **Public share viewer** | MOSTLY DONE | `/share/clips/[linkId]` | `code` | `app/share/clips/[linkId]/page.tsx`, `share-clip-viewer.tsx` | Public URL |
| **Publish to web** | MOSTLY DONE | Slug + embed settings; depends on export output | `code` | `POST .../publish`, export popover publish tab | Export popover |
| **Social publish** | STUB / gated | `403` when feature off | `code` | `composition-social-publish.ts`, `isCompositionSocialPublishEnabled()` | Export popover (if flag on) |
| **Published slug page** | MOSTLY DONE | `/share/p/[slug]` | `code` | `app/share/p/[slug]/page.tsx` | Public |

---

## 14. Markers

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Slash menu (markers/scenes)** | DONE | — | `code` | `script-slash-menu.tsx` | Type `/` in transcript |
| **Marker headings in script** | DONE | — | `code` | `script-marker-heading.tsx` | Transcript |
| **Markers lane** | DONE | — | `code` | `timeline-markers-lane.tsx` | Timeline |
| **Marker list popover** | DONE | Navigate markers | `code` | `script-marker-list-popover.tsx` | Shell |
| **Export include markers** | MOSTLY DONE | Toggle in export | `code` | export popover | Export advanced |

---

## 15. Version history & undo

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Undo / redo (session)** | DONE | localStorage + ops | `tests`: `editor-undo.test.ts` | `use-script-composition.ts` | Header |
| **Server version list** | DONE | — | `code` | `script-version-history-panel.tsx`, `GET .../versions` | Shell version history |
| **Restore version** | DONE | — | `code` | `POST .../versions/[id]/restore` | Version panel |
| **Ops revision conflict** | DONE | 409 rebase | `code` | ops route `baseRevision` | Automatic on save |

---

## 16. Settings & preferences

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Editor settings modal** | DONE | Layout, preview, caption defaults | `code` | `script-editor-settings-modal.tsx` | Header Settings |
| **User editor preferences API** | DONE | Persisted | `code` | `GET/PATCH /api/clips/editor-preferences` | Settings modal |
| **Panel layout persistence** | DONE | localStorage | `code` | `panel-layout.ts` | Shell resize |

---

## 17. Export, download, publish output

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Video export (composition)** | **BROKEN** | Worker failures dominate recent jobs | `prod-db`: `RENDER_SCRIPT_COMPOSITION` all-time **FAILED 22**, **DONE 5**, CANCELED 2; 30d same ratio. Recent errors: `cannot access local variable 'download_object' where it is not associated with a value` (2026-10-27 13:50–14:04 UTC); older: `progress() takes 1 positional argument but 2 were given` | `script-export-popover.tsx`, `POST .../export/video`, worker `script_composition_render.py`, `main.py` `handle_script_composition_render` | Export popover → Video |
| **Export progress poll / cancel** | DONE | UI wired | `code` | `GET/DELETE .../export/[renderId]` | Export popover |
| **Audio export** | **BROKEN** | Same job type as video | `prod-db` | export popover | Export → Audio |
| **SRT/VTT export** | **BROKEN** | Same job type | `prod-db` | export popover | Export → Subtitles |
| **Client transcript export (txt/md)** | DONE | No worker | `code` | export popover transcript tab | Export → Transcript |
| **YouTube chapters copy** | DONE | From document | `code` | `chapters-export.ts` | Export popover |
| **Block export while processing** | DONE | `projectStatus` guard | `code` | export popover | Export button disabled |
| **`edlDurationMs` in job settings** | DONE | Server sets from EDL | `code` | `lib/server/clips/composition-export.ts` | Server-side |

---

## 18. Download / exports hub (cross-product)

| Feature | Status | What's missing / known issues | Evidence | Main files | UI entry |
|---------|--------|------------------------------|----------|------------|----------|
| **Global exports page** | MOSTLY DONE | Clip + composition exports mix | `code` | `/app/exports`, `/app/clips/(drive)/exports` | Sidebar **Exports** |
| **Clip export (clipper)** | MOSTLY DONE | B owns; separate from script render | `code` | clip export APIs | Clip editor / grid |

---

## 19. APIs index (composition backend)

All routes under `new-app/app/api/clips/compositions/[compositionId]/`:

| Route | Feature area | Status (code) |
|-------|----------------|---------------|
| `GET/PATCH` composition | Load/patch metadata | DONE |
| `GET/POST ops` | Save document | DONE |
| `GET/POST versions` + restore | History | DONE |
| `export/video`, `export/[renderId]` | Export | BROKEN at worker |
| `clarity`, `chapters`, `retakes` | AI | DONE |
| `music`, `music/suggest`, `sfx`, `studio-sound` | Audio | MOSTLY DONE |
| `comments` | Comments | DONE |
| `share`, `publish`, `social-publish` | Distribution | MOSTLY DONE / STUB social |
| `broll/stock` | Media | MOSTLY DONE |
| `GET .../projects/[id]/script/bootstrap` | Boot | DONE |

---

## 20. Tests & tooling

| Item | Status | Evidence |
|------|--------|----------|
| `editor-undo.test.ts` | DONE | CI |
| `editor-native-controls.test.ts` | DONE | CI |
| `to-editor-words.test.ts`, `editor-words.test.ts` | DONE | CI |
| `test_script_composition_render_storage.py` | DONE | Worker — guards `download_object` shadowing |
| E2E script editor | — | Not listed in inventory; live QA pending |

---

## 21. Feature flag (implemented, default off)

`SCRIPT_EDITOR_ENABLED` / `NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED` (`lib/features/script-editor-enabled.ts`). When off: hides Editor hub, Create→Editor, **Edit transcript**, script-editor card button; redirects `/app/editor`, `/app/clips/[id]/script`, `/app/sw`, `/app/rooms/*` → clips. **Media library** + **layout packs** stay in Shared nav. **Screenwriting** requires script-editor flag. APIs/code remain. Log: `[editor:flag]`.

---

## 22. Out of scope (separate products)

| Surface | Route | Note |
|---------|-------|------|
| Clipper short editor | `/app/clips/[projectId]/edit/[clipId]` | B / regular clipper |
| Streamer | `/app/streamer` | Stream clipper agent |
| AI Video (t2v) | gated off | Paused feature flag |
