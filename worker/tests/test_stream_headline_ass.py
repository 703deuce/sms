from clips_worker.clip_export_template import stream_headline_frame_layout
from clips_worker.stream_headline_ass import prepare_headline_display


def test_stream_headline_frame_layout_9_16():
    lay = stream_headline_frame_layout(1080, 1920)
    assert lay["bar_h"] == 384
    assert lay["footer_h"] == 538
    assert lay["video_h"] == 1920 - 384 - 538
    assert lay["video_y"] == 384


def test_prepare_headline_display_upper_and_emoji():
    s = prepare_headline_display("broner blacks out on track 😤🔥")
    assert "BRONER" in s
    assert "😤" in s


def test_platform_badge_colors():
    from clips_worker.clip_export_template import _platform_label

    assert _platform_label("kick")[0] == "KICK"
    assert _platform_label("twitch")[1] == "0x9146FF"
