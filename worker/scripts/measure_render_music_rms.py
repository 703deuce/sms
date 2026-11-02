#!/usr/bin/env python3
"""Measure music.wav RMS at fixed timestamps from a READY render stems zip."""
from __future__ import annotations

import os
import sys
import tempfile
import zipfile
from pathlib import Path

import psycopg2

from clips_worker.audio_render import measure_segment_rms_db
from clips_worker.storage import download_object


def main() -> int:
    rid = sys.argv[1] if len(sys.argv) > 1 else ""
    if not rid:
        print("usage: measure_render_music_rms.py <renderId>", file=sys.stderr)
        return 1
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute('select "stemsKey", status from clip_renders where id=%s', (rid,))
    row = cur.fetchone()
    if not row:
        print("render not found", file=sys.stderr)
        return 1
    key, status = row[0], row[1]
    print("status", status)
    if not key:
        print("no stemsKey", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory() as td:
        zpath = Path(td) / "stems.zip"
        download_object(key, zpath)
        with zipfile.ZipFile(zpath) as zf:
            zf.extract("music.wav", td)
        music = Path(td) / "music.wav"
        for label, t0, t1 in [
            ("37.0", 36.95, 37.05),
            ("38.0", 37.95, 38.05),
            ("39.0", 38.95, 39.05),
            ("40.0", 39.95, 40.05),
            ("40.5", 40.45, 40.55),
            ("40.9", 40.85, 40.95),
        ]:
            db = measure_segment_rms_db(music, t0, t1)
            print(f"{label}s {db:.2f} dB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
