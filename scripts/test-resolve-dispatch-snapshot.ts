import assert from "node:assert/strict";
import {
  buildPythonRuntimeBootstrapSnapshot,
  PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY,
} from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import { buildExplicitDispatchMetadata } from "@/lib/telephony/provisioning/dispatch-metadata";
import type { VoiceAgentConfig } from "@/lib/voice/types";

const baseConfig = {
  identity: { displayName: "Amy" },
  advanced: {
    livekitAgentTemplate: "livekit_frontdesk_booking",
    receptionistCompiled: {
      businessName: "ABC Plumbing",
      agentDisplayName: "Amy",
      greeting: "Thanks for calling ABC Plumbing.",
      timezone: "America/New_York",
      capabilities: ["booking"],
      fieldManifest: [],
      enabledBuiltinTools: [],
      compiledPrompt: "",
      businessContext: "",
      compiledAt: new Date().toISOString(),
    },
  },
} as VoiceAgentConfig;

const snapshot = buildPythonRuntimeBootstrapSnapshot(baseConfig, {
  workspaceId: "ws_test",
  agentId: "agent_test",
  agentName: "Booking Agent",
});
assert.ok(snapshot);

const dispatch = buildExplicitDispatchMetadata({
  workspaceId: "ws_test",
  agentId: "agent_test",
  publishedVersionId: "ver_test",
  dispatchSource: "phone_provision",
  pythonRuntimeBootstrapSnapshot: snapshot,
  toE164: "+18663464256",
});

assert.ok(dispatch.pythonRuntimeBootstrapSnapshot);
assert.equal(dispatch.pythonRuntimeBootstrapSnapshot?.agentTemplate, "livekit_frontdesk_booking");

const jobMetadata = JSON.stringify({
  workspaceId: "ws_test",
  agentId: "agent_test",
  publishedVersionId: "ver_test",
  [PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY]: snapshot,
});

async function main() {
  const { resolveDispatchSnapshotForPython } = await import(
    "@/lib/voice/python-runtime-bridge/resolve-dispatch-snapshot"
  );

  const resolved = await resolveDispatchSnapshotForPython({
    jobMetadata,
    participantAttributes: {
      "sip.trunkPhoneNumber": "+18663464256",
      "sip.phoneNumber": "+15551234567",
    },
    fromE164: "+15551234567",
    toE164: "+18663464256",
  });

  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.bootstrapPath, "dispatch_local");
    assert.equal(resolved.workspaceId, "ws_test");
    assert.equal(resolved.agentId, "agent_test");
    assert.equal(resolved.sipOutboundTrunkId, null);
  }

  console.log("test-resolve-dispatch-snapshot: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
