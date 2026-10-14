import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { QuickSendSmsInput } from "@/lib/sms/send-quick";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";

/**
 * True when this outbound uses the shared Transovo platform toll-free sender (not customer-owned A2P).
 */
export async function isTransovoPlatformOutboundSenderRoute(
  senderRoute: QuickSendSmsInput["senderRoute"],
): Promise<boolean> {
  if (!senderRoute?.fromE164?.trim()) return false;

  const recording =
    (process.env.HEADLESS_PROVIDER_MODE || process.env.VOICE_HEADLESS_SMS_MODE || "")
      .trim()
      .toLowerCase() === "recording";
  if (recording) {
    const testE164 =
      process.env.PLATFORM_DISPATCH_TEST_E164?.trim() || "+15714073615";
    if (normalizeE164(senderRoute.fromE164) === normalizeE164(testE164)) {
      return true;
    }
  }

  const phoneNumberId = senderRoute.phoneNumberId?.trim();
  if (phoneNumberId) {
    const auth = await isPhoneAuthorizedForOutboundSms(phoneNumberId);
    if (auth.allowed) {
      const { getPrisma } = await import("@/lib/db");
      const row = await getPrisma().phoneNumber.findFirst({
        where: { id: phoneNumberId },
        select: { settingsJson: true, e164: true },
      });
      if (row && isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson })) {
        return true;
      }
    }
  }

  try {
    const { resolveCanonicalMctbPlatformSender } = await import(
      "@/lib/mctb/messaging/platform-sender-config"
    );
    const canonical = await resolveCanonicalMctbPlatformSender();
    if (!canonical?.e164) return false;
    if (phoneNumberId && canonical.phoneNumberId === phoneNumberId) return true;
    return normalizeE164(senderRoute.fromE164) === normalizeE164(canonical.e164);
  } catch {
    return false;
  }
}
