from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from transovo_voice.voice_v3.intake_prebuilt import run_prebuilt_collector_for_field


@pytest.mark.asyncio
async def test_nested_get_phone_task_returns_e164_shaped_value():
    parent = SimpleNamespace(chat_ctx=None)
    field_meta = {"key": "phone", "type": "phone", "label": "Phone"}

    fake_result = SimpleNamespace(phone_number="+15715550123")

    class _AwaitableTask:
        def __await__(self):
            async def _inner():
                return fake_result

            return _inner().__await__()

    with patch(
        "transovo_voice.voice_v3.intake_prebuilt.GetPhoneNumberTask",
        return_value=_AwaitableTask(),
    ):
        value = await run_prebuilt_collector_for_field(
            parent=parent,
            field_meta=field_meta,
            field_key="phone",
        )

    assert value == "+15715550123"
