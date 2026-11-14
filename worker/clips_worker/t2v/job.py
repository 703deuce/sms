"""T2V_ASSEMBLE worker job — voice, xfade assemble, titles/brand finalize, web handoff."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from clips_worker.internal_callback import post_internal
from clips_worker.storage import download_object, upload_file
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble
from clips_worker.t2v.render_finalize import finalize_t2v_video
from clips_worker.t2v.tts_alignment import duration_ms_from_alignment, words_from_alignment
from clips_worker.render_clip import probe_duration_ms
from clips_worker.t2v.voice_cache import get_or_synthesize_voice_clip
import logging

log = logging.getLogger(__name__)

ASPECT_DIMS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


_PIPELINE_SHORT_SIDE = {"480p": 480, "720p": 720}


def _pipeline_canvas(document: dict, aspect: str, w: int, h: int) -> tuple[int, int]:
    # Only an explicit assembleResolution shrinks the assembled source. renderResolution is the export
    # size: the composition export expects the standard-size source (an 854x480 source came out
    # zoomed/stretched through the shared speakercrop path), so 480p is applied at export only.
    run = document.get("autobuild") or {}
    short = _PIPELINE_SHORT_SIDE.get(str(run.get("assembleResolution") or ""))
    if not short:
        return w, h
    if short == 480 and aspect == "16:9":
        return 854, 480
    scale = short / min(w, h)
    return int(round(w * scale / 2) * 2), int(round(h * scale / 2) * 2)


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
    key_s = str(key)
    try:
        download_object(key_s, dest)
    except RuntimeError as exc:
        msg = str(exc)
        if msg.startswith("storage_object_missing:") and key_s.startswith("stock/"):
            from clips_worker.t2v.stock_repair import repair_stock_asset

            asset_id = media.get("assetId")
            log.warning(
                "[t2v:stock] assemble media missing, attempting repair sceneIdx=%s assetId=%s storageKey=%s",
                idx,
                asset_id,
                key_s,
            )
            if repair_stock_asset(conn, key_s, str(asset_id) if asset_id else None):
                download_object(key_s, dest)
                log.info(
                    "[t2v:stock] assemble media repaired sceneIdx=%s storageKey=%s",
                    idx,
                    key_s,
                )
                return dest
            raise RuntimeError(f"scene_media_{idx}_stock_object_missing:{key_s}") from exc
        raise
    return dest


MIN_SUBSHOT_S = 1.2


def cut_offsets_from_alignment(alignment: dict | None, at_words: list[int], vo_s: float) -> list[float | None]:
    """Cut time (s from scene start) for each word index: the middle of the pause before that word,
    so a cut never lands inside a word. None when the index is out of range or the cut would leave a
    sub-shot shorter than MIN_SUBSHOT_S."""
    words = words_from_alignment(alignment, offset_s=0.0, scene_slot=0) if alignment else []
    out: list[float | None] = []
    last = 0.0
    for k in at_words:
        if not (0 < k < len(words)):
            out.append(None)
            continue
        t = (float(words[k - 1]["e"]) + float(words[k]["s"])) / 2
        if t - last < MIN_SUBSHOT_S or vo_s - t < MIN_SUBSHOT_S:
            out.append(None)
            continue
        out.append(round(t, 3))
        last = t
    return out


def _scene_cuts(conn, sc: dict, alignment: dict | None, vo_s: float, work: Path, idx: int, workspace_id: str):
    """Prompt-to-Video sub-shots: scene.cuts = [{atWord, media}] → [(offset_s, SceneMedia)] on word pauses."""
    raw = [c for c in (sc.get("cuts") or []) if isinstance(c, dict) and isinstance(c.get("atWord"), int)]
    if not raw or not alignment:
        return []
    offsets = cut_offsets_from_alignment(alignment, [c["atWord"] for c in raw], vo_s)
    cuts = []
    for k, (c, off) in enumerate(zip(raw, offsets)):
        if off is None:
            continue
        m = c.get("media") or {"kind": "color"}
        path = _fetch_media(conn, m, work, idx * 100 + k + 1, workspace_id)
        cuts.append((off, SceneMedia(
            kind=m.get("kind", "color"),
            path=path,
            src_in_s=float(m.get("srcInMs") or 0) / 1000.0,
            focal_x=float(m.get("focalX", 0.5)),
            focal_y=float(m.get("focalY", 0.5)),
            ken_burns=m.get("kenBurns", "zoom_in"),
            color=_media_color_hex(m),
        )))
    return cuts


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
    # Prompt-to-Video runs may request a lighter canvas (e.g. 480p for fast first tests).
    w, h = _pipeline_canvas(document, aspect, w, h)
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
                    project_id=str(project_id) if project_id else None,
                    job_id=job.get("id"),
                    scene_id=sc.get("id"),
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
            cuts = _scene_cuts(conn, sc, alignment, vo_s, work, idx, str(workspace_id))
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
                    cuts=cuts,
                )
            )

        if _job_aborted(conn, job["id"]):
            raise RuntimeError("job_canceled")
        progress(job["id"], {"jobStatus": "RUNNING", "stage": "assemble", "progress": 60})
        asm = assemble(scenes, work / "asm", w=w, h=h, fps=30)
        if _job_aborted(conn, job["id"]):
            raise RuntimeError("job_canceled")
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
            workspace_id=workspace_id,
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

        if _job_aborted(conn, job["id"]):
            raise RuntimeError("job_canceled")
        progress(job["id"], {"jobStatus": "RUNNING", "stage": "upload", "progress": 85})
        src_key = f"ws/{workspace_id}/projects/{project_id}/t2v/source_r{revision}_{job['id']}.mp4"
        upload_file(src_key, final, "video/mp4")

        probed_ms = probe_duration_ms(final)
        duration_ms = max(int(asm["durationMs"]), probed_ms)
        if probed_ms > int(asm["durationMs"]):
            log.info(
                "[t2v:assemble] duration from probe exceeds scene sum",
                extra={
                    "draftId": draft_id,
                    "jobId": job["id"],
                    "asmDurationMs": asm["durationMs"],
                    "probedMs": probed_ms,
                },
            )
        if all_words:
            last_end_ms = round(max(w.get("e", 0) for w in all_words) * 1000)
            if last_end_ms < duration_ms:
                log.info(
                    "[t2v:assemble] transcript ends before file duration",
                    extra={
                        "draftId": draft_id,
                        "jobId": job["id"],
                        "lastWordEndMs": last_end_ms,
                        "durationMs": duration_ms,
                    },
                )

        # Actual on-screen shot starts (scene starts + in-scene cuts), for the pacing QA.
        shot_starts: list[int] = []
        for k, sc_obj in enumerate(scenes):
            st = asm["sceneStartsMs"][k]
            shot_starts.append(st)
            shot_starts.extend(st + round(off * 1000) for off, _ in sorted(sc_obj.cuts, key=lambda c: c[0]))
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE clip_jobs SET payload = payload || %s::jsonb WHERE id=%s",
                    (json.dumps({"shotStartsMs": shot_starts, "assembledMs": duration_ms}), job["id"]),
                )
            conn.commit()
        except Exception as exc:  # noqa: BLE001 — QA data only
            log.warning("[t2v:assemble] shot starts not recorded: %s", exc)
            conn.rollback()

        post_internal(
            "/api/t2v/internal/assembled",
            {
                "draftId": draft_id,
                "projectId": project_id,
                "workspaceId": workspace_id,
                "revision": revision,
                "jobId": job["id"],
                "sourceKey": src_key,
                "durationMs": duration_ms,
                "sceneStartsMs": scene_starts,
                "words": all_words,
            },
        )

    progress(job["id"], {"jobStatus": "DONE", "stage": "done", "progress": 100})
