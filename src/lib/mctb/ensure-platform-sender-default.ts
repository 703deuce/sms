import "server-only";

import { loadMissedCallTextConfig, updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbCommercialEntitlements } from "@/lib/mctb/commercial-entitlements";
import { reconcileMctbSmsPhoneNumberId } from "@/lib/mctb/runtime-sms-phone-id";

/**
 * New workspaces use Transovo platform sender until they buy Own Local Number add-on
 * and complete workspace sender verification.
 */
export async function ensureMctbPlatformSenderDefault(workspaceId: string): Promise<void> {
  const [config, commercial] = await Promise.all([
    loadMissedCallTextConfig(workspaceId),
    resolveMctbCommercialEntitlements(workspaceId),
  ]);
  if (commercial.ownSenderAddOnEntitled && config.senderMode === "WORKSPACE") {
    return;
  }

  const smsPhoneNumberId = await reconcileMctbSmsPhoneNumberId({
    senderMode: "PLATFORM",
    phoneNumberId: config.phoneNumberId,
    smsPhoneNumberId: config.smsPhoneNumberId,
  });

  const needsSenderMode = config.senderMode !== "PLATFORM";
  const needsSms =
    Boolean(smsPhoneNumberId) && smsPhoneNumberId !== config.smsPhoneNumberId;

  if (!needsSenderMode && !needsSms) return;

  await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      ...(needsSenderMode ? { sender_mode: "PLATFORM" } : {}),
      ...(needsSms ? { sms_phone_number_id: smsPhoneNumberId } : {}),
    },
  });
}
