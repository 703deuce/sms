"""T6 title style auto-pick (P4; T6.3 luminance fix)."""
from __future__ import annotations

from clips_worker.t6_registry import TITLE_STYLES

LIGHT_BG_LUMA = 0.62


def _band(signals: dict, name: str) -> dict:
    bands = signals.get("bands") if isinstance(signals.get("bands"), dict) else {}
    row = bands.get(name) if isinstance(bands.get(name), dict) else {}
    return {"luma": float(row.get("luma", 0.3) or 0.0), "busy": float(row.get("busy", 0.5) or 0.0)}


def title_backdrop_stats(spec: dict, signals: dict) -> dict:
    """T6.3: luma/busy of the SOURCE region that ends up behind the title.

    The old pick read the source's top-third luma regardless of template, so e.g. a G1 title
    (drawn over the facecam panel, sourced from the bottom of the frame) or a blurred band
    got black text over dark video. The title sits at the top of the composite: use the
    panel under it and map its source box to the measured top / caption / bottom bands.
    """
    play_h = int((spec or {}).get("playH") or 1920)
    rect = (spec or {}).get("titleRect") if isinstance((spec or {}).get("titleRect"), dict) else None
    ty = int((rect or {}).get("y") or 0)
    th = int((rect or {}).get("h") or round(play_h * 384 / 1920))
    mid = ty + th / 2
    top, cap, bot = _band(signals, "top"), _band(signals, "caption"), _band(signals, "bottom")
    for p in (spec or {}).get("panels") or []:
        d = p.get("dest") or {}
        if int(d.get("y") or 0) <= mid <= int(d.get("y") or 0) + int(d.get("h") or 0):
            src = p.get("src") or {}
            sy = float(src.get("y") or 0)
            sh = float(src.get("h") or 1)
            if str(p.get("fit") or "cover").startswith("contain") and sh > 0.6:
                # Letterboxed full frame: the title sits on the blur/black fill around it.
                break
            # (title over a cover panel: live video, not blurred)
            # Top of the panel ~ top of its source box.
            y_src = sy + sh * 0.2
            if y_src < 0.4:
                return top
            if y_src > 0.66:
                return bot
            return cap
    # Bands / letterbox fill: blurred whole frame -> average of the measured bands, but the
    # darkest band decides readability.
    return {
        "luma": min(top["luma"], cap["luma"], bot["luma"]),
        "busy": max(top["busy"], cap["busy"], bot["busy"]),
        "blurred": True,
    }


BUSY_VIDEO = 0.75


def pick_title_style(
    spec: dict,
    signals: dict,
    history: list[str],
    *,
    allowed: list[str] | None = None,
) -> tuple[str, str]:
    """T6.7: the style follows what is actually behind the title.

    - Template fixes the style (``title.allowed`` has one entry, e.g. I2 "Blur Title Box").
    - Light backdrop -> dark text on light blur.
    - Blurred band behind the title (G4/C6/I1-I4 bands): the blur removes the texture, so
      ``busy`` is irrelevant; white text on the dark blur. (The old ``busy > 0.55`` rule fired
      on every stream frame: busy was saturated, see t6_cv.BUSY_ANALYSIS_W.)
    - Title over live video (cover panel): a white box only when that video is really busy,
      otherwise the solid black bar.
    """
    _ = history
    allowed = [a for a in (allowed or []) if a in TITLE_STYLES]
    st = title_backdrop_stats(spec if isinstance(spec, dict) else {}, signals if isinstance(signals, dict) else {})
    luma, busy = st["luma"], st["busy"]
    if luma >= LIGHT_BG_LUMA:
        sid, why = "black_on_light_blur", "light_backdrop"
    elif st.get("blurred"):
        sid, why = "white_on_dark_blur", "blur_band"
    elif busy > BUSY_VIDEO:
        sid, why = "white_box_black", "busy_video"
    else:
        sid, why = "white_on_black", "dark_video"
    if allowed and sid not in allowed:
        return allowed[0], "template_allowed"
    return sid, why


def title_style(style_id: str) -> dict:
    return dict(TITLE_STYLES.get(style_id) or TITLE_STYLES["white_on_black"])
