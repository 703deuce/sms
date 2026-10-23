import { getMembershipForUser, isPowerDialerAdminRole } from "./campaign-access";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";

/** M56 / recording download — role-gated access to call recordings. */
export async function assertPowerDialerRecordingAccess(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const membership = await getMembershipForUser(workspaceId, userId);
  if (!membership) throw new Error("Not a workspace member");
  const settings = await getPowerDialerSettings(workspaceId);
  const allowed = settings.recordingAccessRoles || ["OWNER", "ADMINISTRATOR", "MANAGER"];
  if (isPowerDialerAdminRole(membership.role) || allowed.includes(membership.role)) return;
  throw new Error("Your role cannot access call recordings");
}
