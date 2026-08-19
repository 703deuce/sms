"use client";

import { FindNumberAiPanel } from "@/components/numbers/find-number-ai-panel";
import { NumberShelfCard } from "@/components/landing/numbers/number-shelf-card";
import {
  applySearchStatePatch,
  createDefaultNumberSearchState,
} from "@/lib/premium-numbers/ai-number-search/state";
import { buildPremiumSearchBody, filterResultsByMaxPrice } from "@/lib/premium-numbers/find-number-search-bridge";
import type { NumberSearchState } from "@/lib/premium-numbers/ai-number-search/types";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import type { PremiumNumberProductResult, PremiumSearchProductResponse } from "@/lib/premium-numbers/product-api";
import { runPublicNumberSearch } from "@/lib/premium-numbers/public-find-number-client-search";
import { parseAreaCodesInput } from "@/lib/premium-numbers/toll-free";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PUBLIC_WORKSPACE_KEY = "public-landing";

type SearchTab = "manual" | "ai";

export function NumbersLandingSearch({
  initialTopPicks,
  defaultAreaCodes,
  shelfSearchLogId: initialShelfSearchLogId,
}: {
  initialTopPicks: PremiumNumberProductResult[];
  defaultAreaCodes: string[];
  shelfSearchLogId?: string;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<SearchTab>("manual");
  const [query, setQuery] = useState("");
  const [areaCodeFilter, setAreaCodeFilter] = useState(defaultAreaCodes[0] ?? "");
  const [priceFilter, setPriceFilter] = useState("any");
  const [sortBy, setSortBy] = useState("best");
  const [searchState, setSearchState] = useState<NumberSearchState>(() => {
    const base = createDefaultNumberSearchState();
    return applySearchStatePatch(base, { areaCodes: defaultAreaCodes.slice(0, 2) });
  });

  const [topPicks, setTopPicks] = useState(initialTopPicks);
  const [shelfSearchLogId, setShelfSearchLogId] = useState(initialShelfSearchLogId);
  const [searchResponse, setSearchResponse] = useState<PremiumSearchProductResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [error, setError] = useState("");
  const [reserving, setReserving] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState("");
  const [aiMessages, setAiMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);

  const hasSearched = Boolean(searchResponse);
  const showTopPicks = !hasSearched && !loading;

  const displayResults = useMemo(() => {
    if (!searchResponse) return [];
    const pool = [
      ...(searchResponse.bestMatches ?? []),
      ...(searchResponse.topPicks ?? []),
      ...(searchResponse.memorableAlternatives ?? []),
    ];
    const seen = new Set<string>();
    let results = pool.filter((r) => {
      if (seen.has(r.phoneNumber)) return false;
      seen.add(r.phoneNumber);
      return true;
    });

    if (priceFilter === "under10") {
      results = results.filter((r) => r.premiumPriceCents <= 999);
    } else if (priceFilter === "under20") {
      results = results.filter((r) => r.premiumPriceCents <= 1999);
    }

    if (sortBy === "price") {
      results.sort((a, b) => a.premiumPriceCents - b.premiumPriceCents);
    } else if (sortBy === "score") {
      results.sort((a, b) => b.numberQualityScore - a.numberQualityScore);
    }

    return results.slice(0, 12);
  }, [searchResponse, priceFilter, sortBy]);

  const runSearchFromState = useCallback(async (state: NumberSearchState) => {
    setLoading(true);
    setSearchingMore(false);
    setError("");
    setSearchResponse(null);
    setReserveError("");

    const body = { ...buildPremiumSearchBody(PUBLIC_WORKSPACE_KEY, state), stream: true };

    try {
      await runPublicNumberSearch(body, (data) => {
        let snapshot = data;
        if (state.maxPriceCents) {
          const filtered = filterResultsByMaxPrice(
            [
              ...(data.bestMatches ?? []),
              ...(data.topPicks ?? []),
              ...(data.memorableAlternatives ?? []),
            ],
            state.maxPriceCents,
          );
          const phones = new Set(filtered.map((r) => r.phoneNumber));
          snapshot = {
            ...data,
            bestMatches: (data.bestMatches ?? []).filter((r) => phones.has(r.phoneNumber)),
            topPicks: (data.topPicks ?? []).filter((r) => phones.has(r.phoneNumber)),
            memorableAlternatives: (data.memorableAlternatives ?? []).filter((r) =>
              phones.has(r.phoneNumber),
            ),
            resultCount: filtered.length,
          };
        }
        setSearchResponse(snapshot);
        setSearchingMore(snapshot.searchStatus === "searching");
        if (snapshot.searchStatus !== "searching") {
          setLoading(false);
          trackNumbersLandingEvent("search_completed", { resultCount: snapshot.resultCount });
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setSearchingMore(false);
    }
  }, []);

  async function onManualSearch() {
    trackNumbersLandingEvent("manual_search_started");
    const codes = parseAreaCodesInput(areaCodeFilter || query);
    const next = applySearchStatePatch(searchState, {
      areaCodes: codes.length ? codes : defaultAreaCodes,
      apiIntent: "surprise_me",
    });
    setSearchState(next);
    await runSearchFromState(next);
  }

  async function onAiSearch(message?: string) {
    const text = (message ?? "").trim();
    if (!text) return;
    setAiLoading(true);
    setError("");
    trackNumbersLandingEvent("ai_search_started");
    setAiMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/public/numbers/ai/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: aiSessionId,
          message: text,
          currentSearchState: searchState,
          resultSummaries: displayResults.length ? displayResults : topPicks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      setAiSessionId(data.sessionId);
      setSearchState(data.searchState);
      setAiMessages((prev) => [...prev, { role: "assistant", content: data.assistantMessage }]);
      if (data.searchPerformed) {
        await runSearchFromState(data.searchState);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI search failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function onGetNumber(result: PremiumNumberProductResult) {
    const searchLogId = searchResponse?.searchLogId ?? shelfSearchLogId;
    if (!searchLogId) {
      router.push(
        `/personal/numbers/premium?phone=${encodeURIComponent(result.phoneNumber)}&area=${encodeURIComponent(result.displayNumber.slice(0, 3))}`,
      );
      return;
    }

    setReserving(result.phoneNumber);
    setReserveError("");
    try {
      const res = await fetch("/api/public/numbers/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: result.phoneNumber,
          searchLogId,
          searchMode: searchResponse?.mode ?? "personal",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reserve this number");
      trackNumbersLandingEvent("checkout_started", { phoneNumber: result.phoneNumber });
      router.push(data.signupUrl ?? `/signup?next=/personal/numbers/premium`);
    } catch (err) {
      setReserveError(err instanceof Error ? err.message : "Reservation failed");
    } finally {
      setReserving(null);
    }
  }

  function clearSearch() {
    setSearchResponse(null);
    setError("");
    setReserveError("");
  }

  useEffect(() => {
    trackNumbersLandingEvent("landing_view");
  }, []);

  useEffect(() => {
    if (initialTopPicks.length > 0) return;
    fetch("/api/public/numbers/top-picks")
      .then((r) => r.json())
      .then((data: { items?: PremiumNumberProductResult[]; searchLogId?: string }) => {
        if (data.items?.length) setTopPicks(data.items);
        if (data.searchLogId) setShelfSearchLogId(data.searchLogId);
      })
      .catch(() => {
        /* shelf unavailable */
      });
  }, [initialTopPicks.length]);

  const shelfItems = showTopPicks ? topPicks : displayResults;

  return (
    <div ref={searchRef} className="nl-search-wrap mx-auto w-full max-w-6xl">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex gap-1 rounded-lg bg-[#f3f4f6] p-1">
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition",
              tab === "manual" ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280]",
            )}
          >
            <Search className="h-4 w-4" />
            Search Numbers
          </button>
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-semibold transition",
              tab === "ai" ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280]",
            )}
          >
            <Sparkles className="h-4 w-4" />
            Ask {BRAND_NAME}
          </button>
        </div>

        {tab === "manual" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onManualSearch()}
                  placeholder="Find a number by pattern, area code, word or any other idea…"
                  className="h-12 flex-1 rounded-lg border border-[#e5e7eb] px-4 text-[14px] outline-none ring-[#6366f1] focus:ring-2"
                />
                <button
                  type="button"
                  onClick={onManualSearch}
                  disabled={loading}
                  className="h-12 shrink-0 rounded-lg bg-[#1e3a5f] px-6 text-[14px] font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
                >
                  Go
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <FilterSelect
                  label="Area Code"
                  value={areaCodeFilter}
                  onChange={setAreaCodeFilter}
                  options={[
                    { value: "", label: "Any Area Code" },
                    ...defaultAreaCodes.map((c) => ({ value: c, label: c })),
                    { value: "571,703", label: "571 / 703" },
                    { value: "305,786", label: "305 / 786" },
                    { value: "917,929", label: "917 / 929" },
                  ]}
                />
                <FilterSelect
                  label="Type"
                  value="local"
                  onChange={() => {}}
                  options={[
                    { value: "local", label: "Local" },
                    { value: "tollfree", label: "Toll-Free" },
                  ]}
                />
                <FilterSelect
                  label="Price Range"
                  value={priceFilter}
                  onChange={setPriceFilter}
                  options={[
                    { value: "any", label: "Any Price" },
                    { value: "under10", label: "Under $10" },
                    { value: "under20", label: "Under $20" },
                  ]}
                />
                <FilterSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={setSortBy}
                  options={[
                    { value: "best", label: "Best Match" },
                    { value: "price", label: "Lowest Price" },
                    { value: "score", label: "Highest Score" },
                  ]}
                />
              </div>
            </div>

            <aside className="hidden rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 lg:block">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#6b7280]">
                Searching for…
              </p>
              <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
                <li>• Easy-to-dial personal or business numbers</li>
                <li>• Specific area codes &amp; regional presence</li>
                <li>• Memorable words and alphanumeric patterns</li>
                <li>• AI-driven search for unique requests</li>
              </ul>
            </aside>
          </div>
        ) : (
          <div className="space-y-3">
            <FindNumberAiPanel
              sessionId={aiSessionId}
              messages={aiMessages.map((m, i) => ({
                id: String(i),
                role: m.role,
                content: m.content,
                createdAt: new Date().toISOString(),
              }))}
              understandingChips={[]}
              loading={aiLoading}
              loadingStage={aiLoading ? "Searching live inventory…" : ""}
              suggestedActions={[
                "I want an easy 571 number under $15",
                "Find something with lots of 7s",
                "Memorable number for a roofing company",
              ]}
              onSend={(message, quickAction) => onAiSearch(quickAction ?? message)}
              onQuickAction={(action) => onAiSearch(action)}
              onClear={() => {
                setAiMessages([]);
                setAiSessionId(null);
              }}
              onRemoveChip={() => {}}
              variant="mockup"
            />
          </div>
        )}

        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
        {reserveError ? <p className="mt-3 text-[13px] text-red-600">{reserveError}</p> : null}
        {hasSearched ? (
          <button
            type="button"
            onClick={clearSearch}
            className="mt-3 text-[12px] font-medium text-[#6366f1] hover:underline"
          >
            ← Back to Top Picks Today
          </button>
        ) : null}
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-bold text-[#111827] sm:text-[26px]">
              {showTopPicks ? "Top Picks Today" : "Your Results"}
            </h2>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              {showTopPicks
                ? "Memorable numbers available right now."
                : searchingMore
                  ? "Searching live inventory…"
                  : `${displayResults.length} numbers found`}
            </p>
          </div>
          {showTopPicks && topPicks.length > 0 ? (
            <button
              type="button"
              onClick={onManualSearch}
              className="hidden text-[13px] font-semibold text-[#6366f1] hover:underline sm:block"
            >
              See all results →
            </button>
          ) : null}
        </div>

        {loading && !searchResponse ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[180px] animate-pulse rounded-xl border border-[#e5e7eb] bg-[#f3f4f6]"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
              {shelfItems.map((item) => (
                <NumberShelfCard
                  key={item.phoneNumber}
                  result={item}
                  loading={reserving === item.phoneNumber}
                  onGetNumber={() => onGetNumber(item)}
                  compact
                />
              ))}
            </div>
            {!shelfItems.length && !loading ? (
              <p className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#f9fafb] p-8 text-center text-[14px] text-[#6b7280]">
                No numbers available in this market right now. Try searching a different area code.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-[#e5e7eb] bg-white pl-3 pr-8 text-[12px] font-medium text-[#374151]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#9ca3af]" />
    </label>
  );
}

export function focusLandingSearch() {
  document.querySelector(".nl-search-wrap")?.scrollIntoView({ behavior: "smooth" });
}
