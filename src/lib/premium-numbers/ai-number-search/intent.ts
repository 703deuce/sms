import { extractJsonFromLlm, hasLlmConfigured, llmChatCompletion } from "@/lib/ai/llm";
import { inferIndustryFromText } from "@/lib/premium-numbers/business-name-keywords";
import {
  mergeCustomerKeywords,
  suggestIndustryVanityKeywords,
} from "@/lib/premium-numbers/business-keyword-llm";
import { parseAreaCodesInput } from "@/lib/premium-numbers/toll-free";
import { applySearchStatePatch, mergeKeywords, resetNumberSearchState } from "./state";
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
  const heuristic = parseConciergeHeuristic(input.message, input.quickAction, input.searchState);
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

function uniqueUpper(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const n = w.trim().toUpperCase();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Extract user-supplied vanity words (SPARK, WIRE, etc.) from natural language. */
export function extractExplicitKeywordsFromMessage(message: string): string[] {
  const fromList =
    message.match(/\b([A-Z]{2,8})\b/g) ?? [];
  const commaParts = message
    .split(/[,;]|\bor\b/gi)
    .map((p) => p.trim().toUpperCase())
    .filter((p) => /^[A-Z]{2,8}$/.test(p));
  return uniqueUpper([...fromList, ...commaParts]);
}

function detectAreaCodeConflict(message: string): boolean {
  const lower = message.toLowerCase();
  if (/only\s+571/.test(lower) && /only\s+240/.test(lower)) return true;
  if (lower.includes("but also only")) {
    const codes = message.match(/\b\d{3}\b/g) ?? [];
    if (codes.length >= 2) return true;
  }
  const onlyMatches = [...message.matchAll(/only\s+(?:show\s+)?(\d{3})/gi)].map((m) => m[1]);
  if (onlyMatches.length >= 2 && new Set(onlyMatches).size > 1) return true;
  return false;
}

function detectBudgetConflict(message: string): boolean {
  const under = message.match(/under\s*\$?\s*(\d+)/i);
  const atLeast =
    message.match(/at least\s*\$?\s*(\d+)/i) ?? message.match(/cost at least\s*\$?\s*(\d+)/i);
  if (under && atLeast && Number(under[1]) < Number(atLeast[1])) return true;
  return false;
}

const EXCLUDE_STOPWORDS = new Set([
  "DON",
  "LIKE",
  "SHOW",
  "WANT",
  "THOSE",
  "THEM",
  "THE",
  "OR",
  "AND",
  "NOT",
]);

function parseUpToPriceCents(message: string): number | undefined {
  const m = message.match(/up to\s*\$?\s*(\d+)/i);
  return m ? Number(m[1]) * 100 : undefined;
}

function extractExcludedKeywords(message: string): string[] {
  if (!/don'?t|remove|exclude/i.test(message)) return [];
  const caps = message.match(/\b([A-Z]{2,8})\b/g) ?? [];
  return uniqueUpper(caps);
}

/** Deterministic concierge intent — exported for controller tests. */
export function parseConciergeHeuristic(
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

  if (detectAreaCodeConflict(rawMessage)) {
    return {
      assistantMessage: "Those area-code constraints conflict. Do you want 571, 240, or both?",
      action: { type: "NO_SEARCH" },
      suggestedActions: [],
    };
  }

  if (detectBudgetConflict(rawMessage)) {
    return {
      assistantMessage:
        "Those budget constraints conflict. What maximum price should I use for this search?",
      action: { type: "NO_SEARCH" },
      suggestedActions: [],
    };
  }

  if (
    /invent|made up|fake numbers|don't have to actually|doesn't have to actually/i.test(rawMessage) &&
    /number/i.test(rawMessage)
  ) {
    return {
      assistantMessage:
        "I can only show numbers from live inventory. Tell me your area code and what you're looking for.",
      action: { type: "NO_SEARCH" },
      suggestedActions: [],
    };
  }

  if (/personal|my personal|not a business|personal cell/i.test(rawMessage)) {
    const areaCodes = parseAreaCodesInput(rawMessage);
    return {
      assistantMessage: "Searching for a memorable personal number — no business keywords.",
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          intent: "personal",
          apiIntent: "surprise_me",
          industry: undefined,
          explicitKeywords: [],
          aiGeneratedKeywords: [],
          ...(areaCodes.length ? { areaCodes } : {}),
        },
        rerun: true,
      },
      suggestedActions: ["better_patterns"],
    };
  }

  if (text === "cheaper" || text.includes("cheaper") || text.includes("lower price")) {
    const max = state.maxPriceCents ?? 10000;
    const nextMax = Math.max(2500, max - 2500);
    return {
      assistantMessage: `Prioritizing lower-priced numbers under $${(nextMax / 100).toFixed(0)} while keeping your other filters.`,
      action: {
        type: "UPDATE_SEARCH",
        patch: { maxPriceCents: nextMax, sortBy: "price" },
        rerun: true,
      },
      suggestedActions: ["better_patterns", "compare_top_3"],
    };
  }

  if (
    text.includes("better ones") ||
    text.includes("better patterns") ||
    text.includes("stronger patterns") ||
    quickAction === "better_patterns"
  ) {
    const upTo = parseUpToPriceCents(rawMessage);
    const patch: Partial<NumberSearchState> = {
      searchPrefs: [...new Set([...state.searchPrefs, "vanity", "sequential"] as const)] as import("./types").FindNumberSearchPrefId[],
      apiIntent: "number_pattern",
      sortBy: "score",
    };
    if (upTo != null) patch.maxPriceCents = upTo;
    const budgetNote =
      upTo != null ? ` up to $${(upTo / 100).toFixed(0)}` : "";
    return {
      assistantMessage: `Looking for cleaner, more memorable patterns${budgetNote}.`,
      action: {
        type: "UPDATE_SEARCH",
        patch,
        rerun: true,
      },
      suggestedActions: ["cheaper", "try_another_area"],
    };
  }

  if (
    text.includes("compare top") ||
    /compare.*top/i.test(text) ||
    quickAction === "compare_top_3"
  ) {
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

  if (/forget\s+(?:the\s+)?budget|no budget|remove budget/i.test(rawMessage)) {
    return {
      assistantMessage: "Removed the budget cap — showing the best matches across prices.",
      action: {
        type: "UPDATE_SEARCH",
        patch: { maxPriceCents: undefined },
        rerun: true,
      },
      suggestedActions: ["cheaper", "compare_top_3"],
    };
  }

  if (/toll[- ]?free/i.test(rawMessage) && /instead|try|switch/i.test(rawMessage)) {
    return {
      assistantMessage: "Switching to toll-free numbers.",
      action: {
        type: "UPDATE_SEARCH",
        patch: { numberType: "tollfree", areaCodes: [] },
        rerun: true,
      },
      suggestedActions: ["cheaper", "compare_top_3"],
    };
  }

  if (/truck wrap|on the radio|heard once/i.test(text)) {
    return {
      assistantMessage: "I'll analyze your current matches for memorability and readability.",
      action: { type: "COMPARE_RESULTS", resultIds: [] },
      suggestedActions: [],
    };
  }

  if (/find more like this|something like this/i.test(text)) {
    return {
      assistantMessage: "Searching for similar patterns in live inventory.",
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          searchPrefs: [...new Set([...state.searchPrefs, "vanity"] as const)] as import("./types").FindNumberSearchPrefId[],
          sortBy: "score",
        },
        rerun: true,
      },
      suggestedActions: ["cheaper", "compare_top_3"],
    };
  }

  if (/try\s+(\d{3})\s+too/i.test(rawMessage)) {
    const m = rawMessage.match(/try\s+(\d{3})\s+too/i);
    if (m?.[1]) {
      return {
        assistantMessage: `Added ${m[1]} while keeping your other search filters.`,
        action: {
          type: "UPDATE_SEARCH",
          patch: { areaCodes: [...new Set([...state.areaCodes, m[1]])] },
          rerun: true,
        },
        suggestedActions: ["cheaper", "compare_top_3"],
      };
    }
  }

  if (/only\s+(?:show\s+)?(\d{3})/i.test(rawMessage) || /actually,?\s+only\s+(\d{3})/i.test(rawMessage)) {
    const codes = parseAreaCodesInput(rawMessage);
    if (codes.length) {
      return {
        assistantMessage: `Narrowed to area code${codes.length > 1 ? "s" : ""} ${codes.join(", ")}.`,
        action: { type: "UPDATE_SEARCH", patch: { areaCodes: codes }, rerun: true },
        suggestedActions: ["cheaper", "better_patterns"],
      };
    }
  }

  const multiExclude = extractExcludedKeywords(rawMessage);
  if (multiExclude.length > 0 && /don'?t|remove|exclude/i.test(rawMessage)) {
    const removed = multiExclude;
    return {
      assistantMessage: `Removed ${removed.join(", ")} from this search.`,
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          explicitKeywords: state.explicitKeywords.filter((k) => !removed.includes(k)),
          aiGeneratedKeywords: state.aiGeneratedKeywords.filter((k) => !removed.includes(k)),
          excludedKeywords: [...new Set([...state.excludedKeywords, ...removed])],
        },
        rerun: true,
      },
      suggestedActions: ["better_patterns", "compare_top_3"],
    };
  }

  const removeKw =
    rawMessage.match(/don'?t\s+(?:like|show|want)\s+([A-Za-z]+)/i) ??
    rawMessage.match(/remove\s+([A-Za-z]+)/i) ??
    rawMessage.match(/exclude\s+([A-Za-z]+)/i);
  if (removeKw?.[1]) {
    const kw = removeKw[1].toUpperCase();
    return {
      assistantMessage: `Removed ${kw} from this search.`,
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          explicitKeywords: state.explicitKeywords.filter((k) => k !== kw),
          aiGeneratedKeywords: state.aiGeneratedKeywords.filter((k) => k !== kw),
          excludedKeywords: [...new Set([...state.excludedKeywords, kw])],
        },
        rerun: true,
      },
      suggestedActions: ["better_patterns", "compare_top_3"],
    };
  }

  const replaceMatch = rawMessage.match(
    /forget\s+([A-Za-z,\s]+?)\.?\s*try\s+([A-Za-z,\s]+?)(?:\s+instead)?[.!]?\s*$/i,
  );
  if (replaceMatch) {
    const remove = uniqueUpper(replaceMatch[1].split(/[,\s]+/));
    const add = uniqueUpper(
      replaceMatch[2].split(/[,\s]+/).filter((w) => /^[A-Z]{2,}$/.test(w)),
    );
    return {
      assistantMessage: `Swapped keywords — now searching ${add.join(", ")}.`,
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          explicitKeywords: [
            ...state.explicitKeywords.filter((k) => !remove.includes(k)),
            ...add,
          ],
          aiGeneratedKeywords: state.aiGeneratedKeywords.filter((k) => !remove.includes(k)),
          excludedKeywords: [...new Set([...state.excludedKeywords, ...remove])],
        },
        rerun: true,
      },
      suggestedActions: ["cheaper", "compare_top_3"],
    };
  }

  if (/roofing|roofer/i.test(rawMessage) && /instead|now find|switch/i.test(rawMessage)) {
    return {
      assistantMessage: "Switching to roofing while keeping your area and budget constraints.",
      action: {
        type: "UPDATE_SEARCH",
        patch: {
          industry: "roofing",
          intent: "business",
          apiIntent: "business_keyword",
          aiGeneratedKeywords: [],
        },
        rerun: true,
      },
      suggestedActions: ["cheaper", "better_patterns"],
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

  const explicitFromMsg = extractExplicitKeywordsFromMessage(rawMessage);
  if (explicitFromMsg.length) {
    patch.explicitKeywords = [...new Set([...state.explicitKeywords, ...explicitFromMsg])];
    patch.apiIntent = "business_keyword";
    patch.intent = "business";
    rerun = true;
  }

  if (/\b833\b/.test(rawMessage) && /toll|free|electrician/i.test(rawMessage)) {
    patch.numberType = "tollfree";
    patch.tollFreePrefix = "833";
    patch.areaCodes = [];
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
      state: resetNumberSearchState(),
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
