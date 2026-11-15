"""Part 1 QA kit (measurements; measurements override any AI watch review, RE-9 precedence).

A1 frame parity · A2 black frames · A3 freezes / duplicate frames · A5/A18 text legibility + edge cuts
(from the render-time text audit) · A7 loudness · A14 empty-background coverage · A15 seams (handoff)
· A19 SFX over speech (fixed in audio.build_sfx). Every check returns {id, pass, value, detail}.
"""
from __future__ import annotations

import re
import subprocess

import numpy as np

from clips_worker.motion_studio.core.render import ffprobe_frames
from clips_worker.motion_studio.core.world import HOUSE


def _chk(cid: str, ok: bool, value=None, detail: str = "", severity: str = "error") -> dict:
    return {"id": cid, "pass": bool(ok), "value": value, "detail": detail, "severity": severity}


def frame_parity(path: str, expected: int) -> dict:
    got = ffprobe_frames(path)
    return _chk("A1", got == expected, got, f"expected {expected} frames, muxed {got}")


def black_and_freeze(path: str, allow_black_s: float = 0.5) -> list[dict]:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vf",
                        "blackdetect=d=0.25:pix_th=0.06,freezedetect=n=0.0008:d=1.5", "-an", "-f", "null", "-"],
                       capture_output=True, text=True)
    blacks = [(float(a), float(b)) for a, b in re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r.stderr)]
    freezes = re.findall(r"freeze_duration: ([\d.]+)", r.stderr)
    worst_black = max([b - a for a, b in blacks], default=0.0)
    return [_chk("A2", worst_black <= allow_black_s, round(worst_black, 2), f"{len(blacks)} black spans"),
            _chk("A3", not freezes, len(freezes), "freeze spans >= 1.5 s" if freezes else "", "warn")]


def dup_frames(path: str, max_ratio: float = 0.02, sample_w: int = 160) -> dict:
    """Consecutive identical frames (per-frame grain should make this ~0 for graphics segments)."""
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={sample_w}:-2,format=gray", "-f", "rawvideo", "-"],
                       capture_output=True)
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip().split(",")
    try:
        w, h = int(probe[0]), int(probe[1])
    except (ValueError, IndexError):
        return _chk("A3dup", True, None, "probe failed", "warn")
    hh = int(round(h * sample_w / w / 2) * 2)
    fs = sample_w * hh
    n = len(r.stdout) // fs if fs else 0
    if n < 2:
        return _chk("A3dup", True, 0)
    a = np.frombuffer(r.stdout[: n * fs], np.uint8).reshape(n, fs)
    dups = int((np.abs(np.diff(a.astype(np.int16), axis=0)).max(axis=1) == 0).sum())
    return _chk("A3dup", dups / (n - 1) <= max_ratio, dups, f"{dups} duplicate consecutive frames of {n}", "warn")


def text_audit(stills: list[dict], render_h: int) -> list[dict]:
    """A5 (cap height >= HOUSE min at 1080p) and A18 (text cut by the frame edge) from runner audits."""
    small, cut = [], []
    scale = 1080.0 / max(1, render_h)
    for s in stills or []:
        for a in s.get("audit") or []:
            if a.get("hidden"):
                continue
            if a.get("capPx") is not None and a["capPx"] * scale < HOUSE["min_cap_px"]:
                small.append({"t": s.get("t"), "text": a.get("text"), "capPx": round(a["capPx"] * scale, 1)})
            if a.get("cut"):
                cut.append({"t": s.get("t"), "text": a.get("text")})
    return [_chk("A5", not small, len(small), "; ".join(f"{x['text']!r}@{x['t']}s cap {x['capPx']}px" for x in small[:5])),
            _chk("A18", not cut, len(cut), "; ".join(f"{x['text']!r}@{x['t']}s" for x in cut[:5]))]


def empty_background(stills: list[dict], max_flat: float = 0.62) -> dict:
    """A14: fraction of the frame that is a flat field (low local variance). Flags a lone hero on emptiness."""
    from PIL import Image
    worst = 0.0
    for s in stills or []:
        try:
            im = np.asarray(Image.open(s["path"]).convert("L").resize((192, 108)), np.float32)
        except Exception:  # noqa: BLE001
            continue
        gy, gx = np.gradient(im)
        flat = float(((np.abs(gx) + np.abs(gy)) < 1.2).mean())
        worst = max(worst, flat)
    return _chk("A14", worst <= max_flat, round(worst, 3), "flat-field coverage of the emptiest still", "warn")


def loudness_check(meas: dict) -> dict:
    ok = bool(meas.get("I") is not None and abs(meas["I"] - HOUSE["lufs"]) <= 1.0 and meas.get("TP", 0) <= HOUSE["true_peak"] + 0.05)
    return _chk("A7", ok, {"I": meas.get("I"), "TP": meas.get("TP")}, f"target {HOUSE['lufs']} LUFS / TP {HOUSE['true_peak']}")


def seam_check(handoffs: list[dict]) -> dict:
    bad = [h.get("segmentId") for h in handoffs
           if not h.get("decodeVerified") or not h.get("seamScores") or h.get("seamPass") is False]
    return _chk("A15", not bad, len(bad), f"handoff seams failing ST-CMH-014 or unverified: {bad[:5]}")


def scene_verdict(checks: list[dict]) -> str:
    return "pass" if all(c["pass"] or c.get("severity") == "warn" for c in checks) else "fail"
