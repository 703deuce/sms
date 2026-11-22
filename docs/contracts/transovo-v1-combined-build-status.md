# Transovo V1 — combined build order and implementation status

Source of truth: customer briefs \`CHATGPT_COMBINED_V1.md\` and \`BYO_V1_GAP_AUDIT.md\`, November 22, 2026. App-side work only. Do not change producer skill files or silently enable footage-minute charging.

## Product freeze

One Create Video hub, four public starting choices (Create with AI, Edit My Footage, Create Clips, Audio to Video), one shared editor. V1 footage editing is a *full* footage-led edit with original sources, cuts, titles, captions, transitions, graphics, music, and optional voiceover stored and reopenable. “Clean Up” remains an editor tool, not a fifth product. Keep full effects internally; hide advanced controls by default.

## Dependency-ranked implementation

| Rank | Priority | Items | Required exit gate | This build band |
|---|---|---|---|---|
| 1 | Blocker | B0 + eight section-2 bugs | Film and clipper invariants preserved; finish_clip edits-only works; correct voice and audio, preview, capacity | Partial |
| 2 | Blocker | A6 + A5 | A film opens with real independent editable source/graphic/audio/grade tracks; save/reopen/export parity | Not done |
| 3 | Blocker | B1 | Versioned per-upload Deepgram/shot/sync/quality analysis, stored exactly once and shared by producer, DOC_PLAN, and editor | Not done |
| 4 | Blocker | B2–B4 | Structured brief, footage-led story plan, per-segment source/VO/card choices and selected voice | Brief fields done; planning/VO not done |
| 5 | Blocker | B5 | One native ClipEditsV2 timeline from multiple uploads, with overlays/captions that span every source | Not done |
| 6 | Blocker | Create hub + Screens 1–6 + B12 | Responsive file intake, plain progress, checkpoint review, native live preview/editor and export | Hub and intake complete; result screens reuse old path and require native engine |
| 7 | Blocker | B6 + B7 | Long source chunking, multi-camera sync and order, cut-precision, repeated takes, up to three-hour editable result | Not done |
| 8 | Blocker | B9 + A7 | Scope-aware reversible chat/editor commands that retain manual edits | Not done |
| 9 | Important | A1 + A2 + A9 | Director's note, goal/audience, checklist and style identity stored per version | Goal/audience fields only |
| 10 | Important | A3 + A4 | Long/many-file capacity, beat/laugh/pause-aware cuts, source-index search, stored transitions | Not done |
| 11 | Blocker | B10+B11+B14 | Live preview, selected aspect/quality, parallel long export, idempotent recovery and no stuck jobs | Partial clipper fixes only |
| 12 | Launch | B15 + section 4 | Licensed test matrix, measured audio, render parity, timing and injected failures | Not run |
| 13 | Hold for approval | B13 + A8 | Display footage-minute estimate; only enable charging after explicit customer decision | UI estimate only, no charges |
| Later | Deferred | B8, avatars, Clean Up product, cartoons, live streaming, template marketplace, full AE UI, performance loop | Not V1 | Deliberately excluded |

## App-side paths

- **Film/clipper bug band:** \`new-app/lib/clips/edits.ts\`, \`worker/clips_worker/edits_render.py\`, \`render_job.py\`, \`render_concurrency.py\`, \`motion_studio/pipeline/narration.py\`, \`new-app/lib/server/clips/{agent-finish,producer-server-render,renders}.ts\`, \`app/api/clips/projects/[id]/agent-discover/route.ts\`.
- **Editable film foundation:** \`new-app/lib/motion-studio/editor-timeline.ts\`, \`new-app/lib/motion-studio/producer-project-adapter.ts\`, \`new-app/lib/server/motion-studio/service.ts\`, \`worker/clips_worker/motion_studio/pipeline/editor_stems.py\`, \`new-app/lib/clips/edits.ts\`, the portable project contract.
- **Single shared analysis:** clip upload/media tables, \`producer_transcribe_job.py\`, \`media_transcribe_job.py\`, \`media_sync_job.py\`, shot/footage-watch/audio-analysis worker, \`motion_studio/pipeline/analyze.py\`, producer input APIs.
- **BYO native EDL and segmented render:** native \`ClipEditsV2\` source/inserts, scene overlay timing, \`worker/clips_worker/render_job.py\` and \`edits_render.py\`; new segment/assembly queue workers modeled after \`MGD_RENDER_SEGMENT\` + \`DOC_ASSEMBLE\`.
- **UI:** \`new-app/app/app/page.tsx\`, \`app/app/edit-my-footage/page.tsx\`, \`components/motion-studio/byo-create.tsx\`, project status/checkpoint screens, \`components/clips/editor/editor-shell.tsx\`, simple/advanced panels, \`editor-chat-rail.tsx\`, export dialog and progress.
- **Reliability:** lease/coordinator, deduped upload records, object storage, clip render status and completion, per-file error display, locked idempotent project start.

## Implementation in this partial band

1. Discovery endpoint clip cap 15→30.
2. Loudness target preserved as a numeric setting (including -15 LUFS); two-pass final mix applied for enabled leveling with true-peak target safety margin.
3. Film narration prefers an explicitly validated brief voice ID over environment voice name. Explicit source/quote lines are not sent to paid TTS, with a no-TTS fallback for footage-only stories.
4. Producer server preview sized on the short side (9:16 ~480×854; landscape ~854×480); job slot default scales with CPUs while respecting WORKER_CONCURRENCY override.
5. Standalone clip revision job accepts edits-only POST /renders and GET status, and can complete after its one render finishes without a locally uploaded MP4.
6. Producer render ownership is persisted before enqueue, preventing the worker from finishing before the active render pointer exists; render status polling does not launch paid work.
7. Four-entry Create home with older tools under More.
8. Dedicated Edit My Footage upload/brief screen with multi-file/folder upload, per-file status and retry, order and roles, goal/type/VO/length/shape/captions/music/plan-review options, and footage-minute estimate. It currently submits through the existing Motion Studio footage API, which still needs the native EDL work above.
9. Brief and project settings store the new optional direction/VO/review/goal/audience/CTA values. No billing actions.
10. Audio-to-Video entry selects the existing audio narration path instead of labeling customer audio as background music.

## Finish band (Nov 22, 2026): wire V1 into the existing editor

Direction from Rick: do not build a new editor, timeline engine, render graph or track system. Every V1 workflow lands in the existing Compact Editor through the existing film→editor handoff. The native-track redesign proposed for A6 is dropped.

How each workflow reaches the Compact Editor now:

- **Create with AI**: unchanged. `motion-studio-create.tsx` → `POST /api/motion-studio/agent/jobs` → Transovo Agent live delivery → `service.ts ensureEditorClip` / `editor-timeline.ts buildLiveMotionStudioEditorEdits` → `/app/video-editor/.../edit/...?motionStudio=` (Compact Editor with Motion Studio lanes, live canvas and agent chat).
- **Edit My Footage**: `byo-create.tsx` now starts the **same** agent job as Create with AI (it previously called the app `DOC_PLAN` pipeline, which cannot run these projects: they are created with `director:'creative'`, which the worker registry does not know). `byo-project.tsx` reuses `AgentJobPanel` (progress, preview, download) and `AgentChatPanel` (plan check, change requests, versions) and opens the Compact Editor with `?mode=simple&motionStudio=`.
  - Shared footage analysis: on create, every camera file is transcribed once with the clipper's existing `MEDIA_TRANSCRIBE` job (`queueMediaTranscript`, Deepgram with speakers) on the editor's clip project. The agent assignment returns each input's transcript; the editor's caption path reads the same rows.
  - Brief: direction, optional script, voiceover none / occasional / mostly, the selected voice (existing `CreatorVoicePicker`) or the customer's voiceover recording, captions, music, shape, length (including "as long as it needs" and 30/60 min), file roles (main footage, another camera angle, B-roll) in the customer's order.
  - The assignment carries footage-specific delivery instructions (footage as the asset pool, use app transcripts, voiceover amount and ducking, each used clip as its own footage layer, plan check when requested). No skill files were changed.
- **Audio to Video**: `MotionStudioCreate audioStart` now defaults narration to the customer's recording (`uploaded_narration`), so it is never replaced by AI voice. Same agent job and editor handoff as Create with AI.
- **Create Clips**: unchanged clipper path into the clip editor (≤30 clips, count from good clips).
- **AI changes in the editor**: existing paths only. Motion Studio projects use `AgentChatPanel` → `submitAgentRevision` (revision job carries `manualTimeline`, so manual edits are kept); native clips use `editor-chat-rail.tsx` in-place proposals with Accept / Undo.

Other changes: `FEATURE_BYO_V1` is on by default (`FEATURE_BYO_V1=0` turns the hub off). The ChatGPT-added test files were removed (no test gates). No migrations, no new env vars, billing off.

## Unmet acceptance checks — do not represent V1 as complete

- Native per-file analysis and once-only transcription shared by all consumers.
- Film master decomposed into independently editable tracks; multi-source overlay/caption parity.
- BYO footage-plan checkpoint with reordering, voice line edits, and speaker names.
- Long 30–60 minute timeline segmented render and changed-segment reuse.
- Targeted AI camera/range/VO/section editing with undo and manual-change preservation.
- Five original-licensed footage scenario runs and failed-worker injection.
- Rendered output -15/-14 LUFS and true peak verified by ebur128 (no samples run in this change).
- Billing approval and reconciliation.

Still open after the finish band (not built, by decision or because it needs producer-skill approval):
- Segmented parallel export of 30–60+ minute edits (`RENDER_CLIP` still renders one edit per job).
- Producer-skill rules for Edit My Footage (the skill's intake length cap, footage-led planning, voiceover-amount handling) need Rick's approval; the assignment instructions cover them meanwhile.
- Audio measurement (ebur128) happens in Rick's real-footage tests.

No changes to producer skill files. No tests were run; Rick tests with real videos on the site.
