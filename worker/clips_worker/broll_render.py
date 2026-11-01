"""FFmpeg B-roll overlay filtergraph for export."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from clips_worker.ffmpeg_util import run_ffmpeg


def probe_video_duration_s(video: Path) -> float | None:
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(video),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        val = float((proc.stdout or "").strip())
        return val if val > 0.05 else None
    except Exception:
        return None


def clip_window_duration_s(spec: dict) -> float:
    return max(0.1, float(spec["end_s"]) - float(spec["start_s"]))


def detect_letterbox_crop(video: Path) -> str | None:
    """Median cropdetect box from first ~2s (removes baked-in black bars)."""
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-i",
                str(video),
                "-t",
                "2",
                "-vf",
                "cropdetect=24:16:0",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
        )
        out = proc.stderr or ""
    except Exception:
        out = ""
    crops = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", out)
    if not crops:
        return None
    crops.sort()
    mid = crops[len(crops) // 2]
    w, h, x, y = mid
    if int(w) < 80 or int(h) < 80:
        return None
    return f"crop={w}:{h}:{x}:{y}"


def build_broll_filtergraph(
    broll_specs: list[dict],
    width: int,
    height: int,
    edits: dict | None = None,
    cmd_dir: Path | None = None,
) -> tuple[str, list[str], str]:
    """
    broll_specs: [{local_path, start_s, end_s, duration_s, in_s?, id?}]
    start_s/end_s are OUTPUT seconds; in_s (E2) is the B-roll media in-point shown at start_s.
    E3 (edits given): per-item keyframes (target broll:<id>, local = output − start) and edge /
    between transitions rendered with xfade on the composite (see motion.broll_transition_windows).
    Returns (filter_complex, extra_input_args, final_video_label)
    """
    if not broll_specs:
        return "", [], "0:v"

    from clips_worker.motion import broll_transition_windows, broll_visible_end_ms, has_layer_fx, layer_z

    if edits is not None:
        # Time order = overlay order, so a 'between' window's outgoing item is already composited.
        broll_specs = sorted(broll_specs, key=lambda sp: float(sp["start_s"]))
        # G1a: bring forward / send back re-orders only items that overlap in time (stack_order keeps
        # adjacent items — and so every 'between' window — in time order).
        # G1b: overlay tracks composite bottom -> top (tracks.layer_order), G1a order inside each.
        from clips_worker.tracks import layer_order, spans_tracks

        keyed = [{"id": str(sp.get("id") or f"_{i}"), "startMs": round(float(sp["start_s"]) * 1000),
                  "endMs": round(float(sp["end_s"]) * 1000), "_sp": sp} for i, sp in enumerate(broll_specs)]
        if (edits.get("layerProps") or []) or spans_tracks(edits, "overlay", [k["id"] for k in keyed]):
            broll_specs = [k["_sp"] for k in layer_order(edits, "overlay", keyed, lambda bid: layer_z(edits, f"broll:{bid}"))]
    items = [
        {"id": str(sp.get("id") or f"_{i}"), "startMs": round(float(sp["start_s"]) * 1000),
         "endMs": round(float(sp["end_s"]) * 1000),
         **({k: sp[k] for k in ("transitionIn", "transitionOut") if sp.get(k)})}
        for i, sp in enumerate(broll_specs)
    ]
    windows = broll_transition_windows(items) if edits is not None else []
    parts: list[str] = ["[0:v]format=yuv420p[base]"]
    extra_inputs: list[str] = []
    current = "base"
    cmd_files: list[tuple[Path, str]] = []
    n_inputs = 1
    from clips_worker.layer_fx import despill_chain, key_chain, layer_fx_of, reversed_media, write_chroma_key_alpha_frames, write_mask_frames

    for i, spec in enumerate(broll_specs):
        clip_dur = clip_window_duration_s(spec)
        start = float(spec["start_s"])
        end = float(spec["end_s"])
        item = items[i]
        target = f"broll:{item['id']}"
        moving = edits is not None and spec.get("id") is not None and has_layer_fx(edits, target)
        my_windows = [w for w in windows if w["itemId"] == item["id"]]
        vis_end = broll_visible_end_ms(item, windows) / 1000.0
        if vis_end > end:
            clip_dur = clip_dur + (vis_end - end)  # feeds the next item's 'between' window
            end = vis_end
        inp = f"{n_inputs}:v"
        local = Path(spec["local_path"])
        in_s = max(0.0, float(spec.get("in_s") or 0.0))
        probed = probe_video_duration_s(local)
        if probed is not None and in_s < probed:
            clip_dur = min(clip_dur, probed - in_s)
        clip_dur = max(0.1, clip_dur)
        bar_crop = detect_letterbox_crop(local)
        bar_vf = f"{bar_crop}," if bar_crop else ""
        from clips_worker.color import broll_color_filter

        # E4: per-item color look; G4a: keyframed color windows + sharpen / vignette / grain.
        look = broll_color_filter(edits, item["id"], cmd_dir, w=width, h=height, tag=f"bc{i}", start_s=start,
                                  end_s=end)
        # G4b: mask / chroma key / blend / reverse (layer_fx). Items without them render as before.
        lfx = layer_fx_of(edits, item["id"]) if (edits is not None and spec.get("id") is not None) else {}
        loop_args = ["-stream_loop", "-1"]
        rev_pad = ""
        if lfx.get("reverse") and cmd_dir is not None:
            # Reversed copy of the item's own range (bars cropped, already w × h), played from 0; a
            # 'between' extension past the item's end holds the last (= in-point) frame.
            own = max(0.1, min(clip_dur, float(spec["end_s"]) - start))
            local = reversed_media(local, in_s, own, width, height, Path(cmd_dir) / f"rev{i}.mp4",
                                   pre_vf=bar_crop)
            in_s, bar_vf, loop_args = 0.0, "", []
            rev_pad = f"tpad=stop_mode=clone:stop_duration={clip_dur + 1:.3f},"
        trim = f"trim=0:{clip_dur:.3f}" if in_s <= 0 else f"trim={in_s:.3f}:{in_s + clip_dur:.3f}"
        head = (f"[{inp}]{rev_pad}{trim},setpts=PTS-STARTPTS+{start:.3f}/TB,"
                f"{bar_vf}"
                f"scale={width}:{height}:force_original_aspect_ratio=increase,"
                f"crop={width}:{height}")
        extra_inputs.extend([*loop_args, "-i", str(local)])
        n_inputs += 1
        if not (lfx.get("key") or lfx.get("mask")):
            parts.append(f"{head}{look},fps=30,format=yuv420p[b{i}]")
        else:
            # Alpha from the ungraded pixels (key) × the mask; colour from the graded chain.
            alphas: list[str] = []
            if lfx.get("key"):
                k = lfx["key"]
                parts.append(f"{head},fps=30,split=2[b{i}s0][b{i}s1]")
                parts.append(f"[b{i}s0]null{despill_chain(k)}{look},format=yuv420p[b{i}g]")
                if k.get("keys"):
                    kpath = Path(cmd_dir if cmd_dir is not None else ".") / f"keyalpha{i}.gray"
                    _, kmw, kmh, knfr = write_chroma_key_alpha_frames(local, in_s, clip_dur, width, height, k, kpath)
                    extra_inputs.extend(["-f", "rawvideo", "-pix_fmt", "gray", "-video_size", f"{kmw}x{kmh}",
                                         "-framerate", "10", "-i", str(kpath)])
                    ki = n_inputs
                    n_inputs += 1
                    pad = max(0.0, clip_dur - knfr / 10.0) + 1.0
                    parts.append(f"[{ki}:v]setpts=PTS-STARTPTS+{start:.3f}/TB,tpad=stop_mode=clone:"
                                 f"stop_duration={pad:.3f},fps=30,scale={width}:{height}:flags=bilinear,"
                                 f"format=gray[b{i}ka]")
                else:
                    parts.append(f"[b{i}s1]{key_chain(k)[1:]},alphaextract[b{i}ka]")
                alphas.append(f"b{i}ka")
            else:
                parts.append(f"{head},fps=30{look},format=yuv420p[b{i}g]")
            if lfx.get("mask"):
                mpath = Path(cmd_dir if cmd_dir is not None else ".") / f"mask{i}.gray"
                _, mw, mh, nfr = write_mask_frames(lfx["mask"], clip_dur, width, height, mpath)
                extra_inputs.extend(["-f", "rawvideo", "-pix_fmt", "gray", "-video_size", f"{mw}x{mh}",
                                     "-framerate", "10", "-i", str(mpath)])
                mi = n_inputs
                n_inputs += 1
                pad = max(0.0, clip_dur - nfr / 10.0) + 1.0
                parts.append(f"[{mi}:v]setpts=PTS-STARTPTS+{start:.3f}/TB,tpad=stop_mode=clone:"
                             f"stop_duration={pad:.3f},fps=30,scale={width}:{height}:flags=bilinear,"
                             f"format=gray[b{i}ma]")
                alphas.append(f"b{i}ma")
            if len(alphas) == 2:
                parts.append(f"[{alphas[0]}][{alphas[1]}]blend=all_mode=multiply:shortest=1[b{i}al]")
                al = f"b{i}al"
            else:
                al = alphas[0]
            parts.append(f"[b{i}g][{al}]alphamerge,format=yuva420p[b{i}]")
        out = f"v{i}"
        enable = f"enable='between(t,{start:.3f},{end:.3f})':eof_action=pass"
        if my_windows:
            parts.append(f"[{current}]split={1 + len(my_windows)}[{current}m" + "".join(
                f"][{current}w{k}" for k in range(len(my_windows))) + "]")
            parts.append(f"[b{i}]split={1 + len(my_windows)}[b{i}m" + "".join(
                f"][b{i}w{k}" for k in range(len(my_windows))) + "]")
            main_cur, main_b = f"{current}m", f"b{i}m"
        else:
            main_cur, main_b = current, f"b{i}"
        pre = current
        blend = lfx.get("blend")
        current = _broll_layer(parts, edits, target, main_b, main_cur, out, start, end, width, height, enable,
                               moving, cmd_dir, cmd_files, blend=blend)
        for k, w in enumerate(my_windows):
            current = _broll_window(parts, w, f"{pre}w{k}", f"b{i}w{k}", current, f"bw{i}_{k}", edits, target,
                                    start, width, height, moving, cmd_dir, cmd_files, blend=blend)

    for path, text in cmd_files:
        path.write_text(text)
    return ";".join(parts), extra_inputs, current


def _broll_layer(parts, edits, target, b_label, cur_label, out, start, end, width, height, enable, moving,
                 cmd_dir, cmd_files, blend=None) -> str:
    """Overlay one B-roll layer (with E3 keyframes when present) onto cur_label → out.

    G4b `blend`: the (moved) layer is composited with that blend mode over [start, end] instead."""
    if blend:
        from clips_worker.layer_fx import blend_composite

        s0, s1 = max(0.0, start), max(start, end)
        layer = b_label
        if moving:
            # Moved layer on a transparent canvas (full frame) → blend with the composite.
            parts.append(f"color=c=black@0.0:s={width}x{height}:r=30:d={s1 - s0 + 1:.3f},format=rgba,"
                         f"setpts=PTS-STARTPTS+{s0:.3f}/TB[{out}_t]")
            layer = _moving_layer(parts, edits, target, b_label, f"{out}_t", f"{out}_L", start, end, width, height,
                                  enable, cmd_dir, cmd_files, keep_alpha=True)
        return blend_composite(parts, cur_label, layer, out, blend, width, height, s0, s1)
    if not moving:
        parts.append(f"[{cur_label}][{b_label}]overlay=0:0:{enable}[{out}]")
        return out
    return _moving_layer(parts, edits, target, b_label, cur_label, out, start, end, width, height, enable,
                         cmd_dir, cmd_files)


def _moving_layer(parts, edits, target, b_label, cur_label, out, start, end, width, height, enable, cmd_dir,
                  cmd_files, keep_alpha=False) -> str:
    from clips_worker.motion import layer_motion_chain, layer_sendcmd

    cmd_file = (Path(cmd_dir) if cmd_dir else Path(".")) / f"{out}.cmd"
    graph, tags = layer_motion_chain(edits, target, w=width, h=height, origin_s=start, label_in=b_label,
                                     label_out=f"{out}_k", bg_label=cur_label, cmd_file=str(cmd_file))
    graph = graph.replace(":eval=frame:format=auto[", f":eval=frame:format=auto:{enable}[")
    parts.append(graph + f";[{out}_k]format={'rgba' if keep_alpha else 'yuv420p'}[{out}]")
    if tags:
        cmd_files.append((cmd_file, layer_sendcmd(edits, target, tags, w=width, h=height, start_s=max(0.0, start),
                                                  end_s=end, origin_s=start)))
    return out


def _broll_window(parts, w, cur_w, b_w, current, lab, edits, target, start, width, height, moving,
                  cmd_dir, cmd_files, blend=None) -> str:
    """xfade between the composite without this item (A) and with it (B) over the window."""
    from clips_worker.motion import XFADE_NAME, ZOOM_AMOUNT

    n = int(w["frames"])
    t0 = (w["startFrame"] - 0.5) / 30.0
    t1 = (w["startFrame"] + n - 0.5) / 30.0
    sel = f"trim=start={t0:.6f}:end={t1 + 1 / 30.0:.6f},setpts=PTS-STARTPTS"
    parts.append(f"[{cur_w}]fps=30,{sel},split=2[{lab}c0][{lab}c1]")
    # Window-local time: the item's local origin moves to start − w0.
    w0 = w["startFrame"] / 30.0
    parts.append(f"[{b_w}]{sel}[{lab}b]")
    enable = f"enable='between(t,{start - w0 - 0.0005:.6f},1e9)':eof_action=pass"
    if moving:
        local_edits = _shift_target(edits, target, w0 - start)
        _broll_layer(parts, local_edits, target, f"{lab}b", f"{lab}c1", f"{lab}with", 0.0, n / 30.0 + 0.1,
                     width, height, enable, True, cmd_dir, cmd_files, blend=blend)
    elif blend:
        _broll_layer(parts, edits, target, f"{lab}b", f"{lab}c1", f"{lab}with", max(0.0, start - w0),
                     n / 30.0 + 0.1, width, height, enable, False, cmd_dir, cmd_files, blend=blend)
    else:
        parts.append(f"[{lab}c1][{lab}b]overlay=0:0:{enable}[{lab}with]")
    without, with_ = f"{lab}c0", f"{lab}with"
    a, b = (without, with_) if w["kind"] in ("in", "between") else (with_, without)
    norm = "fps=30,format=gbrp,setsar=1"
    za = f"1+{ZOOM_AMOUNT}*round(t*30)/{n}" if w["type"] == "zoom_in" else None
    zb = f"1+{ZOOM_AMOUNT}*(1-round(t*30)/{n})" if w["type"] == "zoom_out" else None
    for src, zoom, tag in ((a, za, "A"), (b, zb, "B")):
        chain = f"[{src}]{norm},tpad=stop_mode=clone:stop_duration=1,trim=end_frame={n + 1},setpts=PTS-STARTPTS"
        if zoom:
            chain += (
                f",split=2[{lab}{tag}z0][{lab}{tag}z1];[{lab}{tag}z1]scale=w='trunc({width}*({zoom})/2)*2':"
                f"h='trunc({height}*({zoom})/2)*2':eval=frame[{lab}{tag}z2];"
                f"[{lab}{tag}z0][{lab}{tag}z2]overlay=x='(W-w)/2':y='(H-h)/2':eval=frame,format=gbrp,setsar=1"
            )
        parts.append(chain + f",fps=30[{lab}{tag}]")
    parts.append(
        f"[{lab}A][{lab}B]xfade=transition={XFADE_NAME[w['type']]}:duration={n / 30.0:.6f}:offset=0,"
        f"trim=end_frame={n},format=yuv420p,setpts=PTS-STARTPTS+{w0:.6f}/TB[{lab}x]"
    )
    out = f"{lab}o"
    parts.append(
        f"[{current}][{lab}x]overlay=0:0:eof_action=pass:enable='between(t,{t0:.6f},{t1:.6f})'[{out}]"
    )
    return out


def _shift_target(edits: dict, target: str, by_s: float) -> dict:
    """Same keyframes with local time shifted (window-local rendering); G3b: the in / out / loop
    preset reads the same shift from ``_animShiftMs`` (motion.layer_anim)."""
    from clips_worker.motion import normalize_keyframes

    out = []
    for k in normalize_keyframes(edits.get("keyframes")):
        if k["target"] == target:
            k = {**k, "points": [{**p, "tMs": p["tMs"] - by_s * 1000} for p in k["points"]]}
        out.append(k)
    prev = edits.get("_animShiftMs") if isinstance(edits.get("_animShiftMs"), dict) else {}
    shift = {**prev, target: float(prev.get(target) or 0.0) + by_s * 1000}
    return {**edits, "keyframes": out, "_animShiftMs": shift}


def load_broll_specs(conn, edits: dict, work_dir, media: dict | None = None) -> list[dict]:
    from pathlib import Path

    from clips_worker.storage import download_object

    items = edits.get("broll") or []
    specs: list[dict] = []
    for pos, item in enumerate(items):
        if item.get("source") == "upload":
            # E5: the user's own upload (media library); stills become a clip of the item's length.
            from clips_worker.media_sources import upload_broll_spec_path

            local_up = upload_broll_spec_path(item, media or {}, Path(work_dir), pos)
            if local_up is None:
                continue
            start_s = int(item["startMs"]) / 1000.0
            end_s = int(item["endMs"]) / 1000.0
            specs.append(
                {
                    "local_path": local_up,
                    "start_s": start_s,
                    "end_s": end_s,
                    "duration_s": max(0.1, end_s - start_s),
                    "in_s": 0.0 if item.get("still") else max(0, int(item.get("inMs") or 0)) / 1000.0,
                    "id": str(item.get("id") or ""),
                    **({k: item[k] for k in ("transitionIn", "transitionOut") if isinstance(item.get(k), dict)}),
                }
            )
            continue
        with conn.cursor() as cur:
            if item.get("source") == "ai":
                cur.execute('SELECT "storageKey" FROM ai_generations WHERE id=%s', (item.get("generationId"),))
            else:
                cur.execute('SELECT "storageKey" FROM stock_assets WHERE id=%s', (item.get("assetId"),))
            row = cur.fetchone()
        if not row or not row[0]:
            continue
        storage_key = row[0]
        start_s = int(item["startMs"]) / 1000.0
        end_s = int(item["endMs"]) / 1000.0
        local = Path(work_dir) / f"broll_{pos}.mp4"
        download_object(storage_key, local)
        specs.append(
            {
                "local_path": local,
                "start_s": start_s,
                "end_s": end_s,
                "duration_s": max(0.1, end_s - start_s),
                "in_s": max(0, int(item.get("inMs") or 0)) / 1000.0,
                # E3: keyframe target id + edge transitions.
                "id": str(item.get("id") or ""),
                **({k: item[k] for k in ("transitionIn", "transitionOut") if isinstance(item.get(k), dict)}),
            }
        )
    return specs


def apply_broll_overlays(
    base_video,
    out_video,
    broll_specs: list[dict],
    width: int,
    height: int,
    edits: dict | None = None,
) -> None:
    import shutil
    from pathlib import Path

    fc, extra, vlabel = build_broll_filtergraph(
        broll_specs, width, height, edits=edits, cmd_dir=Path(out_video).parent if edits is not None else None
    )
    if not fc:
        shutil.copy(base_video, out_video)
        return
    if "[0:v]format=yuv420p[base]" not in fc:
        raise RuntimeError(f"broll filtergraph missing base label: {fc[:200]}")

    cmd = ["ffmpeg", "-y", "-hide_banner", "-i", str(base_video)]
    cmd.extend(extra)
    cmd.extend(["-filter_complex", fc, "-map", f"[{vlabel}]", "-map", "0:a?", "-c:a", "copy", str(out_video)])
    run_ffmpeg(cmd)
