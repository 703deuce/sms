/**
 * Owner Amy conversation and action state — separate from raw chat history.
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";

export type OwnerConversationMessage = {
  role: "user" | "assistant";
  text: string;
  at: string;
  model?: string;
  promptVersion?: string;
  toolCalls?: Array<{ name: string; args?: unknown }>;
};

export type OwnerConversationState = {
  conversationId: string;
  workspaceId: string;
  agentId: string;
  userId: string;
  activeProposalId?: string;
  pendingConfirmationId?: string;
  activeJobIds: string[];
  referencedCallIds: string[];
  referencedVersionIds: string[];
  lastIntent?: string;
  messages: OwnerConversationMessage[];
  updatedAt: string;
};

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

function conversationKey(userId: string) {
  return `conv_${userId}`;
}

export function getOwnerConversation(
  draftConfig: unknown,
  userId: string,
): OwnerConversationState | null {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const oa = ownerAmyState(config);
  const convos = asRecord(oa.conversations);
  const raw = convos[conversationKey(userId)];
  return raw ? (raw as OwnerConversationState) : null;
}

export async function loadOrCreateOwnerConversation(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
}): Promise<OwnerConversationState> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const existing = getOwnerConversation(agent.draftConfig, input.userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  return {
    conversationId: createId(),
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    userId: input.userId,
    activeJobIds: [],
    referencedCallIds: [],
    referencedVersionIds: [],
    messages: [],
    updatedAt: now,
  };
}

export async function persistOwnerConversation(
  workspaceId: string,
  agentId: string,
  state: OwnerConversationState,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!row) throw new Error("Agent not found");

  const config = parseVoiceAgentConfig(row.draftConfig);
  const oa = ownerAmyState(config);
  const convos = { ...asRecord(oa.conversations) };
  convos[conversationKey(state.userId)] = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  const next = withOwnerAmy(config, { ...oa, conversations: convos });
  await updateVoiceAgentDraft(workspaceId, agentId, { draftConfig: next });
}

export function appendConversationTurn(
  state: OwnerConversationState,
  turn: OwnerConversationMessage,
): OwnerConversationState {
  const messages = [...state.messages, turn].slice(-40);
  return { ...state, messages, updatedAt: new Date().toISOString() };
}

export function trackToolReferences(
  state: OwnerConversationState,
  toolName: string,
  result: unknown,
): OwnerConversationState {
  const next = { ...state };
  if (!result || typeof result !== "object") return next;

  const data =
    "status" in (result as object) && (result as { status: string }).status === "completed"
      ? (result as { data: unknown }).data
      : result;

  if (!data || typeof data !== "object") return next;

  const d = data as Record<string, unknown>;
  const callId = d.callId || (d.trace as { callId?: string })?.callId;
  if (callId && typeof callId === "string") {
    next.referencedCallIds = [...new Set([...next.referencedCallIds, callId])];
  }
  if (toolName === "search_calls" && Array.isArray(d.traces)) {
    for (const t of d.traces) {
      const id = (t as { callId?: string }).callId;
      if (id) next.referencedCallIds = [...new Set([...next.referencedCallIds, id])];
    }
  }
  if (d.proposalId && typeof d.proposalId === "string") {
    next.activeProposalId = d.proposalId;
  }
  if (d.id && /proposal/i.test(toolName)) {
    next.activeProposalId = String(d.id);
  }
  if (d.jobId && typeof d.jobId === "string") {
    next.activeJobIds = [...new Set([...next.activeJobIds, d.jobId])];
  }
  return next;
}
