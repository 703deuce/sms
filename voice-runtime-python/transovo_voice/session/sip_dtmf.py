"""SIP DTMF collection for MCTB Press-1 consent."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from livekit import rtc

    from transovo_voice.session.mctb_sip_e2e_trace import MctbSipE2eTrace


async def wait_for_sip_dtmf_digit(
    room: "rtc.Room",
    *,
    participant_identity: str,
    digit: str,
    timeout_s: float,
    trace: "MctbSipE2eTrace",
) -> bool:
    """Wait until the SIP participant sends the expected DTMF digit."""
    expected = str(digit)
    fut: asyncio.Future[bool] = asyncio.get_running_loop().create_future()

    def _on_sip_dtmf_received(dtmf: "rtc.SipDTMF") -> None:
        if fut.done():
            return
        sender = getattr(dtmf, "participant", None)
        if sender is not None and sender.identity != participant_identity:
            return
        received = str(getattr(dtmf, "digit", "") or "")
        trace.log(
            "mctb_dtmf_received",
            digit=received,
            code=getattr(dtmf, "code", None),
            participantIdentity=participant_identity,
            expectedDigit=expected,
        )
        if received == expected:
            fut.set_result(True)

    room.on("sip_dtmf_received", _on_sip_dtmf_received)
    try:
        return await asyncio.wait_for(fut, timeout=timeout_s)
    except asyncio.TimeoutError:
        trace.log(
            "mctb_dtmf_timeout",
            expectedDigit=expected,
            timeoutSeconds=timeout_s,
            participantIdentity=participant_identity,
        )
        return False
    finally:
        room.off("sip_dtmf_received", _on_sip_dtmf_received)
