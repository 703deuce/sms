"""Regression: inner import must not shadow module-level download_object (export UnboundLocalError)."""
from __future__ import annotations

import ast
from pathlib import Path


def test_run_script_composition_render_job_does_not_shadow_download_object():
    path = Path(__file__).resolve().parents[1] / "clips_worker" / "script_composition_render.py"
    tree = ast.parse(path.read_text())
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "run_script_composition_render_job":
            for child in ast.walk(node):
                if isinstance(child, ast.ImportFrom) and child.module == "clips_worker.storage":
                    for alias in child.names:
                        if alias.name == "download_object":
                            raise AssertionError(
                                "run_script_composition_render_job must not re-import download_object "
                                "(causes UnboundLocalError on earlier calls)"
                            )
            return
    raise AssertionError("run_script_composition_render_job not found")
