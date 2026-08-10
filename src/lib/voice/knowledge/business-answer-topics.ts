/** Topic classification for get_business_answer — server-side, before the LLM speaks. */

function hasTopicToken(topicLower: string, tokens: string[]): boolean {
  return tokens.some((token) => {
    if (token.length <= 2) return topicLower.includes(token);
    return (
      topicLower.includes(token) ||
      new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(topicLower)
    );
  });
}

/** Cost, fees, packages, diagnostic visits, etc. */
export function isPricingTopic(topicLower: string): boolean {
  return hasTopicToken(topicLower, [
    "pric",
    "cost",
    "fee",
    "charge",
    "how much",
    "package",
    "plan",
    "diagnostic",
    "quote",
    "estimate",
    "afford",
    "pay",
  ]);
}

/** Geographic coverage — must be checked before generic "services". */
export function isServiceAreaTopic(topicLower: string): boolean {
  return hasTopicToken(topicLower, [
    "service area",
    "coverage",
    "where do you serve",
    "do you serve",
    "do you come",
    "travel to",
    "come out to",
    "in my area",
    "arlington",
    "northern virginia",
    "nova",
    "county",
    "zip code",
  ]);
}

export function isServicesTopic(topicLower: string): boolean {
  if (isServiceAreaTopic(topicLower)) return false;
  return hasTopicToken(topicLower, [
    "what do you do",
    "what does",
    "offer",
    "repair",
    "install",
    "services",
    "plumb",
    "hvac",
  ]);
}

export function isHoursTopic(topicLower: string): boolean {
  return hasTopicToken(topicLower, [
    "hour",
    "open",
    "close",
    "when are you",
    "availability",
    "business hours",
  ]);
}
