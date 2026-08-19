/** Consumer launch pricing display — 50% off list tiers for paid-search landing. */
export const LAUNCH_PRICING_ACTIVE =
  process.env.NUMBERS_LAUNCH_PRICING !== "0" && process.env.NUMBERS_LAUNCH_PRICING !== "false";

export type LaunchPriceDisplay = {
  priceCents: number;
  listPriceCents?: number;
  showLaunchBadge: boolean;
};

/** Map premium band to consumer launch shelf prices. */
const LAUNCH_SHELF_BY_BAND: Record<string, number> = {
  normal: 499,
  nice: 999,
  memorable: 1499,
  exceptional: 1999,
  good: 4900,
  strong: 9900,
  premium: 14900,
};

const LIST_MULTIPLIER = 2;

export function displayLaunchPrice(
  premiumPriceCents: number,
  band?: string,
): LaunchPriceDisplay {
  if (!LAUNCH_PRICING_ACTIVE) {
    return { priceCents: premiumPriceCents, showLaunchBadge: false };
  }

  const launchFromBand = band ? LAUNCH_SHELF_BY_BAND[band] : undefined;
  const launchCents =
    launchFromBand ??
    (premiumPriceCents <= 0
      ? 499
      : premiumPriceCents >= 7900
        ? Math.max(1999, Math.round(premiumPriceCents * 0.5))
        : premiumPriceCents >= 2900
          ? 1499
          : premiumPriceCents >= 1900
            ? 999
            : 499);

  const listCents = launchFromBand
    ? launchFromBand * LIST_MULTIPLIER
    : Math.max(launchCents * 2, premiumPriceCents || launchCents * 2);

  return {
    priceCents: launchCents,
    listPriceCents: listCents > launchCents ? listCents : undefined,
    showLaunchBadge: true,
  };
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
