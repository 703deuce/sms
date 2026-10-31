"""E4 text items (Text lane) → ASS, burned in the hook stage (after captions / brand logo).

Mirror of new-app/lib/clips/editor/text-items.ts + components/clips/editor/text-items-preview.tsx:
  * (x, y) = anchor in % of the frame; align left / center / right → ASS \\an4 / \\an5 / \\an6
  * sizes are px at a 1920 px tall frame → ASS px = v · H / 1920 (PlayRes = output size)
  * stroke → Outline, shadow → Shadow depth + BackColour alpha, box → a BorderStyle 3 event on the
    layer below with a transparent fill (so stroke and box can both show, like CapCut)
  * keyframes (target ``text:<id>``, item-local ms) → one event per output frame (as the E3 hook)
"""
from __future__ import annotations

import math
from pathlib import Path

from clips_worker.motion import MOTION_FPS, has_motion, layer_transform_at

TEXT_FONTS = {
    "Montserrat": "Montserrat",
    "Anton": "Anton",
    "Poppins": "Poppins",
    "Bangers": "Bangers",
    "Bebas Neue": "Bebas Neue",
    "Archivo Black": "Archivo Black",
    "Luckiest Guy": "Luckiest Guy",
}
REF_H = 1920
_AN = {"left": 4, "center": 5, "right": 6}


def _ass_color(hex_rgb: str, alpha: int = 0) -> str:
    h = str(hex_rgb or "").strip().lstrip("#")
    if len(h) != 6:
        h = "FFFFFF"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def _alpha_for_opacity(op_pct: float) -> int:
    return max(0, min(255, round(255 * (1 - max(0.0, min(100.0, float(op_pct))) / 100))))


def _ts(cs: int) -> str:
    cs = max(0, int(cs))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, c = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{c:02d}"


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\r", "").replace("\n", "\\N")


def text_items(edits: dict) -> list[dict]:
    raw = edits.get("textItems")
    if not isinstance(raw, list):
        return []
    out = []
    for it in raw:
        if not isinstance(it, dict) or not str(it.get("text") or "").strip() or not it.get("id"):
            continue
        try:
            a, b = int(round(float(it["startMs"]))), int(round(float(it["endMs"])))
        except (KeyError, TypeError, ValueError):
            continue
        if b <= a:
            continue
        out.append({**it, "startMs": a, "endMs": b, "style": it.get("style") if isinstance(it.get("style"), dict) else {}})
    return out


def has_text_items(edits: dict) -> bool:
    return bool(text_items(edits))


def _px(v, h: int) -> float:
    try:
        return round(float(v) * h / REF_H, 2)
    except (TypeError, ValueError):
        return 0.0


def _styles_for(i: int, it: dict, h: int) -> tuple[str, str | None]:
    st = it["style"]
    font = TEXT_FONTS.get(str(st.get("font") or ""), "Montserrat")
    size = max(1, round(float(st.get("size") or 96) * h / REF_H))
    an = _AN.get(str(st.get("align") or "center"), 5)
    primary = _ass_color(st.get("color") or "#FFFFFF")
    stroke = st.get("stroke") if isinstance(st.get("stroke"), dict) else None
    shadow = st.get("shadow") if isinstance(st.get("shadow"), dict) else None
    box = st.get("box") if isinstance(st.get("box"), dict) else None
    outline_c = _ass_color((stroke or {}).get("color") or "#000000")
    outline_w = _px((stroke or {}).get("width") or 0, h) if stroke else 0
    back_c = _ass_color((shadow or {}).get("color") or "#000000", _alpha_for_opacity((shadow or {}).get("opacity", 100))) if shadow else "&HFF000000"
    shadow_d = _px((shadow or {}).get("dist") or 0, h) if shadow else 0
    text_style = (f"Style: T{i},{font},{size},{primary},{primary},{outline_c},{back_c},0,0,0,0,100,100,0,0,1,"
                  f"{outline_w},{shadow_d},{an},0,0,0,1")
    box_style = None
    if box:
        box_c = _ass_color(box.get("color") or "#000000", _alpha_for_opacity(box.get("opacity", 100)))
        pad = _px(box.get("pad") or 0, h)
        box_style = (f"Style: B{i},{font},{size},&HFF000000,&HFF000000,{box_c},&HFF000000,0,0,0,0,100,100,0,0,3,"
                     f"{pad},0,{an},0,0,0,1")
    return text_style, box_style


def _anchor(it: dict, w: int, h: int) -> tuple[float, float]:
    return float(it.get("x", 50)) * w / 100, float(it.get("y", 50)) * h / 100


def text_items_ass(edits: dict, *, w: int, h: int, fps: int = MOTION_FPS) -> str | None:
    items = text_items(edits)
    if not items:
        return None
    styles: list[str] = []
    events: list[str] = []
    for i, it in enumerate(items):
        ts, bs = _styles_for(i, it, h)
        styles.append(ts)
        if bs:
            styles.append(bs)
        st = it["style"]
        txt = str(it["text"])
        if st.get("case") == "upper":
            txt = txt.upper()
        esc = _esc(txt)
        ax, ay = _anchor(it, w, h)
        an = _AN.get(str(st.get("align") or "center"), 5)
        layers = [(1, f"T{i}")] + ([(0, f"B{i}")] if bs else [])
        target = f"text:{it['id']}"
        start, end = it["startMs"], it["endMs"]
        if not has_motion(edits, target):
            tag = rf"{{\an{an}\pos({round(ax)},{round(ay)})}}"
            for layer, style in layers:
                events.append(f"Dialogue: {layer},{_ts(start // 10)},{_ts(end // 10)},{style},,0,0,0,,{tag}{esc}")
            continue
        shadow = st.get("shadow") if isinstance(st.get("shadow"), dict) else None
        shadow_a = _alpha_for_opacity(shadow.get("opacity", 100)) if shadow else 255
        box = st.get("box") if isinstance(st.get("box"), dict) else None
        box_a = _alpha_for_opacity(box.get("opacity", 100)) if box else 255
        f0 = int(math.ceil(start * fps / 1000 - 1e-9))
        f1 = int(math.ceil(end * fps / 1000 - 1e-9))
        for f in range(f0, f1):
            t_ms = f * 1000 / fps
            s_cs = int(math.floor(f * 100 / fps + 1e-9))
            e_cs = int(math.floor((f + 1) * 100 / fps + 1e-9))
            if e_cs <= s_cs:
                continue
            tf = layer_transform_at(edits, target, t_ms - start)
            op = max(0.0, min(1.0, tf["opacity"] / 100))
            a_txt = round(255 * (1 - op))
            a_sh = round(255 - (255 - shadow_a) * op)
            a_box = round(255 - (255 - box_a) * op)
            px = round(ax + tf["x"] * w / 100)
            py = round(ay + tf["y"] * h / 100)
            sc = round(tf["scale"], 2)
            rot = round(-tf["rotation"], 2)
            base = rf"\an{an}\pos({px},{py})\fscx{sc}\fscy{sc}\frz{rot}"
            for layer, style in layers:
                if style.startswith("T"):
                    tag = rf"{{{base}\1a&H{a_txt:02X}&\3a&H{a_txt:02X}&\4a&H{a_sh:02X}&}}"
                else:
                    tag = rf"{{{base}\1a&HFF&\3a&H{a_box:02X}&\4a&HFF&}}"
                events.append(f"Dialogue: {layer},{_ts(s_cs)},{_ts(e_cs)},{style},,0,0,0,,{tag}{esc}")
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""
    return header + "\n".join(styles) + "\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + "\n".join(events) + "\n"


def apply_text_items(video: Path, out: Path, edits: dict, *, play_w: int, play_h: int) -> Path:
    ass = text_items_ass(edits, w=play_w, h=play_h)
    if not ass:
        return video
    from clips_worker.t2v.titles_ass import burn_ass

    ass_path = out.parent / "text_items.ass"
    ass_path.write_text(ass, encoding="utf-8")
    burn_ass(video, ass_path, out)
    print(f"[clipper:text_items] n={len(text_items(edits))}", flush=True)
    return out
