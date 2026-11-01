import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("build_music_library", ROOT / "scripts" / "build_music_library.py")
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)
build_catalog_entries = _mod.build_catalog_entries
load_prompts = _mod.load_prompts
write_catalog = _mod.write_catalog


def test_build_catalog_from_prompts(tmp_path):
    prompts = [
        {
            "id": "ml-test",
            "title": "test bed",
            "mood": "calm",
            "genre": "lo-fi",
            "energy": "low",
            "lengthS": 30,
            "prompt": "calm lo-fi instrumental 30 seconds no vocals",
        }
    ]
    p = tmp_path / "prompts.json"
    p.write_text(json.dumps(prompts), encoding="utf-8")
    entries = build_catalog_entries(load_prompts(p))
    assert len(entries) == 1
    assert entries[0]["id"] == "ml-test"
    assert entries[0]["kind"] == "music"
    out = tmp_path / "catalog.json"
    write_catalog(out, entries)
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded[0]["license"] == "elevenlabs"


def test_cli_refuses_run_flag():
    script = Path(__file__).resolve().parents[1] / "scripts/build_music_library.py"
    proc = subprocess.run(
        [sys.executable, str(script), "--run"],
        capture_output=True,
        text=True,
        cwd=str(Path(__file__).resolve().parents[2]),
    )
    assert proc.returncode != 0
    assert "--run" in proc.stderr + proc.stdout
