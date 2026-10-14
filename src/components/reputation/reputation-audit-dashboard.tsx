"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Play, RefreshCw, ListChecks, Star, Link2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MetricCard } from "@/components/ui/metric-card";
import { momentumBadgeClass } from "@/lib/reviews/metrics";
import type { MarketInsights } from "@/lib/reviews/market-insights";
import {
  MarketActivityBanner,
  RecencyAndStreakPanel,
  ReviewMomentumHero,
  ShareOfReviewsPanel,
  WeeklyPacePanel,
} from "@/components/reviews/review-momentum-insights";
import { ReputationModuleTabs, type ReputationModuleTabId } from "@/components/reputation/reputation-module-tabs";
import { ModulePage, ModuleHeader, btnPrimary, btnSecondary, AlertBanner } from "@/components/ui/design-system";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";

type TabId = Exclude<ReputationModuleTabId, "requests">;

const VALID_TABS: TabId[] = ["overview", "momentum", "reviews", "keywords", "competitors", "responses", "tasks"];

function parseTab(value: string | null): TabId {
  if (value && VALID_TABS.includes(value as TabId)) return value as TabId;
  return "overview";
}

type AuditData = {
  audit: Record<string, unknown> | null;
  targetReviews: Array<Record<string, unknown>>;
  competitors: Array<Record<string, unknown>>;
  keywordGaps: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  drafts: Array<Record<string, unknown>>;
  responseAudit?: Record<string, unknown>;
  targetMetrics?: Record<string, unknown>;
  marketInsights?: MarketInsights;
  hasCompetitors: boolean;
};

function priorityBadge(p: string) {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-surface-subtle text-text-muted",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[p] ?? colors.medium}`}>
      {p}
    </span>
  );
}

export function ReputationAuditDashboard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AuditData | null>(null);
  const [tab, setTab] = useState<TabId>(() => parseTab(searchParams.get("tab")));
  const [loading, setLoading] = useState(true);
  const [generatingResponses, setGeneratingResponses] = useState(false);
  const tabPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const handleTabChange = useCallback(
    (next: TabId) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/businesses/${businessId}/reputation?${params.toString()}`, { scroll: false });
    },
    [businessId, router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reputation/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
    start: startJob,
    running,
    error,
    setError,
  } = useModuleJobRunner({
    onSettled: () => load(),
  });

  async function runAudit() {
    try {
      await startJob(
        "/api/reputation/run",
        { businessId, competitorLimit: 5, lookbackDays: 90 },
        "Audit failed"
      );
    } catch {
      /* error already set by runner */
    }
  }

  async function createTasks() {
    await fetch("/api/reputation/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    await load();
  }

  async function generateResponses() {
    const unanswered = (data?.targetReviews ?? []).filter((r) => !r.owner_response_present).slice(0, 5);
    if (!unanswered.length) return;
    setGeneratingResponses(true);
    try {
      await fetch("/api/reputation/responses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reviewIds: unanswered.map((r) => r.id),
        }),
      });
      await load();
      handleTabChange("responses");
    } finally {
      setGeneratingResponses(false);
    }
  }

  const audit = data?.audit;
  const metrics = data?.targetMetrics as Record<string, unknown> | undefined;
  const market = data?.marketInsights as MarketInsights | undefined;

  const recencyEntities = [
    {
      name: "You",
      entity_type: "target",
      days_since_last_review:
        metrics?.daysSinceLastReview != null ? Number(metrics.daysSinceLastReview) : null,
    },
    ...(data?.competitors ?? []).map((c) => ({
      name: String(c.competitor_name),
      entity_type: "competitor",
      days_since_last_review:
        c.days_since_last_review != null ? Number(c.days_since_last_review) : null,
    })),
  ];
  const isRunning = running || audit?.status === "running";

  const velocityChart = [
    { name: "You", reviews: Number(audit?.reviews_30d ?? 0) },
    ...(data?.competitors ?? []).slice(0, 5).map((c) => ({
      name: String(c.competitor_name).slice(0, 16),
      reviews: Number(c.reviews_30d ?? 0),
    })),
  ];

  const dailyExact7 = (metrics?.dailyExact7d as Array<{ date: string; count: number }>) ?? [];
  const weeklyBuckets = (metrics?.weeklyBuckets8to30 as Array<{ label: string; count: number }>) ?? [];
  const trend90 = (metrics?.trendBuckets90d as Array<{ label: string; count: number }>) ?? [];

  if (loading && !audit) {
    return (
      <div className="flex items-center gap-2 py-20 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading reputation data…
      </div>
    );
  }

  return (
    <ModulePage>
      <ModuleHeader
        title="Reputation & Reviews"
        subtitle="Track reviews, velocity, keywords, responses, and competitor gaps."
        actions={
          <>
            <button type="button" onClick={() => void runAudit()} disabled={isRunning} className={btnPrimary}>
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Reputation Audit
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={btnSecondary}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            {audit && (
              <button type="button" onClick={() => void createTasks()} className={btnSecondary}>
                <ListChecks className="h-4 w-4" />
                Create Tasks
              </button>
            )}
          </>
        }
      />

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {Boolean(audit?.progress_stage) && isRunning && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {String(audit?.progress_stage ?? "")}…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Rating"
          value={audit?.rating != null ? `${Number(audit.rating).toFixed(1)}★` : "—"}
        />
        <MetricCard label="Total Reviews" value={Number(audit?.total_reviews ?? 0)} />
        <MetricCard label="30-Day Reviews" value={Number(audit?.reviews_30d ?? 0)} />
        <MetricCard label="Review Momentum" value={String(audit?.momentum_label ?? "—")} />
        <MetricCard
          label="Response Rate"
          value={audit?.response_rate != null ? `${audit.response_rate}%` : "—"}
        />
        <MetricCard
          label="Review Gap"
          value={audit?.review_gap != null ? `+${audit.review_gap} to match top 3` : "—"}
        />
      </div>

      <ReputationModuleTabs businessId={businessId} activeTab={tab} />

      <div ref={tabPanelRef} className="scroll-mt-6">
      {!audit ? (
        <div className="space-y-4 rounded-xl border border-dashed border-border p-12 text-center dark:border-zinc-700">
          <p className="text-text-muted">No reputation audit yet. Run your first audit to track reviews and gaps.</p>
          <Link
            href={`/businesses/${businessId}/review-requests`}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <Link2 className="h-4 w-4" />
            Get Review Link
          </Link>
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-3">
                  <Star className="h-6 w-6 text-amber-500" />
                  <div>
                    <p className="text-xs uppercase text-text-muted">Reputation Health</p>
                    <p className="text-3xl font-bold">{audit.score != null ? `${audit.score}/100` : "—"}</p>
                  </div>
                  {Boolean(audit.momentum_label) && (
                    <span className={`ml-auto rounded-full px-3 py-1 text-sm font-medium ${momentumBadgeClass(audit.momentum_label as never)}`}>
                      {String(audit.momentum_label)}
                    </span>
                  )}
                </div>
              </div>
              {Boolean(audit.ai_summary) && (
                <div className="rounded-xl border border-border p-6 dark:border-zinc-800">
                  <h3 className="font-semibold">Summary</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{String(audit.ai_summary)}</p>
                </div>
              )}
              {audit.recommended_weekly_target != null && (
                <p className="text-sm text-text-muted">
                  Current review target: <strong>{String(audit.recommended_weekly_target)} reviews per week</strong>
                </p>
              )}
              <Link
                href={`/businesses/${businessId}/review-requests`}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Link2 className="h-4 w-4" />
                Get Review Link
              </Link>
            </div>
          )}

          {tab === "momentum" && metrics && (
            <div className="space-y-5">
              {market && (
                <>
                  <MarketActivityBanner market={market} />
                  <ReviewMomentumHero
                    momentumScore={Number(metrics.momentumScore ?? audit.momentum_score ?? 0)}
                    momentumLabel={(metrics.momentumLabel ?? audit.momentum_label ?? "Stable") as import("@/lib/reviews/metrics").MomentumLabel}
                    velocityTrend={market.velocityTrend}
                    velocityTrendLabel={market.velocityTrendLabel}
                    targetSharePct={market.targetSharePct30d}
                  />
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    <WeeklyPacePanel market={market} />
                    <ShareOfReviewsPanel market={market} />
                  </div>
                  <RecencyAndStreakPanel market={market} entities={recencyEntities} />
                </>
              )}
              <div className="grid gap-2.5 lg:grid-cols-2">
                {dailyExact7.length > 0 && (
                  <div className="rounded-xl border border-zinc-200/70 bg-white p-3.5 shadow-sm">
                    <h3 className="mb-2 text-[13px] font-semibold text-zinc-900">Last 7 days (exact)</h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={dailyExact7}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#059669" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="rounded-xl border border-zinc-200/70 bg-white p-3.5 shadow-sm">
                  <h3 className="mb-2 text-[13px] font-semibold text-zinc-900">30-day velocity vs competitors</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={velocityChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="reviews" fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {weeklyBuckets.length > 0 && (
                <div className="rounded-xl border border-border p-4 dark:border-zinc-800">
                  <h3 className="mb-4 text-sm font-semibold">Weekly buckets (days 8–30)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={weeklyBuckets}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {trend90.length > 0 && (
                <div className="rounded-xl border border-border p-4 dark:border-zinc-800">
                  <h3 className="mb-4 text-sm font-semibold">90-day trend</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={trend90}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Reviewer</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Response</th>
                    <th className="px-4 py-3">Sentiment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(data?.targetReviews ?? []).map((r) => (
                    <tr key={String(r.id)}>
                      <td className="px-4 py-3 whitespace-nowrap">{String(r.relative_date_text ?? "—")}</td>
                      <td className="px-4 py-3">{r.rating != null ? `${r.rating}★` : "—"}</td>
                      <td className="px-4 py-3">{String(r.reviewer_name ?? "—")}</td>
                      <td className="max-w-xs truncate px-4 py-3">{String(r.review_text ?? "—")}</td>
                      <td className="px-4 py-3">{r.owner_response_present ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 capitalize">{String(r.sentiment ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "keywords" && (
            <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Keyword</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Yours</th>
                    <th className="px-4 py-3">Comp avg</th>
                    <th className="px-4 py-3">Gap</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(data?.keywordGaps ?? []).map((g) => (
                    <tr key={String(g.id)}>
                      <td className="px-4 py-3 font-medium">{String(g.keyword)}</td>
                      <td className="px-4 py-3 capitalize">{String(g.keyword_type)}</td>
                      <td className="px-4 py-3">{String(g.target_count)}</td>
                      <td className="px-4 py-3">{String(g.competitor_avg)}</td>
                      <td className="px-4 py-3">{String(g.gap)}</td>
                      <td className="px-4 py-3">{priorityBadge(String(g.priority))}</td>
                      <td className="px-4 py-3 text-text-muted">{String(g.recommendation ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "competitors" && (
            <div>
              {!data?.hasCompetitors ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Run a rank grid first to unlock competitor comparison.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                      <tr>
                        <th className="px-4 py-3">Business</th>
                        <th className="px-4 py-3">Rating</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">7D</th>
                        <th className="px-4 py-3">30D</th>
                        <th className="px-4 py-3">90D</th>
                        <th className="px-4 py-3">Avg/wk</th>
                        <th className="px-4 py-3">Response</th>
                        <th className="px-4 py-3">Momentum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {(data?.competitors ?? []).map((c) => (
                        <tr key={String(c.id)}>
                          <td className="px-4 py-3 font-medium">{String(c.competitor_name)}</td>
                          <td className="px-4 py-3">{c.rating != null ? `${c.rating}★` : "—"}</td>
                          <td className="px-4 py-3">{String(c.total_reviews)}</td>
                          <td className="px-4 py-3">{String(c.reviews_7d)}</td>
                          <td className="px-4 py-3">{String(c.reviews_30d)}</td>
                          <td className="px-4 py-3">{String(c.reviews_90d)}</td>
                          <td className="px-4 py-3">{String(c.avg_reviews_per_week ?? "—")}</td>
                          <td className="px-4 py-3">{c.response_rate != null ? `${c.response_rate}%` : "—"}</td>
                          <td className="px-4 py-3">{String(c.momentum_label ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "responses" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-sm text-text-muted">
                  Response rate: <strong>{String(audit.response_rate ?? 0)}%</strong>
                  {data?.responseAudit && (
                    <>
                      {" "}
                      · Unanswered positive: {String(data.responseAudit.unansweredPositive ?? 0)} · Unanswered
                      negative: {String(data.responseAudit.unansweredNegative ?? 0)}
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void generateResponses()}
                  disabled={generatingResponses}
                  className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {generatingResponses ? "Generating…" : "Generate Responses"}
                </button>
              </div>
              <div className="space-y-4">
                {(data?.targetReviews ?? [])
                  .filter((r) => !r.owner_response_present)
                  .map((r) => {
                    const draft = (data?.drafts ?? []).find((d) => d.review_record_id === r.id);
                    return (
                      <div key={String(r.id)} className="rounded-xl border border-border p-4 dark:border-zinc-800">
                        <p className="text-sm font-medium">
                          {r.rating != null ? `${r.rating}★` : "—"} · {String(r.reviewer_name)} · {String(r.relative_date_text)}
                        </p>
                        <p className="mt-2 text-sm text-text-muted">{String(r.review_text ?? "")}</p>
                        {draft && (
                          <div className="mt-3 rounded-lg bg-surface-subtle p-3 text-sm dark:bg-zinc-900">
                            <p className="text-xs font-medium uppercase text-text-muted">Draft response</p>
                            <p className="mt-1">{String(draft.draft_text)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {tab === "tasks" && (
            <ul className="space-y-3">
              {(data?.tasks ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">No tasks yet. Run an audit or click Create Tasks.</p>
              ) : (
                data?.tasks.map((t) => (
                  <li key={String(t.id)} className="rounded-xl border border-border p-4 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{String(t.title)}</span>
                      {priorityBadge(String(t.priority))}
                      <span className="text-xs text-text-muted">
                        Impact: {String(t.impact)} · Effort: {String(t.effort)}
                      </span>
                    </div>
                    {t.description ? <p className="mt-2 text-sm text-text-muted">{String(t.description)}</p> : null}
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
      </div>
    </ModulePage>
  );
}
