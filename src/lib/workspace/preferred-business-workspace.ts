import { getPrisma } from "@/lib/db";
import {
  HP_CERTIFIED_SMS_E164,
  isApprovedMessagingStatus,
  isHpCertifiedSmsNumber,
  scoreSmsSendingNumber,
} from "@/lib/messaging/preferred-sending-number";

/**
 * Business workspaces only. Prefer the workspace that owns the HP-certified
 * 571 10DLC number over leftover 8xx / personal workspaces.
 */
export async function resolvePreferredBusinessWorkspaceId(
  userId: string,
  currentWorkspaceId?: string | null,
): Promise<string> {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, type: true } } },
  });
  const businessIds = memberships
    .map((m: { workspace: { id: string; type?: string } }) => m.workspace)
    .filter((w: { id: string; type?: string }) => w.type !== "PERSONAL")
    .map((w: { id: string }) => w.id);

  if (!businessIds.length) {
    return currentWorkspaceId || memberships[0]?.workspace?.id || "";
  }

  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: { in: businessIds }, status: "Active" },
    select: {
      id: true,
      e164: true,
      status: true,
      type: true,
      a2pStatus: true,
      provider: true,
      settingsJson: true,
      workspaceId: true,
    },
  });

  const byWorkspace = new Map<string, number>();
  for (const id of businessIds) byWorkspace.set(id, 1);
  for (const n of numbers) {
    const prev = byWorkspace.get(n.workspaceId) || 0;
    let bonus = scoreSmsSendingNumber(n);
    if (isHpCertifiedSmsNumber(n.e164)) bonus += 5000;
    if (isApprovedMessagingStatus(n.a2pStatus) && !/toll/i.test(String(n.type || ""))) {
      bonus += 200;
    }
    byWorkspace.set(n.workspaceId, Math.max(prev, bonus));
  }

  const ranked = [...businessIds].sort(
    (a, b) => (byWorkspace.get(b) || 0) - (byWorkspace.get(a) || 0),
  );
  const best = ranked[0];
  const currentScore = currentWorkspaceId ? byWorkspace.get(currentWorkspaceId) || 0 : 0;
  if (
    currentWorkspaceId &&
    businessIds.includes(currentWorkspaceId) &&
    currentScore >= (byWorkspace.get(best) || 0)
  ) {
    return currentWorkspaceId;
  }
  // If current workspace is business but has no approved local number, jump to HP owner.
  if (currentWorkspaceId && businessIds.includes(currentWorkspaceId)) {
    const hasHp = numbers.some(
      (n: { workspaceId: string; e164: string }) =>
        n.workspaceId === currentWorkspaceId && n.e164 === HP_CERTIFIED_SMS_E164,
    );
    if (hasHp) return currentWorkspaceId;
    if ((byWorkspace.get(best) || 0) >= 400 && currentScore < 400) return best;
    return currentWorkspaceId;
  }
  return best || currentWorkspaceId || "";
}
