"""Load music/SFX local files for export from edits.audio."""
from __future__ import annotations

import json
from pathlib import Path

from clips_worker.storage import download_object
from clips_worker.media_sources import has_audio_stream

AUDIO_FADE_MAX_MS = 10_000  # TS AUDIO_FADE_MAX_MS



def _sfx_trim(item: dict) -> tuple[int, int | None]:
    """G1b3: SFX media in-point / play length (TS ClipAudioSfx.inMs / durMs)."""
    try:
        in_ms = max(0, int(round(float(item.get("inMs") or 0))))
    except (TypeError, ValueError):
        in_ms = 0
    try:
        d = int(round(float(item.get("durMs")))) if item.get("durMs") is not None else None
    except (TypeError, ValueError):
        d = None
    return in_ms, (d if d is not None and d >= 100 else None)


def _channels(path: Path) -> int:
    from clips_worker.audio_render import probe_audio_channels

    return probe_audio_channels(path)


def _pan_meta(item: dict) -> dict:
    try:
        p = int(round(float(item.get("pan"))))
    except (TypeError, ValueError):
        return {}
    if p == 0:
        return {}
    return {"pan": max(-100, min(100, p))}


def _sfx_fx(item: dict) -> dict | None:
    """G2: per-clip fades / ducking (TS ClipAudioSfx.fadeInMs / fadeOutMs / duckDepth)."""

    def ms(v) -> int:
        try:
            n = int(round(float(v)))
        except (TypeError, ValueError):
            return 0
        return max(0, min(AUDIO_FADE_MAX_MS, n))

    fi, fo = ms(item.get("fadeInMs")), ms(item.get("fadeOutMs"))
    duck = None
    if item.get("duckDepth") is not None:
        try:
            duck = max(0.0, min(1.0, float(item.get("duckDepth"))))
        except (TypeError, ValueError):
            duck = None
    # G2fix: a looping music clip (TS ClipAudioSfx.loop) — only with an explicit play length,
    # which bounds the `-stream_loop -1` input (atrim duration=durMs).
    loop = item.get("loop") is True and _sfx_trim(item)[1] is not None
    pan = _pan_meta(item)
    if not fi and not fo and duck is None and not loop and not pan:
        return None
    out = {"fade_in_ms": fi, "fade_out_ms": fo, "duck_depth": duck, **pan}
    if loop:
        out["loop"] = True
    return out


def _media_len_ms(path: Path) -> int | None:
    """Audio length (ms) for a fade-out on a clip with no explicit play length."""
    import subprocess

    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
            text=True,
            timeout=30,
        )
        return int(round(float(out.strip()) * 1000))
    except Exception:
        return None


def _with_play_len(fx: dict | None, path: Path, trim: tuple[int, int | None]) -> dict | None:
    if not fx or not (fx.get("fade_in_ms") or fx.get("fade_out_ms")):
        return fx
    in_ms, dur = trim
    if fx.get("loop") and dur is not None:
        # G2fix: a looping clip plays its whole durMs (TS clipPlayLenMs).
        return {**fx, "play_ms": dur}
    # Same as the preview: the play length is durMs capped by the media after the in-point.
    full = _media_len_ms(path)
    rest = None if full is None else max(0, full - in_ms)
    if dur is None:
        dur = rest
    elif rest is not None:
        dur = min(dur, rest)
    return {**fx, "play_ms": dur}


def load_audio_assets(conn, edits: dict, work_dir: Path, media: dict | None = None) -> dict:
    audio = edits.get("audio") or {}
    music = audio.get("music")
    sfx_list = audio.get("sfx") or []

    music_path = None
    music_meta = None
    if music and music.get("uploadId"):
        # E5: the user's own audio upload (media library), same mix / window / fades as AI music.
        up = (media or {}).get(str(music["uploadId"]))
        if up is not None:
            if not has_audio_stream(up):
                print(f"[audio] skip {music['uploadId']}: no audio stream", flush=True)
            else:
                music_path = up
                music_meta = {
                    "volume": float(music.get("volume", 0.5)),
                    "duckDepth": float(music.get("duckDepth", 0.55)),
                    "fadeInMs": int(music.get("fadeInMs", 500)),
                    "fadeOutMs": int(music.get("fadeOutMs", 1000)),
                    "startMs": music.get("startMs"),
                    "endMs": music.get("endMs"),
                    "inMs": music.get("inMs"),
                    "loop": music.get("loop") is True,
                    **_pan_meta(music),
                }
                if music_meta.get("pan") is not None:
                    music_meta["pan_ch"] = _channels(up)
    elif music and music.get("generationId"):
        with conn.cursor() as cur:
            cur.execute('SELECT "storageKey" FROM ai_generations WHERE id=%s', (music["generationId"],))
            row = cur.fetchone()
        if row and row[0]:
            music_path = work_dir / "music.mp3"
            download_object(row[0], music_path)
            music_meta = {
                "volume": float(music.get("volume", 0.5)),
                "duckDepth": float(music.get("duckDepth", 0.55)),
                "fadeInMs": int(music.get("fadeInMs", 500)),
                "fadeOutMs": int(music.get("fadeOutMs", 1000)),
                # E2 timeline window (output ms); absent = whole clip from media 0.
                "startMs": music.get("startMs"),
                "endMs": music.get("endMs"),
                "inMs": music.get("inMs"),
                "loop": music.get("loop") is True,  # G2 Fit to length
                **_pan_meta(music),
            }
            if music_meta.get("pan") is not None:
                music_meta["pan_ch"] = _channels(music_path)

    sfx_paths: list[tuple[Path, int, float]] = []
    sfx_ids: list[str] = []  # G1b3: parallel to sfx_paths (generationId → `sfx:<id>` envelope)
    sfx_trims: list[tuple[int, int | None]] = []  # G1b3: (inMs, durMs) — detached clip audio
    sfx_channels: list[str | None] = []  # G1c: 'L' / 'R' (split stereo) or None
    sfx_fx: list[dict | None] = []  # G2: fades / ducking per clip
    for i, item in enumerate(sfx_list):
        if item.get("uploadId"):
            up = (media or {}).get(str(item["uploadId"]))
            if up is not None:
                if not has_audio_stream(up):
                    print(f"[audio] skip {item.get('uploadId')}: no audio stream", flush=True)
                    continue
                ch = item.get("channel") if item.get("channel") in ("L", "R") else None
                sfx_paths.append((up, int(item.get("atMs", 0)), float(item.get("volume", 0.8))))
                sfx_ids.append(str(item.get("generationId") or ""))
                sfx_trims.append(_sfx_trim(item))
                sfx_channels.append(ch)
                fx = _with_play_len(_sfx_fx(item), up, sfx_trims[-1])
                if fx and fx.get("pan") is not None:
                    fx["pan_ch"] = 1 if ch else _channels(up)
                sfx_fx.append(fx)
            continue
        gid = item.get("generationId")
        if not gid:
            continue
        with conn.cursor() as cur:
            cur.execute('SELECT "storageKey" FROM ai_generations WHERE id=%s', (gid,))
            row = cur.fetchone()
        if not row or not row[0]:
            continue
        local = work_dir / f"sfx_{i}.mp3"
        download_object(row[0], local)
        sfx_paths.append((local, int(item.get("atMs", 0)), float(item.get("volume", 0.8))))
        sfx_ids.append(str(gid))
        sfx_trims.append(_sfx_trim(item))
        sfx_channels.append(item.get("channel") if item.get("channel") in ("L", "R") else None)
        sfx_fx.append(_with_play_len(_sfx_fx(item), local, sfx_trims[-1]))
        if sfx_fx[-1] and sfx_fx[-1].get("pan") is not None:
            ch = sfx_channels[-1]
            sfx_fx[-1]["pan_ch"] = 1 if ch else _channels(local)

    studio_path = None
    studio_mix = None
    studio_source_offset_ms = None
    studio_source_key = None
    studio = audio.get("studioSound") or {}
    if studio.get("enabled") and studio.get("generationId"):
        gid = studio["generationId"]
        with conn.cursor() as cur:
            cur.execute('SELECT "storageKey", status, params FROM ai_generations WHERE id=%s', (gid,))
            row = cur.fetchone()
        if row and row[0] and row[1] == "READY":
            studio_path = work_dir / "studio_isolated.mp3"
            download_object(row[0], studio_path)
            studio_mix = float(studio.get("mix", 0.35))
            params = row[2]
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except json.JSONDecodeError:
                    params = {}
            if isinstance(params, dict):
                if params.get("sourceOffsetMs") is not None:
                    studio_source_offset_ms = int(params["sourceOffsetMs"])
                if params.get("sourceKey"):
                    studio_source_key = str(params["sourceKey"])

    return {
        "music_path": music_path,
        "music_meta": music_meta,
        "sfx_paths": sfx_paths,
        "sfx_ids": sfx_ids,
        "sfx_trims": sfx_trims,
        "sfx_channels": sfx_channels,
        "sfx_fx": sfx_fx,
        "studio_path": studio_path,
        "studio_mix": studio_mix,
        "studio_source_offset_ms": studio_source_offset_ms,
        "studio_source_key": studio_source_key,
    }
