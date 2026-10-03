import "server-only";

import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { pollTelnyxPhoneNumberId } from "@/lib/messaging/telnyx/phone-numbers";
import { MCTB_TRIAL_TOLL_FREE_AREA_CODES } from "@/lib/mctb/onboarding/constants";
import { MCTB_TEXML_DEFAULT_APP_ID } from "@/lib/mctb/texml-ingress/constants";
import {
  isNorthAmericaTollFreeE164,
  isPreferredMctbIngressTollFreeE164,
} from "@/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";

function pickSearchCandidate(
  results: Array<{ phoneNumber: string }>,
): string | null {
  const preferred = results.find((n) => isPreferredMctbIngressTollFreeE164(n.phoneNumber));
  if (preferred?.phoneNumber) return preferred.phoneNumber;
  const anyTollFree = results.find((n) => isNorthAmericaTollFreeE164(n.phoneNumber));
  return anyTollFree?.phoneNumber ?? null;
}

/**
 * Purchase a dedicated Telnyx toll-free for MCTB voice ingress (CFNA target).
 * Does not use messagingRegistration single-number onboarding — workspaces may
 * already have a platform/workspace SMS sender on a different DID.
 */
export async function purchaseTelnyxTollFreeForMctbIngress(
  workspaceId: string,
): Promise<string | null> {
  const { assertCanPurchaseNumber } = await import("@/lib/numbers/acquire-guard");
  const guard = await assertCanPurchaseNumber(workspaceId, { source: "premium" });
  if (!guard.ok) {
    console.warn("[mctb] toll_free_ingress_purchase_blocked", workspaceId, guard.code, guard.error);
    return null;
  }

  const { isNumberPurchaseAllowed } = await import("@/lib/numbers/number-purchase-guard");
  if (!isNumberPurchaseAllowed()) {
    console.warn("[mctb] toll_free_ingress_purchase_disabled_env", workspaceId);
    return null;
  }

  let chosenE164: string | null = null;
  for (const areaCode of MCTB_TRIAL_TOLL_FREE_AREA_CODES) {
    try {
      const results = await telnyxProvider.searchNumbers(areaCode);
      const candidate = pickSearchCandidate(results);
      if (candidate) {
        chosenE164 = candidate;
        break;
      }
    } catch (err) {
      console.warn("[mctb] toll_free_ingress_search_failed", workspaceId, areaCode, err);
    }
  }

  if (!chosenE164) {
    return null;
  }

  const orderBody: Record<string, unknown> = {
    phone_numbers: [{ phone_number: chosenE164 }],
    customer_reference: `ws:${workspaceId}:mctb_toll_free_ingress`,
    connection_id: MCTB_TEXML_DEFAULT_APP_ID,
  };

  const res = await telnyxRequest<{
    data: {
      id: string;
      phone_numbers?: Array<{ id?: string; phone_number?: string; status?: string }>;
    };
  }>("/number_orders", {
    method: "POST",
    body: orderBody,
    idempotencyKey: `mctb-tfn-ingress:${workspaceId}:${chosenE164}`,
  });

  const orderId = res.data.id;
  const purchased = res.data.phone_numbers?.[0];
  let providerNumberId =
    purchased?.id && purchased.status === "success" ? purchased.id : null;
  if (!providerNumberId) {
    providerNumberId = await pollTelnyxPhoneNumberId({
      orderId,
      phoneNumber: chosenE164,
      attempts: 12,
      delayMs: 2000,
    });
  }

  if (!providerNumberId) {
    console.warn("[mctb] toll_free_ingress_order_pending", workspaceId, orderId, chosenE164);
    return chosenE164;
  }

  return chosenE164;
}
