"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
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
import type { NumberSearchState } from "@/lib/premium-numbers/ai-number-search/types";
import { trackFindNumberAiEvent } from "@/lib/premium-numbers/find-number-analytics";
import { runPremiumNumberSearch } from "@/lib/premium-numbers/find-number-client-search";
import {
  buildPremiumSearchBody,
  filterResultsByMaxPrice,
} from "@/lib/premium-numbers/find-number-search-bridge";
import { cn } from "@/lib/utils";
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe,
  Grid3x3,
  LayoutList,
  Lightbulb,
  ListOrdered,
  Phone,
  Sparkles,
  Users,
  Wand2,
  X,
} from "lucide-react";
import {
  WIREFRAME_FIND_NUMBER_BEST,
  WIREFRAME_FIND_NUMBER_MORE,
  WIREFRAME_FIND_NUMBER_RECENT,
  WIREFRAME_FIND_NUMBER_SUMMARY,
} from "@/lib/workspace/personal-mockup-wireframe";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const QUICK_SEARCH_CHIPS = [
  { label: "407", kind: "area" as const, value: "407" },
  { label: "321", kind: "area" as const, value: "321" },
  { label: "888", kind: "area" as const, value: "888" },
  { label: "800", kind: "area" as const, value: "800" },
  { label: "Florida", kind: "region" as const, value: "florida" },
  { label: "Orlando", kind: "region" as const, value: "orlando" },
  { label: "727", kind: "area" as const, value: "727" },
  { label: "813", kind: "area" as const, value: "813" },
  { label: "404", kind: "area" as const, value: "404" },
  { label: "Miami", kind: "region" as const, value: "miami" },
  { label: "Tampa", kind: "region" as const, value: "tampa" },
  { label: "Atlanta", kind: "region" as const, value: "atlanta" },
];

const REGION_AREA_CODES: Record<string, string[]> = {
  florida: ["407", "321", "305", "727", "813"],
  orlando: ["407", "321"],
  miami: ["305", "786"],
  tampa: ["813", "727"],
  atlanta: ["404", "678"],
};

const CAPABILITY_OPTIONS = [
  { id: "Voice", label: "Voice" },
  { id: "SMS", label: "Two-Way SMS" },
  { id: "MMS", label: "MMS" },
  { id: "Multi-Channel", label: "Multi-Channel" },
  { id: "Global Reach", label: "Global Reach" },
  { id: "Programmable", label: "Programmable" },
] as const;

const DISPLAY_MONTHLY_CENTS = 125;

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

const SERVICE_TAGS = ["Voice", "SMS", "MMS"] as const;

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

function wireframeToResult(
  item: {
    displayNumber: string;
    phoneNumber: string;
    monthlyCents: number;
    bullets?: string[];
  },
): PremiumNumberProductResult {
  const bullets = item.bullets ?? [];
  return {
    resultId: item.phoneNumber,
    phoneNumber: item.phoneNumber,
    displayNumber: item.displayNumber,
    businessMatchScore: 85,
    numberQualityScore: 85,
    commercialSemanticScore: 0,
    businessMatchLabel: "Strong Match",
    memorabilityLabel: "Memorable",
    premiumPriceCents: item.monthlyCents,
    premiumPriceBand: "nice",
    headlineLabel: "Match",
    cardBullets: bullets,
    tags: [],
    whyReasons: bullets,
    matchedWords: [],
    patterns: [],
    providerPremium: false,
    provider: "telnyx",
    availabilityStatus: "available",
    listSection: "top_pick",
  };
}

function formatMonthlyDisplay(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function resultMonthlyCents(result: PremiumNumberProductResult, wireframe: boolean): number {
  if (wireframe && result.premiumPriceCents > 0) return result.premiumPriceCents;
  return DISPLAY_MONTHLY_CENTS;
}

export function PersonalFindNumberClient({ workspaceId }: { workspaceId: string }) {
  const [searchState, setSearchState] = useState<NumberSearchState>(() =>
    applySearchStatePatch(createDefaultNumberSearchState(), {
      countryProvince: "United States",
      serviceTags: ["Voice", "SMS", "MMS"],
    }),
  );
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [selectedForAi, setSelectedForAi] = useState<string | null>(null);
  const [extraCapabilities, setExtraCapabilities] = useState<Set<string>>(
    new Set(["Multi-Channel", "Global Reach", "Programmable"]),
  );
  const [recentSearches, setRecentSearches] = useState<
    Array<{ label: string; count: number; date: string }>
  >(WIREFRAME_FIND_NUMBER_RECENT);
  const pendingRecentLabelRef = useRef<string | null>(null);
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
    numberType === "tollfree" ||
    parsedAreaCodes.length > 0 ||
    numberMask.replace(/\D/g, "").length >= 3 ||
    numberMask.replace(/[^A-Za-z]/g, "").length >= 3;

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
    const label =
      numberMask.trim() ||
      (parsedAreaCodes.length ? parsedAreaCodes.join(", ") : "Toll-free search");
    pendingRecentLabelRef.current = label;
    await runSearchFromState(searchState);
  }

  useEffect(() => {
    const label = pendingRecentLabelRef.current;
    if (!label || !searchResponse) return;
    pendingRecentLabelRef.current = null;
    setRecentSearches((prev) =>
      [
        {
          label,
          count: searchResponse.resultCount ?? 0,
          date: new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" }),
        },
        ...prev.filter((p) => p.label !== label),
      ].slice(0, 5),
    );
  }, [searchResponse]);

  function toggleCapability(label: string) {
    if (label === "Voice" || label === "SMS" || label === "MMS") {
      toggleServiceTag(label);
      return;
    }
    setExtraCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isCapabilityActive(label: string) {
    if (label === "Voice" || label === "SMS" || label === "MMS") {
      return serviceTags.has(label);
    }
    return extraCapabilities.has(label);
  }

  function onQuickChip(chip: typeof QUICK_SEARCH_CHIPS[number]) {
    if (chip.kind === "area") {
      toggleQuickAreaCode(chip.value);
      if (chip.value === "888" || chip.value === "800") {
        setNumberType("tollfree");
      }
      return;
    }
    const codes = REGION_AREA_CODES[chip.value] ?? [];
    patchSearch({
      areaCodes: [...new Set([...searchState.areaCodes, ...codes])],
      industry: chip.value,
      intent: "business",
      apiIntent: "business_keyword",
    });
  }

  function openAiConcierge() {
    setAiDrawerOpen(true);
    trackFindNumberAiEvent("ai_search_opened");
    ai.openAiMode();
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
  const isWireframePreview = !searchResponse && !loading && !success;

  const wireframeBest = useMemo(
    () => WIREFRAME_FIND_NUMBER_BEST.map((item) => wireframeToResult(item)),
    [],
  );
  const wireframeMore = useMemo(
    () => WIREFRAME_FIND_NUMBER_MORE.map((item) => wireframeToResult(item)),
    [],
  );

  const displayedBest = isWireframePreview ? wireframeBest : bestMatches;
  const displayedMore = isWireframePreview ? wireframeMore : moreMatches;

  async function onGetNumber(result: PremiumNumberProductResult) {
    if (isWireframePreview) {
      toggleFavorite(result.phoneNumber);
      return;
    }
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

  function onBuyNow(result: PremiumNumberProductResult) {
    if (isWireframePreview) {
      toggleFavorite(result.phoneNumber);
      return;
    }
    onGetNumber(result);
  }

  function fullReset() {
    resetSearch();
    setSearchState(resetNumberSearchState());
    patchSearch({ serviceTags: ["Voice", "SMS", "MMS"] });
    ai.clearAiSession();
  }

  const priceRange = useMemo(() => {
    if (isWireframePreview) {
      return {
        min: WIREFRAME_FIND_NUMBER_SUMMARY.priceMinCents,
        max: WIREFRAME_FIND_NUMBER_SUMMARY.priceMaxCents,
      };
    }
    if (!allResults.length) return null;
    const prices = allResults.map((r) => resultMonthlyCents(r, false));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [allResults, isWireframePreview]);

  const summaryResultCount = searchResponse
    ? resultCount
    : isWireframePreview
      ? WIREFRAME_FIND_NUMBER_SUMMARY.numbersFound
      : 0;

  const totalMonthlyCents = basketCount * DISPLAY_MONTHLY_CENTS;

  const capabilitySummary = [
    ...[...serviceTags].filter((t) => ["Voice", "SMS", "MMS"].includes(t)),
    ...[...extraCapabilities],
  ].join(", ");

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">Find a Number</h1>
          <p className="mt-1 text-[14px] text-[#6b7280]">
            Search through millions of available phone numbers and choose one that fits your
            brand or business needs.
          </p>
        </header>

        <div className={cn(pm.card, "p-5 md:p-6 space-y-5")}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px]">
              <select
                className="h-10 w-full appearance-none rounded-lg border border-[#e5e7eb] bg-white pl-10 pr-8 text-[14px] text-[#111827]"
                value={countryProvince}
                onChange={(e) => setCountryProvince(e.target.value)}
              >
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
              </select>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px]">🇺🇸</span>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            </div>
            <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
              <button
                type="button"
                onClick={() => setNumberType("local")}
                className={cn(
                  "rounded-md px-4 py-2 text-[13px] font-semibold transition",
                  numberType === "local"
                    ? "bg-[#4f46e5] text-white shadow-sm"
                    : "text-[#6b7280] hover:text-[#111827]",
                )}
              >
                Local Numbers
              </button>
              <button
                type="button"
                onClick={() => setNumberType("tollfree")}
                className={cn(
                  "rounded-md px-4 py-2 text-[13px] font-semibold transition",
                  numberType === "tollfree"
                    ? "bg-[#4f46e5] text-white shadow-sm"
                    : "text-[#6b7280] hover:text-[#111827]",
                )}
              >
                Toll-Free Numbers
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-semibold text-[#374151]">
              What do you want your number to look like?
            </label>
            <textarea
              value={numberMask}
              onChange={(e) => setNumberMask(e.target.value)}
              rows={3}
              placeholder="888, TAXI, 1234…"
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-[14px] outline-none focus:border-[#6366f1]"
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
              Find numbers that start with, end with, or contain certain characters or digits.
              E.g. &quot;888&quot;, &quot;TAXI&quot;, &quot;1234&quot;. Minimum length is 3 digits.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => onQuickChip(chip)}
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[12px] font-semibold text-[#374151] hover:border-[#c7d2fe] hover:bg-[#eef2ff]"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#374151]">Number Capabilities</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CAPABILITY_OPTIONS.map((cap) => (
                <label key={cap.id} className="inline-flex items-center gap-2 text-[13px] text-[#374151]">
                  <input
                    type="checkbox"
                    checked={isCapabilityActive(cap.label)}
                    onChange={() => toggleCapability(cap.label)}
                    className="h-4 w-4 rounded border-[#d1d5db] text-[#4f46e5]"
                  />
                  {cap.label}
                </label>
              ))}
            </div>
          </div>

          {showAdvanced ? (
            <div className="space-y-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
              <p className="text-[12px] font-semibold text-[#374151]">Search filters</p>
              {numberType === "local" ? (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#6b7280]">
                    Area codes
                  </label>
                  <Input
                    value={areaCodesInput}
                    onChange={(e) => setAreaCodesInput(e.target.value)}
                    placeholder="407, 321, 813"
                    className="h-10 text-[14px]"
                  />
                </div>
              ) : null}
              {numberType === "tollfree" ? (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#6b7280]">
                    Toll-free prefix
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
                    value={tollFreePrefix}
                    onChange={(e) => setTollFreePrefix(e.target.value as TollFreePrefix)}
                  >
                    {TOLL_FREE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#6b7280]">
                  Match pattern
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as SearchType)}
                >
                  <option value="contains">Contains</option>
                  <option value="starts_with">Starts with</option>
                  <option value="ends_with">Ends with</option>
                </select>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-medium text-[#6b7280]">Search preferences</p>
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
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                          active
                            ? "border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]"
                            : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {pref.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#6b7280]">
                  Keyword hints
                </label>
                <Input
                  value={suggestedKeywords}
                  onChange={(e) => setSuggestedKeywords(e.target.value)}
                  placeholder="TAXI, HOME, LAW"
                  className="h-10 text-[14px]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[12px]"
                    disabled={suggestingKeywords}
                    onClick={onSuggestKeywords}
                  >
                    <Wand2 className="mr-1 h-3.5 w-3.5" />
                    {suggestingKeywords ? "Suggesting…" : "Suggest keywords"}
                  </Button>
                  {suggestError ? (
                    <span className="text-[12px] text-red-600">{suggestError}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-center pt-2">
            <Button
              onClick={onSearch}
              disabled={loading || !canSearch}
              className="h-12 min-w-[280px] rounded-lg px-8 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] hover:opacity-95"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? "Searching…" : "Search for Numbers"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {reserveError ? <p className="text-sm text-red-600">{reserveError}</p> : null}
        {ai.error ? <p className="text-sm text-red-600">{ai.error}</p> : null}
        {searchingMore ? (
          <p className="text-[13px] text-[#6b7280]">Still searching for more numbers…</p>
        ) : null}

        {success ? <PremiumSuccessPanel state={success} onClose={() => setSuccess(null)} /> : null}

        {(searchResponse || isWireframePreview) && !success && displayedBest.length > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-bold text-[#111827]">Best Matches</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[#6b7280]">Sort By:</span>
                <select
                  className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12px] font-medium text-[#374151]"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="default">Best Match</option>
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
                  ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                  : "space-y-3",
              )}
            >
              {displayedBest.slice(0, 3).map((result) => (
                <FindNumberCard
                  key={result.phoneNumber}
                  result={result}
                  monthlyCents={resultMonthlyCents(result, isWireframePreview)}
                  loading={reserving === result.phoneNumber}
                  inBasket={favorites.has(result.phoneNumber)}
                  onGetNumber={() => onGetNumber(result)}
                  onBuyNow={() => onBuyNow(result)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {(searchResponse || isWireframePreview) && !success && displayedMore.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-[16px] font-bold text-[#111827]">More Great Matches</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {displayedMore.slice(0, 12).map((result) => (
                <MoreGreatMatchChip
                  key={result.phoneNumber}
                  result={result}
                  monthlyCents={resultMonthlyCents(result, isWireframePreview)}
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
              Try different digits, a city chip, or chat with a specialist for help.
            </p>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4">
        <TipsForFindNumbersCard onChat={openAiConcierge} />
        <TransovoSearchSummaryCard
          priceRange={priceRange}
          resultCount={summaryResultCount}
          capabilities={capabilitySummary}
          basketCount={basketCount}
          totalMonthlyCents={totalMonthlyCents}
          onViewFilters={() => setShowAdvanced((v) => !v)}
        />
        <RecentSearchCard
          items={recentSearches}
          onClear={() => setRecentSearches([])}
        />
        <TopBrandsCard />
        <WhyTransovoCard />
      </aside>
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

      {aiDrawerOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setAiDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <span className="text-[14px] font-semibold text-[#111827]">Your AI Concierge</span>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(false)}
                className="rounded-lg p-1 hover:bg-[#f3f4f6]"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-[#6b7280]" />
              </button>
            </div>
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
              className="flex-1 rounded-none border-0 shadow-none"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function FindNumberCard({
  result,
  monthlyCents,
  loading,
  inBasket,
  onGetNumber,
  onBuyNow,
}: {
  result: PremiumNumberProductResult;
  monthlyCents: number;
  loading: boolean;
  inBasket: boolean;
  onGetNumber: () => void;
  onBuyNow: () => void;
}) {
  const displayPhone = result.displayNumber;
  const bullets = result.cardBullets.length
    ? result.cardBullets.slice(0, 3)
    : result.whyReasons.slice(0, 3);

  return (
    <div className={cn(pm.card, "flex flex-col p-5 transition hover:shadow-md")}>
      <p className="text-[20px] font-bold leading-tight text-[#111827]">{displayPhone}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["Voice", "SMS", "MMS"] as const).map((cap) => (
          <span
            key={cap}
            className="inline-flex items-center gap-1 rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]"
          >
            <Check className="h-3 w-3" />
            {cap}
          </span>
        ))}
      </div>

      {bullets.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[12px] text-[#6b7280]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-[15px] font-bold text-[#111827]">
        {formatMonthlyDisplay(monthlyCents)}
        <span className="text-[13px] font-medium text-[#6b7280]"> / month</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          className="h-10 rounded-lg text-[13px] font-semibold text-white hover:opacity-95"
          style={{ backgroundColor: PRIMARY }}
          disabled={loading}
          onClick={onGetNumber}
        >
          {loading ? "…" : inBasket ? "In Basket" : "Add to Basket"}
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-lg border-[#4f46e5] text-[13px] font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
          disabled={loading}
          onClick={onBuyNow}
        >
          Buy Now
        </Button>
      </div>
    </div>
  );
}

function MoreGreatMatchChip({
  result,
  monthlyCents,
  loading,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  monthlyCents: number;
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
        {formatMonthlyDisplay(monthlyCents)} / mo
      </span>
    </button>
  );
}

function TipsForFindNumbersCard({ onChat }: { onChat: () => void }) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Tips for Find Numbers</h3>
      <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-[#6b7280]">
        <p className="flex gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#4f46e5]" />
          Vanity numbers with repeating digits are easier for customers to remember and share.
        </p>
        <p className="flex gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#4f46e5]" />
          Local area codes build trust — match your primary market when possible.
        </p>
      </div>
      <button
        type="button"
        onClick={onChat}
        className="mt-4 w-full rounded-lg border border-[#4f46e5] px-4 py-2.5 text-[13px] font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
      >
        Chat with a specialist for help
      </button>
    </div>
  );
}

function TransovoSearchSummaryCard({
  priceRange,
  resultCount,
  capabilities,
  basketCount,
  totalMonthlyCents,
  onViewFilters,
}: {
  priceRange: { min: number; max: number } | null;
  resultCount: number;
  capabilities: string;
  basketCount: number;
  totalMonthlyCents: number;
  onViewFilters: () => void;
}) {
  const priceLabel = priceRange
    ? `${formatMonthlyDisplay(priceRange.min)} - ${formatMonthlyDisplay(priceRange.max)}`
    : "—";

  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Search Summary</h3>
      <dl className="mt-3 space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Price Range</dt>
          <dd className="font-medium text-[#111827]">{priceLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Numbers Found</dt>
          <dd className="font-medium text-[#111827]">{resultCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Capabilities</dt>
          <dd className="font-medium text-[#111827] text-right">{capabilities || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Selected</dt>
          <dd className="font-medium text-[#111827]">{basketCount}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Total Monthly</dt>
          <dd className="font-medium text-[#111827]">{formatMonthlyDisplay(totalMonthlyCents)}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onViewFilters}
        className="mt-3 text-[12px] font-semibold text-[#4f46e5] hover:underline"
      >
        View Search Filters
      </button>
    </div>
  );
}

function RecentSearchCard({
  items,
  onClear,
}: {
  items: Array<{ label: string; count: number; date: string }>;
  onClear: () => void;
}) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Recent Search</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-[#6b7280]">No recent searches yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.label} className="text-[12px]">
              <span className="font-semibold text-[#111827]">{item.label}</span>
              <span className="text-[#6b7280]">
                {" "}
                · {item.count} numbers · {item.date}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-[12px] font-semibold text-[#4f46e5] hover:underline"
      >
        Clear recent searches
      </button>
    </div>
  );
}

function TopBrandsCard() {
  const brands = [
    { name: "Amazon", className: "text-[#ff9900] font-bold italic" },
    { name: "Meta", className: "text-[#0866ff] font-bold" },
    { name: "Google", className: "font-bold text-[#4285f4]" },
    { name: "Uber", className: "font-bold text-[#111827]" },
    { name: "Verizon", className: "font-bold text-[#cd040b]" },
    { name: "Microsoft", className: "font-bold text-[#737373]" },
  ];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Top Brands</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {brands.map((brand) => (
          <div
            key={brand.name}
            className="flex h-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] text-[10px]"
          >
            <span className={brand.className}>{brand.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhyTransovoCard() {
  const items = [
    "25+ years of experience",
    "Trusted by Fortune 500",
    "No Hidden Fees",
    "Best Support Team",
  ];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Why TransOvo?</h3>
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
