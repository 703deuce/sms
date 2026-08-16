import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  mergeCustomerKeywords,
  suggestIndustryVanityKeywords,
} from "@/lib/premium-numbers/business-keyword-llm";
import { inferIndustryFromText } from "@/lib/premium-numbers/business-name-keywords";
import { searchPremiumNumbersPersonal, type PersonalPreference } from "@/lib/premium-numbers/personal-search";
import { searchPremiumNumbers } from "@/lib/premium-numbers/premium-number-search";
import {
  buildProductSearchResponse,
  type PremiumNumberProductResult,
} from "@/lib/premium-numbers/product-api";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";
import { serializeResultsForLog } from "@/lib/premium-numbers/reservation-service";
import { logPremiumSearchCompleted } from "@/lib/premium-numbers/search-observability";
import {
  type NumberType,
  type TollFreePrefix,
  resolveSearchAreaCodes,
} from "@/lib/premium-numbers/toll-free";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    mode?: PremiumSearchMode;
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
  } | null;

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const mode: PremiumSearchMode = body?.mode === "personal" ? "personal" : "business";
    const searchStarted = Date.now();

    let searchResult;
    let areaCode = "";
    let areaCodes: string[] = [];
    let keywordList: string[] = [];
    let keywordSource: string | null = null;

    if (mode === "personal") {
      areaCodes = (body?.areaCodes ?? [])
        .map((c) => c.replace(/\D/g, "").slice(0, 3))
        .filter((c) => c.length === 3);
      if (!areaCodes.length && body?.areaCode) {
        const single = body.areaCode.replace(/\D/g, "").slice(0, 3);
        if (single.length === 3) areaCodes = [single];
      }
      if (!areaCodes.length) {
        return NextResponse.json({ error: "Enter at least one 3-digit area code" }, { status: 400 });
      }
      areaCode = areaCodes[0];
      searchResult = await searchPremiumNumbersPersonal({
        areaCode,
        areaCodes,
        preferences: body?.preferences,
        limit: body?.limit ?? 80,
      });
    } else {
      const industryText = String(body?.industry ?? "").trim();
      if (industryText.length < 2) {
        return NextResponse.json(
          { error: "Enter your industry or type of business" },
          { status: 400 },
        );
      }

      const numberType: NumberType =
        body?.numberType === "tollfree" ? "tollfree" : "local";
      areaCodes = resolveSearchAreaCodes({
        numberType,
        areaCodes: body?.areaCodes,
        areaCode: body?.areaCode,
        tollFreePrefix: body?.tollFreePrefix,
      });
      if (!areaCodes.length) {
        return NextResponse.json(
          {
            error:
              numberType === "local"
                ? "Enter at least one valid 3-digit area code"
                : "Choose a toll-free prefix",
          },
          { status: 400 },
        );
      }
      areaCode = areaCodes[0];

      const llm = await suggestIndustryVanityKeywords(industryText);
      keywordSource = llm.source;
      const userSuggested = body?.suggestedKeywords ?? [];
      const customKeywords = mergeCustomerKeywords({
        suggestedKeywords: [...llm.keywords, ...userSuggested],
        extraKeywords: body?.extraKeywords ?? body?.customKeywords,
      });
      keywordList = customKeywords;

      const industry =
        inferIndustryFromText(industryText) ||
        inferIndustryFromText(customKeywords.join(" ")) ||
        industryText;

      // Backend: ends_with + contains Telnyx queries; scoring ranks word-at-end higher.
      searchResult = await searchPremiumNumbers({
        areaCode,
        areaCodes,
        industry,
        customKeywords,
        matchStyle: "both",
        limit: body?.limit ?? 80,
      });
    }

    const prisma = getPrisma();
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

    const log = await prisma.premiumNumberSearchLog.create({
      data: {
        workspaceId,
        userId: auth.session.userId,
        mode: mode.toUpperCase(),
        areaCode,
        industry: searchResult.industry ?? null,
        keywordsJson: {
          numberType: body?.numberType ?? "local",
          areaCodes,
          tollFreePrefix: body?.tollFreePrefix ?? null,
          industry: body?.industry ?? null,
          suggestedKeywords: body?.suggestedKeywords ?? [],
          extraKeywords: body?.extraKeywords ?? body?.customKeywords ?? [],
          preferences: body?.preferences ?? [],
          keywordSource,
          keywords: keywordList.length ? keywordList : searchResult.keywords.map((k) => k.word),
          providerAttempts: searchResult.providerAttempts ?? [],
        },
        businessMatchCount: product.businessMatchCount,
        memorableMatchCount: product.memorableCount,
        totalResults: product.resultCount,
        resultsJson: serializeResultsForLog(allResults),
      },
    });

    product.searchLogId = log.id;

    logPremiumSearchCompleted({
      searchLogId: log.id,
      workspaceId,
      userId: auth.session.userId,
      mode,
      areaCodes,
      industry: searchResult.industry ?? body?.industry ?? null,
      keywords: keywordList.length
        ? keywordList
        : searchResult.keywords.map((k) => k.word),
      keywordSource,
      status: searchResult.status,
      message: searchResult.message ?? null,
      elapsedMs: Date.now() - searchStarted,
      businessMatchCount: product.businessMatchCount,
      memorableCount: product.memorableCount,
      totalResults: product.resultCount,
      results: allResults,
      providerAttempts: searchResult.providerAttempts,
    });

    return NextResponse.json(product);
  } catch (err) {
    return jsonError(err, 400);
  }
}
