import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadSmartRoutingWorkspaceSettings } from "./workspace-settings";
import {
  isWorkspaceInternalSmartRoutingNumberSync,
  sameSmartRoutingE164,
} from "./internal-numbers";

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
  const called = normalizeE164(input.calledE164);

  if (
    settings?.callbackNumberE164 &&
    sameSmartRoutingE164(settings.callbackNumberE164, called)
  ) {
    return { kind: "employee_callback" };
  }
  if (settings?.assignedCallbackPhoneNumberId === input.phoneNumberId) {
    return { kind: "employee_callback" };
  }

  if (
    settings?.routingNumberE164 &&
    sameSmartRoutingE164(settings.routingNumberE164, called)
  ) {
    return { kind: "inbound_routing" };
  }
  if (settings?.assignedPhoneNumberId === input.phoneNumberId) {
    return { kind: "inbound_routing" };
  }

  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findFirst({
    where: {
      workspaceId: input.workspaceId,
      assignedPhoneNumberId: input.phoneNumberId,
      status: "active",
      publishedVersionId: { not: null },
    },
    select: { id: true },
  });
  if (flow) return { kind: "inbound_routing" };

  return { kind: "none" };
}

export async function isWorkspaceInternalSmartRoutingNumber(
  workspaceId: string,
  e164: string,
): Promise<boolean> {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  return isWorkspaceInternalSmartRoutingNumberSync(settings, e164);
}
