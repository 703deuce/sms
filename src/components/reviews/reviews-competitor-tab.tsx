"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { mock } from "@/components/mockup/ui";
import { StarRating } from "@/components/reviews/reviews-ui";

function competitorBlurb(reviewCount: number): string {
  if (reviewCount >= 10) {
    return "very popular and above average for your industry.";
  }
  if (reviewCount >= 5) {
    return "doing well and about average for your market.";
  }
  return "getting started and below average for review volume.";
}

type Props = {
  data: ReviewsPageData;
  businessId: string;
};

export function ReviewsCompetitorTab({ data, businessId }: Props) {
  const competitorsHref = `/businesses/${businessId}/reputation/competitors`;
  const competitors = data.competitors ?? [];
  const [filter, setFilter] = useState<"all" | string>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return competitors;
    return competitors.filter((c) => c.id === filter);
  }, [competitors, filter]);

  const themePills = useMemo(() => {
    const fromKeywords = data.competitorWinningKeywords?.slice(0, 6) ?? [];
    if (fromKeywords.length > 0) {
      return fromKeywords.map((t) => ({ label: t.keyword, count: t.count }));
    }
    const fromThemes = data.sentiment?.yours?.themes?.slice(0, 6) ?? [];
    if (fromThemes.length > 0) {
      return fromThemes.map((t) => ({ label: t.label, count: t.reviewCount }));
    }
    return [
      { label: "Appointment Scheduling", count: 11 },
      { label: "Residential Junk", count: 7 },
      { label: "Professionalism", count: 7 },
      { label: "Safe Driver", count: 5 },
      { label: "Quick Response", count: 5 },
      { label: "Customer Service", count: 2 },
    ];
  }, [data.competitorWinningKeywords, data.sentiment]);

  const insights = [
    "Review density must be improved",
    "Set up auto-replies",
    "Professional reviews only",
  ];

  const opportunities = [
    "Improve review volume for March up 2",
    "Reduce negative review from 5 to 0 in the first 30 days",
    "Faster response to negative review",
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px] text-[#64748B]">
          <span className="font-medium">Competitors</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-[#E6EAF0] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0F172A] outline-none focus:border-[#137752]"
          >
            <option value="all">All Competitors ({competitors.length})</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`${mock.card} p-5`}>
          <h3 className="text-[16px] font-bold text-[#0F172A]">
            Competitor Reviewing Analysis (Off-site)
          </h3>

          <div className="mt-4 space-y-0 divide-y divide-[#EEF1F5]">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#64748B]">
                No competitor review data yet. Add competitors from your workspace to compare.
              </p>
            ) : (
              filtered.map((comp) => {
                const count = comp.newReviews90d ?? comp.totalReviews ?? 0;
                const rating = comp.avgRating ?? comp.rating ?? 5;
                return (
                  <div key={comp.id} className="py-4 first:pt-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-[#0F172A]">{comp.name}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          <StarRating rating={rating} />
                          <span className="text-[12px] text-[#64748B]">
                            {count} reviews (30 days)
                          </span>
                          <Link
                            href={competitorsHref}
                            className="text-[12px] font-semibold text-[#137752] hover:underline"
                          >
                            View Reviews
                          </Link>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                          {comp.name} is {competitorBlurb(count)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            href={competitorsHref}
            className="mt-2 inline-block text-[13px] font-semibold text-[#137752] hover:underline"
          >
            View all competitor reviews details →
          </Link>
        </div>

        <aside className="space-y-4">
          <div className={`${mock.card} p-4`}>
            <h3 className="text-[14px] font-bold text-[#0F172A]">Top Insights</h3>
            <ul className="mt-3 space-y-2.5">
              {insights.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#0F172A]">
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${mock.card} p-4`}>
            <h3 className="text-[14px] font-bold text-[#0F172A]">Common Product Themes</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {themePills.map((t) => (
                <span
                  key={t.label}
                  className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-medium text-[#475569]"
                >
                  {t.label} ({t.count})
                </span>
              ))}
            </div>
          </div>

          <div className={`${mock.card} p-4`}>
            <h3 className="text-[14px] font-bold text-[#0F172A]">Opportunities for You</h3>
            <ul className="mt-3 space-y-2.5">
              {opportunities.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#0F172A]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href={competitorsHref}
              className="mt-3 inline-block text-[13px] font-semibold text-[#137752] hover:underline"
            >
              View all competitor reports →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
