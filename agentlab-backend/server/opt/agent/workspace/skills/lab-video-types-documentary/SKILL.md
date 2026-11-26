---
name: lab-video-types-documentary
description: Type playbook for short documentaries (1-3 min) and true crime, history and biography films: the pro standards (Must, Should, Freedom) and the type checklist for review.
when_to_use: Attached only when the job's kind is this type (picked by the router model at the judgment step); named by lab-video-producer.
page_line: Documentary films (also true crime, history, biography, and the base for music/culture): radio cut, B-roll that matches, J/L cuts, C4 checklist.
attach_roles: stage
---

# Type playbook: Short documentaries (1–3 min)

Must = fails review if broken. Should = default; break it on purpose with one line in `log/job.md`. Freedom = open.
Full playbook (hook, structure, pacing, layout, captions, audio, transitions, mistakes) and sources: `reference.md`.

**Hook.** The most compelling image or line first; the first 5 s decide whether anyone keeps watching [JAP-EDIT]. For YouTube, people on screen early and more than two shots in the first 5 s [ABCD].

**Must**
- The story works as audio alone.
- Every interview edit covered, or a deliberate jump.
- Speaker's face seen before their voice plays over B-roll.
- No meaning-changing edits.
- No black or silent holes.
- Safe areas for the aspect.
- TP ≤ −1 dBTP.

**Should**
- J/L cuts at most scene joins (about 30 f).
- A strongest-bite open.
- Alternating tempo.
- Lower thirds 90–180 f.

**Freedom**
- World design, camera grammar, archive treatment, score.

### Type checklist, run with the all-types C0 (`lab-video-review`) on change-point stills before render: Documentary (C4)
- [ ] Radio cut makes sense with picture off.
- [ ] Each speaker's face is shown before their voice plays over B-roll.
- [ ] B-roll matches the words.
- [ ] No black or silent holes.
- [ ] Title-safe (16:9: 90%) or the safe box (9:16).
