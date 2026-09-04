import { BRAND_NAME } from "@/lib/brand";

/** Default affirmative SMS opt-in label for public appointment booking (informational, not marketing). */
export const DEFAULT_SMS_CONSENT_TEXT =
  `I agree to receive appointment-related text messages from ${BRAND_NAME}, including confirmations, reminders, rescheduling updates, and customer care messages. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.`;

/** Supplementary disclosure shown near the SMS consent checkbox on public booking forms. */
export function appointmentSmsConsentDisclosure(businessName: string): string {
  const brand = businessName.trim() || "this business";
  return `${brand} may send appointment-related messages using ${BRAND_NAME}'s messaging platform. Mobile information and SMS opt-in data will not be sold, rented, or shared with third parties for their own promotional or marketing purposes. ${BRAND_NAME} may share information with telecommunications carriers, messaging platforms, and other service providers solely as necessary to deliver and support messaging services.`;
}
