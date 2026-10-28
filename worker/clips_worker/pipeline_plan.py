"""Shared plan_clips + empty-picks READY handling for all pipeline modes."""
from __future__ import annotations

from typing import Any, Callable

from clips_worker.plan_clips import plan_clips


def plan_or_finish_empty(
    conn,
    project_id: str,
    job_id: str,
    post_progress: Callable[..., Any],
    picks: list[dict] | None,
    picker_message: str | None,
    *,
    mark_project_ready,
) -> list[dict] | None:
    """
    Run plan_clips exactly once. Returns planned picks, or None when the pipeline
    should exit early after marking the project READY with an empty error message.
    """
    from clips_worker.decision_log import decision_log

    raw = list(picks or [])
    planned = plan_clips(raw) if raw else []
    decision_log(
        "plan_clips",
        "pipeline_plan",
        input_count=len(raw),
        output_count=len(planned),
    )
    if not planned:
        empty_msg = picker_message or "No complete, self-contained moments found."
        decision_log("pipeline", "empty_picks_ready", message=empty_msg)
        mark_project_ready(conn, project_id, error=empty_msg)
        post_progress(
            job_id,
            {
                "projectStatus": "READY",
                "stage": "ready",
                "progress": 100,
                "jobStatus": "DONE",
                "error": empty_msg,
            },
        )
        return None
    return planned
