#!/usr/bin/env python3
"""Render Batch 9A anchors at 1080×1920 and write gallery frame posters + sprites.

Poster timing matches template-factory stable slot midpoints (one frame per slot).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "worker"))

from clips_worker.audio_render import apply_audio_mix, require_template_soundtrack
from clips_worker.media_sources import apply_full_render_sources, source_transition_boundaries
from clips_worker.motion_render import apply_motion_after_cut
from clips_worker.text_items import apply_text_items

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")
PLAY_W, PLAY_H = 1080, 1920
SPRITE_W, SPRITE_H = 1080, 1920
SPRITE_COLS = 4


def run(*args: str) -> None:
    try:
        subprocess.run(args, check=True, capture_output=True, text=True, timeout=300)
    except subprocess.CalledProcessError as err:
        detail = (err.stderr or err.stdout or "").strip()
        raise RuntimeError("ffmpeg failed: " + detail) from err


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _download_cc0_photos(root: Path, manifest_ref: dict) -> list[Path]:
    rel = str(manifest_ref.get("path") or "")
    manifest_path = (ROOT / rel).resolve()
    if not rel or ROOT not in manifest_path.parents or not manifest_path.is_file():
        raise RuntimeError("missing pinned CC0 photo manifest")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("v") != 1 or manifest.get("revision") != manifest_ref.get("revision"):
        raise RuntimeError("CC0 photo manifest revision drift")
    if manifest.get("license") != "CC0-1.0" or len(manifest.get("photos") or []) < 4:
        raise RuntimeError("CC0 photo manifest must contain licensed photographic fixtures")
    out = root / "cc0"
    out.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for index, row in enumerate(manifest["photos"]):
        sha1 = str(row.get("sha1") or "").lower()
        filename = str(row.get("fileName") or "")
        page_url = str(row.get("pageUrl") or "")
        if len(sha1) != 40 or not filename or not page_url.startswith(
            "https://commons.wikimedia.org/wiki/File:"
        ):
            raise RuntimeError("invalid CC0 photo source row")
        target = out / f"{index:02d}_{Path(filename).name}"
        if not target.is_file() or hashlib.sha1(target.read_bytes()).hexdigest() != sha1:
            url = "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + urllib.parse.quote(filename)
            request = urllib.request.Request(
                url, headers={"User-Agent": "TransovoTemplateGallery/1.0 (+https://transovo.ai)"}
            )
            with urllib.request.urlopen(request, timeout=90) as response, target.open("wb") as fh:
                shutil.copyfileobj(response, fh)
        if hashlib.sha1(target.read_bytes()).hexdigest() != sha1:
            raise RuntimeError("CC0 photo SHA-1 mismatch: " + filename)
        paths.append(target)
    return paths


def fixtures(root: Path, music_source: Path, photo_manifest: dict) -> tuple[dict[str, Path], Path]:
    media = root / "media"
    media.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    photos = _download_cc0_photos(root, photo_manifest)
    for i in range(10):
        source = photos[i % len(photos)]
        image = media / f"image_{i}{source.suffix.lower()}"
        if not image.is_file():
            shutil.copyfile(source, image)
        paths[f"gallery_image_{i}"] = image
        paths[f"b8_image_{i}"] = image
    music = media / "music.wav"
    shutil.copyfile(music_source, music)
    return paths, music


def carrier(cache: dict[int, Path], work: Path, total: int) -> Path:
    if total in cache:
        return cache[total]
    work.mkdir(parents=True, exist_ok=True)
    path = work / f"carrier_{total}.mp4"
    run(
        FFMPEG,
        "-y",
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"color=c=#151515:s={PLAY_W}x{PLAY_H}:r=30:d={total / 30:.6f}",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-t",
        f"{total / 30:.6f}",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        str(path),
    )
    cache[total] = path
    return path


def gallery_slot_frames(row: dict) -> list[int]:
    boundaries = [int(x) for x in row["boundaries"]]
    frames: list[int] = []
    for i in range(len(boundaries) - 1):
        start, end = boundaries[i], boundaries[i + 1]
        if i == 0:
            frame = start
        else:
            span = max(1, end - start)
            frame = start + max(1, span // 3)
        frames.append(max(0, min(end - 2, frame)))
    return frames[:SPRITE_COLS]


def render_anchor(row: dict, media: dict[str, Path], music: Path, cache: dict[int, Path], work_root: Path) -> Path:
    total = int(row["totalFrames"])
    duration_ms = round(total * 1000 / 30)
    render_dir = work_root / "renders" / row["id"]
    render_dir.mkdir(parents=True, exist_ok=True)
    cached = render_dir / "render.mp4"
    if cached.is_file() and cached.stat().st_size > 5000:
        return cached
    with tempfile.TemporaryDirectory(prefix=f"gallery-{row['id']}-") as td:
        work = Path(td)
        edits = row["edits"]
        src = carrier(cache, work_root / "_carrier_cache", total)
        sourced = apply_full_render_sources(src, edits, 0, duration_ms, work, media)
        consumed = source_transition_boundaries(edits)
        transitions = [tr for tr in (edits.get("transitions") or []) if int(round(float(tr.get("srcMs", -1)))) not in consumed]
        motion = {**edits, "transitions": transitions or None}
        if motion.get("keyframes") or motion.get("transitions"):
            sourced = apply_motion_after_cut(sourced, sourced, motion, [(0, duration_ms)], 0, work, {})
        text_out = work / "text.mp4"
        with_text = apply_text_items(sourced, text_out, edits, play_w=PLAY_W, play_h=PLAY_H)
        require_template_soundtrack((edits.get("audio") or {}).get("music") or {}, music)
        final = work / "final.mp4"
        apply_audio_mix(
            with_text,
            final,
            music,
            [],
            length_s=total / 30.0,
            volume=0.35,
            duck_depth=0.55,
            fade_in_s=0.5,
            fade_out_s=1.0,
            music_loop=False,
        )
        shutil.copyfile(final, cached)
    return cached


def extract_webp(video: Path, frame: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    at = frame / 30.0
    run(
        FFMPEG,
        "-y",
        "-v",
        "error",
        "-ss",
        f"{at:.4f}",
        "-i",
        str(video),
        "-frames:v",
        "1",
        "-vf",
        f"scale={PLAY_W}:{PLAY_H}:flags=lanczos",
        "-c:v",
        "libwebp",
        "-quality",
        "92",
        "-lossless",
        "0",
        str(dest),
    )


def build_sprite(frame_paths: list[Path], dest: Path) -> None:
    cell_w = SPRITE_W // SPRITE_COLS
    cell_h = round(cell_w * PLAY_H / PLAY_W)
    inputs: list[str] = []
    for p in frame_paths:
        inputs.extend(["-i", str(p)])
    filter_parts = []
    for i in range(len(frame_paths)):
        filter_parts.append(
            f"[{i}:v]scale={cell_w}:{cell_h}:force_original_aspect_ratio=increase,"
            f"crop={cell_w}:{cell_h},setsar=1[v{i}]"
        )
    stack_in = "".join(f"[v{i}]" for i in range(len(frame_paths)))
    filter_parts.append(f"{stack_in}hstack=inputs={len(frame_paths)}[out]")
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        FFMPEG,
        "-y",
        "-v",
        "error",
        *inputs,
        "-filter_complex",
        ";".join(filter_parts),
        "-map",
        "[out]",
        "-c:v",
        "libwebp",
        "-quality",
        "90",
        str(dest),
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--contract", required=True)
    ap.add_argument("--out", default=str(ROOT / "new-app" / "public" / "clips" / "template-previews"))
    ap.add_argument("--work", default=str(ROOT / "build" / "batch9a-gallery-extract"))
    ap.add_argument("--only", default="", help="comma-separated anchor ids")
    args = ap.parse_args()
    if not FFMPEG or not FFPROBE:
        raise RuntimeError("ffmpeg/ffprobe required on PATH")
    contract = json.loads(Path(args.contract).read_text())
    music_source = Path(args.contract).resolve().parent / contract["fixture"]["musicFile"]
    if sha(music_source) != contract["fixture"]["musicSha"]:
        raise RuntimeError("music SHA-256 mismatch")
    only = {x.strip() for x in args.only.split(",") if x.strip()}
    out = Path(args.out)
    work_root = Path(args.work)
    work_root.mkdir(parents=True, exist_ok=True)
    media, music = fixtures(work_root / "_fixtures", music_source, contract["fixture"]["photoManifest"])
    cache: dict[int, Path] = {}
    digests: list[dict] = []
    for row in contract["designs"]:
        anchor_id = row["id"]
        if only and anchor_id not in only:
            continue
        print(f"[gallery-posters] rendering {anchor_id}", flush=True)
        video = render_anchor(row, media, music, cache, work_root)
        frames = gallery_slot_frames(row)
        frame_paths: list[Path] = []
        for idx, frame in enumerate(frames):
            dest = out / f"{anchor_id}_frame{idx}.webp"
            extract_webp(video, frame, dest)
            frame_paths.append(dest)
        sprite = out / f"{anchor_id}.webp"
        build_sprite(frame_paths, sprite)
        digests.append(
            {
                "id": anchor_id,
                "frames": frames,
                "files": {
                    f"frame{i}": f"{anchor_id}_frame{i}.webp" for i in range(len(frame_paths))
                }
                | {"sprite": f"{anchor_id}.webp"},
                "sha256": {
                    f"frame{i}": sha(frame_paths[i]) for i in range(len(frame_paths))
                }
                | {"sprite": sha(sprite)},
            }
        )
    digest_dir = work_root
    digest_dir.mkdir(parents=True, exist_ok=True)
    manifest = digest_dir / "batch9a_gallery_digest.json"
    manifest.write_text(json.dumps({"v": 1, "playW": PLAY_W, "playH": PLAY_H, "anchors": digests}, indent=2) + "\n")
    print(f"Wrote {len(digests)} anchors to {out}", flush=True)
    print(f"Digest {manifest}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
