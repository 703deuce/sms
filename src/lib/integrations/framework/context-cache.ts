import { getPrisma } from "@/lib/db";
import { listRecentIntegrationContextForContact } from "./contact-links";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

const STALE_MS = 15 * 60 * 1000;

/**
 * Messenger/phone must use local cache — never live provider APIs on page load.
 */
export async function getCachedIntegrationContext(
  workspaceId: string,
  contactId: string,
  opts?: { allowStale?: boolean; triggerRefresh?: boolean },
) {
  const prisma = getPrisma();
  const row = await prisma.integrationContextCache.findUnique({
    where: { workspaceId_contactId: { workspaceId, contactId } },
  });

  const stale =
    !row ||
    Date.now() - new Date(row.refreshedAt).getTime() > STALE_MS ||
    (row.staleAt && row.staleAt.getTime() < Date.now());

  if (row && (!stale || opts?.allowStale !== false)) {
    if (stale && opts?.triggerRefresh !== false) {
      void enqueueRefresh(workspaceId, contactId);
    }
    return {
      summary: row.summaryJson as Record<string, unknown>,
      refreshedAt: row.refreshedAt.toISOString(),
      stale: Boolean(stale),
      lastError: row.lastError,
      source: "cache" as const,
    };
  }

  // Cold cache: build from local DB only (no provider HTTP)
  const summary = await listRecentIntegrationContextForContact(workspaceId, contactId);
  await prisma.integrationContextCache.upsert({
    where: { workspaceId_contactId: { workspaceId, contactId } },
    create: {
      workspaceId,
      contactId,
      summaryJson: summary as object,
      refreshedAt: new Date(),
      staleAt: new Date(Date.now() + STALE_MS),
    },
    update: {
      summaryJson: summary as object,
      refreshedAt: new Date(),
      staleAt: new Date(Date.now() + STALE_MS),
      lastError: null,
    },
  });

  return {
    summary: summary as unknown as Record<string, unknown>,
    refreshedAt: new Date().toISOString(),
    stale: false,
    lastError: null,
    source: "local_db" as const,
  };
}

async function enqueueRefresh(workspaceId: string, contactId: string) {
  try {
    await enqueueJob({
      jobType: "integration_context_refresh",
      queueName: "integrations",
      workspaceId,
      priority: 45,
      payload: { workspaceId, contactId },
      idempotencyKey: `int-ctx-${workspaceId}-${contactId}-${new Date().toISOString().slice(0, 13)}`,
    });
  } catch {
    // non-fatal
  }
}

export async function refreshIntegrationContextCache(workspaceId: string, contactId: string) {
  const summary = await listRecentIntegrationContextForContact(workspaceId, contactId);
  await getPrisma().integrationContextCache.upsert({
    where: { workspaceId_contactId: { workspaceId, contactId } },
    create: {
      workspaceId,
      contactId,
      summaryJson: summary as object,
      refreshedAt: new Date(),
      staleAt: new Date(Date.now() + STALE_MS),
    },
    update: {
      summaryJson: summary as object,
      refreshedAt: new Date(),
      staleAt: new Date(Date.now() + STALE_MS),
      lastError: null,
    },
  });
  return summary;
}
