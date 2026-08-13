/** Shared extractors for business description text — used by compile-time context and retrieval fallback. */

export function extractHoursFromDescription(description: string): string | null {
  const hoursMatch = description.match(
    /(?:regular\s+)?hours?\s*(?:are\s+)?([^.]+(?:\d\s*(?:am|pm)|Monday|weekday)[^.]*)/i,
  );
  if (hoursMatch?.[1]) return hoursMatch[1].trim();

  const weekdayMatch = description.match(
    /(Monday[^.]*(?:\d\s*(?:am|pm)|through|to)[^.]*)/i,
  );
  if (weekdayMatch?.[1]) return weekdayMatch[1].trim();

  return null;
}

export function extractPricingFromDescription(description: string): string | null {
  const matches = description.match(/\$[\d,]+[^.]*(?:\.|;|$)/gi);
  if (!matches?.length) return null;
  return matches.map((m) => m.trim().replace(/[.;]+$/, "")).join(". ") + ".";
}
