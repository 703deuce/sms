# Voice clone, round 3: iPhone recordings sometimes contain only ~0.5 s of audio

Live on 6e7d1003 (5c26a5cc deploying). Rick on iPhone Safari, Nov 20, 2026, 8:53 PM ET.

## Evidence (server logs)
- Good attempt: upl_2796ad32…, 1,202,817 bytes, decoded 42,088 ms → reached ElevenLabs (rejected for account plan, separate issue).
- Bad attempt: upl_fb3e5f9d…, **8,002 bytes**, client reported 42,000 ms, ffmpeg decoded **526 ms** → "Voice sample needs at least 10 seconds."
- The earlier failures (upl_727f7b24…, upl_896fde85…) were also ~8.6 KB. So this is recurring: the timer runs 42 s but the blob contains only the first chunk.
- In Rick's screenshot the dialog's audio player shows 00:00 / 00:00 for the bad recording, so the client already knew the blob was empty.
- He had a video playing in picture-in-picture at the time; on iOS another audio session can take the mic and silently stop MediaRecorder.

## Fix
1. After `onstop`, measure the blob locally (decode via `AudioContext.decodeAudioData` or load it into an `<audio>` and read the duration). If it's under 10 s, or wildly shorter than the timer, show inline: "The recording didn't capture your voice. Close other apps using the mic or audio and record again." Don't upload.
2. Listen for `MediaStreamTrack` `ended`/`mute` and `MediaRecorder` `error`/early `stop` events during recording. If they fire, stop the timer and show the same message instead of letting the clock keep counting.
3. On iOS Safari, prefer `audio/mp4` when `MediaRecorder.isTypeSupported('audio/mp4')`, and call `media.start()` without a timeslice. Also call `requestData()` before `stop()`. iOS has known issues with timesliced WebM/Opus.
4. Reset recorder state fully on "Start recording" again: new stream, new chunks array, revoke the old object URL.
5. Show the decoded length next to the file name (e.g. "my-voice.m4a · 0:42") so users can see what was captured.

## Acceptance
- iPhone Safari: record 40 s → blob ≥ 300 KB, player shows ~0:40, server decodes ~40 s.
- Start a video in picture-in-picture, then record → a clear inline error, no upload.
- Desktop Chrome is unchanged.
- Don't touch render/QA.
