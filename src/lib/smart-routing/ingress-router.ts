import "server-only";

import { getPrisma } from "@/lib/db";
import { loadSmartRoutingWorkspaceSettings } from "./workspace-settings";
import { isWorkspaceInternalSmartRoutingNumberSync } from "./internal-numbers";

export type SmartRoutingIngressKind = "inbound_routing" | "employee_callback" | "none";

/**
 * Top-level ingress discriminator: called number determines runtime path.
 * Forwarding metadata is NOT used to choose between inbound routing and employee callback.
 */
export async function resolveSmartRoutingIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  calledE164: string;
}): Promise<{ kind: SmartRoutingIngressKind }> {
  const settings = await loadSmartRoutingWorkspaceSettings(input.workspaceId);
  const prisma = getPrisma();
  const callbackNumberLive = await prisma.phoneNumber.findFirst({
    where: {
      id: input.phoneNumberId,
      workspaceId: input.workspaceId,
      releasedAt: null,
      status: { not: "Released" },
    },
    select: { id: true },
  });

  if (
    callbackNumberLive &&
    settings?.assignedCallbackPhoneNumberId === input.phoneNumberId
  ) {
    return { kind: "employee_callback" };
  }

  const { hasActiveSmartRoutingOnNumber } = await import("./flow-service");
  if (await hasActiveSmartRoutingOnNumber(input.workspaceId, input.phoneNumberId)) {
    return { kind: "inbound_routing" };
  }

  return { kind: "none" };
}

export async function isWorkspaceInternalSmartRoutingNumber(
  workspaceId: string,
  e164: string,
): Promise<boolean> {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  return isWorkspaceInternalSmartRoutingNumberSync(settings, e164);
}
