"""Operator cancellation markers on streamer projects."""
from __future__ import annotations

OPERATOR_CANCEL_PREFIX = "Cancelled by operator"


def project_error_indicates_operator_cancel(error: str | None) -> bool:
    if not error:
        return False
    e = str(error).strip()
    return e.startswith(OPERATOR_CANCEL_PREFIX) or OPERATOR_CANCEL_PREFIX in e


def load_project_operator_cancelled(conn, project_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT error FROM clip_projects WHERE id = %s', (project_id,))
        row = cur.fetchone()
    if not row:
        return False
    return project_error_indicates_operator_cancel(row[0])
