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
