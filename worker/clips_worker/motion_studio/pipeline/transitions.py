"""Frame-exact editorial transitions between normalized scene segments.

The master narration/VO timeline remains authoritative. Cross-boundary transitions
replace frames on BOTH sides of a cut without shortening or shifting the program.
Only implemented transition modes are accepted; no "stored but never rendered" effects.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path


SUPPORTED = frozenset({"cut", "dissolve", "fade", "wipe"})


def _encode(src_args: list[str], vf: str, dst: str, *, fps: int, crf: int, preset: str) -> None:
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *src_args, "-filter_complex", vf,
         "-map", "[v]", "-an", "-c:v", "libx264", "-preset", preset,
         "-crf", str(crf), "-pix_fmt", "yuv420p", "-r", str(fps),
         "-movflags", "+faststart", dst],
        check=True,
    )


def _probe_frames(path: str) -> int:
    from clips_worker.motion_studio.core.render import ffprobe_frames
    return ffprobe_frames(path)


def _transitions(scenes: list[dict], rows: dict[int, dict]) -> dict[int, dict]:
    """Resolve explicitly declared scene-to-scene transitions to exactly one real boundary."""
    boundaries = {(f"s{a['index']}", f"s{b['index']}"): i
                  for i, (a, b) in enumerate(zip(scenes, scenes[1:]))}
    by_boundary: dict[int, dict] = {}
    for sc in scenes:
        qa = (rows[sc["index"]].get("qa") or {})
        spec = qa.get("spec") or {}
        for tr in (spec.get("transitions") or {}).values():
            typ = tr.get("type") or "cut"
            if typ not in SUPPORTED:
                raise ValueError(f"scene {sc['index']}: transition {typ!r} has no verified renderer")
            if typ == "cut":
                continue
            key = (tr.get("fromSceneId"), tr.get("toSceneId"))
            if key not in boundaries:
                raise ValueError(f"scene {sc['index']}: unbound transition {key!r}; name adjacent scene ids")
            idx = boundaries[key]
            if idx in by_boundary:
                raise ValueError(f"boundary {idx}: multiple competing transitions")
            by_boundary[idx] = tr
    return by_boundary


def _duration_frames(tr: dict, a: dict, b: dict, fps: int) -> int:
    params = tr.get("params") or {}
    value = params.get("durationFrames")
    if value is None:
        duration = params.get("durationS")
        if duration is not None:
            value = round(float(duration) * fps)
    if value is None and tr.get("startFrame") is not None and tr.get("endFrame") is not None:
        value = int(tr["endFrame"]) - int(tr["startFrame"])
    if value is None:
        raise ValueError("a dissolve/wipe needs explicit durationFrames or durationS")
    value = int(value)
    if value < 2 or value > min(45, int(a["frames"]), int(b["frames"])):
        raise ValueError(f"transition duration {value} outside verified frame budget")
    return value


def transition_segments(segments: list[str], scenes: list[dict], rows: dict[int, dict],
                        work: str, fps: int, crf: int, preset: str, log) -> list[str]:
    """Return normalized pieces + transition inserts with EXACTLY the same frame count."""
    if len(segments) != len(scenes):
        raise ValueError("scene and segment count differ")
    specs = _transitions(scenes, rows)
    if not specs:
        return segments
    n = len(scenes)
    cuts: dict[int, dict] = {}
    for i, tr in specs.items():
        count = _duration_frames(tr, scenes[i], scenes[i+1], fps)
        cuts[i] = {"type": tr["type"], "frames": count, "left": count // 2,
                   "right": count - count // 2}
    # Do not allow two overlapping transitions to swallow the same scene.
    for i, sc in enumerate(scenes):
        drop_start = cuts.get(i-1, {}).get("right", 0)
        drop_end = cuts.get(i, {}).get("left", 0)
        if drop_start + drop_end >= int(sc["frames"]):
            raise ValueError(f"scene {sc['index']}: transitions consume the whole shot")
    result = []
    for i, (src, sc) in enumerate(zip(segments, scenes)):
        head = cuts.get(i-1, {}).get("right", 0)
        tail = cuts.get(i, {}).get("left", 0)
        count = int(sc["frames"])
        if head or tail:
            dst = os.path.join(work, f"transition_interior_{sc['index']:03d}.mp4")
            vf = f"[0:v]trim=start_frame={head}:end_frame={count-tail},setpts=PTS-STARTPTS,format=yuv420p[v]"
            _encode(["-i", src], vf, dst, fps=fps, crf=crf, preset=preset)
            if _probe_frames(dst) != count-head-tail:
                raise RuntimeError(f"scene {sc['index']}: transition interior frame mismatch")
            result.append(dst)
        else:
            result.append(src)
        if i not in cuts:
            continue
        tr = cuts[i]
        right = tr["right"]
        left = tr["left"]
        k = tr["frames"]
        # Duplicate only boundary frames, never alter the original editorial clock.
        # A stays through the left half and holds its last image; B appears before
        # its cut and then advances through the right half. The full K frames replace
        # left frames of A and right frames of B in the concatenation.
        a = (
            f"[0:v]trim=start_frame={count-left}:end_frame={count},setpts=PTS-STARTPTS,"
            f"tpad=stop_mode=clone:stop_duration={right/fps:.9f},"
            f"trim=end_frame={k},setpts=PTS-STARTPTS[a]"
        )
        b = (
            f"[1:v]trim=start_frame=0:end_frame={right},setpts=PTS-STARTPTS,"
            f"tpad=start_mode=clone:start_duration={left/fps:.9f},"
            f"trim=end_frame={k},setpts=PTS-STARTPTS[b]"
        )
        u = f"((N+0.5)/{k})"
        if tr["type"] == "wipe":
            blend = f"if(lte(X/W,{u}),B,A)"
        else:
            blend = f"A*(1-{u})+B*{u}"
        vf = f"{a};{b};[a][b]blend=all_expr='{blend}':shortest=1,format=yuv420p[v]"
        dst = os.path.join(work, f"transition_boundary_{i:03d}.mp4")
        _encode(["-i", src, "-i", segments[i+1]], vf, dst,
                fps=fps, crf=crf, preset=preset)
        if _probe_frames(dst) != k:
            raise RuntimeError(f"boundary {i}: transition frame mismatch")
        result.append(dst)
        log("transition_rendered", f"boundary {i}: {tr['type']} ({k} frames)", {
            "boundary": i, "type": tr["type"], "frames": k,
        })
    expected = sum(int(sc["frames"]) for sc in scenes)
    actual = sum(_probe_frames(s) for s in result)
    if actual != expected:
        raise RuntimeError(f"picture timeline changed during transitions: {actual} vs {expected}")
    return result
