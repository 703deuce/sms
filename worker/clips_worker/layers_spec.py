"""Layers v3 schema (derived from legacy edits in T1)."""
from __future__ import annotations

import copy
import json
from typing import Any
from urllib.parse import urlparse

from clips_worker.layout_router import editor_mode_uses_stream_frame


def _layout_mode(edits: dict) -> str:
    return str((edits.get("layout") or {}).get("mode") or "speaker_follow")


def _placement(edits: dict) -> str:
    return "fit_top_band" if _layout_mode(edits) == "fit_top" else "export_bar"


def _handle_from_url(url: str) -> str | None:
    u = (url or "").strip()
    if not u:
        return None
    try:
        path = urlparse(u).path or u
    except Exception:
        path = u
    seg = path.rstrip("/").split("/")[-1]
    return seg or None


def _headline_layer(edits: dict) -> dict | None:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    hb = tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}
    placement = _placement(edits)
    z = 5 if placement == "fit_top_band" else 70
    max_lines = 4 if placement == "fit_top_band" else 3
    return {
        "id": "headline",
        "type": "headline",
        "enabled": bool(hb.get("enabled")),
        "z": z,
        "text": str(hb.get("text") or ""),
        "suggested": str(tpl.get("suggestedHeadline") or "") or None,
        "placement": placement,
        "style": {
            "preset": "stream_white_box" if placement == "fit_top_band" else "export_bar",
            "textColor": "#000000",
            "boxColor": "#FFFFFF",
            "radiusPx": 0,
            "widthPct": 100,
            "maxLines": max_lines,
        },
    }


def _badge_layer(edits: dict) -> dict | None:
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    pb = tpl.get("platformBadge") if isinstance(tpl.get("platformBadge"), dict) else {}
    cl = tpl.get("channelLink") if isinstance(tpl.get("channelLink"), dict) else {}
    badge_on = bool(pb.get("enabled"))
    link_on = bool(cl.get("enabled"))
    if not badge_on and not link_on:
        return None
    placement = _placement(edits)
    z = 6 if placement == "fit_top_band" else 71
    platform = str(tpl.get("platform") or "twitch")
    if platform not in ("twitch", "kick", "none"):
        platform = "twitch"
    url = str(cl.get("url") or "")
    return {
        "id": "badge",
        "type": "badge",
        "enabled": True,
        "z": z,
        "platform": platform,
        "handle": _handle_from_url(url),
        "url": url or None,
        "showLabel": badge_on,
        "showLink": link_on,
        "showLogo": False,
        "placement": placement,
    }


def layers_from_legacy(edits: dict) -> list[dict]:
    out: list[dict] = []
    hl = _headline_layer(edits)
    if hl:
        out.append(hl)
    badge = _badge_layer(edits)
    if badge:
        out.append(badge)
    cap = edits.get("captions") if isinstance(edits.get("captions"), dict) else {}
    out.append(
        {
            "id": "captions",
            "type": "captions",
            "enabled": cap.get("enabled", True) is not False,
            "z": 20,
            "settings": copy.deepcopy(cap),
        }
    )
    brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else {}
    logo_key = brand.get("logoKey")
    if logo_key:
        out.append(
            {
                "id": "logo",
                "type": "logo",
                "enabled": True,
                "z": 30,
                "logoKey": str(logo_key),
                "position": str(brand.get("logoPosition") or "TR"),
                "sizePct": brand.get("logoSizePct") if brand.get("logoSizePct") is not None else 12,
                "opacity": brand.get("logoOpacity") if brand.get("logoOpacity") is not None else 0.9,
            }
        )
    ho = edits.get("hookOverlay") if isinstance(edits.get("hookOverlay"), dict) else {}
    if ho.get("enabled") and str(ho.get("text") or "").strip():
        primary = "#FACC15"
        if isinstance(brand, dict) and brand.get("primaryColor"):
            primary = str(brand.get("primaryColor"))
        out.append(
            {
                "id": "hook",
                "type": "hook",
                "enabled": True,
                "z": 40,
                "text": str(ho.get("text") or ""),
                "durationMs": int(ho.get("durationMs") or 2500),
                "color": primary,
            }
        )
    pb = cap.get("progressBar") if isinstance(cap.get("progressBar"), dict) else {}
    if pb.get("enabled"):
        out.append(
            {
                "id": "progressBar",
                "type": "progressBar",
                "enabled": True,
                "z": 80,
                "color": str(pb.get("color") or "#FFFFFF"),
                "position": str(pb.get("position") or "bottom"),
                "thickness": int(pb.get("thickness") or 8),
            }
        )
    chat = edits.get("chatOverlay") if isinstance(edits.get("chatOverlay"), dict) else {}
    if chat.get("enabled"):
        out.append(
            {
                "id": "chat",
                "type": "chat",
                "enabled": True,
                "z": 90,
                "position": str(chat.get("position") or "gameplay_right"),
                "opacity": float(chat.get("opacity") if chat.get("opacity") is not None else 0.85),
            }
        )
    out.sort(key=lambda x: int(x.get("z") or 0))
    return out


MAPPED_KEYS = (
    "exportTemplate",
    "captions",
    "brand",
    "hookOverlay",
    "chatOverlay",
)


def _layer_by_id(layers: list[dict], lid: str) -> dict | None:
    for layer in layers:
        if layer.get("id") == lid:
            return layer
    return None


def legacy_from_layers(layers: list[dict], edits: dict) -> dict:
    out = copy.deepcopy(edits)
    hl = _layer_by_id(layers, "headline")
    badge = _layer_by_id(layers, "badge")
    cap_l = _layer_by_id(layers, "captions")
    logo_l = _layer_by_id(layers, "logo")
    hook_l = _layer_by_id(layers, "hook")
    pb_l = _layer_by_id(layers, "progressBar")
    chat_l = _layer_by_id(layers, "chat")

    tpl = copy.deepcopy(out.get("exportTemplate")) if isinstance(out.get("exportTemplate"), dict) else {}
    had_tpl = isinstance(edits.get("exportTemplate"), dict)
    tpl_dirty = False
    if hl:
        tpl["headlineBar"] = {
            **(tpl.get("headlineBar") if isinstance(tpl.get("headlineBar"), dict) else {}),
            "enabled": bool(hl.get("enabled")),
            "text": str(hl.get("text") or ""),
        }
        if hl.get("suggested"):
            tpl["suggestedHeadline"] = hl.get("suggested")
        tpl_dirty = had_tpl or bool(hl.get("enabled")) or str(hl.get("text") or "").strip()
    if badge:
        tpl["platformBadge"] = {
            **(tpl.get("platformBadge") if isinstance(tpl.get("platformBadge"), dict) else {}),
            "enabled": bool(badge.get("showLabel")),
        }
        tpl["channelLink"] = {
            **(tpl.get("channelLink") if isinstance(tpl.get("channelLink"), dict) else {}),
            "enabled": bool(badge.get("showLink")),
            "url": str(badge.get("url") or ""),
        }
        if badge.get("platform"):
            tpl["platform"] = badge.get("platform")
        tpl_dirty = True
    if tpl_dirty and tpl:
        out["exportTemplate"] = tpl

    if cap_l and isinstance(cap_l.get("settings"), dict):
        settings = copy.deepcopy(cap_l["settings"])
        if pb_l:
            settings["progressBar"] = {
                "enabled": bool(pb_l.get("enabled")),
                "color": pb_l.get("color"),
                "position": pb_l.get("position"),
                "thickness": pb_l.get("thickness"),
            }
        out["captions"] = settings

    if logo_l:
        brand = copy.deepcopy(out.get("brand")) if isinstance(out.get("brand"), dict) else {}
        brand["logoKey"] = logo_l.get("logoKey")
        brand["logoPosition"] = logo_l.get("position")
        brand["logoSizePct"] = logo_l.get("sizePct")
        brand["logoOpacity"] = logo_l.get("opacity")
        out["brand"] = brand
    elif logo_l is None and "brand" in out:
        brand = copy.deepcopy(out.get("brand")) if isinstance(out.get("brand"), dict) else {}
        brand.pop("logoKey", None)
        out["brand"] = brand

    if hook_l:
        out["hookOverlay"] = {
            "enabled": bool(hook_l.get("enabled")),
            "text": hook_l.get("text"),
            "durationMs": hook_l.get("durationMs"),
        }
    if chat_l:
        out["chatOverlay"] = {
            "enabled": bool(chat_l.get("enabled")),
            "position": chat_l.get("position"),
            "opacity": chat_l.get("opacity"),
        }
    return out


def _validate_layer(raw: Any) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if not raw.get("id") or not raw.get("type"):
        return None
    return raw


def _validate(layers_raw: list) -> list[dict] | None:
    if not isinstance(layers_raw, list):
        return None
    parsed: list[dict] = []
    dropped = 0
    for item in layers_raw:
        layer = _validate_layer(item)
        if layer:
            parsed.append(layer)
        else:
            dropped += 1
    if dropped:
        print(f"[clipper:layers] dropped_invalid count={dropped}", flush=True)
    return parsed if parsed else None


def resolve_layers(edits: dict) -> list[dict]:
    if edits.get("layersV") == 3 and isinstance(edits.get("layers"), list):
        parsed = _validate(edits["layers"])
        if parsed is not None:
            return parsed
    return layers_from_legacy(edits)


def _stage_plan(edits: dict) -> list[str]:
    plan = ["layout", "censor", "captions", "logo", "hook", "zoom", "export_bar", "progress", "sfx", "chat"]
    layout_mode = _layout_mode(edits)
    executed: list[str] = []
    if editor_mode_uses_stream_frame(layout_mode):
        executed.append("layout")
    tpl_censor = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else None
    if tpl_censor and tpl_censor.get("profanityCensor"):
        executed.append("censor")
    cap_edits = edits.get("captions") or {}
    if layout_mode == "fit_top" and isinstance(cap_edits, dict):
        cap_edits = {**cap_edits, "marginVPct": 6, "position": "bottom"}
    if int(cap_edits.get("enabled", True)):
        executed.append("captions")
    brand = edits.get("brand") if isinstance(edits.get("brand"), dict) else None
    if brand and brand.get("logoKey"):
        executed.append("logo")
    ho = edits.get("hookOverlay") if isinstance(edits.get("hookOverlay"), dict) else None
    if ho and ho.get("enabled") and str(ho.get("text") or "").strip():
        executed.append("hook")
    zoom_cfg = edits.get("zoom") if isinstance(edits.get("zoom"), dict) else {}
    if zoom_cfg.get("enabled"):
        executed.append("zoom")
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else None
    if tpl and not editor_mode_uses_stream_frame(layout_mode):
        executed.append("export_bar")
    pb = cap_edits.get("progressBar") if isinstance(cap_edits.get("progressBar"), dict) else None
    if pb and pb.get("enabled"):
        executed.append("progress")
    export_sfx_mode = str(edits.get("exportSfx") or "off")
    if export_sfx_mode in ("subtle", "meme"):
        executed.append("sfx")
    chat = edits.get("chatOverlay") if isinstance(edits.get("chatOverlay"), dict) else {}
    if chat.get("enabled"):
        executed.append("chat")
    return executed


def mapped_subset(edits: dict) -> dict:
    out: dict = {}
    for key in MAPPED_KEYS:
        if key in edits:
            out[key] = copy.deepcopy(edits[key])
    return out
