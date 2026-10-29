"""Draw a web-computed ComposeSpec (kind=stream_band) — no layout math here."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

_FONTS = Path(__file__).resolve().parent.parent / "v3" / "fonts"
if not _FONTS.is_dir():
    _FONTS = Path(__file__).resolve().parent.parent / "prototype" / "v3" / "fonts"
_FONT_FILES = {
    "Anton": "Anton-Regular.ttf",
    "Montserrat Black": "Montserrat-Black.ttf",
    "Poppins": "Poppins-ExtraBold.ttf",
}
_EMOJI = Path("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf")


def spec_active(spec: dict | None) -> bool:
    return (
        os.environ.get("EXPORT_COMPOSE_SPEC", "0") == "1"
        and isinstance(spec, dict)
        and spec.get("v") == 1
        and spec.get("kind") == "stream_band"
    )


def _rgba(hex_color: str, a: int = 255) -> tuple[int, int, int, int]:
    h = (hex_color or "#FFFFFF").lstrip("#")
    return (
        (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
        if len(h) == 6
        else (255, 255, 255, a)
    )


def _font(name: str, px: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(_FONTS / _FONT_FILES.get(name, "Anton-Regular.ttf")), max(1, int(px)))


def _is_emoji(ch: str) -> bool:
    o = ord(ch)
    return 0x1F300 <= o <= 0x1FAFF or 0x2600 <= o <= 0x27BF


def _draw_line(
    im: Image.Image,
    cx: float,
    cy: float,
    line: str,
    font: ImageFont.FreeTypeFont,
    px: int,
    fill,
) -> None:
    runs: list[tuple[bool, str]] = []
    for ch in line:
        e = _is_emoji(ch)
        if runs and runs[-1][0] == e:
            runs[-1] = (e, runs[-1][1] + ch)
        else:
            runs.append((e, ch))
    widths = [(len(t) * px * 1.25) if e else font.getlength(t) for e, t in runs]
    x = cx - sum(widths) / 2
    d = ImageDraw.Draw(im)
    for (e, t), w in zip(runs, widths):
        if e and _EMOJI.is_file():
            ef = ImageFont.truetype(str(_EMOJI), 109)
            for ch in t:
                g = Image.new("RGBA", (136, 128), (0, 0, 0, 0))
                ImageDraw.Draw(g).text((0, 0), ch, font=ef, embedded_color=True)
                g = g.resize((int(px * 1.25), int(px * 1.17)))
                im.alpha_composite(g, (int(x), int(cy - g.height / 2)))
                x += px * 1.25
        else:
            d.text((x, cy), t, font=font, fill=fill, anchor="lm")
            x += w


def render_headline_png(h: dict, dest: Path) -> Path:
    w, hgt, r = int(h["w"]), int(h["h"]), int(h.get("radiusPx") or 0)
    im = Image.new("RGBA", (w, hgt), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if r > 0:
        d.rounded_rectangle([0, 0, w - 1, hgt - 1], radius=r, fill=_rgba(h["boxColor"]))
    else:
        d.rectangle([0, 0, w - 1, hgt - 1], fill=_rgba(h["boxColor"]))
    px = int(h["fontPx"])
    font = _font(h["font"], px)
    line_h = px * float(h.get("lineHeight") or 1.04)
    y0 = (hgt - line_h * len(h["lines"])) / 2
    for i, line in enumerate(h["lines"]):
        _draw_line(im, w / 2, y0 + line_h * (i + 0.5), line, font, px, _rgba(h["textColor"]))
    im.save(dest)
    return dest


def render_pill_png(
    rect: dict,
    text: str,
    color: str,
    font_name: str,
    font_px: int,
    dest: Path,
    logo: Path | None = None,
    logo_px: int = 0,
    pad_x: int = 0,
    gap: int = 0,
) -> Path:
    w, hgt = int(rect["w"]), int(rect["h"])
    im = Image.new("RGBA", (w, hgt), _rgba(color))
    x = pad_x
    if logo and logo.is_file():
        lg = Image.open(logo).convert("RGBA").resize((logo_px, logo_px))
        im.alpha_composite(lg, (pad_x, (hgt - logo_px) // 2))
        x = pad_x + logo_px + gap
    if text:
        f = _font(font_name, font_px)
        while f.getlength(text) > w - x - pad_x and font_px > 8:
            font_px -= 1
            f = _font(font_name, font_px)
        cx = x + (w - x - pad_x) / 2 if logo else w / 2
        ImageDraw.Draw(im).text((cx, hgt / 2), text, font=f, fill=(255, 255, 255, 255), anchor="mm")
    im.save(dest)
    return dest


def render_stream_band(src: Path, dest: Path, spec: dict, work: Path, duration_s: float) -> None:
    """src = RAW cut source (any aspect, normally 16:9). Output = spec.playW x spec.playH."""
    w, hgt, v = int(spec["playW"]), int(spec["playH"]), spec["video"]
    b = float(spec["bg"].get("brightness", 0.92))
    fc = [
        f"[0:v]scale={w}:{hgt}:force_original_aspect_ratio=increase,crop={w}:{hgt},boxblur=20:2,"
        f"colorchannelmixer=rr={b}:gg={b}:bb={b}[bg]",
        f"[0:v]scale={v['w']}:{v['h']}:force_original_aspect_ratio=increase,crop={v['w']}:{v['h']}[vid]",
        f"[bg][vid]overlay={v['x']}:{v['y']}[s0]",
    ]
    inputs: list[Path] = []
    overlays: list[tuple[Path, dict, str]] = []
    if spec.get("headline"):
        overlays.append(
            (render_headline_png(spec["headline"], work / "spec_headline.png"), spec["headline"], "")
        )
    if spec.get("badge"):
        bd = spec["badge"]
        logo = Path(__file__).resolve().parent.parent / "assets" / "brand" / (
            "kick_black_128.png" if bd["platform"] == "kick" else "twitch_white_128.png"
        )
        overlays.append(
            (
                render_pill_png(
                    bd,
                    bd["text"],
                    bd["color"],
                    "Montserrat Black",
                    int(bd["fontPx"]),
                    work / "spec_badge.png",
                    logo if bd["showLogo"] else None,
                    int(bd["logoPx"]),
                    int(bd["padX"]),
                    int(bd["gap"]),
                ),
                bd,
                "",
            )
        )
    for i, st in enumerate(spec.get("stickers") or []):
        en = ""
        if st["timing"] == "intro":
            en = f":enable='between(t,0,{st['durationMs'] / 1000:.3f})'"
        elif st["timing"] == "outro":
            en = f":enable='gte(t,{max(0.0, duration_s - st['durationMs'] / 1000):.3f})'"
        overlays.append(
            (
                render_pill_png(
                    st,
                    st["text"],
                    st["color"],
                    "Montserrat Black",
                    max(14, int(st["h"]) // 3),
                    work / f"spec_sticker_{i}.png",
                ),
                st,
                en,
            )
        )
    last = "s0"
    for i, (png, rect, en) in enumerate(overlays, start=1):
        inputs.append(png)
        fc.append(f"[{last}][{i}:v]overlay={int(rect['x'])}:{int(rect['y'])}:format=auto{en}[s{i}]")
        last = f"s{i}"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src)]
    for p in inputs:
        cmd += ["-loop", "1", "-i", str(p)]
    cmd += [
        "-filter_complex",
        ";".join(fc),
        "-map",
        f"[{last}]",
        "-map",
        "0:a?",
        "-shortest",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "copy",
        str(dest),
    ]
    subprocess.check_call(cmd)
    print(
        f"[clipper:compose_spec] applied kind=stream_band video_y={v['y']} "
        f"headline_h={(spec.get('headline') or {}).get('h')} "
        f"font_px={(spec.get('headline') or {}).get('fontPx')}",
        flush=True,
    )
