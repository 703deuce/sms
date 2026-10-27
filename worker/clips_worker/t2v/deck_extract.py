"""Extract slide text from PPT/PDF uploads for T2V deck import."""
from __future__ import annotations

from pathlib import Path


def _pptx_slides(path: Path) -> dict:
    from pptx import Presentation

    prs = Presentation(str(path))
    title = prs.core_properties.title or None
    slides: list[dict] = []
    for i, slide in enumerate(prs.slides):
        texts: list[str] = []
        notes = ""
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes = slide.notes_slide.notes_text_frame.text or ""
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                texts.append(shape.text.strip())
        narration = (notes.strip() or " ".join(texts).strip() or f"Slide {i + 1}")
        slides.append(
            {
                "index": i,
                "title": texts[0][:200] if texts else None,
                "narration": narration[:8000],
                "speakerNotes": notes.strip() or None,
            }
        )
    return {"title": title, "slides": slides}


def _pdf_slides(path: Path) -> dict:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    slides: list[dict] = []
    for i, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        narration = text or f"Slide {i + 1}"
        first_line = narration.split("\n", 1)[0][:200] if narration else None
        slides.append({"index": i, "title": first_line, "narration": narration[:8000]})
    return {"title": None, "slides": slides}


def extract_deck(local_path: Path) -> dict:
    suffix = local_path.suffix.lower()
    if suffix == ".pdf":
        return _pdf_slides(local_path)
    if suffix in (".pptx", ".ppt"):
        if suffix == ".ppt":
            raise RuntimeError("legacy_ppt_unsupported_use_pptx")
        return _pptx_slides(local_path)
    raise RuntimeError(f"unsupported_deck_type:{suffix}")
