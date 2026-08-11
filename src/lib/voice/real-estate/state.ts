import { getPrisma } from "@/lib/db";
import type { RealEstateCallState, RealEstateIntent, RealEstateLeadStatus } from "./types";
import { isIntakeComplete, missingRequiredFields } from "./fields";
import {
  isBareLocalContactId,
  parseLocalContactIdFromSafeId,
} from "./contact-id";

export function createInitialCallState(): RealEstateCallState {
  return {
    secondaryIntents: [],
    callerType: "unknown",
    collectedFields: {},
    leadStatus: "new",
    updatedAt: new Date().toISOString(),
  };
}

function activeIntents(state: RealEstateCallState): RealEstateIntent[] {
  const intents: RealEstateIntent[] = [];
  if (state.primaryIntent) intents.push(state.primaryIntent);
  for (const secondary of state.secondaryIntents) {
    if (!intents.includes(secondary)) intents.push(secondary);
  }
  return intents;
}

export function applyPrimaryIntent(
  state: RealEstateCallState,
  intent: RealEstateIntent,
): RealEstateCallState {
  const next: RealEstateCallState = {
    ...state,
    primaryIntent: intent,
    callerType: intentToCallerType(intent),
    leadStatus: state.leadStatus === "new" ? "intake_in_progress" : state.leadStatus,
    updatedAt: new Date().toISOString(),
  };
  next.intakeComplete = isIntakeComplete(activeIntents(next), next.collectedFields);
  return next;
}

export function applySecondaryIntent(
  state: RealEstateCallState,
  intent: RealEstateIntent,
): RealEstateCallState {
  if (state.primaryIntent === intent) return state;
  const secondaryIntents = state.secondaryIntents.includes(intent)
    ? state.secondaryIntents
    : [...state.secondaryIntents, intent];
  const next: RealEstateCallState = {
    ...state,
    secondaryIntents,
    leadStatus: state.leadStatus === "new" ? "intake_in_progress" : state.leadStatus,
    updatedAt: new Date().toISOString(),
  };
  next.intakeComplete = isIntakeComplete(activeIntents(next), next.collectedFields);
  return next;
}

export function recordCollectedField(
  state: RealEstateCallState,
  fieldId: string,
  value: string,
): RealEstateCallState {
  const trimmed = value.trim();
  if (!trimmed) return state;
  const next: RealEstateCallState = {
    ...state,
    collectedFields: { ...state.collectedFields, [fieldId]: trimmed },
    leadStatus: state.leadStatus === "new" ? "intake_in_progress" : state.leadStatus,
    updatedAt: new Date().toISOString(),
  };
  next.intakeComplete = isIntakeComplete(activeIntents(next), next.collectedFields);
  if (next.intakeComplete && next.leadStatus === "intake_in_progress") {
    next.leadStatus = "qualified";
  }
  return next;
}

export function markMessageTaken(state: RealEstateCallState): RealEstateCallState {
  return {
    ...state,
    messageTaken: true,
    leadStatus: "message_taken",
    updatedAt: new Date().toISOString(),
  };
}

export function markAppointmentBooked(state: RealEstateCallState): RealEstateCallState {
  return {
    ...state,
    leadStatus: "appointment_booked",
    updatedAt: new Date().toISOString(),
  };
}

export function markTransferred(state: RealEstateCallState): RealEstateCallState {
  return {
    ...state,
    leadStatus: "transferred",
    updatedAt: new Date().toISOString(),
  };
}

export function buildMissingFieldsSummary(state: RealEstateCallState): string {
  const missing = missingRequiredFields(activeIntents(state), state.collectedFields);
  if (!missing.length) return "All required fields collected.";
  return `Still need: ${missing.map((f) => f.label).join(", ")}.`;
}

export function buildCollectedFieldsSummary(state: RealEstateCallState): string {
  const entries = Object.entries(state.collectedFields).filter(([, v]) => v.trim());
  if (!entries.length) return "No fields collected yet.";
  return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
}

function intentToCallerType(intent: RealEstateIntent): RealEstateCallState["callerType"] {
  switch (intent) {
    case "buyer":
      return "buyer";
    case "seller":
      return "seller";
    case "existing_client":
      return "existing_client";
    case "agent_to_agent":
      return "agent";
    default:
      return "other";
  }
}

export async function persistCallState(input: {
  workspaceId: string;
  callId: string;
  callState: RealEstateCallState;
}): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const prevMeta =
    existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const localContactId =
    parseLocalContactIdFromSafeId(input.callState.contactId) ||
    (isBareLocalContactId(input.callState.contactId) ? input.callState.contactId : undefined);
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...prevMeta,
        realEstateCallState: input.callState,
      },
      ...(localContactId ? { contactId: localContactId } : {}),
    },
  });
}
