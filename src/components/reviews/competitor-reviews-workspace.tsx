"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  MessageSquareReply,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import {
  ReviewerAvatar,
  SourceIcon,
  StarRating,
  TagPills,
} from "@/components/reviews/reviews-ui";
import { RepBadge, RepMetricCard, rep } from "@/components/reputation/rep-ui";
import type { CompetitorLeaderboardRow } from "@/lib/reviews/competitor-intelligence-data";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;
const COMPANY_COLORS = ["#2563EB", "#7C3AED", "#0891B2", "#DB2777", "#CA8A04", "#4F46E5"];

type CompanyOption = {
  id: string;
  name: string;
  shortName: string;
  isYou: boolean;
  count: number;
  color: string;
  row: CompetitorLeaderboardRow | null;
};

type SentimentFilter = "all" | "positive" | "neutral" | "negative";
type SourceFilter = "all" | "google" | "facebook" | "yelp";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return parts.slice(0, 2).join(" ");
}

function companyKey(review: ReviewListItem, youId: string): string {
  if (review.isTarget) return youId;
  return review.competitorId ?? review.businessName;
}

function sentimentOf(review: ReviewListItem): "positive" | "neutral" | "negative" | null {
  if (review.rating == null) return null;
  if (review.rating >= 4) return "positive";
  if (review.rating === 3) return "neutral";
  return "negative";
}

function themeCounts(reviews: ReviewListItem[], limit = 6): Array<{ label: string; count: number; positive: number; negative: number }> {
  const map = new Map<string, { count: number; positive: number; negative: number }>();
  for (const review of reviews) {
    const sentiment = sentimentOf(review);
    for (const tag of review.tags) {
      const current = map.get(tag) ?? { count: 0, positive: 0, negative: 0 };
      current.count += 1;
      if (sentiment === "positive") current.positive += 1;
      if (sentiment === "negative") current.negative += 1;
      map.set(tag, current);
    }
  }
  return Array.from(map.entries())
    .map(([label, stats]) => ({ label, ...stats }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function fmt(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function ThemeBar({ label, positive, negative, total }: { label: string; positive: number; negative: number; total: number }) {
  const posPct = total > 0 ? (positive / total) * 100 : 0;
  const negPct = total > 0 ? (negative / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[#344054]">{label}</span>
        <span className="tabular-nums text-[#98A2B3]">{total}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
        <div className="h-full bg-[#137752]" style={{ width: `${posPct}%` }} />
        <div className="h-full bg-[#F04438]" style={{ width: `${negPct}%` }} />
      </div>
    </div>
  );
}

export function CompetitorReviewsWorkspace({
  businessId,
  businessName,
  leaderboardRows,
  reviewsFeed,
}: {
  businessId: string;
  businessName: string;
  leaderboardRows: CompetitorLeaderboardRow[];
  reviewsFeed: ReviewListItem[];
}) {
  const youId = leaderboardRows.find((row) => row.isYou)?.id ?? businessId;
  const youRow = leaderboardRows.find((row) => row.isYou) ?? null;

  const companies = useMemo<CompanyOption[]>(() => {
    const counts = new Map<string, number>();
    for (const review of reviewsFeed) {
      const key = companyKey(review, youId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return leaderboardRows
      .map((row, index) => ({
        id: row.id,
        name: row.isYou ? businessName || row.name : row.name,
        shortName: row.isYou ? "You" : shortName(row.name),
        isYou: row.isYou,
        count: counts.get(row.id) ?? (row.isYou ? counts.get(youId) ?? 0 : 0),
        color: row.isYou ? "#137752" : COMPANY_COLORS[index % COMPANY_COLORS.length]!,
        row,
      }))
      .sort((a, b) => Number(b.isYou) - Number(a.isYou) || b.count - a.count);
  }, [businessName, leaderboardRows, reviewsFeed, youId]);

  const [selectedIds, setSelectedIds] = useState<string[]>(["all"]);
  const [compareMode, setCompareMode] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);

  const activeIds = useMemo(() => {
    if (selectedIds.includes("all") && !compareMode) return null;
    return new Set(selectedIds.filter((id) => id !== "all"));
  }, [compareMode, selectedIds]);

  const filteredReviews = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reviewsFeed.filter((review) => {
      const key = companyKey(review, youId);
      if (activeIds && activeIds.size > 0 && !activeIds.has(key)) return false;
      if (ratingFilter !== "all" && Math.round(review.rating ?? 0) !== Number(ratingFilter)) return false;
      if (themeFilter && !review.tags.some((tag) => tag.toLowerCase() === themeFilter.toLowerCase())) return false;
      if (sentimentFilter !== "all" && sentimentOf(review) !== sentimentFilter) return false;
      if (sourceFilter !== "all" && review.source !== sourceFilter) return false;
      if (needle) {
        const haystack = `${review.reviewerName} ${review.businessName} ${review.reviewText ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [activeIds, query, ratingFilter, reviewsFeed, sentimentFilter, sourceFilter, themeFilter, youId]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageReviews = filteredReviews.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [selectedIds, compareMode, ratingFilter, themeFilter, sentimentFilter, sourceFilter, query]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const snapshotCompany = useMemo(() => {
    if (!activeIds || activeIds.size !== 1) return null;
    const id = Array.from(activeIds)[0]!;
    return companies.find((company) => company.id === id) ?? null;
  }, [activeIds, companies]);

  const snapshotReviews = useMemo(() => {
    if (!snapshotCompany) return filteredReviews;
    return reviewsFeed.filter((review) => companyKey(review, youId) === snapshotCompany.id);
  }, [filteredReviews, reviewsFeed, snapshotCompany, youId]);

  const themes = useMemo(() => themeCounts(reviewsFeed, 8), [reviewsFeed]);
  const snapshotThemes = useMemo(() => themeCounts(snapshotReviews, 5), [snapshotReviews]);

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of reviewsFeed) {
      if (review.rating == null) continue;
      const rating = Math.round(review.rating);
      if (rating >= 1 && rating <= 5) counts[rating as 1 | 2 | 3 | 4 | 5] += 1;
    }
    return counts;
  }, [reviewsFeed]);

  const sourceCounts = useMemo(() => {
    const counts = { all: reviewsFeed.length, google: 0, facebook: 0, yelp: 0 };
    for (const review of reviewsFeed) counts[review.source] += 1;
    return counts;
  }, [reviewsFeed]);

  const kpiPool = snapshotCompany ? snapshotReviews : reviewsFeed;
  const ratedPool = kpiPool.filter((review) => review.rating != null);
  const avgRating =
    ratedPool.length > 0
      ? ratedPool.reduce((sum, review) => sum + (review.rating ?? 0), 0) / ratedPool.length
      : youRow?.rating ?? null;
  const responseRate =
    kpiPool.length > 0
      ? Math.round((kpiPool.filter((review) => review.replied).length / kpiPool.length) * 100)
      : youRow?.responseRate ?? 0;
  const weeklyVelocity =
    snapshotCompany?.row != null
      ? Math.round((snapshotCompany.row.reviews30 / (30 / 7)) * 10) / 10
      : youRow
        ? Math.round((youRow.reviews30 / (30 / 7)) * 10) / 10
        : 0;

  function selectSingle(id: string) {
    setCompareMode(false);
    setSelectedIds([id]);
  }

  function toggleCompare(id: string) {
    setCompareMode(true);
    setSelectedIds((prev) => {
      const withoutAll = prev.filter((value) => value !== "all");
      if (withoutAll.includes(id)) {
        const next = withoutAll.filter((value) => value !== id);
        if (!next.length) {
          setCompareMode(false);
          return ["all"];
        }
        return next;
      }
      return [...withoutAll, id];
    });
  }

  const companyColor = (id: string) => companies.find((company) => company.id === id)?.color ?? "#667085";
  const summaryRating = snapshotCompany?.row?.rating ?? avgRating;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <RepMetricCard
          label="Total Reviews"
          value={fmt(kpiPool.length)}
          hint={snapshotCompany ? snapshotCompany.name : "You + tracked competitors"}
          icon={MessageSquareReply}
        />
        <RepMetricCard
          label="Avg Rating"
          value={summaryRating != null ? fmt(summaryRating, 1) : "—"}
          hint={<StarRating rating={summaryRating} size="sm" />}
          icon={Star}
        />
        <RepMetricCard
          label="Review Velocity"
          value={`${fmt(weeklyVelocity, 1)}/wk`}
          hint="Last 30 days paced weekly"
          icon={TrendingUp}
        />
        <RepMetricCard
          label="Response Rate"
          value={`${fmt(responseRate)}%`}
          hint="Owner replies in this feed"
          icon={CheckCircle2}
        />
        <RepMetricCard
          label="Businesses"
          value={fmt(companies.length)}
          hint="You + competitors in view"
          icon={Building2}
        />
        <RepMetricCard
          label="Showing"
          value={`${fmt(pageReviews.length)} / ${fmt(filteredReviews.length)}`}
          hint={`Page ${safePage} of ${totalPages}`}
          icon={Search}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Left filters */}
        <aside className={cn(rep.card, "space-y-5 p-4")}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[#98A2B3]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter reviews"
                className="w-full rounded-lg border border-[#E6EAF0] bg-white py-2 pl-8 pr-3 text-sm text-[#101828] outline-none focus:border-[#137752]"
              />
            </div>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Business</p>
              <button
                type="button"
                onClick={() => {
                  if (compareMode) {
                    setCompareMode(false);
                    setSelectedIds(["all"]);
                    return;
                  }
                  setCompareMode(true);
                  setSelectedIds(companies.slice(0, 2).map((company) => company.id));
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  compareMode ? "bg-[#ECFDF3] text-[#027A48]" : "text-[#667085] hover:text-[#101828]"
                )}
              >
                <GitCompare className="h-3 w-3" />
                Compare
              </button>
            </div>
            <div className="space-y-1">
              <FilterRow
                active={!compareMode && selectedIds.includes("all")}
                label={`All Competitors (${reviewsFeed.length})`}
                onClick={() => selectSingle("all")}
                color="#101828"
              />
              {companies.map((company) => {
                const active = selectedIds.includes(company.id);
                return (
                  <FilterRow
                    key={company.id}
                    active={active}
                    label={`${company.shortName} (${company.count})`}
                    onClick={() => (compareMode ? toggleCompare(company.id) : selectSingle(company.id))}
                    color={company.color}
                    compare={compareMode}
                    checked={active}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Rating</p>
            <div className="space-y-1">
              <FilterRow active={ratingFilter === "all"} label="All ratings" onClick={() => setRatingFilter("all")} />
              {([5, 4, 3, 2, 1] as const).map((stars) => (
                <button
                  key={stars}
                  type="button"
                  onClick={() => setRatingFilter(String(stars) as typeof ratingFilter)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition",
                    ratingFilter === String(stars) ? "bg-[#ECFDF3] font-semibold text-[#027A48]" : "text-[#344054] hover:bg-[#F9FAFB]"
                  )}
                >
                  <StarRating rating={stars} size="sm" />
                  <span className="tabular-nums text-[#98A2B3]">{ratingCounts[stars]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Themes</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setThemeFilter(null)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  !themeFilter ? "bg-[#101828] text-white" : "bg-[#F2F4F7] text-[#344054]"
                )}
              >
                All
              </button>
              {themes.map((theme) => (
                <button
                  key={theme.label}
                  type="button"
                  onClick={() => setThemeFilter(theme.label)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    themeFilter === theme.label ? "bg-[#137752] text-white" : "bg-[#F2F4F7] text-[#344054]"
                  )}
                >
                  {theme.label} ({theme.count})
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Sentiment</p>
            <div className="space-y-1">
              {(
                [
                  ["all", "All sentiment"],
                  ["positive", "Positive"],
                  ["neutral", "Neutral"],
                  ["negative", "Negative"],
                ] as const
              ).map(([id, label]) => (
                <FilterRow
                  key={id}
                  active={sentimentFilter === id}
                  label={label}
                  onClick={() => setSentimentFilter(id)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Center feed */}
        <section className={cn(rep.card, "p-4")}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#101828]">Competitor Reviews</h2>
              <p className="mt-0.5 text-xs text-[#667085]">
                {filteredReviews.length} review{filteredReviews.length === 1 ? "" : "s"}
                {compareMode ? " · compare mode" : ""}
              </p>
            </div>
            <div className="flex flex-wrap rounded-lg bg-[#F2F4F7] p-1">
              {(
                [
                  ["all", `All (${sourceCounts.all})`],
                  ["google", `Google (${sourceCounts.google})`],
                  ["facebook", `Facebook (${sourceCounts.facebook})`],
                  ["yelp", `Yelp (${sourceCounts.yelp})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSourceFilter(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                    sourceFilter === id ? "bg-white text-[#137752] shadow-sm" : "text-[#667085] hover:text-[#101828]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#F2F4F7]">
            {pageReviews.length === 0 ? (
              <p className="py-14 text-center text-sm text-[#667085]">
                No reviews match these filters. Clear a filter or refresh reputation data.
              </p>
            ) : (
              pageReviews.map((review) => {
                const key = companyKey(review, youId);
                const color = companyColor(key);
                return (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => setSelectedReview(review)}
                    className="flex w-full gap-3 py-4 text-left transition first:pt-1 hover:bg-[#F9FAFB]"
                  >
                    <ReviewerAvatar name={review.reviewerName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StarRating rating={review.rating} size="md" />
                            <SourceIcon source={review.source} />
                            {(compareMode || (activeIds && activeIds.size > 0)) && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: color }}
                              >
                                {review.isTarget ? "You" : shortName(review.businessName)}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-[#101828]">{review.reviewerName}</p>
                          <p className="text-xs font-medium text-[#2563EB]">{review.businessName}</p>
                        </div>
                        <p className="shrink-0 text-xs text-[#98A2B3]">{review.relativeDate ?? "Unknown date"}</p>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#344054]">
                        {review.reviewText?.trim() || "No review text provided."}
                      </p>
                      {review.tags.length ? (
                        <div className="mt-2.5">
                          <TagPills tags={review.tags.slice(0, 4)} />
                        </div>
                      ) : null}
                      <p
                        className={cn(
                          "mt-2.5 inline-flex items-center gap-1 text-xs font-semibold",
                          review.replied ? "text-[#027A48]" : "text-[#98A2B3]"
                        )}
                      >
                        {review.replied ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        {review.replied ? "Owner responded" : "No owner response"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {filteredReviews.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F2F4F7] pt-4">
              <p className="text-xs text-[#667085]">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredReviews.length)} of {filteredReviews.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EAF0] text-[#344054] disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((pageNumber) => {
                    if (totalPages <= 7) return true;
                    if (pageNumber === 1 || pageNumber === totalPages) return true;
                    return Math.abs(pageNumber - safePage) <= 1;
                  })
                  .reduce<Array<number | "gap">>((acc, pageNumber, index, list) => {
                    if (index > 0 && pageNumber - (list[index - 1] as number) > 1) acc.push("gap");
                    acc.push(pageNumber);
                    return acc;
                  }, [])
                  .map((item, index) =>
                    item === "gap" ? (
                      <span key={`gap-${index}`} className="px-1 text-xs text-[#98A2B3]">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold",
                          safePage === item
                            ? "bg-[#137752] text-white"
                            : "border border-[#E6EAF0] text-[#344054] hover:bg-[#F9FAFB]"
                        )}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EAF0] text-[#344054] disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Right summary */}
        <aside className="space-y-4">
          <section className={cn(rep.card, "p-4")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              Review Summary
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums text-[#101828]">
                {summaryRating != null ? fmt(summaryRating, 1) : "—"}
              </span>
              <StarRating rating={summaryRating} size="md" />
            </div>
            <p className="mt-2 text-sm leading-5 text-[#667085]">
              {snapshotCompany
                ? `${snapshotCompany.name}: ${fmt(snapshotReviews.length)} reviews in the current feed.`
                : `Overall sentiment across ${fmt(filteredReviews.length)} filtered reviews from you and tracked competitors.`}
            </p>
            {snapshotCompany?.row?.momentumLabel ? (
              <div className="mt-3">
                <RepBadge tone="green">{snapshotCompany.row.momentumLabel}</RepBadge>
              </div>
            ) : null}
          </section>

          <section className={cn(rep.card, "p-4")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              Themes Breakdown
            </p>
            <div className="mt-3 space-y-3">
              {(snapshotThemes.length ? snapshotThemes : themes.slice(0, 5)).map((theme) => (
                <ThemeBar
                  key={theme.label}
                  label={theme.label}
                  positive={theme.positive}
                  negative={theme.negative}
                  total={theme.count}
                />
              ))}
              {!snapshotThemes.length && !themes.length ? (
                <p className="text-sm text-[#667085]">Theme signals appear after reviews sync.</p>
              ) : null}
            </div>
          </section>

          {snapshotCompany ? (
            <section className={cn(rep.card, "p-4")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                Company Snapshot
              </p>
              <div className="mt-3 flex items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: snapshotCompany.color }}
                >
                  {snapshotCompany.shortName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[#101828]">{snapshotCompany.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <StarRating rating={snapshotCompany.row?.rating ?? null} />
                    <span className="text-xs text-[#667085]">
                      {fmt(snapshotCompany.row?.totalReviews)} reviews
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#F2F4F7] pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                    Response Rate
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#101828]">
                    {fmt(snapshotCompany.row?.responseRate)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                    Avg Response
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#101828]">
                    {snapshotCompany.row?.responseSpeedDaysAvg != null
                      ? `${fmt(snapshotCompany.row.responseSpeedDaysAvg, 1)}d`
                      : "—"}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className={cn(rep.card, "p-4")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                Company Snapshot
              </p>
              <h3 className="mt-1 text-base font-semibold text-[#101828]">Pick one company</h3>
              <p className="mt-2 text-sm leading-5 text-[#667085]">
                Select a business in the left filter to load rating, themes, and response metrics instantly.
              </p>
            </section>
          )}
        </aside>
      </div>

      <ReviewDetailDrawer
        review={selectedReview}
        businessId={selectedReview?.isTarget ? businessId : undefined}
        onClose={() => setSelectedReview(null)}
      />
    </div>
  );
}

function FilterRow({
  active,
  label,
  onClick,
  color,
  compare,
  checked,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  color?: string;
  compare?: boolean;
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active ? "bg-[#ECFDF3] font-semibold text-[#027A48]" : "text-[#344054] hover:bg-[#F9FAFB]"
      )}
    >
      {compare ? (
        <span
          className={cn(
            "inline-flex h-3.5 w-3.5 items-center justify-center rounded border",
            checked ? "border-[#137752] bg-[#137752] text-white" : "border-[#D0D5DD] bg-white"
          )}
        >
          {checked ? <Check className="h-2.5 w-2.5" /> : null}
        </span>
      ) : color ? (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <span className="truncate">{label}</span>
    </button>
  );
}
