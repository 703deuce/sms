import "server-only";

import { getPrisma } from "@/lib/db";
import { loadCallForwardingWorkspaceSettings } from "./workspace-settings";
import { resolveVerifiedBusinessCallerId } from "@/lib/smart-routing/workspace-settings";

/** Approved business caller ID for outbound customer legs. */
export async function resolveCallForwardingBusinessCallerId(workspaceId: string): Promise<string | null> {
  const ws = await loadCallForwardingWorkspaceSettings(workspaceId);
  if (ws?.businessNumberE164?.trim()) return ws.businessNumberE164.trim();
  if (ws?.assignedPhoneNumberId) {
    const pn = await getPrisma().phoneNumber.findFirst({
      where: { id: ws.assignedPhoneNumberId, workspaceId },
      select: { e164: true },
    });
    if (pn?.e164) return pn.e164;
  }
  return await resolveVerifiedBusinessCallerId(workspaceId);
}
