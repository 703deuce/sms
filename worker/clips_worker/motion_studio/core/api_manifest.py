"""Machine-readable Motion Core API manifest, generated from the pinned engine.

This module does not import skia or the engine at runtime. It parses the pinned
sources with the AST so unit hosts and the worker image agree. The committed
JSON is the single source of truth for Designer docs, preflight lint, targeted
repair prompts, and the eight-failure regression tests.
"""
from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MS_ROOT = HERE.parent  # motion_studio/
VENDOR_ENGINE = MS_ROOT / "vendor" / "cinematic_skill" / "engine.py"
MANIFEST_PATH = HERE / "motion_core_api_manifest.json"
ENGINE_SHA = "bf435561c6203f90f971300efe952b68b5ec3417"
ENGINE_VERSION = f"cinematic-skill@{ENGINE_SHA[:7]}+transovo-core-v1"

ALLOWED_IMPORTS = [
    "motion_core", "math", "random", "numpy", "skia", "colorsys", "itertools",
    "functools", "statistics", "dataclasses", "typing", "bisect", "collections",
]
PRELOADED = ["skia", "random", "math", "numpy", "np"]
PALETTE_KEYS = ["bg", "ink", "accent", "accent2", "muted"]
COLOR_CONSTANTS = ["CREAM", "WHITE", "RUST", "MUSTARD", "HILITE", "RED", "INK", "TEAL"]

# Host (skia) calls that scene code may use on a canvas. Documented from the
# arities actually used in the pinned engine + Transovo blocks, plus the one
# call models invent incorrectly (drawRoundRect with x,y,w,h,r,paint).
SKIA_SURFACE = {
    "drawRRect": {
        "kind": "skia.Canvas.method",
        "signature": "canvas.drawRRect(rr, paint)",
        "params": [
            {"name": "rr", "kind": "positional", "doc": "skia.RRect (use rrect(x, y, w, h, r))"},
            {"name": "paint", "kind": "positional", "doc": "skia.Paint from paint(rgb, a)"},
        ],
        "arity": [2],
        "example": "c.drawRRect(rrect(x, y, w, h, 12), paint((255, 255, 255), 1))",
    },
    "drawRoundRect": {
        "kind": "skia.Canvas.method",
        "signature": "canvas.drawRoundRect(rect, rx, ry, paint)",
        "params": [
            {"name": "rect", "kind": "positional", "doc": "skia.Rect, e.g. skia.Rect.MakeXYWH(x, y, w, h)"},
            {"name": "rx", "kind": "positional", "doc": "corner radius x"},
            {"name": "ry", "kind": "positional", "doc": "corner radius y"},
            {"name": "paint", "kind": "positional", "doc": "skia.Paint from paint(rgb, a)"},
        ],
        "arity": [4],
        "forbiddenArities": [6],
        "wrong": "c.drawRoundRect(x, y, w, h, r, paint)  # wrong arity",
        "example": "c.drawRoundRect(skia.Rect.MakeXYWH(x, y, w, h), 12, 12, paint((255, 255, 255), 1))",
        "prefer": "c.drawRRect(rrect(x, y, w, h, 12), paint((255, 255, 255), 1))",
    },
    "drawRect": {
        "kind": "skia.Canvas.method",
        "signature": "canvas.drawRect(rect, paint)",
        "params": [
            {"name": "rect", "kind": "positional"},
            {"name": "paint", "kind": "positional"},
        ],
        "arity": [2],
        "example": "c.drawRect(skia.Rect.MakeXYWH(x, y, w, h), paint((255, 255, 255), 1))",
    },
    "drawCircle": {
        "kind": "skia.Canvas.method",
        "signature": "canvas.drawCircle(x, y, radius, paint)",
        "arity": [4],
        "example": "c.drawCircle(x, y, 40, paint((255, 255, 255), 1))",
    },
    "drawPath": {
        "kind": "skia.Canvas.method",
        "signature": "canvas.drawPath(path, paint)",
        "arity": [2],
        "example": "c.drawPath(path, paint((255, 255, 255), 1))",
    },
}

# Validated minimal usage examples (executed in tests when skia is present).
# Each is a full build_scene so check_code / lint_scene / a probe can run it.
EXAMPLES = {
    "StringLine": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    # No rgb kwarg — the string is a red thread. Colour a line with Connector(..., rgb=...).
    film.add(StringLine((0, 0), (1200, 0), 0.1, dur=0.8, sag=0.05, width=9, persist=True))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 200, 0, 0.35)
    return film
''',
    "Connector": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    acc = ctx.rgb("accent")
    film.add(Connector((0, 0), (1200, 200), 0.1, dur=0.8, rgb=acc))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 200, 0, 0.35)
    return film
''',
    "rrect": '''from motion_core import *
class Chip(Item):
    def __init__(self, x, y, t_in):
        super().__init__(t_in, None, 10, False)
        self.x, self.y = x, y
    def draw(self, c, res, t):
        c.drawRRect(rrect(self.x, self.y, 200, 80, 12), paint(ctx_ink(res), 1))
def ctx_ink(res):
    return (245, 245, 245)
def build_scene(ctx):
    film = ctx.film()
    film.add(Chip(-100, 0, 0.1))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 0, 0, 0.4)
    return film
''',
    "drawRoundRect": '''from motion_core import *
class Chip(Item):
    def __init__(self, x, y, t_in):
        super().__init__(t_in, None, 10, False)
        self.x, self.y = x, y
    def draw(self, c, res, t):
        c.drawRoundRect(skia.Rect.MakeXYWH(self.x, self.y, 200, 80), 12, 12, paint((245, 245, 245), 1))
def build_scene(ctx):
    film = ctx.film()
    film.add(Chip(-100, 0, 0.1))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 0, 0, 0.4)
    return film
''',
    "palette": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    bg, ink, acc = ctx.rgb("bg"), ctx.rgb("ink"), ctx.rgb("accent")
    film.add(HeroSlam("HELLO", 0, 0, 280, 0.1, None, rgb=ink, glow=0.3))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 0, 0, 0.35)
    return film
''',
    "shot": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    film.add(HeroSlam("ONE", 0, 0, 280, 0.1, None, rgb=ctx.rgb("ink")))
    film.add(HeroSlam("TWO", 1800, 0, 280, 0.5, None, rgb=ctx.rgb("accent")))
    # Spotlight keys on different targets must be at least 0.25 s apart.
    film.shot(0.0, 0, 0, 0.6)
    film.shot(0.5, 1800, 0, 0.6)
    film.cam(ctx.duration, 900, 0, 0.35)
    return film
''',
    "skia": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    # skia and random are preloaded — no import required.
    _ = skia.Rect.MakeXYWH(0, 0, 10, 10)
    _ = ctx.rand.random()
    film.add(HeroSlam("OK", 0, 0, 280, 0.1, None, rgb=ctx.rgb("ink")))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 0, 0, 0.4)
    return film
''',
    "PhotoFrame": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    key = (ctx.scene or {}).get("assetId")
    if not key and ctx.assets:
        key = next(iter(ctx.assets))
    if key:
        film.add(PhotoFrame(key, 0, 0, 1600, rot=-1.0, t_in=0.1, skin="print"))
    else:
        film.add(HeroSlam("STILL", 0, 0, 280, 0.1, None, rgb=ctx.rgb("ink")))
    film.cam(0, 0, 0, 0.45)
    film.cam(ctx.duration, 0, 0, 0.4)
    return film
''',
    "HeroSlam": '''from motion_core import *
def build_scene(ctx):
    film = ctx.film()
    film.add(HeroSlam("TITLE", 0, 0, 280, 0.1, None, rgb=ctx.rgb("ink"), glow=0.3))
    film.cam(0, 0, 0, 0.4)
    film.cam(ctx.duration, 0, 0, 0.35)
    return film
''',
}


def _ann(node) -> str | None:
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:  # noqa: BLE001
        return None


def _default(node) -> str | None:
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except Exception:  # noqa: BLE001
        return None


def _signature(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> dict:
    a = fn.args
    params = []
    pos = list(a.posonlyargs) + list(a.args)
    defaults = list(a.defaults)
    n_no_def = len(pos) - len(defaults)
    for i, arg in enumerate(pos):
        rec = {"name": arg.arg, "kind": "positional"}
        if arg.annotation:
            rec["annotation"] = _ann(arg.annotation)
        if i >= n_no_def:
            rec["default"] = _default(defaults[i - n_no_def])
        if arg.arg != "self":
            params.append(rec)
    if a.vararg:
        params.append({"name": a.vararg.arg, "kind": "var_positional"})
    for arg, default in zip(a.kwonlyargs, a.kw_defaults):
        rec = {"name": arg.arg, "kind": "keyword_only"}
        if arg.annotation:
            rec["annotation"] = _ann(arg.annotation)
        if default is not None:
            rec["default"] = _default(default)
        params.append(rec)
    if a.kwarg:
        params.append({"name": a.kwarg.arg, "kind": "var_keyword"})
    # Render a compact signature string.
    parts = []
    for p in params:
        if p["kind"] == "var_positional":
            parts.append("*" + p["name"])
        elif p["kind"] == "var_keyword":
            parts.append("**" + p["name"])
        elif "default" in p:
            parts.append(f"{p['name']}={p['default']}")
        else:
            parts.append(p["name"])
    sig = f"{fn.name}({', '.join(parts)})"
    kwargs = [p["name"] for p in params if p["kind"] != "var_positional"]
    return {"signature": sig, "params": params, "kwargs": kwargs, "name": fn.name}


def _parse_module(path: Path, *, skip_private: bool = True) -> dict:
    tree = ast.parse(path.read_text())
    symbols: dict[str, dict] = {}
    constants: dict[str, str] = {}
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and not (skip_private and node.name.startswith("_")):
            init = next((n for n in node.body if isinstance(n, ast.FunctionDef) and n.name == "__init__"), None)
            methods = {}
            for n in node.body:
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and not n.name.startswith("_"):
                    methods[n.name] = _signature(n)
            bases = [b.id for b in node.bases if isinstance(b, ast.Name)]
            rec = {"kind": "class", "name": node.name, "source": path.name, "methods": methods, "bases": bases}
            if init:
                sig = _signature(init)
                rec["signature"] = f"{node.name}({sig['signature'].split('(', 1)[1]}"
                rec["params"] = sig["params"]
                rec["kwargs"] = sig["kwargs"]
            else:
                rec["signature"] = f"{node.name}()"
                rec["params"] = []
                rec["kwargs"] = []
            doc = ast.get_docstring(node)
            if doc:
                rec["doc"] = doc.split("\n")[0][:240]
            symbols[node.name] = rec
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not (skip_private and node.name.startswith("_")):
            sig = _signature(node)
            rec = {"kind": "function", "name": node.name, "source": path.name, **sig}
            doc = ast.get_docstring(node)
            if doc:
                rec["doc"] = doc.split("\n")[0][:240]
            symbols[node.name] = rec
        elif isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name) and tgt.id.isupper() and not tgt.id.startswith("_"):
                    constants[tgt.id] = _default(node.value) or ""
    return {"symbols": symbols, "constants": constants}


def _source_files() -> list[tuple[str, Path]]:
    return [
        ("engine", VENDOR_ENGINE),
        ("blocks", HERE / "blocks.py"),
        ("world", HERE / "world.py"),
        ("api", HERE / "api.py"),
    ]


def _exports_from_api() -> set[str]:
    """Names `from motion_core import *` should expose, parsed from api.py without importing it."""
    tree = ast.parse((HERE / "api.py").read_text())
    names: set[str] = set()
    for node in tree.body:
        if isinstance(node, (ast.ImportFrom, ast.Import)):
            for a in getattr(node, "names", []):
                if a.name != "*":
                    names.add(a.asname or a.name)
        if isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name) and tgt.id == "__all__":
                    try:
                        val = ast.literal_eval(node.value)
                        if isinstance(val, (list, tuple)):
                            names.update(str(x) for x in val)
                    except Exception:  # noqa: BLE001
                        pass
    # api.py uses __all__ = [n for n in dir() if not n.startswith("_")], so collect imports.
    return {n for n in names if not n.startswith("_")}


def _cue_kinds() -> list[str]:
    path = MS_ROOT / "vendor" / "cinematic_skill" / "build_sfx.py"
    if not path.exists():
        return []
    tree = ast.parse(path.read_text())
    # Public kind builders: whoosh, pop, slide, ... heartbeat, clock
    skip = {"n_of", "envelope", "sweep", "band_noise", "tone", "hit", "fade", "room_tone", "main"}
    names = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and not node.name.startswith("_") and node.name not in skip:
            names.append(node.name)
    return names


def generate() -> dict:
    files = []
    symbols: dict[str, dict] = {}
    constants: dict[str, str] = {}
    hasher = hashlib.sha256()
    hasher.update(ENGINE_SHA.encode())
    sfx = MS_ROOT / "vendor" / "cinematic_skill" / "build_sfx.py"
    if sfx.exists():
        hasher.update(b"sfx:")
        hasher.update(sfx.read_bytes())
    for label, path in _source_files():
        raw = path.read_text()
        hasher.update(f"{label}:{path.name}:".encode())
        hasher.update(raw.encode())
        files.append({"id": label, "path": str(path.relative_to(MS_ROOT)), "sha256": hashlib.sha256(raw.encode()).hexdigest()[:16]})
        parsed = _parse_module(path)
        # Later files override earlier ones when Transovo wraps an engine symbol,
        # but a subclass (StudioFilm(Film)) should inherit the base methods.
        for name, rec in parsed["symbols"].items():
            if rec.get("kind") == "class" and name in symbols and symbols[name].get("kind") == "class":
                methods = dict(symbols[name].get("methods") or {})
                methods.update(rec.get("methods") or {})
                rec = {**rec, "methods": methods}
            symbols[name] = rec
        constants.update(parsed["constants"])
    # Inherit methods along documented base classes (e.g. StudioFilm(Film)).
    for name, rec in list(symbols.items()):
        if rec.get("kind") != "class":
            continue
        methods = dict(rec.get("methods") or {})
        for base in rec.get("bases") or []:
            parent = symbols.get(base) or {}
            if parent.get("methods"):
                inherited = dict(parent["methods"])
                inherited.update(methods)
                methods = inherited
        rec["methods"] = methods
    exports = _exports_from_api() | set(PRELOADED) | set(COLOR_CONSTANTS) | {"skia", "random", "math", "numpy", "np"}
    # Attach examples where we have them (by class/function name or alias).
    for key, rec in list(symbols.items()):
        if key in EXAMPLES:
            rec["example"] = EXAMPLES[key]
    # StudioFilm methods are the camera API — copy onto a top-level "film" hint
    film = symbols.get("StudioFilm") or {}
    ctx = {
        "kind": "ctx",
        "fields": [
            "duration", "fps", "width", "height", "seed", "style", "palette",
            "lines", "words", "emphasis", "assets", "data", "scene", "blueprint",
        ],
        "methods": {
            "W": {"signature": "ctx.W(line_id, word, nth=0, end=False)", "doc": "Word clock; raises on a miss."},
            "film": {"signature": "ctx.film(drift=1.0, wobble=1.0) -> StudioFilm"},
            "rgb": {"signature": "ctx.rgb(name, default=(240, 240, 240))", "keys": list(PALETTE_KEYS),
                    "doc": "Palette lookup. Only bg, ink, accent, accent2, muted exist."},
            "rand": {"signature": "ctx.rand", "doc": "seeded random.Random; prefer this over random.random()."},
            "geo": {"signature": "ctx.geo(name='world'|'us', K=20000, origin=(0,0), look=...)"},
            "place": {"signature": "ctx.place(geomap, name) -> (x, y)"},
            "ll": {"signature": "ctx.ll(geomap, lat, lon) -> (x, y)"},
        },
        "paletteKeys": list(PALETTE_KEYS),
    }
    manifest = {
        "schema": 1,
        "engineVersion": ENGINE_VERSION,
        "engineSha": ENGINE_SHA,
        "sourceHash": hasher.hexdigest()[:24],
        "files": files,
        "allowedImports": list(ALLOWED_IMPORTS),
        "preloaded": list(PRELOADED),
        "paletteKeys": list(PALETTE_KEYS),
        "colorConstants": list(COLOR_CONSTANTS),
        "exports": sorted(exports | set(symbols) | set(constants)),
        "constants": {k: constants[k] for k in sorted(constants)},
        "symbols": {k: symbols[k] for k in sorted(symbols)},
        "skiaSurface": SKIA_SURFACE,
        "ctx": ctx,
        "studioFilm": film,
        "examples": {k: EXAMPLES[k] for k in sorted(EXAMPLES)},
        "cueKinds": _cue_kinds(),
    }
    return manifest


def dump(path: Path | None = None) -> Path:
    path = path or MANIFEST_PATH
    data = generate()
    path.write_text(json.dumps(data, indent=2, sort_keys=False) + "\n")
    return path


_cached: dict | None = None


def load_manifest(path: Path | None = None) -> dict:
    global _cached
    path = path or MANIFEST_PATH
    if _cached is not None and path == MANIFEST_PATH:
        return _cached
    if not path.exists():
        data = generate()
    else:
        data = json.loads(path.read_text())
    if path == MANIFEST_PATH:
        _cached = data
    return data


def assert_fresh(path: Path | None = None) -> None:
    """Raise if the committed manifest does not match a fresh generation from the sources."""
    path = path or MANIFEST_PATH
    fresh = generate()
    if not path.exists():
        raise AssertionError("motion core API manifest is missing")
    committed = json.loads(path.read_text())
    if committed.get("sourceHash") != fresh["sourceHash"] or committed.get("engineSha") != fresh["engineSha"]:
        raise AssertionError(
            f"API manifest is stale: committed sourceHash={committed.get('sourceHash')} "
            f"engineSha={committed.get('engineSha')}; generated sourceHash={fresh['sourceHash']} "
            f"engineSha={fresh['engineSha']}. Re-run: python3 -m clips_worker.motion_studio.core.api_manifest"
        )


def format_api_reference(manifest: dict | None = None) -> str:
    m = manifest or load_manifest()
    lines = [
        f"motion_core API ({m['engineVersion']}; engine sha {m['engineSha'][:7]}). "
        "World units = 4K px at zoom 1; frame is 3840x2160 world px at zoom 1.",
        "The following contract is generated from the pinned engine and Transovo core — do not invent symbols or kwargs.",
        "",
        "SANDBOX NAMES (already in scope; also exported by `from motion_core import *`): "
        + ", ".join(m["preloaded"]) + ". Prefer ctx.rand (seeded) over random.random().",
        "ALLOWED IMPORTS: " + ", ".join(m["allowedImports"]) + ".",
        "PALETTE: ctx.palette and ctx.rgb(name) know ONLY these keys: "
        + ", ".join(m["paletteKeys"])
        + ". There is no dark_line or any other key. Mix from those five, or use "
        + ", ".join(m["colorConstants"]) + ".",
        "",
        "ctx: " + ", ".join(m["ctx"]["fields"]) + ".",
    ]
    for name, rec in m["ctx"]["methods"].items():
        lines.append(f"  {rec['signature']}" + (f" — {rec['doc']}" if rec.get("doc") else ""))
    film = m.get("studioFilm") or {}
    if film.get("methods"):
        lines.append("StudioFilm methods:")
        for name, rec in film["methods"].items():
            extra = ""
            if name == "shot":
                extra = " (places a spotlight; two keys < 0.25 s apart on different targets fail QA)."
            lines.append(f"  film.{rec.get('signature', name)}{extra}")
    # High-traffic constructors
    prefer = [
        "HeroSlam", "RollingNumber", "Callout", "Connector", "PhotoFrame", "StringLine",
        "PenMark", "Stamp", "Panel", "LineSeries", "BarSeries", "LowerThird", "ChapterCard",
        "GradientField", "GridField", "ParticleDrift", "NoiseTexture", "MapPin", "Route",
        "GeoMap", "RegionFill", "Board", "Print", "PaperDoc", "Item", "rrect", "paint", "text",
    ]
    lines.append("Constructors and helpers (generated signatures):")
    for name in prefer:
        rec = (m.get("symbols") or {}).get(name)
        if rec and rec.get("signature"):
            lines.append(f"  {rec['signature']}")
    lines.append("skia canvas (use these arities only):")
    for name, rec in (m.get("skiaSurface") or {}).items():
        lines.append(f"  {rec['signature']}" + (f"  Prefer: {rec['prefer']}" if rec.get("prefer") else ""))
        if rec.get("wrong"):
            lines.append(f"    WRONG: {rec['wrong']}")
    sl = (m.get("symbols") or {}).get("StringLine") or {}
    if sl and "rgb" not in (sl.get("kwargs") or []):
        lines.append("StringLine has no 'rgb' argument; it is a red thread. Use Connector(..., rgb=...) to colour a line.")
    lines.append("SPOTLIGHT: film.shot() and film.focus() each place a spotlight key. "
                 "Two spotlight keys closer than 0.25 s that target different positions fail QA. "
                 "Space them at least 0.25 s apart, or keep the same target. "
                 "A camera hold should use film.cam() for the second key.")
    if m.get("cueKinds"):
        lines.append("film.cue(kind, t, gain=1.0) kinds: " + ", ".join(m["cueKinds"]) + ".")
    lines.append("Color constants: " + ", ".join(m.get("colorConstants") or []) + ".")
    classes = sorted(n for n, r in (m.get("symbols") or {}).items() if r.get("kind") == "class")
    lines.append("All exposed classes: " + ", ".join(classes) + ".")
    return "\n".join(lines)



def _line_from_traceback(problems: list[str], code: str | None) -> tuple[int | None, str]:
    """Best-effort offending line number and text from a problem list or source."""
    import re
    blob = "\n".join(problems)
    m = re.search(r"line (\d+)", blob)
    lineno = int(m.group(1)) if m else None
    text = ""
    if code and lineno:
        lines = code.splitlines()
        if 1 <= lineno <= len(lines):
            text = lines[lineno - 1]
    return lineno, text


def _symbol_for_problems(problems: list[str], manifest: dict) -> list[dict]:
    blob = " ".join(problems).lower()
    hits = []
    # Specific failures first
    if "stringline" in blob or ("rgb" in blob and "string" in blob):
        rec = (manifest.get("symbols") or {}).get("StringLine")
        if rec:
            hits.append({**rec, "name": "StringLine", "example": manifest["examples"].get("StringLine")})
    if "drawroundrect" in blob or "rrect" in blob or ("arity" in blob and "round" in blob):
        rec = (manifest.get("skiaSurface") or {}).get("drawRoundRect")
        if rec:
            hits.append({**rec, "name": "drawRoundRect", "example": rec.get("example")})
        rec2 = (manifest.get("symbols") or {}).get("rrect")
        if rec2:
            hits.append({**rec2, "name": "rrect", "example": manifest["examples"].get("rrect")})
    if "palette" in blob or "dark_line" in blob or "ctx.rgb" in blob:
        hits.append({
            "name": "ctx.rgb",
            "signature": manifest["ctx"]["methods"]["rgb"]["signature"],
            "keys": manifest["paletteKeys"],
            "example": manifest["examples"].get("palette"),
        })
    if "spotlight" in blob or "0.25" in blob:
        hits.append({
            "name": "film.shot",
            "signature": "shot(t, x, y, zoom, rot=0, radius=None, strength=0.55)",
            "example": manifest["examples"].get("shot"),
        })
    if "skia" in blob and ("not defined" in blob or "undefined" in blob or "nameerror" in blob):
        hits.append({"name": "skia", "signature": "skia is preloaded in the sandbox",
                     "example": manifest["examples"].get("skia")})
    if "random" in blob and ("not defined" in blob or "undefined" in blob or "nameerror" in blob):
        hits.append({"name": "random / ctx.rand", "signature": "random is preloaded; prefer ctx.rand",
                     "example": manifest["examples"].get("skia")})
    # Fallback: any mentioned symbol name
    if not hits:
        for name, rec in (manifest.get("symbols") or {}).items():
            if name.lower() in blob:
                hits.append({**rec, "name": name, "example": (manifest.get("examples") or {}).get(name)})
                if len(hits) >= 4:
                    break
    return hits


def format_repair(problems: list[str], code: str | None = None, manifest: dict | None = None) -> str:
    """Exact error + offending line + signature + working example. Never a generic 'fix the code'."""
    m = manifest or load_manifest()
    lineno, line = _line_from_traceback(problems, code)
    chunks = [
        f"Engine API {m['engineVersion']}. Fix ONLY the reported problems.",
        "Errors:",
        *["  - " + p for p in problems[:16]],
    ]
    if lineno:
        chunks.append(f"Offending line {lineno}: {line.strip() or '(see traceback)'}")
    for rec in _symbol_for_problems(problems, m):
        chunks.append(f"API signature: {rec.get('signature') or rec.get('name')}")
        if rec.get("wrong"):
            chunks.append(f"Do not write: {rec['wrong']}")
        if rec.get("prefer"):
            chunks.append(f"Prefer: {rec['prefer']}")
        if rec.get("keys"):
            chunks.append("Allowed palette keys: " + ", ".join(rec["keys"]))
        ex = rec.get("example")
        if ex:
            chunks.append("Working example:\n" + ex.strip())
    chunks.append("skia, random, math, numpy/np are already in scope. "
                  "Palette keys are only bg, ink, accent, accent2, muted. "
                  "StringLine has no rgb. drawRoundRect takes (rect, rx, ry, paint). "
                  "Space shot()/focus() at least 0.25 s apart on different targets.")
    return "\n".join(chunks)


def main() -> None:
    path = dump()
    data = json.loads(path.read_text())
    print(f"wrote {path} engineSha={data['engineSha'][:7]} sourceHash={data['sourceHash']} "
          f"symbols={len(data['symbols'])} examples={len(data['examples'])}")


if __name__ == "__main__":
    main()
