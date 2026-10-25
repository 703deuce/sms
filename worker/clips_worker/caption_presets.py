"""Map UI caption presets to ASS style overrides (post-process HEADER)."""
from __future__ import annotations

from pathlib import Path

PRESETS: dict[str, dict[str, str]] = {
    "bold_pop": {"font": "Poppins ExtraBold", "size": "80", "primary": "&H00FFFFFF", "outline": "7"},
    "clean_white": {"font": "Poppins ExtraBold", "size": "72", "primary": "&H00FFFFFF", "outline": "6"},
    "boxed": {"font": "Poppins ExtraBold", "size": "76", "primary": "&H00FFFFFF", "outline": "4"},
    "karaoke": {"font": "Poppins ExtraBold", "size": "78", "primary": "&H00FFFFFF", "outline": "6"},
    "minimal": {"font": "Poppins ExtraBold", "size": "52", "primary": "&H00FFFFFF", "outline": "4"},
    "neon": {"font": "Poppins ExtraBold", "size": "78", "primary": "&H00FFCCFF", "outline": "8"},
}


def apply_preset_to_ass(ass_path: Path, preset_id: str) -> None:
    p = PRESETS.get(preset_id, PRESETS["bold_pop"])
    text = ass_path.read_text()
    if "Style: Cap," not in text:
        return
    lines = []
    for line in text.splitlines():
        if line.startswith("Style: Cap,"):
            parts = line.split(",")
            if len(parts) >= 23:
                parts[1] = p["font"]
                parts[2] = p["size"]
                parts[3] = p["primary"]
                parts[16] = p["outline"]
                line = ",".join(parts)
        lines.append(line)
    ass_path.write_text("\n".join(lines) + "\n")
