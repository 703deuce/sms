from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from transovo_voice.voice_v3.live_context_hydration import (
    apply_live_context_events,
    strip_live_context_events,
)


@dataclass
class _StubGptLive:
    thinking: list[tuple[str, str | None]] = field(default_factory=list)
    commentary: list[tuple[str, str | None]] = field(default_factory=list)

    def append_thinking(self, text: str, *, delegation_id: str | None = None) -> None:
        self.thinking.append((text, delegation_id))

    def append_commentary(self, text: str, *, delegation_id: str | None = None) -> None:
        self.commentary.append((text, delegation_id))


def test_strip_live_context_events() -> None:
    result = {
        "ok": True,
        "liveContextEvents": [
            {"type": "session.thinking.append", "content": "facts", "delegation_id": None},
        ],
    }
    events = strip_live_context_events(result)
    assert "liveContextEvents" not in result
    assert len(events) == 1


def test_apply_live_context_events() -> None:
    stub = _StubGptLive()
    applied = apply_live_context_events(
        [
            {"type": "session.thinking.append", "content": "Anthony Johnson", "delegation_id": "dlg_1"},
            {"type": "session.commentary.append", "content": "Caller name on file.", "delegation_id": None},
        ],
        duplex_session=stub,
    )
    assert applied == 2
    assert stub.thinking[0][0] == "Anthony Johnson"
    assert stub.thinking[0][1] == "dlg_1"
    assert stub.commentary[0][0] == "Caller name on file."
