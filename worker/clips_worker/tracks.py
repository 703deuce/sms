"""G1b multi-track model (mirror of new-app lib/clips/editor/tracks.ts).

`edits.tracks` lists overlay / text / audio tracks in LAYER order (overlay + text share one visual
stack, array order = bottom -> top). A track lists its item ids; unlisted items are on the kind's
default track (ov1 / tx1 / au1), whose mute / hide / lock is the E2 `timelineLanes` lane toggle.
Parity: tests/fixtures/g1b_tracks_parity.json (vitest + pytest).
"""
from __future__ import annotations

import re

from clips_worker.motion import stack_order

DEFAULT_TRACK_ID = {"overlay": "ov1", "text": "tx1", "audio": "au1"}
REV_DEFAULT = {v: k for k, v in DEFAULT_TRACK_ID.items()}
MAX_TRACKS = 16
MAX_VISUAL_TRACKS = 10
TRACK_NAME_MAX = 40
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,24}$")
_ITEM_RE = re.compile(r"^[A-Za-z0-9_~.:-]{1,128}$")
DEFAULT_TRACKS = [{"id": "ov1", "kind": "overlay"}, {"id": "tx1", "kind": "text"}, {"id": "au1", "kind": "audio"}]


def _visual(kind: str) -> bool:
    return kind != "audio"


def _is_default_tracks(ts: list[dict]) -> bool:
    if len(ts) != 3:
        return False
    for t, d in zip(ts, DEFAULT_TRACKS):
        if t["id"] != d["id"] or any(k in t for k in ("name", "items", "locked", "hidden", "muted", "soloed")):
            return False
    return True


def normalize_tracks(raw) -> list[dict] | None:
    if not isinstance(raw, list):
        return None
    out: list[dict] = []
    ids: set[str] = set()
    claimed: dict[str, set[str]] = {"overlay": set(), "text": set(), "audio": set()}
    visual = 0
    for r in raw:
        if len(out) >= MAX_TRACKS:
            break
        if not isinstance(r, dict):
            continue
        tid = r.get("id") if isinstance(r.get("id"), str) else ""
        kind = r.get("kind")
        if not _ID_RE.match(tid) or tid in ids:
            continue
        if kind not in ("overlay", "text", "audio"):
            continue
        def_kind = REV_DEFAULT.get(tid)
        if def_kind and def_kind != kind:
            continue
        if _visual(kind) and visual >= MAX_VISUAL_TRACKS:
            continue
        t: dict = {"id": tid, "kind": kind}
        if isinstance(r.get("name"), str):
            name = re.sub(r"\s+", " ", r["name"]).strip()[:TRACK_NAME_MAX]
            if name:
                t["name"] = name
        if not def_kind:
            if r.get("locked") is True:
                t["locked"] = True
            if r.get("hidden") is True and _visual(kind):
                t["hidden"] = True
            if r.get("muted") is True and kind == "audio":
                t["muted"] = True
            if r.get("soloed") is True and kind == "audio":  # G2 solo
                t["soloed"] = True
        if isinstance(r.get("items"), list):
            items: list[str] = []
            for x in r["items"]:
                if not isinstance(x, str) or not _ITEM_RE.match(x) or x in claimed[kind]:
                    continue
                claimed[kind].add(x)
                items.append(x)
                if len(items) >= 400:
                    break
            if items and not def_kind:
                t["items"] = items
        ids.add(tid)
        if _visual(kind):
            visual += 1
        out.append(t)
    if "ov1" not in ids:
        if visual >= MAX_VISUAL_TRACKS:
            drop = next((i for i, t in enumerate(out) if _visual(t["kind"]) and t["id"] != "tx1"), -1)
            if drop >= 0:
                out.pop(drop)
        out.insert(0, {"id": "ov1", "kind": "overlay"})
    if not any(t["id"] == "tx1" for t in out):
        if sum(1 for t in out if _visual(t["kind"])) >= MAX_VISUAL_TRACKS:
            drop = -1
            for i, t in enumerate(out):
                if _visual(t["kind"]) and t["id"] != "ov1":
                    drop = i
            if drop >= 0:
                out.pop(drop)
        last_visual = -1
        for i, t in enumerate(out):
            if _visual(t["kind"]):
                last_visual = i
        out.insert(last_visual + 1, {"id": "tx1", "kind": "text"})
    if not any(t["id"] == "au1" for t in out):
        out.append({"id": "au1", "kind": "audio"})
    while len(out) > MAX_TRACKS:
        drop = -1
        for i, t in enumerate(out):
            if t["id"] not in REV_DEFAULT:
                drop = i
        if drop < 0:
            break
        out.pop(drop)
    return None if _is_default_tracks(out) else out


def effective_tracks(edits: dict) -> list[dict]:
    return normalize_tracks(edits.get("tracks")) or [dict(t) for t in DEFAULT_TRACKS]


def track_id_of(edits: dict, kind: str, item_id: str, tracks: list[dict] | None = None) -> str:
    for t in tracks if tracks is not None else effective_tracks(edits):
        if t["kind"] == kind and item_id in (t.get("items") or []):
            return t["id"]
    return DEFAULT_TRACK_ID[kind]


def on_default_track(edits: dict, kind: str, item_id: str) -> bool:
    return track_id_of(edits, kind, item_id) == DEFAULT_TRACK_ID[kind]


def apply_track_state(edits: dict) -> dict:
    """Drop items on hidden overlay / text tracks and muted audio tracks (non-default tracks)."""
    ts = normalize_tracks(edits.get("tracks"))
    if not ts:
        return edits
    off: dict[str, set[str]] = {"overlay": set(), "text": set(), "audio": set()}
    for t in ts:
        if t["id"] in REV_DEFAULT or not (t.get("hidden") or t.get("muted")):
            continue
        off[t["kind"]].update(t.get("items") or [])
    out = edits
    broll = edits.get("broll") or []
    if off["overlay"] and any(str(b.get("id")) in off["overlay"] for b in broll):
        out = {**out, "broll": [b for b in broll if str(b.get("id")) not in off["overlay"]]}
    texts = edits.get("textItems") or []
    if off["text"] and any(str(t.get("id")) in off["text"] for t in texts):
        kept = [t for t in texts if str(t.get("id")) not in off["text"]]
        out = {**out, "textItems": kept or None}
    audio = edits.get("audio")
    if off["audio"] and isinstance(audio, dict):
        sfx = audio.get("sfx") or []
        if any(str(s.get("generationId")) in off["audio"] for s in sfx):
            out = {**out, "audio": {**audio, "sfx": [s for s in sfx if str(s.get("generationId")) not in off["audio"]]}}
    return out


def layer_order(edits: dict, kind: str, items: list[dict], z_of) -> list[dict]:
    """Bottom -> top: by track (stack order), then G1a stack_order inside each track."""
    tracks = effective_tracks(edits)
    stack = [t for t in tracks if t["kind"] == kind]
    if len(stack) < 2:
        return stack_order(items, z_of)
    out: list[dict] = []
    for t in stack:
        out.extend(stack_order([it for it in items if track_id_of(edits, kind, str(it["id"]), tracks) == t["id"]], z_of))
    return out


def spans_tracks(edits: dict, kind: str, ids: list[str]) -> bool:
    tracks = effective_tracks(edits)
    return len({track_id_of(edits, kind, i, tracks) for i in ids}) > 1


def _top_used_overlay(stack: list[dict], used: set[str]) -> int:
    top = -1
    for i, t in enumerate(stack):
        if t["kind"] == "overlay" and t["id"] in used:
            top = i
    return top


def under_text_ids(edits: dict, overlay_ids: list[str]) -> list[str]:
    tracks = effective_tracks(edits)
    stack = [t for t in tracks if _visual(t["kind"])]
    used = {track_id_of(edits, "overlay", i, tracks) for i in overlay_ids}
    top = _top_used_overlay(stack, used)
    if top < 0:
        return []
    under = {t["id"] for t in stack[:top] if t["kind"] == "text"}
    if not under:
        return []
    return [
        str(t.get("id"))
        for t in (edits.get("textItems") or [])
        if isinstance(t, dict) and track_id_of(edits, "text", str(t.get("id")), tracks) in under
    ]


def under_passes(edits: dict, overlay_ids: list[str]) -> list[dict]:
    """B-roll stage passes bottom -> top ({kind, trackId, ids}); [] when no text sits under an overlay."""
    under = set(under_text_ids(edits, overlay_ids))
    if not under:
        return []
    tracks = effective_tracks(edits)
    stack = [t for t in tracks if _visual(t["kind"])]
    used = {track_id_of(edits, "overlay", i, tracks) for i in overlay_ids}
    top = _top_used_overlay(stack, used)
    out: list[dict] = []
    for t in stack[: top + 1]:
        if t["kind"] == "overlay":
            ids = [i for i in overlay_ids if track_id_of(edits, "overlay", i, tracks) == t["id"]]
        else:
            ids = [
                str(x.get("id"))
                for x in (edits.get("textItems") or [])
                if str(x.get("id")) in under and track_id_of(edits, "text", str(x.get("id")), tracks) == t["id"]
            ]
        if not ids:
            continue
        if out and out[-1]["kind"] == t["kind"]:
            out[-1]["ids"].extend(ids)
        else:
            out.append({"kind": t["kind"], "trackId": t["id"], "ids": list(ids)})
    return out
