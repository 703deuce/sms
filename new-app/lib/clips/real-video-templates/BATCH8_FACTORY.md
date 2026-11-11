# Batch 8 — deterministic first-party video-template factory (DRAFT, not release-certified)

## What is implemented

The Batch 8 source lives in `b8-authoring-catalog.ts`, `b8-factory.ts` and
`new-app/scripts/template-factory.ts`. It uses **the exact Batch 3
TemplateFamilyV1 / TemplateDesignV1 / ClipEditsV2 compiler**, Batch 2B vendored
font allowlist, Batch 6 source playback and Batch 7 declarative primitives.
It does **not** add another editor timeline, renderer, database migration,
external rendering service, public community format or automatic publication.

The source includes 50 **provisional** structural schedules (F01–F50),
25 explicit curated core recipes and 15 separately authored alternatives.
Each family × design creates one pinned, deterministic **draft candidate**,
for **2,000 candidates**, not 2,000 renders/releases. Alternates change
font pair/hierarchy, placement, motion and graphics — not merely palette,
resolution or soundtrack. F50 has 30 authored clip slots. All families and
variants must retain individual `familyId`, `designId`, `revision`,
content hashes, frame positions, source handles and native text/graphic
animation paths. The generator does not modify existing saved projects.

**Original 50 family source schedules and roles were not found in the
repository** at the start of Batch 8. The currently checked-in ones are
explicitly marked `provisional` and cannot be released until reconciled
with the coordinator's authoritative F01–F50 authoring files. The first
10 listed families retain the F01–F10 anchor order. No fabricated
CapCut/Canva comparisons, render reviews, licensed demo footage, QA scores,
view counts, or previews were inserted into the public gallery.

## Run in new-app

```sh
cd new-app
pnpm templates:b8 author
pnpm templates:b8 expand
pnpm templates:b8 validate --all
pnpm templates:b8 benchmark

# Once independently owned/cleared photos AND videos are registered in the
# fixture manifest with exact SHA-256, durations and legal source records:
pnpm templates:b8 preview f01_bold --fixtures build/real-video-templates/b8/fixtures.json
pnpm templates:b8 jobs --fixtures build/real-video-templates/b8/fixtures.json --shards 16
# Prepare all queued candidates (or --shard 0 ... --shard 15 in parallel):
pnpm templates:b8 prepare-shard --all --fixtures build/real-video-templates/b8/fixtures.json
pnpm templates:b8 claim f01_bold
# The EXISTING app/worker produces the actual QA MP4 and poster; the CLI
# preview command only produces a native edits/asset render-request JSON.
# NEVER describe the render request as a playable MP4 or golden-frame proof.
pnpm templates:b8 quality-report
pnpm templates:b8 contact-sheet
pnpm templates:b8 release-manifest
```

The CLI output defaults to `build/real-video-templates/b8`. Do not commit
generated QA videos, uploader credentials, user media, or rendered output
blindly. JSON input is untrusted: no arbitrary code, inline React, remote
asset URLs, executable templates or unhashed source bytes are accepted.
User/private templates continue through the **Batch 15 user-template
contract**, not through a new public upload format. Public moderation and
sanitization remain owned by Batch 15; the first-party release gate does
not silently promote user uploads.

## Real-media fixture schema

Create `fixtures.json` with `v:1`, a pinned `rendererRevision` and
`media` entries containing: unique local `id`, `kind` (`image` or
`video`), local `path` below `new-app/public/`, actual file `sha256`,
`durationFrames` for clips (verified at 30 fps), and a license object
`{id,provenance,reference}`. At least one independently licensed photo and a long enough video for
an authored slot plus handles must exist. For a full-motion preview the
manifest now also requires `soundtrack: {asset,path,sha256,decision}`.
`asset` is the registered audio TemplateAsset and `decision` is the
existing Batch 5 music decision with pinned beat schedule and explicit
commercial/export license. Source bytes, measured duration, music identity,
rights and schedule must agree. Repeated sources and all-photo cases should
also be checked separately. No fixture is automatically granted commercial
redistribution rights.

The preview command maps media to native source segments, compiles through
the existing Batch 5 music-aware template compiler and writes the authoritative
expected timeline/worker input plan with a separate pinned soundtrack lane. The actual MP4 must be rendered through
the existing preseeded project/FFmpeg worker and returned as a local
`renderMp4`; a false success flag or placeholder cannot create a release.
A local playable MP4 cannot be generated from unregistered or absent
fixture content.

## Evidence and quality stages

Record one evidence entry per exact design ID in `evidence.json`, pointing
to the existing **real** preview MP4, export MP4 and poster, each with a
verified SHA-256 under the public media root. Evidence also requires:
a legally viewable same-type CapCut or Canva reference URL and access date,
licensed image and video fixture IDs and source hashes, editor/reviewer/date,
per-dimension scores, frame/black-frame checks, actual audio/duration
alignment, glyph/contrast/safe-zone/layer retention checks, preview/export
parity, and the explicit `actualWorkerRender` flag.

The 10-point weighted rubric is:

| Dimension | Max points | Minimum normalized score |
| --- | ---: | ---: |
| Pacing | 2 | 4/5 |
| Beat/semantic timing | 2 | 4/5 |
| Transitions | 1.5 | 4/5 |
| Typography | 2 | 4/5 |
| Motion | 1.5 | 4/5 |
| Color | 1 | 4/5 |

No design is eligible below **9/10**, below **4/5** in any dimension,
or on any required failure (rights, first/last/boundary black frames,
audio/video mismatch, lost editable layers, flashes, missing glyphs,
bad safe zones). Every first-ten **anchor** (`f01_bold` through
`f10_bold`) requires full review AND a different independent reviewer
before any other design is released. Every later family must have its
full-quality anchor approved before its remaining 39 can release.
Review all 40 treatments in motion, independently audit at least 10%
of valid variants, every core/alternate style and any flagged design.
Do not treat a compiler-only test or a CSS box as rendered-frame proof.

Quality output reports separate counts for `defined`, `generated`,
`previewed`, `autoRenderPass`, `editorReviewed`, `released`,
`familyCount`, `designCount` and `community`. The target remains
2,000 and any unavailable variants stay gated rather than being counted.
`release-manifest` writes a **local build manifest**, never
`releases.ts`, so the coordinator controls production publication.

## Deterministic job checkpoint and budgets

`jobs` uses `definitionHash + pinned font manifest revision +
fixture media hashes + renderer revision + engine revision` for the
cache key. A stable hash assigns each candidate to one of 1–256 shards.
The local checkpoint supports claim, fail, retry, resume and cancel for
unclaimed work. It rejects more than two concurrent claims and caps each
job to three attempts; suggested per-job limits are 2 CPUs, 4 GiB RAM,
8 GiB scratch. A filesystem lock stops concurrent checkpoint mutations.
Do not falsely cancel a claimed/running worker job; that requires actual
worker cancellation and acknowledgment. Completed jobs require verified
render evidence and human scores, not a manually set flag.

The renderer queue is a **job manifest for the existing worker adapter**.
It does not impersonate worker success or bypass the app's render jobs.
Once actual preview/export MP4s are attached as evidence, `qa-media` and
`qa-all` decode **every output frame at 30 fps** through FFmpeg, compare
preview/export RGB frames, check first/last and every cut boundary for
black frames, detect rapid flash reversals, verify audio streams and compare
decoded soundtrack envelopes. Structural compilation counts never satisfy
real-render or reference-review requirements.

## Add a new family or treatment

1. Add a numbered **explicit** role+duration schedule in
   `b8-authoring-catalog.ts`, after reconciling it with coordinator data.
   Keep contiguous 30 fps frames, legal media source handles, aspect-safe
   layouts, immutable IDs and revision numbers.
2. Add a **curated** style record with verified pinned browser/worker
   font pairing, placement, font sizes, graphic shapes, actual native text
   animations and a Batch 6-supported transition. For an alternate,
   change at least three independently visible dimensions from its parent.
3. Run `validate --all`, the Batch 8 Vitest suite, scoped compiler
   tests and the full TypeScript check. A changed dependency hash only
   invalidates its dependent render shard.
4. Render F01–F10 anchors with both photos/video and compare the actual
   motion against legally viewed same-type references. Repair failures
   before multiplying treatments. Every other family repeats its anchor
   gate; only then review all 40 full motion variants.
5. Attach real poster/demo MP4, pinned source licenses, frame/audio QA,
   at least 9/10 reviewer scores and independent spot checks. Generate
   the local manifest and send it through the coordinator's publication
   workflow. Do not publish unreviewed candidates.

## Open implementation and evidence dependencies

- Original signed F01–F50 family schedules are not present.
- No 2,000 fully licensed sample video outputs, posters, CapCut/Canva
  review references or signed human scores exist.
- Actual MP4 generation still runs through the existing app/worker and requires
  registered licensed fixture uploads plus a live workspace; the factory now
  prepares all 2,000 native edit requests and performs full-frame/audio QA on
  returned media instead of claiming render success.
- Unicode glyph shaping, moving-background text readability, semantic beat
  quality and reference-quality scoring still require real rendered inspection;
  the static lint cannot truthfully certify those from source data alone.
- Incremental worker-render performance benchmarks require actual worker runs
  and cannot be fabricated by the repository-only factory.
- Releasing through the public user-template flow requires its Batch 15
  sanitization/moderation contract and must never bypass review.
- Compact/full Timeline integration stays deferred per the 12:27 PM
  standalone-template override.

## Worker request fan-out

`prepare-shard --all` (or `--shard N`) compiles the queued candidate
matrix to one content-addressed JSON request per candidate using the same
standalone Batch 3/B5 path as `preview`. It checks the current fixture,
music-schedule and renderer hashes against `jobs.json` **before writing**
requests. Only queued jobs are prepared; completed, canceled, running and
failed jobs are not reclaimed. The prepared manifest is a worker handoff,
not an MP4 renderer or automatic publication. Existing worker execution,
real posters, glyph/flash QA and independent 9/10 reviews remain mandatory.

## Audio and sampled color QA

For Batch 8's full-motion previews, both the actual preview MP4 and the
worker-rendered MP4 must contain audio; two silent files are not evidence of
a correctly rendered separate soundtrack lane. The FFmpeg sampling probe now
compares RGB frames (not grayscale) at the first/last frame and each cut
boundary, and persists measured hashes/durations in the QA sidecar. It remains
sampled evidence only: full-motion flash, fine glyphs, readable text on moving
footage, specific music identity, and real visual parity still require actual
inspection and the human release gates.
