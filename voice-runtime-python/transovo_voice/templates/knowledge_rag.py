from __future__ import annotations

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool

from transovo_voice.integrations.backend_client import TransovoBackend
from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.templates.template_context import (
    build_template_instructions,
    resolve_greeting_instructions,
)
from transovo_voice.userdata import SessionUserData

_DEMO_KNOWLEDGE = [
    "We are open Monday through Friday 8 AM to 5 PM.",
    "We offer plumbing, drain cleaning, and water heater service.",
    "Emergency service is available after hours for an additional dispatch fee.",
    "We serve the greater metro area within 30 miles.",
]

_FALLBACK_ROLE = (
    "Answer caller questions using search_business_knowledge when needed. "
    "For simple facts already known from a prior search, answer directly."
)
_TEMPLATE_ROLE = (
    "You are in knowledge RAG lab mode. Prefer search_business_knowledge for business "
    "questions. Use the configured business context above for facts already provided there."
)


class KnowledgeRagAgent(Agent):
    """Knowledge lab — backend business_answer when configured, demo snippets as fallback."""

    def __init__(self, ud: SessionUserData, backend: TransovoBackend) -> None:
        self._ud = ud
        self._backend = backend
        super().__init__(
            instructions=build_template_instructions(
                ud,
                template_mode="livekit_knowledge_rag",
                template_role=_TEMPLATE_ROLE,
                fallback_instructions=_FALLBACK_ROLE,
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions=resolve_greeting_instructions(
                self._ud,
                fallback="Greet the caller and invite them to ask a question about the business.",
            ),
        )

    @function_tool
    async def search_business_knowledge(self, query: str) -> str:
        """Search business knowledge for an answer."""
        result = await self._backend.call(
            "business_answer",
            {
                "workspaceId": self._ud.workspace_id,
                "agentId": self._ud.agent_id,
                "topic": query,
            },
        )
        if result.get("ok") and result.get("speak"):
            return str(result["speak"])

        q = query.lower()
        hits = [line for line in _DEMO_KNOWLEDGE if any(word in line.lower() for word in q.split())]
        if not hits:
            hits = _DEMO_KNOWLEDGE
        return "\n".join(hits[:3])


async def run_knowledge_rag_template(
    ctx: JobContext,
    ud: SessionUserData,
    backend: TransovoBackend,
) -> None:
    session = build_realtime_session(ud)
    await session.start(
        agent=KnowledgeRagAgent(ud, backend),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
