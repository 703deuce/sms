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
    storage_mod._S3_CLIENT = None
    boto3.client.reset_mock()
    storage_mod._s3_client()
    kwargs = boto3.client.call_args.kwargs
    assert kwargs["endpoint_url"] == "https://s3.us-east-005.backblazeb2.com"
    assert kwargs["region_name"] == "us-east-005"
    assert kwargs["config"].retries["max_attempts"] == 10


def test_s3_region_from_b2_endpoint(monkeypatch):
    monkeypatch.delenv("S3_REGION", raising=False)
    monkeypatch.setenv("S3_ENDPOINT", "https://s3.us-west-004.backblazeb2.com")
    assert storage_mod._s3_region() == "us-west-004"


def test_s3_upload_uses_multipart_transfer_config(monkeypatch, tmp_path):
    import boto3
    from unittest.mock import MagicMock

    monkeypatch.setenv("STORAGE_DRIVER", "s3")
    monkeypatch.setenv("S3_ENDPOINT", "https://s3.us-east-005.backblazeb2.com")
    monkeypatch.setenv("S3_REGION", "us-east-005")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("S3_BUCKET", "transovo-clips")
    storage_mod._S3_CLIENT = None
    mock_client = MagicMock()
    boto3.client.reset_mock()
    boto3.client.return_value = mock_client
    f = tmp_path / "big.bin"
    f.write_bytes(b"x" * 1024)
    storage_mod._upload_s3("k/big.bin", f, "application/octet-stream")
    _, kwargs = mock_client.upload_file.call_args
    cfg = kwargs["Config"]
    assert cfg.multipart_threshold == 64 * 1024 * 1024
    assert cfg.multipart_chunksize == 64 * 1024 * 1024
