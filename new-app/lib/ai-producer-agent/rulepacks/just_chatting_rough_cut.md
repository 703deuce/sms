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

## Just Chatting editorial direction v1 — learned from five editing case studies

This is the *genre-specific* layer; it does not replace universal film grammar.
The five training sources cover professional editorial passes, creative direction,
marker-driven collaboration, documentary interview retrieval, and ad generation.
Only the applicable conversational principles are used for this skill.

### Editorial evaluation (before cutting)
- Identify the central topic and viewer promise. Ask what makes this conversation
  worth seeing and what context a new viewer needs to understand it.
- Inventory all 20 minutes, not just finder highlights. Notice setup, story,
  joke, reaction, repetition, emotional pause and payoff. Rank for *contribution
  to this video's story*, not virality scores.
- Preserve original meaning. Don't rearrange responses to create a false answer
  or change how a person appears to respond. Source-ground every kept interval.
- Remove redundant explanations, dead time and failed retakes *only when clear*;
  some pauses, repetition and laughter are essential to the moment.
- Keep the video coherent, with the smallest number of visual effects that serve
  the topic. Do not impose 'change shots every 3 seconds' from other genres.

### Full-edit polish (after approving story cuts)
- Preserve the streamer's aspect ratio and facecam/chat context. Avoid zooming
  away readable chat or important reactions. Default to a restrained full frame.
- Differentiate captions (faithful speech) from supers (concise, accurate
  takeaways). Add only when appropriate. Never make text compete with captions.
- No fabricated B-roll, decorative motion graphics or generic cinematic music in the editorial/cut-selection stage. A separate optional post-cut Motion Graphics specialist may add evidence-grounded explanatory labels after the edit is locked, or choose zero overlays. That specialist must never change source selections, dialogue, timing or narrative decisions.
  Just Chatting normally benefits from clear speech and natural pacing.
- Distinguish a technical jump cut from a genuine change of topic. Don't apply
  a flashy transition to every silence removal.

### Supervising review (before creating output project)
- Review the literal first/last transcript words of *every chosen section* and
  the before/after words at *each join*. Check the meaning and context of the
  proposed timeline; a validator passing does not certify the story.
- Fail edits where the beginning promises a topic that never pays off, where
  the end of one sentence is spliced onto an unrelated response, or where a
  joke loses its setup or reaction. Flag uncertain acoustic joins for listening.
- After creating the edit, use draft-render technical checks; never equate
  technical checks with somebody actually watching/listening to the result.
- Keep selection decisions and QA findings in producer notes for human review.

### First benchmark

Use the LAST 20 minutes of one authorized stream upload (minimum five minutes)
and output one chronological editable 3–8-minute project, with no automatic
posting. Score narrative coherence, retained context, reactions, natural audio
joins, unnecessary material, faithful captions and actual rendered playback.
Do not claim a publishable full edit until real footage has passed these tests.
