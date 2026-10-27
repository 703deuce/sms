"""Docker-visible stage timing for PROCESS_PROJECT and STREAM_* clipper pipelines."""
from __future__ import annotations

import re
import subprocess
import threading
import time
from contextlib import contextmanager
from concurrent.futures import Future
from typing import Any, Callable, Iterator, TypeVar

HEARTBEAT_INTERVAL_S = 30.0
_PREFIX = "[clipper:stage]"

_REDACT_PATTERNS = (
    re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.I),
    re.compile(r"https?://[^\s]+", re.I),
    re.compile(r"(?i)(token|secret|password|authorization|api[_-]?key)\s*[=:]\s*\S+"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
)


def sanitize_log_text(text: str) -> str:
    out = text
    for pat in _REDACT_PATTERNS:
        out = pat.sub("(redacted)", out)
    return out


def _safe_extra(extra: dict[str, Any]) -> str:
    if not extra:
        return ""
    parts: list[str] = []
    for k, v in extra.items():
        if v is None:
            continue
        s = sanitize_log_text(str(v))
        if len(s) > 200:
            s = s[:200] + "…"
        parts.append(f"{k}={s}")
    return (" " + " ".join(parts)) if parts else ""


class _StageCtx:
    project_id: str | None = None
    job_id: str | None = None


_CTX = _StageCtx()


def bind_stage_context(project_id: str | None = None, job_id: str | None = None) -> None:
    if project_id is not None:
        _CTX.project_id = project_id
    if job_id is not None:
        _CTX.job_id = job_id


def _resolve_ids(project: str | None, job: str | None) -> tuple[str | None, str | None]:
    return project or _CTX.project_id, job or _CTX.job_id


def stage_begin(
    stage: str,
    *,
    project: str | None = None,
    job: str | None = None,
    **extra: Any,
) -> float:
    pid, jid = _resolve_ids(project, job)
    print(
        f"{_PREFIX} event=begin stage={stage} project={pid or '-'} job={jid or '-'}"
        f"{_safe_extra(extra)}",
        flush=True,
    )
    return time.monotonic()


def stage_end(
    stage: str,
    t0: float,
    *,
    project: str | None = None,
    job: str | None = None,
    **extra: Any,
) -> None:
    pid, jid = _resolve_ids(project, job)
    elapsed_ms = int((time.monotonic() - t0) * 1000)
    print(
        f"{_PREFIX} event=end stage={stage} project={pid or '-'} job={jid or '-'}"
        f" elapsed_ms={elapsed_ms}{_safe_extra(extra)}",
        flush=True,
    )


@contextmanager
def stage_span(
    stage: str,
    *,
    project: str | None = None,
    job: str | None = None,
    heartbeat: bool = False,
    **begin_extra: Any,
) -> Iterator[None]:
    t0 = stage_begin(stage, project=project, job=job, **begin_extra)
    stop = threading.Event()
    hb_thread: threading.Thread | None = None
    if heartbeat:
        pid, jid = _resolve_ids(project, job)

        def _tick() -> None:
            while not stop.wait(HEARTBEAT_INTERVAL_S):
                print(
                    f"{_PREFIX} event=heartbeat stage={stage} project={pid or '-'} job={jid or '-'}",
                    flush=True,
                )

        hb_thread = threading.Thread(target=_tick, daemon=True)
        hb_thread.start()
    try:
        yield
    finally:
        stop.set()
        if hb_thread:
            hb_thread.join(timeout=1.0)
        stage_end(stage, t0, project=project, job=job)


def wait_heartbeat(
    stage: str,
    wait_fn: Callable[[], Any],
    *,
    project: str | None = None,
    job: str | None = None,
) -> Any:
    """Run blocking wait_fn with begin/end and 30s heartbeats (stall visibility in docker logs)."""
    with stage_span(stage, project=project, job=job, heartbeat=True):
        return wait_fn()


T = TypeVar("T")


def future_result(
    future: Future[T],
    stage: str,
    *,
    timeout: float | None = None,
    project: str | None = None,
    job: str | None = None,
) -> T:
    def _wait() -> T:
        if timeout is not None:
            return future.result(timeout=timeout)
        return future.result()

    return wait_heartbeat(stage, _wait, project=project, job=job)


def thread_join(
    thread: threading.Thread,
    stage: str,
    *,
    timeout: float | None = None,
    project: str | None = None,
    job: str | None = None,
) -> None:
    def _wait() -> None:
        thread.join(timeout=timeout)

    wait_heartbeat(stage, _wait, project=project, job=job)


def log_storage_key(kind: str, object_key: str) -> str:
    """Log-safe storage reference (no signed URLs — keys only, truncated)."""
    key = object_key.split("?")[0]
    if len(key) > 120:
        return f"{kind}:…{key[-80:]}"
    return f"{kind}:{key}"


def ffmpeg_run(
    cmd: list[str],
    *,
    stage: str,
    project: str | None = None,
    job: str | None = None,
    clip_index: int | None = None,
) -> int:
    """Run ffmpeg with stage begin/end and exit code (no secrets in cmd — paths only)."""
    extra: dict[str, Any] = {}
    if clip_index is not None:
        extra["clip_index"] = clip_index
    t0 = stage_begin(stage, project=project, job=job, **extra)
    pid, jid = _resolve_ids(project, job)
    print(
        f"{_PREFIX} event=ffmpeg_start stage={stage} project={pid or '-'} job={jid or '-'}"
        f"{_safe_extra(extra)}",
        flush=True,
    )
    stop = threading.Event()

    def _tick() -> None:
        while not stop.wait(HEARTBEAT_INTERVAL_S):
            print(
                f"{_PREFIX} event=heartbeat stage={stage} project={pid or '-'} job={jid or '-'}",
                flush=True,
            )

    hb = threading.Thread(target=_tick, daemon=True)
    hb.start()
    code = 1
    try:
        proc = subprocess.run(cmd, check=False)
        code = int(proc.returncode)
        dur_ms = int((time.monotonic() - t0) * 1000)
        print(
            f"{_PREFIX} event=ffmpeg_exit stage={stage} project={pid or '-'} job={jid or '-'}"
            f" exit_code={code} elapsed_ms={dur_ms}{_safe_extra(extra)}",
            flush=True,
        )
        if code != 0:
            raise subprocess.CalledProcessError(code, cmd)
        return code
    finally:
        stop.set()
        hb.join(timeout=1.0)
        stage_end(stage, t0, project=project, job=job, exit_code=code, **extra)
