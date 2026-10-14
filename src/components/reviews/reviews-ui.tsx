"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/overview/overview-charts";
import { PageHeader, Panel, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { OPUS_CARD, OPUS_SEARCH_INPUT } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusLineTabs } from "@/newui-transplant/components/app/segmented-nav";
import { Button, buttonVariants } from "@/newui-transplant/components/ui/button";
import { repBtnPrimary, repBtnSecondary } from "@/components/reputation/rep-ui";
import { cn } from "@/lib/utils";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";

export const REVIEWS_TABS = [
  { id: "your-reviews", label: "Your Reviews", icon: Star },
  { id: "competitor-reviews", label: "Competitor Reviews", icon: null },
  { id: "sentiment", label: "Themes & Mentions", icon: null },
  { id: "unanswered", label: "Unanswered", icon: null },
] as const;

export type ReviewsTabId = (typeof REVIEWS_TABS)[number]["id"];

export function RvCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(OPUS_CARD, "bg-card p-4", className)}>{children}</div>;
}

export function RvSectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function kpiDeltaSub(
  value: number | null,
  suffix: string,
  invert = false
): { sub?: string; trendPositive?: boolean } {
  if (value == null || value === 0) {
    const trimmed = suffix.trim();
    return trimmed ? { sub: trimmed } : {};
  }
  const positive = invert ? value < 0 : value > 0;
  return {
    sub: `${positive ? "↑" : "↓"} ${Math.abs(value)}${suffix}`,
    trendPositive: positive,
  };
}

export function DeltaText({
  value,
  suffix = " vs prior 90 days",
  invert = false,
}: {
  value: number | null;
  suffix?: string;
  invert?: boolean;
}) {
  if (value == null || value === 0) {
    return <span className="text-xs text-zinc-500">{suffix.trim() || "—"}</span>;
  }
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={cn("text-xs font-medium", positive ? "text-primary" : "text-red-600")}>
      {positive ? "↑" : "↓"} {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "md" }) {
  const stars = rating ?? 0;
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(cls, i < Math.round(stars) ? "fill-primary text-primary" : "text-zinc-200")} />
      ))}
    </span>
  );
}

export function ReviewStatusBadge({ replied, variant = "default" }: { replied: boolean; variant?: "default" | "pill" }) {
  if (replied) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          variant === "pill"
            ? "rounded-md bg-[#FEF3C7] px-2.5 py-0.5 font-semibold text-[#92400E]"
            : "text-primary"
        )}
      >
        {variant !== "pill" ? <CheckCircle2 className="h-3 w-3" /> : null}
        Replied
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-amber-700",
        variant === "pill" && "rounded-full bg-amber-50 px-2.5 py-0.5"
      )}
    >
      <Clock className="h-3 w-3" />
      {variant === "pill" ? "Unreplied" : "Unanswered"}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: ReviewListItem["urgency"] }) {
  if (!urgency) return null;
  const styles = {
    urgent: "bg-red-50 text-red-700 ring-1 ring-red-100",
    high: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
    medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    low: "bg-zinc-100 text-zinc-600",
  };
  const labels = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[urgency])}>
      {labels[urgency]}
    </span>
  );
}

export function SourceIcon({ source }: { source: ReviewListItem["source"] }) {
  if (source === "facebook") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">f</span>;
  }
  if (source === "yelp") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">★</span>;
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600 ring-1 ring-zinc-200">G</span>;
}

export function ReviewerAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const cls = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs";
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600", cls)}>
      {initials}
    </span>
  );
}

export function TagPills({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map((tag) => (
        <span key={tag} className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
          {tag}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">+{tags.length - 2}</span>
      )}
    </div>
  );
}

export function BusinessCell({ row }: { row: ReviewListItem }) {
  return (
    <div className="flex items-center gap-2">
      {row.isTarget ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-3.5 w-3.5 text-primary" />
        </span>
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100">
          <Building2 className="h-3.5 w-3.5 text-zinc-500" />
        </span>
      )}
      <span className="font-medium text-zinc-900">{row.isTarget ? "You" : row.businessName}</span>
    </div>
  );
}

export function ReviewsHeader({
  businessId,
  loading,
  onRefresh,
  onRunMomentum,
  title = "Reviews",
  subtitle = "Monitor and manage your business's reputation and your competitors across major platforms.",
}: {
  businessId: string;
  loading?: boolean;
  onRefresh: () => void;
  onRunMomentum?: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#475467] hover:bg-muted disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
        <Link
          href={`/businesses/${businessId}/review-requests`}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#475467] hover:bg-muted"
        >
          <Mail className="h-3.5 w-3.5" />
          Request Review
        </Link>
        <Link
          href={`/businesses/${businessId}/review-requests`}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Send Review Link
        </Link>
        <button
          type="button"
          onClick={onRunMomentum}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Analyze
        </button>
      </div>
    </div>
  );
}

export function ReviewsKpiRow({
  kpis,
  variant = "default",
  negativePct,
}: {
  kpis: ReviewsPageData["kpis"];
  variant?: "default" | "unanswered";
  negativePct?: number;
}) {
  const cardClass =
    "rounded-xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

  if (variant === "unanswered") {
    const cards = [
      {
        label: "Unanswered reviews last 30d",
        value: String(kpis.unanswered90d ?? 0),
        sub: `${kpis.newReviews90dDelta ?? 0} vs prev 30 days`,
      },
      {
        label: "Avg. rating last 30d",
        value: kpis.avgRating != null ? kpis.avgRating.toFixed(1) : "—",
        sub: "N/A",
      },
      {
        label: "Response rate",
        value: `${kpis.responseRate}%`,
        sub: `${kpis.responseRateDelta ?? 0}% vs prev 30 days`,
      },
      {
        label: "Total reviews last 30d",
        value: String(kpis.newReviews90d),
        sub: `${kpis.totalReviews} total`,
      },
    ];
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={cardClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-1.5 text-[26px] font-bold leading-none text-foreground">{c.value}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Average Rating",
      value: `${kpis.avgRating?.toFixed(1) ?? "—"} ★`,
      sub:
        kpis.avgRatingDelta != null && kpis.avgRatingDelta !== 0
          ? `${kpis.avgRatingDelta > 0 ? "up" : "down"} from prior period`
          : "vs last 30 days",
    },
    {
      label: "Total Reviews",
      value: kpis.totalReviews >= 1000 ? `${(kpis.totalReviews / 1000).toFixed(1)} K` : String(kpis.totalReviews),
      sub: "All time",
    },
    {
      label: "New Reviews",
      value: String(kpis.newReviews90d),
      sub: "vs last 30 days",
    },
    {
      label: "Reviews to reply",
      value: String(kpis.unanswered90d ?? 0),
      sub: "vs last 30 days",
    },
    {
      label: "Negative",
      value: `${Math.round(negativePct ?? 0)}%`,
      sub: "vs last 30 days",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className={cardClass}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className="mt-1.5 text-[26px] font-bold leading-none tracking-tight text-foreground">{c.value}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function ReviewsTabs({
  active,
  onChange,
}: {
  active: ReviewsTabId;
  onChange: (tab: ReviewsTabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {REVIEWS_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-[#344054]"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
            value === opt.id ? "bg-primary text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SuggestedActionsSidebar({
  suggestions,
  businessId,
  onTabChange,
}: {
  suggestions: ReviewsPageData["suggestions"];
  businessId: string;
  onTabChange?: (tab: ReviewsTabId) => void;
}) {
  const icons: Record<string, LucideIcon> = {
    reply: MessageSquare,
    request: Mail,
    competitor: TrendingUp,
    sentiment: Sparkles,
  };

  return (
    <RvCard>
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h3 className={"text-sm font-semibold"}>Suggested Actions</h3>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => {
          const Icon = icons[s.type] ?? MessageSquare;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.type === "reply") onTabChange?.("unanswered");
                else if (s.type === "request") window.location.href = `/businesses/${businessId}/review-requests`;
                else if (s.type === "sentiment") onTabChange?.("sentiment");
                else if (s.type === "competitor") onTabChange?.("competitor-reviews");
              }}
              className="flex w-full items-start gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 text-left transition-colors hover:border-emerald-200 hover:bg-primary/10/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-primary shadow-sm ring-1 ring-zinc-100">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-zinc-900">{s.title}</p>
                <p className={`mt-0.5 line-clamp-2 ${"text-xs text-muted-foreground"}`}>{s.description}</p>
              </div>
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onTabChange?.("unanswered")}
        className={cn("mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline")}
      >
        View unanswered reviews →
      </button>
    </RvCard>
  );
}

export function SuggestedReplyTasksSidebar({
  data,
  businessId,
  onTabChange,
}: {
  data: ReviewsPageData;
  businessId: string;
  onTabChange?: (tab: ReviewsTabId) => void;
}) {
  const themes = data.sentiment.yours.themes.slice(0, 3);
  return (
    <RvCard>
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h3 className={"text-sm font-semibold"}>Suggested Reply Tasks</h3>
      </div>
      <div className="space-y-2.5 text-[13px]">
        {data.unanswered.length > 0 && (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5">
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <p className="font-medium text-zinc-900">{data.unanswered.length} reviews need a response</p>
                <button
                  type="button"
                  onClick={() => onTabChange?.("unanswered")}
                  className="mt-0.5 text-[11px] font-medium text-primary"
                >
                  View unanswered →
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5">
          <div className="flex items-start gap-2">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <div>
              <p className="font-medium text-zinc-900">Maintain Momentum</p>
              <p className={`mt-0.5 ${"text-xs text-muted-foreground"}`}>
                {data.kpis.avgRatingDelta != null && data.kpis.avgRatingDelta > 0
                  ? `Your rating improved ${data.kpis.avgRatingDelta} stars this period.`
                  : "Keep replying quickly to protect your rating."}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5">
          <div className="flex items-start gap-2">
            <ThumbsUp className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <div>
              <p className="font-medium text-zinc-900">Top Positive Themes</p>
              <ul className={`mt-1.5 space-y-0.5 ${"text-xs text-muted-foreground"}`}>
                {themes.map((t) => (
                  <li key={t.themeId} className="capitalize">
                    {t.label} ({t.reviewCount})
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onTabChange?.("sentiment")}
                className="mt-1.5 text-[11px] font-medium text-primary"
              >
                View sentiment →
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-primary/10/40 p-2.5">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 text-primary" />
            <p className={"text-xs text-muted-foreground"}>
              Your {data.kpis.responseRate}% response rate is above the local industry average.
            </p>
          </div>
        </div>
        <Link
          href={`/businesses/${businessId}/review-requests`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary"
        >
          Send review requests →
        </Link>
      </div>
    </RvCard>
  );
}

export function ReviewsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  if (total === 0) return null;

  const pages: number[] = [];
  const maxButtons = 5;
  let from = Math.max(1, page - 2);
  const to = Math.min(totalPages, from + maxButtons - 1);
  from = Math.max(1, to - maxButtons + 1);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
      <span className={"text-xs text-muted-foreground"}>
        Showing {start}–{end} of {total} review{total === 1 ? "" : "s"}
        {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
      </span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            Previous
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-xs font-medium",
                p === page ? "bg-primary text-white" : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ReviewsTable({
  rows,
  mode = "default",
  textDisplay = "preview",
  onViewReview,
}: {
  rows: ReviewListItem[];
  mode?: "default" | "stream" | "urgency";
  textDisplay?: "preview" | "full";
  onViewReview?: (review: ReviewListItem) => void;
}) {
  const showBusiness = mode === "stream";
  const showUrgency = mode === "urgency";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-zinc-100">
            {showBusiness ? <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2 font-semibold")}>Business</th> : <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Reviewer</th>}
            <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Rating</th>
            {!showUrgency && <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Date</th>}
            <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>{showUrgency ? "Review (excerpt)" : "Review Text"}</th>
            {!showBusiness && !showUrgency && <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Source</th>}
            <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Keywords</th>
            {showUrgency && (
              <>
                <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Days Waiting</th>
                <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>SLA / Urgency</th>
              </>
            )}
            <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Status</th>
            <th className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", "px-3.5 py-2")}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn("border-b border-zinc-50 hover:bg-zinc-50/60", onViewReview && "cursor-pointer")}
              onClick={() => onViewReview?.(row)}
            >
              <td className="px-3.5 py-2">
                {showBusiness ? (
                  <BusinessCell row={row} />
                ) : (
                  <div className="flex items-center gap-2">
                    <ReviewerAvatar name={row.reviewerName} size="sm" />
                    <div>
                      <p className="font-medium text-zinc-900">{row.reviewerName}</p>
                      <p className="text-[11px] text-zinc-500">Reviewer</p>
                    </div>
                  </div>
                )}
              </td>
              <td className="px-3.5 py-2">
                <StarRating rating={row.rating} />
              </td>
              {!showUrgency && (
                <td className="whitespace-nowrap px-3.5 py-2">
                  <p className="text-zinc-900">
                    {row.reviewDate
                      ? new Date(row.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                  {row.relativeDate && <p className="text-[11px] text-zinc-500">{row.relativeDate}</p>}
                </td>
              )}
              <td className="min-w-[200px] max-w-md px-3.5 py-2">
                {textDisplay === "full" ? (
                  <p className="whitespace-pre-wrap text-zinc-700">{row.reviewText?.trim() || "—"}</p>
                ) : (
                  <div>
                    <p className="line-clamp-3 text-zinc-600">{row.reviewText ?? "—"}</p>
                    {onViewReview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewReview(row);
                        }}
                        className="mt-1 text-xs font-medium text-primary hover:text-primary"
                      >
                        Read full review →
                      </button>
                    )}
                  </div>
                )}
              </td>
              {!showBusiness && !showUrgency && (
                <td className="px-3.5 py-2">
                  <SourceIcon source={row.source} />
                </td>
              )}
              <td className="px-3.5 py-2">
                <TagPills tags={row.tags} />
              </td>
              {showUrgency && (
                <>
                  <td className="px-3.5 py-2">
                    <span className={cn("text-sm font-medium", (row.daysWaiting ?? 0) >= 7 ? "text-red-600" : "text-amber-600")}>
                      {row.daysWaiting ?? 0} days
                    </span>
                  </td>
                  <td className="px-3.5 py-2">
                    <UrgencyBadge urgency={row.urgency} />
                  </td>
                </>
              )}
              <td className="px-3.5 py-2">
                <ReviewStatusBadge replied={row.replied} variant={mode === "default" ? "pill" : "default"} />
              </td>
              <td className="px-3.5 py-2">
                <div className="flex items-center gap-1">
                  {!row.replied && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReview?.(row);
                      }}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                      title="Reply"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReview?.(row);
                    }}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
                    title="View full review"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeywordList({
  items,
  title,
  linkLabel,
}: {
  items: Array<{ keyword: string; count: number }>;
  title: string;
  linkLabel?: string;
}) {
  return (
    <RvCard>
      <h3 className={"text-sm font-semibold"}>{title}</h3>
      <ul className="mt-2.5 space-y-2">
        {items.length === 0 ? (
          <li className={"text-xs text-muted-foreground"}>No keywords yet.</li>
        ) : (
          items.map((k) => (
            <li key={k.keyword} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="capitalize text-zinc-700">{k.keyword}</span>
              <span className="font-semibold tabular-nums text-zinc-900">{k.count}</span>
            </li>
          ))
        )}
      </ul>
      {linkLabel && items.length > 0 && (
        <button type="button" className={cn("mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline")}>
          {linkLabel} →
        </button>
      )}
    </RvCard>
  );
}

export function KeywordCloud({ items, title, linkLabel }: { items: Array<{ keyword: string; count: number }>; title: string; linkLabel?: string }) {
  return (
    <RvCard>
      <h3 className={"text-sm font-semibold"}>{title}</h3>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <p className={"text-xs text-muted-foreground"}>No keywords yet.</p>
        ) : (
          items.map((k) => (
            <span key={k.keyword} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] text-zinc-700">
              <span className="capitalize">{k.keyword}</span>{" "}
              <span className="text-zinc-400">{k.count}</span>
            </span>
          ))
        )}
      </div>
      {linkLabel && items.length > 0 && (
        <button type="button" className={cn("mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline")}>
          {linkLabel} →
        </button>
      )}
    </RvCard>
  );
}

export function MiniSpark({ data }: { data: number[] }) {
  return <Sparkline data={data.length ? data : [0, 0, 0, 0]} color="#059669" width={72} height={28} />;
}
