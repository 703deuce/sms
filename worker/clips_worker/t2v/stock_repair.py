"""Re-hydrate stock_assets rows whose storage object is missing (Pixabay/Pexels)."""
from __future__ import annotations

import json
import logging
import os
import secrets
import urllib.parse
import urllib.request
from pathlib import Path

from clips_worker.storage import upload_file

log = logging.getLogger(__name__)


def _pixabay_video_src(provider_id: str) -> str | None:
    key = (os.environ.get("PIXABAY_API_KEY") or "").strip()
    if not key:
        return None
    u = urllib.parse.urlencode({"key": key, "id": provider_id})
    url = f"https://pixabay.com/api/videos/?{u}"
    req = urllib.request.Request(url, headers={"User-Agent": "transovo-t2v-worker/1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
    hits = body.get("hits") or []
    if not hits:
        return None
    hit = hits[0]
    videos = hit.get("videos") or {}
    for tier in ("large", "medium", "small", "tiny"):
        v = videos.get(tier) or {}
        if v.get("url"):
            return str(v["url"])
    return None


def _row_for_asset(conn, asset_id: str | None, storage_key: str) -> tuple[str, str, str] | None:
    with conn.cursor() as cur:
        if asset_id:
            cur.execute(
                'SELECT id, provider, "providerId" FROM stock_assets WHERE id=%s',
                (asset_id,),
            )
        else:
            cur.execute(
                'SELECT id, provider, "providerId" FROM stock_assets WHERE "storageKey"=%s',
                (storage_key,),
            )
        row = cur.fetchone()
    if not row:
        return None
    return str(row[0]), str(row[1]), str(row[2])


def repair_stock_asset(
    conn,
    storage_key: str,
    asset_id: str | None = None,
) -> bool:
    """Download from provider and re-upload. Returns True if object should exist now."""
    row = _row_for_asset(conn, asset_id, storage_key)
    if not row:
        log.warning(
            "[t2v:stock] repair skipped, no db row storageKey=%s assetId=%s",
            storage_key,
            asset_id,
        )
        return False
    asset_id, provider, provider_id = row
    src_url: str | None = None
    if provider == "pixabay":
        src_url = _pixabay_video_src(provider_id)
    if not src_url:
        log.warning(
            "[t2v:stock] repair no provider src provider=%s providerId=%s assetId=%s",
            provider,
            provider_id,
            asset_id,
        )
        return False
    log.info(
        "[t2v:stock] repair re-upload provider=%s providerId=%s storageKey=%s assetId=%s",
        provider,
        provider_id,
        storage_key,
        asset_id,
    )
    req = urllib.request.Request(src_url, headers={"User-Agent": "transovo-t2v-worker/1"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if len(data) < 64:
        return False
    tmp = Path(f"/tmp/stock-repair-{secrets.token_hex(6)}.mp4")
    tmp.write_bytes(data)
    try:
        upload_file(storage_key, tmp, "video/mp4")
    finally:
        tmp.unlink(missing_ok=True)
    return True
