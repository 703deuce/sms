import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { sendQuickSms } from "@/lib/sms/send-quick";

type AutomationStep = {
  id?: string;
  type?: string;
  body?: string;
  message?: string;
  delayMinutes?: number;
  tag?: string;
};

type AutomationDefinition = {
  steps?: AutomationStep[];
  from?: string;
};

/**
 * Process one active automation flow:
 * enrolls opted-in contacts not yet tagged with the flow, sends first SMS step.
 */
export async function processAutomationTick(flowId: string, workspaceId: string) {
  const prisma = getPrisma();
  const flow = await prisma.automationFlow.findFirst({
    where: { id: flowId, workspaceId, status: "ACTIVE" },
  });
  if (!flow) return { ok: true, skipped: true };

  const definition = (flow.definition || {}) as AutomationDefinition;
  const steps = definition.steps || [];
  const sendStep = steps.find(
    (s) => (s.type || "").toLowerCase() === "sms" || s.body || s.message,
  );
  const body = (sendStep?.body || sendStep?.message || "").trim();
  if (!body) {
    return { ok: true, skipped: true, reason: "no_sms_step" };
  }

  const contacts = await prisma.contact.findMany({
    where: { workspaceId, status: "SUBSCRIBED" },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  let sent = 0;
  for (const contact of contacts) {
    try {
      await sendQuickSms({
        workspaceId,
        to: contact.phone,
        body: body
          .replace(/\{\{firstName\}\}/gi, contact.firstName || "")
          .replace(/\{\{name\}\}/gi, `${contact.firstName || ""} ${contact.lastName || ""}`.trim()),
        from: definition.from,
      });
      sent += 1;
    } catch {
      // continue remaining contacts
    }
  }

  const updated = await prisma.automationFlow.update({
    where: { id: flowId },
    data: {
      enrolled: { increment: sent },
      messagesSent: { increment: sent },
      completionRate:
        flow.enrolled + sent > 0
          ? Math.min(100, ((flow.messagesSent + sent) / Math.max(1, flow.enrolled + sent)) * 100)
          : 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      event: "automation.tick",
      detail: `flow=${flowId} sent=${sent}`,
    },
  });

  // Re-queue next minute while active
  if (updated.status === "ACTIVE") {
    await enqueueJob({
      jobType: "automation_tick",
      queueName: "automations",
      workspaceId,
      payload: { flowId, workspaceId },
      idempotencyKey: `automation-tick:${flowId}:${new Date().toISOString().slice(0, 16)}`,
      runAfter: new Date(Date.now() + 60_000),
    });
  }

  return { ok: true, sent };
}

export async function processActiveAutomations() {
  const flows = await getPrisma().automationFlow.findMany({
    where: { status: "ACTIVE" },
    take: 20,
  });
  const results = [];
  for (const flow of flows) {
    results.push(await processAutomationTick(flow.id, flow.workspaceId));
  }
  return { ok: true, flows: results.length, results };
}
