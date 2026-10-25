"""Download clip source objects from Supabase Storage or S3."""
from __future__ import annotations

import os
import urllib.parse
import urllib.request
from pathlib import Path

import boto3


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if not v:
        raise RuntimeError(f"Missing env {name}")
    return v


def storage_driver() -> str:
    return (os.environ.get("STORAGE_DRIVER") or "supabase").strip().lower()


def storage_bucket() -> str:
    return (
        os.environ.get("STORAGE_BUCKET")
        or os.environ.get("CLIPS_STORAGE_BUCKET")
        or os.environ.get("S3_BUCKET")
        or "clips"
    ).strip()


def download_object(object_key: str, dest: Path) -> None:
    if storage_driver() == "s3":
        _download_s3(object_key, dest)
    else:
        _download_supabase(object_key, dest)


def _download_supabase(object_key: str, dest: Path) -> None:
    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = urllib.parse.quote(object_key, safe="/")
    url = f"{base}/storage/v1/object/{bucket}/{encoded}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        dest.write_bytes(resp.read())


def _download_s3(object_key: str, dest: Path) -> None:
    client = boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=env("S3_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("S3_REGION", "us-east-1"),
    )
    client.download_file(storage_bucket(), object_key, str(dest))
