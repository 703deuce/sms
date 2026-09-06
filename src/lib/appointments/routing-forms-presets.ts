/** Client-safe routing form presets (no server-only imports). */

export function presetIndustryOptions(): string[] {
  return [
    "Healthcare",
    "Legal",
    "Real Estate",
    "Financial Services",
    "Home Services",
    "Professional Services",
    "Education",
    "Other",
  ];
}

export function presetCompanySizeOptions(): string[] {
  return ["1-10", "11-50", "51-200", "201-1000", "1000+"];
}
