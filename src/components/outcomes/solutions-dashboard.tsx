import type {
  FeaturedBadge,
  SolutionsDashboardData,
} from "@/lib/outcomes/dashboard-data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarDays,
  LayoutGrid,
  Mail,
  MessageSquare,
  Moon,
  Phone,
  PhoneMissed,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const iconMap = {
  "phone-missed": PhoneMissed,
  moon: Moon,
  calendar: CalendarDays,
  mail: Mail,
  users: Users,
  menu: LayoutGrid,
  star: Star,
  message: MessageSquare,
  phone: Phone,
} as const;

function Badge({ badge, label }: { badge: FeaturedBadge; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold leading-none",
        badge === "setup" && "bg-[#2563eb]/10 text-[#2563eb]",
        badge === "recommended" && "bg-violet-100 text-violet-700",
        badge === "new" && "bg-emerald-100 text-emerald-700",
        badge === "active" && "bg-emerald-100 text-emerald-700",
        badge === "edit" && "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

function PillButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-[12px] font-semibold transition",
        variant === "primary" &&
          "bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]",
        variant === "outline" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      {children}
    </Link>
  );
}

export function SolutionsDashboardView({ data }: { data: SolutionsDashboardData }) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-bold tracking-[-0.025em] text-slate-900">
            Solutions Dashboard
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
            A high-level view of your current solutions and suggestions on how to
            improve your business.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/outcomes/custom-automation"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New Solution
          </Link>
          <Link
            href="/numbers"
            className="inline-flex h-9 items-center rounded-lg bg-[#2563eb] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
          >
            Add Number
          </Link>
        </div>
      </div>

      {/* Featured solution cards */}
      <section>
        <h3 className="mb-3 text-[16px] font-bold tracking-tight text-slate-900">
          What do you want Transovo to handle?
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.featured.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex min-h-[132px] flex-col rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      card.iconTone,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[14px] font-bold tracking-tight text-slate-900">
                        {card.title}
                      </h4>
                      <Badge badge={card.badge} label={card.badgeLabel} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500">
                      {card.description}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3 text-[11px] font-medium text-slate-500">
                      <span>{card.metricPrimary}</span>
                      <span className="text-slate-300">·</span>
                      <span>{card.metricSecondary}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex justify-end pt-3">
                  <PillButton
                    href={card.href}
                    variant={
                      card.actionLabel === "Set Up" || card.badge === "new"
                        ? "primary"
                        : "outline"
                    }
                  >
                    {card.actionLabel}
                  </PillButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Middle utility row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h3 className="text-[14px] font-bold text-slate-900">Needs Attention</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {data.attention.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"
              >
                <span className="text-[13px] font-medium text-slate-800">
                  {item.title}
                </span>
                <PillButton href={item.href} variant="outline">
                  {item.actionLabel}
                </PillButton>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-[14px] font-bold text-slate-900">Top Active Solutions</h3>
          <ul className="mt-3 space-y-2">
            {data.activeSolutions.map((row) => {
              const Icon = iconMap[row.icon];
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      row.iconTone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">
                    {row.label}
                  </span>
                  <PillButton href={row.href} variant="outline">
                    {row.actionLabel}
                  </PillButton>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-[14px] font-bold text-slate-900">Recent Activity</h3>
          <ul className="mt-3 space-y-2.5">
            {data.activity.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                    <span className="truncate text-[13px] font-medium text-slate-800">
                      {row.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{row.when}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recommended Next */}
      <section>
        <h3 className="mb-3 text-[16px] font-bold tracking-tight text-slate-900">
          Recommended Next
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {data.recommended.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex min-w-[220px] flex-1 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    card.iconTone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">
                  {card.title}
                </span>
                <Link
                  href={card.href}
                  className="inline-flex h-7 items-center rounded-md bg-[#2563eb]/10 px-2.5 text-[11px] font-semibold text-[#2563eb] hover:bg-[#2563eb]/15"
                >
                  Add
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
          const up = stat.deltaPct >= 0;
          const Trend = up ? TrendingUp : TrendingDown;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/10 text-[#2563eb]">
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold",
                    up ? "text-emerald-600" : "text-rose-500",
                  )}
                >
                  <Trend className="h-3 w-3" />
                  {up ? "+" : ""}
                  {stat.deltaPct}% last 7 days
                </span>
              </div>
              <p className="mt-3 text-[22px] font-bold tracking-tight text-slate-900">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
