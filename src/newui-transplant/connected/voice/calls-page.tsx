"use client";

import { useEffect, useState } from "react";
import { Page, PageHeader, Stat } from "@/newui-transplant/components/app/kit";
import { CallsBrowser } from "@/newui-transplant/components/voice/calls-browser";
import { mapVoiceCallApiRowToNewUi, type VoiceCallApiRow } from "@/lib/newui-transplant/adapters/voice-calls";
import type { VoiceCall } from "@/newui-transplant/lib/view-models";

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

export function NewUiVoiceCallsPage() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [metrics, setMetrics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100", filter: "all", dateRange: "7d" });
    fetch(`/api/voice/calls?${params}`)
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as VoiceCallApiRow[];
        setCalls(rows.map(mapVoiceCallApiRowToNewUi));
        setMetrics(j.analytics || null);
      })
      .catch(() => {
        setCalls([]);
        setMetrics(null);
      })
      .finally(() => setLoading(false));
  }, []);

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
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading calls…</p>
      ) : (
        <CallsBrowser calls={calls} />
      )}
    </Page>
  );
}
