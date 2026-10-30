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


def person_boxes(clip_file, n_samples: int = 8) -> tuple[int, list[dict]]:
    _ = (clip_file, n_samples)
    return 1, []


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


def _region_stats(gray: np.ndarray, y0: float, y1: float) -> dict[str, float]:
    h, w = gray.shape[:2]
    r0 = max(0, min(h - 1, int(round(y0 * h))))
    r1 = max(r0 + 1, min(h, int(round(y1 * h))))
    crop = gray[r0:r1, :]
    luma = float(np.mean(crop) / 255.0)
    if cv2 is not None:
        lap = cv2.Laplacian(crop, cv2.CV_64F)
        busy = float(min(1.0, np.var(lap) / 500.0))
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
    count, boxes = person_boxes(clip_file)
    out["person_count"] = count
    if boxes:
        out["person_boxes"] = boxes
    out["active_speaker"] = active_speaker(words, crop_track)
    out["hud_at_edges"] = hud_at_edges(clip_file)
    out["bands"] = band_stats(clip_file, [])
    out.setdefault("sources", {"ai": out.get("sources", {}).get("ai", "none"), "cv": "local"})
    return out
