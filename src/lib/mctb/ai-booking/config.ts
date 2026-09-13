import { getPrisma } from "@/lib/db";
import type { MctbAiBookingProviderId } from "@/lib/mctb/ai-booking/types";
import { getDefaultMctbBookingLink } from "@/lib/mctb/ai-booking/fallback";

export type MctbAiBookingWorkspaceConfig = {
  enabled: boolean;
  upgradeRequired: boolean;
  provider: MctbAiBookingProviderId;
  serviceName?: string | null;
  eventTypeUri?: string | null;
  calendarConnectionId?: string | null;
  fallbackBookingLinkId?: string | null;
  timezone?: string | null;
};

const DEFAULT_CONFIG: MctbAiBookingWorkspaceConfig = {
  enabled: false,
  upgradeRequired: true,
  provider: "microsoft",
  serviceName: "Consultation",
  timezone: "America/New_York",
};

export async function loadMctbAiBookingConfig(
  workspaceId: string,
): Promise<MctbAiBookingWorkspaceConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    root.mctb && typeof root.mctb === "object" ? (root.mctb as Record<string, unknown>) : {};
  const raw =
    mctb.aiBooking && typeof mctb.aiBooking === "object"
      ? (mctb.aiBooking as Record<string, unknown>)
      : {};

  const provider = raw.provider === "calendly" || raw.provider === "zoho" || raw.provider === "microsoft"
    ? (raw.provider as MctbAiBookingProviderId)
    : DEFAULT_CONFIG.provider;

  return {
    enabled: raw.enabled === true,
    upgradeRequired: raw.upgradeRequired !== false,
    provider,
    serviceName:
      typeof raw.serviceName === "string" ? raw.serviceName : DEFAULT_CONFIG.serviceName,
    eventTypeUri: typeof raw.eventTypeUri === "string" ? raw.eventTypeUri : null,
    calendarConnectionId:
      typeof raw.calendarConnectionId === "string" ? raw.calendarConnectionId : null,
    fallbackBookingLinkId:
      typeof raw.fallbackBookingLinkId === "string" ? raw.fallbackBookingLinkId : null,
    timezone: typeof raw.timezone === "string" ? raw.timezone : DEFAULT_CONFIG.timezone,
  };
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
