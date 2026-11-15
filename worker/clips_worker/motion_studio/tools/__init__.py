"""Registered creative tools, versioned scene specs, and the deterministic compiler.

Agents choose actions. This package executes them. Custom Python is the Tier 3
extension path, not the default. The deterministic engine is not an agent.
"""
from clips_worker.motion_studio.tools.compiler import compile_spec
from clips_worker.motion_studio.tools.plan import compile_agent_output
from clips_worker.motion_studio.tools.extensions import register_component, use_component
from clips_worker.motion_studio.tools.registry import (
    UNKNOWN_TOOL,
    ToolResult,
    apply_calls,
    assert_tools_fresh,
    default_registry,
    dump_manifest,
    format_tools_reference,
    intended_tool,
    load_tools_manifest,
)
from clips_worker.motion_studio.tools.spec import SPEC_VERSION, new_spec
from clips_worker.motion_studio.tools.validate import validate_spec

__all__ = [
    "SPEC_VERSION",
    "UNKNOWN_TOOL",
    "ToolResult",
    "apply_calls",
    "assert_tools_fresh",
    "compile_agent_output",
    "compile_spec",
    "default_registry",
    "dump_manifest",
    "format_tools_reference",
    "intended_tool",
    "load_tools_manifest",
    "new_spec",
    "register_component",
    "use_component",
    "validate_spec",
]
