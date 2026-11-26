# Motion-graphics craft: reference

## Numbers that work at 30 fps
| Element | Duration | Easing |
|---|---|---|
| Card/frame entrance | 8-15 frames (0.25-0.5 s) | ease-out cubic or spring (damping 12-18, stiffness 120-180) |
| Exit | 5-9 frames | ease-in |
| Camera move between clusters | 0.8-2.0 s | ease-in-out (cubic/quint) |
| Whip | 9-18 frames | ease-in-out quint + directional blur |
| Counter roll | 18-36 frames | ease-out (fast start, settles on value) |
| Stagger between siblings | 2-4 frames | same curve |
| Text hold | >= 0.3 s per word, >= 1.2 s total | still while read |

## Word timing (shared clock)
`audio/timing.json` from Cinematic `build_narration.py`: `segments[] = {id, start, end, vo}`. Word time by letter
share (what Cinematic `doc.W(i,"word")` does):
```python
import json
seg = {s["id"]: s for s in json.load(open("audio/timing.json"))["segments"]}
def word_t(line_id, word, text):
    s = seg[line_id]; i = text.lower().find(word.lower())
    return s["start"] + (s["end"] - s["start"]) * max(i, 0) / max(len(text), 1)
```
For exact words run `transcribe audio/narration.wav` (Deepgram word timestamps) and match words in order.

## Parallax math (any engine)
`layer_offset = camera_xy * depth`, depth: far 0.3, mid 1.0, near 1.5; scale near layers 1.05-1.15 and blur them
(2-6 px at 480p) for depth of field. Keep far layer >= 120% of frame so its edges never show.

## Camera language cheat sheet
- Push-in: build tension, focus, intimacy. Pull-back: reveal, context, isolation, ending.
- Truck/pan along a row: chronology, lists, "and then". Tilt down/up: reveal hierarchy.
- Slow drift (1-3%/s zoom) keeps a still alive; stop drift during reading-critical text if it jitters.
- Match energy to the beat: hook and turn get the fastest moves; context lines the slowest.

## Safe areas and legibility
- EBU R95: action-safe 93% (3.5% inset), graphics/title-safe 90% (5% inset). At 854x480 keep text inside
  x 43-811, y 24-456; keep the bottom 12% free if burnt-in captions are used.
- Mobile: body text >= 3.5-4.5% of frame height, high contrast (shadow/plate behind light text over footage).

## Sources (fetched Nov 26, 2026)
- 12 principles of animation (easing, anticipation, follow-through, staging): https://www.adobe.com/creativecloud/animation/discover/principles-of-animation.html
- School of Motion, follow-through and overlapping action / Animation Bootcamp: https://schoolofmotion.com/blog/follow-through-tutorial
- Principles of animation for motion design (staging/eye-trace, hierarchy): https://www.meganfriesth.com/learn/principlesofanimation
- EBU R95 safe areas: https://tech.ebu.ch/publications/r095
- Type on moving pictures (size per frame height on mobile): https://addaly.com/learn/video-editing/type-on-moving-pictures
- Text timing (0.3 s/word, minimum holds): https://typographyedit.com/tools/text-timing-calculator ; https://legibility.info/rules-for-text-in-videos
- Motion craft (easing, stagger, holds, camera moves) and pacing/beat sync: https://faviovazquez.github.io/showtime/docs/motion-craft.html
- Camera language (push-in vs pull-back): https://www.paraplex.ai/help/camera-moves-and-shake ; https://motionwritten.com/atlas/camera
- 2.5D parallax from stills (layer speeds, depth): https://mahsan.app/library/motion/parallax-2-5d/ ; https://mediascaleup.com
