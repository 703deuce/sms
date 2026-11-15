"""Motion Studio worker job handlers (new job types on the existing clips worker).

DOC_PLAN            analyze uploads (reuse) -> story -> director plan -> checkpoint or DOC_PRODUCE
DOC_PRODUCE         narration -> layout -> fan out MGD_RENDER_SEGMENT per scene (cached scenes skipped)
MGD_RENDER_SEGMENT  one scene: design (sandboxed code + fix loop) + parallel render, or a handoff render;
                    the last scene to finish enqueues DOC_ASSEMBLE (row-locked)
DOC_ASSEMBLE        concat -> VO/music/SFX/clip stems -> mix (-15 LUFS) -> master + small export -> QA ->
                    canvas upload + editor timeline (ClipEditsV2 motionStudio extension) -> review

Every job has maxAttempts=1 (no automatic retry). Errors mark the project failed with the stage and are
recorded on the job WITHOUT the clipper's progress callback (so no clipper project state is touched).
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import time
import traceback
from pathlib import Path

from clips_worker.motion_studio.pipeline import config, db

JOB_TYPES = ("DOC_PLAN", "DOC_PRODUCE", "MGD_RENDER_SEGMENT", "DOC_ASSEMBLE")


def _payload(job: dict) -> dict:
    p = job.get("payload") or {}
    return json.loads(p) if isinstance(p, str) else p


def workdir(project_id: str) -> str:
    base = os.environ.get("MOTION_STUDIO_WORKDIR") or "/tmp/motion_studio"
    d = os.path.join(base, project_id)
    os.makedirs(d, exist_ok=True)
    return d


def _finish_job(conn, job_id: str, error: str | None = None) -> None:
    with conn.cursor() as cur:
        if error:
            cur.execute("UPDATE clip_jobs SET status='FAILED', error=%s, \"finishedAt\"=NOW(), \"lockedBy\"=NULL, \"lockedAt\"=NULL "
                        "WHERE id=%s", (error[:4000], job_id))
        else:
            cur.execute("UPDATE clip_jobs SET status='DONE', error=NULL, \"finishedAt\"=NOW() WHERE id=%s", (job_id,))
    conn.commit()


def _logger(conn, project_id: str, stage: str):
    def log(kind: str, message: str, data: dict | None = None):
        try:
            db.event(conn, project_id, stage, kind, message, data)
        except Exception:  # noqa: BLE001
            conn.rollback()
    return log


def handle(conn, job: dict) -> None:
    """Entry point registered in main.DISPATCH for every Motion Studio job type."""
    p = _payload(job)
    pid = str(p.get("motionProjectId") or "")
    jtype = job.get("type")
    stage = {"DOC_PLAN": "story", "DOC_PRODUCE": "assets", "MGD_RENDER_SEGMENT": "graphics", "DOC_ASSEMBLE": "assemble"}.get(jtype, "story")
    print(f"[motion-studio:worker] begin job={job['id']} type={jtype} project={pid}", flush=True)
    t0 = time.time()
    try:
        proj = db.get_project(conn, pid)
        if not proj:
            raise ValueError("Motion Studio project not found")
        if proj["status"] == "cancelled":
            _finish_job(conn, job["id"])
            return
        if jtype == "DOC_PLAN":
            run_plan(conn, proj, job, p)
        elif jtype == "DOC_PRODUCE":
            run_produce(conn, proj, job, p)
        elif jtype == "MGD_RENDER_SEGMENT":
            run_segment(conn, proj, job, p)
        elif jtype == "DOC_ASSEMBLE":
            run_assemble(conn, proj, job, p)
        _finish_job(conn, job["id"])
        print(f"[motion-studio:worker] done job={job['id']} type={jtype} ms={int((time.time() - t0) * 1000)}", flush=True)
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        msg = f"{type(exc).__name__}: {str(exc)[:500]}"
        traceback.print_exc()
        try:
            if jtype == "MGD_RENDER_SEGMENT" and p.get("sceneId"):
                db.update_scene(conn, p["sceneId"], status="failed", error=msg[:1000])
            db.update_project(conn, pid, status="failed", errorCode=f"{stage}_failed", errorMessage=msg[:1000], errorStage=stage)
            db.event(conn, pid, stage, "failed", f"{jtype} failed: {msg[:300]}", {"job": job["id"]})
        except Exception:  # noqa: BLE001
            conn.rollback()
        _finish_job(conn, job["id"], msg)


# ---------------------------------------------------------------- DOC_PLAN
def run_plan(conn, proj: dict, job: dict, p: dict) -> None:
    from clips_worker.motion_studio.directors.registry import get_director
    from clips_worker.motion_studio.pipeline.analyze import analyze_asset
    director = get_director(proj.get("director") or "documentary")
    agent = director.load()
    pid = proj["id"]
    work = workdir(pid)
    log = _logger(conn, pid, "story")
    assets = db.assets(conn, pid)
    if assets:
        db.set_stage(conn, pid, "story")
        for a in assets:
            if a["status"] == "ready" and a.get("analysis"):
                continue
            db.update_asset(conn, a["id"], status="analyzing")
            try:
                r = analyze_asset(conn, proj, a, work, log)
                db.update_asset(conn, a["id"], status="ready", analysis=r["analysis"], width=r["width"], height=r["height"],
                                durationMs=r["durationMs"])
            except Exception as exc:  # noqa: BLE001 (one asset failing doesn't stop the run)
                db.update_asset(conn, a["id"], status="failed", analysis={"error": type(exc).__name__})
                log("asset_failed", f"analysis failed for {a.get('filename')}: {type(exc).__name__}", {"assetId": a["id"]})
        assets = db.assets(conn, pid)
    catalog = [a for a in assets if a["status"] == "ready"]
    db.set_stage(conn, pid, "story")
    log("stage", "writing the story", {})
    note = ((proj.get("settings") or {}).get("changeNote") or "").strip()
    if note:   # request-changes: the note rides on the brief for the rewrite (user script text stays verbatim)
        proj = {**proj, "brief": f"{proj.get('brief') or ''}\n\nRevision requested by the user: {note}".strip()}
        log("decision", "applying the requested changes", {"note": note[:200]})
    story = agent.build_story(proj, catalog, log)
    db.update_project(conn, pid, story=story, title=proj.get("title") or story.get("title") or "Untitled documentary")
    log("story_ready", f"story: {len(story['lines'])} lines, ~{story['estimatedDurationS']:.0f}s", {"lines": len(story["lines"])})
    db.set_stage(conn, pid, "direct")
    plan = agent.direct(proj, story, catalog, log)
    director.check({"world.canvas", "camera.path", "type.hero_slam"} | ({"handoff.enter"} if any(s["kind"] != "graphics" for s in plan["scenes"]) else set()))
    db.update_project(conn, pid, plan=plan)
    rows = [{"id": db.new_id("mss"), "index": s["index"], "chapter": 0, "kind": s["kind"], "visualType": s.get("visualType", "abstract"),
             "plan": s} for s in plan["scenes"]]
    db.replace_scenes(conn, pid, rows)
    if db.finish_plan(conn, pid, proj["clipProjectId"]):
        log("stage", "plan ready; production started", {})
    else:
        log("checkpoint", "story and plan ready for your review", {})


# ---------------------------------------------------------------- DOC_PRODUCE
def _assets_dir(work: str) -> str:
    d = os.path.join(work, "assets")
    os.makedirs(os.path.join(d, "photos"), exist_ok=True)
    return d


def _prepare_photos(conn, proj: dict, work: str) -> dict:
    """Copy image assets to assets/photos/<assetId>.jpg (+ meta.json) for PhotoFrame; returns ctx assets."""
    from PIL import Image
    from clips_worker.storage import download_object
    ad = _assets_dir(work)
    meta, out = {}, {}
    for a in db.assets(conn, proj["id"]):
        if a["kind"] not in ("image", "video") or a["status"] != "ready":
            continue
        dst = os.path.join(ad, "photos", f"{a['id']}.jpg")
        if not os.path.exists(dst):
            src = os.path.join(work, f"asset_{a['id']}{Path(a.get('filename') or '').suffix}")
            if not os.path.exists(src):
                download_object(a["storageKey"], Path(src))
            if a["kind"] == "image":
                Image.open(src).convert("RGB").save(dst, quality=92)
            else:                               # a still from the clip for photo/print treatments
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", src, "-frames:v", "1", dst], check=False)
        if os.path.exists(dst):
            with Image.open(dst) as im:
                meta[a["id"]] = {"w": im.width, "h": im.height}
            out[a["id"]] = {"kind": "photo" if a["kind"] == "image" else "still", "w": meta[a["id"]]["w"], "h": meta[a["id"]]["h"],
                            "description": ((a.get("analysis") or {}).get("summary") or a.get("filename") or "")[:200]}
    Path(os.path.join(ad, "photos", "meta.json")).write_text(json.dumps(meta))
    return out


def run_produce(conn, proj: dict, job: dict, p: dict) -> None:
    from clips_worker.motion_studio.pipeline.music_source import work_key
    from clips_worker.motion_studio.pipeline.narration import narrate, narrate_upload
    from clips_worker.motion_studio.pipeline.timeline import layout
    pid = proj["id"]
    work = workdir(pid)
    log = _logger(conn, pid, "assets")
    story, plan = proj["story"], proj["plan"]
    settings = proj.get("settings") or {}
    db.set_stage(conn, pid, "assets")
    narr = proj.get("narration")
    if not narr or p.get("renarrate"):
        if settings.get("voiceover") == "upload" and settings.get("voiceoverUploadKey"):
            narr = narrate_upload(conn, proj, story, settings["voiceoverUploadKey"], work, work_key(proj), log)
        elif settings.get("voiceover") == "none":
            from clips_worker.motion_studio.core.wordclock import Script, estimate_words
            sc = Script.from_json([{**l, "chapterId": str(l["chapter"])} for l in story["lines"]])
            ws = estimate_words(sc)
            narr = {"voice": {"name": "none"}, "mock": False, "none": True,
                    "chapters": [{"index": 0, "lineIds": [l["id"] for l in story["lines"]], "key": None,
                                  "durationS": (ws[-1]["e"] + 0.5) if ws else 1.0, "words": ws}]}
        else:
            narr = narrate(proj, story, work, work_key(proj), log)
        narr["chapterPauseS"] = config.NARRATION["chapterPauseMs"] / 1000
        db.update_project(conn, pid, narration=narr)
    lay = layout(plan, narr, story)
    plan["layout"] = lay
    db.update_project(conn, pid, plan=plan)
    log("layout", f"program: {lay['durationS']:.1f}s, {len(lay['scenes'])} scenes", {"frames": lay["frames"]})
    db.set_stage(conn, pid, "graphics")
    rows = db.scenes(conn, pid)
    by_index = {r["index"]: r for r in rows}
    for sc in lay["scenes"]:
        r = by_index.get(sc["index"])
        if r:
            db.update_scene(conn, r["id"], startMs=int(sc["startS"] * 1000), endMs=int(sc["endS"] * 1000), status="queued")
    for sc in lay["scenes"]:
        r = by_index.get(sc["index"])
        if r:
            db.enqueue(conn, proj["clipProjectId"], "MGD_RENDER_SEGMENT", {"motionProjectId": pid, "sceneId": r["id"]}, priority=4)


# ---------------------------------------------------------------- MGD_RENDER_SEGMENT
def _render_hash(*parts) -> str:
    h = hashlib.sha256()
    for x in parts:
        h.update(json.dumps(x, sort_keys=True, default=str).encode())
    return h.hexdigest()[:32]


def run_segment(conn, proj: dict, job: dict, p: dict) -> None:
    from clips_worker.motion_studio.core.render import render_scene, scratch_dir
    from clips_worker.motion_studio.directors.registry import get_director
    from clips_worker.motion_studio.pipeline.music_source import work_key
    from clips_worker.motion_studio.pipeline.timeline import scene_context
    from clips_worker.storage import download_object, upload_file
    agent = get_director(proj.get("director") or "documentary").load()
    pid = proj["id"]
    scene = db.get_scene(conn, p["sceneId"])
    if not scene:
        raise ValueError("scene not found")
    work = workdir(pid)
    log = _logger(conn, pid, "graphics")
    plan, story = proj["plan"], proj["story"]
    lay = plan["layout"]
    sc = next(s for s in lay["scenes"] if s["index"] == scene["index"])
    W, H = config.render_size((proj.get("settings") or {}).get("aspect", "16:9"))
    db.update_scene(conn, scene["id"], status="rendering")
    out = os.path.join(work, f"seg_{scene['index']:03d}.mp4")
    key_base = work_key(proj)
    seed = int(hashlib.sha256(pid.encode()).hexdigest()[:6], 16)
    if sc["kind"] in ("handoff", "hardcut"):
        from clips_worker.motion_studio.core.handoff import HandoffSpec, render_handoff
        h = dict(sc["handoff"])
        row_h = (scene.get("plan") or {}).get("handoff") or {}
        if row_h.get("assetId"):          # Media Library "replace" updates the scene row
            h["assetId"] = row_h["assetId"]
        asset = next((a for a in db.assets(conn, pid) if a["id"] == h["assetId"]), None)
        if not asset:
            raise ValueError("handoff asset missing")
        src = os.path.join(work, f"asset_{asset['id']}{Path(asset.get('filename') or '').suffix}")
        if not os.path.exists(src):
            download_object(asset["storageKey"], Path(src))
        pal = plan["style"]["palette"]
        hexrgb = lambda s: tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))  # noqa: E731
        spec = HandoffSpec(clip_path=src, in_s=float(h.get("inS", 0)), out_s=float(h["outS"]), surface=h.get("surface", "photo"),
                           enter_s=h.get("enterS", 1.4), exit_s=h.get("exitS", 1.2), exit_style=h.get("exitStyle", "mirror"),
                           exit_reason=h.get("exitReason", ""), cut_type="hardcut" if sc["kind"] == "hardcut" else "handoff",
                           cut_justification=h.get("cutJustification", ""), audio_mode=h.get("audioMode", "clip"),
                           bg=hexrgb(pal["bg"]), accent=hexrgb(pal["accent"]), width=W, height=H, seed=seed + scene["index"])
        rh = _render_hash("handoff-v1", spec.__dict__ | {"clip_path": asset["id"]}, W, H)
        if scene.get("renderHash") == rh and scene.get("renderKey") and not p.get("force"):
            log("cache_hit", f"scene {scene['index'] + 1}: handoff unchanged (cached)", {})
        else:
            wav = out.replace(".mp4", ".wav")
            rec = render_handoff(spec, out, wav)
            rec["segmentId"] = f"seg_{scene['index']}"
            upload_file(f"{key_base}/seg_{scene['index']:03d}_{rh[:10]}.mp4", Path(out), "video/mp4")
            upload_file(f"{key_base}/seg_{scene['index']:03d}_{rh[:10]}.wav", Path(wav), "audio/wav")
            db.update_scene(conn, scene["id"], renderKey=f"{key_base}/seg_{scene['index']:03d}_{rh[:10]}.mp4",
                            audioKey=f"{key_base}/seg_{scene['index']:03d}_{rh[:10]}.wav", renderHash=rh, handoff=rec,
                            qa={"seamScores": rec["seamScores"], "seamPass": rec["seamPass"], "decodeVerified": rec["decodeVerified"]},
                            version=scene["version"] + 1, model="trusted-handoff")
            log("handoff_rendered", f"scene {scene['index'] + 1}: {spec.surface} handoff, seams {rec['seamScores']}",
                {"seamPass": rec["seamPass"], "decodeVerified": rec["decodeVerified"]})
    else:
        assets_meta = _prepare_photos(conn, proj, work)
        ctx = scene_context(sc, lay, story, plan, assets_meta, seed)
        notes = str((scene.get("plan") or {}).get("userNotes") or "").strip()
        if notes:                          # inspector edits / director notes from the user (part of the ctx hash)
            ctx["scene"]["userNotes"] = notes[:2000]
        ctx_hash = _render_hash(ctx)
        code = None
        if scene.get("codeKey") and not p.get("regenerate") and (scene.get("qa") or {}).get("ctxHash") == ctx_hash:
            local = os.path.join(work, f"scene_{scene['index']:03d}.py")
            try:
                download_object(scene["codeKey"], Path(local))
                code = Path(local).read_text()
            except Exception:  # noqa: BLE001
                code = None
        sdir = scratch_dir(f"ms_{pid[-8:]}_{scene['index']}_")
        assets_dir = _assets_dir(work)

        def exec_log(mode, ok, kind, err, chash, model, ms):
            db.sandbox_exec(conn, pid, scene["id"], mode, ok, kind, err, chash, model, ms)
        if code is None:
            d = agent.design_scene(ctx, sdir, assets_dir, log, exec_log)
            code = d["code"]
            ck = f"{key_base}/generated/scene_{scene['index']:03d}_{d['codeHash']}.py"
            cp = os.path.join(work, f"scene_{scene['index']:03d}.py")
            Path(cp).write_text(code)
            upload_file(ck, Path(cp), "text/x-python")
            db.update_scene(conn, scene["id"], codeKey=ck, codeHash=d["codeHash"], model=d["model"], fixRounds=d["fixRounds"],
                            usedFallback=d["usedFallback"], qa={"checks": d["checks"], "verdict": d["verdict"], "ctxHash": ctx_hash})
        rh = _render_hash("scene-v1", hashlib.sha256(code.encode()).hexdigest(), ctx_hash, W, H)
        if scene.get("renderHash") == rh and scene.get("renderKey") and not p.get("force"):
            log("cache_hit", f"scene {scene['index'] + 1}: unchanged (cached)", {})
        else:
            try:
                res = render_scene(code, ctx, out, sdir, W, H, 16, None, assets_dir)
                exec_log("render", True, None, None, hashlib.sha256(code.encode()).hexdigest()[:24], scene.get("model"), res["durationMs"])
            except Exception as exc:  # noqa: BLE001 (render failure -> framework fallback, no paid retry)
                kind = getattr(exc, "kind", "sandbox_error")
                exec_log("render", False, kind, str(exc), None, scene.get("model"), None)
                log("fallback", f"scene {scene['index'] + 1}: render failed ({kind}); framework fallback", {})
                from clips_worker.motion_studio.core.fallback import FALLBACK_CODE
                code = FALLBACK_CODE
                res = render_scene(code, ctx, out, sdir, W, H, 16, None, assets_dir)
                db.update_scene(conn, scene["id"], usedFallback=True)
                rh = _render_hash("scene-v1", hashlib.sha256(code.encode()).hexdigest(), ctx_hash, W, H)
            rk = f"{key_base}/seg_{scene['index']:03d}_{rh[:10]}.mp4"
            upload_file(rk, Path(out), "video/mp4")
            still = os.path.join(work, f"still_{scene['index']:03d}.jpg")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0.0, ctx['duration'] * 0.6):.2f}", "-i", out, "-frames:v", "1",
                            "-vf", "scale=640:-2", still], check=False)
            sk = None
            if os.path.exists(still):
                sk = f"{key_base}/still_{scene['index']:03d}_{rh[:10]}.jpg"
                upload_file(sk, Path(still), "image/jpeg")
            db.update_scene(conn, scene["id"], renderKey=rk, renderHash=rh, stillKey=sk, cues=res["cues"], version=scene["version"] + 1)
            log("scene_rendered", f"scene {scene['index'] + 1} rendered ({res['frames']} frames, {res['workers']} workers, "
                f"{res['durationMs'] / 1000:.0f}s)", {"frames": res["frames"]})
        shutil.rmtree(sdir, ignore_errors=True)
    db.update_scene(conn, scene["id"], status="done", error=None)
    _maybe_assemble(conn, proj, p)


def _maybe_assemble(conn, proj: dict, p: dict) -> None:
    pid = proj["id"]
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "MotionStudioProject" WHERE id=%s FOR UPDATE', (pid,))
        cur.execute('SELECT COUNT(*) FROM "MotionStudioScene" WHERE "projectId"=%s AND status <> %s', (pid, "done"))
        remaining = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM clip_jobs WHERE \"projectId\"=%s AND type='DOC_ASSEMBLE' AND status IN ('QUEUED','RUNNING')",
                    (proj["clipProjectId"],))
        pending = cur.fetchone()[0]
    if remaining == 0 and pending == 0 and p.get("assemble", True):
        db.enqueue(conn, proj["clipProjectId"], "DOC_ASSEMBLE", {"motionProjectId": pid}, priority=4)
    else:
        conn.commit()


# ---------------------------------------------------------------- DOC_ASSEMBLE
def _fetch(key: str, local: str) -> str:
    from clips_worker.storage import download_object
    if not os.path.exists(local):
        download_object(key, Path(local))
    return local


def _normalize_segment(src: str, frames: int, W: int, H: int, fps: int, dst: str) -> None:
    """Exact frame count per segment (pad by holding the last frame, or trim). Never -shortest."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-vf",
                    f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={fps},tpad=stop_mode=clone:stop=-1,format=yuv420p",
                    "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", dst + ".tmp.mp4"], check=True)
    os.replace(dst + ".tmp.mp4", dst)


def run_assemble(conn, proj: dict, job: dict, p: dict) -> None:
    from clips_worker.motion_studio.core import audio as A
    from clips_worker.motion_studio.core import qa
    from clips_worker.motion_studio.core.credits import credits_ledger, manifest_entry
    from clips_worker.motion_studio.core.render import ffprobe_frames
    from clips_worker.motion_studio.pipeline.music_source import build_music, work_key
    from clips_worker.motion_studio.pipeline.timeline import chapter_markers, editor_extension, validate_for_export
    from clips_worker.storage import put_json, upload_file
    pid = proj["id"]
    work = workdir(pid)
    log = _logger(conn, pid, "assemble")
    db.set_stage(conn, pid, "assemble")
    plan, story, narr = proj["plan"], proj["story"], proj["narration"]
    lay = plan["layout"]
    fps = lay["fps"]
    W, H = config.render_size((proj.get("settings") or {}).get("aspect", "16:9"))
    rows = {r["index"]: r for r in db.scenes(conn, pid)}
    handoffs = {i: r["handoff"] for i, r in rows.items() if r.get("handoff")}
    errs = validate_for_export(lay, handoffs)
    if errs:
        raise ValueError("export refused: " + "; ".join(errs[:4]))
    # 1) picture
    norm = []
    for sc in lay["scenes"]:
        r = rows[sc["index"]]
        src = _fetch(r["renderKey"], os.path.join(work, f"dl_seg_{sc['index']:03d}_{(r['renderHash'] or '')[:10]}.mp4"))
        got = ffprobe_frames(src)
        dst = os.path.join(work, f"norm_{sc['index']:03d}.mp4")
        _normalize_segment(src, sc["frames"], W, H, fps, dst)
        if got != sc["frames"]:
            log("parity_fix", f"scene {sc['index'] + 1}: {got} -> {sc['frames']} frames", {})
        norm.append(dst)
    lst = os.path.join(work, "concat.txt")
    Path(lst).write_text("".join(f"file '{n}'\n" for n in norm))
    picture = os.path.join(work, "picture.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-preset", "medium",
                    "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(fps), picture + ".tmp.mp4"], check=True)
    os.replace(picture + ".tmp.mp4", picture)
    total = lay["frames"] / fps
    if ffprobe_frames(picture) != lay["frames"]:
        raise RuntimeError("picture frame parity failed")
    # 2) VO track
    vo = None
    if not narr.get("none") and lay["voSegments"]:
        ins, chains, labels = [], [], []
        local_ch = {}
        for c in narr["chapters"]:
            if c.get("key"):
                local_ch[c["index"]] = _fetch(c["key"], os.path.join(work, f"vo_ch{c['index']:02d}.mp3"))
        for k, seg in enumerate(lay["voSegments"]):
            ins += ["-i", local_ch[seg["chapter"]]]
            d = int(round(seg["progStart"] * 1000))
            chains.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim={seg['srcStart']}:{seg['srcEnd']},asetpts=PTS-STARTPTS,"
                          f"afade=t=in:d=0.03,afade=t=out:st={max(0, seg['srcEnd'] - seg['srcStart'] - 0.06):.3f}:d=0.06,adelay={d}|{d}[v{k}]")
            labels.append(f"[v{k}]")
        vo = os.path.join(work, "vo.wav")
        chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{total:.4f}[vo]")
        subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(chains), "-map", "[vo]", "-ar", "48000", vo], check=True)
    # 3) clip audio stems (handoffs)
    clips = []
    for sc in lay["scenes"]:
        r = rows[sc["index"]]
        if r.get("audioKey"):
            w = _fetch(r["audioKey"], os.path.join(work, f"dl_aud_{sc['index']:03d}_{(r['renderHash'] or '')[:10]}.wav"))
            d = int(round(sc["startS"] * 1000))
            st = os.path.join(work, f"clipstem_{sc['index']:03d}.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-af", f"adelay={d}|{d},apad,atrim=0:{total:.4f}", "-ar", "48000", "-ac", "2", st], check=True)
            clips.append(st)
    # 4) SFX from scene cues (scene-local -> program), A19 fixed against speech spans
    cues = []
    for sc in lay["scenes"]:
        for c in rows[sc["index"]].get("cues") or []:
            if 0 <= c.get("t", -1) <= sc["endS"] - sc["startS"]:
                cues.append({**c, "t": round(c["t"] + sc["startS"], 3)})
    speech = []
    for wd in lay["words"]:
        if speech and wd["s"] - speech[-1][1] < 0.25:
            speech[-1][1] = wd["e"]
        else:
            speech.append([wd["s"], wd["e"]])
    sfx = os.path.join(work, "sfx.wav")
    sfx_info = A.build_sfx(cues, total, sfx, [tuple(x) for x in speech])
    # 5) music
    user_music = None
    if plan.get("musicSource") == "user" and (proj.get("settings") or {}).get("musicUploadKey"):
        key = proj["settings"]["musicUploadKey"]
        user_music = _fetch(key, os.path.join(work, f"user_music{Path(key).suffix or '.mp3'}"))
    elif plan.get("musicSource") == "user":
        ma = next((a for a in db.assets(conn, pid) if a["kind"] == "audio" and (a.get("analysis") or {}).get("role") != "narration"), None)
        if ma:
            user_music = _fetch(ma["storageKey"], os.path.join(work, f"asset_{ma['id']}{Path(ma.get('filename') or '').suffix}"))
    music = build_music(proj, plan, story, lay, work, user_music, log)
    # 6) mix
    final_wav = os.path.join(work, "mix.wav")
    meas = A.mix(final_wav, total, vo, music.get("path"), sfx, clips)
    log("mix", f"mix: {meas.get('I')} LUFS, TP {meas.get('TP')}", meas)
    # 7) master + small export (atomic, parity)
    master = os.path.join(work, "master.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", picture, "-i", final_wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "256k", "-af", f"apad,atrim=0:{total:.4f}", "-movflags", "+faststart", master + ".tmp.mp4"], check=True)
    os.replace(master + ".tmp.mp4", master)
    small = os.path.join(work, "small.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", master, "-c:v", "libx264", "-preset", "medium", "-b:v", "6M", "-maxrate", "6M",
                    "-bufsize", "12M", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", small + ".tmp.mp4"], check=True)
    os.replace(small + ".tmp.mp4", small)
    checks = [qa.frame_parity(master, lay["frames"]), qa.frame_parity(small, lay["frames"]), *qa.black_and_freeze(master),
              qa.loudness_check(meas), qa.seam_check(list(handoffs.values()))]
    # 8) uploads: canvas (editor main source), words, exports, ledger
    kb = work_key(proj)
    version = int(proj.get("timelineVersion") or 0) + 1
    master_key, small_key = f"{kb}/export_v{version}.mp4", f"{kb}/export_v{version}_small.mp4"
    upload_file(master_key, Path(master), "video/mp4")
    upload_file(small_key, Path(small), "video/mp4")
    with conn.cursor() as cur:
        cur.execute('SELECT p."uploadId", u.key FROM clip_projects p JOIN clip_uploads u ON u.id=p."uploadId" WHERE p.id=%s',
                    (proj["clipProjectId"],))
        canvas = cur.fetchone()
    conn.commit()
    if canvas:
        upload_file(canvas[1], Path(master), "video/mp4")
        with conn.cursor() as cur:
            cur.execute('UPDATE clip_uploads SET status=\'COMPLETE\', bytes=%s, "durationMs"=%s, width=%s, height=%s WHERE id=%s',
                        (os.path.getsize(master), int(total * 1000), W, H, canvas[0]))
            cur.execute("UPDATE clip_projects SET status='READY', stage='ready', progress=100, \"rangeEndMs\"=%s, \"updatedAt\"=NOW() WHERE id=%s",
                        (int(total * 1000), proj["clipProjectId"]))
        conn.commit()
    words = [{"w": w["w"], "s": w["s"], "e": w["e"], "i": k, "spk": 0} for k, w in enumerate(lay["words"])]
    put_json(f"ws/{proj['workspaceId']}/projects/{proj['clipProjectId']}/words.json", words)
    if proj.get("clipId"):
        put_json(f"ws/{proj['workspaceId']}/projects/{proj['clipProjectId']}/clips/{proj['clipId']}/words.json", words)
    assets = db.assets(conn, pid)
    ledger = credits_ledger(title=story.get("title") or proj["title"], narration={"label": f"ElevenLabs — {narr.get('voice', {}).get('name')}"}
                            if not narr.get("none") else {}, music=music, sfx=sfx_info, sources=story.get("sources") or [],
                            data=story.get("data") or [], assets=[{"filename": a["filename"], "kind": a["kind"]} for a in assets],
                            scenes=[{"rendered": True} for _ in rows], fonts=["Oswald/Inter/JetBrains Mono (system set)"])
    lp = os.path.join(work, "credits.txt")
    Path(lp).write_text(ledger)
    upload_file(f"{kb}/credits_v{version}.txt", Path(lp), "text/plain")
    manifest = [manifest_entry(a["id"], a["kind"], a["filename"], used_in=[f"s{s['index']}" for s in lay["scenes"]
                                                                         if (s.get("handoff") or {}).get("assetId") == a["id"]]) for a in assets]
    ext = editor_extension(pid, lay, story, plan, handoffs, music, version, {i: r.get("renderHash") for i, r in rows.items()})
    edits_patch = {"markers": chapter_markers(lay, story), "motionStudio": ext}
    music_rec = {k: v for k, v in music.items() if k != "path"}
    export_info = {"version": version, "masterKey": master_key, "smallKey": small_key, "creditsKey": f"{kb}/credits_v{version}.txt",
                   "durationMs": int(total * 1000), "frames": lay["frames"], "width": W, "height": H, "manifest": manifest,
                   "editsPatch": edits_patch, "loudness": meas}
    db.update_project(conn, pid, status="review", stage="review", exportInfo=export_info, music=music_rec,
                      qa={"checks": checks, "pass": all(c["pass"] or c.get("severity") == "warn" for c in checks)},
                      timelineVersion=version, errorCode=None, errorMessage=None, errorStage=None)
    stages = (db.get_project(conn, pid) or {}).get("stages") or {}
    stages.update({"assemble": "done", "review": "running"})
    db.update_project(conn, pid, stages=stages)
    log("review", f"ready for review: {total:.1f}s, {len(lay['scenes'])} scenes", {"version": version})
