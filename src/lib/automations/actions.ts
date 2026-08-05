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

/** Map call completion payload → wait_for_call_result branch handle. */
export function normalizeCallResultBranch(
  callResult: Record<string, unknown>,
): string {
  const type = String(callResult.type || "").toUpperCase();
  const outcome = String(callResult.outcome || callResult.status || "").toLowerCase();
  if (
    outcome.includes("book") ||
    outcome === "appointment_booked" ||
    callResult.appointmentBooked === true
  ) {
    return "booked";
  }
  if (outcome.includes("transfer") || type === "CALL_TRANSFERRED") {
    return "transferred";
  }
  if (outcome.includes("voicemail") || callResult.voicemailDetected === true) {
    return "voicemail";
  }
  if (
    outcome.includes("busy") ||
    outcome === "busy" ||
    String(callResult.status || "").toUpperCase() === "BUSY"
  ) {
    return "busy";
  }
  if (
    type === "CALL_MISSED" ||
    outcome.includes("no_answer") ||
    outcome.includes("no-answer") ||
    outcome.includes("missed") ||
    ["NO_ANSWER", "CANCELLED"].includes(String(callResult.status || "").toUpperCase())
  ) {
    return "no_answer";
  }
  if (
    outcome.includes("fail") ||
    type === "TIMEOUT" ||
    String(callResult.status || "").toUpperCase() === "FAILED"
  ) {
    return "failed";
  }
  if (outcome.includes("answer") || outcome === "completed" || type === "CALL_COMPLETED") {
    return outcome.includes("answer") && !outcome.includes("no")
      ? "answered"
      : "completed";
  }
  if (type === "AI_CALL_COMPLETED") return "completed";
  return "completed";
}

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
      let from = cfg.fromNumber ? String(cfg.fromNumber) : undefined;
      // Solution wizards store phoneNumberId; resolve to E.164 for sendQuickSms.
      if (!from && cfg.phoneNumberId) {
        const pn = await prisma.phoneNumber.findFirst({
          where: {
            id: String(cfg.phoneNumberId),
            workspaceId: ctx.workspaceId,
          },
          select: { e164: true },
        });
        from = pn?.e164 || undefined;
      }
      const result = await sendQuickSms({
        workspaceId: ctx.workspaceId,
        to: contact.phone,
        body,
        from,
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

  if (block === "enroll_in_automation" || block === "start_automation") {
    const targetFlowId = String(cfg.automationId || cfg.flowId || "").trim();
    if (targetFlowId && !ctx.testMode) {
      let variables: Record<string, unknown> = {};
      const rawVars = cfg.variablesJson ?? cfg.variables;
      if (typeof rawVars === "string" && rawVars.trim()) {
        try {
          variables = JSON.parse(rawVars) as Record<string, unknown>;
        } catch {
          variables = {};
        }
      } else if (rawVars && typeof rawVars === "object") {
        variables = rawVars as Record<string, unknown>;
      }
      await enrollInAutomation({
        workspaceId: ctx.workspaceId,
        flowId: targetFlowId,
        contactId: ctx.contactId,
        variables,
      });
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "remove_from_automation") {
    const targetFlowId = String(cfg.flowId || cfg.automationId || "").trim();
    if (targetFlowId && !ctx.testMode) {
      await cancelExecutionsInFlow(ctx.workspaceId, ctx.contactId, targetFlowId);
    }
    return { nextNodeId: getNextNodeId(def, node.id) };
  }

  if (block === "start_ai_call" || block === "run_voice_agent") {
    const agentId = String(cfg.agentId || "").trim();
    if (!agentId) {
      return {
        error:
          block === "run_voice_agent"
            ? "run_voice_agent_missing_agent"
            : "start_ai_call_missing_agent",
        nextNodeId: getNextNodeId(def, node.id),
      };
    }

    const attachInbound = Boolean(cfg.attachInbound);
    const waitForOutcome = cfg.waitForOutcome !== false;
    const mode = String(cfg.mode || "realtime_voice");

    // Inbound attach: Telnyx already owns live audio (published on Activate).
    // Do NOT outbound-dial. Bind pendingCallId and advance to Call Outcome wait.
    if (block === "run_voice_agent" && attachInbound) {
      const exec = await prisma.automationExecution.findUnique({
        where: { id: ctx.executionId },
        select: { metadata: true },
      });
      const meta = (exec?.metadata || {}) as Record<string, unknown>;
      const vars = (meta.variables || {}) as Record<string, unknown>;
      const pendingCallId =
        (typeof meta.pendingCallId === "string" && meta.pendingCallId) ||
        (typeof vars.callId === "string" && vars.callId) ||
        null;

      await mergeExecutionMetadata(ctx.executionId, {
        pendingAiCallAgentId: agentId,
        pendingCallId,
        waitingForCallResult: false,
        callResultConsumed: false,
        inboundAttach: true,
        lastAgentResult: {
          status: "attached",
          mode,
          agentId,
          telnyxAssistantId: String(cfg.telnyxAssistantId || "") || null,
          waitForOutcome,
          attachInbound: true,
        },
      });

      return {
        nextNodeId: getNextNodeId(def, node.id),
        output: {
          attached: true,
          agentId,
          pendingCallId,
          mode,
          waitForOutcome,
          block,
        },
      };
    }

    if (!ctx.testMode) {
      const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
      const contextRaw = cfg.contextJson;
      const context =
        typeof contextRaw === "string"
          ? contextRaw
          : JSON.stringify(contextRaw ?? {});
      await enqueueJob({
        jobType: "voice_outbound_ai_call",
        queueName: "voice-outbound",
        workspaceId: ctx.workspaceId,
        payload: {
          workspaceId: ctx.workspaceId,
          agentId,
          contactId: ctx.contactId,
          purpose: String(cfg.purpose || cfg.agentName || ""),
          callerId: String(cfg.callerId || ""),
          timeoutSeconds: Number(cfg.timeoutSeconds || 60),
          retryCount: Number(cfg.retryCount || 0),
          context,
          automationExecutionId: ctx.executionId,
          automationFlowId: ctx.flowId,
          attachInbound: false,
          mode,
        },
        idempotencyKey: `${block}:${ctx.executionId}:${node.id}`,
      });
      await mergeExecutionMetadata(ctx.executionId, {
        pendingAiCallAgentId: agentId,
        waitingForCallResult: false,
        callResultConsumed: false,
        callResult: null,
        pendingCallId: null,
        lastAgentResult: {
          status: "started",
          mode: block,
          agentId,
        },
      });
    }
    return {
      nextNodeId: getNextNodeId(def, node.id),
      output: { queued: true, agentId, block },
    };
  }

  if (block === "wait_for_call_result") {
    const timeoutMinutes = Math.max(1, Number(cfg.timeoutMinutes || 30));
    const timeoutMs = timeoutMinutes * 60_000;
    const exec = await prisma.automationExecution.findUnique({
      where: { id: ctx.executionId },
      select: { metadata: true },
    });
    const meta = (exec?.metadata || {}) as Record<string, unknown>;
    const callResult = meta.callResult as Record<string, unknown> | undefined;
    const consumed = meta.callResultConsumed === true;

    const resolveBranchTarget = (handle: string) => {
      const exact = def.edges.find(
        (e) => e.source === node.id && (e.sourceHandle || "default") === handle,
      );
      if (exact) return exact.target;
      const fallback = def.edges.find(
        (e) =>
          e.source === node.id &&
          (!e.sourceHandle || e.sourceHandle === "default"),
      );
      return fallback?.target || getNextNodeId(def, node.id);
    };

    if (callResult && !consumed) {
      const branch = normalizeCallResultBranch(callResult);
      await mergeExecutionMetadata(ctx.executionId, {
        waitingForCallResult: false,
        callResultConsumed: true,
        lastCallResultBranch: branch,
        // Clear so a later wait_for_call_result in the same run is not poisoned.
        callResult: null,
        pendingCallId: null,
      });
      const output: Prisma.InputJsonValue = {
        branch,
        answered:
          branch === "answered" || branch === "completed" || branch === "booked",
        no_answer: branch === "no_answer",
        busy: branch === "busy",
        failed: branch === "failed",
        completed: branch === "completed",
        transferred: branch === "transferred",
        booked: branch === "booked",
        voicemail: branch === "voicemail",
        callId:
          typeof callResult.callId === "string" ? callResult.callId : null,
        summary:
          typeof callResult.summary === "string" ? callResult.summary : null,
        transcript:
          typeof callResult.transcript === "string"
            ? callResult.transcript
            : null,
        extractedFields:
          callResult.extractedFields &&
          typeof callResult.extractedFields === "object"
            ? (callResult.extractedFields as Prisma.InputJsonValue)
            : null,
      };
      return {
        nextNodeId: resolveBranchTarget(branch),
        output,
      };
    }

    const deadline = Number(meta.callWaitDeadline || 0);
    if (meta.waitingForCallResult === true) {
      if (deadline && Date.now() < deadline) {
        // Spurious wake (race with call-result resume) — keep waiting.
        return {
          waiting: true,
          waitMs: Math.max(deadline - Date.now(), 1_000),
          nextNodeId: node.id,
          output: { waitingForCallResult: true, spuriousWake: true },
        };
      }
      const branch = "failed";
      await mergeExecutionMetadata(ctx.executionId, {
        waitingForCallResult: false,
        callResultConsumed: true,
        lastCallResultBranch: branch,
        callResult: null,
        pendingCallId: null,
      });
      return {
        nextNodeId: resolveBranchTarget(branch),
        output: { branch, failed: true, timedOut: true },
      };
    }

    const callWaitDeadline = Date.now() + timeoutMs;
    await mergeExecutionMetadata(ctx.executionId, {
      waitingForCallResult: true,
      callResultConsumed: false,
      callResult: null,
      callWaitDeadline,
    });
    return {
      waiting: true,
      waitMs: timeoutMs,
      // Stay on this node so resume/timeout can re-evaluate and branch.
      nextNodeId: node.id,
      output: { waitingForCallResult: true },
    };
  }

  if (block === "use_ai_agent") {
    const {
      agentInvokeKey,
      checkAgentInvokeGuards,
      normalizeUseAgentMode,
      readAgentChainFromMetadata,
    } = await import("@/lib/automations/agent-invoke");

    const agentId = String(cfg.agentId || "").trim();
    const setupId = String(cfg.setupId || "").trim();
    const mode = normalizeUseAgentMode(cfg.mode);
    const waitForCompletion = Boolean(cfg.waitForCompletion);
    if (!agentId && !setupId) {
      return {
        error: "use_agent_missing_agent",
        nextNodeId: getNextNodeId(def, node.id),
      };
    }

    const targetKey = agentInvokeKey({ agentId, setupId });
    if (!targetKey) {
      return {
        error: "use_agent_missing_agent",
        nextNodeId: getNextNodeId(def, node.id),
      };
    }

    let resolvedAgentId = agentId || null;
    let primaryFlowId: string | null = null;
    let currentOwnerKey: string | null = null;

    const currentFlow = await prisma.automationFlow.findFirst({
      where: { id: ctx.flowId, workspaceId: ctx.workspaceId },
      select: {
        ownerAgentId: true,
        sourceSolutionSetupId: true,
      },
    });
    currentOwnerKey = agentInvokeKey({
      agentId: currentFlow?.ownerAgentId,
      setupId: currentFlow?.sourceSolutionSetupId,
    });

    if (setupId) {
      const setup = await prisma.solutionSetup.findFirst({
        where: { id: setupId, workspaceId: ctx.workspaceId },
        select: {
          primaryFlowId: true,
          linkedAutomationIds: true,
          linkedAgentIds: true,
        },
      });
      if (setup) {
        primaryFlowId =
          setup.primaryFlowId || setup.linkedAutomationIds?.[0] || null;
        resolvedAgentId = resolvedAgentId || setup.linkedAgentIds?.[0] || null;
      }
    }

    if (resolvedAgentId) {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: resolvedAgentId, workspaceId: ctx.workspaceId },
        select: {
          primaryFlowId: true,
          linkedAutomationIds: true,
          postCallAutomationId: true,
          fallbackAutomationId: true,
        },
      });
      if (agent) {
        primaryFlowId =
          primaryFlowId ||
          agent.primaryFlowId ||
          agent.postCallAutomationId ||
          agent.fallbackAutomationId ||
          agent.linkedAutomationIds?.[0] ||
          null;
      }
    }

    const execRow = await prisma.automationExecution.findUnique({
      where: { id: ctx.executionId },
      select: { metadata: true },
    });
    const agentChain = readAgentChainFromMetadata(execRow?.metadata);
    const guard = checkAgentInvokeGuards({
      targetKey,
      currentFlowId: ctx.flowId,
      targetPrimaryFlowId: primaryFlowId,
      currentOwnerKey,
      agentChain,
    });
    if (!guard.ok) {
      await mergeExecutionMetadata(ctx.executionId, {
        lastAgentResult: {
          status: "failure",
          mode,
          error: guard.error,
          message: guard.message,
          agentId: resolvedAgentId,
          setupId: setupId || null,
        },
      });
      return {
        error: guard.error,
        nextNodeId: getNextNodeId(def, node.id),
        output: { status: "failure", error: guard.error },
      };
    }

    let context: Record<string, unknown> = {};
    if (typeof cfg.contextJson === "string" && cfg.contextJson.trim()) {
      try {
        context = JSON.parse(cfg.contextJson) as Record<string, unknown>;
      } catch {
        context = {};
      }
    } else if (cfg.context && typeof cfg.context === "object") {
      context = cfg.context as Record<string, unknown>;
    }

    // —— Mode: run_primary_workflow ——
    if (mode === "run_primary_workflow") {
      if (!primaryFlowId) {
        await mergeExecutionMetadata(ctx.executionId, {
          lastAgentResult: {
            status: "failure",
            mode,
            error: "use_agent_no_primary_flow",
            agentId: resolvedAgentId,
            setupId: setupId || null,
          },
        });
        return {
          error: "use_agent_no_primary_flow",
          nextNodeId: getNextNodeId(def, node.id),
        };
      }
      if (!ctx.testMode) {
        const enrolled = await enrollInAutomation({
          workspaceId: ctx.workspaceId,
          flowId: primaryFlowId,
          contactId: ctx.contactId,
          variables: {
            ...context,
            usedAgentId: resolvedAgentId,
            usedAgentSetupId: setupId || null,
            purpose: String(cfg.purpose || ""),
            agentChain: guard.nextChain,
            agentDepth: guard.depth,
            parentExecutionId: ctx.executionId,
            parentFlowId: ctx.flowId,
            waitForCompletion,
          },
        });
        const skipped =
          enrolled &&
          typeof enrolled === "object" &&
          "skipped" in enrolled &&
          Boolean((enrolled as { skipped?: boolean }).skipped);
        await mergeExecutionMetadata(ctx.executionId, {
          agentChain: guard.nextChain,
          usedAgentId: resolvedAgentId,
          usedAgentSetupId: setupId || null,
          enrolledAgentFlowId: primaryFlowId,
          lastAgentResult: {
            status: skipped ? "skipped_already_enrolled" : "started",
            mode,
            agentId: resolvedAgentId,
            setupId: setupId || null,
            flowId: primaryFlowId,
            waitForCompletion,
          },
        });
      }
      return {
        nextNodeId: getNextNodeId(def, node.id),
        output: {
          status: "started",
          mode,
          agentId: resolvedAgentId,
          setupId: setupId || null,
          flowId: primaryFlowId,
          waitForCompletion,
        },
      };
    }

    // —— Mode: hand_off_conversation ——
    if (mode === "hand_off_conversation") {
      if (!resolvedAgentId) {
        return {
          error: "use_agent_hand_off_needs_voice_agent",
          nextNodeId: getNextNodeId(def, node.id),
        };
      }
      if (!ctx.testMode) {
        const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
        await enqueueJob({
          jobType: "voice_outbound_ai_call",
          queueName: "voice-outbound",
          workspaceId: ctx.workspaceId,
          payload: {
            workspaceId: ctx.workspaceId,
            agentId: resolvedAgentId,
            contactId: ctx.contactId,
            purpose: String(cfg.purpose || cfg.agentName || ""),
            callerId: String(cfg.callerId || ""),
            timeoutSeconds: Number(cfg.timeoutSeconds || 60),
            retryCount: Number(cfg.retryCount || 0),
            context: JSON.stringify(context),
            automationExecutionId: ctx.executionId,
            automationFlowId: ctx.flowId,
          },
          idempotencyKey: `use-agent-hand-off:${ctx.executionId}:${node.id}`,
        });
      }
      await mergeExecutionMetadata(ctx.executionId, {
        agentChain: guard.nextChain,
        pendingAiCallAgentId: resolvedAgentId,
        lastAgentResult: {
          status: "started",
          mode,
          agentId: resolvedAgentId,
          setupId: setupId || null,
        },
      });
      return {
        nextNodeId: getNextNodeId(def, node.id),
        output: {
          status: "started",
          mode,
          agentId: resolvedAgentId,
        },
      };
    }

    // —— Mode: invoke_task ——
    // Bounded task: enroll primary workflow with task context when available;
    // otherwise record a structured pending result for future model runners.
    if (primaryFlowId && !ctx.testMode) {
      await enrollInAutomation({
        workspaceId: ctx.workspaceId,
        flowId: primaryFlowId,
        contactId: ctx.contactId,
        variables: {
          ...context,
          taskMode: true,
          usedAgentId: resolvedAgentId,
          usedAgentSetupId: setupId || null,
          purpose: String(cfg.purpose || ""),
          agentChain: guard.nextChain,
          agentDepth: guard.depth,
          parentExecutionId: ctx.executionId,
          parentFlowId: ctx.flowId,
          waitForCompletion,
        },
      });
    }
    await mergeExecutionMetadata(ctx.executionId, {
      agentChain: guard.nextChain,
      lastAgentResult: {
        status: primaryFlowId ? "started" : "pending_task_runner",
        mode,
        agentId: resolvedAgentId,
        setupId: setupId || null,
        flowId: primaryFlowId,
        input: context,
        waitForCompletion,
      },
    });
    return {
      nextNodeId: getNextNodeId(def, node.id),
      output: {
        status: primaryFlowId ? "started" : "pending_task_runner",
        mode,
        agentId: resolvedAgentId,
        setupId: setupId || null,
        flowId: primaryFlowId,
      },
    };
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
    // Merge contact identity for upserts. The synthetic workspace automation
    // contact (used only as an FK for event_type.* triggers) carries a fake
    // +1555 phone and placeholder email — never leak those into provider actions.
    const isSystemAutomationContact =
      contact.customFields &&
      typeof contact.customFields === "object" &&
      (contact.customFields as Record<string, unknown>).systemAutomationContact === true;
    params = {
      ...(isSystemAutomationContact
        ? {}
        : {
            email: contact.email,
            phone: contact.phone,
          }),
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
        // Stable per execution node — retries must not duplicate CRM writes.
        idempotencyKey: `crm-act:${ctx.executionId}:${node.id}`,
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
