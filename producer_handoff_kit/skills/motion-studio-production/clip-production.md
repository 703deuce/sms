> Read `craft-standards.md` (podcast / interview / panel clips section) and the `craft/` playbook before every clip job and apply them with judgment (SKILL.md section 1). Decide the pack's creative idea from what you're editing before building (SKILL.md section 1, Rick, Nov 19). Rick (Nov 16, 2026): no ornamental masks or small windows around moving faces; people big and clearly visible; steady, smoothed crops (stationary unless the person really moves); a polished pro podcast-clip look, not a heavy themed frame; files about 15–20 MB per clip with little or no grain.

# Clip production (Motion Studio Producer)

This is the playbook for Transovo clip jobs (`clip_and_finish` and `finish_clip`). It extends the Motion Studio production skill. The non-negotiables, secrets rules, Visual DNA rules, `qa.md`, `engines.md`, `engine-library.md` and `delivery-contract.md` still apply unless this file says otherwise. One unified director handles both clip actions and Motion Studio film jobs; only the intake, stages, and delivery shape change.

A clipping job is a **finish of customer footage**, not a research-to-film production. The customer already supplied the video. You cut, lay out, and dress highlights, then deliver finished MP4s plus an editable edit document per clip. Do not invent a new story, write narration, or search the web for photos and clips unless the customer instruction explicitly asks for B-roll or a graphic that needs a real reference. The source video is the picture. If narration is used at all, use `eleven_flash_v2_5`. No licensing, rights, or font caveats. Heavy engines stay out (Blender, Godot, Unreal). No install pauses mid-job. No 2-second smoke or draft renders, and no rendering until every clip is approved on browser stills (Rick, Nov 18). Build the real clip, review it with still screenshots, render it once, and fix or swap an engine that breaks for one at least as good.

**Live contract (Nov 22, 2026): the Deepgram-first producer clipper** — `docs/contracts/transovo-agent-clipper-v1.md`, sections "v2: Deepgram-first producer clipper" and "Fix 1 — producer handoff and recovery rules" (master `ba2e9e34f`). Production runs with `CLIPS_PRODUCER_PIPELINE=1`: every clipper video upload is transcribed by Transovo with Deepgram, then the coordinator dispatches the job to a registered producer worker (capability `clips-produce` or `motion-studio-produce`). Each clip is published on its own as soon as it is ready. The older v1 flow (source URL in the webhook, `highlights.json`) is only the flag-off fallback; see "Legacy v1 jobs" at the end.

---

## How the two actions differ

**`clip_and_finish`** (`kind: "clips"`, discovery). Transovo has already transcribed the full source with Deepgram (diarized, punctuated, with utterances, paragraphs and word timings). Use that transcript plus your own watch of the picture to pick the strongest moments, including silent visual highlights. Score hook, payoff, speech continuity, action, and usefulness. Produce `clipCount` finished clips (from `/inputs`; default 5, maximum 15), each 20–60 s (`targetSeconds`), and publish each one through `POST {jobUrl}/clips` as soon as it passes QA.

**`finish_clip`** (`kind: "clip_revision"`, one clip). The customer asked for a new finish of one existing clip. `/inputs` returns `revision: {clipId, note, sourceStartMs, sourceEndMs, title}`. Re-finish that exact source range following the note, and deliver one finished MP4, a 480p preview, a thumbnail and an edits document through `/complete`. The source range cannot change on a revision.

Both use the requested `aspectRatio` (9:16 default) and `resolution` from `/inputs` (1080x1920 for 9:16), 30 fps, premium quality, customer footage primary, no web research.

---

## Intake

The coordinator webhook (authenticated with the coordinator webhook key) carries only routing fields, never a source URL:

```
{action: "clip_and_finish" | "finish_clip", kind: "clips" | "clip_revision",
 jobId, jobUrl, jobToken, projectId, clipId, workspaceId, workerId, leaseId,
 coordinator: true, delivery: {mode: "mp4"}}
```

`clipId` is `project:<projectId>` on a discovery job. Acknowledge with HTTP 2xx immediately and work asynchronously. If there is no `jobToken`, or `setupMode` is true, do not fetch inputs, do not render, and do not call paid APIs. Write a short validation report in the routine chat (fields present, action, kind, token yes/no only) and stop.

**Live:** same secret handling as the main skill (`$J=/workspace/motion_jobs/$JOB_ID`, token only in `secrets/` mode 600, curl `--config`, never print tokens or signed URLs). Every callback uses `Authorization: Bearer {jobToken}`.

1. **Fetch inputs first:** `GET {jobUrl}/inputs`. It returns:
   - `action`, `delivery: {mode: "mp4", editable: "transovo.clip-edits/2"}`
   - `source: {url, filename, mime, durationMs}` — signed, **15-minute** URL to the original upload
   - `transcript: {deepgramUrl, compactTranscriptUrl, wordsUrl}` — signed 15-minute URLs to `deepgram.json`, `transcript.compact.jsonl` and `words.json`
   - `clipCount` (1–15, default 5), `targetSeconds: {min: 20, max: 60}`, `aspectRatio`, `resolution`
   - `captionStyle`, `brand`, `notes` (customer instructions)
   - on `finish_clip` only: `revision: {clipId, note, sourceStartMs, sourceEndMs, title}`
2. Save the response as `$J/log/inputs.json` with the URLs stripped (keep only the non-URL fields). Download the source and the three transcript files **in a script right away**, without echoing any URL. Save as `$J/assets/source/source.mp4`, `$J/research/deepgram.json`, `$J/research/transcript.compact.jsonl`, `$J/research/words.json`. If a URL has expired, call `/inputs` again for fresh ones. No provider API key is ever in job input, and none is needed.
3. Never modify the original source file; copy or trim ranges into `$J/clips/<id>/`.

```bash
J=/workspace/motion_jobs/$JOB_ID
mkdir -p $J/{secrets,research,assets/source,clips,deliver,qa,log}
# token + curl.cfg the same way as SKILL.md section 3 "Intake" (never echo the token)
curl -sS --config $J/secrets/curl.cfg "$JOB_URL/inputs" -o $J/secrets/inputs.json   # contains signed URLs: keep in secrets/, never print
```

**Do not transcribe the source yourself.** The Deepgram transcript is the transcript for scoring, cut points, speaker labels and captions. Only if a transcript file is truly missing or unreadable after a fresh `/inputs` call may you fall back to a local transcript, and log that in `log/job.md`.

`GET {jobUrl}` returns status only. Trust `/inputs` and the saved webhook for action and source bounds.

Write `log/job.md` and keep appending layout, cut, engine, timing and cost decisions (they feed `job.json`).

There is **no** `/messages`, `/usage`, or `/parent-artifacts` on this callback API. Endpoints: `GET {jobUrl}`, `GET {jobUrl}/inputs`, `POST {jobUrl}/progress`, `POST {jobUrl}/assets`, `POST {jobUrl}/clips`, `POST {jobUrl}/complete`, `POST {jobUrl}/fail`. Never send the source to production SSH or the clips-worker.

### Lease and deadline (hard rules)

- The job lease is **15 minutes**. Make an authenticated `/progress`, `/inputs` or `/assets` call **at least every 60 seconds** for the whole job, including during long renders (run a small background heartbeat that posts `/progress` with the current stage). Successful calls renew the lease.
- The whole job has a **45-minute deadline** from dispatch. Plan the pack to fit it: publish clips one at a time as they pass QA so finished work reaches the customer even if time runs short.
- After you accept the job there is **no automatic retry**. A lost lease or a missed deadline fails the job and an operator must retry it by hand. Do not let the heartbeat lapse.

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

Post `{stage, percent?, message}` to `{jobUrl}/progress`. Percent is monotonic and stays ≤99 until `/complete`. Invalid stages are stored as `editing`. For a `finish_clip` job you may start at `editing` (moments were already chosen). For `clip_and_finish`, start at `selecting`. Keep posting at least every 60 s (the lease heartbeat), with the current stage and an honest percent.

---

## Batched clip flow (Rick, Nov 18; mandatory)

Quality bar is unchanged: batching removes repeated work and waiting, never craft.

1. **Analyse the whole source once,** never per clip. The transcript is Transovo's Deepgram transcript from `/inputs` (do not re-transcribe); add one pass of picture analysis (faces, speakers on screen, scene changes) on the same source timeline. Every clip reads from that one transcript and analysis.
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

Read the Deepgram transcript (`transcript.compact.jsonl` for a fast pass, `words.json` for exact word times, `deepgram.json` for speakers and paragraphs) and watch the picture, including picture-only stretches. Pick all moments in one pass: complete, self-contained highlights with a hook, a payoff, and enough context to stand alone. Cut on sentence boundaries using the word timings (never mid-word or mid-sentence). Make `clipCount` clips, or fewer only if the source truly lacks publishable moments. Each finished clip is 20–60 s (`targetSeconds`); the API accepts `durationMs` from 1 s to 10 min, but stay in the target window.

Score each clip with an integer **`virality` from 1 to 10** (hook, payoff, speech continuity, action, usefulness). Transovo shows it as `score = virality × 10`. Use the whole range honestly; do not give every clip a 9.

You may tighten in/outs, cut dead air, and add a short bridge. Do not invent dialogue or unnecessarily reassemble the story. Reorder only if the result is still truthful and coherent. Keep original speech and picture central.

If you cannot find even one publishable moment, `POST {jobUrl}/fail` with a short operational `{reason}`. Do not start an open-ended research film.

### `finish_clip` (revision)

Stay inside `revision.sourceStartMs`–`revision.sourceEndMs` (absolute source ms). Follow `revision.note`. You may cut dead air inside that window, but the edits document's `trim.in`/`trim.out` must equal those exact bounds; the source range cannot change on a revision. Finished `durationMs` must be between 1 second and 10 minutes.

Work in `$J/clips/<clipId-or-index>/`. Write `cuts.json` with source-absolute times.

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

Deepgram speaker labels are a **hint**, not ground truth for how many faces are on screen. If transcript and vision disagree, **vision wins for how many boxes you need**; lip activity plus speaker labels win for who is active.

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
- Captions are word-timed from the Deepgram words of the kept ranges. They are **never burned into the footage or the clean plate** (Rick, Nov 18). In the edits document, set the `captions` block (style, preset, animation, position, words per line); Transovo builds the word timing from the saved Deepgram clip words, and `wordFixes` may correct individual words. The finished MP4 shows captions composited on top. You may also commit a `.srt` (`application/x-subrip`) for the clip.
- Caption style may vary between clips in the pack (weight, emphasis, placement) inside the same type family. Do not ship five clips with one identical caption skin.
- Mix engines as layers (GSAP, Motion Canvas, Remotion, HyperFrames, Pixi, p5, Lottie, and so on). Pick what serves the graphic. Log `engine` and `layers[]` per element in `clips/<id>/layout.md`.
- No licensing notes, no font disclaimers, no engine names in customer messages.

---

## Stage E — Render, QA, fix (phases `review`, `rendering`)

**Render first (Rick, Nov 19):** every approved clip is rendered once and gets its final check on that render (steps below), live delivery or not. If a clip job ever carries `delivery.mode:"live"`, the editable package follows `delivery.md` "Live delivery" (render first, editable in the background); `bg_delivery/launch.sh` handles one master per job, so report a multi-clip live job to Rick before delivering it. Clip jobs from the coordinator send `delivery.mode:"mp4"`: render each approved clip once and upload the MP4s.

Before rendering, review every clip in the browser on still screenshots (480p by default, full size only for a frame that can't be judged at 480p; first, busiest and last frame plus wherever something changes; SKILL.md section 7) and fix it there. Browser engines are always reviewed with browser stills. Skia/CanvasKit is built inside the browser scene. Only Cinematic Skill, Manim, Natron and any existing Node Skia script run outside the browser; their layers are checked with the exact still recipes in `film-pipeline.md`, and before approval nothing beyond the exact frame or few seconds being checked is rendered (Rick, Nov 18). Only once every clip is approved, render each clip once at the `/inputs` `resolution` and aspect (1080x1920 for 9:16), plus its 480p preview,, 30 fps CFR, h264, even dimensions, `+faststart`. Sanitize every filename to `[A-Za-z0-9._-]`. Export, as separate files:

- the finished full-resolution MP4 (`clip_01.mp4`) and a 480p MP4 preview (`clip_01.preview.mp4`), both h264, `+faststart`
- a thumbnail PNG (`clip_01.thumbnail.png`)
- custom graphics and titles as separate transparent overlays: **prefer transparent PNG stills** (`image/png`); alpha WebM (`video/webm`) is allowed but its export parity is unverified. Baking a graphic into the footage is a last resort only after real alpha attempts, logged with what was tried. Never bake captions into artwork that should stay editable as native text.
- the per-clip `clip_01.json` and `clip_01.edits.json` (Stage F)

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
- Filenames will survive sanitization and match `clip_NN.json` / the `/clips` call.
- `clip_NN.edits.json` trim equals the clip's source range, every `artifactFilename` is committed, and times use the right clock (source ms vs output ms).

If a clip fails the final watch, fix it in the browser, re-check its stills, and render only that clip again. No round cap; never ship a known-broken clip.

---

## Stage F — Upload, publish per clip, complete (phase `delivering`)

### Upload protocol

For each artifact: `POST {jobUrl}/assets` with `{action:"prepare", kind, filename, mime, bytes, sha256}`, upload to the returned `signedPut` / `tus` / `s3Multipart` destination (never through Next.js, never log the URL), then `{action:"commit", uploadId, parts?}`. Supply multipart ETags when the prepare step used `s3Multipart`. Wait for `ready`. Only committed files may be referenced. Sanitize filenames to `[A-Za-z0-9._-]`. Always send `sha256` (lowercase hex); it is **required** for `kind:"image"` (images ≤25 MB). JSON documents are ≤2 MB.

### `clip_and_finish`: publish each clip as soon as it passes QA

For clip `NN` (`01`, `02`, …), commit:

| File | kind | mime |
|---|---|---|
| `clip_NN.mp4` — full-resolution finished clip | `video` | `video/mp4` |
| `clip_NN.preview.mp4` — 480p finished clip | `video` | `video/mp4` |
| `clip_NN.thumbnail.png` | `image` (sha256 required) | `image/png` |
| `clip_NN.json` — clip metadata | `project` | `application/json` |
| `clip_NN.edits.json` — native editable edit | `project` | `application/json` |
| optional `clip_NN.srt` | `caption` | `application/x-subrip` |
| optional overlays referenced by the edits (`clip_NN_title.png`, …) | `image` or `media` | `image/png` / `video/webm` |

`clip_NN.json`:

```json
{"title": "…", "hook": "…", "why": "…", "sourceStartMs": 142000, "sourceEndMs": 195000,
 "durationMs": 42000, "speakers": ["Speaker 1", "Speaker 2"], "virality": 8}
```

`sourceStartMs`/`sourceEndMs` are absolute ms in the original upload (end > start, inside the source). `durationMs` is the finished MP4 length (integer, 1 000–600 000). `virality` is an integer 1–10.

Then publish the card:

```
POST {jobUrl}/clips
{"clipJson":"clip_NN.json","editsJson":"clip_NN.edits.json","video":"clip_NN.mp4",
 "preview":"clip_NN.preview.mp4","thumbnail":"clip_NN.thumbnail.png"}
```

The clip appears in the customer's project immediately (card plays the 480p preview, download gives the full MP4, Edit opens the native edits). Publishing is idempotent per job + `clipJson` filename, so a retry of the same call is safe. A broken or missing edits document does not block the MP4, but the customer then loses editability, so validate it before publishing.

### `clip_NN.edits.json` (native editable timeline)

```json
{
  "schema": "transovo.clip-edits/2",
  "edits": {
    "v": 2,
    "trim": {"in": 142000, "out": 195000},
    "cutRanges": [[160000, 162000]],
    "aspectRatio": "9:16",
    "layout": {"mode": "speaker_follow", "shotOverrides": []},
    "captions": {"enabled": true, "presetId": "bold_pop", "animation": "pop", "position": "bottom", "wordsPerLine": 2},
    "textItems": [],
    "keyframes": [],
    "broll": [
      {"id": "title1", "source": "upload", "artifactFilename": "clip_01_title.png", "startMs": 0, "endMs": 2500, "still": true}
    ]
  }
}
```

Rules:

- `trim.in`/`trim.out` **must equal** `sourceStartMs`/`sourceEndMs` in `clip_NN.json`. `trim`, `cutRanges` and `sectionOrder` are **absolute source milliseconds**.
- `textItems`, `keyframes`, `captionLines` and `broll` times are **output milliseconds** (0 = first frame of the finished clip).
- `layout` may carry `mode`, `cropBox`, `layoutSegments`, template boxes and `shotOverrides` — describe the speaker layout you actually built (Stage C).
- Headlines, names, shapes and callouts go in `hookOverlay` / `textItems` so they stay editable text; punch-ins in `zoom` / `keyframes`; cuts in `transitions`; optional `audio`, `color`, `tracks`, `layerProps`.
- Custom graphics are `broll` items with `source:"upload"` and `artifactFilename` naming an overlay you **committed before publishing**; a missing overlay makes the edits import fail. Prefer transparent PNG stills.
- Captions are never burned in; the `captions` block carries style and Transovo supplies the word timings from Deepgram.
- Use only this schema; do not claim perfect round-trip fidelity for advanced motion or alpha properties.

### Finish the job

When every clip is published (or the deadline is near and at least one is published):

1. Commit `job.json` (`kind:"project"`, `application/json`) with timing and cost: start/end times per stage, clips published, render minutes, and every paid call (provider, units, USD estimate). No secrets, URLs or tokens.
2. `POST {jobUrl}/complete` with `{"status":"complete","jobJson":"job.json"}`. The server rejects it until `job.json` is committed and at least one clip has been published.

On a terminal failure, `POST {jobUrl}/fail` with `{"reason":"<short operational reason>"}`. The server redacts URLs, tokens and paths and shows the customer friendly wording; still never put secrets in the reason.

After delivery, append one **pack** entry to `STYLE_LEDGER.md` (date, jobId, customer or `projectId`, title, concept, `visualDna`, and a short note of per-clip layouts and engine mixes).

---

## Revisions (`finish_clip`, `kind:"clip_revision"`)

1. `GET {jobUrl}/inputs`; read `revision.note`, `revision.sourceStartMs`, `revision.sourceEndMs`, `revision.title`.
2. Re-finish that exact range with the same craft stages (C–E). Start progress at `editing`.
3. Commit the full MP4 (`kind:video`), the 480p preview (`kind:video`), a thumbnail (`kind:image`, sha256), and an edits document (`kind:project`) whose `trim.in`/`trim.out` equal the revision bounds exactly, plus any overlays it references.
4. `POST {jobUrl}/complete` with `{"status":"complete","video":"clip.mp4","preview":"clip.preview.mp4","thumbnail":"clip.thumbnail.png","editsJson":"clip.edits.json","durationMs":<finished length>}`. `/clips` is discovery-only and returns 409 on a revision.
5. Failure: `POST {jobUrl}/fail` with `{reason}`.

If you receive `{action: "cancel", jobId}`, stop paid work. The server status is authoritative.

---

## Legacy v1 jobs (flag off only)

If a webhook arrives with `source.url` in the payload and no `kind` (the old `GROKBOT_WEBHOOK_URL` path), it is a v1 job: download `source.url` immediately (1-hour URL), and for `clip_and_finish` commit the MP4s plus `highlights.json` (`{clips:[{filename,title,startMs,endMs,durationMs,score 0–100,why}]}`) then `POST /complete {status:"complete"}`; for `finish_clip` commit one MP4 plus `project.json` (`transovo.motion-project/1`) and `POST /complete {status:"complete",durationMs}`. Production runs the v2 flow above; treat a v1 job as unusual and note it in `log/job.md`.

---

## Progress and folder map (quick)

```
$J/
  secrets/                 # token, curl.cfg, inputs.json (signed URLs) — never commit or print
  research/                # deepgram.json, transcript.compact.jsonl, words.json, treatment.md
  assets/source/source.mp4
  clips/<id>/              # cuts.json, layout.md, plates, overlays, qa/
  deliver/                 # clip_NN.* files about to be prepared, job.json
  qa/                      # pack-level notes
  log/job.md
  log/inputs.json          # /inputs without URLs
```

Heartbeat at least every 60 s. Publish each clip when it passes QA. When every clip is published, commit `job.json` and complete the job.
