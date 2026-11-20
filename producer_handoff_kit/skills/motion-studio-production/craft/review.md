# Review: how a pro judges a cut

Rhythm only exists in real time, and we cannot watch real-time playback, so we reconstruct it from cut timings, frame strips and audio. Pros watch at full speed, then with the sound off (eyes and picture logic), then with the picture off (the rhythm of speech, music and breath), and come back with fresh eyes (Walker, [Frame.io](https://blog.frame.io/2021/10/27/art-of-the-cut-dune-joe-walker/); Hamilton, [Slashfilm](https://www.slashfilm.com/1095254/top-gun-maverick-editor-eddie-hamilton-felt-the-weight-of-expectations-exclusive-interview/)).

**Live rules that frame this file:** no rendering until everything is approved. Creative review is on browser stills at 480p (full size only for a frame you can't judge at 480p). The final check is Modal's automatic QA on live jobs (no local render, no watch-through), or a watch of the single box-rendered master on every other job (`../SKILL.md`, `../qa.md`). Nothing below adds an encode before approval. The audio passes use the working voice/mix stems, which the sound stage builds anyway.

**Be honest about how we see.** We perceive through sampled frames plus continuous audio, not continuous motion. So sample densely where it matters (cuts, turns, moves), use the audio as a continuous signal, and never call a section "fine" from three stills.

## 1. Rough-cut review: after the cut, before any graphics
Do this once the assembly is cut and the sound is roughed in (tone bed, joins). Graphics wait for it.

**Pass A: timing on paper (we can't watch playback, Rick, Nov 19).** We only see stills, so don't pretend to watch it play. Read the rhythm from data instead, at no render cost:
- Lay the edit list against the transcript and the pause map: list every cut with its time, the words either side and the gap. Does the hook land in the first seconds? Does each section turn, or does it repeat?
- Plot shot durations (and later, graphic density) across the timeline. Look for waves of tension and release, not one flat level. Flag long stretches with no change (attention drift) and runs of very short cuts (rushed).
- Is the speaker's meaning intact everywhere (`editing.md` §6)? Read each joined passage as one sentence.

**Pass B: the picture alone.** Step 480p frame strips across every cut (several frames each side) and through every turn.
- Eyes: does each cut land where the thought lands (a blink, breath, look), or mid-blink or mid-mouth-shape?
- Eye trace: is the subject where the eye already is after the cut?
- Do jumps look intentional or accidental? Are there flash frames or one-frame gaps?
- Does the framing serve what matters in each section (face vs. board, screen or product)?

**Pass C: audio only, the sound alone.** Use the working voice/mix stem.
- Re-transcribe the cut audio with word timestamps. Clipped first or last syllables, words merged across a join, and gaps that sound unnatural all show up here.
- Measure short-term loudness per line (`ffmpeg ebur128`). The voice should be steady line to line.
- Check every join for clicks (a zoomed waveform at the join) and room-tone dropouts.
- Breaths and pauses: are the ones that do work still there?
- Music: does it enter and exit on story beats, duck before the first word, and end on a phrase?

Then write the fixes, apply them, and only then start graphics.

## 2. Still review while building (graphics, framing, color)
Use 480p stills, at the first, busiest and last frame of each scene, every hero moment, and wherever something changes. Step through moves densely enough to see every position. For each still, ask as a phone viewer:
1. What kind of video is this here, and what does the viewer need to see? Can they see it?
2. Is anything important covered by a graphic, the frame edge or the platform UI?
3. Is there one clear focal point? Squint and check in grayscale.
4. Can the type be read on a phone in the time it's up, while it's still?
5. Is it composed: headroom, look room, a gutter between type and subject, layout pieces not fighting?
6. Do graphics look like they belong in the shot (palette from the grade, grain, light)?
7. Does the color match across the cut, with skin natural and the board or screen readable?
8. Does it look premium? **If it doesn't look right, it isn't right**, whatever a tool says. Tools are hints, never the verdict.

Batch every problem from one look, fix the code that caused it, and re-check only the frames that exposed it plus their neighbours and both sides of any touched cut.

## 3. Final check (after approval)
Do the final check per the live skill: we can't watch playback, so step frame strips through the whole video and re-run the audio checks (re-transcribe, per-line loudness, joins) on the final mix. Then look closer at anything that seems off. Check pacing, sync at hard consonants and hit words, real-clip audio, ducking, every cut, caption timing against cuts, and the ending. Run `../qa.md` once. If you can't explain a cut, a hold, a crop or a graphic from what's on screen, it isn't ready.

## 4. Fresh eyes
After a fix round, re-check the opening and the turn (frames plus transcript) as a cold viewer who knows nothing about the subject. Would a stranger stay past the first 3 seconds? Would they understand the point without the brief?

## 5. Notes and revisions: fix the problem behind the note
Directors often give "a provocation or thought bomb" rather than a fix (Walker, [AOTC *Arrival*](https://www.provideocoalition.com/art-of-the-cut-joe-walker-arrival/)).
- For each note, write one line in the log on what the viewer probably felt and why. Then make the smallest change that fixes that cause.
- "Feels slow at 0:40" may really be a setup problem at 0:20.
- **Example:** Rick's note on the Willie cut meant the layout shouldn't be on screen the whole time. The revision removed it entirely, and he called that cheap. The right fix was to keep the signature layout and vary it at key moments.
- When a note is ambiguous, state in the progress message what you understood, and change only that.
- Precision still applies: map changes to element IDs, and keep untouched elements byte-identical (live revision rules).

## 6. Novice mistakes to catch before delivery
- **Picture:** cuts on sentence boundaries; every shot the same length; only the speaker shown; the same size throughout; unmotivated zooms; accidental-looking jumps; dissolves over weak cuts; flash frames.
- **Pacing:** all pauses removed; emotional beats rushed; one flat energy level; two takes making the same point.
- **Framing:** a face-tracked crop that hides the board, screen or product; a centre crop to vertical; a face cropped at the chin or forehead.
- **Graphics:** too few; centred over the person; competing focal points; text moving while it must be read; everything landing on one frame; flat graphics floating on footage; kinetic text of every word; one box locked on screen the whole time; template texture.
- **Sound:** digital silence; clicks; a voice level jumping between lines; music wallpaper; a swoosh on every move; music faded mid-phrase; pumping ducks.
- **Color:** a LUT at 100%; color jumps at cuts; odd skin; crushed detail on the board or screen; pure white graphics on a filmic grade.
- **Captions:** lines too long; reading too fast; breaks mid-phrase; captions hanging across cuts; names misspelled; anything burned in.
- **Meaning:** a cut that changes what the speaker meant.

## 7. How we'd prove an edit (when Rick asks)
Run a blind A/B against a human edit and against a typical auto-editor's cut of the same footage. Have an editor panel mark specific failures (mid-thought cuts, missed reactions, over-tightening, bad crops, typographic spam, literal B-roll, music fights). On posted clips, track 3-second hold, completion and replays. A "virality score" is not proof. Details are in `/workspace/editing_rules/BEATING_THE_SKEPTICS.md` §5.
