"""Speaker-following 9:16 crop, v2. Free/local only: ffmpeg + OpenCV YuNet + MediaPipe FaceLandmarker + Resemblyzer.
Usage: python speakercrop.py input.mp4 out_vertical.mp4   (models expected next to this script)
v2 vs v1: YuNet boxes -> landmarker on face crops (profile faces), voice-embedding tie-breaker,
look-ahead (decisions shifted earlier), shorter min shot, optional stacked split-screen when both talk."""
import sys, os, json, time, subprocess
import numpy as np, cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

HERE = os.path.dirname(os.path.abspath(__file__))
INP, OUT = sys.argv[1], sys.argv[2]
E = lambda k, d: float(os.environ.get(k, d))
OUT_W, OUT_H = 720, 1280
SAMPLE_FPS = 5.0
MIN_SEG = E('MIN_SEG', 0.8)   # drop shots shorter than this (s)
HYST = E('HYST', 0.5)         # visual score needed to switch
LEAD = E('LEAD', 0.4)         # look-ahead: move decisions this much earlier (s)
EASE = E('EASE', 0.2)         # per-frame easing of crop centre
SPLIT = int(E('SPLIT', 1))    # stacked layout when both talk
USE_VOICE = int(E('VOICE', 1))
VIS_W = E('VIS_W', 0.3)      # weight of lip-motion score when voice is on
t0 = time.time()

cap = cv2.VideoCapture(INP)
fps = cap.get(cv2.CAP_PROP_FPS); W = int(cap.get(3)); H = int(cap.get(4))
step = max(1, round(fps / SAMPLE_FPS))

# ---------- 1. YuNet boxes (handles profiles) -> FaceLandmarker on each face crop ----------
det = cv2.FaceDetectorYN.create(os.path.join(HERE, 'yunet.onnx'), '', (W, H), 0.5, 0.3, 50)
lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=os.path.join(HERE, 'face_landmarker.task')),
    running_mode=vision.RunningMode.IMAGE, num_faces=1, output_face_blendshapes=True,
    min_face_detection_confidence=0.2, min_face_presence_confidence=0.2))
T = []; mouth = [[], []]; xpos = [[], []]; ypos = [[], []]; fsize = [[], []]
pos = [W * 0.3, W * 0.7]; i = 0
while True:
    if not cap.grab(): break
    if i % step == 0:
        ok, fr = cap.retrieve(); T.append(i / fps)
        _, f = det.detect(fr); f = [] if f is None else sorted(f, key=lambda r: -r[2] * r[3])[:2]
        got = [None, None]
        for r in f:
            x, y, w, h = r[:4]; cx = x + w / 2
            k = 0 if abs(cx - pos[0]) < abs(cx - pos[1]) else 1
            if got[k] is None: got[k] = r
        for k in range(2):
            r = got[k]
            if r is None:
                for L in (mouth, xpos, ypos, fsize): L[k].append(np.nan)
                continue
            x, y, w, h = r[:4]; cx, cy = x + w / 2, y + h / 2; s = max(w, h) * 1.8
            pos[k] = 0.8 * pos[k] + 0.2 * cx
            x0, y0 = int(max(0, cx - s / 2)), int(max(0, cy - s / 2))
            crop = np.ascontiguousarray(fr[y0:int(y0 + s), x0:int(x0 + s)])
            res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
            m = np.nan
            if res.face_landmarks:
                pts = res.face_landmarks[0]; ys = [p.y for p in pts]; sz = max(ys) - min(ys)
                jaw = next(b.score for b in res.face_blendshapes[0] if b.category_name == 'jawOpen')
                m = abs(pts[13].y - pts[14].y) / max(sz, 1e-6) + 0.3 * jaw
            mouth[k].append(m); xpos[k].append(cx); ypos[k].append(cy); fsize[k].append(h)
        if pos[0] > pos[1]: pos.reverse()
    i += 1
t_detect = time.time() - t0
T = np.array(T); n = len(T); mouth = np.array(mouth); xpos = np.array(xpos); ypos = np.array(ypos); fsize = np.array(fsize)
face_rate = (100 * np.mean(~np.isnan(xpos), axis=1)).tolist()
lmk_rate = (100 * np.mean(~np.isnan(mouth), axis=1)).tolist()
print('face box L/R %.0f%%/%.0f%%  lip landmarks L/R %.0f%%/%.0f%%' % (*face_rate, *lmk_rate))

# ---------- 2. audio: RMS gate + voice embeddings ----------
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', INP, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
a = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
hop = int(16000 / SAMPLE_FPS)
rms_db = np.array([20 * np.log10(np.sqrt(np.mean(a[j*hop:(j+1)*hop]**2) + 1e-12)) for j in range(len(a)//hop)])
rms_db = np.interp(np.arange(n), np.arange(len(rms_db)), rms_db)
voiced = rms_db > np.percentile(rms_db, 30)

# ---------- 3. visual score ----------
w = max(2, int(1.0 * SAMPLE_FPS)); act = np.full((2, n), np.nan)
for k in range(2):
    for j in range(n):
        seg = mouth[k, max(0, j - w // 2): j + w // 2 + 1]; seg = seg[~np.isnan(seg)]
        if len(seg) >= 2: act[k, j] = np.std(seg)
med = np.nanmedian(act); act /= (med if med > 0 else 1)          # one shared scale for both people
diff = np.where(np.isnan(act[0]), 1.0, act[0]) - np.where(np.isnan(act[1]), 1.0, act[1])
diff[~voiced] = np.nan
win = lambda x, j, r: x[max(0, j - r): j + r + 1]
sm = np.array([np.nanmean(win(diff, j, 4)) if np.any(~np.isnan(win(diff, j, 4))) else np.nan for j in range(n)])

# voice tie-breaker: 2-cluster Resemblyzer partial embeddings, cluster->person by correlation with visual score
aud = np.zeros(n)
t_voice = time.time()
if USE_VOICE:
    from resemblyzer import VoiceEncoder
    from sklearn.cluster import KMeans
    enc = VoiceEncoder('cpu', verbose=False)
    _, parts, slices = enc.embed_utterance(a, return_partials=True, rate=4, min_coverage=0.5)
    pt = np.array([(s.start + s.stop) / 2 / 16000 for s in slices])               # partial centre times (s)
    pv = np.interp(pt, T, voiced.astype(float)) > 0.5
    if pv.sum() > 6:
        km = KMeans(2, n_init=10, random_state=0).fit(parts[pv])
        d = km.transform(parts)                                                     # distance to each centroid
        conf = (d[:, 1] - d[:, 0]) / (d.sum(1) + 1e-9)                              # >0 -> cluster 0
        c_t = np.interp(T, pt, conf)
        ok_ = voiced & ~np.isnan(sm)
        sign = np.sign(np.corrcoef(c_t[ok_], sm[ok_])[0, 1]) if ok_.sum() > 5 else 1.0  # cluster 0 = left if +
        aud = sign * c_t / (np.std(c_t) + 1e-9)                                      # +left / -right, ~unit scale
        aud[~voiced] = 0
t_voice = time.time() - t_voice

# Measured: voice clusters alone matched the pitch proxy 92-98%, lip motion of the profile face is weak.
# So voice leads (when available) and lip motion maps clusters to faces + adds a smaller vote.
aud_s = np.array([np.mean(win(aud, j, 2)) for j in range(n)])
score = (aud_s + VIS_W * np.nan_to_num(sm)) if USE_VOICE else np.nan_to_num(sm)
raw = np.full(n, -1); raw[score > HYST] = 0; raw[score < -HYST] = 1
BOTH_T = E('BOTH_T', 1.3)
both = voiced & (np.nan_to_num(act[0]) > BOTH_T) & (np.nan_to_num(act[1]) > BOTH_T)

spk = np.zeros(n, int); cur = next((int(v) for v in raw if v >= 0), 0)
for j in range(n):
    if raw[j] >= 0: cur = raw[j]
    spk[j] = cur
if SPLIT:                                   # 2 = stacked, only if both talk for >= 1.5 s
    r = int(1.5 * SAMPLE_FPS)
    for j in range(n):
        if both[j:j + r].all() and j + r <= n: spk[j:j + r] = 2
minlen = int(round(MIN_SEG * SAMPLE_FPS)); changed = True
while changed:
    changed = False; segs = []; s = 0
    for j in range(1, n + 1):
        if j == n or spk[j] != spk[s]: segs.append((s, j)); s = j
    for idx, (s, e) in enumerate(segs):
        if e - s < minlen and len(segs) > 1:
            spk[s:e] = spk[segs[idx-1][0]] if idx > 0 else spk[segs[idx+1][0]]; changed = True; break
# look-ahead: shift the decision timeline earlier by LEAD seconds
sh = int(round(LEAD * SAMPLE_FPS))
if sh: spk = np.concatenate([spk[sh:], np.repeat(spk[-1], sh)])

for A in (xpos, ypos, fsize):
    for k in range(2):
        ok_ = ~np.isnan(A[k])
        A[k] = np.interp(np.arange(n), np.where(ok_)[0], A[k][ok_]) if ok_.any() else (W * (0.3 + 0.4 * k))
target = np.array([xpos[min(s, 1), j] if s < 2 else W / 2 for j, s in enumerate(spk)])
json.dump(dict(t=T.tolist(), speaker=spk.tolist(), raw=raw.tolist(), act=np.nan_to_num(act).tolist(), aud=aud.tolist(),
               voiced=voiced.tolist(), target_x=target.tolist(), face_rate=face_rate, lmk_rate=lmk_rate), open('analysis.json', 'w'))

# ---------- 4. render ----------
cw = int(round(H * 9 / 16)) // 2 * 2
cap = cv2.VideoCapture(INP)
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUT_W}x{OUT_H}', '-r', str(fps),
                       '-i', '-', '-i', INP, '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', OUT], stdin=subprocess.PIPE)
cx = target[0]; fi = 0
def tile(fr, j, k):            # 9:8 tile (720x640 out) around person k's face
    th = int(H * 0.62); tw = int(th * 9 / 8)
    x0 = int(np.clip(xpos[k, j] - tw / 2, 0, W - tw)); y0 = int(np.clip(ypos[k, j] - th * 0.4, 0, H - th))
    return cv2.resize(fr[y0:y0 + th, x0:x0 + tw], (OUT_W, OUT_H // 2), interpolation=cv2.INTER_CUBIC)
while True:
    ok, fr = cap.read()
    if not ok: break
    j = min(n - 1, int(round(fi / fps * SAMPLE_FPS)))
    if spk[j] == 2:
        out = np.vstack([tile(fr, j, 0), tile(fr, j, 1)])
    else:
        tgt = np.interp(fi / fps, T, target); cx += EASE * (tgt - cx)
        x0 = int(np.clip(cx - cw / 2, 0, W - cw))
        out = cv2.resize(fr[:, x0:x0 + cw], (OUT_W, OUT_H), interpolation=cv2.INTER_CUBIC)
    ff.stdin.write(out.tobytes()); fi += 1
ff.stdin.close(); ff.wait()
tot = time.time() - t0; dur = fi / fps
print(f'video {dur:.1f}s | detect {t_detect:.1f}s | voice {t_voice:.1f}s | total {tot:.1f}s | {tot/dur*60:.0f}s wall per min of video')
segs = []; s = 0
for j in range(1, n + 1):
    if j == n or spk[j] != spk[s]: segs.append(f"{T[s]:5.1f}-{T[min(j,n-1)]:5.1f}s {['LEFT','RIGHT','SPLIT'][spk[s]]}"); s = j
print(' | '.join(segs))
