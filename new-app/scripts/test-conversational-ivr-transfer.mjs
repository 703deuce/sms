#!/usr/bin/env node
/**
 * Conversational IVR transfer — compile, authorize, publish validation (no PSTN).
 */
import assert from "node:assert/strict";
import { defaultReceptionistEditorConfig } from "../lib/server/receptionist/defaults.ts";
import { compileVoiceV3TransferPolicyFromEditor } from "../lib/server/receptionist/compile-transfer-from-editor.ts";
import { validateEditorForPublish } from "../lib/server/receptionist/compile-runtime.ts";
import { editorToVoiceV3AgentConfig } from "../lib/server/voice-v3/editor-to-voice-v3-config.ts";
import { authorizeVoiceV3Transfer } from "../lib/server/voice-v3/transfer/authorize-transfer.ts";
import { buildAmyTransferInstructions } from "../lib/server/voice-v3/prompts/amy-transfer-instructions.ts";
import { isVoiceV3ToolAuthorizedBase } from "../lib/server/voice-v3/tools/authorize-tool-for-config.ts";

function emptyKnowledge() {
  return {
    knowledgeBaseIds: [],
    openaiVectorStoreIds: [],
    documentSourceIds: [],
    faqFacts: [],
    knowledgeItemSummaries: [],
    revision: "test",
  };
}

const editor = {
  ...defaultReceptionistEditorConfig(),
  connection: { kind: "owned", id: "phone_test_1" },
  capabilities: {
    ...defaultReceptionistEditorConfig().capabilities,
    transfer: true,
    answer: true,
  },
  conversationalRoutes: [
    {
      id: "route_sales",
      name: "Sales",
      description: "New customers, pricing, and quotes.",
      intentDescription: "Caller wants sales, pricing, or to buy.",
      examples: ["I want a quote", "Talk to sales"],
      destinationRef: "fd_1",
      destinationKind: "forwarding_destination",
      destinationPhoneE164: "+15551234001",
      destinationLabel: "Sales line",
      enabled: true,
      confirmBeforeTransfer: false,
    },
    {
      id: "route_sales_group",
      name: "Sales group",
      description: "Sales ring group",
      intentDescription: "Quotes",
      examples: [],
      destinationRef: "rg_1",
      destinationKind: "ring_group",
      enabled: true,
      confirmBeforeTransfer: false,
    },
  ],
};

const policy = compileVoiceV3TransferPolicyFromEditor(editor);
assert.equal(policy.enabled, true, "policy should enable when routes have targets");
assert.equal(policy.routes.length, 2, "individual + ring group routes compile");
assert.ok(policy.destinations.some((d) => d.executor === "phone_ring_group"));

const publishBlocked = validateEditorForPublish(editor);
assert.equal(publishBlocked.ok, true, JSON.stringify(publishBlocked.errors));

const editorClean = {
  ...editor,
  conversationalRoutes: editor.conversationalRoutes.filter((r) => r.id === "route_sales"),
};
const publish = validateEditorForPublish(editorClean);
assert.equal(publish.ok, true, JSON.stringify(publish));

const voiceConfig = editorToVoiceV3AgentConfig({
  editor: editorClean,
  workspaceId: "ws_test",
  knowledge: emptyKnowledge(),
});
assert.ok(isVoiceV3ToolAuthorizedBase(voiceConfig, "transfer_call"));

const amy = buildAmyTransferInstructions(voiceConfig);
assert.ok(amy.includes("route_id=route_sales"), "Live prompt must list semantic routes");

const callContext = {
  callId: "call_ivr_test",
  liveSessionId: "lk_test",
  intake: { values: {} },
  telephony: { inboundCallerE164: "+15559876543" },
};

const authorized = authorizeVoiceV3Transfer({
  config: voiceConfig,
  policy,
  callContext,
  args: { route_id: "route_sales", reason: "Caller asked for sales" },
});
assert.equal(authorized.ok, true);
const execution = authorized.data.execution;
assert.equal(execution.targets.length, 1);
assert.equal(execution.targets[0].dial_target, "+15551234001");
assert.equal(execution.targets[0].mode, "DIRECT");

const wrongRoute = authorizeVoiceV3Transfer({
  config: voiceConfig,
  policy,
  callContext,
  args: { route_id: "route_does_not_exist", reason: "test" },
});
assert.equal(wrongRoute.ok, false);

console.log("test-conversational-ivr-transfer: PASS");
