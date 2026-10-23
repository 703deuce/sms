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
    // Phase 6 — flag stored on disposition definition only.
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
