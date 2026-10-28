"""Verify worker progress callback base URL is reachable (stable public URL or fixed alias)."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request


def callback_base_url() -> str:
    for key in ("WORKER_CALLBACK_URL", "TRANSOVO_BACKEND_URL", "APP_URL"):
        v = (os.environ.get(key) or "").strip().rstrip("/")
        if v:
            return v
    return ""


def probe_callback_health(base_url: str, timeout_sec: float = 15.0) -> tuple[bool, str]:
    url = f"{base_url}/api/health"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            body = resp.read().decode("utf-8", errors="replace")[:500]
        if resp.status != 200:
            return False, f"HTTP {resp.status} from {url}: {body[:120]}"
        try:
            data = json.loads(body)
            if not data.get("ok"):
                return False, f"health ok=false from {url}"
        except json.JSONDecodeError:
            return False, f"non-JSON health from {url}"
        from clips_worker.build_info import clips_worker_git_sha_short

        web_sha = json.loads(body).get("commitSha", "?")
        worker_sha = clips_worker_git_sha_short(12)
        return True, (
            f"ok {url} web_commitSha={str(web_sha)[:12]} worker_git_sha={worker_sha}"
        )
    except Exception as exc:
        return False, f"{url} failed: {exc!r}"


def wait_for_callback_health(
    *,
    max_attempts: int = 30,
    initial_delay_sec: float = 2.0,
    max_delay_sec: float = 30.0,
) -> None:
    base = callback_base_url()
    if not base:
        print("FATAL clips-worker: no WORKER_CALLBACK_URL / APP_URL for progress callbacks", flush=True)
        raise SystemExit(1)

    delay = initial_delay_sec
    last_msg = ""
    for attempt in range(1, max_attempts + 1):
        ok, msg = probe_callback_health(base)
        last_msg = msg
        if ok:
            print(f"clips-worker callback health OK ({msg})", flush=True)
            return
        print(
            f"FATAL clips-worker callback health FAILED attempt={attempt}/{max_attempts} base={base} — {msg}",
            flush=True,
        )
        if attempt < max_attempts:
            time.sleep(delay)
            delay = min(delay * 1.5, max_delay_sec)

    print(f"FATAL clips-worker giving up on callback health after {max_attempts} attempts: {last_msg}", flush=True)
    raise SystemExit(1)
