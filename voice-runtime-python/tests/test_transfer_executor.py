"""Mocked LiveKit transfer executor (no PSTN)."""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from transovo_voice.voice_v3.transfer_targets import normalize_transfer_to

try:
    from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
    from transovo_voice.voice_v3.transfer_executor import (
        _phone_foundation_handoff,
        execute_authorized_transfer_plan,
    )

    _LIVEKIT_AVAILABLE = True
except ModuleNotFoundError:
    _LIVEKIT_AVAILABLE = False


class TestTransferNormalize(unittest.TestCase):
    def test_normalize_e164(self) -> None:
        self.assertEqual(normalize_transfer_to("+15551234567"), "+15551234567")

    def test_passthrough_tel(self) -> None:
        self.assertEqual(normalize_transfer_to("tel:+15551234567"), "+15551234567")


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed in this environment")
class TestExecuteAuthorizedPlan(unittest.IsolatedAsyncioTestCase):
    async def test_livekit_sip_direct_uses_bridge(self) -> None:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        job_ctx.room.on = MagicMock()
        job_ctx.room.off = MagicMock()
        job_ctx.room.remote_participants = {}
        job_ctx.api.sip.create_sip_participant = AsyncMock()
        job_ctx.api.room.get_participant = AsyncMock(
            return_value=MagicMock(tracks=[MagicMock(type=0, sid="track_audio")]),
        )
        job_ctx.api.room.update_subscriptions = AsyncMock()
        job_ctx.add_shutdown_callback = MagicMock()
        telephony = LiveKitTelephonyBridge(
            job_ctx=job_ctx,
            sip_participant_identity="sip-caller-abc",
        )

        result = {
            "ok": True,
            "data": {
                "status": "transfer_authorized",
                "execution": {
                    "transfer_request_id": "tr_test",
                    "route_id": "route_sales",
                    "fallback": "TAKE_MESSAGE",
                    "outbound_sip_trunk_id": "trunk_1",
                    "outbound_caller_id_e164": "+15550001111",
                    "targets": [
                        {
                            "destination_id": "dest_1",
                            "mode": "DIRECT",
                            "dial_target": "+15551234567",
                            "ringing_timeout_seconds": 20,
                        },
                    ],
                    "handoff_instructions": "test",
                },
            },
        }

        with patch(
            "transovo_voice.voice_v3.livekit_bridge_transfer.BackgroundAudioPlayer",
        ) as player_cls:
            player = MagicMock()
            player.start = AsyncMock()
            player.play = MagicMock(return_value=MagicMock(stop=MagicMock()))
            player.aclose = AsyncMock()
            player_cls.return_value = player

            out = await execute_authorized_transfer_plan(result, telephony, None, None)

        self.assertTrue(out.get("ok"))
        data = out.get("data") or {}
        self.assertNotIn("execution", data)
        self.assertEqual(data.get("status"), "transfer_connected")
        job_ctx.api.sip.create_sip_participant.assert_awaited_once()

    async def test_wrong_route_skips_executor(self) -> None:
        telephony = MagicMock()
        out = await execute_authorized_transfer_plan({"ok": False, "error": "bad"}, telephony, None, None)
        self.assertFalse(out.get("ok"))

    async def test_phone_call_control_invokes_backend(self) -> None:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        telephony = LiveKitTelephonyBridge(
            job_ctx=job_ctx,
            sip_participant_identity="sip-caller-abc",
        )
        backend = MagicMock()
        backend._ctx.workspace_id = "ws_1"
        backend._ctx.call_id = "call_1"
        backend._ctx.agent_id = "agent_1"
        backend._backend = MagicMock()
        backend._backend.call = AsyncMock(return_value={"ok": True})

        result = {
            "ok": True,
            "data": {
                "status": "transfer_authorized",
                "execution": {
                    "transfer_request_id": "tr_pf",
                    "route_id": "route_group",
                    "fallback": "TAKE_MESSAGE",
                    "targets": [
                        {
                            "destination_id": "dest_ring",
                            "mode": "DIRECT",
                            "executor": "phone_call_control",
                            "forwarding_group_id": "grp_1",
                            "human_call_id": "hc_1",
                            "inbound_call_control_id": "cc_in_1",
                            "ringing_timeout_seconds": 30,
                        },
                    ],
                    "handoff_instructions": "test",
                },
            },
        }

        out = await execute_authorized_transfer_plan(result, telephony, None, backend)
        backend._backend.call.assert_awaited_once()
        args = backend._backend.call.await_args
        self.assertEqual(args.args[0], "execute_phone_foundation_transfer")
        payload = args.args[1]
        self.assertEqual(payload["humanCallId"], "hc_1")
        self.assertEqual(payload["forwardingGroupId"], "grp_1")
        data = out.get("data") or {}
        self.assertEqual(data.get("status"), "transfer_phone_handoff_started")

    async def test_phone_foundation_missing_context(self) -> None:
        backend = MagicMock()
        backend._ctx.workspace_id = "ws_1"
        backend._backend = MagicMock()
        outcome = await _phone_foundation_handoff(
            backend,
            target={"destination_id": "d1"},
            transfer_request_id="tr_x",
            route_id="r_x",
        )
        self.assertEqual(outcome, "CONFIGURATION_ERROR")


if __name__ == "__main__":
    unittest.main()
