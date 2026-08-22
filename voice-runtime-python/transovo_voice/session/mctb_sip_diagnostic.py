"""MCTB 571 SIP delayed-offer diagnostic — no AI, no SMS, no Gather."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from livekit.agents import JobContext

from transovo_voice.session.startup_audio import play_immediate_answer
from transovo_voice.telemetry import log_event

MCTB_571_E164 = "+15714073615"
MCTB_SIP_DIAGNOSTIC_SAY = (
    "Transovo SIP test. Your forwarded call reached us successfully."
)
LOG_SOURCE = "mctb-sip-diagnostic"

_SECRET_KEY = re.compile(r"password|secret|auth|token|credential", re.I)


def _normalize_e164(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if value.startswith("+"):
        return value
    return value


def is_mctb_571_sip_target(to_e164: str | None) -> bool:
    normalized = _normalize_e164(to_e164)
    return normalized == MCTB_571_E164


def _safe_sip_attrs(attrs: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in attrs.items():
        if _SECRET_KEY.search(key):
            continue
        text = str(value)
        if len(text) > 300:
            text = f"{text[:300]}…"
        out[key] = text
    return out


def _extract_forwarded(attrs: dict[str, str]) -> str | None:
    for key, value in attrs.items():
        lowered = key.lower()
        if "diversion" in lowered or "forward" in lowered or "history-info" in lowered:
            return str(value)[:300]
    return None


def _log_mctb_sip_diagnostic(
    event: str,
    *,
    call_id: str,
    from_e164: str | None,
    to_e164: str | None,
    room: str,
    participant_identity: str,
    attrs: dict[str, str],
    extra: dict[str, Any] | None = None,
) -> None:
    payload = {
        "source": LOG_SOURCE,
        "event": event,
        "callId": call_id,
        "callerAni": from_e164,
        "calledDid": to_e164,
        "forwardedFrom": _extract_forwarded(attrs),
        "callIdHeader": attrs.get("sip.callId") or attrs.get("sip.call-id"),
        "sipHeaders": _safe_sip_attrs(attrs),
        "inviteHasSdp": attrs.get("sip.hasSdp") or attrs.get("sip.inviteHasSdp"),
        "contentLength": attrs.get("sip.contentLength"),
        "receivedAt": datetime.now(timezone.utc).isoformat(),
        "room": room,
        "participantIdentity": participant_identity,
    }
    if extra:
        payload.update(extra)
    print(json.dumps(payload, default=str))


async def run_mctb_sip_diagnostic_session(
    ctx: JobContext,
    *,
    participant_identity: str,
    from_e164: str | None,
    to_e164: str | None,
    attrs: dict[str, str],
) -> None:
    """Answer via LiveKit media, speak diagnostic phrase, hang up — no AI template."""
    call_id = str(uuid4())
    _log_mctb_sip_diagnostic(
        "inbound_sip_captured",
        call_id=call_id,
        from_e164=from_e164,
        to_e164=to_e164,
        room=ctx.room.name,
        participant_identity=participant_identity,
        attrs=attrs,
    )
    log_event(
        "mctb_sip_diagnostic_started",
        call_id=call_id,
        extra={
            "toE164": to_e164,
            "fromE164": from_e164,
            "runtime": "livekit_python",
            "source": LOG_SOURCE,
        },
    )

    await ctx.connect()
    _log_mctb_sip_diagnostic(
        "room_connected",
        call_id=call_id,
        from_e164=from_e164,
        to_e164=to_e164,
        room=ctx.room.name,
        participant_identity=participant_identity,
        attrs=attrs,
    )

    played_ms = await play_immediate_answer(
        ctx.room,
        phrase=MCTB_SIP_DIAGNOSTIC_SAY,
        call_id=call_id,
        temporary=False,
    )
    _log_mctb_sip_diagnostic(
        "diagnostic_phrase_played",
        call_id=call_id,
        from_e164=from_e164,
        to_e164=to_e164,
        room=ctx.room.name,
        participant_identity=participant_identity,
        attrs=attrs,
        extra={"playedMs": played_ms, "phrase": MCTB_SIP_DIAGNOSTIC_SAY},
    )

    _log_mctb_sip_diagnostic(
        "diagnostic_hangup",
        call_id=call_id,
        from_e164=from_e164,
        to_e164=to_e164,
        room=ctx.room.name,
        participant_identity=participant_identity,
        attrs=attrs,
    )
    log_event(
        "mctb_sip_diagnostic_complete",
        call_id=call_id,
        extra={"toE164": to_e164, "fromE164": from_e164, "source": LOG_SOURCE},
    )
