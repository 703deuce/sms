"""Render held stills and report text under 40 px cap height or cut by the frame edge (1920x1080)."""
import os, sys
os.environ["GME_AUDIT"] = "1"
sys.path.insert(0, "/workspace/code_motion_cinematic/repo/skills/cinematic-film/scripts")
import render, ext
film, r, doc = render.make(".", "1920x1080")
bad = 0
for t in map(float, sys.argv[1].split(",")):
    ext.AUDIT.clear()
    r.draw_world(t)
    seen = {}
    for s, px, cut, a in ext.AUDIT:
        seen.setdefault(s, (px, cut, a))
    for s, (px, cut, a) in seen.items():
        flag = ("SMALL " if px < 40 else "") + ("CUT" if cut else "")
        if flag:
            bad += 1
        print(f"t={t:5.1f}  {px:6.1f}px  a={a:.2f}  {flag:9s} {s}")
print("issues:", bad)
