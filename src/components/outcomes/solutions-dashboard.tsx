import type {
  FeaturedBadge,
  SolutionsDashboardData,
} from "@/lib/outcomes/dashboard-data";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CalendarDays,
  Clock3,
  Moon,
  Phone,
  PhoneMissed,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";

const iconMap = {
  "phone-missed": PhoneMissed,
  moon: Moon,
  calendar: CalendarDays,
  welcome: Banknote,
  sparkles: Sparkles,
  reactivate: RefreshCw,
  phone: Phone,
  star: Star,
  clock: Clock3,
  users: Users,
} as const;

function StatusBadge({
  badge,
  label,
}: {
  badge: FeaturedBadge;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold leading-none",
        badge === "runs" && "bg-slate-100 text-slate-600",
        badge === "active" && "bg-emerald-50 text-emerald-700",
        badge === "draft" && "bg-amber-50 text-amber-700",
      )}
    >
      {label}
    </span>
  );
}

function ActiveStatusBadge({
  status,
  label,
}: {
  status: "active" | "draft" | "running";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold leading-none",
        status === "active" && "bg-emerald-50 text-emerald-700",
        status === "draft" && "bg-amber-50 text-amber-700",
        status === "running" && "bg-sky-50 text-sky-700",
      )}
    >
      {label}
    </span>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const w = 78;
  const h = 24;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 text-[#3B82F6]"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function SolutionsDashboardView({ data }: { data: SolutionsDashboardData }) {
  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[640px]">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#111827]">
            Solutions Dashboard
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#6B7280]">
            Choose from our library of pre-built solutions to supercharge your
            business.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link
            href="/outcomes/custom-automation"
            className="inline-flex h-9 items-center gap-1 text-[13px] font-semibold text-[#3B82F6] hover:text-[#2563EB]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Solution
          </Link>
          <Link
            href="/outcomes/answer-every-call"
            className="inline-flex h-9 items-center rounded-lg bg-[#3B82F6] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#2563EB]"
          >
            View All Solutions
          </Link>
        </div>
      </div>

      {/* Featured grid */}
      <section>
        <h3 className="mb-3.5 text-[16px] font-bold tracking-tight text-[#111827]">
          What do you want Transovo to handle?
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.featured.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex min-h-[180px] flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      card.iconTone,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <StatusBadge badge={card.badge} label={card.badgeLabel} />
                </div>
                <h4 className="mt-3.5 text-[15px] font-bold tracking-tight text-[#111827]">
                  {card.title}
                </h4>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.45] text-[#6B7280]">
                  {card.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-[#6B7280]">
                    <span>{card.metricPrimary}</span>
                    <span className="text-[#D1D5DB]">·</span>
                    <span>{card.metricSecondary}</span>
                  </div>
                  <Link
                    href={card.href}
                    className={cn(
                      "inline-flex h-8 items-center rounded-md px-3 text-[12px] font-semibold transition",
                      card.actionTone === "primary"
                        ? "bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                        : "border border-[#E5E7EB] bg-white text-[#111827] hover:bg-slate-50",
                    )}
                  >
                    {card.actionLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Middle row — three separate panels */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Action Needed */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 border-b border-[#F3F4F6] px-5 py-4">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <h3 className="text-[14px] font-bold text-[#111827]">Action Needed</h3>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.actionNeeded.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#111827]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#6B7280]">
                    {item.description}
                  </p>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex h-8 shrink-0 items-center rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-semibold text-[#111827] hover:bg-slate-50"
                >
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* The Active Solutions */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="text-[14px] font-bold text-[#111827]">
              The Active Solutions
            </h3>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_78px_72px] items-center gap-x-2 border-b border-[#E5E7EB] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
            <span>Solution</span>
            <span className="text-center">Activity</span>
            <span className="text-right">Status</span>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.activeSolutions.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="grid grid-cols-[minmax(0,1fr)_78px_72px] items-center gap-x-2 px-5 py-3 hover:bg-slate-50"
                >
                  <span className="truncate text-[13px] font-semibold text-[#111827]">
                    {row.label}
                  </span>
                  <span className="flex justify-center">
                    <MiniSparkline values={row.sparkline} />
                  </span>
                  <span className="flex justify-end">
                    <ActiveStatusBadge status={row.status} label={row.statusLabel} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Events */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="text-[14px] font-bold text-[#111827]">Recent Events</h3>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.activity.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                    <span className="text-[13px] font-medium leading-snug text-[#111827]">
                      {row.title}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 text-[11px] text-[#9CA3AF]">
                    {row.when}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recommended Next */}
      <section>
        <h3 className="mb-3.5 text-[16px] font-bold tracking-tight text-[#111827]">
          Recommended Next
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {data.recommended.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    card.iconTone,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#111827]">
                  {card.title}
                </span>
                <Link
                  href={card.href}
                  className="inline-flex h-8 shrink-0 items-center rounded-md bg-[#3B82F6] px-3 text-[12px] font-semibold text-white hover:bg-[#2563EB]"
                >
                  Set Up
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom stats */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.weekStats.map((stat) => {
          const Icon = iconMap[stat.icon];
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    stat.iconTone,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="leading-snug tracking-tight text-[#111827]">
                    <span className="text-[22px] font-bold tabular-nums">
                      {stat.value}
                    </span>{" "}
                    <span className="text-[13px] font-semibold text-[#4B5563]">
                      {stat.label}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[12px] font-medium",
                      stat.deltaTone === "up" && "text-emerald-600",
                      stat.deltaTone === "down" && "text-rose-500",
                      stat.deltaTone === "flat" && "text-[#9CA3AF]",
                    )}
                  >
                    {stat.deltaLabel}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
