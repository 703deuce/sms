"""G3b: workspace fonts (Text → Upload font) for the text-item burn.

``clip_fonts`` rows (web: POST /api/clips/fonts) hold a TTF/OTF on the clip storage (B2 in prod)
plus the family name and caption_fit metrics parsed at upload. A text style picks one with
``font: "user:<id>"``; the editor preview loads the same bytes into JASSUB under the same family,
so preview == export. Soft-deleted rows still render (an old project keeps its look).
"""
from __future__ import annotations

import os
from pathlib import Path

from clips_worker.text_items import safe_family, user_font_id

MAX_FONTS = 50
_SQL = (
    'SELECT id, family, "storageKey", filename, metrics FROM clip_fonts '
    'WHERE "workspaceId" = %s AND id = ANY(%s)'
)


def used_font_ids(edits: dict) -> list[str]:
    ids: list[str] = []
    caps = edits.get("captions") if isinstance(edits.get("captions"), dict) else {}
    cap_fid = user_font_id(caps.get("font"))
    if cap_fid and cap_fid not in ids:
        ids.append(cap_fid)
    for it in edits.get("textItems") or []:
        st = it.get("style") if isinstance(it, dict) and isinstance(it.get("style"), dict) else {}
        fid = user_font_id(st.get("font"))
        if fid and fid not in ids:
            ids.append(fid)
    return ids[:MAX_FONTS]


def merged_fonts_dir(base: Path | None, extra: list[Path], dest: Path) -> Path:
    """Bundled fonts + user fonts in one directory (ass=…:fontsdir takes one)."""
    dest.mkdir(parents=True, exist_ok=True)
    srcs = sorted(base.iterdir()) if base and base.is_dir() else []
    for f in [*srcs, *extra]:
        if not f.is_file():
            continue
        link = dest / f.name
        if not link.exists():
            try:
                os.symlink(f.resolve(), link)
            except OSError:
                link.write_bytes(f.read_bytes())
    return dest


def prepare_user_fonts(conn, workspace_id: str | None, edits: dict, work_dir: Path) -> dict:
    """Download the workspace fonts the text items use, register their metrics, and return edits
    with ``_fontsDir`` (bundled + user fonts) and each item's ``fontFamily`` set from the row."""
    ids = used_font_ids(edits)
    if not ids or conn is None or not workspace_id:
        return edits
    from clips_worker.caption_fit import register_font_metrics
    from clips_worker.storage import download_object

    with conn.cursor() as cur:
        cur.execute(_SQL, (workspace_id, ids))
        rows = cur.fetchall() or []
    fam: dict[str, str] = {}
    files: list[Path] = []
    for fid, family, key, filename, metrics in rows:
        family = safe_family(family)
        if not family or not key:
            continue
        ext = ".otf" if str(filename or key).lower().endswith(".otf") else ".ttf"
        dest = Path(work_dir) / "user_fonts" / f"{fid}{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            download_object(str(key), dest)
        except Exception as exc:  # noqa: BLE001 — a missing font falls back, never fails the export
            print(f"[g3b:user_font] download_failed id={fid} err={type(exc).__name__}", flush=True)
            continue
        if isinstance(metrics, dict):
            register_font_metrics(family, metrics)
        fam[str(fid)] = family
        files.append(dest)
    if not fam:
        return edits
    try:
        from clips_worker.title_fit import clip_fonts_dir

        base = clip_fonts_dir()
    except ImportError:
        base = None
    fonts_dir = merged_fonts_dir(base, files, Path(work_dir) / "fonts_merged")
    items = []
    for it in edits.get("textItems") or []:
        st = it.get("style") if isinstance(it, dict) and isinstance(it.get("style"), dict) else None
        fid = user_font_id((st or {}).get("font"))
        if st is not None and fid in fam:
            it = {**it, "style": {**st, "fontFamily": fam[fid]}}
        items.append(it)
    print(f"[g3b:user_font] n={len(fam)} missing={len(ids) - len(fam)}", flush=True)
    out = {**edits, "textItems": items, "_fontsDir": str(fonts_dir)}
    caps = out.get("captions") if isinstance(out.get("captions"), dict) else None
    if caps is not None:
        cap_fid = user_font_id(caps.get("font"))
        if cap_fid in fam:
            out = {
                **out,
                "captions": {
                    **caps,
                    "font": fam[cap_fid],
                    "_userFont": True,
                },
            }
    return out


def fonts_dir_for(edits: dict) -> Path | None:
    """fontsdir for a text burn: the merged dir when user fonts were prepared, else the bundled one."""
    p = edits.get("_fontsDir")
    if isinstance(p, str) and p and Path(p).is_dir():
        return Path(p)
    try:
        from clips_worker.title_fit import clip_fonts_dir
    except ImportError:
        return None
    return clip_fonts_dir()
