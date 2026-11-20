#!/usr/bin/env python3
"""face_frame.py — faces placed by detection (SKILL.md Stage 4c step 3).

Detects faces across a clip or image (sampled at shot changes and through each shot), and returns the crop / scale /
position that puts the face centred in a given box: eye line on the upper third, nothing cropped at the forehead or
chin, one steady crop per shot (or a smoothed path with --follow). JSON out. Reports where no face is found.

  python3 face_frame.py SRC --box 640x800 [--fill medium|close|wide|0.33] [--out framing.json]
                        [--every 1.0] [--face largest|left|right|center] [--follow] [--expect 1]
                        [--emit-crop cropped.jpg]        # images: write the framed crop at box size (layer-scene image layers)
  python3 face_frame.py check IMG [--json]               # measure faces in an already-framed box image (what the lint does)
  python3 face_frame.py --serve                          # lint worker: JSON lines on stdin/stdout (base64 PNG in, faces out)

Detector: OpenCV FaceDetectorYN with YuNet 2023mar (models/face_detection_yunet_2023mar.onnx, sha256 in models/SHA256SUMS),
5 landmarks per face (eyes, nose, mouth corners). CPU only, no network.
Exit codes: 0 ok, 1 a face expected but not found / cannot be centred, 2 usage or IO error.
"""
import sys, os, json, math, argparse, base64
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, 'models', 'face_detection_yunet_2023mar.onnx')
FILL = {'close': 0.45, 'medium': 0.33, 'wide': 0.2}
# placement rules (shared with scene_lint.mjs)
EYE_LINE = 1 / 3          # eyes on the upper third of the box
TOL_X = 0.08              # face centre within ±8% of box width of the centre
TOL_EYE = 0.08            # eye line within ±8% of box height of the upper third
FOREHEAD = 0.15           # keep >= 0.15 x face-height above the detected face box (forehead / hair start)
CHIN = 0.05               # keep >= 0.05 x face-height below it (chin)
MAX_FILL = 0.6            # beyond this the forehead/chin rule cannot hold with eyes on the third
MAX_UPSCALE = 1.5         # skill: no visibly soft upscales (> ~1.5x source pixels)

_det = None
def detector():
    global _det
    if _det is None:
        if not os.path.exists(MODEL): raise SystemExit(f'model missing: {MODEL}')
        _det = cv2.FaceDetectorYN.create(MODEL, '', (320, 320), 0.6, 0.3, 50)
    return _det

def detect(img, max_side=960):
    """-> list of faces in image px: {box:[x,y,w,h], eyes:[[x,y],[x,y]], eyeMid:[x,y], nose:[x,y], mouth:[x,y], score}"""
    h, w = img.shape[:2]; k = min(1.0, max_side / max(w, h))
    small = cv2.resize(img, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA) if k < 1 else img
    d = detector(); d.setInputSize((small.shape[1], small.shape[0]))
    _, faces = d.detect(small)
    out = []
    for f in (faces if faces is not None else []):
        v = [float(x) / k for x in f[:14]]
        x, y, fw, fh = v[0:4]
        re, le = [v[4], v[5]], [v[6], v[7]]
        out.append({'box': [x, y, fw, fh], 'eyes': [re, le], 'eyeMid': [(re[0] + le[0]) / 2, (re[1] + le[1]) / 2],
                    'nose': [v[8], v[9]], 'mouth': [(v[10] + v[12]) / 2, (v[11] + v[13]) / 2], 'score': round(float(f[14]), 3)})
    out.sort(key=lambda q: -q['box'][2] * q['box'][3])
    return out

def placement(face, W, H):
    """How a face sits in a W x H box (all fractions of the box)."""
    x, y, fw, fh = face['box']; ex, ey = face['eyeMid']
    cx = (x + fw / 2)
    # horizontal centre: the eye midpoint (robust to 3/4 turns) averaged with the box centre
    hx = (ex + cx) / 2
    return {'centerX': round(hx / W, 4), 'eyeLine': round(ey / H, 4), 'fill': round(fh / H, 4),
            'foreheadRoom': round((y - FOREHEAD * fh) / H, 4), 'chinRoom': round((H - (y + fh + CHIN * fh)) / H, 4)}

def verdict(p, tol_x=TOL_X, tol_eye=TOL_EYE):
    issues = []
    if abs(p['centerX'] - 0.5) > tol_x: issues.append(f"face off-centre horizontally: centre at {p['centerX']:.2f} of the box width (want 0.50 ±{tol_x:.2f})")
    if abs(p['eyeLine'] - EYE_LINE) > tol_eye: issues.append(f"eye line at {p['eyeLine']:.2f} of the box height (want {EYE_LINE:.2f} ±{tol_eye:.2f})")
    if p['foreheadRoom'] < 0: issues.append('forehead cropped')
    if p['chinRoom'] < 0: issues.append('chin cropped')
    return issues

def pick(faces, how, prev=None):
    if not faces: return None
    if prev is not None:   # track: nearest to the previous primary
        return min(faces, key=lambda f: math.dist(f['eyeMid'], prev['eyeMid']) / max(1, prev['box'][3]) - 0.001 * f['box'][3])
    if how == 'left': return min(faces[:4], key=lambda f: f['box'][0])
    if how == 'right': return max(faces[:4], key=lambda f: f['box'][0])
    if how == 'center': return faces[0]
    return faces[0]

def crop_for(face, sw, sh, bw, bh, fill):
    """Crop rect (source px, box aspect) that puts this face centred with eyes on the upper third."""
    A = bw / bh; x, y, fw, fh = face['box']; ex, ey = face['eyeMid']
    hx = (ex + x + fw / 2) / 2
    ch = fh / fill
    ch = max(ch, 3 * (ey - (y - FOREHEAD * fh)), 1.5 * ((y + fh + CHIN * fh) - ey))   # forehead/chin room
    ch = min(ch, sh, sw / A)
    cw = ch * A
    cx, cy = hx - cw / 2, ey - ch * EYE_LINE
    rx, ry = min(max(cx, 0), sw - cw), min(max(cy, 0), sh - ch)
    crop = {'x': rx, 'y': ry, 'w': cw, 'h': ch}
    # if the frame edge pushed the face off-centre, zoom in (smaller crop) until centred, within fill/upscale limits
    for _ in range(40):
        p = placement({'box': [x - crop['x'], y - crop['y'], fw, fh], 'eyeMid': [ex - crop['x'], ey - crop['y']]}, crop['w'], crop['h'])
        if not verdict(p): break
        nh = crop['h'] * 0.95
        if fh / nh > MAX_FILL or bw / (nh * A) > MAX_UPSCALE * 1.0001 and bw / crop['w'] <= MAX_UPSCALE: break
        nw = nh * A; cx, cy = hx - nw / 2, ey - nh * EYE_LINE
        crop = {'x': min(max(cx, 0), sw - nw), 'y': min(max(cy, 0), sh - nh), 'w': nw, 'h': nh}
    return crop

def rel(face, crop):
    return {'box': [face['box'][0] - crop['x'], face['box'][1] - crop['y'], face['box'][2], face['box'][3]],
            'eyeMid': [face['eyeMid'][0] - crop['x'], face['eyeMid'][1] - crop['y']]}

def med_face(fs):
    a = np.array([[*f['box'], *f['eyeMid']] for f in fs]); m = np.median(a, axis=0)
    return {'box': m[:4].tolist(), 'eyeMid': m[4:6].tolist()}

def css(crop, bw, bh, sw, sh):
    k = bw / crop['w']
    return {'scale': round(k, 5), 'width': round(sw * k, 2), 'height': round(sh * k, 2), 'left': round(-crop['x'] * k, 2), 'top': round(-crop['y'] * k, 2),
            'objectPosition': f"{round(-crop['x'] * k, 2)}px {round(-crop['y'] * k, 2)}px"}

def r2(d): return {k: round(v, 2) for k, v in d.items()}

# ---------------- video helpers ----------------
def shots_of(cap, fps, n, t_start=0.0, t_end=None, hist_cut=0.30, mad_cut=28.0, rate=10.0):
    """Shot boundaries (s) from colour-histogram jumps OR large mean-luma change, at ~10 Hz. Cuts closer than 0.3 s merge."""
    stride = max(1, int(round(fps / rate))); prev = None; cuts = [t_start]; i = 0
    if t_start > 0: cap.set(cv2.CAP_PROP_POS_MSEC, t_start * 1000.0); i = int(round(t_start * fps))
    while True:
        if t_end is not None and i / fps >= t_end: break
        ok = cap.grab()
        if not ok: break
        if i % stride == 0:
            ok, fr = cap.retrieve()
            if not ok: break
            s = cv2.resize(fr, (64, 36), interpolation=cv2.INTER_AREA); hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV)
            h = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256]); cv2.normalize(h, h); g = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY).astype(np.float32)
            if prev is not None:
                d = cv2.compareHist(prev[0], h, cv2.HISTCMP_BHATTACHARYYA); mad = float(np.abs(g - prev[1]).mean())
                if (d > hist_cut or mad > mad_cut) and i / fps - cuts[-1] > 0.3: cuts.append(i / fps)
            prev = (h, g)
        i += 1
    dur = i / fps if i else n / fps
    return cuts, dur

def frame_at(cap, t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0); ok, fr = cap.read(); return fr if ok else None

def analyse(src, bw, bh, fill, every, how, follow, expect, t_start=0.0, t_end=None):
    ext = os.path.splitext(src)[1].lower(); res = {'schema': 'ms.face_frame/1', 'box': {'w': bw, 'h': bh}, 'fill': fill, 'rules':
           {'eyeLine': EYE_LINE, 'tolX': TOL_X, 'tolEye': TOL_EYE, 'forehead': FOREHEAD, 'chin': CHIN, 'maxUpscale': MAX_UPSCALE}, 'warnings': [], 'noFace': []}
    if expect is not None: res['expectFaces'] = expect
    if ext in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
        img = cv2.imread(src)
        if img is None: raise SystemExit(f'cannot read {src}')
        sh, sw = img.shape[:2]; res['source'] = {'path': src, 'type': 'image', 'w': sw, 'h': sh}
        segs = [(0.0, 1e9, [(0.0, img)])]
    else:
        cap = cv2.VideoCapture(src)
        if not cap.isOpened(): raise SystemExit(f'cannot open {src}')
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0; n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        sw, sh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cuts, dur = shots_of(cap, fps, n, t_start, t_end); cap.release(); cap = cv2.VideoCapture(src)
        res['source'] = {'path': src, 'type': 'video', 'w': sw, 'h': sh, 'fps': round(fps, 3), 'duration': round(dur, 3), 'start': t_start}
        segs = []
        bounds = cuts + [dur]
        for a, b in zip(bounds[:-1], bounds[1:]):
            if b - a < 0.05: continue
            ts = {round(min(b - 0.05, a + 0.15), 3), round((a + b) / 2, 3), round(max(a + 0.05, b - 0.15), 3)}
            t = a + every
            while t < b - 0.1: ts.add(round(t, 3)); t += every
            segs.append((a, b, [(t, frame_at(cap, t)) for t in sorted(ts)]))
        cap.release()
    shots = []; ok_all = True
    for a, b, frames in segs:
        found = []; miss = []; tracks = []
        for t, fr in frames:
            if fr is None: miss.append(t); continue
            fs = detect(fr)
            if not fs: miss.append(t); continue
            for f in fs[:6]:   # cluster into tracks by eye position (in face heights)
                best = None
                for tr in tracks:
                    d = math.dist(f['eyeMid'], tr['last']['eyeMid']) / max(1.0, tr['last']['box'][3])
                    if d < 1.2 and (best is None or d < best[0]): best = (d, tr)
                if best: best[1]['items'].append((t, f, len(fs))); best[1]['last'] = f
                else: tracks.append({'items': [(t, f, len(fs))], 'last': f})
        if tracks:
            score = lambda tr: (len(tr['items']), float(np.median([f['box'][2] * f['box'][3] for _, f, _ in tr['items']])))
            if how == 'left': tr = min((x for x in tracks if len(x['items']) >= max(1, max(len(y['items']) for y in tracks) // 2)), key=lambda x: np.median([f['box'][0] for _, f, _ in x['items']]))
            elif how == 'right': tr = max((x for x in tracks if len(x['items']) >= max(1, max(len(y['items']) for y in tracks) // 2)), key=lambda x: np.median([f['box'][0] for _, f, _ in x['items']]))
            else: tr = max(tracks, key=lambda x: (x['items'] and len(x['items']) * float(np.median([f['box'][2] * f['box'][3] for _, f, _ in x['items']]))))
            found = tr['items']
            seen_t = {t for t, _, _ in found}; miss += [t for t, fr in frames if fr is not None and t not in seen_t and t not in miss]   # primary absent
        shot = {'t0': round(a, 3), 't1': (round(b, 3) if b < 1e8 else None), 'samples': len(frames), 'facesFound': len(found)}
        if miss: res['noFace'] += [round(t, 3) for t in miss]
        if not found:
            shot['warnings'] = ['no face found in this shot: look at the frame and frame it by hand']
            if expect: ok_all = False
            shots.append(shot); continue
        m = med_face([f for _, f, _ in found])
        spread = float(np.max([math.dist(f['eyeMid'], m['eyeMid']) for _, f, _ in found])) / max(1.0, m['box'][3])
        crop = crop_for(m, sw, sh, bw, bh, fill)
        p = placement(rel(m, crop), crop['w'], crop['h']); issues = verdict(p)
        up = bw / crop['w']
        shot.update({'crop': r2(crop), 'css': css(crop, bw, bh, sw, sh), 'ffmpeg': f"crop={int(round(crop['w']))}:{int(round(crop['h']))}:{int(round(crop['x']))}:{int(round(crop['y']))},scale={bw}:{bh}",
                     'face': {'box': [round(v, 1) for v in m['box']], 'eyeMid': [round(v, 1) for v in m['eyeMid']], 'count': max(c for *_, c in found)},
                     'placed': p, 'upscale': round(up, 3)})
        w = []
        if issues: w.append('cannot centre inside the source frame: ' + '; '.join(issues) + ' (use a wider source, another box shape, or frame by hand)'); ok_all = False
        if up > MAX_UPSCALE: w.append(f'upscale {up:.2f}x > {MAX_UPSCALE}x: will look soft; make the box smaller in the world or use a higher-res source')
        if max(c for *_, c in found) > 1: w.append('more than one face in the shot: the primary (--face) is centred; consider one box per face')
        if spread > 0.35:
            if follow:
                keys = []; last = None
                for t, f, _ in found:
                    c = crop_for(f, sw, sh, bw, bh, fill)
                    if last: c = {k: last[k] * 0.6 + c[k] * 0.4 for k in c}   # smooth
                    last = c; keys.append({'t': round(t, 3), 'crop': r2(c), 'css': css(c, bw, bh, sw, sh)})
                shot['keys'] = keys
            else: w.append(f'subject moves {spread:.2f} face-heights in this shot: crop is the median position; pass --follow for a smoothed path')
        if w: shot['warnings'] = w
        shots.append(shot)
    if expect and res['noFace']: res['warnings'].append(f"no face at t={res['noFace']}")
    res['shots'] = shots; res['ok'] = ok_all
    return res

def group_face(fs):
    x0 = min(f['box'][0] for f in fs); y0 = min(f['box'][1] for f in fs); x1 = max(f['box'][0] + f['box'][2] for f in fs); y1 = max(f['box'][1] + f['box'][3] for f in fs)
    fh = float(np.median([f['box'][3] for f in fs]))
    return {'box': [x0, y0, x1 - x0, max(y1 - y0, fh)], 'eyeMid': [float(np.mean([f['eyeMid'][0] for f in fs])), float(np.mean([f['eyeMid'][1] for f in fs]))]}

def serve():
    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        try:
            q = json.loads(line); buf = np.frombuffer(base64.b64decode(q['png']), np.uint8); img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
            H, W = img.shape[:2]; fs = detect(img)
            out = [{'placed': placement(f, W, H), 'score': f['score'], 'box': [round(v, 1) for v in f['box']]} for f in fs]
            for o in out: o['issues'] = verdict(o['placed'], q.get('tolX', TOL_X), q.get('tolEye', TOL_EYE))
            res = {'id': q.get('id'), 'w': W, 'h': H, 'faces': out}
            n = int(q.get('n', 1))
            if n >= 2 and len(fs) >= 2:   # a planned group (two-shot): centre the group, eyes of the group on the third
                g = group_face(fs[:n]); res['group'] = {'placed': placement(g, W, H)}; res['group']['issues'] = verdict(res['group']['placed'], q.get('tolX', TOL_X), q.get('tolEye', TOL_EYE))
            sys.stdout.write(json.dumps(res) + '\n')
        except Exception as e:
            sys.stdout.write(json.dumps({'id': (q or {}).get('id') if 'q' in dir() else None, 'error': str(e)[:200]}) + '\n')
        sys.stdout.flush()

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--serve': return serve()
    if len(sys.argv) > 1 and sys.argv[1] == 'check':
        img = cv2.imread(sys.argv[2]); H, W = img.shape[:2]; fs = detect(img)
        out = [{'placed': placement(f, W, H), 'issues': verdict(placement(f, W, H)), 'box': [round(v, 1) for v in f['box']]} for f in fs]
        print(json.dumps({'w': W, 'h': H, 'faces': out}, indent=1)); return 0 if out and not out[0]['issues'] else 1
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src'); ap.add_argument('--box', required=True, help='WxH of the on-screen box in output px')
    ap.add_argument('--fill', default='medium', help='face height / box height: close|medium|wide or a number (max 0.6)')
    ap.add_argument('--every', type=float, default=1.0, help='extra samples inside long shots (s)')
    ap.add_argument('--face', default='largest', choices=['largest', 'left', 'right', 'center'])
    ap.add_argument('--follow', action='store_true'); ap.add_argument('--expect', type=int, default=1, help='faces expected (0 = none required)')
    ap.add_argument('--out'); ap.add_argument('--emit-crop')
    ap.add_argument('--start', type=float, default=0.0, help='only the part of the clip the film uses (s)'); ap.add_argument('--end', type=float)
    a = ap.parse_args()
    try: bw, bh = [int(v) for v in a.box.lower().split('x')]
    except Exception: print('bad --box, want WxH', file=sys.stderr); return 2
    fill = FILL.get(a.fill) or float(a.fill); fill = min(fill, MAX_FILL)
    res = analyse(a.src, bw, bh, fill, a.every, a.face, a.follow, a.expect or None, a.start, a.end)
    if a.emit_crop and res['source']['type'] == 'image' and res['shots'] and res['shots'][0].get('crop'):
        c = res['shots'][0]['crop']; img = cv2.imread(a.src)
        x0, y0 = int(round(c['x'])), int(round(c['y'])); x1, y1 = int(round(c['x'] + c['w'])), int(round(c['y'] + c['h']))
        out = cv2.resize(img[y0:y1, x0:x1], (bw, bh), interpolation=cv2.INTER_AREA if (x1 - x0) >= bw else cv2.INTER_CUBIC)
        cv2.imwrite(a.emit_crop, out, [cv2.IMWRITE_JPEG_QUALITY, 92]); res['emitted'] = a.emit_crop
    s = json.dumps(res, indent=1)
    if a.out: open(a.out, 'w').write(s)
    print(s if not a.out else json.dumps({'ok': res['ok'], 'shots': len(res['shots']), 'noFace': res['noFace'][:10], 'out': a.out}))
    return 0 if res['ok'] else 1

if __name__ == '__main__':
    sys.exit(main())
