"""Part 1 / RE-10 (#1207) + RE-12 (#1209): synthesized SFX, beat-keyed generated score, uploaded-music
beat cut, sidechain duck and two-pass loudnorm (-15 LUFS / TP -1.5 / LRA 11).

The default score is a numpy bed in the style of the GME reference `music.py` (nothing to license):
a drone/pad bed, a hat pulse that enters on a story beat, a kick that builds into the peak, everything
cuts at the crash word, and a pad swell resolves under the final hold. Anchors are program-time seconds
from the word clock (the Director picks them). Parameters (bpm, key, mode, instruments, mood) are
derived from a seed = hash(project + script), so the same script is bit-identical and different
scripts differ (RE-12).
"""
from __future__ import annotations

import hashlib
import inspect
import json
import os
import random
import re
import subprocess
import wave
from pathlib import Path

import numpy as np

from clips_worker.motion_studio.core.world import HOUSE
from clips_worker.motion_studio.vendor.cinematic_skill import build_sfx as SFX

SR = 48000
DUCK = {"threshold": 0.025, "ratio": 4, "attack": 35, "release": 550}
NOTE = {"C": 65.41, "C#": 69.30, "D": 73.42, "D#": 77.78, "E": 82.41, "F": 87.31, "F#": 92.50, "G": 98.00,
        "G#": 103.83, "A": 55.00, "A#": 58.27, "B": 61.74}


# ------------------------------------------------------------------ helpers
def _write_wav(path: str, stereo: np.ndarray) -> None:
    tmp = path + ".tmp.wav"
    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
    with wave.open(tmp, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    os.replace(tmp, path)


def silence(path: str, duration: float) -> str:
    _write_wav(path, np.zeros((max(1, int(duration * SR)), 2)))
    return path


def music_seed(project_id: str, script_text: str) -> int:
    return int(hashlib.sha256(f"{project_id}\n{script_text}".encode()).hexdigest()[:8], 16)


def score_params(seed: int, tone: str = "", world: str = "", title: str = "") -> dict:
    """RE-12: tempo, key/mode, instrumentation, mood derived from the script seed + tone + world."""
    r = random.Random(seed)
    blob = " ".join(x for x in (tone, world, title) if x).lower()
    dark = any(k in blob for k in ("dark", "tense", "crime", "crash", "investig", "serious", "tragic", "war",
                                   "drill", "squeeze", "short", "trial", "hearing"))
    bright = any(k in blob for k in ("uplift", "hope", "inspir", "playful", "bright", "fun", "triumph"))
    chart = any(k in blob for k in ("price", "chart", "market", "stock", "finance", "trade"))
    mapped = any(k in blob for k in ("map", "city", "country", "route", "border"))
    mode = "major" if bright else "minor" if dark or chart else r.choice(["minor", "minor", "dorian", "major"])
    lo, hi = (78, 100) if dark or chart else (92, 118) if bright else (84, 108)
    if mapped and not dark:
        lo, hi = (86, 104)
    inst_pool = ["drone", "pad", "hat", "kick", "pluck", "sub", "pulse_bass", "bell"]
    inst = ["pad", "hat", "kick"] + r.sample([i for i in inst_pool if i not in ("pad", "hat", "kick")], k=r.randint(1, 3))
    if chart and "sub" not in inst:
        inst.append("sub")
    return {"bpm": r.randint(lo, hi), "key": r.choice(list(NOTE)), "mode": mode, "instruments": sorted(set(inst)),
            "mood": "dark" if dark else "bright" if bright else ("driving" if chart else r.choice(["tense", "curious", "driving", "reflective"])),
            "seed": seed, "padCutoff": r.choice([380, 420, 520, 650]), "swing": round(r.uniform(0, 0.08), 3),
            "world": (world or "")[:40]}


def generate_score(out_wav: str, duration: float, anchors: dict, params: dict) -> dict:
    """anchors (seconds): pulse (hat enters), build (kick enters), peak, crash (everything cuts, optional),
    resolve (final swell), end. Missing anchors are derived proportionally. Returns the logged event list."""
    from scipy.signal import lfilter
    T = float(duration)
    n = int(T * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    rng = np.random.default_rng(params["seed"])
    a = {k: float(v) for k, v in (anchors or {}).items() if v is not None}
    a.setdefault("pulse", T * 0.18)
    a.setdefault("build", max(a["pulse"] + 2.0, T * 0.42))
    a.setdefault("peak", max(a["build"] + 2.0, T * 0.68))
    a.setdefault("resolve", max(a.get("crash", a["peak"]) + 1.0, T - 5.0))
    a = {k: min(max(0.0, v), T) for k, v in a.items()}
    crash = a.get("crash")
    root = NOTE[params["key"]]
    third = 1.189 if params["mode"] in ("minor", "dorian") else 1.26
    fifth = 1.498

    def env(x0, x1, fi=0.5, fo=0.5):
        e = np.clip((t - x0) / max(fi, 1e-3), 0, 1) * np.clip((x1 - t) / max(fo, 1e-3), 0, 1)
        return e * e * (3 - 2 * e)

    def lp(x, fc):
        k = np.exp(-2 * np.pi * fc / SR)
        return lfilter([1 - k], [1, -k], x)

    def saw(f, ph=0.0):
        return 2 * ((t * f + ph) % 1) - 1

    inst = set(params["instruments"])
    stop = crash if crash is not None else T
    bed = np.zeros(n)
    if "drone" in inst or True:
        bed += 0.5 * np.sin(2 * np.pi * root / 2 * t) + 0.25 * np.sin(2 * np.pi * root / 2 * fifth * t)
    pad = lp(saw(root) + saw(root * 1.006, 0.3) + 0.7 * saw(root * fifth) + 0.5 * saw(root * third, 0.6), params["padCutoff"]) * 0.25
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)
    bed = (bed * 0.55 + pad) * lfo
    grow = np.clip((t - a["pulse"]) / max(0.5, a["peak"] - a["pulse"]), 0, 1)
    benv = env(0.0, stop + 0.05, 2.0, 0.05) * (0.55 + 0.45 * grow)
    if crash is not None:
        benv += env(crash + 1.6, T, 2.5, 2.6) * 0.6
    out += (bed * benv)[:, None]
    beat = 60.0 / params["bpm"]
    events = []

    def hits(start, end, step, fn, gain, pan=0.0, name=""):
        k = start
        i_ = 0
        while k < end - 0.01:
            kk = k + (params["swing"] * step if i_ % 2 else 0.0)
            i0 = int(round(kk * SR))
            s_ = fn()
            j = min(n, i0 + len(s_))
            g = gain(kk)
            out[i0:j, 0] += s_[: j - i0] * g * (1 - pan)
            out[i0:j, 1] += s_[: j - i0] * g * (1 + pan)
            k += step
            i_ += 1
        events.append({"inst": name, "start": round(start, 3), "end": round(min(end, T), 3), "step": round(step, 4)})

    def hat():
        m = int(0.05 * SR)
        x = rng.standard_normal(m)
        x = x - lfilter([1 - np.exp(-2 * np.pi * 6000 / SR)], [1, -np.exp(-2 * np.pi * 6000 / SR)], x)
        return x * np.exp(-np.arange(m) / (0.012 * SR)) * 0.35

    def kick():
        m = int(0.35 * SR)
        tt = np.arange(m) / SR
        f = 45 + 90 * np.exp(-tt / 0.03)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16) * 0.9

    def pluck(f):
        def _p():
            m = int(0.4 * SR)
            tt = np.arange(m) / SR
            return (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt / 0.09) * 0.25
        return _p

    ramp_g = lambda k0: (lambda k: 0.5 + 0.5 * min(1.0, max(0.0, (k - k0) / max(0.5, a["peak"] - k0))))
    if "hat" in inst:
        hits(a["pulse"], stop - 0.02, beat / 2, hat, ramp_g(a["pulse"]), 0.15, "hat")
    if "kick" in inst:
        hits(a["build"], stop - 0.02, beat, kick, ramp_g(a["build"]), 0.0, "kick")
    if "pluck" in inst:
        arp = [root * 2, root * 2 * third, root * 2 * fifth, root * 4]
        for q, f in enumerate(arp):
            hits(a["build"] + q * beat / 2, stop - 0.02, beat * 2, pluck(f), lambda k: 0.6, (q - 1.5) / 6, f"pluck{q}")
    if "sub" in inst or "pulse_bass" in inst:
        sub = np.sin(2 * np.pi * root / 2 * t) * env(a["build"], stop, 1.0, 0.05) * 0.35
        if "pulse_bass" in inst:
            sub *= 0.6 + 0.4 * (np.sin(2 * np.pi * t / beat) > 0)
        out += sub[:, None]
    if "bell" in inst:
        hits(a["peak"], min(stop, a["peak"] + beat * 8), beat * 2, pluck(root * 8), lambda k: 0.35, -0.3, "bell")
    ch = sum(lp(saw(f) + saw(f * 1.004, 0.5), 900) for f in (root, root * fifth, root * 2)) * 0.22
    out += (ch * env(max(0.0, a["resolve"] - 0.6), T, 0.8, 2.4))[:, None]
    # riser into the peak (GME music.py: energy builds into the hit word)
    r0, r1 = max(0.0, a["peak"] - 3.0), a["peak"]
    if r1 - r0 > 0.6:
        nz = rng.standard_normal(n)
        sweep = lp(nz, 400 + 1800 * np.clip((t - r0) / max(0.2, r1 - r0), 0, 1))
        out += (sweep * env(r0, r1, 1.2, 0.05) * 0.16)[:, None]
        events.append({"inst": "riser", "start": round(r0, 3), "end": round(r1, 3), "step": 0})
    out /= np.abs(out).max() + 1e-9
    out *= 0.7
    _write_wav(out_wav, out)
    return {"params": params, "anchors": {k: round(v, 3) for k, v in a.items()}, "events": events, "source": "generated"}


# ------------------------------------------------------------------ uploaded music (beat cut)
def beat_grid(path: str) -> dict:
    import librosa
    y, sr = librosa.load(path, sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
    return {"bpm": float(np.atleast_1d(tempo)[0]), "beats": [round(float(b), 4) for b in beats],
            "duration": float(len(y) / sr)}


def snap_window_to_beats(path: str, in_s: float, out_s: float, *, max_shift: float = 0.2,
                         min_span: float = 1.5) -> dict:
    """ST-RW-005: snap a footage in/out window to a stable musical beat grid.

    Only snaps when the clip has a regular beat (inter-beat CV <= 0.15) and the nearest
    beat is within `max_shift` seconds. Speech-heavy clips usually fail the stability
    test and are left unchanged. Never an automatic paid call.
    """
    orig_in, orig_out = float(in_s), float(out_s)
    in_s, out_s = orig_in, orig_out
    info = {"inS": in_s, "outS": out_s, "snapped": False, "reason": "no_grid"}
    try:
        grid = beat_grid(path)
    except Exception:  # noqa: BLE001
        info["reason"] = "beat_detect_failed"
        return info
    beats = [b for b in (grid.get("beats") or []) if b >= 0]
    if len(beats) < 8:
        info["reason"] = "too_few_beats"
        return info
    gaps = np.diff(beats)
    mean = float(gaps.mean()) if len(gaps) else 0.0
    if mean <= 0.2 or (float(gaps.std()) / mean) > 0.15:
        info["reason"] = "unstable_grid"
        return info

    def nearest(t):
        return min(beats, key=lambda b: abs(b - t))

    inn, outn = nearest(in_s), nearest(out_s)
    if abs(inn - in_s) > max_shift and abs(outn - out_s) > max_shift:
        info["reason"] = "too_far"
        return info
    if abs(inn - in_s) <= max_shift:
        in_s = float(inn)
    if abs(outn - out_s) <= max_shift:
        out_s = float(outn)
    if out_s - in_s < min_span:
        later = [b for b in beats if b >= in_s + min_span]
        out_s = float(later[0]) if later else in_s + min_span
    return {"inS": round(in_s, 4), "outS": round(out_s, 4), "snapped": True, "reason": "beat",
            "bpm": grid.get("bpm"), "shiftIn": round(in_s - orig_in, 4), "shiftOut": round(out_s - orig_out, 4)}


def cut_uploaded_music(src: str, out_wav: str, duration: float, work_dir: str, start_on_beat: float | None = None) -> dict:
    """Start on a beat, loop with the existing crossfaded-loop helper (reuse), fade the tail on a beat."""
    from clips_worker.audio_render import prepare_looped_music_bed
    grid = beat_grid(src)
    beats = grid["beats"] or [0.0]
    b0 = start_on_beat if start_on_beat is not None else beats[0]
    trimmed = os.path.join(work_dir, "music_from_beat.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{b0:.4f}", "-i", src, "-ar", str(SR), "-ac", "2", trimmed], check=True)
    bed = prepare_looped_music_bed(Path(trimmed), duration, Path(work_dir))
    fo = 2.5
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(bed), "-af",
                    f"apad,atrim=0:{duration:.4f},afade=t=out:st={max(0, duration - fo):.3f}:d={fo}",
                    "-ar", str(SR), "-ac", "2", out_wav + ".tmp.wav"], check=True)
    os.replace(out_wav + ".tmp.wav", out_wav)
    return {"source": "upload", "bpm": grid["bpm"], "startBeatS": b0, "beats": len(beats)}


# ------------------------------------------------------------------ SFX
def build_sfx(cues: list[dict], duration: float, out_wav: str, speech: list[tuple[float, float]] | None = None) -> dict:
    """Synthesized SFX bed from cues (ST-BLK-16). A19 auto-fix: a cue landing inside speech is pulled
    -6 dB, or shifted ~150 ms into the nearest gap if that is closer than 150 ms (ST-RW-008)."""
    bed = SFX.Bed(duration)
    speech = speech or []
    fixes = []
    for i, c in enumerate(sorted(cues, key=lambda c: c["t"])):
        fn = SFX.SOUNDS.get(c.get("type"))
        if fn is None:
            continue
        t0, g = float(c["t"]), float(c.get("gain", 1.0))
        for s0, s1 in speech:
            if s0 <= t0 <= s1:
                gap = min(abs(t0 - s0), abs(s1 - t0))
                if gap <= 0.15:
                    t0 = s0 - 0.02 if abs(t0 - s0) < abs(s1 - t0) else s1 + 0.02
                    fixes.append({"t": c["t"], "fix": "shift", "to": round(t0, 3)})
                else:
                    g *= 0.5
                    fixes.append({"t": c["t"], "fix": "-6dB"})
                break
        kw = {"dur": c["dur"]} if "dur" in c and "dur" in inspect.signature(fn).parameters else {}
        bed.add(fn(seed=100 + i, **kw), max(t0, 0), gain=g, pan=((i * 37) % 11 - 5) / 20)
    tmp = Path(out_wav + ".tmp.wav")
    bed.render(tmp)
    os.replace(tmp, out_wav)
    return {"cues": len(cues), "fixes": fixes, "source": "synthesized"}


# ------------------------------------------------------------------ mix + loudness
def _loudnorm_measure(path: str, I: float, TP: float, LRA: float) -> dict:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                        f"loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S)
    return json.loads(m[-1]) if m else {}


def loudness(path: str) -> dict:
    d = _loudnorm_measure(path, HOUSE["lufs"], HOUSE["true_peak"], HOUSE["lra"])
    try:
        return {"I": float(d["input_i"]), "TP": float(d["input_tp"]), "LRA": float(d["input_lra"])}
    except (KeyError, ValueError):
        return {}


def mix(out_wav: str, duration: float, vo: str | None, music: str | None, sfx: str | None,
        clips: list[str] | None = None, music_gain_db: float = -9.0, sfx_gain_db: float = -8.0) -> dict:
    """VO + music (sidechain-ducked under VO) + SFX + clip-audio stems -> two-pass loudnorm. Padded or
    trimmed to exactly `duration` (never -shortest)."""
    I, TP, LRA = HOUSE["lufs"], HOUSE["true_peak"], HOUSE["lra"]
    ins, chains, labels = [], [], []
    def add(p):
        ins.extend(["-i", p])
        return len(ins) // 2 - 1
    fmt = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
    if vo:
        k = add(vo)
        chains.append(f"[{k}:a]{fmt},apad,atrim=0:{duration:.4f},asplit=2[vo][vosc]")
        labels.append("[vo]")
    if music:
        k = add(music)
        chains.append(f"[{k}:a]{fmt},volume={music_gain_db}dB,apad,atrim=0:{duration:.4f}[mu0]")
        if vo:
            chains.append(f"[mu0][vosc]sidechaincompress=threshold={DUCK['threshold']}:ratio={DUCK['ratio']}:"
                          f"attack={DUCK['attack']}:release={DUCK['release']}[mu]")
        else:
            chains.append("[mu0]anull[mu]")
        labels.append("[mu]")
    elif vo:
        chains.append("[vosc]anullsink")
    if sfx:
        k = add(sfx)
        chains.append(f"[{k}:a]{fmt},volume={sfx_gain_db}dB,apad,atrim=0:{duration:.4f}[sx]")
        labels.append("[sx]")
    for j, c in enumerate(clips or []):
        k = add(c)
        chains.append(f"[{k}:a]{fmt},apad,atrim=0:{duration:.4f}[cl{j}]")
        labels.append(f"[cl{j}]")
    if not labels:
        silence(out_wav, duration)
        return {"I": None}
    chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{duration:.4f}[pre]")
    pre = out_wav + ".pre.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(chains), "-map", "[pre]",
                    "-c:a", "pcm_s24le", pre], check=True)
    m = _loudnorm_measure(pre, I, TP, LRA)
    if m:
        ln = (f"loudnorm=I={I}:TP={TP}:LRA={LRA}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
              f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    else:
        ln = f"loudnorm=I={I}:TP={TP}:LRA={LRA}"
    tmp = out_wav + ".tmp.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af", f"{ln},aresample=48000,apad,atrim=0:{duration:.4f}",
                    "-ar", "48000", "-c:a", "pcm_s16le", tmp], check=True)
    os.replace(tmp, out_wav)
    os.unlink(pre)
    meas = loudness(out_wav)
    meas["target"] = {"I": I, "TP": TP, "LRA": LRA}
    meas["pass"] = bool(meas.get("I") is not None and abs(meas["I"] - I) <= 1.0 and meas["TP"] <= TP + 0.05)
    return meas
