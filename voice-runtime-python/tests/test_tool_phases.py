"""Tool phase and slot validation tests."""

from unittest.mock import MagicMock

from transovo_voice.agent.tools import (
    build_availability_tools,
    build_confirm_tools,
    build_idle_tools,
    build_slot_tools,
)
from transovo_voice.agent.amy import AmyAgent
from transovo_voice.userdata import OfferedSlot, SessionUserData, WorkflowState


def _amy(ud: SessionUserData) -> AmyAgent:
    backend = MagicMock()
    return AmyAgent(ud, backend)


def test_idle_tools_include_start_booking_not_confirm() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    agent = _amy(ud)
    tools = build_idle_tools(agent, agent._backend)
    names = {t.info.name for t in tools if hasattr(t, "info")}
    assert "start_booking" in names
    assert "confirm_booking" not in names
    assert "check_availability" not in names


def test_availability_tools_expose_check_not_start() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    agent = _amy(ud)
    tools = build_availability_tools(agent, agent._backend)
    names = {t.info.name for t in tools if hasattr(t, "info")}
    assert "check_availability" in names
    assert "start_booking" not in names
    assert "select_slot" not in names


def test_slot_tools_include_select_not_confirm() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    agent = _amy(ud)
    tools = build_slot_tools(agent, agent._backend)
    names = {t.info.name for t in tools if hasattr(t, "info")}
    assert "select_slot" in names
    assert "confirm_booking" not in names


def test_confirm_tools_include_confirm() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    agent = _amy(ud)
    tools = build_confirm_tools(agent, agent._backend)
    names = {t.info.name for t in tools if hasattr(t, "info")}
    assert "confirm_booking" in names


def test_transfer_tool_only_when_capability_enabled() -> None:
    from transovo_voice.agent.transfer_tool import build_transfer_tool

    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
        capabilities=[],
    )
    backend = MagicMock()
    assert build_transfer_tool(ud, backend) is None

    ud.capabilities = ["transfer_calls"]
    assert build_transfer_tool(ud, backend) is not None


def test_offered_slot_validation_logic() -> None:
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
        offered_slots=[
            OfferedSlot("slot-a", "2026-08-20T10:00:00Z", 30, "Tuesday 10am"),
        ],
    )
    offered = {s.slot_id for s in ud.offered_slots}
    assert "slot-a" in offered
    assert "slot-b" not in offered
    ud.selected_slot_id = "slot-a"
    ud.workflow = WorkflowState.BOOKING_CONFIRM
    assert ud.workflow == WorkflowState.BOOKING_CONFIRM
