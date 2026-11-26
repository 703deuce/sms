# Sound: dialogue, room tone, split edits, sound design, music, mix

Sound comes first. The eye takes each cut as a new picture, but the ear hears one unbroken track, so a bump in the room tone gets noticed more than the cut itself (Dmytryk, [notes](https://www.chicagomediaworks.com/2instructworks/3editing_doc/3editing_docdymytryk.html)). A smooth track makes the picture edit invisible. On BYOF jobs the customer's voice is the spine.

## 1. Dialogue editing (the invisible layer)

**Room tone under every cut.** Build a tone bed from the speaker's own clean silences near each edit, and match its level and color. Gaps get tone, never digital silence ([Idyll Sounds](https://idyllsounds.com/blog/dialog-editing-how-to-fill-a-scene-with-noise), [HSM FILM-310](https://hsmuniversity.org/us/course/film-310-sound-for-film/lesson-6-dialogue-editing)).

- *Judge:* listen to every join at normal speed and on a zoomed waveform. Does the background hiss switch on and off? Is there a click?

- *Trap:* the background drops out at every cut.

**Tiny fades at zero crossings.** Use short audio crossfades of about 20–50 ms at joins (`../craft-standards.md` §1.5). They should be inaudible. A long audio crossfade smears two words into one, and a picture crossfade is a separate decision (`editing.md` §5).

**Never cut inside a word.** Cut on pauses or plosives. Leave 0.25–0.5 s of tone before the first word and after the last (`../craft-standards.md` §1.5).

**Breaths are performance.** Keep the breath before a thought, and reduce or remove the gasp in the middle of one. Stripping every breath sounds robotic.

**Match across takes.** When lines come from different takes, mic distance, room and energy shift. Match them with level and EQ, or choose another take. Don't leave the change audible.

**Clean only until the voice is clear.** Noise reduction, de-essing and de-reverb leave artifacts. If the voice sounds underwater, back off.

**Steady level from line to line.** Check short-term loudness (a few seconds at a time) across every line, not only the integrated number. The viewer should never reach for the volume (BBC's "volume surfing" warning, in `/workspace/editing_rules/EDITING_PRINCIPLES.md` §13).

## 2. Split edits, pre-laps and sound bridges

- **J-cut:** the next sound starts before its picture. **L-cut:** the outgoing sound carries over the next picture. About 1 s is usually plenty (`../craft-standards.md` §1.4).

- *Why:* we hear someone before we turn to look. Split edits make a cut feel like attention moving naturally. When every cut changes picture and sound together, the edit plays like a slideshow ([HSM FILM-220](https://www.hsmuniversity.org/us/course/film-220-film-editing/lesson-6-editing-dialogue-scenes)).

- In explainers, let the next line pre-lap under the end of a graphic or cutaway to pull the viewer forward. Hold the sound of a reveal over the next shot so it sinks in.

- A sharp sound makes people blink, so a cut placed on it disappears.

## 3. Sound design

- **Clear density.** Viewers follow only a few layers at once. Murch puts it at about five when the layers are different kinds of sound (speech, music, effects), and about two and a half when they're the same kind ([Transom](https://transom.org/2005/walter-murch/)). Pick the few sounds that matter, and change the density as the story changes.

- **Specific, not generic.** Use the customer's real sounds first: the marker on the board, the click, the room. A quiet, specific sound tied to a graphic's move makes it feel physical.

- *Trap:* a stock swoosh on every graphic. That is template texture.

- **Ambience grounds graphics.** A steady room or exterior bed keeps graphic-heavy sections from feeling like they hang in a vacuum.

- Placement follows the live skill: hits about 0–150 ms after the word, not on the stressed syllable, and SFX peaks at or below the voice (live `SKILL.md`, sound stage).

## 4. Silence

- Near-silence before a hit is what makes the hit land.

- Pull the music out before an important line, which tells the viewer to listen.

- In documentary, the pause after a hard answer is often the most important part. Don't fill it with a graphic or a riser.

- *Trap:* music running under everything, so the key line gets the same weight as filler.

## 5. Music

- **Music is a choice, not wallpaper.** On BYOF, only use it when it serves the customer's footage and direction. A quiet explanation may be better with none.

- **Edit the music.** Cut on downbeats at phrase boundaries (usually 4, 8 or 16 bars), and hide edits under hits. Rebuild the track so intro, build, drop and outro line up with the film's structure. End on a real ending, never a fade halfway through a phrase.

- **On the beat, but not always.** Put the big hits on the beat and let dialogue-driven cuts follow the speech. Machliss warns against everything feeling "completely sunk up" and "robotic" ([Deadline](https://deadline.com/2018/01/baby-driver-sound-editing-jonathan-amos-paul-machliss-interview-edgar-wright-1202230138/)).

- **Against the moment, or no music at all,** is often stronger than sad piano under a sad line.

- **Ducking.** Music is already down when the first word lands. Typical depths are 10–18 dB, ≥20 dB for music with vocals (or avoid it under speech), ramps in 200–500 ms and out 600–1500 ms (`../craft-standards.md` §1.12). The live mix step's sidechain duck stays (`mix_soundtrack.py`). Listen for pumping, and if you hear it, ride the level around those lines instead.

For a scored film, the Producer composes a cue list (up to four story/mood sections) with ElevenLabs Music; do not use one track per arbitrary minute. Loop long passages seamlessly on bar boundaries and place short crossfades at musical turns. Use the existing mixer's sidechain to duck music 10–18 dB beneath narration; do not reproduce the old one-off synth's roughly 8 dB duck. Land the final musical resolution on the final frame rather than cutting mid-phrase. BYOF footage may need no score at all.

## 6. Mix and finishing

- **Dialogue is the anchor.** Mix around the voice, then normalize.

- **Loudness: use the job's `qa.md` target.** The −14 vs −15 LUFS question is still unsettled. Don't decide it here. True peak ≤ −1 dBTP.

- **Stems** stay separate (voice, ad-libs, music, SFX/ambience), grouped like song tracks per the live skill.

- **Phone-speaker check.** Phone speakers drop the low end. Bass-heavy music disappears, and the voice needs presence (roughly 1–4 kHz) to cut through.

- **Audio QC before the final check:** clicks at cuts, room-tone gaps, sync drift at hard consonants, overs, pumping, a music ending that doesn't land, and an abrupt drop to silence at the very end.

## 7. Novice vs pro

| Novice | Pro |
|---|---|
| Digital silence where pauses were cut | Room tone in every gap |
| Picture and sound always cut together | J/L cuts and pre-laps guide attention |
| Music under everything at one level | Music enters, rises, ducks, drops out and lands |
| Music faded mid-phrase | Music edited to finish on a real ending |
| A swoosh on every graphic | A few specific sounds that carry weight |
| Every breath and pause removed | Breath and silence kept as performance |
| Only integrated LUFS checked | Voice steady line to line, then normalized |
