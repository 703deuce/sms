"""Local CV helpers for T6 signals (P1)."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

try:
    import cv2  # type: ignore
except ImportError:  # pragma: no cover
    cv2 = None


FACES_VERSION = 1

# T6.7: a "face" whose centre and size do not move at all across the clip is a picture of a
# face (Halloween pumpkin, poster, thumbnails in a browser), not a person. Real people,
# including a still streamer behind a webcam, measured >= 0.06 jitter on every test source;
# pictures measured <= 0.021 (see specs/T6_7_fixes.md).
STATIC_FACE_JITTER = 0.03
STATIC_FACE_SIZEVAR = 0.03
STATIC_FACE_MIN_PERSIST = 0.6


def _yunet_path() -> Path | None:
    import os

    p = Path(os.environ.get("SPEAKERCROP_DIR", "/app/v3")) / "yunet.onnx"
    return p if p.is_file() else None


def detect_faces(clip_file, n_samples: int = 10, min_persist: float = 0.4) -> list[dict] | None:
    """T6.3: recurring real faces in the clip (YuNet), normalised to the source frame.

    Returns face clusters sorted by persistence (fraction of sampled frames that contain the
    face), each ``{"x","y","w","h","persist","score"}`` = median face box of the cluster.
    Only clusters seen in >= ``min_persist`` of the samples are kept (a crowd / passers-by
    never form a stable cluster, so IRL crowd shots return ``[]``).
    Returns ``None`` when the detector is unavailable (caller keeps legacy behaviour).
    """
    if cv2 is None or clip_file is None:
        return None
    model = _yunet_path()
    path = Path(clip_file)
    if model is None or not path.is_file():
        return None
    cap = cv2.VideoCapture(str(path))
    try:
        nf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        if nf <= 0 or src_w <= 0 or src_h <= 0:
            return None
        aw = 640
        ah = max(2, int(round(src_h * aw / src_w)))
        det = cv2.FaceDetectorYN_create(str(model), "", (aw, ah), 0.6, 0.3, 50)
        dets: list[tuple[int, float, float, float, float, float]] = []
        n_ok = 0
        for si, fi in enumerate(np.linspace(0.05 * nf, 0.95 * nf, max(1, n_samples)).astype(int)):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
            ok, fr = cap.read()
            if not ok or fr is None:
                continue
            n_ok += 1
            sm = cv2.resize(fr, (aw, ah), interpolation=cv2.INTER_AREA)
            _, found = det.detect(sm)
            for r in ([] if found is None else found):
                fw, fh = float(r[2]) / aw, float(r[3]) / ah
                if fw <= 0.004 or fh <= 0.008:
                    continue
                dets.append((si, float(r[0]) / aw, float(r[1]) / ah, fw, fh, float(r[14])))
    finally:
        cap.release()
    if n_ok == 0:
        return None
    # Greedy clustering by centre distance (relative to face size) across samples.
    clusters: list[list[tuple[int, float, float, float, float, float]]] = []
    for d in sorted(dets, key=lambda t: -t[5]):
        cx, cy = d[1] + d[3] / 2, d[2] + d[4] / 2
        best, best_dist = None, 1e9
        for c in clusters:
            mx = float(np.median([e[1] + e[3] / 2 for e in c]))
            my = float(np.median([e[2] + e[4] / 2 for e in c]))
            mw = float(np.median([e[3] for e in c]))
            dist = ((cx - mx) ** 2 + (cy - my) ** 2) ** 0.5
            if dist < max(0.04, 1.5 * mw) and dist < best_dist and d[0] not in {e[0] for e in c}:
                best, best_dist = c, dist
        if best is None:
            clusters.append([d])
        else:
            best.append(d)
    out: list[dict] = []
    for c in clusters:
        persist = len({e[0] for e in c}) / n_ok
        if persist < min_persist:
            continue
        if _is_static_face(c, persist):
            continue
        out.append(
            {
                "x": round(float(np.median([e[1] for e in c])), 4),
                "y": round(float(np.median([e[2] for e in c])), 4),
                "w": round(float(np.median([e[3] for e in c])), 4),
                "h": round(float(np.median([e[4] for e in c])), 4),
                "persist": round(persist, 3),
                "score": round(float(np.median([e[5] for e in c])), 3),
            }
        )
    out.sort(key=lambda f: (-f["persist"], -(f["w"] * f["h"])))
    return out[:6]


def _is_static_face(cluster: list[tuple], persist: float) -> bool:
    """T6.7: True for a face that never moves (picture/statue/thumbnail), see STATIC_FACE_*."""
    if persist < STATIC_FACE_MIN_PERSIST or len(cluster) < 4:
        return False
    cxs = np.array([e[1] + e[3] / 2 for e in cluster])
    cys = np.array([e[2] + e[4] / 2 for e in cluster])
    ws = np.array([e[3] for e in cluster])
    mw = float(np.median(ws)) or 1e-6
    jitter = float(np.hypot(cxs.std(), cys.std()) / mw)
    sizevar = float(ws.std() / mw)
    return jitter < STATIC_FACE_JITTER and sizevar < STATIC_FACE_SIZEVAR


def person_boxes(clip_file, n_samples: int = 10) -> tuple[int, list[dict]]:
    """T6.3: was a stub returning (1, []) so every person:N panel fell back to a fixed
    top-left box (I5 'Single Person' framed an empty wall). Count = recurring faces."""
    faces = detect_faces(clip_file, n_samples=n_samples)
    if faces is None:
        return 1, []
    return len(faces), faces


def active_speaker(words: list[dict], crop_track: dict | None) -> list[dict]:
    _ = crop_track
    if not words:
        return []
    try:
        t0 = float(words[0]["s"])
        t1 = float(words[-1]["e"])
    except (KeyError, TypeError, ValueError):
        return []
    return [{"t0": t0, "t1": t1, "person": 0}]


def hud_at_edges(clip_file) -> bool:
    _ = clip_file
    return False


def _frame_gray(path: Path, t_s: float) -> np.ndarray | None:
    if cv2 is None:
        return None
    tmp = path.parent / f"_t6_frame_{int(t_s * 1000)}.png"
    try:
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                f"{t_s:.3f}",
                "-i",
                str(path),
                "-frames:v",
                "1",
                str(tmp),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        img = cv2.imread(str(tmp), cv2.IMREAD_GRAYSCALE)
        return img
    except Exception:
        return None
    finally:
        if tmp.is_file():
            tmp.unlink(missing_ok=True)


BUSY_ANALYSIS_W = 320
BUSY_NORM = 6000.0


def _region_stats(gray: np.ndarray, y0: float, y1: float) -> dict[str, float]:
    # T6.7: Laplacian variance depends on resolution and saturated (busy=1.0) on almost every
    # 720p stream frame, so every title became the white box. Measure at a fixed 320 px width.
    if cv2 is not None and gray.shape[1] > BUSY_ANALYSIS_W:
        sh = max(2, int(round(gray.shape[0] * BUSY_ANALYSIS_W / gray.shape[1])))
        gray = cv2.resize(gray, (BUSY_ANALYSIS_W, sh), interpolation=cv2.INTER_AREA)
    h, w = gray.shape[:2]
    r0 = max(0, min(h - 1, int(round(y0 * h))))
    r1 = max(r0 + 1, min(h, int(round(y1 * h))))
    crop = gray[r0:r1, :]
    luma = float(np.mean(crop) / 255.0)
    if cv2 is not None:
        lap = cv2.Laplacian(crop, cv2.CV_64F)
        busy = float(min(1.0, np.var(lap) / BUSY_NORM))
    else:
        busy = 0.5
    return {"luma": round(luma, 3), "busy": round(busy, 3)}


def band_stats(clip_file, rects: list[dict]) -> dict[str, dict[str, float]]:
    _ = rects
    path = Path(clip_file)
    dur = 6.0
    try:
        meta = json.loads(
            subprocess.check_output(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "json",
                    str(path),
                ],
                stderr=subprocess.DEVNULL,
            )
        )
        dur = float((meta.get("format") or {}).get("duration") or dur)
    except Exception:
        pass
    samples = [max(0.0, dur * f) for f in (0.1, 0.25, 0.4, 0.55, 0.7, 0.85)]
    top_acc: list[dict[str, float]] = []
    bot_acc: list[dict[str, float]] = []
    cap_acc: list[dict[str, float]] = []
    for t in samples:
        gray = _frame_gray(path, t)
        if gray is None:
            continue
        top_acc.append(_region_stats(gray, 0.0, 0.33))
        bot_acc.append(_region_stats(gray, 0.67, 1.0))
        cap_acc.append(_region_stats(gray, 0.55, 0.75))

    def _mean(rows: list[dict[str, float]], key: str, default: float) -> float:
        if not rows:
            return default
        return round(sum(r[key] for r in rows) / len(rows), 3)

    return {
        "top": {"luma": _mean(top_acc, "luma", 0.3), "busy": _mean(top_acc, "busy", 0.5)},
        "bottom": {"luma": _mean(bot_acc, "luma", 0.3), "busy": _mean(bot_acc, "busy", 0.5)},
        "caption": {"luma": _mean(cap_acc, "luma", 0.3), "busy": _mean(cap_acc, "busy", 0.5)},
    }


def enrich_signals_cv(
    signals: dict,
    clip_file,
    words: list[dict],
    crop_track: dict | None,
) -> dict:
    out = dict(signals)
    faces = detect_faces(clip_file)
    if faces is None:
        out["person_count"] = int(out.get("person_count") or 1)
    else:
        # T6.3: `faces` drives face/person panels (t6_geometry) and face-template eligibility.
        out["faces"] = faces
        out["faces_v"] = FACES_VERSION
        out["person_count"] = len(faces)
    out["active_speaker"] = active_speaker(words, crop_track)
    out["hud_at_edges"] = hud_at_edges(clip_file)
    out["bands"] = band_stats(clip_file, [])
    out.setdefault("sources", {"ai": out.get("sources", {}).get("ai", "none"), "cv": "local"})
    return out
