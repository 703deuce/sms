"""Tests for field mapping helpers."""

from transovo_voice.tasks.protocols import (
    is_address_field,
    is_email_field,
    is_phone_field,
    looks_like_name_field,
)


def test_field_type_detection() -> None:
    assert is_phone_field({"id": "phone", "type": "phone"})
    assert is_email_field({"id": "email", "type": "email"})
    assert is_address_field({"id": "address", "type": "address"})
    assert looks_like_name_field({"id": "full_name", "label": "name", "type": "text"})


def test_opportunistic_prefill_gating() -> None:
    from transovo_voice.workflows.booking_intake import should_run_opportunistic_prefill
    from transovo_voice.userdata import SessionUserData, WorkflowState

    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
    )
    assert should_run_opportunistic_prefill(ud)

    ud.workflow = WorkflowState.BOOKING_INTAKE
    ud.intake_active = True
    assert not should_run_opportunistic_prefill(ud)

    ud.workflow = WorkflowState.BOOKING_SELECT
    ud.intake_active = False
    assert not should_run_opportunistic_prefill(ud)

    ud.workflow = WorkflowState.FAQ
    assert should_run_opportunistic_prefill(ud)


def test_multi_field_volunteer_skip_logic() -> None:
    """Fields already collected should not appear in missing list."""
    from transovo_voice.workflows.booking_intake import _missing_fields
    from transovo_voice.userdata import ManifestField, ReceptionistCompiled, SessionUserData

    manifest = [
        ManifestField("name", "name", "What is your name?", "text", True),
        ManifestField("phone", "phone", "Phone?", "phone", True),
        ManifestField("email", "email", "Email?", "email", True),
    ]
    ud = SessionUserData(
        workspace_id="w",
        agent_id="a",
        call_id="c",
        business_name="Test",
        timezone="America/New_York",
        receptionist=ReceptionistCompiled(
            business_name="Test",
            agent_display_name="Amy",
            greeting="Hi",
            timezone="America/New_York",
            compiled_prompt="",
            field_manifest=manifest,
        ),
        collected_fields={
            "name": "Anthony Johnson",
            "phone": "+15714776175",
        },
    )
    missing = _missing_fields(ud, "booking")
    missing = [f for f in missing if not ud.collected_fields.get(f["id"], "").strip()]
    assert len(missing) == 1
    assert missing[0]["id"] == "email"
