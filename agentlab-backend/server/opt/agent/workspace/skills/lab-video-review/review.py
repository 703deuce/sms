#!/usr/bin/env python3
"""review.py: review a film BEFORE rendering, at the moments that change; then a technical-only check of the master.

  review.py times <project> [--plan scenes/plan.json] [--fps 30]
      Change points from the timeline (audio/timing.json, plus scene/element start-end from plan.json when it exists):
      first frame, each line's graphic entrance (+0.25 s) and middle, just before each exit, both sides of every scene
      cut, element entrances/exits, the ending. Prints `times=` (comma list for `render.py --probe` or
      `capture.mjs --still`) and writes <project>/qa/changepoints.json with a label per time.
  review.py sheet <dir|png...> --out qa/sheet.jpg [--cols 4] [--width 320]
      Labelled contact sheet of stills (time from the file name); look at it with agent_view.
  review.py audio <mix> [--voice audio/narration.wav --music audio/music.wav]
      Pre-render sound check on the mix: integrated LUFS, true peak, and music under voice while speaking (>= 18 dB).
  review.py final <video> [--expect SECONDS] [--size WxH]
      After the single render, technical only: decodes cleanly, duration, resolution, fps, audio present.
Exit 1 when a check fails."""
import json, os, re, subprocess, sys


def _arg(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


def times(a):
    proj = a[0]
    plan_p = _arg(a, '--plan', os.path.join(proj, 'scenes', 'plan.json'))
    fps = float(_arg(a, '--fps', 30))
    tl = json.load(open(os.path.join(proj, 'audio', 'timing.json')))
    segs = tl.get('segments') or []
    total = float(tl.get('total_duration') or (segs[-1]['end'] if segs else 0))
    pts = [(0.05, 'first frame')]
    for s in segs:
        st, en = float(s['start']), float(s['end'])
        pts += [(st + 0.25, f"{s.get('id')} entrance"), ((st + en) / 2, f"{s.get('id')} middle"),
                (max(st, en - 0.1), f"{s.get('id')} before exit")]
    if os.path.exists(plan_p):
        plan = json.load(open(plan_p))
        scenes = plan.get('scenes', plan) if isinstance(plan, dict) else plan
        for sc in scenes if isinstance(scenes, list) else []:
            for k in ('start', 'end'):
                if isinstance(sc.get(k), (int, float)):
                    t = float(sc[k])
                    pts += [(t - 0.1, f"{sc.get('id')} {k} -0.1"), (t + 0.1, f"{sc.get('id')} {k} +0.1")]
            for el in sc.get('elements') or sc.get('overlays') or []:
                for k in ('start', 'end'):
                    if isinstance(el.get(k), (int, float)):
                        pts.append((float(el[k]) + (0.2 if k == 'start' else -0.1), f"{el.get('id')} {k}"))
    pts.append((max(0.0, total - 0.05), 'ending'))
    out, last = [], -1
    for t, lab in sorted((min(max(0.0, t), total), lab) for t, lab in pts):
        t = round(round(t * fps) / fps, 3)
        if t - last >= 0.2:
            out.append({'t': t, 'label': lab}); last = t
    os.makedirs(os.path.join(proj, 'qa'), exist_ok=True)
    json.dump(out, open(os.path.join(proj, 'qa', 'changepoints.json'), 'w'), indent=1)
    print(f"{len(out)} change points over {total:.1f} s -> {proj}/qa/changepoints.json")
    print('times=' + ','.join(f"{p['t']:g}" for p in out))


def sheet(a):
    from PIL import Image, ImageDraw
    outp = _arg(a, '--out', 'qa/sheet.jpg'); cols = int(_arg(a, '--cols', 4)); w = int(_arg(a, '--width', 320))
    files = []
    for x in [x for x in a if not x.startswith('--') and x not in (outp, str(cols), str(w))]:
        files += sorted(os.path.join(x, f) for f in os.listdir(x) if f.lower().endswith(('.png', '.jpg'))) if os.path.isdir(x) else [x]
    if not files:
        sys.exit('no stills')
    ims = [Image.open(f).convert('RGB') for f in files]
    h = int(w * ims[0].height / ims[0].width); rows = (len(ims) + cols - 1) // cols
    sh = Image.new('RGB', (cols * w, rows * (h + 18)), (20, 20, 20)); d = ImageDraw.Draw(sh)
    for i, (f, im) in enumerate(zip(files, ims)):
        x, y = (i % cols) * w, (i // cols) * (h + 18)
        sh.paste(im.resize((w, h)), (x, y + 18)); d.text((x + 4, y + 3), os.path.basename(f)[:40], fill=(230, 230, 230))
    os.makedirs(os.path.dirname(outp) or '.', exist_ok=True); sh.save(outp, quality=85)
    print(f"{outp}: {len(files)} stills, {cols} per row")


def _loud(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    i = re.findall(r'I:\s+(-?[\d.]+) LUFS', r); p = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', r)
    return (float(i[-1]) if i else None), (float(p[-1]) if p else None)


def _env(f, win=0.4):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '8000', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32); n = int(8000 * win)
    x = x[:len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((x ** 2).mean(axis=1)) + 1e-9)


def audio(a):
    import numpy as np
    mix = a[0]; ok = True
    li, tp = _loud(mix)
    print(f"mix: integrated {li} LUFS (target -14 +/-1), true peak {tp} dBTP (target <= -1)")
    ok &= li is not None and abs(li + 14) <= 1.0 and tp is not None and tp <= -1.0
    v, m = _arg(a, '--voice'), _arg(a, '--music')
    if v and m:
        ev, em = _env(v), _env(m); n = min(len(ev), len(em)); ev, em = ev[:n], em[:n]
        speak = ev > (ev.max() - 30)
        if speak.any():
            gap = float(np.median(ev[speak] - em[speak]))
            print(f"music under voice while speaking: {gap:.1f} dB (target >= 18)"); ok &= gap >= 18
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)


def final(a):
    v = a[0]; ok = True
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate',
                                    '-of', 'json', v], capture_output=True, text=True).stdout or '{}')
    st = pr.get('streams') or []; vs = [s for s in st if s.get('codec_type') == 'video']; au = [s for s in st if s.get('codec_type') == 'audio']
    dur = float((pr.get('format') or {}).get('duration') or 0)
    err = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-f', 'null', '-'], capture_output=True, text=True).stderr.strip()
    print(f"decodes: {'ok' if not err else 'ERRORS: ' + err[:200]}"); ok &= not err
    if vs:
        print(f"video: {vs[0].get('width')}x{vs[0].get('height')} @ {vs[0].get('r_frame_rate')}, {dur:.2f} s")
        if _arg(a, '--size'):
            ok &= f"{vs[0].get('width')}x{vs[0].get('height')}" == _arg(a, '--size')
    else:
        print('video: MISSING'); ok = False
    print(f"audio: {'present' if au else 'MISSING'}"); ok &= bool(au)
    if _arg(a, '--expect'):
        e = float(_arg(a, '--expect')); print(f"duration vs expected {e:g} s: {dur - e:+.2f} s"); ok &= abs(dur - e) <= max(1.0, 0.1 * e)
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help') or a[0] not in ('times', 'sheet', 'audio', 'final'):
        print(__doc__); sys.exit(0)
    {'times': times, 'sheet': sheet, 'audio': audio, 'final': final}[a[0]](a[1:])
