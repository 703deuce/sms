/**
 * Spoken SMS consent disclosure for Voice V3 booking-link sends.
 * Wording is compiled from business identity + platform customer-care SMS program defaults.
 * Do not paraphrase in the model — Amy reads this pattern; runtime enforces consent before send.
 */

export type SpokenDisclosureSource =
  | "VOICE_BOOKING_LINK_CUSTOMER_CARE_DEFAULT"
  | "ENV_OVERRIDE";

export function compileVoiceBookingLinkSpokenDisclosure(input: {
  businessName: string;
  destinationHint?: "inbound_ani" | "other_number";
}): { text: string; source: SpokenDisclosureSource; disclosureVersion: string } {
  const envOverride = process.env.VOICE_BOOKING_LINK_SPOKEN_DISCLOSURE?.trim();
  const business = input.businessName.trim() || "this business";
  const destinationLine =
    input.destinationHint === "other_number"
      ? "the phone number you provided"
      : "the number you're calling from";

  const disclosureVersion =
    process.env.VOICE_BOOKING_LINK_DISCLOSURE_VERSION?.trim() || "voice_booking_link_v1";

  if (envOverride) {
    return {
      text: envOverride.replaceAll("{BUSINESS_NAME}", business).replaceAll("{DESTINATION}", destinationLine),
      source: "ENV_OVERRIDE",
      disclosureVersion,
    };
  }

  const text = [
    `Would you like me to text the booking link to ${destinationLine}?`,
    `By agreeing, you consent to receive SMS booking messages from ${business}.`,
    "Message frequency may vary. Message and data rates may apply.",
    "Reply STOP to opt out or HELP for help.",
  ].join(" ");

  return {
    text,
    source: "VOICE_BOOKING_LINK_CUSTOMER_CARE_DEFAULT",
    disclosureVersion,
  };
}
