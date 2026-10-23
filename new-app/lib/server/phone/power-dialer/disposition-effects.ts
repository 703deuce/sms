import type { PrismaClient } from "@prisma/client";
import { dispositionIsTerminal } from "./eligibility";

export async function applyDispositionEffects(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    attemptId: string;
    contactId: string;
    disposition: string;
    notes?: string;
    callbackAt?: Date | null;
    alreadyApplied: boolean;
  },
) {
  if (input.alreadyApplied) return;

  const d = input.disposition.trim();
  const lower = d.toLowerCase();

  if (lower.includes("do not call") || lower === "dnc") {
    await prisma.contact.updateMany({
      where: { id: input.contactId, workspaceId: input.workspaceId },
      data: { status: "BLOCKED" },
    });
  }

  if (lower === "callback" && input.callbackAt) {
    await prisma.powerDialerAttempt.update({
      where: { id: input.attemptId },
      data: { callbackAt: input.callbackAt },
    });
  }

}

export function isHumanConversation(disposition: string | null, classification: string | null): boolean {
  if (classification === "human") return true;
  if (!disposition) return false;
  const d = disposition.toLowerCase();
  return d === "booked" || d === "interested" || d === "callback" || d === "connected";
}
