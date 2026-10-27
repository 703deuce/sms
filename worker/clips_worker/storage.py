"""Object storage for clips worker (Supabase or S3-compatible e.g. Backblaze B2)."""
from __future__ import annotations

import json
import logging
import mimetypes
import os
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.exceptions import ClientError

from clips_worker.source_cache import get_source_cache

log = logging.getLogger(__name__)

# Browser/CDN-friendly; objects are immutable at a given key+version.
_OBJECT_CACHE_CONTROL = "private, max-age=31536000, immutable"


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if not v:
        raise RuntimeError(f"Missing env {name}")
    return v


def storage_driver() -> str:
    return (os.environ.get("STORAGE_DRIVER") or "s3").strip().lower()


def _uses_s3_api() -> bool:
    return storage_driver() == "s3"


def storage_bucket() -> str:
    return (
        os.environ.get("S3_BUCKET")
        or os.environ.get("STORAGE_BUCKET")
        or os.environ.get("CLIPS_STORAGE_BUCKET")
        or "clips"
    ).strip()


STAGING_KEY_PREFIX = "@staging/"


def _staging_root() -> Path:
    return Path(os.environ.get("CLIPS_UPLOAD_STAGING_DIR") or "/opt/clips-upload-staging")


def _download_staging(upload_id: str, dest: Path) -> None:
    root = _staging_root()
    matches = list(root.glob(f"{upload_id}.*"))
    if not matches:
        raise RuntimeError(f"Staged upload file missing for {upload_id}")
    src = matches[0]
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


_S3_CLIENT = None

_MULTIPART_THRESHOLD = int(os.environ.get("S3_MULTIPART_THRESHOLD_BYTES", str(64 * 1024 * 1024)))
_MULTIPART_CHUNKSIZE = int(os.environ.get("S3_MULTIPART_CHUNKSIZE_BYTES", str(64 * 1024 * 1024)))
_UPLOAD_CONCURRENCY = int(os.environ.get("S3_UPLOAD_CONCURRENCY", "4"))


def _s3_region() -> str:
    explicit = (os.environ.get("S3_REGION") or "").strip()
    if explicit:
        return explicit
    endpoint = (os.environ.get("S3_ENDPOINT") or "").strip()
    # Backblaze: https://s3.us-east-005.backblazeb2.com → us-east-005
    if "backblazeb2.com" in endpoint:
        host = endpoint.split("://", 1)[-1].split("/", 1)[0]
        parts = host.split(".")
        if len(parts) >= 2 and parts[0] == "s3":
            return parts[1]
    return "us-east-1"


def _s3_client():
    global _S3_CLIENT
    if _S3_CLIENT is not None:
        return _S3_CLIENT
    botocore_cfg = Config(
        retries={"max_attempts": 10, "mode": "adaptive"},
        connect_timeout=60,
        read_timeout=600,
    )
    _S3_CLIENT = boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT"),
        aws_access_key_id=env("S3_ACCESS_KEY_ID"),
        aws_secret_access_key=env("S3_SECRET_ACCESS_KEY"),
        region_name=_s3_region(),
        config=botocore_cfg,
    )
    return _S3_CLIENT


def _s3_upload_transfer_config() -> TransferConfig:
    return TransferConfig(
        multipart_threshold=_MULTIPART_THRESHOLD,
        multipart_chunksize=max(_MULTIPART_CHUNKSIZE, 5 * 1024 * 1024),
        max_concurrency=max(1, _UPLOAD_CONCURRENCY),
        use_threads=True,
    )


def _s3_object_meta(object_key: str) -> tuple[str, int]:
    client = _s3_client()
    out = client.head_object(Bucket=storage_bucket(), Key=object_key)
    etag = str(out.get("ETag") or "").strip('"')
    size = int(out.get("ContentLength") or 0)
    return etag, size


def _s3_missing_key(exc: ClientError) -> bool:
    code = str(exc.response.get("Error", {}).get("Code", ""))
    return code in ("404", "NoSuchKey", "NotFound")


def _http_error_snippet(exc: urllib.error.HTTPError, limit: int = 200) -> str:
    try:
        raw = exc.read().decode("utf-8", errors="replace")
    except Exception:
        raw = ""
    text = raw.replace("\n", " ").strip()[:limit]
    for token_key in ("token", "signature", "secret", "authorization"):
        if token_key in text.lower():
            return "(redacted)"
    return text or "(empty)"


def download_object(object_key: str, dest: Path) -> None:
    from clips_worker.stage_log import log_storage_key, stage_span

    with stage_span("download", heartbeat=True, key=log_storage_key("object", object_key)):
        _download_object_inner(object_key, dest)


def _download_object_inner(object_key: str, dest: Path) -> None:
    if object_key.startswith(STAGING_KEY_PREFIX):
        upload_id = object_key[len(STAGING_KEY_PREFIX) :]
        _download_staging(upload_id, dest)
        return
    if _uses_s3_api():
        try:
            _download_s3_cached(object_key, dest)
            return
        except ClientError as exc:
            if _s3_missing_key(exc):
                if object_key.startswith("stock/"):
                    raise RuntimeError(f"storage_object_missing:{object_key}") from exc
                log.warning(
                    "[clips:storage] s3 head/download missing key=%s, trying supabase fallback",
                    object_key,
                )
                try:
                    _download_supabase(object_key, dest)
                    return
                except urllib.error.HTTPError as http_exc:
                    log.error(
                        "[clips:storage] supabase fallback failed key=%s status=%s body=%s",
                        object_key,
                        http_exc.code,
                        _http_error_snippet(http_exc),
                    )
                    raise RuntimeError(f"storage_object_missing:{object_key}") from http_exc
            raise
    _download_supabase(object_key, dest)


def _download_s3_cached(object_key: str, dest: Path) -> None:
    etag, size = _s3_object_meta(object_key)
    cache = get_source_cache()

    def _pull(tmp: Path) -> None:
        client = _s3_client()
        client.download_file(storage_bucket(), object_key, str(tmp))

    cache.fetch(object_key, etag, size, dest, _pull)


def upload_file(object_key: str, path: Path, content_type: str | None = None) -> None:
    from clips_worker.stage_log import log_storage_key, stage_span

    with stage_span(
        "upload",
        heartbeat=True,
        key=log_storage_key("object", object_key),
        bytes=path.stat().st_size if path.is_file() else 0,
    ):
        _upload_file_inner(object_key, path, content_type)


def _upload_file_inner(object_key: str, path: Path, content_type: str | None = None) -> None:
    if _uses_s3_api():
        _upload_s3(object_key, path, content_type)
        try:
            etag, size = _s3_object_meta(object_key)
            get_source_cache().seed(object_key, etag, size, path)
        except Exception:
            get_source_cache().seed(object_key, "local", path.stat().st_size, path)
    else:
        _upload_supabase(object_key, path, content_type)


def object_byte_size(object_key: str) -> int:
    """Best-effort object size for cleanup accounting."""
    if object_key.startswith(STAGING_KEY_PREFIX):
        return 0
    if _uses_s3_api():
        try:
            _, size = _s3_object_meta(object_key)
            return size
        except ClientError:
            return 0
    return 0


def delete_object(object_key: str) -> None:
    if _uses_s3_api():
        client = _s3_client()
        client.delete_object(Bucket=storage_bucket(), Key=object_key)
        return
    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in object_key.split("/"))
    url = f"{base}/storage/v1/object/{bucket}/{encoded}"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={"Authorization": f"Bearer {token}", "apikey": token},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        resp.read()


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
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            dest.write_bytes(resp.read())
    except urllib.error.HTTPError as exc:
        log.error(
            "[clips:storage] supabase download failed key=%s status=%s body=%s",
            object_key,
            exc.code,
            _http_error_snippet(exc),
        )
        raise


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


def _upload_s3(object_key: str, path: Path, content_type: str | None) -> None:
    client = _s3_client()
    mime = content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    extra = {"ContentType": mime, "CacheControl": _OBJECT_CACHE_CONTROL}
    client.upload_file(
        str(path),
        storage_bucket(),
        object_key,
        ExtraArgs=extra,
        Config=_s3_upload_transfer_config(),
    )


def sign_url(object_key: str, expires_s: int = 3600) -> str:
    if _uses_s3_api():
        client = _s3_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": storage_bucket(), "Key": object_key},
            ExpiresIn=expires_s,
        )
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


def _http_error_summary(exc: urllib.error.HTTPError) -> str:
    body_len = 0
    try:
        body_len = len(exc.read())
    except Exception:
        pass
    return f"HTTP {exc.code} {exc.reason or 'error'} body_bytes={body_len}"


def sign_upload_url(object_key: str) -> dict:
    """Signed PUT target for remote encoders (Modal). S3 uses presigned put_object."""
    if _uses_s3_api():
        client = _s3_client()
        mime = mimetypes.guess_type(object_key.split("/")[-1])[0] or "video/mp4"
        put_url = client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": storage_bucket(),
                "Key": object_key,
                "ContentType": mime,
            },
            ExpiresIn=7200,
        )
        if not put_url:
            raise RuntimeError("s3 presigned put_object returned empty url")
        return {"url": put_url, "token": ""}

    base = env("SUPABASE_URL").rstrip("/")
    token = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = storage_bucket()
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in object_key.split("/"))
    url = f"{base}/storage/v1/object/upload/sign/{bucket}/{encoded}"
    body = json.dumps({"upsert": False}).encode()
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
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        log.warning("storage.sign_upload_url failed driver=supabase %s", _http_error_summary(exc))
        raise RuntimeError(f"sign_upload_url failed: {_http_error_summary(exc)}") from exc

    signed = data.get("signedUrl") or data.get("signedURL") or data.get("url")
    if not signed:
        raise RuntimeError("sign_upload_url response missing signedUrl")
    if not str(signed).startswith("http"):
        signed = f"{base}/storage/v1{signed}"
    return {"url": signed, "token": data.get("token") or ""}


def put_json(object_key: str, data: unknown) -> None:
    import tempfile

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        tmp = Path(f.name)
    try:
        upload_file(object_key, tmp, "application/json")
    finally:
        tmp.unlink(missing_ok=True)
