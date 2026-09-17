import { getPrisma } from "@/lib/db";
import { hasActiveMctbPaidEntitlement } from "./mctb-entitlement";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * AI Booking is a premium capability — server gate (not UI-only).
 * Workspaces may be explicitly entitled via customFieldsConfig.mctb.aiBooking.entitled.
 */
export async function hasMctbAiBookingEntitlement(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(root.mctb);
  const ai = asRecord(mctb.aiBooking);
  if (ai.entitled === true) return true;

  const limits = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const lim = asRecord(limits?.limits);
  if (lim.mctbAiBookingEntitled === true) return true;

  if (await hasActiveMctbPaidEntitlement(workspaceId)) {
    return lim.mctbAiBookingEntitled !== false;
  }
  return false;
}
