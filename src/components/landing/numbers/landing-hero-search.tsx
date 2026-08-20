"use client";

import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import type { PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useState } from "react";

const CATEGORIES = [
  "Last Name",
  "Business",
  "Word/Alpha",
  "Memorable",
  "Consecutive",
  "Look Alike",
] as const;

export type HeroSearchParams = {
  areaCode: string;
  contains: string;
  endsWith: string;
  pattern: string;
  numberType: "local" | "tollfree";
  category: (typeof CATEGORIES)[number];
};

export function LandingHeroSearch({
  onResults,
  onSearching,
}: {
  onResults: (data: PremiumSearchProductResponse) => void;
  onSearching: (loading: boolean) => void;
}) {
  const [areaCode, setAreaCode] = useState("");
  const [contains, setContains] = useState("");
  const [endsWith, setEndsWith] = useState("");
  const [pattern, setPattern] = useState("");
  const [numberType, setNumberType] = useState<"local" | "tollfree">("local");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Memorable");
  const [error, setError] = useState("");

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    const codes = areaCode.replace(/\D/g, "").match(/\d{3}/g) ?? [];
    if (numberType === "local" && codes.length === 0 && !contains.trim()) {
      setError("Enter an area code or digits to search.");
      return;
    }

    onSearching(true);
    trackNumbersLandingEvent("manual_search_started", { source: "hero_card" });

    const preferences: string[] = [];
    if (category === "Memorable") preferences.push("repeating_digits", "very_memorable");
    if (category === "Consecutive") preferences.push("easy_sequence");
    if (category === "Look Alike") preferences.push("repeating_pair");
    if (category === "Business" || category === "Word/Alpha") preferences.push("word_pattern");
    if (!preferences.length) preferences.push("surprise_me");

    try {
      const res = await fetch("/api/public/numbers/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: category === "Business" ? "business" : "personal",
          areaCodes: codes.length ? codes : undefined,
          areaCode: codes[0],
          numberType,
          industry: category === "Business" ? contains.trim() || "services" : undefined,
          customKeywords: contains.trim() ? [contains.trim()] : undefined,
          preferences,
        }),
      });
      const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Search failed");
      onResults(data);
      document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      onSearching(false);
    }
  }

  return (
    <form className="nb-hero-search-card" onSubmit={handleSearch}>
      <div className="nb-hero-search-grid">
        <label className="nb-field">
          <span>Area Code</span>
          <input
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value.replace(/[^\d,\s]/g, ""))}
            placeholder="e.g. 571"
          />
        </label>
        <label className="nb-field">
          <span>Contains</span>
          <input
            value={contains}
            onChange={(e) => setContains(e.target.value)}
            placeholder="Any digits or letters"
          />
        </label>
        <label className="nb-field">
          <span>Ends With</span>
          <input
            value={endsWith}
            onChange={(e) => setEndsWith(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
          />
        </label>
        <label className="nb-field">
          <span>Pattern</span>
          <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
            <option value="">Any</option>
            <option value="repeating">Repeating</option>
            <option value="sequential">Sequential</option>
            <option value="double">Double digits</option>
          </select>
        </label>
      </div>

      <div className="nb-hero-search-type">
        <button
          type="button"
          className={cn("nb-type-btn", numberType === "local" && "nb-type-btn-active")}
          onClick={() => setNumberType("local")}
        >
          Local
        </button>
        <button
          type="button"
          className={cn("nb-type-btn", numberType === "tollfree" && "nb-type-btn-active")}
          onClick={() => setNumberType("tollfree")}
        >
          Toll-free
        </button>
      </div>

      <div className="nb-hero-categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={cn("nb-category-link", category === cat && "nb-category-link-active")}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {error ? <p className="nb-search-error">{error}</p> : null}

      <div className="nb-hero-search-footer">
        <button type="submit" className="nb-btn-primary nb-btn-search">
          <Search className="h-4 w-4" />
          Search Now
        </button>
      </div>
    </form>
  );
}
