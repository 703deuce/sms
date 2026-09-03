import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/**
 * Blocks accidental re-subscribe for STOP/suppressed contacts (manual create/edit).
 */
export async function assertCanSubscribeContact(
  workspaceId: string,
  phone: string,
  targetStatus: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = targetStatus.toUpperCase();
  if (status !== "SUBSCRIBED") return { ok: true };

  const normalized = normalizeE164(phone);
  const prisma = getPrisma();

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId, phone: normalized },
  });
  if (suppressed) {
    return {
      ok: false,
      error:
        "This number has opted out (STOP) and cannot be re-subscribed without removing suppression first.",
    };
  }

  const existing = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: normalized } },
    select: { status: true },
  });
  if (existing && existing.status === "UNSUBSCRIBED") {
    return {
      ok: false,
      error: "This contact has opted out and cannot be re-subscribed from this screen.",
    };
  }

  return { ok: true };
}
