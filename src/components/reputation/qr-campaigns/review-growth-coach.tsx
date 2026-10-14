"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Lightbulb,
  Loader2,
  MessageSquareText,
  QrCode,
  TrendingUp,
} from "lucide-react";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-data";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";
import { qrUi } from "./qr-ui";

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

type Opportunity = {
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  icon: typeof Lightbulb;
};

export function ReviewGrowthCoach({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewOverviewData;
}) {
  const [campaigns, setCampaigns] = useState<ReviewQrCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/reputation/qr-campaigns?businessId=${encodeURIComponent(businessId)}&status=all`
        );
        const json = (await res.json()) as { campaigns?: ReviewQrCampaign[] };
        if (!cancelled) setCampaigns(json.campaigns ?? []);
      } catch {
        if (!cancelled) setCampaigns([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const health = useMemo(() => {
    if (!data.hasReviewsData) return { label: "Getting started", tone: "neutral" as const };
    if (data.unansweredNegative > 0) return { label: "Needs attention", tone: "warn" as const };
    if (data.momentumLabel.toLowerCase().includes("slow") || data.reviews30d < 2) {
      return { label: "Slowing", tone: "warn" as const };
    }
    if (data.momentumLabel.toLowerCase().includes("acceler") || data.reviews30d >= 4) {
      return { label: "Strong", tone: "good" as const };
    }
    return { label: "Good", tone: "good" as const };
  }, [data]);

  const opportunity = useMemo((): Opportunity => {
    const active = campaigns.filter((c) => c.status === "active");
    const stale = active
      .map((c) => ({ c, days: daysSince(c.lastScannedAt) }))
      .filter((x) => x.days == null || x.days >= 12)
      .sort((a, b) => (b.days ?? 999) - (a.days ?? 999))[0];

    if (data.unansweredNegative > 0) {
      return {
        title: "Respond to negative reviews first",
        body: `You have ${data.unansweredNegative} unanswered negative review${
          data.unansweredNegative === 1 ? "" : "s"
        }. A fast, helpful reply protects conversion while you grow volume.`,
        ctaLabel: "Open review feed",
        href: `/businesses/${businessId}/reputation/reviews`,
        icon: MessageSquareText,
      };
    }

    if (campaigns.length === 0) {
      return {
        title: "Biggest opportunity this week",
        body: "You don’t have a tracked QR campaign yet. Put a front-desk poster where every customer waits — then measure scans.",
        ctaLabel: "Create QR campaign",
        href: `/businesses/${businessId}/reputation/qr-campaigns/new`,
        icon: QrCode,
      };
    }

    if (stale) {
      const days = stale.days;
      return {
        title: "Biggest opportunity this week",
        body:
          days == null
            ? `“${stale.c.name}” hasn’t recorded a scan yet. Print a second placement (waiting area or vehicle) and keep the tracked QR — not a direct Google link.`
            : `“${stale.c.name}” hasn’t been scanned in ${days} days. Print a second poster for your waiting area, or refresh the placement so customers can see it.`,
        ctaLabel: "Open QR campaign",
        href: `/businesses/${businessId}/reputation/qr-campaigns/${stale.c.id}`,
        icon: QrCode,
      };
    }

    if (data.competitorRank != null && data.competitorPoolSize != null && data.competitorRank > 1) {
      return {
        title: "Close the competitor gap",
        body: `You’re #${data.competitorRank} of ${data.competitorPoolSize} nearby. Competitors are gaining reviews — pair QR placements with SMS review requests after every job.`,
        ctaLabel: "Send review requests",
        href: `/businesses/${businessId}/reputation/campaigns`,
        icon: TrendingUp,
      };
    }

    return {
      title: data.nextAction.title,
      body: data.nextAction.body,
      ctaLabel: data.nextAction.ctaLabel,
      href: `/businesses/${businessId}/reputation/campaigns`,
      icon: Lightbulb,
    };
  }, [businessId, campaigns, data]);

  const Icon = opportunity.icon;

  return (
    <div className={cn(qrUi.card, "overflow-hidden border-l-4 border-l-[#16A34A]")}>
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="border-b border-[#E6EAF0] bg-[linear-gradient(160deg,#ECFDF3_0%,#ffffff_70%)] p-5 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#027A48]">
            Grow Google Reviews
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-[#0B1B32]">Review Health</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-bold",
                health.tone === "good" && "bg-[#ECFDF3] text-[#027A48]",
                health.tone === "warn" && "bg-[#FFFAEB] text-[#B54708]",
                health.tone === "neutral" && "bg-[#F2F4F7] text-[#475467]"
              )}
            >
              {health.label}
            </span>
            {data.googleRating != null ? (
              <span className="text-sm text-[#486581]">
                Rating <strong className="text-[#0B1B32]">{data.googleRating.toFixed(1)}</strong>
              </span>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                Growth
              </dt>
              <dd className="mt-0.5 font-semibold text-[#0B1B32]">{data.momentumLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                Maps
              </dt>
              <dd className="mt-0.5 font-semibold text-[#0B1B32]">
                {data.hasMapsData
                  ? data.mapsAvgRankDelta != null && data.mapsAvgRankDelta < 0
                    ? "Improving"
                    : "Tracking"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                Reviews (30d)
              </dt>
              <dd className="mt-0.5 font-semibold text-[#0B1B32]">{data.reviews30d}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                QR campaigns
              </dt>
              <dd className="mt-0.5 font-semibold text-[#0B1B32]">
                {loading ? "…" : campaigns.filter((c) => c.status === "active").length}
              </dd>
            </div>
          </dl>
        </div>

        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#027A48]">
                Biggest opportunity this week
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#0B1B32]">{opportunity.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#486581]">{opportunity.body}</p>
              <Link href={opportunity.href} className={cn(qrUi.btnPrimary, "mt-4")}>
                {opportunity.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
