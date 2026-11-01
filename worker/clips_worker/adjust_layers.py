"""G4a adjustment layers (mirror of new-app/lib/clips/editor/adjust-layers.ts).

``edits.adjustLayers = [{id, startMs, endMs, spec}]`` (output ms). A layer grades everything below
it — the main video and the overlay (B-roll) tracks — for its span; text, captions and the export
template stay on top (CapCut). Layers stack in list order (later = applied last). Spec = a
ColorSpec without HSL ranges / user LUT (G4b); keyframes: target ``adjust:<id>``, color props only,
local ms from the layer start, stepped like every color keyframe (color_grade.COLOR_STEP_MS).

Export: one pass after the B-roll stage (before captions / text burn): per layer one lut3d per
distinct stepped look + its sharpen / vignette / grain, each gated by ``enable`` windows.
CV-17c: layers with mask/blend on ``adjust:<id>`` are skipped in the plain loop and applied after.
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


def _adjust_has_fx(edits: dict, layer_id: str) -> bool:
    from clips_worker.layer_fx import layer_fx_for

    lfx = layer_fx_for(edits, f"adjust:{layer_id}")
    return bool(lfx.get("mask") or lfx.get("blend"))


def adjust_graph(edits: dict, w: int, h: int, work_dir: Path) -> tuple[str, str, list] | None:
    from clips_worker.color import _lut_for, is_pointwise_identity, look_key, write_cube
    from clips_worker.color_fx import enable_expr, fx_groups, fx_parts
    from clips_worker.color_grade import color_tracks, has_fx, has_fx_tracks, stepped_windows
    from clips_worker.layer_fx import blend_composite, layer_fx_for, write_mask_frames

    if adjust_hidden(edits):
        return None
    layers = normalize_adjust_layers(edits.get("adjustLayers"))
    parts: list[str] = []
    extra_inputs: list = []
    label = "0:v"
    n_in = 1
    n = 0
    plain = [ly for ly in layers if not _adjust_has_fx(edits, ly["id"])]
    fx_layers = [ly for ly in layers if _adjust_has_fx(edits, ly["id"])]
    for i, ly in enumerate(plain):
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
        if has_fx_tracks(tracks):
            for gi, (fx, spans) in enumerate(fx_groups(wins)):
                en = enable_expr([(a / 1000, b / 1000) for a, b in spans])
                parts += fx_parts(label, f"af{i}_{gi}", fx, w, h, Path(work_dir), f"afx{i}_{gi}", en)
                label = f"af{i}_{gi}"
                n += 1
        elif has_fx(ly["spec"]):
            en = enable_expr([(ly["startMs"] / 1000, ly["endMs"] / 1000)])
            parts += fx_parts(label, f"af{i}", ly["spec"].get("fx") or {}, w, h, Path(work_dir), f"afx{i}", en)
            label = f"af{i}"
            n += 1
    for j, ly in enumerate(fx_layers):
        lfx = layer_fx_for(edits, f"adjust:{ly['id']}")
        s0, s1 = ly["startMs"] / 1000, ly["endMs"] / 1000
        tag = f"xf{j}"
        parts.append(f"[{label}]split[{tag}u][{tag}g0]")
        spec = ly["spec"]
        cube = write_cube(spec, Path(work_dir) / f"adj_fx_{j}.cube", lut=_lut_for(edits, spec))
        parts.append(
            f"[{tag}g0]lut3d=file='{cube}':enable='between(t,{s0:.3f},{s1:.3f})'[{tag}g]"
        )
        graded = f"{tag}g"
        if lfx.get("mask"):
            dur = max(0.1, s1 - s0)
            mpath, mw, mh, nfr = write_mask_frames(lfx["mask"], dur, w, h, Path(work_dir) / f"adj_mask_{j}.gray")
            extra_inputs.extend(["-f", "rawvideo", "-pix_fmt", "gray", "-video_size", f"{mw}x{mh}",
                                 "-framerate", "10", "-i", str(mpath)])
            mi = n_in
            n_in += 1
            pad = max(0.0, dur - nfr / 10.0) + 1.0
            parts.append(
                f"[{mi}:v]setpts=PTS-STARTPTS+{s0:.3f}/TB,tpad=stop_mode=clone:stop_duration={pad:.3f},"
                f"fps=30,scale={w}:{h}:flags=bilinear,format=gray[{tag}m]"
            )
            parts.append(f"[{graded}][{tag}m]alphamerge[{tag}k]")
            graded = f"{tag}k"
        mode = lfx.get("blend") or "normal"
        if mode != "normal":
            label = blend_composite(parts, f"{tag}u", graded, f"{tag}o", mode, w, h, s0, s1)
        else:
            parts.append(
                f"[{tag}u][{graded}]overlay=0:0:format=auto:enable='between(t,{s0:.3f},{s1:.3f})'[{tag}o]"
            )
            label = f"{tag}o"
        n += 1
    if not n:
        return None
    return ";".join(parts), label, extra_inputs


def apply_adjust_layers(src: Path, out: Path, edits: dict, w: int, h: int, work_dir: Path) -> bool:
    g = adjust_graph(edits, w, h, work_dir)
    if not g:
        return False
    graph, label, extra = g
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src), *extra, "-filter_complex",
           f"{graph};[{label}]format=yuv420p[av]", "-map", "[av]", "-map", "0:a?", "-c:v", "libx264",
           "-preset", "veryfast", "-crf", "18", "-c:a", "copy", str(out)]
    subprocess.check_call(cmd)
    print(f"[clipper:adjust] layers={len(normalize_adjust_layers(edits.get('adjustLayers')))}", flush=True)
    return True
