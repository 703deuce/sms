"""S3-compatible storage (Backblaze B2) wiring — no network."""
import sys
from unittest.mock import MagicMock

sys.modules.setdefault("boto3", MagicMock())
sys.modules.setdefault("botocore", MagicMock())
sys.modules.setdefault("botocore.exceptions", MagicMock())

import clips_worker.storage as storage_mod  # noqa: E402


def test_storage_driver_s3_uses_s3_api(monkeypatch):
    monkeypatch.setenv("STORAGE_DRIVER", "s3")
    assert storage_mod._uses_s3_api() is True


def test_s3_bucket_env(monkeypatch):
    monkeypatch.setenv("STORAGE_DRIVER", "s3")
    monkeypatch.setenv("S3_BUCKET", "transovo-clips")
    assert storage_mod.storage_bucket() == "transovo-clips"


def test_s3_client_b2_endpoint(monkeypatch):
    import boto3

    monkeypatch.setenv("STORAGE_DRIVER", "s3")
    monkeypatch.setenv("S3_ENDPOINT", "https://s3.us-east-005.backblazeb2.com")
    monkeypatch.setenv("S3_REGION", "us-east-005")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("S3_BUCKET", "transovo-clips")
    boto3.client.reset_mock()
    storage_mod._s3_client()
    kwargs = boto3.client.call_args.kwargs
    assert kwargs["endpoint_url"] == "https://s3.us-east-005.backblazeb2.com"
    assert kwargs["region_name"] == "us-east-005"
