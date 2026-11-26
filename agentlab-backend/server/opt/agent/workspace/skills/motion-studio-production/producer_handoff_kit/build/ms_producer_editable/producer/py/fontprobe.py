#!/usr/bin/env python3
"""fontprobe.py: engine-native font metadata + per-engine load probes.
stdin: JSON list of {"path":..., "sha256":...}; stdout: JSONL font records (one per face; TTC faces get faceIndex).
Probes skia-python (Typeface.MakeFromFile + glyph lookup + raster) and PIL/FreeType (ImageFont.truetype + raster).
ffmpeg drawtext also uses FreeType; it is probed separately on the fonts a project actually uses (fonts.mjs)."""
import sys, json, io
from fontTools.ttLib import TTFont, TTCollection
try:
    import skia
except Exception:
    skia = None
from PIL import ImageFont, Image, ImageDraw

def ranges(cps):
    out = []
    for c in sorted(cps):
        if out and c == out[-1][1] + 1: out[-1][1] = c
        else: out.append([c, c])
    return out

def name(f, *ids):
    n = f['name'] if 'name' in f else None
    if not n: return None
    for i in ids:
        r = n.getDebugName(i)
        if r: return r
    return None

def meta(f):
    cmap = f.getBestCmap() or {}
    os2 = f['OS/2'] if 'OS/2' in f else None
    head = f['head'] if 'head' in f else None
    axes = []
    if 'fvar' in f:
        axes = [{"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue} for a in f['fvar'].axes]
    italic = bool((os2 and (os2.fsSelection & 1)) or (head and head.macStyle & 2))
    return {
        "family": name(f, 16, 1), "subfamily": name(f, 17, 2), "fullName": name(f, 4), "postscriptName": name(f, 6),
        "version": name(f, 5), "weightClass": os2.usWeightClass if os2 else 400, "widthClass": os2.usWidthClass if os2 else 5,
        "italic": italic, "axes": axes, "numGlyphs": f['maxp'].numGlyphs if 'maxp' in f else None,
        "variable": bool(axes), "coverage": ranges(cmap.keys()), "codepoints": len(cmap),
        "license": (name(f, 13) or "")[:200], "licenseUrl": name(f, 14), "fsType": os2.fsType if os2 else None,
    }

def probe_skia(path, idx, sample):
    if not skia: return {"ok": False, "reason": "skia-python not installed"}
    try:
        tf = skia.Typeface.MakeFromFile(path, idx)
        if tf is None: return {"ok": False, "reason": "Typeface.MakeFromFile returned null"}
        font = skia.Font(tf, 48)
        gl = font.textToGlyphs(sample)
        miss = sum(1 for g in gl if g == 0)
        surf = skia.Surface(256, 64); c = surf.getCanvas(); c.clear(skia.ColorWHITE)
        c.drawString(sample, 4, 52, font, skia.Paint(Color=skia.ColorBLACK))
        px = surf.makeImageSnapshot().toarray()
        inked = int((px[:, :, 0] < 128).sum())
        return {"ok": inked > 0, "family": tf.getFamilyName(), "glyphsMissingInSample": miss, "inkedPx": inked, "engineVersion": "skia-python " + getattr(skia, '__version__', '?')}
    except Exception as e:
        return {"ok": False, "reason": str(e)[:200]}

def probe_pil(path, idx, sample):
    try:
        f = ImageFont.truetype(path, 48, index=idx)
        im = Image.new('L', (256, 64), 255); ImageDraw.Draw(im).text((4, 4), sample, font=f, fill=0)
        import numpy as np; inked = int((np.asarray(im) < 128).sum())
        import PIL
        return {"ok": inked > 0, "inkedPx": inked, "engineVersion": "Pillow " + PIL.__version__ + " / FreeType " + str(ImageFont.core.freetype2_version)}
    except Exception as e:
        return {"ok": False, "reason": str(e)[:200]}

def sample_for(cov):
    cps = set()
    for a, b in cov:
        for c in range(a, min(b, a + 64) + 1): cps.add(c)
    s = "".join(ch for ch in "Aa0Zz" if any(a <= ord(ch) <= b for a, b in cov))
    if not s:
        s = ''.join(chr(c) for c in sorted(cps) if c > 32 and not (0xD800 <= c <= 0xDFFF))[:4]
    return s or "A"

def main():
    items = json.load(sys.stdin)
    for it in items:
        p = it["path"]
        try:
            faces = []
            if p.lower().endswith(('.ttc', '.otc')):
                col = TTCollection(p, lazy=True)
                faces = [(i, f) for i, f in enumerate(col.fonts)]
            else:
                faces = [(0, TTFont(p, lazy=True, fontNumber=0))]
        except Exception as e:
            print(json.dumps({"path": p, "sha256": it.get("sha256"), "error": "fontTools: " + str(e)[:200]})); sys.stdout.flush(); continue
        for idx, f in faces:
            try: m = meta(f)
            except Exception as e:
                print(json.dumps({"path": p, "sha256": it.get("sha256"), "faceIndex": idx, "error": "meta: " + str(e)[:200]})); continue
            s = sample_for(m["coverage"])
            rec = {"path": p, "sha256": it.get("sha256"), "faceIndex": idx, **m, "sample": s,
                   "engines": {"skia-python": probe_skia(p, idx, s), "pil": probe_pil(p, idx, s)}}
            print(json.dumps(rec, ensure_ascii=False)); sys.stdout.flush()

if __name__ == '__main__':
    main()
