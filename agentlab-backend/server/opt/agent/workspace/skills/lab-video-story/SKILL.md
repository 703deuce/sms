---
name: lab-video-story
description: Script stage of a film from scratch: angle, structure scaled to length, script rules, script.json and beats, treatment, hooks and lengths.
when_to_use: Opened at the research stage of a film from scratch (video-stage research), after the facts.
page_line: Script stage: angle, structure by length, script rules, script.json, beats, treatment, hooks.
attach_roles: stage
---

# Story and script (stage 1)

Pro standard: a short doc is one question, opened in the first seconds and answered at the end. Every line is a
concrete beat (a fact, a moment, a number, a turn), never a summary. Details and sources: `reference.md`.

Facts come from `research/facts.md` (`lab-video-research`); every line traces to a fact there.

## 2. Angle
- One sentence: "This is the story of X, told through Y, and it ends on Z." Pick the human or causal thread,
  not a list of facts. Good angles: a paradox, a cause behind an outcome, a before/after, a turning point.

## 3. Structure (scale to length; 30 s ~ 70-85 words, 60 s ~ 150-170, 90 s ~ 220-240)
1. **Hook (first 2-3 s):** the outcome or a paradox stated flat. No greeting, no "in this video".
2. **Premise/context:** the minimum needed to follow (who, when, why it matters).
3. **Inciting turn:** the one event that set it moving.
4. **Escalation:** 1-3 beats, each raising stakes or adding a concrete detail (numbers, dates, places).
5. **Reversal/insight:** the line that reframes the hook (skip only if the story has none).
6. **Payoff:** answer the hook; last line lands, no call to action.
For longer films repeat escalation as sections, each ending on a re-hook line that opens the next question.

## 4. Script rules (it is read aloud, then shown on screen)
- Length = target seconds x ~2.0-2.1 spoken words/s (~120-125 wpm). Short declarative sentences, one beat each.
- One idea per line, 6-16 words, active voice, present tense for the action beats.
- Every spoken date or number is also on screen; a phrase is typed on screen or shown on a real document, never both.
- After the cold open, time only moves forward.
- `spoken` text spells numbers as words ("forty thousand dollars"); `text`/`typed` keeps digits.
- Each line names its **hero** (the one thing on screen) and its **hit word** (where the graphic lands).
- Write the hook last, once you know the strongest tension.

Write two structures (for example chronological vs opening on the payoff) and keep the stronger; plant setups early
for payoffs that land later; two beats making the same point with the same feeling are one too many.

## 5. Output (Cinematic Skill format, used by both engines)
`script.json`: takes -> lines `{id, text, spoken, hero, typed, gap_after}` plus `fact_notes`. Then
`log/beats.md`: line | words | hero | hit word | media needed (clip/photo/doc/map/number) | source.
Check total words against the target length before recording the voice. Do not wait for approval.
Then `research/treatment.md`: one-sentence angle, anchor motif, world concept, scene list, music idea per mood
change (for `audio/music_cues.json`), and which beats get real footage.

## Viewer psychology (planning; depth and sources in `reference.md`)
Optimise how the film is structured, never standardise how it looks. Before the voice is locked, check:
- **Promise**: one sentence on what the first frame and title promise and the honest payoff that matches it; no bait.
- **Hook**: the first line and first planned frame work with the sound off; the proposition lands in 1-3 s (90 f),
  the hook by 5-6 s; open on action, a face or a visual anchor ("something's up"), context after the image. No logo,
  welcome or "in this video". Starting at the climax and backtracking is valid; brand within 5 s for brands.
- **Open loop**: name the main question or stake, plant it in the open, pay it off late but for real, on screen;
  never answer the title in the first minute and coast. Each answer opens a tighter question.
- **Progress and escalation**: the viewer can see what "done" looks like and the progress toward it; each section
  raises a cost, risk, question or spectacle. No "and then also" section.
- **Re-hooks**: a 15-60 s film has a mid-point turn; a 2-6 min film at least one mid re-engagement before halfway;
  longer films another before the back half. Never signal the end or a break early.
- **Show, don't recap**: every line has a planned visual that carries meaning, not wallpaper; hold shots that need
  to be felt, move fast through connective tissue; a designed high point near the end (peak-end).
- **Ending**: stop on the payoff or its reaction; no goodbye. Loop the end into the start only if it fits the story.
- **Kill list**: cut any beautiful beat that does not advance the hook, the loop, the people or the payoff.
- Length fits the context (social up to ~3 min; vertical news 25 s-1.5 min; marketing < 1 min, demos 1-5 min).
