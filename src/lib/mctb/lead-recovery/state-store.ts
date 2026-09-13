import { getPrisma } from "@/lib/db";
import type {
  LeadRecoveryCollectField,
  LeadRecoveryConversationState,
  LeadRecoveryIntent,
  LeadRecoveryLeadType,
  LeadRecoveryUrgency,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";

const STATE_KEY = "leadRecovery";

function defaultState(input: {
  workspaceId: string;
  conversationId: string;
}): LeadRecoveryConversationState {
  return {
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    currentIntent: null,
    secondaryIntents: [],
    leadType: "UNKNOWN",
    urgency: "NORMAL",
    serviceCategory: null,
    collectedFields: {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    phase: "IDLE",
    clarificationAttempts: 0,
    lastIntent: null,
    intentPlan: {
      pendingIntents: [],
      completedIntents: [],
      blockedIntents: [],
      currentIntent: null,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function loadLeadRecoveryState(input: {
  workspaceId: string;
  conversationId: string;
}): Promise<LeadRecoveryConversationState> {
  const prisma = getPrisma();
  const row = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId: input.conversationId },
    select: { capturedFieldsJson: true },
  });
  const captured = (row?.capturedFieldsJson || {}) as Record<string, unknown>;
  const stored = captured[STATE_KEY];
  if (stored && typeof stored === "object") {
    return { ...(stored as LeadRecoveryConversationState), conversationId: input.conversationId, workspaceId: input.workspaceId };
  }
  return defaultState(input);
}

export async function saveLeadRecoveryState(state: LeadRecoveryConversationState): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId: state.conversationId },
    select: { id: true, capturedFieldsJson: true, workspaceId: true },
  });
  const captured = (existing?.capturedFieldsJson || {}) as Record<string, unknown>;
  const next = {
    ...captured,
    [STATE_KEY]: { ...state, updatedAt: new Date().toISOString() },
  };
  if (existing) {
    await prisma.mctbConversationAutomationState.update({
      where: { conversationId: state.conversationId },
      data: { capturedFieldsJson: next },
    });
    return;
  }
  await prisma.mctbConversationAutomationState.create({
    data: {
      workspaceId: state.workspaceId,
      conversationId: state.conversationId,
      state: "waiting_for_caller",
      capturedFieldsJson: next,
    },
  });
}

export function mergeIntentIntoState(
  state: LeadRecoveryConversationState,
  intent: StructuredLeadIntent,
): LeadRecoveryConversationState {
  return {
    ...state,
    currentIntent: intent.primary_intent,
    secondaryIntents: intent.secondary_intents,
    leadType: intent.lead_type,
    urgency: intent.urgency,
    serviceCategory: intent.service_category,
    lastIntent: intent,
    collectedFields: {
      ...state.collectedFields,
      ...(intent.reason_for_contact && !state.collectedFields.REASON
        ? { REASON: intent.reason_for_contact }
        : {}),
      ...(intent.location.raw && !state.collectedFields.ADDRESS
        ? { ADDRESS: intent.location.raw }
        : {}),
    },
  };
}

export function applyCollectedField(
  state: LeadRecoveryConversationState,
  field: LeadRecoveryCollectField,
  value: string,
): LeadRecoveryConversationState {
  return {
    ...state,
    collectedFields: { ...state.collectedFields, [field]: value },
    phase: "IDLE",
  };
}
