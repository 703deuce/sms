import json

from clips_worker.streamer.kick_playback import _pick_hls_from_channel, playback_host_for_log


def test_pick_hls_from_livestream_source():
    data = {
        "livestream": {
            "is_live": True,
            "source": "https://stream.kick.com/x/ivs/v1/abc/media/hls/master.m3u8",
        }
    }
    assert _pick_hls_from_channel(data) == data["livestream"]["source"]


def test_playback_host_for_log():
    assert playback_host_for_log("https://stream.kick.com/foo.m3u8") == "stream.kick.com"
    assert playback_host_for_log(None) == "-"
