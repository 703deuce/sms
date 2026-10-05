import "server-only";

import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";
import { getPrisma } from "@/lib/db";

/** Authoritative display name for first-text templates (Business Profile / workspace). */
export async function resolveMctbFirstTextBusinessName(workspaceId: string): Promise<string> {
  const brain = await loadBusinessBrain(workspaceId);
  const fromBrain = brain.businessName?.trim();
  if (fromBrain) return fromBrain;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { displayName: true, name: true },
  });
  return (ws?.displayName || ws?.name || "").trim();
}
