from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock

from transovo_voice.voice_v3.tool_client import TransovoV3ToolClient, VoiceV3CallContext


class TestVoiceV3ToolClientResolve(unittest.IsolatedAsyncioTestCase):
    async def test_resolve_session_config_sends_livekit_sip_bootstrap(self) -> None:
        backend = MagicMock()
        backend.call = AsyncMock(return_value={"liveSessionId": "lk_room"})
        ctx = VoiceV3CallContext(
            room_name="transovo-call-_+15551234567_abc",
            sip_participant_identity="sip_+15559876543",
            caller_e164="+15559876543",
            dialed_e164="+15551234567",
            dialed_e164_source="sip.trunkPhoneNumber",
            sip_call_id="cid",
            provider_call_id=None,
            trunk_id="trunk",
            rule_id=None,
            telnyx_call_screening_raw=None,
            live_session_id="",
            call_id="",
            workspace_id="",
            agent_id="",
        )
        client = TransovoV3ToolClient(backend, ctx)
        await client.resolve_session_config()

        backend.call.assert_awaited_once()
        action, payload = backend.call.await_args.args
        self.assertEqual(action, "resolve_voice_v3_livekit_session")
        self.assertEqual(payload["bootstrapPath"], "livekit_sip")
        self.assertEqual(payload["dialedE164Source"], "sip.trunkPhoneNumber")
        self.assertEqual(payload["roomName"], ctx.room_name)
        self.assertEqual(payload["sipParticipantIdentity"], ctx.sip_participant_identity)


if __name__ == "__main__":
    unittest.main()
