#!/usr/bin/env python3
"""Build music library catalog JSON from prompt presets (dry run).

Use ``--run`` only for manual ElevenLabs generation (never in CI/tests).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROMPTS_PATH = REPO / "new-app/lib/clips/music-library-prompts.json"
CATALOG_PATH = REPO / "new-app/lib/clips/music-library-catalog.json"


def load_prompts(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("prompts must be a JSON array")
    return raw


def build_catalog_entries(prompts: list[dict]) -> list[dict]:
    out: list[dict] = []
    for row in prompts:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        out.append(
            {
                "id": str(row["id"]),
                "title": str(row.get("title") or row["id"]),
                "mood": row.get("mood"),
                "genre": row.get("genre"),
                "energy": row.get("energy"),
                "lengthS": int(row.get("lengthS") or 0),
                "prompt": str(row.get("prompt") or ""),
                "kind": "music",
                "source": "transovo-music",
                "license": "elevenlabs",
            }
        )
    return out


def write_catalog(out_path: Path, entries: list[dict]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build music library catalog JSON")
    parser.add_argument("--prompts", type=Path, default=PROMPTS_PATH)
    parser.add_argument("--out", type=Path, default=CATALOG_PATH)
    parser.add_argument(
        "--run",
        action="store_true",
        help="Generate audio via ElevenLabs (manual only — not used in CI)",
    )
    args = parser.parse_args()
    if args.run:
        raise SystemExit("--run is for manual operator use only; this script writes catalog JSON.")
    prompts = load_prompts(args.prompts)
    entries = build_catalog_entries(prompts)
    write_catalog(args.out, entries)
    print(json.dumps({"written": str(args.out), "count": len(entries)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
