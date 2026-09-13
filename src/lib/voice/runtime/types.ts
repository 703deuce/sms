import type { LeadRecoveryCollectField, LeadRecoveryIntent, LeadRecoveryUrgency } from "@/lib/mctb/lead-recovery/types";
import type { VoiceUniversalIntent } from "@/lib/voice/intents/universal-intents";

/** After-hours voice workflow states — deterministic, not LLM-owned. */
export const VOICE_WORKFLOW_STATES = [
  "START",
  "GREETING",
  "INTENT_IDENTIFICATION",
  "GENERAL_MESSAGE",
  "SERVICE_INQUIRY",
  "EMERGENCY_INTAKE",
  "CALLBACK_REQUEST",
  "BOOKING_REQUEST",
  "FAQ",
  "MESSAGE_CONFIRMATION",
  "NOTIFICATION",
  "SAFE_FALLBACK",
  "COMPLETE",
] as const;

export type VoiceWorkflowState = (typeof VOICE_WORKFLOW_STATES)[number];

export type VoiceActionStatus =
  | "requested"
  | "validated"
  | "denied"
  | "executing"
  | "succeeded"
  | "failed"
  | "fallback_executed";

export type VoiceActionRecord = {
  action: string;
  status: VoiceActionStatus;
  at: string;
  idempotencyKey?: string;
  detail?: Record<string, unknown>;
};

/** Authoritative per-call state — stored on VoiceCall.metadata.voiceRuntimeState */
export type VoiceAfterHoursCallState = {
  callId: string;
  workspaceId: string;
  agentId: string;
  callerPhone?: string | null;
  currentState: VoiceWorkflowState;
  primaryIntent: VoiceUniversalIntent | LeadRecoveryIntent | null;
  secondaryIntents: Array<VoiceUniversalIntent | LeadRecoveryIntent>;
  urgency: LeadRecoveryUrgency;
  collectedFields: Partial<Record<LeadRecoveryCollectField, string>>;
  missingFields: LeadRecoveryCollectField[];
  clarificationAttempts: number;
  toolRetryCounts: Record<string, number>;
  actionHistory: VoiceActionRecord[];
  permittedCapabilities: string[];
  allowedTools: string[];
  activeTask: string | null;
  configSnapshotRevision: string;
  promptVersion: string;
  policyVersion: string;
  workflowVersion: string;
  updatedAt: string;
};

export const VOICE_RUNTIME_STATE_KEY = "voiceRuntimeState";
export const VOICE_RUNTIME_WORKFLOW_VERSION = "after-hours-v1";
