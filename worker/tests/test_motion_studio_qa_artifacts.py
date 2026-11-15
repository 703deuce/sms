"""ST-BLK-19 contact sheet / strips and ST-RW-003 spoken vs on-screen numbers."""
import os
import subprocess
import tempfile

from clips_worker.motion_studio.core.qa import (
    contact_sheet,
    export_qa_artifacts,
    hit_word_times,
    motion_strip,
    numbers_close,
    parse_spoken_numbers,
    parse_written_numbers,
    rolling_numbers_from_code,
    spoken_number_check,
)


def test_parse_numbers_written_and_spoken():
    assert 2_200_000 in parse_written_numbers("the clip shows $2.2M on screen")
    assert 140 in parse_written_numbers("it ran up 140%")
    assert 6_000_000 in parse_spoken_numbers("and then six million dollars")
    assert 140 in parse_spoken_numbers("one hundred forty percent")
    assert numbers_close(6_000_000, 6_000_000)
    assert not numbers_close(2_200_000, 6_000_000)


def test_rolling_number_from_code_and_keef_class_mismatch():
    code = (
        "from motion_core import *\n"
        "def build_scene(ctx):\n"
        "    film.add(RollingNumber(200, 400, 260, 0, 2_200_000, 0.3, 1.2, prefix='$', suffix=''))\n"
    )
    assert rolling_numbers_from_code(code)[0]["v1"] == 2_200_000
    story = {"lines": [{"id": "l1", "text": "It was six million dollars.", "spoken": "it was six million dollars"}], "data": []}
    plan = {"scenes": [{"index": 0, "lineIds": ["l1"]}]}
    bad = spoken_number_check(story, {0: code}, plan)
    assert bad["id"] == "N1" and bad["pass"] is False
    good_code = code.replace("2_200_000", "6_000_000")
    good = spoken_number_check(story, {0: good_code}, plan)
    assert good["pass"] is True


def test_contact_sheet_and_hit_strips(tmp_path):
    from PIL import Image
    stills = []
    for i in range(4):
        p = tmp_path / f"t00{i}.jpg"
        Image.new("RGB", (320, 180), (20 * i, 40, 80)).save(p, quality=80)
        stills.append(str(p))
    sheet = str(tmp_path / "contact_sheet.jpg")
    contact_sheet(stills, sheet, cols=2, cell=(160, 90))
    assert os.path.getsize(sheet) > 0
    im = Image.open(sheet)
    assert im.size == (320, 180)

    # 2-second colour video for strips + export_qa_artifacts
    vid = str(tmp_path / "master.mp4")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                    "-i", "color=c=0x224466:s=320x180:d=2:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", vid],
                   check=True)
    strip = motion_strip(vid, 1.0, str(tmp_path / "strip.jpg"), pre=0.4, post=0.8, frames=6, cell_w=80)
    assert strip and os.path.getsize(strip) > 0
    lay = {"scenes": [{"index": 0, "startS": 0.0, "endS": 2.0, "kind": "graphics"}],
           "words": [{"w": "Chicago", "s": 0.8, "e": 1.1, "line": "l1"}], "fps": 30, "durationS": 2.0, "frames": 60}
    story = {"lines": [{"id": "l1", "text": "In Chicago it started.", "spoken": "in Chicago it started", "hero": "CHICAGO"}]}
    plan = {"scenes": [{"index": 0, "lineIds": ["l1"], "emphasis": [{"lineId": "l1", "word": "Chicago"}]}]}
    assert hit_word_times(lay, story, plan)
    art = export_qa_artifacts(vid, str(tmp_path / "qa"), lay, story, plan, {})
    assert any(c["id"] == "SHEET" and c["pass"] for c in art["checks"])
    assert any(c["id"] == "N1" and c["pass"] for c in art["checks"])
    assert any(name == "contact_sheet.jpg" for _, name, _ in art["files"])
    assert any(name.startswith("strip_") for _, name, _ in art["files"])
