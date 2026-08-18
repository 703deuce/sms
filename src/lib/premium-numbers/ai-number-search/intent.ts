import { extractJsonFromLlm, hasLlmConfigured, llmChatCompletion } from "@/lib/ai/llm";
import { inferIndustryFromText } from "@/lib/premium-numbers/business-name-keywords";
import {
  mergeCustomerKeywords,
  suggestIndustryVanityKeywords,
} from "@/lib/premium-numbers/business-keyword-llm";
import { parseAreaCodesInput } from "@/lib/premium-numbers/toll-free";
import { applySearchStatePatch, mergeKeywords } from "./state";
import type { AiSearchAction, NumberSearchState } from "./types";

const SYSTEM_PROMPT = `You are AI Concierge for Find a Number. You NEVER invent phone numbers.
You parse user requests into structured search updates for an existing inventory search engine.

Return ONLY valid JSON:
{
  "assistantMessage": "short helpful reply",
  "action": {
    "type": "UPDATE_SEARCH" | "COMPARE_RESULTS" | "EXPLAIN_RESULT" | "NO_SEARCH" | "NEW_SEARCH",
    "patch": { ...partial search fields... },
    "rerun": boolean,
    "resultId": "optional phone e164",
    "resultIds": ["optional"]
  },
  "suggestedActions": ["cheaper", "compare_top_3", ...]
}

Search patch fields (only include fields that change):
- numberType: "local" | "tollfree"
- areaCodes: string[] (3-digit US codes)
- industry: string
- explicitKeywords: string[] (user-requested words)
- aiGeneratedKeywords: string[] (your synonym expansions)
- maxPriceCents: number (customer premium price cap in cents)
- minPriceCents: number
- intent: "business" | "personal" | "unknown"
- searchType: "contains" | "starts_with" | "ends_with"
- numberMask: string

Rules:
- Distinguish explicit user keywords vs AI-generated synonyms in separate arrays.
- rerun=true when area codes, keywords, industry, price, number type, or patterns change.
- rerun=false for explanations, comparisons, opinions.
- Never output fake phone numbers in assistantMessage.
- If user switches industry (e.g. electrician to roofing), replace aiGeneratedKeywords with new industry terms but keep explicit constraints like area codes and max price when still valid.`;

export async function parseAiSearchMessage(input: {
  message: string;
  searchState: NumberSearchState;
  quickAction?: string;
  selectedNumberIds?: string[];
  resultSummaries?: Array<{
    phoneNumber: string;
    displayNumber: string;
    premiumPriceCents: number;
    businessMatchScore: number;
    numberQualityScore: number;
    displayWord?: string;
  }>;
}): Promise<{
  assistantMessage: string;
  action: AiSearchAction;
  suggestedActions: string[];
}> {
  const heuristic = parseHeuristic(input.message, input.quickAction, input.searchState);
  if (heuristic) return heuristic;

  if (!hasLlmConfigured()) {
    return {
      assistantMessage:
        "AI is temporarily unavailable. You can continue using manual search — I saved your settings.",
      action: { type: "NO_SEARCH" },
      suggestedActions: [],
    };
  }

  const userPayload = {
    currentSearchState: {
      ...input.searchState,
      keywords: mergeKeywords(input.searchState),
    },
    userMessage: input.message,
    quickAction: input.quickAction ?? null,
    selectedNumberIds: input.selectedNumberIds ?? [],
    topResults: input.resultSummaries?.slice(0, 12) ?? [],
  };

  const llm = await llmChatCompletion(SYSTEM_PROMPT, JSON.stringify(userPayload), {
    temperature: 0.2,
    maxTokens: 1200,
  });

  if (!llm?.content) {
    return {
      assistantMessage: "I couldn't parse that request. Try manual search or rephrase.",
      action: { type: "NO_SEARCH" },
      suggestedActions: [],
    };
  }

  const parsed = extractJsonFromLlm(llm.content) as {
    assistantMessage?: string;
    action?: {
      type?: string;
      patch?: Partial<NumberSearchState>;
      rerun?: boolean;
      resultId?: string;
      resultIds?: string[];
    };
    suggestedActions?: string[];
  };

  const action = normalizeAction(parsed.action);
  return {
    assistantMessage: parsed.assistantMessage?.trim() || "Updated your search.",
    action,
    suggestedActions: parsed.suggestedActions ?? defaultSuggestions(action),
  };
}

function normalizeAction(raw?: {
  type?: string;
  patch?: Partial<NumberSearchState>;
  rerun?: boolean;
  resultId?: string;
  resultIds?: string[];
}): AiSearchAction {
  const type = raw?.type ?? "NO_SEARCH";
  if (type === "NEW_SEARCH") return { type: "NEW_SEARCH" };
  if (type === "COMPARE_RESULTS") {
    return { type: "COMPARE_RESULTS", resultIds: raw?.resultIds ?? [] };
  }
  if (type === "EXPLAIN_RESULT" && raw?.resultId) {
    return { type: "EXPLAIN_RESULT", resultId: raw.resultId };
  }
  if (type === "UPDATE_SEARCH") {
    return {
      type: "UPDATE_SEARCH",
      patch: raw?.patch ?? {},
      rerun: Boolean(raw?.rerun),
    };
  }
  return { type: "NO_SEARCH" };
}

function defaultSuggestions(action: AiSearchAction): string[] {
  if (action.type === "UPDATE_SEARCH" && action.rerun) {
    return ["cheaper", "better_patterns", "compare_top_3", "try_another_area"];
  }
  return ["cheaper", "compare_top_3", "why_this_number"];
}

function parseHeuristic(
  message: string,
  quickAction: string | undefined,
  state: NumberSearchState,
): {
  assistantMessage: string;
  action: AiSearchAction;
  suggestedActions: string[];
} | null {
  const text = (quickAction || message).toLowerCase().trim();
  const rawMessage = message.trim();

  if (text === "new_search" || text === "new search") {
    return {
      assistantMessage: "Starting a fresh search. Tell me what you're looking for.",
      action: { type: "NEW_SEARCH" },
      suggestedActions: [],
    };
  }

  if (text === "cheaper" || (text.includes("cheaper") && text.length < 24)) {
    const max = state.maxPriceCents ?? 7500;
    const nextMax = Math.max(0, max - 2500);
    return {
      assistantMessage: `Prioritizing lower-priced numbers under $${(nextMax / 100).toFixed(0)}.`,
      action: {
        type: "UPDATE_SEARCH",
        patch: { maxPriceCents: nextMax, sortBy: "price" },
        rerun: true,
      },
      suggestedActions: ["better_patterns", "compare_top_3"],
    };
  }

  if (text.includes("compare top") || quickAction === "compare_top_3") {
    return {
      assistantMessage: "I'll compare your top matches using scores and price.",
      action: { type: "COMPARE_RESULTS", resultIds: [] },
      suggestedActions: [],
    };
  }

  if (quickAction === "better_patterns") {
    return {
      assistantMessage: "Looking for cleaner, more memorable patterns.",
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          searchPrefs: [...new Set([...state.searchPrefs, "vanity", "sequential"] as const)] as import("./types").FindNumberSearchPrefId[],
          apiIntent: "number_pattern",
        },
        rerun: true,
      },
      suggestedActions: ["cheaper", "try_another_area"],
    };
  }

  const chipActions: Record<string, Partial<NumberSearchState>> = {
    vanity: {
      searchPrefs: [...new Set([...state.searchPrefs, "vanity"] as const)] as import("./types").FindNumberSearchPrefId[],
      apiIntent: "business_keyword",
      intent: "business",
    },
    "800": { numberType: "tollfree", tollFreePrefix: "800" },
    toll: { numberType: "tollfree" },
    services: { apiIntent: "business_keyword", intent: "business" },
    beautiful: { searchPrefs: [...new Set([...state.searchPrefs, "vanity"] as const)] as import("./types").FindNumberSearchPrefId[] },
    gold: { minPriceCents: 5000 },
    top: { sortBy: "score" },
    area: { numberType: "local" },
    "917": { areaCodes: [...new Set([...state.areaCodes, "917"])] },
    "212": { areaCodes: [...new Set([...state.areaCodes, "212"])] },
    local: { numberType: "local" },
    fitness: { industry: "fitness", intent: "business", apiIntent: "business_keyword" },
    "real estate": { industry: "real estate", intent: "business", apiIntent: "business_keyword" },
    "e-commerce": { industry: "e-commerce", intent: "business", apiIntent: "business_keyword" },
    healthcare: { industry: "healthcare", intent: "business", apiIntent: "business_keyword" },
    technology: { industry: "technology", intent: "business", apiIntent: "business_keyword" },
    electrician: { industry: "electrician", intent: "business", apiIntent: "business_keyword" },
    lawyers: { industry: "lawyers", intent: "business", apiIntent: "business_keyword" },
  };

  if (quickAction && chipActions[quickAction.toLowerCase()]) {
    const patch = chipActions[quickAction.toLowerCase()];
    return {
      assistantMessage: `Searching for ${quickAction} numbers in live inventory.`,
      action: { type: "UPDATE_SEARCH", patch, rerun: true },
      suggestedActions: ["cheaper", "compare_top_3", "better_patterns"],
    };
  }

  const patch: Partial<NumberSearchState> = {};
  let rerun = false;

  const underMatch = rawMessage.match(/under\s*\$?\s*(\d+)/i);
  if (underMatch) {
    patch.maxPriceCents = Number(underMatch[1]) * 100;
    patch.sortBy = "price";
    rerun = true;
  }

  const areaCodes = parseAreaCodesInput(rawMessage.replace(/under\s*\$?\s*\d+/gi, ""));
  if (areaCodes.length) {
    patch.areaCodes = [...new Set([...state.areaCodes, ...areaCodes])];
    rerun = true;
  }

  const industry = inferIndustryFromText(rawMessage);
  if (industry) {
    patch.industry = industry;
    patch.intent = "business";
    patch.apiIntent = "business_keyword";
    rerun = true;
  }

  if (/vanity|memorable|brand/i.test(rawMessage)) {
    patch.searchPrefs = [...new Set([...state.searchPrefs, "vanity"] as const)] as import("./types").FindNumberSearchPrefId[];
    patch.apiIntent = "business_keyword";
    rerun = true;
  }

  if (/\b800\b|toll[- ]?free|\b888\b|\b855\b/.test(rawMessage)) {
    patch.numberType = "tollfree";
    rerun = true;
  }

  if (rerun && Object.keys(patch).length > 0) {
    const parts: string[] = [];
    if (patch.maxPriceCents) parts.push(`under $${patch.maxPriceCents / 100}`);
    if (patch.areaCodes?.length) parts.push(`area ${patch.areaCodes.join(", ")}`);
    if (patch.industry) parts.push(`for ${patch.industry}`);
    const assistantMessage =
      parts.length > 0
        ? `Searching live inventory ${parts.join(", ")}.`
        : "Updated your search — scanning inventory now.";

    return {
      assistantMessage,
      action: { type: "UPDATE_SEARCH", patch, rerun: true },
      suggestedActions: ["cheaper", "better_patterns", "compare_top_3"],
    };
  }

  return null;
}

export async function expandIndustryKeywords(
  industry: string,
  explicit: string[],
): Promise<string[]> {
  const llm = await suggestIndustryVanityKeywords(industry);
  const merged = mergeCustomerKeywords({
    suggestedKeywords: llm.keywords,
    extraKeywords: explicit,
  });
  return merged;
}

export async function buildIndustryPatch(industryText: string): Promise<Partial<NumberSearchState>> {
  const industry =
    inferIndustryFromText(industryText) || industryText.trim().toLowerCase();
  const aiKeywords = await expandIndustryKeywords(industry, []);
  return {
    industry,
    intent: "business",
    apiIntent: "business_keyword",
    aiGeneratedKeywords: aiKeywords,
    explicitKeywords: [],
  };
}

export function applyAiAction(
  state: NumberSearchState,
  action: AiSearchAction,
): { state: NumberSearchState; searchPerformed: boolean; searchChanged: boolean } {
  if (action.type === "NEW_SEARCH") {
    return {
      state: applySearchStatePatch(state, {}),
      searchPerformed: false,
      searchChanged: true,
    };
  }
  if (action.type === "NO_SEARCH") {
    return { state, searchPerformed: false, searchChanged: false };
  }
  if (action.type === "COMPARE_RESULTS" || action.type === "EXPLAIN_RESULT") {
    return { state, searchPerformed: false, searchChanged: false };
  }
  if (action.type === "UPDATE_SEARCH") {
    const next = applySearchStatePatch(state, action.patch);
    return {
      state: next,
      searchPerformed: action.rerun,
      searchChanged: true,
    };
  }
  return { state, searchPerformed: false, searchChanged: false };
}
