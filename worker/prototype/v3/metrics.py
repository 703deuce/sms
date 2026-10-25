"""Score analysis.json against the pitch proxy (eval_pitch logic). usage: python metrics.py [analysis.json] (run in clip dir)"""
import json, sys, subprocess, numpy as np
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'analysis.json'))
T = np.array(d['t']); spk = np.array(d['speaker']); n = len(T); sr = 16000
a = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i','input.mp4','-ac','1','-ar',str(sr),'-af','highpass=f=70,lowpass=f=1000','-f','s16le','-'],capture_output=True).stdout, np.int16).astype(np.float32)
hop = sr // 5; f0 = []
for j in range(len(a) // hop):
    x = a[j*hop:(j+1)*hop]; x = x - x.mean(); ac = np.correlate(x, x, 'full')[len(x)-1:]; lo, hi = sr // 400, sr // 75
    k = lo + np.argmax(ac[lo:hi]); f0.append(sr / k if ac[k] > 0.35 * ac[0] else np.nan)
f0 = np.array(f0); gt = []
for j in range(n):
    w = f0[max(0, j-2): j+3]; w = w[~np.isnan(w)]
    gt.append(-1 if len(w) < 2 else (0 if np.median(w) > 165 else (1 if np.median(w) < 150 else -1)))
gt = np.array(gt); m = gt >= 0
# proxy turns: fill unknowns by holding, drop runs < 0.6 s
g = gt.copy(); cur = next((v for v in g if v >= 0), 0)
for j in range(n):
    if g[j] < 0: g[j] = cur
    cur = g[j]
def changes(s):
    return [(T[j], s[j]) for j in range(1, len(s)) if s[j] != s[j-1]]
for _ in range(3):
    ch = [0] + [j for j in range(1, n) if g[j] != g[j-1]] + [n]
    for s0, e0 in zip(ch, ch[1:]):
        if e0 - s0 < 3 and s0 > 0: g[s0:e0] = g[s0-1]
gc, cc = changes(g), changes(spk)
delays = []; used = set()
for t, s in gc:
    c = [i for i, (tc, sc) in enumerate(cc) if sc == s and -2 <= tc - t <= 3 and i not in used]
    if c: used.add(c[0]); delays.append(cc[c[0]][0] - t)
false = len(cc) - len(used)
fr = d.get('face_rate', [np.nan, np.nan])
print(f"agree {100*(gt[m]==spk[m]).mean():.0f}% | proxy turns {len(gc)} caught {len(delays)} | mean delay {np.mean(delays) if delays else float('nan'):+.2f}s | false switches {false} | face L/R {fr[0]:.0f}%/{fr[1]:.0f}%")
