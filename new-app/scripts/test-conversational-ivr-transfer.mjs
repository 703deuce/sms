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
      id: "route_bad_group",
      name: "Ring group (unsupported)",
      description: "",
      intentDescription: "Should be skipped at compile",
      examples: [],
      destinationRef: "rg_1",
      destinationKind: "ring_group",
      enabled: true,
      confirmBeforeTransfer: false,
    },
  ],
};

const policy = compileVoiceV3TransferPolicyFromEditor(editor);
assert.equal(policy.enabled, true, "policy should enable when routes have E.164");
assert.ok(policy.routes.some((r) => r.id === "route_sales"));
const salesDest = policy.destinations.find((d) => d.phoneE164 === "+15551234001");
assert.ok(salesDest, "sales route must compile to a dialable E.164 destination");
const ringDest = policy.destinations.find((d) => d.id === "ring_group_rg_1");
assert.ok(ringDest?.forwardingGroupId === "rg_1", "ring_group compiles to phone foundation, not raw E.164");

const publishBlocked = validateEditorForPublish(editor);
assert.equal(publishBlocked.ok, false);
assert.ok(
  publishBlocked.errors.some((e) => e.includes("Ring groups are not supported")),
);

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

// Link booking forces full_receptionist — Call Routing must still compile, not demo tr2.
const fullWithLink = {
  ...defaultReceptionistEditorConfig(),
  connection: { kind: "owned", id: "phone_test_1" },
  runtimeProfile: "full_receptionist",
  capabilities: {
    ...defaultReceptionistEditorConfig().capabilities,
    transfer: true,
    book: true,
    answer: true,
  },
  appointments: {
    ...defaultReceptionistEditorConfig().appointments,
    strategy: "link",
    provider: "none",
    bookingLink: "https://example.com/book",
  },
  conversationalRoutes: [
    {
      id: "route_billing",
      name: "Billing",
      description: "Billing department",
      intentDescription: "Caller wants to pay a bill or invoice.",
      examples: [],
      destinationRef: "fd_billing",
      destinationKind: "forwarding_destination",
      destinationPhoneE164: "+17038166017",
      destinationLabel: "Billing",
      enabled: true,
      confirmBeforeTransfer: false,
    },
  ],
};

const fullPolicy = compileVoiceV3TransferPolicyFromEditor(fullWithLink);
assert.ok(
  !fullPolicy.destinations.some((d) => d.id === "tr2"),
  "full_receptionist + link booking must not expose demo tr2 when Call Routing is configured",
);
assert.ok(
  fullPolicy.destinations.some((d) => d.phoneE164 === "+17038166017"),
  "billing E.164 must be in compiled destinations",
);

console.log("test-conversational-ivr-transfer: PASS");
