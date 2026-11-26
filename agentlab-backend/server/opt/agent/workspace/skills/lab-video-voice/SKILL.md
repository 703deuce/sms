---
name: lab-video-voice
description: Narration and timing for a film from scratch: pick the best voice from the full library, scratch timing for free, one paid ElevenLabs pass with set voice settings, words.json and timing.json as the clock, length within 10%, clip audio, dialogue standards.
when_to_use: Opened at the voice stage of a film from scratch (video-stage voice).
page_line: Voice stage: best-fit voice, free scratch timing, one paid ElevenLabs pass, words.json/timing.json clock, length +/-10%, clip audio.
attach_roles: stage
---

# Voice and timing (stage 4)

**The voice is the spine; everything else sits behind it.** A voice the user named or supplied is used exactly
(a supplied voiceover drives the timing instead of TTS); otherwise pick the best fit for this film, never by habit.
Scripts below live in `CS=/opt/engines/repos/cinematic-skill/skills/cinematic-film`.

## Pick the voice (free)
```bash
tts --find "calm deep documentary narrator" --gender male --n 8   # shared library with preview URLs
tts --add <owner_id>:<voice_id>                                   # then use --voice <voice_id>
```
Search by what this film needs (subject, tone, audience, era, accent); download 2-3 previews and compare tone, pace
and clarity; log the voice id and why in `log/job.md`.

## Record
1. Scratch timing for free first: `edge-tts --text "..." --write-media audio/scratch/T01.mp3 --write-subtitles
   audio/scratch/T01.vtt` per take (or Cinematic `make_beats.py` estimates), to fix length before any paid call.
2. Final voice (default, paid within the film's ~$5 paid budget): ElevenLabs, one pass for the whole script (two at
   most), Flash, `mp3_44100_128`:
   `tts "<text>" -o audio/takes/T01.mp3 --voice <id> --speed 0.85 --stability 0.55 --similarity 0.75 --style 0.15`
   If the key is missing, the call fails twice, or the budget is spent: use the best free voice (edge-tts) and say
   so in the final message; never ship a scratch voice silently.
3. `split_takes.py` + `build_narration.py --project P [--target S]` -> `audio/narration.wav`, `audio/timing.json`.
   Word times: `transcribe audio/narration.wav -o audio/words_raw.json` -> `audio/words.json`
   (`{line_id: [{w, t0, t1}]}`). Word anchors raise, never guess: a missing word is an error you fix.
4. Narration + ~0.9 s lead + ~2-3 s tail within +/-10% of the target length; rewrite rather than time-stretch
   (`build_narration.py --target` within +/-5% is fine). Spot-check that word times match the audio (+/-50 ms).

## Clip audio
A clip with someone talking (interview, news, speech) plays its own audio: pause the narration around it and duck the
music under it. Clips that are mostly background music stay muted under narration.

## Dialogue standards (Must; detail and sources in `reference.md`)
- Dialogue intelligible on a phone speaker; breaths turned down (~-15 dB), not all cut; 0.25-0.5 s room tone at
  heads and tails; voice pace about 115-130 words per minute.
- Music, SFX and loudness: `lab-video-sound`.
