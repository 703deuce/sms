import "server-only";

import { getPrisma } from "@/lib/db";
import {
  isCallForwardingCallHandlingActive,
  readCallHandlingMode,
} from "@/lib/numbers/call-handling-mode-shared";
import { readPersonalCallSettings } from "@/lib/numbers/personal-call-settings";
import { loadCallForwardingWorkspaceSettings } from "./workspace-settings";

/** True when inbound on this DID should run Call Forwarding (not SR / MCTB). */
export async function hasActiveCallForwardingOnNumber(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
) {
  if (!phoneNumberId) return false;

  const { hasWorkspaceProductFeature } = await import("@/lib/products/feature-entitlements");
  if (!(await hasWorkspaceProductFeature(workspaceId, "call_forwarding"))) return false;

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: {
      id: phoneNumberId,
      workspaceId,
      releasedAt: null,
      status: { not: "Released" },
    },
  });
  if (!pn || !isCallForwardingCallHandlingActive(pn.settingsJson)) return false;

  const settings = readPersonalCallSettings(pn);
  if (!settings.forwardingEnabled || settings.forwardTargets.length === 0) return false;

  const ws = await loadCallForwardingWorkspaceSettings(workspaceId);
  if (ws?.assignedPhoneNumberId && ws.assignedPhoneNumberId !== phoneNumberId) {
    return false;
  }

  return true;
}

export async function getCallForwardingDestinationE164(
  workspaceId: string,
  phoneNumberId: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!pn || readCallHandlingMode(pn.settingsJson) !== "call_forwarding") return null;
  const callSettings = readPersonalCallSettings(pn);
  return callSettings.forwardTargets[0] ?? null;
}
