import { differenceInCalendarDays, startOfDay } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { hasOwnerResponse } from "@/lib/reviews/normalize";
import { loadStoredReviews, reviewsInWindow } from "@/lib/reviews/review-store";
import { getNotificationSettings, type NotificationSettings } from "@/lib/reputation/review-alerts";

export type ReputationAlertSeverity = "low" | "medium" | "high" | "critical";
export type ReputationAlertStatus = "active" | "resolved" | "dismissed";

export type ReputationAlertRow = {
  id: string;
  source: "persisted" | "synthesized";
  category: string;
  severity: ReputationAlertSeverity;
  title: string;
  body: string | null;
  recommendedAction: string | null;
  status: ReputationAlertStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type ReputationAlertsData = {
  businessId: string;
  businessName: string;
  activeAlerts: ReputationAlertRow[];
  resolvedAlerts: ReputationAlertRow[];
  preferences: NotificationSettings & {
    velocity_drop?: boolean;
    competitor_velocity_spike?: boolean;
    no_reviews_days?: number;
    rating_changed?: boolean;
    response_overdue?: boolean;
    campaign_delivery_problem?: boolean;
    review_gap_widening?: boolean;
    maps_visibility_moved?: boolean;
  };
  previewMetrics?: {
    activeCount: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    requiringAction: number;
    resolved30d: number;
    notificationsSent: number;
    alertAccuracy: number;
  };
};

type PersistedAlertRow = {
  id: string;
  category: string;
  severity: ReputationAlertSeverity | string;
  title: string;
  body: string | null;
  recommended_action: string | null;
  status: ReputationAlertStatus | string;
  created_at: string;
  resolved_at: string | null;
};

const SEVERITIES: ReputationAlertSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: ReputationAlertStatus[] = ["active", "resolved", "dismissed"];

function coerceSeverity(value: string | null | undefined): ReputationAlertSeverity {
  return SEVERITIES.includes(value as ReputationAlertSeverity)
    ? (value as ReputationAlertSeverity)
    : "medium";
}

function coerceStatus(value: string | null | undefined): ReputationAlertStatus {
  return STATUSES.includes(value as ReputationAlertStatus)
    ? (value as ReputationAlertStatus)
    : "active";
}

async function loadPersistedAlerts(businessId: string): Promise<ReputationAlertRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("reputation_alerts")
    .select("id, category, severity, title, body, recommended_action, status, created_at, resolved_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (/relation .*reputation_alerts|schema cache|does not exist/i.test(error.message)) return [];
    console.warn("[ReputationAlerts] reputation_alerts query skipped:", error.message);
    return [];
  }

  return ((data ?? []) as PersistedAlertRow[]).map((row) => ({
    id: row.id,
    source: "persisted",
    category: row.category,
    severity: coerceSeverity(row.severity),
    title: row.title,
    body: row.body,
    recommendedAction: row.recommended_action,
    status: coerceStatus(row.status),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

async function loadPreferenceRow(businessId: string): Promise<Partial<ReputationAlertsData["preferences"]>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("review_notification_settings")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) return {};
  return data as Partial<ReputationAlertsData["preferences"]>;
}

function synthesizePreferenceAlerts(settings: ReputationAlertsData["preferences"]): ReputationAlertRow[] {
  const alerts: ReputationAlertRow[] = [];
  const recipients = settings.email_recipients ?? [];

  if (settings.every_new_review && recipients.length === 0) {
    alerts.push({
      id: "synthetic-alert-recipients",
      source: "synthesized",
      category: "preferences",
      severity: "medium",
      title: "Review alerts are enabled without recipients",
      body: "New review notifications are on, but no email recipients are configured.",
      recommendedAction: "Add at least one recipient in Preferences.",
      status: "active",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
  }

  if (settings.no_reviews_days != null && settings.no_reviews_days > 30) {
    alerts.push({
      id: "synthetic-alert-drought-threshold",
      source: "synthesized",
      category: "preferences",
      severity: "low",
      title: "Review drought alert threshold is relaxed",
      body: `No-review alerts wait ${settings.no_reviews_days} days before firing.`,
      recommendedAction: "Lower the threshold if you want earlier reputation warnings.",
      status: "active",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
  }

  return alerts;
}

export async function loadReputationAlertsData(businessId: string): Promise<ReputationAlertsData> {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) throw new Error("Business not found");

  const [persistedAlerts, settings, preferenceRow, reviews] = await Promise.all([
    loadPersistedAlerts(businessId),
    getNotificationSettings(businessId),
    loadPreferenceRow(businessId),
    loadStoredReviews(supabase, { businessId, lookbackDays: 90 }),
  ]);

  const preferences: ReputationAlertsData["preferences"] = {
    ...settings,
    ...preferenceRow,
    email_recipients: Array.isArray(preferenceRow.email_recipients)
      ? preferenceRow.email_recipients.map(String)
      : settings.email_recipients,
  };

  const recentReviews = reviewsInWindow(reviews, 90);
  const synthesizedReviewAlerts = recentReviews
    .filter((row) => {
      const rating = row.rating != null ? Number(row.rating) : null;
      return rating != null && rating <= 3 && !hasOwnerResponse(row.owner_response_text);
    })
    .slice(0, 20)
    .map((row): ReputationAlertRow => {
      const rating = row.rating != null ? Number(row.rating) : null;
      const reviewDate = row.review_date ? startOfDay(new Date(row.review_date)) : new Date();
      const daysWaiting = differenceInCalendarDays(new Date(), reviewDate);
      const severity: ReputationAlertSeverity =
        rating != null && rating <= 2 && daysWaiting >= 7
          ? "critical"
          : rating != null && rating <= 2
            ? "high"
            : "medium";

      return {
        id: `synthetic-negative-${row.id}`,
        source: "synthesized",
        category: "unanswered_negative",
        severity,
        title: `${rating ?? "Low"}-star review needs a response`,
        body: row.review_text?.trim() || "A low-rating review is currently unanswered.",
        recommendedAction: "Reply to the reviewer and address the issue directly.",
        status: "active",
        createdAt: row.review_date ? `${row.review_date}T00:00:00.000Z` : row.created_at,
        resolvedAt: null,
      };
    });

  const activeAlerts = [
    ...synthesizedReviewAlerts,
    ...synthesizePreferenceAlerts(preferences),
    ...persistedAlerts.filter((alert) => alert.status === "active"),
  ].sort((a, b) => {
    const severityRank = (severity: ReputationAlertSeverity) => SEVERITIES.indexOf(severity);
    const rankDelta = severityRank(b.severity) - severityRank(a.severity);
    if (rankDelta !== 0) return rankDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const resolvedAlerts = persistedAlerts
    .filter((alert) => alert.status === "resolved" || alert.status === "dismissed")
    .sort((a, b) => new Date(b.resolvedAt ?? b.createdAt).getTime() - new Date(a.resolvedAt ?? a.createdAt).getTime());

  return {
    businessId,
    businessName: String(business.name ?? "Your business"),
    activeAlerts,
    resolvedAlerts,
    preferences,
  };
}
