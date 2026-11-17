#!/usr/bin/env python3
"""Phil Blount sh04 (Python / OpenCV + FFmpeg): face-tracked 9:16 punch-in with gamma lift. Parameterized production shot
(contract transovo.editable-elements/1). Same crop/warp/LUT code as scenes/footage/render_shots.py; the face track is a stored
asset (computed once at import), so renders are deterministic and need no detector.
usage: render.py --props props.json --out out.mp4 --work dir --mode render|still|measure [--still N]"""
import json, subprocess, sys, argparse, os, numpy as np, cv2
ap = argparse.ArgumentParser(); ap.add_argument('--props'); ap.add_argument('--out'); ap.add_argument('--work'); ap.add_argument('--mode', default='render'); ap.add_argument('--still', default='')
a = ap.parse_args(); P = json.load(open(a.props)); M = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'editable-elements.json')))
E = P['resolved']['elements']['shot']; spec = M['shotSpec']; OW, OH = M['format']['width'], M['format']['height']
src = P['deps'][spec['footage']]; tr = json.load(open(P['deps'][spec['track']]))
d, W, H = tr['frames'], tr['W'], tr['H']; xs, ys = np.array(tr['xs']), np.array(tr['ys'])
z0, z1, gamma, fy, fx = E['zoomStart'], E['zoomEnd'], E['gamma'], E['framingY'], E['framingX']
issues = []
maxup = OH / (H / max(z0, z1))
if maxup > 1.6: issues.append({"severity": "warning", "code": "IMAGE_UPSCALED", "element": "shot", "message": f"source upscaled {maxup:.2f}x (> 1.6x)"})
def frame_geom(i):
    u = i / max(1, d - 1); e = u * u * (3 - 2 * u); z = z0 + (z1 - z0) * e; ch = H / z; cw = ch * 9 / 16
    cx = np.clip(xs[i] + fx * cw, cw / 2, W - cw / 2); cy = np.clip(ys[i] + ch * fy, ch / 2, H - ch / 2); s = OH / ch
    return np.array([[s, 0, OW / 2 - cx * s], [0, s, OH / 2 - cy * s]]), (cx, cy, cw, ch)
# face position on screen at the hold frame (bounds for the editor overlay)
hf = M['format']['holdFrame']; Mx, (cx, cy, cw, ch) = frame_geom(hf); s = OH / ch
face = {"x": round(float(OW / 2 + (xs[hf] - cx) * s)), "y": round(float(OH / 2 + (ys[hf] - cy) * s))}
if not (0 <= face['y'] <= OH * 0.55): issues.append({"severity": "warning", "code": "FRAMING", "element": "shot", "message": f"face centre at y={face['y']} leaves the top half reserved for the subject (type block lives below)"})
report = {"issues": issues, "frames": d, "describe": {"elements": [{"id": "shot", "bounds": {"x": 0, "y": 0, "w": OW, "h": OH, "space": "screen"}, "faceCentre": face, "maxUpscale": round(float(maxup), 2)}]}}
def lut(img): return cv2.LUT(img, (255 * ((np.arange(256) / 255.0) ** (1 / gamma))).astype(np.uint8)) if gamma and gamma != 1 else img
if a.mode == 'measure':
    json.dump(report, open(os.path.join(a.work, 'report.json'), 'w')); sys.exit(0)
dec = ['ffmpeg', '-v', 'error', '-ss', str(spec['in']), '-i', src, '-vf', 'fps=30', '-frames:v', str(d), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
raw = subprocess.run(dec, capture_output=True).stdout; fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3); assert len(fr) == d
if a.mode == 'still':
    i = int(a.still or hf); Mi, _ = frame_geom(i); cv2.imwrite(a.out, lut(cv2.warpAffine(fr[i], Mi, (OW, OH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)))
    json.dump(report, open(os.path.join(a.work, 'report.json'), 'w')); sys.exit(0)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OW}x{OH}', '-r', '30', '-i', '-', '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p', a.out], stdin=subprocess.PIPE)
for i in range(d):
    Mi, _ = frame_geom(i); p.stdin.write(lut(cv2.warpAffine(fr[i], Mi, (OW, OH), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)).tobytes())
p.stdin.close(); p.wait(); json.dump(report, open(os.path.join(a.work, 'report.json'), 'w'))
