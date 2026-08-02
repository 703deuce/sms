import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { mergeTemplate } from "@/lib/messaging/template";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { enrollInAutomation } from "./enroll";
import { mergeExecutionMetadata, type ExecutionFacts } from "./metadata";
import { isConditionBlock } from "./catalog";
import type { AutomationCanvasNode, AutomationDefinition } from "./types";
import { getNextNodeId, waitDurationMs, waitUntilMs } from "./types";

export async function mergeMessageVars(
  workspaceId: string,
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone: string;
  },
  body: string,
): Promise<string> {
  const ws = await getPrisma().workspace.findUnique({ where: { id: workspaceId } });
  const { resolveReviewLink } = await import("@/lib/messaging/review-link");
  const reviewLink = await resolveReviewLink(workspaceId);
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

export function evaluateConditionNode(
  node: AutomationCanvasNode,
  facts: ExecutionFacts,
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    company?: string | null;
    customFields?: unknown;
  },
  tagNames: string[],
): boolean {
  const cfg = node.data.config || {};
  let field = String(cfg.field || "review_received");
  if (node.data.blockType === "condition_tag") {
    field = "tag_has";
    if (cfg.tag) facts.tag_has = tagNames.includes(String(cfg.tag));
  }
  if (node.data.blockType === "condition_review_status") field = "review_received";
  if (node.data.blockType === "condition_message_status") field = "message_delivered";
  if (node.data.blockType === "condition_has_responded") field = "customer_replied";
  if (node.data.blockType === "condition_customer_field") {
    const cfField = String(cfg.field || "company");
    const val = (contact as Record<string, unknown>)[cfField] ||
      (contact.customFields && typeof contact.customFields === "object"
        ? (contact.customFields as Record<string, unknown>)[cfField]
        : "");
    const operator = String(cfg.operator || "exists");
    const expected = String(cfg.value ?? "");
    if (operator === "exists") return Boolean(val);
    if (operator === "not_exists") return !val;
    if (operator === "contains") return String(val).includes(expected);
    if (operator === "not_contains") return !String(val).includes(expected);
    if (operator === "equals") return String(val) === expected;
    if (operator === "not_equals") return String(val) !== expected;
    return String(val) === expected;
  }

  const operator = String(cfg.operator || "equals");
  const value = String(cfg.value ?? "true");

  let actual = "";
  if (field === "review_received") actual = facts.review_received ? "true" : "false";
  else if (field === "positive_review") actual = facts.positive_review ? "true" : "false";
  else if (field === "negative_feedback") actual = facts.negative_feedback ? "true" : "false";
  else if (field === "customer_replied") actual = facts.customer_replied ? "true" : "false";
  else if (field === "link_clicked") actual = facts.link_clicked ? "true" : "false";
  else if (field === "message_delivered") actual = facts.message_delivered ? "true" : "false";
  else if (field === "tag_has") actual = facts.tag_has ? "true" : "false";
  else if (field === "no_response") actual = facts.no_response ? "true" : "false";

  switch (operator) {
    case "equals":
      return actual === value;
    case "not_equals":
      return actual !== value;
    case "exists":
      return actual === "true";
    case "not_exists":
      return actual !== "true";
    default:
      return actual === value;
  }
}

export async function executeWebhook(
  workspaceId: string,
  contactId: string,
  config: Record<string, unknown>,
) {
  const url = String(config.url || "").trim();
  if (!url) return { skipped: true };
  const contact = await getPrisma().contact.findUnique({ where: { id: contactId } });
  if (!contact) return { error: "contact_not_found" };
  const res = await fetch(url, {
    method: String(config.method || "POST"),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      contact: {
        id: contact.id,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
      },
    }),
  });
  return { status: res.status, ok: res.ok };
}

export async function cancelExecutionsInFlow(
  workspaceId: string,
  contactId: string,
  flowId: string,
) {
  await getPrisma().automationExecution.updateMany({
    where: {
      workspaceId,
      contactId,
      flowId,
      status: { in: ["RUNNING", "WAITING", "PAUSED"] },
    },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
      error: "removed_by_automation",
    },
  });
}

export type StepResult = {
  done?: boolean;
  waiting?: boolean;
  waitMs?: number;
  nextNodeId?: string | null;
  output?: Prisma.InputJsonValue;
  error?: string;
};

export async function runNodeAction(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: {
    executionId: string;
    workspaceId: string;
    contactId: string;
    flowId: string;
    facts: ExecutionFacts;
    tagNames: string[];
    testMode: boolean;
  },
): Promise<StepResult> {
  const prisma = getPrisma();
  const block = node.data.blockType;
  const cfg = node.data.config || {};
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: ctx.contactId } });

  if (node.type === "trigger") {
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "wait") {
    const ms = waitDurationMs(cfg);
    return {
      waiting: true,
      waitMs: ms,
      nextNodeId: getNextNodeId(def, node.id),
    };
  }

  if (block === "wait_until_datetime") {
    const ms = waitUntilMs(cfg);
    return {
      waiting: true,
      waitMs: ms,
      nextNodeId: getNextNodeId(def, node.id),
    };
  }

  if (isConditionBlock(block)) {
    const result = evaluateConditionNode(node, ctx.facts, contact, ctx.tagNames);
    return {
      nextNodeId: getNextNodeId(def, node.id, result ? "yes" : "no"),
      output: { branch: result ? "yes" : "no" },
    };
  }

  if (block === "send_sms" || block === "send_review_request") {
    if (contact.status !== "SUBSCRIBED" && !ctx.testMode) {
      return { done: true, error: "contact_opted_out" };
    }
    const body = await mergeMessageVars(ctx.workspaceId, contact, String(cfg.body || ""));
    if (block === "send_review_request") {
      await mergeExecutionMetadata(ctx.executionId, { review_request_created: true });
      const { emitAutomationEvent } = await import("./events");
      await emitAutomationEvent(ctx.workspaceId, "review_request.created", ctx.contactId);
    }
    if (!ctx.testMode) {
      const idempotencyKey = `auto:${ctx.executionId}:${node.id}`;
      const result = await sendQuickSms({
        workspaceId: ctx.workspaceId,
        to: contact.phone,
        body,
        from: cfg.fromNumber ? String(cfg.fromNumber) : undefined,
        idempotencyKey,
      });
      await mergeExecutionMetadata(ctx.executionId, {
        message_delivered: true,
        review_request_sent: block === "send_review_request",
      });
      if (block === "send_review_request") {
        const { emitAutomationEvent } = await import("./events");
        await emitAutomationEvent(ctx.workspaceId, "review_request.sent", ctx.contactId);
      }
      await prisma.automationFlow.update({
        where: { id: ctx.flowId },
        data: { messagesSent: { increment: 1 } },
      });
      return {
        nextNodeId: getNextNodeId(def, node.id),
        output: { messageId: result?.messageId, sid: result?.sid },
      };
    }
    return {
      nextNodeId: getNextNodeId(def, node.id),
      output: { test: true, body },
    };
  }

  if (block === "send_email") {
    if (!contact.email) return { error: "missing_email" };
    if (!process.env.BREVO_API_KEY?.trim()) {
      return { error: "email_not_configured" };
    }
    const subject = await mergeMessageVars(ctx.workspaceId, contact, String(cfg.subject || ""));
    const html = await mergeMessageVars(ctx.workspaceId, contact, String(cfg.body || ""));
    if (!ctx.testMode) {
      const idempotencyKey = `auto-email:${ctx.executionId}:${node.id}`;
      const prior = await prisma.auditLog.findFirst({
        where: { workspaceId: ctx.workspaceId, event: "automation.email", detail: { contains: idempotencyKey } },
      });
      if (prior) {
        return { nextNodeId: getNextNodeId(def, node.id), output: { duplicate: true } };
      }
      const result = await sendTransactionalEmail({
        to: contact.email,
        subject,
        htmlContent: html,
        replyTo: cfg.replyTo ? String(cfg.replyTo) : undefined,
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          event: "automation.email",
          detail: `${idempotencyKey} status=${result.status}`,
        },
      });
      if (result.status === "failed") return { error: result.error || "email_failed" };
      return { nextNodeId: getNextNodeId(def, node.id), output: { emailId: result.id } };
    }
    return { nextNodeId: getNextNodeId(def, node.id), output: { test: true, subject, html } };
  }

  if (block === "add_tag" || block === "remove_tag") {
    const tagName = String(cfg.tag || "").trim();
    if (tagName) {
      const tag = await prisma.tag.findFirst({ where: { workspaceId: ctx.workspaceId, name: tagName } });
      if (tag && block === "add_tag") {
        await prisma.contactTag.upsert({
          where: { tagId_contactId: { contactId: ctx.contactId, tagId: tag.id } },
          create: { contactId: ctx.contactId, tagId: tag.id },
          update: {},
        });
      }
      if (tag && block === "remove_tag") {
        await prisma.contactTag.deleteMany({ where: { contactId: ctx.contactId, tagId: tag.id } });
      }
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "update_customer") {
    const field = String(cfg.field || "company");
    const value = String(cfg.value ?? "");
    const data: Record<string, unknown> = {};
    if (["firstName", "lastName", "email", "company"].includes(field)) {
      data[field] = value;
      await prisma.contact.update({ where: { id: ctx.contactId }, data: data as { firstName?: string; lastName?: string; email?: string; company?: string } });
    } else {
      const existing =
        contact.customFields && typeof contact.customFields === "object"
          ? (contact.customFields as Record<string, unknown>)
          : {};
      await prisma.contact.update({
        where: { id: ctx.contactId },
        data: { customFields: { ...existing, [field]: value } },
      });
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "create_task") {
    const title = await mergeMessageVars(
      ctx.workspaceId,
      contact,
      String(cfg.title || "Follow-up task"),
    );
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        event: "automation.task",
        detail: `contact=${ctx.contactId} title=${title} dueInDays=${cfg.dueInDays ?? 1}`,
      },
    });
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "send_internal_notification") {
    const msg = await mergeMessageVars(ctx.workspaceId, contact, String(cfg.message || ""));
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        event: "automation.notification",
        detail: `contact=${ctx.contactId} ${msg}`,
      },
    });
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "enroll_in_automation") {
    const targetFlowId = String(cfg.flowId || "").trim();
    if (targetFlowId && !ctx.testMode) {
      await enrollInAutomation({
        workspaceId: ctx.workspaceId,
        flowId: targetFlowId,
        contactId: ctx.contactId,
      });
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "remove_from_automation") {
    const targetFlowId = String(cfg.flowId || "").trim();
    if (targetFlowId && !ctx.testMode) {
      await cancelExecutionsInFlow(ctx.workspaceId, ctx.contactId, targetFlowId);
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "send_webhook") {
    if (!ctx.testMode) {
      const out = await executeWebhook(ctx.workspaceId, ctx.contactId, cfg);
      if (out.error) return { error: out.error };
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "integration_action") {
    const provider = String(cfg.provider || "").trim();
    const actionId = String(cfg.actionId || "").trim();
    if (!provider || !actionId) {
      return { error: "integration_action_missing_config", nextNodeId: getNextNodeId(def, node.id) };
    }
    let params: Record<string, unknown> = {};
    if (cfg.params && typeof cfg.params === "object") {
      params = cfg.params as Record<string, unknown>;
    } else if (cfg.paramsJson) {
      try {
        params = JSON.parse(String(cfg.paramsJson || "{}")) as Record<string, unknown>;
      } catch {
        return { error: "integration_action_invalid_params" };
      }
    }
    // Merge contact identity for upserts
    params = {
      email: contact.email,
      phone: contact.phone,
      firstName: contact.firstName,
      lastName: contact.lastName,
      ...params,
    };
    if (ctx.testMode) {
      return {
        nextNodeId: getNextNodeId(def, node.id),
        output: JSON.parse(JSON.stringify({ test: true, provider, actionId, params })),
      };
    }
    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    const { isExternalProvider } = await import("@/lib/integrations/framework");
    const { isCrmAutomationProvider } = await import("@/lib/crm/automation-actions");
    if (!isExternalProvider(provider) && !isCrmAutomationProvider(provider)) {
      return { error: "integration_action_unknown_provider" };
    }
    if (isCrmAutomationProvider(provider)) {
      await enqueueJob({
        jobType: "crm_automation_action",
        queueName: `crm-${provider}`,
        workspaceId: ctx.workspaceId,
        priority: 20,
        payload: JSON.parse(
          JSON.stringify({
            workspaceId: ctx.workspaceId,
            provider,
            actionId,
            params,
            contactId: ctx.contactId,
            automationFlowId: ctx.flowId,
          }),
        ),
        idempotencyKey: `crm-act-${ctx.flowId}-${ctx.contactId}-${actionId}-${Date.now()}`,
      });
      return { nextNodeId: getNextNodeId(def, node.id) };
    }
    await enqueueJob({
      jobType: "integration_action",
      queueName: `ext-${provider}`,
      workspaceId: ctx.workspaceId,
      priority: 20,
      payload: JSON.parse(
        JSON.stringify({
          workspaceId: ctx.workspaceId,
          provider,
          actionId,
          params,
          contactId: ctx.contactId,
          source: "automation",
          automationFlowId: ctx.flowId,
        }),
      ),
      idempotencyKey: `int-act:${ctx.executionId}:${node.id}`,
    });
    return {
      nextNodeId: getNextNodeId(def, node.id),
      output: { queued: true, provider, actionId },
    };
  }

  if (block === "end_automation" || node.type === "end") {
    return { done: true };
  }

  return { nextNodeId: getNextNodeId(def, node.id) };
}
