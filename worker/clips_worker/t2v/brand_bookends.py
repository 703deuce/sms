"""Apply brand intro/outro to T2V assemble output (same helper as clip render_job)."""
from __future__ import annotations

from pathlib import Path

from clips_worker.brand_concat import concat_brand_bookends


def _storage_key_ok(workspace_id: str, key: str) -> bool:
    return key.startswith(f"ws/{workspace_id}/") or key.startswith("stock/")


def brand_keys_from_settings(settings: dict | None) -> tuple[str | None, str | None]:
    brand = (settings or {}).get("brand") or {}
    template_id = (settings or {}).get("brandTemplateId") or brand.get("brandTemplateId") or brand.get("templateId")
    if not template_id and not brand.get("introVideoKey"):
        return None, None
    intro = brand.get("introVideoKey") if brand.get("useIntro", True) else None
    outro = brand.get("outroVideoKey") if brand.get("useOutro", True) else None
    return intro, outro


def apply_brand_bookends(
    main: Path,
    out: Path,
    *,
    settings: dict | None,
    workspace_id: str,
    w: int,
    h: int,
    work_dir: Path,
) -> Path:
    intro_key, outro_key = brand_keys_from_settings(settings)
    if intro_key and not _storage_key_ok(workspace_id, str(intro_key)):
        intro_key = None
    if outro_key and not _storage_key_ok(workspace_id, str(outro_key)):
        outro_key = None
    if not intro_key and not outro_key:
        if main != out:
            import shutil

            shutil.copy2(main, out)
        return out
    intro_p = work_dir / "brand_intro.mp4" if intro_key else None
    outro_p = work_dir / "brand_outro.mp4" if outro_key else None
    from clips_worker.storage import download_object

    if intro_p:
        download_object(str(intro_key), intro_p)
    if outro_p:
        download_object(str(outro_key), outro_p)
    concat_brand_bookends(main, out, intro_p, outro_p, w, h, work_dir)
    return out
