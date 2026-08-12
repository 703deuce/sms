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
import { TEMPLATE_BUYER_FIELDS } from "../src/lib/voice/real-estate/templates/definitions";
import { heuristicIntakeExtractions } from "../src/lib/voice/real-estate/intake-memory";
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

check("intake memory maps bundled buyer answers", () => {
  const results = heuristicIntakeExtractions(
    ["I'm looking in Dale City for a townhouse around 400k and I need a garage"],
    TEMPLATE_BUYER_FIELDS,
    {},
  );
  const ids = results.map((r) => r.fieldId);
  assert.ok(ids.includes("target_areas"), `expected target_areas in ${ids.join(",")}`);
  assert.ok(ids.includes("property_type"), `expected property_type in ${ids.join(",")}`);
  assert.ok(ids.includes("budget_or_price_range"), `expected budget in ${ids.join(",")}`);
  assert.ok(ids.includes("must_have_features"), `expected must_have_features in ${ids.join(",")}`);
});

check("intake memory separates financing from timeframe", () => {
  const results = heuristicIntakeExtractions(
    ["I have my own financing and we're hoping to buy ASAP"],
    TEMPLATE_BUYER_FIELDS,
    {},
  );
  const ids = results.map((r) => r.fieldId);
  assert.ok(ids.includes("financing_status"), `expected financing_status in ${ids.join(",")}`);
  assert.ok(ids.includes("purchase_timeframe"), `expected purchase_timeframe in ${ids.join(",")}`);
});

check("seller notify intents require contact follow-up fields", () => {
  const { missingContactFollowUpFields } = require("../src/lib/voice/real-estate/fields");
  const missing = missingContactFollowUpFields(["seller"], {}, null);
  const ids = missing.map((f: { field_id: string }) => f.field_id);
  assert.ok(ids.includes("preferred_contact_method"), `expected preferred_contact_method in ${ids.join(",")}`);
  assert.ok(ids.includes("email"), `expected email in ${ids.join(",")}`);
});

check("OpenAI Realtime filters agent_handoff from chat context", () => {
  const adapter = readProjectFile("voice-runtime/src/realtime-openai-chat-context.ts");
  const pipeline = readProjectFile("voice-runtime/src/pipeline.ts");
  assert.ok(adapter.includes("excludeHandoff: true"));
  assert.ok(adapter.includes("excludeConfigUpdate: true"));
  assert.ok(adapter.includes("wrapRealtimeModelForOpenAI"));
  assert.ok(pipeline.includes("wrapRealtimeModelForOpenAI"));
});

check("field transition bridge is non-interactive", () => {
  const bridge = readProjectFile("src/lib/voice/field-transition-bridge.ts");
  const schemaTask = readProjectFile("voice-runtime/src/tasks/schema-field-collection-task.ts");
  const compile = readProjectFile("src/lib/voice/real-estate/compile/compile-instructions.ts");
  assert.ok(bridge.includes("Only the entering field task"));
  assert.ok(schemaTask.includes("FIELD_TRANSITION_BRIDGE_RULES"));
  assert.ok(schemaTask.includes("record_schema_field_value immediately without speaking"));
  assert.ok(compile.includes("FIELD_TRANSITION_BRIDGE_RULES"));
});

check("task transition instrumentation and end call playout", () => {
  const transition = readProjectFile("voice-runtime/src/task-transition-instrumentation.ts");
  const endCall = readProjectFile("voice-runtime/src/frontdesk/end-frontdesk-call.ts");
  const booking = readProjectFile("voice-runtime/src/frontdesk/booking-tools.ts");
  assert.ok(transition.includes("task_transition_latency"));
  assert.ok(endCall.includes("goodbye_playout_finished"));
  assert.ok(endCall.includes("waitForFrontDeskGoodbyePlayout"));
  assert.ok(booking.includes("buildFrontDeskEndCallToolset"));
});

check("frontdesk inbound uses safer realtime VAD", () => {
  const pipeline = readProjectFile("voice-runtime/src/pipeline.ts");
  const inbound = readProjectFile("voice-runtime/src/inbound-session-pipeline.ts");
  const turnCfg = readProjectFile("voice-runtime/src/realtime-turn-config.ts");
  const turnHandling = readProjectFile("voice-runtime/src/frontdesk-realtime-turn-handling.ts");
  const latency = readProjectFile("voice-runtime/src/latency-instrumentation.ts");
  assert.ok(pipeline.includes("resolveFrontDeskInboundRealtimeTurnDetection"));
  assert.ok(pipeline.includes("wrapRealtimeModelForOpenAI"));
  assert.ok(pipeline.includes("inputAudioNoiseReduction"));
  assert.ok(inbound.includes("frontdeskInbound: true"));
  assert.ok(inbound.includes("buildFrontDeskRealtimeTurnHandling"));
  assert.ok(inbound.includes("aecWarmupDuration: 3000"));
  assert.ok(turnCfg.includes("resolveFrontDeskInboundRealtimeTurnDetection"));
  assert.match(turnCfg, /threshold: parseNumberEnv\(process\.env\.VOICE_REALTIME_VAD_THRESHOLD, 0\.65\)/);
  assert.ok(turnHandling.includes("turnDetection: null"));
  assert.ok(turnHandling.includes("resumeFalseInterruption: true"));
  assert.ok(turnHandling.includes("minDuration: parseNumberEnv(process.env.VOICE_INTERRUPTION_MIN_DURATION_MS, 650)"));
  assert.ok(latency.includes("user_speech_started"));
  assert.ok(latency.includes("agent_interrupted"));
  assert.ok(latency.includes("suspected_false_interruption"));
  assert.ok(latency.includes("false_interruption"));
  assert.ok(latency.includes("agent_resumed"));
});

check("intake scripted speech uses caller-facing questions", () => {
  const transitionSpeech = readProjectFile("voice-runtime/src/intake-transition-speech.ts");
  const spokenPrompts = readProjectFile("src/lib/voice/real-estate/field-spoken-prompts.ts");
  assert.ok(transitionSpeech.includes("callerFacingFieldQuestion"));
  assert.ok(spokenPrompts.includes("target_areas"));
  assert.ok(spokenPrompts.includes("What neighborhoods or cities"));
  assert.ok(!transitionSpeech.includes("collection_instruction"));
});

check("RE intake uses single IntakeSequenceCollectionTask", () => {
  const reTools = readProjectFile("voice-runtime/src/frontdesk/real-estate/re-tools.ts");
  const intake = readProjectFile("voice-runtime/src/frontdesk/real-estate/intake-task-group.ts");
  const sequenceTask = readProjectFile(
    "voice-runtime/src/frontdesk/real-estate/intake-sequence-collection-task.ts",
  );
  const transitionSpeech = readProjectFile("voice-runtime/src/intake-transition-speech.ts");
  const scriptedSpeech = readProjectFile("voice-runtime/src/outbound/scripted-speech.ts");
  const taskCtx = readProjectFile("voice-runtime/src/tasks/task-context.ts");
  const intakeMemory = readProjectFile("src/lib/voice/real-estate/intake-memory.ts");
  assert.ok(reTools.includes("collect_required_fields"));
  assert.ok(reTools.includes("startIntakeSequenceFromTools"));
  assert.ok(reTools.includes("TOOL_RESULT_SET_INTENT_SILENT"));
  assert.ok(!reTools.includes('name: "record_collected_field"'));
  assert.ok(intake.includes("runIntakeSequenceCollectionTask"));
  assert.ok(!intake.includes("workflows.TaskGroup"));
  assert.ok(intake.includes("applyHeuristicIntakeBackfill"));
  assert.ok(intake.includes("backfillIntakeFromConversation"));
  assert.ok(sequenceTask.includes("record_schema_field_value"));
  assert.ok(sequenceTask.includes("speakIntakeTransitionLine"));
  assert.ok(sequenceTask.includes("applyHeuristicIntakeBackfill"));
  assert.ok(transitionSpeech.includes("deliverScriptedSpeech"));
  assert.ok(scriptedSpeech.includes("waitForPlayout"));
  assert.ok(intakeMemory.includes("backfillIntakeFromConversation"));
  assert.ok(taskCtx.includes("sessionUsesRealtimeLlm"));
});

check("booking uses EmailCollectionTask and LiveKit end call", () => {
  const booking = readProjectFile("voice-runtime/src/frontdesk/booking-tools.ts");
  const emailTask = readProjectFile("voice-runtime/src/frontdesk/email-collection-task.ts");
  const bridge = readProjectFile("voice-runtime/src/task-async-work-bridge.ts");
  assert.ok(booking.includes("runEmailCollectionTask"));
  assert.ok(booking.includes("buildFrontDeskEndCallToolset"));
  assert.ok(booking.includes("runAsyncWorkWithBridge"));
  assert.ok(emailTask.includes("speakBeforeTaskHandoff"));
  assert.ok(bridge.includes("runAsyncWorkWithBridge"));
  assert.ok(bridge.includes("speakBeforeTaskHandoff"));
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
