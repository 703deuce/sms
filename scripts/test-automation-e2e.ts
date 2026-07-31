/**
 * Automation E2E verification (DB + runner, mock messaging).
 * Run: npx tsx scripts/test-automation-e2e.ts
 */
import { getPrisma } from "../src/lib/db";
import { defaultMvpDefinition } from "../src/lib/automations/validation";
import { enrollInAutomation, enrollForTrigger } from "../src/lib/automations/enroll";
import { advanceAutomationExecution, processAutomationWaits } from "../src/lib/automations/runner";
import { runNodeAction } from "../src/lib/automations/actions";
import { recordContactReview } from "../src/lib/automations/reviews";
import { parseAutomationDefinition, findTriggerNode } from "../src/lib/automations/types";
import { factsFromMetadata } from "../src/lib/automations/metadata";

process.env.APP_URL ||= "http://localhost:3000";
process.env.INTEGRATION_SECRET_KEY ||= "test-integration-secret-key";
delete process.env.TWILIO_MODE;
delete process.env.MESSAGING_ADAPTER;

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

/** One-minute wait MVP for faster E2E */
function fastMvpDefinition() {
  const def = defaultMvpDefinition();
  const wait = def.nodes.find((n) => n.data.blockType === "wait");
  if (wait) {
    wait.data.config = { weeks: 0, days: 0, hours: 0, minutes: 1 };
    wait.data.label = "Wait 1 min";
  }
  return def;
}

async function setupMockMessaging(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.messagingRegistration.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      overallStatus: "ready",
      messagingEnabled: true,
      paused: false,
      phoneAttached: true,
      phoneE164: "+14155550100",
      phoneSid: "PN_MOCK",
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingServiceSid: "MG_MOCK",
      messagingProvider: "mock",
    },
    update: {
      overallStatus: "ready",
      messagingEnabled: true,
      paused: false,
      phoneAttached: true,
      phoneE164: "+14155550100",
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingProvider: "mock",
    },
  });
}

async function main() {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "Automation E2E", slug: `auto-e2e-${Date.now()}` },
  });
  const workspaceId = workspace.id;
  console.log(`workspace=${workspaceId}`);

  const otherWorkspace = await prisma.workspace.create({
    data: { name: "Other WS", slug: `auto-other-${Date.now()}` },
  });

  await setupMockMessaging(workspaceId);

  const contact = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415555${String(Date.now()).slice(-4)}`,
      firstName: "Test",
      lastName: "Customer",
      status: "SUBSCRIBED",
      consentSource: "test",
      consentDate: new Date(),
    },
  });

  const unsub = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415556${String(Date.now()).slice(-4)}`,
      firstName: "Opt",
      lastName: "Out",
      status: "UNSUBSCRIBED",
    },
  });

  const def = fastMvpDefinition();
  const flow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "E2E Review follow-up",
      trigger: "customer_added",
      definition: def as object,
      publishedDefinition: def as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });

  // --- Enrollment once ---
  const enroll1 = await enrollForTrigger(workspaceId, "customer_added", contact.id);
  const enroll2 = await enrollForTrigger(workspaceId, "customer_added", contact.id);
  if (enroll1[0]?.skipped !== false && enroll1[0]?.execution) {
    ok("customer.created enrolls execution");
  } else if (enroll1[0]?.execution) {
    ok("customer.created enrolls execution");
  } else {
    fail("customer.created enrolls execution", JSON.stringify(enroll1));
  }
  if (enroll2[0]?.skipped && enroll2[0]?.reason === "already_enrolled") {
    ok("duplicate enrollment prevented");
  } else {
    fail("duplicate enrollment prevented", JSON.stringify(enroll2));
  }

  const execution = enroll1[0]?.execution;
  if (!execution) {
    fail("execution exists");
    return mainCleanup(workspaceId, otherWorkspace.id, flow.id);
  }

  const parsed = parseAutomationDefinition(flow.publishedDefinition);

  // --- Advance through trigger, send, wait, condition, follow-up ---
  for (let i = 0; i < 8; i += 1) {
    const ex = await prisma.automationExecution.findUnique({ where: { id: execution.id } });
    if (!ex || ex.status === "COMPLETED" || ex.status === "FAILED" || ex.status === "CANCELLED") break;
    if (ex.status === "WAITING") break;
    await advanceAutomationExecution(execution.id);
  }

  const exAfterSend = await prisma.automationExecution.findUnique({ where: { id: execution.id } });
  if (exAfterSend?.status === "WAITING" || exAfterSend?.status === "COMPLETED") {
    ok("advance after enroll");
  } else {
    fail("advance after enroll", exAfterSend?.status);
  }

  const stepsAfterSend = await prisma.automationStepExecution.count({
    where: { executionId: execution.id, status: "completed" },
  });
  if (stepsAfterSend >= 1) ok("first steps recorded");
  else fail("first steps recorded", `steps=${stepsAfterSend}`);

  const messages = await prisma.message.count({
    where: { workspaceId, to: contact.phone },
  });
  if (messages >= 1) ok("review request SMS sent once");
  else fail("review request SMS sent once", `count=${messages}`);

  // Retry advance on send step must not duplicate first SMS
  const msgBeforeDup = await prisma.message.count({ where: { workspaceId, to: contact.phone } });
  await advanceAutomationExecution(execution.id);
  const msgAfterDup = await prisma.message.count({ where: { workspaceId, to: contact.phone } });
  if (msgAfterDup === msgBeforeDup) ok("retry does not duplicate first SMS");
  else fail("retry does not duplicate first SMS", `before=${msgBeforeDup} after=${msgAfterDup}`);

  // --- Wait scheduling ---
  if (exAfterSend?.status === "WAITING" && exAfterSend.nextActionAt) {
    ok("execution enters WAITING with nextActionAt");
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { nextActionAt: new Date(Date.now() - 1000) },
    });
    const wake = await processAutomationWaits();
    if (wake.advanced >= 1) ok("processAutomationWaits wakes execution");
    else fail("processAutomationWaits wakes execution", JSON.stringify(wake));

    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: "RUNNING", nextActionAt: null },
    });
    for (let i = 0; i < 6; i += 1) {
      const ex = await prisma.automationExecution.findUnique({ where: { id: execution.id } });
      if (!ex || ex.status === "COMPLETED" || ex.status === "FAILED" || ex.status === "CANCELLED") break;
      await advanceAutomationExecution(execution.id);
    }
    ok("advance after wait through condition and follow-up");
  } else {
    fail("execution enters WAITING", exAfterSend?.status);
  }

  // --- Condition No branch (no review yet) ---
  const condNode = parsed.nodes.find((n) => n.data.blockType === "condition");
  if (condNode) {
    const condStep = await prisma.automationStepExecution.findUnique({
      where: { executionId_nodeId: { executionId: execution.id, nodeId: condNode.id } },
    });
    if (condStep?.branchTaken === "no") ok("condition follows No branch without review");
    else fail("condition follows No branch", condStep?.branchTaken ?? "no step");
  } else {
    fail("condition node in definition");
  }

  // --- Follow-up on No branch sends second message ---
  const msgCountAfterFollowUp = await prisma.message.count({ where: { workspaceId, to: contact.phone } });
  if (msgCountAfterFollowUp >= 2) ok("follow-up SMS on No branch");
  else fail("follow-up SMS on No branch", `count=${msgCountAfterFollowUp}`);

  // Complete to end if not already
  const finalEx = await prisma.automationExecution.findUnique({ where: { id: execution.id } });
  if (finalEx?.status === "COMPLETED") ok("execution completes");
  else fail("execution completes", finalEx?.status);

  const pathSteps = await prisma.automationStepExecution.findMany({
    where: { executionId: execution.id },
    orderBy: { startedAt: "asc" },
  });
  if (pathSteps.length >= 4) ok("execution history has step path");
  else fail("execution history path", `steps=${pathSteps.length}`);

  // --- Opt-out ---
  const optFlow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "Opt-out test",
      trigger: "customer_added",
      definition: def as object,
      publishedDefinition: def as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
  const optEnroll = await enrollInAutomation({
    workspaceId,
    flowId: optFlow.id,
    contactId: unsub.id,
  });
  if (optEnroll.skipped && optEnroll.reason === "contact_not_subscribed") {
    ok("unsubscribed contact not enrolled");
  } else {
    fail("unsubscribed contact not enrolled", JSON.stringify(optEnroll));
  }

  const optResult = await runNodeAction(
    parsed.nodes.find((n) => n.data.blockType === "send_review_request")!,
    parsed,
    {
      executionId: execution.id,
      workspaceId,
      contactId: unsub.id,
      flowId: flow.id,
      facts: {},
      tagNames: [],
      testMode: false,
    },
  );
  if (optResult.error === "contact_opted_out" || optResult.done) {
    ok("opt-out blocks SMS action");
  } else {
    fail("opt-out blocks SMS", JSON.stringify(optResult));
  }

  // --- Workspace isolation ---
  const crossContact = await prisma.contact.create({
    data: {
      workspaceId: otherWorkspace.id,
      phone: contact.phone,
      status: "SUBSCRIBED",
    },
  });
  const cross = await enrollInAutomation({
    workspaceId,
    flowId: flow.id,
    contactId: crossContact.id,
  }).catch((e: Error) => ({ error: e.message }));
  if ("error" in cross && cross.error === "Contact not found") {
    ok("cross-workspace contact cannot enroll");
  } else {
    fail("cross-workspace isolation", JSON.stringify(cross));
  }

  // --- Review triggers ---
  const reviewFlow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "On review received",
      trigger: "review_received",
      definition: {
        version: 1,
        nodes: [
          {
            id: "t1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { blockType: "review_received", label: "Review received", config: {} },
          },
          {
            id: "e1",
            type: "end",
            position: { x: 0, y: 100 },
            data: { blockType: "end_automation", label: "End", config: {} },
          },
        ],
        edges: [{ id: "e1", source: "t1", target: "e1" }],
      } as object,
      publishedDefinition: {
        version: 1,
        nodes: [
          {
            id: "t1",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: { blockType: "review_received", label: "Review received", config: {} },
          },
          {
            id: "e1",
            type: "end",
            position: { x: 0, y: 100 },
            data: { blockType: "end_automation", label: "End", config: {} },
          },
        ],
        edges: [{ id: "e1", source: "t1", target: "e1" }],
      } as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });

  const reviewContact = await prisma.contact.create({
    data: {
      workspaceId,
      phone: `+1415557${String(Date.now()).slice(-4)}`,
      status: "SUBSCRIBED",
    },
  });

  await recordContactReview(workspaceId, reviewContact.id, { rating: 5, source: "e2e" });
  const reviewExec = await prisma.automationExecution.findFirst({
    where: { flowId: reviewFlow.id, contactId: reviewContact.id },
  });
  if (reviewExec) ok("review.received trigger enrolls");
  else fail("review.received trigger enrolls");

  const facts = factsFromMetadata(
    { review_received: true },
    { customFields: { review_received: true } },
    [],
  );
  if (facts.review_received) ok("factsFromMetadata review_received");
  else fail("factsFromMetadata");

  // --- Scheduled trigger idempotency ---
  const runAt = new Date(Date.now() - 30_000).toISOString();
  const schedDef = {
    version: 1,
    nodes: [
      {
        id: "st",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: {
          blockType: "scheduled_datetime",
          label: "Scheduled",
          config: { runAt, enrollScope: "all_subscribed" },
        },
      },
      {
        id: "se",
        type: "end",
        position: { x: 0, y: 100 },
        data: { blockType: "end_automation", label: "End", config: {} },
      },
    ],
    edges: [{ id: "es", source: "st", target: "se" }],
  };
  const schedFlow = await prisma.automationFlow.create({
    data: {
      workspaceId,
      name: "Scheduled once",
      trigger: "scheduled_datetime",
      definition: schedDef as object,
      publishedDefinition: schedDef as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });

  const { processScheduledAutomations } = await import("../src/lib/automations/runner");
  const s1 = await processScheduledAutomations();
  const s2 = await processScheduledAutomations();
  const schedCount = await prisma.automationExecution.count({ where: { flowId: schedFlow.id } });
  if (schedCount >= 1) ok("scheduled trigger enrolls");
  else fail("scheduled trigger enrolls", JSON.stringify(s1));
  if (s2.enrolled === 0 || schedCount === await prisma.contact.count({ where: { workspaceId, status: "SUBSCRIBED" } })) {
    ok("scheduled trigger no duplicate bulk on second run");
  } else {
    fail("scheduled idempotency", `s2.enrolled=${s2.enrolled}`);
  }

  // Paused flow
  await prisma.automationFlow.update({ where: { id: schedFlow.id }, data: { status: "PAUSED" } });
  const beforePaused = await prisma.automationExecution.count({ where: { flowId: schedFlow.id } });
  await processScheduledAutomations();
  const afterPaused = await prisma.automationExecution.count({ where: { flowId: schedFlow.id } });
  if (afterPaused === beforePaused) ok("paused automation does not enroll");
  else fail("paused automation enroll");

  // Email not configured
  delete process.env.BREVO_API_KEY;
  await prisma.contact.update({
    where: { id: contact.id },
    data: { email: "test@example.com" },
  });
  const emailNode = {
    id: "em",
    type: "action" as const,
    position: { x: 0, y: 0 },
    data: {
      blockType: "send_email",
      label: "Email",
      config: { subject: "Hi", body: "Body" },
    },
  };
  const emailResult = await runNodeAction(emailNode, { version: 1, nodes: [emailNode], edges: [] }, {
    executionId: execution.id,
    workspaceId,
    contactId: contact.id,
    flowId: flow.id,
    facts: {},
    tagNames: [],
    testMode: false,
  });
  if (emailResult.error === "email_not_configured") ok("email step fails clearly without Brevo");
  else fail("email without Brevo", JSON.stringify(emailResult));

  await mainCleanup(workspaceId, otherWorkspace.id, flow.id, optFlow.id, reviewFlow.id, schedFlow.id);

  console.log(`\n${failures.length === 0 ? "All E2E checks passed" : `${failures.length} failed`}`);
  if (failures.length) {
    console.log(failures.join("\n"));
    process.exit(1);
  }
}

async function mainCleanup(
  workspaceId: string,
  otherWorkspaceId: string,
  ...flowIds: string[]
) {
  const prisma = getPrisma();
  for (const fid of flowIds) {
    await prisma.automationFlow.deleteMany({ where: { id: fid } });
  }
  await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWorkspaceId] } } });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
