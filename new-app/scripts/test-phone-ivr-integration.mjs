#!/usr/bin/env node
/**
 * Phone ↔ Conversational IVR integration — policy compile, handoff helpers, mocked paths (no PSTN).
 */
import assert from "node:assert/strict";
import { readIntegratedRouting, integratedNoAnswerIsConversationalIvr } from "../lib/server/phone/ivr-integration/integrated-policy.ts";
import { compileVoiceV3TransferPolicyFromEditor } from "../lib/server/receptionist/compile-transfer-from-editor.ts";
import { defaultReceptionistEditorConfig } from "../lib/server/receptionist/defaults.ts";
import { authorizeVoiceV3Transfer } from "../lib/server/voice-v3/transfer/authorize-transfer.ts";
import { editorToVoiceV3AgentConfig } from "../lib/server/voice-v3/editor-to-voice-v3-config.ts";
import { parseFallbackJson } from "../lib/server/phone/routing/routing-logic.ts";
assert.equal(parseFallbackJson({ type: "conversational_ivr" })?.type, "conversational_ivr");

const integrated = readIntegratedRouting({
  integratedRouting: {
    answeringMode: "staff_then_ivr",
    staffThenIvr: { forwardingGroupId: "fg_1", ringTimeoutSec: 20 },
    noAnswerFallbackType: "conversational_ivr",
  },
});
assert.equal(integrated.answeringMode, "staff_then_ivr");
assert.ok(integratedNoAnswerIsConversationalIvr(integrated));

const editor = {
  ...defaultReceptionistEditorConfig(),
  connection: { kind: "owned", id: "phone_1" },
  capabilities: { ...defaultReceptionistEditorConfig().capabilities, transfer: true },
  conversationalRoutes: [
    {
      id: "sales",
      name: "Sales",
      description: "Sales team",
      intentDescription: "Pricing and quotes",
      examples: [],
      destinationRef: "fg_sales",
      destinationKind: "ring_group",
      destinationLabel: "Sales group",
      enabled: true,
      confirmBeforeTransfer: false,
    },
    {
      id: "billing",
      name: "Billing",
      description: "Billing",
      intentDescription: "Invoices",
      examples: [],
      destinationRef: "fd_bill",
      destinationKind: "forwarding_destination",
      destinationPhoneE164: "+15551234002",
      enabled: true,
      confirmBeforeTransfer: false,
    },
  ],
};

const policy = compileVoiceV3TransferPolicyFromEditor(editor);
assert.equal(policy.routes.length, 2);
const salesRoute = policy.routes.find((r) => r.id === "sales");
assert.ok(salesRoute);
const salesDest = policy.destinations.find((d) => d.id === "rg_fg_sales");
assert.equal(salesDest?.executor, "phone_ring_group");
assert.equal(salesDest?.forwardingGroupId, "fg_sales");

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

const voiceConfig = editorToVoiceV3AgentConfig({
  editor,
  workspaceId: "ws_test",
  knowledge: emptyKnowledge(),
});
const callContext = {
  callId: "call_integrated",
  liveSessionId: "lk_integrated",
  intake: { values: {} },
  telephony: { inboundCallerE164: "+15559876543" },
};
const authGroup = authorizeVoiceV3Transfer({
  config: voiceConfig,
  policy,
  callContext,
  args: { route_id: "sales", reason: "caller asked for estimate" },
});
assert.equal(authGroup.ok, true);
assert.equal(authGroup.data.execution.executor, "phone_ring_group");
assert.equal(authGroup.data.execution.targets[0]?.forwarding_group_id, "fg_sales");

const authPhone = authorizeVoiceV3Transfer({
  config: voiceConfig,
  policy,
  callContext,
  args: { route_id: "billing" },
});
assert.equal(authPhone.ok, true);
assert.equal(authPhone.data.execution.executor, "livekit_refer");
assert.ok(authPhone.data.execution.targets[0]?.dial_target);

console.log("test-phone-ivr-integration: PASS");
