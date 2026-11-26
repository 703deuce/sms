---
name: lab-video-film
description: The stage map for a film made from scratch: the stage order, the file each stage hands to the next, and which stage page opens at each stage (video-stage prints it).
when_to_use: Always attached with lab-video-producer for a film made from scratch.
page_line: Always: the stage map of a film from scratch (stage order, hand-off files, the page that opens at each stage).
attach_roles: stage
---

# Film from scratch: the stage map

At the start of each stage run `video-stage <stage>` in the job folder: it prints that stage's pages (the build
stage adds the engine pages your `scenes/plan.json` picked, and the browser contract when any browser engine is in
it, plus any reference sections the plan names) and logs the read. Stages run in this order; each hands a file to the
next. Never skip a stage's page. Each stage's pages are for that stage only: they are not shown again later (after a
"[Context restored]" message, run `video-stage <current stage>` again). Before leaving a stage, add one line per page
to `log/stages.md`: `<stage> | <page> | what you applied`. Delivery is checked: every stage page and every page or
section `scenes/plan.json` picked must have been opened with `video-stage` and show in `log/stages.md`.

| # | Stage (`video-stage ...`) | Pages it opens | Hands off |
|---|---|---|---|
| 0 | intake (in your first message) | `lab-video-brief`, the one type playbook `lab-video-types-*` | `log/job.md`, `log/checklist.md` |
| 1 | `research` | `lab-video-research`, `lab-video-story` | `research/facts.md`, `assets/data/`, `script.json` |
| 2 | `direction` | `lab-video-variety`, `lab-video-engines` | `research/treatment.md`, `scenes/theme.json`, `scenes/plan.json` |
| 3 | `media` | `lab-video-media` | `assets/photos/`, `assets/clips/`, `research/sources.md` |
| 4 | `voice` | `lab-video-voice` | `audio/narration.wav`, `audio/words.json`, `audio/timing.json` |
| 5a | `design` | `lab-video-build`, `lab-video-motion`, `lab-video-text` | `design/system.md`, `design/components/`, component stills |
| 5b | `build` | only the engine pages `scenes/plan.json` picked, the browser contract if a browser engine is in it, and the `refs` sections | `scenes/<id>/` (code + README), stills |
| 6 | `sound` | `lab-video-sound` | `audio/sfx.wav`, `audio/music.wav`, the mix `audio/mix.m4a` |
| 7 | `review` | `lab-video-review` (with the type playbook from your first message) | `qa/changepoints.json`, `qa/sheet.jpg`, `qa/fixes.md`: every change point approved |
| 8 | `finish` | `lab-video-edit`, `lab-video-look` | one render `out/final.mp4` + `*_480p.mp4`, technical check, captions file |

- Stages 3, 4 and 6 can overlap (downloads, voice and sound run alongside each other); the order of the hand-offs
  still holds: no build before `scenes/plan.json` and `audio/words.json`; no render before stage 7 passes.
- `scenes/plan.json` carries `"type": "lab-video-types-<kind>"` and, per scene, `engine` and `layers[].engine` as
  page slugs (`lab-engine-<name>`), plus `"refs"`: the reference sections you want at build, each as
  `"<page>/reference.md#<section heading start>"` (one small section each, not whole files); `video-stage` reads
  those fields, so keep them exact.
- A revision re-enters at the stage it changes (a new voice = stage 4 onward) and always passes review before the
  one new render.
