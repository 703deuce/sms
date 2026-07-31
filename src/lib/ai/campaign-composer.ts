/**
 * Campaign message composer.
 *
 * Env:
 *   OPENAI_API_KEY — when set, generates messages via OpenAI Chat Completions
 *   OPENAI_MODEL   — optional model name (default gpt-4o-mini)
 */

import { openAiChatCompletion } from "@/lib/ai/openai";

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

function heuristicCompose(input: ComposeInput) {
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
    mode: "heuristic" as const,
  };
}

export async function composeCampaignMessages(input: ComposeInput) {
  const heuristic = heuristicCompose(input);

  const prompt = [
    `Business: ${input.businessName || "our team"}`,
    `Goal: ${input.goal || "drive engagement"}`,
    `Audience: ${input.audience || "subscribed customers"}`,
    `Tone: ${input.tone || "friendly"}`,
    input.offer ? `Offer: ${input.offer}` : "",
    input.includeLink && input.destinationUrl
      ? `Include link: ${input.destinationUrl}`
      : "",
    `Always end with compliance footer: ${COMPLIANCE_FOOTER}`,
    "Use {{first_name}} merge tag. Keep under 320 characters per message.",
    "Return JSON with keys: message, variations (array of 3), shorterVersion, suggestedAudience, suggestedSendTime, abVersions (array of 2), mmsRecommendation.",
  ]
    .filter(Boolean)
    .join("\n");

  const llm = await openAiChatCompletion(
    "You write compliant SMS marketing copy. Return valid JSON only.",
    prompt,
    { temperature: 0.6, maxTokens: 900 },
  );

  if (!llm) return heuristic;

  try {
    const parsed = JSON.parse(llm) as Partial<typeof heuristic>;
    return {
      message: String(parsed.message || heuristic.message),
      variations: Array.isArray(parsed.variations)
        ? parsed.variations.map(String)
        : heuristic.variations,
      shorterVersion: String(parsed.shorterVersion || heuristic.shorterVersion),
      complianceFooter: COMPLIANCE_FOOTER,
      suggestedAudience: String(parsed.suggestedAudience || heuristic.suggestedAudience),
      suggestedSendTime: String(parsed.suggestedSendTime || heuristic.suggestedSendTime),
      abVersions: Array.isArray(parsed.abVersions)
        ? parsed.abVersions.map(String).slice(0, 2)
        : heuristic.abVersions,
      mmsRecommendation: String(parsed.mmsRecommendation || heuristic.mmsRecommendation),
      mode: "openai" as const,
    };
  } catch {
    return {
      ...heuristic,
      message: llm.slice(0, 320),
      mode: "openai" as const,
    };
  }
}
