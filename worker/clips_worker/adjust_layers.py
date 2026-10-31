"""G4a adjustment layers (mirror of new-app/lib/clips/editor/adjust-layers.ts).

``edits.adjustLayers = [{id, startMs, endMs, spec}]`` (output ms). A layer grades everything below
it — the main video and the overlay (B-roll) tracks — for its span; text, captions and the export
template stay on top (CapCut). Layers stack in list order (later = applied last). Spec = a
ColorSpec without HSL ranges / user LUT (G4b); keyframes: target ``adjust:<id>``, color props only,
local ms from the layer start, stepped like every color keyframe (color_grade.COLOR_STEP_MS).

Export: one pass after the B-roll stage (before captions / text burn): per layer one lut3d per
distinct stepped look + its sharpen / vignette / grain, each gated by ``enable`` windows.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

ADJUST_MAX = 20
ADJUST_MIN_MS = 100


def normalize_adjust_layers(raw) -> list[dict]:
    from clips_worker.color import normalize_spec

    out: list[dict] = []
    seen: set[str] = set()
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict):
            continue
        lid = r.get("id")
        if not isinstance(lid, str) or not lid or len(lid) > 64 or lid in seen:
            continue
        try:
            a = math.floor(float(r.get("startMs")) + 0.5)
            b = math.floor(float(r.get("endMs")) + 0.5)
        except (TypeError, ValueError, OverflowError):
            continue
        if a < 0 or b - a < ADJUST_MIN_MS:
            continue
        spec = r.get("spec") if isinstance(r.get("spec"), dict) else {}
        spec = {k: v for k, v in spec.items() if k not in ("hsl", "lut")}
        seen.add(lid)
        out.append({"id": lid, "startMs": a, "endMs": b, "spec": normalize_spec(spec) or {}})
        if len(out) >= ADJUST_MAX:
            break
    return out


def adjust_hidden(edits: dict) -> bool:
    lanes = edits.get("timelineLanes") if isinstance(edits.get("timelineLanes"), dict) else {}
    st = lanes.get("adjust") if isinstance(lanes.get("adjust"), dict) else {}
    return st.get("hidden") is True


def adjust_graph(edits: dict, w: int, h: int, work_dir: Path) -> tuple[str, str] | None:
    from clips_worker.color import _lut_for, is_pointwise_identity, look_key, write_cube
    from clips_worker.color_fx import enable_expr, fx_parts
    from clips_worker.color_grade import color_tracks, has_fx, stepped_windows

    if adjust_hidden(edits):
        return None
    layers = normalize_adjust_layers(edits.get("adjustLayers"))
    parts: list[str] = []
    label = "0:v"
    n = 0
    for i, ly in enumerate(layers):
        tracks = color_tracks(edits, f"adjust:{ly['id']}")
        wins = stepped_windows(ly["spec"], tracks, ly["startMs"], ly["endMs"], origin=ly["startMs"])
        by_key: dict[str, list] = {}
        for a, b, spec in wins:
            if is_pointwise_identity(spec):
                continue
            by_key.setdefault(look_key(spec), [spec, []])[1].append((a / 1000, b / 1000))
        chain = [
            f"lut3d=file='{write_cube(spec, Path(work_dir) / f'adj_{i}_{k}.cube', lut=_lut_for(edits, spec))}'"
            f":enable='{enable_expr(spans)}'"
            for k, (spec, spans) in by_key.items()
        ]
        if chain:
            parts.append(f"[{label}]{','.join(chain)}[al{i}]")
            label = f"al{i}"
            n += 1
        if has_fx(ly["spec"]):
            en = enable_expr([(ly["startMs"] / 1000, ly["endMs"] / 1000)])
            parts += fx_parts(label, f"af{i}", ly["spec"].get("fx") or {}, w, h, Path(work_dir), f"afx{i}", en)
            label = f"af{i}"
            n += 1
    if not n:
        return None
    return ";".join(parts), label


def apply_adjust_layers(src: Path, out: Path, edits: dict, w: int, h: int, work_dir: Path) -> bool:
    g = adjust_graph(edits, w, h, work_dir)
    if not g:
        return False
    graph, label = g
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-filter_complex", f"{graph};[{label}]format=yuv420p[av]",
         "-map", "[av]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy",
         str(out)]
    )
    print(f"[clipper:adjust] layers={len(normalize_adjust_layers(edits.get('adjustLayers')))}", flush=True)
    return True
