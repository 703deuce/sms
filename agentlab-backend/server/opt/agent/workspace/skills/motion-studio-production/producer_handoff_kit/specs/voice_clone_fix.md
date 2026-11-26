# Fix: voice cloning fails silently (live on transovo.ai, merge 4a22a864)

## What happened (Rick, Nov 20, 2026, ~5:43 PM ET)
Rick recorded 36 s in Customize > Narrator library > Create a voice > Record microphone and clicked Create voice twice.
The button showed "Creating your voice…" for ~5 s, then went back. No voice appeared and he saw no clear error.

## Evidence from the server
- Two rows in `clip_uploads` were created (`upl_727f7b24fd09409e9a03119d1196676a` at 22:43:17Z, `upl_896fde85e38e40e69633c07176b430b3` at 22:43:36Z):
  - filename `my-voice.webm`, mime `audio/webm; codecs=opus`, kind `media`, uploadMode `s3_multipart`
  - **bytes 8683** (far too small for 36 s of Opus speech, expect ~100–300 KB)
  - **status PENDING** (never completed)
  - **durationMs NULL**
- App logs show only `[clipper:upload] ... message: 'start'` for both; no completion, no voices POST error log.
- `createClone` in `lib/server/motion-studio/voices.ts` requires the upload to be `status:'COMPLETE'` AND have a finite `durationMs` between 10 s and 5 min, so it can never pass with these rows.

## Likely causes (verify each)
1. **Recording blob is truncated.** `CloneVoiceDialog.record()` builds the File in `media.onstop`, but `stop()` also stops the tracks immediately and the Create button can be clicked before `onstop` fires / final `dataavailable` arrives. Confirm the blob actually contains all chunks (`media.start(1000)` timeslice). Build the File only after `onstop` resolves; disable Create until then; log blob size.
2. **Upload never completes.** `client.uploadFile` → `uploadClipFile(file, …, {kind:'media'})` (clips upload path). The multipart upload stays PENDING. Find why `/api/clips/uploads/[id]/complete` is not reached or fails for small audio/webm (part size, mime allowlist, or an exception swallowed). `uploadFile` must not resolve until status is COMPLETE; surface failures.
3. **No duration for MediaRecorder WebM.** Browser-recorded WebM has no duration header, and the clips path doesn't probe audio. Fix: on upload complete (or inside `createClone`), probe the stored file server-side with ffprobe (decode to get real duration if header is missing), and save `durationMs`. As a fallback, accept a client-reported `durationMs` from the recording timer only when within ±20% of the probed decode duration. Never fail just because the header lacks duration.
4. **Errors aren't visible.** Show any error from upload or clone inline inside the dialog (red text under the buttons), keep the dialog open, and keep the recording so the user can retry without re-recording.

## Acceptance
- Record 30–40 s in Chrome (desktop and Android) and Safari (iOS, `audio/mp4`) → Create voice → voice appears under My voices, selected, within ~60 s.
- Upload an MP3/WAV/M4A sample → same result.
- `clip_uploads` row is COMPLETE with a real `durationMs`; a `MotionStudio` voice row is created with an ElevenLabs voice_id.
- Too-short (<10 s) recordings show a clear inline error.
- Add a test for the dialog: Create disabled until the recorded file is ready; errors render inline.
- Do not touch render/QA. No rights/licensing copy.
