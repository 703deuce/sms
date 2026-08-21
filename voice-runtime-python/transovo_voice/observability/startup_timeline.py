from __future__ import annotations

import os
import time
from typing import Any

from transovo_voice.telemetry import log_event


def startup_masking_audio_enabled() -> bool:
    """Temporary hold phrase while realtime connects — not a substitute for fast startup."""
    raw = os.getenv("VOICE_STARTUP_MASKING_AUDIO", "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}


class StartupTimeline:
    """Wall-clock phases from LiveKit job receive → first model audio."""

    def __init__(self, job_started_at: float) -> None:
        self._t0 = job_started_at
        self._phases: dict[str, int] = {}
        self._masking_audio_ms: int | None = None
        self._dispatch_resolve_ms: int | None = None
        self._bootstrap_http_ms: int | None = None
        self._bootstrap_path: str | None = None

    def ms_from_job_start(self) -> int:
        return int((time.perf_counter() - self._t0) * 1000)

    def mark(self, phase: str, *, extra: dict[str, Any] | None = None) -> int:
        ms = self.ms_from_job_start()
        self._phases[phase] = ms
        payload: dict[str, Any] = {"phase": phase, "msFromJobStart": ms}
        if extra:
            payload.update(extra)
        log_event("startup_phase", extra=payload)
        return ms

    def set_dispatch_resolve_ms(self, ms: int, *, path: str | None = None) -> None:
        self._dispatch_resolve_ms = ms
        self._bootstrap_http_ms = ms
        if path:
            self._bootstrap_path = path

    def set_bootstrap_http_ms(self, ms: int, *, path: str | None = None) -> None:
        self.set_dispatch_resolve_ms(ms, path=path)

    def set_masking_audio_ms(self, ms: int) -> None:
        self._masking_audio_ms = ms

    def snapshot(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "phases": dict(self._phases),
        }
        if self._dispatch_resolve_ms is not None:
            out["dispatchResolveMs"] = self._dispatch_resolve_ms
            out["bootstrapHttpMs"] = self._dispatch_resolve_ms
        if self._bootstrap_path:
            out["bootstrapPath"] = self._bootstrap_path
        if self._masking_audio_ms is not None:
            out["maskingAudioMs"] = self._masking_audio_ms
            out["maskingAudioTemporary"] = True

        phases = self._phases
        if "participant_joined" in phases:
            out["participantJoinedMs"] = phases["participant_joined"]
        if "routing_metadata_parsed" in phases:
            out["routingMetadataParsedMs"] = phases["routing_metadata_parsed"]
        if "config_ready" in phases:
            out["configReadyMs"] = phases["config_ready"]
        if "agent_session_start_begin" in phases:
            out["agentSessionStartBeginMs"] = phases["agent_session_start_begin"]
        if "agent_session_started" in phases:
            out["agentSessionStartedMs"] = phases["agent_session_started"]
        if "first_model_audio" in phases:
            out["firstModelAudioMs"] = phases["first_model_audio"]
        if "first_model_audio" in phases and "participant_joined" in phases:
            out["participantJoinedToFirstModelAudioMs"] = (
                phases["first_model_audio"] - phases["participant_joined"]
            )
        return out
