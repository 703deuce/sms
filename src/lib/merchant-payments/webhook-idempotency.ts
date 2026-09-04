import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";

export async function recordWebhookEvent(input: {
  provider: string;
  eventType: string;
  providerEventId: string;
  workspaceId?: string;
  payload?: unknown;
}): Promise<{ duplicate: boolean; id: string }> {
  const prisma = getPrisma();
  const existing = await prisma.providerWebhookEvent.findUnique({
    where: { providerEventId: input.providerEventId },
  });
  if (existing) return { duplicate: true, id: existing.id };

  const row = await prisma.providerWebhookEvent.create({
    data: {
      id: createId(),
      provider: input.provider,
      eventType: input.eventType,
      providerEventId: input.providerEventId,
      workspaceId: input.workspaceId || null,
      payload: input.payload as object,
      status: "received",
    },
  });
  return { duplicate: false, id: row.id };
}

export async function markWebhookProcessed(id: string, error?: string) {
  const prisma = getPrisma();
  await prisma.providerWebhookEvent.update({
    where: { id },
    data: {
      status: error ? "failed" : "processed",
      errorMessage: error || null,
      processedAt: new Date(),
    },
  });
}
