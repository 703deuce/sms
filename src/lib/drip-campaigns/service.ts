import "server-only";

import { filterWorkspaceListIds } from "@/lib/contacts/workspace-membership";
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

async function resolveWorkspacePhoneNumberId(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  if (!phoneNumberId) return null;
  const row = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { id: true },
  });
  if (!row) throw new Error("Invalid phone number");
  return row.id;
}

export async function assertDripCampaignLaunchReady(
  workspaceId: string,
  record: {
    triggerType: string;
    triggerConfig: unknown;
    phoneNumberId: string | null;
    stepsJson: unknown;
  },
): Promise<void> {
  const steps = parseDripSteps(record.stepsJson);
  if (!steps.length) throw new Error("At least one message is required");
  if (!record.phoneNumberId) throw new Error("Phone number is required");
  await validateTriggerConfig(
    workspaceId,
    record.triggerType as DripCampaignTriggerType,
    parseTriggerConfig(record.triggerConfig),
  );
}

async function validateTriggerConfig(
  workspaceId: string,
  triggerType: DripCampaignTriggerType,
  config: DripTriggerConfig | undefined,
): Promise<DripTriggerConfig> {
  const prisma = getPrisma();
  const out: DripTriggerConfig = { ...(config || {}) };

  switch (triggerType) {
    case "list_join": {
      if (!out.listId) throw new Error("List is required for list_join trigger");
      const [listId] = await filterWorkspaceListIds(workspaceId, [out.listId]);
      if (!listId) throw new Error("Invalid list");
      out.listId = listId;
      break;
    }
    case "tag_added": {
      if (!out.tagId) throw new Error("Tag is required for tag_added trigger");
      const tag = await prisma.tag.findFirst({
        where: { id: out.tagId, workspaceId },
        select: { id: true, name: true },
      });
      if (!tag) throw new Error("Invalid tag");
      out.tagId = tag.id;
      if (!out.tagName) out.tagName = tag.name;
      break;
    }
    case "form_submitted": {
      if (!out.formId) throw new Error("Form is required for form_submitted trigger");
      const form = await prisma.optInForm.findFirst({
        where: { id: out.formId, workspaceId },
        select: { id: true, name: true },
      });
      if (!form) throw new Error("Invalid form");
      out.formId = form.id;
      if (!out.formName) out.formName = form.name;
      break;
    }
    case "contact_added":
      break;
    default:
      throw new Error("Invalid trigger type");
  }

  if (out.exclusionListId) {
    const [exclusionListId] = await filterWorkspaceListIds(workspaceId, [out.exclusionListId]);
    if (!exclusionListId) delete out.exclusionListId;
    else out.exclusionListId = exclusionListId;
  }

  if (out.exclusionSegmentId) {
    const segment = await prisma.segment.findFirst({
      where: { id: out.exclusionSegmentId, workspaceId },
      select: { id: true },
    });
    if (!segment) delete out.exclusionSegmentId;
  }

  return out;
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

/** Active campaigns only — used by trigger matching to avoid hydrating phones. */
export async function listActiveDripCampaigns(
  workspaceId: string,
): Promise<DripCampaignRecord[]> {
  const rows = await getPrisma().dripCampaign.findMany({
    where: { workspaceId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapRow);
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

  const triggerConfig = await validateTriggerConfig(
    workspaceId,
    input.triggerType,
    input.triggerConfig,
  );
  const phoneNumberId = await resolveWorkspacePhoneNumberId(workspaceId, input.phoneNumberId);
  const status = input.status || "paused";

  if (status === "active") {
    await assertDripCampaignLaunchReady(workspaceId, {
      triggerType: input.triggerType,
      triggerConfig,
      phoneNumberId,
      stepsJson: steps,
    });
  }

  const row = await getPrisma().dripCampaign.create({
    data: {
      workspaceId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      triggerConfig: triggerConfig as object,
      phoneNumberId,
      status,
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

  const triggerType = (input.triggerType ??
    existing.triggerType) as DripCampaignTriggerType;
  const patch: Record<string, unknown> = {};

  if (input.name != null) {
    const trimmed = input.name.trim();
    if (trimmed) patch.name = trimmed;
  }
  if (input.triggerType != null) {
    if (!DRIP_CAMPAIGN_TRIGGERS.includes(input.triggerType)) {
      throw new Error("Invalid trigger type");
    }
    patch.triggerType = input.triggerType;
  }
  if (input.triggerConfig != null) {
    patch.triggerConfig = await validateTriggerConfig(
      workspaceId,
      triggerType,
      input.triggerConfig,
    );
  } else if (input.triggerType != null) {
    patch.triggerConfig = await validateTriggerConfig(
      workspaceId,
      triggerType,
      parseTriggerConfig(existing.triggerConfig),
    );
  }
  if (input.phoneNumberId !== undefined) {
    patch.phoneNumberId = await resolveWorkspacePhoneNumberId(workspaceId, input.phoneNumberId);
  }
  if (input.status != null) patch.status = input.status;
  if (input.steps != null) {
    const steps = parseDripSteps(input.steps);
    if (!steps.length) throw new Error("At least one message is required");
    patch.stepsJson = steps;
  }

  const nextStatus = (patch.status as string | undefined) ?? existing.status;
  if (nextStatus === "active") {
    await assertDripCampaignLaunchReady(workspaceId, {
      triggerType: (patch.triggerType as string | undefined) ?? existing.triggerType,
      triggerConfig:
        patch.triggerConfig ??
        (input.triggerConfig != null
          ? input.triggerConfig
          : parseTriggerConfig(existing.triggerConfig)),
      phoneNumberId:
        patch.phoneNumberId !== undefined
          ? (patch.phoneNumberId as string | null)
          : existing.phoneNumberId,
      stepsJson: patch.stepsJson ?? existing.stepsJson,
    });
  }

  const row =
    Object.keys(patch).length > 0
      ? await getPrisma().dripCampaign.update({
          where: { id },
          data: patch,
        })
      : existing;

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
