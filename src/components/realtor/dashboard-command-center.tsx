import type {
  RealtorAmyActivityItem,
  RealtorAttentionKind,
  RealtorDashboardAppointment,
  RealtorLeadRow,
  RealtorNeedsAttentionItem,
} from "@/lib/realtor/types";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Headphones,
  MessageSquare,
  Phone,
  Star,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

function attentionBadge(kind: RealtorAttentionKind): string {
  switch (kind) {
    case "hot_buyer":
      return "HOT BUYER";
    case "transfer_missed":
      return "TRANSFER MISSED";
    case "ai_needs_help":
      return "AI NEEDS HELP";
    default:
      return "NEEDS YOU";
  }
}

function badgeColor(kind: RealtorAttentionKind): string {
  switch (kind) {
    case "hot_buyer":
      return "bg-red-100 text-red-700";
    case "transfer_missed":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: string;
  href: string;
}) {
  return (
    <Link href={href} className="realtor-card block p-4 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-[#6b7280]">{label}</p>
          <p className="mt-2 text-[28px] font-bold text-[#111827]">{value}</p>
          <p className="mt-1 text-[12px] text-emerald-600">{hint}</p>
        </div>
        <span className={cnIcon(tone)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}

function cnIcon(tone: string): string {
  return `flex h-10 w-10 items-center justify-center rounded-[10px] ${tone}`;
}

export function RealtorDashboardView({
  greeting,
  amyWorkedSummary,
  amy,
  metrics,
  metricHrefs,
  needsAttention,
  amyActivity,
  appointments,
  leadSources,
  funnel,
  aiPerformance,
  recentActivity,
}: {
  greeting: string;
  amyWorkedSummary: string;
  amy: { frontDeskActive: boolean; speedToLeadActive: boolean; phoneE164?: string | null };
  metrics: {
    newLeads: number;
    worked: number;
    conversations: number;
    qualified: number;
    appointments: number;
  };
  metricHrefs: Record<string, string>;
  needsAttention: RealtorNeedsAttentionItem[];
  amyActivity: RealtorAmyActivityItem[];
  appointments: RealtorDashboardAppointment[];
  leadSources: Array<{ name: string; count: number }>;
  funnel: {
    leads: number;
    worked: number;
    conversations: number;
    qualified: number;
    appointments: number;
  };
  aiPerformance: {
    totalCalls: number;
    avgDurationSec: number;
    qualificationRate: number;
    appointmentRate: number;
  };
  recentActivity: Array<{ id: string; title: string; at: string }>;
}) {
  const totalSource = leadSources.reduce((s, x) => s + x.count, 0) || metrics.newLeads || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">{greeting} 👋</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">{amyWorkedSummary}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="realtor-card flex items-center gap-3 px-4 py-3">
            <Headphones className="h-5 w-5 text-[#2563eb]" />
            <div>
              <p className="text-[12px] font-semibold text-[#111827]">Front Desk</p>
              <p className="text-[12px] text-[#6b7280]">
                {amy.frontDeskActive ? "Amy is active" : "Off"}
              </p>
            </div>
            <Link href="/realtor/agents/front-desk" className="text-[12px] font-semibold text-[#2563eb]">
              View
            </Link>
          </div>
          <div className="realtor-card flex items-center gap-3 px-4 py-3">
            <TrendingUp className="h-5 w-5 text-[#8b5cf6]" />
            <div>
              <p className="text-[12px] font-semibold text-[#111827]">Speed-to-Lead</p>
              <p className="text-[12px] text-[#6b7280]">
                {amy.speedToLeadActive ? "Amy is active" : "Off"}
              </p>
            </div>
            <Link href="/realtor/agents/speed-to-lead" className="text-[12px] font-semibold text-[#2563eb]">
              View
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricTile
          label="New Leads"
          value={metrics.newLeads}
          hint="+24% vs yesterday"
          icon={UserPlus}
          tone="bg-blue-50 text-blue-600"
          href={metricHrefs.newLeads}
        />
        <MetricTile
          label="Worked"
          value={metrics.worked}
          hint="+18% vs yesterday"
          icon={Headphones}
          tone="bg-emerald-50 text-emerald-600"
          href={metricHrefs.worked}
        />
        <MetricTile
          label="Conversations"
          value={metrics.conversations}
          hint="+29% vs yesterday"
          icon={MessageSquare}
          tone="bg-purple-50 text-purple-600"
          href={metricHrefs.conversations}
        />
        <MetricTile
          label="Qualified"
          value={metrics.qualified}
          hint="+50% vs yesterday"
          icon={Star}
          tone="bg-orange-50 text-orange-600"
          href={metricHrefs.qualified}
        />
        <MetricTile
          label="Appointments"
          value={metrics.appointments}
          hint="+33% vs yesterday"
          icon={Calendar}
          tone="bg-blue-50 text-blue-600"
          href={metricHrefs.appointments}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="mb-3 text-[16px] font-semibold text-[#111827]">Needs Your Attention</h2>
          <div className="realtor-card divide-y">
            {needsAttention.length ? (
              needsAttention.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badgeColor(item.kind)}`}
                    >
                      {attentionBadge(item.kind)}
                    </span>
                    <p className="mt-2 font-semibold text-[#111827]">{item.leadName}</p>
                    <p className="text-[13px] text-[#374151]">{item.reason}</p>
                    {item.subtitle ? (
                      <p className="mt-1 text-[12px] capitalize text-[#6b7280]">{item.subtitle}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[#9ca3af]">{timeAgo(item.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {item.leadId ? (
                      <Link
                        href={`/phone?contact=${item.leadId}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]"
                      >
                        <Phone className="h-4 w-4 text-[#6b7280]" />
                      </Link>
                    ) : null}
                    <Link
                      href={item.href}
                      className="text-[13px] font-semibold text-[#2563eb]"
                    >
                      View Lead
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-6 text-[14px] text-[#6b7280]">
                You&apos;re caught up. Amy is handling everything.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <h2 className="mb-3 text-[16px] font-semibold text-[#111827]">Amy Working Now</h2>
          <div className="realtor-card divide-y">
            {amyActivity.length ? (
              amyActivity.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={item.href || "#"}
                  className="flex items-start gap-3 p-4 hover:bg-[#f9fafb]"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[#2563eb]">
                    <Headphones className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">
                      {item.kind === "calling"
                        ? "Calling"
                        : item.kind === "following_up"
                          ? "Following Up"
                          : item.kind === "inbound"
                            ? "Inbound Call"
                            : "Waiting"}
                    </p>
                    <p className="font-medium text-[#111827]">{item.title}</p>
                    <p className="text-[12px] text-[#6b7280]">{item.detail}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="p-4 text-[13px] text-[#6b7280]">Amy is ready for the next lead.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-[16px] font-semibold text-[#111827]">Upcoming Appointments</h2>
          <div className="realtor-card divide-y">
            {appointments.length ? (
              appointments.slice(0, 4).map((appt) => (
                <div key={appt.id} className="p-4">
                  <p className="font-semibold text-[#111827]">
                    {new Date(appt.startsAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[13px] text-[#374151]">{appt.serviceName}</p>
                  <p className="text-[12px] text-[#6b7280]">{appt.leadName}</p>
                  {appt.leadId ? (
                    <Link
                      href={`/realtor/leads/${appt.leadId}`}
                      className="mt-2 text-[12px] font-semibold text-[#2563eb]"
                    >
                      View Lead
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="p-4 text-[13px] text-[#6b7280]">No upcoming appointments.</p>
            )}
            <Link
              href="/realtor/appointments"
              className="block p-3 text-center text-[13px] font-semibold text-[#2563eb]"
            >
              View all appointments
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="realtor-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#111827]">Lead Source Performance</h3>
            <span className="text-[11px] text-[#6b7280]">This Week</span>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <div className="relative h-28 w-28 rounded-full border-[10px] border-[#2563eb] border-r-[#8b5cf6] border-b-[#f97316] border-l-[#10b981]">
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <p className="text-[20px] font-bold">{metrics.newLeads}</p>
                  <p className="text-[10px] text-[#6b7280]">New Leads</p>
                </div>
              </div>
            </div>
          </div>
          <ul className="mt-4 space-y-1 text-[12px] text-[#6b7280]">
            {leadSources.slice(0, 4).map((s) => (
              <li key={s.name}>
                {s.name}{" "}
                <span className="font-semibold text-[#111827]">
                  {Math.round((s.count / totalSource) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="realtor-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#111827]">Conversion Funnel</h3>
            <span className="text-[11px] text-[#6b7280]">This Week</span>
          </div>
          <div className="mt-4 space-y-2 text-[13px]">
            {[
              ["New Leads", funnel.leads],
              ["Worked", funnel.worked],
              ["Conversations", funnel.conversations],
              ["Qualified", funnel.qualified],
              ["Appointments", funnel.appointments],
            ].map(([label, val]) => (
              <div key={label as string} className="flex items-center gap-2">
                <div
                  className="h-2 rounded-full bg-[#2563eb]"
                  style={{
                    width: `${funnel.leads ? ((val as number) / funnel.leads) * 100 : 0}%`,
                    minWidth: "8px",
                  }}
                />
                <span className="text-[#374151]">{label}</span>
                <span className="ml-auto font-semibold">{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">AI Performance</h3>
          <ul className="mt-4 space-y-3 text-[13px]">
            <li className="flex justify-between">
              <span>Total Calls Handled</span>
              <span className="font-semibold text-emerald-600">{aiPerformance.totalCalls}</span>
            </li>
            <li className="flex justify-between">
              <span>Avg Call Duration</span>
              <span className="font-semibold">
                {Math.floor(aiPerformance.avgDurationSec / 60)}m {aiPerformance.avgDurationSec % 60}s
              </span>
            </li>
            <li className="flex justify-between">
              <span>Qualification Rate</span>
              <span className="font-semibold text-emerald-600">{aiPerformance.qualificationRate}%</span>
            </li>
            <li className="flex justify-between">
              <span>Appointment Rate</span>
              <span className="font-semibold text-emerald-600">{aiPerformance.appointmentRate}%</span>
            </li>
          </ul>
        </div>

        <div className="realtor-card p-4">
          <h3 className="font-semibold text-[#111827]">Recent Activity</h3>
          <ul className="mt-4 space-y-3">
            {recentActivity.length ? (
              recentActivity.map((item) => (
                <li key={item.id} className="text-[12px]">
                  <p className="font-medium text-[#111827]">{item.title}</p>
                  <p className="text-[#9ca3af]">{timeAgo(item.at)}</p>
                </li>
              ))
            ) : (
              <li className="text-[13px] text-[#6b7280]">No recent activity.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
