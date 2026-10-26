"""R2 storage driver wiring (no network)."""
import sys
from unittest.mock import MagicMock

sys.modules.setdefault("boto3", MagicMock())
sys.modules.setdefault("botocore", MagicMock())
sys.modules.setdefault("botocore.exceptions", MagicMock())

import clips_worker.storage as storage_mod  # noqa: E402


def test_storage_driver_r2_uses_s3_api(monkeypatch):
    monkeypatch.setenv("STORAGE_DRIVER", "r2")
    assert storage_mod._uses_s3_api() is True


def test_r2_bucket_env(monkeypatch):
    monkeypatch.setenv("STORAGE_DRIVER", "r2")
    monkeypatch.setenv("R2_BUCKET", "transovo-clips")
    assert storage_mod.storage_bucket() == "transovo-clips"


def test_r2_client_endpoint(monkeypatch):
    import boto3

    monkeypatch.setenv("STORAGE_DRIVER", "r2")
    monkeypatch.setenv("R2_ACCOUNT_ID", "abc123")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("R2_BUCKET", "transovo-clips")
    boto3.client.reset_mock()
    storage_mod._s3_client()
    boto3.client.assert_called()
    kwargs = boto3.client.call_args.kwargs
    assert kwargs["endpoint_url"] == "https://abc123.r2.cloudflarestorage.com"
    assert kwargs["region_name"] == "auto"
