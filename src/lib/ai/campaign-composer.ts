const COMPLIANCE_FOOTER =
  "Reply STOP to opt out. Msg & data rates may apply.";

type ComposeInput = {
  goal?: string;
  audience?: string;
  tone?: string;
  offer?: string;
  businessName?: string;
  includeLink?: boolean;
  destinationUrl?: string;
};

export function composeCampaignMessages(input: ComposeInput) {
  const business = input.businessName?.trim() || "our team";
  const tone = input.tone || "friendly";
  const goal = input.goal || "drive engagement";
  const audience = input.audience || "subscribed customers";

  const base = `Hi {{first_name}}, this is ${business}. `;
  const linkLine = input.includeLink && input.destinationUrl
    ? `\n\nLearn more: ${input.destinationUrl}`
    : "";

  const primary = `${base}We wanted to reach out about ${goal} for ${audience}. Reply if you have questions.${linkLine}\n\n${COMPLIANCE_FOOTER}`;

  const variations = [
    `${base}Quick ${tone} reminder — we're here to help with ${goal}.${linkLine}\n\n${COMPLIANCE_FOOTER}`,
    `${base}Following up with a short update. Let us know the best time to connect.${linkLine}\n\n${COMPLIANCE_FOOTER}`,
    `{{first_name}}, ${business} here. ${input.offer || "We have something new for you."}${linkLine}\n\n${COMPLIANCE_FOOTER}`,
  ];

  return {
    message: primary,
    variations,
    shorterVersion: `${base}Quick update from ${business}. Reply anytime.\n\n${COMPLIANCE_FOOTER}`,
    complianceFooter: COMPLIANCE_FOOTER,
    suggestedAudience: audience,
    suggestedSendTime: "Tuesday 10:00 AM local",
    abVersions: variations.slice(0, 2),
    mmsRecommendation:
      input.offer ? "Consider MMS with a branded image for promotional offers." : "SMS is sufficient for this message.",
  };
}
