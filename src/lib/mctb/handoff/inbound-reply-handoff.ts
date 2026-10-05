/**
 * Production MCTB inbound reply → handoff event + single notification orchestration pass.
 * Independent of whether conversational AI Lead Recovery is enabled.
 */
import { getPrisma } from "@/lib/db";
import {
  getOrCreateAutomationState,
  updateAutomationState,
} from "./automation-state";
import { recordMctbHandoffEvent, persistUrgencyAssessment } from "./events";
import { deliverMctbHandoffNotifications } from "./notifications";
import { buildSnapshotFactsFromCaptured } from "./snapshot";
import { classifyMctbUrgentReply } from "./urgent-reply-classifier";
import { callbackRequestedFromStructuredIntent, detectCallbackIntent } from "./guided-collection";
import { loadMctbHandoffConfig } from "./config";
import { planInboundReplyNotificationEvent } from "./inbound-reply-notification-plan";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

export async function evaluateMctbInboundReplyUrgency(input: {
  config: Awaited<ReturnType<typeof loadMctbHandoffConfig>>;
  body: string;
  customerMessages: string[];
}): Promise<{
  urgent: boolean;
  reason?: string;
  summary?: string;
  ruleVersion: string;
  classification: "urgent" | "normal" | "classifier_unavailable";
  confidence: number;
} | null> {
  if (!input.config.emergencyDetectionEnabled) return null;

  const ai = await classifyMctbUrgentReply({
    instructions: input.config.emergencyCriteria || "",
    latestMessage: input.body,
    recentMessages: input.customerMessages,
  });

  if (ai) {
    return {
      urgent: ai.urgent,
      reason: ai.reason,
      summary: ai.summary,
      ruleVersion: "mctb_urgent_reply_ai_v1",
      classification: ai.urgent ? "urgent" : "normal",
      confidence: ai.urgent ? 0.85 : 0.75,
    };
  }

  return {
    urgent: false,
    reason: "Urgent classifier unavailable — caller-replied notification proceeds as normal",
    summary: input.body.slice(0, 240),
    ruleVersion: "mctb_urgent_reply_ai_unavailable",
    classification: "classifier_unavailable",
    confidence: 0,
  };
}

export async function processMctbInboundReplyHandoff(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  conversationId: string;
  missedCallEventId: string;
  providerMessageId?: string | null;
  structuredIntent?: StructuredLeadIntent | null;
}): Promise<void> {
  const prisma = getPrisma();
  const config = await loadMctbHandoffConfig(input.workspaceId);

  const automation = await getOrCreateAutomationState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    missedCallEventId: input.missedCallEventId,
    responseMode: config.responseMode,
  });

  const captured = (automation.capturedFieldsJson || {}) as Record<string, unknown>;
  const customerMessages = Array.isArray(captured._customer_messages)
    ? (captured._customer_messages as string[])
    : [];
  customerMessages.push(input.body);
  captured._customer_messages = customerMessages;

  const callbackRequested = input.structuredIntent
    ? callbackRequestedFromStructuredIntent(input.structuredIntent)
    : detectCallbackIntent(input.body);

  const urgencyEval = await evaluateMctbInboundReplyUrgency({
    config,
    body: input.body,
    customerMessages,
  });

  let urgencyRow = null;
  if (urgencyEval) {
    urgencyRow = await persistUrgencyAssessment({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      missedCallEventId: input.missedCallEventId,
      customerText: input.body,
      classification: urgencyEval.classification,
      confidence: urgencyEval.confidence,
      reason: urgencyEval.reason,
      ruleVersion: urgencyEval.ruleVersion,
    });
  }

  const urgent = urgencyEval?.classification === "urgent";
  const plan = planInboundReplyNotificationEvent({ callbackRequested, urgent });

  if (urgent && urgencyEval) {
    captured._mctb_urgent_latest = {
      reason: urgencyEval.reason ?? null,
      summary: urgencyEval.summary ?? null,
      messagePreview: input.body.slice(0, 400),
      at: new Date().toISOString(),
      ruleVersion: urgencyEval.ruleVersion,
    };
  }

  const idemSuffix = input.providerMessageId?.trim() || `${Date.now()}`;
  const callerRepliedKey = `mctb-handoff:${input.conversationId}:caller_replied:${idemSuffix}`;

  const { event: callerRepliedEvent, created: callerRepliedCreated } = await recordMctbHandoffEvent({
    workspaceId: input.workspaceId,
    eventType: "caller_replied",
    idempotencyKey: callerRepliedKey,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    urgencyAssessmentId: urgencyRow?.id ?? null,
    metadata: { inboundPreview: input.body.slice(0, 200), notifyAs: plan.eventType },
  });

  const facts = buildSnapshotFactsFromCaptured(captured, input.fromE164, customerMessages);

  if (callerRepliedCreated) {
    await deliverMctbHandoffNotifications({
      workspaceId: input.workspaceId,
      handoffEventId: callerRepliedEvent.id,
      eventType: plan.eventType,
      urgent: plan.urgent,
      facts,
      derived: {
        urgencyClassification: urgencyEval?.classification,
        urgencyReason: urgencyEval?.reason,
        requestedAction: callbackRequested ? "callback_requested" : undefined,
      },
      conversationId: input.conversationId,
      missedCallEventId: input.missedCallEventId,
    });
  }

  const nextState = plan.urgent
    ? "urgent"
    : callbackRequested
      ? "callback_requested"
      : "automation_active";

  await updateAutomationState(input.conversationId, {
    state: nextState,
    capturedFieldsJson: captured,
    followUpStatus: "needs_follow_up",
  });

  await prisma.missedCallEvent.update({
    where: { id: input.missedCallEventId },
    data: { status: "CUSTOMER_REPLIED" },
  }).catch(() => undefined);
}
