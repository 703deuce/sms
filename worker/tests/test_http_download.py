from clips_worker.streamer.http_download import _friendly_step_error, _is_retryable


def test_is_retryable_5xx_and_timeout():
    assert _is_retryable("HTTP Error 502: Bad Gateway")
    assert _is_retryable("ERROR: 429 Too Many Requests")
    assert _is_retryable("download timed out after 30 seconds")
    assert not _is_retryable("VOD not found")


def test_friendly_step_error_502():
    msg = _friendly_step_error("HTTP Error 502: Bad Gateway", "Downloading video")
    assert "502" in msg
    assert "Downloading video" in msg
