import { getPrisma } from "@/lib/db";
import { VOICE_PROMPT_COMPILER_VERSION } from "@/lib/voice/prompt/compile-voice-agent-prompt";
import { businessContextRevision } from "@/lib/voice/prompt/build-business-context";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { LeadRecoveryCollectField, LeadRecoveryUrgency } from "@/lib/mctb/lead-recovery/types";
import {
  VOICE_RUNTIME_STATE_KEY,
  VOICE_RUNTIME_WORKFLOW_VERSION,
  type VoiceActionRecord,
  type VoiceAfterHoursCallState,
  type VoiceWorkflowState,
} from "./types";
import { resolveVoiceCapabilities } from "./capability-resolver";
import { policyVersionLabel, resolveVoiceWorkspacePolicy } from "./wizard-policy-bridge";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function emptyVoiceCallState(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  callerPhone?: string | null;
  configSnapshotRevision?: string;
  policyVersion?: string;
}): VoiceAfterHoursCallState {
  const now = new Date().toISOString();
  return {
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callerPhone: input.callerPhone ?? null,
    currentState: "GREETING",
    primaryIntent: null,
    secondaryIntents: [],
    urgency: "NORMAL",
    collectedFields: {},
    missingFields: [],
    clarificationAttempts: 0,
    toolRetryCounts: {},
    actionHistory: [],
    permittedCapabilities: [],
    allowedTools: [],
    activeTask: null,
    configSnapshotRevision: input.configSnapshotRevision || "unknown",
    promptVersion: VOICE_PROMPT_COMPILER_VERSION,
    policyVersion: input.policyVersion || "lr-wizard-v1",
    workflowVersion: VOICE_RUNTIME_WORKFLOW_VERSION,
    updatedAt: now,
  };
}

function parseVoiceCallState(raw: Record<string, unknown>): VoiceAfterHoursCallState | null {
  if (!raw.callId || !raw.workspaceId || !raw.agentId) return null;
  return {
    callId: String(raw.callId),
    workspaceId: String(raw.workspaceId),
    agentId: String(raw.agentId),
    callerPhone: raw.callerPhone ? String(raw.callerPhone) : null,
    currentState: (raw.currentState as VoiceWorkflowState) || "GREETING",
    primaryIntent: raw.primaryIntent ? (String(raw.primaryIntent) as VoiceAfterHoursCallState["primaryIntent"]) : null,
    secondaryIntents: Array.isArray(raw.secondaryIntents)
      ? raw.secondaryIntents.map(String) as VoiceAfterHoursCallState["secondaryIntents"]
      : [],
    urgency: (raw.urgency as LeadRecoveryUrgency) || "NORMAL",
    collectedFields: asRecord(raw.collectedFields) as VoiceAfterHoursCallState["collectedFields"],
    missingFields: Array.isArray(raw.missingFields)
      ? (raw.missingFields as LeadRecoveryCollectField[])
      : [],
    clarificationAttempts: Number(raw.clarificationAttempts || 0),
    toolRetryCounts: asRecord(raw.toolRetryCounts) as Record<string, number>,
    actionHistory: Array.isArray(raw.actionHistory)
      ? (raw.actionHistory as VoiceActionRecord[])
      : [],
    permittedCapabilities: Array.isArray(raw.permittedCapabilities)
      ? raw.permittedCapabilities.map(String)
      : [],
    allowedTools: Array.isArray(raw.allowedTools) ? raw.allowedTools.map(String) : [],
    activeTask: raw.activeTask ? String(raw.activeTask) : null,
    configSnapshotRevision: String(raw.configSnapshotRevision || "unknown"),
    promptVersion: String(raw.promptVersion || VOICE_PROMPT_COMPILER_VERSION),
    policyVersion: String(raw.policyVersion || "lr-wizard-v1"),
    workflowVersion: String(raw.workflowVersion || VOICE_RUNTIME_WORKFLOW_VERSION),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

export async function loadVoiceCallState(callId: string): Promise<VoiceAfterHoursCallState | null> {
  const call = await getPrisma().voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = asRecord(call?.metadata);
  const raw = asRecord(meta[VOICE_RUNTIME_STATE_KEY]);
  return parseVoiceCallState(raw);
}

export async function saveVoiceCallState(state: VoiceAfterHoursCallState): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: state.callId },
    select: { metadata: true },
  });
  if (!call) throw new Error("Call not found");
  const meta = asRecord(call.metadata);
  const next = { ...state, updatedAt: new Date().toISOString() };
  await prisma.voiceCall.update({
    where: { id: state.callId },
    data: {
      metadata: {
        ...meta,
        [VOICE_RUNTIME_STATE_KEY]: next,
      },
    },
  });
}

export async function ensureVoiceCallState(input: {
  callId: string;
  workspaceId: string;
  agentId: string;
  callerPhone?: string | null;
  wizard?: AppointmentReceptionistWizardState;
}): Promise<VoiceAfterHoursCallState> {
  const existing = await loadVoiceCallState(input.callId);
  if (existing) return existing;

  let policyVersion = "lr-wizard-v1";
  let configRevision = "unknown";
  if (input.wizard) {
    const { config, source } = await resolveVoiceWorkspacePolicy({
      workspaceId: input.workspaceId,
      wizard: input.wizard,
    });
    policyVersion = policyVersionLabel(config, source);
    configRevision = businessContextRevision(input.wizard);
  }

  let state = emptyVoiceCallState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callerPhone: input.callerPhone,
    configSnapshotRevision: configRevision,
    policyVersion,
  });

  if (input.wizard) {
    const resolved = resolveVoiceCapabilities({
      callState: state,
      wizard: input.wizard,
      policy: null,
    });
    state = {
      ...state,
      permittedCapabilities: resolved.capabilities,
      allowedTools: resolved.allowedTools,
    };
  }

  await saveVoiceCallState(state);
  return state;
}

export async function patchVoiceCallState(
  callId: string,
  patch: Partial<VoiceAfterHoursCallState>,
): Promise<VoiceAfterHoursCallState> {
  const current = await loadVoiceCallState(callId);
  if (!current) throw new Error("Voice runtime state not found");
  const next = { ...current, ...patch, callId, updatedAt: new Date().toISOString() };
  await saveVoiceCallState(next);
  return next;
}

export function voiceCallStateToPromptOverlay(
  state: VoiceAfterHoursCallState,
): import("@/lib/voice/prompt/types").VoiceCallPromptState {
  return {
    callId: state.callId,
    currentState: state.currentState,
    primaryIntent: state.primaryIntent,
    knownFields: state.collectedFields as Record<string, string | null | undefined>,
    missingFields: state.missingFields,
    allowedTools: state.allowedTools,
    workflowComplete: state.currentState === "COMPLETE",
  };
}
