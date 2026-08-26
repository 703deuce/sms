"""Runtime build identity for transovo-voice (Git SHA / deploy proof)."""

from __future__ import annotations

import os
import subprocess
from functools import lru_cache


@lru_cache(maxsize=1)
def get_voice_build_identity() -> dict[str, str]:
    sha = (
        os.getenv("VOICE_BUILD_SHA", "").strip()
        or os.getenv("GIT_SHA", "").strip()
        or os.getenv("COMMIT_SHA", "").strip()
        or os.getenv("RAILWAY_GIT_COMMIT_SHA", "").strip()
        or os.getenv("COOLIFY_BRANCH", "").strip()  # fallback label only
    )
    if not sha:
        try:
            proc = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2,
                check=False,
            )
            if proc.returncode == 0:
                sha = proc.stdout.strip()
        except Exception:
            sha = ""

    return {
        "buildSha": sha or "unknown",
        "buildShaFull": os.getenv("VOICE_BUILD_SHA_FULL", "").strip() or sha or "unknown",
        "imageTag": os.getenv("VOICE_IMAGE_TAG", "").strip() or "unknown",
        "hostname": os.getenv("HOSTNAME", "").strip() or "unknown",
    }
