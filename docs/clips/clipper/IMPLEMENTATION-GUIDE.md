# Clipper v2 implementation guide: multi-person reframe, layouts, smoothing, rendering

*Commit target:* `docs/clips/clipper/IMPLEMENTATION-GUIDE.md` · *Written:* 2026-10-27 (ET) · *Scope:* the regular (VOD/upload) clipper. Twitch real-time is **out of scope**.
*Companion specs:* `docs/clips/clipper/clipper-streamer-bic.md` (target behaviour, §4.x numbers referenced below) and `docs/clips/clipper/clipper-streamer-ui-layouts.md` (layout names: speaker_follow / split / fill / fit, stacked streamer layout, PiP).

This guide is self-contained. Every code block in it was run on a 4-vCPU CPU-only box (pinned with `taskset -c 0-3`, no GPU) against short test clips (≤120 s). Each stage gives the goal and why, what already exists in the repo, what changes (as a diff against the named function), exact steps, library APIs and versions, the code, and the measured speed.

**Ground rules for the implementing agent**

1. **Do not rebuild what exists.** Every stage below is labelled **EXISTS, KEEP**, **EXISTS, UPGRADE**, or **NEW**. Upgrades extend the named function or file in place, or add a v2 path behind a flag, and keep the v1 path working.
2. **Ship v2 behind `REFRAME_V=2`.** `worker/prototype/v3/speakercrop.py` stays the subprocess entry point with the same argv and env contract. v1 stays the default until the A/B in §12 passes.
3. **CPU only.** Production is `GPU_PROVIDER=local`. Nothing here may require a GPU or torch on the default path.
4. **No AGPL or non-commercial weights** (see §13). No Ultralytics YOLO, no InsightFace model packs.

---

## 0. The problems this fixes (from `specs/streamer-clipper-inventory.md`)

| # | Problem today | Where | Fixed in |
|---|---|---|---|
| P1 | speakercrop handles at most **2 faces** and only a **2-up split** (no grid, no 3-up, no >2 people) | `speakercrop.py` step 1 (L/R assignment, `xpos[0..1]`), `tile()` | §2–§6, §8 |
| P2 | **fit / fill / split settings are ignored**: `layout_env()` sets `LAYOUT_MODE` / `FORCE_SPLIT`, but speakercrop never reads them | `render_clip.layout_env` → `speakercrop.py` | §6 `director_cfg_from_env` |
| P3 | The fallback **pads with black bars** | `render_clip.ffmpeg_fit_export` | §8.4 |
| P4 | **The subject-follow track is overwritten.** `reframe_clip_preview` writes the motion or fit_blur track, then calls `run_speakercrop` with the same `crop_track_out` | `pipeline.reframe_clip_preview` | §9.3 |
| P5 | **No pan-speed cap** (exponential `EASE` 0.2/frame); fast whips are possible | `speakercrop._eased_x0`, `subject_reframe.build_crop_track` | §7 |
| P6 | **Facecam detection reads only the first 60 frames (~2 s)**, has no rectangle detection, and confidence is just a count | `streamer/layout/detect_facecam.detect_facecam_layout` | §8.6 |
| P7 | **Deepgram diarization is not fused** into the camera timeline (speakercrop re-clusters voices with Resemblyzer) | `speakercrop.py` steps 2–5 | §5 |
| P8 | `aiMeta` has **no `cropMethod`**, so the fallback rate can't be measured | `pipeline.reframe_clip_preview` caller | §9.3 |
| P9 | Local `reframe_core.track_faces` is a **constant-centre placeholder** | `clips_worker/reframe_core.py` | §2–§4 |
| P10 | `MIN_SEG` is 0.8 s (bic §4.4 wants a 1.5–2 s min hold), and there are no shot-boundary-aware cuts | `speakercrop.py` threshold/merge loop | §1, §6 |

## 1. Status of every stage

| Stage | Status | Existing code | What v2 does |
|---|---|---|---|
| 1 Shot detection | **NEW** | none (speakercrop has no notion of editor cuts) | PySceneDetect `AdaptiveDetector`; cuts make layout switches free and reset trackers and smoothing |
| 2 Face detection | **EXISTS, KEEP** + small upgrade | YuNet `yunet.onnx` @ 5 samples/s in `speakercrop.py` | Same model and rate. Detect at 640 px width (3.5x faster than 1280) and filter background faces |
| 2b Person detection | **NEW, optional** | none | MediaPipe EfficientDet-Lite0 for no-face shots (back of head). Default off |
| 3 Tracking | **NEW** | v1 sorts faces left/right per sample | `supervision.ByteTrack` per shot |
| 4 Re-ID → P1..P5 | **NEW** | none (identity = left/right position) | SFace embeddings, per-video gallery, Hungarian with a cannot-link constraint |
| 5 Active speaker | **EXISTS, UPGRADE** | lip gap + jawOpen (FaceLandmarker) and Resemblyzer voice clusters, margin vote | Keep the mouth score (now per person, normalised per person). **Fuse Deepgram `spk` turns** via a softmax posterior. Resemblyzer labels stay as the fallback turn source |
| 6 Director | **EXISTS, UPGRADE** | threshold + merge loop (`MIN_SEG`, `HYST`, `LEAD`, `BOTH_T`), single/split only | Duration-constrained Viterbi over single(Pk) / split(Pa,Pb) / grid / wide, with switch cost, min hold 1.5 s, lead 0.4 s, and free switches at cuts. Honours `LAYOUT_MODE` / `FORCE_SPLIT` / `SHOT_OVERRIDES` |
| 7 Smoothing | **EXISTS, UPGRADE** | `speakercrop._eased_x0` (EASE 0.2), `subject_reframe.build_crop_track` easing | One-Euro filter, dead zone, **pan cap 0.15 frame-widths/s**, reset at cuts |
| 8 Rendering | **EXISTS, UPGRADE** | OpenCV → ffmpeg rawvideo pipe (`speakercrop.py` §4), `tile()` 9:8 2-up, `render_wide()` blur, `render_stack.render_stack_mp4` (streamer stack), `ffmpeg_fit_export` (black pad) | Keep the pipe. Add `compose_frame` (single / split / three / grid / side / pip / wide), blur-fit in ffmpeg for the fallback, and an optional per-segment `filter_complex` + concat renderer |
| 8.6 Facecam detection | **EXISTS, UPGRADE** | `detect_facecam_layout` (first 60 frames, median face × 2.2/2.6) | Samples across the whole video, finds the persistent overlay rectangle, validates it with recurring faces, and gives a real confidence (bic §4.5) |
| 9 Wiring | **EXISTS, UPGRADE** | `render_clip.run_speakercrop`, `pipeline.reframe_clip_preview` | `REFRAME_V=2`, `CROP_TRACK_IN`, `cropMethod` in aiMeta, crop_track v2 (a superset of v1) |
| 10 Tests | **NEW** | — | 20 pytest tests (unit + a 60 s integration fixture) |

**Files touched**

```
worker/clips_worker/reframe_core.py                    UPGRADE (placeholder -> stages 1-8; blend_targets kept)
worker/prototype/v3/speakercrop_v2.py                  NEW     (REFRAME_V=2 entry + CROP_TRACK_IN renderer)
worker/prototype/v3/speakercrop.py                     UPGRADE (3-line dispatch at the top; v1 body untouched)
worker/clips_worker/render_clip.py                     UPGRADE (ffmpeg_fit_export -> blur; run_speakercrop passes REFRAME_V, CROP_TRACK_IN)
worker/clips_worker/pipeline.py                        UPGRADE (reframe_clip_preview: no overwrite, cropMethod)
worker/clips_worker/streamer/layout/detect_facecam.py  UPGRADE (whole-video sampling + rectangle)
worker/requirements.txt                                UPGRADE (scenedetect, supervision, scipy pins)
worker/models/: sface.onnx (+ optional efficientdet_lite0.tflite) NEW model files next to yunet.onnx
new-app/lib/clips/crop-track.ts                        UPGRADE (optional v2 fields)
worker/tests/test_reframe_director.py, test_reframe_integration.py   NEW
worker/tests/fixtures/multicam_edit.mp4 (+ LICENSE.txt)              NEW
```

> **Naming collision.** `subject_reframe.blend_targets(motion, subjectBox, w)` (motion + Gemini box blend) and `reframe_core.blend_targets(prev, nxt, alpha)` (scalar lerp) are different functions that share a name. Keep both, and don't merge them. Import with the module prefix.

---

## 2. Install and versions (measured on Python 3.11, ffmpeg 7.1)

| Package | Version tested | Why | Notes |
|---|---|---|---|
| opencv-contrib-python-**headless** | 4.11.0.86 | YuNet `cv2.FaceDetectorYN`, SFace `cv2.FaceRecognizerSF` | Already a worker dep. Never install the non-headless wheel next to it |
| mediapipe | 1.1.1 (any version speakercrop already uses works) | FaceLandmarker (mouth), optional EfficientDet person detector | Already a worker dep. Call `lm.close()` explicitly, otherwise `__del__` raises at interpreter exit |
| numpy | **1.26.4** (pinned by the worker) | | supervision 0.30.x is the last line that supports numpy<2 |
| scenedetect | **0.7.2** | shot detection | `pip install scenedetect==0.7.2` (pure Python and OpenCV) |
| supervision | **0.30.9**, pin `>=0.30,<0.31` | `sv.ByteTrack` | 0.30.9 emits a deprecation warning, and **0.31 removes `sv.ByteTrack`**. The replacement `trackers.ByteTrackTracker` needs numpy≥2. Pin, and wrap it in `FaceTracker` (below) so it can be swapped later |
| scipy | 1.17.1 (≥1.10 fine) | `linear_sum_assignment` (re-ID, speaker mapping) | |
| onnxruntime | 1.31.1 | only for the optional Light-ASD/insightface experiments | not needed on the default path |
| pytest | 9.1.1 | tests | |

`requirements.txt` diff:

```diff
+scenedetect==0.7.2
+supervision>=0.30.9,<0.31   # sv.ByteTrack removed in 0.31; 0.31+ needs numpy>=2
+scipy>=1.10
```

**Models** (put them next to `yunet.onnx` / `face_landmarker.task`, which speakercrop already loads from its own directory):

| File | Source | License | Size |
|---|---|---|---|
| `yunet.onnx` (exists) | opencv_zoo `face_detection_yunet_2023mar.onnx` | MIT | 0.2 MB |
| `face_landmarker.task` (exists) | MediaPipe | Apache-2.0 | 3.6 MB |
| `sface.onnx` (**new**) | opencv_zoo `face_recognition_sface_2021dec.onnx` | Apache-2.0 | 37 MB |
| `efficientdet_lite0.tflite` (optional) | MediaPipe object detector | Apache-2.0 | 4.4 MB |

```bash
cd worker/prototype/v3   # wherever yunet.onnx lives in the image (/app/v3)
curl -L -o sface.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx
curl -L -o efficientdet_lite0.tflite https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite
```

**Module header** of the upgraded `worker/clips_worker/reframe_core.py`. All stage code below goes into this one file, in the order shown. The existing `blend_targets` is kept verbatim.

```python
"""Pure face/crop helpers for local + Modal parity (S15). No DB or storage imports.

v2 (multi-person reframe): shot detection, face detection, tracking, re-ID,
speaker fusion, Viterbi layout director, One-Euro smoothing, layout geometry.
Everything here is pure numpy/OpenCV so speakercrop.py, reframe_crop.py and
modal_app/face.py can share it.  Heavy models are created by the make_* helpers.
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass, field
from typing import Iterable

import cv2  # opencv-contrib-python-headless (already a worker dependency)
import numpy as np

# --------------------------------------------------------------------------
# existing helpers (kept)
# --------------------------------------------------------------------------

def blend_targets(prev: float, nxt: float, alpha: float = 0.35) -> float:
    return prev * (1 - alpha) + nxt * alpha
```

All timings below are **ms per frame or per sample on 4 vCPU**, at 1280x720 unless noted.

---

## 3. Stage 1: shot detection (NEW)

**Goal.** Find hard cuts in the source (podcast multicam edits, re-uploads of edited shows).
**Why.** A camera move across a cut looks broken. Cuts are free places to change layout, tracker IDs don't survive them, and smoothing must reset at them (bic §4.3/§4.4). v1 has no shot notion, so it whip-pans through editor cuts.

**Steps**
1. Run `detect_shots(video)` once per analysed window, before tracking.
2. Pass the shots to `track_faces` (which resets ByteTrack per shot) and pass the cut sample indices to `viterbi_layout(..., cuts=...)`.
3. Smoothing resets at the same frames (`smooth_path(resets=...)`).

**API.** `scenedetect==0.7.2`: `open_video`, `SceneManager`, `AdaptiveDetector(adaptive_threshold, min_scene_len)`, `SceneManager.auto_downscale=False`, `SceneManager.downscale=4`, `detect_scenes(video)`, `get_scene_list()`. Detectors are **stateful**: create a fresh `SceneManager` and detector per call (the function below does).

```python
def detect_shots(video_path: str, *, downscale: int = 4, adaptive_threshold: float = 3.0,
                 min_scene_len_s: float = 0.5, fps: float = 30.0) -> list[tuple[float, float]]:
    """Return [(start_s, end_s), ...] hard cuts. PySceneDetect 0.7.2 AdaptiveDetector.

    downscale=4 makes 720p/1080p ~1 ms/frame on 4 vCPU (decode dominated).
    A single-shot video returns one (0, duration) entry.
    """
    from scenedetect import AdaptiveDetector, SceneManager, open_video

    video = open_video(video_path)
    fps = float(video.frame_rate or fps)
    sm = SceneManager()
    sm.auto_downscale = False
    sm.downscale = downscale
    sm.add_detector(AdaptiveDetector(adaptive_threshold=adaptive_threshold,
                                     min_scene_len=max(1, int(round(min_scene_len_s * fps)))))
    sm.detect_scenes(video)
    scenes = sm.get_scene_list(start_in_scene=True)
    return [(s.get_seconds(), e.get_seconds()) for s, e in scenes]


def shot_index(shots: list[tuple[float, float]], t: float) -> int:
    for i, (s, e) in enumerate(shots):
        if s <= t < e:
            return i
    return max(0, len(shots) - 1)
```

**Measured** (`multicam_edit.mp4`, 60 s, cuts at 10/20/30/40/50 s): AdaptiveDetector, ContentDetector, and HistogramDetector all found 5/5 cuts with 0 false cuts. AdaptiveDetector at downscale=4 runs at **0.95–0.98 ms/frame**, and decode alone is 0.80–0.94 ms/frame, so it's decode-bound. That is 1.0 s per source-minute at 30 fps. TransNetV2 (a neural shot detector) isn't needed; it would need torch or TF for no gain on hard cuts. Dissolves aren't handled, which is acceptable because the director simply sees a short low-confidence region.

---

## 4. Stage 2: face detection (EXISTS, KEEP: YuNet @ 5 samples/s) + background filter (NEW)

**Existing.** `speakercrop.py` step 1 creates `cv2.FaceDetectorYN.create(yunet.onnx, '', (W, H), 0.5, 0.3, 50)` and runs it on full-res frames every `round(fps/5)` frames. Keep the model, score threshold (0.5–0.6), and rate.

**Upgrade (diff)**
```diff
- det = cv2.FaceDetectorYN.create(os.path.join(HERE, 'yunet.onnx'), '', (W, H), 0.5, 0.3, 50)
- n_f, faces = det.detect(fr)
+ det = rc.make_face_detector(os.path.join(HERE, 'yunet.onnx'), input_w=640, score=0.6)
+ faces = rc.filter_main_faces(rc.detect_faces_scaled(det, fr, 640), H)   # boxes back in source pixels
```

**Why 640 px.** YuNet's cost scales with pixels, and talking heads in a 9:16 crop are never smaller than ~4% of frame height, which is still ≥26 px at 640 width.

| YuNet input width | ms/frame (4 vCPU) |
|---|---|
| 1280 (v1 today) | 23.8 |
| 960 | 12.9 |
| **640 (v2)** | **6.8–7.7** |
| 480 | 5.0 |
| 320 | 3.3–4.0 (misses small panel faces) |

`filter_main_faces` drops faces smaller than 4.5% of frame height and faces far smaller than the largest face in the frame (crowd and background people). The director never targets them.

**API.** `cv2.FaceDetectorYN.create(model, config, input_size, score_threshold, nms_threshold, top_k)`, `det.setInputSize((w, h))`, and `det.detect(img)` returns `(retval, faces[N, 15])` with x, y, w, h, 5 landmarks × 2, and score.

```python
def make_face_detector(model_path: str, input_w: int = 640, score: float = 0.6, nms: float = 0.3, top_k: int = 50):
    import cv2
    return cv2.FaceDetectorYN.create(model_path, "", (input_w, input_w), score, nms, top_k)


def detect_faces_scaled(det, frame: np.ndarray, target_w: int = 640) -> np.ndarray:
    """YuNet on a frame downscaled to target_w. Returns Nx15 float32 in FULL-RES pixels:
    [x, y, w, h, re_x, re_y, le_x, le_y, nose_x, nose_y, rm_x, rm_y, lm_x, lm_y, score]."""
    import cv2
    H, W = frame.shape[:2]
    s = min(1.0, target_w / W)
    small = frame if s == 1.0 else cv2.resize(frame, (int(round(W * s)), int(round(H * s))), interpolation=cv2.INTER_AREA)
    det.setInputSize((small.shape[1], small.shape[0]))
    _, f = det.detect(small)
    if f is None:
        return np.zeros((0, 15), np.float32)
    f = f.astype(np.float32).copy()
    f[:, :14] /= s
    return f


def filter_main_faces(faces: np.ndarray, frame_h: int, *, min_frac: float = 0.045,
                      min_rel: float = 0.40, max_faces: int = 5) -> np.ndarray:
    """Drop background faces: keep faces >= min_frac of frame height AND >= min_rel of the
    largest face, at most max_faces, largest first."""
    if len(faces) == 0:
        return faces
    h = faces[:, 3]
    keep = (h >= min_frac * frame_h) & (h >= min_rel * h.max())
    f = faces[keep]
    return f[np.argsort(-f[:, 3])][:max_faces]
```

**Optional person detector (NEW, default off).** Use it for shots where the speaker turns away and no face is visible. MediaPipe `ObjectDetector` with `efficientdet_lite0.tflite` (category `person`) costs **18.7–20.6 ms/frame**, about 3x YuNet. Run it only on samples where YuNet found nothing in a shot that had faces. `fill_gaps` (§6) already bridges ≤2 s dropouts, so leave this off unless the A/B shows lost speakers.

```python
from mediapipe.tasks.python import BaseOptions, vision
import mediapipe as mp
pd = vision.ObjectDetector.create_from_options(vision.ObjectDetectorOptions(
    base_options=BaseOptions(model_asset_path="efficientdet_lite0.tflite"),
    running_mode=vision.RunningMode.IMAGE, score_threshold=0.4, category_allowlist=["person"], max_results=6))
res = pd.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB)))
boxes = [(d.bounding_box.origin_x, d.bounding_box.origin_y, d.bounding_box.width, d.bounding_box.height) for d in res.detections]
pd.close()
```

---

## 5. Stage 3: tracking (NEW): ByteTrack per shot

**Goal.** Give each face a stable short-term ID (a tracklet) within a shot.
**Why.** v1 identifies people by left/right sort order, which breaks as soon as people cross, lean, or a third face appears. That is the root of the 2-face cap (P1).

**Steps.** Run one `FaceTracker` per shot. Feed it YuNet boxes and scores each sample, keep the returned `tracker_id`, and drop the tracker at a cut (IDs are prefixed with the shot index so they're unique per video).

**API.** `supervision==0.30.9`: `sv.ByteTrack(track_activation_threshold, lost_track_buffer, minimum_matching_threshold, frame_rate, minimum_consecutive_frames)`, `sv.Detections(xyxy, confidence, class_id)`, and `tracker.update_with_detections(dets)` returns detections with `.tracker_id`. The wrapper isolates supervision so that the 0.31 removal is a one-class change.

```python
class FaceTracker:
    """ByteTrack adapter. supervision==0.30.9 (sv.ByteTrack, numpy 1.26 OK).
    When the worker moves to numpy>=2, swap the body for trackers.ByteTrackTracker
    (trackers>=2.6) - the public method stays the same."""

    def __init__(self, sample_fps: float, lost_s: float = 2.0):
        import warnings
        warnings.filterwarnings("ignore", category=FutureWarning, module="supervision")
        import supervision as sv
        self._sv = sv
        self.bt = sv.ByteTrack(track_activation_threshold=0.5, lost_track_buffer=int(round(lost_s * sample_fps)),
                               minimum_matching_threshold=0.8, frame_rate=sample_fps, minimum_consecutive_frames=1)

    def reset(self) -> None:          # call at every hard cut
        self.bt.reset()

    def update(self, faces: np.ndarray) -> list[tuple[int, np.ndarray]]:
        """faces: Nx15 YuNet rows. Returns [(track_id, face_row)] for confirmed tracks."""
        sv = self._sv
        if len(faces) == 0:
            det = sv.Detections.empty()
        else:
            xyxy = np.c_[faces[:, 0], faces[:, 1], faces[:, 0] + faces[:, 2], faces[:, 1] + faces[:, 3]]
            det = sv.Detections(xyxy=xyxy.astype(np.float32), confidence=faces[:, 14].astype(np.float32),
                                class_id=np.zeros(len(faces), int), data={"row": np.arange(len(faces))})
        out = self.bt.update_with_detections(det)
        res = []
        for k in range(len(out)):
            # sv keeps det data; map back to the original row by IoU-free index
            row = int(out.data["row"][k]) if "row" in out.data else int(np.argmin(np.abs(faces[:, 0] - out.xyxy[k, 0])))
            res.append((int(out.tracker_id[k]), faces[row]))
        return res
```

**Measured.** ByteTrack costs **0.76 ms/sample** with 2–3 faces and 1.13 ms/sample with 5 faces. It's negligible.

---

## 6. Stage 4: re-ID to P1..P5 (NEW)

**Goal.** Merge tracklets across shots and occlusions into at most 5 people, `P1..P5`, ordered by screen time.
**Why.** A multicam podcast shows the same host in shots 1, 4, and 6. The director, the crop_track, and the editor's override UI ("focus P2") all need one identity per human (bic §4.2).

**Method**
1. Take an SFace embedding (128-d, L2-normalised) of the aligned face for a tracklet's samples. Cap it at a few per tracklet to bound cost.
2. Each tracklet's prototype is its mean embedding.
3. Build a per-video gallery in tracklet start order. Tracklets that overlap in time can't be the same person (**cannot-link**).
4. Match with Hungarian assignment (`scipy.optimize.linear_sum_assignment`) on cosine similarity, threshold **0.36** (the SFace paper and opencv_zoo threshold for "same person" is 0.363).
5. Unmatched tracklets start a new person, up to `max_people`. Tracklets shorter than 3 samples are ignored.

**API.** `cv2.FaceRecognizerSF.create(model, "")`, `rec.alignCrop(img, face_row)`, and `rec.feature(aligned)` returns `[1, 128]`.

```python
class FaceEmbedder:
    """OpenCV Zoo SFace (Apache-2.0). 128-d, L2-normalised. Uses YuNet landmarks for alignment."""

    def __init__(self, model_path: str):
        import cv2
        self.cv2 = cv2
        self.rec = cv2.FaceRecognizerSF.create(model_path, "")

    def embed(self, frame: np.ndarray, face_row: np.ndarray) -> np.ndarray:
        crop = self.rec.alignCrop(frame, face_row[:15].reshape(1, -1).astype(np.float32))
        v = self.rec.feature(crop).reshape(-1).astype(np.float32)
        return v / (np.linalg.norm(v) + 1e-9)


@dataclass
class Tracklet:
    tid: int                     # unique across the video (shot-prefixed)
    shot: int
    idx: list = field(default_factory=list)      # sample indices
    boxes: list = field(default_factory=list)    # [x, y, w, h]
    embs: list = field(default_factory=list)
    mouth: list = field(default_factory=list)    # mouth_open per sample (NaN if not measured)

    @property
    def start(self) -> int: return self.idx[0]
    @property
    def end(self) -> int: return self.idx[-1]
    def proto(self) -> np.ndarray | None:
        if not self.embs: return None
        m = np.mean(self.embs, 0); return m / (np.linalg.norm(m) + 1e-9)


def assign_people(tracklets: list[Tracklet], *, sim_thr: float = 0.36, max_people: int = 5,
                  min_len: int = 3) -> dict[int, int]:
    """Per-video gallery. Tracklets are processed in start order; every group starting at the
    same sample is matched to the gallery with Hungarian on cost = 1 - cosine.  A person can't
    take a tracklet that overlaps in time with one already assigned to it (cannot-link).
    Returns {tracklet_tid: person_index (0-based, ordered by screen time, < max_people)}."""
    from scipy.optimize import linear_sum_assignment

    tl = [t for t in tracklets if len(t.idx) >= min_len and t.proto() is not None]
    tl.sort(key=lambda t: (t.start, t.boxes[0][0]))
    protos: list[np.ndarray] = []; weights: list[float] = []; spans: list[list[tuple[int, int]]] = []
    raw: dict[int, int] = {}
    i = 0
    while i < len(tl):
        grp = [t for t in tl[i:] if t.start == tl[i].start]
        i += len(grp)
        P = len(protos)
        cost = np.full((len(grp), P), 9.0)
        for a, t in enumerate(grp):
            for p in range(P):
                if any(not (t.end < s or t.start > e) for s, e in spans[p]):
                    continue          # cannot-link: overlaps in time
                cost[a, p] = 1.0 - float(protos[p] @ t.proto())
        rows, cols = linear_sum_assignment(cost) if P else (np.array([], int), np.array([], int))
        taken = {}
        for a, p in zip(rows, cols):
            if cost[a, p] <= 1.0 - sim_thr:
                taken[a] = p
        for a, t in enumerate(grp):
            if a in taken:
                p = taken[a]
                w = weights[p]; n = len(t.embs)
                m = protos[p] * w + t.proto() * n
                protos[p] = m / (np.linalg.norm(m) + 1e-9); weights[p] = w + n; spans[p].append((t.start, t.end))
            else:
                protos.append(t.proto()); weights.append(float(len(t.embs))); spans.append([(t.start, t.end)])
                p = len(protos) - 1
            raw[t.tid] = p
    # order people by screen time, keep max_people
    screen = np.zeros(len(protos))
    for t in tl: screen[raw[t.tid]] += len(t.idx)
    order = list(np.argsort(-screen))[:max_people]
    remap = {int(p): r for r, p in enumerate(order)}
    return {tid: remap[p] for tid, p in raw.items() if p in remap}


def track_faces(video_path: str, params: dict | None = None) -> dict:
    """Detect -> track -> re-ID for the whole clip at params['sample_fps'] (default 5).

    Returns {"v": 2, "fps", "sample_fps", "W", "H", "t": [...], "shots": [(s,e)],
             "people": [{"id": "P1", "x": [...], "y": [...], "w": [...], "h": [...]}]}
    with NaN where a person is not visible.  (Old v1 placeholder callers only read
    "fps"; they keep working.)"""
    import cv2
    params = params or {}
    models = params.get("models_dir") or os.environ.get("REFRAME_MODELS", os.path.dirname(os.path.abspath(__file__)))
    sample_fps = float(params.get("sample_fps") or 5.0)
    det_w = int(params.get("det_w") or 640)
    max_people = int(params.get("max_people") or 5)
    emb_every = int(params.get("emb_every") or 2)
    shots = params.get("shots") or detect_shots(video_path)
    lm = make_mouth_landmarker(params["mouth_model"]) if params.get("mouth_model") else None

    det = make_face_detector(os.path.join(models, "yunet.onnx"), det_w)
    emb = FaceEmbedder(os.path.join(models, "sface.onnx"))
    trk = FaceTracker(sample_fps)
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = int(cap.get(3)), int(cap.get(4))
    step = max(1, round(fps / sample_fps))
    T: list[float] = []
    tracklets: dict[int, Tracklet] = {}
    cur_shot = -1; fi = 0; j = 0
    timings = {"detect": 0.0, "track": 0.0, "embed": 0.0, "n": 0, "n_emb": 0}
    import time
    while cap.grab():
        if fi % step == 0:
            ok, fr = cap.retrieve()
            if not ok: break
            t = fi / fps; T.append(t)
            si = shot_index(shots, t)
            if si != cur_shot:
                trk.reset(); cur_shot = si
            t0 = time.perf_counter()
            faces = filter_main_faces(detect_faces_scaled(det, fr, det_w), H, max_faces=max_people + 1)
            t1 = time.perf_counter()
            for tid, row in trk.update(faces):
                key = si * 10000 + tid                        # unique per shot
                tl = tracklets.setdefault(key, Tracklet(tid=key, shot=si))
                tl.idx.append(j); tl.boxes.append(row[:4].tolist())
                if lm is not None:                                 # Stage 5 visual cue, same pass
                    t3 = time.perf_counter()
                    tl.mouth.append(mouth_open(lm, fr, row[0] + row[2] / 2, row[1] + row[3] / 2, row[3]))
                    timings["mouth"] = timings.get("mouth", 0.0) + time.perf_counter() - t3
                if (len(tl.idx) - 1) % emb_every == 0 and row[3] >= 40:
                    t2 = time.perf_counter(); tl.embs.append(emb.embed(fr, row)); timings["embed"] += time.perf_counter() - t2
                    timings["n_emb"] += 1
            timings["detect"] += t1 - t0; timings["track"] += time.perf_counter() - t1 - 0; timings["n"] += 1
            j += 1
        fi += 1
    n = len(T)
    mapping = assign_people(list(tracklets.values()), max_people=max_people)
    P = 1 + max(mapping.values()) if mapping else 0
    arr = np.full((P, 4, n), np.nan, np.float32); mouth = np.full((P, n), np.nan)
    for key, tl in tracklets.items():
        p = mapping.get(key)
        if p is None: continue
        ms = tl.mouth if tl.mouth else [np.nan] * len(tl.idx)
        for jj, b, m in zip(tl.idx, tl.boxes, ms):
            if np.isnan(arr[p, 0, jj]) or b[3] > arr[p, 3, jj]:
                arr[p, :, jj] = b; mouth[p, jj] = m
    if lm is not None:
        lm.close()
    timings["track"] -= timings["embed"] + timings.get("mouth", 0.0)
    people = [dict(id=f"P{p+1}", x=(arr[p, 0] + arr[p, 2] / 2).tolist(), y=(arr[p, 1] + arr[p, 3] / 2).tolist(),
                   w=arr[p, 2].tolist(), h=arr[p, 3].tolist()) for p in range(P)]
    return {"v": 2, "fps": fps, "sample_fps": sample_fps, "W": W, "H": H, "t": T, "shots": shots,
            "people": people, "mouth": mouth.tolist(), "_tracklets": {k: mapping.get(k) for k in tracklets},
            "_timings": timings}
```

`track_faces` output (the same function name as the old placeholder, but it now returns real data). It is a superset of the placeholder `{"v":1, fps, track:[{t,cx,cy,zoom}]}` contract, so Modal parity code that reads `track` keeps working:

```text
{v:2, fps, sample_fps, W, H, t:[n], track:[{t,cx,cy,zoom}] (v1 compat, = P1),
 people:[{id:"P1", x:[n], y:[n], w:[n], h:[n]}...], mouth:[[n]...]  (Stage 5 hook), shots, _timings}
```

**Measured (4 vCPU)**

| Clip | Wall time | Detection | SFace | Re-ID result |
|---|---|---|---|---|
| multicam_edit (60 s, 5 cuts) | **6.4 s** total | 6.94 ms/sample | 10.1 ms/face (n=260) | **perfect**: host P1 and guest P2 re-identified across all 6 shots; P3/P4 only in shot 5 |
| four_up (60 s, 1920x1080, 4 people) | 10.4 s | 8.07 ms/sample | 9.4 ms/face (n=617) | 4 people + 1 background face (P5, 10% visible, filtered out by the director) |

**Not used, and why.** InsightFace `buffalo_s` / `buffalo_l` work well, but the model pack license is **non-commercial research only**. SFace is Apache-2.0. If quality is ever insufficient, use an ArcFace model with a commercial license; don't ship buffalo.

---

## 7. Stage 5: active speaker (EXISTS, UPGRADE: fuse Deepgram turns with the mouth score)

**Existing.** `speakercrop.py` step 1 computes a mouth score `|lip13.y − lip14.y| / face height + 0.3·jawOpen` per face with FaceLandmarker (IMAGE mode) on a 1.8× face crop. Steps 2–5 cluster voices with Resemblyzer, compute a "lip score", and run a margin vote and an agreement gate. Deepgram's `spk` labels (`deepgram_transcribe.map_deepgram_words` → `{w, s, e, spk, i, p}`) feed captions only (P7).

**Upgrade**
1. Lift the mouth formula into `mouth_open()` unchanged, and run it **inside `track_faces`'s decode loop** (`params["mouth_model"]`) so each tracked face is measured once, in the same pass.
2. Compute `mouth_activity`: a rolling std over 1 s, **normalised per person** by that person's median. v1 used one shared median, which biases toward the frontal face when the other is in profile (speakercrop L83).
3. Use `speaker_turns`: Deepgram words → a per-sample speaker id. Bridge gaps ≤0.6 s and pad ±0.15 s.
4. Use `map_speakers_to_people`: Hungarian on a co-activity gain. A speaker whose voice never lines up with a visible mouth (host voice-over, off-screen guest) stays **unmapped**, so it votes for "none/wide" rather than a wrong face.
5. Use `speaker_posterior`: a softmax over visible people plus "none". The math:

```
for visible person p:   logit_p   = w_vis · (act_p − 1) / vis_temp  +  w_audio · [turn(t) maps to p]
                        logit_p   = −∞ if p not visible at t
none (nobody on screen):logit_none = prior_none + w_audio · [turn(t) is an unmapped voice] + w_silence · [silence at t]
post(t) = softmax({logit_p}, logit_none)            defaults: w_audio 2.5, w_vis 1.0, vis_temp 0.5, w_silence 1.0
```

Audio dominates when it exists (Deepgram diarization is reliable at the turn level). The visual term breaks ties, handles "both talk at once", and is all there is when there are no `spk` labels. **Fallback turn source:** if Deepgram returned no `spk` (single-channel or failed diarization), write v1's Resemblyzer per-word labels (`word_spk`) into `words[i]["spk"]` and use the same code. If there are neither, run visual-only (`analyze_clip` then makes the director stickier: min hold 3 s, switch cost ×2).

```python
def make_mouth_landmarker(model_path: str):
    """Same FaceLandmarker config speakercrop.py already uses (IMAGE mode, blendshapes)."""
    from mediapipe.tasks.python import BaseOptions, vision
    return vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path), running_mode=vision.RunningMode.IMAGE,
        num_faces=1, output_face_blendshapes=True, min_face_detection_confidence=0.2,
        min_face_presence_confidence=0.2))


def mouth_open(lm, frame: np.ndarray, cx: float, cy: float, fh: float) -> float:
    """speakercrop.py step-1 formula, lifted into a function: lip gap / face height + 0.3*jawOpen."""
    import cv2
    import mediapipe as mp
    s = fh * 1.8
    x0, y0 = int(max(0, cx - s / 2)), int(max(0, cy - s / 2))
    crop = np.ascontiguousarray(frame[y0:int(y0 + s), x0:int(x0 + s)])
    if crop.size == 0:
        return float("nan")
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
    if not res.face_landmarks:
        return float("nan")
    pts = res.face_landmarks[0]; ys = [p.y for p in pts]; sz = max(ys) - min(ys)
    jaw = next(b.score for b in res.face_blendshapes[0] if b.category_name == "jawOpen")
    return abs(pts[13].y - pts[14].y) / max(sz, 1e-6) + 0.3 * jaw


def mouth_activity(mouth: np.ndarray, sample_fps: float, win_s: float = 1.0) -> np.ndarray:
    """[P, n] mouth openness -> [P, n] activity = rolling std over win_s, normalised per person
    by that person's median (fixes the shared-median bias when one face is a profile)."""
    P, n = mouth.shape
    w = max(2, int(win_s * sample_fps))
    act = np.full((P, n), np.nan)
    for p in range(P):
        for j in range(n):
            seg = mouth[p, max(0, j - w // 2): j + w // 2 + 1]
            seg = seg[~np.isnan(seg)]
            if len(seg) >= 2:
                act[p, j] = np.std(seg)
        med = np.nanmedian(act[p]) if np.any(~np.isnan(act[p])) else 1.0
        act[p] /= med if med and med > 0 else 1.0
    return act


def speaker_turns(words: list[dict], T: np.ndarray, *, pad_s: float = 0.15, bridge_s: float = 0.6) -> np.ndarray:
    """Deepgram words [{w,s,e,spk}] -> per-sample speaker id (-1 = silence). Gaps shorter than
    bridge_s keep the previous speaker so breaths don't create turns."""
    out = np.full(len(T), -1, int)
    for wd in words:
        if wd.get("spk") is None:
            continue
        out[(T >= wd["s"] - pad_s) & (T <= wd["e"] + pad_s)] = int(wd["spk"])
    last, last_t = -1, -1e9
    for j, t in enumerate(T):
        if out[j] >= 0:
            last, last_t = out[j], t
        elif last >= 0 and t - last_t <= bridge_s:
            out[j] = last
    return out


def map_speakers_to_people(turns: np.ndarray, act: np.ndarray, visible: np.ndarray, *, min_gain: float = 0.05) -> dict[int, int]:
    """Hungarian on co-occurrence: gain[s, p] = mean(act_p | speaker s talks) - mean(act_p | others talk).
    Speakers with no positive gain (off-screen voice, host VO) stay unmapped."""
    from scipy.optimize import linear_sum_assignment
    spk = sorted(int(s) for s in set(turns.tolist()) if s >= 0)
    P = act.shape[0]
    if not spk or P == 0:
        return {}
    a = np.where(visible, np.nan_to_num(act, nan=1.0), np.nan)
    gain = np.zeros((len(spk), P))
    for i, s in enumerate(spk):
        on, off = turns == s, (turns >= 0) & (turns != s)
        for p in range(P):
            m_on, m_off = a[p, on], a[p, off]
            m_on, m_off = m_on[~np.isnan(m_on)], m_off[~np.isnan(m_off)]
            if len(m_on) >= 3 and len(m_off) >= 3:
                gain[i, p] = (m_on.mean() - m_off.mean()) / (a[p][~np.isnan(a[p])].std() + 1e-6)
    r, c = linear_sum_assignment(-gain)
    return {spk[i]: int(p) for i, p in zip(r, c) if gain[i, p] >= min_gain}


def speaker_posterior(turns: np.ndarray, spk2person: dict[int, int], act: np.ndarray, visible: np.ndarray,
                      *, w_audio: float = 2.5, w_vis: float = 1.0, vis_temp: float = 0.5, prior_none: float = 0.0,
                      w_silence: float = 1.0) -> np.ndarray:
    """Fusion -> [P+1, n] probabilities (last row = 'nobody on screen is talking').

    logit_p = w_audio * [turn maps to p] + w_vis * (act_p - 1) / vis_temp      (visible p only)
    logit_none = prior_none + w_audio * [unmapped voice] + w_silence * [silence]
    post = softmax over {people visible, none}."""
    P, n = act.shape
    L = np.full((P + 1, n), -np.inf)
    av = np.nan_to_num(act, nan=1.0)
    for p in range(P):
        L[p] = np.where(visible[p], w_vis * (av[p] - 1.0) / vis_temp, -np.inf)
    for s, p in spk2person.items():
        L[p] = np.where((turns == s) & visible[p], L[p] + w_audio, L[p])
    talking_mapped = np.isin(turns, list(spk2person.keys()))
    L[P] = prior_none + np.where(talking_mapped, 0.0, np.where(turns >= 0, w_audio, w_silence))
    L -= L.max(0, keepdims=True)
    E = np.exp(L)
    return E / E.sum(0, keepdims=True)
```

**Measured**
- `mouth_open` costs **7.2–8.5 ms per face-sample** (FaceLandmarker on the crop). That's 2 people × 5 samples/s × 60 s × 7.5 ms ≈ **4.5 s per source-minute**. It's the largest single analysis cost, the same as v1.
- On the first 20 s of `two_person_720p.mp4`, the per-second dominant speaker from the mouth score agrees with **Light-ASD** (a neural active-speaker model) on 15/19 seconds. The disagreements are at turn boundaries, where Deepgram turns decide anyway.

**Optional upgrade: Light-ASD** (MIT, CVPR 2023, 1 M params; needs torch CPU, ~200 MB wheel). It costs **3.8 ms per face-frame at 25 fps** on 4 vCPU, so 2 faces × 60 s ≈ 11 s per source-minute. It's CPU-viable, but not on the default path because the worker doesn't ship torch. If you enable it, replace `act` with its per-face score (`sigmoid`), keeping `w_vis`. The input crop must follow `Columbia_test.py` exactly (crop scale 0.40, `bsi = int(1.8·bs)`, resize 224 → centre 112 → gray, MFCC 13 at 100 fps, 4 audio frames per video frame). A wrong crop gave 87–99% "speaking" in testing.

```python
# torch==2.2.2+cpu: uv pip install --index-strategy unsafe-best-match "torch==2.2.2+cpu" --extra-index-url https://download.pytorch.org/whl/cpu
# weights: Light-ASD repo weight/finetuning_TalkSet.model ; load with map_location="cpu" and strip "module." prefixes
```

---

## 8. Stage 6: Viterbi layout director (EXISTS, UPGRADE)

**Existing.** `speakercrop.py` L116–135 thresholds a per-sample L/R/both decision with `HYST`, shifts it by `LEAD`, and merges runs shorter than `MIN_SEG` (0.8 s). The only states are LEFT / RIGHT / SPLIT. `SHOT_OVERRIDES` per shot index (focus auto / wide / both / A / B) are applied at render.

**Goal.** Choose, per 0.2 s sample, one layout state, globally optimal over the clip:
- `single(Pk)` for each visible person (9:16 crop following Pk);
- `split(Pa,Pb)` (2-up stack, when two people trade lines within ~3 s);
- `grid` (2x2, when ≥3 people are actively talking, e.g. panel crosstalk);
- `wide` (blur-fit of the whole frame; nobody visible is talking, an off-screen voice, or an empty frame).

**Why Viterbi.** Thresholds plus merging produce flicker at turn boundaries and can't trade "switch now" against "stay 1 s longer". A duration-constrained Viterbi minimises Σ emission cost + Σ switch cost subject to **min hold** and gives an exact optimum in O(n·S·D) time.

**Model**
- Emission (negative log likelihood from `post`):
  - `single(k)`: −log post_k (∞ if Pk not visible).
  - `split(a,b)`: split_bias − log(2·min(win_a, win_b)) − log(post_a + post_b), where `win` is post averaged over `both_win_s`=3 s.
  - `grid`: grid_bias − log(3·third-highest win).
  - `wide`: wide_bias·(1 − post_none) − log(post_none + 0.05), plus `wide_lone_penalty` when exactly one person is visible (a crop beats a letterbox).
- Transition: stay costs 0. Switching costs `switch_cost` (= 4·HYST) and is allowed only after the hold counter reaches D = min_hold·fps. **At a hard cut, switching is free from any hold count**, and every new state (also after a cut) must be held D samples.
- Lead: the posterior is shifted `lead_s` earlier **within each shot** (never across a cut), so the cut lands slightly before the speaker starts, as an editor would cut.
- Settings map: `director_cfg_from_env()` reads exactly what `render_clip.layout_env()` and the existing speakercrop knobs produce:
  - `FORCE_SPLIT=1` → force split (+50 cost on every non-split state; single still wins where only one person is visible).
  - `LAYOUT_MODE=fit` → always wide.
  - `LAYOUT_MODE=fill` → single crops only.
  - `SPLIT=0` → no split states.
  - `MIN_SEG` → min hold, floored at 1.5 s.
  - `LEAD` → lead.
  - `HYST` → switch cost.

  **This fixes P2.**

```python
@dataclass
class DirectorCfg:
    sample_fps: float = 5.0
    min_hold_s: float = 1.5        # MIN_SEG (raised from 0.8; bic wants 1.5-2 s)
    lead_s: float = 0.4            # LEAD / LEAD_WORDS: onset anticipation
    switch_cost: float = 2.0       # HYST * 4: hysteresis = cost of any cut
    split_bias: float = 1.2        # extra cost of 2-up vs single
    grid_bias: float = 1.8         # extra cost of grid vs single
    wide_bias: float = 0.9
    wide_lone_penalty: float = 1.5 # extra cost of wide when exactly one person is on screen
    both_win_s: float = 3.0        # window to call "both are talking" (BOTH_T analogue)
    allow_split: bool = True       # SPLIT
    allow_grid: bool = True
    force: str | None = None       # LAYOUT_MODE / FORCE_SPLIT: 'split' | 'fit' | 'fill' | None


def layout_states(P: int, cfg: DirectorCfg) -> list[tuple]:
    st: list[tuple] = [("single", k) for k in range(P)]
    if cfg.allow_split and P >= 2:
        st += [("split", a, b) for a in range(P) for b in range(a + 1, P)]
    if cfg.allow_grid and P >= 3:
        st.append(("grid",))
    st.append(("wide",))
    return st


def _roll_mean(x: np.ndarray, w: int) -> np.ndarray:
    if w <= 1: return x
    k = np.ones(w) / w
    return np.apply_along_axis(lambda r: np.convolve(np.pad(r, (w // 2, w - 1 - w // 2), mode="edge"), k, "valid"), -1, x)


def emission_costs(post: np.ndarray, visible: np.ndarray, states: list[tuple], cfg: DirectorCfg) -> np.ndarray:
    """[S, n] negative-log costs. post: [P+1, n] from speaker_posterior (already lead-shifted)."""
    P, n = visible.shape
    eps = 1e-3
    win = _roll_mean(post[:P], max(1, int(cfg.both_win_s * cfg.sample_fps)))     # who talks around j
    C = np.zeros((len(states), n))
    for i, s in enumerate(states):
        if s[0] == "single":
            k = s[1]
            C[i] = -np.log(post[k] + eps); C[i][~visible[k]] = np.inf
        elif s[0] == "split":
            a, b = s[1], s[2]
            both = np.minimum(win[a], win[b]) * 2.0                                   # 1.0 when 50/50
            C[i] = cfg.split_bias - np.log(np.clip(both, eps, 1.0)) - np.log(post[a] + post[b] + eps)
            C[i][~(visible[a] & visible[b])] = np.inf
        elif s[0] == "grid":
            third = np.sort(win, axis=0)[-3] * 3.0 if P >= 3 else np.zeros(n)
            C[i] = cfg.grid_bias - np.log(np.clip(third, eps, 1.0))
            C[i][visible.sum(0) < 3] = np.inf
        else:  # wide
            C[i] = cfg.wide_bias * (1 - post[P]) - np.log(post[P] + 0.05)
            C[i] += cfg.wide_lone_penalty * (visible.sum(0) == 1)   # one person on screen: a crop beats a letterbox
    return C


def viterbi_layout(post: np.ndarray, visible: np.ndarray, cfg: DirectorCfg, cuts: Iterable[int] = ()) -> tuple[list[tuple], np.ndarray]:
    """Duration-constrained Viterbi. State space = (layout s, hold counter d in 0..D).
    Leaving s is only allowed once d == D (min hold); every change costs switch_cost.
    At hard cuts (sample indices in `cuts`) the hold resets and switching is free.
    Returns (states, path[n] of state indices)."""
    P, n = visible.shape
    lead = int(round(cfg.lead_s * cfg.sample_fps))
    cuts = sorted(int(c) for c in cuts if 0 < c < n)
    if lead:                                   # onset anticipation, never across a hard cut
        bounds = [0, *cuts, n]; idx = np.arange(n)
        for a, b in zip(bounds[:-1], bounds[1:]):
            idx[a:b] = np.minimum(np.arange(a, b) + lead, b - 1)
        post = post[:, idx]
    states = layout_states(P, cfg)
    if cfg.force == "fit":
        return states, np.full(n, len(states) - 1)
    C = emission_costs(post, visible, states, cfg)
    if cfg.force == "split":
        C[[i for i, s in enumerate(states) if s[0] != "split"]] += 50.0
    S = len(states); D = max(1, int(round(cfg.min_hold_s * cfg.sample_fps)))
    cut = np.zeros(n, bool); cut[[c for c in cuts if 0 < c < n]] = True
    INF = 1e18
    acc = np.full((S, D + 1), INF); acc[:, 0] = np.where(np.isfinite(C[:, 0]), C[:, 0], INF)   # first shot must hold too
    bp_s = np.zeros((n, S, D + 1), np.int16); bp_d = np.zeros((n, S, D + 1), np.int16)
    for j in range(1, n):
        new = np.full((S, D + 1), INF)
        e = np.where(np.isfinite(C[:, j]), C[:, j], INF)
        # stay: d -> min(d+1, D)
        for d in range(D + 1):
            nd = min(d + 1, D)
            better = acc[:, d] < new[:, nd]
            new[better, nd] = acc[better, d]; bp_s[j, better, nd] = np.arange(S)[better]; bp_d[j, better, nd] = d
        # switch: from any (s', d') with d' == D (or any d at a hard cut)
        if cut[j]:
            src = acc.min(1); src_d = acc.argmin(1); sw = 0.0
        else:
            src = acc[:, D]; src_d = np.full(S, D); sw = cfg.switch_cost
        order = np.argsort(src)[:2]                     # best and runner-up source
        tgt_d = 0                                       # a new layout (also after a cut) must be held
        for s in range(S):
            b = int(order[0]) if order[0] != s or len(order) < 2 else int(order[1])
            if b == s: continue
            cand = src[b] + sw
            if cand < new[s, tgt_d]:
                new[s, tgt_d] = cand; bp_s[j, s, tgt_d] = b; bp_d[j, s, tgt_d] = src_d[b]
        new += e[:, None]
        acc = np.minimum(new, INF)
    s, d = np.unravel_index(np.argmin(acc), acc.shape)
    path = np.zeros(n, int)
    for j in range(n - 1, -1, -1):
        path[j] = s
        s, d = bp_s[j, s, d], bp_d[j, s, d]
    return states, path


def path_segments(states: list[tuple], path: np.ndarray, T: np.ndarray) -> list[dict]:
    segs = []; s0 = 0
    for j in range(1, len(path) + 1):
        if j == len(path) or path[j] != path[s0]:
            st = states[path[s0]]
            segs.append(dict(start_s=float(T[s0]), end_s=float(T[min(j, len(T) - 1)]) if j < len(T) else float(T[-1] + (T[1] - T[0] if len(T) > 1 else 0.2)),
                             layout=st[0], slots=[int(x) for x in st[1:]]))
            s0 = j
    return segs


def director_cfg_from_env(env: dict, sample_fps: float = 5.0) -> DirectorCfg:
    """Maps render_clip.layout_env() output (+ existing speakercrop knobs) onto DirectorCfg.
    FIX: speakercrop v1 never read LAYOUT_MODE / FORCE_SPLIT."""
    g = lambda k, d: float(env.get(k, d))
    mode = env.get("LAYOUT_MODE", "speaker_follow")
    cfg = DirectorCfg(sample_fps=sample_fps, min_hold_s=max(1.5, g("MIN_SEG", 1.5)), lead_s=g("LEAD", 0.4),
                      switch_cost=4 * g("HYST", 0.5), allow_split=bool(int(g("SPLIT", 1))),
                      allow_grid=bool(int(g("GRID", 1))))
    if int(g("FORCE_SPLIT", 0)):
        cfg.force = "split"
    elif mode == "fit":
        cfg.force = "fit"
    elif mode == "fill":                         # fill = always a full-bleed single crop, never split/grid/wide
        cfg.force = "fill"; cfg.allow_split = cfg.allow_grid = False
    return cfg
```

**Measured.** 3000 samples (a 10-minute source at 5 samples/s) take **153 ms** with P=2 (4 states) and **185 ms** with P=5 (17 states), about 0.05–0.06 ms/sample. Per 60 s clip, it's 18–36 ms.

**Behaviour verified by tests (§11):**
- follows long turns and ignores a 0.8 s blip;
- min hold is respected;
- lead moves the cut earlier;
- split when two people alternate quickly;
- grid for 4-way crosstalk;
- an invisible person is never chosen;
- force fit / split work;
- a hard cut allows an immediate switch;
- an off-screen voice goes to wide.

**End-to-end on real clips (visual-only, no Deepgram)**

| Clip | Segments | Notes |
|---|---|---|
| multicam_edit 60 s | 11 | Layout changes land on the editor's cuts (10/20/30/40/50 s); no segment shorter than the min hold except at cuts |
| four_up 60 s | 13 with sticky visual-only mode (25 before it) | |
| two_person 120 s | 27 | |

With Deepgram turns, expect fewer, turn-aligned switches. Commit a real Deepgram `words.json` for the fixture (§11) to lock that in.

**SHOT_OVERRIDES (EXISTS, KEEP the contract).** The editor's per-shot focus still works. `i` indexes `segments[]` exactly like v1 indexed `shots[]`. `A` → P1, `B` → P2, `both` → split of the two most visible people, and `wide`. New: `P1..P5`, and a `start_ms` key that survives re-analysis (prefer it in new UI code).

```python
def apply_shot_overrides(track: dict, overrides: list[dict]) -> dict:
    """Editor SHOT_OVERRIDES on a v2 track (in place). Same contract as speakercrop v1 (`i` = segment index,
    focus in auto|wide|both|A|B) plus v2 focus P1..P5 and an optional `start_ms` key that survives re-analysis.
    A->P1, B->P2, both->split of the two most-visible people in that segment."""
    fr = track["_frames"]; fps, W, cw = track["fps"], track["W"], track["cw"]
    by_ms = {int(s["start_ms"]): i for i, s in enumerate(track["segments"])}
    for o in overrides:
        i = by_ms.get(int(o["start_ms"])) if "start_ms" in o else int(o.get("i", -1))
        if i is None or not (0 <= i < len(track["segments"])): continue
        f = {"A": "P1", "B": "P2"}.get(o.get("focus", "auto"), o.get("focus", "auto"))
        sg = track["segments"][i]; a = int(round(sg["start_s"] * fps)); b = min(int(round(sg["end_s"] * fps)), len(track["x0"]))
        if f == "auto" or b <= a: continue
        vis = (~np.isnan(fr["fx"][:, a:b])).sum(1)
        if f == "wide":
            sg.update(layout="wide", slots=[]); track["x0"][a:b] = [-2] * (b - a)
        elif f == "both":
            sg.update(layout="split", slots=sorted(np.argsort(-vis)[:2].tolist(), key=lambda p: np.nanmedian(fr["fx"][p, a:b])))
            track["x0"][a:b] = [-1] * (b - a)
        elif f.startswith("P") and int(f[1:]) - 1 < fr["fx"].shape[0] and vis[int(f[1:]) - 1] > 0:
            p = int(f[1:]) - 1; tgt = fr["fx"][p, a:b].copy()
            tgt[np.isnan(tgt)] = np.nanmedian(tgt)
            cx = smooth_path(tgt, fps, frame_w=W)
            sg.update(layout="single", slots=[p]); track["x0"][a:b] = np.clip(cx - cw / 2, 0, W - cw).astype(int).tolist()
        sg["override"] = f
    return track
```

---

## 9. Stage 7: smoothing (EXISTS, UPGRADE: One-Euro + dead zone + pan cap)

**Existing.** `speakercrop._eased_x0` (L219–229) and the auto track (L231–241) do `c += EASE·(target − c)` per frame with EASE 0.2. `subject_reframe.build_crop_track` eases the same way. Nothing limits speed, so a 600 px target jump moves 120 px in the first frame (P5).

**Upgrade.** Replace the easing with `smooth_path`, keeping the same call sites:
- One-Euro filter (Casiez 2012), with min_cutoff 0.3 Hz and beta 0.02. It's smooth when the subject is still and responsive when they move.
- Dead zone of 6% of frame width (≈19% of a 9:16 crop width at 720p; bic §4.4 asks for 15–20% of crop). The target is re-aimed only when the face leaves the zone, which kills micro-jitter.
- **Pan cap of 0.15 frame-widths/s** (bic §4.4). That's at most 6.4 px/frame at 1280 px and 30 fps.
- `resets`: at layout or shot cuts, the camera jumps instead of panning.

```diff
- def _eased_x0(target_arr):
-     c = float(target_arr[0]); out = []
-     for fi in range(nframes):
-         tgt = float(np.interp(fi / fps, T, target_arr))
-         c += EASE * (tgt - c)
-         out.append(int(np.clip(c - cw / 2, 0, W - cw)))
-     return out
+ def _eased_x0(target_arr, resets=()):
+     tgt = np.interp(np.arange(nframes) / fps, T, target_arr)
+     cx = rc.smooth_path(tgt, fps, frame_w=W, resets=resets)
+     return np.clip(cx - cw / 2, 0, W - cw).astype(int).tolist()
```
Apply the same change in `subject_reframe.build_crop_track`. Also, `speakercrop_v2.render_crop_track` (§10.1) re-smooths any v1 track it's given, so motion tracks get the cap even before `build_crop_track` is changed.

```python
class OneEuro:
    """Casiez et al., CHI 2012.  x_hat = a*x + (1-a)*x_hat_prev,  a = 1/(1 + tau/Te),
    tau = 1/(2*pi*fc),  fc = min_cutoff + beta*|dx_hat|."""

    def __init__(self, freq: float, min_cutoff: float = 0.3, beta: float = 0.02, d_cutoff: float = 1.0):
        self.freq, self.mc, self.beta, self.dc = freq, min_cutoff, beta, d_cutoff
        self.x = None; self.dx = 0.0

    @staticmethod
    def _alpha(cutoff: float, freq: float) -> float:
        tau = 1.0 / (2 * math.pi * cutoff); te = 1.0 / freq
        return 1.0 / (1.0 + tau / te)

    def __call__(self, x: float) -> float:
        if self.x is None:
            self.x = x; return x
        dx = (x - self.x) * self.freq
        ad = self._alpha(self.dc, self.freq); self.dx = ad * dx + (1 - ad) * self.dx
        a = self._alpha(self.mc + self.beta * abs(self.dx), self.freq)
        self.x = a * x + (1 - a) * self.x
        return self.x


def smooth_path(target: np.ndarray, fps: float, *, frame_w: float, dead_zone: float = 0.06,
                max_speed: float = 0.15, min_cutoff: float = 0.3, beta: float = 0.02,
                resets: Iterable[int] = ()) -> np.ndarray:
    """Per-frame centre x.  dead_zone: fraction of frame_w the subject may drift before we re-aim.
    max_speed: frame-widths per second (bic: ~0.15).  `resets` = frame indices of layout/shot cuts,
    where the camera jumps instead of panning."""
    out = np.empty(len(target)); rs = set(int(r) for r in resets)
    f = OneEuro(fps, min_cutoff, beta); aim = c = float(target[0]); vmax = max_speed * frame_w / fps
    for i, x in enumerate(target):
        if i in rs:
            f = OneEuro(fps, min_cutoff, beta); aim = c = float(x)
        if abs(x - aim) > dead_zone * frame_w:
            aim = x - math.copysign(dead_zone * frame_w * 0.5, x - aim)    # re-aim, keep half the zone as slack
        y = f(aim)
        c += float(np.clip(y - c, -vmax, vmax))
        out[i] = c
    return out


def fill_gaps(a: np.ndarray, bounds: list[int], max_gap: int) -> None:
    """In place: inside each shot [bounds[k], bounds[k+1]), linearly bridge NaN runs <= max_gap samples
    between two observations of the same person, and hold the last box for <= max_gap at the shot end.
    Never bridges across a cut."""
    for row in a:
        for lo, hi in zip(bounds[:-1], bounds[1:]):
            seg = row[lo:hi]; ok = np.flatnonzero(~np.isnan(seg))
            if len(ok) == 0: continue
            for i0, i1 in zip(ok[:-1], ok[1:]):
                if 1 < i1 - i0 <= max_gap + 1:
                    seg[i0 + 1:i1] = np.interp(np.arange(i0 + 1, i1), [i0, i1], [seg[i0], seg[i1]])
            last = ok[-1]; seg[last + 1:last + 1 + max_gap] = seg[last]
            first = ok[0]; seg[max(0, first - max_gap):first] = seg[first]
```

`fill_gaps` (new) bridges detector dropouts of ≤2 s within a shot (head turns, motion blur), never across a cut. Without it, the director falls back to wide during a 1 s dropout (seen at 17.6–20 s and 26.4–30 s of multicam_edit before the fix).

**Measured.** `smooth_path` on 18,000 frames (10 min at 30 fps) takes **54 ms**, i.e. **3 µs/frame**. Tests assert that the max per-frame step is ≤ the cap and that the output is jitter-free on a noisy static target.

---

## 10. Stage 8: rendering (EXISTS, UPGRADE)

### 10.1 Decision: keep the OpenCV → ffmpeg pipe as the main renderer

Two approaches were benchmarked on identical inputs (720x1280 output, libx264 veryfast, 4 threads):

| Layout | cv pipe (compose part) | ffmpeg `filter_complex` per segment |
|---|---|---|
| single (with pan) | **5.92** (1.29) ms/frame | 3.66 ms/frame (static crop only; a pan needs `sendcmd` or per-frame expressions) |
| split | 5.83 (2.27) | 5.78 |
| grid | 5.50 (1.83) | 4.34 |
| pip | 6.59 (4.27) | 4.45 |
| wide (blur-fit) | 6.10 (3.75) | 3.62 |

The pipe handles per-frame pans, every layout, and caption burn-in (`-vf ass=...`) in **one encode**, at 5–6.6 ms/frame. That's 5–6x faster than real time on 30 fps. The ffmpeg graph is up to 40% faster on static layouts, but pans would need per-frame expressions, and it needs one encode per segment plus a concat and a final mux.

**So:**
- Use the pipe (`compose_frame`) for all v2 renders.
- Use the ffmpeg graph only where there's no per-frame motion: the **fallback blur-fit export** (§10.4) and an optional "locked-off" style (`render_segments_ffmpeg`, measured below).

**Presets** (split layout, ms/frame):

| Preset | cv pipe | ffmpeg | Bitrate |
|---|---|---|---|
| ultrafast | 4.05 | 2.19 | 5.97 Mb/s |
| superfast | 4.54 | 3.10 | 3.22 Mb/s |
| **veryfast (keep)** | **5.02** | **4.04** | **1.86 Mb/s** |
| faster | 8.02 | 6.44 | 2.09 Mb/s |
| medium | 13.50 | 10.57 | 2.20 Mb/s |

veryfast is the knee: it's 3x smaller than ultrafast for +1 ms/frame. Keep v1's `-preset veryfast -crf 20` and use `ultrafast` only as an emergency or overload setting.

### 10.2 Layout geometry (UPGRADE of `speakercrop.tile()`)

`tile()` (L297) hard-codes a 9:8 tile with two people. `tile_rect` generalises it to any tile aspect: the face sits at ~28% of tile height with 40% head room, clamped inside the frame (it zooms out rather than showing black). `layout_slots` gives the output rectangles:

| Layout | Slots |
|---|---|
| single | full frame |
| split | 2 stacked 9:8 |
| three | 3 stacked |
| grid | 2x2 |
| side | 2 side by side, for 16:9 or 1:1 outputs |
| pip | full + a 3:4 portrait inset bottom-right with a white border |
| wide | blur-fit |

```python
def tile_rect(cx: float, cy: float, fh: float, W: int, H: int, aspect: float, *, head_room: float = 0.40,
              face_frac: float = 0.28) -> tuple[int, int, int, int]:
    """Source crop (x, y, w, h) with the face at `face_frac` of the tile height, eyes ~head_room from top.
    aspect = tile w/h.  Clamped inside the frame (zooms out if the tile can't fit)."""
    th = min(H, max(fh / face_frac, 0.30 * H)); tw = th * aspect
    if tw > W: tw = W; th = tw / aspect
    x = int(np.clip(cx - tw / 2, 0, W - tw)); y = int(np.clip(cy - th * head_room, 0, H - th))
    return x, y, int(tw) // 2 * 2, int(th) // 2 * 2


def layout_slots(layout: str, out_w: int, out_h: int, n: int) -> list[tuple[int, int, int, int]]:
    """Output rectangles (x, y, w, h) for each slot."""
    if layout == "split":                     # 9:16 stack of two 9:8 tiles (existing look)
        h = out_h // 2; return [(0, 0, out_w, h), (0, h, out_w, out_h - h)]
    if layout == "three":
        h = out_h // 3; return [(0, i * h, out_w, h if i < 2 else out_h - 2 * h) for i in range(3)]
    if layout == "grid":                       # 2x2 (3 people -> 3 tiles + blank/wide)
        w, h = out_w // 2, out_h // 2
        return [(0, 0, w, h), (w, 0, out_w - w, h), (0, h, w, out_h - h), (w, h, out_w - w, out_h - h)][:max(n, 1)]
    if layout == "side":                       # side-by-side (16:9 / 1:1 exports)
        w = out_w // 2; return [(0, 0, w, out_h), (w, 0, out_w - w, out_h)]
    if layout == "pip":                        # main full-frame + webcam box bottom-right
        bw = out_w // 3 // 2 * 2; bh = int(bw * 4 / 3) // 2 * 2; m = out_w // 24 // 2 * 2
        return [(0, 0, out_w, out_h), (out_w - bw - m, out_h - bh - int(out_h * 0.22), bw, bh)]
    return [(0, 0, out_w, out_h)]


def blur_fit(fr: np.ndarray, out_w: int, out_h: int, *, blur_px: int = 51, interp=cv2.INTER_LINEAR) -> np.ndarray:
    """Whole frame scaled to out_w, centred over a blurred, zoomed copy (speakercrop.render_wide, faster:
    blur at 1/4 size and upscale, same look)."""
    H, W = fr.shape[:2]
    small = cv2.resize(fr, (out_w // 4, out_h // 4), interpolation=cv2.INTER_AREA)
    k = max(3, blur_px // 4 | 1)
    bg = cv2.resize(cv2.GaussianBlur(small, (k, k), 0), (out_w, out_h), interpolation=cv2.INTER_LINEAR)
    nh = min(out_h, int(round(H * out_w / W)) // 2 * 2)
    y0 = (out_h - nh) // 2
    bg[y0:y0 + nh] = cv2.resize(fr, (out_w, nh), interpolation=interp)
    return bg


def compose_frame(fr: np.ndarray, layout: str, crops: list[tuple[int, int, int, int]], out_w: int, out_h: int,
                  *, interp=cv2.INTER_LINEAR) -> np.ndarray:
    """One output frame. layout in single|split|three|grid|side|pip|wide; crops = source rect per slot
    (from tile_rect / the smoothed single-crop path). Generalises speakercrop.tile()+np.vstack."""
    if layout == "wide":
        return blur_fit(fr, out_w, out_h, interp=interp)
    if layout == "single":
        x, y, w, h = crops[0]
        return cv2.resize(fr[y:y + h, x:x + w], (out_w, out_h), interpolation=interp)
    out = np.zeros((out_h, out_w, 3), np.uint8)
    slots = layout_slots(layout, out_w, out_h, len(crops))
    if layout == "pip":                                    # slot 0 = main (blur-fit), slot 1 = cam box
        out[:] = blur_fit(fr, out_w, out_h, interp=interp); slots, crops = slots[1:], crops[1:]
    for (ox, oy, ow, oh), (x, y, w, h) in zip(slots, crops):
        out[oy:oy + oh, ox:ox + ow] = cv2.resize(fr[y:y + h, x:x + w], (ow, oh), interpolation=interp)
    if layout == "pip":
        (ox, oy, ow, oh) = slots[0]
        cv2.rectangle(out, (ox - 2, oy - 2), (ox + ow + 1, oy + oh + 1), (255, 255, 255), 4)
    return out


def frame_crops(track: dict, i: int) -> tuple[str, list[tuple[int, int, int, int]]]:
    """(layout, source crops) for output frame i, from analyze_clip()'s result. Used by the render loop."""
    W, H, ow, oh = track["W"], track["H"], track["out_w"], track["out_h"]
    fr = track["_frames"]; sg = track["segments"][min(fr["seg_of"][min(i, len(fr["seg_of"]) - 1)], len(track["segments"]) - 1)]
    i = min(i, fr["fx"].shape[1] - 1); lay = sg["layout"]
    def face(p):                               # NaN (person briefly lost) -> that person's clip median box
        v = [fr[k][p, i] for k in ("fx", "fy", "fh")]
        return tuple(float(np.nanmedian(fr[k][p])) if np.isnan(x) else float(x) for k, x in zip(("fx", "fy", "fh"), v))
    if lay == "single":
        x0 = track["x0"][i]; return "single", [(x0, 0, track["cw"], H)]
    if lay == "split":
        return "split", [tile_rect(*face(p), W, H, ow / (oh / 2)) for p in sg["slots"]]
    if lay == "grid":
        vis = [p for p in range(fr["fx"].shape[0]) if not np.isnan(fr["fx"][p, i])]
        vis = sorted(vis, key=lambda p: -track["people"][p]["screen_s"])[:4]
        vis = sorted(vis, key=lambda p: fr["fx"][p, i])
        return "grid", [tile_rect(*face(p), W, H, (ow / 2) / (oh / 2)) for p in vis]
    return "wide", []
```

v1 `render_wide()` (L302) is already a blur-fit. `blur_fit` keeps its look but blurs at quarter size, which is 2.5x cheaper than a 51 px Gaussian at full size.

### 10.3 Orchestrator: `analyze_clip` (stages 1–7 → crop_track v2)

```python
def analyze_clip(video_path: str, words: list[dict] | None, cfg: DirectorCfg, *, models_dir: str,
                 out_w: int = 720, out_h: int = 1280, max_people: int = 5) -> dict:
    """Stages 1-7 end to end. Returns crop_track v2 (a superset of v1, see guide section 'crop_track v2')."""
    import time
    t0 = time.perf_counter()
    shots = detect_shots(video_path)
    tf = track_faces(video_path, {"models_dir": models_dir, "shots": shots, "max_people": max_people,
                                  "mouth_model": os.path.join(models_dir, "face_landmarker.task")})
    T = np.array(tf["t"]); sf = tf["sample_fps"]; W, H, fps = tf["W"], tf["H"], tf["fps"]
    P = len(tf["people"])
    if P == 0:                                     # no faces at all -> caller keeps subject-follow / fit
        return {"v": 2, "people": [], "segments": [], "_timings": {"total": time.perf_counter() - t0}}
    xs = np.array([p["x"] for p in tf["people"]]); ys = np.array([p["y"] for p in tf["people"]])
    hs = np.array([p["h"] for p in tf["people"]]); visible = ~np.isnan(xs)
    cut_idx = [0, *[int(np.searchsorted(T, s)) for s, _ in shots[1:]], len(T)]
    for arr in (xs, ys, hs):                                   # bridge detector dropouts (head turns, blur)
        fill_gaps(arr, cut_idx, max_gap=int(2.0 * sf))
    visible = ~np.isnan(xs)
    med_h = np.array([np.nanmedian(h) if np.any(~np.isnan(h)) else 0 for h in hs])
    minor = (med_h < 0.4 * med_h.max()) | (visible.sum(1) < 2 * sf)      # background faces / <2 s on screen
    visible = visible & ~minor[:, None]                                    # tracked + stored, never directed to
    act = mouth_activity(np.array(tf["mouth"]), sf)
    turns = speaker_turns(words or [], T) if words and any("spk" in w for w in words) else np.full(len(T), -1)
    spk2p = map_speakers_to_people(turns, act, visible)
    post = speaker_posterior(turns, spk2p, act, visible,
                             w_silence=0.0 if not spk2p else 1.0)   # no diarization: visual-only, no wide bias
    cuts = [int(np.searchsorted(T, s)) for s, _ in shots[1:]]
    if not spk2p:                         # visual-only evidence is noisier: be stickier (measured: 25 -> see guide)
        cfg = DirectorCfg(**{**cfg.__dict__, "min_hold_s": max(cfg.min_hold_s, 3.0),
                             "switch_cost": cfg.switch_cost * 2})
    t1 = time.perf_counter()
    if cfg.force == "fill":
        cfg = DirectorCfg(**{**cfg.__dict__, "force": None})
        st, path = viterbi_layout(post, visible, cfg, cuts)
        path = np.array([i if st[i][0] == "single" else next(k for k, s in enumerate(st) if s == ("single", 0)) for i in path])
    else:
        st, path = viterbi_layout(post, visible, cfg, cuts)
    segs = path_segments(st, path, T)
    t2 = time.perf_counter()
    # per-frame boxes: interpolate each person's samples, smooth only the single-crop centre
    nfr = int(round(T[-1] * fps)) + int(round(fps / sf)); ft = np.arange(nfr) / fps
    fill = lambda a: np.interp(ft, T[~np.isnan(a)], a[~np.isnan(a)]) if np.any(~np.isnan(a)) else np.full(nfr, np.nan)
    fx = np.array([fill(x) for x in xs]); fy = np.array([fill(y) for y in ys]); fh = np.array([fill(h) for h in hs])
    seg_of = np.searchsorted([s["start_s"] for s in segs], ft, side="right") - 1
    cw = int(round(H * out_w / out_h)) // 2 * 2
    tgt = np.full(nfr, W / 2.0)
    for i in range(nfr):
        sg = segs[seg_of[i]]
        if sg["layout"] == "single" and not np.isnan(fx[sg["slots"][0], i]):
            tgt[i] = fx[sg["slots"][0], i]
    resets = [i for i in range(1, nfr) if seg_of[i] != seg_of[i - 1]]
    cx = smooth_path(tgt, fps, frame_w=W, resets=resets)
    x0 = np.clip(cx - cw / 2, 0, W - cw).astype(int)
    t3 = time.perf_counter()
    return {"v": 2, "W": W, "H": H, "cw": cw, "fps": fps, "out_w": out_w, "out_h": out_h,
            "x0": [int(v) if segs[seg_of[i]]["layout"] == "single" else (-1 if segs[seg_of[i]]["layout"] != "wide" else -2)
                   for i, v in enumerate(x0)],
            "people": [{"id": p["id"], "screen_s": float(np.sum(~np.isnan(p["x"])) / sf)} for p in tf["people"]],
            "segments": [{**s, "start_ms": int(round(s["start_s"] * 1000)), "end_ms": int(round(s["end_s"] * 1000))} for s in segs],
            "spk2person": {int(k): f"P{v + 1}" for k, v in spk2p.items()},
            "_frames": {"fx": fx, "fy": fy, "fh": fh, "seg_of": seg_of},
            "_timings": {**tf["_timings"], "shots_tracking_s": t1 - t0, "director_s": t2 - t1, "smooth_s": t3 - t2}}
```

### 10.4 `ffmpeg_fit_export`: blur instead of black bars (fixes P3)

```diff
 def ffmpeg_fit_export(clip_src: Path, out_mp4: Path, width: int, height: int) -> None:
     """Fallback when speakercrop fails (short clips, missing faces, etc.)."""
-    vf = (
-        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
-        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1"
-    )
+    from clips_worker.reframe_core import blur_fit_filter
+    vf = blur_fit_filter(width, height, src="[0:v]", dst="[v]")
     threads = str(ffmpeg_threads_per_job())
     subprocess.check_call(
         [
             "ffmpeg", "-y", "-threads", threads, "-v", "error",
             "-i", str(clip_src),
-            "-vf", vf,
+            "-filter_complex", vf, "-map", "[v]", "-map", "0:a?",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
             "-c:a", "aac", "-movflags", "+faststart", str(out_mp4),
         ],
```

```python
def blur_fit_filter(out_w: int, out_h: int, src: str = "[0:v]", dst: str = "[v]", blur: int = 20) -> str:
    """ffmpeg blurred-background fit (replaces the black-bar pad in render_clip.ffmpeg_fit_export)."""
    return (f"{src}split=2[bg][fg];"
            f"[bg]scale={out_w // 4}:{out_h // 4}:force_original_aspect_ratio=increase,"
            f"crop={out_w // 4}:{out_h // 4},boxblur={max(2, blur // 4)}:2,scale={out_w}:{out_h},setsar=1[bgb];"
            f"[fg]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,setsar=1[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2{dst}")
```

**Measured.** The blur-fit export runs at **5.12 ms/frame** (black pad: ~3 ms/frame). The difference is 4 s on a 60 s clip.

### 10.5 Optional: per-segment `filter_complex` + concat (static layouts)

Use this for a "locked-off" style or for a server-side re-render of editor segments without any per-frame motion. Each segment is encoded with `-ss` (before `-i`, for fast seek) and `-frames:v`, and the graph ends with `fps=…,format=yuv420p`. Every branch gets `setsar=1` (otherwise `vstack`/`xstack` and concat fail with an SAR mismatch). The segments are concatenated with the concat demuxer (`-c copy`), and a final pass muxes the source audio and optionally burns the ASS captions.

```python
def segment_filter(layout: str, crops: list[tuple[int, int, int, int]], out_w: int, out_h: int) -> str:
    """filter_complex for ONE segment whose crops are static (locked-off). Input = [0:v]. Output = [v]."""
    if layout == "wide":
        return blur_fit_filter(out_w, out_h, "[0:v]", "[v]")
    if layout == "single":
        x, y, w, h = crops[0]
        return f"[0:v]crop={w}:{h}:{x}:{y},scale={out_w}:{out_h},setsar=1[v]"
    slots = layout_slots(layout, out_w, out_h, len(crops))
    n = len(crops)
    parts = [f"[0:v]split={n}" + "".join(f"[s{i}]" for i in range(n))]
    for i, ((ox, oy, ow, oh), (x, y, w, h)) in enumerate(zip(slots, crops)):
        parts.append(f"[s{i}]crop={w}:{h}:{x}:{y},scale={ow}:{oh},setsar=1[t{i}]")
    tiles = "".join(f"[t{i}]" for i in range(n))
    if layout in ("split", "three"):
        parts.append(f"{tiles}vstack=inputs={n}[v]")
    elif layout == "side":
        parts.append(f"{tiles}hstack=inputs={n}[v]")
    elif layout == "grid":
        lay = "|".join(f"{ox}_{oy}" for ox, oy, _, _ in slots)
        parts.append(f"{tiles}xstack=inputs={n}:layout={lay}:fill=black[v]")
    else:
        raise ValueError(layout)
    return ";".join(parts)


def render_segments_ffmpeg(src: str, segments: list[dict], out_mp4: str, out_w: int, out_h: int, work_dir: str,
                           *, preset: str = "veryfast", crf: int = 20, threads: int = 4, ass_path: str | None = None) -> str:
    """Locked-off renderer: one ffmpeg graph per segment (static crops) -> concat (stream copy) -> one final
    pass that muxes source audio and burns captions (the ASS timeline stays in source time).
    segments: [{start_s, end_s, layout, crops:[(x,y,w,h)...]}]"""
    import subprocess
    from pathlib import Path
    wd = Path(work_dir); wd.mkdir(parents=True, exist_ok=True)
    fps = cv2.VideoCapture(src).get(cv2.CAP_PROP_FPS) or 30.0
    parts = []
    for i, s in enumerate(segments):
        p = wd / f"seg_{i:04d}.mp4"
        # frame-exact segment: -ss before -i (fast seek) + -frames:v, constant fps, same SAR/size for concat
        nfr = max(1, int(round((s["end_s"] - s["start_s"]) * fps)))
        fc = segment_filter(s["layout"], s.get("crops", []), out_w, out_h).removesuffix("[v]") \
            + f"[o];[o]fps={fps},format=yuv420p[v]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-threads", str(threads), "-ss", f"{s['start_s']:.3f}", "-i", src,
                        "-filter_complex", fc, "-map", "[v]", "-frames:v", str(nfr), "-an", "-c:v", "libx264", "-preset", preset,
                        "-crf", str(crf), "-g", str(int(fps * 2)), str(p)], check=True)
        parts.append(p)
    lst = wd / "concat.txt"; lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    joined = wd / "joined.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)], check=True)
    t0 = segments[0]["start_s"]; dur = segments[-1]["end_s"] - t0
    vf = ["-vf", f"ass={ass_path}"] if ass_path else []
    vcodec = ["-c:v", "libx264", "-preset", preset, "-crf", str(crf)] if ass_path else ["-c:v", "copy"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(joined), "-ss", f"{t0:.3f}", "-t", f"{dur:.3f}", "-i", src,
                    "-map", "0:v", "-map", "1:a?", *vf, *vcodec, "-c:a", "aac", "-shortest", "-movflags", "+faststart", out_mp4], check=True)
    return out_mp4
```

**Measured.** 4 segments (single / split / grid / pip), 12 s, took **2.84 s wall (7.89 ms/frame)** including the concat and audio mux. The output had 359 frames at SAR 1:1 with audio.

### 10.6 Facecam detection for streamer VODs (EXISTS, UPGRADE: fixes P6)

**Existing** `detect_facecam_layout(video, work)`:
- reads the first 60 frames, takes every 3rd;
- uses the median YuNet face × 2.2/2.6 as the box;
- confidence = count/12.

**Upgrade** (bic §4.5), same signature and return shape plus `method` and `persist` keys:
1. **Sample 60 frames spread across 2–98% of the video** (seeks), not the first 2 s, so a cam that appears later is found.
2. At 640 px analysis width, compute Canny(60,160) edges per sample. The **persistent-edge map** is the fraction of samples where a pixel is an edge (≥0.6 → overlay border).
3. **Recurring face.** Cluster YuNet faces (8% of width). It must be present in ≥50% of samples, or the result is `gameplay` (no cam).
4. **Rectangle.** Find the best axis-aligned rectangle around the face whose four sides are supported by persistent edges, using prefix sums. A side lying on the frame edge counts as 0.8 support; sides are ≥0.3 face size from the face; area 3–35% of the frame; aspect 0.8–2.4.
5. Confidence = 0.5·side support + 0.5·min(1, persistence/0.5). With no rectangle (a borderless or chroma-keyed cam), fall back to v1's median-face box with confidence ≤0.5.
6. **Caller rule (bic §4.5):** below 0.6 → ask Gemini for the box, then fall back to gameplay-only. That's existing streamer code and stays unchanged.

```python
"""Auto-detect facecam overlay box (S7). Upgraded: samples across the whole VOD and finds the persistent
overlay rectangle (edge persistence + 4-side support), validated by recurring YuNet faces inside it.
Falls back to the original median-face x 2.2/2.6 box when no rectangle is supported."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import cv2
import numpy as np

AW = 640                    # analysis width (all geometry below is in this scale)


def _probe_wh(video: Path) -> tuple[int, int]:          # unchanged
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height", "-of", "json", str(video)], text=True)
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def _sample_frames(video: Path, n: int = 24):
    """n frames spread over 2%..98% of the duration (seek, not decode-all)."""
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    nf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or int(fps * 60)
    out = []
    for fi in np.linspace(0.02 * nf, 0.98 * nf, n).astype(int):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
        ok, fr = cap.read()
        if ok:
            out.append(fr)
    cap.release()
    return out


def _line_candidates(P: np.ndarray, axis: int, lo: int, hi: int, k: int = 10) -> list[int]:
    """Top-k columns (axis=0) or rows (axis=1) by persistent-edge support inside the band [lo, hi)."""
    band = P[lo:hi, :] if axis == 0 else P[:, lo:hi].T
    s = band.mean(axis=0)
    idx = [int(i) for i in np.argsort(-s)[: 4 * k] if s[i] > 0.25]
    keep: list[int] = []
    for i in idx:                                         # non-max suppression: 3 px
        if all(abs(i - j) > 3 for j in keep):
            keep.append(i)
    return keep[:k]


def find_overlay_rect(P: np.ndarray, face: tuple[float, float, float, float], min_support: float = 0.7):
    """Best rectangle (l, t, r, b) enclosing `face` (cx, cy, w, h) whose 4 sides lie on persistent edges
    (or on the frame border). P: dilated persistent-edge mask in [0,1], shape (h, w)."""
    h, w = P.shape
    cx, cy, fw, fh = face
    cs_v = np.vstack([np.zeros((1, w)), np.cumsum(P, axis=0)])   # vertical prefix sums per column
    cs_h = np.hstack([np.zeros((h, 1)), np.cumsum(P, axis=1)])   # horizontal prefix sums per row
    EDGE = 0.8                                            # a side flush with the frame border counts as 0.8
    vsup = lambda x, y0, y1: EDGE if x in (0, w - 1) else (cs_v[y1, x] - cs_v[y0, x]) / max(1, y1 - y0)
    hsup = lambda y, x0, x1: EDGE if y in (0, h - 1) else (cs_h[y, x1] - cs_h[y, x0]) / max(1, x1 - x0)
    y_band = (int(max(0, cy - fh)), int(min(h, cy + fh)))
    x_band = (int(max(0, cx - fw)), int(min(w, cx + fw)))
    cols = _line_candidates(P, 0, *y_band) + [0, w - 1]
    rows = _line_candidates(P, 1, *x_band) + [0, h - 1]
    L = [x for x in cols if x < cx - 0.3 * fw]; R = [x for x in cols if x > cx + 0.3 * fw]   # face may touch
    T = [y for y in rows if y < cy - 0.3 * fh]; B = [y for y in rows if y > cy + 0.3 * fh]   # the cam border
    best, best_s = None, 0.0
    for l in L:
        for r in R:
            for t in T:
                for b in B:
                    rw, rh = r - l, b - t
                    area = rw * rh / (w * h)
                    if not (0.03 <= area <= 0.35 and 0.8 <= rw / max(rh, 1) <= 2.4):
                        continue
                    if (l, t, r, b) == (0, 0, w - 1, h - 1):
                        continue
                    sides = [vsup(l, t, b), vsup(r, t, b), hsup(t, l, r), hsup(b, l, r)]
                    if min(sides) < min_support:
                        continue
                    s = float(np.mean(sides)) + 0.05 * area      # tie-break toward the outer (overlay) border
                    if s > best_s:
                        best, best_s = (l, t, r, b), s
    return best, best_s


def detect_facecam_layout(video: Path, work: Path, n_samples: int = 60) -> dict[str, Any]:
    """Return layout dict: layout stack|gameplay, facecam box normalised, confidence. (contract unchanged,
    plus `method`: rect|face_box and `persist`: fraction of samples with a face in the box)."""
    w, h = _probe_wh(video)
    v3 = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3"))
    yunet_path = v3 / "yunet.onnx"
    gameplay = {"layout": "gameplay", "confidence": 0.0, "source": "auto", "facecam": None}
    if not yunet_path.exists():
        return gameplay
    frames = _sample_frames(video, n_samples)                       # CHANGED: whole VOD, not first 60 frames
    if not frames:
        return gameplay
    ah = int(round(h * AW / w))
    det = cv2.FaceDetectorYN_create(str(yunet_path), "", (AW, ah), 0.6, 0.3, 50)
    E = np.zeros((ah, AW), np.float32); faces = []
    for si, fr in enumerate(frames):
        sm = cv2.resize(fr, (AW, ah), interpolation=cv2.INTER_AREA)
        E += cv2.Canny(cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY), 60, 160) > 0
        _, f = det.detect(sm)
        for r in ([] if f is None else f):
            faces.append((si, r[0] + r[2] / 2, r[1] + r[3] / 2, r[2], r[3]))
    if len(faces) < 3:
        return {**gameplay, "confidence": 0.2}
    P = cv2.dilate(((E / len(frames)) >= 0.6).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
    # recurring face: the median of the biggest cluster of face centres (within 8% of frame width)
    F = np.array(faces); best_c, best_n = None, 0
    for _, x, y, _, _ in F:
        m = np.hypot(F[:, 1] - x, F[:, 2] - y) < 0.08 * AW
        n_s = len(set(F[m, 0].astype(int)))
        if n_s > best_n:
            best_n, best_c = n_s, m
    C = F[best_c]
    face = tuple(float(np.median(C[:, i])) for i in (1, 2, 3, 4))
    persist = best_n / len(frames)
    rect, support = find_overlay_rect(P, face)
    if rect is not None:
        l, t, r, b = rect; method = "rect"
        confidence = float(min(1.0, 0.5 * support + 0.5 * min(1.0, persist / 0.5)))
        box = {"x": l / AW, "y": t / ah, "w": (r - l) / AW, "h": (b - t) / ah}
    else:                                                            # legacy heuristic, kept as fallback
        cx, cy, fw, fh = face; fw *= 2.2; fh *= 2.6; method = "face_box"
        box = {"x": max(0.0, (cx - fw / 2) / AW), "y": max(0.0, (cy - fh / 2) / ah),
               "w": min(0.45, fw / AW), "h": min(0.45, fh / ah)}
        confidence = float(min(0.5, persist))       # < 0.6: caller asks Gemini (bic 4.5 step 5) / user
    if persist < 0.5:                     # bic 4.5: the cam face must be present in >= 50% of samples
        return {**gameplay, "confidence": round(1 - persist, 2)}
    return {"layout": "stack", "facecam": {k: round(v, 4) for k, v in box.items()}, "gameplay": None,
            "split": 0.4, "facecamPosition": "top", "confidence": round(confidence, 3), "source": "auto",
            "method": method, "persist": round(persist, 3)}
```

**Measured** (60 samples):

| Clip | Time | Result | Confidence | IoU vs truth | v1 result |
|---|---|---|---|---|---|
| streamer_cam (bordered 320x240 cam at 24,24) | 6.5 s | rect | 1.0 | **0.97** | box (137,55,168,277), conf 1.0, but the box cuts through the overlay |
| streamer_cam_late_noborder (borderless 384x288 cam, appears at t=4 s) | 4.3 s | rect | 0.94 | **0.965** | **missed** (gameplay, 0.2) |
| two_person (no cam, an interview) | 7.5 s | face_box | 0.5 | — | — |
| four_up (a 2x2 composite) | 8.1 s | rect (the padded tile) | 0.944 | — | — |

On two_person, 0.5 is below the 0.6 threshold, so it correctly goes to the Gemini/gameplay path. four_up's result is a legitimate overlay-like tile. The cost is about 7 s per VOD, run once.

---

## 11. Stage 9: wiring (EXISTS, UPGRADE)

### 11.1 `speakercrop.py`: 3-line dispatch, v1 body untouched

```diff
 import sys, os, json, time, subprocess
+if os.environ.get("REFRAME_V") == "2" or os.environ.get("CROP_TRACK_IN"):
+    import speakercrop_v2; speakercrop_v2.cli(sys.argv[1], sys.argv[2]); sys.exit(0)
 import numpy as np, cv2, mediapipe as mp
```

### 11.2 `speakercrop_v2.py` (NEW, next to speakercrop.py)

This reads the same env as v1, **plus** `LAYOUT_MODE` / `FORCE_SPLIT` (P2) and `CROP_TRACK_IN` (P4). It writes crop_track v2 to `CROP_TRACK_OUT` and renders with the pipe. It exits 3 when there are no faces, so `run_speakercrop`'s existing failure path (blur `ffmpeg_fit_export` + `render_meta["fit_fallback"]`) takes over.

```python
"""REFRAME_V=2 entry for worker/prototype/v3/speakercrop.py (same argv/env contract as v1).

    python speakercrop.py input.mp4 out_vertical.mp4       # v1 (default)
    REFRAME_V=2 python speakercrop.py input.mp4 out.mp4    # -> speakercrop_v2.main()

Env read (all already produced by render_clip.run_speakercrop / layout_env):
  OUT_W OUT_H WORDS CAPTIONS CLIP_START_MS CROP_TRACK_OUT SHOT_OVERRIDES NORENDER FFMPEG_THREADS
  LAYOUT_MODE FORCE_SPLIT SPLIT MIN_SEG LEAD HYST          <- v1 ignored LAYOUT_MODE/FORCE_SPLIT; v2 honours them
  MODELS_DIR (default: next to this script, like v1)       GRID (0 disables 2x2)
"""
from __future__ import annotations
import json, os, subprocess, sys, time
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("CLIPS_WORKER_ROOT", os.path.join(HERE, "..")))   # dir that contains clips_worker/
from clips_worker import reframe_core as rc

LABEL = {0: "A", 1: "B"}                                # v1 shot labels kept for P1/P2 (TS CropTrack compat)


def to_v1_compatible(track: dict, t0_ms: int) -> dict:
    """crop_track v2 = v1 fields (v, W, H, cw, fps, t0_ms, x0, shots[]) + people[] + segments[] + spk2person."""
    shots = []
    for s in track["segments"]:
        lab = {"single": LABEL.get(s["slots"][0], f"P{s['slots'][0] + 1}") if s["slots"] else "wide",
               "split": "split", "three": "three", "grid": "grid", "wide": "wide"}[s["layout"]]
        shots.append({"start_ms": s["start_ms"] + t0_ms, "end_ms": s["end_ms"] + t0_ms, "spk": lab})
    keep = {k: v for k, v in track.items() if not k.startswith("_")}
    return {**keep, "v": 2, "t0_ms": t0_ms, "shots": shots,
            "segments": [{**s, "start_ms": s["start_ms"] + t0_ms, "end_ms": s["end_ms"] + t0_ms,
                          "slots": [f"P{p + 1}" for p in s["slots"]]} for s in track["segments"]],
            "timings": {k: round(float(v), 3) for k, v in track.get("_timings", {}).items() if isinstance(v, (int, float))}}


def main(inp: str, out: str, env: dict | None = None) -> dict:
    env = dict(os.environ if env is None else env)
    t0 = time.perf_counter()
    ow, oh = int(env.get("OUT_W", 720)), int(env.get("OUT_H", 1280))
    t0_ms = int(env.get("CLIP_START_MS", 0))
    words = json.load(open(env["WORDS"])) if env.get("WORDS") and os.path.exists(env["WORDS"]) else None
    cfg = rc.director_cfg_from_env(env)
    track = rc.analyze_clip(inp, words, cfg, models_dir=env.get("MODELS_DIR", HERE), out_w=ow, out_h=oh)
    if not track["segments"]:
        raise SystemExit(3)                              # no faces: caller falls back (blur fit / subject follow)
    rc.apply_shot_overrides(track, json.loads(env.get("SHOT_OVERRIDES", "[]")))
    ct = to_v1_compatible(track, t0_ms)
    crop_out = env.get("CROP_TRACK_OUT", os.path.splitext(out)[0] + ".crop_track.json")
    json.dump(ct, open(crop_out, "w"), separators=(",", ":"))
    if int(env.get("NORENDER", 0)):
        return ct
    vf = []
    if int(env.get("CAPTIONS", 1)) and words:
        try:                                             # same captions module + split_times hook as v1
            import captions
            for wd in words:
                wd.setdefault("spk", 0)
            base = os.path.splitext(out)[0]
            seg_at = lambda t: next((s for s in track["segments"] if s["start_s"] <= t < s["end_s"]), track["segments"][-1])
            info = captions.build(words, inp, base + ".ass", base + ".srt",
                                  split_times=lambda t: seg_at(t)["layout"] in ("split", "three", "grid"))
            json.dump(info.pop("words_fixed"), open(base + ".words.json", "w"), indent=0)
            vf = ["-vf", f"ass={base}.ass:fontsdir={os.path.join(HERE, 'fonts')}".replace(",", r"\,")]
        except ImportError:
            pass
    cap = cv2.VideoCapture(inp); fps = cap.get(cv2.CAP_PROP_FPS)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{oh}",
                           "-r", str(fps), "-i", "-", "-i", inp, "-map", "0:v", "-map", "1:a?", *vf,
                           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                           "-threads", env.get("FFMPEG_THREADS", "4"), "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-shortest", out], stdin=subprocess.PIPE)
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        lay, crops = rc.frame_crops(track, i)
        ff.stdin.write(rc.compose_frame(fr, lay, crops, ow, oh).tobytes()); i += 1
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit(4)
    ct["timings"]["total_s"] = round(time.perf_counter() - t0, 2)
    json.dump(ct, open(crop_out, "w"), separators=(",", ":"))
    print(f"speakercrop v2: {i / fps:.1f}s video, {ct['timings']['total_s']}s wall, "
          f"{len(ct['segments'])} segments, people={[p['id'] for p in ct['people']]}")
    return ct


def render_crop_track(inp: str, out: str, track: dict, env: dict | None = None) -> dict:
    """CROP_TRACK_IN mode: render a track someone else wrote (subject_reframe.write_motion_crop_track,
    pipeline.write_fit_blur_crop_track, or an editor-saved track) instead of re-analysing.
    Fixes the overwrite bug: reframe_clip_preview passes its motion/fit track in here, nothing is recomputed.
    v1 semantics: x0 >= 0 -> crop [x0, x0+cw); x0 < 0 -> wide blur-fit (a v1 fit track uses -1 for 'wide',
    so -1 is only treated as split when the shot label says 'split'). The pan cap is applied here too."""
    env = dict(os.environ if env is None else env)
    ow, oh = int(env.get("OUT_W", 720)), int(env.get("OUT_H", 1280))
    cap = cv2.VideoCapture(inp); fps = cap.get(cv2.CAP_PROP_FPS); W = int(cap.get(3)); H = int(cap.get(4))
    cw = int(track.get("cw", W)); x0 = np.array(track["x0"], float); t0 = int(track.get("t0_ms", 0))
    lab = np.array(["wide"] * len(x0), dtype=object)
    for sh in track.get("shots", []):
        a = max(0, int((sh["start_ms"] - t0) / 1000 * fps)); b = int((sh["end_ms"] - t0) / 1000 * fps)
        lab[a:b] = sh.get("spk", "wide")
    single = (x0 >= 0) & (cw < W)
    if single.any():                                              # One-Euro + 0.15 W/s cap on the given track
        cx = np.where(single, x0 + cw / 2, np.nan)
        cx = np.interp(np.arange(len(cx)), np.flatnonzero(single), cx[single])
        resets = np.flatnonzero(np.diff(single.astype(int)) != 0) + 1
        x0 = np.where(single, np.clip(rc.smooth_path(cx, fps, frame_w=W, resets=resets) - cw / 2, 0, W - cw), x0)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{oh}",
                           "-r", str(fps), "-i", "-", "-i", inp, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
                           "-preset", "veryfast", "-crf", "20", "-threads", env.get("FFMPEG_THREADS", "4"),
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out], stdin=subprocess.PIPE)
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        k = min(i, len(x0) - 1)
        if x0[k] >= 0 and cw < W:
            o = rc.compose_frame(fr, "single", [(int(x0[k]), 0, cw, H)], ow, oh)
        else:
            o = rc.compose_frame(fr, "wide", [], ow, oh)
        ff.stdin.write(o.tobytes()); i += 1
    ff.stdin.close(); ff.wait()
    return {"frames": i, "cropMethod": track.get("method", "track_in")}


def cli(inp: str, out: str) -> None:
    """Called by the 3-line dispatch at the top of speakercrop.py."""
    if os.environ.get("CROP_TRACK_IN"):
        render_crop_track(inp, out, json.load(open(os.environ["CROP_TRACK_IN"])))
    else:
        main(inp, out)


if __name__ == "__main__":
    cli(sys.argv[1], sys.argv[2])
```

Set `CLIPS_WORKER_ROOT` (or `PYTHONPATH`) in the worker image to the directory that contains `clips_worker/`, so that `/app/v3/speakercrop_v2.py` can import `clips_worker.reframe_core`. The dispatch was tested with a stub `speakercrop.py` carrying exactly the 3 lines above: `REFRAME_V=2` gave 10 s of video in 4.0 s wall, and `CROP_TRACK_IN` re-rendered from the written JSON.

**Known gap (do this as part of the work):** `render_crop_track` renders `x0 ≥ 0` as single and everything else as wide. That's correct for v1, motion, and fit tracks, but a **saved v2 track with split or grid segments** would re-render those segments as wide. To fix it, persist the per-sample person boxes in crop_track v2 (`people[k].x/y/h` at 5 samples/s; about 9 KB per minute for 5 people). In `render_crop_track`, rebuild `_frames` from them and call `rc.frame_crops`, the same as `main`.

**Measured on multicam_edit (60 s, 1280x720 at 30 fps)**

| Mode | Segments |
|---|---|
| speaker_follow | 9 single + 1 wide |
| `FORCE_SPLIT=1` | 6 split + 2 single (shots with only one visible person) + 1 wide |
| fill | 9 single |
| fit | 1 wide |

- Wall time for speaker_follow with render: **23.2 s for 60 s of video**.
- crop_track JSON is 7–10 KB.
- `render_crop_track` runs at 5.08 ms/frame (single, track in) and 7.15 ms/frame (fit track → blur).

### 11.3 `pipeline.reframe_clip_preview`: stop overwriting, record `cropMethod` (P4, P8)

```diff
     if has_face_and_speech(clip_file, clip_words):
         rendered = run_speakercrop(clip_file, out_mp4, words_path, reframe_settings, work_dir,
                                    clip_start_ms=clip_start_ms, crop_track_out=crop_track_path)
+        ai_meta["cropMethod"] = "speaker_follow_v2" if os.environ.get("REFRAME_V") == "2" else "speaker_follow"
         return rendered, crop_method, reframe_settings
     ...
-    rendered = run_speakercrop(
-        clip_file, out_mp4, words_path, reframe_settings, work_dir,
-        clip_start_ms=clip_start_ms, crop_track_out=crop_track_path,
-    )
+    # Render FROM the track we just wrote (motion or fit_blur); never let speakercrop recompute/overwrite it.
+    rendered = run_speakercrop(
+        clip_file, out_mp4, words_path, reframe_settings, work_dir,
+        clip_start_ms=clip_start_ms, crop_track_in=crop_track_path,
+    )
     if not crop_track_path.exists():
         write_fit_blur_crop_track(clip_file, crop_track_path, clip_start_ms)
         crop_method = "fit_blur"
         reframe_settings = {**reframe_settings, "layout": "fit"}
+    ai_meta["cropMethod"] = crop_method          # speaker_follow[_v2] | subject_follow | fit_blur | fit_fallback
     return rendered, crop_method, reframe_settings
```

`render_clip.run_speakercrop` diff:

```diff
 def run_speakercrop(..., crop_track_out: Path | None = None, no_render: bool = False,
-                    render_id: str | None = None, render_meta: dict[str, Any] | None = None) -> Path:
+                    render_id: str | None = None, render_meta: dict[str, Any] | None = None,
+                    crop_track_in: Path | None = None) -> Path:
     ...
     env.update(layout_env(settings.get("layout", "speaker_follow")))
+    env.setdefault("REFRAME_V", os.environ.get("REFRAME_V", "1"))
+    if crop_track_in is not None:
+        env["CROP_TRACK_IN"] = str(crop_track_in)      # render-only; CROP_TRACK_OUT is not written
     ...
     # existing failure branch: ffmpeg_fit_export(...) (now blur) + render_meta["fit_fallback"] = True
+    # and ai_meta / render_meta["cropMethod"] = "fit_fallback"
```

Watch out for one v1 quirk: `write_fit_blur_crop_track` writes `x0 = -1`, and v1's render loop treats `-1` as **split**. `render_crop_track` treats `x0 < 0` as wide unless the shot label is `split`. Keep that rule in any TS preview code too.

### 11.4 crop_track v2 (a superset of v1) and the TS type

v2 keeps every v1 field, so the existing preview player keeps working. In `shots[].spk`, `A`/`B` mean P1/P2, plus `P3..P5`, `split`, `grid`, `three`, and `wide`. `x0[i]` is ≥0 for single, −1 for split/grid, and −2 for wide. Add these to `new-app/lib/clips/crop-track.ts` (all optional):

```ts
export type CropLayout = "single" | "split" | "three" | "grid" | "side" | "pip" | "wide";
export interface CropSegmentV2 { start_ms: number; end_ms: number; start_s: number; end_s: number;
  layout: CropLayout; slots: string[] /* "P1".."P5" */; override?: string }
export interface CropTrack {           // existing v1 fields unchanged: v, W, H, cw, fps, t0_ms, x0, x0_A?, x0_B?, shots
  v: 1 | 2;
  people?: { id: string; screen_s: number }[];
  segments?: CropSegmentV2[];
  spk2person?: Record<string, string>;   // Deepgram speaker id -> "P2"
  timings?: Record<string, number>;
}
```

---

## 12. Performance budget: 10-minute source, 4 vCPU, CPU only

Everything here is measured, per **source-minute** at 1280x720 and 30 fps (5 analysis samples/s):

| Step | Per source-minute | Notes |
|---|---|---|
| Decode (all frames, in the tracking pass) | ~1.7 s | 0.9 ms/frame |
| Shot detection (downscale 4) | ~1.0–1.9 s | decode-bound |
| YuNet @ 640, 300 samples | 2.1–2.4 s | 7–8 ms/sample |
| ByteTrack | 0.2–0.3 s | |
| SFace re-ID | 2.6–5.7 s | 10 ms/face; scales with face count. Capping embeddings per tracklet is the first optimisation if needed |
| Mouth (FaceLandmarker) | 4.1–9.1 s | 7.5 ms/face-sample; 2 people ≈ 4.5 s, 4 people ≈ 9 s |
| Viterbi + smoothing | <0.05 s | |
| **Analysis total** | **≈14 s (2 people), ≈24–27 s (4 people)** | measured `analyze_clip` on 60 s clips |
| Render (pipe, veryfast) | ≈9.3 s per output minute | 5.2 ms/frame, all layouts |

**10-minute source**
- Analysis of the whole source runs once: about **2.5 min** for a 2-person podcast (two_person measured at 31 s per 120 s) and about **4.5 min** for a 4-person panel.
- Rendering 10 clips × 45 s = 7.5 output-minutes takes about **70 s**.
- **Total: ≈3.5–5.5 min wall on 4 vCPU.** That's 0.35–0.55× real time.
- v1 re-analyses per export. v2 should cache the analysis JSON (`analyze_clip` minus rendering) per (source, window, model versions) and re-render only when the user changes layout or overrides, because analysis is ~70% of the cost.
- Running 2 renders in parallel (the existing parallel reframe) is fine: the pipe uses ~1.5 cores for x264 and 1 for Python.

**End-to-end speakercrop v2 (analysis + render, one process):**

| Clip | Wall time | Real-time factor |
|---|---|---|
| multicam_edit 60 s | **22.7–23.9 s** | 0.38–0.40× |
| four_up 60 s (1080p, 4 people) | 33–35 s | 0.55–0.59× |
| two_person 120 s | 49.4 s | 0.41× |

**Every stage is CPU-viable.** The only stage with a neural upgrade that needs extra deps is active speaker: Light-ASD at 3.8 ms/face-frame is viable on CPU but needs torch. The default path is the FaceLandmarker mouth score plus Deepgram fusion.

---

## 13. Stage 10: tests (NEW)

**Layout**
- `worker/tests/test_reframe_director.py`: 13 pure-numpy unit tests, run in 0.4 s and need no models.
- `worker/tests/test_reframe_integration.py`: 7 tests that run the real models on a 60 s fixture in about 13 s. They're skipped when the fixture or models are missing.

**Run:** `cd worker && python -m pytest -q tests/test_reframe_*.py -W ignore` (on this box: `20 passed in 13.4 s`).

**Fixtures** (≤3 min each; commit with a `LICENSE.txt` next to them):

| File | What | License |
|---|---|---|
| `multicam_edit.mp4` (60 s) | 6 × 10 s shots: 5 from the CC BY 3.0 interview below (wide, close-ups, cutaway) + 1 from the PD panel (40–50 s). Hard cuts at 10/20/30/40/50 s, host and guest recurring | CC BY 3.0 (attribution) + PD |
| `two_person_720p.mp4` (120 s) | 2-person interview, Wikimedia Commons | **CC BY 3.0**: credit the author in LICENSE.txt |
| `panel_whitehouse.mp4` (90 s) | panel | public domain (US Gov) |
| `four_up.mp4` (60 s) | synthetic 2x2 composite of the above (`ffmpeg xstack`) | inherits CC BY 3.0 / PD |
| `streamer_cam.mp4`, `streamer_cam_late_noborder.mp4` (30 s) | ffmpeg `testsrc2` + a cam overlay | synthetic |

Generate the synthetic ones with ffmpeg so they don't bloat the repo. Also commit a **real Deepgram `words.json`** for `multicam_edit.mp4` (run `deepgram_transcribe` once) and add an assert that, with diarization, P1/P2 turns map to the right person and the segment count drops versus visual-only.

```python
import numpy as np, pytest
from clips_worker.reframe_core import (DirectorCfg, viterbi_layout, path_segments, speaker_turns,
    map_speakers_to_people, speaker_posterior, smooth_path, OneEuro, assign_people, Tracklet, layout_slots, tile_rect)

FPS = 5.0

def synth(P=2, n=150, turns=((0, 0, 40), (1, 40, 80), (0, 80, 84), (1, 84, 150))):
    """turns: (person, start, end) in samples. Returns post, visible."""
    vis = np.ones((P, n), bool)
    act = np.full((P, n), 0.8)
    t = np.full(n, -1)
    for p, a, b in turns:
        act[p, a:b] = 2.0; t[a:b] = p
    post = speaker_posterior(t, {p: p for p in range(P)}, act, vis)
    return post, vis, t, act

def segs_of(post, vis, **kw):
    cfg = DirectorCfg(sample_fps=FPS, lead_s=0.0, **kw)
    st, path = viterbi_layout(post, vis, cfg)
    T = np.arange(post.shape[1]) / FPS
    return path_segments(st, path, T), st, path

def test_follows_long_turns_and_ignores_blip():
    post, vis, _, _ = synth()
    segs, *_ = segs_of(post, vis, allow_split=False)
    lay = [(s["layout"], s["slots"]) for s in segs]
    assert lay == [("single", [0]), ("single", [1])]        # 0.8 s blip by P1 absorbed
    assert abs(segs[1]["start_s"] - 8.0) <= 0.4

def test_min_hold_respected():
    rng = np.random.default_rng(0)
    turns = []; j = 0
    while j < 300:
        L = int(rng.integers(2, 12)); turns.append((int(rng.integers(0, 2)), j, min(300, j + L))); j += L
    post, vis, _, _ = synth(n=300, turns=turns)
    segs, *_ = segs_of(post, vis, min_hold_s=1.5)
    for s in segs[:-1]:
        assert s["end_s"] - s["start_s"] >= 1.5 - 1e-6

def test_lead_moves_cut_earlier():
    post, vis, _, _ = synth()
    st, p0 = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, lead_s=0.0, allow_split=False))
    st, p1 = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, lead_s=0.4, allow_split=False))
    assert np.argmax(p1 != p1[0]) == np.argmax(p0 != p0[0]) - 2

def test_split_when_both_talk_back_and_forth():
    turns = [(i % 2, a, a + 4) for i, a in enumerate(range(0, 100, 4))]
    post, vis, _, _ = synth(n=100, turns=turns)
    segs, *_ = segs_of(post, vis)
    assert any(s["layout"] == "split" for s in segs)

def test_grid_for_four_way_crosstalk():
    turns = [(i % 4, a, a + 3) for i, a in enumerate(range(0, 120, 3))]
    post, vis, _, _ = synth(P=4, n=120, turns=turns)
    segs, *_ = segs_of(post, vis)
    assert max((s["end_s"] - s["start_s"]) for s in segs if s["layout"] == "grid") > 10

def test_invisible_person_never_single():
    post, vis, _, _ = synth()
    vis[1, 50:70] = False
    _, st, path = segs_of(post, vis)
    assert all(st[k] != ("single", 1) for k in path[50:70])

def test_force_fit_and_split():
    post, vis, _, _ = synth()
    st, path = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, force="fit"))
    assert all(st[k][0] == "wide" for k in path)
    st, path = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, force="split"))
    assert all(st[k][0] == "split" for k in path)

def test_hard_cut_allows_immediate_switch():
    post, vis, _, _ = synth(turns=((0, 0, 50), (1, 50, 53), (0, 53, 150)))
    st, path = viterbi_layout(post, vis, DirectorCfg(sample_fps=FPS, lead_s=0, allow_split=False, min_hold_s=2.0), cuts=[50])
    assert st[path[49]] == ("single", 0)

def test_speaker_turns_bridge_and_mapping():
    T = np.arange(0, 20, 0.2)
    words = [dict(w="a", s=0.0, e=0.4, spk=1), dict(w="b", s=0.8, e=1.2, spk=1), dict(w="c", s=5.0, e=9.0, spk=0)]
    t = speaker_turns(words, T)
    assert (t[(T > 0.4) & (T < 0.8)] == 1).all() and t[int(3 / 0.2)] == -1
    act = np.ones((2, len(T))); act[1, t == 1] = 2.5; act[0, t == 0] = 2.5   # deepgram 1 = person 1
    assert map_speakers_to_people(t, act, np.ones_like(act, bool)) == {1: 1, 0: 0}

def test_offscreen_voice_maps_to_none():
    T = np.arange(0, 20, 0.2); n = len(T)
    t = np.where(T < 10, 0, 1)                    # spk 1 = off-screen narrator
    act = np.ones((1, n)); act[0, T < 10] = 2.5
    m = map_speakers_to_people(t, act, np.ones((1, n), bool))
    assert m == {0: 0}
    post = speaker_posterior(t, m, act, np.ones((1, n), bool))
    assert post[1, T >= 10].mean() > 0.8          # 'none' row dominates

def test_one_euro_and_pan_cap():
    fps = 30; W = 1280
    x = np.r_[np.full(30, 300.0), np.full(150, 900.0)] + np.random.default_rng(1).normal(0, 6, 180)
    y = smooth_path(x, fps, frame_w=W, max_speed=0.15)
    assert np.abs(np.diff(y)).max() <= 0.15 * W / fps + 1e-6
    still = smooth_path(np.full(90, 500.0) + np.random.default_rng(2).normal(0, 8, 90), fps, frame_w=W)
    assert np.ptp(still) < 3                       # dead-zone kills jitter
    y2 = smooth_path(x, fps, frame_w=W, resets=[30])
    assert abs(y2[30] - x[30]) < 1e-6              # layout cut = jump, not pan

def _tl(tid, shot, start, n, emb, x=100):
    return Tracklet(tid=tid, shot=shot, idx=list(range(start, start + n)), boxes=[[x, 0, 50, 50]] * n, embs=[emb] * 3)

def test_reid_gallery_hungarian_and_cannot_link():
    rng = np.random.default_rng(0)
    A, B = [v / np.linalg.norm(v) for v in rng.normal(size=(2, 128))]
    noisy = lambda v: (lambda u: u / np.linalg.norm(u))(v + rng.normal(0, 0.02, 128))
    tls = [_tl(1, 0, 0, 50, noisy(A), 100), _tl(2, 0, 0, 50, noisy(B), 800),
           _tl(3, 1, 50, 40, noisy(B)), _tl(4, 2, 90, 60, noisy(A), 100), _tl(5, 2, 90, 60, noisy(B), 800)]
    m = assign_people(tls)
    assert m[1] == m[4] and m[2] == m[3] == m[5] and m[1] != m[2]
    # two tracklets at the same time with the same face can't be one person
    m2 = assign_people([_tl(1, 0, 0, 20, A), _tl(2, 0, 0, 20, noisy(A), 600)])
    assert m2[1] != m2[2]

def test_layout_geometry():
    assert sum(h for *_, h in layout_slots("split", 1080, 1920, 2)) == 1920
    g = layout_slots("grid", 1080, 1920, 4); assert len(g) == 4 and g[3] == (540, 960, 540, 960)
    x, y, w, h = tile_rect(1200, 100, 120, 1280, 720, 9 / 8)
    assert 0 <= x and x + w <= 1280 and 0 <= y and y + h <= 720
```

```python
"""Integration: <=60 s fixture through analyze_clip + frame_crops. Skips when the fixture/models are absent.
Fixture: tests/fixtures/multicam_edit.mp4 (60 s, hard cuts at 10/20/30/40/50 s) — see guide §10."""
import os, numpy as np, pytest
from clips_worker import reframe_core as rc

FIX = os.environ.get("CLIPPER_FIXTURE", "/workspace/clipper-guide/media/multicam_edit.mp4")
MODELS = os.environ.get("CLIPPER_MODELS", "/workspace/clipper-guide/models")
pytestmark = pytest.mark.skipif(not (os.path.exists(FIX) and os.path.isdir(MODELS)), reason="fixture/models missing")


def test_director_cfg_from_env_reads_layout_settings():
    assert rc.director_cfg_from_env({"SPLIT": "1", "FORCE_SPLIT": "1"}).force == "split"
    assert rc.director_cfg_from_env({"LAYOUT_MODE": "fit"}).force == "fit"
    c = rc.director_cfg_from_env({"LAYOUT_MODE": "fill"}); assert c.force == "fill" and not c.allow_split


def test_fill_gaps_never_crosses_cut():
    a = np.array([[1.0, np.nan, 3.0, np.nan, np.nan, np.nan, np.nan, 9.0]])
    rc.fill_gaps(a, [0, 4, 8], max_gap=2)
    assert a[0, 1] == 2.0                      # bridged inside shot 0
    assert a[0, 3] == 3.0                      # held at end of shot 0
    assert np.isnan(a[0, 4]) and a[0, 5] == 9.0   # shot 1: held backwards from 9.0 for <=2 samples only


@pytest.fixture(scope="module")
def track():
    return rc.analyze_clip(FIX, None, rc.director_cfg_from_env({}), models_dir=MODELS)


def test_track_v2_schema(track):
    assert track["v"] == 2 and 1 <= len(track["people"]) <= 5
    assert len(track["x0"]) >= int(59 * track["fps"])
    for s in track["segments"]:
        assert s["layout"] in {"single", "split", "three", "grid", "wide"} and s["end_ms"] > s["start_ms"]


def test_min_hold_except_at_cuts(track):
    cuts = {10.0, 20.0, 30.0, 40.0, 50.0}; segs = track["segments"]
    for s in segs[1:-1]:
        near_cut = any(abs(s["start_s"] - c) < 0.5 or abs(s["end_s"] - c) < 0.5 for c in cuts)
        assert near_cut or s["end_s"] - s["start_s"] >= 1.5 - 1e-6, s


def test_layout_changes_land_on_cuts(track):
    # with visual-only evidence on an edited source most changes should coincide with editor cuts
    starts = [s["start_s"] for s in track["segments"][1:]]
    on_cut = [min(abs(t - c) for c in (10, 20, 30, 40, 50)) < 0.5 for t in starts]
    assert sum(on_cut) >= len(starts) // 2


def test_crops_inside_frame_and_pan_capped(track):
    W, H = track["W"], track["H"]; prev = None; vmax = 0.15 * W / track["fps"] + 1
    for i in range(0, len(track["x0"]), 3):
        lay, crops = rc.frame_crops(track, i)
        for x, y, w, h in crops:
            assert 0 <= x and 0 <= y and x + w <= W and y + h <= H
    x0 = np.array(track["x0"]); single = x0 >= 0
    seg = track["_frames"]["seg_of"]
    d = np.abs(np.diff(x0)); same = single[1:] & single[:-1] & (seg[1:] == seg[:-1])
    assert d[same].max() <= vmax


def test_shot_overrides(track):
    import copy
    t = copy.deepcopy(track); s0 = t["segments"][0]
    rc.apply_shot_overrides(t, [{"i": 0, "focus": "wide"}, {"start_ms": t["segments"][1]["start_ms"], "focus": "both"}])
    assert t["segments"][0]["layout"] == "wide" and t["x0"][int(s0["start_s"] * t["fps"]) + 1] == -2
    assert t["segments"][1]["layout"] == "split" and len(t["segments"][1]["slots"]) == 2
    lay, crops = rc.frame_crops(t, int(t["segments"][1]["start_s"] * t["fps"]) + 2)
    assert lay == "split" and len(crops) == 2
```

**Benchmark harness** (run it before and after any change; it prints per-stage seconds and ms/frame):

```python
"""End-to-end: analyze_clip (stages 1-7) + OpenCV-pipe render (stage 8) on a <=60 s fixture."""
import sys, time, subprocess, json, numpy as np, cv2, warnings; warnings.filterwarnings("ignore")
sys.path.insert(0, "/workspace/clipper-guide/code")
from clips_worker import reframe_core as rc
src = sys.argv[1]; out = sys.argv[2]; words = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else None
cv2.setNumThreads(4)
t0 = time.perf_counter()
tr = rc.analyze_clip(src, words, rc.director_cfg_from_env({}), models_dir="/workspace/clipper-guide/models")
ta = time.perf_counter() - t0
cap = cv2.VideoCapture(src); fps = cap.get(5); OW, OH = tr["out_w"], tr["out_h"]
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{OW}x{OH}", "-r", str(fps), "-i", "-",
                       "-i", src, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "4",
                       "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out], stdin=subprocess.PIPE)
i = 0; t1 = time.perf_counter()
while True:
    ok, fr = cap.read()
    if not ok: break
    lay, crops = rc.frame_crops(tr, i)
    ff.stdin.write(rc.compose_frame(fr, lay, crops, OW, OH).tobytes()); i += 1
ff.stdin.close(); ff.wait(); tr_ = time.perf_counter() - t1
tm = tr["_timings"]; dur = i / fps
print(f"{src.split('/')[-1]}: {dur:.0f}s, people={[p['id']+':'+str(round(p['screen_s']))+'s' for p in tr['people']]}")
print(f"analyze {ta:.1f}s (detect {tm['detect']:.1f} track {tm['track']:.1f} embed {tm['embed']:.1f} mouth {tm.get('mouth',0):.1f} "
      f"director {tm['director_s']*1000:.0f}ms smooth {tm['smooth_s']*1000:.0f}ms) | render {tr_:.1f}s = {1000*tr_/i:.2f} ms/frame | "
      f"total {(ta+tr_):.1f}s = {(ta+tr_)/dur:.2f}x realtime")
print("mouth ms/face:", round(1000 * tm.get("mouth", 0) / max(1, tm["n_emb"] * 2), 2), "| segments:")
print(" | ".join(f"{s['start_s']:.1f}-{s['end_s']:.1f} {s['layout']}{s['slots']}" for s in tr["segments"]))
```
`taskset -c 0-3 python b_e2e.py fixture.mp4 /tmp/out.mp4 [words.json]`

---

## 14. Rollout

1. Land `reframe_core.py`, the tests, and the requirements with `REFRAME_V` unset. There's no behaviour change, so CI just runs the tests.
2. Land the P3 blur fallback and the P4/P8 `reframe_clip_preview` fix. These are independent of v2 and safe to ship immediately.
3. Land the facecam upgrade (P6). Same return shape.
4. A/B: render the same 20 recent clips (from the 18 speaker_follow projects in the last 7 days) with v1 and v2. Check:
   - switches per minute;
   - % of time on the person Deepgram says is talking;
   - max pan px/frame (must be ≤ the cap);
   - `cropMethod` distribution;
   - wall time.
5. Flip `REFRAME_V=2` as the default. Keep v1 for one release behind `REFRAME_V=1`.

## 15. Licenses and flags

| Item | License | Flag |
|---|---|---|
| YuNet, SFace (opencv_zoo) | MIT / Apache-2.0 | OK |
| MediaPipe FaceLandmarker, EfficientDet-Lite0 | Apache-2.0 | OK |
| PySceneDetect | BSD-3 | OK |
| supervision | MIT | **`sv.ByteTrack` is removed in 0.31.** Pin <0.31 while numpy is 1.26.4 |
| Light-ASD (optional) | MIT | needs torch |
| **InsightFace model packs (buffalo_*)** | **non-commercial** | do **not** ship |
| **Ultralytics YOLO** | **AGPL-3.0** | do **not** use (that's why the person detector is MediaPipe) |
| Fixture `two_person_720p.mp4` | CC BY 3.0 | attribution required |
| Wikimania panel clip (evaluated, not used) | CC BY-SA | don't commit (share-alike) |
