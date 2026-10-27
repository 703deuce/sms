# Clipper multiperson — progress

**Branch:** `cursor/clipper-multiperson-e321`  
**Status:** Implementation landed (pytest, no video renders in CI)

## Done

- Tracklets + ByteTrack-lite IoU association + histogram shot cuts (`tracking.py`)
- SFace re-ID clustering (env `REID_DIST`, max 5 persons, 5% min presence)
- Director: Hungarian diarization map, Viterbi layouts, MIN_SHOT / LEAD / overlap rules (`director.py`)
- Critically damped pan smoothing (`smoothing.py`)
- Crop track v2 + v1 legacy shots (`crop_format.py`, `multiperson_pipeline.py`)
- ffmpeg filtergraph helpers + `multiperson_render.py`
- Layout styles: `auto`, `dynamic`, `split_debate`, `grid`, `locked_off` (+ legacy split/fill/fit)
- `PROCESS_PROJECT` rotates `auto` styles per clip rank
- Model: `face_recognition_sface_2021dec.onnx` in `download-models.sh` + `log_models()`
- Unit tests: `worker/tests/test_multiperson_clipper.py`

## Rick / owner video QA

- 3-minute clips on staging worker after Agent A deploy
- Validate 2–4 person podcasts: layout variety, seam captions, no pan nausea

## Deferred

- PySceneDetect AdaptiveDetector (histogram cut fallback only today)
- Per-person thumbnails in crop v2
- Full grid3 ffmpeg path polish (grid4 + two_up primary)
