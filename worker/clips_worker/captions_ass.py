"""Preset-driven ASS caption generator (PlayRes matches output)."""
from __future__ import annotations

import os
import re
from pathlib import Path

from clips_worker.caption_presets import resolve_preset
from clips_worker.caption_safe_area import clamp_caption_export_style

POP_TAG = r"\fscx85\fscy85\t(0,80,\fscx112\fscy112)\t(80,160,\fscx100\fscy100)"
BOUNCE_TAG = r"\fscy70\t(0,90,\fscy118)\t(90,180,\fscy100)"
GLOW_TAG = r"{\blur4\t(0,200,\blur9)\t(200,400,\blur4)}"


def hex_to_ass(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"&H00{b:02X}{g:02X}{r:02X}&"
    return "&H00FFFFFF&"


def _sentence_boundary(prev: str | None) -> bool:
    if not prev:
        return True
    return bool(re.search(r'[.!?]["\')\]]*$', prev.strip()))


def disp(text: str, case: str, sentence_start: bool = False) -> str:
    t = text.replace("{", "(").replace("}", ")")
    if not t:
        return t
    if case == "upper":
        return t.upper()
    lower = t.lower()
    return lower[0:1].upper() + lower[1:] if sentence_start else lower


def disp_words(chunk: list[dict], case: str) -> list[str]:
    if case == "upper":
        return [disp(w["w"], case) for w in chunk]
    out: list[str] = []
    sentence_start = True
    for w in chunk:
        out.append(disp(w["w"], case, sentence_start))
        sentence_start = _sentence_boundary(str(w.get("w", "")))
    return out


def ts(t: float) -> str:
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def alignment_for(position: str) -> int:
    return {"bottom": 2, "middle": 5, "top": 8}.get(position, 2)


def margin_v_px(play_h: int, margin_pct: float) -> int:
    return round(play_h * margin_pct / 100)


def margin_lr_px(play_w: int) -> int:
    """Horizontal safe area so captions do not clip at frame edges."""
    return max(56, round(play_w * 0.08))


def chunk_words(words: list[dict], wpl: int) -> list[list[dict]]:
    out: list[list[dict]] = []
    cur: list[dict] = []
    for w in words:
        if cur and len(cur) >= wpl:
            out.append(cur)
            cur = []
        cur.append(w)
    if cur:
        out.append(cur)
    return out


def active_color(preset: dict, spk: int, colors: dict | None) -> str:
    if colors:
        key = "a" if spk == 0 else "b"
        if colors.get(key):
            return hex_to_ass(str(colors[key]))
    return hex_to_ass(preset["active"] if spk == 0 else preset["activeB"])


def cap_style_colors(preset: dict) -> tuple[str, str, int]:
    """Primary, outline colour, outline width for inactive Cap style."""
    if preset.get("slug") == "boxed":
        return hex_to_ass("#FFFFFF"), hex_to_ass("#000000"), 4
    return (
        hex_to_ass(preset["primary"]),
        hex_to_ass(preset["outline"]),
        int(preset.get("outlineW", 4)),
    )


def inactive_inline(preset: dict) -> str:
    pri, out, ow = cap_style_colors(preset)
    return f"{{\\1c{pri}\\3c{out}\\bord{ow}\\shad0}}"


def build_ass(
    words: list[dict],
    edits_captions: dict,
    ass_path: Path,
    play_w: int = 720,
    play_h: int = 1280,
) -> None:
    edits_captions = clamp_caption_export_style(edits_captions if isinstance(edits_captions, dict) else {}, play_h)
    preset = resolve_preset(edits_captions.get("presetId") or edits_captions.get("preset"))
    inline = edits_captions.get("presetConfig")
    if isinstance(inline, dict) and inline:
        for k, v in inline.items():
            if v is not None:
                preset[k] = v
    emoji_by_word = edits_captions.get("emojiByWord") if isinstance(edits_captions.get("emojiByWord"), dict) else {}
    anim = (edits_captions.get("animation") or preset["animation"] or "none").lower()
    wpl = int(edits_captions.get("wordsPerLine") or preset["wordsPerLine"] or 2)
    case = (edits_captions.get("case") or preset["case"] or "upper").lower()
    case = "upper" if case == "upper" else "sentence"
    size_pct = float(edits_captions.get("size") or edits_captions.get("sizePct") or preset["sizePct"])
    if size_pct < 3:
        size_pct = float(preset["sizePct"])
    size_pct = max(3.0, min(12.0, size_pct))
    fontsize = round(size_pct / 100 * play_h)
    position = edits_captions.get("position") or preset["position"]
    margin_v = margin_v_px(play_h, float(edits_captions.get("marginVPct") or preset["marginVPct"]))
    margin_lr = margin_lr_px(play_w)
    colors = edits_captions.get("colors") if isinstance(edits_captions.get("colors"), dict) else None
    emphasis = set(edits_captions.get("emphasis") or [])
    emph_scale = float(preset.get("emphasisScale") or 1.15)
    box = preset.get("box")

    cap_pri, cap_out, cap_ow = cap_style_colors(preset)
    box_pri = hex_to_ass("#000000")
    box_outline = hex_to_ass(box["color"]) if box else cap_out
    box_pad = int(box.get("padX", 8)) if box else cap_ow

    font_base = str(preset.get("font") or "Poppins")
    font_name = f"{font_base} ExtraBold" if " " not in font_base else font_base
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_w}
PlayResY: {play_h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font_name},{fontsize},{cap_pri},{cap_pri},{cap_out},&H99000000,0,0,0,0,100,100,0,0,1,{cap_ow},0,{alignment_for(position)},{margin_lr},{margin_lr},{margin_v},1
Style: Box,{font_name},{fontsize},{box_pri},{box_pri},{box_outline},&H99000000,0,0,0,0,100,100,0,0,3,{box_pad},0,{alignment_for(position)},{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []
    chunks = chunk_words(words, wpl)

    for chunk_idx, chunk in enumerate(chunks):
        if not chunk:
            continue
        chunk_end = float(chunk[-1]["e"])
        if chunk_idx + 1 < len(chunks):
            chunk_end = min(chunk_end, float(chunks[chunk_idx + 1][0]["s"]))

        if anim == "slideup":
            ws, we = float(chunk[0]["s"]), chunk_end
            cx = play_w // 2
            y = {"bottom": int(play_h * 0.88), "middle": play_h // 2, "top": int(play_h * 0.12)}.get(
                position, int(play_h * 0.88)
            )
            move = f"{{\\move({cx},{y + int(0.03 * play_h)},{cx},{y},0,150)\\fad(150,0)}}"
            line = " ".join(disp_words(chunk, case))
            events.append(f"Dialogue: 1,{ts(ws)},{ts(we)},Cap,,0,0,0,,{move}{line}")
            continue

        if anim == "karaoke":
            ws, we = float(chunk[0]["s"]), chunk_end
            parts = []
            for w, word in zip(chunk, disp_words(chunk, case), strict=True):
                dur_cs = max(1, int((float(w["e"]) - float(w["s"])) * 100))
                parts.append(f"{{\\kf{dur_cs}}}{word}")
            sec = hex_to_ass(preset["primary"])
            pri = hex_to_ass(preset["active"])
            events.append(
                f"Dialogue: 1,{ts(ws)},{ts(we)},Cap,,0,0,0,,"
                f"{{\\1c{pri}\\3c{cap_out}\\2c{sec}}}"
                + " ".join(parts)
            )
            continue

        if anim == "typewriter":
            cased = disp_words(chunk, case)
            for wi, w in enumerate(chunk):
                w_start = float(w["s"])
                w_end = float(chunk[wi + 1]["s"]) if wi + 1 < len(chunk) else chunk_end
                text = cased[wi]
                dur_ms = max(1, int((float(w["e"]) - float(w["s"])) * 1000))
                step = max(1, dur_ms // max(1, len(text)))
                built = ""
                for ci, ch in enumerate(text):
                    off0 = ci * step
                    off1 = min(dur_ms, off0 + step)
                    built += f"{{\\alpha&HFF&\\t({off0},{off1},\\alpha&H00&)}}{ch}"
                spk = int(w.get("spk", 0))
                col = active_color(preset, spk, colors)
                events.append(f"Dialogue: 1,{ts(w_start)},{ts(w_end)},Cap,,0,0,0,,{{\\c{col}}}{built}")
            continue

        for ki, w in enumerate(chunk):
            w_start = float(w["s"])
            w_end = float(chunk[ki + 1]["s"]) if ki + 1 < len(chunk) else chunk_end
            if w_end <= w_start:
                continue

            spk = int(w.get("spk", 0))
            col = active_color(preset, spk, colors)
            wi = int(w.get("i", ki))
            is_emph = wi in emphasis
            use_box_layer = bool(box) and (preset.get("slug") == "boxed" or (preset.get("slug") == "highlighter" and is_emph))

            cased = disp_words(chunk, case)
            parts: list[str] = []
            for xi, x in enumerate(chunk):
                word = cased[xi]
                if x is w:
                    tags = []
                    if use_box_layer:
                        tags.append("\\1c&H000000&")
                    else:
                        tags.append(f"\\c{col}")
                    a = anim if not (preset.get("slug") == "highlighter" and not is_emph) else ("pop" if is_emph else "none")
                    if a == "pop":
                        tags.append(POP_TAG)
                    elif a == "bounce":
                        tags.append(BOUNCE_TAG)
                    elif a == "glow":
                        tags.append(GLOW_TAG.replace("{", "").replace("}", ""))
                    if is_emph and not use_box_layer:
                        sc = int(emph_scale * 100)
                        tags.append(f"\\fscx{sc}\\fscy{sc}")
                    parts.append("{" + "".join(tags) + "}" + word)
                else:
                    parts.append(inactive_inline(preset) + word)

            line = " ".join(parts)
            if use_box_layer:
                events.append(
                    f"Dialogue: 0,{ts(w_start)},{ts(w_end)},Box,,0,0,0,,{cased[ki]}"
                )
            events.append(f"Dialogue: 1,{ts(w_start)},{ts(w_end)},Cap,,0,0,0,,{line}")
            # Color emoji export uses bundled Twemoji PNGs in burn_captions (not libass).

    ass_path.write_text(header + "\n".join(events) + "\n")
