"""DB helpers for Motion Studio tables (psycopg2 connection from the clips worker)."""
from __future__ import annotations

import json
import uuid

from psycopg2.extras import Json, RealDictCursor

PROJECT_JSON = {"settings", "stages", "story", "plan", "narration", "music", "qa", "exportInfo", "proposals"}
SCENE_JSON = {"plan", "qa", "handoff", "cues"}


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


def get_project(conn, project_id: str) -> dict | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT * FROM "MotionStudioProject" WHERE id=%s', (project_id,))
        row = cur.fetchone()
    conn.commit()
    return dict(row) if row else None


def update_project(conn, project_id: str, **fields) -> None:
    if not fields:
        return
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f'"{k}"=%s')
        vals.append(Json(v) if k in PROJECT_JSON and v is not None else v)
    sets.append('"updatedAt"=NOW()')
    with conn.cursor() as cur:
        cur.execute(f'UPDATE "MotionStudioProject" SET {", ".join(sets)} WHERE id=%s', (*vals, project_id))
    conn.commit()


def set_stage(conn, project_id: str, stage: str, status: str = "running", stage_status: str = "running") -> None:
    p = get_project(conn, project_id) or {}
    stages = p.get("stages") or {}
    stages[stage] = stage_status
    update_project(conn, project_id, stage=stage, status=status, stages=stages)


def event(conn, project_id: str, stage: str, kind: str, message: str, data: dict | None = None) -> None:
    """#1221 BE-12: one event per step transition / decision. Never include secrets or signed URLs."""
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "StudioActivityEvent" ("projectId", stage, kind, message, data) VALUES (%s,%s,%s,%s,%s)',
                    (project_id, stage, kind, message[:2000], Json(data) if data is not None else None))
    conn.commit()
    print(f"[motion-studio] project={project_id} stage={stage} kind={kind} {message[:200]}", flush=True)


def enqueue(conn, clip_project_id: str, job_type: str, payload: dict, priority: int = 0) -> str:
    jid = f"job_{uuid.uuid4().hex}"
    with conn.cursor() as cur:
        cur.execute('INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "maxAttempts", "createdAt") '
                    "VALUES (%s,%s,%s,'QUEUED',%s::jsonb,%s,1,NOW())", (jid, clip_project_id, job_type, json.dumps(payload), priority))
    conn.commit()
    return jid


def scenes(conn, project_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT * FROM "MotionStudioScene" WHERE "projectId"=%s ORDER BY index', (project_id,))
        rows = [dict(r) for r in cur.fetchall()]
    conn.commit()
    return rows


def get_scene(conn, scene_id: str) -> dict | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT * FROM "MotionStudioScene" WHERE id=%s', (scene_id,))
        r = cur.fetchone()
    conn.commit()
    return dict(r) if r else None


def replace_scenes(conn, project_id: str, rows: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "MotionStudioScene" WHERE "projectId"=%s', (project_id,))   # own rows only
        for r in rows:
            cur.execute('INSERT INTO "MotionStudioScene" (id, "projectId", index, chapter, kind, "visualType", status, plan, '
                        '"startMs", "endMs", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())',
                        (r["id"], project_id, r["index"], r.get("chapter", 0), r.get("kind", "graphics"), r["visualType"],
                         r.get("status", "planned"), Json(r["plan"]), r.get("startMs", 0), r.get("endMs", 0)))
    conn.commit()


def update_scene(conn, scene_id: str, **fields) -> None:
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f'"{k}"=%s')
        vals.append(Json(v) if k in SCENE_JSON and v is not None else v)
    sets.append('"updatedAt"=NOW()')
    with conn.cursor() as cur:
        cur.execute(f'UPDATE "MotionStudioScene" SET {", ".join(sets)} WHERE id=%s', (*vals, scene_id))
    conn.commit()


def assets(conn, project_id: str) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT a.*, u.key AS "storageKey", u.mime AS mime FROM "StudioAsset" a '
                    'LEFT JOIN clip_uploads u ON u.id=a."uploadId" WHERE a."projectId"=%s ORDER BY a."createdAt"', (project_id,))
        rows = [dict(r) for r in cur.fetchall()]
    conn.commit()
    return rows


def update_asset(conn, asset_id: str, **fields) -> None:
    sets, vals = [], []
    for k, v in fields.items():
        sets.append(f'"{k}"=%s')
        vals.append(Json(v) if k in ("analysis", "provenanceLog") and v is not None else v)
    sets.append('"updatedAt"=NOW()')
    with conn.cursor() as cur:
        cur.execute(f'UPDATE "StudioAsset" SET {", ".join(sets)} WHERE id=%s', (*vals, asset_id))
    conn.commit()


def sandbox_exec(conn, project_id: str, scene_id: str | None, mode: str, ok: bool, error_kind: str | None = None,
                 error: str | None = None, code_hash: str | None = None, model: str | None = None, ms: int | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "MotionStudioSandboxExec" (id, "projectId", "sceneId", mode, ok, "errorKind", error, "codeHash", '
                    'model, "durationMs") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                    (new_id("sbx"), project_id, scene_id, mode, ok, error_kind, (error or "")[:2000] or None, code_hash, model, ms))
    conn.commit()


def should_produce(settings: dict) -> bool:
    """Production starts only after the user pressed Run (runRequested) AND (auto mode OR the story was approved)."""
    s = settings or {}
    mode = s.get("productionMode") or s.get("automation") or "checkpoint"
    return bool(s.get("runRequested")) and (mode == "auto" or bool(s.get("approved")))


def finish_plan(conn, project_id: str, clip_project_id: str) -> bool:
    """Plan done: under a row lock, either pause at the checkpoint or enqueue DOC_PRODUCE. The web /run and
    /story/approve routes update settings under the same row lock and re-check, so exactly one side enqueues."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT settings, stages FROM "MotionStudioProject" WHERE id=%s FOR UPDATE', (project_id,))
        row = cur.fetchone() or {}
        settings, stages = row.get("settings") or {}, row.get("stages") or {}
        go = should_produce(settings)
        settings.pop("changeNote", None)
        if go:
            stages.update({"story": "done", "direct": "done", "assets": "running"})
            cur.execute('UPDATE "MotionStudioProject" SET status=%s, stage=%s, stages=%s, settings=%s, "updatedAt"=NOW() WHERE id=%s',
                        ("running", "assets", Json(stages), Json(settings), project_id))
            cur.execute('SELECT 1 FROM clip_jobs WHERE "projectId"=%s AND type=%s AND status IN (\'QUEUED\',\'RUNNING\')',
                        (clip_project_id, "DOC_PRODUCE"))
            if not cur.fetchone():
                cur.execute('INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "maxAttempts", "createdAt") '
                            "VALUES (%s,%s,'DOC_PRODUCE','QUEUED',%s::jsonb,5,1,NOW())",
                            (f"job_{uuid.uuid4().hex}", clip_project_id, json.dumps({"motionProjectId": project_id})))
        else:
            stages.update({"story": "done", "direct": "awaiting_approval"})
            cur.execute('UPDATE "MotionStudioProject" SET status=%s, stage=%s, stages=%s, settings=%s, "updatedAt"=NOW() WHERE id=%s',
                        ("awaiting_approval", "direct", Json(stages), Json(settings), project_id))
    conn.commit()
    return go
