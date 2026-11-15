"""Resumable stage recovery that keeps the single-attempt paid-call policy.

Unhandled failures still mark the project failed. An explicit user retry may
resume from saved artifacts (plan, narration, scene code, renders) and must
not automatically re-issue a paid model or TTS call that already succeeded.
"""
from __future__ import annotations


def resume_produce(plan: dict | None, narration: dict | None, payload: dict | None, scenes: list[dict] | None) -> dict:
    """Decide what a DOC_PRODUCE resume may reuse and which scenes still need work."""
    payload = payload or {}
    resume = bool(payload.get("resume") or payload.get("recover"))
    has_layout = bool((plan or {}).get("layout"))
    has_narration = bool(narration) and not payload.get("renarrate")
    reuse_narration = has_narration
    reuse_layout = resume and has_layout and has_narration
    pending = []
    done = []
    for scene in scenes or []:
        status = scene.get("status")
        if status == "done" and scene.get("renderKey") and not payload.get("force"):
            done.append(scene.get("id"))
        else:
            pending.append(scene.get("id"))
    if not resume:
        # A fresh produce still re-enqueues every scene; caches inside the
        # segment worker skip paid design when the context hash matches.
        pending = [s.get("id") for s in (scenes or [])]
        done = []
    return {
        "resume": resume,
        "reuseNarration": reuse_narration,
        "reuseLayout": reuse_layout,
        "pendingSceneIds": pending,
        "doneSceneIds": done,
        "skipPaidNarration": reuse_narration,
        "policy": "single-attempt paid calls; resume reuses artifacts; nothing retries automatically",
    }


def recover_render_strategy(ctx: dict, original_code: str | None, error_kind: str | None = None) -> dict:
    """Describe the intent-preserving render recovery; does not execute it."""
    scene = (ctx or {}).get("scene") or {}
    assets = list((ctx or {}).get("assets") or {})
    return {
        "prefer": "visual_type_fallback",
        "visualType": scene.get("visualType"),
        "keepAssets": assets,
        "keepSpec": True,
        "keepOriginalCode": bool(original_code),
        "lastResort": "framework_fallback",
        "errorKind": error_kind,
        "degraded": True,
    }
