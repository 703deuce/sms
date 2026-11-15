"""ST-RW-002 fixtures: the ElevenLabs format fallback is never a paid retry."""
import base64
import os

import pytest

os.environ["MOTION_STUDIO_TTS_CACHE"] = "/tmp/ms_tts_test_cache.json"
from clips_worker.motion_studio.pipeline import tts  # noqa: E402

OK = {"audio_base64": base64.b64encode(b"ID3fake").decode(), "alignment": {"characters": ["a"], "character_start_times_seconds": [0],
                                                                          "character_end_times_seconds": [0.1]}}


class R:
    def __init__(self, status, body=None, text=""):
        self.status_code, self._b, self.text = status, body, text
        self.ok = 200 <= status < 300

    def json(self):
        return self._b


class S:
    def __init__(self, posts, tier="creator"):
        self.posts, self.calls, self.tier = list(posts), [], tier

    def get(self, url, **k):
        return R(200, {"tier": self.tier})

    def post(self, url, params=None, **k):
        self.calls.append(params["output_format"])
        r = self.posts.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture(autouse=True)
def _fresh():
    tts._CACHE.clear()
    if os.path.exists(tts._CACHE_FILE):
        os.remove(tts._CACHE_FILE)


V = {"voiceId": "v"}


def test_403_format_rejection_gives_one_logged_rerequest_at_lower_format():
    logs = []
    s = S([R(403, text='{"detail":"output_format mp3_44100_192 requires a higher tier"}'), R(200, OK)])
    audio, _al, fmt = tts.tts_with_format_fallback("k", "hi", V, model_id="m", preferred="mp3_44100_192", session=s,
                                                   log=lambda *a: logs.append(a))
    assert s.calls == ["mp3_44100_192", "mp3_44100_128"] and fmt == "mp3_44100_128"
    assert len(logs) == 1 and logs[0][0] == "tts_format_fallback"


def test_200_then_later_failure_has_no_rerequest():
    s = S([R(200, {"audio_base64": "", "alignment": {}})])
    with pytest.raises(RuntimeError):
        tts.tts_with_format_fallback("k", "hi", V, model_id="m", preferred="mp3_44100_128", session=s)
    assert s.calls == ["mp3_44100_128"]


@pytest.mark.parametrize("failure", [R(500, text="internal"), TimeoutError("timeout")])
def test_5xx_or_timeout_has_no_automatic_rerequest(failure):
    s = S([failure])
    with pytest.raises(Exception):
        tts.tts_with_format_fallback("k", "hi", V, model_id="m", preferred="mp3_44100_128", session=s)
    assert len(s.calls) == 1


def test_probe_caps_to_plan_and_is_cached_per_account():
    s = S([R(200, OK), R(200, OK)], tier="free")
    _a, _b, fmt = tts.tts_with_format_fallback("k1", "hi", V, model_id="m", preferred="mp3_44100_192", session=s)
    assert fmt == "mp3_44100_128" and s.calls == ["mp3_44100_128"]
    s.get = lambda *a, **k: (_ for _ in ()).throw(AssertionError("probe should be cached"))
    tts.tts_with_format_fallback("k1", "hi", V, model_id="m", preferred="mp3_44100_192", session=s)
    assert "k1" not in open(tts._CACHE_FILE).read()   # account id is hashed, never the key


def test_second_rejection_is_not_retried_again():
    s = S([R(403, text="output_format not allowed"), R(403, text="output_format not allowed")])
    with pytest.raises(tts.FormatRejected):
        tts.tts_with_format_fallback("k", "hi", V, model_id="m", preferred="mp3_44100_128", session=s)
    assert len(s.calls) == 2
