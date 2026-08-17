"use client";

import { removeChipFromState } from "@/lib/premium-numbers/ai-number-search/chips";
import {
  applySearchStatePatch,
  createDefaultNumberSearchState,
  resetNumberSearchState,
} from "@/lib/premium-numbers/ai-number-search/state";
import type {
  AiMessageApiResponse,
  AiNumberSearchMessage,
  NumberSearchState,
} from "@/lib/premium-numbers/ai-number-search/types";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackFindNumberAiEvent } from "@/lib/premium-numbers/find-number-analytics";
import { useCallback, useEffect, useState } from "react";

const SESSION_STORAGE_PREFIX = "find-number-ai-session";

function storageKey(workspaceId: string) {
  return `${SESSION_STORAGE_PREFIX}:${workspaceId}`;
}

function toResultSummaries(results: PremiumNumberProductResult[]) {
  return results.map((r) => ({
    phoneNumber: r.phoneNumber,
    displayNumber: r.displayNumber,
    premiumPriceCents: r.premiumPriceCents,
    businessMatchScore: r.businessMatchScore,
    numberQualityScore: r.numberQualityScore,
    displayWord: r.displayWord,
    vanityDisplay: r.vanityDisplay,
    cardBullets: r.cardBullets,
    whyReasons: r.whyReasons,
    businessMatchLabel: r.businessMatchLabel,
    memorabilityLabel: r.memorabilityLabel,
    premiumPriceBand: r.premiumPriceBand,
    matchedWords: r.matchedWords,
    patterns: r.patterns,
    headlineLabel: r.headlineLabel,
    tags: r.tags,
    listSection: r.listSection,
  }));
}

export function useFindNumberAi({
  workspaceId,
  searchState,
  setSearchState,
  onSearchPerformed,
  topResults,
  selectedNumberId,
}: {
  workspaceId: string;
  searchState: NumberSearchState;
  setSearchState: (state: NumberSearchState) => void;
  onSearchPerformed: (state: NumberSearchState) => Promise<void>;
  topResults: PremiumNumberProductResult[];
  selectedNumberId?: string | null;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiNumberSearchMessage[]>([]);
  const [understandingChips, setUnderstandingChips] = useState<
    AiMessageApiResponse["understandingChips"]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(workspaceId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sessionId?: string;
        messages?: AiNumberSearchMessage[];
        searchState?: NumberSearchState;
      };
      if (parsed.searchState) setSearchState(parsed.searchState);
      if (parsed.sessionId) setSessionId(parsed.sessionId);
      if (parsed.messages) setMessages(parsed.messages);
    } catch {
      /* ignore corrupt session */
    }
  }, [workspaceId, setSearchState]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey(workspaceId),
        JSON.stringify({ sessionId, messages, searchState }),
      );
    } catch {
      /* quota */
    }
  }, [workspaceId, sessionId, messages, searchState]);

  const sendAiMessage = useCallback(
    async (message: string, quickAction?: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      setLoading(true);
      setError("");
      setLoadingStage("Understanding your request…");

      if (quickAction) {
        trackFindNumberAiEvent("ai_suggestion_clicked", { action: quickAction });
      } else if (messages.length === 0) {
        trackFindNumberAiEvent("ai_prompt_submitted");
      } else {
        trackFindNumberAiEvent("ai_followup_sent");
      }

      try {
        setLoadingStage("Generating number ideas…");
        const res = await fetch("/api/numbers/ai/message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            sessionId,
            message: trimmed,
            quickAction,
            currentSearchState: searchState,
            selectedNumberIds: selectedNumberId ? [selectedNumberId] : [],
            resultSummaries: toResultSummaries(topResults),
          }),
        });

        const data = (await res.json()) as AiMessageApiResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "AI request failed");

        setSessionId(data.sessionId);
        setMessages(data.messages);
        setUnderstandingChips(data.understandingChips);
        setSuggestedActions(data.suggestedActions);
        setSearchState(data.searchState);

        if (data.explainOnly) {
          if (quickAction === "compare_top_3" || trimmed.toLowerCase().includes("compare")) {
            trackFindNumberAiEvent("ai_compare_used");
          } else {
            trackFindNumberAiEvent("ai_result_explained");
          }
        }

        if (data.searchPerformed) {
          setLoadingStage("Searching live inventory…");
          await onSearchPerformed(data.searchState);
          setLoadingStage("Ranking matches…");
          trackFindNumberAiEvent("ai_search_completed", {
            area_codes: data.searchState.areaCodes.join(","),
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "AI is temporarily unavailable. You can continue using manual search.";
        setError(msg);
      } finally {
        setLoading(false);
        setLoadingStage("");
      }
    },
    [
      workspaceId,
      sessionId,
      searchState,
      selectedNumberId,
      topResults,
      messages.length,
      setSearchState,
      onSearchPerformed,
    ],
  );

  const removeChip = useCallback(
    async (chipId: string) => {
      const patch = removeChipFromState(searchState, chipId);
      const next = applySearchStatePatch(searchState, patch);
      setSearchState(next);
      setUnderstandingChips(
        (prev) => prev.filter((c) => c.id !== chipId),
      );
      setLoading(true);
      setLoadingStage("Updating search…");
      try {
        await onSearchPerformed(next);
      } finally {
        setLoading(false);
        setLoadingStage("");
      }
    },
    [searchState, setSearchState, onSearchPerformed],
  );

  const clearAiSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setUnderstandingChips([]);
    setSuggestedActions([]);
    setError("");
    setSearchState(resetNumberSearchState());
    try {
      sessionStorage.removeItem(storageKey(workspaceId));
    } catch {
      /* ignore */
    }
  }, [workspaceId, setSearchState]);

  const openAiMode = useCallback(() => {
    trackFindNumberAiEvent("ai_search_opened");
    if (messages.length === 0 && searchState.areaCodes.length > 0) {
      const codes = searchState.areaCodes.join(", ");
      const kws = searchState.keywords.slice(0, 4).join(", ");
      const intro =
        kws.length > 0
          ? `You're currently searching ${codes} numbers using ${kws}. I can refine these results or look for alternatives.`
          : `You're currently searching ${codes}. Tell me what kind of number you want.`;
      setMessages([
        {
          id: "context-intro",
          role: "assistant",
          content: intro,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, [messages.length, searchState.areaCodes, searchState.keywords]);

  return {
    sessionId,
    messages,
    understandingChips,
    loading,
    loadingStage,
    suggestedActions,
    error,
    sendAiMessage,
    removeChip,
    clearAiSession,
    openAiMode,
  };
}
