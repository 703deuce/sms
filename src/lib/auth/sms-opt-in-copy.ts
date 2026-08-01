import { BRAND_NAME } from "@/lib/brand";

const SUPPORT_EMAIL = "support@transovo.ai";
const SITE_URL = "https://transovo.ai";

/**
 * Sample / disclosure opt-in message for Transovo AI account 2FA SMS
 * (shown on /sms-opt-in and related legal copy; registered with carriers).
 */
export const SMS_OPT_IN_DISCLOSURE = `${BRAND_NAME}: You requested SMS verification codes for your account. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help.`;

/** Body of the OTP SMS (matches carrier registration sample content). */
export function smsOtpMessage(code: string): string {
  return `Your ${BRAND_NAME} verification code is ${code}. This code expires in 10 minutes. Do not share this code with anyone.`;
}

/** HELP keyword auto-reply for Transovo AI account verification traffic. */
export const SMS_HELP_MESSAGE = `${BRAND_NAME} Support: For assistance, visit ${SITE_URL} or email ${SUPPORT_EMAIL}. Reply STOP to opt out.`;

/** Short use-case summary used in Terms/Privacy and registration docs. */
export const SMS_2FA_USE_CASE_SUMMARY = `${BRAND_NAME} sends one-time verification codes to users who request them when signing in, verifying their phone number, or resetting their password.`;

/** Additional transactional-use language for legal + registration. */
export const SMS_2FA_ADDITIONAL_DETAILS =
  "Messages are transactional and are sent only after a user enters their phone number and requests a verification code. The number will not be used for advertising, promotional campaigns, or unsolicited messages.";
