"""FFmpeg B-roll overlay filtergraph for export."""
from __future__ import annotations

from clips_worker.ffmpeg_util import run_ffmpeg


def clip_window_duration_s(spec: dict) -> float:
    return max(0.1, float(spec["end_s"]) - float(spec["start_s"]))


def build_broll_filtergraph(
    broll_specs: list[dict],
    width: int,
    height: int,
) -> tuple[str, list[str], str]:
    """
    broll_specs: [{local_path, start_s, end_s, duration_s}]
    Returns (filter_complex, extra_input_args, final_video_label)
    """
    if not broll_specs:
        return "", [], "0:v"

    parts: list[str] = ["[0:v]format=yuv420p[base]"]
    extra_inputs: list[str] = []
    current = "base"

    for i, spec in enumerate(broll_specs):
        clip_dur = clip_window_duration_s(spec)
        start = float(spec["start_s"])
        end = float(spec["end_s"])
        inp = f"{i + 1}:v"
        parts.append(
            f"[{inp}]trim=0:{clip_dur:.3f},setpts=PTS-STARTPTS+{start:.3f}/TB,"
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},fps=30,format=yuv420p[b{i}]"
        )
        out = f"v{i}"
        parts.append(
            f"[{current}][b{i}]overlay=0:0:enable='between(t,{start:.3f},{end:.3f})':eof_action=pass[{out}]"
        )
        current = out
        extra_inputs.extend(["-stream_loop", "-1", "-i", str(spec["local_path"])])

    return ";".join(parts), extra_inputs, current


def load_broll_specs(conn, edits: dict, work_dir) -> list[dict]:
    from pathlib import Path

    from clips_worker.storage import download_object

    items = edits.get("broll") or []
    specs: list[dict] = []
    for pos, item in enumerate(items):
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
            }
        )
    return specs


def apply_broll_overlays(
    base_video,
    out_video,
    broll_specs: list[dict],
    width: int,
    height: int,
) -> None:
    import shutil
    from pathlib import Path

    fc, extra, vlabel = build_broll_filtergraph(broll_specs, width, height)
    if not fc:
        shutil.copy(base_video, out_video)
        return

    cmd = ["ffmpeg", "-y", "-hide_banner", "-i", str(base_video)]
    cmd.extend(extra)
    cmd.extend(["-filter_complex", fc, "-map", f"[{vlabel}]", "-map", "0:a?", "-c:a", "copy", str(out_video)])
    run_ffmpeg(cmd)
