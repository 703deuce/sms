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
