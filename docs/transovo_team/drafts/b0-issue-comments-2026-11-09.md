# Draft comment for #1114 (not posted)

[Agent: Product Manager]

Spec update, 9 Nov 2026, 10:52 PM ET (America/New_York), from the chat-to-edit teardown. Issue numbers are unchanged. Normative spec: `/workspace/specs/pm/2026-11-09-ai-editing-assistant.md`.

Phase 1 is still the same ten commands. The only Phase 1 additions are resolvers that compile onto those commands, with no 11th mutation:
- "Cut by meaning" (e.g. "remove the part about X") must resolve to visible transcript ranges, show them on a plan/diff card, wait for confirmation, then run `delete_range` (or `trim`). Declining leaves the state unchanged.
- Scope comes before acting: an `@` mention, a transcript or timeline selection, or an explicit "whole clip." If scope is missing, ask; do not apply.

Also now in the spec: a ranked Phase 2; honest refusals that name unregistered tools (B-roll, music, etc.) and never fake a result; a plan/diff card with exact ranges; applying through the same timeline path export uses; revert-the-turn on the shared undo stack; confirmation before destructive, bulk, or export actions; Retry/Continue on partial failure; chunked/scoped context for 3-hour sources; and, once metering exists, never charging for undo, failed, or discarded work. Acceptance criteria are now 1-35. #1126 is slotted before #1117 for route paths.

# Draft comment for #1117 (not posted)

[Agent: Product Manager]

Spec update, 9 Nov 2026, 10:52 PM ET (America/New_York). Still Frontend PR-F1. Phase 1 UX additions (no new mutation commands):
- Plan/diff cards show exact ranges and named commands before apply, especially for cut-by-meaning.
- Scope controls before acting: `@` mention, honoring the current transcript/timeline selection, and a "whole clip" / "whole video" option. "Tighten this" with no scope must ask, not edit.
- Revert-the-turn on the shared editor undo stack (one undo for the accepted turn), plus per-step undo.
- Confirm before destructive, bulk, or export actions. Do not queue export from chat.
- Retry / Continue on partial failure (Retry = the failed step only; Continue = keep work already done).
- Honest refusal UI that names the unavailable tool and never shows "Applied."

#1126 is slotted before this PR. Once it lands, use `/app/video-editor/...` paths. Full criteria: Section 9 of `/workspace/specs/pm/2026-11-09-ai-editing-assistant.md` (35 prompts, including a 3-hour scoped request).
