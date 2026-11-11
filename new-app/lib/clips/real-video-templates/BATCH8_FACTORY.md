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

The preview command first re-times each structural family onto the actual
pinned soundtrack beat grid (preserving slot order and minimum shot lengths),
then maps media to native source segments and compiles through the existing
Batch 5 music-aware template compiler. The resulting worker plan keeps every
cut on a real pinned beat and keeps the soundtrack on a separate editable lane. The actual MP4 must be rendered through
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

## Remaining external evidence dependencies

- Original signed F01–F50 family schedules are not present.
- No 2,000 fully licensed sample video outputs, posters, CapCut/Canva
  review references or signed human scores exist.
- Actual MP4 generation requires registered licensed fixture uploads and a live
  authenticated workspace. The factory implementation now drives that existing
  worker path for all 2,000 queued designs and performs full-frame/audio QA; it
  intentionally cannot manufacture credentials, licensed fixture bytes, or
  worker results that do not exist.
- Unicode glyph shaping, moving-background text readability, semantic beat
  quality and reference-quality scoring still require real rendered inspection;
  the static lint cannot truthfully certify those from source data alone.
- Actual worker performance numbers cannot exist before worker runs. Once
  `render-queue` has produced real evidence, `benchmark-real` aggregates
  measured publish, preview-worker, export-worker, download/full-frame-QA and
  end-to-end timings (min/p50/p95/max/mean) from those runs.
- Releasing through the public user-template flow requires its Batch 15
  sanitization/moderation contract and must never bypass review.
- Compact/full Timeline integration stays deferred per the 12:27 PM
  standalone-template override.

## Worker request fan-out

`prepare-shard --all` (or `--shard N`) compiles the queued candidate
matrix to one content-addressed JSON request per candidate using the same
standalone Batch 3/B5 path as `preview`. Every request is rejected unless
the resulting ClipEditsV2 still has one editable source segment per slot,
every slot-boundary cut, every authored cross-source transition, every
animated text/shape layer, source-motion keyframes, template provenance and
the licensed soundtrack on its own audio track. It checks the current fixture,
music-schedule and renderer hashes against `jobs.json` **before writing**
requests. Only queued jobs are prepared; completed, canceled, running and
failed jobs are not reclaimed. The prepared manifest is a worker handoff,
not an MP4 renderer or automatic publication. `render-queue` is the separate
command that invokes the existing worker. Human glyph/readability/reference,
rights and independent 9/10 reviews remain mandatory.

## Audio and sampled color QA

For Batch 8's full-motion previews, both the actual preview MP4 and the
worker-rendered MP4 must contain audio; two silent files are not evidence of
a correctly rendered separate soundtrack lane. The FFmpeg QA pass decodes **every frame at 30 fps**, compares preview/export
RGB frames, checks first/last and cut-boundary black frames, detects rapid
flash reversals, and persists measured hashes/durations in the QA sidecar.
It also compares decoded audio envelopes. Fine glyph shaping, text readability
over moving footage, reference-quality judgment and rights approval still
require actual human inspection; those are never inferred from compiler data.

## Beat-synced factory timing

Batch 8 no longer treats a `beat-time` label as proof of sync. Before a
preview/worker request is emitted, the family boundaries are deterministically
mapped to frames from the verified soundtrack's pinned beat schedule. Slot
order and structure remain unchanged; text, graphics, phrase anchors and
transition durations move on the same output clock. The request is rejected
if the grid is too sparse, a shot would fall below nine frames, a transition
would become unsafe, the soundtrack is too short, or any interior cut/final
boundary fails to land on a pinned music beat. This runtime factory retiming
does not modify the Batch 9A anchor source files.

## Existing-worker execution automation

The factory can now drive the existing authenticated app/worker path instead
of stopping at JSON handoff. After `jobs`, run `render-queue --shard N` or
`render-queue --all`. Configure the app origin with `--base-url` or
`B8_QA_BASE_URL`, and provide authentication only through the environment:
`B8_QA_COOKIE` or `B8_QA_AUTHORIZATION`. Credentials are never accepted as
CLI arguments or written to manifests/logs.

For each queued design the runner: publishes a new idempotent template QA
project through the existing video-template publish API, waits for the real
preseeded carrier/preview worker, re-fetches the persisted ClipEditsV2 and
re-runs the native-edit audit, downloads the actual preview, forces a distinct
30-fps MP4 export through the existing render worker, downloads that render,
extracts a poster from the real render, hashes all three outputs, runs the
full-frame/audio QA, and writes a machine evidence record. Successful jobs move
to `rendered`, not `done`; human glyph/readability/reference/rights/quality
review is still required before `complete`/release. The local runner caps
parallel worker leases at two and keeps the existing three-attempt limit.

## Real worker benchmark

Every `render-queue` evidence record now stores measured stage durations for
publish, carrier/preview readiness, the forced export worker, download plus
full-frame/audio QA, and total elapsed time. `benchmark-real` aggregates only
those actual records; it never substitutes compiler timing for render timing.

The render-timing evidence stores a SHA-256 of the exact pinned beat schedule,
not merely the soundtrack file hash. Editing beat annotations therefore
invalidates cached timing evidence even when the audio bytes are unchanged.

## Focused Batch 8 verification

Use `pnpm typecheck:templates:b8` and `pnpm test:templates:b8` for a focused
Batch 8 gate. The dedicated TypeScript config includes only the Batch 8
factory, its shared template contracts pulled transitively, the runner, and
its tests; it does not add Compact/full Timeline files to this gate. Beat-synced
worker requests are also re-run through blocking legibility lint after retiming,
so music synchronization cannot silently make authored titles unreadably short.
