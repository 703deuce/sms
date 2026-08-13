"use client";

import type {
  CallDisposition,
  DashboardDateRange,
  OperationalDashboardData,
} from "@/lib/outcomes/operational-dashboard";
import { dispositionLabel } from "@/lib/outcomes/operational-dashboard";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Headphones,
  MessageSquare,
  Pencil,
  Phone,
  Play,
  UserPlus,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const RANGE_OPTIONS: Array<{ id: DashboardDateRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function ChangePill({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const label = pct >= 0 ? `+${pct}%` : `${pct}%`;
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[12px] font-bold text-emerald-700">
      {label}
    </span>
  );
}

function dispositionBadgeClass(d: CallDisposition): string {
  if (d === "answered") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (d === "voicemail") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
}

function CallsWeekChart({
  days,
}: {
  days: OperationalDashboardData["chart"]["days"];
}) {
  const max = Math.max(
    5,
    ...days.map((d) => d.answered + d.voicemail + d.missed),
  );
  const step = Math.ceil(max / 4);
  const ticks = [0, step, step * 2, step * 3, step * 4];
  const barMaxPx = 160;

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center gap-5 text-[12px] font-medium text-[#6b7280]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#6366f1]" />
          Answered
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#93c5fd]" />
          Voicemail
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#fdba74]" />
          Missed
        </span>
      </div>
      <div className="flex items-end gap-2">
        <div
          className="flex flex-col justify-between pb-6 text-[11px] tabular-nums text-[#9ca3af]"
          style={{ height: barMaxPx }}
        >
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <span key={t}>{t}</span>
            ))}
        </div>
        <div className="flex flex-1 items-end justify-between gap-1 border-b border-[#e5e7eb] pb-1">
          {days.map((day, idx) => {
            const total = day.answered + day.voicemail + day.missed;
            const barHeight = Math.round((total / max) * barMaxPx);
            return (
              <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="flex w-full max-w-[40px] flex-col justify-end"
                  style={{ height: barMaxPx }}
                >
                  <div
                    className="flex w-full flex-col overflow-hidden rounded-t-md"
                    style={{
                      height: barHeight,
                      minHeight: total ? 4 : 0,
                    }}
                  >
                    {total > 0 ? (
                      <>
                        {day.missed > 0 ? (
                          <div
                            className="w-full bg-[#fdba74]"
                            style={{ height: `${(day.missed / total) * 100}%` }}
                          />
                        ) : null}
                        {day.voicemail > 0 ? (
                          <div
                            className="w-full bg-[#93c5fd]"
                            style={{
                              height: `${(day.voicemail / total) * 100}%`,
                            }}
                          />
                        ) : null}
                        {day.answered > 0 ? (
                          <div
                            className="w-full bg-[#6366f1]"
                            style={{
                              height: `${(day.answered / total) * 100}%`,
                            }}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <span className="text-[11px] font-medium text-[#6b7280]">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsageBar({
  value,
  max,
  pct,
  tone = "primary",
}: {
  value: number;
  max: number;
  pct: number;
  tone?: "primary" | "muted";
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-[#6b7280]">
        <span>
          {value.toLocaleString()} / {max.toLocaleString()} used
        </span>
        <span className="font-semibold text-[#374151]">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "primary" ? "bg-[#6366f1]" : "bg-violet-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function OperationalDashboardView({
  initialData,
}: {
  initialData: OperationalDashboardData;
}) {
  const router = useRouter();
  const [range, setRange] = useState<DashboardDateRange>(initialData.dateRange);
  const [rangeOpen, setRangeOpen] = useState(false);
  const data = initialData;

  const rangeLabel = useMemo(
    () => RANGE_OPTIONS.find((r) => r.id === range)?.label ?? "Last 7 days",
    [range],
  );

  function onRangeChange(next: DashboardDateRange) {
    setRange(next);
    setRangeOpen(false);
    router.push(`/outcomes?range=${next}`);
  }

  const kpiCards = [
    {
      label: "Calls Answered",
      value: data.kpis.callsAnswered,
      change: data.kpis.callsAnsweredChangePct,
      icon: Phone,
      iconBg: "bg-[#eef2ff]",
      iconColor: "text-[#6366f1]",
    },
    {
      label: "New Leads",
      value: data.kpis.newLeads,
      change: data.kpis.newLeadsChangePct,
      icon: UserPlus,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      label: "Appointments Booked",
      value: data.kpis.appointmentsBooked,
      change: data.kpis.appointmentsChangePct,
      icon: Calendar,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    {
      label: "Messages Taken",
      value: data.kpis.messagesTaken,
      change: data.kpis.messagesChangePct,
      icon: FileText,
      iconBg: "bg-[#eef2ff]",
      iconColor: "text-[#6366f1]",
    },
  ];

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-[#111827]">
            {data.greeting}, {data.userName}
          </h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Here&apos;s what&apos;s happening with your AI receptionist,{" "}
            {data.receptionist.name}.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setRangeOpen((v) => !v)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3.5 text-[13px] font-semibold text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            <Calendar className="h-4 w-4 text-[#9ca3af]" />
            {rangeLabel}
            <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
          </button>
          {rangeOpen ? (
            <div className="absolute right-0 top-12 z-20 min-w-[168px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRangeChange(opt.id)}
                  className={cn(
                    "block w-full px-3 py-2.5 text-left text-[13px] font-medium hover:bg-[#f3f4f6]",
                    range === opt.id ? "text-[#6366f1]" : "text-[#374151]",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Status strip */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2">
            <div className="flex gap-3 rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#6366f1]">
                <Headphones className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      data.receptionist.active ? "bg-emerald-500" : "bg-amber-400",
                    )}
                  />
                  <p className="text-[14px] font-bold text-[#111827]">
                    {data.receptionist.name} is{" "}
                    {data.receptionist.active ? "active" : "paused"}
                  </p>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-[#6b7280]">
                  Your AI receptionist is online and answering calls.
                </p>
                <p className="mt-0.5 text-[12px] text-[#9ca3af]">
                  Main line · {data.receptionist.phoneDisplay}
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      data.sms.ready ? "bg-emerald-500" : "bg-amber-400",
                    )}
                  />
                  <p className="text-[14px] font-bold text-[#111827]">
                    {data.sms.label}
                  </p>
                  {data.sms.ready ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {data.sms.sublabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-[#6b7280]">
                  {data.sms.detail}
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href={data.receptionist.testHref}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#6366f1] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#4f46e5]"
            >
              <Phone className="h-4 w-4" />
              Test {data.receptionist.name}
            </Link>
            <Link
              href={data.receptionist.editHref}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-4 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
            >
              <Pencil className="h-4 w-4" />
              Edit Receptionist
            </Link>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[10px]",
                  kpi.iconBg,
                  kpi.iconColor,
                )}
              >
                <kpi.icon className="h-5 w-5" />
              </span>
              <ChangePill pct={kpi.change} />
            </div>
            <p className="mt-4 text-[32px] font-bold tabular-nums leading-none text-[#111827]">
              {kpi.value}
            </p>
            <p className="mt-2 text-[13px] font-medium text-[#6b7280]">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + attention */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2">
          <h2 className="text-[16px] font-bold text-[#111827]">Calls this week</h2>
          <CallsWeekChart days={data.chart.days} />
        </div>
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-[#111827]">
            Needs Your Attention
          </h2>
          <ul className="mt-4 divide-y divide-[#f3f4f6]">
            {data.attention.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-start gap-3 py-3.5 transition hover:bg-[#f9fafb] -mx-2 px-2 rounded-lg"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      item.tone === "red" && "bg-red-500",
                      item.tone === "yellow" && "bg-amber-400",
                      item.tone === "green" && "bg-emerald-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-0.5 text-[12px] text-[#6b7280]">
                        {item.body}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#d1d5db] group-hover:text-[#6366f1]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent + SMS + Automations */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-2">
          <div className="border-b border-[#f3f4f6] px-5 py-4">
            <h2 className="text-[16px] font-bold text-[#111827]">Recent Calls</h2>
          </div>
          {data.recentCalls.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#6b7280]">
              No calls yet. Test your receptionist to see activity here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="px-5 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Reason</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Time</th>
                    <th className="px-3 py-2.5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {data.recentCalls.map((row) => (
                    <tr key={row.id} className="hover:bg-[#f9fafb]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-bold text-[#6366f1]">
                            {row.initials}
                          </span>
                          <Link
                            href={row.href}
                            className="font-semibold text-[#111827] hover:text-[#6366f1]"
                          >
                            {row.name}
                          </Link>
                        </div>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-[#6b7280]">
                        {row.reason}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            dispositionBadgeClass(row.disposition),
                          )}
                        >
                          {dispositionLabel(row.disposition)}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-[#6b7280]">
                        {row.duration}
                      </td>
                      <td className="px-3 py-3 text-[#6b7280]">{row.timeLabel}</td>
                      <td className="px-3 py-3 text-right">
                        {row.hasRecording ? (
                          <Link
                            href={row.href}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6366f1] hover:bg-[#eef2ff]"
                            aria-label="Play recording"
                          >
                            <Play className="h-4 w-4 fill-current" />
                          </Link>
                        ) : (
                          <span className="text-[#d1d5db]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-[#f3f4f6] px-5 py-3.5 text-center">
            <Link
              href="/voice/calls"
              className="text-[13px] font-semibold text-[#6366f1] hover:underline"
            >
              View all calls
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#6366f1]" />
            <h2 className="text-[16px] font-bold text-[#111827]">SMS</h2>
          </div>
          <div className="mt-4 flex gap-8">
            <div>
              <p className="text-[26px] font-bold tabular-nums text-[#111827]">
                {data.smsPanel.sent}
              </p>
              <p className="text-[12px] font-medium text-[#6b7280]">Sent</p>
            </div>
            <div>
              <p className="text-[26px] font-bold tabular-nums text-[#111827]">
                {data.smsPanel.replies}
              </p>
              <p className="text-[12px] font-medium text-[#6b7280]">Replies</p>
            </div>
          </div>
          {data.smsPanel.campaign ? (
            <div className="mt-4 rounded-lg border border-[#f3f4f6] bg-[#f9fafb] p-3.5">
              <p className="text-[13px] font-bold text-[#111827]">
                {data.smsPanel.campaign.name}
              </p>
              {data.smsPanel.campaign.endsLabel ? (
                <p className="mt-0.5 text-[11px] text-[#9ca3af]">
                  {data.smsPanel.campaign.endsLabel}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4">
            <UsageBar
              value={data.smsPanel.messagesUsed}
              max={data.smsPanel.messagesLimit}
              pct={data.smsPanel.messagesPct}
              tone="muted"
            />
            <p className="mt-1 text-[11px] text-[#9ca3af]">messages used</p>
          </div>
          <Link
            href="/inbox"
            className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
          >
            View SMS activity
          </Link>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-[#6366f1]" />
            <h2 className="text-[16px] font-bold text-[#111827]">Automations</h2>
          </div>
          <p className="mt-3 text-[13px] text-[#6b7280]">
            <span className="font-bold text-[#111827]">
              {data.automationsPanel.activeCount} Active
            </span>
            automations
          </p>
          <ul className="mt-4 space-y-2">
            {data.automationsPanel.flows.length === 0 ? (
              <li className="text-[12px] text-[#6b7280]">No active flows yet.</li>
            ) : (
              data.automationsPanel.flows.map((flow) => (
                <li
                  key={flow.name}
                  className="flex items-center justify-between rounded-lg bg-[#f9fafb] px-3 py-2.5"
                >
                  <span className="text-[12px] font-medium text-[#111827]">
                    {flow.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </li>
              ))
            )}
          </ul>
          <Link
            href={data.automationsPanel.href}
            className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
          >
            View all automations
          </Link>
        </div>
      </div>

      {/* Plan usage */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-[16px] font-bold text-[#111827]">Plan Usage</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
              <Phone className="h-4 w-4 text-[#6366f1]" />
              Receptionist minutes
            </div>
            <div className="mt-3">
              <UsageBar
                value={data.planUsage.receptionistMinutesUsed}
                max={data.planUsage.receptionistMinutesLimit}
                pct={data.planUsage.receptionistPct}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
              <MessageSquare className="h-4 w-4 text-[#6366f1]" />
              SMS messages
            </div>
            <div className="mt-3">
              <UsageBar
                value={data.planUsage.smsMessagesUsed}
                max={data.planUsage.smsMessagesLimit}
                pct={data.planUsage.smsPct}
                tone="muted"
              />
            </div>
          </div>
        </div>
        <p className="mt-4 text-[12px] text-[#9ca3af]">
          {data.planUsage.daysLeftInCycle} days left in billing cycle
        </p>
      </div>
    </div>
  );
}
