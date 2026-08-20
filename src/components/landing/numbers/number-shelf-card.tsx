"use client";

import { displayLaunchPrice, formatUsd } from "@/lib/premium-numbers/launch-pricing";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export function NumberShelfCard({
  result,
  loading,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  loading?: boolean;
  onGetNumber: () => void;
}) {
  const pricing = displayLaunchPrice(result.premiumPriceCents, result.premiumPriceBand);
  const descriptor =
    result.cardBullets[0] ??
    result.memorabilityLabel ??
    (result.displayWord ? `Great for ${result.displayWord.toLowerCase()}` : "Easy repeating pattern");
  const impressionSent = useRef(false);

  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    trackNumbersLandingEvent("top_pick_impression", {
      phoneNumber: result.phoneNumber,
      priceCents: pricing.priceCents,
      band: result.premiumPriceBand,
    });
  }, [result.phoneNumber, result.premiumPriceBand, pricing.priceCents]);

  return (
    <article className="nl-shelf-card">
      {pricing.showLaunchBadge ? (
        <span className="nl-shelf-launch-badge">50% Launch Price</span>
      ) : null}
      <p className="nl-shelf-number">{result.vanityDisplay ?? result.displayNumber}</p>
      <p className="nl-shelf-descriptor">{descriptor}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="nl-shelf-price">{formatUsd(pricing.priceCents)}</span>
        {pricing.listPriceCents ? (
          <span className="nl-shelf-list-price">{formatUsd(pricing.listPriceCents)}</span>
        ) : null}
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          trackNumbersLandingEvent("top_pick_clicked", { phoneNumber: result.phoneNumber });
          onGetNumber();
        }}
        className={cn("nl-shelf-cta", loading && "opacity-60")}
      >
        {loading ? "Checking…" : "Get This Number"}
      </button>
    </article>
  );
}
