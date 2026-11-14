"""T2V QA log lines are printed (flush=True): the worker has no logging setup, so log.info lines were dropped."""
from __future__ import annotations

import json
import re
from pathlib import Path

from clips_worker.t2v import assemble as asm
from clips_worker.t2v import verify_stock as vs

T2V_DIR = Path(vs.__file__).parent


def test_no_t2v_log_info_left():
    for f in ("verify_stock.py", "assemble.py", "job.py", "stock_repair.py"):
        src = (T2V_DIR / f).read_text()
        assert "log.info(" not in src, f
        starts = [m.start() for m in re.finditer(r'print\(\s*f?"\[t2v:', src)]
        for k, i in enumerate(starts):
            stop = min([j for j in (src.find("\ndef ", i), *(starts[k + 1:k + 2])) if j > 0] or [len(src)])
            assert "flush=True" in src[i:stop], (f, src[i:i + 80])


def test_assemble_window_line_printed(capsys):
    m = asm.SceneMedia(path=Path("/tmp/x.mp4"), kind="video", window_in_s=6.2, window_out_s=9.8, label="scene:2339")
    asm.log_render_window(m, 6.2, 3.6, False)
    out = capsys.readouterr().out.strip()
    assert out.startswith("[t2v:assemble:window] ")
    rep = json.loads(out.split(" ", 1)[1])
    assert rep["verified"] == rep["rendered"] == [6.2, 9.8] and rep["startMatches"] is True
    assert "http" not in out


def test_scene_and_candidate_lines_printed_without_urls(capsys):
    ev = [{"providerId": "2339", "score": 6, "lighting": 7, "matches": False, "depicts": "partly", "inS": 6.2, "outS": 9.8,
           "previewUrl": "https://cdn.example/v.mp4?token=secret"}]
    vs._log_scene("job_1", "d1", 0, {"sceneId": "sc_1", "lineNo": 1}, None, ev)
    out = capsys.readouterr().out
    assert "[t2v:verify:candidate] " in out and "[t2v:verify:scene] " in out
    assert "http" not in out and "secret" not in out
