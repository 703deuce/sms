from __future__ import annotations

import tempfile
from pathlib import Path

import requests


def fetch(url: str) -> Path:
    dest = Path(tempfile.mkstemp(suffix=".audio")[1])
    with requests.get(url, stream=True, timeout=600) as resp:
        resp.raise_for_status()
        with dest.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8 * 1024 * 1024):
                if chunk:
                    f.write(chunk)
    return dest


def put(signed_upload: dict, path: Path) -> None:
    url = signed_upload.get("url")
    token = signed_upload.get("token")
    if not url:
        raise ValueError("missing upload url")
    headers = {"x-upsert": "true"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with path.open("rb") as f:
        r = requests.put(url, data=f, headers=headers, timeout=600)
    r.raise_for_status()
