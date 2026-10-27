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
from typing import Iterable, Mapping

import cv2  # opencv-contrib-python-headless (already a worker dependency)
import numpy as np

# --------------------------------------------------------------------------
# existing helpers (kept)
# --------------------------------------------------------------------------

def blend_targets(prev: float, nxt: float, alpha: float = 0.35) -> float:
    return prev * (1 - alpha) + nxt * alpha


def _empty_face_track(params: dict | None) -> dict:
    params = params or {}
    dur = float(params.get("duration_s") or 1.0)
    fps = float(params.get("fps") or 30.0)
    sample_fps = float(params.get("sample_fps") or 5.0)
    return {
        "v": 2,
        "fps": fps,
        "sample_fps": sample_fps,
        "W": 0,
        "H": 0,
        "t": [],
        "shots": [(0.0, dur)],
        "people": [],
        "mouth": [],
        "_tracklets": {},
        "_timings": {"detect": 0.0, "track": 0.0, "embed": 0.0, "n": 0, "n_emb": 0},
    }


# --------------------------------------------------------------------------
# Stage 1: shot detection (NEW)
# --------------------------------------------------------------------------

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


# --------------------------------------------------------------------------
# Stage 2: face detection (UPGRADE of the YuNet call in speakercrop.py)
# --------------------------------------------------------------------------

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


def person_detector_enabled(env: Mapping[str, object] | None = None) -> bool:
    """Stage 2b (IMPLEMENTATION-GUIDE): MediaPipe EfficientDet-Lite0, default off (REFRAME_PERSON_DET)."""
    src = env if env is not None else os.environ
    return str(src.get("REFRAME_PERSON_DET", "")).strip().lower() in ("1", "true", "yes")


def make_person_detector(model_path: str, *, score: float = 0.4):
    from mediapipe.tasks.python import BaseOptions, vision

    return vision.ObjectDetector.create_from_options(vision.ObjectDetectorOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.IMAGE,
        score_threshold=score,
        category_allowlist=["person"],
        max_results=6,
    ))


def _person_boxes_to_face_rows(boxes: list[tuple[float, float, float, float]], scale: float) -> np.ndarray:
    """Person detections as YuNet-shaped rows (upper body) for ByteTrack; landmarks/score are placeholders."""
    rows: list[list[float]] = []
    for ox, oy, bw, bh in boxes:
        w = bw / scale
        h = max(bh / scale * 0.35, 24.0)
        x = ox / scale
        y = oy / scale
        rows.append([x, y, w, h] + [0.0] * 10 + [0.55])
    if not rows:
        return np.zeros((0, 15), np.float32)
    return np.array(rows, np.float32)


def detect_persons_scaled(pd, frame: np.ndarray, target_w: int = 640) -> np.ndarray:
    """MediaPipe person detector on a downscaled frame; returns Nx15 rows in full-res pixels."""
    import cv2
    import mediapipe as mp

    H, W = frame.shape[:2]
    s = min(1.0, target_w / W)
    small = frame if s == 1.0 else cv2.resize(frame, (int(round(W * s)), int(round(H * s))), interpolation=cv2.INTER_AREA)
    res = pd.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB)))
    boxes = [(d.bounding_box.origin_x, d.bounding_box.origin_y, d.bounding_box.width, d.bounding_box.height)
             for d in (res.detections or [])]
    return _person_boxes_to_face_rows(boxes, s)


# --------------------------------------------------------------------------
# Stage 3: tracking (UPGRADE of the nearest-x 2-slot EMA in speakercrop.py)
# --------------------------------------------------------------------------

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


# --------------------------------------------------------------------------
# Stage 4: re-ID -> stable P1..P5 (NEW)
# --------------------------------------------------------------------------

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


# --------------------------------------------------------------------------
# Stages 1-4 orchestration: track_faces (UPGRADE of the placeholder)
# --------------------------------------------------------------------------

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
    try:
        shots = params.get("shots") or detect_shots(video_path)
    except Exception:
        return _empty_face_track(params)
    lm = make_mouth_landmarker(params["mouth_model"]) if params.get("mouth_model") else None

    from clips_worker.reframe_models import EFFICIENTDET_TFLITE, SFACE_LEGACY_ONNX, SFACE_ONNX, YUNET_ONNX, resolve_onnx

    env = params.get("env") or {}
    yunet_path = resolve_onnx(models, YUNET_ONNX)
    sface_path = resolve_onnx(models, SFACE_ONNX, SFACE_LEGACY_ONNX)
    if not os.path.isfile(yunet_path) or not os.path.isfile(sface_path):
        return _empty_face_track(params)
    det = make_face_detector(yunet_path, det_w)
    person_pd = None
    if person_detector_enabled(env):
        pd_path = resolve_onnx(models, EFFICIENTDET_TFLITE)
        if os.path.isfile(pd_path):
            person_pd = make_person_detector(pd_path)
    emb = FaceEmbedder(sface_path)
    trk = FaceTracker(sample_fps)
    shot_had_face: set[int] = set()
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return _empty_face_track(params)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W, H = int(cap.get(3)), int(cap.get(4))
    sar_num = cap.get(cv2.CAP_PROP_SAR_NUM) or 1.0
    sar_den = cap.get(cv2.CAP_PROP_SAR_DEN) or 1.0
    if sar_den and abs(float(sar_num) / float(sar_den) - 1.0) > 0.02:
        W = int(round(W * float(sar_num) / float(sar_den)))
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
            if len(faces) == 0 and person_pd is not None and si in shot_had_face:
                faces = filter_main_faces(detect_persons_scaled(person_pd, fr, det_w), H,
                                          min_frac=0.06, max_faces=max_people + 1)
            elif len(faces) > 0:
                shot_had_face.add(si)
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
    if person_pd is not None:
        person_pd.close()
    timings["track"] -= timings["embed"] + timings.get("mouth", 0.0)
    people = [dict(id=f"P{p+1}", x=(arr[p, 0] + arr[p, 2] / 2).tolist(), y=(arr[p, 1] + arr[p, 3] / 2).tolist(),
                   w=arr[p, 2].tolist(), h=arr[p, 3].tolist()) for p in range(P)]
    return {"v": 2, "fps": fps, "sample_fps": sample_fps, "W": W, "H": H, "t": T, "shots": shots,
            "people": people, "mouth": mouth.tolist(), "_tracklets": {k: mapping.get(k) for k in tracklets},
            "_timings": timings}


# --------------------------------------------------------------------------
# Stage 5: active speaker (UPGRADE: fuse Deepgram spk turns with the existing mouth score)
# --------------------------------------------------------------------------

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


# --------------------------------------------------------------------------
# Stage 6: layout director (UPGRADE: replaces the threshold/merge loop in speakercrop.py
# with a duration-constrained Viterbi; keeps the LEAD / MIN_SEG / HYST / BOTH_T knobs)
# --------------------------------------------------------------------------

@dataclass
class DirectorCfg:
    sample_fps: float = 5.0
    min_hold_s: float = 2.25       # MIN_SHOT_CLOSE (bic wants 1.5–2 s+; v2 default)
    lead_s: float = 0.4            # LEAD / LEAD_WORDS: onset anticipation
    switch_cost: float = 2.4       # HYST(0.6) * 4: hysteresis = cost of any cut
    split_bias: float = 1.2        # extra cost of 2-up vs single
    grid_bias: float = 1.8         # extra cost of grid vs single
    wide_bias: float = 0.9
    wide_lone_penalty: float = 1.5 # extra cost of wide when exactly one person is on screen
    both_win_s: float = 3.0        # window to call "both are talking" (BOTH_T analogue)
    allow_split: bool = True       # SPLIT
    allow_three: bool = True       # 3-up vertical stack (P >= 3)
    three_bias: float = 1.5        # extra cost of three vs single (between split and grid)
    allow_grid: bool = True
    force: str | None = None       # LAYOUT_MODE / FORCE_SPLIT: 'split' | 'fit' | 'fill' | None


def layout_states(P: int, cfg: DirectorCfg) -> list[tuple]:
    st: list[tuple] = [("single", k) for k in range(P)]
    if cfg.allow_split and P >= 2:
        st += [("split", a, b) for a in range(P) for b in range(a + 1, P)]
    if cfg.allow_three and P >= 3:
        st.append(("three",))
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
        elif s[0] == "three":
            third = np.sort(win, axis=0)[-3] * 3.0 if P >= 3 else np.zeros(n)
            C[i] = cfg.three_bias - np.log(np.clip(third, eps, 1.0))
            C[i][visible.sum(0) < 3] = np.inf
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


# --------------------------------------------------------------------------
# Stage 7: smoothing (UPGRADE of speakercrop._eased_x0: One-Euro + dead-zone + pan cap)
# --------------------------------------------------------------------------

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


# --------------------------------------------------------------------------
# Stage 8: layout geometry (UPGRADE of speakercrop.tile(); adds grid / three / pip / side)
# --------------------------------------------------------------------------

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


# ---------------------------------------------------------------- Stage 8b: compositing (OpenCV pipe renderer)
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


# ---------------------------------------------------------------- Stage 8c: ffmpeg graph per static segment
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


def blur_fit_filter(out_w: int, out_h: int, src: str = "[0:v]", dst: str = "[v]", blur: int = 20) -> str:
    """ffmpeg blurred-background fit (replaces the black-bar pad in render_clip.ffmpeg_fit_export)."""
    return (f"{src}split=2[bg][fg];"
            f"[bg]scale={out_w // 4}:{out_h // 4}:force_original_aspect_ratio=increase,"
            f"crop={out_w // 4}:{out_h // 4},boxblur={max(2, blur // 4)}:2,scale={out_w}:{out_h},setsar=1[bgb];"
            f"[fg]scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,setsar=1[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2{dst}")


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


# ---------------------------------------------------------------- orchestration (what speakercrop REFRAME_V=2 calls)
def director_cfg_from_env(env: dict, sample_fps: float = 5.0) -> DirectorCfg:
    """Maps render_clip.layout_env() output (+ existing speakercrop knobs) onto DirectorCfg.
    FIX: speakercrop v1 never read LAYOUT_MODE / FORCE_SPLIT."""
    g = lambda k, d: float(env.get(k, d))
    mode = str(env.get("LAYOUT_MODE") or env.get("LAYOUT_STYLE") or "speaker_follow").strip()
    min_close = g("MIN_SHOT_CLOSE", g("MIN_SEG", 2.25))
    cfg = DirectorCfg(sample_fps=sample_fps, min_hold_s=max(2.25, min_close), lead_s=g("LEAD", 0.4),
                      switch_cost=4 * g("HYST", 0.6), allow_split=bool(int(g("SPLIT", 1))),
                      allow_grid=bool(int(g("GRID", 1))))
    if int(g("FORCE_SPLIT", 0)) or mode == "split":
        cfg.force = "split"
    elif mode == "locked_off":
        cfg.force = "fill"
        cfg.allow_split = cfg.allow_grid = False
    elif mode == "fit":
        cfg.force = "fit"
    elif mode == "fill":
        cfg.force = "fill"
        cfg.allow_split = cfg.allow_grid = False
    elif mode == "split_debate":
        cfg.allow_grid = False
        cfg.split_bias *= 0.85
    elif mode in ("grid", "grid3", "grid4"):
        cfg.allow_split = False
        cfg.allow_grid = True
        if mode == "grid3":
            cfg.grid_bias *= 0.7
        elif mode == "grid4":
            cfg.grid_bias *= 0.6
    elif mode == "dynamic":
        pass
    return cfg


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
    if lay == "three":
        vis = [p for p in range(fr["fx"].shape[0]) if not np.isnan(fr["fx"][p, i])]
        vis = sorted(vis, key=lambda p: -track["people"][p]["screen_s"])[:3]
        vis = sorted(vis, key=lambda p: fr["fx"][p, i])
        return "three", [tile_rect(*face(p), W, H, ow / (oh / 3)) for p in vis]
    if lay == "side":
        slots = list(sg["slots"])[:2]
        tile_aspect = (ow / 2) / max(oh, 1)
        return "side", [tile_rect(*face(p), W, H, tile_aspect) for p in slots]
    if lay == "pip":
        p = int(sg["slots"][0]) if sg["slots"] else 0
        cam_w = max(ow // 3, 1)
        return "pip", [tile_rect(*face(p), W, H, cam_w / max(int(cam_w * 4 / 3), 1))]
    if lay == "grid":
        vis = [p for p in range(fr["fx"].shape[0]) if not np.isnan(fr["fx"][p, i])]
        vis = sorted(vis, key=lambda p: -track["people"][p]["screen_s"])[:4]
        vis = sorted(vis, key=lambda p: fr["fx"][p, i])
        return "grid", [tile_rect(*face(p), W, H, (ow / 2) / (oh / 2)) for p in vis]
    return "wide", []


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
