import { getPrisma } from "@/lib/db";
import {
  mergeCustomerKeywords,
  suggestIndustryVanityKeywords,
} from "@/lib/premium-numbers/business-keyword-llm";
import { inferIndustryFromText } from "@/lib/premium-numbers/business-name-keywords";
import { buildKeywordEntries } from "@/lib/premium-numbers/industry-keywords";
import {
  searchPremiumNumbersPersonal,
  type PersonalPreference,
} from "@/lib/premium-numbers/personal-search";
import { searchPremiumNumbers } from "@/lib/premium-numbers/premium-number-search";
import {
  buildProductSearchResponse,
  type PremiumSearchProductResponse,
} from "@/lib/premium-numbers/product-api";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";
import { serializeResultsForLog } from "@/lib/premium-numbers/reservation-service";
import {
  buildSearchUiBreakdown,
  logPremiumSearchCompleted,
  providerCostFromTelnyxCost,
} from "@/lib/premium-numbers/search-observability";
import {
  type NumberType,
  type TollFreePrefix,
  resolveSearchAreaCodes,
} from "@/lib/premium-numbers/toll-free";
import type { PremiumSearchResult } from "@/lib/premium-numbers/types";

export type ExecutePremiumSearchInput = {
  workspaceId: string;
  userId: string;
  mode: PremiumSearchMode;
  areaCode?: string;
  areaCodes?: string[];
  numberType?: NumberType;
  tollFreePrefix?: TollFreePrefix;
  industry?: string;
  suggestedKeywords?: string[];
  extraKeywords?: string[];
  customKeywords?: string[];
  preferences?: PersonalPreference[];
  limit?: number;
  searchLogId?: string;
};

export type PremiumSearchSnapshot = PremiumSearchProductResponse & {
  searchStatus: "searching" | "complete";
};

type SnapshotMeta = {
  pendingProviders: string[];
  completedProviders: string[];
  currentAreaCode?: string;
  inventoryScannedCount: number;
};

export async function executePremiumSearch(
  input: ExecutePremiumSearchInput,
  options?: {
    onSnapshot?: (snapshot: PremiumSearchSnapshot) => void;
  },
): Promise<{
  product: PremiumSearchProductResponse;
  searchResult: PremiumSearchResult;
  searchLogId: string;
  areaCode: string;
  areaCodes: string[];
  keywordList: string[];
  keywordSource: string | null;
  allResults: ReturnType<typeof serializeResultsForLog>;
}> {
  const prisma = getPrisma();
  const mode = input.mode;
  const searchStarted = Date.now();
  let searchResult!: PremiumSearchResult;
  let areaCode = "";
  let areaCodes: string[] = [];
  let keywordList: string[] = [];
  let keywordSource: string | null = null;

  let keywordEntries: ReturnType<typeof buildKeywordEntries> = [];

  const persistSnapshotResults = (
    product: PremiumSearchProductResponse,
    logId?: string,
  ) => {
    if (!logId) return;
    const snapshotResults = [
      ...product.bestMatches,
      ...product.memorableAlternatives,
      ...(product.topPicks ?? []),
    ];
    void prisma.premiumNumberSearchLog
      .update({
        where: { id: logId },
        data: { resultsJson: serializeResultsForLog(snapshotResults) },
      })
      .catch(() => {
        /* log may not exist yet for brand-new searches */
      });
  };

  const emitSnapshot = (
    candidates: PremiumSearchResult["candidates"],
    status: PremiumSearchResult["status"],
    meta: SnapshotMeta,
    searchStatus: PremiumSearchSnapshot["searchStatus"],
    industry?: string,
    message?: string,
    searchLogId?: string,
  ) => {
    const product = buildProductSearchResponse({
      mode,
      areaCode,
      industry,
      status,
      message,
      candidates,
      keywords: keywordEntries,
      searchLogId,
    });
    persistSnapshotResults(product, searchLogId);
    const snapshot: PremiumSearchSnapshot = {
      ...product,
      searchLogId,
      searchStatus,
      pendingProviders: meta.pendingProviders,
      completedProviders: meta.completedProviders,
      currentAreaCode: meta.currentAreaCode,
      inventoryScannedCount: meta.inventoryScannedCount,
    };
    options?.onSnapshot?.(snapshot);
    return snapshot;
  };

  if (mode === "personal") {
    areaCodes = (input.areaCodes ?? [])
      .map((c) => c.replace(/\D/g, "").slice(0, 3))
      .filter((c) => c.length === 3);
    if (!areaCodes.length && input.areaCode) {
      const single = input.areaCode.replace(/\D/g, "").slice(0, 3);
      if (single.length === 3) areaCodes = [single];
    }
    if (!areaCodes.length) {
      throw new Error("Enter at least one 3-digit area code");
    }
    areaCode = areaCodes[0];
    keywordEntries = buildKeywordEntries({});

    searchResult = await searchPremiumNumbersPersonal(
      {
        areaCode,
        areaCodes,
        preferences: input.preferences,
        limit: input.limit ?? 80,
      },
      {
        onProgress: (progress) => {
          emitSnapshot(
            progress.candidates,
            progress.status,
            {
              pendingProviders: progress.pendingProviders,
              completedProviders: progress.completedProviders,
              currentAreaCode: progress.currentAreaCode,
              inventoryScannedCount: progress.inventoryScannedCount,
            },
            progress.pendingProviders.length > 0 ? "searching" : "searching",
            undefined,
            undefined,
            input.searchLogId,
          );
        },
      },
    );
  } else {
    const industryText = String(input.industry ?? "").trim();
    if (industryText.length < 2) {
      throw new Error("Enter your industry or type of business");
    }

    const numberType: NumberType = input.numberType === "tollfree" ? "tollfree" : "local";
    areaCodes = resolveSearchAreaCodes({
      numberType,
      areaCodes: input.areaCodes,
      areaCode: input.areaCode,
      tollFreePrefix: input.tollFreePrefix,
    });
    if (!areaCodes.length) {
      throw new Error(
        numberType === "local"
          ? "Enter at least one valid 3-digit area code"
          : "Choose a toll-free prefix",
      );
    }
    areaCode = areaCodes[0];

    const llm = await suggestIndustryVanityKeywords(industryText);
    keywordSource = llm.source;
    const customKeywords = mergeCustomerKeywords({
      suggestedKeywords: [...llm.keywords, ...(input.suggestedKeywords ?? [])],
      extraKeywords: input.extraKeywords ?? input.customKeywords,
    });
    keywordList = customKeywords;

    const industry =
      inferIndustryFromText(industryText) ||
      inferIndustryFromText(customKeywords.join(" ")) ||
      industryText;

    keywordEntries = buildKeywordEntries({
      industry,
      customKeywords,
    });

    searchResult = await searchPremiumNumbers(
      {
        areaCode,
        areaCodes,
        industry,
        customKeywords,
        matchStyle: "both",
        limit: input.limit ?? 80,
      },
      {
        onProgress: (progress) => {
          emitSnapshot(
            progress.candidates,
            progress.status,
            {
              pendingProviders: progress.pendingProviders,
              completedProviders: progress.completedProviders,
              currentAreaCode: progress.currentAreaCode,
              inventoryScannedCount: progress.inventoryScannedCount,
            },
            progress.pendingProviders.length > 0 ? "searching" : "searching",
            industry,
            undefined,
            input.searchLogId,
          );
        },
      },
    );
  }

  keywordEntries = searchResult.keywords;

  const product = buildProductSearchResponse({
    mode,
    areaCode,
    industry: searchResult.industry,
    status: searchResult.status,
    message: searchResult.message,
    candidates: searchResult.candidates,
    keywords: searchResult.keywords,
  });

  const allResults = [
    ...product.bestMatches,
    ...product.memorableAlternatives,
    ...(product.topPicks ?? []),
  ];

  const keywordsJson = {
    numberType: input.numberType ?? "local",
    areaCodes,
    tollFreePrefix: input.tollFreePrefix ?? null,
    industry: input.industry ?? null,
    suggestedKeywords: input.suggestedKeywords ?? [],
    extraKeywords: input.extraKeywords ?? input.customKeywords ?? [],
    preferences: input.preferences ?? [],
    keywordSource,
    keywords: keywordList.length ? keywordList : searchResult.keywords.map((k) => k.word),
    providerAttempts: searchResult.providerAttempts ?? [],
    searchStatus: "complete",
  };

  let searchLogId = input.searchLogId;
  if (searchLogId) {
    await prisma.premiumNumberSearchLog.update({
      where: { id: searchLogId },
      data: {
        industry: searchResult.industry ?? null,
        keywordsJson,
        businessMatchCount: product.businessMatchCount,
        memorableMatchCount: product.memorableCount,
        totalResults: product.resultCount,
        resultsJson: serializeResultsForLog(allResults),
      },
    });
  } else {
    const log = await prisma.premiumNumberSearchLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        mode: mode.toUpperCase(),
        areaCode,
        industry: searchResult.industry ?? null,
        keywordsJson,
        businessMatchCount: product.businessMatchCount,
        memorableMatchCount: product.memorableCount,
        totalResults: product.resultCount,
        resultsJson: serializeResultsForLog(allResults),
      },
    });
    searchLogId = log.id;
  }

  if (!searchLogId) {
    throw new Error("Premium search log was not created");
  }

  product.searchLogId = searchLogId;

  const finalSnapshot: PremiumSearchSnapshot = {
    ...product,
    searchLogId,
    searchStatus: "complete",
    pendingProviders: [],
    completedProviders: searchResult.providerAttempts?.map((a) => a.provider) ?? [],
    inventoryScannedCount: product.inventoryScannedCount,
  };
  options?.onSnapshot?.(finalSnapshot);

  const uiBreakdown = buildSearchUiBreakdown({
    product,
    rankedCandidates: searchResult.candidates,
  });

  logPremiumSearchCompleted({
    searchLogId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    mode,
    areaCodes,
    industry: searchResult.industry ?? input.industry ?? null,
    keywords: keywordList.length ? keywordList : searchResult.keywords.map((k) => k.word),
    keywordSource,
    status: searchResult.status,
    message: searchResult.message ?? null,
    elapsedMs: Date.now() - searchStarted,
    businessMatchCount: product.businessMatchCount,
    memorableCount: product.memorableCount,
    totalResults: product.resultCount,
    results: allResults,
    providerAttempts: searchResult.providerAttempts,
    uiBreakdown,
    inventoryCosts: searchResult.candidates.map((c) =>
      providerCostFromTelnyxCost(c.phoneNumber, c.provider ?? "telnyx", c.telnyxCost),
    ),
  });

  return {
    product: finalSnapshot,
    searchResult,
    searchLogId,
    areaCode,
    areaCodes,
    keywordList,
    keywordSource,
    allResults: serializeResultsForLog(allResults),
  };
}
