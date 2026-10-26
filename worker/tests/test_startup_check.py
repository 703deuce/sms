import os

import pytest

from clips_worker.startup_check import validate_worker_env


def test_startup_fails_without_database(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("APP_URL", "https://example.com")
    monkeypatch.setenv("WORKER_SHARED_SECRET", "x")
    monkeypatch.setenv("SUPABASE_URL", "https://x.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    with pytest.raises(SystemExit):
        validate_worker_env()
