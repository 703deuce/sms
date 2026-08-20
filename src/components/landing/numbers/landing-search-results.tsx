"use client";

import { NumberShelfCard } from "@/components/landing/numbers/number-shelf-card";
import type { PremiumNumberProductResult, PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";

export function LandingSearchResults({
  response,
  reserving,
  onGetNumber,
}: {
  response: PremiumSearchProductResponse | null;
  reserving: string | null;
  onGetNumber: (item: PremiumNumberProductResult) => void;
}) {
  if (!response) return null;

  const results = [
    ...(response.topPicks ?? []),
    ...(response.bestMatches ?? []),
    ...(response.memorableAlternatives ?? []),
  ].slice(0, 12);

  if (!results.length) {
    return (
      <section id="search-results" className="nb-search-results nb-container">
        <h2 className="nb-section-title">Search Results</h2>
        <p className="nb-muted">No numbers matched your search. Try different filters.</p>
      </section>
    );
  }

  return (
    <section id="search-results" className="nb-search-results">
      <div className="nb-container">
        <h2 className="nb-section-title">Search Results</h2>
        <p className="nb-muted">
          {response.resultCount ?? results.length} numbers found
          {response.inventoryScannedCount ? ` • ${response.inventoryScannedCount} scanned` : ""}
        </p>
        <div className="nb-results-grid">
          {results.map((item) => (
            <NumberShelfCard
              key={item.phoneNumber}
              result={item}
              loading={reserving === item.phoneNumber}
              onGetNumber={() => onGetNumber(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
