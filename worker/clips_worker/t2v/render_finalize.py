"""Post-assemble video: burn ASS titles, optional brand bookends."""
from __future__ import annotations

from pathlib import Path

from clips_worker.t2v.brand_bookends import apply_brand_bookends
from clips_worker.t2v.titles_ass import TextItem, build_ass, burn_ass


def text_items_from_document(document: dict, scene_starts_ms: list[int]) -> tuple[list[TextItem], str, str, str]:
    items: list[TextItem] = []
    scenes = document.get("scenes") or []
    brand = (document.get("settings") or {}).get("brand") or {}
    font = brand.get("fontFamily") or brand.get("titleFont") or "DejaVu Sans"
    primary = brand.get("primaryColor") or "#FFFFFF"
    muted = brand.get("secondaryColor") or "#D0D0D0"
    for idx, sc in enumerate(scenes):
        base = scene_starts_ms[idx] if idx < len(scene_starts_ms) else 0
        for t in sc.get("texts") or []:
            items.append(
                TextItem(
                    kind=t.get("kind", "title"),
                    text=t.get("text", ""),
                    start_ms=base + int(t.get("startMs", 0)),
                    end_ms=base + int(t.get("endMs", 0)),
                    subtitle=t.get("subtitle") or "",
                    animation=t.get("animation", "fade"),
                )
            )
    return items, font, primary, muted


def finalize_t2v_video(
    source: Path,
    out: Path,
    *,
    document: dict,
    scene_starts_ms: list[int],
    w: int,
    h: int,
    work_dir: Path,
    skip_brand_bookends: bool = False,
) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    items, font, primary, muted = text_items_from_document(document, scene_starts_ms)
    current = source
    if items:
        ass_path = work_dir / "titles.ass"
        ass_path.write_text(
            build_ass(items, w=w, h=h, font=font, primary_color=primary, muted_color=muted)
        )
        titled = work_dir / "titled.mp4"
        burn_ass(current, ass_path, titled)
        current = titled
    if skip_brand_bookends:
        if current != out:
            import shutil

            shutil.copy2(current, out)
        return out
    branded = work_dir / "branded.mp4"
    apply_brand_bookends(
        current,
        branded,
        settings=document.get("settings"),
        w=w,
        h=h,
        work_dir=work_dir,
    )
    if branded != out:
        import shutil

        shutil.copy2(branded, out)
    return out
