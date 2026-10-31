"""Preset-driven ASS caption generator (PlayRes matches output)."""
from __future__ import annotations

import copy
import os
import re
from pathlib import Path

from clips_worker.caption_fit import (
    apply_line_scale,
    caption_safe_width_px,
    fit_caption_line,
    fit_reference_frame,
    join_caption_parts,
    round_half_up,
)
from clips_worker.caption_presets import resolve_preset
from clips_worker.caption_safe_area import clamp_caption_export_style

POP_TAG = r"\fscx85\fscy85\t(0,80,\fscx112\fscy112)\t(80,160,\fscx100\fscy100)"
BOUNCE_TAG = r"\fscy70\t(0,90,\fscy118)\t(90,180,\fscy100)"
GLOW_TAG = r"{\blur4\t(0,200,\blur9)\t(200,400,\blur4)}"

_V3_FONTS = Path(__file__).resolve().parent.parent / "v3" / "fonts"
if not (_V3_FONTS / "Poppins-ExtraBold.ttf").is_file():
    _V3_FONTS = Path(__file__).resolve().parent.parent / "prototype" / "v3" / "fonts"
_T6_FONTS = Path(__file__).resolve().parent.parent / "v3" / "fonts" / "t6"
if not (_T6_FONTS / "Lato.ttf").is_file():
    _T6_FONTS = Path(__file__).resolve().parent.parent / "prototype" / "v3" / "fonts" / "t6"
_ASS_FONT_FILES: dict[str, Path] = {
    "Poppins ExtraBold": _V3_FONTS / "Poppins-ExtraBold.ttf",
    "Anton": _V3_FONTS / "Anton-Regular.ttf",
    "Montserrat Black": _V3_FONTS / "Montserrat-Black.ttf",
    "Bangers": _T6_FONTS / "Bangers.ttf",
    "Inter": _T6_FONTS / "Inter.ttf",
    "Lato": _T6_FONTS / "Lato.ttf",
    # EP1: Lato.ttf is the Black weight; its Windows name ID 1 is "Lato Black" (libass-wasm matches
    # only that; fontconfig matches both) → canonical "Lato Black" so preview == export.
    "Lato Black": _T6_FONTS / "Lato.ttf",
    "Bebas Neue": _T6_FONTS / "BebasNeue.ttf",
    "Luckiest Guy": _T6_FONTS / "LuckiestGuy.ttf",
    "Archivo Black": _T6_FONTS / "ArchivoBlack.ttf",
    "Oswald": _T6_FONTS / "Oswald.ttf",
}
_ASS_FONT_ALIASES: dict[str, str] = {
    "Poppins": "Poppins ExtraBold",
    "Anton": "Anton",
    "Montserrat Black": "Montserrat Black",
    "Montserrat": "Montserrat Black",
    "Bangers": "Bangers",
    "Inter": "Inter",
    "Lato": "Lato Black",
    "Lato Black": "Lato Black",
    "Bebas Neue": "Bebas Neue",
    "Luckiest Guy": "Luckiest Guy",
    "Archivo Black": "Archivo Black",
    "Oswald": "Oswald",
}


def resolve_ass_font_name(edits_captions: dict, preset: dict) -> str:
    raw = str(edits_captions.get("font") or preset.get("font") or "Poppins").strip()
    canonical = _ASS_FONT_ALIASES.get(raw, raw)
    path = _ASS_FONT_FILES.get(canonical)
    if path and path.is_file():
        return canonical
    print(f"[captions] font_fallback requested={raw!r} using=Poppins ExtraBold")
    return "Poppins ExtraBold"


def hex_to_ass(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"&H00{b:02X}{g:02X}{r:02X}&"
    return "&H00FFFFFF&"


def hex_to_ass_inline(hex_color: str) -> str:
    """Inline override colour — leading alpha avoids libass parsing \\3c&H0047… as octal \\47."""
    h = hex_color.lstrip("#")
    if len(h) == 6:
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"&HFF{b:02X}{g:02X}{r:02X}&"
    return "&HFFFFFFFF&"


def ass_safe_highlight_hex(hex_color: str) -> str:
    """Libass treats \\47 as octal inside inline tags when the blue byte is 0x47."""
    h = hex_color.lstrip("#").upper()
    if len(h) == 6 and h[4:6] == "47":
        h = h[:4] + "48"
    return f"#{h}"


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
    """Horizontal safe area — ~90% max caption width (parity with preview)."""
    return max(54, round(play_w * 0.05))


def chunk_words(words: list[dict], wpl: int) -> list[list[dict]]:
    out: list[list[dict]] = []
    cur: list[dict] = []
    if words and all("ln" in w for w in words):
        # G3a: manual caption lines — one caption per typed / imported line (wordsPerLine ignored).
        for w in words:
            if cur and cur[-1]["ln"] != w["ln"]:
                out.append(cur)
                cur = []
            cur.append(w)
        if cur:
            out.append(cur)
        return out
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


def _luminance_hex(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return 0.5
    r, g, b = int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _contrast_ass_text(highlight_hex: str) -> str:
    return hex_to_ass("#000000" if _luminance_hex(highlight_hex) > 0.5 else "#FFFFFF")


def _full_line_box_layer_text(
    cased: list[str], active_ki: int, fill_hex: str, *, border: int = 22, breaks: list[int] | None = None
) -> str:
    bc = hex_to_ass(ass_safe_highlight_hex(fill_hex))
    parts: list[str] = []
    for xi, word in enumerate(cased):
        if xi == active_ki:
            parts.append(f"{{\\1c&H000000&\\3c{bc}\\3a&H00&\\bord{border}}}{word}")
        else:
            parts.append(f"{{\\1c&H000000&\\3c&H00000000&\\3a&HFF&\\bord0}}{word}")
    return join_caption_parts(parts, breaks or [])


CP_STALE_KEYS = (
    "presetConfig",
    "colors",
    "animation",
    "case",
    "wordsPerLine",
    "size",
    "sizePct",
    "font",
    "activeStyle",
    "highlightColor",
)


def cp_effective_captions(edits_captions: dict) -> dict:
    """T6.2: a CP preset is self-contained (font, size, case, colours, box, animation).

    edits.captions always still carries the legacy preset's keys (bold_pop: presetConfig with
    white fill + Montserrat Black, colors.a yellow, size 6.5, animation pop) because the editor
    merges and normalizeEdits re-adds defaults. Those keys turned Light BG into white-on-white
    and Boxed Bold into Bold Pop. Mirror of web caption-v2-bridge.effectiveCaptionEdits.
    """
    return {k: v for k, v in edits_captions.items() if k not in CP_STALE_KEYS}


def _cp_line_bg_text(cased: list[str], box: dict, breaks: list[int] | None = None) -> str:
    """Whole-line opaque box (BorderStyle 3 outline) in the CP box colour/opacity; text invisible."""
    h = str(box.get("color") or "#000000").lstrip("#")
    h = h if len(h) == 6 else "000000"
    color = f"&H{h[4:6]}{h[2:4]}{h[0:2]}&".upper()
    opacity = float(box.get("opacity") if box.get("opacity") is not None else 0.6)
    alpha = max(0, min(255, int(round((1.0 - opacity) * 255))))
    pad = int(box.get("padX") or 14)
    return f"{{\\1a&HFF&\\3c{color}\\3a&H{alpha:02X}&\\bord{pad}\\shad0}}" + join_caption_parts(cased, breaks or [])


def _append_caption_events(
    events: list[str],
    *,
    words: list[dict],
    edits_captions: dict,
    preset: dict,
    anim: str,
    wpl: int,
    case: str,
    colors: dict | None,
    emphasis: set,
    emph_scale: float,
    box: dict | None,
    play_w: int,
    play_h: int,
    position: str,
    highlight_mode: str = "color",
    fit: dict | None = None,
) -> None:
    active_style = str(edits_captions.get("activeStyle") or "").lower()
    if active_style not in ("color", "highlight", "fill"):
        active_style = ""
    highlight_mode = str(highlight_mode or preset.get("highlightMode") or "color").lower()
    if highlight_mode == "box" and not active_style:
        active_style = "highlight"
    if highlight_mode == "fill" and not active_style:
        active_style = "fill"
    if highlight_mode in ("karaoke", "karaoke_dim") and anim == "none":
        anim = "karaoke" if highlight_mode == "karaoke" else "karaoke_dim"
    highlight_hex = str(edits_captions.get("highlightColor") or preset.get("active") or "#FDE047")
    if not re.match(r"^#[0-9a-fA-F]{6}$", highlight_hex):
        highlight_hex = "#FDE047"

    chunks = chunk_words(words, wpl)
    cap_out, _, cap_ow = cap_style_colors(preset)

    for chunk_idx, chunk in enumerate(chunks):
        if not chunk:
            continue
        # E3fix: WrapStyle 2 never wraps — break / shrink chunks wider than the safe width.
        breaks, line_scale = _chunk_fit(chunk, case, fit, emphasis=emphasis, anim=anim, active_style=active_style)
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
            line = apply_line_scale(join_caption_parts(disp_words(chunk, case), breaks), line_scale)
            events.append(f"Dialogue: 1,{ts(ws)},{ts(we)},Cap,,0,0,0,,{move}{line}")
            continue

        if anim == "karaoke" or active_style == "fill":
            ws, we = float(chunk[0]["s"]), chunk_end
            parts = []
            for w, word in zip(chunk, disp_words(chunk, case), strict=True):
                dur_cs = max(1, int((float(w["e"]) - float(w["s"])) * 100))
                parts.append(f"{{\\kf{dur_cs}}}{word}")
            sec = hex_to_ass(preset["primary"])
            spk = int(chunk[0].get("spk", 0)) if chunk else 0
            pri_hex = highlight_hex if active_style == "fill" else None
            if pri_hex:
                pri = hex_to_ass(pri_hex)
            else:
                pri = active_color(preset, spk, colors)
            events.append(
                f"Dialogue: 1,{ts(ws)},{ts(we)},Cap,,0,0,0,,"
                + apply_line_scale(f"{{\\1c{pri}\\3c{cap_out}\\2c{sec}}}" + join_caption_parts(parts, breaks), line_scale)
            )
            continue

        if anim == "karaoke_dim" or highlight_mode == "karaoke_dim":
            ws, we = float(chunk[0]["s"]), chunk_end
            parts = []
            dim = hex_to_ass(preset.get("primary") or "#808080")
            for w, word in zip(chunk, disp_words(chunk, case), strict=True):
                dur_cs = max(1, int((float(w["e"]) - float(w["s"])) * 100))
                parts.append(f"{{\\kf{dur_cs}}}{word}")
            spk = int(chunk[0].get("spk", 0)) if chunk else 0
            pri = active_color(preset, spk, colors)
            events.append(
                f"Dialogue: 1,{ts(ws)},{ts(we)},Cap,,0,0,0,,"
                + apply_line_scale(
                    f"{{\\1c{pri}\\3c{cap_out}\\2c{dim}\\alpha&H40&}}" + join_caption_parts(parts, breaks), line_scale
                )
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
            use_box_layer = bool(box) and (
                preset.get("slug") == "boxed"
                or (preset.get("slug") == "highlighter" and is_emph)
                or highlight_mode == "box"
            )
            use_full_line_box = use_box_layer or active_style == "highlight"
            box_fill = highlight_hex if active_style == "highlight" else str(box.get("color", "#FDE047") if box else "#FDE047")

            cased = disp_words(chunk, case)
            parts: list[str] = []
            contrast = _contrast_ass_text(highlight_hex if active_style == "highlight" else "#FDE047")
            for xi, x in enumerate(chunk):
                word = cased[xi]
                if x is w:
                    tags = []
                    if use_full_line_box and active_style == "highlight":
                        tags.append(f"\\c{contrast}")
                        if box and str(preset.get("slug") or "").startswith("cp"):
                            tags.append("\\bord0")  # T6.2: no black stroke on the CP highlight box
                    elif use_box_layer and not use_full_line_box:
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
                    if highlight_mode == "underline" and x is w:
                        tags.append("\\u1")
                    if highlight_mode == "supersize" and x is w:
                        tags.append("\\fscx125\\fscy125")
                    if is_emph and not use_box_layer:
                        sc = int(emph_scale * 100)
                        tags.append(f"\\fscx{sc}\\fscy{sc}")
                    parts.append("{" + "".join(tags) + "}" + word)
                else:
                    inactive = inactive_inline(preset)
                    if highlight_mode == "karaoke_dim":
                        inactive = f"{{\\alpha&H60&}}{inactive}"
                    parts.append(inactive + word)

            line = apply_line_scale(join_caption_parts(parts, breaks), line_scale)
            # T6.2: CP line background (Boxed Bold, Stage, Light BG) on its own bottom layer.
            # Separate layers do not collide in libass, so bg / active box / text stay aligned.
            cp_bg = bool(box) and str(preset.get("slug") or "").startswith("cp")
            if cp_bg:
                events.append(
                    f"Dialogue: 0,{ts(w_start)},{ts(w_end)},Box,,0,0,0,,"
                    + apply_line_scale(_cp_line_bg_text(cased, box, breaks), line_scale)
                )
            if use_full_line_box:
                events.append(
                    f"Dialogue: {1 if cp_bg else 0},{ts(w_start)},{ts(w_end)},Box,,0,0,0,,"
                    + apply_line_scale(_full_line_box_layer_text(cased, ki, box_fill, breaks=breaks), line_scale)
                )
            events.append(f"Dialogue: {2 if cp_bg else 1},{ts(w_start)},{ts(w_end)},Cap,,0,0,0,,{line}")


def _chunk_fit(
    chunk: list[dict],
    case: str,
    fit: dict | None,
    *,
    emphasis: set,
    anim: str,
    active_style: str,
) -> tuple[list[int], float]:
    if not fit:
        return [], 1.0
    peak = 1.0
    if anim in ("pop", "bounce", "stomp"):
        peak = max(peak, 1.12)
    if any(int(w.get("i", -1)) in emphasis for w in chunk):
        peak = max(peak, float(fit.get("emph_scale") or 1.0))
    if str(fit.get("highlight_mode") or "") == "supersize":
        peak = max(peak, 1.25)
    pad = max(float(fit.get("outline_px") or 0), float(fit.get("box_pad_px") or 0))
    if active_style == "highlight":
        pad = max(pad, 22.0)
    return fit_caption_line(
        disp_words(chunk, case),
        font=fit.get("font"),
        fontsize=float(fit.get("fontsize") or 0),
        max_width_px=float(fit.get("max_width_px") or 0),
        peak_scale=peak,
        pad_px=pad,
    )


def build_ass(
    words: list[dict],
    edits_captions: dict,
    ass_path: Path,
    play_w: int = 720,
    play_h: int = 1280,
) -> None:
    edits_captions = clamp_caption_export_style(edits_captions if isinstance(edits_captions, dict) else {}, play_h, play_w)
    preset_id = str(edits_captions.get("presetId") or edits_captions.get("preset") or "bold_pop")
    if preset_id.startswith("cp"):
        edits_captions = cp_effective_captions(edits_captions)
    if preset_id.startswith("cp"):
        from clips_worker.t6_captions import map_v2_to_legacy_ass_preset, resolve_caption_preset_v2

        v2 = resolve_caption_preset_v2(preset_id)
        preset = copy.deepcopy(map_v2_to_legacy_ass_preset({**v2, "id": preset_id}))
    else:
        preset = copy.deepcopy(resolve_preset(preset_id))
    inline = edits_captions.get("presetConfig")
    if isinstance(inline, dict) and inline and not preset_id.startswith("cp"):
        for k, v in inline.items():
            if v is not None:
                preset[k] = v
    if edits_captions.get("font"):
        preset["font"] = edits_captions.get("font")
    emoji_by_word = edits_captions.get("emojiByWord") if isinstance(edits_captions.get("emojiByWord"), dict) else {}
    anim = (edits_captions.get("animation") or preset["animation"] or "none").lower()
    highlight_mode = str(preset.get("highlightMode") or edits_captions.get("highlightMode") or "color").lower()
    wpl = int(edits_captions.get("wordsPerLine") or preset["wordsPerLine"] or 2)
    case = (edits_captions.get("case") or preset["case"] or "upper").lower()
    case = "upper" if case == "upper" else "sentence"
    size_pct = float(edits_captions.get("size") or edits_captions.get("sizePct") or preset["sizePct"])
    if size_pct < 3:
        size_pct = float(preset["sizePct"])
    size_pct = max(3.0, min(12.0, size_pct))
    fontsize = round(size_pct / 100 * play_h)
    spec_fs = edits_captions.get("_composeSpecAssFontsize")
    if spec_fs is not None:
        fontsize = int(spec_fs)
    position = edits_captions.get("position") or preset["position"]
    margin_v = margin_v_px(play_h, float(edits_captions.get("marginVPct") or preset["marginVPct"]))
    if edits_captions.get("_assMarginV") is not None:
        margin_v = int(edits_captions["_assMarginV"])
    ass_align = alignment_for(position)
    if edits_captions.get("_assAlignment") is not None:
        ass_align = int(edits_captions["_assAlignment"])
    max_line_w = edits_captions.get("_composeSpecMaxLineWidthPx")
    if max_line_w is not None:
        max_line_w = int(max_line_w)
        margin_lr = max(0, (play_w - max_line_w) // 2)
    else:
        margin_lr = margin_lr_px(play_w)
        max_line_w = None
    colors = edits_captions.get("colors") if isinstance(edits_captions.get("colors"), dict) else None
    emphasis = set(edits_captions.get("emphasis") or [])
    emph_scale = float(preset.get("emphasisScale") or 1.15)
    box = preset.get("box")

    cap_pri, cap_out, cap_ow = cap_style_colors(preset)
    box_pri = hex_to_ass("#000000")
    box_outline = hex_to_ass(box["color"]) if box else cap_out
    box_pad = int(box.get("padX", 8)) if box else cap_ow

    font_name = resolve_ass_font_name(edits_captions, preset)
    # E3fix2: line breaking is decided in a resolution-independent reference frame (1080 px short
    # side, same aspect) so 720p / 1080p exports and the editor preview break identically.
    ref_w, ref_h, ref_k = fit_reference_frame(play_w, play_h)
    fit = {
        "font": font_name,
        "fontsize": round_half_up(int(spec_fs) * ref_k) if spec_fs is not None else round_half_up(size_pct / 100 * ref_h),
        "max_width_px": (
            round_half_up(int(max_line_w) * ref_k)
            if max_line_w is not None
            else caption_safe_width_px(ref_w)
        ),
        "outline_px": int(cap_ow or 0),
        "box_pad_px": int(box_pad or 0) if box else 0,
        "emph_scale": emph_scale,
        "highlight_mode": highlight_mode,
    }
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_w}
PlayResY: {play_h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font_name},{fontsize},{cap_pri},{cap_pri},{cap_out},&H99000000,0,0,0,0,100,100,0,0,1,{cap_ow},0,{ass_align},{margin_lr},{margin_lr},{margin_v},1
Style: Box,{font_name},{fontsize},{box_pri},{box_pri},{box_outline},&H99000000,0,0,0,0,100,100,0,0,3,{box_pad},0,{ass_align},{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events: list[str] = []
    try:
        _append_caption_events(
            events,
            words=words,
            edits_captions=edits_captions,
            preset=preset,
            anim=anim,
            wpl=wpl,
            case=case,
            colors=colors,
            emphasis=emphasis,
            emph_scale=emph_scale,
            box=box,
            play_w=play_w,
            play_h=play_h,
            position=position,
            highlight_mode=highlight_mode,
            fit=fit,
        )
    except Exception as e:
        print(f"[clipper:captions] active_style_fallback reason={type(e).__name__}")
        fallback = dict(edits_captions)
        fallback.pop("activeStyle", None)
        fallback.pop("highlightColor", None)
        events.clear()
        _append_caption_events(
            events,
            words=words,
            edits_captions=fallback,
            preset=preset,
            anim=anim,
            wpl=wpl,
            case=case,
            colors=colors,
            emphasis=emphasis,
            emph_scale=emph_scale,
            box=box,
            play_w=play_w,
            play_h=play_h,
            position=position,
            highlight_mode=highlight_mode,
            fit=fit,
        )

    ass_path.write_text(header + "\n".join(events) + "\n")
