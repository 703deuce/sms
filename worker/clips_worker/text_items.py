"""E4 text items (Text lane) → ASS, burned in the hook stage (after captions / brand logo).

Mirror of new-app/lib/clips/editor/text-items.ts + components/clips/editor/text-items-preview.tsx:
  * (x, y) = anchor in % of the frame = the CENTRE of the text block. E4fix: align left / right only
    aligns the lines inside the block (CapCut / Descript); the block never moves. Export: \\an4 / \\an6
    at anchor ∓ half the block width (font metrics, caption_fit), \\org at the anchor for rotation
  * sizes are px at a 1920 px tall frame → ASS px = v · H / 1920 (PlayRes = output size)
  * stroke → Outline, shadow → Shadow depth + BackColour alpha, box → a BorderStyle 3 event on the
    layer below with a transparent fill (so stroke and box can both show, like CapCut)
  * keyframes (target ``text:<id>``, item-local ms) → one event per output frame (as the E3 hook)
"""
from __future__ import annotations

import math
from pathlib import Path

from clips_worker.motion import MOTION_FPS, has_motion, layer_transform_at, layer_z
from clips_worker.text_anim import fit_durations, frame_anim, norm_anim, split_units, unit_state
from clips_worker.tracks import layer_order, spans_tracks

# EP1: canonical libass family names (name ID 1 of the bundled faces). fontconfig matched the
# typographic family "Montserrat" / "Poppins" too, but libass-wasm (editor preview) only matches
# these, so the export and the preview now name the same face.
TEXT_FONTS = {
    "Montserrat": "Montserrat Black",
    "Anton": "Anton",
    "Poppins": "Poppins ExtraBold",
    "Bangers": "Bangers",
    "Bebas Neue": "Bebas Neue",
    "Archivo Black": "Archivo Black",
    "Luckiest Guy": "Luckiest Guy",
}
REF_H = 1920
_AN = {"left": 4, "center": 5, "right": 6}
# caption_font_metrics.json row for each text font (fontconfig family → bundled face).
_METRIC_FONT = {"Montserrat": "Montserrat Black", "Poppins": "Poppins ExtraBold"}


GRADIENT_BANDS = 24
LINE_HEIGHT_MIN, LINE_HEIGHT_MAX = 0.7, 2.5
LETTER_SPACING_MIN, LETTER_SPACING_MAX = -20, 100
MAX_MARKS = 50
_BAD_FAMILY = set(',{}\\\r\n\t')


def user_font_id(font) -> str | None:
    """G3b: ``user:<id>`` → id of a workspace font (clip_fonts row), else None."""
    f = str(font or "")
    if not f.startswith("user:"):
        return None
    fid = f[5:]
    if not (1 <= len(fid) <= 64) or not all(c.isalnum() and c.isascii() or c in "_-" for c in fid):
        return None
    return fid


def safe_family(v) -> str:
    """ASS-safe family name (no commas / override braces / backslashes), ≤ 64 chars."""
    return "".join(c for c in str(v or "") if c not in _BAD_FAMILY).strip()[:64]


def font_names(st: dict) -> tuple[str, str]:
    """(Style Fontname, caption_fit metrics name) of a text style. G3b: user fonts use their
    family name (style.fontFamily, the clip_fonts row's name) for both."""
    font = str(st.get("font") or "")
    if user_font_id(font):
        fam = safe_family(st.get("fontFamily"))
        if fam:
            return fam, fam
    if font not in TEXT_FONTS:
        font = "Montserrat"
    return TEXT_FONTS[font], _METRIC_FONT.get(font, font)


def letter_spacing_px(st: dict, h: int) -> float:
    try:
        v = float(st.get("letterSpacing") or 0)
    except (TypeError, ValueError):
        return 0.0
    if v != v or not v:
        return 0.0
    return _px(min(LETTER_SPACING_MAX, max(LETTER_SPACING_MIN, v)), h)


def line_height_mult(st: dict) -> float:
    """1.0 = libass' own line spacing (one event); anything else lays lines out one event each."""
    try:
        v = float(st.get("lineHeight") or 1)
    except (TypeError, ValueError):
        return 1.0
    if v != v:
        return 1.0
    return round(min(LINE_HEIGHT_MAX, max(LINE_HEIGHT_MIN, v)), 2)


def gradient_of(st: dict) -> dict | None:
    g = st.get("gradient")
    if not isinstance(g, dict):
        return None
    from clips_worker.text_shapes import is_hex

    a, b = g.get("from"), g.get("to")
    if not (is_hex(a) and is_hex(b)):
        return None
    return {"from": a, "to": b, "dir": "h" if g.get("dir") == "h" else "v"}


def text_block_width_px(text: str, font_id: str, fontsize: float, spacing: float = 0.0) -> float:
    """Advance width of the widest line at ASS ``fontsize`` (same metrics as the preview).
    ``font_id`` is a TEXT_FONTS id or (G3b) a metrics name; ``spacing`` = ASS Spacing px per char."""
    from clips_worker.caption_fit import text_width_px

    name = _METRIC_FONT.get(font_id, font_id)
    return max((text_width_px(line, name, fontsize) + spacing * len(line) for line in str(text).split("\n")), default=0.0)


def _align_dx(align: str, block_w: float) -> float:
    """\\pos x offset from the block centre for the alignment point of \\an4 / \\an6."""
    if align == "left":
        return -block_w / 2
    if align == "right":
        return block_w / 2
    return 0.0


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
    from clips_worker.text_shapes import item_kind, shape_spec

    raw = edits.get("textItems")
    if not isinstance(raw, list):
        return []
    out = []
    for it in raw:
        if not isinstance(it, dict) or not it.get("id"):
            continue
        # G3b: shapes / stickers / progress bars have no text.
        if item_kind(it) == "text":
            if not str(it.get("text") or "").strip():
                continue
        elif shape_spec(it) is None:
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
    font = font_names(st)[0]
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
    sp = letter_spacing_px(st, h) or 0
    text_style = (f"Style: T{i},{font},{size},{primary},{primary},{outline_c},{back_c},0,0,0,0,100,100,{sp},0,1,"
                  f"{outline_w},{shadow_d},{an},0,0,0,1")
    box_style = None
    if box:
        box_c = _ass_color(box.get("color") or "#000000", _alpha_for_opacity(box.get("opacity", 100)))
        pad = _px(box.get("pad") or 0, h)
        box_style = (f"Style: B{i},{font},{size},&HFF000000,&HFF000000,{box_c},&HFF000000,0,0,0,0,100,100,{sp},0,3,"
                     f"{pad},0,{an},0,0,0,1")
    return text_style, box_style


def _anchor(it: dict, w: int, h: int) -> tuple[float, float]:
    return float(it.get("x", 50)) * w / 100, float(it.get("y", 50)) * h / 100


_IDENT = {"x": 0.0, "y": 0.0, "scale": 100.0, "rotation": 0.0, "opacity": 100.0}


def norm_marks(raw, n: int) -> list[dict]:
    """G3b: bold / italic ranges [{s, e, b?, i?}] in code points of item.text (UI → normalizer)."""
    out: list[dict] = []
    for m in raw if isinstance(raw, list) else []:
        if not isinstance(m, dict) or not (m.get("b") is True or m.get("i") is True):
            continue
        try:
            s0, e0 = int(m["s"]), int(m["e"])
        except (KeyError, TypeError, ValueError):
            continue
        s0, e0 = max(0, s0), min(n, e0)
        if e0 <= s0:
            continue
        out.append({"s": s0, "e": e0, **({"b": True} if m.get("b") is True else {}), **({"i": True} if m.get("i") is True else {})})
        if len(out) >= MAX_MARKS:
            break
    return out


def rich_chars(it: dict, upper: bool) -> list[tuple[str, int]]:
    """Display characters with mark bits (1 = bold, 2 = italic); upper-casing keeps each char's bits."""
    text = str(it["text"])
    flags = [0] * len(text)
    for m in norm_marks(it.get("marks"), len(text)):
        bit = (1 if m.get("b") else 0) | (2 if m.get("i") else 0)
        for k in range(m["s"], m["e"]):
            flags[k] |= bit
    out: list[tuple[str, int]] = []
    for ch, f in zip(text, flags):
        for c in (ch.upper() if upper else ch):
            out.append((c, f))
    return out


def _mark_tag(old: int, new: int) -> str:
    t = ""
    if (old ^ new) & 1:
        t += "\\b1" if new & 1 else "\\b0"
    if (old ^ new) & 2:
        t += "\\i1" if new & 2 else "\\i0"
    return "{" + t + "}"


def rich_lines(chars: list[tuple[str, int]], pieces: list[tuple[str, bool]], tags: list[str | None],
               per_line: bool) -> list[str]:
    """ASS body of the display text: each piece's tag (unit alpha …) before it, \\b / \\i toggles
    where the marks change. per_line → one string per line (marks re-opened on each line), else one
    string with \\N breaks."""
    lines = [""]
    state = 0
    pos = 0
    for (piece, _u), tag in zip(pieces, tags):
        if tag:
            lines[-1] += tag
        for ch in piece:
            f = chars[pos][1] if pos < len(chars) else 0
            pos += 1
            if ch == "\n":
                if per_line:
                    lines.append("")
                    state = 0
                else:
                    lines[-1] += "\\N"
                continue
            if f != state:
                lines[-1] += _mark_tag(state, f)
                state = f
            lines[-1] += _esc(ch)
    return lines


def _unit_tags(txt: str, unit: dict, op: float, shadow_a: int, scale: float, box_a: int | None) -> tuple[list, list[str | None]]:
    """G3a per line / word / character alpha (+ pop height) tags. box_a set → the BOX layer: \\3a per
    unit (G3b: the box fades with its unit; separators take the next unit's tag)."""
    pieces = split_units(txt, unit["unit"])
    n = sum(1 for _, u in pieces if u)
    tags: list[str | None] = []
    k = 0
    for piece, is_unit in pieces:
        if not is_unit:
            tags.append(None)
            continue
        kk = n - 1 - k if unit["rev"] else k
        uo, us = unit_state(unit["type"], kk, n, unit["t"], unit["d"])
        o = op * uo
        if box_a is None:
            a = round(255 * (1 - o))
            a_sh = round(255 - (255 - shadow_a) * o)
            tag = rf"\1a&H{a:02X}&\3a&H{a:02X}&\4a&H{a_sh:02X}&"
        else:
            a_b = round(255 - (255 - box_a) * o)
            tag = rf"\3a&H{a_b:02X}&"
        if us != 1.0:
            tag += rf"\fscy{round(scale * us, 2)}"
        tags.append("{" + tag + "}")
        k += 1
    if box_a is not None:
        nxt = None
        for j in range(len(tags) - 1, -1, -1):
            if pieces[j][1]:
                nxt = tags[j]
            elif nxt:
                tags[j] = nxt
    return pieces, tags


def _gradient_bands(g: dict, cx: float, cy: float, bw: float, bh: float, w: int, h: int) -> list[str]:
    """G3b gradient text: GRADIENT_BANDS screen-space \\clip stripes over the block (top → bottom or
    left → right) partitioning the frame, each with its interpolated \\1c (libass has no gradients)."""
    n = GRADIENT_BANDS
    a = g["from"].lstrip("#")
    b = g["to"].lstrip("#")
    ca = [int(a[0:2], 16), int(a[2:4], 16), int(a[4:6], 16)]
    cb = [int(b[0:2], 16), int(b[2:4], 16), int(b[4:6], 16)]
    vert = g["dir"] == "v"
    lim = h if vert else w
    lo = (cy - bh / 2) if vert else (cx - bw / 2)
    span = bh if vert else bw
    edges = [0] + [min(lim, max(0, round(lo + span * k / n))) for k in range(1, n)] + [lim]
    out: list[str] = []
    for k in range(n):
        e0, e1 = edges[k], edges[k + 1]
        if e1 <= e0:
            continue
        t = k / (n - 1)
        r, gg, bb = (round(ca[j] + (cb[j] - ca[j]) * t) for j in range(3))
        clip = rf"\clip(0,{e0},{w},{e1})" if vert else rf"\clip({e0},0,{e1},{h})"
        out.append(clip + rf"\1c&H{bb:02X}{gg:02X}{r:02X}&")
    return out


def text_items_ass(edits: dict, *, w: int, h: int, fps: int = MOTION_FPS) -> str | None:
    from clips_worker.text_shapes import item_kind

    items = text_items(edits)
    if not items:
        return None
    # G1a: with any stacking order set, events go bottom → top and each item gets its own pair of
    # layers (box 2k, text 2k+1) so a box never covers text above it. Without z: E4 bytes unchanged.
    z_of = lambda tid: layer_z(edits, f"text:{tid}")  # noqa: E731
    # G1b: items on several text tracks stack by track (tracks.layer_order) — same layer pairs.
    z_on = any(z_of(it["id"]) for it in items) or spans_tracks(edits, "text", [str(it["id"]) for it in items])
    if z_on:
        items = layer_order(edits, "text", items, z_of)
    styles: list[str] = []
    events: list[str] = []
    for i, it in enumerate(items):
        ts, bs = _styles_for(i, it, h)
        lt, lb = (2 * i + 1, 2 * i) if z_on else (1, 0)
        if item_kind(it) != "text":
            from clips_worker.text_shapes_ass import shape_item_events

            styles.append(ts)
            events.extend(shape_item_events(i, it, edits, w=w, h=h, fps=fps, layer=lt))
            continue
        styles.append(ts)
        if bs:
            styles.append(bs)
        st = it["style"]
        chars = rich_chars(it, st.get("case") == "upper")
        txt = "".join(c for c, _ in chars)
        ax, ay = _anchor(it, w, h)
        align = str(st.get("align") or "center")
        an = _AN.get(align, 5)
        metric = font_names(st)[1]
        fsize = max(1, round(float(st.get("size") or 96) * h / REF_H))
        sp = letter_spacing_px(st, h)
        grad = gradient_of(st)
        lhm = line_height_mult(st)
        per_line = lhm != 1.0
        n_lines = txt.count("\n") + 1
        lh = fsize * lhm
        block_w = text_block_width_px(txt, metric, fsize, sp) if (an != 5 or (grad and grad["dir"] == "h")) else 0.0
        block_h = n_lines * lh
        layers = [(lt, f"T{i}")] + ([(lb, f"B{i}")] if bs else [])
        target = f"text:{it['id']}"
        start, end = it["startMs"], it["endMs"]
        motion = has_motion(edits, target)
        anim = norm_anim(it.get("anim"))
        plain = [(txt, False)]
        plain_lines = rich_lines(chars, plain, [None], per_line)

        def line_y(j: int, cy: float, scale: float) -> int:
            return round(cy + (j - (n_lines - 1) / 2) * lh * scale / 100)

        def emit(layer: int, style: str, s_cs: int, e_cs: int, tag_of, bodies: list[str], cy: float, scale: float,
                 bands: list[str] | None) -> None:
            for band in (bands or [""]) if style.startswith("T") else [""]:
                if per_line:
                    for j, body in enumerate(bodies):
                        events.append(f"Dialogue: {layer},{_ts(s_cs)},{_ts(e_cs)},{style},,0,0,0,,{tag_of(line_y(j, cy, scale), band)}{body}")
                else:
                    events.append(f"Dialogue: {layer},{_ts(s_cs)},{_ts(e_cs)},{style},,0,0,0,,{tag_of(None, band)}{bodies[0]}")

        sx = round(ax + _align_dx(align, block_w))

        def static_tag(yy, band):
            return rf"{{\an{an}\pos({sx},{round(ay) if yy is None else yy}){band}}}"

        static_bands = _gradient_bands(grad, ax, ay, block_w, block_h, w, h) if grad else None
        if not motion and not anim:
            for layer, style in layers:
                emit(layer, style, start // 10, end // 10, static_tag, plain_lines, ay, 100.0, static_bands)
            continue
        shadow = st.get("shadow") if isinstance(st.get("shadow"), dict) else None
        shadow_a = _alpha_for_opacity(shadow.get("opacity", 100)) if shadow else 255
        box = st.get("box") if isinstance(st.get("box"), dict) else None
        box_a = _alpha_for_opacity(box.get("opacity", 100)) if box else 255
        f0 = int(math.ceil(start * fps / 1000 - 1e-9))
        f1 = int(math.ceil(end * fps / 1000 - 1e-9))
        d_in, d_out = fit_durations(anim, end - start) if anim else (0, 0)
        # G3a: without keyframes / loop only the in + out windows go per frame; the rest is one
        # static event (same \an\pos as an un-animated item) so files stay small.
        if motion or (anim and "loop" in anim):
            spans = [(f0, f1)]
            mid = None
        else:
            fi = int(math.ceil((start + d_in) * fps / 1000 - 1e-9)) if d_in else f0
            fo = int(math.ceil((end - d_out) * fps / 1000 - 1e-9)) if d_out else f1
            fo = max(fo, fi)
            spans = [(f0, fi), (fo, f1)]
            cs_a = int(math.floor(fi * 100 / fps + 1e-9)) if d_in else start // 10
            cs_b = int(math.floor(fo * 100 / fps + 1e-9)) if d_out else end // 10
            mid = (cs_a, cs_b) if cs_b > cs_a else None
        for si, (fa_, fb_) in enumerate(spans):
            if si == 1 and mid:
                for layer, style in layers:
                    emit(layer, style, mid[0], mid[1], static_tag, plain_lines, ay, 100.0, static_bands)
            for f in range(fa_, fb_):
                t_ms = f * 1000 / fps
                s_cs = int(math.floor(f * 100 / fps + 1e-9))
                e_cs = int(math.floor((f + 1) * 100 / fps + 1e-9))
                if e_cs <= s_cs:
                    continue
                tf = layer_transform_at(edits, target, t_ms - start) if motion else dict(_IDENT)
                unit = None
                if anim:
                    fa = frame_anim(anim, t_ms, start, end, d_in, d_out)
                    tf = {"x": tf["x"] + fa["dx"], "y": tf["y"] + fa["dy"], "scale": tf["scale"] * fa["sc"],
                          "rotation": tf["rotation"] + fa["rot"], "opacity": tf["opacity"] * fa["op"]}
                    unit = fa["unit"]
                op = max(0.0, min(1.0, tf["opacity"] / 100))
                a_txt = round(255 * (1 - op))
                a_sh = round(255 - (255 - shadow_a) * op)
                a_box = round(255 - (255 - box_a) * op)
                cxf = ax + tf["x"] * w / 100
                cyf = ay + tf["y"] * h / 100
                px = round(cxf)
                py = round(cyf)
                sc = round(tf["scale"], 2)
                rot = round(-tf["rotation"], 2)
                # Scale about the block centre (the anchor): the \\an4/6 point moves with the scaled width.
                pxa = round(cxf + _align_dx(align, block_w * tf["scale"] / 100))
                if unit:
                    pieces, ttags = _unit_tags(txt, unit, op, shadow_a, tf["scale"], None)
                    t_lines = rich_lines(chars, pieces, ttags, per_line)
                    b_lines = rich_lines(chars, *_unit_tags(txt, unit, op, shadow_a, tf["scale"], box_a), per_line) if bs else plain_lines
                else:
                    t_lines = b_lines = plain_lines
                bands = _gradient_bands(grad, cxf, cyf, block_w * tf["scale"] / 100, block_h * tf["scale"] / 100, w, h) if grad else None
                for layer, style in layers:
                    if style.startswith("T"):
                        alpha = rf"\1a&H{a_txt:02X}&\3a&H{a_txt:02X}&\4a&H{a_sh:02X}&"
                        bodies = t_lines
                    else:
                        alpha = rf"\1a&HFF&\3a&H{a_box:02X}&\4a&HFF&"
                        bodies = b_lines

                    def tag_of(yy, band, _alpha=alpha):
                        y = py if yy is None else yy
                        return rf"{{\an{an}\pos({pxa},{y})\org({px},{py})\fscx{sc}\fscy{sc}\frz{rot}{_alpha}{band}}}"

                    emit(layer, style, s_cs, e_cs, tag_of, bodies, cyf, tf["scale"], bands)
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
    from clips_worker.user_fonts import fonts_dir_for

    # G3b: bundled fonts + the workspace fonts the items use (user_fonts.prepare_user_fonts).
    burn_ass(video, ass_path, out, fontsdir=fonts_dir_for(edits))
    print(f"[clipper:text_items] n={len(text_items(edits))}", flush=True)
    return out
