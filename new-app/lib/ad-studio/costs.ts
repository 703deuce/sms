/** Ad Studio v1 credit placeholders. Billing is deferred. */
export const AD_STUDIO_COSTS = {
  storyline_15: null as number | null,
  storyline_30: null as number | null,
  image_to_ad_15: null as number | null,
  image_to_ad_30: null as number | null,
} as const;

export type AdStudioCostKey = keyof typeof AD_STUDIO_COSTS;
export function formatAdStudioCredits(credits: number | null): string {
  return credits === null ? "Credits TBD" : `${credits} credits`;
}

console.info("[ad-studio:config] initialized", { version: 1, configuredCosts: Object.values(AD_STUDIO_COSTS).filter((cost) => cost !== null).length });
