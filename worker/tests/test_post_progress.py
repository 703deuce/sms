"""Progress callback URL order and retry policy (no network)."""
import sys
from unittest.mock import MagicMock, patch

sys.modules.setdefault("psycopg2", MagicMock())
sys.modules.setdefault("psycopg2.extras", MagicMock())

import clips_worker.main as main_mod  # noqa: E402


def test_progress_base_urls_prefers_callback(monkeypatch):
    monkeypatch.setenv("WORKER_CALLBACK_URL", "http://web-internal:3000")
    monkeypatch.setenv("APP_URL", "https://transovo.ai")
    assert main_mod.progress_base_urls() == ["http://web-internal:3000", "https://transovo.ai"]


def test_post_progress_resilient_never_raises(monkeypatch):
    monkeypatch.setenv("APP_URL", "https://transovo.ai")
    monkeypatch.setenv("WORKER_SHARED_SECRET", "secret")
    with patch.object(main_mod, "_post_progress_once", side_effect=OSError("connection refused")):
        main_mod.post_progress_resilient("cjob_x", {"jobStatus": "RUNNING", "progress": 5})
