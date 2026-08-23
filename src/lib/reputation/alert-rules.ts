import { differenceInCalendarDays, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { hasOwnerResponse } from "@/lib/reviews/normalize";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { loadStoredReviews, reviewsInWindow } from "@/lib/reviews/review-store";
import type { ReputationAlertSeverity } from "@/lib/reputation/alerts-data";

type Supabase = ReturnType<typeof createServiceClient>;

type AlertCandidate = {
  category: string;
  severity: ReputationAlertSeverity;
  title: string;
  body: string | null;
  recommendedAction: string | null;
  dedupeKey: string;
  payload?: Record<string, unknown>;
};

type AlertPreferences = {
  velocity_drop?: boolean;
  competitor_velocity_spike?: boolean;
  no_reviews_days?: number;
  rating_changed?: boolean;
  response_overdue?: boolean;
  campaign_delivery_problem?: boolean;
  review_gap_widening?: boolean;
  maps_visibility_moved?: boolean;
};

function isMissingTableError(message: string): boolean {
  return /relation .* does not exist|schema cache|could not find .* column|does not exist/i.test(message);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function loadBusiness(supabase: Supabase, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, organization_id, name")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Business not found");
  return data as { id: string; organization_id: string; name: string | null };
}

async function loadPreferences(supabase: Supabase, businessId: string): Promise<AlertPreferences> {
  const { data, error } = await supabase
    .from("review_notification_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) return { no_reviews_days: 14 };
  return data as AlertPreferences;
}

function preferenceEnabled(preferences: AlertPreferences, key: keyof AlertPreferences): boolean {
  if (key === "no_reviews_days") return (preferences.no_reviews_days ?? 14) > 0;
  return Boolean(preferences[key]);
}

async function hasActiveDedupe(
  supabase: Supabase,
  params: { businessId: string; category: string; dedupeKey: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("reputation_alerts")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("category", params.category)
    .eq("status", "active")
    .contains("payload_json", { dedupeKey: params.dedupeKey })
    .limit(1);
  if (error) {
    if (isMissingTableError(error.message)) return true;
    throw new Error(error.message);
  }
  return Boolean(data?.length);
}

async function insertAlert(
  supabase: Supabase,
  params: {
    organizationId: string;
    businessId: string;
    alert: AlertCandidate;
  }
): Promise<boolean> {
  if (
    await hasActiveDedupe(supabase, {
      businessId: params.businessId,
      category: params.alert.category,
      dedupeKey: params.alert.dedupeKey,
    })
  ) {
    return false;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("reputation_alerts").insert({
    organization_id: params.organizationId,
    business_id: params.businessId,
    category: params.alert.category,
    severity: params.alert.severity,
    title: params.alert.title,
    body: params.alert.body,
    recommended_action: params.alert.recommendedAction,
    status: "active",
    payload_json: {
      ...(params.alert.payload ?? {}),
      dedupeKey: params.alert.dedupeKey,
    },
    created_at: now,
    updated_at: now,
  });
  if (error) {
    if (isMissingTableError(error.message)) return false;
    throw new Error(error.message);
  }
  return true;
}

async function loadRatingChangeCandidate(
  supabase: Supabase,
  businessId: string
): Promise<AlertCandidate | null> {
  const { data: runs, error } = await supabase
    .from("review_momentum_runs")
    .select("id, created_at")
    .eq("business_id", businessId)
    .in("status", ["ready", "partial"])
    .order("created_at", { ascending: false })
    .limit(2);
  if (error || !runs || runs.length < 2) return null;

  const runIds = runs.map((run) => run.id as string);
  const { data: entities, error: entityError } = await supabase
    .from("review_momentum_entities")
    .select("run_id, rating_current")
    .in("run_id", runIds)
    .eq("entity_type", "target");
  if (entityError) return null;

  const current = toNumber(entities?.find((row) => row.run_id === runIds[0])?.rating_current);
  const previous = toNumber(entities?.find((row) => row.run_id === runIds[1])?.rating_current);
  if (current == null || previous == null) return null;
  const delta = Math.round((current - previous) * 10) / 10;
  if (Math.abs(delta) < 0.2) return null;

  return {
    category: "rating_changed",
    severity: delta < 0 ? "high" : "low",
    title: `Rating ${delta < 0 ? "dropped" : "improved"} by ${Math.abs(delta).toFixed(1)} stars`,
    body: `Latest momentum run rating is ${current.toFixed(1)} vs ${previous.toFixed(1)} previously.`,
    recommendedAction: delta < 0 ? "Review recent negatives and respond with resolution-oriented replies." : "Capture recent positive review themes for campaigns.",
    dedupeKey: `rating:${runIds[0]}:${current}`,
    payload: { current, previous, delta, runId: runIds[0] },
  };
}

async function loadCampaignDeliveryCandidate(
  supabase: Supabase,
  businessId: string
): Promise<AlertCandidate | null> {
  const since = subDays(new Date(), 14).toISOString();
  const { data, error } = await supabase
    .from("review_request_messages")
    .select("id, failed_reason, campaign_id, failed_at, created_at")
    .eq("business_id", businessId)
    .eq("status", "failed")
    .gte("created_at", since)
    .limit(50);
  if (error) return null;
  const failed = data ?? [];
  if (!failed.length) return null;
  return {
    category: "campaign_delivery_problem",
    severity: failed.length >= 10 ? "high" : "medium",
    title: `${failed.length} review request message${failed.length === 1 ? "" : "s"} failed recently`,
    body: String(failed[0]?.failed_reason ?? "Recent review request delivery failures were detected."),
    recommendedAction: "Check sender configuration, opt-outs, and failed recipient records before sending more requests.",
    dedupeKey: `campaign_delivery:${new Date().toISOString().slice(0, 10)}`,
    payload: { failedCount: failed.length, sampleCampaignId: failed[0]?.campaign_id ?? null },
  };
}

async function loadMapsMovedCandidate(
  supabase: Supabase,
  businessId: string
): Promise<AlertCandidate | null> {
  const since = subDays(new Date(), 30).toISOString();
  const { data, error } = await supabase
    .from("scan_batches")
    .select("id, moved_from_scan_id, finished_at, created_at")
    .eq("business_id", businessId)
    .not("moved_from_scan_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return {
    category: "maps_visibility_moved",
    severity: "medium",
    title: "Maps visibility scan center moved",
    body: "A recent Maps scan was moved from an earlier scan center, which can change visibility comparisons.",
    recommendedAction: "Review the latest scan and confirm the scan center still represents the service area.",
    dedupeKey: `maps_moved:${data[0]!.id}`,
    payload: { scanBatchId: data[0]!.id, movedFromScanId: data[0]!.moved_from_scan_id },
  };
}

export async function evaluateAndPersistReputationAlerts(businessId: string): Promise<number> {
  const supabase = createServiceClient();
  const [business, preferences, reviews, momentum] = await Promise.all([
    loadBusiness(supabase, businessId),
    loadPreferences(supabase, businessId),
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    loadLatestMomentumRun(businessId),
  ]);

  const candidates: AlertCandidate[] = [];
  const now = new Date();
  const recentReviews = reviewsInWindow(reviews, 90);

  for (const review of recentReviews) {
    const rating = toNumber(review.rating);
    if (rating == null || rating > 3 || hasOwnerResponse(review.owner_response_text)) continue;
    const published = review.published_at ?? (review.review_date ? `${review.review_date}T00:00:00Z` : review.created_at);
    const daysWaiting = differenceInCalendarDays(now, new Date(published));
    candidates.push({
      category: "unanswered_negative",
      severity: rating <= 2 && daysWaiting >= 7 ? "critical" : rating <= 2 ? "high" : "medium",
      title: `${rating}-star review needs a response`,
      body: review.review_text?.trim() || "A low-rating review is currently unanswered.",
      recommendedAction: "Reply with an apology, address the issue, and offer a clear next step.",
      dedupeKey: `unanswered_negative:${review.id}`,
      payload: { reviewId: review.id, rating, daysWaiting },
    });
  }

  const noReviewsDays = preferences.no_reviews_days ?? 14;
  if (preferenceEnabled(preferences, "no_reviews_days")) {
    const latestDate = recentReviews
      .map((row) => row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null))
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const daysSince = latestDate ? differenceInCalendarDays(now, new Date(latestDate)) : noReviewsDays + 1;
    if (daysSince >= noReviewsDays) {
      candidates.push({
        category: "no_reviews",
        severity: daysSince >= noReviewsDays * 2 ? "high" : "medium",
        title: `No new reviews in ${daysSince} days`,
        body: `${business.name ?? "This business"} has exceeded the configured ${noReviewsDays}-day no-review threshold.`,
        recommendedAction: "Send a small review request cohort to recent satisfied customers.",
        dedupeKey: `no_reviews:${Math.floor(daysSince / Math.max(noReviewsDays, 1))}`,
        payload: { daysSince, thresholdDays: noReviewsDays },
      });
    }
  }

  const targetEntity = momentum?.entities.find((entity) => entity.entity_type === "target");
  const competitorEntities = momentum?.entities.filter((entity) => entity.entity_type === "competitor") ?? [];
  const current30 = toNumber(targetEntity?.reviews_30d) ?? reviewsInWindow(reviews, 30).length;
  const previous30 = momentum?.previousTarget30d ?? null;

  if (preferenceEnabled(preferences, "velocity_drop") && previous30 != null && previous30 > 0) {
    const dropPct = Math.round(((previous30 - current30) / previous30) * 100);
    if (dropPct >= 30) {
      candidates.push({
        category: "velocity_drop",
        severity: dropPct >= 50 ? "high" : "medium",
        title: `Review velocity dropped ${dropPct}%`,
        body: `Current 30-day reviews are ${current30}, down from ${previous30} in the prior momentum run.`,
        recommendedAction: "Restart review requests and inspect campaign delivery metrics.",
        dedupeKey: `velocity_drop:${momentum?.run.id ?? "latest"}:${current30}`,
        payload: { current30, previous30, dropPct },
      });
    }
  }

  if (preferenceEnabled(preferences, "competitor_velocity_spike")) {
    const spiking = competitorEntities
      .map((entity) => ({
        name: String(entity.name ?? "Competitor"),
        reviews30: toNumber(entity.reviews_30d) ?? 0,
      }))
      .filter((entity) => entity.reviews30 >= Math.max(current30 + 3, current30 * 1.5))
      .sort((a, b) => b.reviews30 - a.reviews30)[0];
    if (spiking) {
      candidates.push({
        category: "competitor_velocity_spike",
        severity: "medium",
        title: `${spiking.name} is outpacing review velocity`,
        body: `${spiking.name} added ${spiking.reviews30} reviews in 30 days vs your ${current30}.`,
        recommendedAction: "Increase outreach cadence until your weekly review target closes the velocity gap.",
        dedupeKey: `competitor_spike:${momentum?.run.id ?? "latest"}:${spiking.name}`,
        payload: { competitorName: spiking.name, competitorReviews30: spiking.reviews30, current30 },
      });
    }
  }

  if (preferenceEnabled(preferences, "response_overdue")) {
    const overdue = recentReviews.filter((review) => {
      const rating = toNumber(review.rating);
      if (rating == null || rating > 3 || hasOwnerResponse(review.owner_response_text)) return false;
      const published = review.published_at ?? (review.review_date ? `${review.review_date}T00:00:00Z` : review.created_at);
      return differenceInCalendarDays(now, new Date(published)) >= 3;
    });
    if (overdue.length) {
      candidates.push({
        category: "response_overdue",
        severity: overdue.length >= 3 ? "high" : "medium",
        title: `${overdue.length} negative response${overdue.length === 1 ? " is" : "s are"} overdue`,
        body: "Negative reviews older than three days are still unanswered.",
        recommendedAction: "Respond to the oldest low-rating reviews first.",
        dedupeKey: `response_overdue:${overdue.map((row) => row.id).sort().join(":").slice(0, 120)}`,
        payload: { reviewIds: overdue.map((row) => row.id), overdueCount: overdue.length },
      });
    }
  }

  if (preferenceEnabled(preferences, "review_gap_widening")) {
    const widening = competitorEntities
      .map((entity) => {
        const total = toNumber(entity.total_reviews_current) ?? 0;
        const velocity = toNumber(entity.reviews_30d) ?? 0;
        const targetTotal = toNumber(targetEntity?.total_reviews_current) ?? reviews.length;
        return {
          name: String(entity.name ?? "Competitor"),
          totalGap: total - targetTotal,
          velocityGap: velocity - current30,
        };
      })
      .filter((row) => row.totalGap > 0 && row.velocityGap > 0)
      .sort((a, b) => b.velocityGap - a.velocityGap)[0];
    if (widening) {
      candidates.push({
        category: "review_gap_widening",
        severity: "high",
        title: `Review gap is widening vs ${widening.name}`,
        body: `${widening.name} is ahead by ${widening.totalGap} total reviews and gaining ${widening.velocityGap} more reviews per month.`,
        recommendedAction: "Set a weekly review target above competitor velocity until the total gap stabilizes.",
        dedupeKey: `gap_widening:${momentum?.run.id ?? "latest"}:${widening.name}`,
        payload: widening,
      });
    }
  }

  if (preferenceEnabled(preferences, "rating_changed")) {
    const ratingChanged = await loadRatingChangeCandidate(supabase, businessId);
    if (ratingChanged) candidates.push(ratingChanged);
  }

  if (preferenceEnabled(preferences, "campaign_delivery_problem")) {
    const campaignProblem = await loadCampaignDeliveryCandidate(supabase, businessId);
    if (campaignProblem) candidates.push(campaignProblem);
  }

  if (preferenceEnabled(preferences, "maps_visibility_moved")) {
    const mapsMoved = await loadMapsMovedCandidate(supabase, businessId);
    if (mapsMoved) candidates.push(mapsMoved);
  }

  let created = 0;
  for (const alert of candidates) {
    if (await insertAlert(supabase, { organizationId: business.organization_id, businessId, alert })) {
      created++;
    }
  }
  return created;
}
