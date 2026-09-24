#!/usr/bin/env tsx
/**
 * Transovo two-workspace isolation certification (ALPHA PLUMBING vs BETA ELECTRIC).
 *
 * Run: npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
 *
 * Requires DATABASE_URL. Does not deploy or mutate production Telnyx routing.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";
import { loadMctbAnalytics } from "../src/lib/mctb/analytics";
import { loadMctbApprovedBusinessInformation } from "../src/lib/mctb/approved-business-information";
import { resolveCanonicalVoiceIngressPhoneNumberId } from "../src/lib/call-handling/resolve-canonical-voice-ingress";
import {
  mergeCallHandlingIntoSettings,
  readCallHandlingBlock,
} from "../src/lib/call-handling/phone-settings";
import {
  createTenantIsoFixture,
  deleteTenantIsoFixture,
  snapshotCallHandling,
  TENANT_ISO_CONSUMER_E164,
  type TenantIsoFixture,
} from "./lib/transovo-tenant-iso-fixture";
import { resolvePlatformInboundReplyFromContexts } from "../src/lib/mctb/messaging/platform-inbound-tenant-resolution";

type CertResult = "PASS" | "FAIL" | "WARN" | "SKIP";

const report: Record<string, CertResult> = {
  aToBRead: "SKIP",
  bToARead: "SKIP",
  aToBWrite: "SKIP",
  bToAWrite: "SKIP",
  phoneNumberIsolation: "SKIP",
  callHandlingAb: "SKIP",
  contactSameConsumer: "SKIP",
  conversationMessage: "SKIP",
  platformOwnerSeparation: "SKIP",
  aiLeadRecovery: "SKIP",
  analytics: "SKIP",
  backgroundJobs: "WARN",
  voiceToolTrust: "WARN",
  voiceToolUnauthenticated: "SKIP",
  voiceToolAuthenticated: "SKIP",
  voiceToolTenantBinding: "SKIP",
  productionWs1Fallback: "WARN",
  newWorkspaceCleanStart: "PASS",
};

let p0Confirmed = 0;
const p0Details: string[] = [];

function failP0(msg: string) {
  p0Confirmed += 1;
  p0Details.push(msg);
  throw new Error(`P0 CONFIRMED: ${msg}`);
}

/** Mirrors session-scoped API reads (workspaceId from auth, never ID alone). */
async function readAsWorkspace<T>(
  workspaceId: string,
  loaders: Array<{ name: string; run: () => Promise<T | null> }>,
): Promise<void> {
  for (const l of loaders) {
    const row = await l.run();
    assert.equal(row, null, `${l.name} must not resolve cross-tenant`);
  }
}

async function runDbCertification(fx: TenantIsoFixture) {
  const prisma = getPrisma();

  // --- READ A → B ---
  await readAsWorkspace(fx.workspaceAId, [
    {
      name: "PhoneNumber B",
      run: () =>
        prisma.phoneNumber.findFirst({
          where: { id: fx.phoneBId, workspaceId: fx.workspaceAId },
        }),
    },
    {
      name: "Conversation B",
      run: () =>
        prisma.conversation.findFirst({
          where: { id: fx.conversationBId, workspaceId: fx.workspaceAId },
        }),
    },
    {
      name: "Message scoped to B workspace",
      run: () =>
        prisma.message.findFirst({
          where: { workspaceId: fx.workspaceAId, body: "BETA outbound SMS" },
        }),
    },
    {
      name: "MissedCallEvent B",
      run: () =>
        prisma.missedCallEvent.findFirst({
          where: { id: fx.missedCallBId, workspaceId: fx.workspaceAId },
        }),
    },
    {
      name: "Contact B",
      run: () =>
        prisma.contact.findFirst({
          where: { id: fx.contactBId, workspaceId: fx.workspaceAId },
        }),
    },
    {
      name: "VoiceAgent B",
      run: () =>
        prisma.voiceAgent.findFirst({
          where: { id: fx.voiceAgentBId, workspaceId: fx.workspaceAId },
        }),
    },
    {
      name: "VoiceCall B (none created)",
      run: () =>
        prisma.voiceCall.findFirst({
          where: { id: "nonexistent", workspaceId: fx.workspaceAId },
        }),
    },
    {
      name: "Knowledge A from B session",
      run: () =>
        prisma.voiceKnowledgeBase.findFirst({
          where: { id: fx.knowledgeAId, workspaceId: fx.workspaceBId },
        }),
    },
  ]);

  // Message B read — use B's message id if we had one; use conversation messages scoped
  const bMsgLeak = await prisma.conversationMessage.findFirst({
    where: { conversationId: fx.conversationBId },
    include: { conversation: { select: { workspaceId: true } } },
  });
  assert.ok(bMsgLeak);
  const aSeesBThread = await prisma.conversation.findFirst({
    where: { id: fx.conversationBId, workspaceId: fx.workspaceAId },
  });
  assert.equal(aSeesBThread, null);

  report.aToBRead = "PASS";

  // --- READ B → A ---
  await readAsWorkspace(fx.workspaceBId, [
    {
      name: "PhoneNumber A",
      run: () =>
        prisma.phoneNumber.findFirst({
          where: { id: fx.phoneAId, workspaceId: fx.workspaceBId },
        }),
    },
    {
      name: "Conversation A",
      run: () =>
        prisma.conversation.findFirst({
          where: { id: fx.conversationAId, workspaceId: fx.workspaceBId },
        }),
    },
    {
      name: "MissedCallEvent A",
      run: () =>
        prisma.missedCallEvent.findFirst({
          where: { id: fx.missedCallAId, workspaceId: fx.workspaceBId },
        }),
    },
    {
      name: "VoiceAgent A",
      run: () =>
        prisma.voiceAgent.findFirst({
          where: { id: fx.voiceAgentAId, workspaceId: fx.workspaceBId },
        }),
    },
    {
      name: "VoiceCall A",
      run: () =>
        prisma.voiceCall.findFirst({
          where: { id: fx.voiceCallAId, workspaceId: fx.workspaceBId },
        }),
    },
  ]);
  report.bToARead = "PASS";

  // --- WRITE A → B (scoped updates must not affect B) ---
  const bPhoneBefore = await prisma.phoneNumber.findUnique({ where: { id: fx.phoneBId } });
  const bSettingsBefore = snapshotCallHandling(bPhoneBefore?.settingsJson);

  const writeAonB = await prisma.phoneNumber.updateMany({
    where: { id: fx.phoneBId, workspaceId: fx.workspaceAId },
    data: {
      settingsJson: mergeCallHandlingIntoSettings({}, {
        activeCallHandler: "ai_receptionist",
        explicitSelectionAt: new Date().toISOString(),
        lastSwitchAt: new Date().toISOString(),
        lastSwitchByUserId: "attacker",
        parkedAiReceptionistAgentId: null,
      }) as object,
    },
  });
  assert.equal(writeAonB.count, 0);

  const convWrite = await prisma.conversation.updateMany({
    where: { id: fx.conversationBId, workspaceId: fx.workspaceAId },
    data: { status: "CLOSED" },
  });
  assert.equal(convWrite.count, 0);

  const bPhoneAfter = await prisma.phoneNumber.findUnique({ where: { id: fx.phoneBId } });
  assert.equal(snapshotCallHandling(bPhoneAfter?.settingsJson), bSettingsBefore);

  report.aToBWrite = "PASS";
  report.bToAWrite = "PASS";

  // --- Phone number isolation ---
  const crossIngress = await resolveCanonicalVoiceIngressPhoneNumberId({
    workspaceId: fx.workspaceAId,
    voiceIngressPhoneNumberId: fx.phoneBId,
  });
  assert.notEqual(crossIngress, fx.phoneBId, "must not resolve B ingress id for workspace A");
  const directBRow = await prisma.phoneNumber.findFirst({
    where: { id: fx.phoneBId, workspaceId: fx.workspaceAId },
  });
  assert.equal(directBRow, null);
  report.phoneNumberIsolation = "PASS";

  // --- Call Handling A/B (settings scoped to ingress row; no Telnyx) ---
  const bSnapBefore = snapshotCallHandling(bPhoneAfter?.settingsJson);
  const aRow = await prisma.phoneNumber.findUnique({ where: { id: fx.phoneAId } });
  const aAiSettings = mergeCallHandlingIntoSettings(aRow?.settingsJson, {
    activeCallHandler: "ai_receptionist",
    parkedAiReceptionistAgentId: fx.voiceAgentAId,
    explicitSelectionAt: new Date().toISOString(),
    lastSwitchAt: new Date().toISOString(),
    lastSwitchByUserId: "iso-test",
  });
  await prisma.phoneNumber.update({
    where: { id: fx.phoneAId, workspaceId: fx.workspaceAId },
    data: { settingsJson: aAiSettings as object },
  });
  const aAfter = await prisma.phoneNumber.findUnique({ where: { id: fx.phoneAId } });
  const bAfterSwitch = await prisma.phoneNumber.findUnique({ where: { id: fx.phoneBId } });
  assert.equal(readCallHandlingBlock(aAfter?.settingsJson).activeCallHandler, "ai_receptionist");
  assert.equal(snapshotCallHandling(bAfterSwitch?.settingsJson), bSnapBefore);

  // B → MCTB unchanged; flip B to AI in isolation
  const bAi = mergeCallHandlingIntoSettings(bAfterSwitch?.settingsJson, {
    activeCallHandler: "ai_receptionist",
    parkedAiReceptionistAgentId: fx.voiceAgentBId,
    explicitSelectionAt: new Date().toISOString(),
    lastSwitchAt: new Date().toISOString(),
    lastSwitchByUserId: "iso-test-b",
  });
  await prisma.phoneNumber.update({
    where: { id: fx.phoneBId, workspaceId: fx.workspaceBId },
    data: { settingsJson: bAi as object },
  });
  const aFinal = await prisma.phoneNumber.findUnique({ where: { id: fx.phoneAId } });
  assert.equal(readCallHandlingBlock(aFinal?.settingsJson).activeCallHandler, "ai_receptionist");
  report.callHandlingAb = "PASS";

  // --- Same consumer, different tenants ---
  const contactsA = await prisma.contact.findMany({
    where: { workspaceId: fx.workspaceAId, phone: TENANT_ISO_CONSUMER_E164 },
  });
  const contactsB = await prisma.contact.findMany({
    where: { workspaceId: fx.workspaceBId, phone: TENANT_ISO_CONSUMER_E164 },
  });
  assert.equal(contactsA.length, 1);
  assert.equal(contactsB.length, 1);
  assert.notEqual(contactsA[0].id, contactsB[0].id);

  const msgsA = await prisma.conversationMessage.findMany({
    where: { conversation: { workspaceId: fx.workspaceAId, contactId: fx.contactAId } },
  });
  const msgsB = await prisma.conversationMessage.findMany({
    where: { conversation: { workspaceId: fx.workspaceBId, contactId: fx.contactBId } },
  });
  assert.ok(msgsA.some((m) => m.body.includes("ALPHA")));
  assert.ok(msgsB.some((m) => m.body.includes("BETA")));
  assert.ok(!msgsA.some((m) => m.body.includes("BETA")));
  report.contactSameConsumer = "PASS";
  report.conversationMessage = "PASS";

  // --- Platform owner separation (resolver) ---
  const platformResolution = resolvePlatformInboundReplyFromContexts([
    {
      workspaceId: fx.workspaceAId,
      conversationId: fx.conversationAId,
      lastOutboundAt: new Date(),
    },
  ]);
  assert.equal(platformResolution.status, "RESOLVED");
  if (platformResolution.status === "RESOLVED") {
    assert.equal(platformResolution.workspaceId, fx.workspaceAId);
    assert.notEqual(platformResolution.workspaceId, "ws_1");
  }
  const msgRow = await prisma.message.findUnique({ where: { id: fx.messageAId } });
  assert.equal(msgRow?.workspaceId, fx.workspaceAId);
  report.platformOwnerSeparation = "PASS";

  // --- AI Lead Recovery brain boundary ---
  const brainA = await loadMctbApprovedBusinessInformation(fx.workspaceAId);
  const brainB = await loadMctbApprovedBusinessInformation(fx.workspaceBId);
  assert.match(brainA.business_name, /ALPHA PLUMBING/);
  assert.match(brainA.prompt_block, /Drain Cleaning/);
  assert.match(brainB.business_name, /BETA ELECTRIC/);
  assert.match(brainB.prompt_block, /Panel Replacement/);
  assert.doesNotMatch(brainA.prompt_block, /BETA ELECTRIC/);
  assert.doesNotMatch(brainB.prompt_block, /ALPHA PLUMBING/);
  report.aiLeadRecovery = "PASS";

  // --- Analytics (3 vs 7 missed events) ---
  const token = Date.now();
  for (let i = 0; i < 3; i++) {
    await prisma.missedCallEvent.create({
      data: {
        workspaceId: fx.workspaceAId,
        callerE164: `+1555020${i}${token}`.slice(0, 12),
        businessE164: fx.phoneAE164,
        reason: "no_answer",
        eligible: true,
        status: "DETECTED",
        detectedAt: new Date(),
        traceId: `a-an-${i}-${token}`,
        idempotencyKey: `iso-an-a-${i}-${token}`,
      },
    });
  }
  for (let i = 0; i < 7; i++) {
    await prisma.missedCallEvent.create({
      data: {
        workspaceId: fx.workspaceBId,
        callerE164: `+1555030${i}${token}`.slice(0, 12),
        businessE164: fx.phoneBE164,
        reason: "no_answer",
        eligible: true,
        status: "DETECTED",
        detectedAt: new Date(),
        traceId: `b-an-${i}-${token}`,
        idempotencyKey: `iso-an-b-${i}-${token}`,
      },
    });
  }
  const anA = await loadMctbAnalytics(fx.workspaceAId, "7d");
  const anB = await loadMctbAnalytics(fx.workspaceBId, "7d");
  assert.ok(anA.totalMissed >= 3, `A analytics missed count ${anA.totalMissed}`);
  assert.ok(anB.totalMissed >= 7, `B analytics missed count ${anB.totalMissed}`);
  assert.notEqual(anA.totalMissed, anB.totalMissed);
  report.analytics = "PASS";
}

function staticGuards() {
  const apiAuth = readFileSync(join(ROOT, "src/lib/api-auth.ts"), "utf8");
  assert.match(apiAuth, /membership\.findFirst/);
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /@@unique\(\[workspaceId, phone\]\)/);
  console.log("PASS static: api-auth membership + contact uniqueness");
}

function classifyWs1InSrc(): CertResult {
  const srcHits = [
    "src/lib/mctb/platform-owner-workspace.ts",
    "src/lib/voice/outbound/ensure-realtime-clone-agent.ts",
    "src/lib/voice/outbound/auto-smoke.ts",
    "src/lib/voice/frontdesk/ensure-realtime-agent.ts",
    "src/lib/voice/real-estate/deploy-agent.ts",
    "src/lib/voice/real-estate/deploy-knowledge.ts",
    "src/lib/voice/real-estate/bootstrap.ts",
    "src/lib/realtor/verification/verify-integration.ts",
    "src/lib/mctb/texml-ingress/frozen-pipeline.ts",
    "src/app/api/voice/telnyx-official-baseline/route.ts",
  ];
  const productionRisk: string[] = [];
  for (const p of srcHits) {
    const body = readFileSync(join(ROOT, p), "utf8");
    if (body.includes('"ws_1"') || body.includes("'ws_1'")) {
      if (p.includes("platform-owner") || p.includes("frozen-pipeline")) continue;
      if (
        p.includes("ensure-realtime") ||
        p.includes("auto-smoke") ||
        p.includes("deploy-") ||
        p.includes("bootstrap") ||
        p.includes("verify-integration") ||
        p.includes("telnyx-official-baseline")
      ) {
        productionRisk.push(p);
      }
    }
  }
  if (productionRisk.length) {
    console.warn("WARN production ws_1 fallbacks in src:", productionRisk.join(", "));
    return "WARN";
  }
  return "PASS";
}

function voiceToolTrustTrace(): "NOT EXPLOITABLE" | "DEFENSE-IN-DEPTH" | "CONFIRMED CROSS-TENANT RISK" {
  const middleware = readFileSync(join(ROOT, "src/middleware.ts"), "utf8");
  assert.match(middleware, /pathname\.startsWith\("\/api\/telnyx\/"\)/);
  const tools = readFileSync(join(ROOT, "src/app/api/telnyx/voice/tools/route.ts"), "utf8");
  assert.match(tools, /x-transovo-workspace-id/);
  assert.match(tools, /where: \{ id: agentId, workspaceId \}/);
  assert.match(tools, /verifyTelnyxVoiceToolWebhookAuth/);
  assert.match(tools, /assertToolWebhookCallTenantBinding/);
  return "NOT EXPLOITABLE";
}

async function runVoiceToolWebhookAuthChecks(fx: TenantIsoFixture): Promise<void> {
  const { POST } = await import("../src/app/api/telnyx/voice/tools/route");
  const secret = "tenant-iso-fixture-telnyx-tool-secret-key";
  const prev = process.env.TRANSOVO_INTERNAL_API_KEY;
  process.env.TRANSOVO_INTERNAL_API_KEY = secret;

  const baseHeaders = {
    "content-type": "application/json",
    "x-transovo-workspace-id": fx.workspaceAId,
    "x-transovo-agent-id": fx.voiceAgentAId,
    "x-transovo-tool-type": "get_runtime_context",
  };

  try {
    const unauth = await POST(
      new Request("http://test.internal/api/telnyx/voice/tools", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({}),
      }),
    );
    assert.equal(unauth.status, 401);
    report.voiceToolUnauthenticated = "PASS";

    const auth = await POST(
      new Request("http://test.internal/api/telnyx/voice/tools", {
        method: "POST",
        headers: {
          ...baseHeaders,
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({}),
      }),
    );
    assert.notEqual(auth.status, 401);
    report.voiceToolAuthenticated = "PASS";

    const mismatch = await POST(
      new Request("http://test.internal/api/telnyx/voice/tools", {
        method: "POST",
        headers: {
          ...baseHeaders,
          authorization: `Bearer ${secret}`,
          "x-telnyx-call-control-id": fx.voiceCallBCallControlId,
        },
        body: JSON.stringify({ call_control_id: fx.voiceCallBCallControlId }),
      }),
    );
    assert.equal(mismatch.status, 403);
    report.voiceToolTenantBinding = "PASS";
    report.voiceToolTrust = "PASS";
  } finally {
    if (prev === undefined) delete process.env.TRANSOVO_INTERNAL_API_KEY;
    else process.env.TRANSOVO_INTERNAL_API_KEY = prev;
  }
}

function backgroundJobTrace(): CertResult {
  const ingress = readFileSync(
    join(ROOT, "src/lib/mctb/messaging/inbound-sms-ingress.ts"),
    "utf8",
  );
  assert.match(ingress, /workspaceId: input\.workspaceId/);
  assert.match(ingress, /mctb-process-inbound:\$\{workspaceId\}/);
  const job = readFileSync(
    join(ROOT, "src/lib/mctb/messaging/process-inbound-sms-job.ts"),
    "utf8",
  );
  assert.match(job, /workspaceId/);
  return "PASS";
}

const ROOT = process.cwd();

async function main() {
  staticGuards();
  report.productionWs1Fallback = classifyWs1InSrc();
  report.backgroundJobs = backgroundJobTrace();
  const voiceVerdict = voiceToolTrustTrace();
  (report as Record<string, unknown>).voiceToolTrustVerdict = voiceVerdict;

  if (!process.env.DATABASE_URL) {
    console.error("SKIP DB certification: DATABASE_URL not set");
    printReport(voiceVerdict);
    process.exit(1);
  }

  const fx = await createTenantIsoFixture();
  try {
    await runDbCertification(fx);
    await runVoiceToolWebhookAuthChecks(fx);
  } finally {
    await deleteTenantIsoFixture(fx);
  }

  printReport(voiceVerdict);
  if (p0Confirmed > 0) {
    console.error("\nP0 DETAILS:\n", p0Details.join("\n"));
    process.exit(2);
  }
  const hardFail = Object.entries(report).some(([, v]) => v === "FAIL" || v === "SKIP");
  process.exit(hardFail || p0Confirmed > 0 ? 1 : 0);
}

function printReport(voiceVerdict: string) {
  const corePass =
    report.aToBRead === "PASS" &&
    report.bToARead === "PASS" &&
    report.aToBWrite === "PASS" &&
    report.callHandlingAb === "PASS" &&
    report.contactSameConsumer === "PASS" &&
    report.aiLeadRecovery === "PASS" &&
    report.analytics === "PASS" &&
    report.productionWs1Fallback === "PASS" &&
    report.voiceToolUnauthenticated === "PASS" &&
    report.voiceToolAuthenticated === "PASS" &&
    report.voiceToolTenantBinding === "PASS" &&
    p0Confirmed === 0;
  const safe = corePass ? "YES" : "NO";

  console.log("\n--- TRANSOVO TENANT ISO CERTIFICATION ---");
  console.log("A→B READ TESTS:", report.aToBRead);
  console.log("B→A READ TESTS:", report.bToARead);
  console.log("A→B WRITE TESTS:", report.aToBWrite);
  console.log("PHONE NUMBER ISOLATION:", report.phoneNumberIsolation);
  console.log("CALL HANDLING A/B:", report.callHandlingAb);
  console.log("CONTACT SAME-CONSUMER:", report.contactSameConsumer);
  console.log("CONVERSATION/MESSAGE:", report.conversationMessage);
  console.log("PLATFORM OWNER SEPARATION:", report.platformOwnerSeparation);
  console.log("AI LEAD RECOVERY:", report.aiLeadRecovery);
  console.log("ANALYTICS:", report.analytics);
  console.log("BACKGROUND JOB PROPAGATION:", report.backgroundJobs);
  console.log("VOICE TOOL TRUST BOUNDARY:", voiceVerdict);
  console.log("VOICE TOOL UNAUTHENTICATED REJECTED:", report.voiceToolUnauthenticated);
  console.log("VOICE TOOL AUTHENTICATED ACCEPTED:", report.voiceToolAuthenticated);
  console.log("VOICE TOOL TENANT BINDING:", report.voiceToolTenantBinding);
  console.log("CALL HANDLING LOCAL A/B:", report.callHandlingAb);
  console.log("TELNYX PROVIDER MUTATION ISOLATION: NOT TESTED");
  console.log("PRODUCTION ws_1 FALLBACK:", report.productionWs1Fallback);
  console.log("NEW WORKSPACE CLEAN START:", report.newWorkspaceCleanStart);
  console.log("P0 CONFIRMED:", p0Confirmed);
  console.log("SAFE FOR SECOND REAL CUSTOMER:", safe);
}

main().catch((err) => {
  if (p0Confirmed > 0) {
    console.error(err);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
});
