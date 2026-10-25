"""Load picker prompts and genre config from files (hot-swappable without code changes)."""
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


@lru_cache(maxsize=1)
def load_core_rubric() -> str:
    return (PICKER_ROOT / "prompts" / "core.md").read_text(encoding="utf-8").strip()


def resolve_genre_key(genre: str) -> str:
    cfg = genres_config()
    g = (genre or cfg.get("default_genre", "podcast")).strip().lower()
    genres = cfg.get("genres") or {}
    if g in genres:
        return g
    for key, meta in genres.items():
        aliases = meta.get("aliases") or []
        if g in aliases or g in str(key).lower():
            return key
    return cfg.get("default_genre", "podcast")


def genre_meta(genre: str) -> dict[str, Any]:
    key = resolve_genre_key(genre)
    cfg = genres_config()
    genres = cfg.get("genres") or {}
    base = genres.get(key) or genres.get(cfg.get("default_genre", "podcast")) or {}
    return {"key": key, **base}


def load_genre_prompt(genre: str) -> str:
    meta = genre_meta(genre)
    prompt_file = meta.get("prompt_file") or meta.get("key") or "podcast"
    path = PICKER_ROOT / "prompts" / "genres" / f"{prompt_file}.md"
    if not path.is_file():
        path = PICKER_ROOT / "prompts" / "genres" / "podcast.md"
    return path.read_text(encoding="utf-8").strip()


def score_weights(genre: str) -> dict[str, float]:
    cfg = genres_config()
    default = (cfg.get("scoring") or {}).get("weights") or {}
    meta = genre_meta(genre)
    weights = meta.get("score_weights") or default
    return {
        "hook": float(weights.get("hook", 0.3)),
        "self_contained": float(weights.get("self_contained", 0.2)),
        "payoff": float(weights.get("payoff", 0.2)),
        "energy": float(weights.get("energy", 0.15)),
        "value": float(weights.get("value", 0.15)),
    }


def signal_preferences_text(genre: str) -> str:
    prefs = genre_meta(genre).get("signal_preferences") or {}
    if not prefs:
        return ""
    lines = [f"- {k}: {prefs[k]}" for k in sorted(prefs.keys())]
    return "Signal preferences for this genre:\n" + "\n".join(lines)


def length_bucket(clip_length: str, genre: str) -> dict[str, int]:
    cfg = genres_config()
    buckets = cfg.get("clip_length_buckets") or {}
    bucket = dict(buckets.get(clip_length) or buckets.get("auto") or {})
    overrides = genre_meta(genre).get("length_bucket_overrides") or {}
    for k, v in overrides.items():
        if clip_length in (k, "all"):
            bucket.update(v)
    return bucket


def cleanup_settings() -> dict[str, Any]:
    cfg = genres_config()
    scoring = cfg.get("scoring") or {}
    return {
        "min_score": int(scoring.get("min_score", 60)),
        "top_n": int(scoring.get("top_n", 10)),
        "overlap_drop": float(cfg.get("overlap_drop", 0.4)),
        "padding_ms": int(cfg.get("padding_ms", 150)),
        "max_windows": int(cfg.get("max_candidate_windows", 300)),
    }
