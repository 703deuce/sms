"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import {
  TOLL_FREE_AREA_CODES,
  parseAreaCodesInput,
  type NumberType,
  type TollFreePrefix,
} from "@/lib/premium-numbers/toll-free";
import {
  applySearchStatePatch,
  createDefaultNumberSearchState,
  resetNumberSearchState,
} from "@/lib/premium-numbers/ai-number-search/state";
import type {
  NumberSearchState,
} from "@/lib/premium-numbers/ai-number-search/types";
import { trackFindNumberAiEvent } from "@/lib/premium-numbers/find-number-analytics";
import { runPremiumNumberSearch } from "@/lib/premium-numbers/find-number-client-search";
import {
  buildPremiumSearchBody,
  filterResultsByMaxPrice,
} from "@/lib/premium-numbers/find-number-search-bridge";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowRightLeft,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Filter,
  Globe,
  Grid3x3,
  Heart,
  HeartPulse,
  Laptop,
  LayoutList,
  ListOrdered,
  MessageCircle,
  MessageSquare,
  Mic,
  Phone,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { FindNumberAiPanel } from "./find-number-ai-panel";
import {
  PremiumCheckoutModal,
  PremiumSuccessPanel,
  type PremiumCheckoutState,
} from "./premium-number-checkout";
import { useFindNumberAi } from "./use-find-number-ai";

const TOLL_FREE_OPTIONS: { value: TollFreePrefix; label: string }[] = [
  { value: "all", label: "All toll-free (800, 833, 866, …)" },
  ...TOLL_FREE_AREA_CODES.map((code) => ({ value: code as TollFreePrefix, label: code })),
];

const PRIMARY = "#4f46e5";

const POPULAR_AREA_CODES = [
  "702",
  "310",
  "212",
  "415",
  "646",
  "305",
  "404",
  "678",
  "713",
  "832",
];

const BUSINESS_CATEGORIES = [
  { id: "retail", label: "Retail", industry: "retail", icon: ShoppingBag },
  { id: "real_estate", label: "Real Estate", industry: "real estate", icon: Building2 },
  { id: "healthcare", label: "Healthcare", industry: "healthcare", icon: HeartPulse },
  { id: "tech", label: "Tech/SaaS", industry: "technology", icon: Laptop },
  { id: "hospitality", label: "Hospitality", industry: "hospitality", icon: UtensilsCrossed },
  { id: "professional", label: "Professional", industry: "professional services", icon: Briefcase },
] as const;

const DISPLAY_MONTHLY_CENTS = 100;

type SearchTab = "area_code" | "toll_free";

const AREA_CODE_LOCATIONS: Record<string, string> = {
  "702": "Las Vegas, NV",
  "310": "Los Angeles, CA",
  "212": "New York, NY",
  "415": "San Francisco, CA",
  "646": "New York, NY",
  "305": "Miami, FL",
  "404": "Atlanta, GA",
  "678": "Atlanta, GA",
  "713": "Houston, TX",
  "832": "Houston, TX",
  "571": "Northern Virginia",
  "240": "Maryland",
  "301": "Maryland",
  "602": "Phoenix, AZ",
};

type SearchType = "contains" | "starts_with" | "ends_with";
type SearchIntent = "business_keyword" | "number_pattern" | "surprise_me";
type SearchPrefId =
  | "direct_dial"
  | "vanity"
  | "sequential"
  | "shared_use"
  | "port_ready"
  | "multi_region";

type PatternChipId = PersonalPreference | "word_pattern";

const SEARCH_PREFS: {
  id: SearchPrefId;
  label: string;
  icon: typeof Phone;
}[] = [
  { id: "direct_dial", label: "Direct Dial", icon: Phone },
  { id: "vanity", label: "Vanity", icon: Sparkles },
  { id: "sequential", label: "Sequential", icon: ListOrdered },
  { id: "shared_use", label: "Shared Use", icon: Users },
  { id: "port_ready", label: "Port-Ready", icon: ArrowRightLeft },
  { id: "multi_region", label: "Multi-Region", icon: Globe },
];

const SERVICE_TAGS = ["SMS", "MMS", "Voice", "Fax"] as const;

const QUICK_AREA_CODES = POPULAR_AREA_CODES;

const BUSINESS_QUICK_PICKS = BUSINESS_CATEGORIES.map((c) => ({
  id: c.id,
  label: c.label,
  industry: c.industry,
}));

const PROVINCES = [
  "Vermont",
  "Virginia",
  "California",
  "Texas",
  "New York",
  "Florida",
];

const pm = {
  card: "rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
};

function splitKeywordInput(text: string): string[] {
  return text
    .split(/[,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function maskToKeywords(mask: string): string[] {
  const letters = mask.match(/[A-Za-z]+/g) ?? [];
  return letters.map((w) => w.toUpperCase()).filter((w) => w.length >= 2);
}

function deriveIndustry(mask: string, tags: string[]): string {
  if (tags[0] && tags[0].length >= 2) return tags[0].toLowerCase();
  const words = mask.match(/[A-Za-z]{2,}/g);
  if (words?.[0]) return words[0].toLowerCase();
  return "local services";
}

function toApiPreferences(
  searchPrefs: SearchPrefId[],
  searchType: SearchType,
): PersonalPreference[] {
  const prefs: PersonalPreference[] = [];
  if (searchPrefs.includes("sequential") || searchType === "ends_with") {
    prefs.push("easy_sequence", "repeating_pair", "ends_0000");
  }
  if (searchPrefs.includes("direct_dial")) {
    prefs.push("very_memorable");
  }
  if (searchPrefs.includes("vanity")) {
    prefs.push("very_memorable", "repeating_digits");
  }
  if (!prefs.length) {
    return searchType === "ends_with" ? ["ends_0000"] : ["surprise_me"];
  }
  return [...new Set(prefs)];
}

function formatMonthlyDisplay(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function PersonalFindNumberClient({ workspaceId }: { workspaceId: string }) {
  const [searchState, setSearchState] = useState<NumberSearchState>(
    createDefaultNumberSearchState(),
  );
  const [searchTab, setSearchTab] = useState<SearchTab>("area_code");
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [selectedForAi, setSelectedForAi] = useState<string | null>(null);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const numberType = searchState.numberType;
  const tollFreePrefix = searchState.tollFreePrefix;
  const searchType = searchState.searchType;
  const countryProvince = searchState.countryProvince;
  const numberMask = searchState.numberMask;
  const searchPrefs = searchState.searchPrefs;
  const sortBy = searchState.sortBy;
  const serviceTags = useMemo(() => new Set(searchState.serviceTags), [searchState.serviceTags]);
  const areaCodesInput = searchState.areaCodes.join(", ");
  const suggestedKeywords = searchState.keywords.join(", ");
  const keywordTags = searchState.keywords;

  function patchSearch(patch: Partial<NumberSearchState>) {
    setSearchState((prev) => applySearchStatePatch(prev, patch));
  }

  function setNumberType(value: NumberType) {
    patchSearch({ numberType: value });
  }
  function setTollFreePrefix(value: TollFreePrefix) {
    patchSearch({ tollFreePrefix: value });
  }
  function setSearchType(value: SearchType) {
    patchSearch({ searchType: value });
  }
  function setCountryProvince(value: string) {
    patchSearch({ countryProvince: value });
  }
  function setNumberMask(value: string) {
    patchSearch({ numberMask: value });
  }
  function setSortBy(value: NumberSearchState["sortBy"]) {
    patchSearch({ sortBy: value });
  }
  function setAreaCodesInput(value: string) {
    patchSearch({ areaCodes: parseAreaCodesInput(value) });
  }
  function setSuggestedKeywords(value: string) {
    const words = splitKeywordInput(value);
    patchSearch({ explicitKeywords: words, keywords: words });
  }

  const [loading, setLoading] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [searchDurationSec, setSearchDurationSec] = useState<number | null>(null);
  const [searchCompletedAt, setSearchCompletedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [searchResponse, setSearchResponse] = useState<PremiumSearchProductResponse | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PremiumCheckoutState | null>(null);
  const [success, setSuccess] = useState<PremiumCheckoutState | null>(null);
  const [reserveError, setReserveError] = useState("");

  const parsedAreaCodes = searchState.areaCodes;

  const apiIntent = searchState.apiIntent;

  const industryForSearch = useMemo(
    () => searchState.industry || deriveIndustry(numberMask, keywordTags),
    [searchState.industry, numberMask, keywordTags],
  );

  const canSearch =
    parsedAreaCodes.length > 0 &&
    (apiIntent === "business_keyword"
      ? industryForSearch.length >= 2 ||
        keywordTags.length > 0 ||
        numberMask.replace(/\D/g, "").length >= 4
      : true);

  async function onSuggestKeywords() {
    const industryText = industryForSearch;
    if (industryText.length < 2) {
      setSuggestError("Enter a number mask with letters first");
      return;
    }
    setSuggestingKeywords(true);
    setSuggestError("");
    try {
      const res = await fetch("/api/numbers/premium/suggest-keywords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ industry: industryText }),
      });
      const data = (await res.json()) as { keywords?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not suggest keywords");
      if (data.keywords?.length) {
        patchSearch({
          aiGeneratedKeywords: data.keywords,
          industry: industryText,
          intent: "business",
          apiIntent: "business_keyword",
        });
      } else {
        setSuggestError("No keyword ideas returned — try different wording.");
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setSuggestingKeywords(false);
    }
  }

  function resetSearch() {
    setSearchResponse(null);
    setSearchDurationSec(null);
    setSearchCompletedAt(null);
    setError("");
    setSelectedForAi(null);
  }

  function toggleServiceTag(tag: string) {
    const next = new Set(serviceTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    patchSearch({ serviceTags: [...next] });
  }

  function toggleSearchPref(id: SearchPrefId) {
    const next = searchPrefs.includes(id)
      ? searchPrefs.filter((p) => p !== id)
      : [...searchPrefs, id];
    patchSearch({ searchPrefs: next });
  }

  const runSearchFromState = useCallback(
    async (state: NumberSearchState) => {
      setLoading(true);
      setSearchingMore(false);
      setError("");
      setSearchResponse(null);
      setSuccess(null);
      setSearchDurationSec(null);
      setSearchCompletedAt(null);

      const body = buildPremiumSearchBody(workspaceId, state);

      try {
        const snapshots: PremiumSearchProductResponse[] = [];
        const { durationSec, completedAt } = await runPremiumNumberSearch(body, (data) => {
          snapshots[0] = data;
          setSearchResponse(data);
          setSearchingMore(data.searchStatus === "searching");
          if (data.searchStatus !== "searching") {
            setLoading(false);
          }
        });

        const snapshot = snapshots[0];
        if (snapshot && state.maxPriceCents) {
          const filtered = filterResultsByMaxPrice(
            [
              ...(snapshot.bestMatches ?? []),
              ...(snapshot.topPicks ?? []),
              ...(snapshot.memorableAlternatives ?? []),
            ],
            state.maxPriceCents,
          );
          const filteredPhones = new Set(filtered.map((r) => r.phoneNumber));
          setSearchResponse({
            ...snapshot,
            bestMatches: (snapshot.bestMatches ?? []).filter((r) =>
              filteredPhones.has(r.phoneNumber),
            ),
            topPicks: (snapshot.topPicks ?? []).filter((r) => filteredPhones.has(r.phoneNumber)),
            memorableAlternatives: (snapshot.memorableAlternatives ?? []).filter((r) =>
              filteredPhones.has(r.phoneNumber),
            ),
            resultCount: filtered.length,
          });
        }

        setSearchDurationSec(durationSec);
        setSearchCompletedAt(completedAt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
        setSearchingMore(false);
      }
    },
    [workspaceId],
  );

  async function onSearch() {
    await runSearchFromState(searchState);
  }

  function toggleFavorite(phone: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  const allResults = useMemo(() => {
    if (!searchResponse) return [];
    const pool = [
      ...(searchResponse.bestMatches ?? []),
      ...(searchResponse.topPicks ?? []),
      ...(searchResponse.memorableAlternatives ?? []),
    ];
    const seen = new Set<string>();
    return pool.filter((r) => {
      if (seen.has(r.phoneNumber)) return false;
      seen.add(r.phoneNumber);
      return true;
    });
  }, [searchResponse]);

  const bestMatches = useMemo(() => {
    const sorted = [...allResults];
    if (sortBy === "price") {
      sorted.sort((a, b) => a.premiumPriceCents - b.premiumPriceCents);
    } else if (sortBy === "score") {
      sorted.sort((a, b) => b.numberQualityScore - a.numberQualityScore);
    }
    return sorted.slice(0, 10);
  }, [allResults, sortBy]);

  const moreMatches = useMemo(() => {
    const bestPhones = new Set(bestMatches.map((r) => r.phoneNumber));
    const sorted = allResults.filter((r) => !bestPhones.has(r.phoneNumber));
    if (sortBy === "price") {
      sorted.sort((a, b) => a.premiumPriceCents - b.premiumPriceCents);
    } else if (sortBy === "score") {
      sorted.sort((a, b) => b.numberQualityScore - a.numberQualityScore);
    }
    return sorted;
  }, [allResults, bestMatches, sortBy]);

  const resultCount = searchResponse?.resultCount ?? bestMatches.length;

  const ai = useFindNumberAi({
    workspaceId,
    searchState,
    setSearchState,
    onSearchPerformed: runSearchFromState,
    topResults: allResults.slice(0, 12),
    selectedNumberId: selectedForAi,
  });

  function toggleQuickAreaCode(code: string) {
    const next = searchState.areaCodes.includes(code)
      ? searchState.areaCodes.filter((c) => c !== code)
      : [...searchState.areaCodes, code];
    patchSearch({ areaCodes: next });
  }

  const basketCount = favorites.size;
  const aiEngaged = ai.messages.length > 0;

  async function onGetNumber(result: PremiumNumberProductResult) {
    if (!searchResponse?.searchLogId) return;
    const reserveSearchMode = apiIntent === "business_keyword" ? "business" : "personal";
    setReserving(result.phoneNumber);
    setReserveError("");
    if (aiEngaged) {
      trackFindNumberAiEvent("number_reserved_from_ai", { phone: result.phoneNumber });
    }
    try {
      const res = await fetch("/api/numbers/premium/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          phoneNumber: result.phoneNumber,
          searchLogId: searchResponse.searchLogId,
          searchMode: reserveSearchMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reserve this number");
      if (!data.expiresAt) throw new Error("Reservation did not return an expiration time");
      setCheckout({
        reservationId: data.reservationId,
        phoneNumber: result.phoneNumber,
        vanityDisplay: data.vanityDisplay ?? result.vanityDisplay,
        displayNumber: data.displayNumber ?? result.displayNumber,
        premiumPriceCents: data.premiumPriceCents ?? result.premiumPriceCents,
        expiresAt: data.expiresAt,
      });
    } catch (err) {
      setReserveError(err instanceof Error ? err.message : "Reservation failed");
    } finally {
      setReserving(null);
    }
  }

  function setSearchTabValue(tab: SearchTab) {
    setSearchTab(tab);
    patchSearch({ numberType: tab === "toll_free" ? "tollfree" : "local" });
  }

  async function onBusinessCategoryPick(industry: string) {
    patchSearch({ industry, intent: "business", apiIntent: "business_keyword" });
    await ai.sendAiMessage(`Find me a memorable number for my ${industry} business`);
  }

  function onAskAiAboutNumber(result: PremiumNumberProductResult) {
    setSelectedForAi(result.phoneNumber);
    setMobileAiOpen(true);
    ai.sendAiMessage(
      `Why is ${result.vanityDisplay ?? result.displayNumber} a good choice for my search?`,
    );
  }

  function fullReset() {
    resetSearch();
    setSearchState(resetNumberSearchState());
    setSearchTab("area_code");
    ai.clearAiSession();
  }

  const displayedBest = showSelectedOnly
    ? bestMatches.filter((r) => favorites.has(r.phoneNumber))
    : bestMatches;
  const displayedMore = showSelectedOnly
    ? moreMatches.filter((r) => favorites.has(r.phoneNumber))
    : moreMatches;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">Find a Number</h1>
        <p className="mt-1 text-[14px] text-[#6b7280]">
          Search for phone numbers to expand your business presence and reach more customers.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        {/* Left — search controls */}
        <div className={cn(pm.card, "p-5 md:p-6")}>
          <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
            <button
              type="button"
              onClick={() => setSearchTabValue("area_code")}
              className={cn(
                "rounded-md px-4 py-2 text-[13px] font-semibold transition",
                searchTab === "area_code"
                  ? "bg-[#4f46e5] text-white shadow-sm"
                  : "text-[#6b7280] hover:text-[#111827]",
              )}
            >
              Area Code
            </button>
            <button
              type="button"
              onClick={() => setSearchTabValue("toll_free")}
              className={cn(
                "rounded-md px-4 py-2 text-[13px] font-semibold transition",
                searchTab === "toll_free"
                  ? "bg-[#4f46e5] text-white shadow-sm"
                  : "text-[#6b7280] hover:text-[#111827]",
              )}
            >
              Toll Free/Local
            </button>
          </div>

          {searchTab === "area_code" ? (
            <div className="mt-4 space-y-4">
              <div>
                <Input
                  value={areaCodesInput}
                  onChange={(e) =>
                    setAreaCodesInput(e.target.value.replace(/[^\d,\s]/g, ""))
                  }
                  placeholder="Enter 3-digit area code"
                  className="h-11 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                />
                <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
                  Local area codes help customers recognize your business as part of their
                  community — building trust and improving response rates for calls and texts.
                </p>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Popular Areas</p>
                <div className="grid grid-cols-5 gap-2">
                  {POPULAR_AREA_CODES.map((code) => {
                    const active = searchState.areaCodes.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleQuickAreaCode(code)}
                        className={cn(
                          "rounded-lg border py-2 text-[13px] font-semibold transition",
                          active
                            ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]"
                            : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]",
                        )}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-[12px] text-[#6b7280]">
                Search toll-free prefixes for nationwide reach with a single memorable number.
              </p>
              <select
                className="h-11 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
                value={tollFreePrefix}
                onChange={(e) => setTollFreePrefix(e.target.value as TollFreePrefix)}
              >
                {TOLL_FREE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-[12px] font-semibold text-[#374151]">Business Categories</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {BUSINESS_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = searchState.industry === cat.industry;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onBusinessCategoryPick(cat.industry)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[10px] font-semibold transition",
                      active
                        ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]"
                        : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-center leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showAdvancedFilters ? (
            <div className="mt-4 space-y-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
              <p className="text-[12px] font-semibold text-[#374151]">Advanced filters</p>
              <Input
                value={numberMask}
                onChange={(e) => setNumberMask(e.target.value)}
                placeholder="Number mask e.g. 555-GET-HELP"
                className="h-10 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
              />
              <div className="flex flex-wrap gap-2">
                {SEARCH_PREFS.map((pref) => {
                  const Icon = pref.icon;
                  const active = searchPrefs.includes(pref.id);
                  return (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() => toggleSearchPref(pref.id)}
                      className={cn(
                        "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold",
                        active
                          ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]"
                          : "border-[#e5e7eb] bg-white text-[#6b7280]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {pref.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#4f46e5]"
                onClick={onSuggestKeywords}
                disabled={suggestingKeywords}
              >
                <Wand2 className="h-3.5 w-3.5" />
                {suggestingKeywords ? "Suggesting…" : "Suggest keywords"}
              </button>
              {suggestError ? <p className="text-[11px] text-red-600">{suggestError}</p> : null}
            </div>
          ) : null}

          <Button
            onClick={onSearch}
            disabled={loading || !canSearch}
            className="mt-5 h-12 w-full rounded-lg text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] hover:opacity-95"
            style={{ backgroundColor: PRIMARY }}
          >
            {loading ? "Searching…" : "Start Search"}
          </Button>
        </div>

        {/* Center — AI Concierge (desktop) */}
        <div className="hidden xl:block min-h-[480px]">
          <FindNumberAiPanel
            sessionId={ai.sessionId}
            messages={ai.messages}
            understandingChips={ai.understandingChips}
            loading={ai.loading}
            loadingStage={ai.loadingStage}
            suggestedActions={ai.suggestedActions}
            onSend={(msg, quick) => ai.sendAiMessage(msg, quick)}
            onQuickAction={(action) => ai.sendAiMessage(action, action)}
            onClear={fullReset}
            onRemoveChip={ai.removeChip}
            variant="mockup"
          />
        </div>

        {/* Right — info cards */}
        <div className="hidden space-y-4 xl:block">
          <MockupSearchSummaryCard
            areaCodes={parsedAreaCodes}
            basketCount={basketCount}
            resultCount={searchResponse ? resultCount : 0}
            isActive={Boolean(searchResponse) || loading}
          />
          <MockupSearchImpactCard />
          <MockupNewFeaturesCard />
          <MockupWhyCard />
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={cn(
                "font-medium",
                showAdvancedFilters ? "text-[#4f46e5]" : "text-[#374151] hover:text-[#4f46e5]",
              )}
              onClick={() => setShowAdvancedFilters((v) => !v)}
            >
              Show filters
            </button>
            <button
              type="button"
              className={cn(
                "font-medium",
                showSelectedOnly ? "text-[#4f46e5]" : "text-[#374151] hover:text-[#4f46e5]",
              )}
              onClick={() => setShowSelectedOnly((v) => !v)}
            >
              Show Selected Only
            </button>
            <button type="button" className="font-medium text-[#374151] hover:text-[#4f46e5]">
              Export results to .csv
            </button>
          </div>
        </div>

        {searchResponse && searchDurationSec != null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3 text-[13px]">
            <span className="flex items-center gap-2 font-medium text-[#047857]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {searchResponse.inventoryScannedCount ?? resultCount} numbers scanned • Search
              completed in {searchDurationSec} sec
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-semibold text-[#4f46e5]"
              onClick={fullReset}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New Search
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {reserveError ? <p className="text-sm text-red-600">{reserveError}</p> : null}
        {ai.error ? <p className="text-sm text-red-600">{ai.error}</p> : null}
        {searchingMore ? (
          <p className="text-[13px] text-[#6b7280]">Still searching for more numbers…</p>
        ) : null}

        {success ? <PremiumSuccessPanel state={success} onClose={() => setSuccess(null)} /> : null}

        {searchResponse && !success && displayedBest.length > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-bold text-[#111827]">Best Matches</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12px] font-medium text-[#374151]"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="default">Relevance</option>
                  <option value="score">Highest Score</option>
                  <option value="price">Lowest Price</option>
                </select>
                <div className="inline-flex rounded-lg border border-[#e5e7eb] p-0.5">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md p-1.5",
                      viewMode === "grid" ? "bg-[#eef2ff] text-[#4f46e5]" : "text-[#9ca3af]",
                    )}
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md p-1.5",
                      viewMode === "list" ? "bg-[#eef2ff] text-[#4f46e5]" : "text-[#9ca3af]",
                    )}
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={cn(
                viewMode === "grid"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "space-y-3",
              )}
            >
              {displayedBest.slice(0, 3).map((result) => (
                <FindNumberCard
                  key={result.phoneNumber}
                  result={result}
                  areaCode={parsedAreaCodes[0]}
                  loading={reserving === result.phoneNumber}
                  inBasket={favorites.has(result.phoneNumber)}
                  onToggleBasket={() => {
                    toggleFavorite(result.phoneNumber);
                    if (aiEngaged) {
                      trackFindNumberAiEvent("number_saved_from_ai", {
                        phone: result.phoneNumber,
                      });
                    }
                  }}
                  onGetNumber={() => onGetNumber(result)}
                  onAskAi={() => onAskAiAboutNumber(result)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {searchResponse && !success && displayedMore.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-[16px] font-bold text-[#111827]">More Great Matches</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {displayedMore.slice(0, 12).map((result) => (
                <MoreGreatMatchChip
                  key={result.phoneNumber}
                  result={result}
                  loading={reserving === result.phoneNumber}
                  onGetNumber={() => onGetNumber(result)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {searchResponse && !success && displayedBest.length === 0 ? (
          <div className={cn(pm.card, "border-dashed p-6 text-center")}>
            <p className="text-[15px] font-semibold text-[#111827]">No matches in this search</p>
            <p className="mt-1 text-[13px] text-[#6b7280]">
              Try another area code, category, or ask AI for alternatives.
            </p>
          </div>
        ) : null}
      </div>


      {checkout && !success ? (
        <PremiumCheckoutModal
          state={checkout}
          workspaceId={workspaceId}
          onClose={() => setCheckout(null)}
          onComplete={(result) => {
            if (aiEngaged) {
              trackFindNumberAiEvent("number_purchased_from_ai", {
                phone: checkout.phoneNumber,
              });
            }
            setSuccess({ ...checkout, ...result });
            setCheckout(null);
          }}
        />
      ) : null}

      {/* Mobile AI drawer */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-white shadow-lg lg:hidden"
        style={{ backgroundColor: PRIMARY }}
        onClick={() => {
          setMobileAiOpen(true);
          trackFindNumberAiEvent("ai_search_opened");
        }}
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </button>

      {mobileAiOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileAiOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 top-[12%] flex flex-col rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <span className="text-[14px] font-semibold text-[#111827]">Your AI Concierge</span>
              <button
                type="button"
                onClick={() => setMobileAiOpen(false)}
                className="rounded-lg p-1 hover:bg-[#f3f4f6]"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-[#6b7280]" />
              </button>
            </div>
            {ai.understandingChips.length > 0 ? (
              <div className="border-b border-[#f3f4f6] px-4 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {ai.understandingChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4338ca]"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <FindNumberAiPanel
              sessionId={ai.sessionId}
              messages={ai.messages}
              understandingChips={[]}
              loading={ai.loading}
              loadingStage={ai.loadingStage}
              suggestedActions={ai.suggestedActions}
              onSend={(msg, quick) => ai.sendAiMessage(msg, quick)}
              onQuickAction={(action) => ai.sendAiMessage(action, action)}
              onClear={fullReset}
              onRemoveChip={ai.removeChip}
              variant="mockup"
              className="flex-1 rounded-none border-0 shadow-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FindNumberCard({
  result,
  areaCode,
  loading,
  inBasket,
  onToggleBasket,
  onGetNumber,
  onAskAi,
}: {
  result: PremiumNumberProductResult;
  areaCode?: string;
  loading: boolean;
  inBasket: boolean;
  onToggleBasket: () => void;
  onGetNumber: () => void;
  onAskAi?: () => void;
}) {
  const displayPhone = result.displayNumber;
  const location =
    AREA_CODE_LOCATIONS[areaCode ?? result.phoneNumber.slice(2, 5)] ?? "United States";
  const starCount = Math.min(5, Math.max(1, Math.round(result.numberQualityScore / 20)));
  const monthlyCents = DISPLAY_MONTHLY_CENTS;
  const setupCents = result.premiumPriceCents;

  return (
    <div className={cn(pm.card, "flex flex-col p-5 transition hover:shadow-md")}>
      <div className="flex flex-wrap gap-2">
        {result.numberQualityScore >= 85 ? (
          <span className="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4f46e5]">
            Top Search
          </span>
        ) : null}
        {result.businessMatchScore >= 70 ? (
          <span className="rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#059669]">
            High conversion
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[22px] font-bold leading-tight text-[#111827]">{displayPhone}</p>
      <p className="mt-0.5 text-[13px] text-[#6b7280]">{location}</p>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-3.5 w-3.5",
                i < starCount ? "fill-amber-400 text-amber-400" : "text-[#e5e7eb]",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 text-[#9ca3af]">
          <Mic className="h-3.5 w-3.5" />
          <MessageSquare className="h-3.5 w-3.5" />
          <MessageCircle className="h-3.5 w-3.5" />
        </div>
      </div>

      <p className="mt-4 text-[14px] font-semibold text-[#111827]">
        {formatMonthlyDisplay(monthlyCents)} Monthly
        <span className="text-[#6b7280] font-medium">
          {" "}
          / {formatPremiumPrice(setupCents)} Set-up
        </span>
      </p>

      <Button
        className="mt-4 h-11 w-full rounded-lg text-[14px] font-semibold text-white hover:opacity-95"
        style={{ backgroundColor: PRIMARY }}
        disabled={loading}
        onClick={onGetNumber}
      >
        {loading ? "Reserving…" : "Add To Basket"}
      </Button>

      <div className="mt-3 flex items-center justify-between text-[12px]">
        <button
          type="button"
          className="font-semibold text-[#4f46e5] hover:underline"
          onClick={onAskAi}
        >
          View details
        </button>
        <button
          type="button"
          className="font-semibold text-[#4f46e5] hover:underline"
          onClick={onGetNumber}
        >
          Quick Buy
        </button>
        <button
          type="button"
          onClick={onToggleBasket}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border",
            inBasket ? "border-rose-200 bg-rose-50 text-rose-500" : "border-[#e5e7eb] text-[#9ca3af]",
          )}
          aria-label="Add to basket"
        >
          <Heart className={cn("h-4 w-4", inBasket && "fill-current")} />
        </button>
      </div>
    </div>
  );
}

function MoreGreatMatchChip({
  result,
  loading,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  loading: boolean;
  onGetNumber: () => void;
}) {
  const label = result.vanityDisplay ?? result.displayNumber;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onGetNumber}
      className={cn(
        pm.card,
        "flex shrink-0 flex-col items-start gap-1 px-4 py-3 text-left transition hover:border-[#c7d2fe] min-w-[160px]",
      )}
    >
      <span className="text-[13px] font-bold text-[#111827]">{label}</span>
      <span className="text-[12px] font-semibold text-[#4f46e5]">
        {formatMonthlyDisplay(DISPLAY_MONTHLY_CENTS)} / mo
      </span>
    </button>
  );
}

function MockupSearchSummaryCard({
  areaCodes,
  basketCount,
  resultCount,
  isActive,
}: {
  areaCodes: string[];
  basketCount: number;
  resultCount: number;
  isActive: boolean;
}) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Search Summary</h3>
      <dl className="mt-3 space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Area Code</dt>
          <dd className="font-medium text-[#111827]">{areaCodes.join(", ") || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Country</dt>
          <dd className="font-medium text-[#111827]">America</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Search Status</dt>
          <dd className="font-medium text-[#059669]">{isActive ? "Active" : "Idle"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Selected Count</dt>
          <dd className="font-medium text-[#111827]">{basketCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">New Count</dt>
          <dd className="font-medium text-[#111827]">{resultCount} Numbers</dd>
        </div>
      </dl>
    </div>
  );
}

function MockupSearchImpactCard() {
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Search Impact</h3>
      <dl className="mt-3 space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Search Volume</dt>
          <dd className="font-medium text-[#111827]">0</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Competition</dt>
          <dd className="font-medium text-[#059669]">Low</dd>
        </div>
      </dl>
    </div>
  );
}

function MockupNewFeaturesCard() {
  const items = ["Bulk Buy", "AI Filtering", "Toll-Free"];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">New Features</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[12px] font-medium text-[#4f46e5]">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MockupWhyCard() {
  const items = [
    "Advanced number search tools",
    "Instant activation",
    "No hidden fees",
    "24/7 support",
  ];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Why choose us?</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[12px] text-[#374151]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#4f46e5]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
