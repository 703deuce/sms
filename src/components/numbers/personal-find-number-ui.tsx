"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { srCard } from "@/components/smart-routing/shared";
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
import {
  applySearchStatePatch,
  createDefaultNumberSearchState,
} from "@/lib/premium-numbers/ai-number-search/state";
import {
  manualFormToSearchState,
  searchStateToManualFields,
} from "@/lib/premium-numbers/ai-number-search/controller";
import type {
  FindNumberSearchMode,
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
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Dumbbell,
  Filter,
  Grid3x3,
  Heart,
  Home,
  LayoutList,
  Lightbulb,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Trophy,
  Wand2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { NumberShelfCard } from "@/components/landing/numbers/number-shelf-card";
import { BRAND_NAME } from "@/lib/brand";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { runPublicNumberSearch } from "@/lib/premium-numbers/public-find-number-client-search";
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

const STANDARD_MONTHLY_SERVICE_CENTS = 115;

type SearchIntent = "business_keyword" | "number_pattern" | "surprise_me";

type PatternChipId = PersonalPreference | "word_pattern";

const PATTERN_CHIPS: { id: PatternChipId; label: string }[] = [
  { id: "repeating_digits", label: "Repeating Digits" },
  { id: "ends_0000", label: "Ends in 0000" },
  { id: "easy_sequence", label: "Easy Sequence" },
  { id: "repeating_pair", label: "Repeating Pair" },
  { id: "very_memorable", label: "Very Memorable" },
  { id: "word_pattern", label: "Word + Pattern" },
];

const AI_PROMPT_MAX_LENGTH = 200;

const AI_EXAMPLE_CHIPS = [
  "Vanity",
  "800",
  "Services",
  "Beautiful",
  "Gold",
  "Top",
  "Area",
  "917",
  "212",
  "Local",
];

const AI_POPULAR_CATEGORIES: {
  label: string;
  industry: string;
  icon: typeof Dumbbell;
}[] = [
  { label: "Fitness", industry: "fitness", icon: Dumbbell },
  { label: "Real Estate", industry: "real estate", icon: Home },
  { label: "E-commerce", industry: "e-commerce", icon: ShoppingBag },
  { label: "Healthcare", industry: "healthcare", icon: Stethoscope },
  { label: "Tech", industry: "technology", icon: Cpu },
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

function toApiPreferences(selected: PatternChipId[]): PersonalPreference[] {
  const withoutWord = selected.filter((p) => p !== "word_pattern");
  if (selected.includes("word_pattern")) {
    const set = new Set<PersonalPreference>([
      ...withoutWord,
      "very_memorable",
      "repeating_pair",
    ] as PersonalPreference[]);
    return [...set];
  }
  return withoutWord as PersonalPreference[];
}

function formatMonthlyService(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export type PublicLandingConfig = {
  initialTopPicks?: PremiumNumberProductResult[];
  shelfSearchLogId?: string;
  defaultAreaCodes?: string[];
};

type DetectedVisitorMarket = {
  metroLabel: string;
  likelyAreaCodes: string[];
  confidence: "high" | "medium" | "low";
};

export function PersonalFindNumberClient({
  workspaceId,
  publicLanding,
  hidePageHeader = false,
}: {
  workspaceId: string;
  publicLanding?: PublicLandingConfig;
  hidePageHeader?: boolean;
}) {
  const router = useRouter();
  const isPublic = Boolean(publicLanding);
  const searchEndpoint = isPublic ? "/api/public/numbers/search" : "/api/numbers/premium/search";
  const suggestKeywordsEndpoint = isPublic
    ? "/api/public/numbers/suggest-keywords"
    : "/api/numbers/premium/suggest-keywords";

  const [numberType, setNumberType] = useState<NumberType>("local");
  const [areaCodesInput, setAreaCodesInput] = useState(
    publicLanding?.defaultAreaCodes?.join(", ") ?? "",
  );
  const [tollFreePrefix, setTollFreePrefix] = useState<TollFreePrefix>("all");
  const [searchIntent, setSearchIntent] = useState<SearchIntent>("business_keyword");
  const [industry, setIndustry] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState("");
  const [extraKeywords, setExtraKeywords] = useState("");
  const [patternPrefs, setPatternPrefs] = useState<PatternChipId[]>(["repeating_digits"]);
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"best" | "price" | "score">("best");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [morePage, setMorePage] = useState(0);
  const [searchMode, setSearchMode] = useState<FindNumberSearchMode>("manual");
  const [aiPromptDraft, setAiPromptDraft] = useState("");
  const [aiStarted, setAiStarted] = useState(false);
  const [wantPorting, setWantPorting] = useState(false);
  const [wantVanity, setWantVanity] = useState(false);
  const [searchState, setSearchState] = useState<NumberSearchState>(() =>
    createDefaultNumberSearchState(),
  );

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
  const [topPicks, setTopPicks] = useState<PremiumNumberProductResult[]>(
    publicLanding?.initialTopPicks ?? [],
  );
  const [topPicksLoading, setTopPicksLoading] = useState(
    isPublic && !publicLanding?.initialTopPicks?.length,
  );
  const [topPicksError, setTopPicksError] = useState("");
  const [detectedMarket, setDetectedMarket] = useState<DetectedVisitorMarket | null>(null);
  const [shelfSearchLogId, setShelfSearchLogId] = useState(publicLanding?.shelfSearchLogId);

  useEffect(() => {
    if (!isPublic || publicLanding?.initialTopPicks?.length) return;

    let cancelled = false;
    setTopPicksLoading(true);
    setTopPicksError("");

    fetch("/api/public/numbers/top-picks")
      .then((r) => r.json())
      .then(
        (data: {
          items?: PremiumNumberProductResult[];
          searchLogId?: string;
          market?: {
            metroLabel?: string;
            likelyAreaCodes?: string[];
            confidence?: "high" | "medium" | "low";
          };
          error?: string;
        }) => {
          if (cancelled) return;
          if (data.error) {
            setTopPicksError(data.error);
            return;
          }
          if (data.items?.length) setTopPicks(data.items);
          if (data.searchLogId) setShelfSearchLogId(data.searchLogId);
          if (data.market?.likelyAreaCodes?.length) {
            setDetectedMarket({
              metroLabel: data.market.metroLabel ?? "your area",
              likelyAreaCodes: data.market.likelyAreaCodes,
              confidence: data.market.confidence ?? "low",
            });
            setAreaCodesInput((prev) =>
              prev.trim() ? prev : data.market!.likelyAreaCodes!.join(", "),
            );
          }
        },
      )
      .catch(() => {
        if (!cancelled) {
          setTopPicksError("Could not load picks for your area. Try searching above.");
        }
      })
      .finally(() => {
        if (!cancelled) setTopPicksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPublic, publicLanding?.initialTopPicks?.length]);

  const popularPicksSubtitle = topPicksLoading
    ? "Finding numbers in your area…"
    : detectedMarket && detectedMarket.confidence !== "low"
      ? `Hand-picked near ${detectedMarket.metroLabel}.`
      : detectedMarket
        ? `Showing picks for ${detectedMarket.metroLabel} area codes.`
        : "Hand-picked for you — explore by city.";

  const parsedAreaCodes = useMemo(() => parseAreaCodesInput(areaCodesInput), [areaCodesInput]);
  const keywordTags = useMemo(() => splitKeywordInput(suggestedKeywords), [suggestedKeywords]);

  const canSearch =
    parsedAreaCodes.length > 0 &&
    (searchIntent === "business_keyword"
      ? industry.trim().length >= 2
      : searchIntent === "number_pattern"
        ? patternPrefs.length > 0
        : true);

  async function onSuggestKeywords() {
    const industryText = industry.trim();
    if (industryText.length < 2) {
      setSuggestError("Enter your industry first");
      return;
    }
    setSuggestingKeywords(true);
    setSuggestError("");
    try {
      const res = await fetch(suggestKeywordsEndpoint, {
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

  function removeKeywordTag(tag: string) {
    const next = keywordTags.filter((k) => k !== tag);
    setSuggestedKeywords(next.join(", "));
  }

  function resetSearch() {
    setSearchResponse(null);
    setSearchDurationSec(null);
    setSearchCompletedAt(null);
    setError("");
    setMorePage(0);
  }

  async function onSeeAllPicks() {
    if (parsedAreaCodes.length === 0) return;
    setSearchIntent("surprise_me");
    setLoading(true);
    setSearchingMore(false);
    setError("");
    setSearchResponse(null);
    setSuccess(null);
    setSearchDurationSec(null);
    setSearchCompletedAt(null);
    setMorePage(0);
    const started = performance.now();

    try {
      if (isPublic) {
        trackNumbersLandingEvent("manual_search_started", { source: "see_all_picks" });
      }
      const res = await fetch(searchEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          ...(isPublic ? {} : { workspaceId }),
          mode: "personal" as const,
          areaCodes: parsedAreaCodes,
          preferences: ["surprise_me"] as PersonalPreference[],
        }),
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setSearchingMore(false);
    }
  }

  async function onSearch() {
    setLoading(true);
    setSearchingMore(false);
    setError("");
    setSearchResponse(null);
    setSuccess(null);
    setSearchDurationSec(null);
    setSearchCompletedAt(null);
    setMorePage(0);
    const manualState = buildSearchStateFromManual();
    setSearchState(manualState);
    const started = performance.now();

    const body =
      searchIntent === "business_keyword"
        ? {
            ...(isPublic ? {} : { workspaceId }),
            mode: "business" as const,
            numberType,
            areaCodes: parsedAreaCodes,
            tollFreePrefix: numberType === "tollfree" ? tollFreePrefix : undefined,
            industry: industry.trim(),
            suggestedKeywords: keywordTags,
            extraKeywords: splitKeywordInput(extraKeywords),
          }
        : searchIntent === "surprise_me"
          ? {
              ...(isPublic ? {} : { workspaceId }),
              mode: "personal" as const,
              areaCodes: parsedAreaCodes,
              preferences: ["surprise_me"] as PersonalPreference[],
            }
          : {
              ...(isPublic ? {} : { workspaceId }),
              mode: "personal" as const,
              areaCodes: parsedAreaCodes,
              preferences: toApiPreferences(patternPrefs),
            };

    try {
      if (isPublic) {
        trackNumbersLandingEvent("manual_search_started");
      }
      const res = await fetch(searchEndpoint, {
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
    const activeSearchLogId = searchResponse?.searchLogId ?? shelfSearchLogId;
    if (!activeSearchLogId) return;
    const reserveSearchMode = searchIntent === "business_keyword" ? "business" : "personal";
    setReserving(result.phoneNumber);
    setReserveError("");
    if (aiEngaged) {
      trackFindNumberAiEvent("number_reserved_from_ai", { phone: result.phoneNumber });
    }
    if (isPublic) {
      trackNumbersLandingEvent("number_reserve_clicked", { phoneNumber: result.phoneNumber });
    }
    try {
      const reserveUrl = isPublic
        ? "/api/public/numbers/reserve"
        : "/api/numbers/premium/reserve";
      const res = await fetch(reserveUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(isPublic ? {} : { workspaceId }),
          phoneNumber: result.phoneNumber,
          searchLogId: activeSearchLogId,
          searchMode: reserveSearchMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reserve this number");
      if (isPublic && data.signupUrl) {
        trackNumbersLandingEvent("checkout_started", { phoneNumber: result.phoneNumber });
        router.push(data.signupUrl);
        return;
      }
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

  function toggleCompare(phone: string) {
    setCompare((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else if (next.size < 4) next.add(phone);
      return next;
    });
  }

  const bestMatches = useMemo(() => {
    if (!searchResponse) return [];
    const fromBusiness = searchResponse.bestMatches ?? [];
    const fromPersonal = searchResponse.topPicks ?? [];
    const base = fromBusiness.length ? fromBusiness : fromPersonal;
    const sorted = [...base];
    if (sortBy === "price") {
      sorted.sort((a, b) => a.premiumPriceCents - b.premiumPriceCents);
    } else if (sortBy === "score") {
      sorted.sort((a, b) => b.numberQualityScore - a.numberQualityScore);
    }
    return sorted.slice(0, 3);
  }, [searchResponse, sortBy]);

  const moreMatches = useMemo(() => {
    if (!searchResponse) return [];
    const pool =
      searchResponse.memorableAlternatives?.length
        ? searchResponse.memorableAlternatives
        : (searchResponse.topPicks ?? []).slice(3);
    const sorted = [...pool];
    if (sortBy === "price") {
      sorted.sort((a, b) => a.premiumPriceCents - b.premiumPriceCents);
    } else if (sortBy === "score") {
      sorted.sort((a, b) => b.numberQualityScore - a.numberQualityScore);
    }
    return sorted;
  }, [searchResponse, sortBy]);

  const morePageSize = 6;
  const morePaged = moreMatches.slice(morePage * morePageSize, (morePage + 1) * morePageSize);
  const morePages = Math.max(1, Math.ceil(moreMatches.length / morePageSize));

  const strongMatches =
    searchResponse?.businessMatchCount ??
    bestMatches.filter((r) => r.numberQualityScore >= 75).length;

  const bestScore = bestMatches[0]?.numberQualityScore ?? 0;

  function buildSearchStateFromManual(): NumberSearchState {
    return manualFormToSearchState({
      numberType,
      areaCodes: parsedAreaCodes,
      tollFreePrefix,
      industry,
      suggestedKeywordTags: keywordTags,
      extraKeywords: splitKeywordInput(extraKeywords),
      searchIntent,
      patternPrefs: toApiPreferences(patternPrefs),
    });
  }

  function applySearchStateToManualForm(state: NumberSearchState) {
    const fields = searchStateToManualFields(state);
    setNumberType(fields.numberType);
    setAreaCodesInput(fields.areaCodesInput);
    setTollFreePrefix(fields.tollFreePrefix);
    setIndustry(fields.industry);
    setSuggestedKeywords(fields.suggestedKeywords);
    setExtraKeywords(fields.extraKeywords);
    setSearchIntent(fields.searchIntent as SearchIntent);
    const prefs = fields.patternPrefs as PatternChipId[];
    setPatternPrefs(prefs.length ? prefs : ["repeating_digits"]);
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

  const runSearchFromState = useCallback(
    async (state: NumberSearchState) => {
      setLoading(true);
      setSearchingMore(false);
      setError("");
      setSearchResponse(null);
      setSuccess(null);
      setSearchDurationSec(null);
      setSearchCompletedAt(null);
      setMorePage(0);

      const body = buildPremiumSearchBody(isPublic ? "public-landing" : workspaceId, state);

      try {
        const snapshots: PremiumSearchProductResponse[] = [];
        const onData = (data: PremiumSearchProductResponse) => {
          snapshots[0] = data;
          setSearchResponse(data);
          setSearchingMore(data.searchStatus === "searching");
          if (data.searchStatus !== "searching") {
            setLoading(false);
          }
        };
        const { durationSec, completedAt } = isPublic
          ? await runPublicNumberSearch(body, onData)
          : await runPremiumNumberSearch(body, onData);

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
    [workspaceId, isPublic],
  );

  const ai = useFindNumberAi({
    workspaceId,
    searchState,
    setSearchState,
    onSearchPerformed: runSearchFromState,
    topResults: allResults.slice(0, 12),
    aiMessageEndpoint: isPublic ? "/api/public/numbers/ai/message" : "/api/numbers/ai/message",
    sessionStorageId: isPublic ? "public-landing" : undefined,
  });

  const aiEngaged = ai.messages.length > 0;

  const summaryAreaCodes =
    searchState.areaCodes.length > 0 ? searchState.areaCodes : parsedAreaCodes;
  const summaryIndustry = searchState.industry?.trim() || industry.trim();
  const summarySearchIntent =
    aiEngaged || searchState.areaCodes.length > 0 || searchState.industry
      ? (searchState.apiIntent as SearchIntent)
      : searchIntent;
  const summaryNumberType =
    searchState.areaCodes.length > 0 || aiEngaged ? searchState.numberType : numberType;

  function switchSearchMode(mode: FindNumberSearchMode) {
    if (mode === searchMode) return;
    if (mode === "ai") {
      const fromManual = buildSearchStateFromManual();
      setSearchState(fromManual);
      trackFindNumberAiEvent("manual_to_ai_switch");
      ai.openAiMode();
    } else {
      applySearchStateToManualForm(searchState);
      trackFindNumberAiEvent("ai_to_manual_switch");
    }
    setSearchMode(mode);
  }

  function buildAiSearchState(): NumberSearchState {
    let state = buildSearchStateFromManual();
    if (wantVanity) {
      state = applySearchStatePatch(state, {
        searchPrefs: [...new Set([...state.searchPrefs, "vanity"] as const)],
        apiIntent: "business_keyword",
        intent: "business",
      });
    }
    return state;
  }

  async function onAiFindMyNumber() {
    const msg = aiPromptDraft.trim();
    if (!msg) return;
    const state = buildAiSearchState();
    setSearchState(state);
    trackFindNumberAiEvent("ai_search_opened");
    ai.openAiMode();
    setAiStarted(true);
    await ai.sendAiMessage(msg);
  }

  function onAiExampleChip(chip: string) {
    const additions: Record<string, string> = {
      Vanity: "vanity memorable number",
      Area: "local area code",
      Top: "top rated",
      Services: "professional services",
      Beautiful: "beautiful memorable pattern",
      Gold: "premium gold tier",
      Local: "local number",
    };
    const text = additions[chip] ?? chip;
    setAiPromptDraft((prev) => {
      const base = prev.trim();
      return base ? `${base} ${text}` : text;
    });
  }

  async function onAiCategoryPick(industry: string) {
    setIndustry(industry);
    setAiPromptDraft((prev) => {
      const base = prev.trim();
      const phrase = `memorable number for my ${industry} business`;
      return base ? `${base} ${phrase}` : phrase;
    });
    setSearchState(
      applySearchStatePatch(buildAiSearchState(), {
        industry,
        intent: "business",
        apiIntent: "business_keyword",
      }),
    );
    setAiStarted(true);
    await ai.sendAiMessage(`Find memorable numbers for my ${industry} business`, industry);
  }

  return (
    <div className="mx-auto max-w-[1320px]" id={isPublic ? "find-number-search" : undefined}>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          {!hidePageHeader ? (
          <header>
            <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">Find a Number</h1>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              {searchMode === "ai"
                ? "Search for a new number to add to your workspace by area code or vanity keyword."
                : "Search memorable local and toll-free numbers that help your business stand out."}
            </p>
          </header>
          ) : null}

          <div className={cn(pm.card, "p-5 md:p-6")}>
            <div className="mb-5 inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
              <button
                type="button"
                onClick={() => switchSearchMode("manual")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold transition",
                  searchMode === "manual"
                    ? "bg-white text-[#4338ca] shadow-sm ring-1 ring-[#c7d2fe]"
                    : "text-[#6b7280] hover:text-[#111827]",
                )}
              >
                <Search className="h-4 w-4" />
                {isPublic ? "Search Numbers" : "Manual Search"}
              </button>
              <button
                type="button"
                onClick={() => switchSearchMode("ai")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold transition",
                  searchMode === "ai"
                    ? "bg-white text-[#4338ca] shadow-sm ring-1 ring-[#c7d2fe]"
                    : "text-[#6b7280] hover:text-[#111827]",
                )}
              >
                <Sparkles className="h-4 w-4" />
                {isPublic ? `Ask ${BRAND_NAME}` : "Ask AI Concierge"}
              </button>
            </div>

            {searchMode === "ai" ? (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea
                        value={aiPromptDraft}
                        onChange={(e) =>
                          setAiPromptDraft(e.target.value.slice(0, AI_PROMPT_MAX_LENGTH))
                        }
                        rows={5}
                        placeholder="Tell us what you're looking for…"
                        className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2.5 pb-8 text-[14px] outline-none focus:border-[#6366f1]"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-[#9ca3af]">
                        {aiPromptDraft.length}/{AI_PROMPT_MAX_LENGTH}
                      </span>
                    </div>
                    <div>
                      <p className="mb-2 text-[12px] font-semibold text-[#374151]">
                        Examples:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {AI_EXAMPLE_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => onAiExampleChip(chip)}
                            className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[12px] font-semibold text-[#374151] hover:border-[#c7d2fe] hover:bg-[#eef2ff]"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[12px] font-semibold text-[#374151]">
                        Popular categories
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {AI_POPULAR_CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          return (
                            <button
                              key={cat.label}
                              type="button"
                              disabled={ai.loading}
                              onClick={() => onAiCategoryPick(cat.industry)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] font-semibold text-[#374151] hover:border-[#c7d2fe] hover:bg-[#eef2ff]"
                            >
                              <Icon className="h-4 w-4 text-[#6366f1]" />
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-center pt-2">
                      <Button
                        onClick={onAiFindMyNumber}
                        disabled={ai.loading || !aiPromptDraft.trim()}
                        className="h-12 min-w-[240px] rounded-lg bg-[#6366f1] text-[15px] font-semibold shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:bg-[#5558e3]"
                      >
                        {ai.loading ? "Finding your numbers…" : "Find My Number"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                    {ai.error ? <p className="text-center text-[12px] text-red-600">{ai.error}</p> : null}
                  </div>
                  <div className="relative space-y-4">
                    <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
                      <h3 className="text-[13px] font-bold text-[#111827]">
                        Personalize & Portability
                      </h3>
                      <div className="mt-3 space-y-3">
                        <label className="flex items-start gap-2 text-[12px] text-[#374151]">
                          <input
                            type="checkbox"
                            checked={wantPorting}
                            onChange={(e) => setWantPorting(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-[#d1d5db] text-[#6366f1]"
                          />
                          <span>
                            Do you have a personal number you&apos;d like to use? (Porting)
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px] text-[#374151]">
                          <input
                            type="checkbox"
                            checked={wantVanity}
                            onChange={(e) => setWantVanity(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-[#d1d5db] text-[#6366f1]"
                          />
                          <span>Are you looking for a vanity number?</span>
                        </label>
                      </div>
                      {wantPorting ? (
                        <Link
                          href="/personal/porting"
                          className="mt-3 inline-block text-[12px] font-semibold text-[#6366f1] hover:underline"
                        >
                          Start a port request →
                        </Link>
                      ) : null}
                    </div>
                    <div className="absolute bottom-0 right-0 max-w-[220px] rounded-2xl rounded-br-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#374151] shadow-sm">
                      Hello, how can I help you today?
                    </div>
                  </div>
                </div>
                {aiStarted || aiEngaged ? (
                  <FindNumberAiPanel
                    sessionId={ai.sessionId}
                    messages={ai.messages}
                    understandingChips={ai.understandingChips}
                    loading={ai.loading}
                    loadingStage={ai.loadingStage}
                    suggestedActions={ai.suggestedActions}
                    onSend={(msg, quick) => ai.sendAiMessage(msg, quick)}
                    onQuickAction={(action) => ai.sendAiMessage(action, action)}
                    onClear={() => {
                      resetSearch();
                      setSearchState(createDefaultNumberSearchState());
                      ai.clearAiSession();
                      setAiStarted(false);
                      setAiPromptDraft("");
                    }}
                    onRemoveChip={ai.removeChip}
                    variant="mockup"
                  />
                ) : null}
              </div>
            ) : (
              <>
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Number Type</p>
                <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
                  <IntentToggle
                    active={numberType === "local"}
                    onClick={() => setNumberType("local")}
                    icon={MapPin}
                  >
                    Local
                  </IntentToggle>
                  <IntentToggle
                    active={numberType === "tollfree"}
                    onClick={() => setNumberType("tollfree")}
                    icon={Phone}
                  >
                    Toll-Free
                  </IntentToggle>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Area Codes</p>
                <Input
                  value={areaCodesInput}
                  onChange={(e) =>
                    setAreaCodesInput(e.target.value.replace(/[^\d,\s]/g, ""))
                  }
                  placeholder={topPicksLoading && isPublic ? "Detecting your area…" : "571"}
                  className="h-10 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                />
              </div>

              <div>
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Search Intent</p>
                <div className="inline-flex flex-wrap rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
                  <IntentToggle
                    active={searchIntent === "business_keyword"}
                    onClick={() => setSearchIntent("business_keyword")}
                    icon={Briefcase}
                  >
                    Business / Keyword
                  </IntentToggle>
                  <IntentToggle
                    active={searchIntent === "number_pattern"}
                    onClick={() => setSearchIntent("number_pattern")}
                    icon={Grid3x3}
                  >
                    Number Pattern
                  </IntentToggle>
                  <IntentToggle
                    active={searchIntent === "surprise_me"}
                    onClick={() => setSearchIntent("surprise_me")}
                    icon={Sparkles}
                  >
                    Surprise Me
                  </IntentToggle>
                </div>
              </div>
            </div>

            {searchIntent === "business_keyword" ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-[#374151]">
                    Industry or What You Do
                  </p>
                  <div className="relative">
                    <Input
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="electrician"
                      className="h-10 rounded-lg border-[#e5e7eb] bg-white pr-10 text-[14px]"
                    />
                    <Zap className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6366f1]" />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-semibold text-[#374151]">Suggested Keywords</p>
                  <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1.5">
                    {keywordTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#374151]"
                      >
                        {tag}
                        <button
                          type="button"
                          className="text-[#9ca3af] hover:text-[#111827]"
                          onClick={() => removeKeywordTag(tag)}
                          aria-label={`Remove ${tag}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-[#f3f4f6]"
                      onClick={onSuggestKeywords}
                      disabled={suggestingKeywords}
                      aria-label="Suggest keywords"
                    >
                      <Wand2 className="h-4 w-4" />
                    </button>
                  </div>
                  {suggestError ? (
                    <p className="mt-1 text-[11px] text-red-600">{suggestError}</p>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-semibold text-[#374151]">
                    Business Name or Custom Words
                  </p>
                  <Input
                    value={extraKeywords}
                    onChange={(e) => setExtraKeywords(e.target.value)}
                    placeholder="e.g. MIKE for Mike's Plumbing"
                    className="h-10 rounded-lg border-[#e5e7eb] bg-white text-[14px]"
                  />
                </div>
              </div>
            ) : null}

            {searchIntent !== "surprise_me" ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-semibold text-[#374151]">Pattern Preferences</p>
                <div className="flex flex-wrap gap-2">
                  {PATTERN_CHIPS.map((chip) => {
                    const active = patternPrefs.includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => {
                          setPatternPrefs((prev) => {
                            if (active) {
                              const next = prev.filter((p) => p !== chip.id);
                              return next.length ? next : ["repeating_digits"];
                            }
                            return [...prev, chip.id];
                          });
                        }}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition",
                          active
                            ? "border-[#6366f1] bg-[#eef2ff] text-[#6366f1]"
                            : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#c7d2fe]",
                        )}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

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
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#111827]"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                Advanced Filters
                <ChevronDown className={cn("h-4 w-4 transition", showAdvanced && "rotate-180")} />
              </button>
              <Button
                onClick={onSearch}
                disabled={loading || !canSearch}
                className="h-11 min-w-[200px] rounded-lg bg-[#6366f1] px-6 text-[14px] font-semibold shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:bg-[#5558e3]"
              >
                {loading ? "Searching…" : "Find My Numbers"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
              </>
            )}
          </div>

          {isPublic && !searchResponse && !success ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-bold text-[#111827]">Popular Picks Today</h2>
                  <p
                    className={cn(
                      "mt-1 text-[14px]",
                      topPicksLoading ? "flex items-center gap-2 text-[#6366f1]" : "text-[#6b7280]",
                    )}
                  >
                    {topPicksLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {popularPicksSubtitle}
                      </>
                    ) : (
                      popularPicksSubtitle
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSeeAllPicks}
                  disabled={loading || topPicksLoading || parsedAreaCodes.length === 0}
                  className="text-[13px] font-semibold text-[#6366f1] hover:underline disabled:opacity-50"
                >
                  See all picks →
                </button>
              </div>
              {topPicksLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[108px] animate-pulse rounded-xl border border-[#e5e7eb] bg-[#f3f4f6]"
                    />
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
                <div className={cn(pm.card, "border-dashed p-6 text-center")}>
                  <p className="text-[14px] text-[#6b7280]">
                    {topPicksError ||
                      "Enter an area code above and search to browse live inventory."}
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {searchResponse && searchDurationSec != null ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3 text-[13px]">
              <span className="flex items-center gap-2 font-medium text-[#047857]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {searchResponse.inventoryScannedCount ?? searchResponse.resultCount} numbers scanned
                • {strongMatches} strong matches • Search completed in {searchDurationSec} sec
              </span>
              <span className="flex items-center gap-3 text-[12px] text-[#6b7280]">
                {searchCompletedAt
                  ? `Searched: Today at ${searchCompletedAt.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : null}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold text-[#6366f1]"
                  onClick={resetSearch}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  New Search
                </button>
              </span>
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
                  <Trophy className="h-5 w-5 text-[#6366f1]" />
                  <h2 className="text-[16px] font-bold text-[#111827]">
                    {isPublic ? "Your Results" : "Best Matches"}
                  </h2>
                  <span className="text-[12px] text-[#6b7280]">{bestMatches.length} top results</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[12px]"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  >
                    <option value="best">Sort by: Best Match</option>
                    <option value="score">Highest Score</option>
                    <option value="price">Lowest Price</option>
                  </select>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e5e7eb] px-3 text-[12px] font-medium text-[#374151]"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                  </button>
                  <div className="inline-flex rounded-lg border border-[#e5e7eb] p-0.5">
                    <button
                      type="button"
                      className={cn(
                        "rounded-md p-1.5",
                        viewMode === "grid" ? "bg-[#eef2ff] text-[#6366f1]" : "text-[#9ca3af]",
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
                        viewMode === "list" ? "bg-[#eef2ff] text-[#6366f1]" : "text-[#9ca3af]",
                      )}
                      onClick={() => setViewMode("list")}
                      aria-label="List view"
                    >
                      <LayoutList className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-[#e5e7eb] px-3 text-[12px] font-semibold text-[#374151]"
                  >
                    Compare ({compare.size})
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    : "space-y-3",
                )}
              >
                {bestMatches.map((result, i) => (
                  <FindNumberCard
                    key={result.phoneNumber}
                    result={result}
                    variant={i === 0 ? "best" : "featured"}
                    loading={reserving === result.phoneNumber}
                    favorited={favorites.has(result.phoneNumber)}
                    compared={compare.has(result.phoneNumber)}
                    onToggleFavorite={() => toggleFavorite(result.phoneNumber)}
                    onToggleCompare={() => toggleCompare(result.phoneNumber)}
                    onGetNumber={() => onGetNumber(result)}
                    layout={viewMode}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {searchResponse && !success && moreMatches.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#111827]">More Great Matches</h2>
                  <p className="text-[12px] text-[#6b7280]">
                    {moreMatches.length} additional numbers
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={morePage === 0}
                    className="rounded-lg border border-[#e5e7eb] p-2 disabled:opacity-40"
                    onClick={() => setMorePage((p) => Math.max(0, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={morePage >= morePages - 1}
                    className="rounded-lg border border-[#e5e7eb] p-2 disabled:opacity-40"
                    onClick={() => setMorePage((p) => Math.min(morePages - 1, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {morePaged.map((result) => (
                  <MoreMatchRow
                    key={result.phoneNumber}
                    result={result}
                    favorited={favorites.has(result.phoneNumber)}
                    onToggleFavorite={() => toggleFavorite(result.phoneNumber)}
                    onClick={() => onGetNumber(result)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {searchResponse && !success && bestMatches.length === 0 ? (
            <div className={cn(pm.card, "border-dashed p-6 text-center")}>
              <p className="text-[15px] font-semibold text-[#111827]">No matches in this search</p>
              <p className="mt-1 text-[13px] text-[#6b7280]">
                Try another area code, keyword, or pattern preference.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[300px]">
          <SearchSummaryCard
            areaCodes={summaryAreaCodes}
            industry={summaryIndustry}
            searchIntent={summarySearchIntent}
            numberType={summaryNumberType}
            bestScore={bestScore}
            hasResults={Boolean(searchResponse)}
          />
          {!isPublic ? (
            <SavedCompareCard favorites={favorites.size} compared={compare.size} />
          ) : null}
          <HowItWorksCard />
          {!isPublic ? <WhyTransovoCard /> : null}
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

function IntentToggle({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: typeof MapPin;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition",
        active
          ? "bg-white text-[#6366f1] shadow-sm ring-1 ring-[#c7d2fe]"
          : "text-[#6b7280] hover:text-[#111827]",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#059669"
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#111827]">
        {score}/100
      </span>
    </div>
  );
}

function resolveBadge(result: PremiumNumberProductResult): string | null {
  if (
    result.displayWord &&
    result.wordPlacement === "ending" &&
    result.businessMatchScore >= 75
  ) {
    return "EXACT WORD";
  }
  if (result.displayWord && result.wordPlacement === "embedded") {
    return "WORD + PATTERN";
  }
  if (result.premiumPriceBand === "exceptional" || result.numberQualityScore >= 80) {
    return "BEST MATCH";
  }
  if (result.businessMatchScore >= 55) {
    return "STRONG MATCH";
  }
  return null;
}

function FindNumberCard({
  result,
  variant,
  loading,
  favorited,
  compared,
  onToggleFavorite,
  onToggleCompare,
  onGetNumber,
  layout,
}: {
  result: PremiumNumberProductResult;
  variant: "best" | "featured";
  loading: boolean;
  favorited: boolean;
  compared: boolean;
  onToggleFavorite: () => void;
  onToggleCompare: () => void;
  onGetNumber: () => void;
  layout: "grid" | "list";
}) {
  const vanityTitle =
    result.vanityDisplay ??
    (result.displayWord
      ? buildVanityDisplay(result.phoneNumber, [result.displayWord])
      : undefined);
  const heroTitle = vanityTitle ?? result.displayNumber;
  const subNumber = vanityTitle ? result.displayNumber : null;
  const badge = resolveBadge(result);
  const bullets = result.cardBullets.length ? result.cardBullets : result.whyReasons.slice(0, 3);

  return (
    <div
      className={cn(
        pm.card,
        "relative flex flex-col p-5 transition hover:shadow-md",
        layout === "list" && "flex-row gap-4",
        variant === "best" && "ring-1 ring-[#c7d2fe]",
      )}
    >
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

      {badge ? (
        <span
          className={cn(
            "absolute left-4 top-4 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white",
            badge === "BEST MATCH" ? "bg-[#6366f1]" : "bg-[#4f46e5]",
          )}
        >
          {badge}
        </span>
      ) : null}

      <div className={cn("min-w-0 flex-1", badge && "pt-6")}>
        <p className="text-[26px] font-bold leading-tight tracking-tight text-[#111827]">
          {heroTitle}
        </p>
        {subNumber ? (
          <p className="mt-0.5 text-[13px] font-medium text-[#9ca3af]">{subNumber}</p>
        ) : null}

        <div className="mt-3 flex items-center gap-3">
          <p className="text-[12px] font-semibold text-[#6b7280]">TransOvo Score</p>
          <ScoreRing score={result.numberQualityScore} />
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

        <div className="mt-4 space-y-0.5">
          <p className="text-[20px] font-bold text-[#111827]">
            {formatPremiumPrice(result.premiumPriceCents)}
            <span className="text-[12px] font-medium text-[#6b7280]"> One-time price</span>
          </p>
          <p className="text-[12px] text-[#6b7280]">
            {formatMonthlyService(STANDARD_MONTHLY_SERVICE_CENTS)}/mo Monthly service
          </p>
        </div>
      </div>

      <div className={cn("mt-4 space-y-2", layout === "list" && "mt-0 w-[200px] shrink-0")}>
        <Button
          className="h-11 w-full rounded-lg bg-[#6366f1] text-[14px] font-semibold hover:bg-[#5558e3]"
          disabled={loading}
          onClick={onGetNumber}
        >
          {loading ? "Reserving…" : "Get This Number"}
        </Button>
        <button
          type="button"
          onClick={onToggleCompare}
          className={cn(
            "w-full text-center text-[11px] font-medium",
            compared ? "text-[#6366f1]" : "text-[#9ca3af] hover:text-[#6366f1]",
          )}
        >
          {compared ? "Added to compare" : "Add to compare"}
        </button>
      </div>
    </div>
  );
}

function MoreMatchRow({
  result,
  favorited,
  onToggleFavorite,
  onClick,
}: {
  result: PremiumNumberProductResult;
  favorited: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  const vanityTitle =
    result.vanityDisplay ??
    (result.displayWord
      ? buildVanityDisplay(result.phoneNumber, [result.displayWord])
      : undefined);
  const heroTitle = vanityTitle ?? result.displayNumber;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        pm.card,
        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:border-[#c7d2fe]",
      )}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-[#111827]">{heroTitle}</p>
        <p className="text-[12px] text-[#9ca3af]">{result.displayNumber}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[12px] font-bold text-[#059669]">
          {result.numberQualityScore}/100
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn("text-[#9ca3af]", favorited && "text-rose-500")}
          aria-label="Favorite"
        >
          <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
        </button>
      </div>
    </button>
  );
}

function SearchSummaryCard({
  areaCodes,
  industry,
  searchIntent,
  numberType,
  bestScore,
  hasResults,
}: {
  areaCodes: string[];
  industry: string;
  searchIntent: SearchIntent;
  numberType: NumberType;
  bestScore: number;
  hasResults: boolean;
}) {
  const intentLabel =
    searchIntent === "business_keyword"
      ? "Business / Keyword"
      : searchIntent === "number_pattern"
        ? "Number Pattern"
        : "Surprise Me";

  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">Search Summary</h3>
      <dl className="mt-3 space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Area Code</dt>
          <dd className="font-medium text-[#111827]">{areaCodes.join(", ") || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Industry</dt>
          <dd className="font-medium capitalize text-[#111827]">{industry.trim() || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Search Intent</dt>
          <dd className="font-medium text-[#111827]">{intentLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Number Type</dt>
          <dd className="font-medium text-[#111827]">
            {numberType === "tollfree" ? "Toll-Free" : "Local"}
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

function SavedCompareCard({ favorites, compared }: { favorites: number; compared: number }) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-[#6366f1]" />
        <h3 className="text-[13px] font-bold text-[#111827]">Saved & Compare</h3>
      </div>
      <p className="mt-3 text-[12px] text-[#6b7280]">Saved Numbers: {favorites}</p>
      <p className="text-[12px] text-[#6b7280]">Compared: {compared} / 4</p>
      <Link
        href="/personal/vault"
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[#e5e7eb] py-2 text-[12px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
      >
        View Saved Numbers
      </Link>
    </div>
  );
}

function HowItWorksCard() {
  const steps = [
    { n: 1, title: "Search", desc: "Enter area code and what you do" },
    { n: 2, title: "We scan millions", desc: "Live inventory across carriers" },
    { n: 3, title: "You choose", desc: "Compare scores and reserve" },
    { n: 4, title: "Activate", desc: "Complete purchase and go live" },
  ];
  return (
    <div className={cn(pm.card, "p-4")}>
      <h3 className="text-[13px] font-bold text-[#111827]">How it works</h3>
      <ol className="mt-3 space-y-3">
        {steps.map((step) => (
          <li key={step.n} className="flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">
              {step.n}
            </span>
            <div>
              <p className="text-[12px] font-semibold text-[#111827]">{step.title}</p>
              <p className="text-[11px] text-[#6b7280]">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function WhyTransovoCard() {
  const items = [
    "Enterprise-grade reliability",
    "Instant activation",
    "No hidden fees",
    "24/7 expert support",
  ];
  return (
    <div className={cn(pm.card, "p-4")}>
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#6366f1]" />
        <h3 className="text-[13px] font-bold text-[#111827]">Why TransOvo?</h3>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[12px] text-[#374151]">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#6366f1]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
