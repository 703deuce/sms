# PARKED: #1117 AI editing assistant chat panel

**Parked:** 10 Nov 2026, America/New_York, on John's priority change (via Chief of Staff): AI Studio first, then this panel.

**Branch:** `frontend/ai-assistant-panel`  
**This commit:** research + handoff only. No chat-panel implementation was pushed; work had not left the research/design stage when the priority changed.

## What was already done

- Read the Frontend charter, TEAM.md, PM UPDATED B0 spec (`/workspace/specs/pm/2026-11-09-ai-editing-assistant.md`), the earlier frontend plan (`/workspace/frontend_audit/ai_assistant_panel_plan.md`), and DESIGN_STANDARD.md.
- Read issue #1117 and #1115. Did not wait for #1115 to merge.
- New published PR-B1 as draft PR https://github.com/703deuce/sms/pull/1134 (head then `7f9b59bd7d7c9fc2a1a7d76d65f7dd2525dc08a3`, branch `backend/editor-command-registry`).
- Contract doc: `docs/contracts/editor-command-registry-v1.md` on that branch.
- Public import (after merge): `@/lib/clips/editor-commands` with `EDITOR_COMMAND_REGISTRY_VERSION = 1`.
- Ten Phase 1 commands: `trim`, `split`, `delete_range`, `apply_cleanup`, `restore_cut`, `set_captions`, `set_layout`, `add_or_edit_text`, `apply_brand`, `reorder_segment`.
- Result/diff shape and error codes: `unknown_command`, `invalid_params`, `precondition`, `no_change`.
- No LLM / chat / plan endpoint in that contract (PR-B2 / #1116). Chat/plan must stay a clearly labeled local stub until that ships. Do not invent those fields; raise gaps as a comment on #1134.
- Existing EditorShell already mounts `ProducerPopover`. Accept uses `applyProducerPatch` / `BATCH` so one producer turn is already one undo step. Evolve that popover; do not remove the working Producer chat before the replacement is ready.
- Surfaces: clip editor, Clip Studio, and full-video Timeline in the same EditorShell. Do not enable the flagged `/script` editor. After #1133 lands, routes are under `/app/video-editor/...`.
- #1134 is unmerged, so implementation must **mirror** types in `new-app/lib/clips/ai-assistant/` (relative imports) and must **not** statically import `lib/clips/editor-commands` until that PR merges, or master CI will fail. Note the merge-order dependency in the eventual PR.
- Do not copy New's `editor-commands/` files onto this branch (file overlap with #1134).

## Next steps when this is un-parked

1. Re-read #1134 HEAD (it may have moved) and re-mirror types if the contract changed. Comment on #1134 for any field/shape gaps instead of inventing them.
2. Implement the chat panel (premium DESIGN_STANDARD): scope first (`@`, selection, whole clip/video); plan/diff card with Apply/Cancel before any mutation; one undo step per accepted AI turn via `applyProducerPatch` / `BATCH` plus per-step undo; Retry/Continue on partial failure; honest refusals and error states mapped from the four registry codes; credits only, never `$`; loading/empty/error designed; keyboard and `aria-live` for streaming; keep all existing editor tools working.
3. Typed client + local stub for the missing LLM/plan endpoint (dev/flag only, never presented in production as the real API).
4. Tests (relative imports, `// @ts-expect-error` on vitest): plan-before-apply, single undo per turn, retry/continue, refusal and error rendering, scope. Add to Editor QA and import-guard lists. No tsconfig changes.
5. Branch is already named. Continue with normal commits, no force, no merge, do not touch other open PR branches. Open the PR only when the panel is ready, with the actual root-tsc multiset vs the current master job (and the job id QA named).
6. Post the backend handoff / contract questions on #1117 or #1115 / #1134 if that comment was not posted before park (it was not).

## Known contract gaps to raise (do not invent)

- No propose/plan/confirm or chat-message types in v1 (expected; B2).
- No cut-by-meaning resolver or scoped/chunked transcript packing in the registry (client/LLM concern).
- `validateEditorCommand` failure payload is implied by apply, not fully spelled out in the markdown table.
