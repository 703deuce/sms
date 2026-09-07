import { getPrisma, type DbRow } from "@/lib/db";
import type { AutomationCanvasNode } from "../types";
import type { ExecutionFacts } from "../metadata";
import { isContactOnLists } from "./list-actions";
import {
  evaluateInboxCondition,
  resolveConversationForExecution,
} from "./inbox-actions";

export async function evaluateParityCondition(
  node: AutomationCanvasNode,
  ctx: {
    workspaceId: string;
    contactId: string;
    executionId: string;
    facts: ExecutionFacts;
    metadata: Record<string, unknown>;
  },
): Promise<string> {
  const block = node.data.blockType;
  const cfg = node.data.config || {};
  const prisma = getPrisma();

  if (block === "condition_contact_on_list") {
    const listIds = Array.isArray(cfg.listIds) ? (cfg.listIds as string[]) : [];
    const match = await isContactOnLists(
      ctx.workspaceId,
      ctx.contactId,
      listIds,
      String(cfg.matchMode || "any"),
    );
    return match ? "yes" : "no";
  }

  if (block === "condition_contact_segment") {
    const segmentId = String(cfg.segmentId || "").trim();
    const segmentIds = Array.isArray(cfg.segmentIds)
      ? (cfg.segmentIds as string[]).map(String).filter(Boolean)
      : segmentId
        ? [segmentId]
        : [];
    if (!segmentIds.length) return "no";
    const { contactMatchesSavedSegments } = await import("./segment-match");
    const match = await contactMatchesSavedSegments(
      ctx.workspaceId,
      ctx.contactId,
      segmentIds,
      String(cfg.matchMode || "any"),
    );
    return match ? "yes" : "no";
  }

  if (block === "condition_general_link_clicked") {
    const clicked = Boolean(ctx.facts.link_clicked);
    if (!clicked && cfg.timeframe !== "ever") {
      const since = new Date();
      const days = Number(cfg.timeframeDays || 30);
      if (String(cfg.timeframe) === "since_workflow_started") {
        const exec = await prisma.automationExecution.findUnique({
          where: { id: ctx.executionId },
          select: { startedAt: true },
        });
        if (exec) {
          const count = await prisma.linkClickEvent.count({
            where: {
              workspaceId: ctx.workspaceId,
              contactId: ctx.contactId,
              createdAt: { gte: exec.startedAt },
            },
          });
          return count > 0 ? "yes" : "no";
        }
      } else if (String(cfg.timeframe) === "within_last") {
        since.setDate(since.getDate() - days);
        const count = await prisma.linkClickEvent.count({
          where: {
            workspaceId: ctx.workspaceId,
            contactId: ctx.contactId,
            createdAt: { gte: since },
          },
        });
        return count > 0 ? "yes" : "no";
      }
    }
    return clicked ? "yes" : "no";
  }

  if (block === "condition_workflow_message_clicked") {
    const nodeId = String(cfg.sendSmsNodeId || "");
    const exec = await prisma.automationExecution.findUnique({
      where: { id: ctx.executionId },
      include: { steps: true },
    });
    const step = exec?.steps.find((s: DbRow) => s.nodeId === nodeId);
    const output = (step?.output || {}) as Record<string, unknown>;
    const messageId = typeof output.messageId === "string" ? output.messageId : null;
    if (!messageId) return ctx.facts.link_clicked ? "yes" : "no";
    const count = await prisma.linkClickEvent.count({
      where: { workspaceId: ctx.workspaceId, contactId: ctx.contactId, messageId },
    });
    return count > 0 ? "yes" : "no";
  }

  if (
    block === "condition_inbox_assignee" ||
    block === "condition_inbox_tags" ||
    block === "condition_inbox_status" ||
    block === "condition_inbox_unread"
  ) {
    const conversation = await resolveConversationForExecution(
      ctx.workspaceId,
      ctx.contactId,
      ctx.metadata,
    );
    return evaluateInboxCondition(block, cfg, conversation);
  }

  if (block === "condition_sms_opt_in_status") {
    const contact = await prisma.contact.findFirst({
      where: { id: ctx.contactId, workspaceId: ctx.workspaceId },
      select: { status: true },
    });
    if (!contact) return "no";
    const mode = String(cfg.mode || "compare");
    if (mode === "branch") {
      return contact.status.toLowerCase();
    }
    const compare = String(cfg.compareStatus || "SUBSCRIBED").toUpperCase();
    const is = cfg.match !== "is_not";
    const match = contact.status === compare;
    return match === is ? "yes" : "no";
  }

  if (block === "condition_has_ever_unsubscribed") {
    const contact = await prisma.contact.findFirst({
      where: { id: ctx.contactId, workspaceId: ctx.workspaceId },
      select: { phone: true },
    });
    if (!contact) return "no";
    const since = new Date();
    const days = Number(cfg.timeframeDays || 0);
    if (days > 0) since.setDate(since.getDate() - days);
    const count = await prisma.suppression.count({
      where: {
        workspaceId: ctx.workspaceId,
        phone: contact.phone,
        reason: { in: ["STOP", "UNSUBSCRIBED", "OPT_OUT"] },
        ...(days > 0 ? { createdAt: { gte: since } } : {}),
      },
    });
    return count > 0 ? "yes" : "no";
  }

  if (block === "condition_message_sentiment") {
    const conversation = await resolveConversationForExecution(
      ctx.workspaceId,
      ctx.contactId,
      ctx.metadata,
    );
    if (!conversation) return "unknown";
    const msg = await prisma.conversationMessage.findFirst({
      where: { conversationId: conversation.id, direction: "inbound" },
      orderBy: { createdAt: "desc" },
    });
    if (!msg?.body) return "unknown";
    const body = msg.body.toLowerCase();
    const positive = ["thanks", "great", "love", "awesome", "perfect", "yes"];
    const negative = ["angry", "bad", "hate", "terrible", "worst", "no", "stop"];
    const pos = positive.some((w) => body.includes(w));
    const neg = negative.some((w) => body.includes(w));
    if (pos && neg) return "mixed";
    if (pos) return "positive";
    if (neg) return "negative";
    return "neutral";
  }

  if (block === "condition_workflow_status") {
    const flowId = String(cfg.flowId || "");
    if (!flowId) return "not_started";
    const exec = await prisma.automationExecution.findFirst({
      where: { workspaceId: ctx.workspaceId, flowId, contactId: ctx.contactId },
      orderBy: { startedAt: "desc" },
    });
    if (!exec) return "not_started";
    if (["COMPLETED", "CANCELLED"].includes(exec.status)) return "finished";
    return "in_progress";
  }

  if (block === "condition_business_hours") {
    const { getMessagingRuntimeSettings, isWithinBusinessHours } = await import(
      "@/lib/messaging/messaging-settings"
    );
    const settings = await getMessagingRuntimeSettings(ctx.workspaceId);
    const within = isWithinBusinessHours(settings);
    const check = String(cfg.checkType || "during");
    if (check === "during") return within ? "yes" : "no";
    if (check === "outside") return within ? "no" : "yes";
    return within ? "yes" : "no";
  }

  // Ecommerce conditions — only when integration metadata present on execution.
  const ecommerce = (ctx.metadata.ecommerce || {}) as Record<string, unknown>;
  if (block === "condition_order_status") {
    const status = String(cfg.status || "").toLowerCase();
    const actual = String(ecommerce.orderStatus || "").toLowerCase();
    return actual === status ? "yes" : "no";
  }
  if (block === "condition_order_value" || block === "condition_cart_value") {
    const amount = Number(ecommerce.orderTotal ?? ecommerce.cartTotal ?? 0);
    const target = Number(cfg.amount || 0);
    const op = String(cfg.operator || "greater_than");
    if (op === "greater_than") return amount > target ? "yes" : "no";
    if (op === "less_than") return amount < target ? "yes" : "no";
    return amount === target ? "yes" : "no";
  }

  return "no";
}

export function isParityConditionBlock(blockType: string): boolean {
  return blockType.startsWith("condition_") && ![
    "condition",
    "condition_customer_field",
    "condition_review_status",
    "condition_message_status",
    "condition_tag",
    "condition_has_responded",
  ].includes(blockType);
}
