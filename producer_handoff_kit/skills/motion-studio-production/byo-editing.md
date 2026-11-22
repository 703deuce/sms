# Editing footage we didn't shoot (BYO Path A)

Principles for "Edit My Footage" jobs. Read this before cutting on Path A. Where this file differs from a hard rule in `SKILL.md`, `qa.md` or `delivery.md`, that rule wins. Principles only: apply them with judgment to this footage. Defaults are not mandates. The edit is footage-driven. Graphics never cover faces or what is being shown. The look varies by job.

There is no standalone Clean Up mode in this skill (Rick, Nov 22, deferred). Tightening dead air, fillers and false starts is part of a normal edit when it serves the ask. The editor's existing manual cleanup tools stay available to the customer.

## Why this is different from our films

In a film we write first and then source pictures to fit. In a BYO edit the footage already exists and the story has to be found inside it. The editor's job is closer to a documentary or interview editor: watch, log, select, find the through-line, then shape it. We work with what's there, including its flaws, and we don't put words in anyone's mouth.

## 1. What the customer asked for comes first

1. Read the request and sort it into: **explicit asks** (must be done), **preferences** (follow unless they hurt the result), and **silence** (our call).
2. Classify the job as **open** ("make this a coherent edit": we decide the story, length and shape) or **directed** (explicit structure or asks that must be followed). Say in the director's note what we decided and why.
3. If they give creative direction, follow it. If a direction will clearly hurt the video, do it their way and offer one alternative in the note. Don't silently override.
4. Turn every explicit ask into the request checklist and mark each done or not done with the reason.
5. Infer goal, audience and call to action when missing, and label them as assumptions.

## 2. Watch and log before cutting

1. Prefer the stored transcript, speaker labels, shot changes and moments from the app's analysis. Don't re-transcribe a file that already has one. If none is provided, transcribe once and reuse that transcript.
2. When judging, read **speaker-turn / utterance lines plus a candidate-cut list**, not raw word-timing lists. Word timings are for placing cuts on the box, not for you to scan.
3. Make a log: who speaks, what about, where the strong lines and reactions are, what each file contains (main angle, second angle, extra shots, screen recording), and quality problems (bad audio, soft focus, someone walking through).
4. For long or many files, read in chunks with a running shortlist. Nothing gets cut before it has been looked at in the log.

## 3. Selects, then a paper edit, then a radio cut, then picture, then narration only where needed, then mix

This is the editor's order. Don't lay graphics or voiceover before the audible story works.

1. **Selects:** pull the moments worth keeping and grade them: must use, could use, needed but flawed, visual support only, avoid.
2. **Paper edit:** arrange the selected soundbites as text in story order, with slots for any voiceover or title card. Test the structure as text before touching the timeline.
3. **Radio cut:** build the spine from sound alone. Check it with eyes closed: does it make sense, is there a progression, a turn, and an ending?
4. Only then lay **picture**: angles, cutaways, extra shots, graphics.
5. **Narration only where needed.** Default to the speakers' own words. Add voiceover or a title card only when the ask or the story needs it, and only on the segments that need it (see §7).
6. **Rough cut, then fine cut, then mix.** The rough cut holds the story. The fine cut tightens to the length that keeps attention, fixes every cut point (see §8) and polishes sound.

## 4. The story comes from the footage

1. Find the strongest true through-line the material supports. Don't invent one and force the footage to fit.
2. Start with the hook the footage actually has. Don't promise something the footage never delivers.
3. Keep cause and effect in the order it happened unless the reorder is clearly honest (for example, a teaser of a later moment that is presented as a teaser).
4. Let length come from the material and the ask, not a fixed percentage.

## 5. Ethics of cutting real people's words (hard rules)

These never bend.

1. Never change what someone meant. Removing ums, stumbles, false starts and digressions is fine. Making someone say something they didn't is not.
2. Never build a sentence out of fragments from different moments that reads as one quote. Keep subject, verb and object from the same sentence.
3. Never put an answer after a question it wasn't answering, or a reaction after a line it wasn't reacting to.
4. Don't remove a hesitation if the hesitation is the point (someone reluctant or unable to answer).
5. When two separate remarks are joined, the join should be visible (an angle change, punch-in, short dissolve or visible jump), not hidden under extra shots as if it were one continuous quote.
6. If the speaker's own words can't carry a point honestly, use a voiceover line or title card for it rather than splicing their words.
7. Test: would the person on camera recognise this as a fair version of what they said?

## 6. Working with the footage's limitations

1. **Bad takes and retakes:** keep the best complete take of each idea. Usually that's the last one, but not always: judge delivery, completeness and energy.
2. **Jump cuts:** pick the fix by what's available: a second angle, a cutaway or extra shot of what's being talked about, a clear punch-in (big enough to read as a new shot and not a twitch; alternate, don't stack), or leave the jump honestly in fast social or talking-head styles. Keep the face on screen for the lines that carry feeling. Never cover a face.
3. **Missing coverage:** cover with what exists (another angle, relevant extra shots from the customer's files, a still, a graphic, or a title card). Never fake footage of a real event.
4. **Continuity:** emotion and story beat perfect continuity (Murch's priority order). Accept a small continuity mismatch when the moment is right. Fix it only when it pulls attention.
5. **Audio:** cut on breaths and natural pauses, never inside a word or mid-breath. Fill joins with room tone. Use short crossfades. Even out levels across speakers and files. Clean noise only as far as words stay intact.
6. **Pauses:** keep pauses that land a line, a laugh, a reaction or a thought. Cut dead air. Never cut inside a laugh. Keep the speaker sounding like themselves; don't tighten until it sounds rapid-fire.

## 7. Voiceover and title cards are tools, not defaults

Script and voiceover are optional per job and per segment (Rick, Nov 22). This supersedes the older Path A rule of "no script, no voiceover".

1. Default to the speakers' own words. Add voiceover only when the ask or the story needs it.
2. Three levels per job and per section: **none**; **sparse** (a bridging line between clips, missing context, a transition); **throughout** (a narrated piece built on the footage).
3. Use VO or a title card to give context the footage lacks (who, when, where), to bridge a gap between clips, or to summarise a question the footage can't show cleanly.
4. VO over a speaker ducks the speaker. Pure VO bridges sit over extra shots or graphics, not over someone else's face talking.
5. Use the customer's chosen voice (including a cloned voice) and generate narration only for the segments that need it.
6. Record each segment's `audioMode` in `project.json`: `source` (speakers' own audio), `vo_over` (VO over this footage, source ducked), `vo_bridge` (VO-only line over extra shots, a graphic or a card), or `card` (title card, no VO). Duration comes from the source and VO segments, not from a script word-count.

## 8. Cut precision (every BYO cut)

Not a standalone mode. For every cut in a BYO edit:

1. Use word timings only as a first pass. Put every cut point on the audio itself: the quiet gap between words, never part of the next word, never a clipped syllable or a half-breath.
2. Treat "gaps" that aren't quiet (someone else talking, a laugh, music) as content, not dead air.
3. Add a short crossfade at the join and fill with room tone so the cut doesn't click.
4. Repeated words aren't always stutters (deliberate emphasis). Judge them. Retakes: keep the best take. False starts: remove up to the clean restart.
5. Every cut stays editable and can be restored in the editor. Log a reason for each cut.

## 9. Plan review and the director's note

1. **Plan review defaults on** (Rick, Nov 22). Where the app supports a plan-review or checkpoint screen, produce the edit plan and wait for approval before building the video. The user can turn review off. If the app has no review step on this job, write the plan into the job folder and the director's note, log that the review screen was not available, and continue.
2. Watch the whole thing as a viewer before delivery: story, meaning preserved, no clicks, no clipped words, no sudden level jumps, no faces covered.
3. Director's note: the story found in the footage, why these moments, pacing, look, music, the hook and CTA, where VO or cards were added and why, anything the footage could not support, and how this differs from recent work on the style ledger.
4. Request checklist complete.

## Sources

- Frame.io Workflow Guide: stringouts (https://workflow.frame.io/guide/stringouts), editing stages (https://workflow.frame.io/guide/editing-stages) and receiving feedback (https://workflow.frame.io/guide/receiving-feedback).
- Aspect, "How to Build String-Outs and Selects for Documentary Editing" (https://aspect.inc/blog/post-production/how-to-build-string-outs-and-selects-for-documentary-editing).
- StoryFolder, "Stringout, selects, assembly, radio cut", which cites Steve Shlisky's *Editing the Documentary*, Vashi Nedomansky ACE and Oliver Peters (https://storyfolder.com/blog/stringout-vs-selects-assembly-radio-cut).
- Frederick Wiseman, "On Editing", *The Threepenny Review*, Spring 2008: "the story is found in the editing" (https://www.threepennyreview.com/on-editing-spring-2008/).
- Walter Murch, *In the Blink of an Eye*: the Rule of Six (https://blogs.ischool.berkeley.edu/i290-viznarr-s12/the-rule-of-six-walter-murch/).
- PBS Editorial Standards, "Handle Interview Edits with Care" (https://www.pbs.org/standards/blogs/standards-memos/handling-quotations/) and the "Ethically Editing an Interview" case study (https://www.pbs.org/standards/blogs/standards-case-studies/ethically-editing-an-interview/).
- NPR Training, "How to decide what to cut (or not) in an interview" (https://www.npr.org/sections/npr-training/2025/05/29/g-s1-65686/how-to-decide-what-to-cut-or-not-in-an-interview).
- Canadian Journalism Foundation, "Ethical guidelines for editing audio" (https://cjf-fjc.ca/ethical-guidelines-editing-audio/).
- iZotope, "The Basics of Room Tone in Audio Editing" (https://www.izotope.com/community/blog/basics-of-room-tone-audio-editing).
- HSM University FILM-220 Lesson 8, "Editing documentary and unscripted material" (https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-8-editing-documentary-and-unscripted-material).
- Jump-cut repair practice (secondary, tool-vendor guides that agree with the above): https://addaly.com/learn/video-editing/cutting-a-dialogue-scene and https://www.heyeddie.ai/learn/fundamentals/hide-jump-cuts-in-interviews.
