import "server-only";

import { getPrisma } from "@/lib/db";
import { parseDraftConfig } from "../session-store";
import { getFlow } from "../flow-service";
import { customerSmartRoutingFlowWhere } from "../flow-kind";
import { loadSmartRoutingWorkspaceSettings } from "../workspace-settings";
import type {
  AiRoutingContextDestination,
  AiRoutingFlowContext,
  AiRoutingWorkspaceContext,
} from "./types";

export async function loadAiRoutingDestinations(
  workspaceId: string,
): Promise<AiRoutingContextDestination[]> {
  const prisma = getPrisma();
  const rows = await prisma.smartRoutingDestination.findMany({
    where: { workspaceId },
    orderBy: { label: "asc" },
  });
  return rows.map(
    (r: {
      id: string;
      label: string;
      phoneNumber: string | null;
      destinationType: string;
      active: boolean;
    }) => ({
      id: r.id,
      label: r.label,
      phoneNumber: r.phoneNumber,
      destinationType: r.destinationType,
      active: r.active,
    }),
  );
}

export function resolveDestinationByLabel(
  label: string,
  destinations: AiRoutingContextDestination[],
): {
  match?: AiRoutingContextDestination;
  ambiguous?: AiRoutingContextDestination[];
  missing?: true;
} {
  const q = label.trim().toLowerCase();
  const matches = destinations.filter(
    (d) => d.active && d.label.toLowerCase().includes(q),
  );
  if (matches.length === 1) return { match: matches[0] };
  if (matches.length > 1) return { ambiguous: matches };
  const exact = destinations.filter(
    (d) => d.active && d.label.toLowerCase() === q,
  );
  if (exact.length === 1) return { match: exact[0] };
  if (exact.length > 1) return { ambiguous: exact };
  return { missing: true };
}

export async function buildAiRoutingWorkspaceContext(
  workspaceId: string,
): Promise<AiRoutingWorkspaceContext> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true },
  });
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const messaging = await prisma.workspaceMessagingSettings.findUnique({
    where: { workspaceId },
    select: { timezone: true },
  });
  const authorizedCount = await prisma.smartRoutingAuthorizedCaller.count({
    where: { workspaceId, active: true },
  });
  const mctb = await prisma.missedCallTextConfig.findUnique({
    where: { workspaceId },
    select: { enabled: true, consentMode: true },
  });
  const overrideRaw = settings?.scheduleOverrideJson as
    | { scheduleOverride?: { mode?: string; expiresAt?: string } }
    | null
    | undefined;

  return {
    workspaceId,
    businessName: workspace?.displayName || workspace?.name || "Business",
    timezone: messaging?.timezone || "America/New_York",
    routingNumberE164: settings?.routingNumberE164 ?? null,
    callbackNumberE164: settings?.callbackNumberE164 ?? null,
    publicBusinessE164: settings?.publicBusinessE164 ?? null,
    callerIdStatus: settings?.callerIdStatus ?? "not_verified",
    scheduleOverride: overrideRaw?.scheduleOverride ?? null,
    mctbEnabled: Boolean(mctb?.enabled),
    mctbConsentMode: mctb?.consentMode ?? null,
    authorizedCallerCount: authorizedCount,
    outboundEnabled: settings?.outboundEnabled ?? true,
  };
}

export async function buildAiRoutingFlowContext(
  workspaceId: string,
  flowId: string,
): Promise<AiRoutingFlowContext | null> {
  const flow = await getFlow(workspaceId, flowId);
  if (!flow) return null;
  const published = flow.versions?.find(
    (v: { versionNumber: number; publishedAt?: string | Date | null }) => v.publishedAt,
  );
  return {
    flowId: flow.id,
    name: flow.name,
    type: flow.type,
    status: flow.status,
    timezone: flow.timezone,
    triggerMode: flow.triggerMode,
    scheduleJson: (flow.scheduleJson as Record<string, unknown>) ?? null,
    draftConfig: parseDraftConfig(flow.draftConfigJson),
    updatedAt: flow.updatedAt.toISOString(),
    publishedVersionNumber: published?.versionNumber ?? null,
  };
}

export async function getPrimaryFlowId(workspaceId: string): Promise<string | null> {
  const prisma = getPrisma();
  const active = await prisma.smartRoutingFlow.findFirst({
    where: { workspaceId, status: "active", ...customerSmartRoutingFlowWhere },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (active) return active.id;
  const draft = await prisma.smartRoutingFlow.findFirst({
    where: { workspaceId, ...customerSmartRoutingFlowWhere },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return draft?.id ?? null;
}
