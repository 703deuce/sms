"""REFRAME_V=2 entry for worker/prototype/v3/speakercrop.py (same argv/env contract as v1).

    python speakercrop.py input.mp4 out_vertical.mp4       # v1 (default)
    REFRAME_V=2 python speakercrop.py input.mp4 out.mp4    # -> speakercrop_v2.main()

Env read (all already produced by render_clip.run_speakercrop / layout_env):
  OUT_W OUT_H WORDS CAPTIONS CLIP_START_MS CROP_TRACK_OUT SHOT_OVERRIDES NORENDER FFMPEG_THREADS
  LAYOUT_MODE FORCE_SPLIT SPLIT MIN_SEG LEAD HYST          <- v1 ignored LAYOUT_MODE/FORCE_SPLIT; v2 honours them
  MODELS_DIR (default: next to this script, like v1)       GRID (0 disables 2x2)
"""
from __future__ import annotations
import json, os, subprocess, sys, time
import cv2, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("CLIPS_WORKER_ROOT", os.path.join(HERE, "..")))   # dir that contains clips_worker/
from clips_worker import reframe_core as rc

LABEL = {0: "A", 1: "B"}                                # v1 shot labels kept for P1/P2 (TS CropTrack compat)


def _v1_split_slot_tracks(track: dict) -> tuple[list[int], list[int]]:
    """Editor preview expects x0_A/x0_B per frame (v1 superset)."""
    n = len(track["x0"])
    x0_a = [-1] * n
    x0_b = [-1] * n
    fr = track.get("_frames")
    if not fr:
        return x0_a, x0_b
    w, cw = track["W"], track["cw"]
    seg_of = fr["seg_of"]
    for i in range(n):
        si = min(int(seg_of[i]), len(track["segments"]) - 1)
        sg = track["segments"][si]
        if sg["layout"] not in ("split", "three") or len(sg["slots"]) < 2:
            continue
        for slot, person, out in ((0, sg["slots"][0], x0_a), (1, sg["slots"][1], x0_b)):
            x = fr["fx"][person, i]
            if not np.isnan(x):
                out[i] = int(np.clip(x - cw / 2, 0, w - cw))
    return x0_a, x0_b


def to_v1_compatible(track: dict, t0_ms: int) -> dict:
    """crop_track v2 = v1 fields (v, W, H, cw, fps, t0_ms, x0, x0_A, x0_B, shots[]) + people[] + segments[] + spk2person."""
    shots = []
    for s in track["segments"]:
        lab = {"single": LABEL.get(s["slots"][0], f"P{s['slots'][0] + 1}") if s["slots"] else "wide",
               "split": "split", "three": "three", "grid": "grid", "wide": "wide"}[s["layout"]]
        shots.append({"start_ms": s["start_ms"] + t0_ms, "end_ms": s["end_ms"] + t0_ms, "spk": lab})
    x0_a, x0_b = _v1_split_slot_tracks(track)
    keep = {k: v for k, v in track.items() if not k.startswith("_")}
    return {**keep, "v": 2, "t0_ms": t0_ms, "x0_A": x0_a, "x0_B": x0_b, "shots": shots,
            "segments": [{**s, "start_ms": s["start_ms"] + t0_ms, "end_ms": s["end_ms"] + t0_ms,
                          "slots": [f"P{p + 1}" for p in s["slots"]]} for s in track["segments"]],
            "timings": {k: round(float(v), 3) for k, v in track.get("_timings", {}).items() if isinstance(v, (int, float))}}


def main(inp: str, out: str, env: dict | None = None) -> dict:
    env = dict(os.environ if env is None else env)
    t0 = time.perf_counter()
    ow, oh = int(env.get("OUT_W", 720)), int(env.get("OUT_H", 1280))
    t0_ms = int(env.get("CLIP_START_MS", 0))
    words = json.load(open(env["WORDS"])) if env.get("WORDS") and os.path.exists(env["WORDS"]) else None
    words_for_cap = words
    cfg = rc.director_cfg_from_env(env)
    track = rc.analyze_clip(inp, words, cfg, models_dir=env.get("MODELS_DIR", HERE), out_w=ow, out_h=oh)
    if not track["segments"]:
        raise SystemExit(3)                              # no faces: caller falls back (blur fit / subject follow)
    rc.apply_shot_overrides(track, json.loads(env.get("SHOT_OVERRIDES", "[]")))
    ct = to_v1_compatible(track, t0_ms)
    crop_out = env.get("CROP_TRACK_OUT", os.path.splitext(out)[0] + ".crop_track.json")
    json.dump(ct, open(crop_out, "w"), separators=(",", ":"))
    if int(env.get("NORENDER", 0)):
        return ct
    vf = _caption_vf(env, words_for_cap, inp, out, track)
    cap = cv2.VideoCapture(inp); fps = cap.get(cv2.CAP_PROP_FPS)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{oh}",
                           "-r", str(fps), "-i", "-", "-i", inp, "-map", "0:v", "-map", "1:a?", *vf,
                           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                           "-threads", env.get("FFMPEG_THREADS", "4"), "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-shortest", out], stdin=subprocess.PIPE)
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        lay, crops = rc.frame_crops(track, i)
        ff.stdin.write(rc.compose_frame(fr, lay, crops, ow, oh).tobytes()); i += 1
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit(4)
    ct["timings"]["total_s"] = round(time.perf_counter() - t0, 2)
    json.dump(ct, open(crop_out, "w"), separators=(",", ":"))
    print(f"speakercrop v2: {i / fps:.1f}s video, {ct['timings']['total_s']}s wall, "
          f"{len(ct['segments'])} segments, people={[p['id'] for p in ct['people']]}")
    return ct


def _caption_vf(env: dict, words, inp: str, out: str, track: dict) -> list[str]:
    if not (int(env.get("CAPTIONS", 1)) and words):
        return []
    try:
        import captions

        for wd in words:
            wd.setdefault("spk", 0)
        base = os.path.splitext(out)[0]
        seg_at = lambda t: next(
            (s for s in track.get("segments", []) if s.get("start_s", 0) <= t < s.get("end_s", 1e9)),
            track.get("segments", [{}])[-1],
        )
        captions.build(
            words,
            inp,
            base + ".ass",
            base + ".srt",
            split_times=lambda t: seg_at(t).get("layout") in ("split", "three", "grid"),
        )
        return ["-vf", f"ass={base}.ass:fontsdir={os.path.join(HERE, 'fonts')}".replace(",", r"\,")]
    except ImportError:
        return []


def render_crop_track(inp: str, out: str, track: dict, env: dict | None = None) -> dict:
    """CROP_TRACK_IN mode: render a track someone else wrote (subject_reframe.write_motion_crop_track,
    pipeline.write_fit_blur_crop_track, or an editor-saved track) instead of re-analysing.
    Fixes the overwrite bug: reframe_clip_preview passes its motion/fit track in here, nothing is recomputed.
    v1 semantics: x0 >= 0 -> crop [x0, x0+cw); x0 < 0 -> wide blur-fit (a v1 fit track uses -1 for 'wide',
    so -1 is only treated as split when the shot label says 'split'). The pan cap is applied here too."""
    env = dict(os.environ if env is None else env)
    ow, oh = int(env.get("OUT_W", 720)), int(env.get("OUT_H", 1280))
    cap = cv2.VideoCapture(inp); fps = cap.get(cv2.CAP_PROP_FPS); W = int(cap.get(3)); H = int(cap.get(4))
    cw = int(track.get("cw", W)); x0 = np.array(track["x0"], float); t0 = int(track.get("t0_ms", 0))
    lab = np.array(["wide"] * len(x0), dtype=object)
    for sh in track.get("shots", []):
        a = max(0, int((sh["start_ms"] - t0) / 1000 * fps)); b = int((sh["end_ms"] - t0) / 1000 * fps)
        lab[a:b] = sh.get("spk", "wide")
    single = (x0 >= 0) & (cw < W)
    if single.any():                                              # One-Euro + 0.15 W/s cap on the given track
        cx = np.where(single, x0 + cw / 2, np.nan)
        cx = np.interp(np.arange(len(cx)), np.flatnonzero(single), cx[single])
        resets = np.flatnonzero(np.diff(single.astype(int)) != 0) + 1
        x0 = np.where(single, np.clip(rc.smooth_path(cx, fps, frame_w=W, resets=resets) - cw / 2, 0, W - cw), x0)
    words = json.load(open(env["WORDS"])) if env.get("WORDS") and os.path.exists(env["WORDS"]) else None
    vf = _caption_vf(env, words, inp, out, track)
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{oh}",
                           "-r", str(fps), "-i", "-", "-i", inp, "-map", "0:v", "-map", "1:a?", *vf, "-c:v", "libx264",
                           "-preset", "veryfast", "-crf", "20", "-threads", env.get("FFMPEG_THREADS", "4"),
                           "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out], stdin=subprocess.PIPE)
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        k = min(i, len(x0) - 1)
        if x0[k] >= 0 and cw < W:
            o = rc.compose_frame(fr, "single", [(int(x0[k]), 0, cw, H)], ow, oh)
        else:
            o = rc.compose_frame(fr, "wide", [], ow, oh)
        ff.stdin.write(o.tobytes()); i += 1
    ff.stdin.close(); ff.wait()
    return {"frames": i, "cropMethod": track.get("method", "track_in")}


def cli(inp: str, out: str) -> None:
    """Called by the 3-line dispatch at the top of speakercrop.py."""
    if os.environ.get("CROP_TRACK_IN"):
        render_crop_track(inp, out, json.load(open(os.environ["CROP_TRACK_IN"])))
    else:
        main(inp, out)


if __name__ == "__main__":
    cli(sys.argv[1], sys.argv[2])
