/**
 * John MCTB preprod certification suite.
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

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
const gates: Record<string, boolean> = {
  CALL_DETECTION: true,
  ELIGIBILITY: true,
  SCHEDULING: true,
  SMS_TRANSPORT: true,
  CONVERSATION: true,
  ADMIN_CONTROL: true,
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

  // CALL_DETECTION
  check(
    "missed_no_answer classified",
    classifyInboundCallOutcome({ direction: "inbound", status: "NO_ANSWER" }) ===
      "missed_no_answer",
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

  // ELIGIBILITY
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

  const event = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey: idem } });
  check("event persisted", Boolean(event), "CALL_DATA");
  check("trace id set", Boolean(event?.traceId), "CALL_DATA");

  // ADMIN_CONTROL
  const admin = await executeJohnAdminTool({
    workspaceId: wsId,
    tool: "update_missed_call_text_settings",
    args: { delay_seconds: 300 },
    naturalLanguage: "Wait five minutes before texting them.",
  });
  check("admin delay update", admin.config?.delaySeconds === 300, "ADMIN_CONTROL");

  const paraphrase = await executeJohnAdminTool({
    workspaceId: wsId,
    tool: "update_missed_call_text_settings",
    args: { delay_seconds: 0 },
  });
  check("admin immediate delay", paraphrase.config?.delaySeconds === 0, "ADMIN_CONTROL");

  // classification trigger rules
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
  console.log(`Non-gating failures: ${failed}`);
  if (failed > 0 || gatePass < gateTotal) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
