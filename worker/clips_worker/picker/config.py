"""Load picker prompts and genre config (hot-swappable files)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

PICKER_ROOT = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def genres_config() -> dict[str, Any]:
    return json.loads((PICKER_ROOT / "genres.json").read_text(encoding="utf-8"))


def reload_config() -> None:
    genres_config.cache_clear()
    load_core_rubric.cache_clear()
    load_examples.cache_clear()


@lru_cache(maxsize=1)
def load_core_rubric() -> str:
    return (PICKER_ROOT / "prompts" / "core.md").read_text(encoding="utf-8").strip()


@lru_cache(maxsize=1)
def load_examples() -> str:
    path = PICKER_ROOT / "prompts" / "examples.md"
    return path.read_text(encoding="utf-8").strip() if path.is_file() else ""


def load_cut_rules() -> str:
    return ""  # included in core.md


def resolve_genre_key(genre: str) -> str:
    cfg = genres_config()
    g = (genre or "podcast").strip().lower()
    ui_map = cfg.get("ui_genre_map") or {}
    if g in ui_map:
        return ui_map[g]
    genres = cfg.get("genres") or {}
    if g in genres:
        return g
    for key, meta in genres.items():
        for alias in meta.get("aliases") or []:
            if g == alias:
                return key
    return cfg.get("default_genre", "podcast_interview")


def genre_meta(genre: str) -> dict[str, Any]:
    key = resolve_genre_key(genre)
    cfg = genres_config()
    genres = cfg.get("genres") or {}
    base = genres.get(key) or genres.get(cfg.get("default_genre", "podcast_interview")) or {}
    return {"key": key, **base}


def load_genre_prompt(genre: str) -> str:
    key = resolve_genre_key(genre)
    path = PICKER_ROOT / "prompts" / "genres" / f"{key}.md"
    if not path.is_file():
        path = PICKER_ROOT / "prompts" / "genres" / "podcast_interview.md"
    return path.read_text(encoding="utf-8").strip()


def global_config() -> dict[str, Any]:
    return genres_config().get("global") or {}


def length_bucket(clip_length: str, genre: str, platform: str = "tiktok") -> dict[str, int]:
    cfg = genres_config()
    buckets = cfg.get("clip_length_buckets") or {}
    bucket = dict(buckets.get(clip_length) or buckets.get("auto") or {})
    g_lengths = genre_meta(genre).get("lengths") or {}
    plat = g_lengths.get(platform) or g_lengths.get("youtube_shorts") or {}
    if plat:
        bucket.setdefault("min_ms", int(plat.get("min_s", 15) * 1000))
        bucket.setdefault("max_ms", int(plat.get("max_s", 90) * 1000))
        spot = plat.get("sweet_spot_s") or []
        if len(spot) == 2:
            bucket.setdefault("prefer_min_ms", int(spot[0] * 1000))
            bucket.setdefault("prefer_max_ms", int(spot[1] * 1000))
    return bucket


def selection_settings() -> dict[str, Any]:
    g = global_config()
    sel = g.get("selection") or {}
    return {
        "min_final": float(sel.get("min_final", 6.5)),
        "max_clips": int(sel.get("max_clips", 20)),
        "clips_per_minute": float(sel.get("clips_per_minute", 1 / 3)),
        "min_archetypes_per_hour": int(sel.get("min_archetypes_per_hour", 2)),
        "max_same_archetype_share": float(sel.get("max_same_archetype_share", 0.5)),
        "near_duplicate_jaccard": float(sel.get("near_duplicate_text_jaccard", 0.5)),
        "overlap_drop": 0.4,
    }


def snap_settings() -> dict[str, Any]:
    return global_config().get("snap") or {}
