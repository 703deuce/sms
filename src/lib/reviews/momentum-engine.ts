import { createServiceClient } from "@/lib/db/client";
import { buildReviewMomentumCompetitorPool } from "@/lib/maps/grid";
import { assertScanBelongsToBusiness } from "@/lib/db/queries";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import { enrichTargetBusiness } from "@/lib/jobs/enrich-competitors";
import { fetchReviewsForEntity } from "@/lib/reviews/fetch-reviews";
import type { NormalizedReview } from "@/lib/reviews/normalize";
import {
  loadKnownReviewIds,
  loadStoredReviews,
  storedRowToNormalized,
  upsertReviews,
} from "@/lib/reviews/review-store";
import {
  applyGapAndTargets,
  calcEntityMetrics,
  type EntityMomentumMetrics,
} from "@/lib/reviews/metrics";
import { buildMarketInsights, type MarketInsights } from "@/lib/reviews/market-insights";
import {
  fallbackReviewMomentumTasks,
  generateReviewMomentumAnalysis,
} from "@/lib/providers/deepseek/review-momentum";

export interface MomentumEntityRow {
  id: string;
  entityType: "target" | "competitor";
  name: string;
  businessId?: string | null;
  competitorId?: string | null;
  metrics: EntityMomentumMetrics;
  unavailable?: boolean;
  velocityWarning?: string | null;
}

export interface MomentumRunResult {
  runId: string;
  status: string;
  warnings: string[];
  aiSummary: string | null;
  entities: MomentumEntityRow[];
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    impact: string;
    effort: string;
    status: string;
  }>;
  topCompetitor30d: number;
  reviewGap: number;
  recommendedWeeklyTarget: number;
  marketInsights?: MarketInsights;
}

async function upsertCompetitor(
  supabase: ReturnType<typeof createServiceClient>,
  comp: { name?: string; cid?: string; place_id?: string }
): Promise<string | null> {
  if (comp.place_id) {
    const { data: byPlace } = await supabase
      .from("competitors")
      .select("id")
      .eq("place_id", comp.place_id)
      .maybeSingle();
    if (byPlace) return byPlace.id;
  }
  if (comp.cid) {
    const { data: existing } = await supabase.from("competitors").select("id").eq("cid", comp.cid).maybeSingle();
    if (existing) return existing.id;
  }
  const { data: created } = await supabase
    .from("competitors")
    .insert({ cid: comp.cid ?? null, place_id: comp.place_id ?? null, name: comp.name ?? "Unknown" })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function persistHexDataId(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    businessId?: string;
    competitorId?: string | null;
    dataId: string | null;
    currentCid?: string | null;
  }
): Promise<void> {
  if (!params.dataId?.startsWith("0x")) return;
  if (params.currentCid === params.dataId) return;
  try {
    if (params.businessId) {
      await supabase.from("businesses").update({ cid: params.dataId }).eq("id", params.businessId);
    }
    if (params.competitorId) {
      await supabase.from("competitors").update({ cid: params.dataId }).eq("id", params.competitorId);
    }
  } catch (err) {
    console.warn("[ReviewMomentum] persist hex data_id skipped:", err);
  }
}

async function syncAndLoadReviews(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    organizationId: string;
    businessId?: string | null;
    competitorId?: string | null;
    provider: string;
    fetchedReviews: NormalizedReview[];
    entityKey: string;
    lookbackDays: number;
    reconcileAbsent?: boolean;
  }
): Promise<NormalizedReview[]> {
  try {
    await upsertReviews(supabase, {
      organizationId: params.organizationId,
      businessId: params.businessId,
      competitorId: params.competitorId,
      provider: params.provider,
      reviews: params.fetchedReviews,
      entityKey: params.entityKey,
      reconcileAbsent: params.reconcileAbsent,
      observedSourceIds: params.fetchedReviews
        .map((review) => review.sourceReviewId)
        .filter((id): id is string => Boolean(id)),
    });
  } catch (err) {
    console.warn("[ReviewMomentum] business_reviews upsert skipped:", err);
  }

  const stored = await loadStoredReviews(supabase, {
    businessId: params.businessId,
    competitorId: params.competitorId,
    lookbackDays: params.lookbackDays,
  });
  return stored.map(storedRowToNormalized);
}

/**
 * Fetch → upsert → load lookback from DB.
 * Incremental sync returning 0 new reviews must not wipe lookback totals.
 * If incremental finds nothing new but DB has no in-window rows, fall back to a full lookback fetch.
 */
async function fetchMergeAndLoadLookback(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    organizationId: string;
    businessId?: string | null;
    competitorId?: string | null;
    entityKey: string;
    lookbackDays: number;
    knownIds: Set<string>;
    fetchArgs: Parameters<typeof fetchReviewsForEntity>[0];
  }
): Promise<{
  reviews: NormalizedReview[];
  fetch: Awaited<ReturnType<typeof fetchReviewsForEntity>>;
}> {
  let fetch = await fetchReviewsForEntity({
    ...params.fetchArgs,
    lookbackDays: params.lookbackDays,
    stopAtSourceIds: params.knownIds.size > 0 ? params.knownIds : undefined,
  });

  let reviews = await syncAndLoadReviews(supabase, {
    organizationId: params.organizationId,
    businessId: params.businessId,
    competitorId: params.competitorId,
    provider: fetch.provider,
    fetchedReviews: fetch.reviews,
    entityKey: params.entityKey,
    lookbackDays: params.lookbackDays,
    reconcileAbsent: fetch.dataIdValidated && params.knownIds.size === 0 && fetch.stoppedReason !== "incremental_sync",
  });

  if (fetch.incrementalNoNew && reviews.length === 0 && params.knownIds.size > 0) {
    console.log("[ReviewMomentum] incremental_empty_full_refetch", {
      entityKey: params.entityKey,
      knownIds: params.knownIds.size,
      note: "Incremental returned 0 new but DB lookback is empty — running full lookback fetch",
    });
    fetch = await fetchReviewsForEntity({
      ...params.fetchArgs,
      lookbackDays: params.lookbackDays,
      stopAtSourceIds: undefined,
    });
    reviews = await syncAndLoadReviews(supabase, {
      organizationId: params.organizationId,
      businessId: params.businessId,
      competitorId: params.competitorId,
      provider: fetch.provider,
      fetchedReviews: fetch.reviews,
      entityKey: params.entityKey,
      lookbackDays: params.lookbackDays,
      reconcileAbsent: fetch.dataIdValidated && fetch.stoppedReason !== "incremental_sync",
    });
  }

  console.log("[ReviewMomentum] lookback_after_merge", {
    entityKey: params.entityKey,
    fetchedNew: fetch.reviews.length,
    stoppedReason: fetch.stoppedReason,
    incrementalNoNew: fetch.incrementalNoNew,
    lookbackDays: params.lookbackDays,
    storedInLookback: reviews.length,
  });

  return { reviews, fetch };
}

export async function runReviewMomentum(params: {
  businessId: string;
  organizationId: string;
  scanBatchId?: string;
  competitorLimit?: number;
  lookbackDays?: number;
}): Promise<MomentumRunResult> {
  const supabase = createServiceClient();
  const competitorLimit = params.competitorLimit ?? 3;
  const lookbackDays = params.lookbackDays ?? 90;
  const warnings: string[] = [];

  const { data: business } = await supabase.from("businesses").select("*").eq("id", params.businessId).single();
  if (!business) throw new Error("Business not found");

  let scanBatchId = params.scanBatchId;
  if (scanBatchId) {
    await assertScanBelongsToBusiness(scanBatchId, params.businessId);
  } else {
    const { data: latest } = await supabase
      .from("scan_batches")
      .select("id")
      .eq("business_id", params.businessId)
      .in("status", [...USABLE_SCAN_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    scanBatchId = latest?.id ?? undefined;
  }

  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", params.businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

  const { data: run } = await supabase
    .from("review_momentum_runs")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      scan_batch_id: scanBatchId ?? null,
      status: "running",
      lookback_days: lookbackDays,
      competitor_limit: competitorLimit,
    })
    .select("*")
    .single();

  if (!run) throw new Error("Failed to create momentum run");

  try {
    const searchState = primaryKw?.state ?? business.state ?? null;

    let competitorCandidates: ReturnType<typeof buildReviewMomentumCompetitorPool> = [];
    if (scanBatchId) {
      const { data: points } = await supabase
        .from("scan_points")
        .select("id, distance_from_center_m, grid_label")
        .eq("scan_batch_id", scanBatchId);
      const pointIds = (points ?? []).map((p) => p.id);
      if (pointIds.length) {
        const { data: results } = await supabase
          .from("scan_results")
          .select("top_competitors_json, scan_point_id, keyword_id")
          .in("scan_point_id", pointIds);
        const locationTokens = [primaryKw?.city, primaryKw?.state, searchState].filter(
          (t): t is string => !!t?.trim()
        );
        competitorCandidates = buildReviewMomentumCompetitorPool(results ?? [], {
          excludeCid: business.cid,
          excludePlaceId: business.place_id,
          excludeName: business.name,
          targetCategory: business.primary_category,
          keyword: primaryKw?.keyword,
          locationTokens,
          scanPoints: points ?? [],
          primaryKeywordId: primaryKw?.id,
        });
      }
    }

    const targetProfile = await enrichTargetBusiness({
      name: business.name,
      cid: business.cid,
      placeId: business.place_id,
      city: primaryKw?.city,
      state: primaryKw?.state,
      lat: business.scan_center_lat ?? business.lat,
      lng: business.scan_center_lng ?? business.lng,
      organizationId: params.organizationId,
    });

    const targetKnownIds = await loadKnownReviewIds(supabase, { businessId: params.businessId });

    const { reviews: targetReviews, fetch: targetFetch } = await fetchMergeAndLoadLookback(
      supabase,
      {
        organizationId: params.organizationId,
        businessId: params.businessId,
        entityKey: `biz:${params.businessId}`,
        lookbackDays,
        knownIds: targetKnownIds,
        fetchArgs: {
          placeId: business.place_id,
          cid: business.cid,
          name: business.name,
          city: primaryKw?.city,
          state: primaryKw?.state,
          lat: business.scan_center_lat ?? business.lat,
          lng: business.scan_center_lng ?? business.lng,
          organizationId: params.organizationId,
          depth: 50,
        },
      }
    );
    await persistHexDataId(supabase, {
      businessId: params.businessId,
      dataId: targetFetch.scrapingDogDataId,
      currentCid: business.cid,
    });
    if (targetFetch.warning && !warnings.includes(targetFetch.warning)) {
      warnings.push(targetFetch.warning);
    }
    for (const w of targetFetch.warnings) {
      if (!warnings.includes(w)) warnings.push(w);
    }
    if (targetReviews.some((r) => r.dateParseWarning)) {
      warnings.push("Some reviews had relative dates and may reduce accuracy.");
    }

    let targetMetrics = calcEntityMetrics(targetReviews, {
      totalReviewsCurrent: targetProfile.review_count ?? targetReviews.length,
      ratingCurrent: targetProfile.rating ?? null,
      velocityAvailable: targetFetch.velocityAvailable,
      velocityWarning: targetFetch.velocityWarning,
    });

    const competitorMetricsList: Array<{
      comp: (typeof competitorCandidates)[0];
      competitorId: string | null;
      metrics: EntityMomentumMetrics;
    }> = [];

    const seenPlaceIds = new Set<string>();
    let skippedNoPlaceId = 0;
    let skippedNoDataId = 0;

    console.log("[ReviewMomentum] competitor_pool", {
      candidateCount: competitorCandidates.length,
      targetCount: competitorLimit,
      filter:
        "top-3 map pack; center-cell SERP first (search from business lat/lng), then full grid; keyword intent filter",
      candidates: competitorCandidates.slice(0, 20).map((c) => ({
        name: c.name,
        place_id: c.place_id ?? null,
        poolTier: c.poolTier,
        top3Appearances: c.top3Appearances,
        avgTop3Rank: c.avgTop3Rank,
      })),
    });

    for (const comp of competitorCandidates) {
      if (competitorMetricsList.length >= competitorLimit) break;

      if (!comp.place_id) {
        skippedNoPlaceId++;
        console.log("[ReviewMomentum] competitor_skipped", {
          name: comp.name,
          reason: "no_place_id",
        });
        continue;
      }
      if (seenPlaceIds.has(comp.place_id)) continue;

      const competitorId = await upsertCompetitor(supabase, comp);
      const compKnownIds = competitorId
        ? await loadKnownReviewIds(supabase, { competitorId })
        : new Set<string>();

      if (!competitorId) {
        console.log("[ReviewMomentum] competitor_skipped", {
          name: comp.name,
          reason: "upsert_failed",
        });
        continue;
      }

      const { reviews: compReviews, fetch: fetchResult } = await fetchMergeAndLoadLookback(
        supabase,
        {
          organizationId: params.organizationId,
          competitorId,
          entityKey: `comp:${competitorId}`,
          lookbackDays,
          knownIds: compKnownIds,
          fetchArgs: {
            placeId: comp.place_id,
            name: comp.name ?? "Competitor",
            city: primaryKw?.city,
            state: searchState,
            lat: business.scan_center_lat ?? business.lat,
            lng: business.scan_center_lng ?? business.lng,
            organizationId: params.organizationId,
            depth: 50,
            mapsTotalReviews: comp.review_count ?? null,
            mapsRating: comp.rating ?? null,
            allowStoredHex: false,
          },
        }
      );

      if (!fetchResult.dataIdValidated) {
        skippedNoDataId++;
        console.log("[ReviewMomentum] competitor_replaced", {
          name: comp.name,
          place_id: comp.place_id,
          reason: "no_valid_data_id",
          tryingNext: true,
        });
        continue;
      }

      seenPlaceIds.add(comp.place_id);
      await persistHexDataId(supabase, {
        competitorId,
        dataId: fetchResult.scrapingDogDataId,
        currentCid: comp.cid,
      });

      const metrics = calcEntityMetrics(compReviews, {
        totalReviewsCurrent: comp.review_count ?? compReviews.length ?? 0,
        ratingCurrent: comp.rating ?? null,
        velocityAvailable: fetchResult.velocityAvailable,
        velocityWarning: fetchResult.velocityWarning,
      });

      competitorMetricsList.push({
        comp,
        competitorId,
        metrics,
      });
    }

    if (competitorMetricsList.length < competitorLimit) {
      console.warn("[ReviewMomentum] competitor_pool_exhausted", {
        found: competitorMetricsList.length,
        wanted: competitorLimit,
        skippedNoPlaceId,
        skippedNoDataId,
        totalCandidates: competitorCandidates.length,
      });
    }

    const velocityCompetitors = competitorMetricsList;
    const { target: enrichedTarget, competitors: enrichedVelocityComps } = applyGapAndTargets(
      targetMetrics,
      velocityCompetitors.map((c) => c.metrics)
    );
    targetMetrics = enrichedTarget;

    const competitorMetricsFinal = enrichedVelocityComps;

    const entityRows: MomentumEntityRow[] = [
      {
        id: "target",
        entityType: "target",
        name: business.name,
        businessId: params.businessId,
        metrics: targetMetrics,
        unavailable: !targetFetch.dataIdValidated,
        velocityWarning: targetFetch.velocityWarning,
      },
      ...competitorMetricsList.map((c, i) => ({
        id: `comp-${i}`,
        entityType: "competitor" as const,
        name: c.comp.name ?? "Competitor",
        competitorId: c.competitorId,
        metrics: competitorMetricsFinal[i] ?? c.metrics,
      })),
    ];

    const topCompetitor30d = Math.max(
      ...enrichedVelocityComps.map((c) => c.reviews30d),
      0
    );
    const reviewGap = targetMetrics.gapToTop3_30d ?? 0;
    const recommendedWeeklyTarget = targetMetrics.recommendedWeeklyTarget ?? 1;

    const marketInsights = buildMarketInsights(
      targetMetrics,
      competitorMetricsList.map((c, i) => ({
        name: c.comp.name ?? "Competitor",
        metrics: competitorMetricsFinal[i] ?? c.metrics,
      })),
      targetReviews
    );

    const sampleReviews = targetReviews.slice(0, 5).map((r) => ({
      rating: r.rating,
      text: r.reviewText?.slice(0, 120),
      date: r.reviewDate?.toISOString().slice(0, 10) ?? r.relativeDateText,
    }));

    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
    const ai = await generateReviewMomentumAnalysis({
      organizationId: params.organizationId,
      model,
      payload: {
        business: business.name,
        keyword: primaryKw?.keyword,
        city: primaryKw?.city,
        target: targetMetrics,
        competitors: competitorMetricsList.map((c, i) => ({
          name: c.comp.name,
          ...competitorMetricsFinal[i],
        })),
        reviewGap,
        recommendedWeeklyTarget,
        sampleReviews,
      },
    });

    const aiSummary =
      ai?.summary ??
      `You gained ${targetMetrics.reviews30d} reviews in the last 30 days while top competitors averaged ${Math.round(topCompetitor30d)}. Gap: ${reviewGap} reviews. Aim for ${recommendedWeeklyTarget} reviews per week.`;

    const taskPayload =
      ai?.tasks ??
      fallbackReviewMomentumTasks(reviewGap, recommendedWeeklyTarget);

    for (const entity of entityRows) {
      try {
        await supabase.from("review_momentum_entities").insert({
        run_id: run.id,
        organization_id: params.organizationId,
        business_id: entity.businessId ?? null,
        competitor_id: entity.competitorId ?? null,
        entity_type: entity.entityType,
        name: entity.name,
        total_reviews_current: entity.metrics.totalReviewsCurrent,
        rating_current: entity.metrics.ratingCurrent,
        reviews_7d: entity.metrics.reviews7d,
        reviews_30d: entity.metrics.reviews30d,
        reviews_90d: entity.metrics.reviews90d,
        reviews_yesterday: entity.metrics.reviewsYesterday,
        avg_reviews_per_week: entity.metrics.avgReviewsPerWeek,
        days_since_last_review: entity.metrics.daysSinceLastReview,
        acceleration_pct: entity.metrics.accelerationPct,
        consistency_score: entity.metrics.consistencyScore,
        velocity_score: entity.metrics.velocityScore,
        recency_score: entity.metrics.recencyScore,
        momentum_score: entity.metrics.momentumScore,
        momentum_label: entity.metrics.momentumLabel,
        gap_to_top3_30d: entity.entityType === "target" ? entity.metrics.gapToTop3_30d : null,
        recommended_weekly_target:
          entity.entityType === "target" ? entity.metrics.recommendedWeeklyTarget : null,
        metrics_json: {
          dailyCounts30d: entity.metrics.dailyCounts30d,
          dailyExact7d: entity.metrics.dailyExact7d,
          weeklyBuckets8to30: entity.metrics.weeklyBuckets8to30,
          trendBuckets90d: entity.metrics.trendBuckets90d,
          weeklyCounts8w: entity.metrics.weeklyCounts8w,
          weekdayHeatmap: entity.metrics.weekdayHeatmap,
          unavailable: entity.entityType === "target" ? (entity.unavailable ?? false) : false,
          velocityAvailable: entity.entityType === "competitor" ? true : entity.metrics.velocityAvailable,
          velocityWarning:
            entity.entityType === "target"
              ? (entity.metrics.velocityWarning ?? entity.velocityWarning ?? null)
              : null,
          marketInsights:
            entity.entityType === "target" ? marketInsights : undefined,
        },
      });
      } catch (err) {
        console.warn("[ReviewMomentum] entity save skipped:", err);
      }
    }

    const insertedTasks: MomentumRunResult["tasks"] = [];
    for (const t of taskPayload.slice(0, 8)) {
      try {
        const { data: task } = await supabase
        .from("review_momentum_tasks")
        .insert({
          run_id: run.id,
          organization_id: params.organizationId,
          business_id: params.businessId,
          title: t.title,
          description: t.description,
          priority: t.priority,
          impact: t.impact,
          effort: t.effort,
          evidence_json: { evidence: t.evidence },
        })
        .select("*")
        .single();
        if (task) {
          insertedTasks.push({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            impact: task.impact,
            effort: task.effort,
            status: task.status,
          });
        }
      } catch (err) {
        console.warn("[ReviewMomentum] task save skipped:", err);
      }
    }

    const status = warnings.some((w) => w.includes("No review data")) ? "partial" : "ready";

    await supabase
      .from("review_momentum_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        ai_summary: aiSummary,
        ai_model: ai ? model : null,
        warnings,
      })
      .eq("id", run.id);

    return {
      runId: run.id,
      status,
      warnings,
      aiSummary,
      entities: entityRows,
      tasks: insertedTasks,
      topCompetitor30d,
      reviewGap,
      recommendedWeeklyTarget,
      marketInsights,
    };
  } catch (err) {
    await supabase
      .from("review_momentum_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : "Momentum run failed",
      })
      .eq("id", run.id);
    throw err;
  }
}

export async function loadLatestMomentumRun(businessId: string) {
  const supabase = createServiceClient();
  const { data: usableRuns } = await supabase
    .from("review_momentum_runs")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["ready", "partial"])
    .order("created_at", { ascending: false })
    .limit(2);

  const { data: absoluteLatest } = await supabase
    .from("review_momentum_runs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(2);

  const runs = usableRuns?.length ? usableRuns : absoluteLatest;
  const run = runs?.[0] ?? null;
  if (!run) return null;

  const { data: entities } = await supabase
    .from("review_momentum_entities")
    .select("*")
    .eq("run_id", run.id)
    .order("entity_type", { ascending: true });

  const { data: tasks } = await supabase
    .from("review_momentum_tasks")
    .select("*")
    .eq("run_id", run.id)
    .order("created_at", { ascending: true });

  let previousTarget30d: number | null = null;
  const priorRun = runs?.[1];
  if (priorRun) {
    const { data: priorTarget } = await supabase
      .from("review_momentum_entities")
      .select("reviews_30d")
      .eq("run_id", priorRun.id)
      .eq("entity_type", "target")
      .maybeSingle();
    previousTarget30d = priorTarget?.reviews_30d ?? null;
  }

  return { run, entities: entities ?? [], tasks: tasks ?? [], previousTarget30d };
}
