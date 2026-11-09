# Transovo AI Motion Graphics — implementation and release gate

**Branch:** `feature/ai-motion-graphics-foundation`  
**PR:** #1067 (draft; DO NOT MERGE UNTIL COMPLETE)

## Existing architecture reused

- Existing AI Producer approved editorial cut timeline, word alignment, and video/audio source evidence
- Existing clip editor Text layer, keyframes, template library, track inspector and undo/redo/autosave
- Existing CPU FFmpeg worker Text ASS and SVG-like vector shape renderers
- Existing workspace ownership, Prisma clip edits optimistic concurrency and storage
- Existing social export safe-zone helpers (motion planner uses conservative normalized rects)

No new unlimited server or unlicensed Remotion integration was added. All supported motion
templates use the current text/shape burn pipeline and require no After Effects.

## Implemented on feature branch (requires final release QA)

- Declarative validated graphic plans with stable graphic IDs, timing, shape geometry, layer metadata and source evidence
- Post-edit LLM generation of text overlays, numeric bar charts and step diagrams grounded in approved transcript
- Separate prompting for Story, multi-source, Clean Take and streaming modes
- AI Motion editor tab, generate/review/apply workflow, edit and remove generated text items
- Natural-language targeted move/resize/recolor/rewrite/remove one graphic with independent validation
- Workspace-scoped saved Style Profiles, additive Prisma migration and authenticated CRUD APIs
- Authorized reference screenshot analysis using Gemini (1–3 images), original palettes/font selection
- Authorized short MP4/WebM reference video style analysis using 3 locally sampled images (no original video upload)
- Persistence of plan provenance in `edits.motionPlan`, with rendered layers authoritative in `edits.textItems`
- Automated plan/adapter unit tests and actual FFmpeg text/vector MP4 rendering pixel+audio smoke test

## Important limitations; NOT production-complete yet

- Video-reference sampling is visual only: it does not reconstruct precise animation timing or arbitrary motion effects
- No AI-generated unrestricted React/Remotion components, complex masked presenters, 3D particles or tracked callouts
- No automated object tracking or per-frame occlusion analysis of gameplay/presenters
- The motion planner uses transcript evidence; it does not yet consume the entire Gemini visual/audio observations handoff
- Synchronous planning limits inputs to 10 minutes, and relies on a live editor browser session
- No persistent async motion planning job queue, progress/cancel/resume or dedicated render cache
- Timeline Text layer rendering supports existing animation engine but complex infographic shapes are separate text/shape pieces
- No robust video-level QA of all rendered frames beyond a synthetic smoke proof
- No verified production edits through all six modes in real uploaded projects
- No independent three-target-format (9:16, 16:9, 1:1) real export tests yet
- Safe-zone validation is conservative, not platform/control-position specific for each generated item
- Style profiles store extracted characteristics; original reference assets aren't persisted in the style profile
- No deployed feature end-to-end smoke, billing/quotas review or external security/license review

## Release acceptance gate

Before marking PR ready or merging into master, complete the limitations above
where within product scope, then require:
1. GitHub Clips editor import guards, editor QA regression, Prisma guards, new app CI guards pass.
2. Scoped TypeScript checker passes for all modified motion paths; no tests altered to conceal bugs.
3. Video/Audio worker MP4 proof passes and representative actual decoded output frames are inspected.
4. Real editor smoke tests: upload/clip → AI generate → approve → preview/canvas edit → save/reload → export
   for 9:16, 16:9 and 1:1.
5. No differences to existing Story/Footage/Flow/QA and streamer pipelines; master remains unchanged until then.
6. Document the eligibility and licensing of any third-party renderer before shipping paid automation.

This branch contains partial integrated functionality, **not** the complete feature promised in the
full AI Motion Graphics specification. Keep PR draft/unmerged until acceptance gates are met.
