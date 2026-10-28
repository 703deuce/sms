"""Twemoji PNG overlays for export (libass cannot render color emoji reliably)."""
from __future__ import annotations

from pathlib import Path

from clips_worker.emoji_whitelist import EMOJI_WHITELIST_SET

TWEMOJI_DIR = Path(__file__).resolve().parents[1] / "assets" / "twemoji"


def twemoji_codepoint(emoji: str) -> str | None:
    """Filename stem for Twemoji 14 (strip U+FE0F / U+200D per Twitter asset names)."""
    cps: list[str] = []
    for ch in emoji or "":
        cp = ord(ch)
        if cp in (0xFE0F, 0x200D):
            continue
        if cp > 0x7F or cp >= 0x1F300:
            cps.append(f"{cp:x}")
    if not cps:
        return None
    return "-".join(cps)


def twemoji_png_path(emoji: str) -> Path | None:
    if emoji not in EMOJI_WHITELIST_SET:
        return None
    stem = twemoji_codepoint(emoji)
    if not stem:
        return None
    path = TWEMOJI_DIR / f"{stem}.png"
    return path if path.is_file() else None


def emoji_events_from_words(
    words: list[dict],
    emoji_by_word: dict,
    *,
    play_w: int,
    play_h: int,
    fontsize: int,
    position: str = "bottom",
) -> list[tuple[float, float, str, int, int, Path]]:
    """(start_s, end_s, emoji, x, y, png_path) for each whitelisted word emoji."""
    events: list[tuple[float, float, str, int, int, Path]] = []
    y_base = {"bottom": int(play_h * 0.88), "middle": play_h // 2, "top": int(play_h * 0.12)}.get(
        position, int(play_h * 0.88)
    )
    size = max(32, int(fontsize * 1.2))
    cx = play_w // 2 - size // 2
    emo_y = y_base - int(fontsize * 1.6)
    for w in words:
        wi = w.get("i", w.get("idx"))
        emo = emoji_by_word.get(str(wi)) or emoji_by_word.get(wi)
        if not emo or not isinstance(emo, str):
            continue
        png = twemoji_png_path(emo.strip())
        if not png:
            continue
        t0 = float(w.get("s", 0))
        t1 = float(w.get("e", t0 + 0.4))
        events.append((t0, t1 + 0.6, emo.strip(), cx, emo_y, png))
    return events


def build_caption_burn_filter_complex(
    *,
    ass_path: Path,
    fontsdir: Path,
    emoji_events: list[tuple[float, float, str, int, int, Path]],
) -> tuple[str, list[Path], str]:
    """Single ffmpeg filter graph: ASS burn + all emoji PNG overlays. Input 0 = video; 1..N = PNGs."""
    ass_esc = str(ass_path).replace(":", r"\,")
    fonts_esc = str(fontsdir).replace(":", r"\,")
    chain = f"[0:v]ass={ass_esc}:fontsdir={fonts_esc}[v0]"
    extra_inputs: list[Path] = []
    prev = "v0"
    for i, (t0, t1, _emo, x, y, png) in enumerate(emoji_events):
        inp = i + 1
        extra_inputs.append(png)
        nxt = f"v{inp}"
        chain += (
            f";[{prev}][{inp}:v]overlay={x}:{y}:enable='between(t,{t0:.3f},{t1:.3f})'[{nxt}]"
        )
        prev = nxt
    return chain, extra_inputs, prev


# Back-compat alias
_codepoint = twemoji_codepoint
