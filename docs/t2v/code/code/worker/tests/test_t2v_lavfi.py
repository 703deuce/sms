"""Tiny local ffmpeg tests for the T2V worker (few seconds each, lavfi inputs only).
Run: cd worker && python3 tests/test_t2v_lavfi.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from clips_worker.t2v.assemble import Scene, SceneMedia, assemble, probe_duration, xfade_filter  # noqa: E402
from clips_worker.t2v.titles_ass import TextItem, build_ass  # noqa: E402
from clips_worker.t2v.tts_alignment import words_from_alignment  # noqa: E402

W, H, FPS = 640, 360, 30


def sh(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def gen_inputs(d: Path) -> dict:
    sh(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=25:d=1.5", str(d / "short.mp4")])
    sh(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "smptehdbars=s=1920x1080:r=30:d=4", str(d / "long.mp4")])
    sh(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "mandelbrot=s=800x800", "-frames:v", "1", str(d / "still.png")])
    for i, f in enumerate([330, 440, 550]):
        sh(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"sine=f={f}:d={1.2 + i * 0.3}", "-ar", "44100", str(d / f"vo{i}.wav")])
    sh(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=f=110:d=6", "-ar", "44100", str(d / "music.wav")])
    return {k: d / v for k, v in {"short": "short.mp4", "long": "long.mp4", "still": "still.png", "music": "music.wav"}.items()}


def mean_volume(path: Path, start: float, dur: float) -> float:
    p = subprocess.run(["ffmpeg", "-v", "info", "-ss", str(start), "-t", str(dur), "-i", str(path), "-af", "volumedetect",
                        "-f", "null", "-"], capture_output=True, text=True)
    line = [l for l in p.stderr.splitlines() if "mean_volume" in l][0]
    return float(line.split("mean_volume:")[1].split("dB")[0])


def main() -> None:
    results = {}
    with tempfile.TemporaryDirectory() as td:
        d = Path(td)
        inp = gen_inputs(d)

        # 1) offsets math: transitions start exactly at scene boundaries
        fc, _ = xfade_filter([2.5, 2.5, 2.0], [("fade", 0.5), ("slideleft", 0.5)])
        assert "offset=2.000" in fc and "offset=4.000" in fc, fc
        results["xfade_offsets"] = "ok"

        # 2) full assemble: short video (loops), long video (trim), still (Ken Burns), with VO
        scenes = [
            Scene("s1", 2.0, SceneMedia("video", inp["short"]), "fade", 0.5, d / "vo0.wav"),
            Scene("s2", 2.0, SceneMedia("video", inp["long"], src_in_s=1.0, focal_x=0.2), "slide_left", 0.5, d / "vo1.wav"),
            Scene("s3", 2.0, SceneMedia("image", inp["still"], ken_burns="zoom_in"), "fade", 0.5, d / "vo2.wav"),
        ]
        t0 = time.time()
        res = assemble(scenes, d / "work", w=W, h=H, fps=FPS)
        dur = probe_duration(res["source"])
        assert abs(dur - 6.0) < 0.1, dur
        assert res["sceneStartsMs"] == [0, 2000, 4000]
        results["assemble_3_scenes"] = f"ok duration={dur:.2f}s wall={time.time() - t0:.1f}s"

        # 3) ducking with the EXISTING audio_render filter graph shape (sidechaincompress)
        out = d / "ducked.wav"
        fc = ("[0:a]asplit=2[sp][sc];[1:a]volume=0.8,atrim=0:6,asetpts=PTS-STARTPTS[mv];"
              "[mv][sc]sidechaincompress=threshold=0.0316:ratio=6.6:attack=20:release=300:makeup=1[md];"
              "[sp][md]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[aout]")
        sh(["ffmpeg", "-y", "-v", "error", "-i", str(d / "work" / "vo.wav"), "-i", str(inp["music"]),
            "-filter_complex", fc, "-map", "[aout]", str(out)])
        music_only = d / "music_only.wav"
        sh(["ffmpeg", "-y", "-v", "error", "-i", str(inp["music"]), "-af", "volume=0.8", str(music_only)])
        ducked_only = d / "ducked_music.wav"
        sh(["ffmpeg", "-y", "-v", "error", "-i", str(d / "work" / "vo.wav"), "-i", str(inp["music"]), "-filter_complex",
            fc.replace("[sp][md]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[aout]", "[sp]anullsink;[md]anull[aout]"),
            "-map", "[aout]", str(ducked_only)])
        under_vo = mean_volume(ducked_only, 0.3, 0.8)
        alone = mean_volume(music_only, 0.3, 0.8)
        assert under_vo < alone - 3, (under_vo, alone)
        results["ducking"] = f"ok music_under_vo={under_vo:.1f}dB music_alone={alone:.1f}dB mix={mean_volume(out, 0.3, 0.8):.1f}dB"

        # 4) titles / lower third ASS burn
        ass = build_ass([TextItem("title", "Five Tips", 0, 1800, animation="slide_up"),
                         TextItem("lower_third", "Rick James", 2200, 3800, subtitle="Founder, Transovo")], w=W, h=H)
        (d / "titles.ass").write_text(ass)
        burned = d / "titled.mp4"
        sh(["ffmpeg", "-y", "-v", "error", "-i", str(res["source"]), "-vf", f"ass={d / 'titles.ass'}",
            "-c:a", "copy", str(burned)])
        sh(["ffmpeg", "-y", "-v", "error", "-ss", "1.0", "-i", str(burned), "-frames:v", "1", "/workspace/t2v/code/worker/tests/title_frame.png"])
        sh(["ffmpeg", "-y", "-v", "error", "-ss", "3.0", "-i", str(burned), "-frames:v", "1", "/workspace/t2v/code/worker/tests/lower_third_frame.png"])
        sh(["ffmpeg", "-y", "-v", "error", "-ss", "2.25", "-i", str(burned), "-frames:v", "1", "/workspace/t2v/code/worker/tests/transition_frame.png"])
        results["titles_ass"] = f"ok duration={probe_duration(burned):.2f}s"

        # 5) alignment -> words with scene-blocked stable ids
        al = {"characters": list("Hi there"), "character_start_times_seconds": [0, .1, .2, .3, .4, .5, .6, .7],
              "character_end_times_seconds": [.1, .2, .3, .4, .5, .6, .7, .8]}
        words = words_from_alignment(al, offset_s=2.0, scene_slot=3)
        assert words == [{"w": "Hi", "s": 2.0, "e": 2.2, "i": 30000, "spk": 0},
                         {"w": "there", "s": 2.3, "e": 2.8, "i": 30001, "spk": 0}], words
        results["alignment_words"] = "ok"
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
