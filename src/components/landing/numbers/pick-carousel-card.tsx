"use client";

import { displayLaunchPrice, formatUsd } from "@/lib/premium-numbers/launch-pricing";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { cn } from "@/lib/utils";

/** Compact carousel card matching FindNumber.ai mockup */
export function PickCarouselCard({
  result,
  loading,
  onView,
  variant = "carousel",
}: {
  result: PremiumNumberProductResult;
  loading?: boolean;
  onView: () => void;
  variant?: "carousel" | "shelf";
}) {
  const pricing = displayLaunchPrice(result.premiumPriceCents, result.premiumPriceBand);
  const display = result.vanityDisplay ?? result.displayNumber;

  if (variant === "shelf") {
    return (
      <article className="fn-shelf-card">
        {pricing.showLaunchBadge ? (
          <span className="fn-shelf-badge">50% Launch Price</span>
        ) : null}
        <p className="fn-shelf-number">{display}</p>
        <p className="fn-shelf-meta">
          {result.cardBullets[0] ?? result.memorabilityLabel ?? "Memorable number"}
        </p>
        <div className="fn-shelf-prices">
          <span className="fn-shelf-price">{formatUsd(pricing.priceCents)}</span>
          {pricing.listPriceCents ? (
            <span className="fn-shelf-was">{formatUsd(pricing.listPriceCents)}</span>
          ) : null}
        </div>
        <button type="button" disabled={loading} className="fn-shelf-link" onClick={onView}>
          {loading ? "Checking…" : "Get This Number"}
        </button>
      </article>
    );
  }

  return (
    <article className="fn-pick-card">
      <p className="fn-pick-number">{display}</p>
      <button
        type="button"
        disabled={loading}
        className={cn("fn-pick-view", loading && "opacity-60")}
        onClick={() => {
          trackNumbersLandingEvent("top_pick_clicked", { phoneNumber: result.phoneNumber });
          onView();
        }}
      >
        {loading ? "…" : `View · ${formatUsd(pricing.priceCents)}`}
      </button>
    </article>
  );
}
