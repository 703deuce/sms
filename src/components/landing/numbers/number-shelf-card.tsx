"use client";

import { displayLaunchPrice, formatUsd } from "@/lib/premium-numbers/launch-pricing";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function NumberShelfCard({
  result,
  loading,
  onGetNumber,
  onViewDetails,
  compact,
}: {
  result: PremiumNumberProductResult;
  loading?: boolean;
  onGetNumber: () => void;
  onViewDetails?: () => void;
  compact?: boolean;
}) {
  const pricing = displayLaunchPrice(result.premiumPriceCents, result.premiumPriceBand);
  const descriptor =
    result.cardBullets[0] ??
    result.memorabilityLabel ??
    (result.displayWord ? `Great for ${result.displayWord.toLowerCase()}` : "Easy repeating pattern");
  const badge = result.displayWord ? "Business Vanity" : pricing.showLaunchBadge ? "50% Launch Price" : null;
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
    <article
      className={cn(
        "nl-card flex flex-col rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:shadow-md",
        compact && "min-w-[160px] shrink-0 snap-start sm:min-w-0",
      )}
    >
      {badge ? (
        <span
          className={cn(
            "mb-2 inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            result.displayWord
              ? "bg-[#ede9fe] text-[#6d28d9]"
              : "bg-[#ecfdf5] text-[#047857]",
          )}
        >
          {badge}
        </span>
      ) : null}

      <p className="text-[22px] font-bold leading-tight tracking-tight text-[#111827] sm:text-[24px]">
        {result.vanityDisplay ?? result.displayNumber}
      </p>
      <p className="mt-1 text-[12px] text-[#6b7280]">{descriptor}</p>

      <div className="mt-3 flex items-baseline gap-2">
        {pricing.listPriceCents ? (
          <span className="text-[13px] text-[#9ca3af] line-through">
            {formatUsd(pricing.listPriceCents)}
          </span>
        ) : null}
        <span className="text-[20px] font-bold text-[#111827]">{formatUsd(pricing.priceCents)}</span>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            trackNumbersLandingEvent("top_pick_clicked", { phoneNumber: result.phoneNumber });
            onGetNumber();
          }}
          className="h-10 w-full rounded-lg bg-[#1e3a5f] text-[13px] font-semibold text-white transition hover:bg-[#152a45] disabled:opacity-60"
        >
          {loading ? "Checking…" : "Get This Number"}
        </button>
        {onViewDetails ? (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-center text-[12px] font-medium text-[#6366f1] hover:underline"
          >
            View Details
          </button>
        ) : (
          <Link
            href={`/personal/numbers/premium?phone=${encodeURIComponent(result.phoneNumber)}`}
            className="text-center text-[12px] font-medium text-[#6366f1] hover:underline"
          >
            View Details
          </Link>
        )}
      </div>
    </article>
  );
}
