import "server-only";

import { loadSmartRoutingWorkspaceSettings } from "./workspace-settings";

export type RouteOverride = {
  destinationId: string;
  expiresAt: string;
};

export async function loadActiveRouteOverride(workspaceId: string): Promise<RouteOverride | null> {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const raw = settings?.scheduleOverrideJson as
    | { routeOverride?: { destinationId?: string; expiresAt?: string } }
    | null;
  const override = raw?.routeOverride;
  if (!override?.destinationId || !override.expiresAt) return null;
  const exp = new Date(override.expiresAt);
  if (exp <= new Date()) return null;
  return { destinationId: override.destinationId, expiresAt: override.expiresAt };
}

export function routeOverridePayload(
  destinationId: string,
  expiresAt: Date,
): Record<string, unknown> {
  return {
    routeOverride: {
      destinationId,
      expiresAt: expiresAt.toISOString(),
    },
  };
}
