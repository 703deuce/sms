# Real video templates — Batch 3 representation and migration boundary

## Production representation

Batch 3 uses the existing ClipEditsV2 editor/render contract. It does **not** add a proprietary
player, appended inserts, or a flattened user-media MP4.

- A purpose-generated neutral black/silent carrier supplies the complete 30fps output clock.
  Template carriers may be photo-only; no sacrificial video upload or ASR is required.
- Each authored slot is a normal `sourceSegment` spanning carrier/source time and is also bounded
  by ordinary `videoSplits`. Those are the same Video-lane items used by Compact and the full
  Timeline.
- Slot media time is explicit: `inMs + source-clock delta * speed`. Fixed slot duration is
  independent of the source playback rate.
- Per-slot fit, position/scale/rotation/crop and the supported brightness/contrast/saturation look
  are persisted on the source segment. Browser preview and the shared clips worker normalize the
  same fields.
- Incoming cross-source transitions are ordinary `edits.transitions` records at the matching
  Video split. Source-handle requirements are declared and validated before publish. Preview
  clones and worker export both read A/B frames directly from the registered source media;
  unsupported transition types are rejected rather than downgraded.
- Text and trusted built-in graphics remain ordinary `textItems` on the output clock. Music remains
  `audio.music` and can span/loop across the full sequence. Neither is embedded in slot footage.
- `templateProvenance` is non-authoritative lineage only. Source segments, transitions, text,
  tracks and audio are the editable/rendered truth. Provenance survives normalizers but is excluded
  from render-cache hashing.

Existing clips with no template provenance keep the legacy source-segment/transition behavior.
Existing insert behavior is unchanged and templates never use inserts.

## Versioned definitions and snapshots

Family/design JSON is strict and DATA-only. Definitions contain no JavaScript, React, arbitrary
remote URLs, or executable render expressions. Validators reject unknown fields/capabilities,
oversized budgets, missing slots, short media/handles, overlapping transition windows and invalid
rights metadata without silently clamping or dropping authored content.

Published projects snapshot the validated family/design revisions in the clip's existing `aiMeta`.
Updating a catalog definition later cannot change that project's snapshot. Deterministic IDs derive
from instance + immutable family revision + source/slot/layer role.

## Transactional publishing — no migration

Batch 3 adds no database table or migration. A serializable transaction uses the existing
`clip_uploads`, `clip_projects`, `clip_project_media`, `clips` and `clip_jobs` tables to:

1. verify every selected upload belongs to the workspace and is complete/compatible;
2. create the neutral carrier upload/project;
3. register all selected media and music;
4. create one preseeded full-video clip containing the compiled editable timeline; and
5. queue the existing PROCESS_PROJECT path with an exact-frame template-carrier flag.

Deterministic project/clip/job IDs make retries idempotent. The worker's existing
`preseededFullVideo` path enriches that same clip instead of creating a competing timeline.
Authoring choices are stored separately in `aiMeta.videoTemplate.authoringState` with an optimistic
authoring version; saving those choices never regenerates over Compact/Timeline edits. Cancellation
only cancels pending carrier work. Unknown or foreign media is reported generically as not found.

## Proof and regression boundary

Automated Batch 3 tests cover deterministic compile, exact frame count, output/item/source mapping
(including repeated sources and per-slot speed), photo-only and mixed inputs, 30 slots, full-span
text/music, source-vs-muted video audio, short-video/handle rejection, legacy absent-field
normalization, Compact/full-Timeline slot representation, transaction/idempotency/CAS behavior and
cache-hash isolation.

The worker FFmpeg regression runs the production helpers: an exact-frame neutral carrier,
photo/video/photo source slots, a cross-source transition sourced from real A/B handles, per-slot
transform/FX/speed, source audio, a full-span Text-lane item and looping full-span music. It asserts
frame count/duration and audio/video output. A second fixture proves a 73-frame carrier exactly.

Worker files changed in Batch 3:
- `worker/clips_worker/blank_project.py`
- `worker/clips_worker/media_sources.py`
- `worker/clips_worker/edits_render.py`
- `worker/tests/test_real_video_template_sequence.py`

## "Analysis errored" investigation

The earlier visible proof error was not a product analyzer failure. A one-off notebook command tried
to write into `/mnt/data/tv-proof`, a path already owned by an uploaded attachment, and FFmpeg
returned `Permission denied`. Repository search found no product code emitting "Analysis errored".
All committed proofs use an isolated temporary directory (`mktemp` / pytest `tmp_path`) so file
ownership from uploads cannot collide with generated proof media.
