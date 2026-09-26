"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Page, PageHeader, Stat } from "@/newui-transplant/components/app/kit";
import { CallsBrowser } from "@/newui-transplant/components/voice/calls-browser";
import { mapVoiceCallApiRowToNewUi, type VoiceCallApiRow } from "@/lib/newui-transplant/adapters/voice-calls";
import {
  buildVoiceCallsSearchParams,
  filterCallsClientSide,
  type VoiceCallsFetchParams,
} from "@/lib/newui-transplant/voice-calls-query";
import type { CallOutcome, VoiceCall } from "@/newui-transplant/lib/view-models";

type Analytics = {
  answered: number;
  leads: number;
  appointments: number;
  talkTimeSeconds: number;
};

function fmtTalkTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DEFAULT_PARAMS: VoiceCallsFetchParams = {
  dateRange: "7d",
  filter: "all",
  q: "",
  attentionOnly: false,
};

export function NewUiVoiceCallsPage() {
  const [params, setParams] = useState<VoiceCallsFetchParams>(DEFAULT_PARAMS);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [metrics, setMetrics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const search = buildVoiceCallsSearchParams({ ...params, limit: 200 });
      const res = await fetch(`/api/voice/calls?${search}`);
      const j = await res.json();
      const rows = (j.data || []) as VoiceCallApiRow[];
      const mapped = rows.map(mapVoiceCallApiRowToNewUi);
      setCalls(filterCallsClientSide(mapped, params.filter, params.attentionOnly));
      setMetrics(j.analytics || null);
    } catch {
      setCalls([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  const wiring = useMemo(
    () => ({
      period: params.dateRange,
      onPeriodChange: (period: string) =>
        setParams((p) => ({
          ...p,
          dateRange: period === "today" || period === "30d" ? period : "7d",
        })),
      filter: params.filter,
      onFilterChange: (filter: CallOutcome | "all") => setParams((p) => ({ ...p, filter })),
      query: params.q,
      onQueryChange: (q: string) => setParams((p) => ({ ...p, q })),
      mode: params.attentionOnly ? "attention" as const : "all" as const,
      onModeChange: (mode: "all" | "attention") =>
        setParams((p) => ({ ...p, attentionOnly: mode === "attention" })),
      loading,
    }),
    [params, loading],
  );

  const m = metrics ?? { answered: 0, leads: 0, appointments: 0, talkTimeSeconds: 0 };

  return (
    <Page>
      <PageHeader title="Calls" description="Track and manage calls handled by the AI receptionist." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Answered" value={loading ? "…" : String(m.answered)} />
        <Stat label="Leads" value={loading ? "…" : String(m.leads)} />
        <Stat label="Appointments" value={loading ? "…" : String(m.appointments)} />
        <Stat label="Talk time" value={loading ? "…" : fmtTalkTime(m.talkTimeSeconds)} />
      </div>
      {loading && !calls.length ? (
        <p className="text-sm text-muted-foreground">Loading calls…</p>
      ) : (
        <CallsBrowser calls={calls} wiring={wiring} />
      )}
    </Page>
  );
}
