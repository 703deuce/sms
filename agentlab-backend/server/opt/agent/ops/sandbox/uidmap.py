"""Allocate and look up per-job UIDs. Map file is one 'jobid uid' line, 0600."""
from __future__ import annotations
import os, tempfile
from pathlib import Path

MAP_PATH = Path(os.environ.get("AGENT_UID_MAP", "/opt/agent/ops/sandbox/uid.map"))
POOL_START = 20001
POOL_END = 20100


def _load(path: Path) -> dict[str, int]:
    out = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1].isdigit():
            out[parts[0]] = int(parts[1])
    return out


def _save(path: Path, mapping: dict[str, int]):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".map.tmp")
    lines = [f"{job} {uid}\n" for job, uid in sorted(mapping.items(), key=lambda kv: kv[1])]
    tmp.write_text("".join(lines))
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def lookup(job_id: str) -> int | None:
    job_id = _clean(job_id)
    return _load(MAP_PATH).get(job_id)


def allocate(job_id: str) -> int:
    job_id = _clean(job_id)
    mapping = _load(MAP_PATH)
    if job_id in mapping:
        return mapping[job_id]
    used = set(mapping.values())
    for uid in range(POOL_START, POOL_END + 1):
        if uid not in used:
            mapping[job_id] = uid
            _save(MAP_PATH, mapping)
            return uid
    raise RuntimeError("job UID pool exhausted (20001-20100)")


def _clean(job_id: str) -> str:
    job_id = (job_id or "").strip().strip("/")
    if not job_id or ".." in job_id or "/" in job_id or "\x00" in job_id:
        raise ValueError("invalid job id")
    if len(job_id) > 128:
        raise ValueError("job id too long")
    return job_id
