"""Load music/SFX local files for export from edits.audio."""
from __future__ import annotations

import json
from pathlib import Path

from clips_worker.storage import download_object



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
            music_path = up
            music_meta = {
                "volume": float(music.get("volume", 0.25)),
                "duckDepth": float(music.get("duckDepth", 0.7)),
                "fadeInMs": int(music.get("fadeInMs", 500)),
                "fadeOutMs": int(music.get("fadeOutMs", 1000)),
                "startMs": music.get("startMs"),
                "endMs": music.get("endMs"),
                "inMs": music.get("inMs"),
            }
    elif music and music.get("generationId"):
        with conn.cursor() as cur:
            cur.execute('SELECT "storageKey" FROM ai_generations WHERE id=%s', (music["generationId"],))
            row = cur.fetchone()
        if row and row[0]:
            music_path = work_dir / "music.mp3"
            download_object(row[0], music_path)
            music_meta = {
                "volume": float(music.get("volume", 0.25)),
                "duckDepth": float(music.get("duckDepth", 0.7)),
                "fadeInMs": int(music.get("fadeInMs", 500)),
                "fadeOutMs": int(music.get("fadeOutMs", 1000)),
                # E2 timeline window (output ms); absent = whole clip from media 0.
                "startMs": music.get("startMs"),
                "endMs": music.get("endMs"),
                "inMs": music.get("inMs"),
            }

    sfx_paths: list[tuple[Path, int, float]] = []
    sfx_ids: list[str] = []  # G1b3: parallel to sfx_paths (generationId → `sfx:<id>` envelope)
    sfx_trims: list[tuple[int, int | None]] = []  # G1b3: (inMs, durMs) — detached clip audio
    for i, item in enumerate(sfx_list):
        if item.get("uploadId"):
            up = (media or {}).get(str(item["uploadId"]))
            if up is not None:
                sfx_paths.append((up, int(item.get("atMs", 0)), float(item.get("volume", 0.8))))
                sfx_ids.append(str(item.get("generationId") or ""))
                sfx_trims.append(_sfx_trim(item))
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
        "studio_path": studio_path,
        "studio_mix": studio_mix,
        "studio_source_offset_ms": studio_source_offset_ms,
        "studio_source_key": studio_source_key,
    }
