# Batch 7 — standalone primitive capability matrix

**Status: partial / not release-certified.** Base master: 3e98eb0a. Priority override honored: no Compact or full Timeline integration or mandatory editable-timeline gate.

| Capability | Current evidence | Release status |
|---|---|---|
| Collage frame, confetti, countdown numeral, before/after labels, roster, calendar, route arrow, underline, line reveal, text glow | Opt-in compiler emits ordinary TextItem/ASS-supported vectors and text with existing keyframes | Prototype; not end-to-end certified |
| Font propagation and text fit | Uses requested pinned TextFontId and shared fitMotionTextToBox; chart/diagram already pass font into labels on master | Static inspection only |
| Capacity and user edits | Fail-closed against 60-item limit, collision checks, unrelated manual items and keyframes unchanged | New Vitest fixtures, not executed |
| Reduced motion | Static visible layers without movement keyframes or flashing effects | Prototype |
| Numeric count-up | One static countdown numeral only, no fake count-up animation | Unsupported |
| True F05 foreground depth and occlusion | No licensed verified cutout model, background hole fill, masks/maps cache, or GPU/CPU budget proof | Unsupported; hide from defaults |
| Four-photo depth, same-source independent slots, replacement-safe crop, preview/export parity | No decoded worker/preview proof | Unsupported/unverified |
| Full 50 families x 40 reviewed treatments | No authored certified release catalog here | Not delivered |

This helper does not bind photo media or build the template preview/export. Collage frames and before/after text are editable overlays, not compositing or true foreground/background isolation. Do not imply a finished template from this change alone. Batch 6 is still draft PR #1181 and has not been imported. No worker, editor timeline, migration, Ad Studio, AI Studio, SMS, app3, or root app files changed.

## Required verification before merge

Run Vitest on tests/clips/real-video-template-b7-primitives.test.ts, full new-app tsc, production template compiler regressions, worker pytest and actual decoded browser/FFmpeg golden-frame comparisons (9:16, 1:1, 16:9). No such checks have been executed in this GitHub-only environment (repository dependencies and local checkout unavailable). Do not mark this PR ready solely because the fixtures exist.
