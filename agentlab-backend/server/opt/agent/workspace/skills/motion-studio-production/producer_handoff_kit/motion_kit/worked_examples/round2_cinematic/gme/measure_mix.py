"""Compare each SFX hit's momentary loudness (400 ms, EBU R128 M) with the voice's speech level."""
import json, re, subprocess, sys, numpy as np
def M(path, db=0.0):
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-af", f"volume={db}dB,ebur128=metadata=1,ametadata=print:key=lavfi.r128.M",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    ts = [float(x) for x in re.findall(r"pts_time:([\d.]+)", r)]
    ms = [float(x) for x in re.findall(r"lavfi.r128.M=(-?(?:inf|[\d.]+))", r)]
    return np.array(ts[: len(ms)]), np.array(ms)
db = float(sys.argv[1])
vt, vm = M("audio/narration.m4a"); st, sm = M("audio/sfx.wav", db)
speech = np.median(vm[vm > -35]); vmax = np.percentile(vm[vm > -35], 95)
print(f"voice speech median M {speech:.1f}  p95 {vmax:.1f}")
cues = json.load(open("sfx_cues.json"))["cues"]
worst = -99
for c in cues:
    if c["type"] in ("tick",): continue
    w = (st >= c["t"]) & (st <= c["t"] + 0.6)
    pk = sm[w].max() if w.any() else -99
    worst = max(worst, pk - speech)
    print(f"{c['t']:6.2f} {c['type']:8s} sfx M {pk:6.1f}  vs speech {pk - speech:+5.1f} dB")
print("worst over speech:", round(worst, 1))
