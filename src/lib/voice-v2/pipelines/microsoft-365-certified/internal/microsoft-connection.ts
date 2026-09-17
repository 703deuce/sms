import "server-only";

import { getPrisma } from "@/lib/db";
import { hasOAuthTokens, type CalendarConfig } from "./calendar-providers";
import { loadMctbAiBookingConfig, saveMctbAiBookingConfig } from "./workspace-booking-config";
import type { MctbAiBookingProviderId } from "./workspace-booking-types";

export type MicrosoftConnectionHealth = {
  id: string;
  status: string;
  connected: boolean;
  updatedAt: Date;
};

export async function listMicrosoftCalendarConnections(
  workspaceId: string,
): Promise<MicrosoftConnectionHealth[]> {
  const prisma = getPrisma();
  const rows = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId, provider: "microsoft" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, config: true, updatedAt: true },
  });
  return rows.map((row) => {
    const cfg = (row.config || {}) as CalendarConfig;
    const connected = row.status === "connected" && hasOAuthTokens(cfg);
    return {
      id: row.id,
      status: row.status,
      connected,
      updatedAt: row.updatedAt,
    };
  });
}

/** Workspace-level canonical Microsoft Calendar OAuth row (newest healthy connected). */
export async function getCanonicalMicrosoftCalendarConnectionId(
  workspaceId: string,
): Promise<string | null> {
  const rows = await listMicrosoftCalendarConnections(workspaceId);
  const healthy = rows.find((r) => r.connected);
  return healthy?.id ?? null;
}

export async function isMicrosoftConnectionHealthy(
  workspaceId: string,
  connectionId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
    select: { status: true, config: true },
  });
  if (!row) return false;
  const cfg = (row.config || {}) as CalendarConfig;
  return row.status === "connected" && hasOAuthTokens(cfg);
}

/**
 * Resolve which Microsoft connection row MCTB AI Booking should use.
 * Prefers explicit config when healthy; otherwise canonical connected row.
 */
export async function resolveMctbMicrosoftConnectionId(
  workspaceId: string,
  explicitId?: string | null,
): Promise<string | null> {
  const configured = explicitId?.trim() || null;
  if (configured && (await isMicrosoftConnectionHealthy(workspaceId, configured))) {
    return configured;
  }
  return getCanonicalMicrosoftCalendarConnectionId(workspaceId);
}

export type MctbMicrosoftPointerMigrationResult = {
  migrated: boolean;
  fromId: string | null;
  toId: string | null;
  reason?: string;
};

import { shouldRemigrateMctbMicrosoftPointer } from "./microsoft-connection-pointer-logic";

export { shouldRemigrateMctbMicrosoftPointer };

/**
 * After Microsoft OAuth or connection removal, keep MCTB AI Booking pointed at a live connection.
 */
export async function migrateMctbAiBookingMicrosoftConnectionPointers(input: {
  workspaceId: string;
  activeConnectionId: string;
  replacedConnectionIds?: string[];
}): Promise<MctbMicrosoftPointerMigrationResult> {
  const cfg = await loadMctbAiBookingConfig(input.workspaceId);
  if (cfg.provider !== "microsoft") {
    return { migrated: false, fromId: null, toId: null, reason: "provider_not_microsoft" };
  }

  const activeHealthy = await isMicrosoftConnectionHealthy(
    input.workspaceId,
    input.activeConnectionId,
  );
  if (!activeHealthy) {
    return {
      migrated: false,
      fromId: cfg.calendarId ?? null,
      toId: null,
      reason: "active_connection_not_healthy",
    };
  }

  const configuredId = cfg.calendarId || cfg.providerConnectionId || null;
  const configuredHealthy = configuredId
    ? await isMicrosoftConnectionHealthy(input.workspaceId, configuredId)
    : false;
  const decision = shouldRemigrateMctbMicrosoftPointer({
    configuredId,
    configuredHealthy,
    activeConnectionId: input.activeConnectionId,
    activeHealthy,
    replacedConnectionIds: input.replacedConnectionIds,
  });

  if (!decision.migrate) {
    return {
      migrated: false,
      fromId: configuredId,
      toId: configuredId,
      reason: decision.reason,
    };
  }

  await saveMctbAiBookingConfig(input.workspaceId, {
    calendarId: input.activeConnectionId,
    providerConnectionId: input.activeConnectionId,
  });

  return {
    migrated: true,
    fromId: configuredId,
    toId: input.activeConnectionId,
    reason: decision.reason,
  };
}

/** Runtime heal: resolve + persist when config pointer is stale (no manual DB). */
export async function ensureMctbMicrosoftConnectionPointer(
  workspaceId: string,
): Promise<MctbMicrosoftPointerMigrationResult> {
  const cfg = await loadMctbAiBookingConfig(workspaceId);
  if (cfg.provider !== ("microsoft" as MctbAiBookingProviderId)) {
    return { migrated: false, fromId: null, toId: null, reason: "provider_not_microsoft" };
  }
  const canonical = await getCanonicalMicrosoftCalendarConnectionId(workspaceId);
  if (!canonical) {
    return {
      migrated: false,
      fromId: cfg.calendarId ?? null,
      toId: null,
      reason: "no_canonical_connection",
    };
  }
  return migrateMctbAiBookingMicrosoftConnectionPointers({
    workspaceId,
    activeConnectionId: canonical,
  });
}
