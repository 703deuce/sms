"""T2V_ASSEMBLE worker job — voice, xfade assemble, titles/brand finalize, web handoff."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from clips_worker.internal_callback import post_internal
from clips_worker.storage import download_object, put_json, upload_file
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble
from clips_worker.t2v.render_finalize import finalize_t2v_video
from clips_worker.t2v.tts_alignment import duration_ms_from_alignment, words_from_alignment
from clips_worker.t2v.voice_cache import get_or_synthesize_voice_clip

ASPECT_DIMS = {
    "16:9": (1280, 720),
    "9:16": (720, 1280),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


def _payload(job: dict) -> dict:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    return payload


def _media_color_hex(media: dict) -> str:
    c = (media.get("color") or "#111111").strip()
    if c.startswith("0x"):
        return c
    if c.startswith("#"):
        return "0x" + c[1:]
    return "0x111111"


def _stock_storage_key(conn, asset_id: str | None) -> str | None:
    if not asset_id:
        return None
    with conn.cursor() as cur:
        cur.execute('SELECT "storageKey" FROM stock_assets WHERE id=%s', (asset_id,))
        row = cur.fetchone()
    return row[0] if row and row[0] else None


def _storage_key_ok(workspace_id: str, key: str) -> bool:
    return key.startswith(f"ws/{workspace_id}/") or key.startswith("stock/")


def _job_aborted(conn, job_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT status, error FROM clip_jobs WHERE id=%s', (job_id,))
        row = cur.fetchone()
    if not row:
        return True
    status, err = row
    if status == "FAILED":
        return True
    return bool(err and "Canceled" in str(err))


def _fetch_media(conn, media: dict | None, work: Path, idx: int, workspace_id: str) -> Path | None:
    if not media or media.get("kind") == "color":
        return None
    ext = ".jpg" if media.get("kind") == "image" else ".mp4"
    dest = work / f"media_{idx}{ext}"
    key = media.get("storageKey") or _stock_storage_key(conn, media.get("assetId"))
    if not key:
        raise RuntimeError(f"scene_media_{idx}_missing_storage_key")
    if not _storage_key_ok(workspace_id, str(key)):
        raise RuntimeError("invalid_storage_key")
    download_object(str(key), dest)
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
    draft_id = p.get("draftId")
    workspace_id = p.get("workspaceId")
    project_id = p.get("projectId")
    if not draft_id or not workspace_id:
        raise ValueError("T2V_ASSEMBLE payload requires draftId and workspaceId")

    with conn.cursor() as cur:
        cur.execute(
            'SELECT document, revision, "projectId" FROM t2v_drafts WHERE id=%s AND "workspaceId"=%s',
            (draft_id, workspace_id),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError(f"T2vDraft not found: {draft_id}")
    document, revision, db_project_id = row
    if isinstance(document, str):
        document = json.loads(document)
    project_id = project_id or db_project_id
    aspect = (document.get("settings") or {}).get("aspect", "16:9")
    w, h = ASPECT_DIMS.get(aspect, ASPECT_DIMS["16:9"])
    voice = document.get("voice") or {}
    scenes_doc = document.get("scenes") or []
    n = len(scenes_doc)
    needs_voice = any(
        (sc.get("narration") or "").strip() and not sc.get("muted") for sc in scenes_doc
    )
    if needs_voice and not voice.get("voiceId"):
        raise RuntimeError("draft_missing_voice_settings")

    with tempfile.TemporaryDirectory(prefix="t2v-asm-") as td:
        work = Path(td)
        scenes: list[Scene] = []
        alignments: list[dict | None] = []
        scene_starts: dict[str, int] = {}

        for idx, sc in enumerate(scenes_doc):
            if _job_aborted(conn, job["id"]):
                raise RuntimeError("job_canceled")
            progress(
                job["id"],
                {"jobStatus": "RUNNING", "stage": "voice", "progress": 5 + int(40 * idx / max(1, n))},
            )
            vo_path = None
            vo_s = 0.0
            alignment = None
            narration = (sc.get("narration") or "").strip()
            if narration and not sc.get("muted") and voice.get("voiceId"):
                vhash = (sc.get("voice") or {}).get("hash")
                if not vhash:
                    raise RuntimeError(f"scene {sc.get('id')} missing voice.hash (compute in TypeScript)")
                prev_t = scenes_doc[idx - 1]["narration"] if idx else None
                next_t = scenes_doc[idx + 1]["narration"] if idx + 1 < n else None
                clip = get_or_synthesize_voice_clip(
                    conn,
                    workspace_id=workspace_id,
                    text=narration,
                    voice=voice,
                    voice_hash=vhash,
                    previous_text=prev_t,
                    next_text=next_t,
                )
                conn.commit()
                vo_path = work / f"vo_{idx}.mp3"
                download_object(clip["storageKey"], vo_path)
                alignment = clip["alignment"]
                vo_s = max(clip.get("durationMs", 0) / 1000.0, duration_ms_from_alignment(alignment) / 1000.0)
            alignments.append(alignment)

            pad_ms = int(sc.get("padMs") or 400)
            min_ms = int(sc.get("minDurMs") or 2000)
            dur_s = max(min_ms / 1000.0, vo_s + pad_ms / 1000.0)

            mdoc = sc.get("media") or {"kind": "color"}
            media_path = _fetch_media(conn, mdoc, work, idx, str(workspace_id))
            scenes.append(
                Scene(
                    id=sc.get("id", str(idx)),
                    dur_s=dur_s,
                    media=SceneMedia(
                        kind=mdoc.get("kind", "color"),
                        path=media_path,
                        src_in_s=float(mdoc.get("srcInMs") or 0) / 1000.0,
                        focal_x=float(mdoc.get("focalX", 0.5)),
                        focal_y=float(mdoc.get("focalY", 0.5)),
                        ken_burns=mdoc.get("kenBurns", "zoom_in"),
                        color=_media_color_hex(mdoc),
                    ),
                    transition=sc.get("transition", "fade"),
                    transition_s=float(sc.get("transitionMs") or 500) / 1000.0,
                    vo_path=vo_path,
                )
            )

        if _job_aborted(conn, job["id"]):
            raise RuntimeError("job_canceled")
        progress(job["id"], {"jobStatus": "RUNNING", "stage": "assemble", "progress": 60})
        asm = assemble(scenes, work / "asm", w=w, h=h, fps=30)
        progress(job["id"], {"jobStatus": "RUNNING", "stage": "assemble", "progress": 72})
        final = work / "source.mp4"
        finalize_t2v_video(
            asm["source"],
            final,
            document=document,
            scene_starts_ms=asm["sceneStartsMs"],
            w=w,
            h=h,
            work_dir=work / "post",
            skip_brand_bookends=True,
        )

        all_words: list[dict] = []
        t0 = 0.0
        for idx, sc in enumerate(scenes_doc):
            scene_starts[sc["id"]] = round(t0 * 1000)
            al = alignments[idx]
            if al:
                all_words.extend(
                    words_from_alignment(al, offset_s=t0, scene_slot=int(sc.get("slot", idx)))
                )
            t0 += scenes[idx].dur_s

        progress(job["id"], {"jobStatus": "RUNNING", "stage": "upload", "progress": 85})
        src_key = f"ws/{workspace_id}/projects/{project_id}/t2v/source_r{revision}.mp4"
        upload_file(src_key, final, "video/mp4")
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
                "durationMs": asm["durationMs"],
                "sceneStartsMs": scene_starts,
                "words": all_words,
            },
        )

    progress(job["id"], {"jobStatus": "DONE", "stage": "done", "progress": 100})
