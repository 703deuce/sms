import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { findTriggerNode, parseAutomationDefinition } from "./types";

export async function enrollInAutomation({
  workspaceId,
  flowId,
  contactId,
  testMode = false,
  forceVersion,
}: {
  workspaceId: string;
  flowId: string;
  contactId: string;
  testMode?: boolean;
  forceVersion?: number;
}) {
  const prisma = getPrisma();
  const flow = await prisma.automationFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!flow) throw new Error("Automation not found");
  if (!testMode && flow.status !== "ACTIVE") {
    throw new Error("Automation is not active");
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact) throw new Error("Contact not found");
  if (!testMode && contact.status !== "SUBSCRIBED") {
    return { skipped: true, reason: "contact_not_subscribed" };
  }

  const version = forceVersion ?? flow.version;
  const enrollmentKey = testMode
    ? `test:${flowId}:${contactId}:${Date.now()}`
    : `${flowId}:${contactId}:v${version}`;

  if (!testMode) {
    const existing = await prisma.automationExecution.findUnique({
      where: { enrollmentKey },
    });
    if (existing) return { execution: existing, skipped: true, reason: "already_enrolled" };
  }

  const rawDef = flow.publishedDefinition ?? flow.definition;
  const def = parseAutomationDefinition(rawDef);
  const trigger = findTriggerNode(def);
  if (!trigger) throw new Error("Automation has no trigger");

  const execution = await prisma.automationExecution.create({
    data: {
      workspaceId,
      flowId,
      flowVersion: version,
      contactId,
      enrollmentKey,
      status: "RUNNING",
      currentNodeId: trigger.id,
      metadata: { testMode } as import("@/lib/domain").Prisma.InputJsonValue,
    },
  });

  if (!testMode) {
    await prisma.automationFlow.update({
      where: { id: flowId },
      data: { enrolled: { increment: 1 } },
    });
  }

  await enqueueJob({
    jobType: "automation_advance",
    queueName: "automations",
    workspaceId,
    payload: { executionId: execution.id },
    idempotencyKey: `automation-advance:${execution.id}:start`,
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      event: testMode ? "automation.test_enroll" : "automation.enroll",
      detail: `flow=${flowId} contact=${contactId} execution=${execution.id}`,
    },
  });

  return { execution, skipped: false };
}

export async function enrollForTrigger(
  workspaceId: string,
  triggerBlockType: string,
  contactId: string,
  filters?: {
    tag?: string;
    formSlug?: string;
    provider?: string;
    eventType?: string;
    orderStatus?: string;
    eventTypeName?: string;
  },
) {
  const prisma = getPrisma();
  const flows = await prisma.automationFlow.findMany({
    where: { workspaceId, status: "ACTIVE" },
    take: 50,
  });

  const results = [];
  for (const flow of flows) {
    const def = parseAutomationDefinition(flow.publishedDefinition ?? flow.definition);
    const trigger = findTriggerNode(def);
    if (!trigger || trigger.data.blockType !== triggerBlockType) continue;

    const cfg = (trigger.data.config || {}) as Record<string, unknown>;

    if (
      (triggerBlockType === "tag_added" || triggerBlockType === "integration_tag_added") &&
      filters?.tag
    ) {
      const required = String(cfg.tag || "").trim();
      if (required && required !== filters.tag) continue;
    }

    if (
      (triggerBlockType === "form_submitted" ||
        triggerBlockType === "integration_form_submitted") &&
      filters?.formSlug
    ) {
      const required = String(cfg.formSlug || "").trim();
      if (required && required !== filters.formSlug) continue;
    }

    if (triggerBlockType.startsWith("integration_") && filters?.provider) {
      const requiredProvider = String(cfg.provider || "").trim();
      if (requiredProvider && requiredProvider !== filters.provider) continue;
    }

    if (triggerBlockType === "integration_order_updated" && filters?.orderStatus) {
      const required = String(cfg.orderStatus || "").trim();
      if (required && required !== filters.orderStatus) continue;
    }

    if (
      triggerBlockType === "integration_appointment_scheduled" &&
      filters?.eventTypeName
    ) {
      const required = String(cfg.eventTypeName || "").trim();
      if (required && required !== filters.eventTypeName) continue;
    }

    results.push(
      await enrollInAutomation({ workspaceId, flowId: flow.id, contactId }),
    );
  }
  return results;
}
