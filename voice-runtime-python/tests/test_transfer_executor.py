"""Mocked LiveKit SIP transfer executor (no PSTN)."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock

from transovo_voice.voice_v3.transfer_targets import normalize_transfer_to

try:
    from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
    from transovo_voice.voice_v3.transfer_executor import (
        _direct_transfer,
        execute_authorized_transfer_plan,
    )

    _LIVEKIT_AVAILABLE = True
except ModuleNotFoundError:
    _LIVEKIT_AVAILABLE = False


class TestTransferNormalize(unittest.TestCase):
    def test_normalize_e164(self) -> None:
        self.assertEqual(normalize_transfer_to("+15551234567"), "tel:+15551234567")

    def test_passthrough_tel(self) -> None:
        self.assertEqual(normalize_transfer_to("tel:+15551234567"), "tel:+15551234567")


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed in this environment")
class TestDirectTransfer(unittest.IsolatedAsyncioTestCase):
    async def test_refer_accepted(self) -> None:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        job_ctx.api.sip.transfer_sip_participant = AsyncMock()
        telephony = LiveKitTelephonyBridge(
            job_ctx=job_ctx,
            sip_participant_identity="sip-caller-abc",
        )
        outcome = await _direct_transfer(
            telephony,
            dial_target="+15551234567",
            ringing_timeout_seconds=25,
        )
        self.assertEqual(outcome, "SIP_REFER_ACCEPTED")
        job_ctx.api.sip.transfer_sip_participant.assert_awaited_once()
        req = job_ctx.api.sip.transfer_sip_participant.await_args.args[0]
        self.assertEqual(req.room_name, "room_test")
        self.assertEqual(req.participant_identity, "sip-caller-abc")
        self.assertEqual(req.transfer_to, "tel:+15551234567")

    async def test_timeout_maps_from_error_message(self) -> None:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        job_ctx.api.sip.transfer_sip_participant = AsyncMock(
            side_effect=RuntimeError("ringing timeout exceeded"),
        )
        telephony = LiveKitTelephonyBridge(
            job_ctx=job_ctx,
            sip_participant_identity="sip-caller-abc",
        )
        with self.assertRaises(asyncio.TimeoutError):
            await _direct_transfer(
                telephony,
                dial_target="+15551234567",
                ringing_timeout_seconds=5,
            )


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed in this environment")
class TestExecuteAuthorizedPlan(unittest.IsolatedAsyncioTestCase):
    async def test_strips_execution_and_reports_refer(self) -> None:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        job_ctx.api.sip.transfer_sip_participant = AsyncMock()
        telephony = LiveKitTelephonyBridge(
            job_ctx=job_ctx,
            sip_participant_identity="sip-caller-abc",
        )
        backend = MagicMock()
        backend._ctx.workspace_id = "ws_1"
        backend._ctx.call_id = "call_1"
        backend._ctx.agent_id = "agent_1"
        backend._backend = MagicMock()
        backend._backend.call = AsyncMock()

        result = {
            "ok": True,
            "data": {
                "status": "transfer_authorized",
                "execution": {
                    "transfer_request_id": "tr_test",
                    "route_id": "route_sales",
                    "fallback": "TAKE_MESSAGE",
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

        out = await execute_authorized_transfer_plan(result, telephony, None, backend)
        self.assertTrue(out.get("ok"))
        data = out.get("data") or {}
        self.assertNotIn("execution", data)
        self.assertEqual(data.get("status"), "transfer_refer_accepted")
        self.assertFalse(data.get("human_answered", True))

    async def test_wrong_route_skips_executor(self) -> None:
        telephony = MagicMock()
        out = await execute_authorized_transfer_plan({"ok": False, "error": "bad"}, telephony, None, None)
        self.assertFalse(out.get("ok"))


if __name__ == "__main__":
    unittest.main()
