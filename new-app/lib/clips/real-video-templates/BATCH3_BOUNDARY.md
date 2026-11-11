# Real video templates — Batch 3 sequence boundary (2026-11-11)

## Status: production representation implemented

Batch 3 uses the existing ClipEditsV2/editor/export stack rather than a parallel player or a flattened
template movie. A template compiles to ordinary editable lanes on a neutral, silent, exact-frame
carrier. The carrier is only the source/output clock; user photos/videos remain registered media and
are editable after publishing.

The implementation is intentionally opt-in through template provenance. Legacy clips with no template
provenance retain their existing normalization, timeline, preview, cache-hash and worker behavior.

## Authoritative representation

- Family/design definitions are immutable revisioned JSON. Unknown fields, unsupported operations,
  invalid rights metadata and budget overflow fail closed instead of being clamped or dropped.
- The authored sequence is a gap-free 30fps frame clock. `sequence-timebase.ts` maps output frame,
  item-local frame and media frame exactly, including repeated-source ambiguity.
- Each media slot compiles to a real `sources` + `sourceSegments` Video-lane record, with a seeded
  stable item ID, media in-point, fit, source-audio policy, per-slot transform and per-slot FX.
- Slot boundaries compile to ordinary `videoSplits`. Supported cross-source transitions compile to
  ordinary `transitions` records; required A/B source handles are validated and transition windows
  may not overlap.
- Text/shape layers remain `textItems`; music remains the normal `audio.music` lane. Their authored
  time ranges are not burned into slot media, so full-sequence overlays/audio survive every slot.
- `inserts` are not used for template assembly.
- `templateProvenance` is non-authoritative lineage/slot lookup only. It survives edit
  normalization/patching but is excluded from render cache hashes.

## Preview and editor parity

- PreviewStage resolves the same source segment, media time, fit, transform and FX used by export.
- Transition A/B clones are pinned to the outgoing/incoming slot at the split and seek the registered
  source handles instead of cloning the carrier frame.
- Compact draws every slot over its existing 44px Video filmstrip and selects it through the existing
  Media inspector; no Compact geometry changed.
- Full Timeline uses the existing source-segment Video-lane filmstrips/selection and transition
  handles. Slot records remain editable after template creation.
- Authoring state is metadata only after publish. Normal editor saves remain authoritative and are
  never regenerated from the template snapshot.

## Worker/export parity

Required shared-clips changes are limited to:

- `worker/clips_worker/blank_project.py` — exact authored 30fps neutral carrier generation.
- `worker/clips_worker/media_sources.py` — mirrored source-segment transforms/FX and direct
  cross-source transition windows rendered from the registered A/B media handles.
- `worker/clips_worker/edits_render.py` — prevents template source transitions already consumed by
  the source adapter from being rendered a second time.
- `worker/tests/test_real_video_template_sequence.py` — low-resolution FFmpeg/ffprobe proof for
  exact frames, mixed photo/video slots, source transforms/FX, a cross-source transition,
  full-span text and continuous music/audio.

The production path keeps text and music after source composition; no slot footage is flattened into
the carrier.

## Transactional publishing boundary

`publishTemplateProject` creates a NEW workspace-owned full-video project only. Inside one
Serializable transaction it validates all selected COMPLETE uploads, registers project media, stores
the compiled editable ClipEditsV2 payload and pinned family/design snapshot, creates the exact-frame
carrier upload record, and queues the existing PROCESS_PROJECT worker path.

IDs are deterministic from workspace + idempotency key. A retry returns the original project when the
pinned definition matches and conflicts when it does not. Foreign/missing media returns a non-leaking
not-found style failure. Mid-transaction failures expose no partial project. Cancellation stops pending
carrier work without deleting the user's timeline.

`saveTemplateAuthoringState` uses an optimistic authoring version in clip metadata. It does not
rewrite `clips.edits`; Compact/Timeline edits remain authoritative.

No Batch 3 database migration is required.

## Regression gates

The existing Editor QA workflow now runs:

- deterministic compiler/validation/timebase/legacy-golden tests,
- transactional publish/idempotency/ownership/CAS/cancellation/rollback tests,
- Compact + full Timeline slot-editor regressions,
- a scoped real TypeScript compiler gate covering every Batch 3 web/API integration,
- the FFmpeg worker sequence parity test above.

The standalone 2-slot and 30-slot proof scripts remain as reproducible offline fixtures.

## Intentional boundary for later batches

Batch 3 does not create a React component per template, a proprietary timeline/player, arbitrary
executable template code, arbitrary remote asset URLs, or a new render service. The transition set is
limited to the types proven through the shared browser/FFmpeg transition math; unsupported types are
rejected rather than silently downgraded.
