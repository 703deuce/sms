from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

from livekit.agents import AgentServer, JobContext, cli

from transovo_voice.boot_probe import probe_backend_health
from transovo_voice.constants import VOICE_RUNTIME_API_VERSION
from transovo_voice.session.inbound import run_inbound_session
from transovo_voice.telemetry import log_boot_versions, log_event

load_dotenv()

logger = logging.getLogger("transovo-voice")
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "transovo-voice-runtime")

server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
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
            extra={"note": "Outbound uses transovo-outbound-runtime TypeScript worker"},
        )
        logger.warning(
            "Outbound jobs use transovo-outbound-runtime — this Python worker is inbound-only",
        )
        return
    await run_inbound_session(ctx)


def main() -> None:
    log_event(
        "python_voice_boot_started",
        extra={
            "agentName": AGENT_NAME,
            "apiVersion": VOICE_RUNTIME_API_VERSION,
        },
    )
    log_boot_versions()
    probe_backend_health()
    # LiveKit cli.run_app handles SIGTERM/SIGINT and drains active jobs when possible.
    cli.run_app(server)


if __name__ == "__main__":
    main()
