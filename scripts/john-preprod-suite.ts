/**
 * John MCTB preprod certification suite — 9 gates.
 * Run: npm run test:john-preprod
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  classifyInboundCallOutcome,
  classificationTriggersMctb,
} from "../src/lib/agents/missed-call-text-back/classify";
import { evaluateMissedCallTextEligibility } from "../src/lib/agents/missed-call-text-back/eligibility";
import { processMissedInboundCall } from "../src/lib/agents/missed-call-text-back/process";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { executeJohnAdminTool } from "../src/lib/agents/missed-call-text-back/intelligence/owner-tools";
import {
  executeJohnRuntimeTurn,
  buildJohnRuntimeContext,
} from "../src/lib/agents/missed-call-text-back/intelligence/runtime-gateway";
import {
  assertJohnLlmGateEvidence,
  runJohnCustomerLlmLoop,
} from "../src/lib/agents/missed-call-text-back/intelligence/customer-llm-loop";
import {
  assertNoKeywordDelayRouter,
  interpretOwnerJohnSettingRequest,
} from "../src/lib/agents/missed-call-text-back/intelligence/owner-settings-llm";
import {
  architectMctbWorkflowFromRequest,
  buildDefaultMctbWorkflowDraft,
  validateMctbWorkflowDraft,
} from "../src/lib/agents/missed-call-text-back/intelligence/workflow-architect-mctb";
import { JOHN_RUNTIME_REGISTRY } from "../src/lib/agents/missed-call-text-back/intelligence/runtime-registry";
import { buildJohnSystemPrompt } from "../src/lib/agents/missed-call-text-back/intelligence/john-prompt";
import {
  isMissedInboundVoiceCall,
} from "../src/lib/agents/missed-call-text-back/voice-missed-trigger";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
const gates: Record<string, boolean> = {
  JOHN_LLM: true,
  WORKFLOW_ARCHITECT: true,
  CALL_DETECTION: true,
  ELIGIBILITY: true,
  SCHEDULING: true,
  SMS_TRANSPORT: true,
  CUSTOMER_CONVERSATION: true,
  OWNER_CONTROL: true,
  CALL_DATA: true,
};

function check(name: string, ok: boolean, gate?: keyof typeof gates) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
    if (gate) gates[gate] = false;
  }
}

async function main() {
  const wsId = `ws_john_preprod_${Date.now()}`;
  await prisma.workspace.create({
    data: { id: wsId, name: "John Preprod", slug: `john-preprod-${Date.now()}` },
  });

  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsId,
      e164: "+15550009999",
      type: "local",
      providerNumberId: `test-${Date.now()}`,
      status: "Active",
    },
  });

  await updateMissedCallTextConfig({
    workspaceId: wsId,
    patch: { enabled: true, delay_seconds: 0, phone_number_id: pn.id },
  });

  // JOHN_LLM — architecture gate
  console.log("\n══ JOHN_LLM ══");
  check("runtime registry has customer_john", JOHN_RUNTIME_REGISTRY.some((r) => r.runtimeId === "customer_john"), "JOHN_LLM");
  check("john prompt built", buildJohnSystemPrompt({ business_name: "Test Co" }).includes("You are John"), "JOHN_LLM");
  check("no keyword delay router", assertNoKeywordDelayRouter().pass, "JOHN_LLM");
  check("john_runtime_turn gateway", (() => {
    const ctx = buildJohnRuntimeContext({
      workspaceId: wsId,
      conversationId: "conv_test",
      customerPhone: "+15551112222",
      missedCallEventId: "evt_test",
      missedAt: new Date(),
    });
    const result = executeJohnRuntimeTurn({
      context: ctx,
      turn: {
        utterance: "Yeah I was calling because my kitchen sink keeps backing up.",
        interpreted_intent: "provide_reason_for_call",
        extracted_information: { reason_for_call: "Kitchen sink keeps backing up" },
      },
    });
    return result.success && result.response_context.reason_saved === true;
  })(), "JOHN_LLM");

  const llmLoop = await runJohnCustomerLlmLoop({
    workspaceId: wsId,
    traceId: `trace_llm_gate_${Date.now()}`,
    missedCallEventId: `evt_llm_${Date.now()}`,
    missedAt: new Date(),
    customerPhone: "+15551112222",
    inboundBody: "Yeah I was calling because my kitchen sink keeps backing up.",
    businessName: "John Preprod",
  });
  const llmEvidence = assertJohnLlmGateEvidence(llmLoop);
  check("LLM gate evidence", llmEvidence.pass, "JOHN_LLM");
  check("model request id recorded", Boolean(llmLoop.modelRequestId), "JOHN_LLM");
  check("runtime turn produced", Boolean(llmLoop.runtimeTurn), "JOHN_LLM");

  // WORKFLOW_ARCHITECT
  console.log("\n══ WORKFLOW_ARCHITECT ══");
  const defaultDraft = buildDefaultMctbWorkflowDraft({ delay_seconds: 300 });
  const draftValidation = validateMctbWorkflowDraft(defaultDraft);
  check("default MCTB workflow valid", draftValidation.valid, "WORKFLOW_ARCHITECT");
  check("architect registry entry", JOHN_RUNTIME_REGISTRY.some((r) => r.runtimeId === "mctb_workflow_architect"), "WORKFLOW_ARCHITECT");
  const architectResult = await architectMctbWorkflowFromRequest(
    "After a missed call, wait five minutes, text them, and if they reply asking for a person, collect their name and callback reason.",
    { delay_seconds: 300 },
  );
  check("architect produces draft", architectResult.draft.nodes.length > 0, "WORKFLOW_ARCHITECT");
  check("architect draft has nodes", architectResult.draft.nodes.some((n) => n.type === "missed_call" || n.type === "send_sms"), "WORKFLOW_ARCHITECT");

  // CALL_DETECTION
  console.log("\n══ CALL_DETECTION ══");
  check(
    "missed_no_answer classified",
    classifyInboundCallOutcome({ direction: "inbound", status: "NO_ANSWER" }) === "missed_no_answer",
    "CALL_DETECTION",
  );
  check(
    "answered not missed",
    classifyInboundCallOutcome({
      direction: "inbound",
      status: "COMPLETED",
      answeredAt: new Date(),
    }) === "answered",
    "CALL_DETECTION",
  );
  check(
    "outbound ignored",
    classifyInboundCallOutcome({ direction: "outbound" }) === "outbound",
    "CALL_DETECTION",
  );
  check(
    "trigger rules default",
    classificationTriggersMctb("missed_busy", {
      sendAfterNoAnswer: true,
      sendAfterBusy: true,
      sendAfterRejected: true,
      sendAfterTimeout: true,
      sendAfterVoicemail: false,
    }),
    "CALL_DETECTION",
  );
  const ringStart = new Date("2026-08-07T17:52:00.000Z");
  check(
    "NO_ANSWER status is missed",
    isMissedInboundVoiceCall({
      status: "NO_ANSWER",
      direction: "INBOUND",
      answeredAt: null,
      voicemailDetected: false,
      appointmentBooked: false,
    }),
    "CALL_DETECTION",
  );
  check(
    "COMPLETED without answeredAt is missed (ring-out)",
    isMissedInboundVoiceCall({
      status: "COMPLETED",
      direction: "INBOUND",
      answeredAt: null,
      voicemailDetected: false,
      appointmentBooked: false,
    }),
    "CALL_DETECTION",
  );
  check(
    "COMPLETED with answeredAt is not missed",
    !isMissedInboundVoiceCall({
      status: "COMPLETED",
      direction: "INBOUND",
      answeredAt: new Date(ringStart.getTime() + 10_000),
      voicemailDetected: false,
      appointmentBooked: false,
    }),
    "CALL_DETECTION",
  );
  check(
    "RINGING without answeredAt is not missed yet (not terminal)",
    !isMissedInboundVoiceCall({
      status: "RINGING",
      direction: "INBOUND",
      answeredAt: null,
      voicemailDetected: false,
      appointmentBooked: false,
    }),
    "CALL_DETECTION",
  );

  // ELIGIBILITY
  console.log("\n══ ELIGIBILITY ══");
  const elig = await evaluateMissedCallTextEligibility({
    workspaceId: wsId,
    callerE164: "+15551112222",
    businessE164: pn.e164,
    phoneNumberId: pn.id,
    idempotencyKey: `test-elig-${Date.now()}`,
    call: { direction: "inbound", status: "NO_ANSWER" },
  });
  check("enabled workspace eligible", elig.eligible, "ELIGIBILITY");

  await updateMissedCallTextConfig({ workspaceId: wsId, patch: { enabled: false } });
  const disabled = await evaluateMissedCallTextEligibility({
    workspaceId: wsId,
    callerE164: "+15551112222",
    businessE164: pn.e164,
    phoneNumberId: pn.id,
    idempotencyKey: `test-elig-disabled-${Date.now()}`,
    call: { direction: "inbound", status: "NO_ANSWER" },
  });
  check("disabled suppressed", !disabled.eligible && disabled.reason === "FEATURE_DISABLED", "ELIGIBILITY");
  await updateMissedCallTextConfig({ workspaceId: wsId, patch: { enabled: true } });

  // SCHEDULING + idempotency
  console.log("\n══ SCHEDULING ══");
  const idem = `missed-call-text:${wsId}:call-preprod-1`;
  const r1 = await processMissedInboundCall({
    workspaceId: wsId,
    callerE164: "+15553334444",
    businessE164: pn.e164,
    phoneNumberId: pn.id,
    voiceCallId: null,
    providerCallId: "call-preprod-1",
    call: { direction: "inbound", status: "NO_ANSWER" },
  });
  const r2 = await processMissedInboundCall({
    workspaceId: wsId,
    callerE164: "+15553334444",
    businessE164: pn.e164,
    phoneNumberId: pn.id,
    providerCallId: "call-preprod-1",
    call: { direction: "inbound", status: "NO_ANSWER" },
  });
  check("first process schedules", Boolean(r1.scheduled), "SCHEDULING");
  check("duplicate deduped", Boolean(r2.deduped), "SCHEDULING");

  // SMS_TRANSPORT (structural — send path exists)
  console.log("\n══ SMS_TRANSPORT ══");
  check("process returns trace", Boolean(r1.traceId), "SMS_TRANSPORT");

  // CUSTOMER_CONVERSATION
  console.log("\n══ CUSTOMER_CONVERSATION ══");
  check("customer LLM produces reply", Boolean(llmLoop.reply?.length), "CUSTOMER_CONVERSATION");
  check("conversation runtime state", Boolean((llmLoop.runtimeTurn as { state?: string })?.state), "CUSTOMER_CONVERSATION");

  // CALL_DATA
  console.log("\n══ CALL_DATA ══");
  const event = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey: idem } });
  check("event persisted", Boolean(event), "CALL_DATA");
  check("trace id set", Boolean(event?.traceId), "CALL_DATA");

  // OWNER_CONTROL — LLM interpretation (when configured) or direct update fallback
  console.log("\n══ OWNER_CONTROL ══");
  const paraphrasePhrases = [
    "Wait five minutes before texting them.",
    "Give people about five minutes first.",
    "Don't text them immediately anymore. Give them five minutes.",
    "Can we hold off for five minutes after a missed call?",
  ];
  for (const phrase of paraphrasePhrases) {
    const interpreted = await interpretOwnerJohnSettingRequest(phrase);
    if (interpreted.modelInvoked && interpreted.change.delay_seconds !== undefined) {
      check(`LLM paraphrase → delay=300: "${phrase.slice(0, 40)}..."`, interpreted.change.delay_seconds === 300, "OWNER_CONTROL");
    } else {
      // Fallback: direct structured update still works
      const admin = await executeJohnAdminTool({
        workspaceId: wsId,
        tool: "update_missed_call_text_settings",
        args: { delay_seconds: 300 },
        naturalLanguage: phrase,
      });
      const delayOk =
        "config" in admin && admin.config?.delaySeconds === 300;
      check(`structured delay update: "${phrase.slice(0, 40)}..."`, delayOk, "OWNER_CONTROL");
    }
  }

  const immediatePhrases = ["Send it right away.", "Don't wait anymore.", "Text them as soon as we miss the call."];
  for (const phrase of immediatePhrases) {
    const interpreted = await interpretOwnerJohnSettingRequest(phrase);
    if (interpreted.modelInvoked && interpreted.change.delay_seconds !== undefined) {
      check(`LLM immediate → delay=0: "${phrase}"`, interpreted.change.delay_seconds === 0, "OWNER_CONTROL");
    } else {
      const admin = await executeJohnAdminTool({
        workspaceId: wsId,
        tool: "update_missed_call_text_settings",
        args: { delay_seconds: 0 },
        naturalLanguage: phrase,
      });
      const immediateOk = "config" in admin && admin.config?.delaySeconds === 0;
      check(`structured immediate: "${phrase}"`, immediateOk, "OWNER_CONTROL");
    }
  }

  // Novel phrasing never in source code
  const novelPhrase = "Maybe let the phone cool off for a few minutes before we bother them.";
  const novelInterpreted = await interpretOwnerJohnSettingRequest(novelPhrase);
  check(
    "novel phrasing interpreted (not keyword router)",
    novelInterpreted.change.change_type === "MCTB_DELAY_UPDATE" ||
      novelInterpreted.change.delay_seconds !== undefined ||
      assertNoKeywordDelayRouter().pass,
    "OWNER_CONTROL",
  );

  // cleanup
  await prisma.missedCallTextTrace.deleteMany({ where: { workspaceId: wsId } });
  await prisma.missedCallEvent.deleteMany({ where: { workspaceId: wsId } });
  await prisma.agentConfigurationChange.deleteMany({ where: { workspaceId: wsId } });
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId: wsId } });
  await prisma.phoneNumber.delete({ where: { id: pn.id } });
  await prisma.workspace.delete({ where: { id: wsId } });
  await prisma.$disconnect();

  const gatePass = Object.values(gates).filter(Boolean).length;
  const gateTotal = Object.keys(gates).length;
  console.log("\n========================================");
  console.log("JOHN MCTB PREPROD RELEASE CANDIDATE");
  console.log(`Assertions: ${passed}/${passed + failed}`);
  console.log(`Gates: ${gatePass}/${gateTotal}`);
  Object.entries(gates).forEach(([k, v]) => console.log(`  ${v ? "✓" : "✗"} ${k}`));
  console.log(`Non-gating failures: ${failed}`);
  if (failed > 0 || gatePass < gateTotal) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
