import "server-only";

import { getPrisma } from "@/lib/db";
import {
  DEFAULT_AI_ADVANCED,
  parseAdvancedConfig,
  parseHandoffConfig,
  parseKnowledgeConfig,
  parseLeadConfig,
  parseTriggerConfig,
  type AiReplyRecord,
  type AiReplyType,
  type AiReplyTone,
  type AiReplyLength,
  type AiAdvancedConfig,
  type AiHandoffConfig,
  type AiKnowledgeConfig,
  type AiLeadConfig,
  type AiTriggerConfig,
} from "./types";

function mapRow(row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  replyType: string;
  phoneNumberId: string | null;
  status: string;
  tone: string;
  responseLength: string;
  systemPrompt: string;
  triggerConfig: unknown;
  knowledgeConfig: unknown;
  leadConfig: unknown;
  handoffConfig: unknown;
  advancedConfig: unknown;
  messagesSent: number;
  contactsEngaged: number;
  conversions: number;
  handoffs: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AiReplyRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    replyType: row.replyType as AiReplyType,
    phoneNumberId: row.phoneNumberId,
    phoneNumberE164: null,
    status: row.status === "active" ? "active" : row.status === "draft" ? "draft" : "paused",
    tone: row.tone as AiReplyTone,
    responseLength: row.responseLength as AiReplyLength,
    systemPrompt: row.systemPrompt,
    trigger: parseTriggerConfig(row.triggerConfig),
    knowledge: parseKnowledgeConfig(row.knowledgeConfig),
    lead: parseLeadConfig(row.leadConfig),
    handoff: parseHandoffConfig(row.handoffConfig),
    advanced: parseAdvancedConfig(row.advancedConfig),
    messagesSent: row.messagesSent,
    contactsEngaged: row.contactsEngaged,
    conversions: row.conversions,
    handoffs: row.handoffs,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function hydratePhone(row: AiReplyRecord): Promise<AiReplyRecord> {
  if (!row.phoneNumberId) return row;
  const pn = await getPrisma().phoneNumber.findFirst({
    where: { id: row.phoneNumberId, workspaceId: row.workspaceId },
    select: { e164: true },
  });
  return { ...row, phoneNumberE164: pn?.e164 || null };
}

export type CreateAiReplyInput = {
  name: string;
  description?: string;
  replyType?: AiReplyType;
  phoneNumberId?: string | null;
  status?: "active" | "paused" | "draft";
  tone?: AiReplyTone;
  responseLength?: AiReplyLength;
  systemPrompt: string;
  trigger?: AiTriggerConfig;
  knowledge?: AiKnowledgeConfig;
  lead?: AiLeadConfig;
  handoff?: AiHandoffConfig;
  advanced?: AiAdvancedConfig;
};

export async function listAiReplies(workspaceId: string): Promise<AiReplyRecord[]> {
  const rows = await getPrisma().aiReply.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return Promise.all(rows.map((r) => hydratePhone(mapRow(r))));
}

export async function getAiReply(workspaceId: string, id: string): Promise<AiReplyRecord | null> {
  const row = await getPrisma().aiReply.findFirst({ where: { id, workspaceId } });
  if (!row) return null;
  return hydratePhone(mapRow(row));
}

export async function createAiReply(
  workspaceId: string,
  input: CreateAiReplyInput,
): Promise<AiReplyRecord> {
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.systemPrompt.trim()) throw new Error("Instructions are required");

  const row = await getPrisma().aiReply.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      replyType: input.replyType || "conversational",
      phoneNumberId: input.phoneNumberId || null,
      status: input.status || "paused",
      tone: input.tone || "professional",
      responseLength: input.responseLength || "medium",
      systemPrompt: input.systemPrompt.trim(),
      triggerConfig: (input.trigger || { mode: "all_incoming" }) as object,
      knowledgeConfig: (input.knowledge || {}) as object,
      leadConfig: (input.lead || {}) as object,
      handoffConfig: (input.handoff || { enabled: true, keywords: ["agent", "human", "help"] }) as object,
      advancedConfig: { ...DEFAULT_AI_ADVANCED, ...input.advanced } as object,
    },
  });
  return hydratePhone(mapRow(row));
}

export async function updateAiReply(
  workspaceId: string,
  id: string,
  input: Partial<CreateAiReplyInput>,
): Promise<AiReplyRecord> {
  const existing = await getPrisma().aiReply.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("AI reply not found");

  const row = await getPrisma().aiReply.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.replyType != null ? { replyType: input.replyType } : {}),
      ...(input.phoneNumberId !== undefined ? { phoneNumberId: input.phoneNumberId } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.tone != null ? { tone: input.tone } : {}),
      ...(input.responseLength != null ? { responseLength: input.responseLength } : {}),
      ...(input.systemPrompt != null ? { systemPrompt: input.systemPrompt.trim() } : {}),
      ...(input.trigger != null ? { triggerConfig: input.trigger as object } : {}),
      ...(input.knowledge != null ? { knowledgeConfig: input.knowledge as object } : {}),
      ...(input.lead != null ? { leadConfig: input.lead as object } : {}),
      ...(input.handoff != null ? { handoffConfig: input.handoff as object } : {}),
      ...(input.advanced != null
        ? {
            advancedConfig: {
              ...parseAdvancedConfig(existing.advancedConfig),
              ...input.advanced,
            } as object,
          }
        : {}),
    },
  });
  return hydratePhone(mapRow(row));
}

export async function deleteAiReply(workspaceId: string, id: string): Promise<void> {
  const existing = await getPrisma().aiReply.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("AI reply not found");
  await getPrisma().aiReply.delete({ where: { id } });
}

export async function duplicateAiReply(workspaceId: string, id: string): Promise<AiReplyRecord> {
  const source = await getAiReply(workspaceId, id);
  if (!source) throw new Error("AI reply not found");
  return createAiReply(workspaceId, {
    name: `${source.name} (copy)`,
    description: source.description || undefined,
    replyType: source.replyType,
    phoneNumberId: source.phoneNumberId,
    status: "draft",
    tone: source.tone,
    responseLength: source.responseLength,
    systemPrompt: source.systemPrompt,
    trigger: source.trigger,
    knowledge: source.knowledge,
    lead: source.lead,
    handoff: source.handoff,
    advanced: source.advanced,
  });
}
