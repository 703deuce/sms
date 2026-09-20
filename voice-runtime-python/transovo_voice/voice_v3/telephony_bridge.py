from __future__ import annotations

from dataclasses import dataclass

from livekit.agents import JobContext


@dataclass(frozen=True)
class LiveKitTelephonyBridge:
    job_ctx: JobContext
    sip_participant_identity: str
