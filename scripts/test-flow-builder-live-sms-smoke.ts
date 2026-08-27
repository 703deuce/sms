/**
 * Single controlled live SMS smoke — one flow, one message.
 *
 * Run (requires TEST_SMS_TO / OUTBOUND_TEST_PHONE and FROM_E164):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-flow-builder-live-sms-smoke.ts
 */

import { getPrisma } from "../src/lib/db";
import { createNodeId, createEdgeId } from "../src/lib/automations/types";
import { enrollInAutomation } from "../src/lib/automations/enroll";
import { processAutomationWaits } from "../src/lib/automations/runner";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const TEST_SMS_TO = (process.env.TEST_SMS_TO || process.env.OUTBOUND_TEST_PHONE || "").trim();
const FROM_E164 = (process.env.FROM_E164 || "").trim();
const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"] as const;

async function runExecution(executionId: string) {
  const { advanceAutomationExecution } = await import("../src/lib/automations/runner");
  const { handleJob } = await import("../src/lib/jobs/job-handlers");
  for (let i = 0; i < 24; i += 1) {
    const ex = await getPrisma().automationExecution.findUnique({ where: { id: executionId } });
    if (!ex || TERMINAL.includes(ex.status as (typeof TERMINAL)[number])) return ex;
    if (ex.status === "WAITING" && ex.nextActionAt && ex.nextActionAt.getTime() > Date.now()) {
      await getPrisma().automationExecution.update({
        where: { id: executionId },
        data: { nextActionAt: new Date(Date.now() - 1000) },
      });
      await processAutomationWaits();
    }
    const jobs = await getPrisma().jobQueue.findMany({
      where: { jobType: "automation_advance", status: { in: ["pending", "deferred"] } },
      take: 100,
    });
    const mine = jobs.some((j) => (j.payload as { executionId?: string })?.executionId === executionId);
    if (mine) {
      await handleJob("automation_advance", { executionId });
    } else if (ex.status === "RUNNING") {
      try {
        await advanceAutomationExecution(executionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("duplicate key")) throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return getPrisma().automationExecution.findUnique({ where: { id: executionId } });
}

async function main() {
  const prisma = getPrisma();
  let fromE164 = FROM_E164;
  if (!fromE164) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { workspaceId: WORKSPACE_ID },
      select: { e164: true },
    });
    fromE164 = phone?.e164 || "";
  }
  if (!TEST_SMS_TO || !fromE164) {
    console.error("Set TEST_SMS_TO (or OUTBOUND_TEST_PHONE) and FROM_E164 (or have a workspace number)");
    process.exit(1);
  }
  const marker = `live-smoke-${Date.now().toString(36)}`;
  const contact = await prisma.contact.findFirst({
    where: {
      workspaceId: WORKSPACE_ID,
      phone: { contains: TEST_SMS_TO.replace(/\D/g, "").slice(-10) },
      status: "SUBSCRIBED",
    },
  });
  if (!contact) {
    console.error("No subscribed test contact for", TEST_SMS_TO);
    process.exit(1);
  }

  const triggerId = createNodeId();
  const smsId = createNodeId();
  const endId = createNodeId();
  const body = `Flow Builder live smoke ${marker}`;
  const def = {
    version: 1,
    nodes: [
      {
        id: triggerId,
        type: "trigger" as const,
        position: { x: 0, y: 0 },
        data: { blockType: "manual_enrollment", label: "Manual", config: {} },
      },
      {
        id: smsId,
        type: "action" as const,
        position: { x: 0, y: 80 },
        data: {
          blockType: "send_sms",
          label: "SMS",
          config: { body, fromNumber: fromE164, stopOnReply: false },
        },
      },
      {
        id: endId,
        type: "end" as const,
        position: { x: 0, y: 160 },
        data: { blockType: "end_automation", label: "End", config: {} },
      },
    ],
    edges: [
      { id: createEdgeId(), source: triggerId, target: smsId, sourceHandle: "default" },
      { id: createEdgeId(), source: smsId, target: endId, sourceHandle: "default" },
    ],
  };

  const since = new Date();
  const flow = await prisma.automationFlow.create({
    data: {
      workspaceId: WORKSPACE_ID,
      name: `cert-live-sms-${marker}`,
      trigger: "manual_enrollment",
      definition: def as object,
      publishedDefinition: def as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });

  try {
    const enroll = await enrollInAutomation({
      workspaceId: WORKSPACE_ID,
      flowId: flow.id,
      contactId: contact.id,
    });
    if (!enroll.execution) {
      console.error("Enroll failed", enroll);
      process.exit(1);
    }
    const final = await runExecution(enroll.execution.id);
    const smsRows = await prisma.message.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        to: contact.phone,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, body: true },
    });
    const smsCount = smsRows.filter((m) =>
      /live smoke/i.test(m.body || ""),
    ).length;
    console.log(
      JSON.stringify(
        {
          marker,
          flowId: flow.id,
          executionId: enroll.execution.id,
          executionStatus: final?.status,
          smsCount,
          body,
          pass: final?.status === "COMPLETED" && smsCount >= 1,
        },
        null,
        2,
      ),
    );
    if (final?.status !== "COMPLETED" || smsCount < 1) process.exit(1);
  } finally {
    await prisma.automationExecution.deleteMany({ where: { flowId: flow.id } });
    await prisma.automationFlow.delete({ where: { id: flow.id } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
