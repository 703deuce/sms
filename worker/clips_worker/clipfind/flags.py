"""Clipfind feature flags — single resolver (C1 hard rule 2)."""
from __future__ import annotations

import os
import traceback
from typing import Any

from clips_worker.clipfind.context import JobCtx, get_job_ctx
from clips_worker.decision_log import decision_log

# Logging-only defaults ON
_DEFAULT_ON = frozenset(
    {
        "CLIPFIND_DROP_LEDGER",
        "CLIPFIND_SHADOW_RANK",
        "CLIPFIND_BEATS_SHADOW",
        "CLIPFIND_COST_LOG",
    }
)

_BEHAVIOR_FLAGS = (
    "CLIPFIND_MINLEN_KEEP",
    "CLIPFIND_PEAK_DEDUPE_IOU",
    "CLIPFIND_LLM_KEEP_DEMOTE",
    "CLIPFIND_HOOK_ORDER_REPAIR",
    "CLIPFIND_REASSESS_KEEP",
    "CLIPFIND_UPLOAD_MISSING_UNAVAILABLE",
    "CLIPFIND_GATES_DEMOTE",
    "CLIPFIND_FAIR_RANK",
    "CLIPFIND_UPLOAD_FAIR_RANK",
    "CLIPFIND_NEVER_EMPTY",
    "CLIPFIND_SETUP_LOOKBACK",
    "CLIPFIND_REACTION_TAIL",
    "CLIPFIND_VARIANTS",
    "CLIPFIND_VALIDATE_WINDOW",
    "CLIPFIND_JUDGE_V2",
    "CLIPFIND_CHAT_PAYOFF",
    "CLIPFIND_DENSE_LOOK",
)

_ALL_FLAGS = tuple(_DEFAULT_ON) + _BEHAVIOR_FLAGS


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _workspace_override_on(workspace_id: str) -> bool:
    raw = os.environ.get("CLIPFIND_ON_WORKSPACES", "").strip()
    if not raw or not workspace_id:
        return False
    ids = {x.strip() for x in raw.split(",") if x.strip()}
    return workspace_id in ids


def _project_override_on(project_id: str) -> bool:
    raw = os.environ.get("CLIPFIND_ON_PROJECTS", "").strip()
    if not raw or not project_id:
        return False
    ids = {x.strip() for x in raw.split(",") if x.strip()}
    return project_id in ids


def resolved_clipfind_flags(job_ctx: JobCtx | None = None) -> dict[str, bool]:
    ctx = job_ctx or get_job_ctx()
    ws = (ctx.workspace_id if ctx else "") or ""
    proj = (ctx.project_id if ctx else "") or ""
    if _env_bool("CLIPFIND_ALL_OFF", False):
        return {name: False for name in _ALL_FLAGS}
    ws_on = _workspace_override_on(ws)
    proj_on = _project_override_on(proj)
    behavior_override = ws_on or proj_on
    out: dict[str, bool] = {}
    for name in _ALL_FLAGS:
        default = name in _DEFAULT_ON
        val = _env_bool(name, default)
        if behavior_override and name in _BEHAVIOR_FLAGS:
            val = True
        out[name] = val
    return out


def clipfind_flag(name: str, job_ctx: JobCtx | None = None) -> bool:
    return resolved_clipfind_flags(job_ctx).get(name, False)


def log_resolved_flags(job_ctx: JobCtx | None = None) -> None:
    try:
        ctx = job_ctx or get_job_ctx()
        resolved = resolved_clipfind_flags(job_ctx)
        decision_log(
            "clipfind",
            "flags",
            clipfind_on_workspace=_workspace_override_on((ctx.workspace_id if ctx else "") or ""),
            clipfind_on_project=_project_override_on((ctx.project_id if ctx else "") or ""),
            **{k.lower(): v for k, v in resolved.items()},
        )
    except Exception as exc:
        decision_log("clipfind", "fallback", site="log_resolved_flags", reason=type(exc).__name__)


def clipfind_fallback(site: str, reason: str, *, exc: BaseException | None = None, **extra: Any) -> None:
    try:
        payload: dict[str, Any] = dict(extra)
        if exc is not None:
            payload["msg"] = str(exc)[:200]
            tb = traceback.extract_tb(exc.__traceback__)
            if tb:
                fr = tb[-1]
                payload["frame"] = f"{fr.filename}:{fr.lineno} {fr.name}"
        decision_log("clipfind", "fallback", site=site, reason=str(reason)[:200], **payload)
    except Exception:
        pass
