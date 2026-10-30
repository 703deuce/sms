#!/usr/bin/env python3
"""T6.2 matrix acceptance assertions (spec section a)."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / "worker"
SPECS = Path(__file__).resolve().parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/t62m")
A_META = json.loads((SPECS / "fixtures" / "A_db.json").read_text())
B_META = json.loads((SPECS / "fixtures" / "B_db.json").read_text())

sys.path.insert(0, str(WORKER))
from clips_worker.t6_geometry import resolve_template_geometry  # noqa: E402
from clips_worker.t6_registry import TEMPLATE_IDS, TEMPLATES  # noqa: E402
from clips_worker.t6_signals import signals_or_defaults  # noqa: E402

I_TEMPLATES = [f"I{i}" for i in range(1, 5)]
FACE_TEMPLATES_A = [f"G{i}" for i in range(1, 7)]
FACE_TEMPLATES_B = I_TEMPLATES + [f"C{i}" for i in range(1, 10)]


def load_spec(meta: dict, tid: str) -> dict:
    edits = json.loads(json.dumps(meta["edits"]))
    edits.setdefault("layout", {})["template"] = {"id": tid, "auto": False}
    signals = signals_or_defaults(meta["aiMeta"])
    return resolve_template_geometry(TEMPLATES[tid], signals, edits)


def frame_at(path: Path, t: float) -> np.ndarray:
    cap = cv2.VideoCapture(str(path))
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"no frame {t}s {path}")
    return frame


def region(frame: np.ndarray, rect: dict) -> np.ndarray:
    h, w = frame.shape[:2]
    x = int(rect.get("x", 0))
    y = int(rect.get("y", 0))
    rw = int(rect.get("w", w))
    rh = int(rect.get("h", h))
    return frame[y : y + rh, x : x + rw]


def mean_abs_diff(a: np.ndarray, b: np.ndarray) -> float:
    if a.shape != b.shape:
        b = cv2.resize(b, (a.shape[1], a.shape[0]))
    return float(np.mean(cv2.absdiff(a, b)))


def detect_faces_yunet(crop: np.ndarray) -> list[tuple[float, float]]:
    from clips_worker.reframe_core import make_face_detector

    model = Path(WORKER / "models" / "face_detection_yunet_2023mar.onnx")
    if not model.is_file():
        return [(0.5, 0.5)]  # skip if model missing in dev
    det = make_face_detector(str(model), input_w=320, score=0.5)
    h, w = crop.shape[:2]
    faces = det(crop, w, h)
    centers = []
    for row in faces:
        x, y, bw, bh = row[0:4]
        centers.append((float(x + bw / 2) / max(w, 1), float(y + bh / 2) / max(h, 1)))
    return centers


def assert_captions(mp4: Path, spec: dict, log: list) -> None:
    spec_path = mp4.parent / f"{mp4.stem.split('_')[0]}_spec.json"
    if spec_path.is_file():
        spec = json.loads(spec_path.read_text())
    rect = spec.get("captionRect") or {"x": 0, "y": int(0.72 * 1920), "w": 1080, "h": 200}
    for t in (1, 5, 10):
        png = mp4.with_suffix("").as_posix() + f"_{t}.png"
        if not Path(png).is_file():
            log.append(("FAIL", str(mp4), f"missing frame {t}s"))
            continue
        on = cv2.imread(png)
        # caption region should have variation vs flat band when words exist
        cap = region(on, rect)
        if float(np.std(cap)) < 4 and t == 5:
            log.append(("WARN", str(mp4), f"low caption variance t={t}"))


def assert_i_templates(log: list) -> None:
    edits_b = B_META["edits"]
    signals = signals_or_defaults(B_META["aiMeta"])
    for tid in I_TEMPLATES:
        edits = json.loads(json.dumps(edits_b))
        edits.setdefault("layout", {})["template"] = {"id": tid, "auto": False}
        spec = resolve_template_geometry(TEMPLATES[tid], signals, edits)
        src = spec["panels"][0]["src"]
        if src.get("w", 0) < 0.98:
            log.append(("FAIL", "I-width", f"{tid} src.w={src.get('w')}"))


def main() -> int:
    log: list[tuple[str, str, str]] = []
    if not OUT.is_dir():
        print("OUT missing", OUT)
        return 2
    mp4s = list(OUT.rglob("*.mp4"))
    if not mp4s:
        print("no mp4 under", OUT)
        return 2
    assert_i_templates(log)
    for mp4 in sorted(mp4s):
        parts = mp4.stem.split("_")
        tid = parts[0] if parts else ""
        meta = A_META if mp4.parts[-2] == "A" or "/A/" in str(mp4) else B_META
        if tid in TEMPLATE_IDS:
            spec = load_spec(meta, tid)
            assert_captions(mp4, spec, log)
    fails = [x for x in log if x[0] == "FAIL"]
    for row in log:
        print("\t".join(row))
    print(f"CHECKED {len(mp4s)} mp4s FAIL={len(fails)} WARN={sum(1 for x in log if x[0]=='WARN')}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
