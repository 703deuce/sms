"""Lavfi integration: assemble + ASS burn (no DB/storage)."""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from clips_worker.t2v.assemble import Scene, SceneMedia, assemble, probe_duration
from clips_worker.t2v.render_finalize import finalize_t2v_video


def test_assemble_and_titles_under_10s():
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        vo = d / "vo.wav"
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=440:d=2",
                "-ar", "48000", "-ac", "1", str(vo),
            ],
            check=True,
            capture_output=True,
        )
        scenes = [
            Scene("a", 2.0, SceneMedia("color"), "fade", 0.5, vo),
            Scene("b", 2.0, SceneMedia("color", color="0x222222"), "fade", 0.5, None),
        ]
        asm = assemble(scenes, d / "work", w=320, h=180, fps=24)
        doc = {
            "settings": {"aspect": "16:9", "brand": {"primaryColor": "#FACC15"}},
            "scenes": [
                {"slot": 0, "texts": [{"kind": "title", "text": "Test", "startMs": 0, "endMs": 1500, "animation": "fade"}]},
                {"slot": 1, "texts": []},
            ],
        }
        out = d / "final.mp4"
        finalize_t2v_video(
            asm["source"],
            out,
            document=doc,
            scene_starts_ms=asm["sceneStartsMs"],
            w=320,
            h=180,
            work_dir=d / "post",
        )
        dur = probe_duration(out)
        assert dur <= 10.0 and dur >= 3.0
