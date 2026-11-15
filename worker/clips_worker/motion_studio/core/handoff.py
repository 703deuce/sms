"""Part 1 / RE-6 (#1203): Cinematic Media Handoff — the ONE handoff implementation (ST-CMH-001..017).

Phases: ENTER (world animates into the exact first frame on a surface) -> PLAYBACK (footage plays
normally) -> EXIT (exact last frame, animates away) -> CONTINUITY (record of world state + timing).

Deterministic seams: grabs and playback come from ONE decode with ONE transform (`transformId`):
    accurate seek (-ss before -i decodes to the exact PTS) -> scale cover -> centre crop -> fps=<fps> (CFR by timestamp)
The final ENTER frame IS clip frame 0 (pixel identical before encoding), playback continues at frame 1,
and the first EXIT frame IS the last clip frame, so there is no duplicated or skipped frame at a seam.
Surface effects (shadow, glare, bezel, skew) reach zero at the seams. No paid video model is used.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import subprocess
from dataclasses import dataclass, field, asdict

import numpy as np
import skia

from clips_worker.motion_studio.core.render import ffprobe_frames

SURFACES = ("photo", "tv", "newspaper")            # P1 surface kinds (phone/cinema/billboard/panel: P2, same interface)
SEAM_THRESHOLDS = {"mad": 1.0, "within4": 0.999, "psnr": 45.0}   # ST-CMH-014 (VQ tunes)
SEAM_QP = 4                                                          # x264 qp on seam frames (0 would force High 4:4:4)


@dataclass
class HandoffSpec:
    clip_path: str
    in_s: float
    out_s: float
    surface: str = "photo"
    enter_s: float = 1.4
    exit_s: float = 1.2
    exit_style: str = "mirror"            # mirror | asymmetric
    exit_reason: str = ""
    cut_type: str = "handoff"             # handoff | hardcut
    cut_justification: str = ""
    audio_mode: str = "clip"              # clip (footage mode b: clip sound) | bed (mode a: VO over, clip low) | mute
    clip_gain_db: float = 0.0
    bg: tuple = (12, 14, 20)
    accent: tuple = (255, 196, 0)
    width: int = 1920
    height: int = 1080
    fps: int = 30
    seed: int = 1
    tilt_deg: float = -4.0
    start_scale: float = 0.44
    params: dict = field(default_factory=dict)


def transform_id(spec: HandoffSpec) -> str:
    return f"cover-crop-{spec.width}x{spec.height}@{spec.fps}-accurate-seek-v1"


def _decode_cmd(spec: HandoffSpec, n_frames: int) -> list[str]:
    W, H = spec.width, spec.height
    vf = f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},fps={spec.fps},format=rgb24"
    return ["ffmpeg", "-v", "error", "-ss", f"{spec.in_s:.3f}", "-i", spec.clip_path, "-an", "-vf", vf,
            "-frames:v", str(n_frames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]


def probe_media(path: str) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
                        "-of", "json", path], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except ValueError:
        d = {}
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video"), {})
    return {"duration": float((d.get("format") or {}).get("duration") or 0), "w": v.get("width"), "h": v.get("height"),
            "hasAudio": any(s.get("codec_type") == "audio" for s in d.get("streams", []))}


def _ease(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)       # smootherstep: zero velocity + acceleration at the seam


class _Surface:
    """Surface interface: placement(u) + applyTexture + effects(u) that reach zero at u == 1."""

    def __init__(self, spec: HandoffSpec):
        self.s = spec
        self.W, self.H = spec.width, spec.height
        self.rng = np.random.default_rng(spec.seed)
        self.paper_lines = [(float(self.rng.uniform(0.15, 0.95))) for _ in range(40)]

    def placement(self, u: float, asym: bool = False) -> tuple[float, float, float, float, float]:
        """(cx, cy, scale, rot_deg, skew) of the media rect in output px. u=1 => identity (fills the frame)."""
        e = _ease(u)
        s0 = self.s.start_scale
        sc = s0 + (1 - s0) * e
        rot = self.s.tilt_deg * (1 - e)
        if asym:
            cx = self.W / 2 - (1 - e) * self.W * 0.34
            cy = self.H / 2 + (1 - e) * self.H * 0.08
            rot = -self.s.tilt_deg * 1.6 * (1 - e)
        else:
            cx = self.W / 2 + (1 - e) * self.W * 0.06
            cy = self.H / 2 + (1 - e) * self.H * 0.04
        skew = (0.10 if self.s.surface == "newspaper" else 0.0) * (1 - e)
        return cx, cy, sc, rot, skew

    def draw(self, c: skia.Canvas, img: skia.Image, u: float, asym: bool = False) -> None:
        cx, cy, sc, rot, skew = self.placement(u, asym)
        fx = 1 - _ease(u)                    # surface-effect strength; exactly 0 at the seam
        W, H = self.W, self.H
        c.save()
        c.translate(cx, cy)
        c.rotate(rot)
        if skew:
            c.skew(skew, 0)
        c.scale(sc, sc)
        r = skia.Rect.MakeXYWH(-W / 2, -H / 2, W, H)
        kind = self.s.surface
        if fx > 0:
            sh = skia.Paint(Color=skia.Color(0, 0, 0, int(150 * fx)), MaskFilter=skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 40))
            if kind == "photo":
                b = W * 0.035
                c.drawRect(r.makeOutset(b, b).makeOffset(30, 40), sh)
                c.drawRect(skia.Rect.MakeLTRB(-W / 2 - b, -H / 2 - b, W / 2 + b, H / 2 + b * 2.2), skia.Paint(Color=skia.Color(246, 243, 236)))
            elif kind == "tv":
                b = W * 0.045
                c.drawRRect(skia.RRect.MakeRectXY(r.makeOutset(b, b), b * 0.6, b * 0.6), sh)
                c.drawRRect(skia.RRect.MakeRectXY(r.makeOutset(b, b), b * 0.6, b * 0.6), skia.Paint(Color=skia.Color(16, 16, 18)))
                c.drawCircle(W / 2 + b * 0.5, H / 2 + b * 0.55, b * 0.12, skia.Paint(Color=skia.Color(*self.s.accent, int(200 * fx))))
            elif kind == "newspaper":
                pw, ph = W * 1.5, H * 1.9
                page = skia.Rect.MakeXYWH(-pw * 0.42, -ph * 0.36, pw, ph)
                c.drawRect(page.makeOffset(30, 40), sh)
                c.drawRect(page, skia.Paint(Color=skia.Color(236, 230, 214)))
                ink = skia.Paint(Color=skia.Color(40, 38, 34, 150))
                c.drawRect(skia.Rect.MakeXYWH(page.left() + 60, page.top() + 50, pw - 120, 70), ink)
                y = H / 2 + 60
                for i, frac in enumerate(self.paper_lines):
                    if y > page.bottom() - 40:
                        break
                    c.drawRect(skia.Rect.MakeXYWH(-W / 2, y, W * frac, 14), ink)
                    y += 30
                for j in range(30):
                    yy = page.top() + 160 + j * 30
                    if yy < -H / 2 - 30 or yy > H / 2 + 40:
                        c.drawRect(skia.Rect.MakeXYWH(W / 2 + 50, yy, pw * 0.42 - 120 - W * 0.0 + (pw - W) * 0.0, 14), ink)
        c.drawImageRect(img, r, skia.SamplingOptions(skia.FilterMode.kLinear), skia.Paint())
        if fx > 0 and kind in ("tv", "photo"):
            g = skia.GradientShader.MakeLinear([skia.Point(-W / 2, -H / 2), skia.Point(W / 2, H / 2)],
                                               [skia.Color(255, 255, 255, int(46 * fx)), skia.Color(255, 255, 255, 0)])
            c.drawRect(r, skia.Paint(Shader=g))
        c.restore()


def _background(spec: HandoffSpec) -> skia.Image:
    W, H = spec.width, spec.height
    surf = skia.Surface(W, H)
    with surf as c:
        lift = tuple(min(255, int(v * 1.8 + 12)) for v in spec.bg)
        g = skia.GradientShader.MakeRadial(skia.Point(W / 2, H * 0.45), max(W, H) * 0.75,
                                           [skia.Color(*lift), skia.Color(*spec.bg), skia.Color(*(int(v * 0.45) for v in spec.bg))])
        c.drawRect(skia.Rect.MakeWH(W, H), skia.Paint(Shader=g))
        rng = np.random.default_rng(spec.seed + 7)
        p = skia.Paint(Color=skia.Color(255, 255, 255, 10), AntiAlias=True)
        for _ in range(140):
            c.drawCircle(float(rng.uniform(0, W)), float(rng.uniform(0, H)), float(rng.uniform(1, 4)), p)
    return surf.makeImageSnapshot()


def _to_img(arr: np.ndarray) -> skia.Image:
    rgba = np.dstack([arr, np.full(arr.shape[:2], 255, np.uint8)])
    return skia.Image.fromarray(np.ascontiguousarray(rgba), colorType=skia.ColorType.kRGBA_8888_ColorType)


def _world_frame(surface: _Surface, bg: skia.Image, img: skia.Image, u: float, asym: bool) -> np.ndarray:
    W, H = surface.W, surface.H
    s = skia.Surface(W, H)
    with s as c:
        c.drawImage(bg, 0, 0)
        surface.draw(c, img, u, asym)
    return s.makeImageSnapshot().toarray(colorType=skia.ColorType.kRGBA_8888_ColorType)[..., :3]


def _seam(a: np.ndarray, b: np.ndarray) -> dict:
    d = np.abs(a.astype(np.int16) - b.astype(np.int16))
    mse = float(np.mean(d.astype(np.float32) ** 2))
    return {"mad": round(float(d.mean()), 3), "within4": round(float((d <= 4).mean()), 5),
            "psnr": round(99.0 if mse == 0 else 10 * math.log10(255 ** 2 / mse), 2)}


def _yuv420_roundtrip(arr: np.ndarray) -> np.ndarray:
    """The frame as it can exist in a yuv420p deliverable (chroma subsampled, no compression). Seam scores compare
    against this so they measure seam/grab/codec error, not the format's chroma subsampling (ST-CMH-014)."""
    H, W = arr.shape[:2]
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-i", "-",
                        "-vf", "format=yuv420p,format=rgb24", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       input=arr.tobytes(), capture_output=True)
    if len(r.stdout) != W * H * 3:
        return arr
    return np.frombuffer(r.stdout, np.uint8).reshape(H, W, 3)


def _seam_zones(idxs: list[int], total: int, q: int = SEAM_QP, radius: int = 3) -> str:
    """x264 zones: near-transparent quantiser around each seam frame so the handoff frame survives the encode.
    +/-3 frames, because with B-frames a +/-1 zone is undone by its lower-quality reference frames (measured)."""
    zs = []
    for i in sorted(set(idxs)):
        a, b = max(0, i - radius), min(total - 1, i + radius)
        if zs and a <= zs[-1][1] + 1:
            zs[-1][1] = b
        else:
            zs.append([a, b])
    return "/".join(f"{a},{b},q={q}" for a, b in zs)


def _seam_ok(sc: dict) -> bool:
    return sc["mad"] <= SEAM_THRESHOLDS["mad"] and sc["within4"] >= SEAM_THRESHOLDS["within4"] and sc["psnr"] >= SEAM_THRESHOLDS["psnr"]


def _decode_frames_at(path: str, idxs: list[int], W: int, H: int) -> dict[int, np.ndarray]:
    sel = "+".join(f"eq(n\\,{i})" for i in idxs)
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select='{sel}'", "-vsync", "0", "-f", "rawvideo",
                        "-pix_fmt", "rgb24", "-"], capture_output=True)
    fs = W * H * 3
    out = {}
    for k, i in enumerate(sorted(idxs)):
        chunk = r.stdout[k * fs:(k + 1) * fs]
        if len(chunk) == fs:
            out[i] = np.frombuffer(chunk, np.uint8).reshape(H, W, 3)
    return out


def _audio(spec: HandoffSpec, out_wav: str, enter_n: int, play_n: int, exit_n: int, has_audio: bool, src_dur: float) -> dict:
    """Audio tails (ST-CMH-016): with handles, lead in/out from real material under ENTER/EXIT with fades;
    without handles, a short eased fade at the clip edges. Never an abrupt stop."""
    fps = spec.fps
    total = (enter_n + play_n + exit_n) / fps
    if not has_audio or spec.audio_mode == "mute":
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{total:.4f}",
                        "-c:a", "pcm_s16le", out_wav + ".tmp.wav"], check=True)
        os.replace(out_wav + ".tmp.wav", out_wav)
        return {"mode": "silent", "tailMs": 0, "handles": False}
    enter_s, exit_s = enter_n / fps, exit_n / fps
    play_start = spec.in_s
    pre = min(enter_s, max(0.0, play_start))                      # real pre-roll available
    post = min(exit_s, max(0.0, src_dur - (spec.in_s + play_n / fps)))
    a0 = play_start - pre
    a_len = pre + play_n / fps + post
    gain = spec.clip_gain_db + (-16.0 if spec.audio_mode == "bed" else 0.0)
    fin = max(0.12, pre * 0.9)
    fout = max(0.12, post * 0.9)
    lead_pad = enter_s - pre
    af = (f"aresample=48000,aformat=channel_layouts=stereo,volume={gain}dB,afade=t=in:st=0:d={fin:.3f},"
          f"afade=t=out:st={max(0.0, a_len - fout):.3f}:d={fout:.3f},adelay={int(round(lead_pad * 1000))}|{int(round(lead_pad * 1000))},"
          f"apad,atrim=0:{total:.4f}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a0:.3f}", "-t", f"{a_len:.3f}", "-i", spec.clip_path, "-vn",
                    "-af", af, "-c:a", "pcm_s16le", out_wav + ".tmp.wav"], check=True)
    os.replace(out_wav + ".tmp.wav", out_wav)
    return {"mode": spec.audio_mode, "tailMs": int(round(max(pre, post) * 1000)), "handles": pre > 0.05 or post > 0.05,
            "fadeInMs": int(fin * 1000), "fadeOutMs": int(fout * 1000)}


def render_handoff(spec: HandoffSpec, out_mp4: str, out_wav: str, crf: int = 14) -> dict:
    """Render ENTER+PLAYBACK+EXIT as one segment (one encode). Returns the BE-13 handoff record (ST-CMH-017)."""
    if spec.surface not in SURFACES:
        raise ValueError(f"surface {spec.surface!r} not in P1 kinds {SURFACES}")
    hard = spec.cut_type == "hardcut"
    if hard and not spec.cut_justification.strip():
        raise ValueError("hard cut requires a justification (ST-BLK-22, interim D11)")
    W, H, fps = spec.width, spec.height, spec.fps
    meta = probe_media(spec.clip_path)
    src_dur = meta["duration"]
    out_s = min(spec.out_s, src_dur) if src_dur else spec.out_s
    play_total = max(2, int(round((out_s - spec.in_s) * fps)))
    enter_n = 0 if hard else max(2, int(round(spec.enter_s * fps)))
    exit_n = 0 if hard else max(2, int(round(spec.exit_s * fps)))
    asym = spec.exit_style == "asymmetric"
    surface = _Surface(spec)
    bg = _background(spec)
    dec = subprocess.Popen(_decode_cmd(spec, play_total), stdout=subprocess.PIPE)
    tmp = out_mp4 + ".tmp.mp4"
    enter_v0 = max(0, enter_n - 1)
    total_est = enter_v0 + play_total + exit_n
    zones = _seam_zones([enter_v0, enter_v0 + play_total - 1], total_est)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps),
                            "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-x264-params", f"zones={zones}",
                            "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp], stdin=subprocess.PIPE)
    fs = W * H * 3
    first = last = second = None
    got = 0
    written = 0
    try:
        buf = dec.stdout.read(fs)
        if len(buf) != fs:
            raise RuntimeError("could not decode the first clip frame")
        first = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        got = 1
        img0 = _to_img(first)
        for i in range(enter_n - 1):                       # ENTER: last frame is the exact grab (below)
            enc.stdin.write(_world_frame(surface, bg, img0, i / (enter_n - 1), False).tobytes())
            written += 1
        enc.stdin.write(first.tobytes())                   # seam frame == clip frame 0 (playback starts here)
        written += 1
        last = first
        while True:
            buf = dec.stdout.read(fs)
            if len(buf) != fs:
                break
            fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            if second is None:
                second = fr
            got += 1
            enc.stdin.write(buf)
            written += 1
            last = fr
        imgL = _to_img(last)
        for i in range(1, exit_n + 1):                     # EXIT: starts from the exact last frame (already written)
            enc.stdin.write(_world_frame(surface, bg, imgL, 1 - i / exit_n, asym).tobytes())
            written += 1
        enc.stdin.close()
        if enc.wait() != 0:
            raise RuntimeError("handoff encode failed")
    except BaseException:
        enc.kill()
        dec.kill()
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    dec.wait()
    play_n = got
    enter_v = max(0, enter_n - 1)          # frames before clip frame 0
    muxed = ffprobe_frames(tmp)
    if muxed != written:
        os.unlink(tmp)
        raise RuntimeError(f"handoff frame parity failed: wrote {written}, muxed {muxed}")
    # seam verification on the ENCODED output, at exact frame indices
    seam_in_idx, seam_out_idx = enter_v, enter_v + play_n - 1
    dec_frames = _decode_frames_at(tmp, [seam_in_idx, seam_out_idx], W, H)
    scores = {}
    if seam_in_idx in dec_frames:
        scores["enter"] = _seam(dec_frames[seam_in_idx], _yuv420_roundtrip(first))
    if seam_out_idx in dec_frames:
        scores["exit"] = _seam(dec_frames[seam_out_idx], _yuv420_roundtrip(last))
    if not hard:
        # render-domain: the fully arrived surface (u=1) must show exactly the grabbed frame (catches crop/grade/resample)
        scores["enterRender"] = _seam(_world_frame(surface, bg, img0, 1.0, False), first)
        scores["exitRender"] = _seam(_world_frame(surface, bg, imgL, 1.0, asym), last)
    decode_ok = len(dec_frames) == 2
    passed = decode_ok and all(_seam_ok(s) for s in scores.values())
    os.replace(tmp, out_mp4)
    audio = _audio(spec, out_wav, enter_v, play_n, exit_n, meta["hasAudio"], src_dur)
    h = hashlib.sha256()
    h.update(json.dumps({k: v for k, v in asdict(spec).items() if k != "clip_path"}, sort_keys=True, default=str).encode())
    h.update(str(os.path.getsize(spec.clip_path)).encode())
    return {
        "kind": "handoff" if not hard else "hardcut",
        "clipAsset": os.path.basename(spec.clip_path),
        "inFrame": int(round(spec.in_s * fps)), "outFrame": int(round(spec.in_s * fps)) + play_n - 1,
        "inPtsS": round(spec.in_s, 4), "outPtsS": round(spec.in_s + (play_n - 1) / fps, 4),
        "transformId": transform_id(spec),
        "surface": {"kind": spec.surface, "params": {"startScale": spec.start_scale, "tiltDeg": spec.tilt_deg, **spec.params}},
        "enterFrames": [0, enter_v], "playbackFrames": [enter_v, enter_v + play_n], "exitFrames": [enter_v + play_n, written],
        "worldStateIn": f"surface:{spec.surface}:u=0", "worldStateOut": f"surface:{spec.surface}:u=0:{'asym' if asym else 'mirror'}",
        "exitStyle": spec.exit_style, "exitReason": spec.exit_reason or ("asymmetric exit chosen by director" if asym else ""),
        "cutType": spec.cut_type, "cutJustification": spec.cut_justification,
        "handles": audio.get("handles", False), "audioTail": audio,
        "seamScores": scores, "seamPass": passed, "decodeVerified": decode_ok,
        "frames": written, "durationMs": int(round(written * 1000 / fps)), "renderHash": h.hexdigest()[:24],
    }
