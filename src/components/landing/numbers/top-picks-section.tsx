"use client";

import { NumberShelfCard } from "@/components/landing/numbers/number-shelf-card";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { cn } from "@/lib/utils";
import { Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ShelfMarket = {
  metroLabel: string;
  likelyAreaCodes: string[];
  localized: boolean;
};

type TopPicksResponse = {
  items?: PremiumNumberProductResult[];
  searchLogId?: string;
  market?: ShelfMarket & { city?: string | null; region?: string | null };
  error?: string;
};

export function TopPicksSection({
  onShelfSearchLogId,
  onAreaCodesDetected,
  onGetNumber,
  reserving,
}: {
  onShelfSearchLogId: (id: string | undefined) => void;
  onAreaCodesDetected: (codes: string[]) => void;
  onGetNumber: (item: PremiumNumberProductResult) => void;
  reserving: string | null;
}) {
  const [topPicks, setTopPicks] = useState<PremiumNumberProductResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [localizing, setLocalizing] = useState(false);
  const [error, setError] = useState("");
  const [market, setMarket] = useState<ShelfMarket | null>(null);
  const [cityOrZip, setCityOrZip] = useState("");

  const applyResponse = useCallback(
    (data: TopPicksResponse) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      setError("");
      setTopPicks(data.items ?? []);
      onShelfSearchLogId(data.searchLogId);
      if (data.market) {
        setMarket({
          metroLabel: data.market.metroLabel,
          likelyAreaCodes: data.market.likelyAreaCodes,
          localized: Boolean(data.market.localized),
        });
        if (data.market.localized && data.market.likelyAreaCodes.length) {
          onAreaCodesDetected(data.market.likelyAreaCodes);
        }
      }
    },
    [onAreaCodesDetected, onShelfSearchLogId],
  );

  const loadGeneric = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/numbers/top-picks");
      const data = (await res.json()) as TopPicksResponse;
      applyResponse(data);
    } catch {
      setError("Could not load top picks.");
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    void loadGeneric();
  }, [loadGeneric]);

  async function loadLocal(body: Record<string, unknown>) {
    setLocalizing(true);
    setError("");
    try {
      const res = await fetch("/api/public/numbers/top-picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as TopPicksResponse;
      if (!res.ok) {
        setError(data.error ?? "Could not find numbers for that location.");
        return;
      }
      applyResponse(data);
      trackNumbersLandingEvent("top_pick_localized", { source: String(body.lat ? "browser" : "city_or_zip") });
    } catch {
      setError("Could not load local picks. Try again.");
    } finally {
      setLocalizing(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    setLocalizing(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void loadLocal({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocalizing(false);
        setError("Location permission denied. Enter a city or ZIP instead.");
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  function submitCityOrZip(e: React.FormEvent) {
    e.preventDefault();
    const value = cityOrZip.trim();
    if (!value) return;
    void loadLocal({ cityOrZip: value });
  }

  const subtitle = localizing
    ? "Finding numbers in your area…"
    : market?.localized
      ? `Top picks near ${market.metroLabel}.`
      : "Memorable numbers available right now.";

  return (
    <section className="nl-top-picks space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="nl-top-picks-badge" aria-hidden>
              ★
            </span>
            <h2 className="text-[22px] font-bold text-[#111827]">Top Picks Today</h2>
          </div>
          <p
            className={cn(
              "mt-1 text-[14px]",
              localizing ? "flex items-center gap-2 text-[#2563eb]" : "text-[#64748b]",
            )}
          >
            {localizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {subtitle}
              </>
            ) : (
              subtitle
            )}
          </p>
        </div>
        <a href="#search" className="text-[13px] font-semibold text-[#2563eb] hover:underline">
          View more numbers →
        </a>
      </div>

      <div className="nl-location-bar">
        <button type="button" onClick={useMyLocation} disabled={localizing || loading} className="nl-location-btn">
          <MapPin className="h-4 w-4" />
          Use my location
        </button>
        <span className="text-[13px] text-[#94a3b8]">or</span>
        <form onSubmit={submitCityOrZip} className="flex min-w-0 flex-1 gap-2">
          <input
            value={cityOrZip}
            onChange={(e) => setCityOrZip(e.target.value)}
            placeholder="Enter city or ZIP"
            className="nl-location-input"
          />
          <button type="submit" disabled={localizing || loading} className="nl-location-submit">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="nl-shelf-skeleton" />
          ))}
        </div>
      ) : topPicks.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {topPicks.map((item) => (
            <NumberShelfCard
              key={item.phoneNumber}
              result={item}
              loading={reserving === item.phoneNumber}
              onGetNumber={() => onGetNumber(item)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-white p-6 text-center text-[14px] text-[#64748b]">
          No picks available right now. Try searching above.
        </div>
      )}
    </section>
  );
}
