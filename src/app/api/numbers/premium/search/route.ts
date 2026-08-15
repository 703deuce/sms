import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { extractBusinessNameKeywords } from "@/lib/premium-numbers/business-name-keywords";
import { searchPremiumNumbersPersonal, type PersonalPreference } from "@/lib/premium-numbers/personal-search";
import { searchPremiumNumbers } from "@/lib/premium-numbers/premium-number-search";
import {
  buildProductSearchResponse,
  type PremiumNumberProductResult,
} from "@/lib/premium-numbers/product-api";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";
import { serializeResultsForLog } from "@/lib/premium-numbers/reservation-service";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    workspaceId?: string;
    mode?: PremiumSearchMode;
    areaCode?: string;
    industry?: string;
    businessName?: string;
    customKeywords?: string[];
    preferences?: PersonalPreference[];
    limit?: number;
  } | null;

  try {
    const workspaceId = await resolveWorkspaceId(auth.session, body?.workspaceId);
    const areaCode = String(body?.areaCode || "").trim();
    if (!/^\d{3}$/.test(areaCode)) {
      return NextResponse.json({ error: "Valid 3-digit area code required" }, { status: 400 });
    }

    const mode: PremiumSearchMode = body?.mode === "personal" ? "personal" : "business";
    const businessKeywords = extractBusinessNameKeywords(body?.businessName);
    const customKeywords = [
      ...(body?.customKeywords ?? []),
      ...businessKeywords,
    ].filter(Boolean);

    let searchResult;
    if (mode === "personal") {
      searchResult = await searchPremiumNumbersPersonal({
        areaCode,
        preferences: body?.preferences,
        limit: body?.limit ?? 80,
      });
    } else {
      searchResult = await searchPremiumNumbers({
        areaCode,
        industry: body?.industry?.trim() || undefined,
        customKeywords,
        limit: body?.limit ?? 80,
      });
    }

    const prisma = getPrisma();
    const product = buildProductSearchResponse({
      mode,
      areaCode,
      industry: body?.industry,
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
        industry: body?.industry?.trim() || null,
        keywordsJson: {
          custom: body?.customKeywords ?? [],
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
