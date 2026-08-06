/**
 * Structured agent-to-agent handoffs (e.g. MCTB → Amy).
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";

export type AgentHandoffPayload = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  contactId?: string | null;
  conversationId?: string | null;
  callId?: string | null;
  source: string;
  intent: string;
  collectedFields: Record<string, unknown>;
  requestedNextAction: string;
  urgency: "low" | "normal" | "high";
  consentStatus: "unknown" | "opted_in" | "opted_out" | "human_controlled";
  owningAgentId: string;
  status: "pending" | "accepted" | "completed" | "rejected" | "expired";
  createdAt: string;
  completedAt?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function createAgentHandoff(input: {
  workspaceId: string;
  fromAgentId: string;
  toAgentId: string;
  source: string;
  intent: string;
  requestedNextAction: string;
  collectedFields?: Record<string, unknown>;
  contactId?: string;
  conversationId?: string;
  callId?: string;
  urgency?: AgentHandoffPayload["urgency"];
  consentStatus?: AgentHandoffPayload["consentStatus"];
}): Promise<AgentHandoffPayload> {
  const handoff: AgentHandoffPayload = {
    id: createId(),
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    contactId: input.contactId || null,
    conversationId: input.conversationId || null,
    callId: input.callId || null,
    source: input.source,
    intent: input.intent,
    collectedFields: input.collectedFields || {},
    requestedNextAction: input.requestedNextAction,
    urgency: input.urgency || "normal",
    consentStatus: input.consentStatus || "unknown",
    owningAgentId: input.toAgentId,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.toAgentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Target agent not found");
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const advanced = asRecord(config.advanced);
  const operating = asRecord(advanced.agentOperating);
  const list = Array.isArray(operating.handoffs) ? [...operating.handoffs] : [];
  list.unshift(handoff);
  await updateVoiceAgentDraft(input.workspaceId, input.toAgentId, {
    draftConfig: {
      ...config,
      advanced: {
        ...advanced,
        agentOperating: {
          ...operating,
          handoffs: list.slice(0, 50),
        },
      },
    },
  });
  return handoff;
}

export function listAgentHandoffs(draftConfig: unknown): AgentHandoffPayload[] {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const list = asRecord(asRecord(config.advanced).agentOperating).handoffs;
  return Array.isArray(list) ? (list as AgentHandoffPayload[]) : [];
}
