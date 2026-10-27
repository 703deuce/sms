import json
from clips_worker.callback_health import callback_base_url, probe_callback_health


def test_callback_base_url_prefers_worker_callback(monkeypatch):
    monkeypatch.setenv("WORKER_CALLBACK_URL", "https://transovo.ai")
    monkeypatch.setenv("APP_URL", "https://example.com")
    assert callback_base_url() == "https://transovo.ai"


def test_probe_callback_health_ok(monkeypatch):
    body = json.dumps({"ok": True, "commitSha": "abc123"}).encode()

    class Resp:
        status = 200

        def read(self):
            return body

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: Resp())
    ok, msg = probe_callback_health("https://transovo.ai")
    assert ok is True
    assert "abc123" in msg
