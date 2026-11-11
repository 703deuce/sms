# Batch 7 standalone primitive capability matrix

Batch 7 follows the Nov. 11 standalone-template priority override. It adds no
Compact/full Timeline integration and no editable-timeline publication gate.
The authoritative output remains Batch 3 \`ClipEditsV2\`; template preview and
export consume the existing text/shape, keyframe and source-composite paths.

| Primitive / capability | Status | Authoritative representation | Reduced-motion / flash behavior |
| --- | --- | --- | --- |
| Photo frame | supported | four editable shape \`textItems\` | static |
| Collage card (2–4 sources) | supported | existing \`sourceSegments[].layout\` + editable frame/title | static composite |
| Confetti | supported | bounded editable shape items + item-local keyframes | static confetti with reduced motion; no flicker with reduced flash |
| Countdown | supported | discrete timed text items | static number changes; no fake \`count_up\` |
| Before / after | supported | existing side-by-side source layout + labels/divider | static |
| Roster selection | supported | editable text/shape group | static |
| Calendar label | supported | editable text/shape group | static |
| Route arrow | supported | editable arrow shape + item-local reveal keyframes | static arrow with reduced motion |
| Text underline / line reveal | supported | editable text + line shape/keyframes | static underline with reduced motion |
| Text-only glow | supported | text item shadow/glow only | lower glow intensity with reduced flash |
| Numeric \`count_up\` animation | gated / unsupported | none | adapter rejects it; it is never relabeled as \`pop\` |
| \`draw\` animation | gated / unsupported | none | adapter rejects it |
| Ordinary-photo F05 true depth | **unsupported / hidden** | none | no Ken Burns substitution |
| User-supplied alpha foreground | composite-only | ordinary editable upload layer | not advertised as true depth |
| User-supplied foreground + hole-filled background parallax | proof-required | two ordinary upload still layers + item-local keyframes | static layered composite with reduced motion |

## F05 audit

The repository already contains Robust Video Matting for **video person
matting** in \`worker/modal_app/matte.py\`. It is pinned to upstream commit
\`53d74c6826735f01f4406b5ca9075eee27bec094\`, with GPL-3.0 license/notice
vendored under \`worker/modal_app/third_party/rvm/\`. The current worker path
uses the existing Modal \`Matter\` class, 20-second chunks, 1080-pixel short
side, a 3600-second maximum window and the existing GPU budget guard.

That is not a licensed/proven static-photo depth-map + background-hole-fill
pipeline, so Batch 7 does not use it to claim F05 true photo depth. Ordinary
photos remain ineligible for the F05 default. A future implementation must add
a separately reviewed model/license, deterministic crop-aware workspace cache,
bounded compute/storage and decoded preview/export occlusion proof.

## Capacity and font fidelity

Batch 7 checks the existing \`TEXT_MAX_ITEMS = 60\` limit before returning an
edit and fails closed rather than dropping manual or generated layers. It uses
the same shipped text-item font inventory for headline/body pairings. Existing
chart/diagram primitives already pass the requested render font into every
generated label; regression coverage keeps that behavior pinned.

## Launch catalog note

These are reusable first-party building blocks. This batch does **not** claim
that the 50 structural families × 40 meaningfully authored treatments (2,000
released first-party templates) have already been authored or reviewed.
