"""Part 1 / BE-15 (#1224): asset manifest (ST-BLK-24, no licence fields) + credits ledger (ST-BLK-23)."""
from __future__ import annotations

ENGINE_CREDIT = ("Motion engine: Cinematic Skill (github.com/Moh4696/cinematic-skill @ bf43556), MIT licence, "
                 "copyright (c) exploraX. Vendored unmodified.")


def manifest_entry(asset_id: str, kind: str, filename: str, crop=None, grade=None, used_in=None) -> dict:
    return {"assetId": asset_id, "kind": kind, "filename": filename, "crop": crop, "grade": grade, "usedIn": used_in or []}


def credits_ledger(*, title: str, narration: dict, music: dict, sfx: dict, sources: list[dict], data: list[dict],
                   assets: list[dict], scenes: list[dict], fonts: list[str]) -> str:
    L = [f"{title}", "", "CREDITS & SOURCES", ""]
    if narration:
        L.append(f"Narration: {narration.get('label', 'ElevenLabs')}")
    if music:
        src = music.get("source")
        if src == "generated":
            p = music.get("params") or {}
            L.append(f"Music: original score generated for this video ({p.get('bpm')} bpm, {p.get('key')} {p.get('mode')}); no third-party samples")
        elif src == "elevenlabs":
            L.append("Music: generated with ElevenLabs Music for this video")
        elif src == "upload":
            L.append("Music: supplied by the creator")
    if sfx:
        L.append("Sound effects: synthesized for this video (no samples)")
    L.append(ENGINE_CREDIT)
    if fonts:
        L.append("Fonts: " + ", ".join(sorted(set(fonts))))
    if sources:
        L += ["", "Research sources:"]
        for s in sources:
            L.append(f"- {s.get('title') or s.get('url')}: {s.get('url')}")
    if data:
        L += ["", "Data:"]
        for d in data:
            prov = d.get("provenance") or {}
            L.append(f"- {d.get('label')}: {d.get('value')}{d.get('unit') or ''} ({prov.get('origin', 'user')}"
                     + (f"; {', '.join(prov.get('citations') or [])}" if prov.get("citations") else "")
                     + (", approximate" if prov.get("approximate") else "") + ")")
    if assets:
        L += ["", "Media supplied by the creator:"]
        for a in assets:
            L.append(f"- {a.get('filename')} ({a.get('kind')})")
    if scenes:
        rr = sum(1 for s in scenes if s.get("rendered"))
        L += ["", f"Scenes: {len(scenes)} ({rr} rendered this export, {len(scenes) - rr} reused from cache)"]
    return "\n".join(L) + "\n"
