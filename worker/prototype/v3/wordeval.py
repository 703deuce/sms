"""Per-word voice label vs pitch proxy. usage (in clip dir): python wordeval.py [words_spk.json]"""
import json, sys, subprocess, numpy as np
W = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'words_spk.json')); sr = 16000
a = np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i','input.mp4','-ac','1','-ar',str(sr),'-af','highpass=f=70,lowpass=f=1000','-f','s16le','-'],capture_output=True).stdout, np.int16).astype(np.float32)
def f0(x):
    x = x - x.mean(); ac = np.correlate(x, x, 'full')[len(x)-1:]; lo, hi = sr // 400, sr // 75
    k = lo + np.argmax(ac[lo:hi]); return sr / k if ac[k] > 0.35 * ac[0] else np.nan
ok = {'raw': [], 'spk': []}; line = []
for w in W:
    seg = a[int(w['s']*sr):int(w['e']*sr)]; fs = [f0(seg[i:i+800]) for i in range(0, len(seg)-799, 400)]
    fs = [f for f in fs if f == f]; g = -1 if len(fs) < 2 else (0 if np.median(fs) > 165 else (1 if np.median(fs) < 150 else -1))
    if g >= 0: ok['raw'].append(w['raw'] == g); ok['spk'].append(w['spk'] == g)
    line.append(f"{w['w']}[{'LR?'[g]}{'LR'[w['raw']]}{'LR'[w['spk']]}]")
print(f"words with pitch gt {len(ok['raw'])}/{len(W)} | raw voice acc {100*np.mean(ok['raw']):.0f}% | smoothed {100*np.mean(ok['spk']):.0f}%")
if len(sys.argv) > 2: print(' '.join(line))
