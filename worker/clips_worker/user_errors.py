"""Map internal failures to safe user-visible job/project errors."""


class ClipUserError(ValueError):
    """Validation failure safe to show on the project (not retried as infra)."""


BYO_MAX_DURATION_MS = 180_000
BYO_DURATION_MESSAGE = (
    "Bring-your-own clips can be up to 3 minutes. Use Find clips for longer videos."
)

_INTERNAL_MARKERS = (
    "on conflict",
    "unique or exclusion constraint",
    "psycopg2",
    "syntax error at",
    "undefined column",
    "undefined table",
    "deadlock detected",
)


def user_facing_job_error(message: str) -> str:
    raw = (message or "").strip()
    if not raw:
        return "Processing failed. Retry processing."
    lower = raw.lower()
    if any(m in lower for m in _INTERNAL_MARKERS):
        return "Processing failed. Retry processing."
    return raw[:500]
