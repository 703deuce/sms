from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv

from livekit.agents import AgentServer, JobContext, cli

from transovo_voice.media_backend import apply_media_backend_env
from transovo_voice.constants import VOICE_RUNTIME_API_VERSION
from transovo_voice.session.inbound import run_inbound_session
from transovo_voice.telemetry import log_boot_versions, log_event

load_dotenv()

logger = logging.getLogger("transovo-voice")
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "transovo-voice-runtime")
_worker_registered = False


def _ensure_worker_registered() -> None:
    global _worker_registered
    if _worker_registered:
        return
    _worker_registered = True
    log_event(
        "voice_worker_registered",
        extra={
            "workerId": os.getenv("HOSTNAME") or os.getenv("FLY_MACHINE_ID") or "local",
            "workerType": "livekit_rtc_session",
            "agentName": AGENT_NAME,
            "namespace": os.getenv("LIVEKIT_PROJECT") or os.getenv("LIVEKIT_URL") or "default",
            "connectedToLiveKit": True,
            "registeredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "mctb-sip-e2e",
        },
    )


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    _ensure_worker_registered()
    job_id = getattr(getattr(ctx, "job", None), "id", None) or ctx.room.name
    log_event(
        "worker_job_entry_entered",
        room=ctx.room.name,
        extra={
            "source": "mctb-sip-e2e",
            "jobId": str(job_id),
            "roomName": ctx.room.name,
        },
    )
    log_event(
        "worker_job_received",
        room=ctx.room.name,
        extra={
            "source": "mctb-sip-e2e",
            "event": "worker_job_received",
            "jobId": str(job_id),
            "roomName": ctx.room.name,
        },
    )
    ctx.log_context_fields = {
        "service": "transovo-voice",
        "room": ctx.room.name,
        "impl": "python",
    }
    metadata = ctx.job.metadata or ""
    if metadata and "outbound" in metadata.lower():
        log_event(
            "python_voice_outbound_skipped",
            room=ctx.room.name,
            extra={"note": "Outbound AI voice disabled during clean-room rebuild"},
        )
        logger.warning("Outbound jobs are disabled — inbound template testing only")
        return
    await run_inbound_session(ctx)


def main() -> None:
    active_backend = apply_media_backend_env()
    from transovo_voice.build_identity import get_voice_build_identity

    log_event(
        "python_voice_boot_started",
        extra={
            "agentName": AGENT_NAME,
            "apiVersion": VOICE_RUNTIME_API_VERSION,
            "mediaBackend": active_backend,
            **get_voice_build_identity(),
        },
    )
    log_boot_versions()
    from transovo_voice.boot_probe import probe_backend_health

    probe_backend_health()
    # LiveKit cli.run_app handles SIGTERM/SIGINT and drains active jobs when possible.
    cli.run_app(server)


if __name__ == "__main__":
    main()
