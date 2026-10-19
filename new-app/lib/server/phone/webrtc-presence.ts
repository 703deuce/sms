import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { phoneServerLog } from "@/lib/server/phone/phone-log";

const STALE_MS = 90_000;

export async function markWebRtcRegistered(workspaceId: string, registered: boolean) {
  const userId = await resolveInternalUserId();
  const prisma = getPrisma();
  await prisma.softphonePresence.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: {
      workspaceId,
      userId,
      status: registered ? "available" : "offline",
      customLabel: registered ? "Browser softphone" : null,
      queueAvailable: registered,
      lastRegisteredAt: registered ? new Date() : null,
    },
    update: {
      status: registered ? "available" : "offline",
      queueAvailable: registered,
      lastRegisteredAt: registered ? new Date() : undefined,
      ...(registered ? {} : { customLabel: null }),
    },
  });
  phoneServerLog("webrtc-presence", registered ? "registered" : "unregistered", {
    workspaceId,
    userId,
  });
}

export async function isWebRtcAgentReachable(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - STALE_MS);
  const count = await prisma.softphonePresence.count({
    where: {
      workspaceId,
      status: { in: ["available", "on_call"] },
      queueAvailable: true,
      updatedAt: { gte: since },
    },
  });
  return count > 0;
}
