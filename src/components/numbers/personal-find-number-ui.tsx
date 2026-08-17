"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import { buildVanityDisplay } from "@/lib/premium-numbers/vanity-display";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import {
  TOLL_FREE_AREA_CODES,
  parseAreaCodesInput,
  type NumberType,
  type TollFreePrefix,
} from "@/lib/premium-numbers/toll-free";
import { cn } from "@/lib/utils";
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Globe,
  Grid3x3,
  Heart,
  LayoutList,
  ListOrdered,
  MapPin,
  Phone,
  RefreshCw,
  Share2,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  PremiumCheckoutModal,
  PremiumSuccessPanel,
  type PremiumCheckoutState,
} from "./premium-number-checkout";

const TOLL_FREE_OPTIONS: { value: TollFreePrefix; label: string }[] = [
  { value: "all", label: "All toll-free (800, 833, 866, …)" },
  ...TOLL_FREE_AREA_CODES.map((code) => ({ value: code as TollFreePrefix, label: code })),
];

const PRIMARY = "#4338ca";
const DISPLAY_MONTHLY_CENTS = 1500;

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
  const [numberType, setNumberType] = useState<NumberType>("local");
  const [areaCodesInput, setAreaCodesInput] = useState("");
  const [tollFreePrefix, setTollFreePrefix] = useState<TollFreePrefix>("all");
  const [searchType, setSearchType] = useState<SearchType>("contains");
  const [countryProvince, setCountryProvince] = useState("Vermont");
  const [serviceTags, setServiceTags] = useState<Set<string>>(
    new Set(["SMS", "MMS", "Voice", "Fax"]),
  );
  const [numberMask, setNumberMask] = useState("");
  const [searchPrefs, setSearchPrefs] = useState<SearchPrefId[]>(["direct_dial", "vanity"]);
  const [suggestedKeywords, setSuggestedKeywords] = useState("");
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"default" | "price" | "score">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const parsedAreaCodes = useMemo(() => parseAreaCodesInput(areaCodesInput), [areaCodesInput]);
  const keywordTags = useMemo(() => splitKeywordInput(suggestedKeywords), [suggestedKeywords]);

  const apiIntent: SearchIntent = useMemo(() => {
    if (searchType === "ends_with" || searchPrefs.includes("sequential")) {
      return "number_pattern";
    }
    if (
      searchPrefs.includes("vanity") ||
      searchType === "contains" ||
      searchType === "starts_with"
    ) {
      return "business_keyword";
    }
    return "surprise_me";
  }, [searchType, searchPrefs]);

  const industryForSearch = useMemo(
    () => deriveIndustry(numberMask, keywordTags),
    [numberMask, keywordTags],
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
        setSuggestedKeywords(data.keywords.join(", "));
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
  }

  function toggleServiceTag(tag: string) {
    setServiceTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function toggleSearchPref(id: SearchPrefId) {
    setSearchPrefs((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function onSearch() {
    setLoading(true);
    setSearchingMore(false);
    setError("");
    setSearchResponse(null);
    setSuccess(null);
    setSearchDurationSec(null);
    setSearchCompletedAt(null);
    const started = performance.now();

    const maskKeywords = maskToKeywords(numberMask);
    const extraFromMask = splitKeywordInput(numberMask.replace(/[A-Za-z-]/g, " ").trim());
    const allExtra = [...new Set([...maskKeywords, ...splitKeywordInput(numberMask), ...extraFromMask])];

    const body =
      apiIntent === "business_keyword"
        ? {
            workspaceId,
            mode: "business" as const,
            numberType,
            areaCodes: parsedAreaCodes,
            tollFreePrefix: numberType === "tollfree" ? tollFreePrefix : undefined,
            industry: industryForSearch,
            suggestedKeywords: keywordTags.length ? keywordTags : maskKeywords,
            extraKeywords: allExtra,
          }
        : apiIntent === "surprise_me"
          ? {
              workspaceId,
              mode: "personal" as const,
              areaCodes: parsedAreaCodes,
              preferences: ["surprise_me"] as PersonalPreference[],
            }
          : {
              workspaceId,
              mode: "personal" as const,
              areaCodes: parsedAreaCodes,
              preferences: toApiPreferences(searchPrefs, searchType),
            };

    try {
      const res = await fetch("/api/numbers/premium/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Search failed");
      }

      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let gotFirst = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line) as {
              type: string;
              data?: PremiumSearchProductResponse;
              error?: string;
            };
            if (msg.type === "error") throw new Error(msg.error || "Search failed");
            if (!msg.data) continue;

            setSearchResponse(msg.data);
            setSearchingMore(msg.data.searchStatus === "searching");

            if (!gotFirst) {
              gotFirst = true;
              setLoading(false);
            }
            if (msg.type === "complete" || msg.data.searchStatus === "complete") {
              setSearchingMore(false);
              setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
              setSearchCompletedAt(new Date());
            }
          }
        }

        if (!gotFirst) {
          setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
          setSearchCompletedAt(new Date());
        }
      } else {
        const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
        setSearchResponse(data);
        setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
        setSearchCompletedAt(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setSearchingMore(false);
    }
  }

  async function onGetNumber(result: PremiumNumberProductResult) {
    if (!searchResponse?.searchLogId) return;
    const searchMode = apiIntent === "business_keyword" ? "business" : "personal";
    setReserving(result.phoneNumber);
    setReserveError("");
    try {
      const res = await fetch("/api/numbers/premium/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          phoneNumber: result.phoneNumber,
          searchLogId: searchResponse.searchLogId,
          searchMode,
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
  const bestScore = bestMatches[0]?.numberQualityScore ?? 0;

  const searchTypeLabel =
    searchType === "contains"
      ? "Contains"
      : searchType === "starts_with"
        ? "Starts With"
        : "Ends With";

  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <header>
            <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">Find a Number</h1>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              Search and select numbers from various countries for your business needs.
            </p>
          </header>

          <div className={cn(pm.card, "p-5 md:p-6")}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Number Type</p>
                <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
                  <TypeToggle active={numberType === "local"} onClick={() => setNumberType("local")}>
                    {numberType === "local" ? <Check className="h-3.5 w-3.5" /> : null}
                    Local
                  </TypeToggle>
                  <TypeToggle
                    active={numberType === "tollfree"}
                    onClick={() => setNumberType("tollfree")}
                  >
                    Toll Free
                  </TypeToggle>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Area Code</p>
                <Input
                  value={areaCodesInput}
                  onChange={(e) =>
                    setAreaCodesInput(e.target.value.replace(/[^\d,\s]/g, ""))
                  }
                  placeholder="551"
                  className="h-10 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                />
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Search Type</p>
                <div className="inline-flex flex-wrap rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
                  {(
                    [
                      ["contains", "Contains Pattern"],
                      ["starts_with", "Starts With"],
                      ["ends_with", "Ends With"],
                    ] as const
                  ).map(([id, label]) => (
                    <TypeToggle
                      key={id}
                      active={searchType === id}
                      onClick={() => setSearchType(id)}
                    >
                      {label}
                    </TypeToggle>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Country or Province</p>
                <div className="relative">
                  <select
                    className="h-10 w-full appearance-none rounded-lg border border-[#e5e7eb] bg-white px-3 pr-8 text-[14px] text-[#111827]"
                    value={countryProvince}
                    onChange={(e) => setCountryProvince(e.target.value)}
                  >
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Supports / Service</p>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_TAGS.map((tag) => {
                    const active = serviceTags.has(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleServiceTag(tag)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-semibold transition",
                          active
                            ? "border-[#4338ca] bg-[#eef2ff] text-[#4338ca]"
                            : "border-[#e5e7eb] bg-white text-[#6b7280]",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  <ChevronDown className="h-4 w-4 self-center text-[#9ca3af]" aria-hidden />
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Number Mask or Sequence</p>
                <Input
                  value={numberMask}
                  onChange={(e) => setNumberMask(e.target.value)}
                  placeholder="e.g. 555-GET-HELP"
                  className="h-10 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[12px] font-semibold text-[#374151]">Search Preferences</p>
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
                        "flex min-w-[100px] flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition",
                        active
                          ? "border-[#4338ca] bg-[#eef2ff] text-[#4338ca]"
                          : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {pref.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {keywordTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#6b7280]">Keywords:</span>
                {keywordTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#374151]"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  className="ml-1 text-[#9ca3af] hover:text-[#4338ca]"
                  onClick={onSuggestKeywords}
                  disabled={suggestingKeywords}
                  aria-label="Refresh keywords"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-[#4338ca]"
                onClick={onSuggestKeywords}
                disabled={suggestingKeywords}
              >
                <Wand2 className="h-3.5 w-3.5" />
                {suggestingKeywords ? "Suggesting keywords…" : "Suggest keywords from mask"}
              </button>
            )}
            {suggestError ? <p className="mt-1 text-[11px] text-red-600">{suggestError}</p> : null}

            {showAdvanced && numberType === "tollfree" ? (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Toll-free prefix</p>
                <select
                  className="flex h-10 w-full max-w-md rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
                  value={tollFreePrefix}
                  onChange={(e) => setTollFreePrefix(e.target.value as TollFreePrefix)}
                >
                  {TOLL_FREE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb]"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                Advanced Filter
                <ChevronDown className={cn("h-4 w-4 transition", showAdvanced && "rotate-180")} />
              </button>
              <Button
                onClick={onSearch}
                disabled={loading || !canSearch}
                className="h-11 min-w-[200px] rounded-lg px-6 text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(67,56,202,0.35)] hover:opacity-95"
                style={{ backgroundColor: PRIMARY }}
              >
                {loading ? "Searching…" : "Call for Numbers"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[12px] text-[#6b7280]">
            <div className="flex items-center gap-3">
              <button type="button" className="hover:text-[#111827]" aria-label="Download results">
                <Download className="h-4 w-4" />
              </button>
              <button type="button" className="hover:text-[#111827]" aria-label="Share search">
                <Share2 className="h-4 w-4" />
              </button>
              <button type="button" className="hover:text-[#111827]" aria-label="Save search">
                <Heart className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span>{loading ? "Results may take up to 30 sec" : "Results may take up to 30 sec"}</span>
              <select
                className="h-8 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[12px]"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="default">Sort by: Default</option>
                <option value="score">Highest Score</option>
                <option value="price">Lowest Price</option>
              </select>
            </div>
          </div>

          {searchResponse && searchDurationSec != null ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3 text-[13px]">
              <span className="flex items-center gap-2 font-medium text-[#047857]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {searchResponse.inventoryScannedCount ?? resultCount} numbers scanned • Search
                completed in {searchDurationSec} sec
              </span>
              {searchCompletedAt ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold text-[#4338ca]"
                  onClick={resetSearch}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  New Search
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {reserveError ? <p className="text-sm text-red-600">{reserveError}</p> : null}
          {searchingMore ? (
            <p className="text-[13px] text-[#6b7280]">Still searching for more numbers…</p>
          ) : null}

          {success ? <PremiumSuccessPanel state={success} onClose={() => setSuccess(null)} /> : null}

          {searchResponse && !success && bestMatches.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#4338ca]" />
                  <h2 className="text-[16px] font-bold text-[#111827]">Best Matches</h2>
                  <span className="text-[12px] text-[#6b7280]">{resultCount} numbers found</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[12px] font-semibold text-[#374151]">
                    All ({resultCount})
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e5e7eb] px-3 text-[12px] font-medium text-[#374151]"
                  >
                    Sort By
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e5e7eb] px-3 text-[12px] font-medium text-[#374151]"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filter
                  </button>
                  <div className="inline-flex rounded-lg border border-[#e5e7eb] p-0.5">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md p-1.5",
                        viewMode === "grid" ? "bg-[#eef2ff] text-[#4338ca]" : "text-[#9ca3af]",
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
                        viewMode === "list" ? "bg-[#eef2ff] text-[#4338ca]" : "text-[#9ca3af]",
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
                {bestMatches.slice(0, 3).map((result) => (
                  <FindNumberCard
                    key={result.phoneNumber}
                    result={result}
                    numberType={numberType}
                    loading={reserving === result.phoneNumber}
                    favorited={favorites.has(result.phoneNumber)}
                    onToggleFavorite={() => toggleFavorite(result.phoneNumber)}
                    onGetNumber={() => onGetNumber(result)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {searchResponse && !success && moreMatches.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-[16px] font-bold text-[#111827]">Even More Matches</h2>
              <div className="space-y-2">
                {moreMatches.slice(0, 8).map((result) => (
                  <MoreMatchRow
                    key={result.phoneNumber}
                    result={result}
                    loading={reserving === result.phoneNumber}
                    onGetNumber={() => onGetNumber(result)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {searchResponse && !success && bestMatches.length === 0 ? (
            <div className={cn(pm.card, "border-dashed p-6 text-center")}>
              <p className="text-[15px] font-semibold text-[#111827]">No matches in this search</p>
              <p className="mt-1 text-[13px] text-[#6b7280]">
                Try another area code, mask, or search preference.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[300px]">
          <SearchSummaryCard
            areaCodes={parsedAreaCodes}
            searchType={searchTypeLabel}
            countryProvince={countryProvince}
            numberMask={numberMask}
            numberType={numberType}
            serviceTags={serviceTags}
            bestScore={bestScore}
            hasResults={Boolean(searchResponse)}
          />
          <SearchHistoryCard />
          <NewNumbersCard results={bestMatches.slice(0, 4)} />
          <KeyFeaturesCard />
        </aside>
      </div>

      {checkout && !success ? (
        <PremiumCheckoutModal
          state={checkout}
          workspaceId={workspaceId}
          onClose={() => setCheckout(null)}
          onComplete={(result) => {
            setSuccess({ ...checkout, ...result });
            setCheckout(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TypeToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition",
        active
          ? "bg-white text-[#4338ca] shadow-sm ring-1 ring-[#c7d2fe]"
          : "text-[#6b7280] hover:text-[#111827]",
      )}
    >
      {children}
    </button>
  );
}

function FindNumberCard({
  result,
  numberType,
  loading,
  favorited,
  onToggleFavorite,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  numberType: NumberType;
  loading: boolean;
  favorited: boolean;
  onToggleFavorite: () => void;
  onGetNumber: () => void;
}) {
  const vanityTitle =
    result.vanityDisplay ??
    (result.displayWord
      ? buildVanityDisplay(result.phoneNumber, [result.displayWord])
      : undefined);
  const heroTitle = vanityTitle ?? result.displayNumber;
  const subNumber = vanityTitle ? result.displayNumber : null;
  const bullets = result.cardBullets.length ? result.cardBullets : result.whyReasons.slice(0, 3);
  const topRated = result.numberQualityScore >= 90;

  return (
    <div className={cn(pm.card, "relative flex flex-col p-5 transition hover:shadow-md")}>
      <button
        type="button"
        onClick={onToggleFavorite}
        className={cn(
          "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] transition",
          favorited ? "border-rose-200 bg-rose-50 text-rose-500" : "text-[#9ca3af] hover:text-rose-500",
        )}
        aria-label="Save favorite"
      >
        <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
      </button>

      <div className="flex flex-wrap gap-2">
        {numberType === "local" ? (
          <span className="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4338ca]">
            LOCAL
          </span>
        ) : null}
        {topRated ? (
          <span className="rounded-md bg-[#ecfdf5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#059669]">
            TOP RATED
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-[#4338ca]">
        {heroTitle}
      </p>
      {subNumber ? <p className="mt-0.5 text-[13px] font-medium text-[#9ca3af]">{subNumber}</p> : null}

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

      <div className="mt-4 space-y-0.5">
        <p className="text-[18px] font-bold text-[#111827]">
          {formatMonthlyDisplay(DISPLAY_MONTHLY_CENTS)}
          <span className="text-[12px] font-medium text-[#6b7280]"> Monthly</span>
        </p>
        <p className="text-[12px] text-[#6b7280]">
          Set-up fee {formatPremiumPrice(result.premiumPriceCents)}
        </p>
      </div>

      <Button
        className="mt-4 h-11 w-full rounded-lg text-[14px] font-semibold text-white hover:opacity-95"
        style={{ backgroundColor: PRIMARY }}
        disabled={loading}
        onClick={onGetNumber}
      >
        {loading ? "Reserving…" : "Get This Number"}
      </Button>
    </div>
  );
}

function MoreMatchRow({
  result,
  loading,
  onGetNumber,
}: {
  result: PremiumNumberProductResult;
  loading: boolean;
  onGetNumber: () => void;
}) {
  const vanityTitle =
    result.vanityDisplay ??
    (result.displayWord
      ? buildVanityDisplay(result.phoneNumber, [result.displayWord])
      : undefined);
  const heroTitle = vanityTitle ?? result.displayNumber;
  const price =
    result.premiumPriceCents > 0
      ? formatPremiumPrice(result.premiumPriceCents)
      : formatMonthlyDisplay(85);

  return (
    <div
      className={cn(
        pm.card,
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
      )}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-[#111827]">{heroTitle}</p>
        <p className="text-[12px] text-[#9ca3af]">{result.displayNumber}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[14px] font-bold text-[#111827]">{price}</span>
        <Button
          variant="outline"
          className="h-9 rounded-lg border-[#4338ca] px-4 text-[13px] font-semibold text-[#4338ca] hover:bg-[#eef2ff]"
          disabled={loading}
          onClick={onGetNumber}
        >
          {loading ? "…" : "Get"}
        </Button>
      </div>
    </div>
  );
}

function SearchSummaryCard({
  areaCodes,
  searchType,
  countryProvince,
  numberMask,
  numberType,
  serviceTags,
  bestScore,
  hasResults,
}: {
  areaCodes: string[];
  searchType: string;
  countryProvince: string;
  numberMask: string;
  numberType: NumberType;
  serviceTags: Set<string>;
  bestScore: number;
  hasResults: boolean;
}) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Search Summary</h3>
      <dl className="mt-3 space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Area code</dt>
          <dd className="font-medium text-[#111827]">{areaCodes.join(", ") || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Pattern</dt>
          <dd className="font-medium text-[#111827]">{searchType}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Region</dt>
          <dd className="font-medium text-[#111827]">{countryProvince}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Mask</dt>
          <dd className="font-medium text-[#111827]">{numberMask.trim() || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Type</dt>
          <dd className="font-medium text-[#111827]">
            {numberType === "tollfree" ? "Toll Free" : "Local"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Services</dt>
          <dd className="font-medium text-[#111827]">
            {[...serviceTags].join(", ") || "—"}
          </dd>
        </div>
      </dl>
      {hasResults && bestScore > 0 ? (
        <div className="mt-3 rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-2 text-center">
          <p className="text-[11px] font-medium text-[#047857]">Best Score</p>
          <p className="text-[18px] font-bold text-[#059669]">{bestScore}/100</p>
        </div>
      ) : null}
    </div>
  );
}

function SearchHistoryCard() {
  const items = ["New Numbers", "Vanity", "Sequential", "Toll Free"];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Search History</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item}>
            <button
              type="button"
              className="text-[12px] font-medium text-[#4338ca] hover:underline"
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewNumbersCard({ results }: { results: PremiumNumberProductResult[] }) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">New Numbers</h3>
      {results.length === 0 ? (
        <p className="mt-2 text-[12px] text-[#6b7280]">Run a search to see new matches.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {results.map((r) => (
            <li key={r.phoneNumber} className="text-[12px]">
              <span className="font-semibold text-[#111827]">
                {r.vanityDisplay ?? r.displayNumber}
              </span>
              <span className="text-[#9ca3af]"> · {r.numberQualityScore}/100</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KeyFeaturesCard() {
  const items = [
    "Instant activation",
    "24/7 expert support",
    "Enterprise-grade reliability",
    "No hidden fees",
  ];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Key Features</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[12px] text-[#374151]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#4338ca]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
