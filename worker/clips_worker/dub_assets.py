"""Load dub audio + words for export when edits.audioTrack is dub:<id>."""
from __future__ import annotations

import json
from pathlib import Path


def load_dub_assets(conn, edits: dict, work_dir: Path) -> dict | None:
    track = (edits or {}).get("audioTrack") or "original"
    if not str(track).startswith("dub:"):
        return None
    dub_id = str(track).split(":", 1)[1]
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "audioKey", words, status FROM dub_tracks WHERE id=%s',
            (dub_id,),
        )
        row = cur.fetchone()
    if not row or row[2] != "READY" or not row[0]:
        return None
    from clips_worker.storage import download_object

    audio_key, words_json, _ = row
    audio_path = work_dir / "dub_audio.m4a"
    download_object(audio_key, audio_path)
    words = words_json
    if isinstance(words, str):
        words = json.loads(words)
    return {"dub_audio_path": audio_path, "dub_words": words or []}
