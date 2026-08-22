import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import {
  isAdminMctbTestWorkspace,
  type AdminMctbTestFlags,
} from "@/lib/mctb/admin-test-workspace-shared";

type PhoneRow = {
  settingsJson?: unknown;
  a2pStatus?: string | null;
  type?: string | null;
};

/** Whether MCTB setup can run live SMS on the selected number(s). */
export function isMctbSetupMessagingReady(input: {
  phoneNumbers: PhoneRow[];
  requiredActions: string[];
  adminFlags?: AdminMctbTestFlags;
}): boolean {
  const hasApprovedPhone = input.phoneNumbers.some((n) => isPhoneMessagingApproved(n));
  if (!hasApprovedPhone) return false;
  if (input.adminFlags && isAdminMctbTestWorkspace(input.adminFlags)) return true;
  return input.requiredActions.length === 0;
}
