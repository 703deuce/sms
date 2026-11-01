# Clip editor in-project recording (Nov 2026)

Scope: **clip editor only** (`/app/clips/.../editor`). Rooms / script `use-editor-recorder` unchanged.

| Handoff | Status | Notes |
|---------|--------|--------|
| AU-25 Voiceover in editor | **DONE-UNVERIFIED** | Mic take → Voiceover audio track at playhead |
| PR-06 Camera (in editor) | **DONE-UNVERIFIED** | Same bar as PR-09; camera + mic |
| PR-07 Screen + baked bubble | **DONE-UNVERIFIED** | `getDisplayMedia` + optional canvas bubble (single file) |
| PR-08 Teleprompter | **DONE-UNVERIFIED** | `TeleprompterPanel` + per-project script in `localStorage` |
| PR-09 Record into open clip | **DONE-UNVERIFIED** | Upload + insert / append / B-roll overlay |
| PR-10 Slides recording | **Deferred** | Screen capture covers slides; native importer separate |

Implementation: `lib/clips/editor/recording.ts`, `recording-bubble.ts`, `components/clips/editor/recording/*`.

Tests: `recording.test.ts`, `recording-bubble.test.ts`, `use-clip-recorder.test.ts`, `use-clip-recorder-screen.test.ts`, `recorder-bar.test.tsx`.
