"""Supabase Storage download/upload for clips worker."""
from __future__ import annotations

import json
import mimetypes
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


def upload_file(object_key: str, path: Path, content_type: str | None = None) -> None:
    if storage_driver() == "s3":
        _upload_s3(object_key, path, content_type)
    else:
        _upload_supabase(object_key, path, content_type)


def _download_supabase(object_key: str, dest: Path) -> None:
    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in object_key.split("/"))
    url = f"{base}/storage/v1/object/{bucket}/{encoded}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "apikey": token},
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        dest.write_bytes(resp.read())


def _upload_supabase(object_key: str, path: Path, content_type: str | None) -> None:
    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in object_key.split("/"))
    url = f"{base}/storage/v1/object/{bucket}/{encoded}"
    mime = content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    data = path.read_bytes()
    req = urllib.request.Request(
        url,
        data=data,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": token,
            "Content-Type": mime,
            "x-upsert": "true",
        },
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        resp.read()


def _download_s3(object_key: str, dest: Path) -> None:
    client = boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=env("S3_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("S3_REGION", "us-east-1"),
    )
    client.download_file(storage_bucket(), object_key, str(dest))


def _upload_s3(object_key: str, path: Path, content_type: str | None) -> None:
    client = boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=env("S3_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("S3_REGION", "us-east-1"),
    )
    extra = {"ContentType": content_type} if content_type else {}
    client.upload_file(str(path), storage_bucket(), object_key, ExtraArgs=extra)


def sign_url(object_key: str, expires_s: int = 3600) -> str:
    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in object_key.split("/"))
    url = f"{base}/storage/v1/object/sign/{bucket}/{encoded}"
    body = json.dumps({"expiresIn": expires_s}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": token,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    signed = data.get("signedURL") or data.get("signedUrl")
    if not signed:
        raise RuntimeError("sign response missing signedURL")
    if signed.startswith("http"):
        return signed
    return f"{base}/storage/v1{signed}"


def sign_upload_url(object_key: str) -> dict:
    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in object_key.split("/"))
    url = f"{base}/storage/v1/object/upload/sign/{bucket}/{encoded}"
    req = urllib.request.Request(
        url,
        data=b"{}",
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": token,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    return {"url": data.get("url"), "token": data.get("token")}


def put_json(object_key: str, data: unknown) -> None:
    import tempfile

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        tmp = Path(f.name)
    try:
        upload_file(object_key, tmp, "application/json")
    finally:
        tmp.unlink(missing_ok=True)
