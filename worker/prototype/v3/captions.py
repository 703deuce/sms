"""Word-by-word TikTok/Shorts-style captions -> ASS (burned in by libass) + SRT.
build(words, audio16k, ass_path, srt_path, split_times=None)
  words: [{w, s, e, p, spk}]  (spk 0 = left person, 1 = right person; from speakercrop's per-word voice labels)
"""
import re, numpy as np

PLAY_W, PLAY_H = 720, 1280
MAX_WORDS, MAX_CHARS, PAUSE = 3, 18, 0.35     # chunk limits; a gap > PAUSE s always starts a new chunk
HL = {0: '&H0000E6FF&', 1: '&H0014FF39&'}      # ASS BGR: speaker 0 (left) yellow #FFE600, speaker 1 (right) green #39FF14
POP = r'\fscx100\fscy100\t(0,90,\fscx116\fscy116)\t(90,180,\fscx110\fscy110)'   # scale pop on the active word

HEADER = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {PLAY_W}
PlayResY: {PLAY_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Poppins ExtraBold,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,0,0,0,0,100,100,0,0,1,7,4,2,40,40,380,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def clean(words):
    """merge whisper sub-word artifacts ('get' '-go' -> 'get-go'), drop empties"""
    out = []
    for w in words:
        t = w['w'].strip()
        if not t: continue
        if out and (t.startswith('-') or t in {"'s", "n't", "%"}):
            out[-1] = dict(out[-1], w=out[-1]['w'] + t, e=w['e']); continue
        out.append(dict(w, w=t))
    return out

def fix_timing(words, a, sr=16000):
    """snap starts that follow a pause onto the audio energy onset; close tiny gaps; enforce sane durations."""
    hop = sr // 100; env = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2) + 1e-10) for i in range(0, len(a) - hop, hop)])
    db = 20 * np.log10(env); moved = []
    for i, w in enumerate(words):
        prev_e = words[i - 1]['e'] if i else 0.0
        if w['s'] - prev_e > 0.10:                                   # only meaningful after a pause
            lo, hi = int(max(prev_e, w['s'] - 0.15) * 100), int((w['s'] + 0.10) * 100)
            fl = np.percentile(db[max(0, lo - 30):lo + 1], 20) if lo > 0 else db[:30].min()
            on = next((k for k in range(lo, min(hi, len(db))) if db[k] > fl + 8), None)
            if on is not None:
                ns = on / 100; moved.append(ns - w['s']); w['s'] = round(ns, 3)
    for i, w in enumerate(words):
        nxt = words[i + 1]['s'] if i + 1 < len(words) else w['e'] + 0.3
        w['e'] = min(w['e'], nxt)
        if nxt - w['e'] < 0.25: w['e'] = nxt                      # no flicker between connected words
        w['e'] = max(w['e'], w['s'] + 0.08); w['e'] = min(w['e'], w['s'] + 1.5)   # whisper sometimes stretches a word
    return words, moved

def chunks(words):
    out, cur = [], []
    for i, w in enumerate(words):
        if cur:
            prev = cur[-1]; txt = ' '.join(x['w'] for x in cur + [w])
            if (len(cur) >= MAX_WORDS or len(txt) > MAX_CHARS * 2 - 4 or w['s'] - prev['e'] > PAUSE
                    or w.get('spk') != prev.get('spk') or re.search(r'[.?!,;:]$', prev['w'])):
                out.append(cur); cur = []
        cur.append(w)
    if cur: out.append(cur)
    return out

def disp(t):     # display form: upper case, drop trailing commas/periods (keep ? !)
    return re.sub(r'[.,;:]+$', '', t).upper().replace('{', '(').replace('}', ')')

def ts(t, srt=False):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f'{h:02d}:{m:02d}:{s:06.3f}'.replace('.', ',') if srt else f'{h}:{m:02d}:{s:05.2f}'

def build(words, a, ass_path, srt_path, split_times=None):
    words, moved = fix_timing(clean(words), a)
    ch = chunks(words); ev, srt = [], []
    for ci, c in enumerate(ch):
        end = c[-1]['e'] + 0.25
        if ci + 1 < len(ch): end = min(end, ch[ci + 1][0]['s'])          # never overlap the next chunk
        pos = ''
        if split_times is not None and split_times(c[0]['s']): pos = r'{\an5\pos(360,640)}'   # stacked layout: seam
        for k, w in enumerate(c):
            ws = w['s']; we = c[k + 1]['s'] if k + 1 < len(c) else end
            if we - ws < 0.02: continue
            parts = [('{\\c%s%s}%s{\\r}' % (HL.get(w.get('spk', 0), HL[0]), POP, disp(x['w'])) if x is w else disp(x['w'])) for x in c]
            ev.append(f"Dialogue: 0,{ts(ws)},{ts(we)},Cap,,0,0,0,,{pos}{' '.join(parts)}")
        srt.append(f"{len(srt) + 1}\n{ts(c[0]['s'], 1)} --> {ts(end, 1)}\n{' '.join(x['w'] for x in c)}\n")
    open(ass_path, 'w').write(HEADER + '\n'.join(ev) + '\n')
    open(srt_path, 'w').write('\n'.join(srt))
    return dict(words=len(words), chunks=len(ch), snapped=len(moved),
                mean_shift_ms=round(1000 * float(np.mean(moved)), 1) if moved else 0.0, words_fixed=words)
