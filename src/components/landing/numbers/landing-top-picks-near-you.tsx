"use client";

import { NumberShelfCard } from "@/components/landing/numbers/number-shelf-card";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, MapPin, Phone, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

export function LandingTopPicksNearYou({
  onShelfSearchLogId,
  onGetNumber,
  reserving,
}: {
  onShelfSearchLogId: (id: string | undefined) => void;
  onGetNumber: (item: PremiumNumberProductResult) => void;
  reserving: string | null;
}) {
  const [topPicks, setTopPicks] = useState<PremiumNumberProductResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [localizing, setLocalizing] = useState(false);
  const [error, setError] = useState("");
  const [market, setMarket] = useState<ShelfMarket | null>(null);
  const [cityOrZip, setCityOrZip] = useState("");
  const [showPicks, setShowPicks] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const applyResponse = useCallback(
    (data: TopPicksResponse) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      setError("");
      setTopPicks(data.items ?? []);
      setShowPicks(true);
      onShelfSearchLogId(data.searchLogId);
      if (data.market) {
        setMarket({
          metroLabel: data.market.metroLabel,
          likelyAreaCodes: data.market.likelyAreaCodes,
          localized: Boolean(data.market.localized),
        });
      }
    },
    [onShelfSearchLogId],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/public/numbers/top-picks");
        const data = (await res.json()) as TopPicksResponse;
        applyResponse(data);
      } catch {
        setError("Could not load top picks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [applyResponse]);

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
      trackNumbersLandingEvent("top_pick_localized", {
        source: String(body.lat ? "browser" : "city_or_zip"),
      });
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
    navigator.geolocation.getCurrentPosition(
      (pos) => void loadLocal({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLocalizing(false);
        setError("Location permission denied. Enter a city or ZIP instead.");
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  function submitLocation(e: React.FormEvent) {
    e.preventDefault();
    const value = cityOrZip.trim();
    if (!value) return;
    void loadLocal({ cityOrZip: value });
  }

  function scrollCarousel(dir: -1 | 1) {
    carouselRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  }

  const picksTitle = market?.localized
    ? `Top picks near ${market.metroLabel}`
    : "Top picks for today";

  return (
    <section id="top-picks" className="nb-top-picks-section">
      <div className="nb-container">
        <div className="nb-top-picks-header">
          <MapPin className="nb-top-picks-pin" />
          <div>
            <h2 className="nb-section-title">Top Picks Near You</h2>
            <p className="nb-top-picks-lead">
              Low-cost, high-value numbers hand-picked for memorability. Share your location or enter
              a city or ZIP to see picks in your area — or browse today&apos;s nationwide favorites.
            </p>
          </div>
        </div>

        <div className="nb-location-row">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={localizing || loading}
            className="nb-location-use-btn"
          >
            <MapPin className="h-4 w-4" />
            Use current location
          </button>
          <form onSubmit={submitLocation} className="nb-location-form">
            <input
              value={cityOrZip}
              onChange={(e) => setCityOrZip(e.target.value)}
              placeholder="Search by city, zip, or area code"
              className="nb-location-input"
            />
            <button type="submit" disabled={localizing || loading} className="nb-location-search-btn">
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>

        {error ? <p className="nb-inline-error">{error}</p> : null}

        {localizing ? (
          <p className="nb-loading-row">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding numbers in your area…
          </p>
        ) : null}

        {showPicks && !loading ? (
          <div className="nb-picks-block">
            <div className="nb-picks-block-head">
              <h3 className="nb-picks-subtitle">{picksTitle}</h3>
              <div className="nb-carousel-nav">
                <button type="button" onClick={() => scrollCarousel(-1)} aria-label="Previous">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => scrollCarousel(1)} aria-label="Next">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
            {topPicks.length > 0 ? (
              <div ref={carouselRef} className="nb-picks-carousel">
                {topPicks.map((item) => (
                  <div key={item.phoneNumber} className="nb-picks-carousel-item">
                    <NumberShelfCard
                      result={item}
                      loading={reserving === item.phoneNumber}
                      onGetNumber={() => onGetNumber(item)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="nb-empty-picks">No picks available — try searching above.</p>
            )}
          </div>
        ) : loading ? (
          <div className="nb-picks-carousel">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="nb-picks-carousel-item">
                <div className="nl-shelf-skeleton" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="nb-number-categories">
          {[
            { icon: MapPin, label: "Local Numbers", href: "#search" },
            { icon: Phone, label: "Toll Free Numbers", href: "#search" },
            { icon: Sparkles, label: "Premium Numbers", href: "#search" },
          ].map(({ icon: Icon, label, href }) => (
            <a key={label} href={href} className="nb-number-category">
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
