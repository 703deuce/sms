"""Caption timing vs audio energy. usage (clip dir): python timingcheck.py words.json vertical_v3.words.json"""
import sys, json, subprocess, numpy as np
pcm = subprocess.run(['ffmpeg','-v','error','-i','input.mp4','-ac','1','-ar','16000','-f','s16le','-'], capture_output=True).stdout
a = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768; hop = 160
db = 20 * np.log10(np.array([np.sqrt(np.mean(a[i:i+hop]**2) + 1e-10) for i in range(0, len(a)-hop, hop)]))
thr = np.percentile(db, 30)
for f in sys.argv[1:]:
    W = json.load(open(f)); con, on = [], []
    for i, w in enumerate(W):
        s = int(w['s'] * 100); e = max(s + 1, int(w['e'] * 100))
        on.append(db[s:e].mean() > thr)
        if i and w['s'] - W[i-1]['e'] > 0.15 and s > 10: con.append(db[s:s+10].mean() - db[s-10:s].mean())
    print(f"{f:28s} words {len(W)} | highlight over voiced audio {100*np.mean(on):.0f}% | onset contrast after pauses {np.mean(con):+.1f} dB (n={len(con)})")
