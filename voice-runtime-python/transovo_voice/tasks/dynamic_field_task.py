from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from livekit.agents import llm
from livekit.agents.llm.tool_context import ToolError, function_tool
from livekit.agents.voice.agent import AgentTask

from transovo_voice.tasks.protocols import DynamicFieldResult


@dataclass
class DynamicFieldConfig:
    field_id: str
    label: str
    question: str
    field_type: str
    required: bool = True
    options: list[str] | None = None
    validation: str | None = None


class DynamicFieldTask(AgentTask[DynamicFieldResult]):
  """Reusable manifest-driven field collection for arbitrary customer fields."""

  def __init__(self, config: DynamicFieldConfig, chat_ctx: llm.ChatContext | None = None) -> None:
    self._config = config
    extra = ""
    if config.options:
      extra = f" Valid options: {', '.join(config.options)}."

    @function_tool(name="record_field_value", description=f"Record the caller's {config.label}.")
    async def record_field_value(value: str) -> str:
      trimmed = value.strip()
      if not trimmed:
        raise ToolError(f"Please provide your {config.label}.")
      if config.options and trimmed not in config.options:
        raise ToolError(f"Please choose one of: {', '.join(config.options)}.")
      self.complete(DynamicFieldResult(field_id=config.field_id, value=trimmed))
      return "Saved."

    super().__init__(
      instructions=(
        f"Collect exactly one field: {config.label}. "
        f"When the caller answers, call record_field_value. "
        f"Question to ask if needed: {config.question}.{extra} "
        "Do not ask for other missing fields in the same question."
      ),
      chat_ctx=chat_ctx,
      tools=[record_field_value],
    )

  async def on_enter(self) -> None:
    question = self._config.question.strip() or f"What is your {self._config.label}?"
    await self.session.generate_reply(
      instructions=f"Ask the caller this one question naturally: {question}",
    )
