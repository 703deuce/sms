# Script editor — build plan

**Status:** **M3** (in progress) — timeline includes **reserved lanes** for scenes strip, overlays, and music (wired in M7–M10). Core M3: ruler, captions stub, wordbar, script track, zoom/split/trim/gaps. **Export deferred to M5.**  
**Product spec:** `docs/clips/script-editor.md` (v1.1 — full Descript-at-launch scope).  
**Owner decisions (2026-10-26):** see §0 “Decisions locked” below. **Scope expansion (2026-10-27):** §0.1.

---

## 0. Decisions locked (owner)

| Topic | Decision |
|-------|----------|
| Source words | Keep pipeline **`ClipWord`** in storage (`w`, `s`, `e`, `p?`, `spk?`, `i?`). Editor uses **`toEditorWords()`** mapping layer. |
| Word ids | Stable, immutable: `` `${sourceMediaId}:${index}` `` where `index` is original transcript order (never re-indexed; corrections change text, not id). |
| Compositions | **v1:** `full` over project source + **`clip`** per `Clip` row; clip doc seeded from source range + existing **`ClipEditsV2`**; save writes back to `Clip.edits` + render path unchanged. |
| Collab | **No Yjs.** Server op log (append-only, idempotent `opId`, snapshot every 200 ops) + **IndexedDB** write-ahead + **single-tab lock** (spec §C2). Multi-user post-launch. |
| Reframe | Keyframes **per composition**, **source time**. Clip comps: import from `cropKey` / `aiMeta` on first open. |
| Reference images | **URLs only** (`script-editor-SOURCES.txt`); do not vendor PNGs. |
| AI rail | **Hidden in v1** (no dead controls). |
| Filler / gaps | Lightweight **enrichment at transcript-ready** (additive JSON fields on stored transcript); **backfill on first editor open** if missing. |
| Launch breadth | **Full Descript-class editor at launch** — everything in spec **§B5** that was “Later” is now **launch-required** (scenes, layouts, markers/chapters, media/B-roll, music, Studio Sound, LLM transcript tools, comments). See §0.1. |
| Still post-launch | **Eye Contact**, **Overdub / Regenerate AI voice**, **Underlord AI chat** — remain with **AI Studio on hold**. |

### 0.1 Launch scope expansion (owner, 2026-10-27)

Former §B5 “Later” items are **launch-required**. Implement in **M7+** after M1–M6; **M2/M3 document + EDL** must stay forward-compatible (reserve tokens and JSON fields; do not break existing `keptWordIds` / gap / split ops).

| Area | Launch deliverable | Milestone |
|------|-------------------|-----------|
| **Scenes** | `/` inserts `sceneBreak`; per-scene aspect, reframe, caption visibility; scene thumbnails in script | **M7** |
| **Layouts** | Layout picker per scene (Descript-style templates) | **M7** |
| **Markers / chapters** | `#` marker token; transport markers dropdown; chapter metadata on export | **M8** |
| **B-roll / media** | Media panel (upload, project clips, **Pixabay** stock); overlays **anchored to words**; overlay lanes on timeline | **M9** |
| **Music** | Music lane: library, fade in/out, auto-duck under speech | **M10** |
| **Studio Sound** | Enhance voice toggle + intensity; CPU worker (**DeepFilterNet** or similar OSS); preview uses processed proxy | **M11** |
| **LLM transcript ops** | Remove retakes, edit-for-clarity, filler/gap removal via **cheap LLM text ops** on transcript (not Underlord chat) | **M12** |
| **Comments** | Comments panel on words/ranges; single editor + lease (no live multi-user) | **M13** |

**Timeline (M3):** ship lane **slots** for scenes strip, **overlay** stack, and **music** now (empty or placeholder until M7–M10), so later work does not reshuffle layout.

---

## 1. Milestones ↔ spec §D

Done = corresponding **§D1** browser tests pass on **transovo.ai** (fixture `test_interview_60s` + 3 h two-speaker fixture). Unit tests support but do not gate.

| Milestone | Goal | §D1 tests | Build order (high level) |
|-----------|------|-----------|---------------------------|
| **M1** | Shell, layout, synced read-only transcript + preview seek | 1–11 | Prisma + APIs (read), `toEditorWords`, enrichment backfill, editor route shell, layout A1–A2, virtualized script (read-only), proxy player seek, panel persistence |
| **M2** | Core text editing + undo | 12–28 | Document model + op log + IndexedDB queue, EDL derive v1, delete/ignore/restore/correct/cut-paste, undo stack, speaker rename |
| **M3** | Timeline | 29–36 | Lanes §B4 incl. **scenes / overlay / music slots**, wordbar, script track, transport, zoom, split/trim/ripple |
| **M4** | Fillers, gaps, captions, reframe, properties | 37–48 | Enrichment UI, filler/gap tools B3, caption panel, reframe, properties §B5 (aspect, captions toggle, volume) |
| **M5** | Save, versions, export, reliability, performance | 49–60 | §C2 save status, versions, export popover §C3 (+ **chapter metadata** when M8 done), render jobs §C5, 3 h perf §C4 |
| **M6** | Transovo integration | 61–66 | Entry from project + clip cards, Library ▸ Editor, shortcuts sheet, no dead controls audit |
| **M7** | Scenes + layouts | 67–72 | `sceneBreak` token, per-scene aspect/reframe/captions, script thumbnails, layout picker |
| **M8** | Markers + chapters | 73–77 | `#` marker, ruler flags, transport dropdown, export chapter tags |
| **M9** | Media + B-roll overlays | 78–84 | Media panel, Pixabay, word-anchored overlays, timeline overlay lanes |
| **M10** | Music lane | 85–88 | Library, lane UI, fades, ducking under speech |
| **M11** | Studio Sound | 89–91 | Worker enhance job, proxy preview, Properties intensity |
| **M12** | LLM transcript tools | 92–95 | Remove retakes, edit-for-clarity, bulk filler/gap (LLM); review + undo |
| **M13** | Comments | 96–98 | Comments panel, anchors to words/ranges, export omit internal notes |

**Visual gate (every milestone):** spot-check **§D2** (20 items) against SOURCES URLs before marking milestone done.

### Suggested sprint breakdown

1. **M1a (data plane):** migration + read APIs + `toEditorWords` + enrichment worker hook + backfill on open.  
2. **M1b (UI shell):** layout regions, loading/empty/error states, read-only sync.  
3. **M2:** op log write path + EDL + editing gestures.  
4. **M3–M6:** core editor + export integration (`clipEditsFromComposition()` mid M2).  
5. **M7–M13:** full Descript-at-launch scope (§0.1); timeline lane slots from M3 avoid rework.

### §D1 tests for M7–M13 (browser; full steps in `script-editor.md`)

| # | Feature | M | One-line acceptance |
|---|---------|---|---------------------|
| 67 | Scene insert | M7 | `/` at cursor → scene boundary + thumbnail in script; duration unchanged |
| 68 | Per-scene aspect | M7 | Scene 2 set to 9:16 → preview crop changes only in that scene |
| 69 | Per-scene captions | M7 | Turn captions off for scene 1 → hidden in preview, on in scene 2 |
| 70 | Scene reframe | M7 | Manual keyframe in scene 2 survives a cut in scene 1 |
| 71 | Layout picker | M7 | Apply layout template to current scene → canvas matches preset |
| 72 | Scene strip | M7 | Timeline scenes strip shows numbered thumbs aligned to scene starts |
| 73 | Marker insert | M8 | `#` at word → marker flag on ruler + entry in markers dropdown |
| 74 | Marker seek | M8 | Pick marker in transport dropdown → playhead jumps |
| 75 | Chapter export | M8 | Export video with chapters → file has chapter markers at flagged markers |
| 76 | Marker rename | M8 | Edit marker label → persists after reload |
| 77 | Marker delete | M8 | Delete marker → removed from ruler and export metadata |
| 78 | Media panel upload | M9 | Upload image → appears in Media panel; drag to word creates overlay |
| 79 | Project clip media | M9 | Insert project clip as overlay anchored to word → moves when words move |
| 80 | Pixabay stock | M9 | Search Pixabay, insert stock video → overlay lane clip + preview |
| 81 | Overlay trim | M9 | Drag overlay edges on timeline → duration changes, anchor word unchanged |
| 82 | Overlay delete | M9 | Delete overlay → lane and preview clear; script unchanged |
| 83 | Multi overlay lanes | M9 | Two overlays on different layers → both visible, selectable |
| 84 | Overlay export | M9 | Export MP4 → overlays composited like preview |
| 85 | Music insert | M10 | Add track from library → music lane clip, audible on play |
| 86 | Music fade | M10 | Fade in/out handles → smooth audibility at edges |
| 87 | Ducking | M10 | Duck under speech on → music lowers during dialogue |
| 88 | Music export | M10 | Export MP3/MP4 includes music mix with ducking |
| 89 | Studio Sound job | M11 | Enable enhance → job runs; status in Properties |
| 90 | Studio Sound preview | M11 | When proxy ready, preview plays enhanced speech at set intensity |
| 91 | Studio Sound export | M11 | Export uses enhanced audio when toggle on |
| 92 | Remove retakes | M12 | LLM tool finds retake block → review → delete applies as cut ops |
| 93 | Edit for clarity | M12 | Suggest shorter phrasing → accept updates text + keeps media mapping |
| 94 | LLM filler pass | M12 | Bulk filler suggestion → Remove all uses one undo step |
| 95 | LLM undo | M12 | One undo after LLM bulk → full revert |
| 96 | Comment on word | M13 | Add comment on word → pin visible in panel |
| 97 | Comment on range | M13 | Select range → comment → shows span in panel |
| 98 | Comments not in export | M13 | Export video/SRT → comment text absent |

---

## 2. Domain model (maps spec §B1 → codebase)

### 2.1 Storage layers

```
ClipProject.transcriptWords     → ClipWord[] (+ additive enrichment fields)
ClipProject.transcriptKey       → same JSON in object storage (canonical for worker)
Clip.wordsKey                   → per-clip word slice (legacy; editor uses project transcript + range)
Clip.edits                      → ClipEditsV2 (trim, cutRanges, wordFixes, captions, layout, …)
ScriptComposition (new)         → document + revision + reframe + caption refs
ScriptCompositionOp (new)       → append-only ops
ScriptCompositionSnapshot (new) → every 200 ops
ScriptCompositionVersion (new)  → checkpoints §C2
ScriptCompositionLease (new)    → single-editor lock
ScriptSpeaker (new)             → project-level speaker names/colors
ScriptMediaAsset (new)          → proxy HLS, peaks, sprite URLs per project source
```

### 2.2 `toEditorWords()` (TypeScript)

**Input:** `sourceMediaId` (see below), `ClipWord[]` from project transcript.  
**Output:** `EditorWord[]`:

```ts
type EditorWord = {
  id: string              // `${sourceMediaId}:${i}` — i from original order, not array position after edits
  index: number           // same as i (immutable)
  t0Ms: number            // Math.round(s * 1000) or existing ms if we add ms fields later
  t1Ms: number
  text: string            // w
  conf?: number           // from ASR when present
  speakerId: string       // `spk:${n}` default or mapped ScriptSpeaker.id
  isFiller?: boolean
  fillerKind?: 'lexicon' | 'repeat' | 'silence'
  gapBeforeMs?: number    // enrichment: long pause before this word
}
```

**Rules:**

- `sourceMediaId` = `clip_upload:{uploadId}` or `import:{projectId}` (stable for life of project).  
- Never reassign `id` when tokens are deleted/restored; document tokens reference `wordId`.  
- Enrichment fields are **additive** on stored JSON: `{ w, s, e, i, spk?, isFiller?, fillerKind?, gapBeforeMs? }`.

### 2.3 Document tokens (in-memory + snapshot JSON)

Align with spec §B1 `Token` kinds. Persist as JSON array or run-length runs in snapshot:

- `word` → `wordId`, `ignored`, `textOverride?`, `speakerOverride?`  
- `gap` → `gapMs`  
- `paraBreak` / `speakerChange` (speakerChange may reference `speakerOverride`)  
- **`sceneBreak`** (M7) → optional `sceneId`, thumbnail time in source ms  
- **`marker`** (M8) → `markerId`, label, chapter export flag  
- Removed source ranges stored in **boundary map** (for restore): keyed by boundary id between kept tokens.

**Parallel JSON on `ScriptDocumentV1` (M3+ compatible; EDL ignores until milestone ships):**

```ts
type WordAnchoredOverlay = {
  id: string
  anchorWordId: string        // moves with text edits via word id
  mediaAssetId: string        // upload | project clip | pixabay ref
  outOffsetMs: number         // relative to anchor word output start
  durMs: number
  layer: number
}
type MusicClip = {
  id: string
  assetId: string
  outStartMs: number
  durMs: number
  fadeInMs?: number
  fadeOutMs?: number
  duckUnderSpeech?: boolean
}
// document.overlays?: WordAnchoredOverlay[]
// document.musicTracks?: MusicClip[]
// document.scenes?: { id, startWordId, layoutId?, aspect?, reframe?, captionsVisible? }[]
// document.markers?: { id, outMs, label, exportAsChapter? }[]
```

**Piece table / B-tree:** client-only structure for perf (§C4); server stores snapshot + ops, not the tree.

### 2.4 EDL (derived, pure)

Package: `new-app/lib/clips/script-edl/` (new).

```ts
type EdlSegment =
  | { kind: 'source'; srcInMs: number; srcOutMs: number; outInMs: number; outOutMs: number }
  | { kind: 'gap'; durMs: number; freezeSrcMs: number }

function deriveEdl(document: Document, wordsById: Map<string, EditorWord>, opts?: { padMs: number }): EdlSegment[]
function outputTimeToSourceMs(tOut: number, edl: EdlSegment[]): number | null
function sourceMsToOutputTime(tSrc: number, edl: EdlSegment[]): number | null
```

Implement spec §B1 rules (80 ms pad, gap segments, contiguous merge). **Unit-test heavy** — same module used by preview, timeline, captions, and export bridge.

### 2.5 Bridge: composition → `ClipEditsV2` (clip kind only)

`clipEditsFromComposition(document, edl, words, existingEdits, clipBounds)` → `ClipEditsV2`:

| Editor concept | `ClipEditsV2` field |
|----------------|---------------------|
| Trim to composition range | `trim.in` / `trim.out` (absolute source ms) |
| Deleted word ranges | `cutRanges` (merged, absolute ms) |
| Correct | `wordFixes[indexKey]` using **stable index** `i` (matches render pipeline `wordFixes[String(l.i)]`) |
| Captions | `captions.*` |
| Reframe | `layout` + optional future extension for manual keyframes stored on composition |
| Ignored words | EDL skip + optional explicit cuts only when “ignore” implies skip in export (spec: skip playback — map to cuts or export-time filter; **default:** treat as EDL-excluded, not additional `cutRanges` unless export requires) |

**Full composition** does not write `Clip.edits` until user exports a sub-range or “update clip” action; it persists only on `ScriptComposition`.

---

## 3. Prisma models (draft — additive migration, **do not apply** until clipper gate)

Migration name (planned): `20261027000000_script_editor_compositions`

```prisma
enum ScriptCompositionKind {
  FULL
  CLIP
}

model ScriptMediaAsset {
  id          String   @id
  projectId   String   @unique
  workspaceId String
  durationMs  Int
  fps         Float?
  sourceKey   String   // clip_uploads.key
  proxyHlsKey String?
  audioPeaksKey String?
  thumbsSpriteKey String?
  enrichedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project ClipProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("script_media_assets")
}

model ScriptSpeaker {
  id          String   @id
  projectId   String
  workspaceId String
  label       String   // "Speaker 1" default
  color       String   // hex token
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project ClipProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, label])
  @@index([projectId])
  @@map("script_speakers")
}

model ScriptComposition {
  id            String                @id
  projectId     String
  workspaceId   String
  kind          ScriptCompositionKind
  clipId        String?               // set when kind = CLIP
  title         String
  revision      Int                   @default(0)
  aspect        String                @default("9:16")
  captionStyleId String?
  captionPos    Json?
  reframe       Json                  @default("{}") // keyframes in source ms
  document      Json?                 // latest snapshot (denormalized cache)
  deletedAt     DateTime?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt

  project ClipProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  clip    Clip?       @relation(fields: [clipId], references: [id], onDelete: Cascade)
  ops     ScriptCompositionOp[]
  snapshots ScriptCompositionSnapshot[]
  versions ScriptCompositionVersion[]
  leases  ScriptCompositionLease[]

  @@unique([projectId, kind, clipId])
  @@index([workspaceId, updatedAt])
  @@map("script_compositions")
}

model ScriptCompositionOp {
  id              String   @id // client opId (uuid v7)
  compositionId   String
  revision        Int      // server revision after apply
  baseRevision    Int
  op              Json
  createdAt       DateTime @default(now())
  createdByUserId String?

  composition ScriptComposition @relation(fields: [compositionId], references: [id], onDelete: Cascade)

  @@unique([compositionId, id])
  @@index([compositionId, revision])
  @@map("script_composition_ops")
}

model ScriptCompositionSnapshot {
  id            String   @id
  compositionId String
  revision      Int
  document      Json
  createdAt     DateTime @default(now())

  composition ScriptComposition @relation(fields: [compositionId], references: [id], onDelete: Cascade)

  @@unique([compositionId, revision])
  @@map("script_composition_snapshots")
}

model ScriptCompositionVersion {
  id            String   @id
  compositionId String
  revision      Int
  name          String?
  auto          Boolean  @default(false)
  document      Json
  meta          Json?    // durationMs, wordCount, deltaWords
  createdAt     DateTime @default(now())
  createdByUserId String?

  composition ScriptComposition @relation(fields: [compositionId], references: [id], onDelete: Cascade)

  @@index([compositionId, createdAt])
  @@map("script_composition_versions")
}

model ScriptCompositionLease {
  id            String   @id
  compositionId String   @unique
  holderId      String   // client instance id
  expiresAt     DateTime
  updatedAt     DateTime @updatedAt

  composition ScriptComposition @relation(fields: [compositionId], references: [id], onDelete: Cascade)

  @@map("script_composition_leases")
}

// Optional: composition-scoped export (full-video export); clip exports keep using clip_renders
model ScriptCompositionRender {
  id               String   @id
  compositionId    String
  workspaceId      String
  status           String   @default("QUEUED")
  idempotencyKey   String
  resolution       String
  aspectRatio      String
  settings         Json
  outputKey        String?
  error            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  composition ScriptComposition @relation(fields: [compositionId], references: [id], onDelete: Cascade)

  @@unique([compositionId, idempotencyKey])
  @@index([workspaceId, status])
  @@map("script_composition_renders")
}
```

**`ClipProject` relation additions (draft):**

```prisma
  scriptMediaAsset ScriptMediaAsset?
  scriptSpeakers   ScriptSpeaker[]
  scriptCompositions ScriptComposition[]
```

**Indexes / constraints notes:**

- One `FULL` composition per project (enforce in app on create).  
- `CLIP` composition 1:1 with `clipId`.  
- Soft-delete compositions → `deletedAt` (30-day trash per spec §C5).

---

## 4. API routes (Next.js `app/api`)

Base: `/api/clips/script/...` (workspace-scoped via existing auth).

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/projects/[projectId]/script/bootstrap` | Project source URL, proxy/peaks/sprite status, speakers, list compositions, transcript metadata (word count, enriched?) |
| POST | `/projects/[projectId]/script/compositions` | Lazy-create `FULL` or `CLIP` (body: `{ kind, clipId? }`) |
| GET | `/compositions/[compositionId]` | Composition + document snapshot + revision + lease holder |
| POST | `/compositions/[compositionId]/ops` | Batch apply ops (idempotent `opId`), return `{ revision, ackedOpIds }` |
| GET | `/compositions/[compositionId]/ops?afterRevision=` | Catch-up for second device / recovery |
| POST | `/compositions/[compositionId]/lease` | Acquire / renew / release single-tab lock |
| POST | `/compositions/[compositionId]/lease/takeover` | Force takeover |
| GET | `/compositions/[compositionId]/versions` | List versions |
| POST | `/compositions/[compositionId]/versions` | Manual checkpoint |
| POST | `/compositions/[compositionId]/versions/[versionId]/restore` | Restore → new revision |
| POST | `/compositions/[compositionId]/sync-to-clip` | **CLIP only:** persist `clipEditsFromComposition` → `Clip.edits`, bump clip `updatedAt` |
| POST | `/compositions/[compositionId]/export/video` | Enqueue render (composition render or linked clip render) |
| GET | `/compositions/[compositionId]/export/[renderId]` | Poll status + signed URL |
| POST | `/projects/[projectId]/script/enrich` | Idempotent enrichment trigger (if transcript ready but `enrichedAt` null) |

**Internal / worker**

| Route | Purpose |
|-------|---------|
| POST `/api/internal/script/enrich` | HMAC: run filler/gap pass, write transcript JSON + `ScriptMediaAsset.enrichedAt` |
| POST `/api/internal/script/media` | Generate proxy HLS, peaks, sprite (chunked jobs, lease heartbeat) |

**Hooks into existing clipper pipeline**

- After `transcriptWords` persisted (progress route or worker end of transcribe): enqueue **`SCRIPT_ENRICH`** job (new `clip_jobs.type`, low priority).  
- On editor bootstrap: if enrichment missing, call enrich inline (small VOD) or enqueue + show “Analyzing fillers…” skeleton.

---

## 5. UI component tree (layout §A)

Route (align spec §C6 with existing clips URLs):

- `/app/clips/[projectId]/script` — **full** composition (spec `/app/projects/:id/edit`)  
- `/app/clips/[projectId]/script/[compositionId]` — explicit id (clip comp)  
- Deep link: `?t=123.4` → output time seconds  

```
app/app/clips/[projectId]/script/[[...composition]]/page.tsx   (server: load bootstrap, pass props)

components/script-editor/
  script-editor-page.tsx          // client root, providers
  script-editor-shell.tsx         // grid: regions [1]–[6]
  script-editor-top-bar.tsx       // [1] back, undo/redo, save status, breadcrumb, export, help (no AI)
  script-editor-layout.tsx        // split panes + drag handles (A2)
  script-editor-rail.tsx          // [6] icons: Properties, Captions, Edit tools, Versions (no AI)
  script-panel-host.tsx           // [5] drawer / side panel

  script/
    script-editor-panel.tsx       // [2] toolbar + virtualized column
    script-paragraph.tsx
    script-word.tsx               // playhead class via ref, not React state per frame
    script-selection-toolbar.tsx
    script-find-bar.tsx
    script-filler-review-bar.tsx  // M4
    script-states.tsx             // loading / empty / error / retry

  preview/
    preview-canvas.tsx            // [3] letterbox + captions overlay (reuse caption renderer)
    preview-pill-bar.tsx          // aspect, reframe, captions toggle
    preview-player.tsx            // dual-video A/B + WebAudio crossfade (M1 fallback: single video)

  transport/
    transport-bar.tsx             // [4a]
    timeline/
      timeline-panel.tsx          // [4b] collapse handle
      timeline-ruler.tsx
      timeline-captions-lane.tsx
      timeline-wordbar.tsx
      timeline-script-track.tsx   // thumbs + waveform

  side/
    properties-panel.tsx
    captions-panel.tsx            // reuse Transovo preset cards
    edit-tools-panel.tsx          // filler + shorten gaps
    versions-panel.tsx

  export/
    export-popover.tsx            // tabs Video / Audio / Subtitles / Transcript
    export-progress-inline.tsx

  hooks/
    use-composition-document.ts
    use-edl.ts
    use-op-log-sync.ts            // IndexedDB + 500ms batch + offline backoff
    use-editor-lease.ts           // BroadcastChannel + server lease
    use-playhead-sync.ts
    use-layout-persistence.ts     // localStorage per user

  state/
    document-store.ts             // undo stack (one per composition)
    edl-worker-client.ts          // optional Web Worker for search/SRT
```

**Existing code to reuse**

- `components/clips/editor/caption-overlay.tsx`, caption presets  
- `lib/clips/edits.ts` (`keepSegments`, `remapTime`, caption word export patterns)  
- `lib/clips/format.ts`, design tokens / `Panel`, `PageHeader`  
- Do **not** reuse screenwriting Yjs workspace.

---

## 6. EDL & render integration

### 6.1 Preview (client)

1. `deriveEdl(document, wordsById)` on each document revision (incremental optimization §C4).  
2. Player maps **output time** → active segment → **source time** → `video.currentTime`.  
3. Captions: map kept words through EDL to output times; use `textOverride ?? text`.  
4. Reframe: composition `reframe` JSON in source ms → crop rect per frame (clip: seed from `cropKey` on first open).

### 6.2 Clip export (existing `RENDER_CLIP`)

**Flow for `kind === CLIP`:**

1. On save (debounced) or explicit sync: `clipEditsFromComposition()` → `prisma.clip.update({ edits })`.  
2. Export popover calls existing `enqueueRenderClip()` with normalized edits.  
3. **Idempotency:** keep `editsVersionHash` + `renderVersionHash` (`lib/clips/edits.ts`, `lib/clips/export-aspect.ts`).  
4. Composition revision at export click stored on `ClipRender` or new `ScriptCompositionRender` row for audit.

**Worker:** no change to ffmpeg graph initially — worker already consumes `ClipEditsV2` + words. Verify **ignored words** and **gap segments** match preview after bridge tests.

### 6.3 Full-composition video export

1. Either temporary **synthetic clip** row (hidden) spanning full trim, or new job type **`RENDER_COMPOSITION`** with payload `{ compositionId, revision, edl, reframe, captionStyle }`.  
2. Prefer **phase 1:** create/update a dedicated `Clip` (“Full export”) linked to composition, reuse `RENDER_CLIP`.  
3. **Idempotency key:** `sha256(compositionId + revision + exportSettings)` per spec §C5.  
4. Long renders: chunked segments in worker (future); M5 test 55 — reuse clipper lease/reaper patterns (`job-reliability.ts`).

### 6.4 Subtitles / transcript export

- **SRT/VTT/TXT:** client-side from EDL + tokens (spec: instant, no job).  
- Validate against `buildSrt` / export paths in `lib/clips/edits.ts` for parity.

### 6.5 Tests (required before each milestone merge)

| Area | Tests |
|------|--------|
| `toEditorWords` | stable ids, enrichment fields |
| `deriveEdl` | pad, gaps, ignore, restore boundaries (fixtures from spec B2.15) |
| `clipEditsFromComposition` | round-trip with worker caption word export (`lib/server/clips/...` export tests) |
| Op log | idempotent replay, snapshot at 200, stale `baseRevision` |
| API | op batch, lease takeover |

---

## 7. Transcript enrichment (spec §B3 + owner #8)

**When:** `SCRIPT_ENRICH` after transcript ready (worker or web internal).

**Algorithm (v1, English):**

- Lexicon + isolation rules from spec §B3.  
- Repeated words, silence gaps > 750 ms default.  
- Write **additive** fields onto each word object in `transcriptWords` + storage JSON.  
- Set `ScriptMediaAsset.enrichedAt`.

**Editor open:** if `!enrichedAt`, run enrich in API (sync for < 5 min audio) or show skeleton + poll.

---

## 8. Reliability checklist (editor-specific)

Mirror clipper lessons (spec §C5):

- Job types: `SCRIPT_ENRICH`, `SCRIPT_MEDIA_PROXY`, `RENDER_*` — all use `clip_jobs` lease + `reapStaleJobs()`.  
- UI: no non-terminal state > timeout without Retry/Cancel (reuse `ProjectFailedAlert` patterns).  
- Render: always expose job id + idempotency key in UI for support.

---

## 9. Files to create (implementation checklist)

| Path | Milestone |
|------|-----------|
| `new-app/prisma/migrations/20261027000000_script_editor_compositions/migration.sql` | M1 (apply after gate) |
| `new-app/lib/clips/editor-words.ts` | M1 |
| `new-app/lib/clips/script-edl/*` | M2 |
| `new-app/lib/clips/composition-to-edits.ts` | M2 |
| `new-app/lib/server/clips/script/*` | M1 |
| `worker/clips_worker/script_enrich.py` | M1 |
| `components/script-editor/**` | M1+ |

---

## 10. References

- Spec: `docs/clips/script-editor.md`  
- Screenshots: `docs/clips/script-editor-SOURCES.txt`  
- Roadmap: `docs/ROADMAP.md`  
- Clipper EDL today: `new-app/lib/clips/edits.ts` (`keepSegments`, `remapTime`, `editsVersionHash`)  
- Render enqueue: `new-app/lib/server/clips/renders.ts`
