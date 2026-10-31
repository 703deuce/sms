"""T6.3 guard: NON-template export (legacy layout modes) must be byte-for-byte/PSNR-identical
between 2472fba and the patched tree. usage (from worker/): python3 harness_regress.py SRC META MODE OUT.mp4"""
import json, shutil, sys
from pathlib import Path

sys.path.insert(0, ".")
import clips_worker.edits_render as er  # noqa: E402
from clips_worker.t6_render import probe_duration_s  # noqa: E402

src, meta_path, mode, out = sys.argv[1:5]
out = Path(out); out.parent.mkdir(parents=True, exist_ok=True)
d = json.load(open(meta_path))
e = json.loads(json.dumps(d["edits"]))
dur = probe_duration_s(Path(src))
e["trim"] = {"in": 0, "out": int(dur * 1000)}
e["cutRanges"] = []
e["layout"] = {k: v for k, v in e.get("layout", {}).items() if k != "template"}
e["layout"]["mode"] = mode
e.setdefault("exportTemplate", {})
e["exportTemplate"]["headlineBar"] = {"enabled": True, "text": "REGRESSION TITLE"}
e["captions"] = {**e.get("captions", {}), "enabled": True}
words = [{"w": "word", "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2), "i": i} for i in range(int(dur / 0.4))]
settings = {"aiMeta": d["aiMeta"]}
work = out.parent / f"work_{out.stem}"; shutil.rmtree(work, ignore_errors=True); work.mkdir()
clip_src, applied, meta = er._apply_facecam_or_pip_layout(Path(src), work, e, settings, play_w=1080, play_h=1920)
ctx = {"work_dir": work, "play_w": 1080, "play_h": 1920, "length_s": dur, "settings": settings, "conn": None,
       "project_id": "p", "clip_id": "c", "clip_start_ms": 0, "clip_end_ms": int(dur * 1000), "render_id": "h",
       "stage": lambda *a, **k: None, "compose_spec": None,
       "facecam_seam_captions": bool(meta.get("seam_captions")), "facecam_stack_split": meta.get("stack_split"),
       "facecam_position": meta.get("facecam_position"), "per_clip_layout_applied": applied,
       "t6_spec": meta.get("t6_spec")}
try:
    er.compose_export(clip_src, words, out, e, ctx)
except ModuleNotFoundError:
    pass
print("OUT", out, out.exists(), "t6_spec", bool(meta.get("t6_spec")))
