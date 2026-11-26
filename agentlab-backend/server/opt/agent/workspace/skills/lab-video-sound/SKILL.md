---
name: lab-video-sound
description: Sound stage of a film from scratch: SFX on visual hits, music by mood (generated ElevenLabs Music by default within the cap, a supplied or free track as fallback), score vs song, the mix with ducking and loudness, stems, the pre-render audio check.
when_to_use: Opened at the sound stage of a film from scratch (video-stage sound).
page_line: Sound stage: SFX on hits, generated or supplied music by mood under the voice, mix, ducking, loudness, stems.
attach_roles: stage
---

# Sound (stage 6)

**Dialogue first; music and SFX sit behind the voice.** Run it alongside the build once `audio/timing.json` exists.

## SFX
Cinematic `render.py --project P --cues` + `build_sfx.py --project P`, engine SFX (Dolly `sfx.mjs`, the Remotion
craft guide's `npm run audio`), the `sfx` tool, or synthesised cues on visual hits. Hits land ~0-150 ms after the
word, off the stressed syllable, never louder than the voice median.

## Music
- A track the user supplied is used. Otherwise decide whether music improves the film and, per mood, **music**
  (groove with drums) or **score** (no drums: pads, strings, piano, tension, ambience); serious, sad, dark or scary
  subjects usually get score. Genre and era match the subject; vary it across films.
- Write `audio/music_cues.json`: `{film_duration_seconds, has_narration, cues: [{id, start, end, prompt, bpm,
  drums, vocals}]}`, 1-4 cues covering the film with no gaps, ending on the last frame. Prompts describe mood,
  instruments and era; never an artist, song or lyric.
- **Default: generated music** (ElevenLabs Music, instrumental under narration):
  ```bash
  M=/workspace/skills/lab-video-sound/gen_music.py
  python3 $M --cues audio/music_cues.json --out audio/music.wav --dry-run      # estimate: minutes x $0.15
  python3 $M --cues audio/music_cues.json --out audio/music.wav --raw-dir audio/music_src/
  ```
  Music cap ~$2 per film and ~$5 for all paid calls in the film (voice included): set
  `MOTION_STUDIO_PAID_BUDGET_REMAINING_USD` to what is left. Cached cues are reused on retries; at most two attempts
  per cue. Log the estimate and the spend in `log/job.md`.
- **Fallback** (key missing, over budget, or two failed attempts): a real free track by feel,
  `python3 /workspace/skills/lab-video-edit/getmusic.py "Dark,Mysterious" audio/music.mp3` (keep the credit line in
  `research/sources.md`), and say why in the final message.

- **Edit the music**: cut on downbeats at phrase boundaries (4/8/16 bars), line intro/build/drop/outro up with the
  film's structure, end on a real ending, never a mid-phrase fade. Big hits on the beat, the rest follows speech.
- **Silence is a tool**: near-silence before a hit; pull the music out before an important line; let a hard answer
  breathe. Against-the-moment music or none is often stronger than the obvious cue.
- SFX: a few specific sounds that carry weight, not a stock swoosh on every move; a steady ambience bed under
  graphic-heavy stretches; viewers follow ~5 layers of different kinds at once at most.

## Mix
```bash
python3 $CS/scripts/mix_soundtrack.py --project P --music audio/music.wav --stems --lufs -14 \
  --duck-ratio 4 --duck-threshold 0.025
```
Sidechain duck and two-pass loudnorm. Music at least 18 dB under the voice while anyone speaks (sung vocals never
under narration); ramps 200-500 ms in, 600-1500 ms out; real clip audio at the voice level. If the duck measures
short, change the flags (`--duck-ratio 6`, `--duck-threshold 0.015`) and listen for pumping; never edit the mixer.
Stems at master length (narration, music, sfx, footage audio).

Phone-speaker check: the voice needs presence (~1-4 kHz) and stays steady line to line (short-term loudness), not
only on the integrated number.

## Check before render
`python3 /workspace/skills/lab-video-review/review.py audio audio/mix.m4a --voice audio/narration.wav --music
audio/music.wav`: -14 LUFS +/-1, true peak <= -1 dBTP, music >= 18 dB under the voice. Standards: `reference.md`.
