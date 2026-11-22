"""Producer-side adapter to the same native edits renderer used by editor export.

This command is invoked by the producer runtime, not the clips-worker job lane.
All media paths are local. No URLs, credentials or transcript text are logged.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

from clips_worker.edits_render import render_edited_clip


def render_native_document(
    source: Path,
    words_path: Path,
    document_path: Path,
    output: Path,
    workdir: Path,
    broll_specs_path: Path | None = None,
) -> dict:
    body = document_path.read_bytes()
    doc = json.loads(body)
    if not isinstance(doc, dict) or doc.get("schema") != "transovo.clip-edits/2":
        raise ValueError("Expected transovo.clip-edits/2")
    edits = doc.get("edits")
    if not isinstance(edits, dict) or not isinstance(edits.get("trim"), dict):
        raise ValueError("Native edits and trim required")
    start = int(edits["trim"]["in"])
    end = int(edits["trim"]["out"])
    if start < 0 or end <= start:
        raise ValueError("Invalid absolute source trim")
    words = json.loads(words_path.read_text(encoding="utf-8"))
    if not isinstance(words, list):
        raise ValueError("Expected global source word array")
    broll_specs = None
    if broll_specs_path:
        broll_specs = json.loads(broll_specs_path.read_text(encoding="utf-8"))
        if not isinstance(broll_specs, list):
            raise ValueError("B-roll specifications must be an array")
    elif edits.get("broll"):
        raise ValueError("B-roll media must be materialized; supply --broll-specs")
    workdir.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Existing render_edited_clip expects clip-local footage while native trims and
    # transcript remain absolute source times. Materialize that exact window once.
    local_source = workdir / "producer_source_clip.mp4"
    subprocess.check_call([
        "ffmpeg", "-y", "-v", "error",
        "-ss", f"{start/1000:.6f}", "-i", str(source),
        "-t", f"{(end-start)/1000:.6f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", str(local_source),
    ])
    settings = {
        "aspectRatio": edits.get("aspectRatio", "9:16"),
        "exportResolution": "1080p",
        "layout": edits.get("layout") or {},
    }
    rendered, _render_words, srt = render_edited_clip(
        local_source, output, words, edits, start, end, settings, workdir,
        broll_specs=broll_specs, render_id="producer_native",
    )
    subtitle = output.with_suffix(".srt")
    subtitle.write_text(srt, encoding="utf-8")
    # Hash of EXACT published edits.json bytes for producer report/provenance.
    return {
        "video": str(rendered),
        "srt": str(subtitle),
        "editsSha256": hashlib.sha256(body).hexdigest(),
        "renderEngine": "transovo-edits-render/1",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Render producer clip from canonical native edits.json")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--words", type=Path, required=True)
    parser.add_argument("--edits", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--workdir", type=Path, required=True)
    parser.add_argument("--broll-specs", type=Path)
    args = parser.parse_args()
    result = render_native_document(
        args.source, args.words, args.edits, args.output, args.workdir, args.broll_specs
    )
    # Do not print paths or URLs to producer logs. Only stable metadata is safe.
    print(json.dumps({"renderEngine": result["renderEngine"],
                      "editsSha256": result["editsSha256"]}))


if __name__ == "__main__":
    main()
