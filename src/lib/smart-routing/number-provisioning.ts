import "server-only";

import { getPrisma } from "@/lib/db";
import {
  ensureSmartRoutingWorkspaceSettings,
  loadSmartRoutingWorkspaceSettings,
  updateSmartRoutingWorkspaceSettings,
  type SmartRoutingWorkspaceSettingsRecord,
} from "./workspace-settings";
import { setCallHandlingMode } from "@/lib/numbers/call-handling-mode";

function readRoutingOwner(settingsJson: unknown): string | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const owner = (settingsJson as Record<string, unknown>).routingOwner;
  return typeof owner === "string" ? owner : null;
}

export async function assignRoutingPhoneNumber(
  workspaceId: string,
  phoneNumberId: string,
) {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!pn) throw new Error("Routing number not found");

  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (settings?.assignedCallbackPhoneNumberId === phoneNumberId) {
    throw new Error("Cannot use the Business Callback Number as the Routing Number");
  }

  await setCallHandlingMode({
    workspaceId,
    phoneNumberId,
    mode: "smart_routing",
  });
  await updateSmartRoutingWorkspaceSettings(workspaceId, {
    assignedPhoneNumberId: phoneNumberId,
    routingNumberE164: pn.e164,
  });
  return pn;
}

export async function assignCallbackPhoneNumber(
  workspaceId: string,
  phoneNumberId: string,
) {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
  });
  if (!pn) throw new Error("Callback number not found");

  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  if (settings?.assignedPhoneNumberId === phoneNumberId) {
    throw new Error("Cannot use the Routing Number as the Business Callback Number");
  }
  if (settings?.routingNumberE164 && settings.routingNumberE164 === pn.e164) {
    throw new Error("Cannot use the Routing Number as the Business Callback Number");
  }

  await transitionNumberService(workspaceId, phoneNumberId, "set_smart_routing_callback_owner");
  await updateSmartRoutingWorkspaceSettings(workspaceId, {
    assignedCallbackPhoneNumberId: phoneNumberId,
    callbackNumberE164: pn.e164,
  });
  return pn;
}

/**
 * When routing is assigned but callback is missing, auto-pick another workspace number.
 */
export async function ensureCallbackNumberAssigned(workspaceId: string) {
  const settings = await ensureSmartRoutingWorkspaceSettings(workspaceId);
  if (settings.callbackNumberE164 && settings.assignedCallbackPhoneNumberId) {
    return settings;
  }

  const prisma = getPrisma();
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  const routingId = settings.assignedPhoneNumberId;
  const routingE164 = settings.routingNumberE164;

  const candidate = numbers.find((n: { id: string; e164: string; settingsJson: unknown }) => {
    if (routingId && n.id === routingId) return false;
    if (routingE164 && n.e164 === routingE164) return false;
    const owner = readRoutingOwner(n.settingsJson);
    if (owner === "smart_routing" || owner === "smart_routing_callback") return false;
    return true;
  });

  if (!candidate) return settings;

  await assignCallbackPhoneNumber(workspaceId, candidate.id);
  return (await loadSmartRoutingWorkspaceSettings(workspaceId)) as SmartRoutingWorkspaceSettingsRecord;
}
