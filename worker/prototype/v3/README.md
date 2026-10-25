# speakercrop v3: speaker-following 9:16 crop + word-by-word captions (PoC, free/local only)

Input: a wide two-shot (two people side by side). Output: a 720x1280 MP4 whose crop follows whoever is talking, with
TikTok/Shorts-style animated captions burned in, plus `<out>.ass`, `<out>.srt` and `<out>.words.json` next to it.
Everything runs locally on CPU: ffmpeg/libass, OpenCV YuNet, MediaPipe FaceLandmarker, Resemblyzer, faster-whisper
(medium.en, int8). No paid APIs and no gated or token models. Font: Poppins ExtraBold (OFL) in `fonts/`.

## Run
    python3 -m venv venv && . venv/bin/activate
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install mediapipe opencv-python-headless numpy pillow webrtcvad-wheels librosa scikit-learn faster-whisper
    pip install --no-deps resemblyzer
    curl -LO https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
    curl -L -o yunet.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
    python speakercrop.py input.mp4 vertical_v3.mp4   # runs ASR if words.json isn't next to the output (ASR_MODEL=small is ~4x faster)
    python metrics.py; python wordeval.py             # turn metrics / per-word voice labels vs the pitch proxy
    python timingcheck.py words.json vertical_v3.words.json   # caption timing vs audio energy
    python contact_captions.py vertical_v3.mp4        # 8 captioned frames, each on a different highlighted word
Files: `speakercrop.py` (pipeline), `transcribe.py` (ASR), `captions.py` (ASS/SRT), `speakercrop_v2.py` / `speakercrop_v1.py` (older rounds).

## Pipeline (exact steps, so it can be rebuilt in a product)
1. **Faces, 5 samples/s.** YuNet (score 0.5) finds faces, including 3/4 profiles. The two largest are the two people,
   labeled left and right by running x position. Each box is padded to 1.8x and passed to FaceLandmarker (IMAGE mode).
   Mouth = inner-lip gap (landmarks 13/14) / face height + 0.3*jawOpen. Activity = std over 1 s, with one median
   shared by both people. Lip score `sm` = act_L - act_R, averaged over ±0.8 s of voiced samples.
2. **Audio.** 16 kHz mono. An RMS gate marks the quietest 30% as pauses. Resemblyzer partial embeddings (1.6 s
   windows, 4/s) go into KMeans(2) on voiced partials. Which cluster is which person comes from the sign of the
   correlation between the cluster confidence and the lip score, so there's no enrollment and no names.
   `aud_s` = cluster confidence, normalized and smoothed over ±0.4 s.
3. **Coarse timeline (v2).** score = aud_s + 0.3*sm, switch past ±0.5, hold through pauses. A split layout is used
   when both mouths are active for ≥1.5 s. Shots under 0.8 s are merged.
4. **ASR.** faster-whisper medium.en, CPU int8, word_timestamps, Silero VAD filter (min silence 300 ms), beam 5,
   condition_on_previous_text off. Audio is decoded with ffmpeg rather than PyAV. Output: `words.json` [{w, s, e, p}].
5. **Word-level turns (v3, catches ~1 s interjections).** For every word, one Resemblyzer embedding over an 0.8 s
   window centered on the word (longer if the word is longer). The label is the closer of the two step-2 centroids,
   and margin = |cos_L - cos_R|. Labels are smoothed by a margin-weighted vote over ±1 word.
   A run of words from one speaker is **kept only if** it is ≥0.7 s long AND (it is ≥3 s long OR it has ≥2 words
   AND the 1.6 s voice track `aud_s` agrees with it by ≥0.3). Other runs are absorbed by the neighboring speaker.
   This second voice view is what removed the false cuts on emphatic speech ("please, please, please").
   The camera timeline is then rebuilt from the word runs: word span ±0.1 s, gaps hold the last speaker, and
   split-screen decisions are kept. Shots under 0.6 s are merged and look-ahead is 0.2 s (word starts are precise).
   Writes `words_spk.json`.
6. **Caption timing fixes** (`captions.py`). Whisper splits like "get" + "-go" are merged into one word. If a
   word follows a pause (>0.10 s), its start is snapped to the first 10 ms frame in [start-0.15, start+0.10] that
   is 8 dB above the local noise floor (20th percentile of the previous 0.3 s). A word ends at the next word's start
   when the gap is under 0.25 s (no flicker), and its duration is clamped to 0.08–1.5 s.
7. **Chunking.** 1–3 words and ≤32 characters (wraps to at most 2 lines). A new chunk starts after a pause over
   0.35 s, after punctuation, or **at every speaker change** (from step 5). Display text is UPPER CASE with trailing
   , . ; : dropped. A chunk stays up until 0.25 s after its last word or until the next chunk starts.
8. **ASS.** PlayRes 720x1280, Poppins ExtraBold 80 px, white fill, 7 px black outline, 4 px shadow, bottom-center,
   MarginV 380, so the text's baseline sits at ~70% of the frame height: above the bottom 20% UI zone and on the chest,
   below the faces. There is one Dialogue event per word, showing the whole chunk with the active word recolored by
   speaker (left person yellow #FFE600, right person green #39FF14) and a scale pop
   `\t(0,90,\fscx116\fscy116)\t(90,180,\fscx110\fscy110)`. In split layout the text moves to the seam
   (`\an5\pos(360,640)`). The SRT has one cue per chunk.
9. **Render, single pass.** OpenCV crops each frame (crop eases 0.2/frame toward the target face) and pipes raw BGR
   into ffmpeg: `-vf ass=<out>.ass:fontsdir=fonts`, libx264 veryfast crf 20, AAC audio from the source.
Env knobs: HYST LEAD MIN_SEG EASE VIS_W VOICE SPLIT BOTH_T | WORD_MIN AUD_MIN LEAD_WORDS MIN_SEG_WORDS | CAPTIONS ASR_MODEL WORDS NORENDER DEBUG.

## Clips (all CC BY 3.0, Spencer Fornaciari, Wikimedia Commons; trimmed, cropped to 9:16, re-encoded)
- main : Jill Thompson Interview, ECCC 2010, Part 1, 1:30–2:30. test2: Part 1, 4:00–5:00. test3: Part 2, 4:10–5:10 (densest back-and-forth).
  https://commons.wikimedia.org/wiki/File:Backroom_Comics_Podcast_-_Jill_Thompson_Interview_at_ECCC_2010_Part_1.webm
  https://commons.wikimedia.org/wiki/File:Backroom_Comics_Podcast_-_Jill_Thompson_Interview_at_ECCC_2010_Part_2.webm

## Results (pitch proxy: woman on the left / man on the right; the proxy itself is noisy)
| clip  | ver | agree | turns caught | mean delay | false sw |
|-------|-----|-------|--------------|------------|----------|
| main  | v2  | 98%   | 1/2          | -1.0 s     | 0        |
| main  | v3  | 98%   | 1/2          | -0.4 s     | 0        |
| test2 | v2  | 97%   | 2/4          | +0.4 s     | 2        |
| test2 | v3  | 96%   | 2/4          | +0.9 s     | **0**    |
| test3 | v2  | 93%   | 4/10         | -0.15 s    | 0        |
| test3 | v3  | 93%   | **5/10**     | -0.2 s     | 0        |
Without the step-5 agreement gate, test3 reached 6/10 at 95% but test2 had 6 false cuts. The gate trades one catch for zero false cuts.
Per-word voice label vs pitch proxy: main 96%, test2 98%, test3 89%.

Caption timing vs audio energy (`timingcheck.py`). Onset contrast = energy in the first 100 ms of a highlighted word minus
the 100 ms before it, for words after a pause. Raw whisper → fixed: main +1.5 → +7.4 dB, test2 +2.0 → +2.8 dB,
test3 -0.2 → +4.1 dB. Note that the snap uses the same energy, so this measure flatters the fix. Highlights over
voiced audio: 79–88% for both raw and fixed.
ASR: medium.en is noticeably better than small on this clip. small heard "infection" for "affection" and "sob" for "sobbed",
and dropped "you know" and the second "sure". medium.en errors seen: "Scott Alley" (should be Allie), a stray "-go" token
(merged), and hesitations ("Um", repeated "that's") are kept verbatim.
Speed (8 CPU cores, 720p): crop + captions + encode ~18–19 s per minute of video, plus ASR at 13–20 s per minute
(medium.en) or ~5 s per minute (small). Total ~35–40 s of wall time per minute.

## Known limits
- Interjections under ~0.7 s stay on the main speaker by design. Some proxy "turns" in test3 are backchannels where both
  people overlap. The first 0.7 s of a clip can be mislabeled ("I love animals" in test3 is captioned green).
- Speaker-to-face mapping assumes two visible people. Edited multi-cam footage needs shot detection first (not done).
