import { getPrisma } from "@/lib/db";
import { loadMctbHandoffConfig } from "./config";
import {
  getOrCreateAutomationState,
  shouldBlockAutomation,
  updateAutomationState,
} from "./automation-state";
import { recordMctbHandoffEvent, persistUrgencyAssessment } from "./events";
import { deliverMctbHandoffNotifications } from "./notifications";
import { buildSnapshotFactsFromCaptured, createMctbLeadSnapshot } from "./snapshot";
import {
  detectCallbackIntent,
  extractFieldFromReply,
  guidedCollectionComplete,
  nextGuidedField,
  promptForField,
} from "./guided-collection";
import { assessMctbUrgency, isUrgentClassification } from "./urgency";
import type { MctbHandoffEventType, MctbResponseMode } from "./types";

export type ProcessMctbInboundReplyResult = {
  handled: boolean;
  reason?: string;
  automationReply?: string | null;
  skipAi?: boolean;
  eventType?: MctbHandoffEventType;
  handoffEventId?: string;
};

/**
 * Legacy handoff automation (notify_only, guided_collection, etc.).
 * Customer SMS on Telnyx does not call this — use {@link recordMctbLeadRecoveryInboundSideEffects}.
 */
export async function processMctbInboundReply(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  conversationId?: string | null;
  missedCallEventId?: string | null;
  providerMessageId?: string | null;
}): Promise<ProcessMctbInboundReplyResult> {
  const prisma = getPrisma();
  const config = await loadMctbHandoffConfig(input.workspaceId);
  const mode: MctbResponseMode = config.responseMode;
  const { loadLeadRecoveryConfig } = await import("@/lib/mctb/lead-recovery/config");
  const leadRecoveryConfig = await loadLeadRecoveryConfig(input.workspaceId);
  const leadRecoverySmsActive =
    leadRecoveryConfig.enabled && leadRecoveryConfig.policyHealth !== "DISABLED";

  const missedEvent =
    input.missedCallEventId
      ? await prisma.missedCallEvent.findFirst({
          where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
        })
      : await prisma.missedCallEvent.findFirst({
          where: {
            workspaceId: input.workspaceId,
            callerE164: input.fromE164,
            smsSentAt: { not: null },
          },
          orderBy: { smsSentAt: "desc" },
        });

  if (!missedEvent) {
    return { handled: false, reason: "no_mctb_thread" };
  }

  let conversationId = input.conversationId;
  if (!conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: {
        workspaceId: input.workspaceId,
        missedCallEventId: missedEvent.id,
        productSource: "MCTB",
      },
      select: { id: true },
    });
    conversationId = conv?.id ?? null;
  }

  const automation = conversationId
    ? await getOrCreateAutomationState({
        workspaceId: input.workspaceId,
        conversationId: conversationId ?? null,
        missedCallEventId: missedEvent.id,
        responseMode: mode,
      })
    : null;

  if (automation && shouldBlockAutomation(automation.state)) {
    return { handled: true, reason: "human_or_resolved", skipAi: true, automationReply: null };
  }

  const captured = (automation?.capturedFieldsJson || {}) as Record<string, unknown>;
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
      conversationId: conversationId ?? null,
      missedCallEventId: missedEvent.id,
      customerText: input.body,
      classification: urgencyResult.classification,
      confidence: urgencyResult.confidence,
      reason: urgencyResult.reason,
      ruleVersion: urgencyResult.ruleVersion,
    });
  }

  const urgent = isUrgentClassification(urgencyResult);
  const callbackRequested = detectCallbackIntent(input.body);

  const idemSuffix = input.providerMessageId || `${Date.now()}`;
  const callerRepliedKey = `mctb-handoff:${conversationId || missedEvent.id}:caller_replied:${idemSuffix}`;

  const { event: callerRepliedEvent, created: callerRepliedCreated } = await recordMctbHandoffEvent({
    workspaceId: input.workspaceId,
    eventType: "caller_replied",
    idempotencyKey: callerRepliedKey,
    missedCallEventId: missedEvent.id,
    conversationId,
    urgencyAssessmentId: urgencyRow?.id ?? null,
    metadata: { inboundPreview: input.body.slice(0, 200) },
  });

  const facts = buildSnapshotFactsFromCaptured(captured, input.fromE164, customerMessages);

  if (callerRepliedCreated && mode === "notify_only") {
    await deliverHandoff({
      workspaceId: input.workspaceId,
      handoffEventId: callerRepliedEvent.id,
      eventType: callbackRequested ? "callback_requested" : urgent ? "urgent_detected" : "caller_replied",
      urgent,
      facts,
      derived: {
        urgencyClassification: urgencyResult?.classification,
        urgencyReason: urgencyResult?.reason,
        requestedAction: callbackRequested ? "callback_requested" : undefined,
      },
      conversationId: conversationId ?? null,
      missedCallEventId: missedEvent.id,
    });
    if (conversationId) {
      await updateAutomationState(conversationId, {
        state: leadRecoverySmsActive
          ? "automation_active"
          : urgent
            ? "urgent"
            : callbackRequested
              ? "callback_requested"
              : "needs_human",
        capturedFieldsJson: captured,
        followUpStatus: leadRecoverySmsActive ? null : "needs_follow_up",
      });
    }
    if (!leadRecoverySmsActive) {
      await prisma.missedCallEvent.update({
        where: { id: missedEvent.id },
        data: { status: "CUSTOMER_REPLIED" },
      });
      return {
        handled: true,
        skipAi: true,
        automationReply: null,
        eventType: "caller_replied",
        handoffEventId: callerRepliedEvent.id,
      };
    }
    return {
      handled: true,
      skipAi: false,
      eventType: "caller_replied",
      handoffEventId: callerRepliedEvent.id,
    };
  }

  if (mode === "immediate_handoff" || (urgent && config.emergencyAction === "stop_ai_handoff")) {
    await handleLeadCaptured({
      workspaceId: input.workspaceId,
      missedCallEventId: missedEvent.id,
      conversationId: conversationId ?? null,
      captured,
      customerPhone: input.fromE164,
      customerMessages,
      eventType: urgent ? "urgent_detected" : callbackRequested ? "callback_requested" : "human_required",
      urgent,
      urgencyAssessmentId: urgencyRow?.id,
      idempotencySuffix: idemSuffix,
      urgencyResult,
    });
    if (conversationId) {
      await updateAutomationState(conversationId, {
        state: urgent ? "urgent" : "needs_human",
        capturedFieldsJson: captured,
        followUpStatus: "needs_follow_up",
      });
    }
    return {
      handled: true,
      skipAi: true,
      automationReply: urgent
        ? "We understand this is urgent. Our team has been notified and will follow up shortly."
        : "Thanks — our team has been notified and will follow up with you shortly.",
      eventType: urgent ? "urgent_detected" : "human_required",
    };
  }

  if (mode === "guided_collection") {
    const activeField = automation?.activeFieldId
      ? config.fieldSchema.find((f) => f.id === automation.activeFieldId)
      : nextGuidedField(config, captured);

    if (activeField && automation?.activeFieldId) {
      const extracted = extractFieldFromReply(activeField.id, input.body);
      if (extracted) captured[activeField.id] = extracted;
      captured[`_asked_${activeField.id}`] = true;
    }

    const nextField = nextGuidedField(config, captured);
    if (guidedCollectionComplete(config, captured) || !nextField) {
      await handleLeadCaptured({
        workspaceId: input.workspaceId,
        missedCallEventId: missedEvent.id,
        conversationId: conversationId ?? null,
        captured,
        customerPhone: input.fromE164,
        customerMessages,
        eventType: urgent ? "urgent_detected" : "lead_captured",
        urgent,
        urgencyAssessmentId: urgencyRow?.id,
        idempotencySuffix: idemSuffix,
        urgencyResult,
      });
      if (conversationId) {
        await updateAutomationState(conversationId, {
          state: "needs_human",
          capturedFieldsJson: captured,
          activeFieldId: null,
          followUpStatus: "needs_follow_up",
        });
      }
      return {
        handled: true,
        skipAi: true,
        automationReply: "Thanks — we have what we need. Someone from our team will follow up shortly.",
        eventType: "lead_captured",
      };
    }

    if (conversationId) {
      await updateAutomationState(conversationId, {
        state: "collecting_information",
        capturedFieldsJson: captured,
        activeFieldId: nextField.id,
      });
    }
    return {
      handled: true,
      skipAi: true,
      automationReply: promptForField(nextField),
      eventType: "caller_replied",
    };
  }

  if (urgent && config.emergencyDetectionEnabled) {
    await handleLeadCaptured({
      workspaceId: input.workspaceId,
      missedCallEventId: missedEvent.id,
      conversationId: conversationId ?? null,
      captured,
      customerPhone: input.fromE164,
      customerMessages,
      eventType: "urgent_detected",
      urgent: true,
      urgencyAssessmentId: urgencyRow?.id,
      idempotencySuffix: idemSuffix,
      urgencyResult,
    });
    if (conversationId && config.emergencyAction !== "ai_continue_notify") {
      await updateAutomationState(conversationId, {
        state: "urgent",
        capturedFieldsJson: captured,
        followUpStatus: "needs_follow_up",
      });
      if (config.emergencyAction === "stop_ai_handoff") {
        return {
          handled: true,
          skipAi: true,
          automationReply:
            "We understand this is urgent. Our team has been notified and will follow up shortly.",
          eventType: "urgent_detected",
        };
      }
    }
  }

  if (mode === "ai_conversation") {
    if (conversationId) {
      await updateAutomationState(conversationId, {
        state: "automation_active",
        capturedFieldsJson: captured,
      });
    }
    return {
      handled: true,
      skipAi: false,
      eventType: "caller_replied",
      handoffEventId: callerRepliedEvent.id,
    };
  }

  if (mode === "notify_only" && leadRecoverySmsActive) {
    if (conversationId) {
      await updateAutomationState(conversationId, {
        state: "automation_active",
        capturedFieldsJson: captured,
      });
    }
    return {
      handled: true,
      skipAi: false,
      eventType: "caller_replied",
      handoffEventId: callerRepliedEvent.id,
    };
  }

  return { handled: false, reason: "unhandled_mode" };
}

async function handleLeadCaptured(input: {
  workspaceId: string;
  missedCallEventId: string;
  conversationId: string | null;
  captured: Record<string, unknown>;
  customerPhone: string;
  customerMessages: string[];
  eventType: MctbHandoffEventType;
  urgent: boolean;
  urgencyAssessmentId?: string | null;
  idempotencySuffix: string;
  urgencyResult?: { classification: string; reason?: string } | null;
}) {
  const facts = buildSnapshotFactsFromCaptured(
    input.captured,
    input.customerPhone,
    input.customerMessages,
  );
  const snapshot = await createMctbLeadSnapshot({
    workspaceId: input.workspaceId,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    triggerEvent: input.eventType,
    customerFacts: facts,
    aiDerived: {
      urgencyClassification: input.urgencyResult?.classification,
      urgencyReason: input.urgencyResult?.reason,
    },
  });
  const idempotencyKey = `mctb-handoff:${input.conversationId || input.missedCallEventId}:${input.eventType}:${input.idempotencySuffix}`;
  const { event } = await recordMctbHandoffEvent({
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    idempotencyKey,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId,
    leadSnapshotId: snapshot.id,
    urgencyAssessmentId: input.urgencyAssessmentId ?? null,
  });
  await deliverHandoff({
    workspaceId: input.workspaceId,
    handoffEventId: event.id,
    eventType: input.eventType,
    urgent: input.urgent,
    facts,
    derived: {
      urgencyClassification: input.urgencyResult?.classification,
      urgencyReason: input.urgencyResult?.reason,
    },
    conversationId: input.conversationId,
    missedCallEventId: input.missedCallEventId,
  });
}

async function deliverHandoff(input: {
  workspaceId: string;
  handoffEventId: string;
  eventType: MctbHandoffEventType;
  urgent: boolean;
  facts: ReturnType<typeof buildSnapshotFactsFromCaptured>;
  derived?: { urgencyClassification?: string; urgencyReason?: string; requestedAction?: string };
  conversationId: string | null;
  missedCallEventId: string;
}) {
  await deliverMctbHandoffNotifications({
    workspaceId: input.workspaceId,
    handoffEventId: input.handoffEventId,
    eventType: input.eventType,
    urgent: input.urgent,
    facts: input.facts,
    derived: input.derived,
    conversationId: input.conversationId,
    missedCallEventId: input.missedCallEventId,
  });
}

export async function emitMctbHumanRequiredHandoff(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  conversationId?: string | null;
  missedCallEventId: string;
  reason?: string;
}) {
  const idempotencySuffix = `human:${input.body.slice(0, 24)}`;
  await handleLeadCaptured({
    workspaceId: input.workspaceId,
    missedCallEventId: input.missedCallEventId,
    conversationId: input.conversationId ?? null,
    captured: { _customer_messages: [input.body] },
    customerPhone: input.fromE164,
    customerMessages: [input.body],
    eventType: "human_required",
    urgent: false,
    idempotencySuffix,
    urgencyResult: null,
  });
  if (input.conversationId) {
    await updateAutomationState(input.conversationId, {
      state: "needs_human",
      followUpStatus: "needs_follow_up",
    });
  }
}

export async function takeOverMctbConversation(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
}) {
  await getOrCreateAutomationState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });
  return updateAutomationState(input.conversationId, {
    state: "human_active",
    humanTakenOverByUserId: input.userId,
  });
}

export async function resumeMctbAutomation(input: {
  workspaceId: string;
  conversationId: string;
}) {
  const config = await loadMctbHandoffConfig(input.workspaceId);
  if (config.responseMode === "immediate_handoff" || config.responseMode === "notify_only") {
    throw new Error("Automation cannot resume in this response mode");
  }
  return updateAutomationState(input.conversationId, {
    state: config.responseMode === "guided_collection" ? "collecting_information" : "automation_active",
    humanTakenOverByUserId: null,
  });
}

export async function updateMctbFollowUpStatus(input: {
  workspaceId: string;
  conversationId: string;
  status: "needs_follow_up" | "acknowledged" | "called_back" | "resolved" | "appointment_booked";
  userId: string;
}) {
  const stateMap: Record<string, string> = {
    needs_follow_up: "needs_human",
    acknowledged: "needs_human",
    called_back: "human_active",
    resolved: "resolved",
    appointment_booked: "appointment_booked",
  };
  return updateAutomationState(input.conversationId, {
    followUpStatus: input.status,
    followUpActorUserId: input.userId,
    state: stateMap[input.status] as import("./types").MctbAutomationState,
  });
}
