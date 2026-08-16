"use client";

import type { PersonalAnalyticsSummary, PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { PersonalNumberSelector } from "./personal-number-selector";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalStatCard,
  PersonalSection,
  pMuted,
} from "./personal-ui";

export function PersonalAnalyticsClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<PersonalAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const numberId = initialNumberId;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (numberId) params.set("numberId", numberId);
    const res = await fetch(`/api/personal/analytics?${params}`);
    const j = await res.json().catch(() => ({}));
    setData(j.data ?? null);
    setLoading(false);
  }, [days, numberId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Analytics"
        description="Call volume, duration, and per-number breakdown for your Personal account."
      />
      <PersonalNumberSelector numbers={numbers} selectedId={numberId} allowAll />

      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-[13px] ${
              days === d ? "bg-[#6366f1] text-white" : "bg-[#f3f4f6]"
            }`}
          >
            {d} days
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p className={pMuted}>Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PersonalStatCard label="Total calls" value={data.totalCalls} />
            <PersonalStatCard label="Answered" value={data.answered} />
            <PersonalStatCard label="Missed" value={data.missed} />
            <PersonalStatCard label="Voicemails" value={data.voicemails} />
            <PersonalStatCard label="Forwarded minutes" value={data.forwardedMinutes} />
            <PersonalStatCard
              label="Avg duration"
              value={`${data.averageDurationSeconds}s`}
            />
          </div>

          <PersonalSection title="By Transovo number">
            <ul className="space-y-2 text-[13px]">
              {data.byNumber
                .filter((n) => n.calls > 0)
                .sort((a, b) => b.calls - a.calls)
                .map((n) => (
                  <li key={n.numberId} className="flex justify-between">
                    <span>{formatPhone(n.e164)}</span>
                    <span className="font-semibold">{n.calls} calls</span>
                  </li>
                ))}
            </ul>
          </PersonalSection>

          <PersonalSection title="Calls by day">
            {data.byDay.length === 0 ? (
              <p className={pMuted}>No data for this period.</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {data.byDay.slice(-14).map((d) => (
                  <li key={d.date} className="flex justify-between">
                    <span>{d.date}</span>
                    <span>{d.calls}</span>
                  </li>
                ))}
              </ul>
            )}
          </PersonalSection>
        </>
      )}
    </PersonalPageWrap>
  );
}
