# Real video templates — Batch 3 sequence boundary (2026-11-11)

## Status: experimental, NOT launchable
The data-contract and compile prototype are intentionally not connected to project creation, PATCH,
ClipEditsV2 save, preview, export, or customer-facing template lists. `renderable: false` is a
hard gate. No generated carrier is uploaded to customer projects. No migrations.

## Proven representation
- Immutable family/design snapshots addressed by (ID, revision); family output slots are a
  gap-free, zero-based 30fps frame clock. Source choices use trusted registered IDs plus
  explicit license metadata. Validation fails closed on unknown operations and oversized
  inputs, without clamping or silently truncating.
- Deterministic per-instance slot/source/text identifiers and a v1 sequence manifest record
  output frame positions and media in-points. Ordinary ClipEditsV2 sourceSegments/textItems/audio
  are produced as **a prototype only**, not persisted.
- Existing sourceSegments use main-source times; a purpose-made neutral silent carrier is
  required to hold the entire output clock. Existing `inserts` are NOT used.
- `scripts/prove-real-video-template-carrier.sh` demonstrates a neutral silent carrier,
  one still-photo span, one video span, a single text overlay spanning both, and continuous
  music. It asserts exact 60-frame / 2-second output with FFmpeg and ffprobe. This demonstrates
  only an isolated filtergraph approach; it is NOT the worker implementation.

## Not proven — do not enable
1. No shared opt-in sequence adapter in current ClipEditsV2 preview/export pipeline.
   SourceSegments are normalized as main-time replacement video spans; the worker currently
   renders replacements differently from the FFmpeg fixture. It is NOT proven that all overlay
   lanes and audio remain continuous through a photo-only first project.
2. Cross-source dissolve/blending, per-slot transform and speed, source/output/item-local
   timing roundtrip and transitions are not proven or enabled. Only `cut` is valid in v1.
3. No permission-checked asset resolver or ownership-bound new project creation. The JSON
   asset/license object is an assertion supplied by the caller, not a substitute for the DB's
   ownership and rights checks.
4. No transactional template-instance persistence, idempotent creation, cancellation,
   CAS write integration, live editor roundtrip, or versioned snapshots in the DB.
5. No production end-to-end render test, worker changes, preview/export parity or CI build
   verification in this branch. Zero worker files changed.

## Future migration boundary
Introduce a versioned, opt-in **sequence** representation in the existing normalization,
preview and shared-clips worker export adapter. Explicitly map media-in vs output frames.
Keep existing sourceSegments/inserts and all absent legacy fields unchanged when the opt-in
flag is absent; old cache hashes remain untouched. Reject unsupported transitions, never
silently downgrade to hard cuts. Verify 1 photo, 30 slots, all-source audio modes, speed,
layered text and continuous music in both preview and final exported media, then enable
new-project-only transactional template creation. Do NOT wire the prototype into saves
before that validation.


## Additional B3 verification after merging master aeb973bb (#1177)
- `sequence-timebase.ts` explicitly maps output → item-local → media frames, and returns
  every matching output for repeated media rather than guessing a unique position.
- `tests/clips/real-video-templates-b3.test.ts` runs through the existing
  editor regression's `batch5-template-full-video.test.tsx` import and covers
  exhaustive 30-slot frame roundtrips.
- `scripts/prove-real-video-template-30-slots.sh` is a second, no-network FFmpeg
  fixture. A matching 160×90, 30fps filtergraph was executed locally and
  ffprobe confirmed exactly 900 frames, 30.000000 seconds, with video and audio.
  This exercises repeating photo/video sources, one full-span text graphic
  and a full-span music channel. It does not exercise worker/preview parity.
- Worker `edits_render.py` applies `apply_full_render_sources` to the base
  before color/cut and before `_legacy_compose` burns text, so the
  full-length-carrier architecture has a plausible existing cut-only path.
  The code path still has no proven cross-source dissolve/individual transforms.
