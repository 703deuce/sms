"""Caption preset ASS mapping parity (T6.1 F5)."""
from __future__ import annotations

import re

import pytest

from clips_worker.captions_ass import build_ass, resolve_ass_font_name, _ASS_FONT_ALIASES
from clips_worker.t6_captions import map_v2_to_legacy_ass_preset, resolve_caption_preset_v2
from clips_worker.t6_registry import CAPTION_PRESETS_V2


@pytest.mark.parametrize("preset_id", sorted(k for k in CAPTION_PRESETS_V2 if k.startswith("cp")))
def test_resolve_ass_font_no_fallback(preset_id: str, tmp_path, capsys):
    v2 = resolve_caption_preset_v2(preset_id)
    legacy = map_v2_to_legacy_ass_preset({**v2, "id": preset_id})
    edits = {"presetId": preset_id}
    name = resolve_ass_font_name(edits, legacy)
    canonical = _ASS_FONT_ALIASES.get(str(legacy.get("font") or ""), legacy.get("font"))
    assert name == canonical or name.startswith(str(legacy.get("font") or "")[:4])
    out = capsys.readouterr().out
    assert "font_fallback" not in out


def test_pick_caption_preset_four_args():
    from clips_worker.t6_captions import pick_caption_preset

    pid, _ = pick_caption_preset({"clip_type": "gaming"}, {"duration_s": 10}, [], "seed")
    assert pid == "cp2"
