"""Benchmark: 60 s, 12-scene, 1280x720@30 assemble from lavfi media (spec rule: test videos 1-3 min)."""
import subprocess, sys, tempfile, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble, probe_duration

with tempfile.TemporaryDirectory() as td:
    d = Path(td)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=8", str(d / "v.mp4")], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "mandelbrot=s=1600x900", "-frames:v", "1", str(d / "i.png")], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=300:d=4.5", str(d / "vo.wav")], check=True)
    scenes = [Scene(f"s{k}", 5.0, SceneMedia("image" if k % 3 == 2 else "video", d / ("i.png" if k % 3 == 2 else "v.mp4"), src_in_s=1.0),
                    ["fade", "slide_left", "dissolve", "cut"][k % 4], 0.5, d / "vo.wav") for k in range(12)]
    t0 = time.time()
    r = assemble(scenes, d / "w", w=1280, h=720, fps=30)
    print(f"60s/12 scenes 720p30 assemble: duration={probe_duration(r['source']):.2f}s wall={time.time()-t0:.1f}s")
