# import-time step (not a render step): run the production face tracker once for shot sh04 and store the smoothed track as an
# asset, so every later render is deterministic and needs no detector. Same code path as scenes/footage/render_shots.py.
import json, subprocess, sys, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
src, s, t0, t1, model, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5], sys.argv[6]
d = round(t1 * 30) - round(t0 * 30)
W, H = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip().split(','))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(s), '-i', src, '-vf', 'fps=30', '-frames:v', str(d), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3); assert len(fr) == d
det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=model), min_detection_confidence=0.45))
xs = np.full(d, np.nan); ys = np.full(d, np.nan)
for i in range(0, d, 2):
    sm = cv2.resize(fr[i], (640, int(640 * H / W)))
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(sm[:, :, ::-1])))
    if not r.detections: continue
    b = max([b.bounding_box for b in r.detections], key=lambda b: b.width * b.height); sc = W / 640
    xs[i] = (b.origin_x + b.width / 2) * sc; ys[i] = (b.origin_y + b.height / 2) * sc
ok = ~np.isnan(xs)
if ok.sum() == 0: xs[:] = W / 2; ys[:] = H * 0.4
else: idx = np.arange(d); xs = np.interp(idx, idx[ok], xs[ok]); ys = np.interp(idx, idx[ok], ys[ok])
k = np.exp(-0.5 * (np.arange(-45, 46) / 18.0) ** 2); k /= k.sum()
xs = np.convolve(np.pad(xs, 45, mode='edge'), k, 'valid'); ys = np.convolve(np.pad(ys, 45, mode='edge'), k, 'valid')
json.dump({"frames": d, "W": W, "H": H, "xs": xs.tolist(), "ys": ys.tolist(), "detections": int(ok.sum()), "model": model.split('/')[-1]}, open(out, 'w'))
det.close(); print(json.dumps({"frames": d, "detections": int(ok.sum())}))
