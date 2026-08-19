"use client";

import { displayLaunchPrice, formatUsd } from "@/lib/premium-numbers/launch-pricing";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
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
        "flex flex-col rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-[#c7d2fe] hover:shadow-md",
      )}
    >
      <p className="text-[18px] font-bold leading-tight tracking-tight text-[#111827] lg:text-[20px]">
        {result.vanityDisplay ?? result.displayNumber}
      </p>
      <p className="mt-2 text-[13px] font-medium text-[#64748b]">
        {formatUsd(pricing.priceCents)} one-time
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          trackNumbersLandingEvent("top_pick_clicked", { phoneNumber: result.phoneNumber });
          onGetNumber();
        }}
        className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#6366f1] hover:underline disabled:opacity-60"
      >
        {loading ? "Checking…" : "Buy this Number"}
        {!loading ? <ArrowRight className="h-3.5 w-3.5" /> : null}
      </button>
    </article>
  );
}
