import { Button } from "@/components/ui/button";
import { loadSolutionDashboard } from "@/lib/solution-dashboard";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { cn, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

function Sparkline({
  points,
  color = "#10b981",
  width = 72,
  height = 28,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!points.length || points.every((p) => p === 0)) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
    return <span className="text-[12px] font-medium text-muted-foreground">—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "text-[12px] font-semibold",
        positive ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

const contactStatusTone: Record<string, string> = {
  New: "bg-sky-50 text-sky-700",
  Engaged: "bg-emerald-50 text-emerald-700",
  Lead: "bg-amber-50 text-amber-800",
  Subscribed: "bg-emerald-50 text-emerald-700",
  Unsubscribed: "bg-orange-50 text-orange-700",
  Blocked: "bg-rose-50 text-rose-700",
  Invalid: "bg-slate-100 text-slate-600",
};

export default async function DashboardPage() {
  const { session, workspaceId } = await requireWorkspaceContext();
  const data = await loadSolutionDashboard(workspaceId, session.name);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">{data.todayLabel}</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold tracking-tight text-foreground">
            Welcome back, {data.userName}!
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
            Here&apos;s what&apos;s happening with {data.workspaceName} — outcomes from your
            solutions over the last 30 days.
          </p>
        </div>
        <Link href="/solutions">
          <Button variant="outline" className="h-9 gap-1.5 rounded-[10px] text-[13px]">
            <Sparkles className="h-3.5 w-3.5" />
            Browse solutions
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.solutionKpis.map((kpi) => (
          <Link
            key={kpi.id}
            href={kpi.href}
            className="surface group rounded-[12px] bg-card p-4 transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-medium text-muted-foreground">{kpi.title}</p>
              {!kpi.configured ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  Setup
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-[24px] font-bold tracking-tight text-foreground">
                  {formatNumber(kpi.value)}
                </p>
                <div className="mt-1">
                  <Delta value={kpi.deltaPct} />
                </div>
              </div>
              <Sparkline points={kpi.sparkline} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
              <span className="text-[11px] text-muted-foreground">
                {kpi.metaLabel}: {kpi.metaValue}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary opacity-80 group-hover:opacity-100">
                Open
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {data.alerts.map((alert) => (
        <div
          key={alert.detail}
          className="flex flex-col gap-3 rounded-[12px] border border-amber-200/80 bg-[#fff8e8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-[13px] font-semibold text-amber-950">{alert.title}</p>
              <p className="mt-0.5 text-[12px] text-amber-900/80">{alert.detail}</p>
            </div>
          </div>
          <Link href={alert.href}>
            <Button
              variant="outline"
              className="h-9 rounded-[10px] border-amber-300 bg-white text-[13px]"
            >
              Fix now
            </Button>
          </Link>
        </div>
      ))}

      <section className="surface rounded-[12px] bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-foreground">Business performance</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Snapshot across leads, calls, bookings, and messaging.
            </p>
          </div>
          <Link href="/reports" className="text-[12px] font-semibold text-primary hover:underline">
            View reports
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {data.snapshot.map((metric) => (
            <Link
              key={metric.label}
              href={metric.href}
              className="rounded-[12px] border border-border/80 px-3 py-3 transition hover:border-primary/30 hover:bg-muted/30"
            >
              <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-[20px] font-bold tracking-tight">{metric.value}</p>
                <Sparkline points={metric.sparkline} width={56} height={24} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-foreground">Active solution performance</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Deeper stats for the solutions driving recovery, reviews, and bookings.
            </p>
          </div>
          <Link href="/solutions" className="text-[12px] font-semibold text-primary hover:underline">
            Solution Center
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.solutionPerformance.map((block) => (
            <Link
              key={block.id}
              href={block.href}
              className="surface rounded-[12px] bg-card p-4 transition hover:shadow-md"
            >
              <p className="text-[13px] font-semibold text-foreground">{block.title}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {block.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-[16px] font-bold tracking-tight">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-12">
        <section className="surface rounded-[12px] bg-card p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground">Recent contacts</h3>
            <Link href="/contacts" className="text-[12px] font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {data.recentContacts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentContacts.map((contact) => (
                <li key={contact.id}>
                  <Link
                    href={contact.href}
                    className="flex items-center gap-3 py-2.5 transition hover:bg-muted/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground">
                      {contact.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {contact.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {contact.lastActivity}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                        contactStatusTone[contact.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {contact.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface rounded-[12px] bg-card p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground">Latest activity</h3>
            <Link href="/inbox" className="text-[12px] font-semibold text-primary hover:underline">
              Open inbox
            </Link>
          </div>
          {data.activity.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Activity from calls, bookings, forms, and inbox will show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-[10px] border border-border/70 px-3 py-2.5 transition hover:border-primary/30 hover:bg-muted/30"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-foreground">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {item.at.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                      {item.detail}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-3 xl:col-span-4">
          <section className="surface rounded-[12px] bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-foreground">Get started with Transovo</h3>
              <span className="text-[11px] font-medium text-muted-foreground">
                {data.onboarding.filter((s) => s.done).length}/{data.onboarding.length}
              </span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${
                    data.onboarding.length
                      ? (data.onboarding.filter((s) => s.done).length / data.onboarding.length) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
            <ul className="space-y-1.5">
              {data.onboarding.map((step) => (
                <li key={step.id}>
                  {step.done ? (
                    <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span>{step.label}</span>
                    </div>
                  ) : (
                    <Link
                      href={step.href}
                      className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] hover:bg-muted"
                    >
                      <Circle className="h-4 w-4 text-muted-foreground" />
                      <span>{step.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="surface rounded-[12px] bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-foreground">
                {data.teamStats[0]?.label === "leads" ? "Top sources" : "Team activity"}
              </h3>
              <Link
                href="/settings/users"
                className="text-[12px] font-semibold text-primary hover:underline"
              >
                Team
              </Link>
            </div>
            {data.teamStats.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Team call volume and lead sources will appear as activity grows.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.teamStats.map((row) => (
                  <li
                    key={row.name}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-border/70 px-3 py-2"
                  >
                    <span className="truncate text-[13px] font-medium">{row.name}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">
                      {formatNumber(row.count)} {row.label}
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
