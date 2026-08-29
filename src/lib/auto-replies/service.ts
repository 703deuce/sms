import "server-only";

import { getPrisma } from "@/lib/db";
import {
  AUTO_REPLY_TRIGGERS,
  DEFAULT_AUTO_REPLY_RULES,
  type AutoReplyRecord,
  type AutoReplyRules,
  type AutoReplyTriggerConfig,
  type AutoReplyTriggerType,
} from "./types";

function parseTriggerConfig(raw: unknown): AutoReplyTriggerConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    listId: typeof o.listId === "string" ? o.listId : undefined,
    listName: typeof o.listName === "string" ? o.listName : undefined,
    tagId: typeof o.tagId === "string" ? o.tagId : undefined,
    tagName: typeof o.tagName === "string" ? o.tagName : undefined,
    formId: typeof o.formId === "string" ? o.formId : undefined,
    formName: typeof o.formName === "string" ? o.formName : undefined,
  };
}

function parseRules(raw: unknown): AutoReplyRules {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AUTO_REPLY_RULES };
  const o = raw as Record<string, unknown>;
  return {
    oncePerContact: o.oncePerContact !== false,
    excludeUnsubscribed: o.excludeUnsubscribed !== false,
    respectQuietHours: o.respectQuietHours !== false,
  };
}

function mapRow(row: {
  id: string;
  workspaceId: string;
  name: string;
  triggerType: string;
  triggerConfig: unknown;
  message: string;
  mediaUrls: string[];
  status: string;
  rulesJson: unknown;
  sendCount: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AutoReplyRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    triggerType: row.triggerType as AutoReplyTriggerType,
    triggerConfig: parseTriggerConfig(row.triggerConfig),
    message: row.message,
    mediaUrls: row.mediaUrls || [],
    status: row.status === "active" ? "active" : "paused",
    rules: parseRules(row.rulesJson),
    sendCount: row.sendCount,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAutoReplies(workspaceId: string): Promise<AutoReplyRecord[]> {
  const rows = await getPrisma().autoReply.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapRow);
}

export async function getAutoReply(
  workspaceId: string,
  id: string,
): Promise<AutoReplyRecord | null> {
  const row = await getPrisma().autoReply.findFirst({
    where: { id, workspaceId },
  });
  return row ? mapRow(row) : null;
}

export type CreateAutoReplyInput = {
  name: string;
  triggerType: AutoReplyTriggerType;
  triggerConfig?: AutoReplyTriggerConfig;
  message: string;
  mediaUrls?: string[];
  status?: "active" | "paused";
  rules?: Partial<AutoReplyRules>;
};

export async function createAutoReply(
  workspaceId: string,
  input: CreateAutoReplyInput,
): Promise<AutoReplyRecord> {
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.message.trim()) throw new Error("Message is required");
  if (!AUTO_REPLY_TRIGGERS.includes(input.triggerType)) {
    throw new Error("Invalid trigger type");
  }

  const row = await getPrisma().autoReply.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      triggerConfig: (input.triggerConfig || {}) as object,
      message: input.message.trim(),
      mediaUrls: input.mediaUrls || [],
      status: input.status === "active" ? "active" : "paused",
      rulesJson: { ...DEFAULT_AUTO_REPLY_RULES, ...input.rules } as object,
    },
  });
  return mapRow(row);
}

export async function updateAutoReply(
  workspaceId: string,
  id: string,
  input: Partial<CreateAutoReplyInput>,
): Promise<AutoReplyRecord> {
  const existing = await getPrisma().autoReply.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Auto reply not found");

  const row = await getPrisma().autoReply.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.triggerType != null ? { triggerType: input.triggerType } : {}),
      ...(input.triggerConfig != null
        ? { triggerConfig: input.triggerConfig as object }
        : {}),
      ...(input.message != null ? { message: input.message.trim() } : {}),
      ...(input.mediaUrls != null ? { mediaUrls: input.mediaUrls } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.rules != null
        ? {
            rulesJson: {
              ...parseRules(existing.rulesJson),
              ...input.rules,
            } as object,
          }
        : {}),
    },
  });
  return mapRow(row);
}

export async function setAutoReplyStatus(
  workspaceId: string,
  id: string,
  status: "active" | "paused",
): Promise<AutoReplyRecord> {
  return updateAutoReply(workspaceId, id, { status });
}

export async function duplicateAutoReply(
  workspaceId: string,
  id: string,
): Promise<AutoReplyRecord> {
  const source = await getAutoReply(workspaceId, id);
  if (!source) throw new Error("Auto reply not found");
  return createAutoReply(workspaceId, {
    name: `${source.name} (copy)`,
    triggerType: source.triggerType,
    triggerConfig: source.triggerConfig,
    message: source.message,
    mediaUrls: source.mediaUrls,
    status: "paused",
    rules: source.rules,
  });
}

export async function deleteAutoReply(workspaceId: string, id: string): Promise<void> {
  const existing = await getPrisma().autoReply.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Auto reply not found");
  await getPrisma().autoReply.delete({ where: { id } });
}
