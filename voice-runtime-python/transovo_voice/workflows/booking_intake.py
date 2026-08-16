from __future__ import annotations

from typing import Any

from livekit.agents.beta.workflows import (
    GetAddressTask,
    GetEmailTask,
    GetNameTask,
    GetPhoneNumberTask,
    TaskGroup,
    TaskCompletedEvent,
)

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.tasks.dynamic_field_task import DynamicFieldConfig, DynamicFieldTask
from transovo_voice.tasks.protocols import (
    BookingIntakeResult,
    is_address_field,
    is_email_field,
    is_phone_field,
    looks_like_name_field,
)
from transovo_voice.telemetry import log_event
from transovo_voice.userdata import SessionUserData, WorkflowState


def _missing_fields(ud: SessionUserData, purpose: str = "booking") -> list[dict[str, Any]]:
    manifest = ud.manifest_dicts()
    collected = ud.collected_fields
    missing: list[dict[str, Any]] = []
    for field in manifest:
        if not field.get("required"):
            ask_when = field.get("askWhen")
            if purpose == "booking" and ask_when == "when_booking":
                pass
            elif purpose == "message" and ask_when == "when_booking":
                continue
            else:
                continue
        if not collected.get(field["id"], "").strip():
            missing.append(field)
    return missing


async def opportunistic_prefill(
    backend: TransovoBackend,
    ud: SessionUserData,
    transcript: str,
) -> None:
    if not transcript.strip():
        return
    result = await backend.call(
        "extract_fields",
        {
            "transcript": transcript,
            "manifest": ud.manifest_dicts(),
            "currentFields": ud.collected_fields,
            "callerE164": ud.caller_e164,
        },
    )
    if not result.get("ok"):
        return
    fields = result.get("fields") or {}
    if not fields:
        return
    persisted = await backend.call(
        "persist_intake_fields",
        {
            "workspaceId": ud.workspace_id,
            "agentId": ud.agent_id,
            "callId": ud.call_id,
            "fields": fields,
            "purpose": "booking",
        },
    )
    if persisted.get("ok"):
        ud.collected_fields = persisted.get("fields") or ud.collected_fields


async def run_booking_intake_task_group(
    session,
    ud: SessionUserData,
    backend: TransovoBackend,
    purpose: str = "booking",
) -> BookingIntakeResult:
    ud.workflow = WorkflowState.BOOKING_INTAKE
    log_event(
        "task_group_started",
        call_id=ud.call_id,
        workspace_id=ud.workspace_id,
        agent_id=ud.agent_id,
        workflow=ud.workflow.value,
        extra={"purpose": purpose},
    )

    missing = _missing_fields(ud, purpose)
    missing = [f for f in missing if not ud.collected_fields.get(f["id"], "").strip()]
    if not missing:
        return BookingIntakeResult(fields=dict(ud.collected_fields), complete=True)

    chat_ctx = session.chat_ctx

    async def on_completed(event: TaskCompletedEvent) -> None:
        result = event.result
        field_id = event.task_id
        value: str | None = None
        if hasattr(result, "phone_number"):
            value = result.phone_number
        elif hasattr(result, "email_address"):
            value = result.email_address
        elif hasattr(result, "email"):
            value = result.email
        elif hasattr(result, "address"):
            value = result.address
        elif hasattr(result, "value"):
            value = result.value
        elif hasattr(result, "first_name"):
            parts = [getattr(result, "first_name", ""), getattr(result, "last_name", "")]
            value = " ".join(p for p in parts if p and str(p).strip()).strip()
        if not value:
            return
        ud.collected_fields[field_id] = value
        await backend.call(
            "persist_intake_fields",
            {
                "workspaceId": ud.workspace_id,
                "agentId": ud.agent_id,
                "callId": ud.call_id,
                "fields": {field_id: value},
                "purpose": purpose,
            },
        )
        log_event(
            "field_completed",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"fieldId": field_id},
        )

    group = TaskGroup(chat_ctx=chat_ctx, summarize_chat_ctx=False, on_task_completed=on_completed)

    for field in missing:
        fid = field["id"]
        label = field.get("label") or fid
        question = field.get("question") or f"What is your {label}?"

        if looks_like_name_field(field):
            group.add(
                lambda f=fid: GetNameTask(last_name=True, chat_ctx=chat_ctx),
                id=fid,
                description=f"Collect {label}",
            )
            continue
        if is_phone_field(field):
            group.add(
                lambda: GetPhoneNumberTask(chat_ctx=chat_ctx),
                id=fid,
                description=f"Collect {label}",
            )
            continue
        if is_email_field(field):
            group.add(
                lambda: GetEmailTask(chat_ctx=chat_ctx),
                id=fid,
                description=f"Collect {label}",
            )
            continue
        if is_address_field(field):
            group.add(
                lambda: GetAddressTask(chat_ctx=chat_ctx),
                id=fid,
                description=f"Collect {label}",
            )
            continue

        cfg = DynamicFieldConfig(
            field_id=fid,
            label=label,
            question=question,
            field_type=str(field.get("type") or "text"),
            required=bool(field.get("required")),
            options=None,
            validation=field.get("validation"),
        )
        group.add(
            lambda c=cfg: DynamicFieldTask(c, chat_ctx=chat_ctx),
            id=fid,
            description=f"Collect {label}",
        )

    await group

    still_missing = _missing_fields(ud, purpose)
    still_missing = [f for f in still_missing if not ud.collected_fields.get(f["id"], "").strip()]
    complete = len(still_missing) == 0
    if complete:
        log_event(
            "intake_completed",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
        )
    return BookingIntakeResult(fields=dict(ud.collected_fields), complete=complete)
