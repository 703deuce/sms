#!/usr/bin/env python3
"""Render platform brand PNGs from SVG sources for web + worker assets."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TWITCH_SVG = REPO / "new-app/public/brand/twitch.svg"
KICK_SVG = REPO / "new-app/public/brand/kick.svg"
OUTS = [
    (TWITCH_SVG, REPO / "new-app/public/brand/twitch_white_128.png"),
    (TWITCH_SVG, REPO / "worker/assets/brand/twitch_white_128.png"),
    (KICK_SVG, REPO / "new-app/public/brand/kick_black_128.png"),
    (KICK_SVG, REPO / "worker/assets/brand/kick_black_128.png"),
]
SIZE = 128


def _render_rsvg(svg: Path, png: Path) -> None:
    png.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "rsvg-convert",
            "-w",
            str(SIZE),
            "-h",
            str(SIZE),
            "-o",
            str(png),
            str(svg),
        ],
    )


def _render_cairosvg(svg: Path, png: Path) -> None:
    import cairosvg

    png.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(url=str(svg), write_to=str(png), output_width=SIZE, output_height=SIZE)


def render_png(svg: Path, png: Path) -> None:
    if not svg.is_file():
        raise SystemExit(f"missing svg: {svg}")
    try:
        _render_rsvg(svg, png)
    except (FileNotFoundError, subprocess.CalledProcessError):
        try:
            _render_cairosvg(svg, png)
        except ImportError as exc:
            raise SystemExit(
                "install rsvg-convert (librsvg2-bin) or pip install cairosvg to run gen-brand-logos"
            ) from exc


def main() -> int:
    seen: set[Path] = set()
    for svg, png in OUTS:
        if png in seen:
            continue
        seen.add(png)
        render_png(svg, png)
        print(f"[gen-brand-logos] {png.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
