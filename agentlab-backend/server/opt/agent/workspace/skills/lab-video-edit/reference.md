# Editing, sound and delivery: reference (tested on this lab Nov 26 2026: 12 s mixed film, 0.56 MB, -13.7 LUFS)

Helpers in this folder (`/workspace/skills/lab-video-edit/`): `getmusic.py`, `merge_cues.py`.

## 1. Music bed (free, licensed)
```bash
python3 /workspace/skills/lab-video-edit/getmusic.py "Dark,Somber" media/bed.mp3 60 110
# prints 5 candidates (title | feel | bpm | length) and a ready credit line -> paste into out/sources.md
```
Kevin MacLeod / incompetech.com, CC BY 4.0 (credit required). Feels include Dark, Mysterious, Somber, Tense,
Suspenseful, Epic, Uplifting, Bright, Calming, Driving... Other free sources: Wikimedia Commons audio (CC BY/
BY-SA/CC0, via `fetch_commons.py search`), archive.org (only CC0/CC BY/BY-SA; skip NC/ND). Pick a section that
fits: `ffmpeg -ss 35 -i bed.mp3 -t 40 bed_cut.mp3` (start on a phrase, check by ear with `ebur128` levels).

## 2. SFX on the shared clock
```bash
python3 $CS/render.py --project $P --cues          # cues for every Cinematic item
python3 /workspace/skills/lab-video-edit/merge_cues.py $P '[[4.0,8.0]]' \
  '[{"type":"whoosh","t":3.95,"gain":0.7},{"type":"pop","t":4.15,"gain":0.6},{"type":"ticks","t":6.2,"gain":0.5}]'
python3 $CS/build_sfx.py --project $P              # -> audio/sfx.wav
```
Ranges = Remotion segments (their own hits are added by hand from the scene plan). Whoosh `t` 1-2 frames before
the cut; riser `{"type":"riser","t":T-1.5,"dur":1.5}` ends on the hit; `impact`/`stamp` on verdict/number words.

## 3. Mix to target
```bash
python3 $CS/mix_soundtrack.py --project $P --music media/bed_cut.mp3 --lufs -14 \
  --music-db -4 --sfx-db -3 --duck-ratio 3 --duck-threshold 0.03 --music-level 0.07   # -> audio/mix.m4a
```
Two-pass loudness normalisation, sidechain ducking of music under VO, -1.5 dBTP ceiling. Without Cinematic:
`ffmpeg -i vo.wav -i music.mp3 -filter_complex "[1:a]volume=0.25[m];[m][0:a]sidechaincompress=threshold=0.03:
ratio=8:release=250[d];[0:a][d]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1:LRA=11" mix.m4a`.

## 4. Join, texture, encode, check
```bash
printf "file '%s'\n" out/seg01.mp4 out/seg02.mp4 out/seg03.mp4 > list.txt     # in timeline order
ffmpeg -y -f concat -safe 0 -i list.txt -c copy cut.mp4    # if it complains, use -vf fps=30,scale=854:480 + re-encode
ffmpeg -y -i cut.mp4 -i $P/audio/mix.m4a -map 0:v -map 1:a -shortest \
  -vf "noise=alls=6:allf=t,vignette=angle=PI/5" -c:v libx264 -crf 26 -preset medium -maxrate 2.5M -bufsize 5M \
  -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -movflags +faststart out/final.mp4
ffmpeg -hide_banner -nostats -i out/final.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary
for t in 1 5 9 13 17 21 25 29; do ffmpeg -v error -y -ss $t -i out/final.mp4 -frames:v 1 out/check_$t.png; done
```

## Levels (pro reference)
| Element | Target |
|---|---|
| Final, social/YouTube | -14 LUFS integrated, <= -1 dBTP |
| Final, broadcast EU / US | -23 LUFS +-0.5, -1 dBTP (EBU R128) / -24 LKFS, -2 dBTP (ATSC A/85) |
| VO | consistent, peaks ~-6..-3 dBFS before master, always intelligible |
| Music under VO | 10-20 dB below VO (ducked), up 3-6 dB in gaps |
| SFX | 6-12 dB under VO; impacts on silent beats may match VO |

## Editing grammar
- Murch's Rule of Six, in priority order: emotion 51%, story 23%, rhythm 10%, eye-trace 7%, 2D plane 5%, 3D space 4%.
- Cut on action; match eye-trace (next hero appears where the eye already is); J/L cuts at seams.
- Narration drives cuts; music downbeats for reveals; leave room (air) before key lines.

## Sources (fetched Nov 26, 2026)
- Walter Murch's Rule of Six: https://blogs.ischool.berkeley.edu/i290-viznarr-s12/the-rule-of-six-walter-murch/
- Five fundamental editing techniques (cut on action, J/L): https://www.editshare.com/blog/5-fundamental-editing-techniques/
- J and L cuts: https://www.adobe.com/creativecloud/video/post-production/cuts-in-film/l-and-j-cut.html
- EBU R128 loudness: https://tech.ebu.ch/docs/r/r128s4.pdf ; ATSC A/85 (-24 LKFS)
- Loudness targets per platform 2026: https://www.forasoft.com/learn/audio-for-video/articles-audio/lufs-targets-per-platform-2026
- Mastering for YouTube (-14 LUFS, -1 dBTP): https://www.saucemastering.com/blog/how-to-master-for-youtube
- Mixing for YouTube (music under VO, ducking): https://sounddesign.irpr.agency/guides/how-to-mix-audio-for-youtube/
- Sound design for documentaries (whoosh/riser/impact placement): https://creatuneagency.com ; https://faviovazquez.github.io/showtime/docs/pacing.html
- Kevin MacLeod licence: https://incompetech.com/music/royalty-free/licenses/


---

# Craft standards: cutting, speech, pacing, transitions, sync (detail and sources)

**Must** = a hard pro or platform standard; breaking one fails review. **Should** = a strong default; break it on
purpose and write one line in `log/job.md` saying why. **Freedom** = where creativity is open: every visual choice
(type family, palette, layout shape, motion grammar, texture) stays open unless a line is marked Must.
Units: pixels for 1080x1920 with the 480x854 value in brackets (x 0.444); frames at 30 fps (1 f = 33.3 ms).
Source labels in [BRACKETS] resolve in `/workspace/skills/lab-video-edit/craft-sources.md`.

> **Scope of every face rule:** face framing, face punch-ins, eye lines and "face on screen" rules apply only to the clip or moment where a person is just talking (podcast, interview, talking head). They do not carry over to a whiteboard, screen, tutorial, demo, product or any moment where something else is what the viewer needs to see. There, frame for that content. Decide clip by clip.

## 1.1 What a cut has to do, in priority order (Murch's Rule of Six)
Murch ranks what a cut must satisfy: **1) emotion (51%), 2) story (23%), 3) rhythm (10%), 4) eye-trace (7%), 5) the two-dimensional plane of the screen (5%), 6) three-dimensional space of action (4%)**. When you can't satisfy all six, give them up from the bottom: "don't ever give up emotion before story", and so on [MURCH].
- In our pipeline this means a deliberate continuity break (a jump cut, a crossed line) is allowed when it serves emotion or story. QA should flag it, not auto-fail it.

## 1.2 Dmytryk's seven rules of cutting [DMYT]
1. Never make a cut without a positive reason.
2. When undecided about the exact frame, cut long rather than short.
3. Whenever possible, cut in movement.
4. Fresh material is preferable to stale.
5. Scenes should begin and end with continuing action.
6. Cut for proper values rather than proper matches: drama beats a perfect match.
7. Substance first, then form.

## 1.3 Continuity grammar
- **180-degree rule.** Keep the camera on one side of the line between two people, so A always looks one way and B the other. When you reframe a two-shot into a split or stack, keep each person facing the way they face in the source; never mirror-flip a face to "fix" a layout [JAP-FRAME][ADOBE-180].
- **Eyeline.** Gaze direction and height stay consistent across shot/reverse-shot. A subject who looks screen-left sits on the right third with lead room to the left [JAP-FRAME].
- **30-degree rule / jump cuts.** Cutting between two near-identical framings of the same subject reads as a jump. Change the angle by at least 30°, or change shot size clearly. Otherwise the jump is a deliberate style choice [WIKI-30][BBC-BITE].
  - *Clip application:* when you cut out words inside one camera angle, hide the seam with a real change: a punch-in or punch-out (different size), a layout change, a reaction shot or a B-roll insert. The other option is an intentional jump cut that fits the film's style [JAP-EDIT][HSM-8].
- **Cut on action.** Cut a few frames after a movement begins in the outgoing shot and pick it up slightly later in the incoming one. Some editors overlap the action by 1–2 frames [HSM-4]. Motion carries the eye across the cut [JAP-EDIT].
- **Motivated cuts.** Cut on a look, a sound, a movement or a story need. An unmotivated cut needs a purpose, such as surprise [HSM-3].
- **Match cuts / graphic matches.** Link two shots through shape, colour or composition (the bone-to-spacecraft cut). A *sound match* bridges two scenes through audio [HSM-3].

## 1.4 Conversations: split edits and reactions
- **J-cut:** the next shot's audio starts before its picture. **L-cut:** the outgoing audio continues under the next picture. "One second or so is plenty" (≈ **30 f**) [JAP-EDIT][ADOBE-JL][HSM-6].
- L-cuts are how B-roll and reactions are laid under a speaker. J-cuts pull the viewer into the next speaker or scene [JAP-EDIT][HSM-6].
- **Reaction shots.** Cutting only to whoever is talking ("ping-pong editing") feels mechanical. Reactions carry subtext, control pause length without breaking lip sync, and hide trims [HSM-6].
  - Cut to a reaction just **after** a punchline, not during it.
  - Don't cut away from a line the audience needs to watch being delivered [HSM-6].
- **Groups of 3+ people.** Pick the 2–3 people who drive the moment and treat the others as a chorus whose reactions punctuate key lines. Return to a wider frame from time to time to re-establish who sits where [HSM-6].
- **Overlaps.** Closing response gaps tightens pace, but keep the pauses that carry meaning [HSM-5][HSM-6].

## 1.5 Speech edits: never mid-word, keep it human
- **Must: never cut inside a word, a vowel, or a continuous consonant (M, N, S).** Cut in a pause or breath, or just before a stop consonant (P B T D K G), where the consonant's attack hides the join [JAP-SPEECH].
- **Must: no clicks.** Blend each audio join with a short crossfade of **20–50 ms** [JAP-SPEECH]. Lay room tone under gaps, never digital silence [JAP-SPEECH][HSM-6].
- **Pauses.** Shorten them; don't delete them.
  - Example from the lesson: a 2 s pause becomes **0.6 s (18 f)** [JAP-SPEECH].
  - Descript's word-gap tool detects gaps longer than a threshold you set and shortens them to a target you set; its example target is 200 ms (6 f) [DESC-GAPS]. Treat 200 ms as the floor for fast social clips, not a default for every gap.
  - Keep longer air after a line that needs to land [HSM-5].
- **Breaths.** Turn them down, don't cut them all out: about **−15 dB** is the suggested start. Over-editing (every breath and pause gone) makes speech sound robotic [JAP-SPEECH].
- **Fillers.** Cut the fillers that distract and keep the ones that carry thought. Some fillers keep a speaker's natural cadence; cut more, but don't over-edit [DESC-EDIT].
- **Heads and tails.** Leave **0.25–0.5 s (8–15 f)** of room tone before the first word and after the last [JAP-SPEECH].
- **Must: preserve meaning (ethics).**
  - Never splice words so someone appears to say something they didn't. Never cut a qualifier that flips the meaning [JAP-SPEECH].
  - Never move a reaction onto a question it wasn't answering [HSM-8].
  - Removing "ums" and condensing an answer is fine if the meaning stays the same [HSM-8].

## 1.6 Pacing and rhythm
- **Measured data:** the average shot length (ASL) of Hollywood films fell from about **10 s** (1930s–40s) to **under 4 s** after 2000. Shorter shots also carry more motion [CUTTING].
- **Illustrative ASL ranges** (editing course, not measured) [HSM-5]:

  | Material | Typical ASL |
  |---|---|
  | Contemporary drama | 4–7 s |
  | Action sequences | 1.5–3 s |
  | Music videos and trailers | 1–2 s |

- **Cut count is not pace.** Pace is how fast story and emotion arrive [HSM-5].
  - Accelerate (shorter shots) into a peak, then release on a held shot.
  - Hold a shot until its information is absorbed, then cut. Wide or text-heavy shots need longer; a simple close-up can be short.
  - Leave air after an important line.
  - "Enter late, leave early." Don't trim every shot evenly [HSM-5].
- **Montage to music.** Cut to the music's structure: phrases and accents. One beat lasts 60 ÷ BPM seconds. Vary the pattern and hold a key image across a phrase so it doesn't feel mechanical [HSM-7].
- **Vary shot length.** A row of identical 4 s shots feels mechanical [JAP-EDIT].

## 1.7 Transitions
- **The straight cut is the default.** It reads as "now and next" [HSM-3][JAP-EDIT].
- **Conventional meanings:**
  - Dissolve: time passing, a soft link, memory.
  - Fade to black: the end of a section or a bigger time jump.
  - Wipe: reads as dated unless it is the deliberate style [JAP-EDIT][HSM-3].
- **Don't** put a dissolve inside a continuous conversation: it implies time passed. A dissolve over a bad cut "is usually a slow bad cut"; fix it with a different take, a trim, a cutaway or sound instead [HSM-3].
- **Keep each transition's meaning consistent** through a film; that consistency is part of the film's transition grammar [HSM-3].

## 1.8 Sync
- **Lip sync** (ITU-R BT.1359): viewers detect sound **+45 ms early** or **−125 ms late**. It becomes unacceptable past +90 / −185 ms [ITU-1359][HSM-9]. At 30 fps that means **≤1 frame early, ≤3 frames late**. After any crop or retime, audio and picture must stay frame-locked.
- **Caption in-time** is on the first frame of the audio, or within 1–2 frames of it [NFX-T].
- **Graphic hits** (a word slam, a counter): the house 0 to +200 ms after the word stays valid for design hits. It does not apply to captions.
