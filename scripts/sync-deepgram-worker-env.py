#!/usr/bin/env python3
"""Copy DEEPGRAM_* from Coolify app .env into worker.env (length-verified). Never prints secrets."""
from __future__ import annotations

import datetime
import re
import shutil
import sys
from pathlib import Path

COOLIFY_ENV = Path("/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env")
WORKER_ENV = Path("/opt/clips-worker/worker.env")


def _read_text(path: Path) -> str:
    try:
        return path.read_text(errors="replace")
    except OSError:
        import subprocess

        return subprocess.check_output(["sudo", "cat", str(path)], text=True)


def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in _read_text(path).splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip().strip('"').strip("'")
        out[k] = v
    return out


def main() -> int:
    try:
        _read_text(COOLIFY_ENV)
    except Exception:
        print("missing_coolify_env", file=sys.stderr)
        return 1
    try:
        _read_text(WORKER_ENV)
    except Exception:
        print("missing_worker_env", file=sys.stderr)
        return 1
    cool = parse_env(COOLIFY_ENV)
    dg_key = next((k for k in cool if k.upper() == "DEEPGRAM_API_KEY"), None)
    if not dg_key:
        dg_key = next((k for k in cool if "DEEPGRAM" in k.upper()), None)
    if not dg_key:
        print("coolify_deepgram_key=NONE")
        return 0
    val = cool[dg_key]
    worker = parse_env(WORKER_ENV)
    if dg_key in worker and len(worker[dg_key]) == len(val):
        print(f"worker_deepgram_key={dg_key} already_present len={len(val)}")
        return 0
    bak = WORKER_ENV.with_name(
        WORKER_ENV.name + f".bak-{datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}"
    )
    import subprocess

    subprocess.check_call(["sudo", "cp", "-a", str(WORKER_ENV), str(bak)])
    lines = [
        ln
        for ln in _read_text(WORKER_ENV).splitlines()
        if not ln.startswith("DEEPGRAM") and not re.match(r"^DEEPGRAM_API_KEY\s*=\s*$", ln.strip())
    ]
    lines.append(f"{dg_key}={val}")
    new_body = "\n".join(lines) + "\n"
    subprocess.run(
        ["sudo", "tee", str(WORKER_ENV)],
        input=new_body.encode(),
        check=True,
        stdout=subprocess.DEVNULL,
    )
    verify = parse_env(WORKER_ENV).get(dg_key, "")
    if len(verify) != len(val):
        print("worker_update_failed_len_mismatch", file=sys.stderr)
        return 1
    print(f"worker_deepgram_key={dg_key} synced len={len(val)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
