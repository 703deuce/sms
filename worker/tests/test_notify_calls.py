from clips_worker.streamer.notify import _sign_body


def test_notify_sign_body_stable():
    assert _sign_body("secret", "{}") == _sign_body("secret", "{}")
