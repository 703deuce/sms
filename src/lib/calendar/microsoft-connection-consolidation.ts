import "server-only";

import { isSameMicrosoftAccount } from "@/lib/calendar/microsoft-canonical-connection";
import { mergeCalendarConnectionConfig } from "@/lib/calendar/connection-config-merge";
import { updateWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/db";

const IMPORT_CONFIG_KEYS = [
  "importCalendarIds",
  "writeCalendarId",
  "syncEnabled",
  "phoneFieldKeys",
  "importTitleInclude",
  "importTitleExclude",
  "microsoftDeltaLinks",
  "microsoftSubscription",
] as const;

function pickImportConfig(config: CalendarConfig): Partial<CalendarConfig> {
  const out: Partial<CalendarConfig> = {};
  for (const key of IMPORT_CONFIG_KEYS) {
    const value = config[key];
    if (value === undefined || value === null) continue;
    if (key === "importCalendarIds" && Array.isArray(value) && value.length === 0) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function hasImportCalendars(config: CalendarConfig): boolean {
  return (config.importCalendarIds?.length ?? 0) > 0;
}

export type MicrosoftCalendarConsolidationResult = {
  consolidated: boolean;
  activeConnectionId: string;
  mergedFromIds: string[];
  reason?: string;
};

/**
 * After Microsoft OAuth, merge reminder import settings from duplicate/stale rows
 * into the connection that just received fresh tokens.
 */
export async function consolidateMicrosoftCalendarConnectionsAfterOAuth(input: {
  workspaceId: string;
  activeConnectionId: string;
}): Promise<MicrosoftCalendarConsolidationResult> {
  const prisma = getPrisma();
  const active = await prisma.voiceCalendarConnection.findFirst({
    where: { id: input.activeConnectionId, workspaceId: input.workspaceId, provider: "microsoft" },
  });
  if (!active) {
    return {
      consolidated: false,
      activeConnectionId: input.activeConnectionId,
      mergedFromIds: [],
      reason: "active_not_found",
    };
  }

  const siblings = await prisma.voiceCalendarConnection.findMany({
    where: {
      workspaceId: input.workspaceId,
      provider: "microsoft",
      id: { not: input.activeConnectionId },
    },
  });
  if (!siblings.length) {
    return {
      consolidated: false,
      activeConnectionId: input.activeConnectionId,
      mergedFromIds: [],
      reason: "no_siblings",
    };
  }

  const activeConfig = (active.config || {}) as CalendarConfig;
  let patch: Record<string, unknown> = {};
  const mergedFromIds: string[] = [];

  for (const sibling of siblings) {
    const siblingConfig = (sibling.config || {}) as CalendarConfig;
    if (!isSameMicrosoftAccount(activeConfig, siblingConfig)) continue;

    const importPatch = pickImportConfig(siblingConfig);
    if (!Object.keys(importPatch).length) continue;

    patch = mergeCalendarConnectionConfig(patch, importPatch as Record<string, unknown>);
    mergedFromIds.push(sibling.id);

    await updateWorkspaceCalendarConnection(input.workspaceId, sibling.id, {
      status: "disconnected",
      config: {
        replacedByConnectionId: input.activeConnectionId,
        replacedAt: new Date().toISOString(),
      },
    });
  }

  if (!Object.keys(patch).length) {
    return {
      consolidated: false,
      activeConnectionId: input.activeConnectionId,
      mergedFromIds: [],
      reason: "nothing_to_merge",
    };
  }

  const merged = mergeCalendarConnectionConfig(
    activeConfig as Record<string, unknown>,
    patch,
  ) as CalendarConfig;

  if (!hasImportCalendars(activeConfig) && hasImportCalendars(merged)) {
    merged.syncEnabled = merged.syncEnabled ?? true;
  }

  await updateWorkspaceCalendarConnection(input.workspaceId, input.activeConnectionId, {
    status: "connected",
    config: merged as Record<string, unknown>,
  });

  return {
    consolidated: true,
    activeConnectionId: input.activeConnectionId,
    mergedFromIds,
  };
}
