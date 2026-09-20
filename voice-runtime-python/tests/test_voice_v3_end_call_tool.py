from transovo_voice.voice_v3.end_call_tool import (
    END_CALL_END_INSTRUCTIONS,
    END_CALL_EXTRA_DESCRIPTION,
    build_voice_v3_end_call_toolset,
)


def test_build_voice_v3_end_call_toolset_config() -> None:
    toolset = build_voice_v3_end_call_toolset(
        call_id="call_1",
        workspace_id="ws_1",
        agent_id="agent_1",
        room="lk_room",
        extra_hint="Business-specific hint.",
    )
    assert toolset._delete_room is True
    assert toolset._end_instructions == END_CALL_END_INSTRUCTIONS
    assert "Business-specific hint" in toolset._extra_description
    assert "genuinely complete" in END_CALL_EXTRA_DESCRIPTION
    assert len(toolset.tools) == 1
    tool = toolset.tools[0]
    assert tool.info.name == "end_call"
