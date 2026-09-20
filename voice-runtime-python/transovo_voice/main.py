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
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "[REDACTED]")
VOICE_V3_AGENT_NAME = os.getenv("VOICE_V3_LIVEKIT_AGENT_NAME", "").strip() or "transovo-voice-v3"
WORKER_PROFILE = os.getenv("VOICE_WORKER_PROFILE", "legacy").strip().lower()


def _ensure_worker_registered(agent_name: str) -> None:
    log_event(
        "voice_worker_registered",
        extra={
            "workerId": os.getenv("HOSTNAME") or os.getenv("FLY_MACHINE_ID") or "local",
            "workerType": "livekit_rtc_session",
            "agentName": agent_name,
            "workerProfile": WORKER_PROFILE,
            "namespace": os.getenv("LIVEKIT_PROJECT") or os.getenv("LIVEKIT_URL") or "default",
            "connectedToLiveKit": True,
            "registeredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "transovo-voice-main",
        },
    )


def _build_server() -> AgentServer:
    server = AgentServer()

    if WORKER_PROFILE == "v3":
        agent_name = VOICE_V3_AGENT_NAME

        @server.rtc_session(agent_name=agent_name)
        async def voice_v3_entrypoint(ctx: JobContext) -> None:
            _ensure_worker_registered(agent_name)
            ctx.log_context_fields = {
                "service": "transovo-voice",
                "room": ctx.room.name,
                "impl": "python",
                "profile": "voice_v3_gpt_live",
            }
            from transovo_voice.voice_v3.session import run_voice_v3_livekit_session

            await run_voice_v3_livekit_session(ctx)

        return server

    agent_name = AGENT_NAME

    @server.rtc_session(agent_name=agent_name)
    async def entrypoint(ctx: JobContext) -> None:
        _ensure_worker_registered(agent_name)
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

    return server


def main() -> None:
    active_backend = apply_media_backend_env()
    from transovo_voice.build_identity import get_voice_build_identity

    active_agent = VOICE_V3_AGENT_NAME if WORKER_PROFILE == "v3" else AGENT_NAME
    log_event(
        "python_voice_boot_started",
        extra={
            "agentName": active_agent,
            "workerProfile": WORKER_PROFILE,
            "apiVersion": VOICE_RUNTIME_API_VERSION,
            "mediaBackend": active_backend,
            **get_voice_build_identity(),
        },
    )
    log_boot_versions()
    from transovo_voice.boot_probe import probe_backend_health

    probe_backend_health()
    server = _build_server()
    cli.run_app(server)


if __name__ == "__main__":
    main()
