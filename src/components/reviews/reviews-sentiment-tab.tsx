"use client";

import { useMemo, useState } from "react";
import { Info, Lightbulb, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReviewsPageData } from "@/lib/reviews/reviews-page-data";

export function ReviewsSentimentTab({ data }: { data: ReviewsPageData }) {
  const themes = data.sentiment.yours.themes.slice(0, 10);
  const sentiment = data.sentiment.yours.sentiment;
  const chartData = useMemo(
    () =>
      themes.map((t) => ({
        name: t.label,
        count: t.reviewCount,
      })),
    [themes]
  );
  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
  const [showAll, setShowAll] = useState(false);
  const topThemes = themes.slice(0, showAll ? themes.length : 3);

  if (!data.hasData && !themes.length) {
    return (
      <div className="rounded-xl border border-[#E6EAF0] bg-white p-8 text-center text-sm text-[#667085] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        Run Review Momentum to sync reviews and detect themes.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">
      <section className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
        <div className="flex items-start gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-[#101828]">
              Themes distribution — Top 10 mentions
              <Info className="h-3.5 w-3.5 text-[#98A2B3]" />
            </h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              A visual summary of top themes mentioned in your reviews.
            </p>
          </div>
        </div>

        <div className="mt-4 h-[360px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2F4F7" />
                <XAxis
                  type="number"
                  domain={[0, Math.ceil(maxCount * 1.15) || 5]}
                  tick={{ fontSize: 11, fill: "#98A2B3" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12, fill: "#344054" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#F9FAFB" }}
                  formatter={(value) => [value ?? 0, "Mentions"]}
                />
                <Bar dataKey="count" name="Mention Frequency" fill="#137752" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-[#667085]">
              Theme mentions will appear as more reviews sync.
            </p>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-[#667085]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#137752]" />
            Mention Frequency
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#137752] shadow-sm">
              <Lightbulb className="h-4 w-4" />
            </span>
            <p className="text-sm text-[#027A48]">
              Advanced Topic & Trend Extraction: See what your customers are really saying about your
              business.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#137752] px-3.5 text-xs font-semibold text-white hover:bg-[#0f6244]"
          >
            See more insights
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h3 className="text-sm font-semibold text-[#101828]">Top Themes For You</h3>
          <ul className="mt-3 space-y-3">
            {topThemes.map((t) => (
              <li key={t.themeId} className="flex items-start gap-2.5">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#101828]">{t.label}</p>
                    <span className="rounded bg-[#ECFDF3] px-1.5 py-0.5 text-[10px] font-semibold text-[#027A48]">
                      Top theme
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {t.reviewCount} review{t.reviewCount === 1 ? "" : "s"} · {t.pct}% of mentions
                  </p>
                </div>
              </li>
            ))}
            {!topThemes.length ? (
              <li className="text-sm text-[#667085]">No themes detected yet.</li>
            ) : null}
          </ul>
          {themes.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-semibold text-[#137752] hover:underline"
            >
              {showAll ? "Show fewer themes →" : "See all themes →"}
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h3 className="text-sm font-semibold text-[#101828]">Sentiment Analysis</h3>
          <p className="mt-0.5 text-xs text-[#667085]">
            A visual summary of how your customers perceive your business.
          </p>
          <div className="mt-4 space-y-3">
            {[
              { label: "Positive", pct: sentiment.positivePct, color: "bg-[#137752]" },
              { label: "Neutral", pct: sentiment.neutralPct, color: "bg-[#98A2B3]" },
              { label: "Negative", pct: sentiment.negativePct, color: "bg-[#D0D5DD]" },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#344054]">{row.label}</span>
                  <span className="tabular-nums text-[#667085]">{row.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F4F7]">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${Math.max(2, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[#137752]">See sentiment analysis →</p>
        </div>
      </aside>
    </div>
  );
}
