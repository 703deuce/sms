"""Per-job clipfind context (thread-local, mirrors decision_log binding)."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

from clips_worker.clipfind.ledger import CandidateLedger


@dataclass
class JobCtx:
    workspace_id: str = ""
    job_type: str = ""
    job_id: str = ""
    vod_id: str | None = None
    project_id: str | None = None
    artifact_dir: str | None = None
    signals_key: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)


_lock = threading.Lock()
_ctx: JobCtx | None = None
_ledger: CandidateLedger | None = None


def bind_clipfind(
    *,
    workspace_id: str,
    job_type: str,
    job_id: str = "",
    vod_id: str | None = None,
    project_id: str | None = None,
    artifact_dir: str | None = None,
    signals_key: str | None = None,
    **extra: Any,
) -> None:
    global _ctx, _ledger
    with _lock:
        _ctx = JobCtx(
            workspace_id=(workspace_id or "").strip(),
            job_type=(job_type or "").strip(),
            job_id=(job_id or "").strip(),
            vod_id=vod_id,
            project_id=project_id,
            artifact_dir=artifact_dir,
            signals_key=signals_key,
            extra=dict(extra),
        )
        _ledger = CandidateLedger()


def unbind_clipfind() -> None:
    global _ctx, _ledger
    with _lock:
        _ctx = None
        _ledger = None


def get_job_ctx() -> JobCtx | None:
    with _lock:
        return _ctx


def get_ledger() -> CandidateLedger | None:
    with _lock:
        return _ledger
