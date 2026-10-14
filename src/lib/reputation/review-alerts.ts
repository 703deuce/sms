import { createServiceClient } from "@/lib/db/client";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import { logger } from "@/lib/observability/logger";

export type NotificationSettings = {
  every_new_review: boolean;
  low_rating_only: boolean;
  unanswered_only: boolean;
  daily_summary: boolean;
  weekly_summary: boolean;
  email_recipients: string[];
  velocity_drop: boolean;
  competitor_velocity_spike: boolean;
  no_reviews_days: number;
  rating_changed: boolean;
  response_overdue: boolean;
  campaign_delivery_problem: boolean;
  review_gap_widening: boolean;
  maps_visibility_moved: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  every_new_review: true,
  low_rating_only: false,
  unanswered_only: false,
  daily_summary: false,
  weekly_summary: false,
  email_recipients: [],
  velocity_drop: true,
  competitor_velocity_spike: true,
  no_reviews_days: 14,
  rating_changed: true,
  response_overdue: true,
  campaign_delivery_problem: true,
  review_gap_widening: true,
  maps_visibility_moved: true,
};

function mapSettingsRow(data: Record<string, unknown> | null | undefined): NotificationSettings {
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    every_new_review: Boolean(data.every_new_review ?? DEFAULT_SETTINGS.every_new_review),
    low_rating_only: Boolean(data.low_rating_only),
    unanswered_only: Boolean(data.unanswered_only),
    daily_summary: Boolean(data.daily_summary),
    weekly_summary: Boolean(data.weekly_summary),
    email_recipients: Array.isArray(data.email_recipients)
      ? (data.email_recipients as string[]).map(String)
      : [],
    velocity_drop: Boolean(data.velocity_drop ?? DEFAULT_SETTINGS.velocity_drop),
    competitor_velocity_spike: Boolean(
      data.competitor_velocity_spike ?? DEFAULT_SETTINGS.competitor_velocity_spike
    ),
    no_reviews_days:
      data.no_reviews_days != null ? Number(data.no_reviews_days) : DEFAULT_SETTINGS.no_reviews_days,
    rating_changed: Boolean(data.rating_changed ?? DEFAULT_SETTINGS.rating_changed),
    response_overdue: Boolean(data.response_overdue ?? DEFAULT_SETTINGS.response_overdue),
    campaign_delivery_problem: Boolean(
      data.campaign_delivery_problem ?? DEFAULT_SETTINGS.campaign_delivery_problem
    ),
    review_gap_widening: Boolean(data.review_gap_widening ?? DEFAULT_SETTINGS.review_gap_widening),
    maps_visibility_moved: Boolean(
      data.maps_visibility_moved ?? DEFAULT_SETTINGS.maps_visibility_moved
    ),
  };
}

export async function getNotificationSettings(businessId: string): Promise<NotificationSettings> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("review_notification_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  return mapSettingsRow(data as Record<string, unknown> | null);
}

export async function upsertNotificationSettings(params: {
  organizationId: string;
  businessId: string;
  settings: Partial<NotificationSettings>;
}): Promise<NotificationSettings> {
  const supabase = createServiceClient();
  const current = await getNotificationSettings(params.businessId);
  const next: NotificationSettings = {
    ...current,
    ...params.settings,
    email_recipients: params.settings.email_recipients ?? current.email_recipients,
    no_reviews_days: params.settings.no_reviews_days ?? current.no_reviews_days,
  };

  const payload = {
    organization_id: params.organizationId,
    business_id: params.businessId,
    every_new_review: next.every_new_review,
    low_rating_only: next.low_rating_only,
    unanswered_only: next.unanswered_only,
    daily_summary: next.daily_summary,
    weekly_summary: next.weekly_summary,
    email_recipients: next.email_recipients,
    velocity_drop: next.velocity_drop,
    competitor_velocity_spike: next.competitor_velocity_spike,
    no_reviews_days: next.no_reviews_days,
    rating_changed: next.rating_changed,
    response_overdue: next.response_overdue,
    campaign_delivery_problem: next.campaign_delivery_problem,
    review_gap_widening: next.review_gap_widening,
    maps_visibility_moved: next.maps_visibility_moved,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("review_notification_settings")
    .upsert(payload, { onConflict: "business_id" });
  if (error) {
    // Migration 077 not applied — save base fields only.
    if (/column .* does not exist|schema cache/i.test(error.message)) {
      const { error: legacyError } = await supabase.from("review_notification_settings").upsert(
        {
          organization_id: params.organizationId,
          business_id: params.businessId,
          every_new_review: next.every_new_review,
          low_rating_only: next.low_rating_only,
          unanswered_only: next.unanswered_only,
          daily_summary: next.daily_summary,
          weekly_summary: next.weekly_summary,
          email_recipients: next.email_recipients,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
      if (legacyError) throw new Error(legacyError.message);
      return next;
    }
    throw new Error(error.message);
  }
  return next;
}

/**
 * Scan recent business_reviews and email configured recipients for new alerts.
 * Idempotent via review_notification_events.event_key.
 */
export async function processNewReviewAlerts(limitBusinesses = 20): Promise<number> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();

  const { data: settingsRows } = await supabase
    .from("review_notification_settings")
    .select("*")
    .eq("every_new_review", true)
    .limit(limitBusinesses);

  if (!settingsRows?.length) return 0;

  let sent = 0;
  for (const settings of settingsRows) {
    const recipients = Array.isArray(settings.email_recipients)
      ? (settings.email_recipients as string[]).map(String).filter((e) => e.includes("@"))
      : [];
    if (!recipients.length) continue;

    const { data: reviews } = await supabase
      .from("business_reviews")
      .select("id, reviewer_name, rating, review_text, review_date, owner_response_text, created_at")
      .eq("business_id", settings.business_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15);

    for (const review of reviews ?? []) {
      const rating = review.rating != null ? Number(review.rating) : null;
      if (settings.low_rating_only && (rating == null || rating > 3)) continue;
      if (settings.unanswered_only && review.owner_response_text) continue;

      const eventKey = `new_review:${review.id}`;
      const { data: existing } = await supabase
        .from("review_notification_events")
        .select("id")
        .eq("business_id", settings.business_id)
        .eq("event_key", eventKey)
        .maybeSingle();
      if (existing) continue;

      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", settings.business_id)
        .maybeSingle();

      const subject = `New ${rating != null ? `${rating}★ ` : ""}review${business?.name ? ` — ${business.name}` : ""}`;
      const body = [
        `A new Google review was detected${business?.name ? ` for ${business.name}` : ""}.`,
        "",
        `Reviewer: ${review.reviewer_name || "Anonymous"}`,
        rating != null ? `Rating: ${rating}` : null,
        review.review_date ? `Date: ${review.review_date}` : null,
        "",
        review.review_text || "(no text)",
        "",
        "Attribution is confirmed only when tracking evidence matches — see Campaigns for honest labels.",
      ]
        .filter(Boolean)
        .join("\n");

      let allOk = true;
      for (const to of recipients) {
        const result = await sendBrevoEmail({
          toEmail: to,
          subject,
          textBody: body,
          organizationId: String(settings.organization_id ?? ""),
          businessId: String(settings.business_id ?? ""),
        });
        if (!result.ok) {
          allOk = false;
          logger.warn("review_alert_send_failed", { to, error: result.error });
        }
      }

      if (!allOk) continue;

      const { error } = await supabase.from("review_notification_events").insert({
        organization_id: settings.organization_id,
        business_id: settings.business_id,
        event_key: eventKey,
        event_type: "new_review",
        payload_json: {
          review_id: review.id,
          rating,
          reviewer_name: review.reviewer_name,
        },
      });
      if (error) {
        logger.warn("review_alert_event_insert_failed", { error: error.message });
        continue;
      }
      sent++;
    }
  }

  return sent;
}
