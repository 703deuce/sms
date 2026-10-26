from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import psycopg2

L4_USD_PER_S = float(os.environ.get("MODAL_L4_USD_PER_S", "0.000222"))
SCALEDOWN_S = float(os.environ.get("MODAL_SCALEDOWN_S", "60"))


def record_modal_transcribe(
    conn,
    workspace_id: str,
    project_id: str,
    gpu_seconds: float,
    batch: bool = False,
) -> None:
    extra = SCALEDOWN_S if batch else 0.0
    units = gpu_seconds + extra
    cost_micros = int(round(units * L4_USD_PER_S * 1_000_000))
    usage_id = f"aiu_{uuid.uuid4().hex[:24]}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ai_usage (
              id, "workspaceId", "projectId", provider, model, units, "unitType", "costUsdMicros", "createdAt"
            ) VALUES (%s, %s, %s, 'modal', 'L4:transcribe', %s, 'gpu_s', %s, %s)
            """,
            (usage_id, workspace_id, project_id, units, cost_micros, datetime.now(timezone.utc)),
        )
    conn.commit()
