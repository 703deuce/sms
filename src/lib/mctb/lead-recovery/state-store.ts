import { getPrisma } from "@/lib/db";
import { defaultGuardFields } from "@/lib/mctb/lead-recovery/conversation-guard";
import { mergeConversationTurn, type MctbConversationTurn } from "@/lib/mctb/conversation-thread";
import type {
  LeadRecoveryCollectField,
  LeadRecoveryConversationState,
  LeadRecoveryIntent,
  LeadRecoveryLeadType,
  LeadRecoveryUrgency,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";

const STATE_KEY = "leadRecovery";

const e2eInMemoryState = new Map<string, LeadRecoveryConversationState>();

function e2eStateKey(workspaceId: string, conversationId: string) {
  return `${workspaceId}:${conversationId}`;
}

function useE2eInMemoryState(): boolean {
  if (process.env.LR_CERT_E2E !== "1") return false;
  const prisma = getPrisma();
  return !prisma.mctbConversationAutomationState?.findUnique;
}

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
    ...defaultGuardFields(),
  };
}

export async function loadLeadRecoveryState(input: {
  workspaceId: string;
  conversationId: string;
}): Promise<LeadRecoveryConversationState> {
  if (useE2eInMemoryState()) {
    const hit = e2eInMemoryState.get(e2eStateKey(input.workspaceId, input.conversationId));
    if (hit) return hit;
    return defaultState(input);
  }
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

export class LeadRecoveryStateVersionConflictError extends Error {
  readonly code = "STATE_VERSION_CONFLICT" as const;
  constructor(
    readonly expectedVersion: number,
    readonly actualVersion: number,
  ) {
    super(`Lead recovery state version conflict: expected ${expectedVersion}, got ${actualVersion}`);
    this.name = "LeadRecoveryStateVersionConflictError";
  }
}

export async function saveLeadRecoveryState(
  state: LeadRecoveryConversationState,
  options?: { expectedVersion?: number },
): Promise<void> {
  if (useE2eInMemoryState()) {
    const key = e2eStateKey(state.workspaceId, state.conversationId);
    const existing = e2eInMemoryState.get(key);
    const actual = existing?.stateVersion ?? 0;
    if (options?.expectedVersion !== undefined && options.expectedVersion !== actual) {
      throw new LeadRecoveryStateVersionConflictError(options.expectedVersion, actual);
    }
    e2eInMemoryState.set(key, { ...state, updatedAt: new Date().toISOString() });
    return;
  }
  const prisma = getPrisma();
  const existing = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId: state.conversationId },
    select: { id: true, capturedFieldsJson: true, workspaceId: true },
  });
  const captured = (existing?.capturedFieldsJson || {}) as Record<string, unknown>;
  const prior = captured[STATE_KEY] as LeadRecoveryConversationState | undefined;
  const actualVersion = prior?.stateVersion ?? 0;
  if (options?.expectedVersion !== undefined && options.expectedVersion !== actualVersion) {
    throw new LeadRecoveryStateVersionConflictError(options.expectedVersion, actualVersion);
  }
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

export function appendConversationTurn(
  state: LeadRecoveryConversationState,
  turn: MctbConversationTurn,
): LeadRecoveryConversationState {
  const thread = mergeConversationTurn(state.conversationThread ?? [], turn);
  return { ...state, conversationThread: thread };
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
