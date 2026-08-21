import assert from "node:assert/strict";
import {
  PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY,
  attachPythonRuntimeBootstrapSnapshot,
  buildPythonRuntimeBootstrapSnapshot,
  getPythonRuntimeBootstrapSnapshot,
} from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import type { VoiceAgentConfig } from "@/lib/voice/types";

const baseConfig = {
  identity: { displayName: "Amy" },
  advanced: {
    livekitAgentTemplate: "livekit_frontdesk_booking",
    receptionistCompiled: {
      businessName: "ABC Plumbing",
      agentDisplayName: "Amy",
      greeting: "Thanks for calling ABC Plumbing. How can I help?",
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
assert.equal(snapshot?.agentTemplate, "livekit_frontdesk_booking");
assert.equal(snapshot?.businessName, "ABC Plumbing");
assert.equal(snapshot?.receptionistCompiled?.compiledPrompt, "");

const attached = attachPythonRuntimeBootstrapSnapshot(baseConfig, {
  workspaceId: "ws_test",
  agentId: "agent_test",
});
const loaded = getPythonRuntimeBootstrapSnapshot(
  attached.advanced as Record<string, unknown> | undefined,
);
assert.ok(loaded);
assert.equal(loaded?.workspaceId, "ws_test");
assert.equal(
  (attached.advanced as Record<string, unknown>)[PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY],
  loaded,
);

console.log("test-build-bootstrap-snapshot: ok");
