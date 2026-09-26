import { TransovoKpiStrip } from "@/components/transovo/kpi-strip";
import { fmtTalkTime } from "@/lib/voice/calls/display";

export type CallsMetricsData = {
  answered: number;
  leads: number;
  appointments: number;
  talkTimeSeconds: number;
  answeredChangePct: number | null;
  leadsChangePct: number | null;
  appointmentsChangePct: number | null;
  talkTimeChangePct: number | null;
};

export function CallsMetrics({
  metrics,
  loading = false,
  degraded = false,
}: {
  metrics: CallsMetricsData | null;
  loading?: boolean;
  degraded?: boolean;
}) {
  const items = [
    {
      label: "Calls Answered",
      value: metrics ? String(metrics.answered) : "—",
      trendPct: metrics?.answeredChangePct ?? null,
    },
    {
      label: "New Leads",
      value: metrics ? String(metrics.leads) : "—",
      trendPct: metrics?.leadsChangePct ?? null,
    },
    {
      label: "Appointments",
      value: metrics ? String(metrics.appointments) : "—",
      trendPct: metrics?.appointmentsChangePct ?? null,
    },
    {
      label: "Total Talk Time",
      value: metrics ? fmtTalkTime(metrics.talkTimeSeconds) : "—",
      trendPct: metrics?.talkTimeChangePct ?? null,
    },
  ];

  return (
    <TransovoKpiStrip
      variant="inline"
      loading={loading}
      degraded={degraded}
      items={items}
    />
  );
}
