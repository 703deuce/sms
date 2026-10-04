import { getPrisma } from "@/lib/db";
import type { MctbAiBookingProviderId } from "@/lib/mctb/ai-booking/types";
import { getDefaultMctbBookingLink } from "@/lib/mctb/ai-booking/fallback";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";

export type MctbAiBookingFulfillmentMode = "calendar" | "link_only";

export type MctbAiBookingWorkspaceConfig = {
  enabled: boolean;
  entitled: boolean;
  upgradeRequired: boolean;
  /** SMS scheduling fulfillment: live provider book vs booking link only (calendar path preserved for later). */
  fulfillmentMode: MctbAiBookingFulfillmentMode;
  /** @deprecated Legacy multi-agent pipeline — MCTB SMS uses simple-sms-agent. Kept for migration reads only. */
  smsPipelinePrimary: boolean;
  provider: MctbAiBookingProviderId;
  providerConnectionId?: string | null;
  eventTypeId?: string | null;
  eventTypeUri?: string | null;
  calendarId?: string | null;
  serviceName?: string | null;
  durationMinutes?: number | null;
  fallbackBookingLinkId?: string | null;
  timezone?: string | null;
};

const DEFAULT_CONFIG: MctbAiBookingWorkspaceConfig = {
  enabled: false,
  entitled: false,
  upgradeRequired: true,
  fulfillmentMode: "link_only",
  smsPipelinePrimary: false,
  provider: "microsoft",
  serviceName: "Consultation",
  durationMinutes: 30,
  timezone: "America/New_York",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRawAiBooking(customFieldsConfig: unknown): Record<string, unknown> {
  const root = asRecord(customFieldsConfig);
  const mctb = asRecord(root.mctb);
  return asRecord(mctb.aiBooking);
}

export async function loadMctbAiBookingConfig(
  workspaceId: string,
): Promise<MctbAiBookingWorkspaceConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const raw = readRawAiBooking(ws?.customFieldsConfig);

  const provider =
    raw.provider === "calendly" || raw.provider === "zoho" || raw.provider === "microsoft"
      ? (raw.provider as MctbAiBookingProviderId)
      : DEFAULT_CONFIG.provider;

  const entitled = await hasMctbAiBookingEntitlement(workspaceId);
  const enabledFlag = raw.enabled === true;
  const fulfillmentMode: MctbAiBookingFulfillmentMode =
    raw.fulfillmentMode === "calendar" ? "calendar" : "link_only";

  return {
    enabled: enabledFlag && entitled,
    entitled,
    upgradeRequired: !entitled,
    fulfillmentMode,
    smsPipelinePrimary: raw.smsPipelinePrimary === true,
    provider,
    providerConnectionId:
      typeof raw.providerConnectionId === "string" ? raw.providerConnectionId : null,
    eventTypeId: typeof raw.eventTypeId === "string" ? raw.eventTypeId : null,
    eventTypeUri:
      typeof raw.eventTypeUri === "string"
        ? raw.eventTypeUri
        : typeof raw.eventTypeId === "string"
          ? raw.eventTypeId
          : null,
    calendarId:
      typeof raw.calendarId === "string"
        ? raw.calendarId
        : typeof raw.calendarConnectionId === "string"
          ? raw.calendarConnectionId
          : null,
    serviceName:
      typeof raw.serviceName === "string" ? raw.serviceName : DEFAULT_CONFIG.serviceName,
    durationMinutes:
      typeof raw.durationMinutes === "number" ? raw.durationMinutes : DEFAULT_CONFIG.durationMinutes,
    fallbackBookingLinkId:
      typeof raw.fallbackBookingLinkId === "string" ? raw.fallbackBookingLinkId : null,
    timezone: typeof raw.timezone === "string" ? raw.timezone : DEFAULT_CONFIG.timezone,
  };
}

export async function saveMctbAiBookingConfig(
  workspaceId: string,
  patch: Partial<{
    enabled: boolean;
    fulfillmentMode: MctbAiBookingFulfillmentMode;
    smsPipelinePrimary: boolean;
    provider: MctbAiBookingProviderId;
    providerConnectionId: string | null;
    eventTypeId: string | null;
    eventTypeUri: string | null;
    calendarId: string | null;
    serviceName: string | null;
    durationMinutes: number | null;
    fallbackBookingLinkId: string | null;
    timezone: string | null;
    entitled: boolean;
  }>,
): Promise<MctbAiBookingWorkspaceConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(root.mctb);
  const prev = asRecord(mctb.aiBooking);
  const next = { ...prev, ...patch };
  const customFieldsConfig = {
    ...root,
    mctb: {
      ...mctb,
      aiBooking: next,
    },
  };
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customFieldsConfig },
  });
  return loadMctbAiBookingConfig(workspaceId);
}

export async function resolveFallbackBookingUrl(
  workspaceId: string,
  config: MctbAiBookingWorkspaceConfig,
): Promise<string | null> {
  if (config.fallbackBookingLinkId) {
    const prisma = getPrisma();
    const row = await prisma.mctbBookingLink.findFirst({
      where: { workspaceId, id: config.fallbackBookingLinkId, active: true },
    });
    if (row?.url) return row.url;
  }
  const def = await getDefaultMctbBookingLink(workspaceId);
  return def?.url ?? null;
}
