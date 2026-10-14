"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Loader2,
  MessageSquarePlus,
  PencilLine,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepSearch,
  rep,
} from "@/components/reputation/rep-ui";
import { ReputationEmptySyncState } from "@/components/reputation/reputation-sync-button";
import {
  ReviewerAvatar,
  SourceIcon,
  StarRating,
} from "@/components/reviews/reviews-ui";
import { reviewFeedPreviewData } from "@/lib/reviews/review-feed-preview-data";
import type {
  ReviewFeedDashboardData,
  ReviewFeedDetails,
} from "@/lib/reviews/review-feed-preview-data";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "google" | "facebook" | "yelp";
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";
type SentimentFilter = "all" | "positive" | "neutral" | "negative";
type ResponseFilter = "all" | "responded" | "no-response";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function sentimentFor(review: ReviewListItem): ReviewFeedDetails["sentiment"] {
  if (review.rating == null) return { label: "Neutral", confidence: 0.5 };
  if (review.rating >= 4) return { label: "Positive", confidence: 0.92 };
  if (review.rating <= 2) return { label: "Negative", confidence: 0.86 };
  return { label: "Neutral", confidence: 0.78 };
}

function sourceLabel(source: ReviewListItem["source"]): string {
  if (source === "facebook") return "Facebook";
  if (source === "yelp") return "Yelp";
  return "Google Business Profile";
}

function compactDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fullDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STAR_BAR_COLORS: Record<number, string> = {
  5: "#137752",
  4: "#FDB022",
  3: "#F79009",
  2: "#EF4444",
  1: "#B42318",
};

function StarSummary({
  rating,
  count,
  total,
}: {
  rating: number;
  count: number;
  total: number;
}) {
  const barColor = STAR_BAR_COLORS[rating] ?? "#FDB022";
  return (
    <RepMetricCard
      label={`${rating} Star`}
      value={formatNumber(count)}
      hint={`${pct(count, total)}% of reviews`}
    >
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct(count, total)}%`, backgroundColor: barColor }}
        />
      </div>
    </RepMetricCard>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-6 py-12 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#137752]" />
      <p className="mt-3 text-sm font-semibold text-[#101828]">
        No reviews match these filters
      </p>
      <p className="mt-1 text-sm text-[#667085]">
        Clear search or widen the filters to see more reviews.
      </p>
    </div>
  );
}

function DetailSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className={cn(rep.label, "border-b border-[#F2F4F7] pb-1")}>{heading}</p>
      {children}
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={rep.label}>{label}</p>
      <div className="mt-1 text-sm font-medium text-[#344054]">{children}</div>
    </div>
  );
}

function ReviewDetailPanel({
  review,
  details,
  businessId,
  onUpdated,
}: {
  review: ReviewListItem | null;
  details: ReviewFeedDetails | null;
  businessId: string;
  onUpdated?: (review: ReviewListItem) => void;
}) {
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setWriting(false);
    setStatusMsg(null);
    setActionError(null);
  }, [review?.id]);

  if (!review) {
    return (
      <aside className={cn(rep.card, "flex min-h-[620px] items-center justify-center p-6 text-center")}>
        <div>
          <MessageSquarePlus className="mx-auto h-9 w-9 text-[#98A2B3]" />
          <h2 className="mt-3 text-base font-semibold text-[#101828]">
            Select a review
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Open any review to inspect sentiment, tags, IDs, and response actions.
          </p>
        </div>
      </aside>
    );
  }

  const currentReview = review;
  const sentiment = details?.sentiment ?? sentimentFor(currentReview);
  const reviewId = details?.reviewId ?? currentReview.id;
  const location = details?.location ?? currentReview.businessName;
  const lastEditedAt = details?.lastEditedAt;
  const confidenceDecimal =
    typeof sentiment.confidence === "number" && sentiment.confidence > 1
      ? sentiment.confidence / 100
      : sentiment.confidence;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(reviewId);
      setStatusMsg("Review ID copied");
    } catch {
      setActionError("Could not copy review ID");
    }
  }

  async function generateResponse() {
    setGenerating(true);
    setActionError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/reputation/responses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reviewIds: [currentReview.id] }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        drafts?: Array<{ draftText?: string; reply?: string }>;
        reply?: string;
        error?: string;
      };
      const reply = json.drafts?.[0]?.draftText || json.drafts?.[0]?.reply || json.reply;
      if (!res.ok || !reply) {
        const firstName = currentReview.reviewerName.split(" ")[0] || "there";
        setDraft(
          `Hi ${firstName},\n\nThank you for sharing your feedback. We appreciate you taking the time to review us.\n\nBest regards`
        );
        setWriting(true);
        setStatusMsg("Suggested reply ready (fallback)");
        return;
      }
      setDraft(reply);
      setWriting(true);
      setStatusMsg("Suggested reply ready — copy into Google Business Profile to publish");
    } catch {
      setActionError("Could not generate a reply");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleResolved() {
    setResolving(true);
    setActionError(null);
    try {
      const nextResolved = !currentReview.resolved;
      const res = await fetch(`/api/reviews/${businessId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: currentReview.id, resolved: nextResolved }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      onUpdated?.({
        ...currentReview,
        resolved: nextResolved,
        resolvedAt: nextResolved ? json.review?.resolved_at ?? new Date().toISOString() : null,
      });
      setStatusMsg(nextResolved ? "Marked resolved" : "Reopened");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setResolving(false);
    }
  }

  return (
    <aside className={cn(rep.card, "min-h-[620px] overflow-hidden")}>
      <div className="border-b border-[#E6EAF0] p-5">
        <div className="flex items-start gap-3">
          <SourceIcon source={currentReview.source} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#101828]">
                {currentReview.reviewerName}
              </h2>
              {currentReview.isNew ? <RepBadge tone="green">New</RepBadge> : null}
              {details?.edited ? <RepBadge tone="blue">Edited</RepBadge> : null}
              {currentReview.resolved ? <RepBadge tone="gray">Resolved</RepBadge> : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StarRating rating={currentReview.rating} />
              <span className="text-xs text-[#667085]">
                {currentReview.relativeDate ?? compactDate(currentReview.publishedAt ?? currentReview.reviewDate)}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#344054]">
          {currentReview.reviewText?.trim() || "No review text provided."}
        </p>
      </div>

      <div className="space-y-5 overflow-y-auto p-5" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <DetailSection heading="Details">
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Published">
              {fullDate(details?.publishedDateTime ?? currentReview.publishedAt ?? currentReview.reviewDate)}
            </DetailField>
            <DetailField label="Location">{location}</DetailField>
            <DetailField label="Source">{sourceLabel(currentReview.source)}</DetailField>
            <DetailField label="Last Edited">
              {lastEditedAt ? fullDate(lastEditedAt) : "No edits"}
            </DetailField>
          </div>
          <DetailField label="Review ID">
            <div className="flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs text-[#475467]">{reviewId}</code>
              <button
                type="button"
                onClick={() => void copyId()}
                className="text-[#98A2B3] hover:text-[#475467]"
                aria-label="Copy review ID"
              >
                <Clipboard className="h-4 w-4" />
              </button>
            </div>
          </DetailField>
        </DetailSection>

        <DetailSection heading="Sentiment & Themes">
          <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[#101828]">
                  {sentiment.label}
                </p>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Confidence: {confidenceDecimal.toFixed(2)}
                </p>
              </div>
              <RepBadge
                tone={
                  sentiment.label === "Positive"
                    ? "green"
                    : sentiment.label === "Negative"
                      ? "red"
                      : "gray"
                }
              >
                {sentiment.label}
              </RepBadge>
            </div>
          </div>
          <div>
            <p className={rep.label}>Themes</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(currentReview.tags.length ? currentReview.tags : ["Customer experience"]).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#E6EAF0] bg-white px-2.5 py-1 text-xs font-medium text-[#475467]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </DetailSection>

        <DetailSection heading="Response">
          {currentReview.ownerResponseText ? (
            <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] p-4">
              <p className={cn(rep.label, "text-[#027A48]")}>Owner Response</p>
              <p className="mt-2 text-sm leading-6 text-[#344054]">
                {currentReview.ownerResponseText}
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-[#FEF3F2] px-3 py-2 text-sm font-medium text-[#B42318]">
              No response yet
            </p>
          )}
          {writing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-[#E6EAF0] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#137752]"
              />
              <button
                type="button"
                className={cn(rep.btnSecondary, "w-full justify-center")}
                onClick={() => {
                  void navigator.clipboard.writeText(draft);
                  setStatusMsg("Reply copied");
                }}
              >
                Copy reply
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={generating}
            onClick={() => void generateResponse()}
            className={cn(rep.btnPrimary, "w-full justify-center")}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Response
          </button>
          <button
            type="button"
            onClick={() => {
              setWriting(true);
              if (!draft) {
                const firstName = currentReview.reviewerName.split(" ")[0] || "there";
                setDraft(`Hi ${firstName},\n\n`);
              }
            }}
            className={cn(rep.btnSecondary, "w-full justify-center")}
          >
            <PencilLine className="h-4 w-4" />
            Write Your Own
          </button>
        </DetailSection>

        <DetailSection heading="More Actions">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={resolving}
              onClick={() => void toggleResolved()}
              className={cn(rep.btnSecondary, "justify-center")}
            >
              {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {currentReview.resolved ? "Reopen Review" : "Mark as Resolved"}
            </button>
          </div>
        </DetailSection>

        {statusMsg ? <p className="text-xs font-medium text-[#027A48]">{statusMsg}</p> : null}
        {actionError ? <p className="text-xs font-medium text-[#B42318]">{actionError}</p> : null}
      </div>
    </aside>
  );
}

function ResponseStatus({ replied }: { replied: boolean }) {
  if (replied) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#667085]">
        <Check className="h-3.5 w-3.5" />
        Responded
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs font-semibold text-[#B42318]">
      No response
    </span>
  );
}

function ReviewCard({
  review,
  selected,
  details,
  onSelect,
}: {
  review: ReviewListItem;
  selected: boolean;
  details: ReviewFeedDetails | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-[#F2F4F7] bg-white p-4 text-left transition hover:bg-[#F9FAFB]",
        selected && "border-l-4 border-l-[#137752] bg-[#ECFDF3] hover:bg-[#ECFDF3]"
      )}
    >
      <div className="flex items-start gap-3">
        <SourceIcon source={review.source} />
        <div className="min-w-0 flex-1">
          {/* Top row: name / stars / time / badges / response status far right */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <ReviewerAvatar name={review.reviewerName} size="sm" />
              <p className="font-semibold text-[#101828]">{review.reviewerName}</p>
              <StarRating rating={review.rating} />
              <span className="text-xs text-[#667085]">
                {review.relativeDate ?? compactDate(review.publishedAt ?? review.reviewDate)}
              </span>
              {review.isNew ? <RepBadge tone="green">New</RepBadge> : null}
              {details?.edited ? <RepBadge tone="blue">Edited</RepBadge> : null}
            </div>
            <ResponseStatus replied={review.replied} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#344054]">
            {review.reviewText?.trim() || "No review text provided."}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(review.tags.length ? review.tags : ["Customer experience"]).slice(0, 4).map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  tag === "Positive" || tag === "Professionalism"
                    ? "bg-[#ECFDF3] text-[#027A48]"
                    : "bg-[#F2F4F7] text-[#475467]"
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ReviewsDashboard({
  businessId,
  initialData,
  forcePreview = false,
}: {
  businessId: string;
  initialData?: ReviewFeedDashboardData;
  forcePreview?: boolean;
}) {
  const searchParams = useSearchParams();
  const initialResponse =
    searchParams.get("tab") === "unanswered" || searchParams.get("response") === "no-response"
      ? "no-response"
      : "all";
  const [data, setData] = useState<ReviewFeedDashboardData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData && !forcePreview);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [response, setResponse] = useState<ResponseFilter>(initialResponse);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("tab") === "unanswered" || searchParams.get("response") === "no-response") {
      setResponse("no-response");
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    if (forcePreview) {
      setData(initialData ?? reviewFeedPreviewData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load reviews");
      const next = json as ReviewFeedDashboardData;
      setData(next);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [businessId, forcePreview, initialData]);

  useEffect(() => {
    queueMicrotask(() => {
      if (forcePreview) {
        setData(initialData ?? reviewFeedPreviewData);
        setLoading(false);
        return;
      }
      if (initialData) {
        setData(initialData);
        setLoading(false);
        return;
      }
      void load();
    });
  }, [forcePreview, initialData, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const owned = data.yourReviews.length ? data.yourReviews : data.stream.filter((row) => row.isTarget);
    return owned.length ? owned : data.stream;
  }, [data]);

  // Sort by date descending (Newest First)
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTime = new Date(a.publishedAt ?? a.reviewDate ?? "").getTime();
        const bTime = new Date(b.publishedAt ?? b.reviewDate ?? "").getTime();
        return bTime - aTime;
      }),
    [rows]
  );

  const detailMap = data?.feedDetails ?? {};

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((row) => {
      if (source !== "all" && row.source !== source) return false;
      if (rating !== "all" && Math.round(row.rating ?? 0) !== Number(rating)) return false;
      const label = sentimentFor(row).label.toLowerCase();
      if (sentiment !== "all" && label !== sentiment) return false;
      if (response === "responded" && !row.replied) return false;
      if (response === "no-response" && row.replied) return false;
      if (q) {
        const hay = `${row.reviewerName} ${row.reviewText ?? ""} ${row.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rating, response, sorted, search, sentiment, source]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!filtered.length) {
        setSelectedId(null);
        return;
      }
      setSelectedId((current) => (current && filtered.some((row) => row.id === current) ? current : filtered[0]!.id));
    });
  }, [filtered]);

  const selected = filtered.find((row) => row.id === selectedId) ?? null;
  const selectedDetails = selected ? detailMap[selected.id] ?? null : null;

  const totalReviews = data?.feedSummary?.totalReviews ?? data?.kpis.totalReviews ?? rows.length;
  const newReviews = data?.feedSummary?.newReviews ?? data?.kpis.newReviews90d ?? rows.filter((row) => row.isNew).length;
  const starCounts = data?.feedSummary?.starCounts ?? {
    5: rows.filter((row) => Math.round(row.rating ?? 0) === 5).length,
    4: rows.filter((row) => Math.round(row.rating ?? 0) === 4).length,
    3: rows.filter((row) => Math.round(row.rating ?? 0) === 3).length,
    2: rows.filter((row) => Math.round(row.rating ?? 0) === 2).length,
    1: rows.filter((row) => Math.round(row.rating ?? 0) === 1).length,
  };
  const responded = data?.feedSummary?.withResponse ?? rows.filter((row) => row.replied).length;
  const noResponse = data?.feedSummary?.noResponse ?? Math.max(0, totalReviews - responded);

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#137752]" />
      </div>
    );
  }

  if (!forcePreview && error) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="Couldn’t load live reviews"
        description={`${error}. Refresh reputation data to import your latest Google reviews and try again.`}
      />
    );
  }

  if (!data) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="No live review feed yet"
        description="Refresh reputation data to import your Google reviews into the new feed."
      />
    );
  }

  if (!forcePreview && (!data.hasData || rows.length === 0)) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="No reviews found yet"
        description="Refresh reputation data to pull in live Google Business Profile reviews before using the feed."
      />
    );
  }

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Review Feed"
        subtitle="Monitor, respond to, and manage your Google Business Profile reviews."
        dateRangeLabel="Last 90 days"
        showExport={false}
        showFilters={false}
        actions={
          <Link href={`/businesses/${businessId}/reputation/settings`} className={rep.btnSecondary}>
            <Settings2 className="h-4 w-4" />
            Feed Settings
          </Link>
        }
      />

      {error ? (
        <div className="rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-3.5 py-2.5 text-sm text-[#93370D]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <RepMetricCard
          label="All Reviews"
          value={formatNumber(totalReviews)}
          trend={`+${newReviews} new`}
          hint="this period"
          trendPositive
        />
        {[5, 4, 3, 2, 1].map((star) => (
          <StarSummary
            key={star}
            rating={star}
            count={starCounts[star as keyof typeof starCounts] ?? 0}
            total={totalReviews}
          />
        ))}
        <RepMetricCard
          label="With Response"
          value={formatNumber(responded)}
          hint={`${pct(responded, totalReviews)}% response rate`}
        />
        <RepMetricCard
          label="No Response"
          value={formatNumber(noResponse)}
          hint={`${pct(noResponse, totalReviews)}% need attention`}
          valueClassName={noResponse > 0 ? "text-[#B54708]" : undefined}
        />
      </div>

      <div className={cn(rep.card, "p-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <RepSearch
            value={search}
            onChange={setSearch}
            placeholder="Search reviews..."
            className="min-w-[240px]"
          />
          <select value={source} onChange={(e) => setSource(e.target.value as SourceFilter)} className={rep.select}>
            <option value="all">All Sources</option>
            <option value="google">Google</option>
          </select>
          <select value={rating} onChange={(e) => setRating(e.target.value as RatingFilter)} className={rep.select}>
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value as SentimentFilter)}
            className={rep.select}
          >
            <option value="all">All Sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          <select
            value={response}
            onChange={(e) => setResponse(e.target.value as ResponseFilter)}
            className={rep.select}
          >
            <option value="all">All Response Status</option>
            <option value="responded">Responded</option>
            <option value="no-response">No Response</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className={cn(rep.card, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-[#E6EAF0] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[#101828]">Newest First</h2>
              <p className="text-xs text-[#667085]">
                Showing {filtered.length} of {sorted.length} loaded reviews
                {response === "no-response" ? " · unanswered only" : ""}
              </p>
            </div>
          </div>
          <div className="max-h-[760px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState />
              </div>
            ) : (
              filtered.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  details={detailMap[review.id] ?? null}
                  selected={review.id === selectedId}
                  onSelect={() => setSelectedId(review.id)}
                />
              ))
            )}
          </div>
        </section>

        <ReviewDetailPanel
          review={selected}
          details={selectedDetails}
          businessId={businessId}
          onUpdated={(next) => {
            setData((current) => {
              if (!current) return current;
              const patch = (list: ReviewListItem[]) =>
                list.map((row) => (row.id === next.id ? { ...row, ...next } : row));
              return {
                ...current,
                stream: patch(current.stream),
                yourReviews: patch(current.yourReviews),
                unanswered: patch(current.unanswered ?? []),
              };
            });
          }}
        />
      </div>

      <p className="text-xs text-[#98A2B3]">
        Review data sourced from Google Business Profile. Export and response automation are wired to the production review workflow.
      </p>
    </div>
  );
}
