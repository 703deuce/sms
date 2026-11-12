# Batch 9 Phase B — first-ten style-pack expansion

Phase A already owns the ten bold anchors `f01_bold` through `f10_bold`.
Phase B is the next ordered expansion: the other 39 treatments for each of
F01–F10, **390 additional variants**. The 40-treatment source remains the
Batch 8 canonical 25 core recipes + 15 separately authored alternates.

This module deliberately does not add those 390 rows to the public gallery.
`batch9PhaseAAnchorGate()` requires all ten anchors to pass the exact Batch 8
evidence audit, score >=9/10 with every dimension >=4/5, and have a different
independent reviewer. Only after that gate is true can an exact Phase B variant
be eligible, and that variant must still carry its own render/reference/rights
evidence and score.

Run:

```sh
cd new-app
pnpm templates:b9:phase-b --evidence build/real-video-templates/b9a/evidence.json
```

The command writes a local status/eligible manifest only. It never edits
`releases.ts`, Batch 9A anchors, the gallery/studio redesign, Compact, or the
full Timeline.

## Phase B release gate

A local Phase B release manifest is only populated after the ten Phase A anchors
are certified and each exact variant passes the Batch 8 evidence audit. Before
any Phase B release rows are returned, independent review must cover at least
10% of the currently eligible variants, every one of the 39 non-bold treatment
recipes must have an independently reviewed example, and every flagged variant
must have an independent reviewer. The generated rows are certified
`VideoTemplateRelease` records with real reviewed MP4/poster evidence, but the
CLI still never mutates the production `releases.ts` registry automatically.


## Exact-definition review and production render

Review scope is explicit so same-ID Batch 8 rows cannot certify the redesigned anchors:

```sh
cd new-app
pnpm templates:review-workbook --scope batch9a \
  --evidence build/real-video-templates/b9a/evidence.json
pnpm templates:review-evidence --scope batch9a \
  --evidence build/real-video-templates/b9a/evidence.json \
  --reviews build/real-video-templates/b9a/human-reviews.json
```

After all ten live anchors pass that gate, Phase B can render through the same
production export orchestration used by Batch 8. The command refuses to build
the 390-row contract before Phase A certification and verifies/copies the exact
pinned soundtrack bytes beside the contract.

```sh
pnpm templates:b9:phase-b:render \
  --evidence build/real-video-templates/b9a/evidence.json \
  --source ../build/b8-worker-contract.json \
  --shard 0 --shards 10
```

Each of the 390 variants is already covered by the focused compile gate for
one editable source segment per slot, native transitions, animated text/graphic
layers, video motion keyframes, mixed photo/video sources, and music on its own
track. Public promotion remains fail-closed until exact variant render/review
evidence also passes.
