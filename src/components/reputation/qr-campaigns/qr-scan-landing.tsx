"use client";

import { useState } from "react";
import { MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { qrUi } from "./qr-ui";

/**
 * Mobile-first public funnel after a QR scan.
 */
export function QrScanLanding({
  businessName,
  locationLabel,
  brandColor,
  headline,
  description,
  destinationUrl,
}: {
  businessName: string;
  locationLabel?: string | null;
  brandColor: string;
  headline: string;
  description: string;
  destinationUrl: string;
}) {
  const [rating, setRating] = useState(5);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#DCFCE7_0%,_#F4F7FB_55%,_#E2E8F0_100%)] px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_60px_rgba(11,27,50,0.16)] ring-1 ring-black/5">
        <div
          className="px-6 pb-8 pt-8 text-center text-white"
          style={{
            background: `linear-gradient(160deg, ${brandColor} 0%, #0B1B32 120%)`,
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
            Google Review
          </p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
            How was your experience today?
          </h1>
          <p className="mt-2 text-sm text-white/85">
            {headline || "We appreciate your feedback"}
            {description ? ` — ${description}` : ""}
          </p>
        </div>

        <div className="space-y-5 px-6 py-7 text-center">
          <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] px-4 py-4">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="h-5 w-5 fill-[#F5C518] text-[#F5C518]" />
              ))}
            </div>
            <p className="mt-2 text-lg font-extrabold text-[#0B1B32]">{businessName}</p>
            {locationLabel ? (
              <p className="mt-1 inline-flex items-center justify-center gap-1 text-sm text-[#667085]">
                <MapPin className="h-3.5 w-3.5" />
                {locationLabel}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} stars`}
                onClick={() => setRating(n)}
                className="rounded-lg p-1 transition hover:scale-110"
              >
                <Star
                  className={cn(
                    "h-9 w-9",
                    n <= rating ? "fill-[#F5C518] text-[#F5C518]" : "text-[#D0D5DD]"
                  )}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-[#667085]">
            Tap a rating, then continue to leave your Google review.
          </p>
          <a
            href={destinationUrl}
            className={cn(qrUi.btnPrimary, "w-full text-base")}
            style={{ background: brandColor }}
          >
            Leave Review
          </a>
          <p className="text-[11px] text-[#98A2B3]">
            You&apos;ll open Google&apos;s review form for {businessName}.
          </p>
        </div>
      </div>
    </main>
  );
}
