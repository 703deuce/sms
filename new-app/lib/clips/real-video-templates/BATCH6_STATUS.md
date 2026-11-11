# Batch 6 — slot-local playback and real cross-source transitions

Scope follows Rick's 12:27 PM override: template-owned preview/render only. No new Compact/full Timeline
wiring and no editable-timeline publication gate work are part of this PR.

## Implemented

- Additive sourceSegments playback v1 plan at the existing 30fps template clock.
- Authored play, hold, and named speed-curve pieces. Curves reuse speed-curves.ts; rates reuse
  the existing speed clamps. The compiler expands them deterministically into ordinary play/hold runs.
- Output duration never changes. Holds freeze the source frame and source audio while text/graphics/music
  remain on the output clock.
- Existing slot-local transform and FX fields remain on the same source segment and therefore do not leak
  into the following shot.
- Browser preview maps the same source frame/rate plan. A hold pauses the selected source element instead of
  attempting an invalid HTMLMediaElement playbackRate of zero.
- Worker pre-renders only playback-bearing source windows, then reuses the normal source compositor.
  Source audio uses matching atempo chains; holds insert silence rather than replaying a sample.
- Centered cross-source transition windows sample the actual outgoing/incoming source media, including
  playback handles. Authored output duration is unchanged.
- Template-safe transition authoring is restricted to hard cut plus crossfade, dip-white, directional
  push/wipe, zoom-blur, whip-pan and glitch. Other catalog entries remain enumerated as unavailable.
- Cross-source shader transitions render the real A/B source windows through the existing shader renderer;
  they do not silently substitute a fade. If the shader renderer is unavailable, rendering fails visibly.
- Source duration/handle capacity is validated before compilation; no slice/truncate fallback is introduced.
- Legacy payloads without playback normalize/render through the prior code path.

## Verification added

- TypeScript B6 compiler/timebase tests cover curve expansion, freeze/repeated frames, source capacity,
  transforms/FX, transition allowlist, and output-clock text/graphics/music.
- Worker B6 tests decode rendered frames, verify a held image stays frozen, verify source audio is silent
  during the hold, verify exact-duration cross-source crossfade output, and exercise a decoded shader
  boundary when the EGL/moderngl renderer is available.
- The existing editor regression workflow now includes both focused B6 suites.

## Deploy/cache handoff

No migration and no deploy in this PR. editsVersionHash already includes the new render-bearing playback
field (template provenance remains excluded), so distinct plans get distinct render cache keys. Because the
worker's interpretation of the new field is introduced here, the coordinator should roll the worker image
revision together with this PR and invalidate any environment-level worker/image cache that can retain the
old media_sources.py code.

## Remaining limitations

- Playback authoring is template-schema only in this scope; no new Compact/full Timeline controls are added.
- The worker requires a 30fps template carrier for playback plans.
- Shader decoded-frame CI is conditional on the runner having the existing EGL/moderngl/llvmpipe stack;
  absence is reported as a skip, while production rendering fails rather than degrading silently.


## Independent follow-up QA

A direct FFmpeg reproduction found the earlier duration-based `tpad` could produce too
few decoded pictures at the end of a hold. B6 now uses an explicit frame-count hold,
two-frame codec-boundary rounding guard for play pieces, exact 30fps output timestamps
and a decoded-frame count assertion. Missing uploaded template media and invalid
playback payloads fail closed instead of returning the black carrier or 1x speed.
Regression tests cover a 15-frame silent-source hold, invalid plans and absent media.

The requested full TypeScript diagnostic comparison (master baseline: 456), scoped
Vitest and worker pytest require a checked-out repository/CI runner. GitHub Actions
were queued during this work; a queued check is not a passing check.
