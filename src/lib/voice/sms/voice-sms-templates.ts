/**
 * Deterministic SMS templates for live voice agents.
 * The model selects template_id — application code composes the message.
 */

export const VOICE_SMS_TEMPLATE_IDS = [
  "booking_link",
  "quote_link",
  "financing_link",
  "directions",
  "callback_confirmation",
] as const;

export type VoiceSmsTemplateId = (typeof VOICE_SMS_TEMPLATE_IDS)[number];

export type ResolvedVoiceSmsTemplate = {
  templateId: VoiceSmsTemplateId;
  body: string;
  idempotencyKey: string;
};

function bookingUrl(input: { bookingUrl?: string | null; websiteUrl?: string | null }): string {
  return (
    input.bookingUrl?.trim() ||
    process.env.HARBOR_BOOKING_LINK_URL?.trim() ||
    process.env.VOICE_BOOKING_LINK_URL?.trim() ||
    input.websiteUrl?.trim() ||
    "https://harbordrainpros.com"
  );
}

export function resolveVoiceSmsTemplate(input: {
  templateId: string;
  callId: string;
  businessName?: string | null;
  bookingUrl?: string | null;
  websiteUrl?: string | null;
}): ResolvedVoiceSmsTemplate {
  const id = input.templateId.trim().toLowerCase() as VoiceSmsTemplateId;
  const business = input.businessName?.trim() || "Harbor Drain Pros";
  const url = bookingUrl(input);

  const templates: Record<VoiceSmsTemplateId, string> = {
    booking_link: `Hi! Here's the link to schedule with ${business}: ${url}`,
    quote_link: `Hi from ${business}! Request a free estimate here: ${url}`,
    financing_link: `Hi from ${business}! Learn about financing options here: ${url}`,
    directions: `Hi from ${business}! Find us here: ${url}`,
    callback_confirmation: `Thanks for calling ${business}. We received your callback request and will follow up shortly.`,
  };

  if (!(id in templates)) {
    throw new Error(`Unknown SMS template_id: ${input.templateId}`);
  }

  return {
    templateId: id,
    body: templates[id],
    idempotencyKey: `${input.callId}:sms:${id}:v1`,
  };
}
