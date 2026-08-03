import { Button } from "@/components/ui/button";
import { loadSolutionDashboard } from "@/lib/solution-dashboard";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { cn, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

function Sparkline({
  points,
  color = "#10b981",
  width = 88,
  height = 32,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!points.length || points.every((p) => p === 0)) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#e2e8f0"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[12px] font-medium text-slate-400">0.0%</span>;
  }
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px] font-semibold",
        positive ? "text-emerald-600" : "text-rose-500",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

const contactStatusTone: Record<string, string> = {
  New: "bg-sky-100 text-sky-700",
  Engaged: "bg-emerald-100 text-emerald-700",
  Lead: "bg-amber-100 text-amber-800",
  Subscribed: "bg-emerald-100 text-emerald-700",
  Unsubscribed: "bg-orange-100 text-orange-700",
  Blocked: "bg-rose-100 text-rose-700",
  Invalid: "bg-slate-100 text-slate-600",
};

export default async function DashboardPage() {
  const { session, workspaceId } = await requireWorkspaceContext();
  const data = await loadSolutionDashboard(workspaceId, session.name);
  const alert = data.alerts[0] ?? null;
  const onboardingDone = data.onboarding.filter((s) => s.done).length;
  const onboardingPct = data.onboarding.length
    ? Math.round((onboardingDone / data.onboarding.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-[22px] font-semibold tracking-tight text-slate-900">
            Welcome back, {data.userName}!{" "}
            <span className="font-medium text-slate-600">
              Here&apos;s what&apos;s happening with {data.workspaceName}.
            </span>
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">{data.todayLabel}</p>
        </div>
        <Link href="/solutions">
          <Button
            variant="outline"
            className="h-9 rounded-lg border-slate-200 bg-white text-[13px] font-semibold text-slate-700 shadow-sm"
          >
            Customize Dashboard
          </Button>
        </Link>
      </div>

      {/* Solution KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.solutionKpis.map((kpi) => (
          <div
            key={kpi.id}
            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold text-slate-500">{kpi.title}</p>
              {!kpi.configured ? (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Setup
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[28px] font-bold leading-none tracking-tight text-slate-900">
                  {formatNumber(kpi.value)}
                </p>
                <div className="mt-2">
                  <Delta value={kpi.deltaPct} />
                </div>
              </div>
              <Sparkline
                points={kpi.sparkline}
                color={kpi.deltaPct != null && kpi.deltaPct < 0 ? "#f43f5e" : "#10b981"}
              />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{kpi.active}</span> Active
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-semibold text-slate-700">{kpi.total}</span> Total
              </p>
              <Link
                href={kpi.href}
                className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
              >
                Go to App
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Single alert banner */}
      {alert ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-[#FFF8E8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[13px] text-amber-950">
              <span className="font-semibold">{alert.title}.</span>{" "}
              <span className="text-amber-900/85">{alert.detail}</span>
            </p>
          </div>
          <Link href={alert.href}>
            <Button
              variant="outline"
              className="h-8 rounded-lg border-amber-300 bg-white px-3 text-[12px] font-semibold"
            >
              Fix now
            </Button>
          </Link>
        </div>
      ) : null}

      {/* Business Performance Snapshot */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)]">
        <h3 className="text-[15px] font-bold text-slate-900">Business Performance Snapshot</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {data.snapshot.map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className="rounded-xl border border-slate-100 bg-[#FBFBFD] px-3 py-3 transition hover:border-emerald-200 hover:bg-white"
            >
              <p className="text-[11px] font-semibold text-slate-500">{metric.label}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-[20px] font-bold tracking-tight text-slate-900">
                  {metric.value}
                </p>
                <Sparkline points={metric.sparkline} width={56} height={24} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Active Solution Performance */}
      <section>
        <h3 className="text-[15px] font-bold text-slate-900">Active Solution Performance</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.solutionPerformance.map((block) => (
            <Link
              key={block.id}
              href={block.href}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)] transition hover:border-emerald-200"
            >
              <p className="text-[13px] font-bold text-slate-900">{block.title}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {block.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-[18px] font-bold tracking-tight text-slate-900">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom 3-column grid */}
      <div className="grid gap-3 xl:grid-cols-3">
        {/* Recent Contacts */}
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-slate-900">Recent Contacts</h3>
            <Link href="/contacts" className="text-[12px] font-semibold text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {data.recentContacts.length === 0 ? (
            <p className="text-[13px] text-slate-500">No contacts yet.</p>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 font-semibold">Name</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentContacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-2">
                        <Link
                          href={contact.href}
                          className="text-[13px] font-semibold text-slate-800 hover:text-emerald-700"
                        >
                          {contact.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            contactStatusTone[contact.status] ?? "bg-slate-100 text-slate-600",
                          )}
                        >
                          {contact.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[12px] text-slate-500">
                        {contact.lastActivity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Latest Activity */}
        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-slate-900">Latest Activity</h3>
            <Link href="/inbox" className="text-[12px] font-semibold text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {data.activity.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              Activity from calls, bookings, forms, and inbox will show up here.
            </p>
          ) : (
            <ul className="space-y-0">
              {data.activity.map((item, index) => (
                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < data.activity.length - 1 ? (
                    <span className="absolute left-[7px] top-3 bottom-0 w-px bg-slate-200" />
                  ) : null}
                  <span className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                  <Link href={item.href} className="min-w-0 flex-1 hover:opacity-90">
                    <p className="text-[13px] font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">{item.detail}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {item.at.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Onboarding + Team Stats */}
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Get started with Transovo</h3>
              <span className="text-[12px] font-semibold text-slate-500">
                {onboardingDone}/{data.onboarding.length}
              </span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${onboardingPct}%` }}
              />
            </div>
            <ul className="space-y-1">
              {data.onboarding.map((step) => (
                <li key={step.id}>
                  {step.done ? (
                    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[13px] text-slate-500">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="line-through decoration-slate-300">{step.label}</span>
                    </div>
                  ) : (
                    <Link
                      href={step.href}
                      className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[13px] text-slate-800 hover:bg-slate-50"
                    >
                      <Circle className="h-4 w-4 text-slate-300" />
                      <span>{step.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.04)]">
            <h3 className="mb-3 text-[15px] font-bold text-slate-900">Team Stats</h3>
            {data.teamStats.length === 0 ? (
              <p className="text-[13px] text-slate-500">
                Team call volume and lead sources will appear as activity grows.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.teamStats.map((row, i) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#FBFBFD] px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
                        {i + 1}
                      </span>
                      <span className="truncate text-[13px] font-semibold text-slate-800">
                        {row.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-slate-500">
                      {formatNumber(row.count)}{" "}
                      <span className="font-medium text-slate-400">{row.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
