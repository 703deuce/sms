"""Unit tests for LiveKit bridge transfer (no PSTN)."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

try:
    from transovo_voice.voice_v3.livekit_bridge_transfer import execute_livekit_bridge_transfer
    from transovo_voice.voice_v3.telephony_bridge import LiveKitTelephonyBridge
    from transovo_voice.voice_v3.transfer_executor import execute_authorized_transfer_plan
    from transovo_voice.voice_v3.transfer_targets import (
        destination_participant_identity,
        normalize_transfer_to,
    )

    _LIVEKIT_AVAILABLE = True
except ModuleNotFoundError:
    _LIVEKIT_AVAILABLE = False


class TestTransferTargets(unittest.TestCase):
    def test_normalize_e164(self) -> None:
        self.assertEqual(normalize_transfer_to("+15551234567"), "+15551234567")

    def test_strip_tel(self) -> None:
        self.assertEqual(normalize_transfer_to("tel:+15551234567"), "+15551234567")

    def test_destination_identity_stable(self) -> None:
        a = destination_participant_identity("tr_abc", "dest_1")
        b = destination_participant_identity("tr_abc", "dest_1")
        self.assertEqual(a, b)


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed")
class TestBridgeTransferConfig(unittest.IsolatedAsyncioTestCase):
    async def test_missing_trunk(self) -> None:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        telephony = LiveKitTelephonyBridge(job_ctx=job_ctx, sip_participant_identity="caller-1")
        outcome = await execute_livekit_bridge_transfer(
            telephony,
            None,
            transfer_request_id="tr_missing_trunk",
            destination_id="dest_1",
            dial_target="+15551234567",
            ringing_timeout_seconds=20,
            sip_trunk_id=None,
            sip_number="+15550001111",
        )
        self.assertEqual(outcome, "CONFIGURATION_ERROR")


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed")
class TestBridgeTransferSuccess(unittest.IsolatedAsyncioTestCase):
    async def test_connected_shuts_down_agent(self) -> None:
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

        telephony = LiveKitTelephonyBridge(job_ctx=job_ctx, sip_participant_identity="caller-1")
        context = MagicMock()
        context.session.current_speech = None
        context.session.input.audio = None
        context.session.output.audio = None
        context.session.shutdown = MagicMock()

        with patch(
            "transovo_voice.voice_v3.livekit_bridge_transfer.BackgroundAudioPlayer",
        ) as player_cls:
            player = MagicMock()
            player.start = AsyncMock()
            player.play = MagicMock(return_value=MagicMock(stop=MagicMock()))
            player.aclose = AsyncMock()
            player_cls.return_value = player

            outcome = await execute_livekit_bridge_transfer(
                telephony,
                context,
                transfer_request_id="tr_ok",
                destination_id="dest_1",
                dial_target="+15551234567",
                ringing_timeout_seconds=20,
                sip_trunk_id="trunk_1",
                sip_number="+15550001111",
            )

        self.assertEqual(outcome, "CONNECTED")
        job_ctx.api.sip.create_sip_participant.assert_awaited_once()
        req = job_ctx.api.sip.create_sip_participant.await_args.args[0]
        self.assertEqual(req.room_name, "room_test")
        self.assertEqual(req.sip_trunk_id, "trunk_1")
        self.assertEqual(req.sip_call_to, "+15551234567")
        self.assertEqual(req.participant_identity, destination_participant_identity("tr_ok", "dest_1"))
        self.assertTrue(req.wait_until_answered)
        context.session.shutdown.assert_called_once()


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed")
class TestDuplicateTransfer(unittest.IsolatedAsyncioTestCase):
    async def test_idempotent_in_flight(self) -> None:
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
        telephony = LiveKitTelephonyBridge(job_ctx=job_ctx, sip_participant_identity="caller-1")

        call_count = 0

        async def slow_create(_req: object) -> None:
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.05)

        job_ctx.api.sip.create_sip_participant.side_effect = slow_create

        with patch(
            "transovo_voice.voice_v3.livekit_bridge_transfer.BackgroundAudioPlayer",
        ) as player_cls:
            player = MagicMock()
            player.start = AsyncMock()
            player.play = MagicMock(return_value=MagicMock(stop=MagicMock()))
            player.aclose = AsyncMock()
            player_cls.return_value = player

            t1 = asyncio.create_task(
                execute_livekit_bridge_transfer(
                    telephony,
                    None,
                    transfer_request_id="tr_dup",
                    destination_id="dest_1",
                    dial_target="+15551234567",
                    ringing_timeout_seconds=20,
                    sip_trunk_id="trunk_1",
                    sip_number="+15550001111",
                ),
            )
            await asyncio.sleep(0.01)
            t2 = asyncio.create_task(
                execute_livekit_bridge_transfer(
                    telephony,
                    None,
                    transfer_request_id="tr_dup",
                    destination_id="dest_1",
                    dial_target="+15551234567",
                    ringing_timeout_seconds=20,
                    sip_trunk_id="trunk_1",
                    sip_number="+15550001111",
                ),
            )
            o1, o2 = await asyncio.gather(t1, t2)

        self.assertEqual(o1, o2)
        self.assertEqual(call_count, 1)


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed")
class TestExecuteAuthorizedPlan(unittest.IsolatedAsyncioTestCase):
    async def test_bridge_direct_mode(self) -> None:
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
        telephony = LiveKitTelephonyBridge(job_ctx=job_ctx, sip_participant_identity="caller-1")

        result = {
            "ok": True,
            "data": {
                "execution": {
                    "transfer_request_id": "tr_plan",
                    "route_id": "route_1",
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
                    "handoff_instructions": "summary",
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
        self.assertEqual(data.get("status"), "transfer_connected")
        self.assertNotIn("execution", data)


@unittest.skipUnless(_LIVEKIT_AVAILABLE, "livekit not installed")
class TestBridgeTransferFailures(unittest.IsolatedAsyncioTestCase):
    def _telephony(self) -> LiveKitTelephonyBridge:
        job_ctx = MagicMock()
        job_ctx.room.name = "room_test"
        job_ctx.room.on = MagicMock()
        job_ctx.room.off = MagicMock()
        job_ctx.room.remote_participants = {}
        job_ctx.api.room.remove_participant = AsyncMock()
        job_ctx.add_shutdown_callback = MagicMock()
        return LiveKitTelephonyBridge(job_ctx=job_ctx, sip_participant_identity="caller-1"), job_ctx

    async def test_busy_restores_and_returns_busy(self) -> None:
        telephony, job_ctx = self._telephony()
        job_ctx.api.sip.create_sip_participant = AsyncMock(side_effect=RuntimeError("line busy"))
        context = MagicMock()
        context.session.current_speech = None
        context.session.input.audio = None
        context.session.output.audio = None

        with patch(
            "transovo_voice.voice_v3.livekit_bridge_transfer.BackgroundAudioPlayer",
        ) as player_cls:
            player = MagicMock()
            player.start = AsyncMock()
            player.play = MagicMock(return_value=MagicMock(stop=MagicMock()))
            player.aclose = AsyncMock()
            player_cls.return_value = player

            outcome = await execute_livekit_bridge_transfer(
                telephony,
                context,
                transfer_request_id="tr_busy",
                destination_id="dest_1",
                dial_target="+15551234567",
                ringing_timeout_seconds=20,
                sip_trunk_id="trunk_1",
                sip_number="+15550001111",
            )

        self.assertEqual(outcome, "BUSY")
        job_ctx.api.room.remove_participant.assert_awaited()

    async def test_caller_hangup_during_ring(self) -> None:
        telephony, job_ctx = self._telephony()

        async def slow_dial(_req: object) -> None:
            await asyncio.sleep(1.0)

        job_ctx.api.sip.create_sip_participant = AsyncMock(side_effect=slow_dial)

        with patch(
            "transovo_voice.voice_v3.livekit_bridge_transfer.BackgroundAudioPlayer",
        ) as player_cls:
            player = MagicMock()
            player.start = AsyncMock()
            player.play = MagicMock(return_value=MagicMock(stop=MagicMock()))
            player.aclose = AsyncMock()
            player_cls.return_value = player

            task = asyncio.create_task(
                execute_livekit_bridge_transfer(
                    telephony,
                    None,
                    transfer_request_id="tr_cancel",
                    destination_id="dest_1",
                    dial_target="+15551234567",
                    ringing_timeout_seconds=20,
                    sip_trunk_id="trunk_1",
                    sip_number="+15550001111",
                ),
            )
            await asyncio.sleep(0.02)
            for handler in job_ctx.room.on.call_args_list:
                if handler.args and handler.args[0] == "participant_disconnected":
                    cb = handler.args[1]
                    participant = MagicMock()
                    participant.identity = "caller-1"
                    cb(participant)
            outcome = await asyncio.wait_for(task, timeout=2.0)

        self.assertEqual(outcome, "CANCELLED")


if __name__ == "__main__":
    unittest.main()
