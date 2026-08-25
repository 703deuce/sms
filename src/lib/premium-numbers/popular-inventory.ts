import { getPrisma } from "@/lib/db";
import {
  buildProductSearchResponse,
  merchandisePersonalResults,
} from "@/lib/premium-numbers/product-api";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { getPublicLandingSearchContext } from "@/lib/premium-numbers/public-landing-context";
import { serializeResultsForLog } from "@/lib/premium-numbers/reservation-service";
import { searchPremiumNumbersPersonal } from "@/lib/premium-numbers/personal-search";

type ShelfCacheEntry = {
  items: PremiumNumberProductResult[];
  searchLogId?: string;
  expiresAt: number;
  marketSlug: string;
};

const shelfCache = new Map<string, ShelfCacheEntry>();
const SHELF_CACHE_TTL_MS = 15 * 60 * 1000;

/** Reserved/sold numbers removed from cached shelves immediately. */
const removedFromShelves = new Set<string>();

export function invalidatePopularShelfNumber(phoneNumber: string) {
  removedFromShelves.add(phoneNumber);
  for (const key of shelfCache.keys()) {
    const entry = shelfCache.get(key);
    if (!entry) continue;
    const filtered = entry.items.filter((i) => i.phoneNumber !== phoneNumber);
    if (filtered.length !== entry.items.length) {
      shelfCache.set(key, { ...entry, items: filtered });
    }
  }
}

function diversifyShelf(candidates: PremiumNumberProductResult[]): PremiumNumberProductResult[] {
  return merchandisePersonalResults(
    candidates.filter((candidate) => !removedFromShelves.has(candidate.phoneNumber)),
    { limit: 12 },
  );
}

async function fetchPersonalPoolForAreaCodes(areaCodes: string[]): Promise<PremiumNumberProductResult[]> {
  const primary = areaCodes[0];
  if (!primary) return [];

  const personalResults = await searchPremiumNumbersPersonal({
    areaCode: primary,
    areaCodes,
    preferences: ["surprise_me"],
    limit: 60,
  });

  const personalProduct = buildProductSearchResponse({
    mode: "personal",
    areaCode: primary,
    status: personalResults.status,
    message: personalResults.message,
    candidates: personalResults.candidates,
    keywords: personalResults.keywords,
  });

  return [...(personalProduct.topPicks ?? []), ...(personalProduct.memorableAlternatives ?? [])];
}

async function fetchNationwidePool(areaCodes: string[]): Promise<PremiumNumberProductResult[]> {
  const codes = areaCodes.slice(0, 6);
  const perCode = await Promise.all(
    codes.map(async (areaCode) => {
      try {
        return await fetchPersonalPoolForAreaCodes([areaCode]);
      } catch {
        return [];
      }
    }),
  );
  return perCode.flat();
}

export type GetPopularInventoryInput = {
  areaCodes: string[];
  marketSlug: string;
  maxResults?: number;
};

export async function getPopularInventory(
  input: GetPopularInventoryInput,
): Promise<{ items: PremiumNumberProductResult[]; searchLogId?: string }> {
  const cacheKey = `popular:${input.marketSlug}`;
  const cached = shelfCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      items: cached.items.slice(0, input.maxResults ?? 12),
      searchLogId: cached.searchLogId,
    };
  }

  const areaCodes = input.areaCodes.slice(0, input.marketSlug === "generic" ? 6 : 3);
  if (!areaCodes.length) return { items: [] };

  const personalPool =
    input.marketSlug === "generic" && areaCodes.length > 1
      ? await fetchNationwidePool(areaCodes)
      : await fetchPersonalPoolForAreaCodes(areaCodes);

  const pool = personalPool.filter(
    (r) => !removedFromShelves.has(r.phoneNumber),
  );

  const shelf = diversifyShelf(pool);

  let searchLogId: string | undefined;
  try {
    const ctx = await getPublicLandingSearchContext();
    const prisma = getPrisma();
    const log = await prisma.premiumNumberSearchLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        mode: "PERSONAL",
        areaCode: areaCodes[0],
        keywordsJson: { source: "top_picks_shelf", marketSlug: input.marketSlug, areaCodes },
        businessMatchCount: 0,
        memorableMatchCount: shelf.length,
        totalResults: shelf.length,
        resultsJson: serializeResultsForLog(shelf),
      },
    });
    searchLogId = log.id;
  } catch {
    // shelf still usable for browse without reserve log
  }

  shelfCache.set(cacheKey, {
    items: shelf,
    searchLogId,
    expiresAt: Date.now() + SHELF_CACHE_TTL_MS,
    marketSlug: input.marketSlug,
  });

  return {
    items: shelf.slice(0, input.maxResults ?? 12),
    searchLogId,
  };
}

export function clearPopularShelfCache(marketSlug?: string) {
  if (marketSlug) {
    shelfCache.delete(`popular:${marketSlug}`);
    return;
  }
  shelfCache.clear();
}
