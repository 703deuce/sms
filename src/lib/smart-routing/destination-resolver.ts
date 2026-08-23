import "server-only";

import { getPrisma } from "@/lib/db";
import { isDestinationAvailable } from "./destination-availability";

export type ResolvedDestination = {
  id: string;
  phone: string;
  label: string;
  answerConfirmationEnabled: boolean;
};

export async function resolveDestinationForRouting(
  workspaceId: string,
  destinationId: string,
): Promise<ResolvedDestination | null> {
  if (!destinationId) return null;
  const prisma = getPrisma();
  const dest = await prisma.smartRoutingDestination.findFirst({
    where: { id: destinationId, workspaceId },
  });
  if (!dest?.phoneNumber?.trim() || !isDestinationAvailable(dest)) return null;
  return {
    id: dest.id,
    phone: dest.phoneNumber.trim(),
    label: dest.label,
    answerConfirmationEnabled: Boolean(dest.answerConfirmationEnabled),
  };
}

export async function resolveDestinationPhone(
  workspaceId: string,
  destinationId: string,
): Promise<string | null> {
  const resolved = await resolveDestinationForRouting(workspaceId, destinationId);
  return resolved?.phone ?? null;
}
