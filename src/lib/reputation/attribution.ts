import { createServiceClient } from "@/lib/db/client";
import { labelReviewAttribution, type AttributionLevel } from "@/lib/reputation/contacts-normalize";
import { logger } from "@/lib/observability/logger";

/**
 * Match recent Google reviews to campaign clicks with honest labels only.
 * Confirmed requires an approved identifier (reviewer name ↔ contact name uniquely);
 * timing + click alone is "likely"; otherwise "unattributed" campaign-window noise.
 */
export async function attributeRecentReviewsForBusiness(params: {
  businessId: string;
  organizationId: string;
  campaignId?: string;
  lookbackHours?: number;
}): Promise<number> {
  const supabase = createServiceClient();
  const lookback = params.lookbackHours ?? 72;
  const since = new Date(Date.now() - lookback * 3600_000).toISOString();

  let campQuery = supabase
    .from("review_request_campaigns")
    .select("id, started_at, created_at")
    .eq("business_id", params.businessId)
    .in("status", ["active", "paused", "completed", "scheduled"]);
  if (params.campaignId) campQuery = campQuery.eq("id", params.campaignId);
  const { data: campaigns } = await campQuery;
  if (!campaigns?.length) return 0;

  const { data: reviewRows } = await supabase
    .from("business_reviews")
    .select("id, review_date, reviewer_name, created_at, updated_at")
    .eq("business_id", params.businessId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!reviewRows?.length) return 0;

  let written = 0;
  for (const campaign of campaigns) {
    const campaignStart = new Date(
      (campaign.started_at as string | null) ?? (campaign.created_at as string) ?? since
    ).getTime();

    const { data: clicks } = await supabase
      .from("review_request_clicks")
      .select("id, recipient_id, message_id, clicked_at")
      .eq("campaign_id", campaign.id)
      .gte("clicked_at", new Date(campaignStart).toISOString())
      .order("clicked_at", { ascending: false })
      .limit(200);

    for (const review of reviewRows) {
      const reviewId = String(review.id);
      const reviewAt = new Date(
        String(
          (review as { created_at?: string }).created_at ??
            (review as { review_date?: string }).review_date ??
            Date.now()
        )
      ).getTime();
      if (Number.isNaN(reviewAt) || reviewAt < campaignStart) continue;

      const { data: existing } = await supabase
        .from("review_campaign_attributions")
        .select("id")
        .eq("business_id", params.businessId)
        .eq("campaign_id", campaign.id)
        .eq("review_id", reviewId)
        .maybeSingle();
      if (existing) continue;

      const reviewerName = String(
        (review as { reviewer_name?: string | null }).reviewer_name ?? ""
      )
        .trim()
        .toLowerCase();

      let best:
        | {
            recipientId: string;
            level: AttributionLevel;
            hoursSinceClick: number | null;
            clickId: string;
          }
        | null = null;

      for (const click of clicks ?? []) {
        const clickedAt = new Date(String(click.clicked_at)).getTime();
        if (Number.isNaN(clickedAt) || reviewAt < clickedAt) continue;
        const hoursSinceClick = (reviewAt - clickedAt) / 3600_000;
        if (hoursSinceClick > lookback) continue;

        let hasApprovedIdentifier = false;
        if (reviewerName && click.recipient_id) {
          const { data: recipient } = await supabase
            .from("review_request_recipients")
            .select("first_name, last_name, full_name")
            .eq("id", click.recipient_id)
            .maybeSingle();
          const full = [recipient?.first_name, recipient?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim()
            .toLowerCase();
          const alt = String(recipient?.full_name ?? "")
            .trim()
            .toLowerCase();
          if (reviewerName && (reviewerName === full || reviewerName === alt) && reviewerName.length > 2) {
            // Unique name among campaign recipients (full_name OR first+last).
            const { data: namePeers } = await supabase
              .from("review_request_recipients")
              .select("id, first_name, last_name, full_name")
              .eq("campaign_id", campaign.id)
              .limit(500);
            const matches = (namePeers ?? []).filter((r) => {
              const f = [r.first_name, r.last_name].filter(Boolean).join(" ").trim().toLowerCase();
              const a = String(r.full_name ?? "").trim().toLowerCase();
              return reviewerName === f || reviewerName === a;
            });
            hasApprovedIdentifier = matches.length === 1;
          }
        }

        const level = labelReviewAttribution({
          hasUniqueTrackedClick: true,
          hasApprovedIdentifier,
          hoursSinceClick,
          likelyWindowHours: lookback,
        });

        if (
          !best ||
          rank(level) > rank(best.level) ||
          (rank(level) === rank(best.level) &&
            (hoursSinceClick ?? 999) < (best.hoursSinceClick ?? 999))
        ) {
          best = {
            recipientId: String(click.recipient_id),
            level,
            hoursSinceClick,
            clickId: String(click.id),
          };
        }
      }

      const level: AttributionLevel = best?.level ?? "unattributed";
      const { error } = await supabase.from("review_campaign_attributions").insert({
        organization_id: params.organizationId,
        business_id: params.businessId,
        campaign_id: campaign.id,
        recipient_id: best?.recipientId ?? null,
        review_id: reviewId,
        attribution_level: level,
        evidence_json: {
          click_id: best?.clickId ?? null,
          hours_since_click: best?.hoursSinceClick ?? null,
          reviewer_name_matched: level === "confirmed",
        },
        detected_at: new Date(reviewAt).toISOString(),
      });
      if (error) {
        logger.warn("attribution_insert_failed", { error: error.message, reviewId });
        continue;
      }
      written++;

      if (best?.recipientId && level !== "unattributed") {
        await supabase
          .from("review_request_recipients")
          .update({
            review_detected_at: new Date(reviewAt).toISOString(),
            review_attribution: level,
            updated_at: new Date().toISOString(),
          })
          .eq("id", best.recipientId);

        // Confirmed/likely review → stop remaining reminders (all success modes).
        const { completeRecipientOnSuccess } = await import("@/lib/reputation/campaigns");
        await completeRecipientOnSuccess({
          supabase,
          campaignId: String(campaign.id),
          recipientId: String(best.recipientId),
          reason: "review_detected",
        }).catch(() => undefined);
      }
    }
  }

  return written;
}

function rank(level: AttributionLevel): number {
  if (level === "confirmed") return 3;
  if (level === "likely") return 2;
  return 1;
}
