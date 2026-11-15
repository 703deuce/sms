"""Versioned tool registry. Schemas and docs are generated from registered implementations."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

TOOLS_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = TOOLS_DIR / "tools_manifest.json"

# Documentation fields every registered tool must carry (spec 6).
DOC_FIELDS = (
    "purpose",
    "when_to_use",
    "when_not_to_use",
    "prohibited",
    "preconditions",
    "dependencies",
    "behavior",
    "errors",
    "side_effects",
    "authorization",
    "resource_limits",
    "reversible",
    "defaults",
)

UNKNOWN_TOOL = "UNKNOWN_TOOL"
MISSING_ARGUMENT = "MISSING_ARGUMENT"
INVALID_ARGUMENT = "INVALID_ARGUMENT"
MISSING_TARGET = "MISSING_TARGET"
INVALID_RANGE = "INVALID_RANGE"
UNSUPPORTED_VALUE = "UNSUPPORTED_VALUE"
UNKNOWN_ASSET = "UNKNOWN_ASSET"
LIMIT_EXCEEDED = "LIMIT_EXCEEDED"
PRECONDITION_FAILED = "PRECONDITION_FAILED"
AUTHORIZATION = "AUTHORIZATION"
INVALID_DATA = "INVALID_DATA"
IDEMPOTENT_REPLAY = "IDEMPOTENT_REPLAY"

# Task phrases -> the one correct registered tool (tool-awareness tests + repair hints).
INTENT_MAP = (
    ("push the camera", "animate_camera"),
    ("pull the camera", "animate_camera"),
    ("camera hold", "animate_camera"),
    ("pan the camera", "animate_camera"),
    ("track the camera", "animate_camera"),
    ("camera reveal", "animate_camera"),
    ("place a photo", "place_media"),
    ("place the photograph", "place_media"),
    ("put this photo", "place_media"),
    ("place footage", "place_media"),
    ("place the clip", "place_media"),
    ("create an environment", "create_environment"),
    ("invent a world", "create_environment"),
    ("create a desk environment", "create_environment"),
    ("create a chart", "create_graphic"),
    ("create a map graphic", "create_graphic"),
    ("draw a chart", "create_graphic"),
    ("transition between scenes", "transition_scene"),
    ("connect two scenes", "transition_scene"),
    ("add a music cue", "compose_audio"),
    ("add a sound effect", "compose_audio"),
    ("compose audio", "compose_audio"),
    ("draw a path", "draw_path"),
    ("animate typography", "animate_text"),
    ("animate text", "animate_text"),
    ("place kinetic type", "animate_text"),
    ("set a material", "set_material"),
    ("animate a property", "animate_property"),
    ("apply an effect", "apply_effect"),
    ("group a layout", "layout_group"),
    ("place a shape", "place_primitive"),
    ("place a primitive", "place_primitive"),
    ("register a custom component", "register_component"),
    ("use a registered component", "use_component"),
)


@dataclass
class Param:
    name: str
    typ: str
    required: bool
    description: str
    allowed: list[Any] | None = None
    default: Any = None


@dataclass
class ToolResult:
    ok: bool
    tool: str
    version: str
    data: dict[str, Any] = field(default_factory=dict)
    errors: list[dict[str, str]] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "tool": self.tool, "version": self.version, "data": self.data, "errors": self.errors}


def error(code: str, message: str, recovery: str = "") -> dict[str, str]:
    rec = {"code": code, "message": message}
    if recovery:
        rec["recovery"] = recovery
    return rec


@dataclass
class Tool:
    name: str
    tier: int
    purpose: str
    when_to_use: str
    when_not_to_use: str
    prohibited: str
    preconditions: list[str]
    dependencies: list[str]
    behavior: str
    errors: dict[str, str]  # code -> recovery guidance
    side_effects: str
    authorization: str
    resource_limits: str
    reversible: bool
    defaults: str
    parameters: list[Param]
    examples: list[dict[str, Any]]
    apply_fn: Callable[[dict, dict], ToolResult]
    aliases: tuple[str, ...] = ()
    semver: str = "1.0"

    def schema(self) -> dict[str, Any]:
        props = {}
        required = []
        for p in self.parameters:
            item: dict[str, Any] = {"type": p.typ, "description": p.description}
            if p.allowed is not None:
                item["enum"] = list(p.allowed)
            if p.default is not None:
                item["default"] = p.default
            props[p.name] = item
            if p.required:
                required.append(p.name)
        return {
            "type": "object",
            "properties": props,
            "required": required,
            "additionalProperties": False,
        }

    def version(self) -> str:
        blob = json.dumps(
            {
                "name": self.name,
                "tier": self.tier,
                "semver": self.semver,
                "schema": self.schema(),
                "purpose": self.purpose,
                "behavior": self.behavior,
            },
            sort_keys=True,
        )
        src = getattr(self.apply_fn, "__code__", None)
        if src is not None:
            blob += f"{src.co_filename}:{src.co_firstlineno}:{src.co_code.hex()}"
        return f"{self.semver}+{hashlib.sha256(blob.encode()).hexdigest()[:8]}"

    def missing_docs(self) -> list[str]:
        missing = []
        # preconditions/dependencies may be legitimately empty (e.g. create_environment).
        allow_empty = {"preconditions", "dependencies"}
        for field in DOC_FIELDS:
            val = getattr(self, field)
            if field in allow_empty:
                if val is None:
                    missing.append(field)
                continue
            if val is None or val == "" or val == {} or val == []:
                missing.append(field)
        if not self.parameters:
            missing.append("parameters")
        if not self.examples:
            missing.append("examples")
        return missing

    def validate_args(self, arguments: dict[str, Any]) -> list[dict[str, str]]:
        problems = []
        args = arguments or {}
        allowed = {p.name for p in self.parameters}
        required = {p.name for p in self.parameters if p.required}
        for name in required:
            if name not in args or args[name] is None:
                problems.append(error(
                    MISSING_ARGUMENT,
                    f"{self.name} is missing required argument {name!r}.",
                    f"Supply {name}. See the {self.name} schema.",
                ))
        for name, value in args.items():
            if name in ("opId", "sceneId"):
                continue
            if name not in allowed:
                problems.append(error(
                    INVALID_ARGUMENT,
                    f"{self.name} has no argument {name!r}.",
                    f"Allowed arguments: {sorted(allowed)}.",
                ))
                continue
            param = next(p for p in self.parameters if p.name == name)
            if param.allowed is not None and value not in param.allowed:
                problems.append(error(
                    UNSUPPORTED_VALUE,
                    f"{self.name}.{name} does not accept {value!r}.",
                    f"Supported values: {param.allowed}.",
                ))
        return problems

    def apply(self, spec: dict, arguments: dict[str, Any]) -> ToolResult:
        problems = self.validate_args(arguments or {})
        if problems:
            return ToolResult(False, self.name, self.version(), errors=problems)
        return self.apply_fn(spec, arguments or {})

    def document(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "aliases": list(self.aliases),
            "tier": self.tier,
            "version": self.version(),
            "purpose": self.purpose,
            "whenToUse": self.when_to_use,
            "whenNotToUse": self.when_not_to_use,
            "prohibited": self.prohibited,
            "preconditions": list(self.preconditions),
            "dependencies": list(self.dependencies),
            "behavior": self.behavior,
            "errors": dict(self.errors),
            "sideEffects": self.side_effects,
            "authorization": self.authorization,
            "resourceLimits": self.resource_limits,
            "reversible": self.reversible,
            "defaults": self.defaults,
            "parameters": [
                {
                    "name": p.name,
                    "type": p.typ,
                    "required": p.required,
                    "description": p.description,
                    "allowed": p.allowed,
                    "default": p.default,
                }
                for p in self.parameters
            ],
            "schema": self.schema(),
            "examples": list(self.examples),
        }


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}
        self._aliases: dict[str, str] = {}

    def register(self, tool: Tool) -> None:
        missing = tool.missing_docs()
        if missing:
            raise ValueError(f"tool {tool.name} is missing documentation fields: {missing}")
        self._tools[tool.name] = tool
        for a in tool.aliases:
            self._aliases[a] = tool.name

    def resolve(self, name: str) -> Tool | None:
        if name in self._tools:
            return self._tools[name]
        canon = self._aliases.get(name)
        return self._tools.get(canon) if canon else None

    def names(self) -> list[str]:
        return sorted(self._tools)

    def aliases(self) -> dict[str, str]:
        return dict(self._aliases)

    def document(self) -> dict[str, Any]:
        tools = {name: self._tools[name].document() for name in self.names()}
        return {
            "schema": 1,
            "package": "motion.studio.tools",
            "sourceHash": _source_hash(),
            "tools": tools,
            "aliases": self.aliases(),
            "intents": [{"intent": a, "tool": b} for a, b in INTENT_MAP],
        }


_REGISTRY: ToolRegistry | None = None


def default_registry() -> ToolRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        from clips_worker.motion_studio.tools import builtin as _builtin
        reg = ToolRegistry()
        for tool in _builtin.all_tools():
            reg.register(tool)
        _REGISTRY = reg
    return _REGISTRY


def _source_hash() -> str:
    h = hashlib.sha256()
    for name in ("registry.py", "spec.py", "builtin.py", "validate.py", "compiler.py", "extensions.py", "composition.py"):
        path = TOOLS_DIR / name
        if path.exists():
            h.update(name.encode())
            h.update(path.read_bytes())
    return h.hexdigest()[:24]


def dump_manifest(path: Path | None = None) -> Path:
    dest = path or MANIFEST_PATH
    dest.write_text(json.dumps(default_registry().document(), indent=2, sort_keys=True) + "\n")
    return dest


def load_tools_manifest(path: Path | None = None) -> dict[str, Any]:
    dest = path or MANIFEST_PATH
    return json.loads(dest.read_text())


def assert_tools_fresh(path: Path | None = None) -> None:
    dest = path or MANIFEST_PATH
    if not dest.exists():
        raise AssertionError(f"tools manifest missing: {dest}")
    committed = json.loads(dest.read_text())
    fresh = default_registry().document()
    if committed.get("sourceHash") != fresh["sourceHash"]:
        raise AssertionError(
            "tools manifest is stale relative to the registered implementations; "
            "run python3 -m clips_worker.motion_studio.tools"
        )
    if set(committed.get("tools") or {}) != set(fresh["tools"]):
        raise AssertionError("tools manifest tool set does not match the registry")


def format_tools_reference(registry: ToolRegistry | None = None, compact: bool = True) -> str:
    """Generated tool docs for the Motion Engineer. Never hand-maintained."""
    reg = registry or default_registry()
    lines = [
        "REGISTERED CREATIVE TOOLS (generated from the tool registry; do not invent tools or arguments).",
        "Prefer structured calls: {\"tools\": [{\"tool\": \"name\", \"arguments\": {...}}, ...]}.",
        "Custom Python is Tier 3 only, and only when a registered tool cannot express the approved design.",
        "Available tools: " + ", ".join(reg.names()) + ".",
        "Aliases: " + ", ".join(f"{a}->{c}" for a, c in sorted(reg.aliases().items())) + ".",
        "",
    ]
    for name in reg.names():
        doc = reg._tools[name].document()
        req = [p["name"] for p in doc["parameters"] if p["required"]]
        opt = [p["name"] for p in doc["parameters"] if not p["required"]]
        lines.append(f"{doc['name']} (tier {doc['tier']}, {doc['version']})")
        lines.append(f"  Purpose: {doc['purpose']}")
        lines.append(f"  Use when: {doc['whenToUse']}")
        lines.append(f"  Do not use when: {doc['whenNotToUse']}")
        lines.append(f"  Required: {req}. Optional: {opt}.")
        if compact:
            # one short example
            if doc["examples"]:
                lines.append(f"  Example: {json.dumps(doc['examples'][0], sort_keys=True)}")
        else:
            lines.append(f"  Behavior: {doc['behavior']}")
            lines.append(f"  Preconditions: {doc['preconditions']}")
            lines.append(f"  Errors: {doc['errors']}")
            lines.append(f"  Prohibited: {doc['prohibited']}")
            for ex in doc["examples"]:
                lines.append(f"  Example: {json.dumps(ex, sort_keys=True)}")
        lines.append("")
    return "\n".join(lines)


def intended_tool(task: str) -> str | None:
    """Deterministic tool-awareness helper: map a task phrase to the registered tool."""
    blob = (task or "").strip().lower()
    for phrase, name in INTENT_MAP:
        if phrase in blob:
            return name
    return None


def apply_calls(
    spec: dict,
    calls: list[dict[str, Any]],
    registry: ToolRegistry | None = None,
) -> tuple[dict, list[ToolResult]]:
    """Apply a sequence of structured tool calls to a scene spec (planning only)."""
    reg = registry or default_registry()
    results: list[ToolResult] = []
    for raw in calls or []:
        name = str((raw or {}).get("tool") or "")
        arguments = dict((raw or {}).get("arguments") or {})
        tool = reg.resolve(name)
        if tool is None:
            results.append(ToolResult(
                False,
                name or "?",
                "",
                errors=[error(
                    UNKNOWN_TOOL,
                    f"tool {name!r} is not registered.",
                    "Use only tools from the registry: " + ", ".join(reg.names()) + ".",
                )],
            ))
            continue
        op_id = arguments.get("opId")
        if op_id:
            previous = next((op for op in spec.get("ops") or [] if op.get("opId") == op_id), None)
            if previous:
                results.append(ToolResult(
                    True,
                    tool.name,
                    tool.version(),
                    data={"opId": op_id, "replayed": True, **(previous.get("data") or {})},
                    errors=[],
                ))
                continue
        result = tool.apply(spec, arguments)
        results.append(result)
        spec.setdefault("ops", []).append({
            "tool": tool.name,
            "version": tool.version(),
            "arguments": arguments,
            "ok": result.ok,
            "opId": arguments.get("opId") or (result.data or {}).get("id"),
            "data": result.data,
            "errors": result.errors,
        })
    return spec, results
