"""T6.3 acceptance harness (same as T6.2): real worker export path (layout -> compose_export) on a local clip.

Usage (from worker/):  python ../specs/T6_2_patches/harness_render.py SRC.mp4 EDITS_AIMETA.json TEMPLATE TITLE CP OUT_DIR
Words: synthetic 3-words-per-0.4s track covering the whole clip so captions must appear at 1/5/10 s.
"""
import json, shutil, sys
from pathlib import Path

sys.path.insert(0, ".")
import clips_worker.edits_render as er  # noqa: E402
from clips_worker.t6_render import probe_duration_s  # noqa: E402

src, meta_path, tid, title, cp, out_dir = sys.argv[1:7]
out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
d = json.load(open(meta_path))
e = json.loads(json.dumps(d["edits"]))
dur = probe_duration_s(Path(src))
e["trim"] = {"in": 0, "out": int(dur * 1000)}
e["cutRanges"] = []
e["layout"] = {**e.get("layout", {}), "template": {"id": tid, "auto": False, "lane": "x", "reason": "harness"}}
e.setdefault("exportTemplate", {})
e["exportTemplate"]["headlineBar"] = {"enabled": title != "none", "text": "HARNESS TITLE TEST"}
if title != "none":
    e["exportTemplate"]["headlineStyle"] = {"t6Id": title}
e["captions"] = {**e.get("captions", {}), "presetId": cp, "enabled": True}
e["captions"].pop("presetConfig", None)
vocab = "this is the caption parity harness line going on and on".split()
words = [{"w": vocab[i % len(vocab)], "s": round(i * 0.4, 2), "e": round(i * 0.4 + 0.35, 2), "i": i}
         for i in range(int(dur / 0.4))]
settings = {"aiMeta": d["aiMeta"], "t6": {"templates": True, "captions": True, "titles": True}}
work = out_dir / f"work_{tid}_{title}_{cp}"; shutil.rmtree(work, ignore_errors=True); work.mkdir()
clip_src, applied, meta = er._apply_facecam_or_pip_layout(Path(src), work, e, settings, play_w=1080, play_h=1920)
ctx = {"work_dir": work, "play_w": 1080, "play_h": 1920, "length_s": dur, "settings": settings, "conn": None,
       "project_id": "p", "clip_id": "c", "clip_start_ms": 0, "clip_end_ms": int(dur * 1000), "render_id": "h",
       "stage": lambda *a, **k: None, "compose_spec": None,
       "facecam_seam_captions": bool(meta.get("seam_captions")), "facecam_stack_split": meta.get("stack_split"),
       "facecam_position": meta.get("facecam_position"), "per_clip_layout_applied": applied,
       "t6_spec": meta.get("t6_spec")}
final = out_dir / f"{tid}_{title}_{cp}.mp4"
try:
    er.compose_export(clip_src, words, final, e, ctx)
except ModuleNotFoundError:
    pass  # chat overlay needs storage deps; output already written before that stage
json.dump(meta.get("t6_spec"), open(out_dir / f"{tid}_spec.json", "w"))
print("OUT", final, final.exists())
