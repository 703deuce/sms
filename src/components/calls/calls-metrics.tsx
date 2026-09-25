import { TransovoKpiStrip } from "@/components/transovo/kpi-strip";
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

export function CallsMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <TransovoKpiStrip
      items={[
        {
          icon: Phone,
          label: "Calls Answered",
          value: String(metrics.answered),
          trendPct: metrics.answeredChangePct,
        },
        {
          icon: UserPlus,
          label: "New Leads",
          value: String(metrics.leads),
          trendPct: metrics.leadsChangePct,
        },
        {
          icon: Calendar,
          label: "Appointments",
          value: String(metrics.appointments),
          trendPct: metrics.appointmentsChangePct,
        },
        {
          icon: Clock,
          label: "Total Talk Time",
          value: fmtTalkTime(metrics.talkTimeSeconds),
          trendPct: metrics.talkTimeChangePct,
        },
      ]}
    />
  );
}
