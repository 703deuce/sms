"""Modal monthly spend guard (reads ai_usage via DATABASE_URL)."""
from __future__ import annotations

import os
import time
from datetime import datetime, timezone

import psycopg2

_cache_until = 0.0
_cache_allow = True


def _monthly_budget_usd() -> float:
    return float(os.environ.get("MODAL_MONTHLY_BUDGET_USD", "30"))


def _threshold_micros() -> int:
    return int(_monthly_budget_usd() * 0.95 * 1_000_000)


def allow(conn=None) -> bool:
    global _cache_until, _cache_allow
    now = time.time()
    if now < _cache_until:
        return _cache_allow

    threshold = _threshold_micros()
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = 0
    own_conn = conn is None
    if own_conn:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            _cache_allow = True
            _cache_until = now + 60
            return True
        conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM("costUsdMicros"), 0)::bigint
                FROM ai_usage
                WHERE provider = 'modal' AND "createdAt" >= %s
                """,
                (month_start,),
            )
            total = int(cur.fetchone()[0])
    finally:
        if own_conn:
            conn.close()

    _cache_allow = total < threshold
    _cache_until = now + 60
    return _cache_allow
