# Transovo editing skill: Just Chatting long-form rough cut (v0)

Applies only when editMode = just_chatting_rough_cut. This is a first-party adaptation
of the **editorial workflow**, not Resolve-specific APIs, from these MIT-licensed
instruction sets (reviewed 2026-11-05):
- Simbastack-hq/resolve-edit-kit (MIT): paper edit, deliberate pacing, A/B choices,
  transcript join review, avoid rewriting an existing timeline.
- Forward-Future/alexs-davinci-editing-skills (MIT): dialogue cleanup, first cuts,
  short audio fades, listen/visual verification.

The source projects' tools require DaVinci Resolve and are NOT imported here.
Our tools operate only on Transovo's ClipEditsV2, source-time words and video frames.

## Goal

Turn a **raw ~20-minute Just Chatting recording** into ONE coherent, editable,
3–10-minute rough cut. This is NOT a viral highlight pack. Keep complete thoughts,
the streamer's personality, interesting stories, jokes and authentic reactions.
User instruction takes precedence over soft pacing suggestions.

## Mandatory editorial pass

1. INVENTORY the full source (not only the top 12 viral moments). Identify topics
   and the boundaries of complete stories. Read the transcript over each candidate.
2. PAPER EDIT: outline opening, topic development, strongest payoff and resolution.
   Keep cause before effect; preserve the person's actual meaning.
3. STRUCTURE: choose a chronologically ordered list of kept source intervals.
   Prefer broad, complete conversational beats. Start each interval before its
   first word; end after its last thought/reaction. Avoid isolated 1-second pieces.
4. TIGHTEN: after building broad sections, shorten only clearly empty gaps and
   false starts. Never auto-delete "mhm", laughter, chat reactions or hesitation
   conveying emotion. For uncertain filler, leave it for human review.
5. QUALITY: for every join, inspect source words, audio energy and video. The
   existing validator is a last line of defense, not proof of natural pacing.
6. APPLY to a NEW editable project, never the original. Captions, music, layout
   and cuts must refer to the same source-to-output time map. No export/posting.

## Operational constraints

- Output target is user-supplied within 3–10 minutes, never a 15–60s short.
- Only ONE output project; preserve chronological order unless user explicitly
  asks otherwise and a real narrative reason is cited.
- Prefer 6–24 reasonably long retained segments; do not exceed 64.
- Never invent missing transcript, frames or waveforms. If missing, mark the
  resulting plan as needing review and don't claim it was fully verified.
- No memes, automatic generative footage, loud SFX or unnecessary zooms.
- Keep the original aspect ratio when possible; use full_frame or fit_blur for
  conversational footage, not aggressive vertical speaker-follow by default.
- Cut on acoustic valleys near true word boundaries; do not cut through
  words, reactions or laughter. Prefer to keep an extra breath over losing speech.
- Review duration, caption alignment and every transition in preview/export.
- Use tool calls to make actual edits. A prose-only list is not completion.

## Notes to creator

Explain what was kept, what was shortened, which joins are uncertain,
and any editorial choices worth A/B auditioning. Never promise perfection.
