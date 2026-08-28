/**
 * True event waits — suspend execution until matching event or timeout.
 * Persists state in execution metadata (survives restart).
 */

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import type { AutomationCanvasNode, AutomationDefinition } from "../types";
import { mergeExecutionMetadata } from "../metadata";
import { waitDurationMs } from "../types";
import { matchInboundMessage, waitForReplyOutcome } from "./message-matching";
import { outcomeResult } from "./resolve-outcome";
import { fieldTypeForContactField } from "../block-registry";

export type EventWaitState = {
  eventWaitActive: true;
  eventWaitType: string;
  eventWaitNodeId: string;
  eventWaitDeadline: number;
  eventWaitConfig: Record<string, unknown>;
  eventWaitConsumed?: boolean;
  eventWaitOutcome?: string;
};

const EVENT_WAIT_BLOCKS = new Set([
  "wait_for_reply",
  "wait_for_link_click",
  "wait_for_workflow_message_click",
  "wait_for_customer_field_change",
]);

export function isEventWaitBlock(blockType: string): boolean {
  return EVENT_WAIT_BLOCKS.has(blockType);
}

function eventWaitKey(nodeId: string): string {
  return `eventWait:${nodeId}`;
}

export async function readEventWaitState(
  executionId: string,
  nodeId: string,
): Promise<EventWaitState | null> {
  const prisma = getPrisma();
  const ex = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    select: { metadata: true },
  });
  const meta = (ex?.metadata || {}) as Record<string, unknown>;
  const state = meta[eventWaitKey(nodeId)] as EventWaitState | undefined;
  if (!state?.eventWaitActive) return null;
  return state;
}

async function writeEventWaitState(
  executionId: string,
  nodeId: string,
  state: EventWaitState | null,
) {
  await mergeExecutionMetadata(executionId, {
    [eventWaitKey(nodeId)]: state,
    eventWaitActive: state?.eventWaitActive === true,
  });
}

function evaluateFieldCondition(
  field: string,
  operator: string,
  value: string,
  valueEnd: string,
  contact: Record<string, unknown>,
): boolean {
  const fieldType = fieldTypeForContactField(field);
  const raw =
    contact[field] ??
    (contact.customFields && typeof contact.customFields === "object"
      ? (contact.customFields as Record<string, unknown>)[field]
      : "");
  const actual = raw == null ? "" : String(raw);

  if (operator === "has_value") return actual.trim().length > 0;
  if (operator === "has_no_value") return actual.trim().length === 0;

  if (fieldType === "number") {
    const n = Number(actual);
    const target = Number(value);
    const end = Number(valueEnd);
    if (operator === "equals") return n === target;
    if (operator === "not_equal") return n !== target;
    if (operator === "greater_than") return n > target;
    if (operator === "less_than") return n < target;
    if (operator === "between") return n >= target && n <= end;
  }

  if (operator === "is" || operator === "equals") return actual === value;
  if (operator === "is_not" || operator === "not_equal") return actual !== value;
  if (operator === "contains") return actual.includes(value);
  if (operator === "not_contains") return !actual.includes(value);
  if (operator === "starts_with") return actual.startsWith(value);
  if (operator === "ends_with") return actual.endsWith(value);
  return false;
}

export async function runEventWaitNode(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: {
    executionId: string;
    workspaceId: string;
    contactId: string;
  },
): Promise<{
  waiting?: boolean;
  waitMs?: number;
  nextNodeId?: string | null;
  output?: Prisma.InputJsonValue;
}> {
  const block = node.data.blockType;
  const cfg = node.data.config || {};
  const existing = await readEventWaitState(ctx.executionId, node.id);

  if (existing?.eventWaitConsumed && existing.eventWaitOutcome) {
    await writeEventWaitState(ctx.executionId, node.id, null);
    return outcomeResult(def, node.id, existing.eventWaitOutcome);
  }

  if (existing?.eventWaitActive) {
    if (Date.now() < existing.eventWaitDeadline) {
      return {
        waiting: true,
        waitMs: Math.max(existing.eventWaitDeadline - Date.now(), 1_000),
        nextNodeId: node.id,
        output: { eventWaitActive: true, spuriousWake: true },
      };
    }
    const timeoutOutcome =
      block === "wait_for_customer_field_change" ? "timed_out" : "timed_out";
    const replyTimeout = block === "wait_for_reply" ? "no_reply" : timeoutOutcome;
    await writeEventWaitState(ctx.executionId, node.id, {
      ...existing,
      eventWaitActive: false,
      eventWaitConsumed: true,
      eventWaitOutcome: replyTimeout,
    });
    return outcomeResult(def, node.id, replyTimeout, { timedOut: true });
  }

  // Immediate satisfaction for field-change wait.
  if (block === "wait_for_customer_field_change") {
    const prisma = getPrisma();
    const contact = await prisma.contact.findUnique({ where: { id: ctx.contactId } });
    if (contact) {
      const field = String(cfg.field || "company");
      const operator = String(cfg.operator || "is");
      const value = String(cfg.value ?? "");
      const valueEnd = String(cfg.valueEnd ?? "");
      const met = evaluateFieldCondition(
        field,
        operator,
        value,
        valueEnd,
        contact as unknown as Record<string, unknown>,
      );
      if (met) {
        return outcomeResult(def, node.id, "condition_met", { immediate: true });
      }
    }
  }

  const waitMs = waitDurationMs(cfg);
  const deadline = Date.now() + waitMs;
  const state: EventWaitState = {
    eventWaitActive: true,
    eventWaitType: block,
    eventWaitNodeId: node.id,
    eventWaitDeadline: deadline,
    eventWaitConfig: cfg,
    eventWaitConsumed: false,
  };
  await writeEventWaitState(ctx.executionId, node.id, state);

  return {
    waiting: true,
    waitMs,
    nextNodeId: node.id,
    output: { eventWaitActive: true, eventWaitType: block },
  };
}

/** Resume event waits on inbound SMS. */
export async function resumeEventWaitsOnInboundMessage(input: {
  workspaceId: string;
  contactId: string;
  body: string;
  messageId?: string | null;
}) {
  const prisma = getPrisma();
  const waiting = await prisma.automationExecution.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: "WAITING",
    },
    take: 20,
  });

  const { enqueueJob: enqueue } = await import("@/lib/messaging/enqueue-advance");
  let resumed = 0;

  for (const ex of waiting) {
    const meta = (ex.metadata || {}) as Record<string, unknown>;
    if (!meta.eventWaitActive) continue;
    if (!ex.currentNodeId) continue;

    const state = meta[eventWaitKey(ex.currentNodeId)] as EventWaitState | undefined;
    if (!state?.eventWaitActive || state.eventWaitConsumed) continue;
    if (state.eventWaitType !== "wait_for_reply") continue;

    const match = matchInboundMessage(input.body, state.eventWaitConfig);
    const outcome = waitForReplyOutcome(state.eventWaitConfig, match, false);

    // Save extracted data before branching.
    if (state.eventWaitConfig.saveDetectedData === true) {
      const saveField = String(state.eventWaitConfig.saveField || "");
      const saveVar = String(state.eventWaitConfig.saveVariableName || "");
      const patch: Record<string, unknown> = {};
      if (saveVar) {
        patch.workflowVariables = {
          ...((meta.workflowVariables || {}) as Record<string, unknown>),
          [saveVar]: match.extractedEmail || match.extractedPhone || input.body,
        };
      }
      if (saveField && match.extractedEmail) {
        await prisma.contact.update({
          where: { id: input.contactId },
          data: { email: match.extractedEmail },
        });
      }
      if (Object.keys(patch).length) {
        await mergeExecutionMetadata(ex.id, patch);
      }
    }

    const claimed = await prisma.automationExecution.updateMany({
      where: {
        id: ex.id,
        status: "WAITING",
      },
      data: {
        status: "RUNNING",
        nextActionAt: null,
        metadata: {
          ...meta,
          [eventWaitKey(ex.currentNodeId)]: {
            ...state,
            eventWaitActive: false,
            eventWaitConsumed: true,
            eventWaitOutcome: outcome,
          },
          eventWaitActive: false,
          inboundReplyBody: input.body.slice(0, 500),
          inboundReplyMessageId: input.messageId || null,
        } as Prisma.InputJsonValue,
      },
    });

    if (claimed.count === 1) {
      await enqueue({
        jobType: "automation_advance",
        queueName: "automations",
        workspaceId: input.workspaceId,
        payload: { executionId: ex.id },
        idempotencyKey: `automation-advance:${ex.id}:reply:${input.messageId || Date.now()}`,
      });
      resumed += 1;
    }
  }

  return { resumed };
}

/** Resume link-click event waits. */
export async function resumeEventWaitsOnLinkClick(input: {
  workspaceId: string;
  contactId: string;
  trackingToken?: string;
  messageId?: string | null;
  destinationUrl?: string | null;
  linkClickEventId?: string;
}) {
  const prisma = getPrisma();
  const waiting = await prisma.automationExecution.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: "WAITING",
    },
    take: 20,
  });

  let resumed = 0;
  for (const ex of waiting) {
    const meta = (ex.metadata || {}) as Record<string, unknown>;
    if (!meta.eventWaitActive || !ex.currentNodeId) continue;
    const state = meta[eventWaitKey(ex.currentNodeId)] as EventWaitState | undefined;
    if (!state?.eventWaitActive || state.eventWaitConsumed) continue;
    if (
      state.eventWaitType !== "wait_for_link_click" &&
      state.eventWaitType !== "wait_for_workflow_message_click"
    ) {
      continue;
    }

    const cfg = state.eventWaitConfig;
    const linkMode = String(cfg.linkMode || "any");
    if (linkMode === "specific" && cfg.trackedLinkId && cfg.trackedLinkId !== input.trackingToken) {
      continue;
    }
    if (
      state.eventWaitType === "wait_for_workflow_message_click" &&
      cfg.sendSmsNodeId
    ) {
      const step = await prisma.automationStepExecution.findUnique({
        where: {
          executionId_nodeId: {
            executionId: ex.id,
            nodeId: String(cfg.sendSmsNodeId),
          },
        },
      });
      const out = (step?.output || {}) as Record<string, unknown>;
      const msgId = typeof out.messageId === "string" ? out.messageId : null;
      if (msgId && input.messageId && msgId !== input.messageId) continue;
    }

    const claimed = await prisma.automationExecution.updateMany({
      where: { id: ex.id, status: "WAITING" },
      data: {
        status: "RUNNING",
        nextActionAt: null,
        metadata: {
          ...meta,
          [eventWaitKey(ex.currentNodeId)]: {
            ...state,
            eventWaitActive: false,
            eventWaitConsumed: true,
            eventWaitOutcome: "clicked",
          },
          eventWaitActive: false,
          clickedUrl: input.destinationUrl || null,
          clickedAt: new Date().toISOString(),
          linkClickEventId: input.linkClickEventId || null,
        } as Prisma.InputJsonValue,
      },
    });

    if (claimed.count === 1) {
      await enqueueJob({
        jobType: "automation_advance",
        queueName: "automations",
        workspaceId: input.workspaceId,
        payload: { executionId: ex.id },
        idempotencyKey: `automation-advance:${ex.id}:link:${input.linkClickEventId || input.trackingToken}`,
      });
      resumed += 1;
    }
  }
  return { resumed };
}

/** Resume field-change waits when contact is updated. */
export async function resumeEventWaitsOnFieldChange(input: {
  workspaceId: string;
  contactId: string;
  field: string;
  contact: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const waiting = await prisma.automationExecution.findMany({
    where: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      status: "WAITING",
    },
    take: 20,
  });

  let resumed = 0;
  for (const ex of waiting) {
    const meta = (ex.metadata || {}) as Record<string, unknown>;
    if (!meta.eventWaitActive || !ex.currentNodeId) continue;
    const state = meta[eventWaitKey(ex.currentNodeId)] as EventWaitState | undefined;
    if (!state?.eventWaitActive || state.eventWaitType !== "wait_for_customer_field_change") {
      continue;
    }
    const cfg = state.eventWaitConfig;
    const watchField = String(cfg.field || "");
    if (watchField && watchField !== input.field) continue;

    const met = evaluateFieldCondition(
      watchField,
      String(cfg.operator || "is"),
      String(cfg.value ?? ""),
      String(cfg.valueEnd ?? ""),
      input.contact,
    );
    if (!met) continue;

    const claimed = await prisma.automationExecution.updateMany({
      where: { id: ex.id, status: "WAITING" },
      data: {
        status: "RUNNING",
        nextActionAt: null,
        metadata: {
          ...meta,
          [eventWaitKey(ex.currentNodeId)]: {
            ...state,
            eventWaitActive: false,
            eventWaitConsumed: true,
            eventWaitOutcome: "condition_met",
          },
          eventWaitActive: false,
        } as Prisma.InputJsonValue,
      },
    });

    if (claimed.count === 1) {
      await enqueueJob({
        jobType: "automation_advance",
        queueName: "automations",
        workspaceId: input.workspaceId,
        payload: { executionId: ex.id },
        idempotencyKey: `automation-advance:${ex.id}:field:${input.field}`,
      });
      resumed += 1;
    }
  }
  return { resumed };
}

/** Handle event wait timeout from processAutomationWaits. */
export async function handleEventWaitTimeout(executionId: string, currentNodeId: string) {
  const state = await readEventWaitState(executionId, currentNodeId);
  if (!state?.eventWaitActive) return null;
  if (Date.now() < state.eventWaitDeadline) return null;

  const outcome =
    state.eventWaitType === "wait_for_reply"
      ? "no_reply"
      : "timed_out";

  await writeEventWaitState(executionId, currentNodeId, {
    ...state,
    eventWaitActive: false,
    eventWaitConsumed: true,
    eventWaitOutcome: outcome,
  });

  return outcome;
}
