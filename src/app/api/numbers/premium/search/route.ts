import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mergeCustomerKeywords } from "@/lib/premium-numbers/business-keyword-llm";
import { inferIndustryFromText } from "@/lib/premium-numbers/business-name-keywords";
import { searchPremiumNumbersPersonal, type PersonalPreference } from "@/lib/premium-numbers/personal-search";
import { searchPremiumNumbers } from "@/lib/premium-numbers/premium-number-search";
import {
  buildProductSearchResponse,
  type PremiumNumberProductResult,
} from "@/lib/premium-numbers/product-api";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";
import { serializeResultsForLog } from "@/lib/premium-numbers/reservation-service";
import type { KeywordMatchStyle } from "@/lib/premium-numbers/telnyx-inventory-search";
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
    numberType?: NumberType;
    tollFreePrefix?: TollFreePrefix;
    matchStyle?: KeywordMatchStyle;
    primaryKeyword?: string;
    suggestedKeywords?: string[];
    extraKeywords?: string[];
    businessName?: string;
    industry?: string;
    customKeywords?: string[];
    preferences?: PersonalPreference[];
    limit?: number;
  } | null;

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const mode: PremiumSearchMode = body?.mode === "personal" ? "personal" : "business";

    let searchResult;
    let areaCode = "";
    let areaCodes: string[] = [];

    if (mode === "personal") {
      areaCode = String(body?.areaCode || "").trim();
      if (!/^\d{3}$/.test(areaCode)) {
        return NextResponse.json({ error: "Enter a valid 3-digit area code" }, { status: 400 });
      }
      searchResult = await searchPremiumNumbersPersonal({
        areaCode,
        preferences: body?.preferences,
        limit: body?.limit ?? 80,
      });
      areaCodes = [areaCode];
    } else {
      const numberType: NumberType =
        body?.numberType === "tollfree" ? "tollfree" : "local";
      areaCodes = resolveSearchAreaCodes({
        numberType,
        areaCode: body?.areaCode,
        tollFreePrefix: body?.tollFreePrefix,
      });
      if (!areaCodes.length) {
        return NextResponse.json(
          {
            error:
              numberType === "local"
                ? "Enter a valid 3-digit local area code"
                : "Choose a toll-free prefix",
          },
          { status: 400 },
        );
      }
      areaCode = areaCodes[0];

      const customKeywords = mergeCustomerKeywords({
        primaryKeyword: body?.primaryKeyword,
        suggestedKeywords: body?.suggestedKeywords,
        extraKeywords: body?.extraKeywords ?? body?.customKeywords,
        businessName: body?.businessName,
      });

      const matchStyle: KeywordMatchStyle =
        body?.matchStyle === "contains" || body?.matchStyle === "both"
          ? body.matchStyle
          : "ends_with";

      const industry =
        body?.industry?.trim() ||
        inferIndustryFromText(customKeywords.join(" ")) ||
        undefined;

      searchResult = await searchPremiumNumbers({
        areaCode,
        areaCodes,
        industry,
        customKeywords,
        primaryKeywords: body?.primaryKeyword?.trim()
          ? [body.primaryKeyword.trim()]
          : undefined,
        matchStyle,
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
          tollFreePrefix: body?.tollFreePrefix ?? null,
          matchStyle: body?.matchStyle ?? "ends_with",
          primaryKeyword: body?.primaryKeyword ?? null,
          suggestedKeywords: body?.suggestedKeywords ?? [],
          extraKeywords: body?.extraKeywords ?? body?.customKeywords ?? [],
          businessName: body?.businessName ?? null,
          preferences: body?.preferences ?? [],
        },
        businessMatchCount: product.businessMatchCount,
        memorableMatchCount: product.memorableCount,
        totalResults: product.resultCount,
        resultsJson: serializeResultsForLog(allResults),
      },
    });

    product.searchLogId = log.id;

    return NextResponse.json(product);
  } catch (err) {
    return jsonError(err, 400);
  }
}
