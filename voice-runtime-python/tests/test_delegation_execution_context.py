from __future__ import annotations

from transovo_voice.voice_v3.delegation_execution_context import DelegationExecutionContext


def test_active_delegation_from_response_created_and_call_mapping() -> None:
    ctx = DelegationExecutionContext()
    ctx.note_openai_server_event(
        {
            "type": "response.event",
            "delegation_id": "dlg_book_1",
            "event": {"type": "response.created", "response": {"id": "resp_1"}},
        }
    )
    assert ctx.active_delegation_id == "dlg_book_1"
    ctx.note_openai_server_event(
        {
            "type": "response.event",
            "delegation_id": "dlg_book_1",
            "event": {
                "type": "response.output_item.done",
                "item": {
                    "type": "function_call",
                    "status": "completed",
                    "call_id": "call_intake_1",
                    "name": "update_intake",
                    "arguments": "{}",
                },
            },
        }
    )
    assert ctx.delegation_id_for_function_call("call_intake_1") == "dlg_book_1"
    ctx.note_openai_server_event(
        {
            "type": "response.event",
            "delegation_id": "dlg_book_1",
            "event": {"type": "response.completed", "response": {"id": "resp_1"}},
        }
    )
    assert ctx.active_delegation_id is None
    assert ctx.delegation_id_for_function_call("call_intake_1") == "dlg_book_1"
