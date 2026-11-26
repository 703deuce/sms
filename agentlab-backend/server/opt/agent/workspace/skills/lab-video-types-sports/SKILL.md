---
name: lab-video-types-sports
description: Type playbook for Sports highlights and sports stories: the pro standards (Must, Should, Freedom) and the type checklist for review.
when_to_use: Attached only when the job's kind is this type (picked by the router model at the judgment step); named by lab-video-producer.
page_line: Sports highlight or sports-story films: open on the climax, screen direction, real slow motion only, C3 checklist.
attach_roles: stage
---

# Type playbook: Sports highlights

Must = fails review if broken. Should = default; break it on purpose with one line in `log/job.md`. Freedom = open.
Full playbook (hook, structure, pacing, layout, captions, audio, transitions, mistakes) and sources: `reference.md`.

**Hook.** Open on the decisive play or its biggest moment, then rewind to how it happened. This is the sanctioned "start at the climax" hook [TT-CA1].

**Must**
- Screen direction is consistent, or the crossing is motivated.
- The ball/subject stays in frame through tracked crops.
- Text inside the safe box.
- No duplicated-frame fake slow motion.
- TP ≤ −1 dBTP.

**Should**
- Open on the climax or stakes.
- Cut on motion.
- Hold the reaction.
- Natural sound up at peaks.
- Montage cut to musical phrases.

**Freedom**
- Broadcast-package look or not.
- Score-bug style.
- Speed ramps.
- Music genre.

### Type checklist, run with the all-types C0 (`lab-video-review`) on change-point stills before render: Sports (C3)
- [ ] Screen direction is consistent.
- [ ] The ball or subject stays in the crop.
- [ ] Slow motion comes only from high-frame-rate sources (mpdecimate shows no duplicates during motion).
- [ ] The reaction is held. Graphics stay off the action.
