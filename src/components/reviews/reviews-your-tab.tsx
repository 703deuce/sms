"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Search } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import {
  ReviewStatusBadge,
  ReviewerAvatar,
  SourceIcon,
  StarRating,
  TagPills,
} from "@/components/reviews/reviews-ui";

const INITIAL_REVIEW_COUNT = 8;
const REVIEW_INCREMENT = 8;

export function ReviewsYourTab({
  data,
  businessId,
}: {
  data: ReviewsPageData;
  businessId: string;
}) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_REVIEW_COUNT);
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);

  const filtered = useMemo(() => {
    return data.yourReviews.filter((r) => {
      if (
        search &&
        !(r.reviewText ?? "").toLowerCase().includes(search.toLowerCase()) &&
        !r.reviewerName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data.yourReviews, search]);

  useEffect(() => {
    setVisibleCount(INITIAL_REVIEW_COUNT);
  }, [search]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const sentiment = data.sentiment.yours.sentiment;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="text-sm font-semibold text-[#101828]">
          Your Review Insights in last 30 days
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
              Response rate
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-[#101828]">
              {data.kpis.responseRate}%
              <span className="text-sm font-semibold text-[#027A48]">↑</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
              Response Time
            </p>
            <p className="mt-1 text-2xl font-bold text-[#101828]">
              {data.kpis.avgDaysWaiting != null
                ? `${Math.max(1, Math.round(data.kpis.avgDaysWaiting * 24))}h`
                : "—"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#667085]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#12B76A]" />
              healthy
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
              Review Count
            </p>
            <p className="mt-1 text-2xl font-bold text-[#101828]">
              {data.kpis.totalReviews}{" "}
              <span className="text-sm font-medium text-[#667085]">Total</span>
            </p>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
              <span
                className="bg-[#137752]"
                style={{ width: `${Math.max(4, sentiment.positivePct)}%` }}
              />
              <span
                className="bg-[#98A2B3]"
                style={{ width: `${Math.max(2, sentiment.neutralPct)}%` }}
              />
              <span
                className="bg-[#F04438]"
                style={{ width: `${Math.max(2, sentiment.negativePct)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedReview(data.yourReviews[0] ?? null)}
              className="mt-2 text-xs font-semibold text-[#137752] hover:underline"
            >
              View details →
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <section className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="search"
                placeholder="Search reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#137752]"
              />
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>('input[type="search"][placeholder="Search reviews..."]');
                el?.focus();
              }}
            >
              Filter
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              onClick={() => {
                const rows = [
                  ["Reviewer", "Rating", "Date", "Text"],
                  ...filtered.map((r) => [
                    r.reviewerName,
                    String(r.rating ?? ""),
                    r.reviewDate ?? "",
                    (r.reviewText ?? "").replaceAll("\n", " "),
                  ]),
                ];
                const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
                const csv = rows.map((row) => row.map((cell) => escape(String(cell))).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "reviews.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export
            </button>
          </div>

          <p className="mb-3 text-xs text-[#667085]">
            Showing {Math.min(visibleCount, filtered.length)} reviews — sorted by newest review date
          </p>

          <div className="divide-y divide-[#F2F4F7]">
            {visibleRows.map((row) => (
              <article key={row.id} className="py-3.5 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ReviewerAvatar name={row.reviewerName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#101828]">{row.reviewerName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StarRating rating={row.rating} />
                        <span className="text-xs text-[#667085]">
                          {row.relativeDate ?? "—"}
                        </span>
                        <SourceIcon source={row.source} />
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#344054]">
                        {row.reviewText?.trim() || "No review text."}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#137752]">
                        <button type="button" onClick={() => setSelectedReview(row)}>
                          View full review
                        </button>
                        {!row.replied ? (
                          <button type="button" onClick={() => setSelectedReview(row)}>
                            Generate reply
                          </button>
                        ) : (
                          <button type="button" onClick={() => setSelectedReview(row)}>
                            Share review
                          </button>
                        )}
                        {row.tags.length > 0 ? <TagPills tags={row.tags} /> : null}
                      </div>
                    </div>
                  </div>
                  <ReviewStatusBadge replied={row.replied} variant="pill" />
                </div>
              </article>
            ))}
            {!visibleRows.length ? (
              <p className="py-8 text-center text-sm text-[#667085]">No reviews match your filters.</p>
            ) : null}
          </div>

          {visibleCount < filtered.length ? (
            <div className="mt-3 border-t border-[#F2F4F7] pt-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + REVIEW_INCREMENT)}
                className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
              >
                More reviews
              </button>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="text-sm font-semibold text-[#101828]">Suggested Actions</h3>
            <ul className="mt-3 space-y-2.5">
              {(data.suggestions.length
                ? data.suggestions
                : [
                    {
                      id: "reply",
                      title: "Respond to new positive reviews",
                      description: "Keep your response rate high.",
                    },
                    {
                      id: "ai",
                      title: "Let AI draft a reply",
                      description: "Open Unanswered to generate drafts.",
                    },
                    {
                      id: "request",
                      title: "Request more reviews",
                      description: "Send a review link to recent customers.",
                    },
                  ]
              )
                .slice(0, 4)
                .map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                    <div>
                      <p className="text-sm font-medium text-[#101828]">{s.title}</p>
                      <p className="text-xs text-[#667085]">{s.description}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="text-sm font-semibold text-[#101828]">Suggested Reply Rules</h3>
            <ul className="mt-3 space-y-3">
              {[
                { title: "5-star auto-reply rewards", href: `/businesses/${businessId}/review-requests` },
                { title: "Negative Review Alerts", href: `/businesses/${businessId}/reviews?tab=unanswered` },
                { title: "New Review Digest", href: `/businesses/${businessId}/review-momentum` },
              ].map((item) => (
                <li key={item.title} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-[#344054]">
                    <Plus className="h-3.5 w-3.5 text-[#137752]" />
                    {item.title}
                  </span>
                  <Link href={item.href} className="text-xs font-semibold text-[#137752] hover:underline">
                    Manage…
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
    </div>
  );
}
