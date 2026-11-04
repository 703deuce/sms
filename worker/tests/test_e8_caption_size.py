"""E8: user-selected CP caption sizes must survive export's stale-legacy-style cleanup."""
from clips_worker.captions_ass import build_ass


def test_cp_size_slider_affects_burned_ass(tmp_path):
    words = [
        {"w": "IN", "s": 0.0, "e": 0.3, "i": 0},
        {"w": "THE", "s": 0.3, "e": 0.6, "i": 1},
        {"w": "MIDDLE", "s": 0.6, "e": 1.0, "i": 2},
    ]
    results = []
    for pct in (3, 10):
        path = tmp_path / f"size-{pct}.ass"
        build_ass(
            words,
            {"presetId": "cp1", "size": 6.5, "userSizePct": pct, "position": "top"},
            path,
            play_w=720,
            play_h=1280,
        )
        line = next(line for line in path.read_text().splitlines() if line.startswith("Style: Cap,"))
        results.append(int(line.split(",")[2]))
    assert results[1] > results[0] * 3
