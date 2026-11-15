"""ST-SBX-001..003: static policy for generated scene code (checked before any execution).

Hybrid model: generated Python may only import the engine surface (`motion_core`) and a small pure
allow-list, and may not touch dunders, builtins that reach the OS, or reflection. The runtime audit
hook (runner.py) is the second layer; rlimits + an env with no secrets + a scratch cwd are the third.
SEC-1 review is required before production custom code (D23).
"""
from __future__ import annotations

import ast

ALLOWED_IMPORTS = {"math", "random", "numpy", "skia", "colorsys", "itertools", "functools", "statistics",
                   "dataclasses", "typing", "motion_core", "bisect", "collections"}
BANNED_NAMES = {"__import__", "eval", "exec", "compile", "open", "globals", "locals", "vars", "getattr", "setattr",
                "delattr", "breakpoint", "input", "memoryview", "help", "exit", "quit", "__builtins__", "__loader__",
                "__spec__", "os", "sys", "subprocess", "socket", "importlib", "ctypes", "builtins", "shutil", "pathlib"}
MAX_CODE_BYTES = 120_000


class PolicyViolation(Exception):
    pass


def check_code(code: str) -> ast.Module:
    if len(code.encode()) > MAX_CODE_BYTES:
        raise PolicyViolation("code too large")
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise PolicyViolation(f"syntax error line {exc.lineno}: {exc.msg}") from None
    has_build = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name.split(".")[0] not in ALLOWED_IMPORTS:
                    raise PolicyViolation(f"import not allowed: {a.name}")
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] not in ALLOWED_IMPORTS or node.level:
                raise PolicyViolation(f"import not allowed: {node.module}")
        elif isinstance(node, ast.Name) and node.id in BANNED_NAMES:
            raise PolicyViolation(f"name not allowed: {node.id}")
        elif isinstance(node, ast.Attribute) and node.attr.startswith("__") and node.attr.endswith("__"):
            # Custom Item subclasses must call super().__init__; all other dunders stay banned.
            if node.attr != "__init__":
                raise PolicyViolation(f"dunder attribute not allowed: {node.attr}")
        elif isinstance(node, ast.Attribute) and node.attr in ("f_globals", "f_locals", "gi_frame", "cr_frame", "tb_frame", "f_back"):
            raise PolicyViolation(f"frame access not allowed: {node.attr}")
        elif isinstance(node, (ast.Global, ast.Nonlocal)):
            pass
        elif isinstance(node, ast.FunctionDef) and node.name == "build_scene":
            has_build = True
        elif isinstance(node, ast.Constant) and isinstance(node.value, str) and "__" in node.value and len(node.value) < 40:
            if node.value.startswith("__") and node.value.endswith("__"):
                raise PolicyViolation("dunder string not allowed")
    if not has_build:
        raise PolicyViolation("missing def build_scene(ctx)")
    return tree


SAFE_BUILTINS = ["abs", "all", "any", "bool", "dict", "divmod", "enumerate", "filter", "float", "frozenset", "int",
                 "isinstance", "issubclass", "iter", "len", "list", "map", "max", "min", "next", "pow", "print", "range",
                 "repr", "reversed", "round", "set", "slice", "sorted", "str", "sum", "tuple", "zip", "Exception",
                 "ValueError", "KeyError", "IndexError", "TypeError", "ZeroDivisionError", "StopIteration", "True",
                 "False", "None", "object", "property", "staticmethod", "classmethod", "super", "hasattr", "callable",
                 "hash", "id", "chr", "ord", "format", "type", "NotImplementedError", "ArithmeticError", "RuntimeError"]


PALETTE_KEYS = frozenset({"bg", "ink", "accent", "accent2", "muted"})
PRELOADED_NAMES = frozenset({"skia", "random", "math", "numpy", "np", "ctx"})
# Names provided by `from motion_core import *` / the sandbox. Kept here so lint
# does not need to import skia on unit hosts.
MOTION_CORE_NAMES = frozenset({
    "HOUSE", "LinearAxis", "StudioFilm", "CR", "keys_on_words", "mercator", "tile_positions",
    "Board", "Cached", "Chalk", "GeoMap", "Holes", "Ledger", "LOOKS", "MAP_LOOKS", "OpenLedger",
    "Print", "RegionFill", "CREAM", "WHITE", "RUST", "MUSTARD", "HILITE", "RED", "INK", "TEAL",
    "BarSeries", "BigText", "Callout", "Card", "ChapterCard", "Connector", "Counter", "DotField",
    "EmphasisMark", "FieldSpread", "FilmFrame", "GradientField", "GridField", "HeroSlam", "Item",
    "LineSeries", "LowerThird", "MapPin", "NoiseTexture", "Panel", "PaperDoc", "PenMark",
    "ParticleDrift", "PhotoFrame", "RollingNumber", "Route", "ScreenItem", "Stamp", "StringLine",
    "XMarker", "SAMPLING", "clamp", "color", "ease_in_out", "ease_out_back", "ease_out_cubic",
    "hexrgb", "legible", "look_from_style", "paint", "partial_path", "per_frame_grain", "ramp",
    "rot_point", "rrect", "spring", "text", "text_width",
})


def _call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _const_str(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def lint_scene(code: str) -> list[str]:
    """Pre-render AST checks: undefined names, bad signatures, unknown palette keys.

    Returns human-readable problems (empty if the code is statically ok). Syntax
    errors are reported as a problem rather than raised, so the fix loop can see them.
    """
    problems: list[str] = []
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return [f"syntax error line {exc.lineno}: {exc.msg}"]

    defined: set[str] = set(SAFE_BUILTINS) | set(PRELOADED_NAMES) | set(MOTION_CORE_NAMES)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                defined.add(a.asname or a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            for a in node.names:
                if a.name == "*":
                    defined |= MOTION_CORE_NAMES
                else:
                    defined.add(a.asname or a.name)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            defined.add(node.name)
            for arg in node.args.args + node.args.kwonlyargs:
                defined.add(arg.arg)
            if node.args.vararg:
                defined.add(node.args.vararg.arg)
            if node.args.kwarg:
                defined.add(node.args.kwarg.arg)
        elif isinstance(node, ast.arg):
            defined.add(node.arg)
        elif isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for tgt in targets:
                for n in ast.walk(tgt):
                    if isinstance(n, ast.Name):
                        defined.add(n.id)
        elif isinstance(node, ast.NamedExpr) and isinstance(node.target, ast.Name):
            defined.add(node.target.id)
        elif isinstance(node, ast.For) and isinstance(node.target, ast.Name):
            defined.add(node.target.id)
        elif isinstance(node, ast.ExceptHandler) and node.name:
            defined.add(node.name)
        elif isinstance(node, ast.alias):
            defined.add(node.asname or node.name.split(".")[0])

    # Second pass: uses and signature mistakes. For-loop targets already collected.
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load) and node.id not in defined:
            # Common false positives: comprehension targets are Stores first in the same tree
            problems.append(f"undefined name {node.id!r} — it is not in the sandbox or motion_core "
                            f"(preloaded: skia, random, math, numpy/np)")
        if isinstance(node, ast.Call):
            name = _call_name(node.func)
            if name == "StringLine":
                bad = [k.arg for k in node.keywords if k.arg == "rgb"]
                if bad:
                    problems.append(
                        "StringLine has no 'rgb' argument; it is a red thread. "
                        "Signature: StringLine(a, b, t_in, dur=1.0, sag=0.05, width=9, z=None, "
                        "pins=True, t_out=None, persist=False, hold=5.0, sfx=True). "
                        "Use Connector(..., rgb=...) to colour a line."
                    )
            if name == "drawRoundRect":
                npos = len(node.args)
                # Correct: (rect, rx, ry, paint) — 4 positional. Wrong: (x, y, w, h, r, paint) — 6.
                if npos >= 6:
                    problems.append(
                        "c.drawRoundRect(x, y, w, h, r, paint) is the wrong arity. "
                        "Use c.drawRRect(rrect(x, y, w, h, r), paint) or "
                        "c.drawRoundRect(skia.Rect.MakeXYWH(x, y, w, h), rx, ry, paint)."
                    )
            if name == "rgb" and node.args:
                # ctx.rgb("dark_line")
                key = _const_str(node.args[0])
                if key is not None and key not in PALETTE_KEYS:
                    problems.append(
                        f"unknown palette key {key!r} passed to ctx.rgb. "
                        f"Only {sorted(PALETTE_KEYS)} exist. Mix from those or use CREAM/WHITE/"
                        f"RUST/MUSTARD/HILITE/RED/INK/TEAL."
                    )
            if name == "get" and node.args and isinstance(node.func, ast.Attribute):
                # ctx.palette.get("dark_line")
                if isinstance(node.func.value, ast.Attribute) and node.func.value.attr == "palette":
                    key = _const_str(node.args[0])
                    if key is not None and key not in PALETTE_KEYS:
                        problems.append(
                            f"unknown palette key {key!r} on ctx.palette.get. "
                            f"Only {sorted(PALETTE_KEYS)} exist."
                        )
        if isinstance(node, ast.Subscript):
            # ctx.palette["dark_line"] or palette["dark_line"]
            sl = node.slice
            key = _const_str(sl)
            holder = node.value
            is_palette = (isinstance(holder, ast.Name) and holder.id == "palette") or (
                isinstance(holder, ast.Attribute) and holder.attr == "palette"
            )
            if is_palette and key is not None and key not in PALETTE_KEYS:
                problems.append(
                    f"unknown palette key {key!r}. Only {sorted(PALETTE_KEYS)} exist."
                )

    # Dedup while preserving order (undefined names can appear many times)
    seen, out = set(), []
    for p in problems:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out
