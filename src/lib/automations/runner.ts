import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { mergeTemplate } from "@/lib/messaging/template";
import { sendQuickSms } from "@/lib/sms/send-quick";
import {
  findNode,
  getNextNodeId,
  parseAutomationDefinition,
  waitDurationMs,
  type AutomationCanvasNode,
  type AutomationDefinition,
} from "./types";

type ExecutionFacts = {
  review_received?: boolean;
  customer_replied?: boolean;
  link_clicked?: boolean;
  tag_has?: boolean;
};

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"] as const;

async function recordStep(
  executionId: string,
  nodeId: string,
  status: string,
  extra?: {
    branchTaken?: string;
    output?: Prisma.InputJsonValue;
    error?: string;
  },
) {
  const prisma = getPrisma();
  await prisma.automationStepExecution.upsert({
    where: { executionId_nodeId: { executionId, nodeId } },
    create: {
      executionId,
      nodeId,
      status,
      startedAt: new Date(),
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
      branchTaken: extra?.branchTaken,
      output: extra?.output,
      error: extra?.error,
      attemptCount: 1,
    },
    update: {
      status,
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
      branchTaken: extra?.branchTaken,
      output: extra?.output,
      error: extra?.error,
      attemptCount: { increment: 1 },
    },
  });
}

async function completeExecution(
  executionId: string,
  status: "COMPLETED" | "FAILED" | "CANCELLED",
  error?: string,
) {
  const prisma = getPrisma();
  await prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
      failedAt: status === "FAILED" ? new Date() : null,
      error,
      nextActionAt: null,
      currentNodeId: null,
    },
  });
}

function factsFromMetadata(metadata: unknown, contact: {
  customFields?: unknown;
  lastReply?: Date | null;
}): ExecutionFacts {
  const facts: ExecutionFacts = {};
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    facts.review_received = Boolean(m.review_received);
    facts.customer_replied = Boolean(m.customer_replied);
    facts.link_clicked = Boolean(m.link_clicked);
  }
  if (contact.lastReply) facts.customer_replied = true;
  if (contact.customFields && typeof contact.customFields === "object") {
    const cf = contact.customFields as Record<string, unknown>;
    if (cf.review_received) facts.review_received = true;
  }
  return facts;
}

function evaluateCondition(
  node: AutomationCanvasNode,
  facts: ExecutionFacts,
): boolean {
  const cfg = node.data.config || {};
  const field = String(cfg.field || "review_received");
  const operator = String(cfg.operator || "equals");
  const value = String(cfg.value ?? "true");

  let actual: string | boolean = "";
  if (field === "review_received") actual = facts.review_received ? "true" : "false";
  else if (field === "customer_replied") actual = facts.customer_replied ? "true" : "false";
  else if (field === "link_clicked") actual = facts.link_clicked ? "true" : "false";
  else if (field === "tag_has") actual = facts.tag_has ? "true" : "false";

  const actualStr = String(actual);
  switch (operator) {
    case "equals":
      return actualStr === value;
    case "not_equals":
      return actualStr !== value;
    case "exists":
      return actualStr === "true";
    case "not_exists":
      return actualStr !== "true";
    default:
      return actualStr === value;
  }
}

async function mergeMessageBody(
  workspaceId: string,
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null; phone: string },
  body: string,
): Promise<string> {
  const ws = await getPrisma().workspace.findUnique({ where: { id: workspaceId } });
  const reviewLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/review`;
  return mergeTemplate(body, {
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
    name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
    email: contact.email || "",
    phone: contact.phone,
    businessName: ws?.name || "",
    reviewLink,
    "customer.firstName": contact.firstName || "",
    "customer.lastName": contact.lastName || "",
    "customer.email": contact.email || "",
    "customer.phone": contact.phone,
    "business.name": ws?.name || "",
  });
}

async function executeNode(
  executionId: string,
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  workspaceId: string,
  contactId: string,
  facts: ExecutionFacts,
  metadata: unknown,
) {
  const prisma = getPrisma();
  const block = node.data.blockType;
  const cfg = node.data.config || {};
  const testMode =
    metadata && typeof metadata === "object" && (metadata as { testMode?: boolean }).testMode;

  if (node.type === "trigger") {
    const nextId = getNextNodeId(def, node.id);
    if (!nextId) {
      await completeExecution(executionId, "COMPLETED");
      return;
    }
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextId, status: "RUNNING" },
    });
    await recordStep(executionId, node.id, "completed");
    await enqueueAdvance(executionId, workspaceId);
    return;
  }

  if (block === "wait") {
    const ms = waitDurationMs(cfg);
    const nextId = getNextNodeId(def, node.id);
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status: "WAITING",
        currentNodeId: nextId || node.id,
        nextActionAt: new Date(Date.now() + ms),
      },
    });
    await recordStep(executionId, node.id, "completed", {
      output: { waitMs: ms },
    });
    return;
  }

  if (block === "condition") {
    const result = evaluateCondition(node, facts);
    const branch = result ? "yes" : "no";
    const nextId = getNextNodeId(def, node.id, branch);
    await recordStep(executionId, node.id, "completed", { branchTaken: branch });
    if (!nextId) {
      await completeExecution(executionId, "COMPLETED");
      return;
    }
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextId, status: "RUNNING" },
    });
    await enqueueAdvance(executionId, workspaceId);
    return;
  }

  if (block === "send_sms" || block === "send_review_request") {
    const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    if (contact.status !== "SUBSCRIBED" && !testMode) {
      await completeExecution(executionId, "CANCELLED", "contact_opted_out");
      return;
    }

    const stepKey = node.id;
    const existing = await prisma.automationStepExecution.findUnique({
      where: { executionId_nodeId: { executionId, nodeId: stepKey } },
    });
    if (existing?.status === "completed") {
      const nextId = getNextNodeId(def, node.id);
      if (!nextId) {
        await completeExecution(executionId, "COMPLETED");
        return;
      }
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { currentNodeId: nextId, status: "RUNNING" },
      });
      await enqueueAdvance(executionId, workspaceId);
      return;
    }

    const body = await mergeMessageBody(workspaceId, contact, String(cfg.body || ""));
    if (!testMode) {
      try {
        const result = await sendQuickSms({
          workspaceId,
          to: contact.phone,
          body,
          from: cfg.fromNumber ? String(cfg.fromNumber) : undefined,
        });
        await recordStep(executionId, node.id, "completed", {
          output: { messageId: result?.messageId, sid: result?.sid },
        });
        await prisma.automationFlow.update({
          where: { id: (await prisma.automationExecution.findUnique({ where: { id: executionId } }))!.flowId },
          data: { messagesSent: { increment: 1 } },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "send_failed";
        await recordStep(executionId, node.id, "failed", { error: msg });
        await completeExecution(executionId, "FAILED", msg);
        return;
      }
    } else {
      await recordStep(executionId, node.id, "completed", { output: { test: true, body } });
    }

    const nextId = getNextNodeId(def, node.id);
    if (!nextId) {
      await completeExecution(executionId, "COMPLETED");
      return;
    }
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextId, status: "RUNNING" },
    });
    await enqueueAdvance(executionId, workspaceId);
    return;
  }

  if (block === "add_tag" || block === "remove_tag") {
    const tagName = String(cfg.tag || "").trim();
    if (tagName) {
      const tag = await prisma.tag.findFirst({
        where: { workspaceId, name: tagName },
      });
      if (tag && block === "add_tag") {
        await prisma.contactTag.upsert({
          where: { tagId_contactId: { contactId, tagId: tag.id } },
          create: { contactId, tagId: tag.id },
          update: {},
        });
      }
      if (tag && block === "remove_tag") {
        await prisma.contactTag.deleteMany({ where: { contactId, tagId: tag.id } });
      }
    }
    await recordStep(executionId, node.id, "completed");
    const nextId = getNextNodeId(def, node.id);
    if (!nextId) {
      await completeExecution(executionId, "COMPLETED");
      return;
    }
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextId, status: "RUNNING" },
    });
    await enqueueAdvance(executionId, workspaceId);
    return;
  }

  if (block === "end_automation" || node.type === "end") {
    await recordStep(executionId, node.id, "completed");
    await completeExecution(executionId, "COMPLETED");
    return;
  }

  // Unknown — skip to next or complete
  const nextId = getNextNodeId(def, node.id);
  if (nextId) {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextId, status: "RUNNING" },
    });
    await enqueueAdvance(executionId, workspaceId);
  } else {
    await completeExecution(executionId, "COMPLETED");
  }
}

async function enqueueAdvance(executionId: string, workspaceId: string) {
  await enqueueJob({
    jobType: "automation_advance",
    queueName: "automations",
    workspaceId,
    payload: { executionId },
    idempotencyKey: `automation-advance:${executionId}:${Date.now()}`,
  });
}

export async function advanceAutomationExecution(executionId: string) {
  const prisma = getPrisma();
  const execution = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    include: { flow: true, contact: true },
  });
  if (!execution) return { skipped: true };

  if (TERMINAL.includes(execution.status as typeof TERMINAL[number])) {
    return { skipped: true };
  }

  if (execution.flow.status === "PAUSED" && !execution.metadata) {
    return { skipped: true, reason: "flow_paused" };
  }

  const rawDef =
    execution.flow.publishedDefinition ?? execution.flow.definition;
  const def = parseAutomationDefinition(rawDef);
  const node = findNode(def, execution.currentNodeId);
  if (!node) {
    await completeExecution(executionId, "FAILED", "missing_current_node");
    return { failed: true };
  }

  const facts = factsFromMetadata(execution.metadata, execution.contact);

  for (let guard = 0; guard < 15; guard += 1) {
    const live = await prisma.automationExecution.findUnique({
      where: { id: executionId },
    });
    if (!live || TERMINAL.includes(live.status as typeof TERMINAL[number])) {
      return { done: true };
    }
    if (live.status === "WAITING") {
      return { waiting: true };
    }

    const currentNode = findNode(def, live.currentNodeId);
    if (!currentNode) break;

    await executeNode(
      executionId,
      currentNode,
      def,
      execution.workspaceId,
      execution.contactId,
      facts,
      execution.metadata,
    );

    const after = await prisma.automationExecution.findUnique({
      where: { id: executionId },
    });
    if (!after || TERMINAL.includes(after.status as typeof TERMINAL[number])) {
      return { done: true };
    }
    if (after.status === "WAITING") {
      return { waiting: true };
    }
    if (after.currentNodeId === currentNode.id) {
      break;
    }
  }

  return { ok: true };
}

export async function processAutomationWaits() {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.automationExecution.findMany({
    where: {
      status: "WAITING",
      nextActionAt: { lte: now },
    },
    take: 50,
    include: { flow: true },
  });

  let advanced = 0;
  for (const ex of due) {
    if (ex.flow.status !== "ACTIVE") continue;
    await prisma.automationExecution.update({
      where: { id: ex.id },
      data: { status: "RUNNING", nextActionAt: null },
    });
    await enqueueJob({
      jobType: "automation_advance",
      queueName: "automations",
      workspaceId: ex.workspaceId,
      payload: { executionId: ex.id },
      idempotencyKey: `automation-advance:${ex.id}:wake`,
    });
    advanced += 1;
  }
  return { advanced };
}

export async function processActiveAutomations() {
  await processAutomationWaits();
  return { ok: true };
}
