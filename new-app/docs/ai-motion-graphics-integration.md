# AI Motion Graphics — integration roadmap (foundation PR)

## Existing master architecture reviewed
- Motion/keyframes: `lib/clips/editor/motion-schema.ts`, `motion-frame.ts`
- Timeline: `lib/clips/editor/clip-timeline.ts`
- Social safe zone: `lib/clips/overlay-safe-zone.ts`
- AI Producer: `lib/ai-producer-agent/*`, output assembly and locked editorial modes
- Render: existing FFmpeg/Python worker. Keep unchanged until preview/export parity tests exist.

## Non-negotiable architectural contracts
1. Run after the approved editorial timeline. Never let graphic regeneration rewrite Story/Footage/Flow/QA selections.
2. Motion instructions are declarative JSON. Do not eval model-generated JS in Next.js or worker.
3. All placements/timings are output-relative milliseconds. Preserve source-to-output mappings only as evidence pointers.
4. Graphics have stable IDs, revision records and non-destructive edits. Preserve other changes on targeted edits.
5. Existing keyframe/track systems remain authoritative; add a compatible graphic lane rather than a duplicate NLE.
6. Images and remote references require user authorization; treat uploaded assets as untrusted.
7. No licensing assumptions: Remotion Free License eligibility is organization-size dependent; check official current license before integration. Consider SVG/CSS preview plus isolated FFmpeg or frame-rendered overlays as an alternative.

## Implementation sequence (NOT implemented by this foundation PR)
- **Phase A — persisted editable storage**: add motionPlan and styleProfile persistence with workspace ownership/auth checks, version and revision controls, account-scoped assets, cache invalidation.
- **Phase B — editor preview and controls**: reuse existing timeline, keyframes, on-canvas drag, undo/redo, inspection UI, safe-zone renderer for 9:16/16:9/1:1. Wire to real persistence.
- **Phase C — render parity**: isolated overlay renderer/worker job, alpha composition into existing EDL render, cancel/retry/status, cache and error telemetry. Test final MP4 against frame previews.
- **Phase D — agent planning**: one post-edit planner using Story/Footage/Flow/QA handoff and transcript/visual evidence. Validate source-grounding, graphic density, obscured important objects, layout, continuity and actual rendered frames. Do not fabricate figures.
- **Phase E — style profile analysis**: authorized reference ingestion, original style profile extraction, template suggestions and feedback by graphic ID.
- **Phase F — mode adapters**: register separately for single source, multi source, Clean Take, continuous stream clips, assembled stream stories and long stream edit. Default off and regression-test each.
- **Phase G — live render evidence**: export each target format and representative projects (talking head, gaming, captions, saved profile, reopened edited project). Inspect actual frames and verify logs/CI.

## Current PR scope
- Pure Zod-based non-executable data contracts
- Deterministic validation of intervals, boxes, safe rectangles, evidence references, animation durations, keyframes and ID uniqueness
- Controlled one-item patching without rewriting the original plan
- Initial Vitest tests (not run in connected repo environment)

**Do not present this PR as a complete motion-graphics feature.** The worker, UI, persistence, generation, and real exports are intentionally not connected yet.
