> Read `craft-standards.md` (podcast / interview / panel clips section) and the `craft/` playbook before every clip job and apply them with judgment (SKILL.md section 1). Decide the pack's creative idea from what you're editing before building (SKILL.md section 1, Rick, Nov 19). Rick (Nov 16, 2026): no ornamental masks or small windows around moving faces; people big and clearly visible; steady, smoothed crops (stationary unless the person really moves); a polished pro podcast-clip look, not a heavy themed frame; files about 15–20 MB per clip with little or no grain.

# Clip production (Motion Studio Producer)

This is the playbook for Transovo clip jobs (`clip_and_finish` and `finish_clip`). It extends the Motion Studio production skill. The non-negotiables, secrets rules, Visual DNA rules, `qa.md`, `engines.md`, `engine-library.md` and `delivery-contract.md` still apply unless this file says otherwise. One unified director handles both clip actions and Motion Studio film jobs; only the intake, stages, and delivery shape change.

A clipping job is a **finish of customer footage**, not a research-to-film production. The customer already supplied the video. You cut, lay out, and dress highlights, then deliver finished MP4s. Do not invent a new story, write narration, or search the web for photos and clips unless the customer instruction explicitly asks for B-roll or a graphic that needs a real reference. The source video is the picture. If narration is used at all, use `eleven_flash_v2_5`. No licensing, rights, or font caveats. Heavy engines stay out (Blender, Godot, Unreal). No install pauses mid-job. No 2-second smoke or draft renders, and no rendering until every clip is approved on browser stills (Rick, Nov 18). Build the real clip, review it with still screenshots, render it once, and fix or swap an engine that breaks for one at least as good.

The live contract is Transovo Agent Clipper v1 (`docs/contracts/transovo-agent-clipper-v1.md`, master `855ca229`). Details and known gaps: `/workspace/motion_jobs/AGENT_CLIPPER_CONTRACT.md`.

---

## How the two actions differ

**`clip_and_finish`** (`mode: autonomous_clipper`). You watch and listen to the **full source** and pick your own moments, including silent visual highlights. Score hook, payoff, speech continuity, action, and usefulness. Produce up to `maxClips` (1–10) finished, separate MP4s and a `highlights.json` manifest. Do not wait for, or reuse, the legacy clip-finding worker — opted-in projects skip it.

**`finish_clip`** (`mode: source_footage_enhancement`). Transovo already found and scored one moment. You receive that clip's source URL, local or absolute bounds, score, and editorial brief. Retain the voice and meaningful action, trim unnecessary pauses, frame speakers, add story-specific motion graphics, and produce **one** finished MP4, plus `project.json` with editable layers (required).

Both jobs are 9:16, 30 fps, `quality: "premium"`, `mediaPolicy: "user_footage_primary"`, `webResearch: false`. Target lengths are typically 30 or 60 seconds (`targetDurationsSeconds: [30, 60]` on discover jobs). Do not treat a pack-level duration as one runtime for the whole job.

---

## Intake

Webhook fields, on top of the usual envelope (`version: 1`, `jobId`, `projectId`, `jobUrl`, `callbackUrl`, live-mode `jobToken`):

- `action`: `clip_and_finish` | `finish_clip`
- `mode`: `autonomous_clipper` | `source_footage_enhancement`
- `title`, `direction`
- `source`: `{url, filename, mime?, startMs, endMs, durationMs}`
- `aspectRatio: "9:16"`, `fps: 30`, `quality: "premium"`
- `mediaPolicy: "user_footage_primary"`, `webResearch: false`
- For `clip_and_finish`: `maxClips`, `targetDurationsSeconds`
- For `finish_clip`: `clipId`, `score`, `durationSeconds`, `projectTitle`. If `source.url` is the original upload, `startMs`/`endMs` are absolute on that file. If it is a clip-local segment or preview, they start at zero.

If `action` is `clip_and_finish` or `finish_clip`, follow this playbook even if a field name differs slightly. If there is no `jobToken`, or `setupMode` is true, do not download the source, do not render, and do not call paid APIs. Write a short validation report in the routine chat (fields present, action, maxClips or clipId, aspect, token yes/no only) and stop.

**Live:** same secret handling as the main skill (`$J=/workspace/motion_jobs/$JOB_ID`, token only in `secrets/` mode 600, curl `--config`, never print tokens or signed URLs). Token lifetime is 36 hours; finish inside it. **Download the source immediately** — the signed URL expires in one hour, and this job API has no `/source`, `/transcript`, or `/moments` refetch. Pull `source.url` in a script; do not echo it. Save the file as `$J/assets/source/source.mp4`. Never modify that original file; copy or trim ranges into `$J/clips/<id>/`.

```bash
J=/workspace/motion_jobs/$JOB_ID
mkdir -p $J/{secrets,research,assets/source,clips,deliver,qa,log}
# token + curl.cfg the same way as SKILL.md section 3 "Intake" (never echo the token)
curl -sS --config $J/secrets/curl.cfg "$JOB_URL" -o $J/log/assignment.json
```

`GET {jobUrl}` returns status only (phase, progress, message). It does **not** re-issue a source URL and may even mis-label `mode` as `source_footage_enhancement` on a discover job. Trust the webhook payload you saved, not that GET, for action and source bounds.

Write `log/job.md` and keep appending layout, cut, engine and cost decisions.

There is **no** `/messages`, `/usage`, or `/parent-artifacts` on this callback API. Do not call them. If you need a transcript for scoring or captions, make one yourself from the downloaded source (do not send the file to production SSH or the clips-worker).

---

## Progress (customer-facing)

Use the clipper stages, not the film stages. Short, first-person-plural, Transovo / Transovo Agent only. Never name bots, models, engines, tools, paths, URLs, or prices. If a line would trip the sanitizer, use the default.

1. `selecting` — "We're preparing your highlights…"
2. `editing` — "We're shaping the best moments…"
3. `graphics` — "We're adding motion graphics…"
4. `review` — "We're reviewing the edit…"
5. `rendering` — "We're rendering your finished clip…"
6. `delivering` — "We're adding it to your clips…"
7. `complete` — set by `/complete`, not by a progress post past 99%

Post `{stage, percent?, message}` to `{jobUrl}/progress`. Percent is monotonic and stays ≤99 until `/complete`. Invalid stages are stored as `editing`. For a `finish_clip` job you may start at `editing` (moments were already chosen). For `clip_and_finish`, start at `selecting`.

---

## Batched clip flow (Rick, Nov 18; mandatory)

Quality bar is unchanged: batching removes repeated work and waiting, never craft.

1. **Transcribe and analyse the whole source once,** in parallel chunks, never per clip. Use fixed 30 s chunks without VAD (lesson from the first live clip job: whisper `small.en` hallucinates on crowd noise), run concurrently, then join them onto one source timeline. Every clip reads from that one transcript and analysis.
2. **Pick all moments in one pass,** scored (Stage B), each with clean in/out points on sentence boundaries (never mid-word or mid-sentence).
3. **Lock ONE clip design system for the source before building:** caption style, graphic components (lower-thirds, callouts, score or stat cards, transitions), framing approach (decided per moment: face-led for pure talk, content-led when a board, screen, product or demo matters; never crop a face badly), colour and type, all expressing the pack's creative idea. Save it as `design/system.md` plus shared component code in `design/components/`. Build each component once and check it by browser still once.
4. **Optionally split the clips across up to 4 helper subagents** (Task executors) when the pack is big enough that it truly saves time, building at the same time from that system. Each helper gets a self-contained brief: the design system path, its clips' cuts and transcript ranges, the full craft rules (key words and numbers readable, people and what they show well framed, real speech intact, captions as separate layers never burned in, no silent or lazier fallbacks), browser-still review, and no rendering. Each clip still gets story-specific graphics and custom touches; a clip that is only the shared components on footage fails.
5. **The lead reviews every clip by browser stills:** first, busiest and last frame, stills along every move, framing judged as a viewer (faces not badly cropped, what they show readable), caption readability, and the cut points (sentence boundaries, no clipped words). It fixes problems directly or sends them back to the owning helper, then re-checks the exposing stills.
6. **Targets (planning only, never a reason to cut quality):** 10 premium clips from a 1 h source in about 15–25 min total; basic clips (captions + framing) under 1 min each.
7. **`finish_clip`** (one clip) uses the same design-system-then-build approach, built by the lead alone.

---

## Stage A — Pack direction (phase `selecting` or start of `editing`)

Read the last 5–8 entries of `/workspace/motion_jobs/STYLE_LEDGER.md` and every earlier entry for this customer. Steer away from both.

Then, for the **pack** (one source video, N clips):

1. Skim the source (and, for `finish_clip`, the title, score, and brief). Name the show: interview, podcast, panel, monologue, walk-and-talk, gameplay-with-facecam, sports, and so on.
2. Sketch three visual concepts in `research/treatment.md`, two or three lines each, then pick one. Lock a pack `visualDna` the same way a film job does (type, colour, graphic style, caption treatment, transition grammar). All clips in the pack share that DNA; treatments may vary between clips so they do not look templated.
3. Mix engines as layers the way the main skill already allows. Choose by what the moment needs (a punch-in and captions on one clip, a split box and a score graphic on another). Leave Blender / Godot / Unreal out. Use the best engine for each layer, never one because it is already render-tested or familiar (Rick, Nov 18). There is no engine-count limit and no "use every engine" rule.

---

## Stage B — Moments and cuts (phase `selecting` then `editing`)

### `clip_and_finish`

Watch the whole source once, including picture-only stretches, using the single transcript and analysis from the batched flow (step 1). Pick all moments in one pass: complete, self-contained highlights — a hook, a payoff, and enough context to stand alone. Score each integer 0–100 on hook, payoff, speech continuity, action, and usefulness. Stay within `maxClips`. Prefer the `targetDurationsSeconds` (30 and 60) when the moment supports it. Finished `durationMs` must be between 1 second and 180 seconds.

You may tighten in/outs, cut dead air, and add a short bridge in a 30/60 s clip. Do not invent dialogue or unnecessarily reassemble the story. Reorder only if the result is still truthful and coherent. Keep original speech and picture central.

If you cannot find even one publishable moment, `POST /complete` with `{status:"failed"}` only. Do not start an open-ended research film.

### `finish_clip`

Stay inside the assigned `source.startMs`–`source.endMs`. You may tighten in/outs and cut dead air inside that window, and you may add a short bridge in a 30/60 s clip. You must not invent a new moment outside the assignment. If the window has nothing usable after cuts, keep the assigned in/outs, note it, and finish the footage you were given. Finished `durationMs` must be between 1 second and 10 minutes.

Work in `$J/clips/<clipId-or-index>/`. Write `cuts.json` with source-absolute times (map clip-local bounds back onto the original timeline when the payload started at zero).

---

## Stage C — Speaker layout (phase `editing`)

This is the edit the in-app clipper could not reliably automate. You decide the layout from the picture, then track it.

### Tools (already on this box — do not call production)

- MediaPipe: `/workspace/motion_engines/mediapipe/venv`. Tasks API.
- OpenCV: `/workspace/motion_engines/opencv/venv` (`opencv-contrib-python-headless`) for tracking and optical flow between detections.
- Models in `/workspace/motion_engines/mediapipe/models/`:
  - Face Landmarker: `face_landmarker.task` (official `.task` bundle)
  - Face Detector: `blaze_face_short_range.tflite` and `blaze_face_full_range.tflite` (Google publishes the detector as `.tflite`, not `.task`)
  - Selfie segmenters are already there for cutouts

Suggested use: Face Detector on a sampled grid (short-range for close talking heads, full-range when people sit farther back), Face Landmarker (`VIDEO` mode) on each face crop for `jawOpen` / lip activity, OpenCV (CSRT or optical flow) to hold the box between detections. Smooth with a minimum shot length of about 1.0–1.5 s, hysteresis before switching the active speaker, and eased crop keys so the punch-in does not jitter.

If you transcribe the source, speaker labels are a **hint**, not ground truth for how many faces are on screen. If transcript and vision disagree, **vision wins for how many boxes you need**; lip activity plus speaker labels win for who is active.

### Decision rules (Rick's framing rule)

Count **visible, addressable faces** in the moment (people the viewer should be able to watch), not everyone in a distant background.

**One speaker (or one face the moment is about).**

- When the moment is pure talk, punch in and face-track (full-frame or a tight punch-in is allowed). When they draw, demo, show a screen or product, frame for that content instead, and switch back to the face when it's just talk again (SKILL.md section 1). Face tracking is a tool, not a requirement.
- Keep eyes and mouth in the upper-center of the frame. Keep captions and text inside the 9:16 safe box: text, logos and captions inside x 120–888, y 288–1248, and left of x 780 below y 780 at 1080x1920 (x 53–395, y 128–555 at 480x854); see `craft-standards.md`; the bottom caption line sits no lower than y 1248.
- Track the talking head as they move. Do not snap every frame; ease the crop.
- If the face is lost for a beat, hold the last good crop briefly, then ease out to a wider fit rather than freezing on empty space.

**Two speakers.**

- Never flatten both people into one full-frame punch-in that loses someone. Use a split or a stacked pair of boxes.
- 9:16: prefer top/bottom stacks, or a larger active speaker over a smaller listener, when that reads better than a squeezed side-by-side.
- The box treatment (rounded, hard, inset, typographic frame, cutout) comes from the pack DNA — do not reuse one default rectangle across packs.
- You may slightly favor the active speaker (tighter crop, larger tile, light emphasis) but both people stay visible while they are in the conversation.
- If they sit already as a clean two-shot and a split would feel worse, you may keep a framed two-shot (still a framed treatment, not a bare full-frame with captions slapped on).

**Three or more.**

- Pick the arrangement that fits the seating and the talk: two on top and one below, a 2×2, a hero plus a row of listeners, and so on.
- Promote the active speaker; do not shuffle the grid every sentence. Minimum layout or hero change ~1.0–1.5 s.
- If a fourth or fifth person is barely in frame and never speaks, it is fine to leave them out of the grid. Log that choice.

**No face, weak face, or gameplay / slides with a small facecam.**

- Do not invent a punch-in. Fit the useful region (the slide, the board, the gameplay, the play) and, if a facecam exists, place it as its own tile.
- OpenCV motion follow is allowed when a subject is clear but not a face (hands on a bench, a product, a ball carrier).
- MediaPipe selfie segmentation / rembg / SAM 2 may be used for a cutout tile when the DNA wants a person lifted off a messy background. That is a treatment, not a requirement.

Write the layout decision per clip in `clips/<id>/layout.md`: speaker count, arrangement, active-speaker rule, crop path used.

---

## Stage D — Motion graphics and captions (phase `graphics`)

Graphics go **over** the edited footage. They should feel specific to what is said and who is on screen, not like a skin applied to every short.

### What to add (only when it earns its place)

- A hook title in the first 1–3 s when the opening line is a complete claim.
- Speaker lower-thirds when a name is known or clearly said. Do not guess a name.
- A pull-quote or big-word hit on a line that is actually the point of the clip.
- A number, date, or list on screen when it is spoken.
- A story-specific graphic only when the line calls for it (a map when they talk about a place, a score or ticker when they talk about a game or a price). If the line does not call for it, skip it.

An empty graphic list is the correct choice when the cut and the layout already carry the clip.

### Rules

- Safe area depends on the layout. In a stack, do not put a title through someone's face in the top tile or through captions in the bottom tile. In a punch-in, stay clear of eyes, mouth, and the caption band.
- Captions are word-timed from your transcript of the kept ranges. They are always delivered as their own layer in `project.json`, never burned into the footage or the clean plate (Rick, Nov 18); the finished MP4 shows them as composited on top. This job API **does not accept `.srt` uploads** (mime not in the allow-list), so do not try to commit a caption file as its own artifact.
- Caption style may vary between clips in the pack (weight, emphasis, placement) inside the same type family. Do not ship five clips with one identical caption skin.
- Mix engines as layers (GSAP, Motion Canvas, Remotion, HyperFrames, Pixi, p5, Lottie, and so on). Pick what serves the graphic. Record `engine` and `layers[]` on every element, same as a film job.
- No licensing notes, no font disclaimers, no engine names in customer messages.

---

## Stage E — Render, QA, fix (phases `review`, `rendering`)

**Render at export (live delivery):** see SKILL.md "Render at export". If this clip job's payload or `GET {jobUrl}` carries `delivery.mode:"live"`, render no clip MP4s: the final watch is live browser playback of each whole clip, and delivery follows the live path in `delivery.md` "Live delivery" (publish-live.mjs, `delivery:"live"`). The clipper contract has not been seen sending `delivery.mode` yet, so until a clip job carries it, keep the current steps below: render each approved clip once and upload the MP4s.

Before rendering, review every clip in the browser on still screenshots (480p by default, full size only for a frame that can't be judged at 480p; first, busiest and last frame plus wherever something changes; SKILL.md section 7) and fix it there. Browser engines are always reviewed with browser stills. Skia/CanvasKit is built inside the browser scene. Only Cinematic Skill, Manim, Natron and any existing Node Skia script run outside the browser; their layers are checked with the exact still recipes in `film-pipeline.md`, and before approval nothing beyond the exact frame or few seconds being checked is rendered (Rick, Nov 18). Only once every clip is approved, render each clip once to 9:16 (or the requested aspect), 30 fps CFR, h264, even dimensions, `+faststart`. Sanitize every filename to `[A-Za-z0-9._-]`. Also export, as separate files for the timeline when you will upload them:

- silent or clean footage tiles / layout plates (`kind: "media"`)
- title and graphic overlays as separate layers with alpha (`kind: "media"`; baking is a last resort only after real alpha attempts, logged with what was tried; `image/png` or a video with alpha if the mime is allowed — today only `video/mp4` and `video/webm`)
- source-dialogue stem and any music/SFX stems (`kind: "audio"`)
- for `finish_clip` only: `project.json` (`kind: "project"`, schema `transovo.motion-project/1`)

Look at the browser stills before approval (`qa.md` §2), then watch each final clip once before you claim it is done. Fix the scene code, not a post-process cover-up. No draft or smoke renders.

### Clip QA checklist

- The cut is a complete thought; hook and payoff are both there.
- Original speech is intact and in sync; no invented dialogue.
- Layout follows the framing rule (punch-in only on one focused speaker; split/stacked/grid boxes for two or more).
- Graphics do not cover faces, mouths, or the caption band.
- Faces are never badly cropped (chin or forehead cut, eyes in the wrong place, jammed against a border); judged by eye. Framing serves what the viewer needs to see (SKILL.md section 1).
- Key words and numbers stay readable; no object fully hides key text (Rick).
- Motion is stable (no jittery crops, no 2-frame layout flips).
- Audio is intelligible; music and SFX sit under speech.
- Master around the `qa.md` loudness window.
- Filenames will survive sanitization and match the manifest.

If a clip fails the final watch, fix it in the browser, re-check its stills, and render only that clip again. No round cap; never ship a known-broken clip.

---

## Stage F — Upload and complete (phase `delivering`)

For each artifact: `POST {jobUrl}/assets` with `{action:"prepare", kind, filename, mime, bytes}`, upload to the returned `signedPut` / `tus` / `s3Multipart` destination (never through Next.js, never log the URL), then `{action:"commit", uploadId, parts?}`. Supply multipart ETags when the prepare step used `s3Multipart`. Wait for `ready`. Only committed files may appear in completion records. Max 100 artifacts, 2 GB each.

### `clip_and_finish`

1. Commit each finished MP4, `kind: "video"`, `mime: "video/mp4"` (for example `highlight_1.mp4`).
2. Commit a file **named exactly `highlights.json`**, `kind: "project"`, `mime: "application/json"`, ≤2 MB:

```json
{
  "clips": [
    {
      "filename": "highlight_1.mp4",
      "title": "A complete highlight",
      "startMs": 142000,
      "endMs": 195000,
      "durationMs": 42000,
      "score": 93,
      "why": "Strong hook, context and payoff"
    }
  ]
}
```

`startMs`/`endMs` are absolute in the original uploaded source. `durationMs` is the produced MP4 length, even if pauses were cut. `score` is an integer 0–100. `filename` must equal a committed MP4 filename. Provide 1–10 records.

3. `POST {jobUrl}/complete` with `{ "status": "complete" }`. Do not rely on a `clips` array in this body — the server reads `highlights.json`. This path does **not** import `project.json`; do not claim editable timeline parity for discover jobs.

### `finish_clip`

1. Commit one MP4, `kind: "video"`, `mime: "video/mp4"`.
2. Also commit **`project.json`** (required) (`kind: "project"`, `mime: "application/json"`, filename exactly `project.json`) and any media/audio assets it references by filename. Use the existing `transovo.motion-project/1` tracks/elements contract. The app tries to import layers without overwriting the original source audio. If the manifest fails, only the finished MP4 is delivered — do not claim full timeline parity.
3. `POST {jobUrl}/complete` with `{ "status": "complete", "durationMs": <finished video length> }`. `durationMs` is required and must be a safe integer from 1_000 to 600_000.

On failure for either action: `{ "status": "failed" }` only. The server supplies the customer wording.

After delivery, append one **pack** entry to `STYLE_LEDGER.md` (date, jobId, customer or `projectId`, title, concept, `visualDna`, and a short note of per-clip layouts and engine mixes).

---

## Revisions

Clipper v1 has **no** `revise_clip` action and no `/parent-artifacts`. If a later contract adds one, follow that contract and reuse this playbook's layout, graphics, and QA rules. Until then, a new `finish_clip` job on the same clip is a fresh finish, not a linked revision.

If you receive `{ action: "cancel", jobId }`, stop paid work and do not `/complete` a partial pack unless a clip has already been committed and the server asks otherwise. The server status is authoritative.

---

## Progress and folder map (quick)

```
$J/
  secrets/                 # token, curl.cfg — never commit or print
  research/                # treatment.md, optional local transcript
  assets/source/source.mp4
  clips/<id>/              # cuts.json, layout.md, plates, overlays, qa/
  deliver/                 # files about to be prepared
  qa/                      # pack-level notes
  log/job.md
  log/assignment.json
```

Report progress as you move. When every clip has passed QA and is committed, complete the job.
