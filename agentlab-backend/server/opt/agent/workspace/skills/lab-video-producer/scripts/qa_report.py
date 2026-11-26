#!/usr/bin/env python3
"""Technical QA for a rendered Motion Studio video (master or one scene clip).

usage: qa_report.py VIDEO --out DIR [--every 1.0] [--expect-seconds N] [--expect-aspect 16:9]
                    [--lufs -15] [--tolerance 0.10]

Writes into DIR:
  sheet.jpg        contact sheet, one 320px-wide tile every --every seconds, time-stamped
  frames/          the individual tiles at full resolution (open the ones that matter)
  report.json      probe facts + measurements + PASS/FAIL per check
Prints a one-line verdict per check. Exit 0 = every hard check passed, 1 = something failed.

Measures: duration vs expected, resolution/aspect, fps (CFR), audio present, integrated loudness and
true peak (EBU R128), unintended black stretches (blackdetect), frozen stretches (freezedetect),
mean luma per tile (near-empty/dark frames), and per-tile change (static camera detection).
It cannot judge story, legibility or taste: you still have to LOOK at sheet.jpg and the frames.
"""
import argparse, json, math, os, pathlib, re, subprocess, sys

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def probe(path):
    r = run(["ffprobe", "-v", "error", "-show_entries",
             "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels",
             "-of", "json", path])
    return json.loads(r.stdout or "{}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--out", required=True)
    ap.add_argument("--every", type=float, default=1.0)
    ap.add_argument("--expect-seconds", type=float, default=None)
    ap.add_argument("--expect-aspect", default=None, help="e.g. 16:9, 9:16, 1:1, 4:5")
    ap.add_argument("--lufs", type=float, default=-15.0)
    ap.add_argument("--tolerance", type=float, default=0.10, help="allowed duration deviation as a fraction")
    ap.add_argument("--no-audio-ok", action="store_true", help="scene clips / overlays may be silent")
    a = ap.parse_args()
    out = pathlib.Path(a.out); (out / "frames").mkdir(parents=True, exist_ok=True)
    p = probe(a.video)
    v = next((s for s in p.get("streams", []) if s["codec_type"] == "video"), None)
    au = next((s for s in p.get("streams", []) if s["codec_type"] == "audio"), None)
    dur = float(p.get("format", {}).get("duration", 0) or 0)
    checks, facts = [], {"duration": dur}
    def check(name, ok, detail, hard=True):
        checks.append({"check": name, "pass": bool(ok), "hard": hard, "detail": detail})
    if not v:
        check("video_stream", False, "no video stream"); return finish(out, facts, checks)
    w, h = int(v["width"]), int(v["height"])
    num, den = map(int, v["r_frame_rate"].split("/")); anum, aden = map(int, v["avg_frame_rate"].split("/"))
    fps = num / den if den else 0; afps = anum / aden if aden else 0
    facts.update(width=w, height=h, fps=round(fps, 3), avg_fps=round(afps, 3), codec=v["codec_name"])
    check("codec_h264", v["codec_name"] == "h264", v["codec_name"])
    check("even_dimensions", w % 2 == 0 and h % 2 == 0, f"{w}x{h}")
    check("cfr", abs(fps - afps) < 0.05, f"r={fps:.3f} avg={afps:.3f}")
    if a.expect_aspect:
        x, y = map(float, a.expect_aspect.split(":"))
        check("aspect", abs(w / h - x / y) < 0.01, f"{w}x{h} vs {a.expect_aspect}")
    if a.expect_seconds:
        dev = abs(dur - a.expect_seconds) / a.expect_seconds
        check("duration", dev <= a.tolerance, f"{dur:.2f}s vs requested {a.expect_seconds:.0f}s ({dev*100:.1f}% off)")
    # audio
    if au:
        r = run(["ffmpeg", "-nostats", "-i", a.video, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
        I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
        I = float(I[-1]) if I else None; TP = float(TP[-1]) if TP else None
        facts.update(lufs=I, true_peak=TP)
        check("loudness", I is not None and abs(I - a.lufs) <= 1.5, f"{I} LUFS (target {a.lufs} ±1.5)")
        check("true_peak", TP is not None and TP <= -1.0, f"{TP} dBTP (max -1.0)")
    else:
        check("audio_stream", a.no_audio_ok, "no audio stream", hard=not a.no_audio_ok)
    # black / frozen stretches
    r = run(["ffmpeg", "-nostats", "-i", a.video, "-vf", "blackdetect=d=0.5:pix_th=0.10,freezedetect=n=0.001:d=1.0",
             "-an", "-f", "null", "-"]).stderr
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", r)
    blacks = [(float(s), float(e)) for s, e in blacks if not (float(s) < 1.0 or float(e) > dur - 2.5)]   # ignore fade-in/out
    freezes = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", r)]
    fdurs = [float(x) for x in re.findall(r"freeze_duration: ([\d.]+)", r)]
    facts.update(black_mid=blacks, freezes=list(zip(freezes, fdurs)))
    check("no_black_midfilm", not blacks, f"{len(blacks)} black stretch(es) >0.5s mid-film: {blacks[:5]}")
    check("no_long_freeze", not [d for d in fdurs if d >= 2.0], f"freezes (start,len): {list(zip(freezes, fdurs))[:8]}", hard=False)
    # tiles + luma + change
    n = max(1, int(dur // a.every))
    tw = 320; th = int(round(tw * h / w / 2) * 2)
    lumas, diffs, prev = [], [], None
    for i in range(n):
        t = min(dur - 0.05, i * a.every + a.every / 2)
        f = out / "frames" / f"t{t:07.2f}.png"
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", a.video, "-frames:v", "1", str(f)])
        data = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"],
                              capture_output=True).stdout
        if not data:
            continue
        px = list(data); mean = sum(px) / len(px)
        lumas.append((round(t, 2), round(mean, 1)))
        if prev is not None and len(prev) == len(px):
            diffs.append((round(t, 2), round(sum(abs(x - y) for x, y in zip(px, prev)) / len(px), 2)))
        prev = px
    dark = [t for t, m in lumas if m < 12]
    static_runs, run_len = [], 0
    for t, d in diffs:
        run_len = run_len + 1 if d < 0.6 else 0
        if run_len * a.every >= 4.0:
            static_runs.append(t)
    facts.update(luma=lumas, tile_change=diffs)
    check("not_mostly_dark", len(dark) <= max(1, 0.1 * len(lumas)), f"{len(dark)}/{len(lumas)} tiles near-black: {dark[:8]}", hard=False)
    check("camera_or_content_moves", not static_runs,
          f"stretches with no visible change for >=4s ending at {sorted(set(static_runs))[:8]}", hard=False)
    # contact sheet: labelled thumbnails (time in seconds), row-major in time order
    cols = 6
    (out / "thumbs").mkdir(exist_ok=True)
    for f in sorted((out / "frames").glob("t*.png")):
        t = float(f.stem[1:])
        dst = out / "thumbs" / (f.stem + ".png")
        r = run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-vf",
                 f"scale={tw}:{th},drawtext=text='{t:.1f}s':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6",
                 str(dst)])
        if r.returncode != 0:
            run(["ffmpeg", "-v", "error", "-y", "-i", str(f), "-vf", f"scale={tw}:{th}", str(dst)])
    run(["ffmpeg", "-v", "error", "-y", "-pattern_type", "glob", "-i", str(out / "thumbs" / "t*.png"),
         "-vf", f"tile={cols}x{math.ceil(len(lumas)/cols) or 1}:padding=4:margin=4", "-frames:v", "1", str(out / "sheet.jpg")])
    facts["sheet"] = str(out / "sheet.jpg")
    return finish(out, facts, checks)

def finish(out, facts, checks):
    (out / "report.json").write_text(json.dumps({"facts": facts, "checks": checks}, indent=1))
    hard_fail = False
    for c in checks:
        tag = "PASS" if c["pass"] else ("FAIL" if c["hard"] else "WARN")
        hard_fail |= (not c["pass"]) and c["hard"]
        print(f"{tag:4s} {c['check']:24s} {c['detail']}")
    print("sheet:", facts.get("sheet"), "| report:", out / "report.json")
    sys.exit(1 if hard_fail else 0)

if __name__ == "__main__":
    main()
