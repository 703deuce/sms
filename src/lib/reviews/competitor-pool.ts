/**
 * Competitor pool builder extracted from LSE grid scan results.
 * Grid-ranking product is excluded from Transovo; this module only aggregates
 * scan_results when explicit scan data is provided (optional for Velocity).
 */

export type AggregatedCompetitor = {
  name: string;
  cid?: string | null;
  place_id?: string | null;
  category?: string | null;
  score?: number;
  appearances?: number;
  avg_rank?: number | null;
  distance_m?: number | null;
};

type ScanResultRow = {
  top_competitors_json?: unknown;
  scan_point_id?: string;
  keyword_id?: string | null;
};

type ScanPointRow = {
  id: string;
  distance_from_center_m?: number | null;
  grid_label?: string | null;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCompetitorsJson(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === "object" && raw !== null && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: Array<Record<string, unknown>> }).items;
  }
  return [];
}

/**
 * Build ranked competitor candidates from scan cell JSON (when scan batch exists).
 * Returns empty when results are missing — target-only velocity still runs.
 */
export function buildReviewMomentumCompetitorPool(
  results: ScanResultRow[],
  opts: {
    excludeCid?: string | null;
    excludePlaceId?: string | null;
    excludeName?: string | null;
    targetCategory?: string | null;
    keyword?: string | null;
    locationTokens?: string[];
    scanPoints?: ScanPointRow[];
    primaryKeywordId?: string | null;
    limit?: number;
  },
): AggregatedCompetitor[] {
  const limit = opts.limit ?? 12;
  const excludeName = opts.excludeName ? normalizeName(opts.excludeName) : null;
  const byKey = new Map<string, AggregatedCompetitor & { score: number }>();

  const pointDistance = new Map<string, number | null>();
  for (const p of opts.scanPoints ?? []) {
    pointDistance.set(p.id, p.distance_from_center_m ?? null);
  }

  for (const row of results) {
    if (opts.primaryKeywordId && row.keyword_id && row.keyword_id !== opts.primaryKeywordId) {
      continue;
    }
    const distance = row.scan_point_id ? pointDistance.get(row.scan_point_id) ?? null : null;
    for (const comp of parseCompetitorsJson(row.top_competitors_json)) {
      const name = String(comp.name ?? comp.title ?? "").trim();
      if (!name) continue;
      if (excludeName && normalizeName(name) === excludeName) continue;
      const cid = (comp.cid as string) ?? (comp.data_id as string) ?? null;
      const placeId = (comp.place_id as string) ?? null;
      if (opts.excludeCid && cid && opts.excludeCid === cid) continue;
      if (opts.excludePlaceId && placeId && opts.excludePlaceId === placeId) continue;
      const key = placeId || cid || normalizeName(name);
      const rank = typeof comp.rank === "number" ? comp.rank : null;
      const bump = rank != null ? Math.max(0, 25 - rank) : 1;
      const existing = byKey.get(key);
      if (existing) {
        existing.score += bump;
        existing.appearances = (existing.appearances ?? 0) + 1;
        if (distance != null) {
          existing.distance_m =
            existing.distance_m == null ? distance : Math.min(existing.distance_m, distance);
        }
      } else {
        byKey.set(key, {
          name,
          cid,
          place_id: placeId,
          category: (comp.category as string) ?? opts.targetCategory ?? null,
          score: bump,
          appearances: 1,
          avg_rank: rank,
          distance_m: distance,
        });
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}
