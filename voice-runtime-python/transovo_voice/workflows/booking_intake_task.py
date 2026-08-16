from __future__ import annotations

from typing import TYPE_CHECKING

from livekit.agents import NOT_GIVEN, NotGivenOr
from livekit.agents.llm import ChatContext
from livekit.agents.voice.agent import AgentTask

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.tasks.protocols import BookingIntakeResult
from transovo_voice.workflows.booking_intake import run_manifest_intake_task_group

if TYPE_CHECKING:
    from transovo_voice.userdata import SessionUserData


_INTAKE_INSTRUCTIONS = (
    "Collect the required caller details in a natural conversation. "
    "Before asking anything, scan the conversation for information the caller already gave — "
    "dates, name, phone, email, or other manifest fields. "
    "Do not re-ask details already volunteered."
)


class BookingIntakeTask(AgentTask[BookingIntakeResult]):
    """Short-lived AgentTask wrapping manifest-driven TaskGroup intake (hotel BookRoomTask pattern)."""

    def __init__(
        self,
        backend: TransovoBackend,
        purpose: str = "booking",
        *,
        chat_ctx: NotGivenOr[ChatContext] = NOT_GIVEN,
    ) -> None:
        self._backend = backend
        self._purpose = purpose
        super().__init__(
            instructions=_INTAKE_INSTRUCTIONS,
            chat_ctx=chat_ctx,
        )

    async def on_enter(self) -> None:
        ud: SessionUserData = self.session.userdata
        result = await run_manifest_intake_task_group(
            self.session,
            ud,
            self._backend,
            self.chat_ctx,
            self._purpose,
        )
        if not self.done():
            self.complete(result)
