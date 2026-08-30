/** @deprecated Platform demo retired — owned workspace DIDs only. */
export type PlatformDemoPhoneLink = {
  phoneNumberId: string;
  e164: string;
  ownerWorkspaceId: string;
  settingsJson: Record<string, unknown>;
};

export { readAdminTestWorkspaceIds } from "@/lib/mctb/platform-demo-access-shared";

/** Platform demo removed — always null. */
export async function getPlatformDemoPhoneRecord(): Promise<PlatformDemoPhoneLink | null> {
  return null;
}

/** Platform demo removed — never authorized. */
export async function isWorkspaceAuthorizedForPlatformDemoNumber(
  _workspaceId: string,
): Promise<boolean> {
  return false;
}

/** Platform demo removed — no-op. */
export async function linkWorkspaceToPlatformDemoNumber(_input: {
  workspaceId: string;
  userEmail?: string | null;
}): Promise<{
  phoneNumberId: string;
  e164: string;
  ownerWorkspaceId: string;
  linkedWorkspaceId: string;
  alreadyLinked: boolean;
}> {
  throw new Error("Platform demo has been removed. Use your workspace-owned MCTB number.");
}

/** Platform demo removed — no-op. */
export async function unlinkWorkspaceFromPlatformDemoNumber(_input: {
  workspaceId: string;
}): Promise<{ unlinked: boolean; remainingLinked: number }> {
  return { unlinked: false, remainingLinked: 0 };
}
