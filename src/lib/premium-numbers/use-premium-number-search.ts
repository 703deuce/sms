"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type PremiumNumberProductResult,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import type { PersonalPreference } from "@/lib/premium-numbers/personal-search";
import {
  parseAreaCodesInput,
  type NumberType,
  type TollFreePrefix,
} from "@/lib/premium-numbers/toll-free";
import type { PremiumCheckoutState } from "@/components/numbers/premium-number-checkout";

export type PremiumSearchMode = "business" | "personal";

function splitKeywordInput(text: string): string[] {
  return text
    .split(/[,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function usePremiumNumberSearch(workspaceId: string, initialMode: PremiumSearchMode = "business") {
  const [mode, setMode] = useState<PremiumSearchMode>(initialMode);
  const [numberType, setNumberType] = useState<NumberType>("local");
  const [areaCodesInput, setAreaCodesInput] = useState("");
  const [tollFreePrefix, setTollFreePrefix] = useState<TollFreePrefix>("all");
  const [industry, setIndustry] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState("");
  const [extraKeywords, setExtraKeywords] = useState("");
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [preferences, setPreferences] = useState<PersonalPreference[]>(["surprise_me"]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [searchDurationSec, setSearchDurationSec] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [searchResponse, setSearchResponse] = useState<PremiumSearchProductResponse | null>(null);
  const [reserving, setReserving] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PremiumCheckoutState | null>(null);
  const [success, setSuccess] = useState<PremiumCheckoutState | null>(null);
  const [reserveError, setReserveError] = useState("");

  const parsedAreaCodes = useMemo(() => parseAreaCodesInput(areaCodesInput), [areaCodesInput]);

  const canSearch =
    mode === "personal"
      ? parsedAreaCodes.length > 0
      : numberType === "local"
        ? parsedAreaCodes.length > 0 && industry.trim().length >= 2
        : industry.trim().length >= 2;

  const toggleFavorite = useCallback((phone: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }, []);

  const onSuggestKeywords = useCallback(async () => {
    const industryText = industry.trim();
    if (industryText.length < 2) {
      setSuggestError("Enter your industry first");
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
  }, [industry]);

  const onSearch = useCallback(async () => {
    setLoading(true);
    setSearchingMore(false);
    setError("");
    setSearchResponse(null);
    setSuccess(null);
    setSearchDurationSec(null);
    const started = performance.now();

    const body =
      mode === "business"
        ? {
            workspaceId,
            mode,
            numberType,
            areaCodes: parsedAreaCodes,
            tollFreePrefix: numberType === "tollfree" ? tollFreePrefix : undefined,
            industry: industry.trim(),
            suggestedKeywords: splitKeywordInput(suggestedKeywords),
            extraKeywords: splitKeywordInput(extraKeywords),
          }
        : {
            workspaceId,
            mode,
            areaCodes: parsedAreaCodes,
            preferences,
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
            }
          }
        }

        if (!gotFirst) {
          setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
        }
      } else {
        const data = (await res.json()) as PremiumSearchProductResponse & { error?: string };
        setSearchResponse(data);
        setSearchDurationSec(Math.round(((performance.now() - started) / 1000) * 10) / 10);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setSearchingMore(false);
    }
  }, [
    workspaceId,
    mode,
    numberType,
    parsedAreaCodes,
    tollFreePrefix,
    industry,
    suggestedKeywords,
    extraKeywords,
    preferences,
  ]);

  const onGetNumber = useCallback(
    async (result: PremiumNumberProductResult) => {
      if (!searchResponse?.searchLogId) return;
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
            searchMode: mode,
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
    },
    [searchResponse?.searchLogId, workspaceId, mode],
  );

  const showPreSearch = !searchResponse && !loading && !success;

  return {
    mode,
    setMode,
    numberType,
    setNumberType,
    areaCodesInput,
    setAreaCodesInput,
    tollFreePrefix,
    setTollFreePrefix,
    industry,
    setIndustry,
    suggestedKeywords,
    setSuggestedKeywords,
    extraKeywords,
    setExtraKeywords,
    suggestingKeywords,
    suggestError,
    preferences,
    setPreferences,
    favorites,
    toggleFavorite,
    loading,
    searchingMore,
    searchDurationSec,
    error,
    searchResponse,
    reserving,
    checkout,
    setCheckout,
    success,
    setSuccess,
    reserveError,
    canSearch,
    onSuggestKeywords,
    onSearch,
    onGetNumber,
    showPreSearch,
    parsedAreaCodes,
  };
}
