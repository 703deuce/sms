#!/usr/bin/env python3
"""edge-tts wrapper for tts_say.py --cmd: retries flaky connections, and saves WordBoundary timings.
usage: edge_take.py TXT OUT [--voice V] [--rate R]   (env WORDS_DIR: where <take>.words.json goes)"""
import asyncio, json, os, pathlib, subprocess, sys, time, argparse
import edge_tts

ap = argparse.ArgumentParser(); ap.add_argument("txt"); ap.add_argument("out")
ap.add_argument("--voice", default="en-US-AndrewNeural"); ap.add_argument("--rate", default="-8%")
a = ap.parse_args()
text = pathlib.Path(a.txt).read_text()

async def go(mp3):
    words = []
    com = edge_tts.Communicate(text, a.voice, rate=a.rate, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t0": ch["offset"] / 1e7, "t1": (ch["offset"] + ch["duration"]) / 1e7})
    return words

mp3 = a.out + ".mp3"
for i in range(8):
    try:
        words = asyncio.run(go(mp3)); break
    except Exception as e:
        print("retry", i, e, file=sys.stderr); time.sleep(3 + 2 * i)
else:
    sys.exit("edge-tts failed")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ar", "48000", "-ac", "1", a.out], check=True)
wd = os.environ.get("WORDS_DIR")
if wd:
    name = pathlib.Path(a.out).stem.replace("_raw", "")
    pathlib.Path(wd).mkdir(parents=True, exist_ok=True)
    (pathlib.Path(wd) / f"{name}.words.json").write_text(json.dumps(words, indent=0))
