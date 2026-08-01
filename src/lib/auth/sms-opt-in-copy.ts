import { BRAND_NAME } from "@/lib/brand";

/**
 * Required Telnyx / carrier consent + sample 2FA opt-in message shown at the
 * point of collection on /sms-opt-in (and related legal copy).
 */
export const SMS_OPT_IN_DISCLOSURE = `${BRAND_NAME}: You requested SMS verification codes for your account. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help.`;

/** Body of the OTP SMS (includes the one-time code). */
export function smsOtpMessage(code: string): string {
  return `${BRAND_NAME}: Your verification code is ${code}. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help.`;
}
