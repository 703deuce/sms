from clips_worker.streamer.twitch_duration import parse_twitch_duration


def test_parse_helix_duration_string():
    assert parse_twitch_duration("3h2m1s") == 3 * 3600 + 2 * 60 + 1


def test_parse_numeric_seconds():
    assert parse_twitch_duration(90) == 90.0
    assert parse_twitch_duration("120") == 120.0
