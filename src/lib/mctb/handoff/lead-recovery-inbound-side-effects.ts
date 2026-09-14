/**
 * Team / audit side effects for MCTB customer SMS — not a customer-facing agent.
 * Lead Recovery is the only conversational path for inbound MCTB SMS.
 */
import { getPrisma } from "@/lib/db";
import {
  getOrCreateAutomationState,
  updateAutomationState,
} from "./automation-state";
import { recordMctbHandoffEvent, persistUrgencyAssessment } from "./events";
import { deliverMctbHandoffNotifications } from "./notifications";
import { buildSnapshotFactsFromCaptured } from "./snapshot";
import { assessMctbUrgency, isUrgentClassification } from "./urgency";
import { detectCallbackIntent } from "./guided-collection";
import { loadMctbHandoffConfig } from "./config";

export async function recordMctbLeadRecoveryInboundSideEffects(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  conversationId: string;
  missedCallEventId: string;
  providerMessageId?: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  const config = await loadMctbHandoffConfig(input.workspaceId);

  const automation = await getOrCreateAutomationState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    missedCallEventId: input.missedCallEventId,
    responseMode: "ai_conversation",
  });

  const captured = (automation.capturedFieldsJson || {}) as Record<string, unknown>;
  const customerMessages = Array.isArray(captured._customer_messages)
    ? (captured._customer_messages as string[])
    : [];
  customerMessages.push(input.body);
  captured._customer_messages = customerMessages;

  const urgencyResult = assessMctbUrgency({ customerText: input.body, config });
  let urgencyRow = null;
  if (urgencyResult) {
    urgencyRow = await persistUrgencyAssessment({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      missedCallEventId: input.missedCallEventId,
      customerText: input.body,
      classification: urgencyResult.classification,
      confidence: urgencyResult.confidence,
      reason: urgencyResult.reason,
      ruleVersion: urgencyResult.ruleVersion,
    });
  }

  const urgent = isUrgentClassification(urgencyResult);
  const callbackRequested = detectCallbackIntent(input.body);
  const callerRepliedKey = `mctb-handoff:${input.conversationId}:caller_replied`;

  const { event: callerRepliedEvent, created: callerRepliedCreated } = await recordMctbHandoffEvent({
    workspaceId: input.workspaceId,
    eventType: "caller_replied",
    idempotencyKey: callerRepliedKey,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    urgencyAssessmentId: urgencyRow?.id ?? null,
    metadata: { inboundPreview: input.body.slice(0, 200) },
  });

  const facts = buildSnapshotFactsFromCaptured(captured, input.fromE164, customerMessages);

  if (callerRepliedCreated) {
    await deliverMctbHandoffNotifications({
      workspaceId: input.workspaceId,
      handoffEventId: callerRepliedEvent.id,
      eventType: callbackRequested
        ? "callback_requested"
        : urgent
          ? "urgent_detected"
          : "caller_replied",
      urgent,
      facts,
      derived: {
        urgencyClassification: urgencyResult?.classification,
        urgencyReason: urgencyResult?.reason,
        requestedAction: callbackRequested ? "callback_requested" : undefined,
      },
      conversationId: input.conversationId,
      missedCallEventId: input.missedCallEventId,
    });
  }

  await updateAutomationState(input.conversationId, {
    state: "automation_active",
    capturedFieldsJson: captured,
    followUpStatus: null,
  });

  await prisma.missedCallEvent.update({
    where: { id: input.missedCallEventId },
    data: { status: "CUSTOMER_REPLIED" },
  }).catch(() => undefined);
}
