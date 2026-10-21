import "server-only";

import { getPrisma } from "@/lib/server/db";
import { getPhoneCallControlConnectionId } from "@/lib/server/telephony/config";
import { mergeTelephonySettingsPatch } from "@/lib/server/telephony/integrated-phone-ingress";
import { routeNumberToPhoneCallControl } from "@/lib/server/telephony/product-routes";
import { upsertDefaultAnsweringPolicy } from "@/lib/server/telephony/integrated-phone-policy";

export type ProvisionIntegratedPhoneResult = {
  ok: boolean;
  phoneNumberId: string;
  actions: string[];
  error?: string;
};

/**
 * One-time carrier provision for Transovo-owned business numbers:
 * Call Control ingress + phone_foundation ingress model + default answering policy.
 */
export async function provisionIntegratedPhoneNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
  /** When false, only updates DB flags (number already on Call Control). */
  applyCarrierRoute?: boolean;
}): Promise<ProvisionIntegratedPhoneResult> {
  const actions: string[] = [];
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
  });
  if (!phone?.e164) {
    return { ok: false, phoneNumberId: input.phoneNumberId, actions, error: "Phone number not found" };
  }

  if (!getPhoneCallControlConnectionId()) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      actions,
      error: "TELNYX_CALL_CONTROL_APP_ID or TELNYX_CONNECTION_ID is not configured",
    };
  }

  if (input.applyCarrierRoute !== false) {
    const routed = await routeNumberToPhoneCallControl({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
    });
    actions.push(...routed.actions);
    if (!routed.ok) {
      return { ok: false, phoneNumberId: input.phoneNumberId, actions, error: routed.error };
    }
  } else {
    actions.push("carrier_route_skipped_already_provisioned");
  }

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      settingsJson: mergeTelephonySettingsPatch(phone.settingsJson, {
        ingressModel: "phone_foundation",
        telephony: {
          routingMode: "telnyx_call_control",
          state: "active",
        },
      }) as object,
    },
  });
  actions.push("ingress_model_phone_foundation");

  await upsertDefaultAnsweringPolicy(input.workspaceId, input.phoneNumberId);
  actions.push("default_answering_policy");

  return { ok: true, phoneNumberId: input.phoneNumberId, actions };
}
