import "server-only";

import { loadWorkspaceAccessiblePhoneNumbers } from "@/lib/numbers/workspace-accessible-numbers";

/** True when phoneNumberId is owned by or linked to this workspace (setup dropdown). */
export async function isMctbSetupPhoneAccessible(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<boolean> {
  if (!phoneNumberId?.trim()) return false;
  const phones = await loadWorkspaceAccessiblePhoneNumbers(workspaceId);
  return phones.some((p) => p.id === phoneNumberId);
}

/** Drop stale/deleted phone ids so setup UI and saves stay consistent. */
export async function sanitizeMctbSetupPhoneNumberId(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  if (!phoneNumberId?.trim()) return null;
  const ok = await isMctbSetupPhoneAccessible(workspaceId, phoneNumberId);
  return ok ? phoneNumberId : null;
}
