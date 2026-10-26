"""Fail fast on missing worker env (avoids DATABASE_URL crash loops)."""
from __future__ import annotations

import os
import sys

REQUIRED_ALWAYS = (
    "DATABASE_URL",
    "APP_URL",
    "WORKER_SHARED_SECRET",
)

REQUIRED_SUPABASE = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
)

REQUIRED_S3 = (
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
)


def validate_worker_env() -> None:
    missing: list[str] = []
    for key in REQUIRED_ALWAYS:
        if not (os.environ.get(key) or "").strip():
            missing.append(key)
    driver = (os.environ.get("STORAGE_DRIVER") or "supabase").strip().lower()
    if driver == "s3":
        for key in REQUIRED_S3:
            if not (os.environ.get(key) or "").strip():
                missing.append(key)
    else:
        for key in REQUIRED_SUPABASE:
            if not (os.environ.get(key) or "").strip():
                missing.append(key)
    if missing:
        print(f"FATAL clips-worker missing required env: {', '.join(missing)}", flush=True)
        sys.exit(1)
