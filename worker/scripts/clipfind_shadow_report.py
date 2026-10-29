#!/usr/bin/env python3
"""Read clipfind shadow + ledger JSON from S3 keys and print summary table (C1)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from clips_worker.storage import download_object, get_json


def _load(path_or_key: str) -> dict:
    p = Path(path_or_key)
    if p.is_file():
        return json.loads(p.read_text(encoding="utf-8"))
    return get_json(path_or_key)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Clipfind shadow report")
    ap.add_argument("keys", nargs="+", help="S3 keys or local paths to clipfind_shadow.json / ledger")
    args = ap.parse_args(argv)
    for key in args.keys:
        try:
            if key.endswith("clipfind_ledger.json"):
                data = _load(key)
                print(f"=== ledger {key} ===")
                print("candidates", data.get("candidateCount"), "drops", data.get("dropCountsBySite"))
                continue
            shadow = _load(key)
            print(f"=== shadow {key} ===")
            print("overlap_at_n", shadow.get("overlap_at_n"))
            print("investigate", shadow.get("investigate_count"), "pool", shadow.get("pool_count"))
            print("old_top", shadow.get("old_top"))
            print("new_top", shadow.get("new_top"))
            print("new_only", json.dumps(shadow.get("new_only") or [], indent=2)[:4000])
            print("old_only", json.dumps(shadow.get("old_only") or [], indent=2)[:2000])
        except Exception as exc:
            print(f"ERR {key}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
