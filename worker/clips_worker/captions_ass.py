"""Preset-driven ASS caption generator (PlayRes matches output)."""
from __future__ import annotations

import re
from pathlib import Path

from clips_worker.caption_presets import resolve_preset

POP_TAG = r"\fscx85\fscy85\t(0,80,\fscx112\fscy112)\t(80,160,\fscx100\fscy100)"
BOUNCE_TAG = r"\fscy70\t(0,90,\fscy118)\t(90,180,\fscy100)"
GLOW_TAG = r"{\blur4\t(0,200,\blur9)\t(200,400,\blur4)}"


def hex_to_ass(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"&H00{b:02X}{g:02X}{r:02X}&"
    return "&H00FFFFFF&"


def disp(text: str, case: str) -> str:
    t = text.replace("{", "(").replace("}", ")")
    return t.upper() if case == "upper" else t[0:1].upper() + t[1:] if t else t


def ts(t: float) -> str:
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def alignment_for(position: str) -> int:
    return {"bottom": 2, "middle": 5, "top": 8}.get(position, 2)


def margin_v(play_h: int, margin_pct: float) -> int:
    return max(20, int(play_h * margin_pct / 100))


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


def build_ass(
    words: list[dict],
    edits_captions: dict,
    ass_path: Path,
    play_w: int = 720,
    play_h: int = 1280,
) -> None:
    preset = resolve_preset(edits_captions.get("presetId") or edits_captions.get("preset"))
    anim = (edits_captions.get("animation") or preset["animation"] or "none").lower()
    wpl = int(edits_captions.get("wordsPerLine") or preset["wordsPerLine"] or 2)
    case = (edits_captions.get("case") or preset["case"] or "upper").lower()
    if case == "upper":
        case = "upper"
    else:
        case = "sentence"
    size_pct = float(edits_captions.get("size") or edits_captions.get("sizePct") or preset["sizePct"])
    fontsize = max(24, int(play_h * size_pct / 100))
    position = edits_captions.get("position") or preset["position"]
    margin_v_px = margin_v(play_h, float(edits_captions.get("marginVPct") or preset["marginVPct"]))
    colors = edits_captions.get("colors") if isinstance(edits_captions.get("colors"), dict) else None
    emphasis = set(edits_captions.get("emphasis") or [])
    emph_scale = float(preset.get("emphasisScale") or 1.15)

    primary = hex_to_ass(preset["primary"])
    outline = hex_to_ass(preset["outline"])
    secondary = primary

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_w}
PlayResY: {play_h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Poppins ExtraBold,{fontsize},{primary},{secondary},{outline},&H99000000,0,0,0,0,100,100,0,0,1,{preset.get('outlineW', 4)},{preset.get('shadow', 0)},{alignment_for(position)},40,40,{margin_v_px},1
Style: Box,Poppins ExtraBold,{fontsize},{primary},{secondary},{outline},&H99000000,0,0,0,0,100,100,0,0,3,{preset.get('outlineW', 4)},0,{alignment_for(position)},40,40,{margin_v_px},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []
    chunks = chunk_words(words, wpl)
    box = preset.get("box")

    for chunk in chunks:
        if not chunk:
            continue
        ws = chunk[0]["s"]
        we = chunk[-1]["e"] + 0.2
        cx = play_w // 2
        y = {"bottom": int(play_h * 0.88), "middle": play_h // 2, "top": int(play_h * 0.12)}.get(position, int(play_h * 0.88))

        if anim == "slideup":
            move = f"{{\\move({cx},{y + int(0.03 * play_h)},{cx},{y},0,150)\\fad(150,0)}}"
            line = " ".join(disp(w["w"], case) for w in chunk)
            events.append(f"Dialogue: 0,{ts(ws)},{ts(we)},Cap,,0,0,0,,{move}{line}")
            continue

        if anim == "karaoke":
            parts = []
            for w in chunk:
                dur_cs = max(1, int((w["e"] - w["s"]) * 100))
                parts.append(f"{{\\kf{dur_cs}}}{disp(w['w'], case)}")
            sec = hex_to_ass(preset["primary"])
            pri = hex_to_ass(preset["active"])
            events.append(
                f"Dialogue: 0,{ts(ws)},{ts(we)},Cap,,0,0,0,,"
                + f"{{\\1c{pri}\\3c{outline}\\2c{sec}}}"
                + " ".join(parts)
            )
            continue

        if anim == "typewriter":
            for wi, w in enumerate(chunk):
                text = disp(w["w"], case)
                dur_ms = max(1, int((w["e"] - w["s"]) * 1000))
                step = max(1, dur_ms // max(1, len(text)))
                built = ""
                for ci, ch in enumerate(text):
                    off0 = ci * step
                    off1 = min(dur_ms, off0 + step)
                    built += f"{{\\alpha&HFF&\\t({off0},{off1},\\alpha&H00&)}}{ch}"
                spk = int(w.get("spk", 0))
                col = active_color(preset, spk, colors)
                events.append(f"Dialogue: 0,{ts(w['s'])},{ts(w['e'])},Cap,,0,0,0,,{{\\c{col}}}{built}")
            continue

        for ki, w in enumerate(chunk):
            w_start = w["s"]
            w_end = chunk[ki + 1]["s"] if ki + 1 < len(chunk) else we
            spk = int(w.get("spk", 0))
            col = active_color(preset, spk, colors)
            wi = int(w.get("i", ki))
            is_emph = wi in emphasis
            parts = []
            for x in chunk:
                if x is w:
                    tags = [f"\\c{col}"]
                    if is_emph:
                        sc = int(emph_scale * 100)
                        tags.append(f"\\fscx{sc}\\fscy{sc}")
                    a = anim if not (preset["slug"] == "highlighter" and not is_emph) else ("pop" if is_emph else "none")
                    if a == "pop":
                        tags.append(POP_TAG)
                    elif a == "bounce":
                        tags.append(BOUNCE_TAG)
                    elif a == "glow":
                        tags.append(GLOW_TAG.replace("{", "").replace("}", ""))
                    parts.append("{" + "".join(tags) + "}" + disp(x["w"], case) + "{\\r}")
                else:
                    parts.append(disp(x["w"], case))
            line = " ".join(parts)
            if box and is_emph:
                pad_x = int(box.get("padX", 6))
                box_col = hex_to_ass(box["color"])
                events.append(
                    f"Dialogue: 0,{ts(w_start)},{ts(w_end)},Box,,0,0,0,,"
                    f"{{\\bord{pad_x}\\3c{box_col}\\1c{box_col}}}{disp(w['w'], case)}"
                )
            events.append(f"Dialogue: 0,{ts(w_start)},{ts(w_end)},Cap,,0,0,0,,{line}")

    ass_path.write_text(header + "\n".join(events) + "\n")
