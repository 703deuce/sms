from transovo_voice.voice_v3.gpt_live_observability import (
    _sanitize_arguments,
    _summarize_delegation,
    _tool_names_from_delegation_responses,
)


def test_summarize_delegation_responses_tools() -> None:
    delegation = {
        "type": "responses",
        "responses": {
            "model": "gpt-6-astra",
            "tool_choice": "auto",
            "parallel_tool_calls": False,
            "tools": [
                {"type": "function", "function": {"name": "find_availability", "description": "x"}},
                {"name": "update_intake", "description": "y", "parameters": {}},
            ],
        },
    }
    summary = _summarize_delegation(delegation)
    assert summary["delegationType"] == "responses"
    assert summary["responsesToolsLength"] == 2
    assert summary["responsesToolNames"] == ["find_availability", "update_intake"]


def test_tool_names_from_delegation_responses() -> None:
    names = _tool_names_from_delegation_responses(
        {"tools": [{"function": {"name": "book_appointment"}}]},
    )
    assert names == ["book_appointment"]


def test_sanitize_arguments_redacts_email() -> None:
    out = _sanitize_arguments({"email": "anthony@example.com", "count": 2})
    assert out["email"] == "[email]"
    assert out["count"] == 2
