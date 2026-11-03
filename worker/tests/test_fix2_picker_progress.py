from __future__ import annotations

import time

from clips_worker.picker_progress import (
    PickerProgressTicker,
    picker_budget_s,
    picker_eta_seconds,
    picker_tick_payload,
)
from clips_worker.video_picker import shortfall_reasks_for


def test_budget():
    assert picker_budget_s(226) == 120
    assert picker_budget_s(1500) == 180
    assert picker_budget_s(3000) == 360


def test_tick_payload_start_and_overrun():
    p0 = picker_tick_payload(0.0, 226, 2)
    assert p0["stage"] == "finding_clips"
    assert p0["projectStatus"] == "FINDING_CLIPS"
    assert p0["progress"] == 52
    assert p0["etaSeconds"] == 120 + 130  # 3 clips / 2 workers -> 2 * 65
    p1 = picker_tick_payload(129.0, 226, 2)
    assert p1["progress"] == 54
    assert p1["etaSeconds"] == 15 + 130


def test_eta_never_increases_while_picking():
    etas = [picker_eta_seconds(t, 226, 2) for t in range(0, 400, 10)]
    assert all(b <= a for a, b in zip(etas, etas[1:]))
    assert min(etas) > 0


def test_progress_stays_below_picker_done():
    assert all(picker_tick_payload(t, 226, 2)["progress"] <= 54 for t in range(0, 1000, 25))


def test_ticker_posts_and_stops():
    posts: list[tuple[str, dict]] = []
    with PickerProgressTicker("job1", lambda j, p: posts.append((j, p)), 226, 2, every_s=0.01):
        time.sleep(0.08)
    n = len(posts)
    assert n >= 1
    assert posts[0][0] == "job1" and "etaSeconds" in posts[0][1]
    time.sleep(0.05)
    assert len(posts) == n


def test_ticker_survives_post_errors():
    def boom(_j, _p):
        raise RuntimeError("down")

    with PickerProgressTicker("job1", boom, 226, 2, every_s=0.01):
        time.sleep(0.03)


def test_no_shortfall_reask_for_edge_reassess():
    assert shortfall_reasks_for(True) == 0
    assert shortfall_reasks_for(False) == 1
