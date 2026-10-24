"""Session tool registration logging helpers."""

from livekit.agents import function_tool

from transovo_voice.voice_v3.session import _registered_tool_log_name


async def _noop_tool(_x: str) -> str:
    return "ok"


def test_registered_tool_log_name_from_function_tool_info() -> None:
    decorated = function_tool(
        _noop_tool,
        raw_schema={
            "name": "send_booking_link",
            "description": "test",
            "parameters": {"type": "object", "properties": {}},
        },
    )
    assert _registered_tool_log_name(decorated) == "send_booking_link"
