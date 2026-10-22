from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from livekit.agents.llm import ChatContext, ChatMessage

from transovo_voice.voice_v3.intake_bridge import (
    COLLECT_CALLER_INTAKE_TOOL,
    execute_collect_caller_intake,
)
from transovo_voice.voice_v3.intake_chat_context import append_caller_hint, resolve_intake_chat_context
from transovo_voice.voice_v3.tools import build_livekit_tools


@pytest.mark.asyncio
async def test_volunteered_values_fast_path_skips_agent_task():
    """Luna can persist a multi-field batch without starting IntakeTask when objective completes."""
    client = MagicMock()
    complete_state = {
        "ok": True,
        "data": {
            "values": {
                "name": "Anthony",
                "email": "anthony@example.com",
                "phone": "+15715550123",
            },
            "missing_required_fields": [],
            "objective": {"status": "COMPLETE", "missing_required_fields": []},
            "state_version": 3,
        },
    }
    client.execute = AsyncMock(
        side_effect=[
            complete_state,  # initial load
            {"ok": True, "data": {"updated_fields": ["name", "email", "phone"]}},  # persist
            complete_state,  # reload after persist
        ],
    )
    context = SimpleNamespace(session=None)
    fields = [
        {"key": "name", "label": "Name", "type": "text", "required": True},
        {"key": "email", "label": "Email", "type": "email", "required": True},
        {"key": "phone", "label": "Phone", "type": "phone", "required": True},
    ]

    with patch("transovo_voice.voice_v3.intake_bridge.run_intake_task", AsyncMock()) as mock_task:
        result = await execute_collect_caller_intake(
            context=context,
            client=client,
            intake_fields=fields,
            arguments={
                "volunteered_values": [
                    {"key": "name", "value": "Anthony"},
                    {"key": "email", "value": "anthony@example.com"},
                    {"key": "phone", "value": "571-555-0123"},
                ],
            },
            function_call_id="fc_test",
        )

    mock_task.assert_not_called()
    assert result["status"] == "INTAKE_COLLECTED"
    assert result["data"]["persisted_volunteered_only"] is True
    persist_call = client.execute.call_args_list[1]
    assert persist_call.kwargs["tool_name"] == "update_intake"


def test_collect_caller_intake_registered_as_livekit_function_tool():
    """collect_caller_intake must be a LiveKit function_tool on Amy's session (not HTTP-only)."""
    schema = [
        {
            "name": COLLECT_CALLER_INTAKE_TOOL,
            "description": "test",
            "parameters": {"type": "object", "properties": {}},
        },
    ]
    client = MagicMock()
    tools = build_livekit_tools(schema, client, intake_fields=[])
    assert len(tools) == 1
    tool = tools[0]
    assert tool.info.name == COLLECT_CALLER_INTAKE_TOOL


def test_resolve_intake_chat_context_uses_session_history():
    history = ChatContext.empty()
    history.insert(ChatMessage(role="user", content=["My email is a@b.co"]))
    session = SimpleNamespace(history=history)
    context = SimpleNamespace(session=session)
    ctx = resolve_intake_chat_context(context)
    assert ctx is not None
    assert len(ctx.items) >= 1


def test_append_caller_hint_adds_user_message():
    base = ChatContext.empty()
    enriched = append_caller_hint(base, "My name is Anthony and my email is anthony@example.com")
    assert enriched is not None
    assert len(enriched.items) >= 1
