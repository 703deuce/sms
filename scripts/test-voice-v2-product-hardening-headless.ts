#!/usr/bin/env npx tsx
/**
 * Product hardening scenarios — uncertainty, human request, urgency, vendor, transfer fail.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-product-hardening-headless.ts
 */
import assert from "node:assert/strict";
import { AMY_V2_CORE_STATIC_PROMPT, ONE_AMY_V2_WORKFLOW_APPEND } from "../src/lib/voice-v2/one-amy/amy-core-static-prompt";
import { buildVoiceV2KnowledgeLayerBInstructions } from "../src/lib/voice-v2/knowledge-config";
import { buildVoiceV2AfterHoursLayerBInstructions } from "../src/lib/voice-v2/after-hours-handling-prompt";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { afterHoursHandlingFromWizard } from "../src/lib/voice-v2/after-hours-handling-config";
import { evaluateUrgencyForContext } from "../src/lib/voice-v2/urgency-evaluator";
import { applyAfterHoursEvaluations } from "../src/lib/voice-v2/after-hours-orchestrator";
import {
  inferCallerClassificationFromTranscriptSnippet,
  blocksCustomerBookingForClassification,
} from "../src/lib/voice-v2/spam-handling";
import { executeVoiceV2TransferPlan } from "../src/lib/voice-v2/transfer/transfer-executor";
import {
  MockVoiceV2TransferProvider,
  setMockTransferBehavior,
  clearMockTransferBehaviors,
} from "../src/lib/voice-v2/transfer/mock-transfer-provider";
import { setVoiceV2CallContext, clearVoiceV2CallSessions } from "../src/lib/voice-v2/intake/session-store";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import type { VoiceV2CallContext } from "../src/lib/voice-v2/intake/types";
import { buildReceptionistCompiledPrompt } from "../src/lib/voice/receptionist/build-receptionist-compiled-prompt";

function check(name: string, ok: boolean, detail = "") {
  console.log(ok ? `PASS ${name}` : `FAIL ${name} ${detail}`);
  assert.ok(ok, name);
}

async function main() {
// Prompt contracts
check("UNCERTAINTY_IN_CORE_PROMPT", AMY_V2_CORE_STATIC_PROMPT.includes("# UNCERTAINTY (HARD LIMIT)"));
check("HUMAN_REQUEST_IN_CORE_PROMPT", AMY_V2_CORE_STATIC_PROMPT.includes("# HUMAN REQUEST (HARD LIMIT)"));
check("HUMAN_IN_WORKFLOW_APPEND", ONE_AMY_V2_WORKFLOW_APPEND.includes("caller_requested_human"));

const kb = buildVoiceV2KnowledgeLayerBInstructions({
  advanced: {
    knowledge: { knowledgeBaseEnabled: true, knowledgeBaseIds: ["kb1"], knowledgeBaseRevision: "t" },
  },
} as never);
check(
  "KNOWLEDGE_NO_GUESS_PRICING",
  Boolean(kb && (kb.includes("do not guess pricing") || kb.includes("do not invent company-specific"))),
);

const w = applyWizardPreset(createDefaultWizardState(), "after_hours");
w.urgencyEnabled = true;
w.urgencyRules = [
  {
    id: "urgent_flood",
    fieldKey: "active_flooding",
    operator: "EQUALS",
    value: "true",
    severity: "URGENT",
    action: "TRANSFER",
    transferPlanId: "default_transfer_plan",
  },
];
w.voiceV2HumanTransferEnabled = true;
w.transferDestinationPhone = "+15551234567";
w.collectFields = [
  { id: "active_flooding", label: "Active flooding", enabled: true, required: false },
];
const config = afterHoursHandlingFromWizard(w)!;
const advanced = { voiceV2AfterHoursHandling: config };
const ahPrompt = buildVoiceV2AfterHoursLayerBInstructions({ advanced } as never);
check("AFTER_HOURS_OPERATIONAL_MODES", Boolean(ahPrompt?.includes("OPERATIONAL MODES")));
check("AFTER_HOURS_URGENCY_NOT_LLM", Boolean(ahPrompt?.includes("not by your guess")));

const defaultGreeting = createDefaultWizardState().openingGreeting;
check(
  "DEFAULT_GREETING_SHORT",
  defaultGreeting.includes("How can I help") && defaultGreeting.includes("Thanks for calling"),
);

// Panic / urgent — deterministic
clearVoiceV2CallSessions();
const schema = intakeSchemaFromWizardOnly({
  fields: {
    active_flooding: { enabled: true, requirementLevel: "OPTIONAL" },
  },
});
const ctx: VoiceV2CallContext = {
  sessionKey: "cc:prod-hard",
  workspaceId: "ws",
  agentId: "a",
  businessTimezone: "America/New_York",
  intakeSchema: schema,
  intakeState: {
    active_flooding: {
      value: "true",
      status: "CAPTURED",
      source: "CALLER",
      updatedAt: new Date().toISOString(),
    },
  },
  askedFields: {},
  compiledAt: new Date().toISOString(),
  capabilities: { afterHoursHandling: config },
};
setVoiceV2CallContext(ctx);
const urgent = evaluateUrgencyForContext(ctx, config);
check("PANIC_URGENT", urgent.status === "URGENT" && urgent.matchedRuleId === "urgent_flood");

// Ambiguous urgency — no rule match
const ctx2 = { ...ctx, intakeState: {} };
const normal = evaluateUrgencyForContext(ctx2, config);
check("AMBIGUOUS_URGENCY_NORMAL", normal.status === "NORMAL");

// Vendor solicitation
check(
  "VENDOR_CLASSIFICATION",
  inferCallerClassificationFromTranscriptSnippet("Hi we sell merchant services") === "VENDOR_SALES",
);
check(
  "VENDOR_BLOCKS_BOOKING",
  blocksCustomerBookingForClassification(
    { ...config, salesSolicitationEnabled: true, salesSolicitationAction: "DECLINE_POLITELY" },
    "VENDOR_SALES",
  ),
);

// Transfer failure → callback pending action
clearMockTransferBehaviors();
setMockTransferBehavior("inv-1", ["NO_ANSWER"]);
const transferCtx = applyAfterHoursEvaluations(ctx, config);
const provider = new MockVoiceV2TransferProvider();
const transferResult = await executeVoiceV2TransferPlan({
  ctx: transferCtx,
  config,
  provider,
  callControlId: "cc-test",
  planId: config.defaultTransferPlan?.id,
  invocationId: "inv-1",
  callerRequested: true,
});
check("TRANSFER_FAIL_NOT_OK", !transferResult.ok);

const compiledPrompt = buildReceptionistCompiledPrompt({
  livekitProfile: "frontdesk_realtime",
  businessName: "Test Co",
  agentDisplayName: "Amy",
  businessDescription: "Plumbing",
  greeting: w.openingGreeting,
  language: "en-US",
  timezone: "America/New_York",
  answerWhen: "after_hours",
  capabilities: [...w.capabilities],
  fieldManifest: [],
  voiceV2OneAmy: true,
  voiceV2AfterHoursInstructions: ahPrompt || undefined,
  enabledBuiltinTools: [],
  compiledPrompt: "",
  businessContext: "",
  realtimeModel: "[REDACTED]",
  realtimeOutputMode: "elevenlabs",
  ttsModel: "[REDACTED]",
  voiceId: "el:test:test",
  voiceSpeed: 1,
  compiledAt: new Date().toISOString(),
  conversationBehavior: {
    responseLength: "short",
    style: "professional",
    allowInterrupt: true,
    confirmImportantDetails: true,
    repeatWhenUncertain: false,
    avoidDuplicateQuestions: true,
    handleOutOfOrderAnswers: true,
    allowAcknowledgments: true,
    fillerSpeech: "natural",
    silenceRepromptSec: 5,
  },
});
check(
  "COMPILED_INCLUDES_AFTER_HOURS",
  compiledPrompt.includes("AFTER-HOURS OPERATIONAL MODES"),
);

console.log("\nALL_PRODUCT_HARDENING_TESTS_PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
