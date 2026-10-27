"""T2V_ASSEMBLE worker job."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from clips_worker.internal_callback import post_internal
from clips_worker.storage import download_object, put_json, upload_file
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble
from clips_worker.t2v.elevenlabs_tts import tts_with_timestamps
from clips_worker.t2v.tts_alignment import words_from_alignment

ASPECT_DIMS = {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (1080, 1080), "4:5": (1080, 1350)}


def _payload(job: dict) -> dict:
    p = job.get("payload") or {}
    if isinstance(p, str):
        p = json.loads(p)
    return p


def _voice_cache_get(conn, ws: str, hsh: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "storageKey", alignment FROM t2v_voice_clips WHERE "workspaceId"=%s AND hash=%s',
            (ws, hsh),
        )
        row = cur.fetchone()
    if not row:
        return None
    alignment = row[1]
    if isinstance(alignment, str):
        alignment = json.loads(alignment)
    return {"storageKey": row[0], "alignment": alignment}


def _stock_storage_key(conn, asset_id: str | None) -> str | None:
    if not asset_id:
        return None
    with conn.cursor() as cur:
        cur.execute('SELECT "storageKey" FROM stock_assets WHERE id=%s', (asset_id,))
        row = cur.fetchone()
    return row[0] if row and row[0] else None


def _fetch_media(conn, media: dict | None, work: Path, idx: int) -> Path | None:
    if not media or media.get("kind") == "color":
        return None
    dest = work / f"media_{idx}{'.jpg' if media.get('kind') == 'image' else '.mp4'}"
    key = media.get("storageKey") or _stock_storage_key(conn, media.get("assetId"))
    if key:
        download_object(str(key), dest)
        return dest
    src = media.get("previewUrl") or media.get("srcUrl")
    if not src:
        return None
    import requests

    r = requests.get(src, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)
    return dest


def _project_words_key(conn, project_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute('SELECT "transcriptKey" FROM clip_projects WHERE id=%s', (project_id,))
        row = cur.fetchone()
    if not row or not row[0]:
        raise RuntimeError("project_missing_transcript_key")
    return row[0]


def run_t2v_assemble_job(conn, job: dict, progress) -> None:
    p = _payload(job)
    draft_id = p["draftId"]
    workspace_id = p["workspaceId"]
    project_id = p["projectId"]

    with conn.cursor() as cur:
        cur.execute('SELECT document, revision FROM t2v_drafts WHERE id=%s', (draft_id,))
        row = cur.fetchone()
    if not row:
        raise RuntimeError("draft_not_found")
    doc, revision = row[0], row[1]
    if isinstance(doc, str):
        doc = json.loads(doc)

    w, h = ASPECT_DIMS.get(doc["settings"]["aspect"], (1280, 720))
    voice = doc.get("voice") or {}
    scenes_out: list[Scene] = []
    scene_meta: list[dict] = []
    n = len(doc.get("scenes") or [])

    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        for idx, sc in enumerate(doc["scenes"]):
            progress(
                job["id"],
                {"jobStatus": "RUNNING", "stage": "voice", "progress": 5 + int(40 * idx / max(1, n))},
            )
            vo_path = None
            vo_s = 0.0
            alignment = None
            if sc.get("narration", "").strip() and not sc.get("muted"):
                vo_info = sc.get("voice") or {}
                hsh = vo_info.get("hash")
                vo_path = work / f"vo_{idx}.mp3"
                cached = _voice_cache_get(conn, workspace_id, hsh) if hsh else None
                if cached:
                    download_object(cached["storageKey"], vo_path)
                    alignment = cached["alignment"]
                else:
                    prev_t = doc["scenes"][idx - 1]["narration"] if idx else None
                    next_t = doc["scenes"][idx + 1]["narration"] if idx + 1 < n else None
                    audio, alignment, _model = tts_with_timestamps(
                        sc["narration"],
                        voice,
                        previous_text=prev_t,
                        next_text=next_t,
                    )
                    vo_path.write_bytes(audio)
                ends = (alignment or {}).get("character_end_times_seconds") or [0]
                vo_s = float(ends[-1]) if ends else 0.0
            dur_s = max((sc.get("minDurMs") or 2000) / 1000, vo_s + (sc.get("padMs") or 400) / 1000)
            media_path = _fetch_media(conn, sc.get("media"), work, idx)
            m = sc.get("media") or {}
            scenes_out.append(
                Scene(
                    id=sc["id"],
                    dur_s=dur_s,
                    media=SceneMedia(
                        kind=m.get("kind", "color"),
                        path=media_path,
                        src_in_s=(m.get("srcInMs") or 0) / 1000,
                        focal_x=m.get("focalX", 0.5),
                        focal_y=m.get("focalY", 0.5),
                        ken_burns=m.get("kenBurns", "zoom_in"),
                        color=m.get("color", "0x111111"),
                    ),
                    transition=sc.get("transition", "fade"),
                    transition_s=(sc.get("transitionMs") or 500) / 1000,
                    vo_path=vo_path,
                )
            )
            scene_meta.append({"id": sc["id"], "slot": sc["slot"], "alignment": alignment, "dur_s": dur_s})

        progress(job["id"], {"jobStatus": "RUNNING", "stage": "assemble", "progress": 65})
        out = assemble(scenes_out, work / "asm", w=w, h=h, fps=30)

        all_words: list[dict] = []
        t0 = 0.0
        scene_starts: dict[str, int] = {}
        for idx, meta in enumerate(scene_meta):
            scene_starts[meta["id"]] = round(t0 * 1000)
            if meta.get("alignment"):
                all_words += words_from_alignment(
                    meta["alignment"],
                    offset_s=t0,
                    scene_slot=int(meta["slot"]),
                )
            t0 += meta["dur_s"]

        progress(job["id"], {"jobStatus": "RUNNING", "stage": "upload", "progress": 85})
        src_key = f"ws/{workspace_id}/projects/{project_id}/t2v/source_r{revision}.mp4"
        upload_file(src_key, out["source"], "video/mp4")
        put_json(_project_words_key(conn, project_id), all_words)

        post_internal(
            "/api/t2v/internal/assembled",
            {
                "draftId": draft_id,
                "projectId": project_id,
                "workspaceId": workspace_id,
                "revision": revision,
                "jobId": job["id"],
                "sourceKey": src_key,
                "durationMs": out["durationMs"],
                "sceneStartsMs": scene_starts,
                "words": all_words,
            },
        )

        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE t2v_drafts
                SET status=%s, stage=%s, progress=%s, "assembledRevision"=%s, error=NULL, "updatedAt"=NOW()
                WHERE id=%s
                """,
                ("READY", "done", 100, revision, draft_id),
            )
            cur.execute(
                'UPDATE clip_jobs SET status=%s, "finishedAt"=NOW() WHERE id=%s',
                ("DONE", job["id"]),
            )
        conn.commit()

    progress(job["id"], {"jobStatus": "DONE", "stage": "done", "progress": 100})
