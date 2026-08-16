from __future__ import annotations

from livekit.agents import llm
from livekit.agents.beta.workflows import GetAddressTask, GetEmailTask, GetNameTask, GetPhoneNumberTask

from transovo_voice.tasks.protocols import (
    AddressIntakeResult,
    EmailIntakeResult,
    NameIntakeResult,
    PhoneIntakeResult,
)


class TransovoNameTask:
    def __init__(self, field_id: str, last_name: bool = True, chat_ctx: llm.ChatContext | None = None):
        self._field_id = field_id
        self._last_name = last_name
        self._chat_ctx = chat_ctx

    async def run(self, chat_ctx: llm.ChatContext | None = None) -> NameIntakeResult:
        ctx = chat_ctx or self._chat_ctx
        task = GetNameTask(last_name=self._last_name, chat_ctx=ctx)
        result = await task
        parts = [result.first_name, result.last_name]
        full = " ".join(p for p in parts if p and p.strip()).strip()
        return NameIntakeResult(
            field_id=self._field_id,
            full_name=full,
            first_name=result.first_name,
            last_name=result.last_name,
        )


class TransovoPhoneTask:
    def __init__(self, field_id: str, chat_ctx: llm.ChatContext | None = None):
        self._field_id = field_id
        self._chat_ctx = chat_ctx

    async def run(self, chat_ctx: llm.ChatContext | None = None) -> PhoneIntakeResult:
        ctx = chat_ctx or self._chat_ctx
        task = GetPhoneNumberTask(chat_ctx=ctx)
        result = await task
        return PhoneIntakeResult(field_id=self._field_id, phone_number=result.phone_number)


class TransovoEmailTask:
    def __init__(self, field_id: str, chat_ctx: llm.ChatContext | None = None):
        self._field_id = field_id
        self._chat_ctx = chat_ctx

    async def run(self, chat_ctx: llm.ChatContext | None = None) -> EmailIntakeResult:
        ctx = chat_ctx or self._chat_ctx
        task = GetEmailTask(chat_ctx=ctx)
        result = await task
        return EmailIntakeResult(field_id=self._field_id, email=result.email_address)


class TransovoAddressTask:
    def __init__(self, field_id: str, chat_ctx: llm.ChatContext | None = None):
        self._field_id = field_id
        self._chat_ctx = chat_ctx

    async def run(self, chat_ctx: llm.ChatContext | None = None) -> AddressIntakeResult:
        ctx = chat_ctx or self._chat_ctx
        task = GetAddressTask(chat_ctx=ctx)
        result = await task
        return AddressIntakeResult(field_id=self._field_id, address=result.address)
