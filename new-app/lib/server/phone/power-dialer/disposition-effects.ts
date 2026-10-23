import type { PrismaClient, PowerDialerDisposition } from "@prisma/client";
import { dispositionIsTerminal } from "./eligibility";
import { upsertCallbackFromDisposition } from "./callbacks-service";

export async function applyDispositionEffects(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    attemptId: string;
    contactId: string;
    campaignId: string;
    disposition: string;
    dispositionDef?: PowerDialerDisposition | null;
    notes?: string;
    callbackAt?: Date | null;
    timezone?: string;
    assignedUserId?: string | null;
    alreadyApplied: boolean;
  },
) {
  if (input.alreadyApplied) return;

  const def = input.dispositionDef;
  const d = input.disposition.trim();
  const lower = d.toLowerCase();

  const addToDnc = def?.addToDnc || lower.includes("do not call") || lower === "dnc";
  if (addToDnc) {
    await prisma.contact.updateMany({
      where: { id: input.contactId, workspaceId: input.workspaceId },
      data: { status: "BLOCKED" },
    });
    if (typeof prisma.contact?.findFirst === "function") {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId, workspaceId: input.workspaceId },
        select: { phone: true },
      });
      if (contact?.phone) {
        const { addInternalDnc } = await import("./internal-dnc");
        await addInternalDnc({
          workspaceId: input.workspaceId,
          phone: contact.phone,
          reason: `Disposition: ${d}`,
          source: "disposition",
        });
      }
    }
  }

  const scheduleCb =
    def?.scheduleCallback || lower === "callback" || lower.includes("callback");
  if (scheduleCb && input.callbackAt) {
    await prisma.powerDialerAttempt.update({
      where: { id: input.attemptId },
      data: { callbackAt: input.callbackAt },
    });
    await upsertCallbackFromDisposition({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      attemptId: input.attemptId,
      scheduledAt: input.callbackAt,
      timezone: input.timezone || "America/Chicago",
      notes: input.notes,
      disposition: d,
      assignedUserId: input.assignedUserId || undefined,
    });
  }

  if (def?.removeFromQueue || def?.markContactCompleted) {
    // Campaign queue eligibility uses attempt caps / dispositions — no list removal unless DNC.
  }

  if (def?.triggerCrmUpdate) {
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.attemptId, workspaceId: input.workspaceId },
      select: { humanCallId: true },
    });
    const { syncPowerDialerAttemptToIntegrations } = await import("./crm-sync-bridge");
    await syncPowerDialerAttemptToIntegrations({
      workspaceId: input.workspaceId,
      attemptId: input.attemptId,
      contactId: input.contactId,
      humanCallId: attempt?.humanCallId,
      disposition: d,
      notes: input.notes,
      callbackAt: input.callbackAt,
      triggerCrm: true,
    });
  }
}

export function isHumanConversation(disposition: string | null, classification: string | null): boolean {
  if (classification === "screener" || classification === "voicemail" || classification === "ivr") {
    return false;
  }
  if (classification === "human") return true;
  if (!disposition) return false;
  const d = disposition.toLowerCase();
  return d === "booked" || d === "interested" || d === "callback" || d === "connected";
}

export { dispositionIsTerminal };
