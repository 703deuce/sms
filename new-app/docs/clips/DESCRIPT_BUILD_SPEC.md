# Transovo: Descript-parity build spec (D1 to D9)

**Repo:** `703deuce/sms` (`new-app/` Next.js 16.4.3 + root `prisma/schema.prisma` (Prisma 6.19.3) + `worker/clips_worker/main.py`) · **Written:** Mon Oct 26 2026 (America/New_York)
**Source of scope:** Descript Product Map canvas `3755cb1f-81a0-454c-b8a7-c83b6e186a1f` (local copy `/workspace/agent-tools/4d36562c-d20e-4c3c-99e0-17c0c4e9fd0b.txt`).
**Prerequisite:** `/workspace/plan/ui_polish_spec.md` is merged first. This spec assumes its sidebar, `PageHeader`, kit and tokens.

---

## 0. Ground rules (apply to every milestone)

### 0.1 Scope
| In scope (build) | OUT of scope (do not build, do not stub UI for) |
|---|---|
| Long-form editor, transcript tools, multitrack, markers/chapters, long-form performance, project-wide AI Producer | **Timeline export to NLEs** (FCPXML / Premiere XML / AAF / Pro Tools / Resolve). *Normal MP4, GIF, WAV/MP3 and SRT/VTT/TXT/DOCX/MD exports stay in scope* |
| Voice: Studio Sound, loudness and room tone, TTS, voice clone with consent, Regenerate, Convert to AI speech | Lip sync for dubbed video, AI avatars (both are built on lip-sync) |
| AI text tools, skills/prompt templates, chapters, images/thumbnails, captions animations, stock, translate, dub proofread, Brand Studio basics, audiograms, audio-only | Team drives, invites, roles, SSO/SCIM |
| **Recording, all of it:** solo screen+camera, slides mode, teleprompter + async request links, Rooms remote multi-guest, Rooms production tools, recording → project with auto-transcription | Screenwriting / script generator ("Write") |
| Scenes compositor, transitions, color/effects, layout packs, Quick Design, multiple compositions, multicam, green screen | AI video studio (text-to-video maker). *Wan 3.0 AI B-roll that already exists stays* |
| Comments on transcript/timeline, web share pages (hosted player link) | Social publishing (YouTube/LinkedIn/podcast host upload), marketing pages |
| | **Auth, sign-in, credits, metering, Stripe, billing: deferred.** Every route uses `resolveWorkspaceId()` from `lib/server/workspace.ts` (the existing stub). No route may require a session. |

Deferred items stay unbuilt, with no vendor and no stub UI ("later / maybe never" in the map). These are Eye Contact, smooth jump cuts, Portrait Lighting / skin smoothing, simultaneous co-editing (CRDT), public API/MCP/Zapier, desktop app, and mobile app. They are listed in §11 so nobody builds them by accident.

### 0.2 Engineering rules
1. **Prisma migrations are additive only.** Allowed: new models, new nullable columns, new columns with defaults, new enum values appended at the end, and new indexes. Forbidden: renames, drops, type changes and `NOT NULL` without a default. Create each migration with `pnpm prisma migrate dev --name dN_<slug> --create-only`, review the SQL for `DROP`/`ALTER ... TYPE`, and only then apply it.
2. **Worker job types.** `ClipJob.type` values are claimed in `worker/clips_worker/main.py`. **Every new type must be added in 3 places:**
   - the type list in `count_queued_jobs()`;
   - the type list in `claim_job()`;
   - the dispatch `if/elif` (or dict) that maps type to handler.
   
   Progress is posted to `POST /api/internal/jobs/{id}/progress` (the existing route). The reaper stays as is (5 min stale, `attempts < 3`). Add a unit test `worker/tests/test_job_types.py` asserting that the three sets are equal: `assert set(COUNT_TYPES) == set(CLAIM_TYPES) == set(DISPATCH.keys())`. If the lists are inline literals today, first refactor them into one module-level `JOB_TYPES` tuple (behaviour-neutral) in commit D1.0.
3. **Long jobs go to the worker; short vendor calls (under 10 s) may run in the route** (e.g. TTS of one sentence, an LLM text tool). Anything that touches ffmpeg runs in the worker.
4. **Every new editing capability is a reducer action** in `lib/clips/edits-reducer.ts`: extend the `ProducerToolName` union, implement it in `applyProducerTool`, add a JSON-schema tool definition where the Producer's tools are declared, and mark it in `pendingPaid` if it calls a paid vendor. This lets the AI Producer drive each feature on day one.
5. **Edits schema.** `ClipEditsV2` (`lib/clips/edits.ts`, `v:2`) gains **optional** keys only. `normalizeEdits()` fills defaults, so old rows keep loading. Do not bump `v` unless a key changes meaning. `editsVersionHash` automatically covers the new keys, so check the render cache key in a test.
6. **Secrets.** Read env vars server-side only, and never log them. The client gets only `NEXT_PUBLIC_*` values (the LiveKit **URL** is public; keys are not).
7. **No price is hard-coded.** Paid-action cost labels come from config (`lib/config/costs.ts`, all `null` = "cost shown later") until billing exists. Vendor prices are only quoted below where they were read on the vendor's page on 2026-10-26.
8. **Tests.** `vitest` covers reducers, serializers and route handlers (with vendor fetch mocked via `msw` or `vi.fn`). `pytest` covers worker handlers with ffmpeg on tiny fixtures in `worker/tests/fixtures/`. `playwright` covers one happy path per milestone on port 3100. Each milestone ends with `pnpm -C new-app typecheck && pnpm -C new-app test && pnpm -C new-app e2e && pytest worker`.

### 0.3 Vendors and env (verified 2026-10-26)
| Purpose | Vendor / lib | Env | Docs (cited) |
|---|---|---|---|
| TTS, voice clone, voice changer, audio isolation, STT fallback, music/SFX/dubbing (already wired) | ElevenLabs REST, header `xi-api-key` | `ELEVENLABS_API_KEY` (code must also accept the legacy `ELEVENLABS_KEY`: `process.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_KEY`) | https://elevenlabs.io/docs/api-reference/text-to-speech/convert · https://elevenlabs.io/docs/api-reference/voices/ivc/create · https://elevenlabs.io/docs/api-reference/speech-to-speech/convert · https://elevenlabs.io/docs/api-reference/audio-isolation/convert · https://elevenlabs.io/docs/api-reference/speech-to-text/convert |
| AI images (Nano Banana 2) and AI video B-roll (Wan 3.0) | Kie.ai market API: `POST https://api.kie.ai/api/v1/jobs/createTask` `{model, input, callBackUrl?}` → `taskId`; poll `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=`; states `waiting/queuing/generating/success/fail`; `data.resultJson.resultUrls` | `KIE_*` (existing; reuse the existing Kie client module, `rg -l "api.kie.ai" new-app lib worker`) | https://docs.kie.ai/market/quickstart · https://docs.kie.ai/market/google/nanobanana2 (`model:"nano-banana-2"`, `input.prompt` ≤20000 chars, `image_input[]`, `aspect_ratio`, `resolution`, `output_format`) · https://docs.kie.ai/market/common/get-task-detail |
| Vision (frame understanding, scene/layout detection, Quick Design) | Gemini API | `GEMINI_API_KEY`, `VISION_MODEL=gemini-flash-lite-latest` (a `-latest` alias, hot-swapped by Google with 2-week notice for breaking changes) | https://ai.google.dev/gemini-api/docs/models |
| LLM (Producer, text tools, retakes, translate) | `gpt-6-luna` through the **existing** LLM client the Producer uses (`rg -l "gpt-6-luna" new-app`). **Never send `temperature`**: the model rejects it. | existing | n/a (internal) |
| Stock media | Pixabay (existing) | existing `PIXABAY_*` | https://pixabay.com/api/docs/ |
| Transcription | faster-whisper `medium.en` + diarization in the worker (existing). Optional fallback for non-English or multichannel: ElevenLabs Scribe v2 | existing | https://elevenlabs.io/docs/api-reference/speech-to-text/convert |
| Captions render | ASS subtitles via libass in ffmpeg (existing) | n/a | https://ffmpeg.org/ffmpeg-filters.html#subtitles-1 |
| Realtime rooms | **LiveKit Cloud, Build plan** (default), switchable to self-hosted OSS LiveKit by env only | `LIVEKIT_URL` (wss URL; also exposed as `NEXT_PUBLIC_LIVEKIT_URL`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | https://livekit.io/pricing · https://docs.livekit.io/home/server/generating-tokens/ · https://docs.livekit.io/reference/components/react/ |

**ElevenLabs request shapes (from the cited API reference):**
- **TTS:** `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128`. JSON `{ text, model_id (default "eleven_multilingual_v2"), voice_settings?: { stability, similarity_boost, style, use_speaker_boost, speed }, previous_text?, next_text?, seed? }` returns audio bytes. `previous_text`/`next_text` keep prosody continuous when you splice a span, which is how Regenerate works.
- **Instant voice clone:** `POST https://api.elevenlabs.io/v1/voices/add` (multipart) `name`, `files[]`, `remove_background_noise?`, `description?`, `labels?`. It returns `{ voice_id, requires_verification }`.
- **Voice changer:** `POST https://api.elevenlabs.io/v1/voice-changer/{voice_id}` (multipart) `audio`, `model_id` (`eleven_multilingual_sts_v2`), `remove_background_noise?`, `voice_settings?`, `output_format` (query). It returns audio.
- **Audio isolation:** `POST https://api.elevenlabs.io/v1/audio-isolation` (multipart) `audio`. It returns audio.
- **STT (Scribe):** `POST https://api.elevenlabs.io/v1/speech-to-text` (multipart) `model_id:"scribe_v2"`, `file` **or** `source_url`, `diarize`, `num_speakers` (≤32), `timestamps_granularity:"word"`, `use_multi_channel` (≤5 channels, one speaker per channel), `keyterms[]` (glossary), `webhook?`. Files must be under 5 GB.

> Pricing: this spec states **no ElevenLabs, Kie or Gemini prices**. Show costs from `lib/config/costs.ts` (null until billing) and link the vendor pricing pages in the admin README only.

---

## 1. Milestone order (value ÷ effort; Editor and Voice first)
| # | Milestone | Sidebar item (from ui_polish §5.1) | Map phase | Est. Cursor-days (map) |
|---|---|---|---|---|
| **D1** | Long-form Editor | **Library › Editor** (`/app/editor`): flip `disabled:false` | 1 | ~22 |
| **D2** | Voice | **Library › Voice** (`/app/voice`) + editor rail tab | 2 | ~14.5 |
| **D3** | AI text, podcast and caption tools | **Library › Podcast tools** (`/app/podcast`) + editor panels | 3 (minus publishing) | ~17 |
| **D4** | Record (solo): screen+camera, slides, teleprompter + request links | **Create › Record** (`/app/record`): flip `disabled:false` | 4 | ~11 |
| **D5** | Rooms: remote multi-guest recording (LiveKit Cloud Build) | **Create › Record › Rooms** tab (`/app/record/rooms`) | 6 | ~20 |
| **D6** | Rooms production tools + comments | inside Rooms + editor Comments tab | 6 | ~12 |
| **D7** | Design: scenes compositor, transitions, color, layout packs, Quick Design, multiple compositions | **Create › Design** (`/app/design`) + editor | 5 | ~38 |
| **D8** | Multitrack sequences, multicam, green screen | editor (no sidebar item) | 5 | ~14 |
| **D9** | Web share pages | project "Share" button (no sidebar item) | 1 | ~3 |

Days are the Product Map's rough "Cursor-days" estimates. They are not quotes.

Sidebar additions not in ui_polish §5.1 (add them in the milestone that ships them):
- `{ title:'Podcast tools', href:'/app/podcast', icon: Podcast, group:'Library' }` (D3);
- `{ title:'Design', href:'/app/design', icon: Shapes, group:'Create' }` (D7).

The final sidebar is:
- **Create:** New project, Record, Design;
- **Library:** Projects, Editor, Voice, Podcast tools;
- **Brand:** Brand kit, Templates;
- **Exports:** Exports.

---

## 2. D1: Long-form Editor (top priority)

**Goal:** open any upload or recording as a full-length project and edit it like a document. This reuses the clipper's reducer, transcript, timeline, autosave and render queue.

### 2.1 Prisma (migration `d1_longform_editor`)
```prisma
enum ProjectKind { CLIPS LONGFORM RECORDING }          // new enum

model ClipProject {                                    // existing model: ADD fields only
  // ...existing fields unchanged...
  kind            ProjectKind  @default(CLIPS)
  glossary        String[]     @default([])            // custom spellings fed to ASR
}

model Composition {                                    // a long-form edit over a project's source media
  id            String   @id @default(cuid())
  workspaceId   String
  projectId     String
  title         String   @default("Main")
  edits         Json                                    // ClipEditsV2 (+ D1 optional keys), normalized
  editsHash     String?
  durationMs    Int?
  aspect        String   @default("16:9")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  project       ClipProject @relation(fields: [projectId], references: [id])
  snapshots     EditSnapshot[]
  markers       Marker[]
  @@index([workspaceId, projectId])
}

model EditSnapshot {                                   // Producer revert points and manual versions
  id            String   @id @default(cuid())
  compositionId String?
  clipId        String?                                 // also usable for short clips
  label         String
  source        String                                  // 'producer' | 'manual' | 'autosave'
  edits         Json
  createdAt     DateTime @default(now())
  composition   Composition? @relation(fields: [compositionId], references: [id])
  @@index([compositionId, createdAt])
  @@index([clipId, createdAt])
}

model Marker {
  id            String   @id @default(cuid())
  compositionId String
  atMs          Int
  title         String
  kind          String   @default("chapter")            // 'chapter' | 'note'
  createdAt     DateTime @default(now())
  composition   Composition @relation(fields: [compositionId], references: [id])
  @@index([compositionId, atMs])
}

model SpeakerLabel {                                   // rename/merge speakers per project
  id          String @id @default(cuid())
  projectId   String
  speakerKey  String                                    // diarization label, e.g. "SPEAKER_01"
  displayName String
  mergedInto  String?                                   // another speakerKey
  color       Int    @default(0)                        // index into --speaker-1..6
  @@unique([projectId, speakerKey])
}

model MediaExport {                                    // long-form/audio/subtitle exports (clip exports keep their table)
  id            String   @id @default(cuid())
  workspaceId   String
  compositionId String
  kind          String                                  // 'video' | 'gif' | 'audio' | 'subtitle' | 'transcript'
  format        String                                  // mp4|gif|wav|mp3|srt|vtt|txt|docx|md
  options       Json                                    // resolution, fps, lufs, sampleRate, channels, range, embedSubs
  status        String   @default("QUEUED")             // QUEUED|RENDERING|READY|FAILED|EXPIRED
  storagePath   String?
  sizeBytes     BigInt?
  error         String?
  expiresAt     DateTime?
  createdAt     DateTime @default(now())
  @@index([workspaceId, createdAt])
}
```
Fix the relation names to the real model names in `schema.prisma` (`ClipProject` per the existing code). Add the back-relations (`compositions Composition[]`) on `ClipProject`. Back-relations are additive.

### 2.2 Edits schema additions (`lib/clips/edits.ts`; all optional, defaults in `normalizeEdits`)
```ts
moves?: { id: string; fromStartMs: number; fromEndMs: number; toAtMs: number }[]   // move/paste ranges in source time
gapMaxMs?: number | null                     // shorten word gaps longer than this (null = off)
tracks?: { id: string; kind: 'video'|'audio'|'broll'|'text'|'voice'; name: string; muted?: boolean; locked?: boolean; items: TrackItem[] }[]
// TrackItem = { id, srcId, startMs, endMs, atMs, gainDb?, x?, y?, w?, h? }
audioFx?: { studioSound?: { assetId: string; mix: number } | null; loudnessLufs?: -14|-16|-18|-23|-24|null; roomTone?: boolean }
```
- `keepSegments()` / `remapTime()` / `outputDurationMs()` must apply `moves` after `cutRanges`. Write the property test first: `outputDurationMs(edits)` must equal the sum of kept segment lengths for 1,000 random edit sets (`fast-check`, dev-dep).

### 2.3 Reducer / Producer actions (`edits-reducer.ts`)
New `ProducerToolName` members and payloads:
| Action | Payload | Paid |
|---|---|---|
| `move_range` | `{ fromStartMs, fromEndMs, toAtMs }` | no |
| `restore_range` | `{ startMs, endMs }` (removes overlapping cuts) | no |
| `set_gap_max` | `{ gapMaxMs: number \| null }` | no |
| `cut_retakes` | `{ ranges: {startMs,endMs,reason}[] }` (proposed by the retakes endpoint, applied after review) | no |
| `add_marker` / `remove_marker` | `{ atMs, title, kind }` / `{ id }` | no |
| `rename_speaker` / `merge_speakers` | `{ speakerKey, displayName }` / `{ from, into }` | no |
| `add_track` / `move_item` / `set_track_mute` | `{ kind, name }` / `{ itemId, toTrackId, atMs }` / `{ trackId, muted }` | no |
| `snapshot` / `revert_to_snapshot` | `{ label }` / `{ snapshotId }` | no |

- **Project-wide Producer (F6 → long-form):** the Producer request gains `scope: 'clip' | 'composition' | 'project'`. When the scope is `project`, the tool calls carry `targetId` (clip or composition) and are applied per target. Before applying any batch, the server writes an `EditSnapshot{source:'producer'}`. The UI shows **Revert** on the producer message, which dispatches `revert_to_snapshot`.
- **Review pass:** after a batch, run one extra LLM call ("check these edits for broken sentences or cut words mid-phrase") and show the warnings as `Callout tone="warning"` (no auto-apply).

### 2.4 API routes (all `app/api/editor/**`, Node runtime, `resolveWorkspaceId()`, zod-validated)
| Route | Method | Purpose |
|---|---|---|
| `/api/editor/compositions` | POST `{ projectId, title? }` | create from a READY project (sets `project.kind` to `LONGFORM` if it is a new project) |
| `/api/editor/compositions` | GET `?projectId=` | list |
| `/api/editor/compositions/[id]` | GET / PATCH `{ title?, edits?, aspect? }` / DELETE (soft) | load and autosave (same debounce and version-hash pattern as clips) |
| `/api/editor/compositions/[id]/snapshots` | GET / POST `{ label }` | versions |
| `/api/editor/compositions/[id]/markers` | GET / POST / DELETE | markers |
| `/api/editor/projects/[id]/speakers` | GET / PUT `{ speakerKey, displayName?, mergedInto?, color? }` | rename/merge |
| `/api/editor/projects/[id]/glossary` | PUT `{ terms: string[] }` | glossary (max 200 terms, each ≤ 50 chars) |
| `/api/editor/projects/[id]/retranscribe` | POST `{ engine?: 'whisper'\|'scribe', language? }` | enqueue `TRANSCRIBE` with the glossary |
| `/api/editor/compositions/[id]/retakes` | POST | LLM (`gpt-6-luna`, no temperature) over the transcript returns `{ranges[]}`. The review list is shown before apply. |
| `/api/editor/compositions/[id]/exports` | POST `{ kind, format, options }` | create `MediaExport` + enqueue `EXPORT_MEDIA` |
| `/api/editor/exports/[id]` | GET | status + signed download URL |

### 2.5 Worker job types (add to `count_queued_jobs`, `claim_job` and dispatch)
| Type | Payload | Does |
|---|---|---|
| `TRANSCRIBE` | `{ projectId, engine, language?, glossary[] }` | Whisper: `initial_prompt = ", ".join(glossary)` (faster-whisper `transcribe(..., initial_prompt=...)`) with `medium.en` for English; for other languages use the multilingual model set in `WHISPER_MULTI_MODEL` (default `large-v3`). Scribe: multipart to `/v1/speech-to-text` with `keyterms`, `diarize=true` and `timestamps_granularity=word`. Writes the same transcript JSON shape as `PROCESS_PROJECT`. |
| `PROXY_MEDIA` | `{ projectId }` | 540p H.264 proxy (`-vf scale=-2:540 -c:v libx264 -preset veryfast -crf 28 -g 48`) + waveform peaks JSON (`audiowaveform`-style, 100 px/s, computed with numpy from `ffmpeg -f s16le`) + a thumbnail sprite every 2 s (`fps=1/2,scale=160:-1,tile=10x10`). Enqueued automatically after `PROCESS_PROJECT` when `kind=LONGFORM`. |
| `EXPORT_MEDIA` | `{ exportId }` | **video:** concat kept segments (from `keepSegments`, serialized by the route into the payload) with the existing render path, resolution 480/720/1080/2160 (`-vf scale=-2:H`), H.264 `-crf 20`, AAC 192k; embedded subtitles `-c:s mov_text` when `embedSubs`. **gif:** `fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse` (max 60 s). **audio:** `-vn`, wav `pcm_s16le` or mp3 `libmp3lame -b:a 192k`, `-ar 44100\|48000`, `-ac 1\|2`, then `loudnorm=I={lufs}:TP=-1.5:LRA=11` (two-pass), and chapters as an ffmetadata file (`-i chapters.txt -map_metadata 1`). **subtitle/transcript:** serialize remapped words, so SRT/VTT/TXT/MD are plain text and DOCX uses `python-docx`. |

**Exclusion check:** no FCPXML/XML/AAF format value may be accepted by the zod enum.

### 2.6 UI (placement)
- **Sidebar Library › Editor → `/app/editor`:** a list of compositions (`ProjectGrid` style, 16:9 cards) plus "Open a project in Editor" (a `Command` picker over READY projects that calls POST compositions).
- **`/app/editor/[compositionId]`:** reuses `EditorShell` with `mode="longform"`:
  - Preview 16:9.
  - Rail adds `markers` (`Bookmark`), `speakers` (`Users`) and `export` (`Download`). It hides `thumbnail` if not relevant (keep it for YouTube covers).
  - **Script panel:** virtualized with `@tanstack/react-virtual` `^3` (one row per paragraph). Drag-select then "Move to…" drives `move_range`. A "Show removed" toggle shows cut words inline with a Restore action. The gap slider (`Slider` 0.1–2.0 s, off by default) drives `set_gap_max`. "Find retakes" (`Repeat`) opens a review `Sheet` with checkbox rows and dispatches `cut_retakes` with the checked ranges.
  - **Timeline:** N tracks from `edits.tracks`, uses the proxy video for preview, renders waveform peaks on `<canvas>` and thumbnail sprite strips, and supports zoom (`Slider`, 1 px/s … 200 px/s).
  - **Export dialog:** tabs Video (MP4/GIF, 480p–4K, range: all / selection / between markers), Audio (WAV/MP3, 44.1/48 kHz, mono/stereo, LUFS select −14/−16/−18/−23/−24), and Text (SRT/VTT/TXT/DOCX/MD).
- Exports page: `MediaExport` rows join the existing table with a "Type" column.

### 2.7 Tests and acceptance
- **vitest:**
  - `edits-reducer.d1.test.ts` (every new action, undo/redo symmetry, `normalizeEdits` on a v2 row without the new keys);
  - `time-remap.property.test.ts` (fast-check);
  - `srt.test.ts` (golden file, after cuts and moves);
  - route tests for compositions CRUD, glossary limits and the export zod enum rejecting `fcpxml`.
- **pytest:**
  - `test_export_media.py` (10 s fixture → mp3 at −16 LUFS ±1 measured with `ffmpeg -af ebur128`; GIF ≤ 60 s; chapters present in `ffprobe -show_chapters`);
  - `test_proxy_media.py`;
  - `test_job_types.py`.
- **playwright `e2e/d1-editor.spec.ts`:** open fixture project → Editor → delete a sentence → preview skips it → move a paragraph → add a marker → export MP3 → the Exports row turns READY.
- **Acceptance:**
  1. A 60-min file scrolls the Script at 60 fps (Performance panel, no long task > 50 ms while scrolling).
  2. The timeline is interactive within 3 s of load (proxy + peaks).
  3. Producer "remove all the ums and tighten pauses over 0.7 s" yields a snapshot + edits + Revert that works.
  4. All export formats download and play.
  5. Old clip editors are unaffected (D1 doesn't touch the clip routes).

---

## 3. D2: Voice

### 3.1 Prisma (`d2_voice`)
```prisma
model Voice {
  id            String   @id @default(cuid())
  workspaceId   String
  name          String
  provider      String   @default("elevenlabs")
  providerVoiceId String
  kind          String                                  // 'stock' | 'clone'
  consentAssetId String?                                // recording of the consent line (clone only)
  consentText   String?
  requiresVerification Boolean @default(false)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?
  @@index([workspaceId])
}

model AudioAsset {                                     // generated or processed audio (TTS, isolated, converted, regenerated spans)
  id          String   @id @default(cuid())
  workspaceId String
  projectId   String?
  kind        String                                    // 'tts' | 'isolated' | 'converted' | 'regen' | 'roomtone'
  storagePath String
  durationMs  Int
  meta        Json                                      // voiceId, model_id, text, source range, settings
  createdAt   DateTime @default(now())
  @@index([workspaceId, projectId])
}
```

### 3.2 Features → vendor → job
| Feature | Vendor call (cited §0.3) | Job type | Reducer action |
|---|---|---|---|
| **Studio Sound** | `POST /v1/audio-isolation` on the extracted audio (worker sends ≤ 10-min chunks split at silence and joins them with a 50 ms `acrossfade`) | `STUDIO_SOUND {projectId}` → `AudioAsset(kind:isolated)` | `set_studio_sound {enabled, mix 0..1}` (paid). The render mixes isolated × mix + original × (1−mix) via `amix=weights` |
| **Loudness** | none, ffmpeg `loudnorm` two-pass | inside `EXPORT_MEDIA` / render | `set_loudness {lufs}` |
| **Room tone** | none. Detect the quietest 2 s window (`silencedetect=n=-50dB:d=0.5`) and loop it under removed gaps at −6 dB | `ROOM_TONE {projectId}` → `AudioAsset(kind:roomtone)` | `set_room_tone {enabled}` |
| **TTS voiceover** | `POST /v1/text-to-speech/{voice_id}` `model_id` from env `ELEVENLABS_TTS_MODEL` (default `eleven_multilingual_v2`), `output_format=mp3_44100_128` | route (≤ 2,500 chars sync) or `TTS {text, voiceId}` for longer | `insert_voiceover {text, voiceId, atMs, trackId?}` (paid). Adds a `voice` track item |
| **Voice clone** | `POST /v1/voices/add` with ≥ 1 sample + `remove_background_noise=true` | route | none (library op) |
| **Regenerate** (type new words in the speaker's voice) | TTS with the speaker's cloned `voice_id`, `previous_text` = the 2 preceding sentences, `next_text` = the 2 following, fixed `seed` per project | `REGENERATE_SPAN {compositionId, startMs, endMs, text, voiceId}`: splice with a 30 ms `acrossfade`, match loudness to the ±2 s context (`loudnorm` measured), overlay room tone | `regenerate_words {startMs, endMs, text, voiceId}` (paid). The UI warns "mouth won't match on video" |
| **Convert to AI speech** | `POST /v1/voice-changer/{voice_id}` `model_id=eleven_multilingual_sts_v2`, `remove_background_noise=true`, ≤ 5-min chunks | `VOICE_CONVERT {projectId, speakerKey?, voiceId}` then re-align the words with a forced alignment pass (faster-whisper word timestamps on the output) | `convert_voice {speakerKey?, voiceId}` (paid) |

**Consent (required for clones):**
- The clone wizard shows the line: *"I, {name}, consent to Transovo creating an AI copy of my voice for my own projects."* The user records it in-browser (MediaRecorder, reusing D4's recorder hook if it has shipped, else a minimal one).
- Verify it by transcribing it with Whisper and requiring ≥ 80 % word match with the line.
- Store it as `consentAssetId`. If `requires_verification` comes back true, show a `Callout` linking to ElevenLabs' verification flow, and never automate it.

### 3.3 Routes
- `GET /api/voice/voices` (workspace clones + stock voices from `GET https://api.elevenlabs.io/v1/voices`, cached 1 h);
- `POST /api/voice/clone` (multipart: name, samples[], consent audio);
- `DELETE /api/voice/voices/[id]` (soft delete, and `DELETE /v1/voices/{voice_id}` upstream);
- `POST /api/voice/tts`;
- `POST /api/voice/studio-sound`;
- `POST /api/voice/convert`;
- `POST /api/voice/regenerate`.

### 3.4 UI
- **Sidebar Library › Voice → `/app/voice`:**
  - tabs "Voices" (cards with a play sample, a clone badge and a consent status `StatusBadge`), "Clone a voice" (3-step `Steps` wizard: samples → consent recording → name), and "Text to speech" (a script `Textarea` + voice `Select` + Generate → `AudioAsset` list with download).
- **Editor rail** adds `voice` (`AudioLines`, tone `text-lane-voice`):
  - a Studio Sound `ToggleRow` + mix `Slider`;
  - a Loudness `Select`;
  - a Room tone toggle;
  - "Add voiceover" (TTS) at the playhead;
  - "Convert speaker…".
- **Script panel:** select words → bubble action `Wand2` "Regenerate". This opens an inline input pre-filled with the selected text, and the user edits it and confirms.
- Paid confirmations use the Producer's existing paid card pattern.

### 3.5 Tests and acceptance
- **vitest:** mock ElevenLabs. TTS route sends `xi-api-key`, never logs it (spy on `console`), and handles both env names. The clone route rejects missing consent. All reducer actions are covered.
- **pytest:** splice crossfade length; loudness match within ±1 LU; Studio Sound chunk join has no clicks (max sample delta at the joins below a threshold).
- **e2e:** the TTS tab generates a (mocked) mp3 and it plays.
- **Acceptance:**
  - Studio Sound on a noisy fixture lowers the noise floor (measured with `astats` RMS in silence regions);
  - Regenerate "Tuesday" → "Thursday" plays seamlessly;
  - a clone can't be created without a consent recording;
  - Convert voice keeps word timestamps usable for further edits.

---

## 4. D3: AI text, podcast and caption tools (no publishing)

### 4.1 Prisma (`d3_text_tools`)
```prisma
model TextArtifact {
  id          String   @id @default(cuid())
  workspaceId String
  projectId   String
  compositionId String?
  kind        String                                    // 'show_notes'|'titles'|'summary'|'description'|'chapters'|'blog'|'social_copy'|'translation'
  language    String   @default("en")
  content     Json                                      // { text } or { items: [...] } or { chapters: [{atMs,title}] }
  createdAt   DateTime @default(now())
  @@index([projectId, kind])
}
model PromptSkill {                                    // saved chat → reusable skill, slash command
  id          String   @id @default(cuid())
  workspaceId String
  slug        String                                    // used as /slug in the Producer
  title       String
  prompt      String
  toolAllowList String[] @default([])
  builtIn     Boolean  @default(false)
  createdAt   DateTime @default(now())
  @@unique([workspaceId, slug])
}
model AudiogramPreset {
  id String @id @default(cuid())
  workspaceId String
  name String
  style Json                                            // waveform kind, colors, bg asset, layout per speaker
}
```

### 4.2 Features
| Feature | Implementation | Route / job | Reducer action |
|---|---|---|---|
| Show notes, titles (5 options), summary, description, blog post, social **copy** (text only; no posting) | One `gpt-6-luna` call per preset (no temperature) over the transcript (chunk if > 100k chars: map-reduce summaries). Prompts live in `lib/ai/text-presets.ts` | `POST /api/text/[projectId]/generate {kind, compositionId?, language?}` → `TextArtifact` | `generate_text {kind}` |
| Chapters | LLM returns `[{atMs,title}]`, snapped to the nearest paragraph start | same route, `kind:'chapters'` | `generate_chapters` → `add_marker` × n |
| Skills / slash commands | 10 built-in seeds (`/tighten`, `/clean-audio`, `/chapters`, `/shownotes`, `/titles`, `/captions-bold`, `/remove-retakes`, `/studio-sound`, `/translate-captions`, `/audiogram`). "Save this chat as a skill" stores the prompt + tools used | `GET/POST/DELETE /api/skills` | Producer resolves `/slug` → system prompt + tool allow-list |
| Web search in the Producer | A `web_search` tool exposed to the LLM (server-side). Use the existing LLM provider's built-in search tool if the client supports it; if it doesn't, **leave this feature off** (no new paid search vendor without Rick's OK) | n/a | `web_search` (read-only, not a reducer action) |
| Images + inpaint | Kie `nano-banana-2` createTask with `input.prompt`, optional `image_input:[url]` for edits/inpaint, `aspect_ratio`; poll `recordInfo` | job `IMAGE_GEN {prompt, imageUrls?, aspect}` | `insert_image {assetId, atMs, durMs, trackId}` (paid), `generate_thumbnail` (exists) |
| Caption animations + gradients | Extend presets with `animation: 'pop'\|'bounce'\|'typewriter'\|'slide'\|'karaoke'\|'fade'\|'wave'\|...` (15 total) and `fill: {type:'solid'\|'gradient', stops[]}`. ASS: karaoke via `\k`, pop via `\t(\fscx120\fscy120)` → `\t(\fscx100\fscy100)`, fades via `\fad`; gradients: render as a two-layer ASS (`\clip` halves) **or** pre-render the gradient text PNG with Pillow and overlay (choose per preset, documented in `captions/ass_builder.py`). The CSS preview mirrors each in `caption-anim.css` | worker render path | `set_captions` (exists; extend schema) |
| Stock library panel | Pixabay images/videos/music in a unified Media panel with search + type filter (already partly built). **No new stock vendor** | `GET /api/stock/search?q&type&page` | `insert_stock_broll` (exists), `insert_stock_image` |
| Translate captions + do-not-translate list | LLM translates caption segments in batches of 50 with a JSON schema, preserving `{dnt}` terms (from `ClipProject.glossary` + a per-request list) | `POST /api/text/[projectId]/translate-captions {language, dnt[]}` → `TextArtifact(kind:'translation')` | `set_caption_language {language}` |
| Dub proofread + timing modes | Existing ElevenLabs dubbing path: add a proofread step (show the translated script, editable, before synthesis) and `timing: 'match'\|'direct'` (match = time-stretch each segment with `atempo` within 0.8–1.25×; direct = no stretch) | extend the existing `DUB` job payload (optional fields) | `dub` (exists; add `timing`) |
| Brand Studio basics | Brand templates gain `fonts[]` (uploaded TTF/OTF to storage, registered for libass via `fontsdir`), `colors[]`, `defaultLayoutId?`, `isDefault` | extend the existing brand routes (additive columns) | `apply_brand` (exists) |
| Audiograms | ffmpeg `showwaves=s=1080x300:mode=cline:colors=...` per speaker track (D1 speaker separation via diarization masks) or `showfreqs`; composite over a bg image + logo + captions | job `AUDIOGRAM {compositionId, presetId, aspect}` | `make_audiogram {presetId, aspect}` |
| Audio-only compositions | `Composition.aspect = 'audio'` → render skips video; editor hides Preview/Layout and shows a large waveform | n/a | n/a |

### 4.3 UI
- **Sidebar Library › Podcast tools → `/app/podcast`:** pick a project, then cards per text preset with a `Sparkles` Generate and Copy/Download (.md). There is a chapters list and an Audiogram builder (preset cards + preview + export).
- **Editor rail:** a `text` tab (`FileText`, "Write-ups") with the same generators scoped to the composition, and a `media` tab (`Images`) for the stock + AI image panel.
- **Producer composer:** typing `/` opens a `Command` popover listing skills.

### 4.4 Tests and acceptance
- **vitest:**
  - presets snapshot (prompt text, and that `temperature` is absent from the request body);
  - chapters snapping;
  - translate preserves DNT terms (mock LLM);
  - skills CRUD + slash resolution.
- **pytest:**
  - ASS builder golden files for each animation;
  - audiogram 5 s render;
  - dub `atempo` bounds.
- **Acceptance:**
  - generating show notes for a 60-min transcript completes < 60 s;
  - chapters become markers;
  - `/shownotes` works in the Producer;
  - all 15 caption animations preview in the browser and burn in identically (side-by-side frame check at 3 timestamps);
  - **no** "Publish"/"Post to" button exists anywhere.

---

## 5. D4: Record (solo, browser-only)

**No server media infra.** Everything is captured in the browser and uploaded in chunks to the existing storage. LiveKit is **not** used in D4.

### 5.1 Prisma (`d4_record`)
```prisma
enum RecordingStatus { RECORDING UPLOADING ASSEMBLING TRANSCRIBING READY FAILED ABANDONED }   // new enum

model Recording {
  id            String   @id @default(cuid())
  workspaceId   String
  projectId     String?                                 // set when assembled into a ClipProject(kind: RECORDING)
  roomId        String?                                 // D5
  mode          String                                  // 'screen_cam' | 'screen' | 'cam' | 'slides' | 'teleprompter' | 'request' | 'room'
  title         String   @default("Untitled recording")
  status        RecordingStatus @default(RECORDING)
  startedAt     DateTime @default(now())
  endedAt       DateTime?
  durationMs    Int?
  meta          Json?                                   // layout, slide timings, script id, device labels (no PII)
  tracks        RecordingTrack[]
  @@index([workspaceId, startedAt])
}

model RecordingTrack {                                 // one per participant × source (cam, screen, mic)
  id            String   @id @default(cuid())
  recordingId   String
  participantKey String                                  // opaque, e.g. 'host' or RoomGuest.id
  source        String                                  // 'camera' | 'screen' | 'mic' | 'screen2'
  mimeType      String                                  // e.g. video/webm;codecs=vp9,opus
  startedAtClientMs BigInt                               // performance.timeOrigin + performance.now() at start
  clockOffsetMs Int      @default(0)                    // server − client, measured at start (D5 sync)
  chunkCount    Int      @default(0)
  bytes         BigInt   @default(0)
  finalized     Boolean  @default(false)
  assembledPath String?                                 // after RECORDING_ASSEMBLE
  durationMs    Int?
  recording     Recording @relation(fields: [recordingId], references: [id])
  chunks        RecordingChunk[]
  @@unique([recordingId, participantKey, source])
}

model RecordingChunk {
  id          String   @id @default(cuid())
  trackId     String
  index       Int                                       // 0..n, contiguous
  bytes       Int
  sha256      String
  storagePath String
  receivedAt  DateTime @default(now())
  track       RecordingTrack @relation(fields: [trackId], references: [id])
  @@unique([trackId, index])                            // idempotent re-upload
}

model RecordingRequest {                                // teleprompter / async request links
  id          String   @id @default(cuid())
  workspaceId String
  token       String   @unique                          // 32-byte random, base64url
  title       String
  script      String?
  instructions String?
  maxDurationSec Int   @default(600)
  expiresAt   DateTime
  recordingId String?
  createdAt   DateTime @default(now())
}
```

### 5.2 Client recorder (`lib/record/recorder.ts`, `hooks/use-recorder.ts`)
- **Capture:**
  - `navigator.mediaDevices.getDisplayMedia({ video: { width: {ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30} }, audio: true })` for screen (system/tab audio where the browser allows it);
  - `getUserMedia({ video: { width:{ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30} }, audio: { echoCancellation:true, noiseSuppression:false, autoGainControl:false, sampleRate:48000, channelCount:1 } })` for cam + mic.
- **Separate recorders per source** (camera, screen, mic). They are not mixed; mixing happens in the editor via the layout.
- **MIME:** the first of `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/mp4;codecs=avc1,mp4a` (Safari) for which `MediaRecorder.isTypeSupported()` is true. Mic-only uses `audio/webm;codecs=opus` (or `audio/mp4`).
- **Bitrate:** 1080p `videoBitsPerSecond: 6_000_000`, 720p `3_000_000`, and `audioBitsPerSecond: 128_000`.
- `recorder.start(5000)` makes `dataavailable` fire every ~5 s with a Blob chunk (MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/start).
- **Durability (nothing is lost):**
  - each chunk is written **first** to IndexedDB (`idb` `^8`, store `rec-chunks`, key `${trackId}:${index}`), then uploaded;
  - it is deleted from IDB only after a 200 OK with the matching sha256.
- **Uploader** (`lib/record/chunk-uploader.ts`):
  - one in-flight request per track;
  - exponential backoff 1 s → 30 s with ±20 % jitter, retrying forever while the page is open;
  - `navigator.onLine` listener;
  - `beforeunload` warns if the queue is non-empty.
  - On reload, `/app/record` scans IDB for unfinished tracks and offers **"Resume upload"** (the resumable flow).
- **Upload transport:** `PUT /api/record/tracks/[trackId]/chunks/[index]` with the raw body (`application/octet-stream`) and headers `x-chunk-sha256` and `x-chunk-bytes`. The server streams the body to storage at `recordings/{recordingId}/{trackId}/{index:06d}.part` and upserts `RecordingChunk` (idempotent on `[trackId,index]`). Max body 64 MB; set the `export const maxDuration = 60` route config.
- **Finalize:** `POST /api/record/tracks/[trackId]/finalize {chunkCount, durationMs}`. The server verifies the indices are contiguous (it returns the missing ones, and the client re-sends from IDB), then enqueues `RECORDING_ASSEMBLE` once **all tracks of the recording** are finalized.
- **Live meters:** a `AudioContext` + `AnalyserNode` level meter, a 3-2-1 countdown, a pause/resume (`recorder.pause()`), and a max length (from plan caps config, **not enforced**; it only warns).

### 5.3 Modes
| Mode | Capture | Extra |
|---|---|---|
| Screen + camera | display + user media | Camera bubble preview (draggable PiP in the recorder UI). Stored as separate tracks; the editor layout preset "Screen + cam bubble" is set in `meta.layout` |
| Slides | display media of a slide window/tab + camera | "Next slide" hotkey (→ / PageDown) logs `meta.slideMarks: [{atMs, n}]`, which become markers on assembly |
| Teleprompter (self) | camera + mic | Script panel overlay: `font-size` slider, speed slider (words/min 80–220), mirror toggle, auto-scroll; script from text or a `TextArtifact` |
| Request link (async) | public page `/r/[token]` (no auth) with the teleprompter recorder | Creator makes the request in `/app/record/requests` (title, script, instructions, max duration, expiry 1–30 days). The guest records; the upload goes to the creator's workspace with `participantKey:'guest'`. The token is single-use after finalize |

**Public request route security** (no auth exists yet):
- the token is 32 random bytes;
- rate-limit 30 req/min/IP on `/api/record/public/*` (in-memory LRU per instance is OK for now);
- chunk routes for request recordings check `RecordingRequest.token` + `recordingId` match;
- no workspace data is exposed except title, script and instructions.

### 5.4 Worker
- **`RECORDING_ASSEMBLE {recordingId}`** (add to both claim lists + dispatch):
  1. Per track: concatenate the chunk files in index order. They are a single continuous WebM/MP4 byte stream, so use a byte concat, then run `ffmpeg -fflags +genpts -i joined.webm -c copy` to fix the duration/cues. Re-encode only if copy fails: `-c:v libx264 -crf 18 -preset veryfast -c:a aac -b:a 192k`, CFR 30 (`-vsync cfr -r 30`), audio `-ar 48000`.
  2. Align the tracks by `startedAtClientMs + clockOffsetMs` (pad the start with `adelay`/`tpad`).
  3. Create a `ClipProject{kind:'RECORDING'}` with a source asset per track. The primary source is camera (or screen if there is no camera). Mic audio goes onto each speaker's track.
  4. Enqueue `TRANSCRIBE` (whisper medium.en + diarization). For **multi-track rooms, transcribe each speaker's mic track separately** and merge by time with `speaker = participant` (better than diarization). Optional: ElevenLabs Scribe `use_multi_channel` with up to 5 mono channels, one per speaker.
  5. Status: `ASSEMBLING → TRANSCRIBING → READY`; progress is posted via the existing progress route.
- **`RECORDING_GC`** (cron-like, enqueued daily by the reaper loop): deletes `.part` chunks of assembled recordings older than 7 days and marks `ABANDONED` recordings with no chunk in 7 days. This mirrors Descript's guest file recovery of up to 7 days.

### 5.5 Routes
- `POST /api/record/recordings {mode, title, meta}` → `{recordingId}`;
- `POST /api/record/recordings/[id]/tracks {participantKey, source, mimeType, startedAtClientMs}` → `{trackId, clockOffsetMs}` (server time is returned so the client computes the offset);
- `PUT …/chunks/[index]`;
- `POST …/finalize`;
- `GET /api/record/recordings/[id]` (status + missing chunks);
- `POST/GET /api/record/requests`;
- `GET /api/record/public/requests/[token]`.

### 5.6 UI (sidebar **Create › Record → `/app/record`**, flip `disabled:false`)
- **`/app/record`:** `PageHeader icon={Video} iconTone="record"`. Mode `OptionTile`s: Screen + camera (`MonitorSmartphone`), Screen (`Monitor`), Camera (`Camera`), Audio only (`Mic`), Slides (`Presentation`), Teleprompter (`ScrollText`). Then the device pickers (`Select` camera/mic, live preview, level meter) and a big red record `Button` (`bg-lane-record`, `Circle` filled).
- **Recording HUD:** a timer `font-mono`, a pulsing red dot, pause/stop, an upload-queue indicator (`CloudUpload` + "{n} chunks pending"), and the network state.
- **After stop:** a stepper Uploading → Assembling → Transcribing → Ready, then "Open in Editor" (D1).
- **`/app/record/requests`:** a table plus a "New request" `Dialog`, and a copy-link button.
- **Recordings list** (tab on `/app/record`): status badges and Resume upload for local unfinished tracks.

### 5.7 Tests and acceptance
- **vitest:**
  - chunk uploader (fake timers; offline → online resumes; duplicate index is idempotent; sha mismatch triggers a retry);
  - finalize returns the missing indices;
  - request token validation.
- **pytest:** assemble 3 webm chunk fixtures → playable mp4 with the correct duration (±100 ms).
- **playwright:** Chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`. Record 15 s screen+cam → stop → the project reaches READY with a transcript. A second test sets the context offline mid-recording (`context.setOffline(true)` for 10 s), then online, and asserts no missing chunks.
- **Acceptance:**
  - kill the tab at 30 s, reopen `/app/record`, choose "Resume upload", and the recording assembles with ≤ 5 s lost (the last unflushed timeslice);
  - 1080p is captured when the device supports it (check `track.getSettings()`);
  - a request link works in a private window with no login.

---

## 6. D5: Rooms (remote multi-guest recording) on LiveKit, env-switchable

### 6.1 Decision (Rick, latest)
- **Start on LiveKit Cloud's free Build plan** (https://livekit.io/pricing): 5,000 WebRTC participant-minutes, 50 GB downstream data transfer and 100 concurrent connections. Ship is $50/mo for 150k min / 250 GB, then $0.12/GB.
- The server URL and keys are **env only**: `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. **Moving to self-hosted LiveKit (Appendix A) changes only these three values.** No code path may branch on "cloud vs self-hosted".
- **No Egress, no Telnyx, no server-side recording.** LiveKit only carries the *live* conversation. Every participant's browser records its **own** camera/mic/screen locally at full quality with D4's recorder and uploads chunks to our storage.
- Plan recording-hour caps are **config only, not enforced** (§6.7).

### 6.2 Packages (`new-app/package.json`)
```bash
pnpm add livekit-client@^2.23.0 livekit-server-sdk@^2.19.2 @livekit/components-react@^2.9.24 @livekit/components-styles@^1.2.0
```
- Note: `livekit-client` and `livekit-server-sdk` already exist in the repo; this bumps them. Run `pnpm why livekit-client` and remove any duplicate.
- Docs:
  - React components: https://docs.livekit.io/reference/components/react/
  - Tokens: https://docs.livekit.io/home/server/generating-tokens

### 6.3 Prisma (`d5_rooms`)
```prisma
model RecordingRoom {
  id            String   @id @default(cuid())
  workspaceId   String
  name          String
  livekitRoom   String   @unique                         // e.g. "rr_" + cuid; never contains user names
  inviteToken   String   @unique                         // 32 random bytes, base64url, for /join/[inviteToken]
  producerToken String   @unique                         // separate link for producers (D6)
  scheduledFor  DateTime?                                 // D6
  settings      Json                                      // { resolution:'1080p'|'720p', screenShare:boolean, guestCanShare:boolean, maxParticipants:number }
  activeRecordingId String?
  createdAt     DateTime @default(now())
  archivedAt    DateTime?
  guests        RoomGuest[]
  @@index([workspaceId, createdAt])
}

model RoomGuest {
  id            String   @id @default(cuid())
  roomId        String
  displayName   String                                    // typed by the guest; stored, never put in the LiveKit identity
  role          String   @default("guest")                // 'host' | 'guest' | 'producer'
  identity      String   @unique                          // opaque "p_" + cuid used as the LiveKit identity
  joinedAt      DateTime @default(now())
  leftAt        DateTime?
  room          RecordingRoom @relation(fields: [roomId], references: [id])
}
```
`Recording.roomId` (D4) links a room session to its recording; `RecordingTrack.participantKey = RoomGuest.id`.

### 6.4 Token route: `app/api/record/rooms/[roomId]/token/route.ts`
```ts
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
export const runtime = 'nodejs';

const Body = z.object({ inviteToken: z.string().min(20).optional(), displayName: z.string().trim().min(1).max(60) });

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const body = Body.parse(await req.json());
  const room = await prisma.recordingRoom.findUnique({ where: { id: roomId } });
  if (!room || room.archivedAt) return Response.json({ error: 'not_found' }, { status: 404 });

  // host = caller from the app (resolveWorkspaceId matches); guest/producer = valid invite/producer token
  const workspaceId = await resolveWorkspaceId().catch(() => null);
  const role = workspaceId === room.workspaceId && !body.inviteToken ? 'host'
    : body.inviteToken === room.inviteToken ? 'guest'
    : body.inviteToken === room.producerToken ? 'producer' : null;
  if (!role) return Response.json({ error: 'forbidden' }, { status: 403 });

  const active = await prisma.roomGuest.count({ where: { roomId, leftAt: null, role: { not: 'producer' } } });
  const max = (room.settings as any)?.maxParticipants ?? RECORDING_LIMITS.maxParticipants; // 10
  if (role !== 'producer' && active >= max) return Response.json({ error: 'room_full' }, { status: 409 }); // a capacity guard, not billing

  const guest = await prisma.roomGuest.create({ data: { roomId, displayName: body.displayName, role, identity: `p_${cuid()}` } });

  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: guest.identity,                     // opaque, no PII
    name: body.displayName,                       // shown in the room UI only
    ttl: '10m',                                   // short; the client fetches a fresh one on reconnect
    metadata: JSON.stringify({ role, guestId: guest.id }),
  });
  at.addGrant({
    room: room.livekitRoom, roomJoin: true, canSubscribe: true, canPublishData: true,
    canPublish: true,
    canPublishSources: role === 'producer' ? [TrackSource.MICROPHONE] : undefined, // D6
    hidden: role === 'producer',                                                  // D6
    roomAdmin: role === 'host',
  });
  return Response.json({ token: await at.toJwt(), url: process.env.LIVEKIT_URL, guestId: guest.id, role });
}
```
- `toJwt()` is async in server-sdk v2.
- Import `TrackSource` from `livekit-server-sdk` (re-exported protocol enum). If that export name differs in 2.19.x, use the string form documented on the tokens page. Check this in the PR, and do not guess silently.
- **Never** return or log `LIVEKIT_API_SECRET`.
- The route reads the env at request time, so switching env is enough.

### 6.5 Client
- **Pages:**
  - Host: `/app/record/rooms/[roomId]`.
  - Guests: **public** `/join/[inviteToken]`, no auth. A green-room page with a name field, a device check (camera/mic preview, level meter, a speaker test) and a "Join" button.
- **Room UI:** `@livekit/components-react`.
```tsx
import '@livekit/components-styles';
import { LiveKitRoom, GridLayout, ParticipantTile, RoomAudioRenderer, ControlBar, useTracks } from '@livekit/components-react';
import { Track, VideoPresets } from 'livekit-client';

<LiveKitRoom serverUrl={url} token={token} connect video audio
  options={{
    adaptiveStream: true, dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },      // capture 1080p for local recording
    publishDefaults: { simulcast: true, videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h540] }, // live view stays light
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  }}
  data-lk-theme="default" className="h-dvh bg-background">
  <RoomStage />            {/* GridLayout + ParticipantTile over useTracks([Track.Source.Camera, Track.Source.ScreenShare]) */}
  <RoomAudioRenderer />
  <RecordingBar />         {/* our component: REC state, timer, per-guest upload health */}
  <ControlBar variation="minimal" />
</LiveKitRoom>
```
- Restyle the components to the ui_polish tokens by overriding the `--lk-*` CSS variables in `app/(app)/record/rooms/livekit-theme.css`: `--lk-bg: var(--background)`, `--lk-fg: var(--foreground)`, `--lk-accent-bg: var(--primary)`, and so on.
- **Why live layers stay ≤ 540p:** recording quality comes from the local recorder, not the stream. This keeps the Build plan's 50 GB downstream lasting longer (§6.8).
- **Local recording per participant** (reuses `lib/record/recorder.ts`):
  1. The host clicks **Record**. `POST /api/record/rooms/[roomId]/recordings` creates a `Recording{mode:'room'}`, sets `room.activeRecordingId` and calls `RoomServiceClient.updateRoomMetadata(livekitRoom, JSON.stringify({ rec: { id, state:'recording', serverStartMs } }))`. Every client reacts to `RoomEvent.RoomMetadataChanged`.
  2. Each client:
     - clones its local camera/mic `MediaStreamTrack`s (`localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack.clone()`) so the recorder is independent of LiveKit's simulcast;
     - registers tracks via `POST /api/record/recordings/[id]/tracks` (gets `clockOffsetMs`);
     - starts `MediaRecorder` with `start(5000)` on camera, mic (separate audio-only recorder, 48 kHz Opus 128 kbps) and screen if shared;
     - chunks go IDB → upload exactly as in D4.
  3. **Clock sync:** the client measures the offset with 5 round-trips to `GET /api/record/time` (NTP-style: offset = serverTime − (t0+t1)/2, keep the min-RTT sample). The value is stored on the track and used by `RECORDING_ASSEMBLE` alignment. Target is ±40 ms (verify with a clap test in QA).
  4. Stop: the host clicks Stop, metadata state becomes `'stopped'`, then every client stops its recorders, flushes and finalizes. Late or offline guests keep uploading from IDB later (the recovery window is 7 days, per `RECORDING_GC`).
  5. **Crash recovery:** if a guest reloads, `/join/[token]` detects IDB leftovers and resumes the upload before rejoining. Recording resumes into a **new track segment** (`source:'camera#2'`), which assembly concatenates with the gap filled by black/silence.
- **Upload health:** each client sends `publishData` JSON `{t:'up', pending, bytes}` every 5 s (reliable). The host's `RecordingBar` shows per-guest chips: green when synced, amber when pending > 6, red when offline.

### 6.6 Assembly + transcription
`RECORDING_ASSEMBLE` (D4) already handles N participants:
- per-speaker video + mic tracks, aligned;
- each mic track is transcribed separately and merged (speaker = guest display name, written into `SpeakerLabel`);
- the project opens in the Editor with a default **multicam "active speaker"** layout once D8 ships. Before D8 it opens as a grid layout with the existing layout presets.

### 6.7 Plan caps: `lib/record/plans.ts` (config only, NOT enforced)
```ts
// Modelled on Descript's published plan limits (https://www.descript.com/pricing). NOT ENFORCED until auth/billing exist.
export const RECORDING_PLANS = {
  free:      { recordingHoursPerMonth: 2,  maxParticipants: 10, producers: 0  }, // producers on Free: assumption (pricing page lists 3/3/10 for paid tiers)
  hobbyist:  { recordingHoursPerMonth: 5,  maxParticipants: 10, producers: 3  },
  creator:   { recordingHoursPerMonth: 15, maxParticipants: 10, producers: 3  },
  business:  { recordingHoursPerMonth: 25, maxParticipants: 10, producers: 10 },
} as const;
export type RecordingPlanId = keyof typeof RECORDING_PLANS;
export const RECORDING_LIMITS = { maxParticipants: 10, enforce: false as const };
export function recordingCapFor(plan: RecordingPlanId = 'free') { return RECORDING_PLANS[plan]; } // read-only helper; callers may WARN, never block
```
- `maxParticipants: 10` is used as a **room capacity guard** in the token route (a technical limit, not billing).
- Hours are shown as informational text ("Plan limit: 2 h/month, not enforced yet").
- A unit test asserts `RECORDING_LIMITS.enforce === false`, and that no route imports `recordingCapFor` to block.

### 6.8 Build-plan budget: estimates, verify in QA
- **Participant-minutes:** every connected participant counts. A 3-person 60-min session ≈ 180 participant-min, so the 5,000 free minutes ≈ 27 such sessions/month (arithmetic on the published allowance).
- **Downstream:** each participant receives the others' streams. With 540p simulcast + `adaptiveStream`, budget about 1–1.5 Mbps per received video. This figure is an assumption to confirm with LiveKit Cloud's dashboard during QA, not a LiveKit-published number. A 3-person hour is then about 3 × 2 × 1.25 Mbps × 3600 s ÷ 8 ≈ 3.4 GB, so 50 GB ≈ 14 such hours. Producers (audio-only) are negligible.
- **When the allowance runs out:** either upgrade to Ship (pricing above) or switch the env to self-hosted (Appendix A). There are no code changes either way.
- **Admin page:** `/app/record/rooms` shows "This month: N participant-minutes used (local estimate from RoomGuest join/leave)". This is an estimate only; the source of truth is the LiveKit Cloud dashboard.

### 6.9 Routes summary
| Route | Auth model |
|---|---|
| `POST/GET /api/record/rooms` | workspace (`resolveWorkspaceId`) |
| `GET/PATCH/DELETE /api/record/rooms/[id]` | workspace |
| `POST /api/record/rooms/[id]/rotate-invite` | workspace |
| `POST /api/record/rooms/[id]/token` | host, or a valid invite/producer token (public) |
| `POST /api/record/rooms/[id]/recordings` / `POST …/recordings/[rid]/stop` | host only |
| `GET /api/record/time` | public, returns `{ now: Date.now() }` |
| `POST /api/record/rooms/[id]/leave` | the guest itself (identity in body + invite token) |

Public routes are rate limited as in D4. Invite tokens can be rotated.

### 6.10 UI
- **Sidebar:** Create › Record has a sub-tab bar on `/app/record`: **Record** | **Rooms** | **Requests** | **Recordings**.
- **`/app/record/rooms`:**
  - a room cards grid (name, last used, a guests avatar stack);
  - "New room" `Dialog` (name, resolution, guest screen share toggle);
  - each card has Copy guest link / Copy producer link / Open.
- **Host room page:**
  - the stage;
  - a right `Sheet` with Guests (upload health chips, mute guest via `RoomServiceClient.mutePublishedTrack`, remove via `removeParticipant`), Chat/Comments (D6) and Notes;
  - a REC button `bg-lane-record`.
- **Guest page:** a minimal chrome with logo and room name, a "You're being recorded" banner when recording, an upload status line, and a "Don't close this tab until upload completes" `Callout` after stop.

### 6.11 Tests and acceptance
- **vitest:**
  - token route: host/guest/producer/forbidden/room_full;
  - the JWT payload's `video.room` equals `livekitRoom` (decode with `jose`);
  - identity is opaque (no display name);
  - ttl ≤ 600 s;
  - the env switch: set `LIVEKIT_URL` to two values and the response `url` follows;
  - `recordingCapFor` is never used to block.
- **playwright** (`e2e/d5-rooms.spec.ts`, needs `LIVEKIT_*` in the test env; skip if absent):
  - two browser contexts with fake media join the same room;
  - the host records 20 s and stops;
  - both upload; assembly makes a project with 2 speakers; the transcript has both names.
- **Manual QA:**
  - a clap test for sync (±40 ms);
  - pull the guest's network for 30 s mid-recording, restore it, and nothing is lost;
  - a guest closes and reopens the tab and recovery works;
  - Safari guest (mp4 MediaRecorder) + Chrome host mix assemble together.
- **Acceptance:**
  - local 1080p recording when the camera supports it (`getSettings().height === 1080`), regardless of live layer quality;
  - no Egress API is called anywhere (`rg -n "EgressClient" new-app` is empty);
  - swapping `LIVEKIT_*` to a self-hosted server (Appendix A) works with zero code changes.

---

## 7. D6: Rooms production tools + comments

### 7.1 Prisma (`d6_production`)
```prisma
model Comment {
  id            String   @id @default(cuid())
  workspaceId   String
  projectId     String?
  compositionId String?
  recordingId   String?
  authorName    String                                    // free text until auth exists
  body          String
  atMs          Int?                                      // time in recording/composition
  wordStartId   String?                                   // anchored to transcript word ids after transcription
  wordEndId     String?
  resolvedAt    DateTime?
  createdAt     DateTime @default(now())
  @@index([projectId, createdAt])
  @@index([recordingId])
}
```

### 7.2 Features
| Feature | Implementation |
|---|---|
| **Producers** (Descript: 3/3/10 per plan; config only) | Producer link → token with `hidden:true` and `canPublishSources:[MICROPHONE]`, so they are invisible on stage. **Push-to-talk:** the mic track publishes muted. Holding Space (or a button) calls `track.unmute()`. The producer sets `localParticipant.setTrackSubscriptionPermissions(false, [{ participantIdentity: hostIdentity, allowAll: true }])` so only the **host** hears them (talkback). Producers never get a local recording. |
| **Live captions** | Each participant runs the browser Web Speech API (`window.SpeechRecognition \|\| webkitSpeechRecognition`, `continuous`, `interimResults`) on its own mic where supported (Chromium). It broadcasts `publishData({t:'cap', text, final})` (lossy for interim, reliable for final). Unsupported browsers get no captions (graceful). **No paid STT for live captions.** |
| **Editor comments during recording** | Producers/host type notes and they are sent via `publishData({t:'note'})` and `POST /api/comments {recordingId, atMs}` (atMs = server-synced elapsed). After `TRANSCRIBE`, the worker job `ANCHOR_COMMENTS {recordingId}` maps each `atMs` to the nearest word id range (±2 s window) and sets `projectId`. In the editor they show as markers + a Comments panel. |
| **2-screen share** | `room.localParticipant.setScreenShareEnabled(true)` publishes one screen. A second screen uses `createLocalScreenTracks()` again, published with `name:'screen2'` and recorded as `source:'screen2'`. Limited to 2 per participant (UI enforces this). |
| **Scheduled rooms (.ics)** | `scheduledFor` + a "Download invite (.ics)" button generated server-side with the `ics` npm package (`createEvent({ start, duration, title, url: joinUrl, description })`; add the latest version, `pnpm add ics`). **No email sending.** The user copies the link or downloads the .ics. |

### 7.3 Comments everywhere (not just rooms)
- **Routes:**
  - `GET/POST /api/comments?projectId|compositionId|recordingId`;
  - `PATCH /api/comments/[id] {body?, resolved?}`;
  - `DELETE`.
- **Editor:** a `comments` rail tab (`MessageSquare`). Selecting words → "Comment" creates it with `wordStartId/wordEndId`. Comment highlights in the Script use `bg-warning/15 underline decoration-warning`.
- Because comments anchor to word ids, they **survive edits**; if a word is cut, the comment shows "on removed text".

### 7.4 Tests and acceptance
- **vitest:** comment anchoring (atMs → words), surviving cuts.
- **e2e (LiveKit env):** the producer is not visible in the guest's participant list; the guest cannot hear the producer (assert no remote audio track from the producer identity on the guest).
- **Acceptance:**
  - push-to-talk is audible only to the host;
  - live captions appear in Chrome;
  - notes taken during recording appear anchored in the editor transcript;
  - the .ics imports into Google Calendar.

---

## 8. D7: Design (compositor, compositions, transitions, color, layouts, Quick Design)

**Scope guard:** this is layout/compositing of the user's **own** media. It is not an "AI video studio" (no text-to-video scenes, no avatars).

### 8.1 Data (edits keys, optional; no new tables except `LayoutPack`)
```ts
// in ClipEditsV2 / Composition.edits
scenes?: { id: string; startMs: number; layoutId: string; transitionIn?: { kind: 'cut'|'fade'|'dissolve'|'wipeleft'|'slideup'|'circleopen'|'zoomin'; durMs: number } }[]
layers?: { id: string; kind: 'video'|'image'|'text'|'shape'|'captions'|'waveform'; srcId?: string; x:number; y:number; w:number; h:number; rotation?:number; radius?:number; opacity?:number; z:number; text?: string; style?: Record<string,unknown>; keyframes?: { atMs:number; x?:number; y?:number; w?:number; h?:number; opacity?:number }[] }[]
color?: { brightness?: number; contrast?: number; saturation?: number; temperature?: number; lutAssetId?: string | null }
```
```prisma
model LayoutPack { id String @id @default(cuid()) workspaceId String? name String builtIn Boolean @default(false) layouts Json createdAt DateTime @default(now()) }
```
Multiple compositions already exist from D1 (`Composition` × n per project). Add "Duplicate composition" (copy edits) and per-composition aspect (16:9, 9:16, 1:1, 4:5, audio).

### 8.2 Renderer
- **Preview:** a `<canvas>` compositor in `components/editor/compositor/canvas-stage.tsx`. It draws layers from `<video>`/`<img>` elements in `requestAnimationFrame` and interpolates keyframes linearly. Selection handles come from `react-moveable` (check its current version on npm before adding) or are hand-rolled with pointer events; choose hand-rolled if bundle size > 60 kB gz.
- **Final:** `worker/render/compositor.py` builds an ffmpeg `filter_complex`:
  - per layer: `scale`, `pad`, `overlay=x:y:enable='between(t,a,b)'`, with expressions for keyframes, e.g. `x='if(lt(t,a),x0,x0+(x1-x0)*(t-a)/(b-a))'`;
  - rounded corners via `geq` alpha masks or a pre-rendered PNG mask;
  - transitions via `xfade=transition=<kind>:duration=<s>:offset=<s>` between scene outputs;
  - color via `eq=brightness:contrast:saturation`, `colortemperature=temperature=` and `lut3d=file=`;
  - text layers are rendered as ASS (libass) for parity with captions.
- **Parity test:** render 3 frames with ffmpeg and with a headless canvas (playwright screenshot) and assert SSIM ≥ 0.9 (`ffmpeg -lavfi ssim`).

### 8.3 Layout packs + Quick Design
- **Built-in packs** (JSON in `lib/design/layout-packs/*.json`): Podcast 2-up, 3-up, Speaker + screen, Screen + bubble (4 corners), Full speaker, Title card, Audiogram. Each layout is a list of layer slots bound to roles (`speaker:active`, `speaker:1..n`, `screen`, `captions`, `logo`).
- **Quick Design** (`POST /api/design/quick {compositionId, aspect}`):
  1. sample 6 frames (worker `FRAME_SAMPLE`, or reuse the thumbnails sprite from `PROXY_MEDIA`);
  2. send them to Gemini `POST https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent` (header `x-goog-api-key: $GEMINI_API_KEY`, `inline_data` JPEG parts, `generationConfig.responseMimeType: "application/json"` + `responseSchema`);
  3. Gemini returns `{ layoutId, sceneBreaks:[ms], brandColors? }` chosen **only from the provided layout ids**;
  4. apply as scenes. Producer action: `quick_design {aspect}`.

### 8.4 UI
- **Sidebar Create › Design → `/app/design`:** layout pack gallery (preview thumbnails rendered from JSON) + "Apply to composition…" picker.
- **Editor rail:** a `design` tab (`Shapes`) with Scenes (list with layout pickers + transition `Select` + duration `Slider` 0.2–2 s), Layers (z-order list, visibility, lock), Color (sliders + LUT upload `.cube`) and a Quick Design button.
- The **Preview** switches to the canvas stage when a composition has `layers`/`scenes`.

### 8.5 Tests and acceptance
- **vitest:**
  - keyframe interpolation;
  - scene → filter graph string snapshot;
  - Quick Design rejects layout ids not in the pack.
- **pytest:**
  - each `xfade` kind renders;
  - `lut3d` with a sample `.cube`;
  - SSIM parity.
- **Acceptance:** a 3-scene composition with transitions previews smoothly and exports identically (SSIM ≥ 0.9), and duplicating a composition to 9:16 keeps edits.

---

## 9. D8: Multitrack sync, multicam, green screen

| Feature | Implementation |
|---|---|
| **Multitrack sync** (separately recorded files, e.g. a local mic + camera) | Worker `SYNC_TRACKS {projectId, assetIds[]}`: decode mono 8 kHz, onset-envelope (abs → 20 ms RMS), cross-correlate via `numpy.fft` against the reference, search ±120 s, offset = argmax. Confidence = peak / 2nd-peak; if < 1.5, flag it for manual nudge. Writes `edits.tracks[].items[].atMs`. UI: "Sync tracks" in the Timeline header with a manual nudge (±1 frame / ±10 ms). |
| **Multicam (active speaker)** | Per-speaker mic tracks (rooms) or diarization (single file) give speaker segments. Rule: switch to the active speaker after ≥ 1.2 s of speech, hold ≥ 2.0 s, show a wide/grid shot if overlap > 0.8 s or every ~45 s for variety. Producer action `auto_multicam {minHoldMs, wideEveryMs}` writes `scenes` with `layoutId` `speaker:active`/`grid`. Manual override: click a camera thumbnail at the playhead to insert a scene. |
| **Green screen (background removal)** | Self-hosted, **license-checked**. Use **MediaPipe Image Segmenter** (selfie segmentation model, Apache-2.0: verify the model card license in the PR) in the worker (`pip install mediapipe`) per frame → alpha mask → `alphamerge` overlay on a background (color, image, blur via `boxblur`). Job `BG_REMOVE {assetId}` writes a ProRes 4444 / VP9-alpha intermediate. **Do not** use Robust Video Matting (GPL-3.0) or any non-commercial model. Preview: a lower-res mask video. |

**Tests:**
- synthetic offset test (shift a fixture 3.217 s, detected within ±10 ms);
- multicam rule unit tests (hold/overlap);
- bg removal on a 3 s fixture produces an alpha channel (`ffprobe pix_fmt` has `a`).

---

## 10. D9: Web share pages (no social publishing)

- **Prisma `d9_share`:** `model ShareLink { id String @id @default(cuid()) workspaceId String exportId String? mediaExportId String? slug String @unique title String showTranscript Boolean @default(true) allowDownload Boolean @default(false) allowComments Boolean @default(false) views Int @default(0) expiresAt DateTime? revokedAt DateTime? createdAt DateTime @default(now()) }`.
- **Routes:**
  - `POST /api/share {exportId|mediaExportId, ...}` → slug (10-char base62);
  - `PATCH/DELETE /api/share/[id]`;
  - public `GET /api/public/share/[slug]` (signed media URL, 1 h);
  - public `POST /api/public/share/[slug]/comments` (rate limited, name + body, stored as `Comment` with `atMs`).
- **Page:** public `app/s/[slug]/page.tsx`, no auth, with `generateMetadata` for OG title/image (the thumbnail). It has:
  - an HTML5 `<video>` player with captions (`<track kind="captions" src=…vtt>`);
  - an interactive transcript (click word → seek, highlight current word);
  - chapters from markers;
  - optional download;
  - optional comments.
- It is **not** a social post: there is no posting to platforms, only a link the user copies.
- **Exports page:** a "Share" `DropdownMenuItem` per row → `Dialog` with toggles + Copy link + Revoke.
- **Tests and acceptance:**
  - a revoked or expired link returns 404;
  - the transcript click seeks;
  - the page works logged-out in a private window.

---

## 11. Explicitly deferred / out of scope (do not build, do not stub UI)
- **Out:**
  - NLE timeline export (FCPXML/XML/AAF/EDL/Premiere/Resolve);
  - lip-sync, avatars, eye contact (Phase 7 eye contact is "later");
  - team invites / roles / co-editing;
  - screenwriting;
  - AI video studio (text-to-video scenes, Wan 3.0 generative scenes beyond existing AI B-roll);
  - social publishing / scheduling to platforms;
  - marketing pages;
  - auth/login, credits, billing, plan enforcement.
- **Later (Phase 7, separate spec):** jump-cut smoothing, relighting, public API/MCP, desktop app, mobile app.
- **Hooks left in place:** `resolveWorkspaceId()` is used by every new route; `lib/config/costs.ts` has cost labels as config (not hard-coded); `RECORDING_PLANS` is config with `enforce:false`.

## 12. Environment summary (names only; never commit values)
| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | existing |
| `ELEVENLABS_KEY` / `ELEVENLABS_API_KEY` | D2, D3 dub, optional Scribe | read via `getElevenLabsKey()` that accepts either |
| `ELEVENLABS_TTS_MODEL` | D2 | default `eleven_multilingual_v2` |
| `KIE_API_KEY` (and existing `KIE_*`) | D3 images, existing AI B-roll (Wan) | keep the existing names; don't rename |
| `GEMINI_API_KEY`, `VISION_MODEL` | D7 Quick Design, existing vision | `VISION_MODEL=gemini-flash-lite-latest` |
| `LLM_MODEL` (existing var for `gpt-6-luna`) | D1 retakes/review, D3 | **never send `temperature`** |
| `PIXABAY_API_KEY` | stock | existing |
| `WHISPER_MODEL` / `WHISPER_MULTI_MODEL` | worker | `medium.en` / `large-v3` |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | D5, D6 | LiveKit Cloud Build now; self-hosted later (env-only switch) |
| `PUBLIC_BASE_URL` | invite/request/share links | e.g. `http://localhost:3100` in dev |

If an existing var name differs in `.env.example`, **keep the existing name** and update this table in the PR. Add every new name to `.env.example` with an empty value.

## 13. Test matrix (run per milestone PR)
| Layer | Command | Must pass |
|---|---|---|
| Types | `pnpm -C new-app tsc --noEmit` | 0 errors |
| Lint | `pnpm -C new-app lint` | 0 errors |
| Unit | `pnpm -C new-app vitest run` | all |
| Worker | `cd worker && pytest -q` | all, incl. `test_job_types.py` |
| Prisma | `pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` | additive only (no `DROP`, no `ALTER COLUMN … TYPE`); CI greps for these |
| E2E | `pnpm -C new-app playwright test e2e/d{N}-*.spec.ts` | all (LiveKit specs skip without env) |
| Regression | `pnpm -C new-app playwright test e2e/smoke*.spec.ts` + ui_polish §13 checklist F1–F6 | unchanged behavior |
| Secrets | `rg -n "(sk-|xi-api-key\s*[:=]\s*['\"][A-Za-z0-9])" new-app worker --glob '!*.test.*'` | no hits |

---

## Appendix A: Self-hosted LiveKit (later; env-only switch)

**Why it's an appendix:** Rick chose LiveKit Cloud Build to start. When the free allowance is outgrown, or to avoid per-minute charges, deploy this and change `LIVEKIT_URL/KEY/SECRET`. LiveKit server is open source under Apache-2.0 (https://github.com/livekit/livekit).

**Sources** (verified while writing):
- Deployment: https://docs.livekit.io/home/self-hosting/deployment/
- VM guide: https://docs.livekit.io/home/self-hosting/vm/
- Ports/firewall: https://docs.livekit.io/home/self-hosting/ports-firewall/
- Benchmark: https://docs.livekit.io/home/self-hosting/benchmark/

### A.1 Generate the config (recommended)
```bash
docker run --rm -it -v$PWD:/output livekit/generate
```
It produces `livekit.yaml`, `caddy.yaml`, `docker-compose.yaml` and redis config for a domain with TLS + TURN/TLS. Prefer this output, and use the files below only as a reference.

### A.2 `deploy/livekit/docker-compose.yaml` (reference)
```yaml
services:
  livekit:
    image: livekit/livekit-server:v1.13.11
    command: --config /etc/livekit.yaml
    network_mode: host            # required for WebRTC UDP port range
    restart: unless-stopped
    volumes: [ "./livekit.yaml:/etc/livekit.yaml:ro" ]
    depends_on: [ redis ]
  redis:
    image: redis:7-alpine
    network_mode: host
    command: redis-server --bind 127.0.0.1 --port 6379
    restart: unless-stopped
  caddy:                          # TLS for wss://lk.example.com and turn.example.com
    image: livekit/caddyl4        # image used by livekit/generate; keep whatever the generator emits
    command: run --config /etc/caddy.yaml --adapter yaml
    network_mode: host
    restart: unless-stopped
    volumes: [ "./caddy.yaml:/etc/caddy.yaml:ro", "./caddy_data:/data" ]
```

### A.3 `deploy/livekit/livekit.yaml` (reference; secrets come from the env/secret store, never committed)
```yaml
port: 7880
bind_addresses: [ "" ]
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
redis:
  address: 127.0.0.1:6379
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}   # render with envsubst at deploy time
turn:
  enabled: true
  domain: turn.example.com
  tls_port: 5349
  udp_port: 3478
  external_tls: true          # Caddy terminates TLS for TURN/TLS on 443 → 5349
room:
  max_participants: 20        # ≥ guests (10) + producers + host
  empty_timeout: 300
logging:
  level: info
```
TURN is built in (no separate coturn needed). coturn is only an option if you later want TURN on separate hosts.

### A.4 Firewall (from the ports doc)
| Port | Proto | Purpose |
|---|---|---|
| 443 | TCP | HTTPS/WSS signaling via Caddy + TURN/TLS |
| 7880 | TCP | API/WebSocket (behind Caddy) |
| 7881 | TCP | WebRTC over TCP fallback |
| 7882 | UDP | WebRTC UDP mux (if `rtc.udp_port` is used instead of the range) |
| 50000–60000 | UDP | WebRTC media |
| 3478 | UDP | TURN/UDP |
| 5349 | TCP | TURN/TLS (if not fronted on 443) |

### A.5 Sizing
- **Published benchmark:** a c2-standard-16 handled 150 publishers / 150 subscribers at 720p using about 50 MBps in / 93 MBps out at about 85 % CPU.
- **Our load** is far lighter: ≤ 10 publishers per room, live layers ≤ 540p, audio-only producers.
- **Estimate:** 4 vCPU / 8 GB with ≥ 1 Gbps NIC for roughly 5–8 concurrent rooms of 3–4 people. This is an extrapolation, not a LiveKit figure; load-test with `lk load-test` (LiveKit CLI) before relying on it.
- **Egress traffic:** per room ≈ N × (N−1) × per-stream bitrate. Budget it from the provider's bandwidth pricing, and check that before committing.

### A.6 Cut-over checklist
1. Deploy and get DNS + TLS green.
2. `lk room list --url wss://lk.example.com --api-key … --api-secret …` from a dev machine (keys via env, not shell history).
3. Set `LIVEKIT_URL/KEY/SECRET` in staging and run `e2e/d5-rooms.spec.ts` + the manual clap/sync test.
4. Flip production env.
5. Keep the Cloud project for 1 week as rollback (env revert only).
