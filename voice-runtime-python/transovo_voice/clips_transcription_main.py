"""Dedicated LiveKit worker for Rooms captions (one rtc_session per process)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from livekit.agents import AgentServer, cli

from transovo_voice.clips_recording.transcription_agent import register_transcription_agent

load_dotenv()


def _http_port() -> int:
    raw = os.getenv("CLIPS_WORKER_HTTP_PORT", "").strip() or "8083"
    return int(raw, 10)


def main() -> None:
    os.environ.setdefault("CLIPS_RECORDING_WORKER_ENABLED", "1")
    server = AgentServer(port=_http_port())
    register_transcription_agent(server)
    cli.run_app(server)


if __name__ == "__main__":
    main()
