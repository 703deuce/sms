import { getPrisma } from "@/lib/db";
import { notifyIncomingSoftphoneCall } from "./device-service";

/** Resolve which users should be pushed for an inbound softphone ring. */
export async function notifyUsersForInboundCall(input: {
  workspaceId: string;
  humanCallId: string;
  fromE164: string;
  toE164: string;
  queueId?: string | null;
  /** Explicit target users (e.g. forward_user). Skips workspace-wide fan-out. */
  userIds?: string[];
}) {
  const prisma = getPrisma();
  const userIds = new Set<string>(input.userIds || []);

  if (input.queueId) {
    const queue = await prisma.callQueue.findFirst({
      where: { id: input.queueId, workspaceId: input.workspaceId },
    });
    for (const uid of queue?.memberUserIds || []) userIds.add(uid);
  }

  if (!userIds.size) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId: input.workspaceId, e164: input.toE164 },
    });
    if (pn) {
      const assignments = await prisma.phoneNumberAssignment.findMany({
        where: { phoneNumberId: pn.id },
      });
      for (const a of assignments) userIds.add(a.userId);
    }
  }

  // Fallback: all users with an active softphone device registration.
  if (!userIds.size) {
    const devices = await prisma.softphoneDevice.findMany({
      where: { workspaceId: input.workspaceId, active: true },
    });
    for (const d of devices) userIds.add(d.userId);
  }

  if (!userIds.size) return { sent: 0, targeted: 0 };

  return notifyIncomingSoftphoneCall({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    userIds: [...userIds],
  });
}
