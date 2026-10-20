from __future__ import annotations

import json
import unittest

from transovo_voice.session.dispatch_resolver import (
    PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY,
    build_bootstrap_from_snapshot,
    extract_call_numbers,
    resolve_dialed_e164_source,
    try_local_dispatch_bootstrap,
)


class DispatchResolverTests(unittest.TestCase):
    def test_extract_call_numbers_from_sip_attrs(self) -> None:
        from_e164, to_e164 = extract_call_numbers(
            {
                "sip.phoneNumber": "+15551234567",
                "sip.trunkPhoneNumber": "+18663464256",
            },
            None,
            "sip_abc",
        )
        self.assertEqual(from_e164, "+15551234567")
        self.assertEqual(to_e164, "+18663464256")

    def test_resolve_dialed_e164_source_prefers_trunk(self) -> None:
        source = resolve_dialed_e164_source(
            {"sip.trunkPhoneNumber": "+15717491685"},
            None,
        )
        self.assertEqual(source, "sip.trunkPhoneNumber")

    def test_local_dispatch_from_job_metadata_snapshot(self) -> None:
        snapshot = {
            "snapshotVersion": 1,
            "builtAt": "2026-01-01T00:00:00Z",
            "apiVersion": 1,
            "workspaceId": "ws_test",
            "agentId": "agent_test",
            "timezone": "America/New_York",
            "businessName": "ABC Plumbing",
            "runtimeProfile": "generic_receptionist",
            "agentTemplate": "livekit_frontdesk_booking",
            "agentTemplateVersion": "1",
            "runtime": "livekit_python",
            "receptionistCompiled": {
                "businessName": "ABC Plumbing",
                "greeting": "Hello",
                "fieldManifest": [],
                "capabilities": [],
                "enabledBuiltinTools": [],
            },
        }
        job_metadata = json.dumps(
            {
                "workspaceId": "ws_test",
                "agentId": "agent_test",
                "publishedVersionId": "ver_test",
                PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY: snapshot,
            },
        )
        bootstrap = try_local_dispatch_bootstrap(
            job_metadata=job_metadata,
            room_metadata=None,
            participant_attributes={},
            call_id="call_local_1",
            from_e164="+15551234567",
            to_e164="+18663464256",
        )
        self.assertIsNotNone(bootstrap)
        assert bootstrap is not None
        self.assertTrue(bootstrap["ok"])
        self.assertEqual(bootstrap["callId"], "call_local_1")
        self.assertEqual(bootstrap["bootstrapPath"], "dispatch_local")
        self.assertIsNone(bootstrap["sipOutboundTrunkId"])

    def test_build_bootstrap_from_snapshot_uses_predetermined_call_id(self) -> None:
        snapshot = {
            "snapshotVersion": 1,
            "apiVersion": 1,
            "workspaceId": "ws_test",
            "agentId": "agent_test",
            "timezone": "America/New_York",
            "businessName": "ABC Plumbing",
            "runtimeProfile": "generic_receptionist",
            "agentTemplate": "livekit_basic_voice",
        }
        bootstrap = build_bootstrap_from_snapshot(
            snapshot,
            call_id="predetermined-id",
            from_e164="+15551234567",
            to_e164="+18663464256",
        )
        self.assertEqual(bootstrap["callId"], "predetermined-id")


if __name__ == "__main__":
    unittest.main()
