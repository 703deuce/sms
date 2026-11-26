# Voice clone fix, round 2 (after cd982570)

cd982570 is deployed live on transovo.ai (Coolify deploy batfncdpvcnbdmoneqhrffjj finished). The `creator` CI check passes. Two blockers remain before voice cloning can work:

## 1. FFmpeg is NOT in the live container
Coolify app ds8s3hjin60qs6g7s0iqkixs builds with **Nixpacks from /nixpacks.toml at the repo root**, not `new-app/Dockerfile`. The Dockerfile change in a39eac2c has no effect.
Verified on the live container: `ffprobe: not found`.
So `probeVoiceDurationMs` always throws, and every clone returns "Cannot verify the audio recording duration."

Fix: in `/nixpacks.toml`, change `[phases.setup] nixPkgs = ["nodejs_22"]` to `nixPkgs = ["nodejs_22", "ffmpeg"]` (or `ffmpeg-headless`).
Keep `aptPkgs = []` (apt was intentionally removed for build speed).
You can leave the Dockerfile line in place.
Make sure `ffprobe`/`ffmpeg` resolve on PATH at runtime in the Nixpacks image. If not, set an env such as `FFPROBE_PATH`/`FFMPEG_PATH` and use it in voices.ts.

## 2. Decode-fallback regex is broken
In `new-app/lib/server/motion-studio/voices.ts`:
`/^out_time_us=(\\d+)$/gm` is a regex literal, so `\\d` matches a literal backslash plus "d" and never matches.
Change it to `/^out_time_us=(\d+)$/gm`.
That fallback is exactly the path MediaRecorder WebM files need when the header has no duration.
Add a unit test that feeds a sample ffmpeg `-progress` output string and checks the parsed ms.

## 3. Smaller items
- Log (no secrets) at each createClone stage: sample bytes, probed ms, which probe path was used, and the ElevenLabs HTTP status. That way the next failure is visible in `docker logs`.
- The upload rows from the failed attempts (upl_727f7b24…, upl_896fde85…) are stuck PENDING at 8,683 bytes. That's harmless, but confirm a fresh recording of 30–40 s produces a much larger blob (expect 100 KB+). If it's still ~8 KB, the recorder is still only capturing the first chunk.

## CI note
On cd982570 these checks fail: new-app-tsc, worker-ofl-export-fonts, visual-audio-worker-regression, clips-worker-pytest, captions-worker-regression, new-app-guards, font-and-typography-tests, editor-regression, voice-agent-runtime, editor-shell-import-guard.
new-app-tsc and worker-ofl-export-fonts were already failing on 4a22a864.
Please check whether any of the others were caused by this change set (especially new-app-guards and new-app-tsc in voices.ts/upload.ts) and fix any that were.

## Acceptance
- On the live container, `ffprobe -version` and `ffmpeg -version` work.
- Record 30–40 s in Chrome and click Create voice. The voice appears under My voices; the clip_uploads row is COMPLETE with a real durationMs; a cloned voice row exists.
- Do not touch render/QA.
