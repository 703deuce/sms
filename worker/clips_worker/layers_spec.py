"""Layers v3 schema (derived from legacy edits in T1)."""
from __future__ import annotations

import copy
import json
from typing import Any
from urllib.parse import urlparse

from clips_worker.layout_router import editor_mode_uses_stream_frame, export_stream_headline_compose_active

_V3_EXTRA_LAYER_TYPES = frozenset({"sticker"})


def _layout_mode(edits: dict) -> str:
    return str((edits.get("layout") or {}).get("mode") or "speaker_follow")


def _placement(edits: dict) -> str:
    mode = _layout_mode(edits)
    if mode in ("facecam_stack", "facecam_pip", "screen_pip", "stack"):
        return "stack_corner"
    if mode == "fit_top" or export_stream_headline_compose_active(edits):
        return "fit_top_band"
    return "export_bar"


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
            "preset": "bold_news" if placement == "fit_top_band" else "export_bar",
            "font": "Anton" if placement == "fit_top_band" else "Montserrat Black",
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


def _layers_canonical(layers: list) -> str:
    return json.dumps(layers, separators=(",", ":"), sort_keys=True)


def _count_layer_sync_changes(before: list, after: list) -> int:
    before_by_id = {
        layer.get("id"): layer for layer in before if isinstance(layer, dict) and layer.get("id")
    }
    changed = 0
    for layer in after:
        if not isinstance(layer, dict) or not layer.get("id"):
            changed += 1
            continue
        prev = before_by_id.get(layer["id"])
        if prev is None or _layers_canonical([prev]) != _layers_canonical([layer]):
            changed += 1
    for lid in before_by_id:
        if not any(isinstance(layer, dict) and layer.get("id") == lid for layer in after):
            changed += 1
    return changed


def _badge_layer_enabled(layer: dict) -> bool:
    return bool(layer.get("showLabel") or layer.get("showLink"))


def badge_sprite_active(layer: dict) -> bool:
    return bool(layer.get("showLabel") or layer.get("showLink") or layer.get("showLogo"))


def badge_render_state(edits: dict, *, template_mode: bool = False) -> dict:
    """EP1: the ONE badge-visibility rule (mirror: new-app/lib/clips/render-plan/badge.ts).

    v3 sprite (build_v3_extras): badge layer enabled and showLabel / showLink / showLogo; the text is
    the handle (or platform label) only when showLabel. Otherwise the legacy export bar draws the
    platform badge when exportTemplate.platformBadge.enabled — never in T6 template mode
    (apply_export_template returns after the title). Fixture: tests/fixtures/render_plan/badge_cases.json.
    """
    from clips_worker.clip_export_template import _platform_label

    layer = _layer_by_id(resolve_layers(edits), "badge")
    if layer and layer.get("enabled") and badge_sprite_active(layer):
        platform = str(layer.get("platform") or "twitch")
        label, _ = _platform_label(platform)
        show_label = bool(layer.get("showLabel"))
        handle = str(layer.get("handle") or layer.get("url") or "").split("/")[-1][:24]
        text = handle.upper() if handle else label
        return {
            "on": True,
            "source": "sprite",
            "platform": platform,
            "showLabel": show_label,
            "showLogo": bool(layer.get("showLogo")),
            "text": text if show_label else "",
        }
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    if not template_mode and bool((tpl.get("platformBadge") or {}).get("enabled")):
        platform = str(tpl.get("platform") or "twitch")
        label, _ = _platform_label(platform)
        return {"on": True, "source": "legacy", "platform": platform, "showLabel": True, "showLogo": False, "text": label}
    return {"on": False, "source": None, "platform": None, "showLabel": False, "showLogo": False, "text": ""}


def _merge_sync_layer(stored: dict | None, fresh: dict) -> dict:
    out = copy.deepcopy(fresh)
    if not stored:
        if out.get("type") == "badge":
            out["enabled"] = _badge_layer_enabled(out)
        return out
    if out.get("type") == "headline" and isinstance(stored.get("style"), dict):
        out["style"] = copy.deepcopy(stored["style"])
    if out.get("type") == "badge":
        out["showLogo"] = bool(stored.get("showLogo"))
        if stored.get("handle"):
            out["handle"] = stored["handle"]
        out["enabled"] = _badge_layer_enabled(out)
    return out


def _orphan_badge_from_stored(stored: dict, edits: dict) -> dict:
    out = copy.deepcopy(stored)
    tpl = edits.get("exportTemplate") if isinstance(edits.get("exportTemplate"), dict) else {}
    pb = tpl.get("platformBadge") if isinstance(tpl.get("platformBadge"), dict) else {}
    cl = tpl.get("channelLink") if isinstance(tpl.get("channelLink"), dict) else {}
    out["showLabel"] = bool(pb.get("enabled"))
    out["showLink"] = bool(cl.get("enabled"))
    out["enabled"] = _badge_layer_enabled(out)
    return out


def sync_layers_from_legacy(edits: dict) -> dict:
    """Merge mapped legacy fields into stored v3 layers; preserve headline style, badge logo, stickers."""
    if edits.get("layersV") != 3:
        return edits
    layers_raw = edits.get("layers") if isinstance(edits.get("layers"), list) else []
    stored_map = {
        layer["id"]: layer
        for layer in layers_raw
        if isinstance(layer, dict) and layer.get("id")
    }
    fresh = layers_from_legacy(edits)
    merged: list[dict] = []
    fresh_ids: set[str] = set()
    for layer in fresh:
        lid = str(layer.get("id") or "")
        fresh_ids.add(lid)
        merged.append(_merge_sync_layer(stored_map.get(lid), layer))
    stored_badge = stored_map.get("badge")
    if stored_badge and "badge" not in fresh_ids and badge_sprite_active(stored_badge):
        merged.append(_orphan_badge_from_stored(stored_badge, edits))
    extras = [
        copy.deepcopy(layer)
        for layer in layers_raw
        if isinstance(layer, dict) and layer.get("type") in _V3_EXTRA_LAYER_TYPES
    ]
    merged.extend(extras)
    merged.sort(key=lambda x: int(x.get("z") or 0))
    placement = _placement(edits)
    for layer in merged:
        if layer.get("type") in ("headline", "badge"):
            layer["placement"] = placement
        if layer.get("type") == "badge" and placement == "fit_top_band":
            layer["placement"] = "fit_top_band"
    changed = _count_layer_sync_changes(layers_raw, merged)
    if changed:
        print(f"[clipper:layers] synced changed={changed}", flush=True)
    out = {**edits, "layers": merged}
    out.pop("layersLegacyFp", None)
    return out


def v3_has_extras(layers: list[dict]) -> bool:
    for layer in layers:
        if not isinstance(layer, dict) or not layer.get("enabled"):
            continue
        if layer.get("type") in _V3_EXTRA_LAYER_TYPES:
            return True
        if layer.get("type") == "badge" and badge_sprite_active(layer):
            return True
    return False


def resolve_layers(edits: dict) -> list[dict]:
    if edits.get("layersV") == 3:
        edits = sync_layers_from_legacy(edits)
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
    layers_raw = edits.get("layers") if edits.get("layersV") == 3 and isinstance(edits.get("layers"), list) else None
    if layers_raw and v3_has_extras(layers_raw):
        executed.append("sprites")
    return executed


def mapped_subset(edits: dict) -> dict:
    out: dict = {}
    for key in MAPPED_KEYS:
        if key in edits:
            out[key] = copy.deepcopy(edits[key])
    return out


def badge_rect(
    placement: str,
    play_w: int,
    play_h: int,
    *,
    text: str = "",
    show_logo: bool = False,
    video_y: int = 0,
    video_h: int = 0,
    badge_y: int | None = None,
) -> dict[str, int]:
    from clips_worker.overlay_geometry import badge_rect as _badge_rect

    return _badge_rect(
        placement,
        play_w,
        play_h,
        text=text,
        show_logo=show_logo,
        video_y=video_y,
        video_h=video_h,
        badge_y=badge_y,
    )
