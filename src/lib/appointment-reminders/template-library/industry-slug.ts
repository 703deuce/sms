/** Legacy preset IDs → canonical library industry slug. */
const LEGACY_INDUSTRY_SLUG: Record<string, string> = {
  healthcare_dental: "healthcare",
  counseling_wellness: "counseling",
};

export function resolveLibraryIndustrySlug(industry: string): string {
  return LEGACY_INDUSTRY_SLUG[industry] || industry;
}
