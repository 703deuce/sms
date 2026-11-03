# Multi-source representation (M0 decision)

**Decision:** For v1, multi-source runs use the **script composition EDL** model
(`lib/clips/script-edl/types.ts`) when more than one distinct upload/source is involved,
so every segment can carry its own transcript/caption words via `media_words` / per-source
transcription jobs. Single-source runs use normal `ClipEditsV2` on one main trim.

**Rationale:** E5 `sourceSegments` on a single main transcript does not guarantee captions
for non-main angles; script composition is the supported multi-clip storyline path in the editor today.

**Captions:** Each EDL source segment must have words loaded (existing upload transcript or
`MEDIA_TRANSCRIBE` before apply). The validator rejects plans that reference sources without words.
