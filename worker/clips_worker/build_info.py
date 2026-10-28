"""Build / deploy identity for worker logs and health probes."""
from __future__ import annotations

import os

_SHA_FILE = "/app/CLIPS_WORKER_GIT_SHA"


def clips_worker_git_sha() -> str:
    try:
        if os.path.isfile(_SHA_FILE):
            return (open(_SHA_FILE, encoding="utf-8").read() or "").strip()
    except OSError:
        pass
    return (os.environ.get("CLIPS_WORKER_GIT_SHA") or "unknown").strip()


def clips_worker_git_sha_short(n: int = 12) -> str:
    sha = clips_worker_git_sha()
    if sha == "unknown":
        return sha
    return sha[: max(7, min(n, len(sha)))]
