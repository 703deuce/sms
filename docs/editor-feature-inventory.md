# Editor product feature inventory (Descript-style)

**Scope:** Whole editor product under sidebar **Editor** (`resolveActiveSidebarSection` → `editor`), not the clipper short-form editor (`/edit/[clipId]`).

**Status legend:** **Working** = wired end-to-end in code with tests or clear happy path · **Partial** = UI/API exists, known gaps · **Broken** = missing route, dead API, or wrong UX · **N/A** = gated/off or out of lane.

*Last reviewed: 2026-10-27 (code audit; live QA pending Rick’s pass).*

---

## 1. Navigation & hub

| Feature | Route / entry | API / server | Status | Notes |
|--------|----------------|--------------|--------|-------|
| Editor hub (project list) | `/app/editor` | `getClipsDriveProjects` | **Working** | Shows processing + ready; auto-refresh while processing |
| Sidebar: Editor hub | `app-sidebar` → Editor | — | **Working** | |
| Sidebar: Media library | `/app/clips/media` | `listMediaLibraryUploads` | **Working** | Uploads list + create/open script projects |
| Sidebar: Layout packs | `/app/clips?view=layouts` | brand templates | **Partial** | Drive view; not editor-specific |
| Sidebar: Rooms (record) | `/app/rooms`, `/app/rooms/new` | LiveKit/recording APIs | **Partial** | Gated by `FEATURE_SCRIPT_RECORDING` + LiveKit |
| Sidebar: Screenwriting | `/app/sw` | `/api/sw/*` | **Working** | Separate screenplay product; AI → gpt-6-luna (`7805e11e4`) |
| Create menu → Editor | `/app/editor` | — | **Working** | |
| Projects library (Clips nav) | `/app/clips` | `/api/clips/projects` | **Working** | Shared with clipper drive |

---

## 2. Project creation & import

| Feature | Route / UI | API | Status | Notes |
|--------|------------|-----|--------|-------|
| New upload project | `/app/clips/new` | `POST /api/clips/projects`, uploads | **Working** | Shared create flow |
| Editor empty state import | `ScriptEmptyImport` | `POST /api/clips/projects/[id]/media` | **Working** | Links to media library; transcribing poll via `ScriptEditorTranscribing` |
| Link import | empty import | same media API | **Partial** | YouTube blocked by import-url rules (by design) |
| Media library pick | `/app/clips/media` | `ClipUpload` list | **Working** | Attach via new project → script |
| Record new | `/app/rooms/new` | rooms stack | **Partial** | Not embedded in editor shell |
| Rooms take import | `/app/rooms` | upload → project | **Partial** | Manual path |
| Script bootstrap | `ScriptEditorEntry` | `GET .../script/bootstrap` | **Working** | Composition + words + signed video URL |
| Attach media to existing project | empty import | `projects/[id]/media` | **Working** | Same-origin auth via `assertDevApiAccess` |

---

## 3. Transcription & speakers

| Feature | UI | API / worker | Status | Notes |
|--------|-----|--------------|--------|-------|
| Transcription pipeline | `ScriptEditorTranscribing` | `getProjectStatus` + bootstrap | **Working** | Poll until words ready; `[editor:transcribe]` |
| Speaker labels / blocks | `script-editor-shell`, `groupSpeakerBlocks` | `script-enrich`, bootstrap | **Partial** | Depends on diarization in transcript |
| Speaker rename | `speaker-rename-popover` | composition ops | **Working** | Ops path |
| Enriched transcript | bootstrap `enrichedAt` | `ensureProjectTranscriptEnriched` | **Partial** | Needs live verify |

---

## 4. Main editor shell (`/app/clips/[projectId]/script`)

| Feature | Component | API | Status | Notes |
|--------|-----------|-----|--------|-------|
| Editor page | `script/page.tsx` → `ScriptEditorEntry` | bootstrap | **Working** | T2V stale banner when `sourceKind=t2v` |
| Shell / preview / transport | `script-editor-shell` | composition ops | **Working** | Large surface; needs live QA |
| Composition switcher (full vs clip) | `script-composition-switcher` | bootstrap `clipId` | **Working** | |
| Save / undo / redo | `use-script-composition` | `POST .../compositions/[id]/ops` | **Working** | Persisted undo in localStorage |
| Saving indicator | shell header | ops | **Working** | `saved` / `saving` / `error` |
| Settings modal | `script-editor-settings-modal` | `editor-preferences` | **Working** | |
| Shortcuts | `script-shortcuts-sheet` | — | **Working** | |
| Keyboard / descript shortcuts | `descript-shortcuts.ts` | — | **Partial** | Needs QA |

---

## 5. Side rail panels

| Tab | Panel | API | Status | Notes |
|-----|-------|-----|--------|-------|
| Project | `script-project-panel` | bootstrap metadata | **Working** | |
| Edit tools | `script-edit-tools-panel` | — | **Working** | Filler / gaps / retakes tabs |
| Properties | `script-properties-panel` | ops | **Working** | |
| Elements | `script-elements-panel` | ops | **Partial** | |
| Layouts | `script-layouts-panel` | `/api/clips/brand/templates` | **Partial** | |
| Captions | `script-captions-panel` | document settings | **Working** | |
| Media / B-roll | `script-media-panel` | `.../broll/stock` | **Partial** | Stock search; overlaps clipper broll API |

**Also in shell (not rail):** Comments, Markers, Storyboard, Multicam, Clarity, Audio, AI tools, Version history, Export, Share.

---

## 6. Text-based editing

| Feature | UI | Mechanism | Status | Notes |
|--------|-----|-----------|--------|-------|
| Word delete → cut video | transcript + toolbar | EDL ops `cut` | **Working** | Core Descript model |
| Selection toolbar | `script-selection-toolbar` | ops | **Working** | |
| Filler words | `script-filler-review-bar`, edit tools | `filler-hits` + ops | **Working** | |
| Shorten gaps | `script-shorten-gaps-panel` | gap ops | **Working** | |
| Retakes (AI detect) | `script-retakes-panel` | `POST .../retakes` | **Working** | gpt-6-luna (`7805e11e4`) |
| Retake apply | shell | ops | **Partial** | QA apply path |
| Context menu | `script-transcript-context-menu` | ops | **Working** | |
| Clarity rewrite | `script-clarity-panel` | `.../clarity` | **Working** | Luna + `[editor:clarity]` |

---

## 7. Timeline & scenes

| Feature | Component | Status | Notes |
|--------|-----------|--------|-------|
| Timeline panel | `timeline-panel` | **Working** | Ruler, word bar, music, overlays, captions lane |
| Scenes strip | `timeline-scenes-strip` | **Partial** | |
| Markers | `timeline-markers-lane`, slash menu | **Working** | |
| Playhead sync | `sync-playhead`, follow mode | **Working** | |
| Multicam | `script-multicam-panel` | **Partial** | |
| Storyboard | `script-storyboard-panel` | **Partial** | |

---

## 8. Captions & subtitles

| Feature | UI | Export | Status | Notes |
|--------|-----|--------|--------|-------|
| Caption styles / burn | `script-captions-panel`, overlay | export settings `burnCaptions` | **Working** | |
| Caption overlay preview | `script-caption-overlay` | — | **Working** | |
| SRT/VTT export | `script-export-popover` | `exportKind` srt/vtt | **Partial** | Worker `RENDER_SCRIPT_COMPOSITION` |
| Subtitle track | export settings | `includeSubtitleTrack` | **Partial** | |

---

## 9. AI actions

| Feature | Route | Model | Status | Notes |
|--------|-------|-------|--------|-------|
| Chapters | `.../chapters` | gpt-6-luna | **Working** | `7805e11e4` |
| Music suggest | `.../music/suggest` | gpt-6-luna | **Working** | |
| SW script AI kinds | `/api/sw/scripts/[id]/ai/[kind]` | gpt-6-luna | **Working** | assist, coverage, etc. |
| AI tools panel | `script-ai-tools-panel` | chapters | **Working** | |

---

## 10. Audio

| Feature | UI | API | Status | Notes |
|--------|-----|-----|--------|-------|
| Studio Sound | `studio-sound-preview`, audio panel | `.../studio-sound` | **Partial** | Enqueues generation job |
| Music bed | `script-audio-panel` | `.../music`, MUSIC worker | **Partial** | |
| SFX | audio panel | `.../sfx` | **Partial** | |
| Levels / VU | `script-vu-meter` | preview audio | **Partial** | |

---

## 11. Comments, share, publish

| Feature | UI | API | Status | Notes |
|--------|-----|-----|--------|-------|
| Comments threads | `script-comments-panel` | `.../comments` | **Working** | Mentions → `workspace-members` |
| Timeline pins | `timeline-comment-pins` | comments | **Working** | |
| Share / access | `script-project-access-modal` | `.../share` | **Working** | |
| Public share viewer | `/share/clips/[linkId]` | public API | **Partial** | |
| Publish | export popover | `.../publish` | **Partial** | |
| Social publish | export popover | `.../social-publish` | **Partial** | Feature-flagged |

---

## 12. Version history

| Feature | UI | API | Status | Notes |
|--------|-----|-----|--------|-------|
| Version list / restore | `script-version-history-panel` | `.../versions` | **Working** | |
| Server revision | ops `baseRevision` | ops route | **Working** | 409 rebase |

---

## 13. Export & download

| Feature | UI | API / worker | Status | Notes |
|--------|-----|--------------|--------|-------|
| Video export | `script-export-popover` | `.../export/video` → `RENDER_SCRIPT_COMPOSITION` | **Partial** | `edlDurationMs` in settings; needs prod QA |
| Export poll / cancel | export popover | `export/[renderId]` | **Working** | |
| Audio / text exports | export popover | same render job | **Partial** | |
| Download URL | export popover | signed URL | **Partial** | |

---

## 14. Composition API index (editor backend)

| Path | Purpose |
|------|---------|
| `GET/PATCH /api/clips/compositions/[id]` | Load metadata |
| `GET/POST /api/clips/compositions/[id]/ops` | Save / undo document |
| `GET/POST /api/clips/compositions/[id]/versions` | History |
| `POST .../export/video`, `GET/DELETE .../export/[renderId]` | Export |
| `.../clarity`, `chapters`, `retakes`, `music`, `music/suggest`, `sfx`, `studio-sound` | AI / audio |
| `.../comments`, `.../share`, `.../publish`, `.../social-publish` | Collab |
| `.../broll/stock` | Stock media search |
| `GET /api/clips/projects/[id]/script/bootstrap` | Editor boot |
| `GET/PATCH /api/clips/editor-preferences` | User prefs |
| `GET /api/clips/workspace-members` | Comment mentions |

---

## 15. Fix priority (user journey)

1. Export duration/errors — live test (Rick).
2. Recording → editor handoff (rooms upload → script).
3. Partial panels (elements, layouts, multicam, storyboard) — live QA.
4. Audio (studio sound, music, SFX) — job + preview QA.
5. Share/publish/social — feature flags + prod verify.

---

## Out of lane (do not treat as editor bugs)

- Clipper `/app/clips/[id]/edit/[clipId]` and clip `broll`/`thumbnail` APIs.
- Streamer `/app/streamer`.
- AI Video (`t2v`) — paused behind feature flag (`c9a9f4a4a`).
