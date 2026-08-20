import { getPrisma } from "@/lib/db";
import { buildProductSearchResponse } from "@/lib/premium-numbers/product-api";
import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { getPublicLandingSearchContext } from "@/lib/premium-numbers/public-landing-context";
import { serializeResultsForLog } from "@/lib/premium-numbers/reservation-service";
import { searchPremiumNumbers } from "@/lib/premium-numbers/premium-number-search";
import { searchPremiumNumbersPersonal } from "@/lib/premium-numbers/personal-search";
import type { PremiumSearchMode } from "@/lib/premium-numbers/premium-pricing";

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

function targetPriceBucket(cents: number): "499" | "999" | "1499" | "1999" | "2999plus" {
  if (cents <= 499) return "499";
  if (cents <= 999) return "999";
  if (cents <= 1499) return "1499";
  if (cents <= 1999) return "1999";
  return "2999plus";
}

/** Merchandising mix guidance — not hard quotas. */
const BUCKET_TARGETS: Record<string, number> = {
  "499": 3,
  "999": 4,
  "1499": 2,
  "1999": 1,
  "2999plus": 1,
};

function diversifyShelf(candidates: PremiumNumberProductResult[]): PremiumNumberProductResult[] {
  const personal = candidates.filter((c) => !c.displayWord);
  const business = candidates.filter((c) => Boolean(c.displayWord));

  const buckets: Record<string, PremiumNumberProductResult[]> = {
    "499": [],
    "999": [],
    "1499": [],
    "1999": [],
    "2999plus": [],
  };

  for (const c of personal) {
    buckets[targetPriceBucket(c.premiumPriceCents)].push(c);
  }

  const picked: PremiumNumberProductResult[] = [];
  const seen = new Set<string>();

  for (const [bucket, target] of Object.entries(BUCKET_TARGETS)) {
    const pool = buckets[bucket] ?? [];
    let count = 0;
    for (const item of pool) {
      if (count >= target) break;
      if (seen.has(item.phoneNumber) || removedFromShelves.has(item.phoneNumber)) continue;
      seen.add(item.phoneNumber);
      picked.push(item);
      count++;
    }
  }

  // Fill to ~10 personal if short
  for (const c of personal) {
    if (picked.length >= 10) break;
    if (seen.has(c.phoneNumber) || removedFromShelves.has(c.phoneNumber)) continue;
    seen.add(c.phoneNumber);
    picked.push(c);
  }

  // Add up to 2 business vanity
  for (const b of business) {
    if (picked.filter((p) => p.displayWord).length >= 2) break;
    if (seen.has(b.phoneNumber) || removedFromShelves.has(b.phoneNumber)) continue;
    seen.add(b.phoneNumber);
    picked.push(b);
  }

  return picked.slice(0, 12);
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

  let businessResults: PremiumNumberProductResult[] = [];
  try {
    const biz = await searchPremiumNumbers({
      areaCode: areaCodes[0],
      areaCodes: areaCodes.slice(0, 3),
      industry: "services",
      customKeywords: ["LAW", "ROOF", "MOVE", "HOME"],
      matchStyle: "both",
      limit: 20,
    });
    const product = buildProductSearchResponse({
      mode: "business",
      areaCode: areaCodes[0],
      industry: biz.industry,
      status: biz.status,
      message: biz.message,
      candidates: biz.candidates,
      keywords: biz.keywords,
    });
    businessResults = [...product.bestMatches, ...product.memorableAlternatives].slice(0, 6);
  } catch {
    // business vanity optional for shelf
  }

  const pool = [...personalPool, ...businessResults].filter(
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
