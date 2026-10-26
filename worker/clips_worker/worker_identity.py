"""Per-process worker instance id (distinct from stable WORKER_ID env across deploys)."""
from __future__ import annotations

import os
import uuid

_INSTANCE_ID: str | None = None


def worker_instance_id() -> str:
    global _INSTANCE_ID
    if _INSTANCE_ID is None:
        base = os.environ.get("WORKER_ID", "worker-1")
        _INSTANCE_ID = f"{base}:{uuid.uuid4().hex[:8]}"
    return _INSTANCE_ID
