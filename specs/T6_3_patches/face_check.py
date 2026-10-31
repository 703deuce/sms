"""T6.3 acceptance: YuNet face check on rendered face/person panels.

usage: SPEAKERCROP_DIR=... python3 face_check.py OUT_DIR EVIDENCE_DIR
For every rendered template whose registry panel src is a face/person source, grab full-res
frames at 1/5/10 s, crop the VISIBLE part of the panel (below the 384px title bar when the
headline is on), run YuNet, and require a face in >=2/3 frames (clip A). Clip B (crowd, no
persistent face) must render person templates as the whole frame (contain_blur).
"""
import json, os, subprocess, sys
from pathlib import Path
import cv2, numpy as np

sys.path.insert(0, str(Path.cwd()))
from clips_worker.t6_registry import TEMPLATES  # noqa: E402
from clips_worker.t6_cv import _yunet_path  # noqa: E402

FACE_SRCS = {"face_tight", "active_speaker", "facecam_box"}
out, ev = Path(sys.argv[1]), Path(sys.argv[2])
ev.mkdir(parents=True, exist_ok=True)
det = cv2.FaceDetectorYN.create(str(_yunet_path()), "", (320, 320), 0.6)


def faces(img):
    h, w = img.shape[:2]
    s = 640 / max(w, h) if max(w, h) > 640 else 1.0
    im = cv2.resize(img, (int(w * s), int(h * s))) if s != 1.0 else img
    det.setInputSize((im.shape[1], im.shape[0]))
    _, f = det.detect(im)
    return [] if f is None else [(x / s, y / s, fw / s, fh / s, sc) for x, y, fw, fh, *_, sc in f]


def frame(mp4, t):
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(mp4), "-frames:v", "1", "-f", "image2pipe",
                        "-vcodec", "png", "-"], capture_output=True).stdout
    return cv2.imdecode(np.frombuffer(p, np.uint8), cv2.IMREAD_COLOR)


rows, crops = [], []
for clip in ("A", "B"):
    for tid, t in TEMPLATES.items():
        idx = [i for i, p in enumerate(t["panels"]) if p["src"] in FACE_SRCS or p["src"].startswith("person:")]
        if not idx:
            continue
        mp4s = sorted((out / clip).glob(f"{tid}_white_on_black_*.mp4"))
        spec_p = out / clip / f"{tid}_spec.json"
        if not mp4s or not spec_p.is_file():
            continue
        spec = json.loads(spec_p.read_text())
        title_bottom = 0
        if spec.get("titleRect"):
            title_bottom = spec["titleRect"]["y"] + spec["titleRect"]["h"]
        else:
            title_bottom = 384  # fallback export bar (headline on in the A/B fixtures)
        for i in idx:
            pan = spec["panels"][i]
            d = pan["dest"]
            y0 = max(d["y"], title_bottom if d["y"] < title_bottom else d["y"])
            hits = 0
            for ts in (1, 5, 10):
                img = frame(mp4s[0], ts)
                c = img[y0:d["y"] + d["h"], d["x"]:d["x"] + d["w"]]
                f = faces(c)
                if f:
                    hits += 1
                if ts == 5:
                    vis = c.copy()
                    for x, y, w, h, sc in f:
                        cv2.rectangle(vis, (int(x), int(y)), (int(x + w), int(y + h)), (0, 255, 0), 3)
                    name = ev / f"face_{clip}_{tid}_p{i}.png"
                    cv2.imwrite(str(name), vis)
                    crops.append(name)
            full = pan["src"]["w"] >= 0.999 and pan["src"]["h"] >= 0.999
            rows.append({"clip": clip, "tid": tid, "panel": i, "src": t["panels"][i]["src"], "fit": pan["fit"],
                         "whole_frame": full, "face_frames": f"{hits}/3", "src_box": pan["src"]})
for r in rows:
    print(json.dumps(r))
(ev / "face_check.json").write_text(json.dumps(rows, indent=1))
