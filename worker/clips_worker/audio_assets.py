"""Load music/SFX local files for export from edits.audio."""
from __future__ import annotations

from pathlib import Path


def load_audio_assets(conn, edits: dict, work_dir: Path) -> dict:
    audio = edits.get("audio") or {}
    music = audio.get("music")
    sfx_list = audio.get("sfx") or []

    music_path = None
    music_meta = None
    if music and music.get("generationId"):
        with conn.cursor() as cur:
            cur.execute('SELECT "storageKey" FROM ai_generations WHERE id=%s', (music["generationId"],))
            row = cur.fetchone()
        if row and row[0]:
            from clips_worker.storage import download_object

            music_path = work_dir / "music.mp3"
            download_object(row[0], music_path)
            music_meta = {
                "volume": float(music.get("volume", 0.25)),
                "duckDepth": float(music.get("duckDepth", 0.7)),
                "fadeInMs": int(music.get("fadeInMs", 500)),
                "fadeOutMs": int(music.get("fadeOutMs", 1000)),
            }

    sfx_paths: list[tuple[Path, int, float]] = []
    for i, item in enumerate(sfx_list):
        gid = item.get("generationId")
        if not gid:
            continue
        with conn.cursor() as cur:
            cur.execute('SELECT "storageKey" FROM ai_generations WHERE id=%s', (gid,))
            row = cur.fetchone()
        if not row or not row[0]:
            continue
        from clips_worker.storage import download_object

        local = work_dir / f"sfx_{i}.mp3"
        download_object(row[0], local)
        sfx_paths.append((local, int(item.get("atMs", 0)), float(item.get("volume", 0.8))))

    return {"music_path": music_path, "music_meta": music_meta, "sfx_paths": sfx_paths}
