"""Synthesised tension bed for the GME film (custom, numpy only, nothing to license).
Dark E-minor drone; a 96 bpm hat pulse enters with the Reddit beat, a kick joins at the buy rush and
builds into $483; everything cuts at the Robinhood "off" (crash), then a sparse pad carries the hearing
and swells into "I like the stock", resolving to an open E5 chord that rings out under the final hold."""
import json, numpy as np, wave

SR = 48000
tm = json.load(open("audio/timing.json"))
T = tm["total_duration"]
words = json.load(open("audio/words.json"))
def W(line, w):
    for x in words[str(line)]:
        if x["w"].strip(".,!?\"'—").lower() == w.lower():
            return x["t0"]
    raise KeyError((line, w))
seg = {s["line"] if "line" in s else i + 1: s for i, s in enumerate(tm["segments"])}
def L(i):
    s = tm["segments"][i - 1]
    return s.get("start", s.get("t0"))

n = int(T * SR); t = np.arange(n) / SR
out = np.zeros((n, 2))
rng = np.random.default_rng(7)

def env(a, b, fi=0.5, fo=0.5):
    e = np.clip((t - a) / max(fi, 1e-3), 0, 1) * np.clip((b - t) / max(fo, 1e-3), 0, 1)
    return e * e * (3 - 2 * e)

def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    from scipy.signal import lfilter
    return lfilter([1 - a], [1, -a], x)

def saw(f, ph=0):
    return 2 * ((t * f + ph) % 1) - 1

crash = W(10, "off"); r483 = W(8, "four"); stock = W(12, "stock")
# drone: E1 + B1, slow LFO on a low-passed saw pair
drone = 0.5 * np.sin(2 * np.pi * 41.2 * t) + 0.25 * np.sin(2 * np.pi * 61.7 * t)
pad = lp(saw(82.4) + saw(82.9, 0.3) + 0.7 * saw(123.5) + 0.7 * saw(123.0, 0.6), 420) * 0.25
lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)
bed = (drone * 0.55 + pad) * lfo
bed_env = env(0.0, crash + 0.05, 2.0, 0.05) * (0.55 + 0.45 * np.clip((t - L(5)) / (r483 - L(5)), 0, 1))
bed_env += env(crash + 1.6, T, 2.5, 2.6) * 0.6
out += (bed * bed_env)[:, None]

bpm = 96; beat = 60 / bpm
def hits(start, end, step, fn, gain, pan=0.0):
    k = start
    while k < end:
        i = int(k * SR); seg_ = fn()
        j = min(n, i + len(seg_)); g = gain(k)
        out[i:j, 0] += seg_[: j - i] * g * (1 - pan); out[i:j, 1] += seg_[: j - i] * g * (1 + pan)
        k += step

def hat():
    m = int(0.05 * SR); x = rng.standard_normal(m)
    x = x - lp(x, 6000)
    return x * np.exp(-np.arange(m) / (0.012 * SR)) * 0.35
def kick():
    m = int(0.35 * SR); tt = np.arange(m) / SR
    f = 45 + 90 * np.exp(-tt / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16) * 0.9

g0 = L(5)
hits(g0, crash - 0.02, beat / 2, hat, lambda k: 0.5 + 0.5 * min(1, (k - g0) / (r483 - g0)), 0.15)
k0 = W(7, "buy")
hits(k0, crash - 0.02, beat, kick, lambda k: 0.55 + 0.45 * min(1, (k - k0) / (r483 - k0)))
# final swell: open E5 (E2 B2 E3) chord blooming on "stock" and ringing to the end
ch = sum(lp(saw(f) + saw(f * 1.004, 0.5), 900) for f in (82.4, 123.5, 164.8)) * 0.22
out += (ch * env(stock - 0.6, T, 0.8, 2.4))[:, None] * np.array([1.0, 1.0])

out /= np.abs(out).max() + 1e-9
out *= 0.7
with wave.open("audio/music.wav", "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((out * 32767).astype("<i2").tobytes())
print("audio/music.wav", T)
