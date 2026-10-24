from __future__ import annotations

import asyncio
import contextlib
import logging
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum
from typing import Any

from livekit import api, rtc
from livekit.protocol.models import TrackType
from livekit.agents.voice.background_audio import (
    AudioConfig,
    BackgroundAudioPlayer,
    BuiltinAudioClip,
    PlayHandle,
)
from livekit.agents.voice.events import RunContext

from transovo_voice.telemetry import log_event
from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
from transovo_voice.voice_v3.transfer_targets import (
    destination_participant_identity,
    normalize_transfer_to,
)

logger = logging.getLogger("transovo-voice.voice_v3.bridge_transfer")


class BridgeTransferLifecycle(str, Enum):
    ATTEMPTING = "attempting"
    RINGING = "ringing"
    ANSWERED = "answered"
    CONNECTED = "connected"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ENDED = "ended"


@dataclass
class _TransferAttemptState:
    transfer_request_id: str
    destination_id: str
    caller_identity: str
    destination_identity: str
    room_name: str
    lifecycle: BridgeTransferLifecycle = BridgeTransferLifecycle.ATTEMPTING
    cancel_event: asyncio.Event | None = None


_in_flight: dict[str, asyncio.Task[str]] = {}
_completed: dict[str, str] = {}
_active_attempts: dict[str, _TransferAttemptState] = {}


def _log_lifecycle(
    state: _TransferAttemptState,
    lifecycle: BridgeTransferLifecycle,
    **extra: Any,
) -> None:
    state.lifecycle = lifecycle
    log_event(
        "VOICE_V3_BRIDGE_TRANSFER_LIFECYCLE",
        extra={
            "transfer_request_id": state.transfer_request_id,
            "destination_id": state.destination_id,
            "room": state.room_name,
            "caller_identity": state.caller_identity,
            "destination_identity": state.destination_identity,
            "lifecycle": lifecycle.value,
            **extra,
        },
    )


async def _wait_for_agent_speech_idle(context: RunContext | None) -> None:
    if context is None:
        return
    session = context.session
    speech = session.current_speech
    if speech is not None and not speech.done():
        try:
            await asyncio.wait_for(speech, timeout=30.0)
        except asyncio.TimeoutError:
            logger.warning("voice_v3_bridge_transfer_speech_wait_timeout")


def _set_session_io_enabled(context: RunContext, enabled: bool, saved: dict[str, bool]) -> None:
    input_io = context.session.input
    output_io = context.session.output
    if not saved:
        saved["audio_input"] = input_io.audio_enabled
        saved["video_input"] = input_io.video_enabled
        saved["audio_output"] = output_io.audio_enabled
        saved["transcription_output"] = output_io.transcription_enabled
        saved["video_output"] = output_io.video_enabled
    if input_io.audio:
        input_io.set_audio_enabled(enabled and saved.get("audio_input", True))
    if input_io.video:
        input_io.set_video_enabled(enabled and saved.get("video_input", True))
    if output_io.audio:
        output_io.set_audio_enabled(enabled and saved.get("audio_output", True))
    if output_io.transcription:
        output_io.set_transcription_enabled(enabled and saved.get("transcription_output", True))
    if output_io.video:
        output_io.set_video_enabled(enabled and saved.get("video_output", True))


async def _list_audio_track_sids(
    lk_api: api.LiveKitAPI,
    room_name: str,
    identity: str,
) -> list[str]:
    info = await lk_api.room.get_participant(
        api.RoomParticipantIdentity(room=room_name, identity=identity),
    )
    sids: list[str] = []
    for track in info.tracks:
        if track.type == TrackType.AUDIO:
            sids.append(track.sid)
    return sids


async def _set_participant_subscribed_to_peer(
    lk_api: api.LiveKitAPI,
    room_name: str,
    subscriber_identity: str,
    publisher_identity: str,
    subscribe: bool,
) -> None:
    track_sids = await _list_audio_track_sids(lk_api, room_name, publisher_identity)
    if not track_sids:
        return
    await lk_api.room.update_subscriptions(
        api.UpdateSubscriptionsRequest(
            room=room_name,
            identity=subscriber_identity,
            track_sids=track_sids,
            subscribe=subscribe,
        ),
    )


async def _bridge_caller_and_destination(
    lk_api: api.LiveKitAPI,
    room_name: str,
    caller_identity: str,
    destination_identity: str,
) -> None:
    await _set_participant_subscribed_to_peer(
        lk_api, room_name, caller_identity, destination_identity, True
    )
    await _set_participant_subscribed_to_peer(
        lk_api, room_name, destination_identity, caller_identity, True
    )


async def _remove_destination_leg(
    lk_api: api.LiveKitAPI,
    room_name: str,
    destination_identity: str,
) -> None:
    with contextlib.suppress(Exception):
        await lk_api.room.remove_participant(
            api.RoomParticipantIdentity(room=room_name, identity=destination_identity),
        )


def _register_post_handoff_cleanup(
    telephony: LiveKitTelephonyBridge,
    state: _TransferAttemptState,
) -> None:
    room = telephony.job_ctx.room
    caller_identity = state.caller_identity
    dest_identity = state.destination_identity
    room_name = state.room_name
    lk_api = telephony.job_ctx.api

    async def _maybe_delete_room_when_humans_done() -> None:
        humans = {
            p.identity
            for p in room.remote_participants.values()
            if p.identity in (caller_identity, dest_identity)
        }
        if not humans:
            with contextlib.suppress(Exception):
                await lk_api.room.delete_room(api.DeleteRoomRequest(room=room_name))

    def _on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
        if participant.identity not in (caller_identity, dest_identity):
            return
        asyncio.create_task(_maybe_delete_room_when_humans_done())

    room.on("participant_disconnected", _on_participant_disconnected)


async def finalize_transfer_handoff(context: RunContext | None) -> None:
    if context is None:
        return
    try:
        context.session.shutdown(drain=True)
    except Exception:
        logger.exception("voice_v3_bridge_transfer_agent_shutdown_failed")


async def execute_livekit_bridge_transfer(
    telephony: LiveKitTelephonyBridge,
    context: RunContext | None,
    *,
    transfer_request_id: str,
    destination_id: str,
    dial_target: str,
    ringing_timeout_seconds: float,
    sip_trunk_id: str | None,
    sip_number: str | None,
) -> str:
    if transfer_request_id in _completed:
        return _completed[transfer_request_id]

    existing = _in_flight.get(transfer_request_id)
    if existing is not None:
        return await existing

    task = asyncio.create_task(
        _execute_livekit_bridge_transfer_impl(
            telephony,
            context,
            transfer_request_id=transfer_request_id,
            destination_id=destination_id,
            dial_target=dial_target,
            ringing_timeout_seconds=ringing_timeout_seconds,
            sip_trunk_id=sip_trunk_id,
            sip_number=sip_number,
        ),
    )
    _in_flight[transfer_request_id] = task
    try:
        outcome = await task
        _completed[transfer_request_id] = outcome
        return outcome
    finally:
        _in_flight.pop(transfer_request_id, None)


async def _execute_livekit_bridge_transfer_impl(
    telephony: LiveKitTelephonyBridge,
    context: RunContext | None,
    *,
    transfer_request_id: str,
    destination_id: str,
    dial_target: str,
    ringing_timeout_seconds: float,
    sip_trunk_id: str | None,
    sip_number: str | None,
) -> str:
    trunk = (sip_trunk_id or "").strip()
    caller_id = (sip_number or "").strip()
    if not trunk:
        log_event(
            "VOICE_V3_BRIDGE_TRANSFER_CONFIG_ERROR",
            extra={"reason": "missing_outbound_sip_trunk", "transfer_request_id": transfer_request_id},
        )
        return "CONFIGURATION_ERROR"
    if not caller_id:
        log_event(
            "VOICE_V3_BRIDGE_TRANSFER_CONFIG_ERROR",
            extra={"reason": "missing_outbound_caller_id", "transfer_request_id": transfer_request_id},
        )
        return "CONFIGURATION_ERROR"

    job_ctx = telephony.job_ctx
    room_name = job_ctx.room.name
    caller_identity = telephony.sip_participant_identity
    dest_identity = destination_participant_identity(transfer_request_id, destination_id)
    sip_call_to = normalize_transfer_to(dial_target)

    state = _TransferAttemptState(
        transfer_request_id=transfer_request_id,
        destination_id=destination_id,
        caller_identity=caller_identity,
        destination_identity=dest_identity,
        room_name=room_name,
        cancel_event=asyncio.Event(),
    )
    _active_attempts[transfer_request_id] = state
    _log_lifecycle(state, BridgeTransferLifecycle.ATTEMPTING, executor="livekit_bridge")

    await _wait_for_agent_speech_idle(context)

    io_saved: dict[str, bool] = {}
    hold_player = BackgroundAudioPlayer()
    hold_handle: PlayHandle | None = None
    caller_disconnect_task: asyncio.Task[None] | None = None

    def _on_caller_disconnect(participant: rtc.RemoteParticipant) -> None:
        if participant.identity != caller_identity:
            return
        if state.cancel_event:
            state.cancel_event.set()
        _log_lifecycle(state, BridgeTransferLifecycle.CANCELLED, reason="caller_disconnected")

    job_ctx.room.on("participant_disconnected", _on_caller_disconnect)

    success = False
    try:
        if context is not None:
            _set_session_io_enabled(context, False, io_saved)
            await hold_player.start(room=job_ctx.room)
            hold_handle = hold_player.play(
                AudioConfig(BuiltinAudioClip.HOLD_MUSIC, volume=0.75),
                loop=True,
            )

        _log_lifecycle(state, BridgeTransferLifecycle.RINGING)

        sip_request = api.CreateSIPParticipantRequest(
            sip_trunk_id=trunk,
            sip_call_to=sip_call_to,
            sip_number=caller_id,
            room_name=room_name,
            participant_identity=dest_identity,
            participant_name="Transfer destination",
            wait_until_answered=True,
            play_dialtone=True,
        )
        sip_request.ringing_timeout.FromTimedelta(timedelta(seconds=ringing_timeout_seconds))

        dial_task = asyncio.create_task(job_ctx.api.sip.create_sip_participant(sip_request))
        cancel_wait = state.cancel_event or asyncio.Event()
        done, _ = await asyncio.wait(
            {dial_task, asyncio.create_task(cancel_wait.wait())},
            return_when=asyncio.FIRST_COMPLETED,
        )

        if cancel_wait.is_set() and not dial_task.done():
            dial_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await dial_task
            await _remove_destination_leg(job_ctx.api, room_name, dest_identity)
            return "CANCELLED"

        try:
            await dial_task
        except Exception as exc:
            msg = str(exc).lower()
            await _remove_destination_leg(job_ctx.api, room_name, dest_identity)
            if "busy" in msg:
                _log_lifecycle(state, BridgeTransferLifecycle.FAILED, reason="busy")
                return "BUSY"
            if "timeout" in msg or "no answer" in msg or "deadline" in msg:
                _log_lifecycle(state, BridgeTransferLifecycle.FAILED, reason="timeout")
                return "TIMEOUT"
            if "auth" in msg or "403" in msg or "401" in msg:
                _log_lifecycle(state, BridgeTransferLifecycle.FAILED, reason="auth")
                return "PROVIDER_ERROR"
            logger.exception("voice_v3_bridge_transfer_dial_failed")
            _log_lifecycle(state, BridgeTransferLifecycle.FAILED, reason="provider")
            return "PROVIDER_ERROR"

        _log_lifecycle(state, BridgeTransferLifecycle.ANSWERED)

        await _set_participant_subscribed_to_peer(
            job_ctx.api, room_name, caller_identity, dest_identity, False
        )
        await _bridge_caller_and_destination(
            job_ctx.api,
            room_name,
            caller_identity,
            dest_identity,
        )
        _log_lifecycle(state, BridgeTransferLifecycle.CONNECTED)

        _register_post_handoff_cleanup(telephony, state)
        await finalize_transfer_handoff(context)
        success = True
        return "CONNECTED"
    finally:
        job_ctx.room.off("participant_disconnected", _on_caller_disconnect)
        if hold_handle:
            hold_handle.stop()
        with contextlib.suppress(Exception):
            await hold_player.aclose()
        if context is not None and not success:
            _set_session_io_enabled(context, True, io_saved)
        _active_attempts.pop(transfer_request_id, None)
