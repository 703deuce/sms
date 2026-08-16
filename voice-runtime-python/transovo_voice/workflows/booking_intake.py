from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

from livekit.agents.beta.workflows import (
    GetAddressTask,
    GetEmailTask,
    GetNameTask,
    GetPhoneNumberTask,
    TaskGroup,
    TaskCompletedEvent,
)
from livekit.agents.voice.agent import AgentTask

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

logger = logging.getLogger("transovo-voice.booking-intake")

_INTAKE_WORKFLOWS = frozenset({WorkflowState.BOOKING_INTAKE, WorkflowState.MESSAGE_INTAKE})


def should_run_opportunistic_prefill(ud: SessionUserData) -> bool:
    """Opportunistic extraction observes IDLE utterances only — never during active intake."""
    if ud.intake_active:
        return False
    if ud.workflow in _INTAKE_WORKFLOWS:
        return False
    # Amy owns speech during booking flow after intake starts via tools.
    if ud.workflow not in (WorkflowState.IDLE, WorkflowState.FAQ):
        return False
    return True


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


async def _persist_intake_fields_async(
    backend: TransovoBackend,
    ud: SessionUserData,
    fields: dict[str, str],
    purpose: str,
) -> None:
    try:
        persisted = await backend.call(
            "persist_intake_fields",
            {
                "workspaceId": ud.workspace_id,
                "agentId": ud.agent_id,
                "callId": ud.call_id,
                "fields": fields,
                "purpose": purpose,
            },
        )
        if persisted.get("ok") and persisted.get("fields"):
            ud.collected_fields = persisted.get("fields") or ud.collected_fields
    except Exception:
        logger.exception("async persist_intake_fields failed callId=%s", ud.call_id)


async def opportunistic_prefill(
    backend: TransovoBackend,
    ud: SessionUserData,
    transcript: str,
) -> None:
    if not should_run_opportunistic_prefill(ud):
        return
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
    for field_id, value in fields.items():
        trimmed = str(value).strip()
        if trimmed and not ud.collected_fields.get(field_id, "").strip():
            ud.collected_fields[field_id] = trimmed
    asyncio.create_task(_persist_intake_fields_async(backend, ud, fields, "booking"))


def _wrap_task_with_started_log(task: AgentTask, field_id: str, ud: SessionUserData) -> AgentTask:
    original_on_enter = task.on_enter

    async def on_enter_with_log() -> None:
        log_event(
            "task_started",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"fieldId": field_id},
        )
        await original_on_enter()

    task.on_enter = on_enter_with_log
    return task


def _task_factory(
    builder: Callable[[], AgentTask],
    field_id: str,
    ud: SessionUserData,
) -> Callable[[], AgentTask]:
    def factory() -> AgentTask:
        return _wrap_task_with_started_log(builder(), field_id, ud)

    return factory


async def run_booking_intake_task_group(
    session,
    ud: SessionUserData,
    backend: TransovoBackend,
    purpose: str = "booking",
) -> BookingIntakeResult:
    ud.workflow = (
        WorkflowState.BOOKING_INTAKE if purpose == "booking" else WorkflowState.MESSAGE_INTAKE
    )
    ud.intake_active = True
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
        ud.intake_active = False
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
        log_event(
            "field_completed",
            call_id=ud.call_id,
            workspace_id=ud.workspace_id,
            agent_id=ud.agent_id,
            workflow=ud.workflow.value,
            extra={"fieldId": field_id},
        )
        asyncio.create_task(
            _persist_intake_fields_async(backend, ud, {field_id: value}, purpose),
        )

    group = TaskGroup(chat_ctx=chat_ctx, summarize_chat_ctx=False, on_task_completed=on_completed)

    for field in missing:
        fid = field["id"]
        label = field.get("label") or fid
        question = field.get("question") or f"What is your {label}?"

        if looks_like_name_field(field):
            group.add(
                _task_factory(
                    lambda: GetNameTask(last_name=True, chat_ctx=chat_ctx),
                    fid,
                    ud,
                ),
                id=fid,
                description=f"Collect {label}",
            )
            continue
        if is_phone_field(field):
            group.add(
                _task_factory(lambda: GetPhoneNumberTask(chat_ctx=chat_ctx), fid, ud),
                id=fid,
                description=f"Collect {label}",
            )
            continue
        if is_email_field(field):
            group.add(
                _task_factory(lambda: GetEmailTask(chat_ctx=chat_ctx), fid, ud),
                id=fid,
                description=f"Collect {label}",
            )
            continue
        if is_address_field(field):
            group.add(
                _task_factory(lambda: GetAddressTask(chat_ctx=chat_ctx), fid, ud),
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
            _task_factory(lambda c=cfg: DynamicFieldTask(c, chat_ctx=chat_ctx), fid, ud),
            id=fid,
            description=f"Collect {label}",
        )

    await group

    ud.intake_active = False
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
