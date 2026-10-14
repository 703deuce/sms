import { createServiceClient } from "@/lib/db/client";
import { buildReviewMomentumCompetitorPool } from "@/lib/maps/grid";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import { enrichTargetBusiness } from "@/lib/jobs/enrich-competitors";
import { fetchReviewsForEntity } from "@/lib/reviews/fetch-reviews";
import { classifyReviewAge } from "@/lib/reviews/date-buckets";
import { dedupeKey, hasOwnerResponse, type NormalizedReview } from "@/lib/reviews/normalize";
import { applyGapAndTargets, calcEntityMetrics, type MomentumLabel } from "@/lib/reviews/metrics";
import { buildMarketInsights } from "@/lib/reviews/market-insights";
import {
  loadStoredReviews,
  storedRowToNormalized,
  upsertReviews,
} from "@/lib/reviews/review-store";
import {
  aggregateKeywordStrengths,
  buildKeywordDictionary,
  computeKeywordGaps,
  extractKeywordsFromReview,
} from "@/lib/reputation/keywords";
import { auditOwnerResponses, sentimentLabel } from "@/lib/reputation/response-audit";
import { computeReputationHealthScore } from "@/lib/reputation/score";
import {
  fallbackReputationTasks,
  generateReputationAnalysis,
  generateReviewResponseDraft,
} from "@/lib/providers/deepseek/reputation";

async function upsertCompetitor(
  supabase: ReturnType<typeof createServiceClient>,
  comp: { name?: string; cid?: string; place_id?: string }
): Promise<string | null> {
  if (comp.place_id) {
    const { data: byPlace } = await supabase.from("competitors").select("id").eq("place_id", comp.place_id).maybeSingle();
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

function toReviewRecordRow(params: {
  review: NormalizedReview;
  auditId: string;
  organizationId: string;
  businessId?: string | null;
  competitorId?: string | null;
  provider: string;
  entityKey: string;
  dictionary: ReturnType<typeof buildKeywordDictionary>;
}) {
  const kw = extractKeywordsFromReview(params.review, params.dictionary);
  const bucket = classifyReviewAge(params.review);
  return {
    organization_id: params.organizationId,
    business_id: params.businessId ?? null,
    competitor_id: params.competitorId ?? null,
    audit_id: params.auditId,
    source_provider: params.provider,
    source_review_id: params.review.sourceReviewId ?? dedupeKey(params.review, params.entityKey).slice(0, 120),
    reviewer_name: params.review.reviewerName,
    rating: params.review.rating,
    review_text: params.review.reviewText,
    relative_date_text: params.review.relativeDateText,
    exact_day: bucket?.in7dExact ?? false,
    date_confidence: params.review.dateParseWarning ? "low" : params.review.reviewDate ? "high" : "medium",
    owner_response_text: params.review.ownerResponseText,
    owner_response_present: hasOwnerResponse(params.review.ownerResponseText),
    review_url: params.review.reviewUrl,
    sentiment: sentimentLabel(params.review.rating),
    service_keywords: kw.service,
    trust_keywords: kw.trust,
    location_keywords: kw.location,
    raw_json: params.review.raw,
  };
}

export async function runReputationAudit(params: {
  businessId: string;
  organizationId: string;
  competitorLimit?: number;
  lookbackDays?: number;
  forceRefresh?: boolean;
}) {
  const supabase = createServiceClient();
  const competitorLimit = params.competitorLimit ?? 5;
  const lookbackDays = params.lookbackDays ?? 90;
  const warnings: string[] = [];

  const { data: business } = await supabase.from("businesses").select("*").eq("id", params.businessId).single();
  if (!business) throw new Error("Business not found");

  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", params.businessId);
  const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  const locationTokens = [primaryKw?.city, primaryKw?.state, primaryKw?.keyword?.split(" ").pop()].filter(
    (t): t is string => !!t?.trim()
  );
  const dictionary = buildKeywordDictionary(locationTokens);

  const { data: latestScan } = await supabase
    .from("scan_batches")
    .select("id")
    .eq("business_id", params.businessId)
    .in("status", [...USABLE_SCAN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: auditRow } = await supabase
    .from("reputation_audits")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      scan_batch_id: latestScan?.id ?? null,
      status: "running",
      progress_stage: "Fetching reviews",
    })
    .select("id")
    .single();

  const auditId = auditRow!.id as string;

  try {
    let competitorCandidates: ReturnType<typeof buildReviewMomentumCompetitorPool> = [];
    if (latestScan?.id) {
      const { data: points } = await supabase.from("scan_points").select("id, distance_from_center_m").eq("scan_batch_id", latestScan.id);
      const pointIds = (points ?? []).map((p) => p.id);
      if (pointIds.length) {
        const { data: results } = await supabase
          .from("scan_results")
          .select("top_competitors_json, scan_point_id, keyword_id")
          .in("scan_point_id", pointIds);
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

    const targetFetch = await fetchReviewsForEntity({
      placeId: business.place_id,
      cid: business.cid,
      name: business.name,
      city: primaryKw?.city,
      state: primaryKw?.state,
      lat: business.scan_center_lat ?? business.lat,
      lng: business.scan_center_lng ?? business.lng,
      organizationId: params.organizationId,
      depth: 50,
      lookbackDays,
    });

    warnings.push(...targetFetch.warnings);

    // Persist then count lookback from storage — never trust a single fetch length as 90d total.
    try {
      await upsertReviews(supabase, {
        organizationId: params.organizationId,
        businessId: params.businessId,
        provider: targetFetch.provider,
        reviews: targetFetch.reviews,
        entityKey: `biz:${params.businessId}`,
        reconcileAbsent: targetFetch.dataIdValidated && targetFetch.stoppedReason !== "incremental_sync",
        observedSourceIds: targetFetch.reviews
          .map((review) => review.sourceReviewId)
          .filter((id): id is string => Boolean(id)),
      });
    } catch (err) {
      console.warn("[ReputationAudit] business_reviews upsert skipped:", err);
    }
    const storedTarget = await loadStoredReviews(supabase, {
      businessId: params.businessId,
      lookbackDays,
    });
    const targetReviewsForMetrics =
      storedTarget.length > 0
        ? storedTarget.map(storedRowToNormalized)
        : targetFetch.reviews;

    let targetMetrics = calcEntityMetrics(targetReviewsForMetrics, {
      totalReviewsCurrent: targetProfile.review_count ?? targetReviewsForMetrics.length,
      ratingCurrent: targetProfile.rating ?? null,
      velocityAvailable: targetFetch.velocityAvailable,
      velocityWarning: targetFetch.velocityWarning,
    });

    const competitorReviewSets: NormalizedReview[][] = [];
    const competitorRows: Array<Record<string, unknown>> = [];
    const competitorRecordRows: Array<Record<string, unknown>> = [];

    await supabase.from("reputation_audits").update({ progress_stage: "Comparing competitors" }).eq("id", auditId);

    const seen = new Set<string>();
    for (const comp of competitorCandidates) {
      if (competitorRows.length >= competitorLimit) break;
      if (!comp.place_id || seen.has(comp.place_id)) continue;

      let compMetrics = calcEntityMetrics([], {
        totalReviewsCurrent: comp.review_count ?? 0,
        ratingCurrent: comp.rating ?? null,
        velocityAvailable: false,
        velocityWarning: "Velocity unavailable — using grid totals only",
      });
      let compReviews: NormalizedReview[] = [];
      let velocityAvailable = false;
      const competitorId = await upsertCompetitor(supabase, comp);

      try {
        const fetchResult = await fetchReviewsForEntity({
          placeId: comp.place_id,
          name: comp.name ?? "Competitor",
          city: primaryKw?.city,
          state: primaryKw?.state,
          lat: business.scan_center_lat ?? business.lat,
          lng: business.scan_center_lng ?? business.lng,
          organizationId: params.organizationId,
          depth: 50,
          lookbackDays,
          mapsTotalReviews: comp.review_count ?? null,
          mapsRating: comp.rating ?? null,
          allowStoredHex: false,
        });
        if (fetchResult.dataIdValidated) {
          if (competitorId) {
            try {
              await upsertReviews(supabase, {
                organizationId: params.organizationId,
                competitorId,
                provider: fetchResult.provider,
                reviews: fetchResult.reviews,
                entityKey: `comp:${competitorId}`,
                reconcileAbsent: fetchResult.dataIdValidated && fetchResult.stoppedReason !== "incremental_sync",
                observedSourceIds: fetchResult.reviews
                  .map((review) => review.sourceReviewId)
                  .filter((id): id is string => Boolean(id)),
              });
            } catch (err) {
              console.warn("[ReputationAudit] competitor reviews upsert skipped:", err);
            }
            const storedComp = await loadStoredReviews(supabase, {
              competitorId,
              lookbackDays,
            });
            compReviews =
              storedComp.length > 0
                ? storedComp.map(storedRowToNormalized)
                : fetchResult.reviews;
          } else {
            compReviews = fetchResult.reviews;
          }
          velocityAvailable = fetchResult.velocityAvailable;
          compMetrics = calcEntityMetrics(compReviews, {
            totalReviewsCurrent: comp.review_count ?? compReviews.length,
            ratingCurrent: comp.rating ?? null,
            velocityAvailable,
          });
        }
      } catch {
        warnings.push(`Could not fetch reviews for ${comp.name}`);
      }

      seen.add(comp.place_id);
      competitorReviewSets.push(compReviews);

      for (const r of compReviews) {
        competitorRecordRows.push(
          toReviewRecordRow({
            review: r,
            auditId,
            organizationId: params.organizationId,
            competitorId,
            provider: "scrapingdog",
            entityKey: `comp:${competitorId}`,
            dictionary,
          })
        );
      }

      const compResponse = auditOwnerResponses(compReviews);
      competitorRows.push({
        audit_id: auditId,
        organization_id: params.organizationId,
        competitor_id: competitorId,
        competitor_name: comp.name ?? "Competitor",
        rating: comp.rating ?? compMetrics.ratingCurrent,
        total_reviews: comp.review_count ?? compMetrics.totalReviewsCurrent,
        reviews_7d: compMetrics.reviews7d,
        reviews_30d: compMetrics.reviews30d,
        reviews_90d: compMetrics.reviews90d,
        avg_reviews_per_week: compMetrics.avgReviewsPerWeek,
        days_since_last_review: compMetrics.daysSinceLastReview,
        response_rate: compResponse.responseRate,
        momentum_score: compMetrics.momentumScore,
        momentum_label: compMetrics.momentumLabel,
        keyword_strengths: aggregateKeywordStrengths(compReviews, dictionary),
        velocity_available: velocityAvailable,
        raw_json: { velocityWarning: compMetrics.velocityWarning },
      });
    }

    const { target: scoredTarget, competitors: scoredCompetitors } = applyGapAndTargets(
      targetMetrics,
      competitorRows.map((c, i) => ({
        ...calcEntityMetrics(competitorReviewSets[i] ?? [], {
          totalReviewsCurrent: c.total_reviews as number,
          ratingCurrent: c.rating as number | null,
        }),
        reviews7d: c.reviews_7d as number,
        reviews30d: c.reviews_30d as number,
        reviews90d: c.reviews_90d as number,
        momentumScore: c.momentum_score as number,
        momentumLabel: c.momentum_label as MomentumLabel,
        avgReviewsPerWeek: c.avg_reviews_per_week as number,
        daysSinceLastReview: c.days_since_last_review as number | null,
      }))
    );

    targetMetrics = scoredTarget;

    const targetRecordRows = targetFetch.reviews.map((r) =>
      toReviewRecordRow({
        review: r,
        auditId,
        organizationId: params.organizationId,
        businessId: params.businessId,
        provider: targetFetch.provider,
        entityKey: `biz:${params.businessId}`,
        dictionary,
      })
    );

    const responseAudit = auditOwnerResponses(targetFetch.reviews);
    const keywordGaps = computeKeywordGaps({
      targetReviews: targetFetch.reviews,
      competitorReviews: competitorReviewSets,
      dictionary,
    });

    const competitorAvgReviews =
      competitorRows.length > 0
        ? competitorRows.reduce((a, c) => a + (c.total_reviews as number), 0) / competitorRows.length
        : targetMetrics.totalReviewsCurrent;

    const score = computeReputationHealthScore({
      rating: targetMetrics.ratingCurrent,
      totalReviews: targetMetrics.totalReviewsCurrent,
      competitorAvgReviews,
      targetMetrics,
      responseAudit,
      keywordGaps,
      daysSinceLastReview: targetMetrics.daysSinceLastReview,
    });

    const marketInsights = buildMarketInsights(
      targetMetrics,
      competitorRows.map((c, i) => ({
        name: String(c.competitor_name),
        metrics: scoredCompetitors[i] ?? calcEntityMetrics(competitorReviewSets[i] ?? []),
      })),
      targetFetch.reviews
    );

    await supabase.from("reputation_audits").update({ progress_stage: "Generating tasks" }).eq("id", auditId);

    const aiPayload = {
      business: business.name,
      rating: targetMetrics.ratingCurrent,
      totalReviews: targetMetrics.totalReviewsCurrent,
      reviews7d: targetMetrics.reviews7d,
      reviews30d: targetMetrics.reviews30d,
      reviewGap: targetMetrics.gapToTop3_30d,
      weeklyTarget: targetMetrics.recommendedWeeklyTarget,
      momentumLabel: targetMetrics.momentumLabel,
      responseRate: responseAudit.responseRate,
      unanswered: responseAudit.unansweredPositive + responseAudit.unansweredNegative,
      keywordGaps: keywordGaps.slice(0, 10),
      competitors: competitorRows.map((c) => ({
        name: c.competitor_name,
        reviews30d: c.reviews_30d,
        rating: c.rating,
      })),
    };

    const ai =
      (await generateReputationAnalysis({ payload: aiPayload, organizationId: params.organizationId })) ??
      fallbackReputationTasks({
        reviewGap: targetMetrics.gapToTop3_30d ?? 0,
        weeklyTarget: targetMetrics.recommendedWeeklyTarget ?? 1,
        unanswered: responseAudit.unansweredPositive + responseAudit.unansweredNegative,
        keywordGaps: keywordGaps.filter((g) => g.gap > 0).map((g) => g.keyword),
      });

    const taskRows = ai.tasks.map((t) => ({
      audit_id: auditId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      impact: t.impact,
      effort: t.effort,
      status: "open",
      evidence_json: { evidence: t.evidence },
    }));

    const gapRows = keywordGaps.map((g) => ({
      audit_id: auditId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      keyword: g.keyword,
      keyword_type: g.keywordType,
      target_count: g.targetCount,
      competitor_avg: g.competitorAvg,
      competitor_max: g.competitorMax,
      gap: g.gap,
      priority: g.priority,
      recommendation: g.recommendation,
    }));

    if (targetRecordRows.length) await supabase.from("review_records").insert(targetRecordRows);
    if (competitorRecordRows.length) await supabase.from("review_records").insert(competitorRecordRows);
    if (competitorRows.length) await supabase.from("reputation_competitors").insert(competitorRows);
    if (gapRows.length) await supabase.from("review_keyword_gaps").insert(gapRows);
    if (taskRows.length) await supabase.from("reputation_tasks").insert(taskRows);

    const status = warnings.length || !targetFetch.velocityAvailable ? "partial" : "ready";

    await supabase
      .from("reputation_audits")
      .update({
        status,
        score,
        rating: targetMetrics.ratingCurrent,
        total_reviews: targetMetrics.totalReviewsCurrent,
        reviews_7d: targetMetrics.reviews7d,
        reviews_30d: targetMetrics.reviews30d,
        reviews_90d: targetMetrics.reviews90d,
        momentum_label: targetMetrics.momentumLabel,
        momentum_score: targetMetrics.momentumScore,
        response_rate: responseAudit.responseRate,
        review_gap: targetMetrics.gapToTop3_30d,
        recommended_weekly_target: targetMetrics.recommendedWeeklyTarget,
        ai_summary: ai.summary,
        metrics_json: { targetMetrics, responseAudit, marketInsights, topFindings: ai.top_findings },
        warnings,
        progress_stage: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", auditId);

    return { auditId, status, score, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reputation audit failed";
    await supabase
      .from("reputation_audits")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", auditId);
    throw err;
  }
}

export async function loadLatestReputationAudit(businessId: string) {
  const supabase = createServiceClient();
  const { data: usable } = await supabase
    .from("reputation_audits")
    .select("*")
    .eq("business_id", businessId)
    .in("status", ["ready", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const audit =
    usable ??
    (
      await supabase
        .from("reputation_audits")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;

  if (!audit) return null;

  const [reviews, competitors, keywordGaps, tasks, drafts] = await Promise.all([
    supabase.from("review_records").select("*").eq("audit_id", audit.id).order("created_at", { ascending: false }),
    supabase.from("reputation_competitors").select("*").eq("audit_id", audit.id),
    supabase.from("review_keyword_gaps").select("*").eq("audit_id", audit.id).order("gap", { ascending: false }),
    supabase.from("reputation_tasks").select("*").eq("audit_id", audit.id),
    supabase.from("review_response_drafts").select("*").eq("audit_id", audit.id),
  ]);

  const targetReviews = (reviews.data ?? []).filter((r) => r.business_id);
  const metrics = (audit.metrics_json ?? {}) as Record<string, unknown>;
  const responseAudit = metrics.responseAudit as Record<string, unknown> | undefined;
  const targetMetrics = metrics.targetMetrics as Record<string, unknown> | undefined;
  const marketInsights = metrics.marketInsights as Record<string, unknown> | undefined;

  return {
    audit,
    reviews: reviews.data ?? [],
    targetReviews,
    competitors: competitors.data ?? [],
    keywordGaps: keywordGaps.data ?? [],
    tasks: tasks.data ?? [],
    drafts: drafts.data ?? [],
    responseAudit,
    targetMetrics,
    marketInsights,
    hasCompetitors: (competitors.data ?? []).length > 0,
  };
}

export async function generateResponseDrafts(params: {
  auditId: string;
  businessId: string;
  organizationId: string;
  reviewRecordIds: string[];
  businessName: string;
}) {
  const supabase = createServiceClient();
  const { data: reviews } = await supabase
    .from("review_records")
    .select("*")
    .eq("audit_id", params.auditId)
    .in("id", params.reviewRecordIds);

  const drafts: Array<{ reviewRecordId: string; draftText: string }> = [];

  for (const r of reviews ?? []) {
    const draftText =
      (await generateReviewResponseDraft({
        businessName: params.businessName,
        reviewText: String(r.review_text ?? ""),
        rating: r.rating != null ? Number(r.rating) : null,
        serviceKeywords: (r.service_keywords as string[]) ?? [],
        organizationId: params.organizationId,
      })) ?? "Thank you for your review — we appreciate your feedback and look forward to serving you again.";

    await supabase.from("review_response_drafts").insert({
      audit_id: params.auditId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      review_record_id: r.id,
      draft_text: draftText,
      status: "draft",
      ai_model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    });

    drafts.push({ reviewRecordId: r.id as string, draftText });
  }

  return drafts;
}
