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

function TrendPill({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const label = pct >= 0 ? `+${pct}% vs last 7 days` : `${pct}% vs last 7 days`;
  return (
    <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      {label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  changePct,
}: {
  icon: typeof Phone;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  changePct: number | null;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[28px] font-semibold tabular-nums leading-none tracking-tight text-[#111827]">
            {value}
          </p>
          <p className="mt-2 text-sm font-medium text-[#6b7280]">{label}</p>
          <TrendPill pct={changePct} />
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

export function CallsMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={Phone}
        iconBg="bg-[#eef2ff]"
        iconColor="text-[#6366f1]"
        label="Calls Answered"
        value={String(metrics.answered)}
        changePct={metrics.answeredChangePct}
      />
      <MetricCard
        icon={UserPlus}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        label="New Leads"
        value={String(metrics.leads)}
        changePct={metrics.leadsChangePct}
      />
      <MetricCard
        icon={Calendar}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
        label="Appointments"
        value={String(metrics.appointments)}
        changePct={metrics.appointmentsChangePct}
      />
      <MetricCard
        icon={Clock}
        iconBg="bg-sky-50"
        iconColor="text-sky-600"
        label="Total Talk Time"
        value={fmtTalkTime(metrics.talkTimeSeconds)}
        changePct={metrics.talkTimeChangePct}
      />
    </div>
  );
}
