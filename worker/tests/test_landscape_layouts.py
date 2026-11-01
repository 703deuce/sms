import json
from pathlib import Path

from clips_worker.layout_router import LANDSCAPE_LAYOUTS, landscape_layout

FIX = Path(__file__).resolve().parent / "fixtures" / "landscape_layouts.json"


def test_py_landscape_table_matches_fixture():
    fixture = json.loads(FIX.read_text(encoding="utf-8"))
    for mode, worker in fixture.items():
        assert landscape_layout(mode) == worker
    assert landscape_layout("unknown") == "fit"
    assert LANDSCAPE_LAYOUTS["center_crop"] == "fill"
