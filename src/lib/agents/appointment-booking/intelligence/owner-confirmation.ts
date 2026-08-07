/**
 * Backend confirmation records — the LLM cannot self-confirm production actions.
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";

export type ActionConfirmation = {
  id: string;
  userId: string;
  actionType: string;
  targetId: string;
  confirmedAt?: string;
  expiresAt: string;
  createdAt: string;
};

const CONFIRMATION_TTL_MS = 30 * 60 * 1000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function operatingState(config: VoiceAgentConfig) {
  return asRecord(asRecord(config.advanced).agentOperating);
}

function ownerAmyState(config: VoiceAgentConfig) {
  return asRecord(operatingState(config).ownerAmy);
}

function withOwnerAmy(
  config: VoiceAgentConfig,
  ownerAmy: Record<string, unknown>,
): VoiceAgentConfig {
  const op = operatingState(config);
  return {
    ...config,
    advanced: {
      ...(asRecord(config.advanced) || {}),
      agentOperating: { ...op, ownerAmy },
    },
  };
}

export function listActionConfirmations(draftConfig: unknown): ActionConfirmation[] {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const list = ownerAmyState(config).confirmations;
  return Array.isArray(list) ? (list as ActionConfirmation[]) : [];
}

export async function createActionConfirmation(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  actionType: string;
  targetId: string;
}): Promise<ActionConfirmation> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const oa = ownerAmyState(config);
  const now = Date.now();
  const confirmations = listActionConfirmations(agent.draftConfig).filter(
    (c) => new Date(c.expiresAt).getTime() > now,
  );

  const record: ActionConfirmation = {
    id: createId(),
    userId: input.userId,
    actionType: input.actionType,
    targetId: input.targetId,
    expiresAt: new Date(now + CONFIRMATION_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
  };

  confirmations.push(record);
  const next = withOwnerAmy(config, { ...oa, confirmations });
  await updateVoiceAgentDraft(input.workspaceId, input.agentId, { draftConfig: next });
  return record;
}

export async function consumeActionConfirmation(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  confirmationId: string;
  actionType: string;
  targetId: string;
}): Promise<ActionConfirmation> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const oa = ownerAmyState(config);
  const now = Date.now();
  const confirmations = listActionConfirmations(agent.draftConfig);
  const idx = confirmations.findIndex((c) => c.id === input.confirmationId);

  if (idx < 0) {
    throw new Error("Confirmation record not found or expired");
  }

  const record = confirmations[idx];
  if (record.userId !== input.userId) {
    throw new Error("Confirmation was issued to a different user");
  }
  if (new Date(record.expiresAt).getTime() <= now) {
    throw new Error("Confirmation expired — request approval again");
  }
  if (record.actionType !== input.actionType) {
    throw new Error(`Confirmation action mismatch: expected ${input.actionType}`);
  }
  if (record.targetId !== input.targetId) {
    throw new Error("Confirmation target mismatch");
  }
  if (record.confirmedAt) {
    throw new Error("Confirmation already consumed");
  }

  record.confirmedAt = new Date(now).toISOString();
  confirmations[idx] = record;
  const next = withOwnerAmy(config, { ...oa, confirmations });
  await updateVoiceAgentDraft(input.workspaceId, input.agentId, { draftConfig: next });
  return record;
}

/** Match explicit owner approval phrases — must be a new user message, not model text. */
export function isExplicitOwnerApproval(text: string): boolean {
  return /^(yes|yep|yeah|confirm|approve|go ahead|do it|activate|put (it|this) live|publish)\b/i.test(
    text.trim(),
  );
}

const CHANGE_PROPOSAL_TOOLS = new Set([
  "create_booking_policy_proposal",
  "create_collection_field_proposal",
  "create_service_proposal",
  "create_transfer_rule_proposal",
  "create_voice_proposal",
  "create_resource_assignment_proposal",
  "create_knowledge_proposal",
  "propose_setup_change",
]);

function unwrapToolPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.status === "completed" && d.data && typeof d.data === "object") {
    return d.data as Record<string, unknown>;
  }
  return d;
}

function workflowDraftReady(d: Record<string, unknown>): boolean {
  const architect = d.architectResult as { status?: string } | undefined;
  if (architect?.status && architect.status !== "draft_created") return false;
  if (d.validationStatus === "invalid") return false;
  if (d.validationStatus === "valid") return true;
  return architect?.status === "draft_created";
}

/**
 * Derive backend confirmation records from tool results.
 * Workflow drafts must NOT be mapped to confirm_change_proposal.
 */
export function extractPendingActionConfirmation(
  toolName: string,
  toolResult: unknown,
): { actionType: string; targetId: string } | null {
  const d = unwrapToolPayload(toolResult);
  if (!d) return null;

  if (toolName === "request_workflow_draft") {
    const draftId = d.id || (d.architectResult as { draftId?: string } | undefined)?.draftId;
    if (!draftId || !workflowDraftReady(d)) return null;
    return { actionType: "promote_workflow_draft", targetId: String(draftId) };
  }

  if (!CHANGE_PROPOSAL_TOOLS.has(toolName)) return null;

  const targetId = d.proposalId || d.id;
  if (!targetId) return null;
  const requiresConfirmation = Boolean(
    d.requiresConfirmation || d.confirmationRequired || CHANGE_PROPOSAL_TOOLS.has(toolName),
  );
  if (!requiresConfirmation) return null;

  return { actionType: "confirm_change_proposal", targetId: String(targetId) };
}
