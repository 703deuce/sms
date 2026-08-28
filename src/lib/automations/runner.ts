import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { runNodeAction } from "./actions";
import { factsFromMetadata } from "./metadata";
import { isConditionBlock } from "./catalog";
import { findNode, parseAutomationDefinition } from "./types";
import { handleEventWaitTimeout, isEventWaitBlock } from "./parity/event-waits";

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
  const completed = status === "COMPLETED";
  await prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      status,
      completedAt: completed ? new Date() : null,
      failedAt: status === "FAILED" ? new Date() : null,
      error,
      nextActionAt: null,
      currentNodeId: null,
    },
  });
  const ex = await prisma.automationExecution.findUnique({
    where: { id: executionId },
  });
  if (completed && ex) {
    const total = await prisma.automationExecution.count({
      where: { flowId: ex.flowId, status: "COMPLETED" },
    });
    const enrolled = await prisma.automationExecution.count({
      where: { flowId: ex.flowId },
    });
    await prisma.automationFlow.update({
      where: { id: ex.flowId },
      data: {
        completionRate: enrolled > 0 ? (total / enrolled) * 100 : 0,
      },
    });
  }
  if (ex && (status === "COMPLETED" || status === "FAILED")) {
    try {
      const { emitPlatformEvent } = await import("@/lib/platform/events");
      await emitPlatformEvent({
        workspaceId: ex.workspaceId,
        type: status === "COMPLETED" ? "AUTOMATION_COMPLETED" : "AUTOMATION_FAILED",
        contactId: ex.contactId,
        automationId: ex.flowId,
        payload: { executionId, error: error || null },
        idempotencyKey: `automation-${status.toLowerCase()}:${executionId}`,
      });
    } catch {
      /* non-fatal */
    }
  }
}

async function getContactTags(contactId: string): Promise<string[]> {
  const rows = await getPrisma().contactTag.findMany({
    where: { contactId },
    include: { tag: true },
  });
  return rows.map((r: typeof rows[number]) => r.tag.name);
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

  if (execution.flow.status === "PAUSED") {
    return { skipped: true, reason: "flow_paused" };
  }

  if (execution.status === "PAUSED") {
    return { skipped: true, reason: "execution_paused" };
  }

  const rawDef = execution.flow.publishedDefinition ?? execution.flow.definition;
  const def = parseAutomationDefinition(rawDef);

  const testMode =
    execution.metadata &&
    typeof execution.metadata === "object" &&
    (execution.metadata as { testMode?: boolean }).testMode;

  const tagNames = await getContactTags(execution.contactId);
  const facts = factsFromMetadata(execution.metadata, execution.contact, tagNames);

  for (let guard = 0; guard < 20; guard += 1) {
    const live = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    if (!live || TERMINAL.includes(live.status as typeof TERMINAL[number])) {
      return { done: true };
    }
    if (live.status === "WAITING") {
      return { waiting: true };
    }

    const node = findNode(def, live.currentNodeId);
    if (!node) {
      await completeExecution(executionId, "FAILED", "missing_current_node");
      return { failed: true };
    }

    const block = node.data.blockType;
    const isSend =
      block === "send_sms" ||
      block === "send_review_request" ||
      block === "send_email";
    if (isSend) {
      const existing = await prisma.automationStepExecution.findUnique({
        where: { executionId_nodeId: { executionId, nodeId: node.id } },
      });
      if (existing?.status === "completed") {
        const nextId = def.edges.find((e) => e.source === node.id)?.target;
        if (!nextId) {
          await completeExecution(executionId, "COMPLETED");
          return { done: true };
        }
        await prisma.automationExecution.update({
          where: { id: executionId },
          data: { currentNodeId: nextId, status: "RUNNING" },
        });
        continue;
      }
    }

    const result = await runNodeAction(node, def, {
      executionId,
      workspaceId: execution.workspaceId,
      contactId: execution.contactId,
      flowId: execution.flowId,
      facts,
      tagNames,
      testMode: Boolean(testMode),
    });

    if (result.error && result.error !== "contact_opted_out") {
      await recordStep(executionId, node.id, "failed", { error: result.error });
      await completeExecution(executionId, "FAILED", result.error);
      return { failed: true };
    }

    if (result.done || result.error === "contact_opted_out") {
      await recordStep(executionId, node.id, "completed", { output: result.output });
      await completeExecution(executionId, result.error ? "CANCELLED" : "COMPLETED", result.error);
      return { done: true };
    }

    if (result.waiting && result.waitMs) {
      const waitStatus =
        node.data.blockType === "wait_for_call_result" || isEventWaitBlock(node.data.blockType)
          ? "waiting"
          : "completed";
      await recordStep(executionId, node.id, waitStatus, {
        output: { waitMs: result.waitMs, ...(result.output as object) },
      });
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: {
          status: "WAITING",
          currentNodeId: result.nextNodeId || node.id,
          nextActionAt: new Date(Date.now() + result.waitMs),
        },
      });
      return { waiting: true };
    }

    const branchTaken =
      result.output &&
      typeof result.output === "object" &&
      "branch" in (result.output as object)
        ? String((result.output as { branch?: string }).branch)
        : undefined;

    await recordStep(executionId, node.id, "completed", {
      branchTaken,
      output: result.output,
    });

    const nextId = result.nextNodeId;
    if (!nextId) {
      await completeExecution(executionId, "COMPLETED");
      return { done: true };
    }

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextId, status: "RUNNING" },
    });

    const nextNode = findNode(def, nextId);
    // Keep advancing through graph-native control blocks in this job.
    // Critical: wait_for_call_result must run here so WAITING + waitingForCallResult
    // are set before the call ends (otherwise resume never wakes the execution).
    if (
      nextNode &&
      (isConditionBlock(nextNode.data.blockType) ||
        nextNode.data.blockType === "wait" ||
        nextNode.data.blockType === "wait_until_datetime" ||
        nextNode.data.blockType === "wait_for_call_result" ||
        isEventWaitBlock(nextNode.data.blockType) ||
        nextNode.data.blockType === "end_automation" ||
        nextNode.type === "trigger")
    ) {
      continue;
    }
    return { ok: true };
  }

  return { ok: true };
}

export async function processAutomationWaits() {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.automationExecution.findMany({
    where: { status: "WAITING", nextActionAt: { lte: now } },
    take: 50,
    include: { flow: true },
  });

  let advanced = 0;
  for (const ex of due) {
    if (ex.flow.status !== "ACTIVE") continue;

    const meta = (ex.metadata || {}) as Record<string, unknown>;
    if (meta.eventWaitActive === true && ex.currentNodeId) {
      const { readEventWaitState } = await import("./parity/event-waits");
      const state = await readEventWaitState(ex.id, ex.currentNodeId);
      if (state?.eventWaitActive) {
        const timeoutOutcome = await handleEventWaitTimeout(ex.id, ex.currentNodeId);
        if (!timeoutOutcome) {
          continue;
        }
      }
    } else {
      try {
        const { emitNoResponseAfterWait } = await import("./stop-on-reply");
        await emitNoResponseAfterWait(ex.workspaceId, ex.contactId, ex.id);
      } catch {
        /* non-fatal */
      }
    }

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

export async function processScheduledAutomations() {
  const prisma = getPrisma();
  const flows = await prisma.automationFlow.findMany({
    where: { status: "ACTIVE" },
    take: 30,
  });
  let enrolled = 0;
  for (const flow of flows) {
    const def = parseAutomationDefinition(flow.publishedDefinition ?? flow.definition);
    const trigger = def.nodes.find((n) => n.type === "trigger");
    if (!trigger || trigger.data.blockType !== "scheduled_datetime") continue;
    const runAt = String(trigger.data.config?.runAt || "");
    if (!runAt) continue;
    const target = new Date(runAt);
    const now = Date.now();
    const MAX_LATE_MS = 24 * 60 * 60_000;
    if (target.getTime() > now) continue;
    if (target.getTime() < now - MAX_LATE_MS) continue;

    const key = `scheduled:${flow.id}:${runAt}`;
    const fired = await prisma.auditLog.findFirst({
      where: { workspaceId: flow.workspaceId, event: "automation.scheduled", detail: { contains: key } },
    });
    if (fired) continue;

    const scope = String(trigger.data.config?.enrollScope || "all_subscribed");
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: flow.workspaceId, status: "SUBSCRIBED" },
      take: scope === "all_subscribed" ? 500 : 100,
    });

    const { enrollInAutomation } = await import("./enroll");
    for (const c of contacts) {
      await enrollInAutomation({
        workspaceId: flow.workspaceId,
        flowId: flow.id,
        contactId: c.id,
      }).catch(() => undefined);
      enrolled += 1;
    }

    await prisma.auditLog.create({
      data: {
        workspaceId: flow.workspaceId,
        event: "automation.scheduled",
        detail: key,
      },
    });
  }
  return { enrolled };
}

export async function processActiveAutomations() {
  await processAutomationWaits();
  await processScheduledAutomations();
  const { processContactBirthdayTriggers } = await import("./parity/birthday-processor");
  await processContactBirthdayTriggers();
  return { ok: true };
}
