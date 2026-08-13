"use client";

import type {
  DashboardDateRange,
  OperationalDashboardData,
} from "@/lib/outcomes/operational-dashboard";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronDown,
  FileText,
  MessageSquare,
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

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        active ? "bg-emerald-500" : "bg-amber-400",
      )}
    />
  );
}

function AttentionDot({ tone }: { tone: "red" | "yellow" | "green" }) {
  if (tone === "green") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-violet-600">
        ✓
      </span>
    );
  }
  return (
    <span
      className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
        tone === "red" ? "bg-red-500" : "bg-amber-400",
      )}
    />
  );
}

function CallsWeekChart({
  days,
}: {
  days: OperationalDashboardData["chart"]["days"];
}) {
  const max = Math.max(
    1,
    ...days.map((d) => d.leads + d.existing + d.other),
  );
  const ticks = [0, 10, 20, 30, 40];

  return (
    <div className="flex h-full min-h-[220px] flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] font-medium text-[#6b7280]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#6366f1]" />
          New Leads
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" />
          Existing Customers
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#d6b28a]" />
          Other
        </span>
      </div>
      <div className="flex flex-1 items-end gap-3">
        <div className="flex h-[180px] flex-col justify-between pr-2 text-[10px] tabular-nums text-[#9ca3af]">
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <span key={t}>{t}</span>
            ))}
        </div>
        <div className="flex flex-1 items-end justify-between gap-2 border-b border-[#e5e7eb] pb-1">
          {days.map((day, idx) => {
            const total = day.leads + day.existing + day.other;
            const barMaxPx = 160;
            const barHeight = Math.round((total / max) * barMaxPx);
            return (
              <div key={idx} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="flex w-full max-w-[36px] flex-col justify-end overflow-hidden rounded-t-md"
                  style={{ height: barMaxPx }}
                >
                  <div
                    className="flex w-full flex-col overflow-hidden rounded-t-md"
                    style={{ height: barHeight || 0, minHeight: total ? 4 : 0 }}
                  >
                    {day.leads > 0 ? (
                      <div
                        className="w-full bg-[#6366f1]"
                        style={{ height: `${(day.leads / total) * 100}%` }}
                      />
                    ) : null}
                    {day.existing > 0 ? (
                      <div
                        className="w-full bg-[#3b82f6]"
                        style={{ height: `${(day.existing / total) * 100}%` }}
                      />
                    ) : null}
                    {day.other > 0 ? (
                      <div
                        className="w-full bg-[#d6b28a]"
                        style={{ height: `${(day.other / total) * 100}%` }}
                      />
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

function ProgressBar({
  value,
  max,
  tone = "primary",
}: {
  value: number;
  max: number;
  tone?: "primary" | "success";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "success" ? "bg-violet-500" : "bg-[#6366f1]",
        )}
        style={{ width: `${pct}%` }}
      />
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

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
            {data.greeting}, {data.userName}
          </h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">
            Here&apos;s what Transovo handled for you today.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setRangeOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] font-semibold text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            {rangeLabel}
            <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
          </button>
          {rangeOpen ? (
            <div className="absolute right-0 top-11 z-20 min-w-[160px] rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRangeChange(opt.id)}
                  className={cn(
                    "block w-full px-3 py-2 text-left text-[13px] font-medium hover:bg-[#f3f4f6]",
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
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-8">
            <div className="flex items-start gap-2.5">
              <StatusDot active={data.receptionist.active} />
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">
                  {data.receptionist.name} is{" "}
                  {data.receptionist.active ? "active" : "paused"}
                </p>
                <p className="text-[13px] text-[#6b7280]">
                  Answering every call · {data.receptionist.phoneDisplay}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <StatusDot active={data.sms.ready} />
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">
                  {data.sms.label}
                </p>
                <p className="text-[13px] text-[#6b7280]">{data.sms.sublabel}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={data.receptionist.editHref}
              className="inline-flex h-9 items-center rounded-lg border border-[#d1d5db] bg-white px-4 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
            >
              Edit Receptionist
            </Link>
            <Link
              href={data.receptionist.testHref}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#6366f1] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#4f46e5]"
            >
              <Phone className="h-4 w-4" />
              Test {data.receptionist.name}
            </Link>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Calls Answered",
            value: data.kpis.callsAnswered,
            hint: data.kpis.callsAnsweredHint,
            icon: Phone,
            iconBg: "bg-[#eef2ff]",
            iconColor: "text-[#6366f1]",
          },
          {
            label: "New Leads",
            value: data.kpis.newLeads,
            hint: data.kpis.newLeadsHint,
            icon: UserPlus,
            iconBg: "bg-violet-50",
            iconColor: "text-violet-600",
          },
          {
            label: "Appointments Booked",
            value: data.kpis.appointmentsBooked,
            hint: data.kpis.appointmentsHint,
            icon: Calendar,
            iconBg: "bg-indigo-50",
            iconColor: "text-indigo-600",
          },
          {
            label: "Messages Taken",
            value: data.kpis.messagesTaken,
            hint: data.kpis.messagesHint,
            icon: FileText,
            iconBg: "bg-[#eef2ff]",
            iconColor: "text-[#6366f1]",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[28px] font-bold tabular-nums leading-none text-[#111827]">
                  {kpi.value}
                </p>
                <p className="mt-2 text-[13px] font-medium text-[#6b7280]">
                  {kpi.label}
                </p>
                <p className="mt-1 text-[12px] text-[#9ca3af]">{kpi.hint}</p>
              </div>
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[10px]",
                  kpi.iconBg,
                  kpi.iconColor,
                )}
              >
                <kpi.icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + attention */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-[15px] font-bold text-[#111827]">Calls this week</h2>
          <div className="mt-4">
            <CallsWeekChart days={data.chart.days} />
          </div>
        </div>
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-bold text-[#111827]">
            Needs Your Attention
          </h2>
          <ul className="mt-4 space-y-4">
            {data.attention.map((item) => (
              <li key={item.id} className="flex gap-3">
                <AttentionDot tone={item.tone} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#111827]">
                    {item.title}
                  </p>
                  {item.body ? (
                    <p className="mt-0.5 text-[12px] text-[#6b7280]">{item.body}</p>
                  ) : null}
                  <Link
                    href={item.href}
                    className="mt-1 inline-block text-[12px] font-semibold text-[#6366f1] hover:underline"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent calls + SMS + Automations */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-[#f3f4f6] px-5 py-3.5">
            <h2 className="text-[15px] font-bold text-[#111827]">Recent Calls</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="px-5 py-2">Name</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2 text-right">Voice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {data.recentCalls.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f9fafb]">
                    <td className="px-5 py-3 font-semibold text-[#111827]">
                      <Link href={row.href} className="hover:text-[#6366f1]">
                        {row.name}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-[#6b7280]">
                      {row.reason}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                          row.statusClass,
                        )}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#6b7280]">
                      {row.duration}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[#6b7280]">
                      {row.time}
                    </td>
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
          <div className="border-t border-[#f3f4f6] px-5 py-3">
            <Link
              href="/voice/calls"
              className="text-[13px] font-semibold text-[#6366f1] hover:underline"
            >
              View all calls →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#6366f1]" />
            <h2 className="text-[15px] font-bold text-[#111827]">SMS</h2>
          </div>
          <div className="mt-4 flex gap-6 text-[13px]">
            <div>
              <p className="text-[22px] font-bold text-[#111827]">
                {data.smsPanel.sent}
              </p>
              <p className="text-[12px] text-[#6b7280]">Sent</p>
            </div>
            <div>
              <p className="text-[22px] font-bold text-[#111827]">
                {data.smsPanel.replies}
              </p>
              <p className="text-[12px] text-[#6b7280]">Replies</p>
            </div>
          </div>
          {data.smsPanel.campaign ? (
            <div className="mt-4 rounded-lg border border-[#f3f4f6] bg-[#f9fafb] p-3">
              <p className="text-[13px] font-semibold text-[#111827]">
                {data.smsPanel.campaign.name}
              </p>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                {data.smsPanel.campaign.sent} / {data.smsPanel.campaign.total} sent
              </p>
              <ProgressBar
                value={data.smsPanel.campaign.sent}
                max={data.smsPanel.campaign.total}
                tone="success"
              />
              <p className="mt-1 text-[11px] font-medium text-[#6b7280]">
                {data.smsPanel.campaign.pct}%
              </p>
              <Link
                href={data.smsPanel.campaign.href}
                className="mt-2 inline-block text-[12px] font-semibold text-[#6366f1] hover:underline"
              >
                View Campaign →
              </Link>
            </div>
          ) : data.smsPanel.empty ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#e5e7eb] p-3">
              <p className="text-[13px] font-semibold text-[#111827]">
                {data.smsPanel.empty.title}
              </p>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                {data.smsPanel.empty.body}
              </p>
              <Link
                href={data.smsPanel.empty.href}
                className="mt-2 inline-block text-[12px] font-semibold text-[#6366f1] hover:underline"
              >
                {data.smsPanel.empty.actionLabel}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-[#6366f1]" />
            <h2 className="text-[15px] font-bold text-[#111827]">Automations</h2>
          </div>
          <p className="mt-3 text-[13px] text-[#6b7280]">
            <span className="font-bold text-[#111827]">
              {data.automationsPanel.activeCount} Active
            </span>
            · {data.automationsPanel.runsThisWeek} runs this week
            {data.automationsPanel.failedCount > 0
              ? ` · ${data.automationsPanel.failedCount} failed`
              : ""}
          </p>
          <ul className="mt-4 space-y-2">
            {data.automationsPanel.flows.map((flow) => (
              <li
                key={flow.name}
                className="flex items-center justify-between rounded-lg bg-[#f9fafb] px-3 py-2 text-[12px]"
              >
                <span className="font-medium text-[#111827]">{flow.name}</span>
                <span className="text-violet-600">{flow.status}</span>
              </li>
            ))}
          </ul>
          <Link
            href={data.automationsPanel.href}
            className="mt-4 inline-block text-[12px] font-semibold text-[#6366f1] hover:underline"
          >
            View Automations →
          </Link>
        </div>
      </div>

      {/* Plan usage */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-bold text-[#111827]">Plan Usage</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-[#374151]">Receptionist</span>
              <span className="tabular-nums text-[#6b7280]">
                {data.planUsage.receptionistMinutesUsed} /{" "}
                {data.planUsage.receptionistMinutesLimit} minutes
              </span>
            </div>
            <ProgressBar
              value={data.planUsage.receptionistMinutesUsed}
              max={data.planUsage.receptionistMinutesLimit}
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-[#374151]">SMS</span>
              <span className="tabular-nums text-[#6b7280]">
                {data.planUsage.smsMessagesUsed.toLocaleString()} /{" "}
                {data.planUsage.smsMessagesLimit.toLocaleString()} messages
              </span>
            </div>
            <ProgressBar
              value={data.planUsage.smsMessagesUsed}
              max={data.planUsage.smsMessagesLimit}
              tone="success"
            />
          </div>
        </div>
        <p className="mt-4 text-[12px] text-[#9ca3af]">
          {data.planUsage.daysLeftInCycle} days left in billing cycle
        </p>
      </div>

      {data.isDemo ? (
        <p className="text-center text-[11px] text-[#9ca3af]">
          Showing sample dashboard data — place a call or send a message to see live
          activity.
        </p>
      ) : null}
    </div>
  );
}
