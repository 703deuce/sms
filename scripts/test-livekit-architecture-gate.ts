/**
 * Architecture refactor gate — LiveKit-native Realtor product invariants.
 * Run: npx tsx scripts/test-livekit-architecture-gate.ts
 */
import assert from "node:assert/strict";
import {
  assertLegacyWorkflowVoiceToolAllowed,
  isLegacyWorkflowVoicePathEnabled,
  LEGACY_WORKFLOW_VOICE_TOOL_TYPES,
} from "../src/lib/voice/architecture/legacy-voice-path";
import {
  isLegacyCallerAmyAgent,
  requiresLiveKitVoiceRuntime,
} from "../src/lib/voice/architecture/livekit-voice-profiles";
import {
  COMPILED_WORKFLOW_VISUAL_ROLE,
  workflowVisualizationMeta,
} from "../src/lib/voice/architecture/compiled-policy";
import { compileFrontDeskFromProductConfig } from "../src/lib/voice/real-estate/compile/compile-front-desk";
import { DEFAULT_REALTOR_PRODUCT_CONFIG } from "../src/lib/realtor/types";
import {
  buildExplicitDispatchMetadata,
  mergeExplicitDispatchMetadata,
} from "../src/lib/telephony/provisioning/dispatch-metadata";
import { FRONTDESK_REALTIME_PROFILE } from "../src/lib/voice/frontdesk/agent-config";
import fs from "node:fs";
import path from "node:path";

function readProjectFile(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`, err);
    process.exitCode = 1;
  }
}

check("legacy workflow tools blocked in production", () => {
  assert.equal(isLegacyWorkflowVoicePathEnabled(), false);
  assert.throws(() => assertLegacyWorkflowVoiceToolAllowed("continue_workflow"));
  assert.throws(() => assertLegacyWorkflowVoiceToolAllowed("runtime_turn"));
});

check("realtor frontdesk requires LiveKit runtime", () => {
  const compiled = compileFrontDeskFromProductConfig(DEFAULT_REALTOR_PRODUCT_CONFIG);
  const config = {
    advanced: {
      livekitProfile: FRONTDESK_REALTIME_PROFILE,
      realEstateFrontDesk: true,
      realEstateCompiled: compiled,
    },
  };
  assert.equal(requiresLiveKitVoiceRuntime(config), true);
  assert.equal(isLegacyCallerAmyAgent({ agentType: "receptionist", config }), false);
});

check("legacy caller amy still detectable without livekit profile", () => {
  assert.equal(isLegacyCallerAmyAgent({ agentType: "receptionist" }), true);
  assert.equal(isLegacyCallerAmyAgent({ agentType: "custom" }), false);
});

check("compiled workflow is visualization-only", () => {
  const compiled = compileFrontDeskFromProductConfig(DEFAULT_REALTOR_PRODUCT_CONFIG);
  assert.equal(compiled.workflowVisualization.role, COMPILED_WORKFLOW_VISUAL_ROLE);
  assert.equal(compiled.workflowVisualization.executableAtVoiceRuntime, false);
  assert.deepEqual(compiled.workflowVisualization, workflowVisualizationMeta());
});

check("explicit dispatch metadata merges with precedence", () => {
  const merged = mergeExplicitDispatchMetadata(
    buildExplicitDispatchMetadata({
      workspaceId: "ws1",
      agentId: "agent1",
      dispatchSource: "did_lookup",
      toE164: "+15551234567",
    }),
    {
      workspaceId: "ws1",
      agentId: "agentExplicit",
      publishedVersionId: "ver1",
      dispatchSource: "job_metadata",
    },
  );
  assert.equal(merged?.agentId, "agentExplicit");
  assert.equal(merged?.publishedVersionId, "ver1");
});

check("RE intake uses TaskGroup collect_required_fields", () => {
  const reTools = readProjectFile("voice-runtime/src/frontdesk/real-estate/re-tools.ts");
  const intake = readProjectFile("voice-runtime/src/frontdesk/real-estate/intake-task-group.ts");
  assert.ok(reTools.includes("collect_required_fields"));
  assert.ok(reTools.includes("runRealEstateIntakeTaskGroup"));
  assert.ok(!reTools.includes('name: "record_collected_field"'));
  assert.ok(!intake.includes("updateAgent(group)"), "intake must await group.run() without manual updateAgent");
});

check("booking uses EmailCollectionTask and LiveKit end call", () => {
  const booking = readProjectFile("voice-runtime/src/frontdesk/booking-tools.ts");
  assert.ok(booking.includes("runEmailCollectionTask"));
  assert.ok(booking.includes("buildEndCallToolset"));
});

check("legacy tool set is complete", () => {
  for (const tool of [
    "runtime_turn",
    "continue_workflow",
    "get_runtime_context",
    "get_workflow_requirements",
    "check_field_requirements",
  ]) {
    assert(LEGACY_WORKFLOW_VOICE_TOOL_TYPES.has(tool), tool);
  }
});

if (process.exitCode) {
  console.error("\nArchitecture gate FAILED");
  process.exit(1);
}
console.log("\nArchitecture gate passed.");
