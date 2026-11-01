"""G1c track-level effects (mirror of new-app lib/clips/editor/track-fx.ts).

One chain per track, applied once to everything on it:
  'voice'  main sound (after the voice volume envelope)
  'music'  the music bed (before ducking)
  'au<N>'  an audio track: its SFX are mixed into one bus, the chain runs on the bus
  'ov<N>'  an overlay track: color look for B-roll items on it without their own look

Order: afftdn → highpass → bass → equalizer → treble → acompressor → volume (LUFS gain) → alimiter.
Every filter / option exists in ffmpeg 5.1 (tests/test_g1c.py runs them on 5.1).
The LUFS target is a LINEAR gain = target − loudnorm-measured integrated loudness of the pre-gain
chain output (the preview applies the same gain from its BS.1770 measurement).
Parity fixture: tests/fixtures/g1c_trackfx_parity.json.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
from pathlib import Path

FX_LIMITS = {
    "nr": (6, 40, 12),
    "hp": (20, 400, 80),
    "shelf": (-12, 12, 0),
    "midHz": (200, 8000, 2500),
    "threshold": (-60, 0, -18),
    "ratio": (1, 20, 3),
    "attack": (0.1, 200, 10),
    "release": (10, 2000, 150),
    "makeup": (0, 24, 0),
    "limit": (-24, 0, -1),
    "lufs": (-36, -8, -16),
    "deess": (0, 100, 50),
    "vfxAmount": (0, 100, 50),
}
VFX_TYPES = frozenset({"echo", "reverb", "robot", "telephone"})
EQ_LOW_HZ = 120
EQ_HIGH_HZ = 8000
EQ_MID_Q = 1
COMP_KNEE_DB = 6
LUFS_GAIN_MAX_DB = 24
_KEY_RE = re.compile(r"^[A-Za-z0-9_-]{1,24}$")


def _js_round(x: float) -> int:
    return int(math.floor(x + 0.5))


def _r2(v: float) -> float:
    return _js_round(v * 100) / 100


def _num(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, str):
        if not v.strip():
            return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def _clamp(v, lim):
    n = _num(v)
    return None if n is None else _r2(min(lim[1], max(lim[0], n)))


def is_overlay_fx_key(key: str) -> bool:
    return bool(re.match(r"^ov\d+$", key or ""))


def is_audio_fx_key(key: str) -> bool:
    return key in ("voice", "music") or bool(re.match(r"^au\d+$", key or ""))


def _num_out(v: float):
    return int(v) if float(v).is_integer() else v


def normalize_track_fx_one(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    track = raw.get("track") if isinstance(raw.get("track"), str) else ""
    if not _KEY_RE.match(track) or not (is_audio_fx_key(track) or is_overlay_fx_key(track)):
        return None
    out: dict = {"track": track}
    if is_audio_fx_key(track):
        nr = _clamp(raw.get("nr"), FX_LIMITS["nr"])
        if nr is not None:
            out["nr"] = _num_out(nr)
        e = raw.get("eq")
        if isinstance(e, dict):
            eq: dict = {}
            hp = _clamp(e.get("hp"), FX_LIMITS["hp"])
            if hp is not None:
                eq["hp"] = _js_round(hp)
            for k in ("low", "mid", "high"):
                g = _clamp(e.get(k), FX_LIMITS["shelf"])
                if g is not None and g != 0:
                    eq[k] = _num_out(g)
            mh = _clamp(e.get("midHz"), FX_LIMITS["midHz"])
            if "mid" in eq:
                eq["midHz"] = _js_round(mh if mh is not None else FX_LIMITS["midHz"][2])
            if eq:
                out["eq"] = eq
        c = raw.get("comp")
        if isinstance(c, dict):
            def pick(k):
                v = _clamp(c.get(k), FX_LIMITS[k])
                return _num_out(v if v is not None else FX_LIMITS[k][2])
            out["comp"] = {k: pick(k) for k in ("threshold", "ratio", "attack", "release", "makeup")}
        lim = _clamp(raw.get("limit"), FX_LIMITS["limit"])
        if lim is not None:
            out["limit"] = _num_out(lim)
        lufs = _clamp(raw.get("lufs"), FX_LIMITS["lufs"])
        if lufs is not None:
            out["lufs"] = _js_round(lufs)
        deess = _clamp(raw.get("deess"), FX_LIMITS["deess"])
        if deess is not None:
            out["deess"] = _js_round(deess)
        vfx = raw.get("vfx")
        if isinstance(vfx, dict):
            t = vfx.get("type")
            if t in VFX_TYPES:
                entry: dict = {"type": t}
                if t != "telephone":
                    amt = _clamp(vfx.get("amount"), FX_LIMITS["vfxAmount"])
                    entry["amount"] = _js_round(amt if amt is not None else FX_LIMITS["vfxAmount"][2])
                out["vfx"] = entry
        if track == "voice":
            pan = raw.get("pan")
            if pan is not None:
                try:
                    p = int(round(float(pan)))
                except (TypeError, ValueError):
                    p = 0
                if p != 0:
                    out["pan"] = max(-100, min(100, p))
    else:
        col = raw.get("color")
        from clips_worker.color import is_identity_spec

        if isinstance(col, dict) and not is_identity_spec(col):
            out["color"] = col
    if raw.get("bypass") is True:
        out["bypass"] = True
    return out if has_fx(out) else None


def has_fx(fx) -> bool:
    return bool(fx) and any(k in fx for k in ("nr", "eq", "comp", "limit", "lufs", "color", "deess", "vfx", "pan"))


def normalize_track_fx(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    by: dict[str, dict] = {}
    for r in raw:
        fx = normalize_track_fx_one(r)
        if fx:
            by[fx["track"]] = fx
    return [by[k] for k in sorted(by)]


def track_fx_for(edits: dict, key: str) -> dict | None:
    for fx in normalize_track_fx(edits.get("trackFx")):
        if fx["track"] == key:
            return fx
    return None


def audio_fx_active(fx) -> bool:
    return bool(fx) and not fx.get("bypass") and is_audio_fx_key(fx.get("track", "")) and has_fx(fx)


def _f(v: float, nd: int = 4) -> str:
    s = f"{v:.{nd}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _lin(db: float) -> float:
    return 10 ** (db / 20.0)


def pan_gains(pan) -> tuple[float, float]:
    p = max(-1.0, min(1.0, float(pan) / 100.0))
    if p <= 0:
        return 1.0, _r2(1.0 + p)
    return _r2(1.0 - p), 1.0


def _vfx_filters(vfx: dict) -> list[str]:
    t = vfx.get("type")
    if t not in VFX_TYPES:
        return []
    if t == "telephone":
        return [
            "highpass=f=300:p=2:t=q:w=0.7071",
            "lowpass=f=3400:p=2:t=q:w=0.7071",
        ]
    amt = float(vfx.get("amount") if vfx.get("amount") is not None else FX_LIMITS["vfxAmount"][2])
    m = max(0.0, min(1.0, amt / 100.0))
    if t == "echo":
        return [f"aecho=1:1:300|600:{_f(0.6 * m)}|{_f(0.3 * m)}"]
    if t == "reverb":
        ds = [_f(m * 0.5 * (0.8 ** (k - 1))) for k in range(1, 7)]
        return [f"aecho=1:1:23|37|53|71|97|131:{'|'.join(ds)}"]
    if t == "robot":
        return [f"aeval=val(ch)*({_f(1 - m)}+{_f(m)}*sin(2*PI*60*t)):c=same"]
    return []


def pre_chain(fx: dict) -> list[str]:
    """Filters before the LUFS gain."""
    if not audio_fx_active(fx):
        return []
    out: list[str] = []
    if fx.get("nr") is not None:
        out.append(f"afftdn=nr={_f(fx['nr'], 2)}:nf=-50")
    eq = fx.get("eq") or {}
    if eq.get("hp") is not None:
        out.append(f"highpass=f={int(eq['hp'])}:p=2:t=q:w=0.7071")
    if eq.get("low") is not None:
        out.append(f"bass=g={_f(eq['low'], 2)}:f={EQ_LOW_HZ}:t=s:w=1")
    if eq.get("mid") is not None:
        out.append(f"equalizer=f={int(eq.get('midHz') or FX_LIMITS['midHz'][2])}:t=q:w={EQ_MID_Q}:g={_f(eq['mid'], 2)}")
    if eq.get("high") is not None:
        out.append(f"treble=g={_f(eq['high'], 2)}:f={EQ_HIGH_HZ}:t=s:w=1")
    if fx.get("deess") is not None:
        out.append(f"deesser=i={_f(float(fx['deess']) / 100.0, 2)}:m=0.5:f=0.5:s=o")
    c = fx.get("comp")
    if c:
        out.append(
            "acompressor="
            f"threshold={_f(max(0.000977, _lin(float(c['threshold']))), 6)}:ratio={_f(float(c['ratio']), 2)}"
            f":attack={_f(float(c['attack']), 2)}:release={_f(float(c['release']), 2)}"
            f":makeup={_f(min(64.0, _lin(float(c['makeup']))), 4)}:knee={_f(_lin(COMP_KNEE_DB), 4)}"
            ":detection=peak:link=maximum"
        )
    vfx = fx.get("vfx")
    if isinstance(vfx, dict):
        out.extend(_vfx_filters(vfx))
    return out


def post_chain(fx: dict, lufs_gain_db: float | None) -> list[str]:
    if not audio_fx_active(fx):
        return []
    out: list[str] = []
    if fx.get("lufs") is not None and lufs_gain_db is not None:
        out.append(f"volume={_f(lufs_gain_db, 2)}dB")
    if fx.get("limit") is not None:
        out.append(f"alimiter=limit={_f(max(0.0625, _lin(float(fx['limit']))), 5)}:attack=5:release=50:level=0")
    return out


def chain_str(fx: dict | None, lufs_gain_db: float | None = None) -> str:
    if not fx:
        return ""
    return ",".join(pre_chain(fx) + post_chain(fx, lufs_gain_db))


def lufs_gain_db(measured, target) -> float | None:
    if target is None or measured is None or not math.isfinite(float(measured)) or float(measured) < -69:
        return None
    return _r2(max(-LUFS_GAIN_MAX_DB, min(LUFS_GAIN_MAX_DB, float(target) - float(measured))))


_LOUD_RE = re.compile(r"\{\s*\"input_i\"[^}]*\}", re.S)


def parse_loudnorm_json(stderr: str) -> float | None:
    m = _LOUD_RE.search(stderr or "")
    if not m:
        return None
    try:
        v = float(json.loads(m.group(0)).get("input_i"))
    except (ValueError, TypeError):
        return None
    return v if math.isfinite(v) else None


def measure_lufs(cmd_inputs: list[str], filter_complex: str, label: str) -> float | None:
    """Integrated loudness of `label` in a graph (loudnorm measure pass, nothing written)."""
    fc = f"{filter_complex};{label}loudnorm=print_format=json[ln]" if filter_complex else f"{label}loudnorm=print_format=json[ln]"
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-y", *cmd_inputs, "-filter_complex", fc, "-map", "[ln]", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return parse_loudnorm_json(r.stderr)


def apply_voice_fx(video: Path, out: Path, fx: dict) -> bool:
    """Main sound through its track chain (video stream copied). False when nothing to do."""
    if not audio_fx_active(fx):
        return False
    pre = pre_chain(fx)
    gain = None
    if fx.get("lufs") is not None:
        fc = f"[0:a]{','.join(pre) or 'anull'}[pre]"
        gain = lufs_gain_db(measure_lufs(["-i", str(video)], fc, "[pre]"), fx["lufs"])
    post = post_chain(fx, gain)
    filters = list(pre + post)
    if fx.get("pan"):
        from clips_worker.audio_render import pan_filter, probe_audio_channels

        pf = pan_filter(int(fx["pan"]), probe_audio_channels(video))
        if pf:
            filters.append(pf.lstrip(","))
    chain = ",".join(filters)
    if not chain:
        return False
    subprocess.check_call(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video), "-map", "0:v:0", "-map", "0:a:0",
         "-c:v", "copy", "-af", chain, "-shortest", "-c:a", "aac", "-b:a", "192k", str(out)]
    )
    return True


def apply_track_color(edits: dict) -> dict:
    """Overlay-track looks → color.broll[id] for items on the track without a look of their own."""
    fxs = [f for f in normalize_track_fx(edits.get("trackFx")) if is_overlay_fx_key(f["track"]) and f.get("color") and not f.get("bypass")]
    if not fxs or not edits.get("broll"):
        return edits
    from clips_worker.tracks import track_id_of

    color = dict(edits.get("color") or {}) if isinstance(edits.get("color"), dict) else {}
    br = dict(color.get("broll") or {}) if isinstance(color.get("broll"), dict) else {}
    by = {f["track"]: f["color"] for f in fxs}
    changed = False
    for b in edits.get("broll") or []:
        bid = str(b.get("id"))
        if bid in br:
            continue
        spec = by.get(track_id_of(edits, "overlay", bid))
        if spec:
            br[bid] = spec
            changed = True
    if not changed:
        return edits
    color["broll"] = br
    return {**edits, "color": color}


def _bus_measure_graph(items: list[tuple[int, float, tuple | None, str | None, str | None]], pre: list[str]) -> str:
    """items: (at_ms, volume, trim, env_expr, channel) — the same per-SFX chain as the mix."""
    from clips_worker.audio_render import sfx_chan, sfx_env, sfx_trim

    parts: list[str] = []
    labs: list[str] = []
    for j, (at, vol, trim, env, ch) in enumerate(items):
        chan = sfx_chan({"channels": [ch]}, 0)
        parts.append(f"[{j}:a]{chan}{sfx_trim([trim] if trim else None, 0)}adelay={at}|{at},volume={vol:.4f}{sfx_env([env], 0)}[m{j}]")
        labs.append(f"[m{j}]")
    sum_ = f"amix=inputs={len(labs)}:duration=longest:normalize=0," if len(labs) > 1 else ""
    parts.append(f"{''.join(labs)}{sum_}{','.join(pre) or 'anull'}[pre]")
    return ";".join(parts)


def mix_track_fx(
    edits: dict,
    *,
    sfx_paths: list,
    sfx_ids: list,
    sfx_trims: list | None,
    sfx_envs: list | None,
    sfx_channels: list | None,
    music_path,
    music_args: tuple | None,
) -> dict | None:
    """`track_fx` for audio_render: per-SFX channel picks, per-SFX bus key, bus / music chains.
    music_args = (L, V, FI, FO, window, envelope) — the same as the mix's music_chain."""
    from clips_worker.tracks import track_id_of

    fxs = {f["track"]: f for f in normalize_track_fx(edits.get("trackFx")) if audio_fx_active(f)}
    channels = list(sfx_channels or [])
    if not fxs and not any(channels):
        return None
    out: dict = {"channels": channels, "buses": [], "bus_fx": {}, "music": None}
    if len(sfx_ids) == len(sfx_paths):
        out["buses"] = [track_id_of(edits, "audio", sid) if sid else None for sid in sfx_ids]
    for key in sorted(set(b for b in out["buses"] if b and b in fxs)):
        fx = fxs[key]
        gain = None
        if fx.get("lufs") is not None:
            idx = [i for i, b in enumerate(out["buses"]) if b == key]
            items = [
                (int(sfx_paths[i][1]), float(sfx_paths[i][2]), (sfx_trims or [None] * len(sfx_paths))[i],
                 (sfx_envs or [None] * len(sfx_paths))[i], channels[i] if i < len(channels) else None)
                for i in idx
            ]
            inputs: list[str] = []
            for i in idx:
                inputs += ["-i", str(sfx_paths[i][0])]
            gain = lufs_gain_db(measure_lufs(inputs, _bus_measure_graph(items, pre_chain(fx)), "[pre]"), fx["lufs"])
        out["bus_fx"][key] = chain_str(fx, gain)
    mfx = fxs.get("music")
    if mfx and music_path is not None and music_args is not None:
        gain = None
        if mfx.get("lufs") is not None:
            from clips_worker.audio_render import music_chain

            L, V, FI, FO, win, env = music_args
            fc = music_chain(0, L, V, FI, FO, win, "mv", env) + f";[mv]{','.join(pre_chain(mfx)) or 'anull'}[pre]"
            gain = lufs_gain_db(measure_lufs(["-i", str(music_path)], fc, "[pre]"), mfx["lufs"])
        out["music"] = chain_str(mfx, gain) or None
    return out
