from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

from livekit.agents import AgentServer, JobContext, cli

from transovo_voice.session.inbound import run_inbound_session
from transovo_voice.telemetry import log_boot_versions, log_event

load_dotenv()

logger = logging.getLogger("transovo-voice")
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "transovo-voice-runtime")

server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name, "impl": "python"}
    metadata = ctx.job.metadata or ""
    if metadata and "outbound" in metadata.lower():
        log_event(
            "python_voice_outbound_skipped",
            extra={"room": ctx.room.name, "note": "use VOICE_RUNTIME_IMPL=typescript for outbound"},
        )
        logger.warning("Outbound jobs require TypeScript runtime until Python outbound ships")
        return
    await run_inbound_session(ctx)


def main() -> None:
    log_event("python_voice_boot_started", extra={"agentName": AGENT_NAME})
    log_boot_versions()
    cli.run_app(server)


if __name__ == "__main__":
    main()
