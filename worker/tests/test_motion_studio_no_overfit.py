"""Runtime packages and prompts must not leak test-film terms or copyable topic examples.

Test fixtures and unit tests may name past films. vendor/cinematic_skill and
gazetteer dictionaries (stock.py place lists, map GeoJSON) are excluded.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

WORKER_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = WORKER_ROOT.parent
if not (REPO_ROOT / "new-app").is_dir():
    # Inside the worker image the tests live at /app/tests and the package at /app/clips_worker.
    REPO_ROOT = WORKER_ROOT

FILM_TERMS = [
    (re.compile(r"blockbuster", re.I), "Blockbuster"),
    (re.compile(r"netflix", re.I), "Netflix"),
    (re.compile(r"gamestop", re.I), "GameStop"),
    (re.compile(r"\bkeef\b", re.I), "Keef"),
    (re.compile(r"wright\s+flyer", re.I), "Wright Flyer"),
    (re.compile(r"\bgme\b"), "GME"),
    (re.compile(r"kill\s+devil", re.I), "Kill Devil Hills"),
    (re.compile(r"sandi\s+harding", re.I), "Sandi Harding"),
    (re.compile(r"roaring\s+kitty", re.I), "Roaring Kitty"),
    (re.compile(r"short\s+squeeze", re.I), "short squeeze"),
]

# Place names that only belong in gazetteers / map data, not prompts or defaults.
PLACE_TERMS = [
    (re.compile(r"\bSydney\b"), "Sydney"),
    (re.compile(r"Kill Devil Hills"), "Kill Devil Hills"),
]

SKIP_DIR_NAMES = {
    "vendor", "tests", "fixtures", "__pycache__", "node_modules", ".next",
    "maps", "dist", "build",
}
SKIP_FILE_NAMES = {"test_motion_studio_no_overfit.py"}
TEXT_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt"}

# stock.py and GeoJSON are gazetteers, not default tours.
GAZETTEER_REL = {
    "clips_worker/motion_studio/core/stock.py",
    "worker/clips_worker/motion_studio/core/stock.py",
}


def _iter_runtime_files() -> list[Path]:
    roots: list[Path] = []
    pkg = WORKER_ROOT / "clips_worker" / "motion_studio"
    if pkg.is_dir():
        roots.append(pkg)
    for rel in (
        "new-app/lib/motion-studio",
        "new-app/lib/server/motion-studio",
        "new-app/components/motion-studio",
        "lib/motion-studio",
        "lib/server/motion-studio",
        "components/motion-studio",
    ):
        cand = REPO_ROOT / rel
        if cand.is_dir():
            roots.append(cand)
    files: list[Path] = []
    seen: set[Path] = set()
    for root in roots:
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            if any(part in SKIP_DIR_NAMES for part in path.parts):
                continue
            if path.name in SKIP_FILE_NAMES:
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            files.append(path)
    return files


def _is_gazetteer(path: Path) -> bool:
    s = str(path).replace("\\", "/")
    return s.endswith("/core/stock.py") or "/assets/maps/" in s or path.suffix.lower() == ".geojson"


def test_runtime_and_prompts_have_no_test_film_terms():
    hits: list[str] = []
    files = _iter_runtime_files()
    assert files, "runtime file walk returned nothing"
    for path in files:
        text = path.read_text(errors="replace")
        gazetteer = _is_gazetteer(path)
        terms = FILM_TERMS if gazetteer else FILM_TERMS + PLACE_TERMS
        for i, line in enumerate(text.splitlines(), 1):
            # Allow a comment that names the anti-pattern next(iter...) without film titles.
            for rx, label in terms:
                if rx.search(line):
                    rel = path
                    hits.append(f"{rel}:{i}: {label}: {line.strip()[:160]}")
    if hits:
        pytest.fail(
            "Test-film terms in runtime/prompts (fixtures/tests/vendor/gazetteers are allowed):\n"
            + "\n".join(hits)
        )


def test_prompt_examples_do_not_pick_a_random_catalog_asset():
    """Models copied next(iter(ctx.assets)) and showed the wrong still."""
    roots = []
    pkg = WORKER_ROOT / "clips_worker" / "motion_studio"
    if pkg.is_dir():
        roots.append(pkg)
    hits = []
    for root in roots:
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in {".py", ".json"}:
                continue
            if any(part in SKIP_DIR_NAMES for part in path.parts):
                continue
            text = path.read_text(errors="replace")
            if "next(iter(ctx.assets))" in text:
                # Allowed only as a prohibition, not as example code to copy.
                for i, line in enumerate(text.splitlines(), 1):
                    if "next(iter(ctx.assets))" not in line:
                        continue
                    low = line.lower()
                    if any(w in low for w in ("never", "do not", "don't", "not pick", "must not")):
                        continue
                    hits.append(f"{path}:{i}: {line.strip()[:160]}")
    if hits:
        pytest.fail("Example code still picks a random catalog asset:\n" + "\n".join(hits))
