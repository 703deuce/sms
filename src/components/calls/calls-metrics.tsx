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
  compact = false,
}: {
  metrics: CallsMetricsData | null;
  loading?: boolean;
  degraded?: boolean;
  /** Pass 3B: single contextual line (values dominate, labels inline) */
  compact?: boolean;
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

  if (compact) {
    return (
      <div
        className="transovo-calls-context-line"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <span className="transovo-calls-context-line__loading">Loading summary…</span>
        ) : degraded ? (
          <span className="transovo-calls-context-line__muted">Summary unavailable</span>
        ) : (
          <>
            <span>
              <strong>{items[0].value}</strong> answered
            </span>
            <span className="transovo-calls-context-line__sep" aria-hidden>·</span>
            <span>
              <strong>{items[1].value}</strong> leads
            </span>
            <span className="transovo-calls-context-line__sep" aria-hidden>·</span>
            <span>
              <strong>{items[2].value}</strong> appointments
            </span>
            <span className="transovo-calls-context-line__sep" aria-hidden>·</span>
            <span>
              <strong>{items[3].value}</strong> talk time
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <TransovoKpiStrip
      variant="inline"
      loading={loading}
      degraded={degraded}
      items={items}
    />
  );
}
