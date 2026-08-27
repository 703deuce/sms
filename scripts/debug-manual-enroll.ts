import { getPrisma } from "../src/lib/db";
import { createNodeId, createEdgeId } from "../src/lib/automations/types";
import { enrollInAutomation } from "../src/lib/automations/enroll";
import { advanceAutomationExecution } from "../src/lib/automations/runner";

async function main() {
  const prisma = getPrisma();
  const ws = "ws_1";
  const triggerId = createNodeId();
  const smsId = createNodeId();
  const endId = createNodeId();
  const def = {
    version: 1,
    nodes: [
      {
        id: triggerId,
        type: "trigger" as const,
        position: { x: 0, y: 0 },
        data: { blockType: "manual_enrollment", label: "m", config: {} },
      },
      {
        id: smsId,
        type: "action" as const,
        position: { x: 0, y: 80 },
        data: {
          blockType: "send_sms",
          label: "sms",
          config: { body: "debug cert", fromNumber: "+15714073615", stopOnReply: false },
        },
      },
      {
        id: endId,
        type: "end" as const,
        position: { x: 0, y: 160 },
        data: { blockType: "end_automation", label: "e", config: {} },
      },
    ],
    edges: [
      { id: createEdgeId(), source: triggerId, target: smsId, sourceHandle: "default" },
      { id: createEdgeId(), source: smsId, target: endId, sourceHandle: "default" },
    ],
  };
  const flow = await prisma.automationFlow.create({
    data: {
      workspaceId: ws,
      name: `cert-debug-manual-${Date.now()}`,
      trigger: "manual_enrollment",
      definition: def as object,
      publishedDefinition: def as object,
      version: 1,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
  const contact = await prisma.contact.findFirst({
    where: { workspaceId: ws, phone: { contains: "5714776175" }, status: "SUBSCRIBED" },
  });
  console.log("contact", contact?.id);
  try {
    const enroll = await enrollInAutomation({
      workspaceId: ws,
      flowId: flow.id,
      contactId: contact!.id,
    });
    console.log("enroll", enroll.execution?.id, enroll.skipped, enroll.reason);
    const jobs = await prisma.jobQueue.findMany({
      where: { jobType: "automation_advance", status: { in: ["pending", "deferred"] } },
      take: 5,
    });
    console.log("pending jobs", jobs.length);
    for (let i = 0; i < 5; i++) {
      try {
        const r = await advanceAutomationExecution(enroll.execution!.id);
        console.log("advance", i, r);
      } catch (e) {
        console.error("advance error", e);
        break;
      }
    }
    const ex = await prisma.automationExecution.findUnique({ where: { id: enroll.execution!.id } });
    console.log("final", ex?.status, ex?.currentNodeId, ex?.error);
  } catch (e) {
    console.error("main error", e);
  }
  await prisma.automationExecution.deleteMany({ where: { flowId: flow.id } });
  await prisma.automationFlow.delete({ where: { id: flow.id } });
}

main().catch(console.error);
