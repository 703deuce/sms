#!/usr/bin/env python3
"""Clone a Motion Studio project's brief and uploads into a preflight-only run.

Reuses existing StudioAsset uploadIds (and analysis when present) so the real
pipeline can run story, plan, design, contract validation, lint and compile
without enqueueing render segments and without inventing a user session.

Usage (inside clips-worker):
  python /app/scripts/ms_preflight_from_project.py msp_SOURCE_ID

Prints the new project id and job id only. Never prints secrets, env, or URLs.
"""
from __future__ import annotations

import json
import os
import sys
import uuid

import psycopg2
from psycopg2.extras import Json, RealDictCursor


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}" if prefix != "job" else f"job_{uuid.uuid4().hex}"


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1].startswith("msp_"):
        print("usage: ms_preflight_from_project.py msp_<source_id>", file=sys.stderr)
        return 2
    source_id = sys.argv[1]
    dsn = (os.environ.get("DATABASE_URL") or "").strip()
    if not dsn:
        print("DATABASE_URL is not configured", file=sys.stderr)
        return 2
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT * FROM "MotionStudioProject" WHERE id=%s', (source_id,))
            src = cur.fetchone()
            if not src:
                print(f"source project not found: {source_id}", file=sys.stderr)
                return 1
            cur.execute(
                'SELECT id, "workspaceId", "uploadId", kind, filename, status, width, height, "durationMs", analysis, "provenanceLog" '
                'FROM "StudioAsset" WHERE "projectId"=%s ORDER BY "createdAt"',
                (source_id,),
            )
            assets = list(cur.fetchall())
        settings = dict(src.get("settings") or {})
        settings.update({
            "preflightOnly": True,
            "productionMode": "auto",
            "automation": "auto",
            "runRequested": True,
            "webResearch": False,
            "mediaPolicy": "uploads_only",
            "renderSize": settings.get("renderSize") or "480p",
            "finalRenderSize": settings.get("finalRenderSize") or settings.get("renderSize") or "480p",
            "format": "16:9_480p" if not str(settings.get("renderSize") or "480p").startswith("1080") else settings.get("format") or "16:9_480p",
            "approved": True,
        })
        # Always persist an explicit 480p target unless the source already set another renderSize.
        if not src.get("settings") or not (src.get("settings") or {}).get("renderSize"):
            settings["renderSize"] = "480p"
            settings["finalRenderSize"] = "480p"
            settings["format"] = "16:9_480p"
        title = (src.get("title") or "Documentary").strip()
        if "(preflight)" not in title.lower():
            title = (title[:100] + " (preflight)").strip()
        new_id = _id("msp")
        clip_id = _id("proj")
        clip_row_id = "clip_ms_" + uuid.uuid4().hex[:24]
        idem = f"preflight:{source_id}:{uuid.uuid4().hex[:12]}"
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO clip_projects (id, "workspaceId", "createdById", title, settings, "rangeStartMs", "rangeEndMs", '
                'status, stage, progress, "sourceKind", "createdAt", "updatedAt") '
                "VALUES (%s,%s,%s,%s,%s::jsonb,%s,%s,'QUEUED','motion_studio',0,'motion_studio',NOW(),NOW())",
                (
                    clip_id,
                    src["workspaceId"],
                    src["userId"],
                    title[:120],
                    json.dumps({"aspectRatio": "16:9", "blank": True, "byo": True}),
                    0,
                    int(settings.get("lengthMin") or 5) * 60_000,
                ),
            )
            cur.execute(
                'INSERT INTO "MotionStudioProject" (id, "workspaceId", "userId", director, "clipProjectId", "clipId", title, brief, '
                'workflow, settings, status, stage, stages, "idempotencyKey", "createdAt", "updatedAt") '
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'planning','story',%s,%s,NOW(),NOW())",
                (
                    new_id,
                    src["workspaceId"],
                    src["userId"],
                    src.get("director") or "documentary",
                    clip_id,
                    clip_row_id,
                    title[:120],
                    src.get("brief") or "",
                    src.get("workflow") or "idea",
                    Json(settings),
                    Json({}),
                    idem[:190],
                ),
            )
            cur.execute(
                'INSERT INTO "StudioActivityEvent" ("projectId", stage, kind, message, data) VALUES (%s,%s,%s,%s,%s)',
                (new_id, "story", "stage",
                 f"Pre-flight dry-run created from {source_id}. Story, plan and design will run; render will not start.",
                 Json({"sourceProjectId": source_id, "preflightOnly": True, "assetCount": len(assets)})),
            )
            for a in assets:
                cur.execute(
                    'INSERT INTO "StudioAsset" (id, "projectId", "workspaceId", "uploadId", kind, filename, status, width, height, '
                    '"durationMs", analysis, "provenanceLog", "createdAt", "updatedAt") '
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())",
                    (
                        _id("msa"),
                        new_id,
                        a["workspaceId"],
                        a["uploadId"],
                        a["kind"],
                        a.get("filename") or "",
                        a.get("status") or "pending",
                        a.get("width"),
                        a.get("height"),
                        a.get("durationMs"),
                        Json(a["analysis"]) if a.get("analysis") is not None else None,
                        Json({**(a.get("provenanceLog") or {}), "clonedFrom": a["id"], "sourceProjectId": source_id})
                        if True else None,
                    ),
                )
            job_id = _id("job")
            cur.execute(
                'INSERT INTO clip_jobs (id, "projectId", type, status, payload, priority, "maxAttempts", "createdAt") '
                "VALUES (%s,%s,'DOC_PLAN','QUEUED',%s::jsonb,5,1,NOW())",
                (job_id, clip_id, json.dumps({"motionProjectId": new_id, "preflightOnly": True})),
            )
        conn.commit()
        ready = sum(1 for a in assets if a.get("status") == "ready" and a.get("analysis"))
        print(
            f"preflight_project={new_id} clipProject={clip_id} job={job_id} "
            f"assets={len(assets)} readyWithAnalysis={ready} source={source_id}"
        )
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
