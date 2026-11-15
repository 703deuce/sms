"""Assets actually in hand, compact evidence, and engine capabilities.

The catalog is the generic stage interface for media: user uploads and any
later acquisition appear here only after they are actually available. Story,
Director, and Production Designer stages all start from this list — never from
assets that were requested but not found.

The Motion Engineer implements HOW from the API manifest and the tool registry.
The Production Designer must only request treatments this list can actually support,
or declare a custom-object extension.
"""
from __future__ import annotations

import re


def format_designer_capabilities() -> str:
    """Generated, topic-neutral capability brief for visual design decisions."""
    from clips_worker.motion_studio.tools.registry import default_registry

    lines = [
        "ENGINE AND TOOL CAPABILITIES (what the Motion Engineer can actually build).",
        "Use this as the source of truth for visual treatments. Do not assume a treatment exists because it would look good.",
        "",
        "Media. place_media / PhotoFrame shows the official upload as it actually appears. "
        "You cannot change, invent, hide, or rewrite wording, objects, or a state that is already in the image or clip. "
        "Whole-image treatments (fade, crop, rotate, skin, hold) apply to the entire frame. "
        "There is no per-element, per-letter, or per-region fade of pixels inside an upload unless a registered tool "
        "or a declared customObject extension says so. Typography (animate_text, HeroSlam, Callout, LowerThird) "
        "sits ON TOP of the picture; it does not edit the upload's pixels.",
        "Camera. animate_camera and film.cam / film.shot: motivated moves and holds. A held still is valid. "
        "A camera hold uses a second cam key, not a second spotlight.",
        "Graphics. create_graphic, maps, charts, documents, and counters must use verified numbers and labels "
        "from this film's data or narration — never invent what an upload shows.",
        "Footage. Play the official clip for its planned stretch. You cannot restage or contradict what the clip shows.",
        "Effects. apply_effect supports whole-object or whole-frame effects (spotlight, grain, shake, damp, hold), "
        "not selective erasure of letters inside a still.",
        "Extensions. If a beat needs a treatment that is not in this list, declare it on customObjects "
        "(id, name, purpose, sceneIndex). The Engineer will implement it only from primitives and registered tools; "
        "otherwise they return a structured limitation for you to revise.",
        "",
        "REGISTERED TOOLS:",
    ]
    reg = default_registry()
    for name in reg.names():
        doc = reg._tools[name].document()
        lines.append(
            f"- {doc['name']} (tier {doc['tier']}): {doc['purpose']} "
            f"Use when: {doc['whenToUse']} Do not use when: {doc['whenNotToUse']}"
        )
    return "\n".join(lines)


def asset_evidence(asset: dict | None) -> dict:
    """What the analysis says this upload actually shows. Never includes paths or model ids."""
    asset = asset or {}
    an = asset.get("analysis") or {}
    text = an.get("onScreenText") or an.get("text") or an.get("ocr") or []
    if isinstance(text, str):
        text = [text]
    tags = an.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    people = an.get("people") or []
    faces = an.get("faces") or []
    def _trim_people(items):
        out = []
        for p in items[:12]:
            if isinstance(p, dict):
                out.append({k: p[k] for k in ("name", "label", "role", "count", "id") if k in p})
            elif isinstance(p, str):
                out.append(p)
        return out
    transcript = an.get("transcriptText") or ""
    if isinstance(transcript, list):
        transcript = " ".join(str(x) for x in transcript)
    evidence = {
        "summary": (an.get("summary") or "")[:400] or None,
        "description": (an.get("description") or "")[:400] or None,
        "onScreenText": [str(x)[:120] for x in text[:24]],
        "tags": [str(x)[:80] for x in tags[:24]],
        "people": _trim_people(people),
        "faces": _trim_people(faces) if isinstance(faces, list) else faces,
        "era": an.get("era") or None,
        "moments": (an.get("moments") or [])[:16],
        "shots": (an.get("shots") or [])[:12],
        "hasAudio": an.get("hasAudio"),
        "durationS": an.get("durationS"),
        "transcriptText": (str(transcript)[:400] or None),
        "speakers": (an.get("speakers") or [])[:8],
    }
    # Drop empty values so the prompt stays tight.
    return {k: v for k, v in evidence.items() if v not in (None, "", [], {})}


# Statuses that mean the item is not actually available to this run.
_NOT_IN_HAND = {
    "missing", "requested", "not_found", "notfound", "failed", "error",
    "pending", "awaiting", "rejected", "unavailable",
}


def assets_in_hand(catalog: list | None) -> list[dict]:
    """Media actually available to this run.

    The catalog is the only stage input for media, whatever source added it
    (uploads today, a future acquisition agent later). An item is in hand when
    it has an id, is not flagged missing, and is not in a requested/failed
    state. Requested-but-not-found wishes are omitted and must not be claimed.
    """
    out: list[dict] = []
    seen: set[str] = set()
    for a in catalog or []:
        if not isinstance(a, dict):
            continue
        aid = a.get("id") or a.get("assetId")
        if not aid or aid in seen:
            continue
        if a.get("missing") is True or a.get("inHand") is False or a.get("found") is False:
            continue
        if a.get("acquired") is False and (a.get("source") or a.get("origin")) in {"acquisition", "acquired", "requested"}:
            continue
        status = str(a.get("status") or "ready").strip().lower().replace("-", "_")
        if status in _NOT_IN_HAND:
            continue
        kind = a.get("kind")
        if kind not in (None, "image", "photo", "still", "video", "audio"):
            # Keep unknown kinds that still have an id and a ready status (future media types).
            if status in _NOT_IN_HAND:
                continue
        seen.add(aid)
        row = dict(a)
        row["id"] = aid
        out.append(row)
    return out


def catalog_records(catalog: list | None) -> list[dict]:
    """Compact, path-free records for story / director / production prompts."""
    rows = []
    for a in assets_in_hand(catalog):
        ev = asset_evidence(a)
        rows.append({
            "assetId": a["id"],
            "kind": a.get("kind"),
            "filename": a.get("filename"),
            "durationMs": a.get("durationMs") or a.get("duration_ms"),
            "evidence": ev,
        })
    return rows


def evidence_text(asset: dict | None) -> str:
    """Flatten analysis evidence into a searchable blob (no paths or model ids)."""
    ev = asset_evidence(asset)
    parts: list[str] = []

    def _walk(value):
        if value is None or value is False:
            return
        if isinstance(value, (str, int, float)):
            parts.append(str(value))
        elif isinstance(value, dict):
            for v in value.values():
                _walk(v)
        elif isinstance(value, (list, tuple)):
            for v in value:
                _walk(v)

    _walk(ev)
    # Also include filename as weak evidence of what the file is, not of text on screen.
    if asset:
        if asset.get("filename"):
            parts.append(str(asset.get("filename")))
        if asset.get("id") or asset.get("assetId"):
            parts.append(str(asset.get("id") or asset.get("assetId")))
    return " ".join(parts)


_QUOTED = re.compile('[\u201c\u201d\u0022]([^\u201c\u201d\u0022]{2,120})[\u201c\u201d\u0022]')


def quoted_claims(text: str | None) -> list[str]:
    """Quoted phrases in a visual claim (on-screen wording, titles, signs)."""
    if not text:
        return []
    return [m.strip() for m in _QUOTED.findall(text) if m.strip()]


def validate_claims_against_asset(text: str | None, asset: dict | None, label: str) -> list[str]:
    """A visual claim must not invent wording the assigned asset's analysis does not record."""
    claims = quoted_claims(text)
    if not claims:
        return []
    if not asset:
        return [f"{label} claims {claims[0]!r} but no asset in hand is assigned"]
    blob = evidence_text(asset).lower()
    errs: list[str] = []
    for claim in claims:
        needle = " ".join(claim.lower().split())
        if needle and needle not in " ".join(blob.split()):
            errs.append(
                f"{label} claims {claim!r} which the assigned asset's analysis does not record"
            )
    return errs


def validate_story_assets(story: dict, catalog: list | None) -> list[str]:
    """Story must be built from assets actually in hand, and must not claim missing media."""
    if not catalog:
        return []
    if story.get("verbatim"):
        return _validate_citations_only(story, catalog)
    hand = assets_in_hand(catalog)
    by_id = {a["id"]: a for a in hand}
    errs: list[str] = []
    cited: set[str] = set()
    for i, ln in enumerate(story.get("lines") or []):
        if not isinstance(ln, dict):
            continue
        lid = ln.get("id") or f"line {i}"
        aid = ln.get("visualAssetId") or ln.get("assetId")
        q = ln.get("quote")
        if isinstance(q, dict) and q.get("assetId"):
            aid = aid or q.get("assetId")
        text = " ".join(str(x) for x in (ln.get("text"), ln.get("spoken"), ln.get("hero")) if x)
        if aid:
            if aid not in by_id:
                errs.append(
                    f"story line {lid} cites asset {aid} which is not in hand; "
                    "move the wish to missingAssets or illustrate it with engine tools"
                )
            else:
                cited.add(aid)
                errs.extend(validate_claims_against_asset(text, by_id[aid], f"story line {lid}"))
        elif quoted_claims(text) and not ln.get("illustrative"):
            errs.append(
                f"story line {lid} claims a visual but does not cite an asset in hand"
            )
    for a in hand:
        if a["id"] not in cited:
            errs.append(
                f"upload {a.get('filename') or a['id']} is in hand but is not cited by any story line"
            )
    for wish in story.get("missingAssets") or []:
        wid = wish.get("assetId") if isinstance(wish, dict) else None
        if wid and wid in by_id:
            errs.append(f"missingAssets lists {wid} but that asset is already in hand")
    return errs


def _validate_citations_only(story: dict, catalog: list | None) -> list[str]:
    """Verbatim scripts may omit coverage; citations that exist must still be in hand."""
    by_id = {a["id"]: a for a in assets_in_hand(catalog)}
    errs: list[str] = []
    for i, ln in enumerate(story.get("lines") or []):
        if not isinstance(ln, dict):
            continue
        aid = ln.get("visualAssetId") or ln.get("assetId")
        if aid and aid not in by_id:
            errs.append(f"story line {ln.get('id') or i} cites asset {aid} which is not in hand")
    return errs


def validate_visuals_against_assets(items: list[dict], catalog: list | None,
                                    *, unknown_asset: str = "error") -> list[str]:
    """Director/PD visual text that depends on an asset must match that asset's analysis.

    unknown_asset='skip' omits the 'not in hand' error when the caller already
    reports an unassigned / missing asset id (the quoted-claim check still runs
    when the asset exists).
    """
    if not catalog:
        return []
    by_id = {a["id"]: a for a in assets_in_hand(catalog)}
    errs: list[str] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        label = item.get("label") or "visual"
        text = item.get("text") or ""
        aid = item.get("assetId")
        illustrative = bool(item.get("illustrative"))
        if aid:
            if aid not in by_id:
                if unknown_asset != "skip":
                    errs.append(f"{label} depends on asset {aid} which is not in hand")
            else:
                errs.extend(validate_claims_against_asset(text, by_id[aid], label))
        elif quoted_claims(text) and not illustrative:
            errs.append(f"{label} claims a visual but does not cite an asset in hand and is not labeled illustrative")
    return errs
