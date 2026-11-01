"""G4c blur regions (mirror of new-app/lib/clips/editor/blur-regions.ts).

``edits.blurRegions`` = [{id, startMs, endMs, mode, amount, mask}] in OUTPUT (edit) ms, applied
to the main video after cut / motion and under B-roll, text and captions.

  manual  the G4b shape mask (rect / ellipse / …, feather, invert, keyframed geometry in ms from
          the region start) — the preview draws the same mask, so preview = export.
  faces   the worker's self-hosted YuNet face detector (the T6 model, CPU, no API) finds faces
          every 100 ms inside the region; each face gets a feathered ellipse (held for up to
          300 ms across missed detections). The preview cannot run YuNet, so it shows the manual
          mask with a "faces are found on export" note. No model → the manual mask is used.

Blur strength: Gaussian sigma = amount/100 × BLUR_UNIT × short side (CSS blur radius in the
preview uses the same unit on the displayed frame).
"""
from __future__ import annotations

import math
import re
import subprocess
from pathlib import Path

BLUR_MAX_REGIONS = 20
BLUR_UNIT = 0.04
BLUR_DEFAULT = 60
FACE_STEP_MS = 100
FACE_HOLD_STEPS = 3
FACE_PAD_W = 1.5
FACE_PAD_H = 1.6
FACE_FEATHER = 25
BLUR_MODES = ("manual", "faces")
DEFAULT_BLUR_MASK = {"shape": "ellipse", "x": 50, "y": 40, "w": 30, "h": 40, "rot": 0, "feather": 20}
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _num(v):
    if isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def normalize_blur_regions(raw) -> list[dict]:
    from clips_worker.layer_fx import normalize_mask

    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for r in raw:
        if not isinstance(r, dict) or not isinstance(r.get("id"), str) or not _ID.match(r["id"]) or r["id"] in seen:
            continue
        a, b = _num(r.get("startMs")), _num(r.get("endMs"))
        if a is None or b is None:
            continue
        a = max(0, int(math.floor(a + 0.5)))
        b = int(math.floor(b + 0.5))
        if b - a < 100:
            continue
        amt = _num(r.get("amount"))
        amount = BLUR_DEFAULT if amt is None else int(max(1, min(100, math.floor(amt + 0.5))))
        mask = normalize_mask(r.get("mask")) or dict(DEFAULT_BLUR_MASK)
        seen.add(r["id"])
        out.append({"id": r["id"], "startMs": a, "endMs": b, "mode": r.get("mode") if r.get("mode") in BLUR_MODES else "manual",
                    "amount": amount, "mask": mask})
        if len(out) >= BLUR_MAX_REGIONS:
            break
    out.sort(key=lambda x: (x["startMs"], x["id"]))
    return out


def blur_sigma(amount: int, w: int, h: int) -> float:
    return round(amount / 100 * BLUR_UNIT * min(w, h), 3)


def _yunet():
    try:
        import cv2  # type: ignore

        from clips_worker.t6_cv import _yunet_path
    except Exception:
        return None, None
    p = _yunet_path()
    if p is None or not hasattr(cv2, "FaceDetectorYN_create"):
        return None, None
    return cv2, p


def detect_face_steps(src: Path, start_ms: int, end_ms: int, detector=None) -> list[list[tuple]] | None:
    """Per FACE_STEP_MS step in [start, end): [(cx, cy, w, h)] normalized boxes, or None when no
    detector is available. ``detector(frame_bgr) -> [(x, y, w, h)]`` (normalized) for tests."""
    import numpy as np

    aw = 640
    if detector is None:
        cv2, model = _yunet()
        if cv2 is None:
            return None
        det_holder: dict = {}

        def detector(fr):  # noqa: F811
            hh, ww = fr.shape[:2]
            if "d" not in det_holder:
                det_holder["d"] = cv2.FaceDetectorYN_create(str(model), "", (ww, hh), 0.6, 0.3, 50)
            _, found = det_holder["d"].detect(fr)
            res = []
            for r in ([] if found is None else found):
                fw, fh = float(r[2]) / ww, float(r[3]) / hh
                if fw > 0.004 and fh > 0.008:
                    res.append((float(r[0]) / ww, float(r[1]) / hh, fw, fh))
            return res

    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0:s=x", str(src)], capture_output=True, text=True, check=True)
    sw, sh = (int(v) for v in r.stdout.strip().split("x")[:2])
    ah = max(2, int(round(sh * aw / sw / 2)) * 2)
    n = max(1, math.ceil((end_ms - start_ms) / FACE_STEP_MS))
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{start_ms / 1000:.3f}", "-i", str(src), "-frames:v", str(n),
         "-vf", f"fps={1000 / FACE_STEP_MS:g},scale={aw}:{ah}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        capture_output=True, check=True)
    fsz = aw * ah * 3
    steps: list[list[tuple]] = []
    for i in range(n):
        chunk = proc.stdout[i * fsz:(i + 1) * fsz]
        if len(chunk) < fsz:
            steps.append([])
            continue
        fr = np.frombuffer(chunk, dtype=np.uint8).reshape(ah, aw, 3)
        steps.append([(x + fw / 2, y + fh / 2, fw, fh) for x, y, fw, fh in detector(fr)])
    return steps


def hold_faces(steps: list[list[tuple]], hold: int = FACE_HOLD_STEPS) -> list[list[tuple]]:
    """Fill short detection gaps: a step with no face keeps the last faces for ≤ hold steps."""
    out: list[list[tuple]] = []
    last: list[tuple] = []
    miss = 0
    for faces in steps:
        if faces:
            last, miss = faces, 0
            out.append(faces)
        elif last and miss < hold:
            miss += 1
            out.append(last)
        else:
            out.append([])
    return out


def face_mask_frames(steps: list[list[tuple]], w: int, h: int, path: Path) -> tuple[int, int, int]:
    """Gray mask frames (layer_fx mask grid) — union of feathered ellipses per step."""
    import numpy as np

    from clips_worker.layer_fx import mask_alpha, mask_grid

    mw, mh = mask_grid(w, h)
    with Path(path).open("wb") as fh:
        for faces in steps:
            m = np.zeros((mh, mw), dtype=np.uint8)
            for cx, cy, fw, fhh in faces:
                g = {"x": cx * 100, "y": cy * 100, "w": fw * 100 * FACE_PAD_W, "h": fhh * 100 * FACE_PAD_H,
                     "rot": 0, "feather": FACE_FEATHER}
                m = np.maximum(m, mask_alpha("ellipse", g, False, w, h))
            fh.write(m.tobytes())
    return mw, mh, len(steps)


def blur_graph(regions: list[tuple[dict, int, int, int, int]], w: int, h: int) -> tuple[str, str]:
    """regions: (region, input index, mask w, mask h, frames). → (graph, out label)."""
    parts: list[str] = []
    cur = "0:v"
    for i, (rg, mi, _mw, _mh, nfr) in enumerate(regions):
        s, e = rg["startMs"] / 1000, rg["endMs"] / 1000
        sig = blur_sigma(rg["amount"], w, h)
        pad = max(0.0, (e - s) - nfr / 10.0) + 1.0
        parts.append(f"[{cur}]split[r{i}a][r{i}b]")
        parts.append(f"[r{i}b]trim=start={s:.3f}:end={e:.3f},gblur=sigma={sig:.3f}:steps=3,format=yuv420p[r{i}bl]")
        parts.append(f"[{mi}:v]setpts=PTS-STARTPTS+{s:.3f}/TB,tpad=stop_mode=clone:stop_duration={pad:.3f},"
                     f"fps=30,scale={w}:{h}:flags=bilinear,format=gray[r{i}m]")
        parts.append(f"[r{i}bl][r{i}m]alphamerge,format=yuva420p[r{i}x]")
        parts.append(f"[r{i}a][r{i}x]overlay=0:0:eof_action=pass:enable='between(t,{s:.3f},{e:.3f})'[r{i}o]")
        cur = f"r{i}o"
    return ";".join(parts), cur


def apply_blur_regions(src: Path, out: Path, edits: dict, w: int, h: int, work_dir: Path, detector=None) -> bool:
    from clips_worker.layer_fx import write_mask_frames

    regions = normalize_blur_regions(edits.get("blurRegions"))
    if not regions or w <= 0 or h <= 0:
        return False
    wd = Path(work_dir)
    rows: list[tuple[dict, int, int, int, int]] = []
    inputs: list[str] = []
    n_faces = 0
    for i, rg in enumerate(regions):
        mpath = wd / f"blur_mask_{i}.gray"
        dur_s = (rg["endMs"] - rg["startMs"]) / 1000
        steps = None
        if rg["mode"] == "faces":
            try:
                steps = detect_face_steps(Path(src), rg["startMs"], rg["endMs"], detector)
            except Exception as exc:
                print(f"[g4c:blur] face_detect_failed region={rg['id']} err={type(exc).__name__}", flush=True)
                steps = None
            if steps is None:
                print(f"[g4c:blur] faces unavailable region={rg['id']} → manual mask", flush=True)
        if steps is not None:
            steps = hold_faces(steps)
            n_faces += sum(len(s) for s in steps)
            mw, mh, nfr = face_mask_frames(steps, w, h, mpath)
        else:
            _, mw, mh, nfr = write_mask_frames(rg["mask"], dur_s, w, h, mpath)
        inputs += ["-f", "rawvideo", "-pix_fmt", "gray", "-video_size", f"{mw}x{mh}", "-framerate", "10", "-i", str(mpath)]
        rows.append((rg, i + 1, mw, mh, nfr))
    graph, label = blur_graph(rows, w, h)
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), *inputs, "-filter_complex", f"{graph};[{label}]format=yuv420p[bv]",
         "-map", "[bv]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", str(out)],
        check=True)
    print(f"[g4c:blur] regions={len(regions)} face_boxes={n_faces}", flush=True)
    return True
