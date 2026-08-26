import "server-only";

import { getPrisma } from "@/lib/db";

export async function emitMassTextOpsEvent(input: {
  workspaceId: string;
  eventType: string;
  campaignId?: string | null;
  contactId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  try {
    const { emitPlatformEvent } = await import("@/lib/platform/events");
    await emitPlatformEvent({
      workspaceId: input.workspaceId,
      type: input.eventType,
      campaignId: input.campaignId ?? null,
      contactId: input.contactId ?? null,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey ?? undefined,
    });
  } catch {
    // best-effort
  }

  try {
    const prisma = getPrisma();
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        event: input.eventType,
        detail: JSON.stringify({
          campaignId: input.campaignId,
          ...(input.payload || {}),
        }).slice(0, 2000),
      },
    });
  } catch {
    // best-effort
  }
}

export async function recordMassTextingBillingEvent(input: {
  workspaceId?: string | null;
  stripeEventId: string;
  eventType: string;
  payload?: unknown;
}): Promise<boolean> {
  const prisma = getPrisma();
  try {
    await prisma.massTextingBillingEvent.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        stripeEventId: input.stripeEventId,
        eventType: input.eventType,
        payload: input.payload as never,
      },
    });
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = String((err as { code: string }).code);
      if (code === "P2002" || code === "23505") return false;
    }
    throw err;
  }
}
