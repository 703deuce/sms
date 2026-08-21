from __future__ import annotations

from livekit.agents import Agent, JobContext
from livekit.agents.llm import function_tool

from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session
from transovo_voice.userdata import SessionUserData

_DEMO_KNOWLEDGE = [
    "We are open Monday through Friday 8 AM to 5 PM.",
    "We offer plumbing, drain cleaning, and water heater service.",
    "Emergency service is available after hours for an additional dispatch fee.",
    "We serve the greater metro area within 30 miles.",
]


class KnowledgeRagAgent(Agent):
    """Phase F lab — simple keyword knowledge search (not full vector RAG yet)."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "Answer caller questions using search_business_knowledge when needed. "
                "For simple facts already known from a prior search, answer directly."
            ),
        )

    async def on_enter(self) -> None:
        await self.session.generate_reply(
            instructions="Greet the caller and invite them to ask a question about the business.",
        )

    @function_tool
    async def search_business_knowledge(self, query: str) -> str:
        """Search business knowledge for an answer."""
        q = query.lower()
        hits = [line for line in _DEMO_KNOWLEDGE if any(word in line.lower() for word in q.split())]
        if not hits:
            hits = _DEMO_KNOWLEDGE
        return "\n".join(hits[:3])


async def run_knowledge_rag_template(ctx: JobContext, ud: SessionUserData) -> None:
    session = build_realtime_session(ud)
    await session.start(
        agent=KnowledgeRagAgent(),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
    )
