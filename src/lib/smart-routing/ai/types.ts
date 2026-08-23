import type { DraftConfig, FlowValidationResult } from "../types";

export const AI_ROUTING_INTENTS = ["create", "modify", "analyze", "explain"] as const;
export type AiRoutingIntent = (typeof AI_ROUTING_INTENTS)[number];

export const AI_PROPOSAL_STATUSES = [
  "ai_proposed",
  "validated",
  "awaiting_approval",
  "clarification_needed",
  "published",
  "rejected",
  "failed",
] as const;
export type AiProposalStatus = (typeof AI_PROPOSAL_STATUSES)[number];

export type AiRoutingProposedChange = {
  area: string;
  currentSummary?: string;
  proposedSummary: string;
  changeType?: "add" | "remove" | "modify" | "none";
};

export type AiRoutingProposalPayload = {
  intent: AiRoutingIntent;
  summary: string;
  proposedChanges: AiRoutingProposedChange[];
  routingConfig?: DraftConfig;
  scheduleOverride?: { mode: string; expiresAt?: string; until?: string };
  temporaryRouting?: { expiresAt: string; reason?: string };
  assumptions: string[];
  warnings: string[];
  requiresConfirmation: boolean;
  clarificationQuestion?: string;
};

export type AiRoutingInvocationRecord = {
  requestId: string;
  runtimeId: "smart_routing_ai";
  model: string;
  promptVersion: string;
  toolCalls: string[];
  latencyMs: number;
};

export type AiRoutingContextDestination = {
  id: string;
  label: string;
  phoneNumber: string | null;
  destinationType: string;
  active: boolean;
};

export type AiRoutingWorkspaceContext = {
  workspaceId: string;
  businessName: string;
  timezone: string;
  routingNumberE164: string | null;
  callbackNumberE164: string | null;
  publicBusinessE164: string | null;
  callerIdStatus: string;
  scheduleOverride: { mode?: string; expiresAt?: string } | null;
  mctbEnabled: boolean;
  mctbConsentMode: string | null;
  authorizedCallerCount: number;
  outboundEnabled: boolean;
};

export type AiRoutingFlowContext = {
  flowId: string;
  name: string;
  type: string;
  status: string;
  timezone: string;
  triggerMode: string;
  scheduleJson: Record<string, unknown> | null;
  draftConfig: DraftConfig;
  updatedAt: string;
  publishedVersionNumber: number | null;
};

export type AiRoutingAnalyticsSummary = {
  periodDays: number;
  callsRouted: number;
  answered: number;
  noAnswer: number;
  answerRate: number;
  outboundBusinessCallbacks: number;
  byFlow: Record<string, number>;
  byMenuSelection?: Record<string, number>;
  byHour?: Record<string, number>;
  voicemailCount?: number;
  mctbRecoveryCount?: number;
  insufficientData?: boolean;
};

export type AiRoutingProposalView = {
  id: string;
  status: AiProposalStatus;
  intent: AiRoutingIntent;
  userPrompt: string;
  summary: string | null;
  proposedChanges: AiRoutingProposedChange[];
  assumptions: string[];
  warnings: string[];
  clarificationQuestion: string | null;
  requiresConfirmation: boolean;
  validation: FlowValidationResult | null;
  preview: {
    currentSummary: string;
    proposedSummary: string;
    changes: AiRoutingProposedChange[];
  } | null;
  flowId: string | null;
  baseFlowUpdatedAt: string | null;
  createdAt: string;
  canApply: boolean;
  canUndo: boolean;
};
