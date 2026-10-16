from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

from livekit.agents import AgentServer, JobContext, cli

from transovo_voice.media_backend import apply_media_backend_env
from transovo_voice.constants import VOICE_RUNTIME_API_VERSION
from transovo_voice.telemetry import log_boot_versions, log_event

load_dotenv()

logger = logging.getLogger("transovo-voice")
VOICE_V3_AGENT_NAME = os.getenv("VOICE_V3_LIVEKIT_AGENT_NAME", "").strip() or "transovo-voice-v3"
WORKER_PROFILE = os.getenv("VOICE_WORKER_PROFILE", "v3").strip().lower()

if WORKER_PROFILE != "v3":
    logger.error(
        "VOICE_WORKER_PROFILE=%s is not supported — only voice_v3 (GPT-Live) runs inbound calls",
        WORKER_PROFILE,
    )
    sys.exit(1)


def _worker_http_port() -> int:
    """LiveKit AgentServer health HTTP port (one per worker process)."""
    raw = (
        os.getenv("VOICE_WORKER_HTTP_PORT", "").strip()
        or os.getenv("LIVEKIT_WORKER_HTTP_PORT", "").strip()
        or "8081"
    )
    return int(raw, 10)


server = AgentServer(port=_worker_http_port())


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


async def voice_v3_entrypoint(ctx: JobContext) -> None:
    _ensure_worker_registered(VOICE_V3_AGENT_NAME)
    ctx.log_context_fields = {
        "service": "transovo-voice",
        "room": ctx.room.name,
        "impl": "python",
        "profile": "voice_v3_gpt_live",
    }
    from transovo_voice.voice_v3.session import run_voice_v3_livekit_session

    await run_voice_v3_livekit_session(ctx)


server.rtc_session(agent_name=VOICE_V3_AGENT_NAME)(voice_v3_entrypoint)


def _prewarm_voice_v3_observability_modules() -> None:
    import anyio  # noqa: F401
    import transovo_voice.voice_v3.forensics  # noqa: F401
    import transovo_voice.voice_v3.gpt_live_delegation_telemetry  # noqa: F401


def main() -> None:
    active_backend = apply_media_backend_env()
    from transovo_voice.build_identity import get_voice_build_identity

    _prewarm_voice_v3_observability_modules()

    log_event(
        "python_voice_boot_started",
        extra={
            "agentName": VOICE_V3_AGENT_NAME,
            "workerProfile": WORKER_PROFILE,
            "apiVersion": VOICE_RUNTIME_API_VERSION,
            "mediaBackend": active_backend,
            **get_voice_build_identity(),
        },
    )
    log_boot_versions()
    from transovo_voice.boot_probe import probe_backend_health

    probe_backend_health()
    cli.run_app(server)


if __name__ == "__main__":
    main()
