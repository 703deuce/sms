import { subDays, startOfDay } from "date-fns";
import type { createServiceClient } from "@/lib/db/client";
import { dedupeKey, hasOwnerResponse, type NormalizedReview } from "@/lib/reviews/normalize";
import { extractThemeTagsFromText } from "@/lib/reviews/review-themes";

type Supabase = ReturnType<typeof createServiceClient>;

/** Columns needed for list/UI metrics — excludes bulky raw_json. */
export const REVIEW_LIST_COLUMNS =
  "id, organization_id, business_id, competitor_id, source_provider, source_review_id, reviewer_name, rating, review_text, review_date, published_at, last_edited_at, first_observed_at, last_observed_at, owner_responded_at, date_precision, is_deleted, absent_pull_count, relative_date_text, owner_response_text, review_url, resolved_at, created_at, updated_at";

export type StoredReviewRow = {
  id: string;
  organization_id: string;
  business_id: string | null;
  competitor_id: string | null;
  source_provider: string;
  source_review_id: string | null;
  reviewer_name: string | null;
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  published_at?: string | null;
  last_edited_at?: string | null;
  first_observed_at?: string | null;
  last_observed_at?: string | null;
  owner_responded_at?: string | null;
  date_precision?: string | null;
  is_deleted?: boolean | null;
  absent_pull_count?: number | null;
  relative_date_text: string | null;
  owner_response_text: string | null;
  review_url: string | null;
  resolved_at?: string | null;
  raw_json?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export function storedRowToNormalized(row: StoredReviewRow): NormalizedReview {
  const publishedAt = row.published_at
    ? new Date(row.published_at)
    : row.review_date
      ? startOfDay(new Date(row.review_date))
      : null;
  return {
    sourceReviewId: row.source_review_id,
    reviewerName: row.reviewer_name,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate: publishedAt ? startOfDay(publishedAt) : null,
    publishedAt,
    lastEditedAt: row.last_edited_at ? new Date(row.last_edited_at) : null,
    datePrecision: (row.date_precision as NormalizedReview["datePrecision"]) ?? "unknown",
    relativeDateText: row.relative_date_text,
    ownerResponseText: row.owner_response_text,
    ownerRespondedAt: row.owner_responded_at ? new Date(row.owner_responded_at) : null,
    reviewUrl: row.review_url,
    raw: row.raw_json ?? {},
  };
}

export async function loadKnownReviewIds(
  supabase: Supabase,
  params: { businessId?: string | null; competitorId?: string | null }
): Promise<Set<string>> {
  const ids = new Set<string>();
  let query = supabase.from("business_reviews").select("source_review_id").not("source_review_id", "is", null);
  if (params.businessId) query = query.eq("business_id", params.businessId);
  else if (params.competitorId) query = query.eq("competitor_id", params.competitorId);
  else return ids;

  const { data } = await query.limit(5000);
  for (const row of data ?? []) {
    if (row.source_review_id) ids.add(row.source_review_id);
  }
  return ids;
}

/**
 * Batch upsert on migration 027 unique indexes:
 * - (business_id, source_provider, source_review_id)
 * - (competitor_id, source_provider, source_review_id)
 */
export async function upsertReviews(
  supabase: Supabase,
  params: {
    organizationId: string;
    businessId?: string | null;
    competitorId?: string | null;
    provider: string;
    reviews: NormalizedReview[];
    entityKey: string;
    reconcileAbsent?: boolean;
    observedSourceIds?: string[];
    softDeleteAfterPulls?: number;
  }
): Promise<{ inserted: number; updated: number }> {
  const entityId = params.businessId ?? params.competitorId;
  if (!entityId) {
    return { inserted: 0, updated: 0 };
  }

  const now = new Date().toISOString();
  if (!params.reviews.length) {
    if (params.reconcileAbsent) {
      await reconcileAbsentReviews(supabase, {
        businessId: params.businessId,
        competitorId: params.competitorId,
        provider: params.provider,
        observedSourceIds: params.observedSourceIds ?? [],
        softDeleteAfterPulls: params.softDeleteAfterPulls,
      });
    }
    return { inserted: 0, updated: 0 };
  }

  type UpsertPayload = ReviewUpsertRow & {
    published_at: string | null;
    last_edited_at: string | null;
    first_observed_at: string;
    last_observed_at: string;
    owner_responded_at: string | null;
    date_precision: string;
    is_deleted: boolean;
    absent_pull_count: number;
  };

  const bySourceId = new Map<string, UpsertPayload>();

  for (const review of params.reviews) {
    const sourceReviewId = review.sourceReviewId ?? dedupeKey(review, params.entityKey).slice(0, 120);
    const publishedIso =
      review.publishedAt?.toISOString() ??
      (review.reviewDate ? review.reviewDate.toISOString() : null);
    bySourceId.set(sourceReviewId, {
      organization_id: params.organizationId,
      business_id: params.businessId ?? null,
      competitor_id: params.competitorId ?? null,
      source_provider: params.provider,
      source_review_id: sourceReviewId,
      reviewer_name: review.reviewerName,
      rating: review.rating,
      review_text: review.reviewText,
      review_date: review.reviewDate ? review.reviewDate.toISOString().slice(0, 10) : null,
      relative_date_text: review.relativeDateText,
      owner_response_text: review.ownerResponseText,
      review_url: review.reviewUrl,
      raw_json: review.raw,
      updated_at: now,
      published_at: publishedIso,
      last_edited_at: review.lastEditedAt?.toISOString() ?? null,
      first_observed_at: now,
      last_observed_at: now,
      owner_responded_at: review.ownerRespondedAt?.toISOString() ?? null,
      date_precision: review.datePrecision ?? "unknown",
      is_deleted: false,
      absent_pull_count: 0,
    });
  }

  const sourceIds = Array.from(bySourceId.keys());

  let existingQuery = supabase
    .from("business_reviews")
    .select(
      "id, source_review_id, published_at, first_observed_at, date_precision, rating, review_text, owner_response_text"
    )
    .eq("source_provider", params.provider)
    .in("source_review_id", sourceIds);

  if (params.businessId) existingQuery = existingQuery.eq("business_id", params.businessId);
  else existingQuery = existingQuery.eq("competitor_id", params.competitorId!);

  const { data: existingRows } = await existingQuery;
  const existingBySource = new Map(
    (existingRows ?? [])
      .filter((r) => r.source_review_id)
      .map((r) => [r.source_review_id as string, r])
  );
  const existingSet = new Set(existingBySource.keys());

  // Never replace published_at / first_observed_at on update; preserve exact dates.
  for (const [sourceId, row] of bySourceId) {
    const prior = existingBySource.get(sourceId);
    if (!prior) continue;
    if (prior.published_at) row.published_at = prior.published_at as string;
    if (prior.first_observed_at) row.first_observed_at = prior.first_observed_at as string;
    if (prior.date_precision === "exact") row.date_precision = "exact";
  }

  const rows = Array.from(bySourceId.values());

  const onConflict = params.businessId
    ? "business_id,source_provider,source_review_id"
    : "competitor_id,source_provider,source_review_id";

  // Chunk to keep payloads bounded on large syncs.
  // Requires non-partial unique indexes (migration 064). Partial indexes from
  // 027 are invisible to PostgREST ON CONFLICT and fail with:
  // "there is no unique or exclusion constraint matching the ON CONFLICT specification".
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("business_reviews").upsert(chunk, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) {
      if (/no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message)) {
        await upsertReviewsRowByRow(supabase, chunk, {
          businessId: params.businessId,
          competitorId: params.competitorId,
          provider: params.provider,
        });
        continue;
      }
      throw new Error(error.message);
    }
  }

  const updated = rows.filter((r) => existingSet.has(r.source_review_id)).length;
  const inserted = rows.length - updated;

  // Snapshot rows that changed text/rating/response for history.
  try {
    const changed = rows.filter((r) => {
      const prior = existingBySource.get(r.source_review_id);
      if (!prior) return true;
      return (
        String(prior.rating ?? "") !== String(r.rating ?? "") ||
        String(prior.review_text ?? "") !== String(r.review_text ?? "") ||
        String(prior.owner_response_text ?? "") !== String(r.owner_response_text ?? "")
      );
    });
    if (changed.length) {
      const ids = changed.map((r) => r.source_review_id);
      let idQuery = supabase
        .from("business_reviews")
        .select("id, organization_id, business_id, competitor_id, source_provider, source_review_id, rating, review_text, published_at, last_edited_at, owner_response_text, owner_responded_at, relative_date_text, raw_json")
        .eq("source_provider", params.provider)
        .in("source_review_id", ids);
      if (params.businessId) idQuery = idQuery.eq("business_id", params.businessId);
      else idQuery = idQuery.eq("competitor_id", params.competitorId!);
      const { data: fresh } = await idQuery;
      if (fresh?.length) {
        await supabase.from("business_review_snapshots").insert(
          fresh.map((row) => ({
            review_id: row.id,
            organization_id: row.organization_id,
            business_id: row.business_id,
            competitor_id: row.competitor_id,
            source_provider: row.source_provider,
            source_review_id: row.source_review_id,
            rating: row.rating,
            review_text: row.review_text,
            published_at: row.published_at,
            last_edited_at: row.last_edited_at,
            owner_response_text: row.owner_response_text,
            owner_responded_at: row.owner_responded_at,
            relative_date_text: row.relative_date_text,
            raw_json: row.raw_json ?? {},
            observed_at: now,
          }))
        );
      }
    }
  } catch {
    /* snapshots are best-effort until migration is applied */
  }

  // Soft attribution pass after new reviews land (never invents confirmed).
  if (params.businessId && inserted > 0) {
    try {
      const { attributeRecentReviewsForBusiness } = await import(
        "@/lib/reputation/attribution"
      );
      await attributeRecentReviewsForBusiness({
        businessId: params.businessId,
        organizationId: params.organizationId,
      });
    } catch {
      /* non-blocking */
    }
  }

  const knownIds = sourceIds.filter(Boolean).slice(0, 500);

  await updateSyncState(supabase, {
    organizationId: params.organizationId,
    businessId: params.businessId,
    competitorId: params.competitorId,
    knownReviewIds: knownIds,
    lastSyncAt: now,
    lastReviewDateSeen: params.reviews.find((r) => r.reviewDate)?.reviewDate?.toISOString().slice(0, 10) ?? null,
  });

  if (params.reconcileAbsent) {
    await reconcileAbsentReviews(supabase, {
      businessId: params.businessId,
      competitorId: params.competitorId,
      provider: params.provider,
      observedSourceIds: params.observedSourceIds ?? sourceIds,
      softDeleteAfterPulls: params.softDeleteAfterPulls,
    });
  }

  return { inserted, updated };
}

export async function reconcileAbsentReviews(
  supabase: Supabase,
  params: {
    businessId?: string | null;
    competitorId?: string | null;
    provider: string;
    observedSourceIds: string[];
    softDeleteAfterPulls?: number;
  }
): Promise<{ observed: number; absent: number; softDeleted: number }> {
  const entityId = params.businessId ?? params.competitorId;
  if (!entityId) return { observed: 0, absent: 0, softDeleted: 0 };

  const threshold = params.softDeleteAfterPulls ?? 3;
  const now = new Date().toISOString();
  const observedIds = Array.from(new Set(params.observedSourceIds.filter(Boolean)));

  const chunkSize = 200;
  for (let i = 0; i < observedIds.length; i += chunkSize) {
    const chunk = observedIds.slice(i, i + chunkSize);
    let updateObserved = supabase
      .from("business_reviews")
      .update({
        absent_pull_count: 0,
        is_deleted: false,
        last_observed_at: now,
        updated_at: now,
      })
      .eq("source_provider", params.provider)
      .in("source_review_id", chunk);
    if (params.businessId) updateObserved = updateObserved.eq("business_id", params.businessId);
    else updateObserved = updateObserved.eq("competitor_id", params.competitorId!);
    const { error } = await updateObserved;
    if (error) throw new Error(error.message);
  }

  let candidateQuery = supabase
    .from("business_reviews")
    .select("id, source_review_id, absent_pull_count")
    .eq("source_provider", params.provider)
    .not("source_review_id", "is", null)
    .limit(10000);
  if (params.businessId) candidateQuery = candidateQuery.eq("business_id", params.businessId);
  else candidateQuery = candidateQuery.eq("competitor_id", params.competitorId!);

  const { data: candidates, error: candidateError } = await candidateQuery;
  if (candidateError) throw new Error(candidateError.message);

  const observedSet = new Set(observedIds);
  const absentRows = (candidates ?? []).filter((row) => !observedSet.has(String(row.source_review_id ?? "")));
  const softDeleteIds: string[] = [];
  const keepIds: string[] = [];

  for (const row of absentRows) {
    const nextAbsentCount = Number(row.absent_pull_count ?? 0) + 1;
    if (nextAbsentCount >= threshold) softDeleteIds.push(row.id);
    else keepIds.push(row.id);
  }

  for (let i = 0; i < keepIds.length; i += chunkSize) {
    const chunk = keepIds.slice(i, i + chunkSize);
    const rows = absentRows.filter((row) => chunk.includes(row.id));
    for (const row of rows) {
      const { error } = await supabase
        .from("business_reviews")
        .update({
          absent_pull_count: Number(row.absent_pull_count ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  for (let i = 0; i < softDeleteIds.length; i += chunkSize) {
    const chunk = softDeleteIds.slice(i, i + chunkSize);
    const rows = absentRows.filter((row) => chunk.includes(row.id));
    for (const row of rows) {
      const { error } = await supabase
        .from("business_reviews")
        .update({
          absent_pull_count: Number(row.absent_pull_count ?? 0) + 1,
          is_deleted: true,
          updated_at: now,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  return {
    observed: observedIds.length,
    absent: absentRows.length,
    softDeleted: softDeleteIds.length,
  };
}

type ReviewUpsertRow = {
  organization_id: string;
  business_id: string | null;
  competitor_id: string | null;
  source_provider: string;
  source_review_id: string;
  reviewer_name: string | null;
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  relative_date_text: string | null;
  owner_response_text: string | null;
  review_url: string | null;
  raw_json: Record<string, unknown>;
  updated_at: string;
  published_at?: string | null;
  last_edited_at?: string | null;
  first_observed_at?: string;
  last_observed_at?: string;
  owner_responded_at?: string | null;
  date_precision?: string;
  is_deleted?: boolean;
  absent_pull_count?: number;
};

/**
 * Fallback when the DB still has partial unique indexes (pre-064) that PostgREST
 * cannot target with ON CONFLICT. Match by natural key and update or insert.
 */
async function upsertReviewsRowByRow(
  supabase: Supabase,
  rows: ReviewUpsertRow[],
  params: {
    businessId?: string | null;
    competitorId?: string | null;
    provider: string;
  }
): Promise<void> {
  for (const row of rows) {
    let existingQuery = supabase
      .from("business_reviews")
      .select("id")
      .eq("source_provider", params.provider)
      .eq("source_review_id", row.source_review_id)
      .limit(1);
    if (params.businessId) existingQuery = existingQuery.eq("business_id", params.businessId);
    else existingQuery = existingQuery.eq("competitor_id", params.competitorId!);

    const { data: existing, error: selectError } = await existingQuery.maybeSingle();
    if (selectError) throw new Error(selectError.message);

    if (existing?.id) {
      const { error } = await supabase
        .from("business_reviews")
        .update(row)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("business_reviews").insert(row);
      if (error) throw new Error(error.message);
    }
  }
}

async function updateSyncState(
  supabase: Supabase,
  params: {
    organizationId: string;
    businessId?: string | null;
    competitorId?: string | null;
    knownReviewIds: string[];
    lastSyncAt: string;
    lastReviewDateSeen: string | null;
  }
) {
  const entityId = params.businessId ?? params.competitorId;
  if (!entityId) return;

  const conflictCol = params.businessId ? "business_id" : "competitor_id";

  let existingQuery = supabase.from("review_sync_state").select("known_review_ids");
  if (params.businessId) existingQuery = existingQuery.eq("business_id", params.businessId);
  else existingQuery = existingQuery.eq("competitor_id", params.competitorId!);

  const { data: existing } = await existingQuery.maybeSingle();

  const mergedIds = Array.from(
    new Set([...(existing?.known_review_ids as string[] | undefined ?? []), ...params.knownReviewIds])
  ).slice(-500);

  const row = {
    organization_id: params.organizationId,
    business_id: params.businessId ?? null,
    competitor_id: params.competitorId ?? null,
    last_sync_at: params.lastSyncAt,
    last_review_date_seen: params.lastReviewDateSeen,
    known_review_ids: mergedIds,
    updated_at: params.lastSyncAt,
  };

  const { error } = await supabase.from("review_sync_state").upsert(row, {
    onConflict: conflictCol,
    ignoreDuplicates: false,
  });
  if (error) {
    if (/no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message)) {
      // Pre-064 partial unique indexes — update-or-insert by entity id.
      let existingQuery = supabase.from("review_sync_state").select("id");
      if (params.businessId) existingQuery = existingQuery.eq("business_id", params.businessId);
      else existingQuery = existingQuery.eq("competitor_id", params.competitorId!);
      const { data: existingRow, error: selectError } = await existingQuery.maybeSingle();
      if (selectError) throw new Error(selectError.message);
      if (existingRow?.id) {
        const { error: updateError } = await supabase
          .from("review_sync_state")
          .update(row)
          .eq("id", existingRow.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase.from("review_sync_state").insert(row);
        if (insertError) throw new Error(insertError.message);
      }
      return;
    }
    throw new Error(error.message);
  }
}

export async function loadStoredReviews(
  supabase: Supabase,
  params: {
    businessId?: string | null;
    competitorId?: string | null;
    competitorIds?: string[];
    lookbackDays?: number;
    limit?: number;
    /** When true, also select raw_json (default: omit for lean list payloads). */
    includeRaw?: boolean;
    /** When true, include soft-deleted reviews. Default false. */
    includeDeleted?: boolean;
  }
): Promise<StoredReviewRow[]> {
  const lookbackDays = params.lookbackDays ?? 90;
  const cutoffDate = subDays(new Date(), lookbackDays).toISOString().slice(0, 10);
  const cutoffTs = subDays(new Date(), lookbackDays).toISOString();

  const selectCols = params.includeRaw
    ? `${REVIEW_LIST_COLUMNS}, raw_json`
    : REVIEW_LIST_COLUMNS;

  let query = supabase
    .from("business_reviews")
    .select(selectCols)
    // Prefer published_at when present; also accept legacy review_date rows.
    .or(`published_at.gte.${cutoffTs},and(published_at.is.null,review_date.gte.${cutoffDate})`)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (!params.includeDeleted) {
    // Graceful if migration 077 not applied yet — PostgREST may error on missing column.
    query = query.or("is_deleted.is.null,is_deleted.eq.false");
  }

  if (params.businessId) {
    query = query.eq("business_id", params.businessId);
  } else if (params.competitorId) {
    query = query.eq("competitor_id", params.competitorId);
  } else if (params.competitorIds?.length) {
    query = query.in("competitor_id", params.competitorIds);
  } else {
    return [];
  }

  if (params.limit) query = query.limit(params.limit);
  const { data, error } = await query;
  if (error) {
    // Fallback for DBs without published_at / is_deleted columns yet.
    if (/column .* does not exist|schema cache/i.test(error.message)) {
      let legacy = supabase
        .from("business_reviews")
        .select(
          params.includeRaw
            ? "id, organization_id, business_id, competitor_id, source_provider, source_review_id, reviewer_name, rating, review_text, review_date, relative_date_text, owner_response_text, review_url, created_at, updated_at, raw_json"
            : "id, organization_id, business_id, competitor_id, source_provider, source_review_id, reviewer_name, rating, review_text, review_date, relative_date_text, owner_response_text, review_url, created_at, updated_at"
        )
        .gte("review_date", cutoffDate)
        .order("review_date", { ascending: false });
      if (params.businessId) legacy = legacy.eq("business_id", params.businessId);
      else if (params.competitorId) legacy = legacy.eq("competitor_id", params.competitorId);
      else if (params.competitorIds?.length) legacy = legacy.in("competitor_id", params.competitorIds);
      if (params.limit) legacy = legacy.limit(params.limit);
      const { data: legacyData } = await legacy;
      return (legacyData ?? []) as unknown as StoredReviewRow[];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as unknown as StoredReviewRow[];
}

export function reviewsInWindow(rows: StoredReviewRow[], days: number): StoredReviewRow[] {
  const cutoff = startOfDay(subDays(new Date(), days));
  return rows.filter((r) => {
    if (r.is_deleted) return false;
    const raw = r.published_at ?? r.review_date;
    if (!raw) return false;
    return startOfDay(new Date(raw)) >= cutoff;
  });
}

export function calcResponseRate(rows: StoredReviewRow[]): number {
  if (!rows.length) return 0;
  const replied = rows.filter((r) => hasOwnerResponse(r.owner_response_text)).length;
  return Math.round((replied / rows.length) * 100);
}

export function calcAvgRating(rows: StoredReviewRow[]): number | null {
  const rated = rows.filter((r) => r.rating != null);
  if (!rated.length) return null;
  const sum = rated.reduce((acc, r) => acc + Number(r.rating), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

export function extractTagsFromText(text: string | null, limit = 3): string[] {
  return extractThemeTagsFromText(text, limit);
}
