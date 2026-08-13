import { fmtTalkTime } from "@/lib/voice/calls/display";
import { Calendar, Clock, Phone, UserPlus } from "lucide-react";

type Metrics = {
  answered: number;
  leads: number;
  appointments: number;
  talkTimeSeconds: number;
  answeredChangePct: number | null;
  leadsChangePct: number | null;
  appointmentsChangePct: number | null;
  talkTimeChangePct: number | null;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  changePct,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  changePct: number | null;
}) {
  const changeLabel =
    changePct == null
      ? null
      : changePct >= 0
        ? `+ ${changePct}% from last 7 days`
        : `${changePct}% from last 7 days`;

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-[#111827]">
            {value}
          </p>
          <p className="mt-1 text-sm font-medium text-[#374151]">{label}</p>
          {changeLabel ? (
            <p className="mt-1 text-xs text-[#6b7280]">{changeLabel}</p>
          ) : null}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#6366f1]">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

export function CallsMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={Phone}
        label="Calls Answered"
        value={String(metrics.answered)}
        changePct={metrics.answeredChangePct}
      />
      <MetricCard
        icon={UserPlus}
        label="New Leads"
        value={String(metrics.leads)}
        changePct={metrics.leadsChangePct}
      />
      <MetricCard
        icon={Calendar}
        label="Appointments"
        value={String(metrics.appointments)}
        changePct={metrics.appointmentsChangePct}
      />
      <MetricCard
        icon={Clock}
        label="Total Talk Time"
        value={fmtTalkTime(metrics.talkTimeSeconds)}
        changePct={metrics.talkTimeChangePct}
      />
    </div>
  );
}
