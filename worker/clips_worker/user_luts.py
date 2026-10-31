"""G4a user LUTs (Color → Import LUT). ``clip_luts`` rows (web: POST /api/clips/luts) hold a 3D
.cube on the clip storage (B2 in prod). A ColorSpec picks one with ``lut: {id, intensity}``; the
editor preview loads the same bytes (GET /api/clips/luts/<id>/file) and bakes the same grid, so
preview == export. Soft-deleted rows still render (an old project keeps its look). A LUT that can't
be read is skipped (logged) — the export never fails on it.
"""
from __future__ import annotations

from pathlib import Path

MAX_LUTS = 20
_SQL = 'SELECT id, "storageKey" FROM clip_luts WHERE "workspaceId" = %s AND id = ANY(%s)'


def used_lut_ids(edits: dict) -> list[str]:
    c = edits.get("color") if isinstance(edits.get("color"), dict) else {}
    specs = [c.get("video")] + [s.get("spec") for s in c.get("segments") or [] if isinstance(s, dict)]
    specs += list((c.get("broll") or {}).values()) if isinstance(c.get("broll"), dict) else []
    ids: list[str] = []
    for s in specs:
        lut = s.get("lut") if isinstance(s, dict) else None
        lid = lut.get("id") if isinstance(lut, dict) else None
        if isinstance(lid, str) and lid and lid not in ids:
            ids.append(lid)
    return ids[:MAX_LUTS]


def prepare_user_luts(conn, workspace_id: str | None, edits: dict, work_dir: Path) -> dict:
    """Download + parse the LUTs the color specs use → edits with ``_lutData`` {id: parsed}."""
    ids = used_lut_ids(edits)
    if not ids or conn is None or not workspace_id:
        return edits
    from clips_worker.color_grade import parse_cube
    from clips_worker.storage import download_object

    with conn.cursor() as cur:
        cur.execute(_SQL, (workspace_id, ids))
        rows = cur.fetchall() or []
    data: dict[str, dict] = {}
    for lid, key in rows:
        dest = Path(work_dir) / "user_luts" / f"{lid}.cube"
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            download_object(str(key), dest)
            data[str(lid)] = parse_cube(dest.read_text(encoding="utf-8", errors="replace"))
        except Exception as exc:  # noqa: BLE001 — a missing LUT is skipped, never fails the export
            print(f"[g4a:user_lut] skipped id={lid} err={type(exc).__name__}", flush=True)
    missing = [i for i in ids if i not in data]
    if missing:
        print(f"[g4a:user_lut] missing={len(missing)}", flush=True)
    return {**edits, "_lutData": data} if data else edits
