"""G2 face analysis + grouping (ST-ING / G2), reusing the clipper's vision stack: YuNet detection (t6_cv / blur_regions)
and SFace re-ID embeddings (reframe_core.FaceEmbedder, OpenCV Zoo, Apache-2.0). Local CPU only, no paid call.

detect(path, kind) -> per-asset faces [{box:[x,y,w,h] (0..1), score, t (video seconds|None), emb:[128]}]
group(assets)      -> stable project people P1..Pn across photos and footage (cosine >= SFACE_COSINE)."""
from __future__ import annotations

import os

import numpy as np

SFACE_COSINE = 0.363          # OpenCV Zoo SFace same-identity cosine threshold
MIN_SCORE = 0.7
MIN_FACE = 0.025              # face width as a fraction of the frame width
MAX_FACES = 12
DET_W = 960


def _models() -> tuple[str, str] | None:
    from clips_worker.reframe_models import SFACE_LEGACY_ONNX, SFACE_ONNX, YUNET_ONNX, resolve_onnx
    d = os.environ.get("SPEAKERCROP_DIR", "/app/v3")
    y, s = resolve_onnx(d, YUNET_ONNX), resolve_onnx(d, SFACE_ONNX, SFACE_LEGACY_ONNX)
    return (y, s) if os.path.isfile(y) and os.path.isfile(s) else None


def _frames(path: str, kind: str, n: int = 10):
    import cv2
    if kind == "image":
        im = cv2.imread(path, cv2.IMREAD_COLOR)
        if im is not None:
            yield None, im
        return
    cap = cv2.VideoCapture(path)
    try:
        nf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0) or 30.0
        if nf <= 0:
            return
        for fi in np.linspace(0.03 * nf, 0.97 * nf, max(1, min(n, nf))).astype(int):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
            ok, fr = cap.read()
            if ok and fr is not None:
                yield round(fi / fps, 3), fr
    finally:
        cap.release()


def detect(path: str, kind: str) -> dict:
    """Never raises: {status: done|unavailable|error, items:[...]}."""
    if kind not in ("image", "video"):
        return {"status": "skipped", "items": []}
    try:
        import cv2
        m = _models()
        if m is None:
            return {"status": "unavailable", "items": [], "note": "face models not installed"}
        from clips_worker.reframe_core import FaceEmbedder
        emb = FaceEmbedder(m[1])
        det = None
        items: list[dict] = []
        for t, fr in _frames(path, kind):
            h, w = fr.shape[:2]
            sc = min(1.0, DET_W / max(w, 1))
            sm = cv2.resize(fr, (max(2, int(w * sc)), max(2, int(h * sc))), interpolation=cv2.INTER_AREA) if sc < 1 else fr
            sh, sw = sm.shape[:2]
            if det is None:
                det = cv2.FaceDetectorYN_create(m[0], "", (sw, sh), MIN_SCORE, 0.3, 50)
            det.setInputSize((sw, sh))
            _, found = det.detect(sm)
            for r in ([] if found is None else found):
                if float(r[14]) < MIN_SCORE or float(r[2]) / sw < MIN_FACE:
                    continue
                v = emb.embed(sm, r)
                items.append({"box": [round(float(r[0]) / sw, 4), round(float(r[1]) / sh, 4), round(float(r[2]) / sw, 4),
                                      round(float(r[3]) / sh, 4)],
                              "score": round(float(r[14]), 3), "t": t, "emb": [round(float(x), 4) for x in v]})
        items.sort(key=lambda f: -(f["box"][2] * f["box"][3] * f["score"]))
        return {"status": "done", "items": _dedupe(items)[:MAX_FACES]}
    except Exception as exc:  # noqa: BLE001 (analysis is best effort; never blocks the plan)
        return {"status": "error", "items": [], "error": type(exc).__name__}


def _cos(a, b) -> float:
    a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
    return float(a @ b / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9))


def _dedupe(items: list[dict]) -> list[dict]:
    """Within one video, the same person across samples collapses to their best face (+ count of sightings)."""
    out: list[dict] = []
    for f in items:
        hit = next((o for o in out if _cos(o["emb"], f["emb"]) >= SFACE_COSINE), None)
        if hit is None:
            out.append({**f, "sightings": 1})
        else:
            hit["sightings"] += 1
    return out


def group(assets: list[dict]) -> tuple[dict[str, list[dict]], list[dict]]:
    """assets: [{id, faces:[...]}] -> ({assetId: faces with 'person'}, people [{id, assetIds, count, sample}])."""
    people: list[dict] = []
    out: dict[str, list[dict]] = {}
    flat = [(a["id"], f) for a in assets for f in (a.get("faces") or []) if f.get("emb")]
    flat.sort(key=lambda af: -(af[1]["box"][2] * af[1]["box"][3] * af[1]["score"]))
    for aid, f in flat:
        best, bs = None, SFACE_COSINE
        for p in people:
            s = _cos(p["centroid"], f["emb"])
            if s >= bs:
                best, bs = p, s
        if best is None:
            best = {"id": f"P{len(people) + 1}", "centroid": np.asarray(f["emb"], np.float32), "n": 0, "assetIds": [],
                    "sample": {"assetId": aid, "box": f["box"], "t": f.get("t")}}
            people.append(best)
        best["centroid"] = (best["centroid"] * best["n"] + np.asarray(f["emb"], np.float32)) / (best["n"] + 1)
        best["n"] += 1
        if aid not in best["assetIds"]:
            best["assetIds"].append(aid)
        out.setdefault(aid, []).append({**f, "person": best["id"]})
    summary = [{"id": p["id"], "assetIds": p["assetIds"], "count": p["n"], "sample": p["sample"]} for p in people]
    return out, summary


def relabel(analysis: dict, faces: list[dict]) -> dict:
    an = dict(analysis)
    an["faces"] = faces
    an["faceStatus"] = analysis.get("faceStatus", "done")
    an["people"] = sorted({f["person"] for f in faces if f.get("person")})
    return an
