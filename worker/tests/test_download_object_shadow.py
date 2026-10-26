"""Ensure no function uses download_object before a local import shadows the name (UnboundLocalError)."""
from __future__ import annotations

import ast
from pathlib import Path


def _function_shadows_download_object(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> str | None:
    names_imported_locally: set[str] = set()
    for node in ast.walk(fn):
        if isinstance(node, ast.ImportFrom) and node.module == "clips_worker.storage":
            for alias in node.names:
                if alias.name == "download_object":
                    names_imported_locally.add("download_object")
    if "download_object" not in names_imported_locally:
        return None
    first_use_line: int | None = None
    import_line: int | None = None
    for node in ast.walk(fn):
        if isinstance(node, ast.ImportFrom) and node.module == "clips_worker.storage":
            for alias in node.names:
                if alias.name == "download_object":
                    import_line = node.lineno
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "download_object":
            if first_use_line is None:
                first_use_line = node.lineno
    if first_use_line is not None and import_line is not None and first_use_line < import_line:
        return f"{fn.name} uses download_object at line {first_use_line} before import at {import_line}"
    return None


def test_no_download_object_shadow_in_clips_worker():
    root = Path(__file__).resolve().parents[1] / "clips_worker"
    violations: list[str] = []
    for path in sorted(root.rglob("*.py")):
        tree = ast.parse(path.read_text())
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                msg = _function_shadows_download_object(node)
                if msg:
                    violations.append(f"{path.name}:{msg}")
    assert not violations, "download_object shadow bugs:\n" + "\n".join(violations)
