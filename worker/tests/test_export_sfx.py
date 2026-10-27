import os
from pathlib import Path

from clips_worker.export_sfx import build_export_sfx_events, bundled_sfx_available, sfx_assets_dir


def test_bundled_sfx_paths_exist():
    root = Path(__file__).resolve().parents[1]
    os.environ["CLIPS_WORKER_ROOT"] = str(root)
    assert bundled_sfx_available()
    assert (sfx_assets_dir() / "whoosh.wav").is_file()


def test_subtle_whoosh_on_zoom_peaks_only():
    root = Path(__file__).resolve().parents[1]
    os.environ["CLIPS_WORKER_ROOT"] = str(root)
    kf = [(0.0, 1.0), (1.0, 1.0), (1.25, 1.12), (2.0, 1.12), (2.5, 1.0), (5.0, 1.0)]
    events = build_export_sfx_events(
        "subtle",
        duration_s=5.0,
        zoom_keyframes=kf,
        caption_words=[{"s": 2.0, "i": 0, "w": "wow"}],
        emphasis=[0],
    )
    assert events
    assert all("whoosh" in p.name for p, _, _ in events)
    assert not any("pop" in p.name for p, _, _ in events)
