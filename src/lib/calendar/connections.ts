import "server-only";

import { getPrisma } from "@/lib/db";

export type WorkspaceCalendarProvider = "google" | "microsoft" | "internal" | "calendly";

export type WorkspaceCalendarConnection = {
  id: string;
  workspaceId: string;
  name: string;
  provider: string;
  status: string;
  config: Record<string, unknown> | null;
  credentialsRef: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const OAUTH_PROVIDERS = new Set<WorkspaceCalendarProvider>(["google", "microsoft"]);

export function isOAuthCalendarProvider(provider: string) {
  return OAUTH_PROVIDERS.has(provider as WorkspaceCalendarProvider);
}

export async function listWorkspaceCalendarConnections(workspaceId: string) {
  return getPrisma().voiceCalendarConnection.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getWorkspaceCalendarConnection(workspaceId: string, connectionId: string) {
  return getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
  });
}

export async function createWorkspaceCalendarConnection(
  workspaceId: string,
  input: {
    name?: string;
    provider?: string;
    config?: Record<string, unknown>;
  },
) {
  const provider = input.provider || "internal";
  const status =
    provider === "google" || provider === "microsoft"
      ? "pending_oauth"
      : provider === "internal"
        ? "connected"
        : "pending";

  return getPrisma().voiceCalendarConnection.create({
    data: {
      workspaceId,
      name: input.name || "Calendar",
      provider,
      config: input.config || {},
      status,
    },
  });
}

export async function updateWorkspaceCalendarConnection(
  workspaceId: string,
  connectionId: string,
  data: {
    name?: string;
    status?: string;
    config?: Record<string, unknown>;
    lastSyncAt?: Date;
  },
) {
  const existing = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!existing) return null;

  return getPrisma().voiceCalendarConnection.update({
    where: { id: connectionId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.config !== undefined ? { config: data.config } : {}),
      ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
    },
  });
}

export async function deleteWorkspaceCalendarConnection(workspaceId: string, connectionId: string) {
  const existing = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  if (!existing) return null;

  const prisma = getPrisma();
  await prisma.voiceService.updateMany({
    where: { workspaceId, calendarId: connectionId },
    data: { calendarId: null },
  });
  await prisma.voiceStaffMember.updateMany({
    where: { workspaceId, calendarId: connectionId },
    data: { calendarId: null },
  });

  const deleted = await prisma.voiceCalendarConnection.delete({
    where: { id: connectionId },
  });

  if (existing.provider === "microsoft") {
    try {
      const { getCanonicalMicrosoftCalendarConnectionId, migrateMctbAiBookingMicrosoftConnectionPointers } =
        await import("@/lib/mctb/ai-booking/microsoft-connection");
      const canonical = await getCanonicalMicrosoftCalendarConnectionId(workspaceId);
      if (canonical) {
        await migrateMctbAiBookingMicrosoftConnectionPointers({
          workspaceId,
          activeConnectionId: canonical,
          replacedConnectionIds: [connectionId],
        });
      }
    } catch (err) {
      console.warn(
        "[mctb/ai-booking] microsoft_delete_pointer_migration_failed",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return deleted;
}
