import "server-only";

import { getPrisma } from "@/lib/db";
import {
  DRIP_CAMPAIGN_TRIGGERS,
  parseDripSteps,
  type DripCampaignRecord,
  type DripCampaignTriggerType,
  type DripStep,
  type DripTriggerConfig,
} from "./types";

function parseTriggerConfig(raw: unknown): DripTriggerConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    listId: typeof o.listId === "string" ? o.listId : undefined,
    listName: typeof o.listName === "string" ? o.listName : undefined,
    tagId: typeof o.tagId === "string" ? o.tagId : undefined,
    tagName: typeof o.tagName === "string" ? o.tagName : undefined,
    formId: typeof o.formId === "string" ? o.formId : undefined,
    formName: typeof o.formName === "string" ? o.formName : undefined,
    exclusionListId: typeof o.exclusionListId === "string" ? o.exclusionListId : undefined,
    exclusionSegmentId:
      typeof o.exclusionSegmentId === "string" ? o.exclusionSegmentId : undefined,
  };
}

async function resolvePhoneE164(
  workspaceId: string,
  phoneNumberId: string | null,
): Promise<string | null> {
  if (!phoneNumberId) return null;
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { e164: true },
  });
  return row?.e164 || null;
}

function mapRow(row: {
  id: string;
  workspaceId: string;
  name: string;
  triggerType: string;
  triggerConfig: unknown;
  phoneNumberId: string | null;
  status: string;
  stepsJson: unknown;
  triggeredCount: number;
  messagesSent: number;
  lastSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DripCampaignRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    triggerType: row.triggerType as DripCampaignTriggerType,
    triggerConfig: parseTriggerConfig(row.triggerConfig),
    phoneNumberId: row.phoneNumberId,
    phoneNumberE164: null,
    status:
      row.status === "active" ? "active" : row.status === "draft" ? "draft" : "paused",
    steps: parseDripSteps(row.stepsJson),
    triggeredCount: row.triggeredCount,
    messagesSent: row.messagesSent,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function hydratePhone(campaign: DripCampaignRecord): Promise<DripCampaignRecord> {
  return {
    ...campaign,
    phoneNumberE164: await resolvePhoneE164(campaign.workspaceId, campaign.phoneNumberId),
  };
}

export async function listDripCampaigns(workspaceId: string): Promise<DripCampaignRecord[]> {
  const rows = await getPrisma().dripCampaign.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  const mapped = rows.map(mapRow);
  return Promise.all(mapped.map(hydratePhone));
}

export async function getDripCampaign(
  workspaceId: string,
  id: string,
): Promise<DripCampaignRecord | null> {
  const row = await getPrisma().dripCampaign.findFirst({
    where: { id, workspaceId },
  });
  if (!row) return null;
  return hydratePhone(mapRow(row));
}

export type CreateDripCampaignInput = {
  name: string;
  triggerType: DripCampaignTriggerType;
  triggerConfig?: DripTriggerConfig;
  phoneNumberId?: string | null;
  status?: "active" | "paused" | "draft";
  steps: DripStep[];
};

export async function createDripCampaign(
  workspaceId: string,
  input: CreateDripCampaignInput,
): Promise<DripCampaignRecord> {
  if (!input.name.trim()) throw new Error("Name is required");
  if (!DRIP_CAMPAIGN_TRIGGERS.includes(input.triggerType)) {
    throw new Error("Invalid trigger type");
  }
  const steps = parseDripSteps(input.steps);
  if (!steps.length) throw new Error("At least one message is required");

  const row = await getPrisma().dripCampaign.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      triggerConfig: (input.triggerConfig || {}) as object,
      phoneNumberId: input.phoneNumberId || null,
      status: input.status || "paused",
      stepsJson: steps as object[],
    },
  });
  return hydratePhone(mapRow(row));
}

export async function updateDripCampaign(
  workspaceId: string,
  id: string,
  input: Partial<CreateDripCampaignInput>,
): Promise<DripCampaignRecord> {
  const existing = await getPrisma().dripCampaign.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Drip campaign not found");

  const row = await getPrisma().dripCampaign.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.triggerType != null ? { triggerType: input.triggerType } : {}),
      ...(input.triggerConfig != null ? { triggerConfig: input.triggerConfig as object } : {}),
      ...(input.phoneNumberId !== undefined ? { phoneNumberId: input.phoneNumberId } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.steps != null ? { stepsJson: parseDripSteps(input.steps) as object[] } : {}),
    },
  });
  return hydratePhone(mapRow(row));
}

export async function deleteDripCampaign(workspaceId: string, id: string): Promise<void> {
  const existing = await getPrisma().dripCampaign.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new Error("Drip campaign not found");
  await getPrisma().dripCampaign.delete({ where: { id } });
}

export async function duplicateDripCampaign(
  workspaceId: string,
  id: string,
): Promise<DripCampaignRecord> {
  const source = await getDripCampaign(workspaceId, id);
  if (!source) throw new Error("Drip campaign not found");
  return createDripCampaign(workspaceId, {
    name: `${source.name} (copy)`,
    triggerType: source.triggerType,
    triggerConfig: source.triggerConfig,
    phoneNumberId: source.phoneNumberId,
    status: "paused",
    steps: source.steps,
  });
}
