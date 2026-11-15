"""Part 1 QA kit (measurements; measurements override any AI watch review, RE-9 precedence).

A1 frame parity · A2 black frames · A3 freezes / duplicate frames · A5/A18 text legibility + edge cuts
(from the render-time text audit) · A7 loudness · A14 empty-background coverage · A15 seams (handoff)
· A19 SFX over speech (fixed in audio.build_sfx). Every check returns {id, pass, value, detail}.
"""
from __future__ import annotations

import ast
import os
import re
import subprocess

import numpy as np

from clips_worker.motion_studio.core.render import ffprobe_frames


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
    from clips_worker.motion_studio.core.world import HOUSE
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
    """A14: fraction of the frame that is a flat field (low local variance). Empty flyovers fail."""
    from PIL import Image
    worst = 0.0
    for s in stills or []:
        try:
            im = np.asarray(Image.open(s["path"]).convert("L").resize((192, 108)), np.float32)
        except Exception:  # noqa: BLE001
            continue
        gy, gx = np.gradient(im)
        edge = np.abs(gx) + np.abs(gy)
        flat = float((edge < 1.2).mean())
        # A nearly black, low-edge frame (dark ocean / empty grid) is empty even if
        # a little noise keeps the flat fraction just under the threshold.
        if float(im.mean()) < 28 and float(edge.mean()) < 2.0:
            flat = max(flat, 0.95)
        worst = max(worst, flat)
    return _chk("A14", worst <= max_flat, round(worst, 3), "flat-field coverage of the emptiest still", "error")


def loudness_check(meas: dict) -> dict:
    from clips_worker.motion_studio.core.world import HOUSE
    ok = bool(meas.get("I") is not None and abs(meas["I"] - HOUSE["lufs"]) <= 1.0 and meas.get("TP", 0) <= HOUSE["true_peak"] + 0.05)
    return _chk("A7", ok, {"I": meas.get("I"), "TP": meas.get("TP")}, f"target {HOUSE['lufs']} LUFS / TP {HOUSE['true_peak']}")


def seam_check(handoffs: list[dict]) -> dict:
    bad = [h.get("segmentId") for h in handoffs
           if not h.get("decodeVerified") or not h.get("seamScores") or h.get("seamPass") is False]
    return _chk("A15", not bad, len(bad), f"handoff seams failing ST-CMH-014 or unverified: {bad[:5]}")


def scene_verdict(checks: list[dict]) -> str:
    return "pass" if all(c["pass"] or c.get("severity") == "warn" for c in checks) else "fail"



# ------------------------------------------------------------------ ST-BLK-19 contact sheet + motion strips; ST-RW-003 number audit

_NUM = re.compile(
    r"(?P<sym>[$€£])?\s*(?P<num>\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?P<suf>billion|million|thousand|percent|bn|mm|m|k|%)?",
    re.I,
)
_WORD_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100, "thousand": 1000,
    "million": 1_000_000, "billion": 1_000_000_000,
}
_SUF = {"billion": 1e9, "bn": 1e9, "million": 1e6, "mm": 1e6, "m": 1e6, "thousand": 1e3, "k": 1e3,
        "percent": 1, "%": 1}


def parse_written_numbers(text: str) -> list[float]:
    """Extract numeric values from display text ($2.2M, 140%, 6,000,000)."""
    out = []
    for m in _NUM.finditer(text or ""):
        raw = m.group("num").replace(",", "")
        try:
            v = float(raw)
        except ValueError:
            continue
        suf = (m.group("suf") or "").lower()
        if suf in _SUF and suf not in ("percent", "%"):
            v *= _SUF[suf]
        out.append(v)
    return out


def parse_spoken_numbers(spoken: str) -> list[float]:
    """Extract values from spoken-form narration ('six million', 'one hundred forty percent')."""
    toks = re.findall(r"[a-z]+", (spoken or "").lower().replace("-", " "))
    out, acc, stacked = [], 0.0, False
    def flush():
        nonlocal acc, stacked
        if stacked:
            out.append(acc)
        acc, stacked = 0.0, False
    i = 0
    while i < len(toks):
        w = toks[i]
        if w not in _WORD_NUM:
            flush()
            i += 1
            continue
        n = float(_WORD_NUM[w])
        if n >= 1000 and stacked:
            acc = (acc or 1) * n
        elif n == 100 and stacked:
            acc = (acc or 1) * 100
        else:
            acc += n
        stacked = True
        i += 1
    flush()
    return out


def numbers_close(a: float, b: float) -> bool:
    if a == b:
        return True
    return abs(a - b) <= max(0.51, 0.01 * max(abs(a), abs(b)))


def rolling_numbers_from_code(code: str) -> list[dict]:
    """Read RollingNumber v0/v1 (and prefix/suffix) from generated scene code."""
    out = []
    try:
        tree = ast.parse(code or "")
    except SyntaxError:
        return out
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        name = ""
        if isinstance(node.func, ast.Name):
            name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            name = node.func.attr
        if name != "RollingNumber":
            continue
        kw = {k.arg: k.value for k in node.keywords if k.arg}

        def num_at(pos, key):
            src = kw.get(key)
            if src is None and pos < len(node.args):
                src = node.args[pos]
            if isinstance(src, ast.Constant) and isinstance(src.value, (int, float)):
                return float(src.value)
            if isinstance(src, ast.UnaryOp) and isinstance(src.op, ast.USub) and isinstance(src.operand, ast.Constant):
                return -float(src.operand.value)
            return None

        def str_at(key):
            src = kw.get(key)
            if isinstance(src, ast.Constant) and isinstance(src.value, str):
                return src.value
            return ""

        v1 = num_at(4, "v1")
        if v1 is None:
            continue
        out.append({"v0": num_at(3, "v0"), "v1": v1, "prefix": str_at("prefix"), "suffix": str_at("suffix")})
    return out


def spoken_number_check(story: dict, codes: dict[int, str], plan: dict | None = None) -> dict:
    """N1 / ST-RW-003: an on-screen RollingNumber must match the number the line actually speaks.

    Catches the class of error in the Keef film ($2.2M on screen vs 'six million' spoken).
    """
    by_id = {l["id"]: l for l in story.get("lines") or []}
    data_by_line = {}
    for d in story.get("data") or []:
        if d.get("lineId") is not None:
            data_by_line.setdefault(d["lineId"], []).append(float(d["value"]))
    mismatches = []
    scenes = (plan or {}).get("scenes") or []
    for idx, code in (codes or {}).items():
        rolls = rolling_numbers_from_code(code)
        if not rolls:
            continue
        sc = next((s for s in scenes if s.get("index") == idx), {}) or {}
        line_ids = sc.get("lineIds") or []
        expected = []
        for lid in line_ids:
            l = by_id.get(lid) or {}
            expected.extend(parse_written_numbers(l.get("text") or ""))
            expected.extend(parse_spoken_numbers(l.get("spoken") or ""))
            expected.extend(data_by_line.get(lid) or [])
        expected = list(dict.fromkeys(expected))
        if not expected:
            continue
        for r in rolls:
            if not any(numbers_close(r["v1"], e) for e in expected):
                mismatches.append({"scene": idx, "shown": r["v1"], "spoken": expected[:6]})
    ok = not mismatches
    detail = "; ".join(f"scene {m['scene']+1} shows {m['shown']:g} but the line speaks {m['spoken']}" for m in mismatches[:6])
    if not mismatches and not any(rolling_numbers_from_code(c) for c in (codes or {}).values()):
        detail = "no RollingNumber in scene code"
    return _chk("N1", ok, len(mismatches), detail or "on-screen numbers match the narration")


def contact_sheet(paths: list[str], out: str, cols: int = 3, cell: tuple[int, int] = (640, 360)) -> str:
    """ST-BLK-19 / ST-QA-A1: labelled grid of stills, same idea as the reference sheet.py."""
    from PIL import Image, ImageDraw, ImageFont
    paths = [p for p in paths if p and os.path.exists(p)]
    if not paths:
        raise ValueError("no stills for contact sheet")
    w, h = cell
    cols = max(1, cols)
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w, rows * h), (40, 40, 40))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for i, path in enumerate(paths):
        im = Image.open(path).convert("RGB").resize((w, h))
        d = ImageDraw.Draw(im)
        label = os.path.basename(path)
        d.rectangle((4, 4, 8 + d.textlength(label, font=font), 24), fill=(0, 0, 0))
        d.text((8, 6), label, fill=(255, 255, 0), font=font)
        sheet.paste(im, ((i % cols) * w, (i // cols) * h))
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    sheet.save(out, quality=88)
    return out


def _grab(video: str, t: float, dest: str) -> bool:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{max(0.0, t):.3f}",
                        "-i", video, "-frames:v", "1", dest], capture_output=True, text=True)
    return r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 0


def motion_strip(video: str, t: float, out: str, *, pre: float = 0.4, post: float = 0.8, frames: int = 8,
                 cell_w: int = 240) -> str | None:
    """ST-BLK-19: −400 to +800 ms around a hit word, as a horizontal strip."""
    from PIL import Image
    start = max(0.0, t - pre)
    dur = pre + post
    fps = max(2, frames) / max(0.2, dur)
    tmp = out + ".frames"
    os.makedirs(tmp, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{start:.3f}", "-i", video,
                        "-t", f"{dur:.3f}", "-vf", f"fps={fps:.4f},scale={cell_w}:-2", os.path.join(tmp, "%02d.jpg")],
                       capture_output=True, text=True)
    files = sorted(f for f in (os.path.join(tmp, n) for n in os.listdir(tmp) if n.endswith(".jpg")) if os.path.exists(f))
    if r.returncode != 0 or len(files) < 2:
        return None
    ims = [Image.open(f).convert("RGB") for f in files]
    h = ims[0].height
    strip = Image.new("RGB", (sum(i.width for i in ims), h), (20, 20, 20))
    x = 0
    for im in ims:
        strip.paste(im, (x, 0))
        x += im.width
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    strip.save(out, quality=88)
    return out


def hit_word_times(lay: dict, story: dict, plan: dict | None = None) -> list[tuple[float, str, str]]:
    """Program times of hero / emphasis ('hit') words for strips and the contact sheet."""
    heroes = {l["id"]: (l.get("hero") or "").lower() for l in story.get("lines") or []}
    emph = []
    for s in (plan or {}).get("scenes") or []:
        lids = [str(x) for x in (s.get("lineIds") or [])]
        for e in s.get("emphasis") or []:
            if isinstance(e, str) and e.strip():
                word, line = e.strip().lower(), None
            elif isinstance(e, dict):
                word = str(e.get("word") or e.get("text") or e.get("w") or "").strip().lower()
                line = e.get("lineId") or e.get("line")
                line = str(line) if line else None
            else:
                continue
            if not word:
                continue
            # Bare words from the director have no lineId; attach them to every line in the scene.
            targets = [line] if line else (lids or [None])
            for lid in targets:
                emph.append((lid, word))
    out = []
    seen = set()
    for w in lay.get("words") or []:
        lid, tok = str(w.get("line") or ""), re.sub(r"[^a-z0-9]", "", (w.get("w") or "").lower())
        if not lid or not tok:
            continue
        hero = heroes.get(lid) or ""
        hit = tok in re.sub(r"[^a-z0-9 ]", "", hero) or any(tok in re.sub(r"[^a-z0-9]", "", word) or word.startswith(tok)
                                                            for line, word in emph if line is None or line == lid)
        if not hit:
            continue
        key = (round(float(w["s"]), 1), lid)
        if key in seen:
            continue
        seen.add(key)
        out.append((float(w["s"]), lid, w.get("w") or tok))
    return out


def export_qa_artifacts(master: str, dest: str, lay: dict, story: dict, plan: dict,
                        codes: dict[int, str] | None = None) -> dict:
    """Build contact sheet + hit-word strips and run the spoken-vs-screen number check."""
    os.makedirs(dest, exist_ok=True)
    files, stills = [], []
    midpoints = []
    for sc in lay.get("scenes") or []:
        midpoints.append((0.5 * (float(sc.get("startS") or 0) + float(sc.get("endS") or 0)), f"scene_{sc.get('index', 0):03d}"))
    hits = hit_word_times(lay, story, plan)
    samples = midpoints + [(t, f"hit_{lid}_{re.sub(r'[^a-zA-Z0-9]+', '', tok)[:16]}") for t, lid, tok in hits]
    # de-dupe times within 0.15 s
    kept, last = [], -99.0
    for t, name in sorted(samples, key=lambda x: x[0]):
        if t - last < 0.15:
            continue
        kept.append((t, name))
        last = t
    for i, (t, name) in enumerate(kept[:36]):
        path = os.path.join(dest, f"{i:02d}_{name}.jpg")
        if _grab(master, t, path):
            stills.append(path)
    sheet = os.path.join(dest, "contact_sheet.jpg")
    sheet_ok = False
    if stills:
        try:
            contact_sheet(stills, sheet, cols=3)
            sheet_ok = os.path.exists(sheet)
            if sheet_ok:
                files.append((sheet, "contact_sheet.jpg", "image/jpeg"))
        except Exception:  # noqa: BLE001
            sheet_ok = False
    for t, lid, tok in hits[:24]:
        safe = re.sub(r"[^a-zA-Z0-9]+", "", tok)[:16] or "hit"
        path = os.path.join(dest, f"strip_{lid}_{safe}_{t:.2f}.jpg")
        if motion_strip(master, t, path):
            files.append((path, os.path.basename(path), "image/jpeg"))
    checks = [
        _chk("SHEET", sheet_ok, len(stills), "contact sheet + stills around scenes and hit words" if sheet_ok else "contact sheet could not be written",
             "warn"),
        spoken_number_check(story, codes or {}, plan),
    ]
    return {"checks": checks, "files": files, "stills": stills}


def degraded_scenes_check(scenes: list[dict] | None) -> dict:
    """A completed film must not silently ship fallback or otherwise degraded scenes."""
    bad = []
    for s in scenes or []:
        qa_blob = s.get("qa") or {}
        if s.get("usedFallback") or qa_blob.get("degraded") or qa_blob.get("verdict") == "degraded":
            bad.append({"index": s.get("index"), "cause": qa_blob.get("degradeCause") or "framework fallback"})
    return _chk("F1", not bad, bad, ("degraded scenes: " + ", ".join(f"s{b['index']}" for b in bad)) if bad else "no degraded scenes")


def unexplained_repetition_check(plan: dict | None) -> dict:
    """The same still/clip repeating without a narrative reuseReason fails film QA."""
    manifest = ((plan or {}).get("assetUsageManifest")
                or ((plan or {}).get("blueprint") or {}).get("assetUsageManifest") or {})
    bad = []
    for e in manifest.get("entries") or []:
        uses = e.get("usedIn") or []
        if len(uses) > 1 and any(not u.get("reuseReason") for u in uses[1:]):
            bad.append(e.get("assetId"))
    if not manifest:
        # Fall back to scene assignments when the manifest is missing.
        seen = {}
        for s in (plan or {}).get("scenes") or []:
            aid = s.get("assetId") or ((s.get("handoff") or {}).get("assetId") if isinstance(s.get("handoff"), dict) else None)
            if not aid:
                continue
            seen.setdefault(aid, []).append(s)
        for aid, rows in seen.items():
            if len(rows) > 1 and any(not r.get("reuseReason") for r in rows[1:]):
                bad.append(aid)
    return _chk("F2", not bad, bad, ("unexplained repeats: " + ", ".join(str(x) for x in bad)) if bad else "no unexplained repeats")


def unused_uploads_check(plan: dict | None, catalog: list[dict] | None = None) -> dict:
    """Every relevant ready upload should appear in the authoritative usage manifest."""
    manifest = ((plan or {}).get("assetUsageManifest")
                or ((plan or {}).get("blueprint") or {}).get("assetUsageManifest") or {})
    unused = list(manifest.get("unused") or [])
    if catalog and not manifest:
        used = set()
        for s in (plan or {}).get("scenes") or []:
            if s.get("assetId"):
                used.add(s["assetId"])
            h = s.get("handoff") or {}
            if isinstance(h, dict) and h.get("assetId"):
                used.add(h["assetId"])
        unused = [a["id"] for a in catalog if a.get("id") not in used and a.get("kind") in ("image", "video")]
    return _chk("F3", not unused, unused, ("unused uploads: " + ", ".join(unused)) if unused else "every inventory upload is used")


def film_quality(plan: dict | None, scenes: list[dict] | None, catalog: list[dict] | None = None) -> list[dict]:
    """Whole-film technical+allocation QA, reported separately from creative quality."""
    return [
        degraded_scenes_check(scenes),
        unexplained_repetition_check(plan),
        unused_uploads_check(plan, catalog),
    ]


def film_pass(checks: list[dict], scenes: list[dict] | None = None) -> bool:
    if any(not (c.get("pass") or c.get("severity") == "warn") for c in checks or []):
        return False
    if scenes and any(
        s.get("usedFallback") or (s.get("qa") or {}).get("degraded") or (s.get("qa") or {}).get("verdict") == "degraded"
        for s in scenes
    ):
        return False
    return True
