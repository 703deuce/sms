#!/usr/bin/env npx tsx
/**
 * Voice V3 transfer system — compiler, authorize, publish validation, tool schema (no PSTN).
 */
import assert from "node:assert/strict";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { buildTransferCallOpenAiTool } from "../src/lib/voice-v3/tools/transfer-call-tool";
import { TRANSFER_CALL_TOOL_DESCRIPTION } from "../src/lib/voice-v3/tools/astra-tool-contracts";
import { authorizeVoiceV3Transfer } from "../src/lib/voice-v3/transfer/authorize-transfer";
import { compileVoiceV3TransferPolicyFromWizard } from "../src/lib/voice-v3/transfer/compile-transfer-config";
import { buildWarmTransferHandoffInstructions } from "../src/lib/voice-v3/transfer/build-handoff-summary";
import { validateVoiceV3TransferPolicyForPublish } from "../src/lib/voice-v3/transfer/validate-transfer-publish";
import { buildAstraTransferInstructions } from "../src/lib/voice-v3/prompts/astra-transfer-instructions";
import { buildAmyTransferInstructions } from "../src/lib/voice-v3/prompts/amy-transfer-instructions";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import type { VoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";

function baseWizard(overrides: Partial<AppointmentReceptionistWizardState> = {}): AppointmentReceptionistWizardState {
  return {
    capabilities: ["transfer_calls", "answer_questions"],
    answerWhen: "every_call",
    transferDestinations: [
      { id: "sales", label: "Sales", phoneE164: "+15559876543", enabled: true },
      { id: "ops", label: "Operations", phoneE164: "+15550001111", enabled: true },
    ],
    transferRouting: "waterfall",
    transferPlanSteps: [
      { order: 1, destinationId: "sales", transferMode: "BASIC", timeoutSeconds: 20 },
      { order: 2, destinationId: "ops", transferMode: "WARM", timeoutSeconds: 25 },
    ],
    transferRingSeconds: 30,
    transferFallback: "take_message",
    warmTransfer: false,
    voiceV2HumanTransferEnabled: true,
    transferDestinationPhone: "",
    transferDestinationName: "",
    agentName: "Amy",
    businessName: "Test Co",
    ...overrides,
  } as AppointmentReceptionistWizardState;
}

function minimalCallContext(): VoiceV3CallContext {
  return {
    callId: "call_test",
    liveSessionId: "lk_test",
    intake: {
      values: {
        name: { value: "Jane Doe" },
        custom_secret: { value: "should not appear in handoff" },
      },
    },
    telephony: { inboundCallerE164: "+15551234567" },
  } as VoiceV3CallContext;
}

function run(): void {
  const wizard = baseWizard();
  const policy = compileVoiceV3TransferPolicyFromWizard(wizard);
  assert.equal(policy.enabled, true);
  assert.equal(policy.routing, "waterfall");
  assert.equal(policy.routes[0]?.targets.length, 2);
  assert.equal(policy.routes[0]?.targets[0]?.mode, "DIRECT");
  assert.equal(policy.routes[0]?.targets[1]?.mode, "WARM");

  const publishIssues = validateVoiceV3TransferPolicyForPublish(policy, true);
  assert.equal(publishIssues.length, 0, `unexpected publish issues: ${JSON.stringify(publishIssues)}`);

  const warmPolicy = {
    ...policy,
    telephony: { outboundSipTrunkId: null, outboundCallerIdE164: null },
  };
  const warmIssues = validateVoiceV3TransferPolicyForPublish(warmPolicy, true);
  assert.ok(
    warmIssues.some((i) => i.id === "transfer_warm_no_trunk"),
    "warm transfer without trunk should block publish",
  );

  const config = compileVoiceV3AgentConfig({ wizard });
  assert.ok(config.transfer?.enabled);
  assert.equal(config.transfer?.routes[0]?.targets.length, 2);

  const openAiTool = buildTransferCallOpenAiTool(config);
  assert.equal(openAiTool.name, "transfer_call");
  const params = openAiTool.parameters as { properties?: Record<string, unknown> };
  assert.ok(params.properties?.route_id);
  assert.ok(params.properties?.destination_id);
  assert.match(TRANSFER_CALL_TOOL_DESCRIPTION, /route_id/);
  assert.match(TRANSFER_CALL_TOOL_DESCRIPTION, /Do not invent phone numbers/);

  const authorized = authorizeVoiceV3Transfer({
    config,
    policy: config.transfer!,
    callContext: minimalCallContext(),
    args: { route_id: config.transfer!.routes[0].id, reason: "Caller asked for sales" },
  });
  assert.equal(authorized.ok, true);
  if (!authorized.ok) throw new Error("expected ok");
  const data = authorized.data as { execution: { targets: unknown[] }; surface: { status: string } };
  assert.equal(data.surface.status, "transfer_authorized");
  assert.equal(data.execution.targets.length, 2);
  const first = data.execution.targets[0] as { dial_target: string; mode: string };
  assert.equal(first.mode, "DIRECT");
  assert.match(first.dial_target, /^\+/);

  const singleDest = authorizeVoiceV3Transfer({
    config,
    policy: config.transfer!,
    callContext: minimalCallContext(),
    args: { destination_id: "ops", reason: null },
  });
  assert.equal(singleDest.ok, true);
  if (!singleDest.ok) throw new Error("expected ok");
  const singleData = singleDest.data as { execution: { targets: { destination_id: string }[] } };
  assert.equal(singleData.execution.targets.length, 1);
  assert.equal(singleData.execution.targets[0].destination_id, "ops");

  const handoff = buildWarmTransferHandoffInstructions({
    businessName: "Test Co",
    agentName: "Amy",
    reason: "billing question",
    callContext: minimalCallContext(),
  });
  assert.match(handoff, /Jane Doe/);
  assert.ok(!handoff.includes("custom_secret"));
  assert.ok(!handoff.includes("should not appear"));

  const astra = buildAstraTransferInstructions(config);
  assert.match(astra, /destination_id=sales/);
  const amy = buildAmyTransferInstructions(config);
  assert.match(amy, /warm transfer/i);

  const singleWizard = baseWizard({
    transferRouting: "single",
    transferPlanSteps: [
      { order: 1, destinationId: "sales", transferMode: "BASIC", timeoutSeconds: 15 },
      { order: 2, destinationId: "ops", transferMode: "BASIC", timeoutSeconds: 15 },
    ],
  });
  const singlePolicy = compileVoiceV3TransferPolicyFromWizard(singleWizard);
  assert.equal(singlePolicy.routes[0]?.targets.length, 1);

  console.log("VOICE_V3_TRANSFER_SYSTEM_CERT: PASS");
}

run();
